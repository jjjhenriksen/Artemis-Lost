import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dynamicVaultRoot } from "./storagePaths.js";

const overridesRoot = path.join(dynamicVaultRoot, "overrides");
const sessionJsonPath = path.join(dynamicVaultRoot, "session.json");
const sessionStateMdPath = path.join(dynamicVaultRoot, "session-state.md");
const logMdPath = path.join(dynamicVaultRoot, "log.md");
const npcOverridePath = path.join(overridesRoot, "npc-override.md");
const locationDeltaPath = path.join(overridesRoot, "location-delta.md");

function joinLines(lines) {
  return lines.join("\n");
}

function formatCrewStatus(crew = []) {
  return crew.map(
    (member) =>
      `- ${member.name} | ${member.role} | controller ${member.character?.controller === "bot" ? "bot" : "human"} | health ${member.health}, morale ${member.morale} | ${member.extra.label}: ${member.extra.value}`
  );
}

function formatSystems(systems = {}) {
  return Object.entries(systems).map(([key, value]) => {
    const asText =
      typeof value === "number" && ["o2", "power", "comms", "propulsion"].includes(key)
        ? `${value}%`
        : value;
    return `- ${key} | nominal snapshot | ${asText} | no automated alert summary`;
  });
}

function formatEvents(eventLog = []) {
  return eventLog.map((event) => `- ${event.ts} | all | ${event.type} | ${event.msg}`);
}

function getDangerLevel(worldState) {
  const warningCount = [
    worldState?.systems?.o2 < 60,
    worldState?.systems?.power < 70,
    worldState?.systems?.comms < 40,
    worldState?.crew?.some((member) => member.health < 60),
  ].filter(Boolean).length;

  if (warningCount >= 3) return "critical";
  if (warningCount >= 1) return "elevated";
  return "guarded";
}

function buildSessionStateMarkdown({ worldState, turn, narration, conversationHistory, slotId }) {
  const currentLocationId = (worldState.environment.location || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return joinLines([
    "# Session State",
    "",
    "## Meta",
    `- slot: ${slotId}`,
    `- turn: ${turn}`,
    `- phase: ${worldState.mission.phase}`,
    `- lastUpdatedIso: ${new Date().toISOString()}`,
    "",
    "## Snapshot",
    `- currentLocationId: ${currentLocationId}`,
    `- dangerLevel: ${getDangerLevel(worldState)}`,
    `- activeObjectives: ${worldState.mission.objectives.join(" | ")}`,
    `- openClocks: comms ${worldState.systems.comms}%, o2 ${worldState.systems.o2}%, power ${worldState.systems.power}%`,
    "",
    "## Crew Status",
    ...formatCrewStatus(worldState.crew),
    "",
    "## Systems",
    ...formatSystems(worldState.systems),
    "",
    "## New Events",
    ...formatEvents(worldState.eventLog.slice(0, 12)),
    "",
    "## GM Notes",
    `- latestNarration: ${narration ? narration.split("\n")[0] : "No narration yet."}`,
    `- recentHistoryCount: ${conversationHistory.length}`,
    `- anomaly: ${worldState.environment.anomaly}`,
    `- unresolvedThreats: ${worldState.environment.hazards.join(", ")}`,
    "",
  ]);
}

function buildLogMarkdown(conversationHistory = [], slotId) {
  return joinLines([
    "# Session Log",
    "",
    `- slot: ${slotId}`,
    "",
    ...conversationHistory.flatMap((entry, index) => [
      `## Entry ${index + 1}`,
      `- role: ${entry.role}`,
      `- turn: ${entry.turn ?? "n/a"}`,
      `- crew: ${entry.crewName ?? "n/a"}`,
      `- content: ${entry.content}`,
      "",
    ]),
  ]);
}

async function writeIfMissing(targetPath, content) {
  try {
    await readFile(targetPath, "utf8");
  } catch {
    await writeFile(targetPath, content, "utf8");
  }
}

export async function ensureSessionMirrorPaths() {
  await mkdir(dynamicVaultRoot, { recursive: true });
  await mkdir(overridesRoot, { recursive: true });

  await Promise.all([
    writeIfMissing(
      npcOverridePath,
      "# NPC Override Convention\n\nUse this file to record active NPC behavior overrides.\n"
    ),
    writeIfMissing(
      locationDeltaPath,
      "# Location Delta Convention\n\nUse this file to record evolving location changes.\n"
    ),
  ]);
}

export async function syncActiveMirror(slotId, payload, withSlotMetadata) {
  if (!payload?.worldState || !slotId) {
    await Promise.all([
      writeFile(sessionJsonPath, "null\n", "utf8"),
      writeFile(sessionStateMdPath, "# Session State\n\nNo active session loaded.\n", "utf8"),
      writeFile(logMdPath, "# Session Log\n\nNo active session loaded.\n", "utf8"),
    ]);
    return;
  }

  await Promise.all([
    writeFile(
      sessionJsonPath,
      `${JSON.stringify(withSlotMetadata(slotId, payload), null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      sessionStateMdPath,
      buildSessionStateMarkdown({
        worldState: payload.worldState,
        turn: payload.turn,
        narration: payload.narration,
        conversationHistory: payload.conversationHistory ?? [],
        slotId,
      }),
      "utf8"
    ),
    writeFile(logMdPath, buildLogMarkdown(payload.conversationHistory ?? [], slotId), "utf8"),
  ]);
}
