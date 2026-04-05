import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { dynamicVaultRoot } from "./storagePaths.js";

const slotsRoot = path.join(dynamicVaultRoot, "slots");
const slotsIndexPath = path.join(slotsRoot, "index.json");
const DATABASE_URL = process.env.DATABASE_URL || "";
const databaseEnabled = Boolean(DATABASE_URL);
const DEFAULT_OWNER_ID = "local-player";

let sqlClient = null;
let schemaReadyPromise = null;

function getSlotPath(slotId) {
  return path.join(slotsRoot, `${slotId}.json`);
}

function normalizeOwnerId(ownerId) {
  if (!ownerId || typeof ownerId !== "string") return DEFAULT_OWNER_ID;
  const normalized = ownerId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return normalized || DEFAULT_OWNER_ID;
}

function getOwnedSlotKey(ownerId, slotId) {
  return `${normalizeOwnerId(ownerId)}:${slotId}`;
}

function getOwnerIndexPath(ownerId) {
  return path.join(slotsRoot, `${normalizeOwnerId(ownerId)}-index.json`);
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

function buildEmptyIndex(saveSlots) {
  return {
    activeSlotId: null,
    slots: saveSlots.map(({ id, label }) => ({ id, label, lastUpdatedIso: null })),
  };
}

function normalizePayload(payload, lastUpdatedIso) {
  return {
    ...payload,
    lastUpdatedIso: lastUpdatedIso?.toISOString?.() || payload?.lastUpdatedIso || null,
  };
}

async function readSlotsIndex(saveSlots, ownerId) {
  const ownerIndexPath = getOwnerIndexPath(ownerId);
  return (await readJson(ownerIndexPath, null)) || buildEmptyIndex(saveSlots);
}

async function writeSlotsIndex(index, ownerId) {
  const ownerIndexPath = getOwnerIndexPath(ownerId);
  await writeFile(ownerIndexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

async function getActiveSlotIdFromDatabase(ownerId) {
  await ensureDatabaseSchema();
  const sql = getSql();
  const rows =
    await sql`select value from app_meta where key = ${`activeSlotId:${normalizeOwnerId(ownerId)}`}`;
  return rows[0]?.value?.slotId || null;
}

async function setActiveSlotIdInDatabase(slotId, ownerId) {
  await ensureDatabaseSchema();
  const sql = getSql();
  await sql`
    insert into app_meta (key, value)
    values (${`activeSlotId:${normalizeOwnerId(ownerId)}`}, ${sql.json({ slotId })})
    on conflict (key) do update set value = excluded.value
  `;
}

export function createSessionStorageAdapter(saveSlots) {
  return {
    async ensurePaths() {
      await mkdir(dynamicVaultRoot, { recursive: true });
      await mkdir(slotsRoot, { recursive: true });

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        return;
      }

      await writeIfMissing(slotsIndexPath, `${JSON.stringify(buildEmptyIndex(saveSlots), null, 2)}\n`);
    },

    async listSessions(ownerId = DEFAULT_OWNER_ID) {
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();
        const [rows, activeSlotId] = await Promise.all([
          sql`select slot_id, payload, last_updated_iso from sessions`,
          getActiveSlotIdFromDatabase(normalizedOwnerId),
        ]);

        const sessionsBySlotId = new Map(
          rows
            .filter((row) => row.slot_id.startsWith(`${normalizedOwnerId}:`))
            .map((row) => [
              row.slot_id.replace(`${normalizedOwnerId}:`, ""),
              normalizePayload(row.payload, row.last_updated_iso),
            ])
        );

        return {
          activeSlotId,
          slots: saveSlots.map(({ id, label }) => ({
            id,
            label,
            session: sessionsBySlotId.get(id) || null,
          })),
        };
      }

      const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
      const slots = await Promise.all(
        saveSlots.map(async ({ id, label }) => ({
          id,
          label,
          session: await readJson(getSlotPath(getOwnedSlotKey(normalizedOwnerId, id)), null),
        }))
      );

      return {
        activeSlotId: index.activeSlotId,
        slots,
      };
    },

    async loadSession(slotId, ownerId = DEFAULT_OWNER_ID) {
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const resolvedSlotId = slotId || (await getActiveSlotIdFromDatabase(normalizedOwnerId));
        if (!resolvedSlotId) return null;

        const sql = getSql();
        const rows =
          await sql`select payload, last_updated_iso from sessions where slot_id = ${getOwnedSlotKey(normalizedOwnerId, resolvedSlotId)} limit 1`;
        const row = rows[0];
        if (!row?.payload) return null;

        return {
          slotId: resolvedSlotId,
          session: normalizePayload(row.payload, row.last_updated_iso),
        };
      }

      const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
      const resolvedSlotId = slotId || index.activeSlotId;
      if (!resolvedSlotId) return null;

      const session = await readJson(getSlotPath(getOwnedSlotKey(normalizedOwnerId, resolvedSlotId)), null);
      if (!session) return null;

      index.activeSlotId = resolvedSlotId;
      await writeSlotsIndex(index, normalizedOwnerId);

      return {
        slotId: resolvedSlotId,
        session,
      };
    },

    async saveSession(slotId, payload, ownerId = DEFAULT_OWNER_ID) {
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();

        await sql`
          insert into sessions (slot_id, payload, last_updated_iso)
          values (${getOwnedSlotKey(normalizedOwnerId, slotId)}, ${sql.json(payload)}, ${payload.lastUpdatedIso})
          on conflict (slot_id) do update
          set payload = excluded.payload,
              last_updated_iso = excluded.last_updated_iso
        `;

        await setActiveSlotIdInDatabase(slotId, normalizedOwnerId);
        return;
      }

      await writeFile(getSlotPath(getOwnedSlotKey(normalizedOwnerId, slotId)), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

      const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
      index.activeSlotId = slotId;
      index.slots = saveSlots.map(({ id, label }) => ({
        id,
        label,
        lastUpdatedIso:
          id === slotId
            ? payload.lastUpdatedIso
            : index.slots.find((entry) => entry.id === id)?.lastUpdatedIso || null,
      }));
      await writeSlotsIndex(index, normalizedOwnerId);
    },

    async deleteSession(slotId, ownerId = DEFAULT_OWNER_ID) {
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();
        const activeSlotId = await getActiveSlotIdFromDatabase(normalizedOwnerId);

        await sql`delete from sessions where slot_id = ${getOwnedSlotKey(normalizedOwnerId, slotId)}`;

        if (activeSlotId === slotId) {
          await setActiveSlotIdInDatabase(null, normalizedOwnerId);
        }

        return { deletedActiveSession: activeSlotId === slotId };
      }

      await rm(getSlotPath(getOwnedSlotKey(normalizedOwnerId, slotId)), { force: true });

      const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
      const deletedActiveSession = index.activeSlotId === slotId;
      if (deletedActiveSession) {
        index.activeSlotId = null;
      }
      index.slots = saveSlots.map(({ id, label }) => ({
        id,
        label,
        lastUpdatedIso:
            id === slotId ? null : index.slots.find((entry) => entry.id === id)?.lastUpdatedIso || null,
      }));
      await writeSlotsIndex(index, normalizedOwnerId);

      return { deletedActiveSession };
    },

    getMode() {
      return databaseEnabled ? "database" : "filesystem";
    },
  };
}
