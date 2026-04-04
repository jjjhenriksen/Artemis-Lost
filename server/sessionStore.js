import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { dynamicVaultRoot } from "./storagePaths.js";

const dynamicRoot = dynamicVaultRoot;
const overridesRoot = path.join(dynamicRoot, "overrides");
const slotsRoot = path.join(dynamicRoot, "slots");
const slotsIndexPath = path.join(slotsRoot, "index.json");
const sessionJsonPath = path.join(dynamicRoot, "session.json");
const sessionStateMdPath = path.join(dynamicRoot, "session-state.md");
const logMdPath = path.join(dynamicRoot, "log.md");
const npcOverridePath = path.join(overridesRoot, "npc-override.md");
const locationDeltaPath = path.join(overridesRoot, "location-delta.md");
const DATABASE_URL = process.env.DATABASE_URL || "";
const databaseEnabled = Boolean(DATABASE_URL);

let sqlClient = null;
let schemaReadyPromise = null;

export const SAVE_SLOTS = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
];

function joinLines(lines) {
  return lines.join("\n");
}

function getSlotPath(slotId) {
  return path.join(slotsRoot, `${slotId}.json`);
}

function getSql() {
  if (!databaseEnabled) return null;
  if (!sqlClient) {
    sqlClient = postgres(DATABASE_URL, {
      max: 1,
      ssl: DATABASE_URL.includes("sslmode=require") ? "require" : "prefer",
    });
  }
  return sqlClient;
}

async function ensureDatabaseSchema() {
  if (!databaseEnabled) return;
  if (schemaReadyPromise) return schemaReadyPromise;

  const sql = getSql();
  schemaReadyPromise = (async () => {
    await sql`
      create table if not exists sessions (
        slot_id text primary key,
        payload jsonb not null,
        last_updated_iso timestamptz not null default now()
      )
    `;

    await sql`
      create table if not exists app_meta (
        key text primary key,
        value jsonb not null
      )
    `;
  })();

  return schemaReadyPromise;
}

