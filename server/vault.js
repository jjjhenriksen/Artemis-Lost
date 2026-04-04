import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const vaultRoot = path.join(projectRoot, "vault");

async function safeRead(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readMarkdownDirectory(directoryPath) {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const contents = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(directoryPath, file.name);
        const content = await safeRead(fullPath);
        return `FILE: ${file.name}\n${content}`.trim();
      })
    );

    return contents.filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}

export async function loadVaultContext() {
  const staticRoot = path.join(vaultRoot, "static");
  const dynamicRoot = path.join(vaultRoot, "dynamic");

  const [locations, crew, lore, sessionState, log, npcOverride, locationDelta] =
    await Promise.all([
      readMarkdownDirectory(path.join(staticRoot, "locations")),
      readMarkdownDirectory(path.join(staticRoot, "crew")),
      readMarkdownDirectory(path.join(staticRoot, "lore")),
      safeRead(path.join(dynamicRoot, "session-state.md")),
      safeRead(path.join(dynamicRoot, "log.md")),
      safeRead(path.join(dynamicRoot, "overrides", "npc-override.md")),
      safeRead(path.join(dynamicRoot, "overrides", "location-delta.md")),
    ]);

  return {
    locations,
    crew,
    lore,
    sessionState,
    log,
    npcOverride,
    locationDelta,
  };
}

export function formatVaultContext(vaultContext) {
  return [
    "Vault mission context:",
    "",
    "## Locations",
    vaultContext.locations || "No location files found.",
    "",
    "## Crew",
    vaultContext.crew || "No crew files found.",
    "",
    "## Lore",
    vaultContext.lore || "No lore files found.",
    "",
    "## Session State",
    vaultContext.sessionState || "No session state yet.",
    "",
    "## Session Log",
    vaultContext.log || "No session log yet.",
    "",
    "## NPC Overrides",
    vaultContext.npcOverride || "No active NPC overrides.",
    "",
    "## Location Deltas",
    vaultContext.locationDelta || "No active location deltas.",
  ].join("\n");
}
