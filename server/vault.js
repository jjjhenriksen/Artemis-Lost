import { readFile } from "node:fs/promises";
import path from "node:path";
import { staticVaultRoot } from "./storagePaths.js";
import { getOwnerMirrorPaths } from "./sessionMirrors.js";

async function safeRead(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw Object.assign(new Error("Mission context could not be read. Check storage access and retry."), {
      status: 503, code: "CONTEXT_UNAVAILABLE",
    });
  }
}

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/\b(rim|station|seat|bench|cabin)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function trimToSection(label, content) {
  if (!content) return "";
  return `FILE: ${label}\n${content}`.trim();
}

async function readStaticContext(worldState, activeCrew) {
  const locationSlug = slugify(worldState?.environment?.location);
  const crewId = typeof activeCrew?.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(activeCrew.id)
    ? activeCrew.id : "";

  const [locationFile, crewFile, missionBrief, anomaly] = await Promise.all([
    locationSlug
      ? safeRead(path.join(staticVaultRoot, "locations", `${locationSlug}.md`))
      : "",
    crewId ? safeRead(path.join(staticVaultRoot, "crew", `${crewId}.md`)) : "",
    safeRead(path.join(staticVaultRoot, "lore", "mission-brief.md")),
    safeRead(path.join(staticVaultRoot, "lore", "anomaly.md")),
  ]);

  return {
    location: trimToSection(`${locationSlug || "current-location"}.md`, locationFile),
    crew: trimToSection(`${crewId || "active-crew"}.md`, crewFile),
    missionBrief: trimToSection("mission-brief.md", missionBrief),
    anomaly: trimToSection("anomaly.md", anomaly),
  };
}

export async function loadVaultContext({ worldState, activeCrew, sharedRoom = false, ownerId }) {
  // Shared missions never read the singleton solo session, log or override files.
  if (sharedRoom) return readStaticContext(worldState, activeCrew);
  const paths = getOwnerMirrorPaths(ownerId);
  const [staticContext, sessionState, log, npcOverride, locationDelta] = await Promise.all([
    readStaticContext(worldState, activeCrew),
    safeRead(paths.sessionStateMdPath),
    safeRead(paths.logMdPath),
    safeRead(paths.npcOverridePath),
    safeRead(paths.locationDeltaPath),
  ]);

  return {
    ...staticContext,
    sessionState,
    log,
    npcOverride,
    locationDelta,
  };
}

export function getVaultContextBudget(env = process.env) {
  function integer(value, fallback, minimum, maximum) {
    const result = value === undefined || value === "" ? fallback : Number(value);
    if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
      throw Object.assign(new Error("Vault context budgets must be bounded integers. Check the context configuration."), {
        status: 503, code: "INVALID_CONTEXT_BUDGET",
      });
    }
    return result;
  }
  return {
    sectionMaxBytes: integer(env.VAULT_SECTION_MAX_BYTES, 4000, 256, 65536),
    totalMaxBytes: integer(env.VAULT_TOTAL_MAX_BYTES, 16000, 2048, 262144),
  };
}

function utf8Slice(value, limit, recent) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= limit) return value;
  let start = recent ? bytes.length - limit : 0;
  let end = recent ? bytes.length : limit;
  // Do not split a multi-byte code point at either edge.
  while (start < end && (bytes[start] & 0xc0) === 0x80) start++;
  while (end > start && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.subarray(start, end).toString("utf8");
}

function clipped(value, limit, recent) {
  if (Buffer.byteLength(value, "utf8") <= limit) return value;
  const notice = recent ? "[Context truncated: older material omitted.]\n" : "[Context truncated: section shortened.]\n";
  const contentLimit = limit - Buffer.byteLength(notice, "utf8");
  let content = utf8Slice(value, contentLimit, recent);
  // Prefer complete recent log entries when the cut lands inside an older entry.
  if (recent) {
    const nextEntry = content.indexOf("\n## Entry ");
    if (nextEntry >= 0) content = content.slice(nextEntry + 1);
  }
  return notice + content;
}

export function formatVaultContext(vaultContext, budget = getVaultContextBudget()) {
  const sections = [
    ["Current Location", vaultContext.location || "No location file found for the current scene."],
    ["Active Crew", vaultContext.crew || "No crew file found for the active role."],
    ["Mission Brief", vaultContext.missionBrief || "No mission brief found."],
    ["Anomaly Lore", vaultContext.anomaly || "No anomaly lore found."],
    ["Session State", vaultContext.sessionState || "No session state yet."],
    ["Session Log", vaultContext.log || "No session log yet.", true],
    ["NPC Overrides", vaultContext.npcOverride || "No active NPC overrides."],
    ["Location Deltas", vaultContext.locationDelta || "No active location deltas."],
  ];
  const prefix = "Vault mission context:\n\n";
  const overhead = Buffer.byteLength(prefix) + sections.reduce((sum, [title]) => sum + Buffer.byteLength(`## ${title}\n`), 0) + (sections.length - 1) * 2;
  // Reserve a fair share for every section so lengthy lore cannot crowd out the
  // newest mission log. Headers and truncation notices count toward the budget.
  const limit = Math.min(budget.sectionMaxBytes, Math.floor((budget.totalMaxBytes - overhead) / sections.length));
  if (!Number.isSafeInteger(limit) || limit < 64) {
    throw Object.assign(new Error("Vault context budget is too small."), { status: 503, code: "INVALID_CONTEXT_BUDGET" });
  }
  return prefix + sections.map(([title, value, recent]) => {
    const heading = `## ${title}\n`;
    const contentLimit = Math.min(limit, budget.sectionMaxBytes - Buffer.byteLength(heading));
    return heading + clipped(value, contentLimit, recent);
  }).join("\n\n");
}