function withSlotMetadata(slotId, session) {
  const slot = SAVE_SLOTS.find((entry) => entry.id === slotId);
  return {
    ...session,
    slotId,
    slotLabel: slot?.label || slotId,
  };
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

async function readJson(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeIfMissing(targetPath, content) {
  try {
    await readFile(targetPath, "utf8");
  } catch {
    await writeFile(targetPath, content, "utf8");
  }
}

async function readSlotsIndex() {
  return (
    (await readJson(slotsIndexPath, null)) || {
      activeSlotId: null,
      slots: SAVE_SLOTS.map(({ id, label }) => ({ id, label, lastUpdatedIso: null })),
    }
  );
}

async function writeSlotsIndex(index) {
  await writeFile(`${slotsIndexPath}`, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

async function getActiveSlotIdFromDatabase() {
  await ensureDatabaseSchema();
  const sql = getSql();
  const rows = await sql`select value from app_meta where key = 'activeSlotId'`;
  return rows[0]?.value?.slotId || null;
}

async function setActiveSlotIdInDatabase(slotId) {
  await ensureDatabaseSchema();
  const sql = getSql();
  await sql`
    insert into app_meta (key, value)
    values ('activeSlotId', ${sql.json({ slotId })})
    on conflict (key) do update set value = excluded.value
  `;
}

async function listSessionsFromDatabase() {
  await ensureDatabaseSchema();
  const sql = getSql();
  const [rows, activeSlotId] = await Promise.all([
    sql`select slot_id, payload, last_updated_iso from sessions`,
    getActiveSlotIdFromDatabase(),
  ]);

  const bySlotId = new Map(
    rows.map((row) => [
      row.slot_id,
      {
        ...row.payload,
        lastUpdatedIso: row.last_updated_iso?.toISOString?.() || row.payload?.lastUpdatedIso || null,
      },
    ])
  );

  return {
    activeSlotId,
    slots: SAVE_SLOTS.map(({ id, label }) => ({
      id,
      label,
      session: bySlotId.has(id) ? withSlotMetadata(id, bySlotId.get(id)) : null,
    })),
  };
}

async function loadSessionFromDatabase(slotId) {
  await ensureDatabaseSchema();
  if (!slotId) {
    slotId = await getActiveSlotIdFromDatabase();
  }
  if (!slotId) return null;

  const sql = getSql();
  const rows = await sql`select payload, last_updated_iso from sessions where slot_id = ${slotId} limit 1`;
  const row = rows[0];
  if (!row?.payload) return null;

  const payload = {
    ...row.payload,
    lastUpdatedIso: row.last_updated_iso?.toISOString?.() || row.payload?.lastUpdatedIso || null,
  };

  await setActiveSlotIdInDatabase(slotId);
  await syncActiveMirror(slotId, payload);
  return withSlotMetadata(slotId, payload);
}

async function saveSessionToDatabase(slotId, session) {
  await ensureDatabaseSchema();
  const sql = getSql();

  const payload = {
    worldState: session.worldState,
    narration: session.narration,
    turn: session.turn,
    conversationHistory: session.conversationHistory ?? [],
    createdFromCharacterCreation: Boolean(session.createdFromCharacterCreation),
    lastUpdatedIso: new Date().toISOString(),
  };

  await sql`
    insert into sessions (slot_id, payload, last_updated_iso)
    values (${slotId}, ${sql.json(payload)}, ${payload.lastUpdatedIso})
    on conflict (slot_id) do update
    set payload = excluded.payload,
        last_updated_iso = excluded.last_updated_iso
  `;

  await setActiveSlotIdInDatabase(slotId);
  await syncActiveMirror(slotId, payload);

  return withSlotMetadata(slotId, payload);
}

async function deleteSessionFromDatabase(slotId) {
  await ensureDatabaseSchema();
  const sql = getSql();
  const activeSlotId = await getActiveSlotIdFromDatabase();

  await sql`delete from sessions where slot_id = ${slotId}`;

  if (activeSlotId === slotId) {
    await setActiveSlotIdInDatabase(null);
    await syncActiveMirror(null, null);
  }

  return { slotId, deleted: true };
}

async function syncActiveMirror(slotId, payload) {
  if (!payload?.worldState) {
    await Promise.all([
      writeFile(sessionJsonPath, "null\n", "utf8"),
      writeFile(sessionStateMdPath, "# Session State\n\nNo active session loaded.\n", "utf8"),
      writeFile(logMdPath, "# Session Log\n\nNo active session loaded.\n", "utf8"),
    ]);
    return;
  }

  await Promise.all([
    writeFile(sessionJsonPath, `${JSON.stringify(withSlotMetadata(slotId, payload), null, 2)}\n`, "utf8"),
    writeFile(
      sessionStateMdPath,
      buildSessionStateMarkdown({
        worldState: payload.worldState,
        turn: payload.turn,
        narration: payload.narration,
        conversationHistory: payload.conversationHistory,
        slotId,
      }),
      "utf8"
    ),
    writeFile(logMdPath, buildLogMarkdown(payload.conversationHistory, slotId), "utf8"),
  ]);
}

export async function ensureSessionPaths() {
  await mkdir(dynamicRoot, { recursive: true });
  await mkdir(overridesRoot, { recursive: true });
  await mkdir(slotsRoot, { recursive: true });

  if (databaseEnabled) {
    await ensureDatabaseSchema();
  }

  await Promise.all([
    writeIfMissing(
      npcOverridePath,
      "# NPC Override Convention\n\nUse this file to record active NPC behavior overrides.\n"
    ),
    writeIfMissing(
      locationDeltaPath,
      "# Location Delta Convention\n\nUse this file to record evolving location changes.\n"
    ),
    writeIfMissing(
      slotsIndexPath,
      `${JSON.stringify(
        {
          activeSlotId: null,
          slots: SAVE_SLOTS.map(({ id, label }) => ({ id, label, lastUpdatedIso: null })),
        },
        null,
        2
      )}\n`
    ),
  ]);
}

export async function listSessions() {
  if (databaseEnabled) {
    await ensureSessionPaths();
    return listSessionsFromDatabase();
  }

  await ensureSessionPaths();
  const index = await readSlotsIndex();

  const sessions = await Promise.all(
    SAVE_SLOTS.map(async ({ id, label }) => {
      const session = await readJson(getSlotPath(id), null);
      return {
        id,
        label,
        session: session ? withSlotMetadata(id, session) : null,
      };
    })
  );

  return {
    activeSlotId: index.activeSlotId,
    slots: sessions,
  };
}

export async function loadSession(slotId) {
  if (databaseEnabled) {
    await ensureSessionPaths();
    return loadSessionFromDatabase(slotId);
  }

  await ensureSessionPaths();
  if (!slotId) {
    const index = await readSlotsIndex();
    slotId = index.activeSlotId;
  }
  if (!slotId) return null;

  const session = await readJson(getSlotPath(slotId), null);
  if (!session) return null;

  const index = await readSlotsIndex();
  index.activeSlotId = slotId;
  await writeSlotsIndex(index);
  await syncActiveMirror(slotId, session);
  return withSlotMetadata(slotId, session);
}

export async function saveSession(slotId, session) {
  if (databaseEnabled) {
    await ensureSessionPaths();
    if (!SAVE_SLOTS.some((slot) => slot.id === slotId)) {
      throw new Error(`Unknown save slot: ${slotId}`);
    }
    return saveSessionToDatabase(slotId, session);
  }

  await ensureSessionPaths();
  if (!SAVE_SLOTS.some((slot) => slot.id === slotId)) {
    throw new Error(`Unknown save slot: ${slotId}`);
  }

  const payload = {
    worldState: session.worldState,
    narration: session.narration,
    turn: session.turn,
    conversationHistory: session.conversationHistory ?? [],
    createdFromCharacterCreation: Boolean(session.createdFromCharacterCreation),
    lastUpdatedIso: new Date().toISOString(),
  };

  await writeFile(getSlotPath(slotId), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const index = await readSlotsIndex();
  index.activeSlotId = slotId;
  index.slots = SAVE_SLOTS.map(({ id, label }) => ({
    id,
    label,
    lastUpdatedIso:
      id === slotId
        ? payload.lastUpdatedIso
        : index.slots.find((entry) => entry.id === id)?.lastUpdatedIso || null,
  }));
  await writeSlotsIndex(index);
  await syncActiveMirror(slotId, payload);

  return withSlotMetadata(slotId, payload);
}

export async function deleteSession(slotId) {
  if (databaseEnabled) {
    await ensureSessionPaths();
    return deleteSessionFromDatabase(slotId);
  }

  await ensureSessionPaths();
  await rm(getSlotPath(slotId), { force: true });

  const index = await readSlotsIndex();
  if (index.activeSlotId === slotId) {
    index.activeSlotId = null;
    await syncActiveMirror(null, null);
  }
  index.slots = SAVE_SLOTS.map(({ id, label }) => ({
    id,
    label,
    lastUpdatedIso: id === slotId ? null : index.slots.find((entry) => entry.id === id)?.lastUpdatedIso || null,
  }));
  await writeSlotsIndex(index);

  return { slotId, deleted: true };
}

export function getSessionBackendMode() {
  return databaseEnabled ? "database" : "filesystem";
}
