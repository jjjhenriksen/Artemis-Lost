import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { dynamicVaultRoot } from "./storagePaths.js";
import { atomicWriteFile, withOwnerIndexLock } from "./atomicFile.js";
import { assertKnownSlot, assertValidSession } from "./sessionValidation.js";
import { DEFAULT_OWNER_ID, normalizeOwnerId, getPortableSlotRelativePath, getPortableOwnerRelativePath } from "./sessionFilePaths.js";

const slotsRoot = path.join(dynamicVaultRoot, "slots");
const DATABASE_URL = process.env.DATABASE_URL || "";
const databaseEnabled = Boolean(DATABASE_URL);

let sqlClient = null;
let schemaReadyPromise = null;

function getOwnedSlotPath(ownerId, slotId) {
  return path.join(slotsRoot, getPortableSlotRelativePath(ownerId, slotId));
}

function getLegacySlotPath(ownerId, slotId) {
  return path.join(slotsRoot, `${getOwnedSlotKey(ownerId, slotId)}.json`);
}

async function readOwnedSession(ownerId, slotId) {
  const portable = await readJson(getOwnedSlotPath(ownerId, slotId), null, assertValidSession);
  // Existing colon-named saves cannot exist as ordinary files on Windows.
  // A corrupt/unreadable new file must never be hidden by an older fallback.
  if (portable !== null || process.platform === "win32") return portable;
  const legacyPath = getLegacySlotPath(ownerId, slotId);
  // A component beyond 255 ASCII bytes could never be a legacy filename on
  // supported ordinary filesystems; avoid probing an impossible legacy path.
  if (path.basename(legacyPath).length > 255) return null;
  return readJson(legacyPath, null, assertValidSession);
}

function getOwnedSlotKey(ownerId, slotId) {
  return `${normalizeOwnerId(ownerId)}:${slotId}`;
}

function getOwnerIndexPath(ownerId) {
  return path.join(slotsRoot, getPortableOwnerRelativePath(ownerId), "index.json");
}

function getLegacyOwnerIndexPath(ownerId) {
  return path.join(slotsRoot, `${normalizeOwnerId(ownerId)}-index.json`);
}

export class SaveStorageError extends Error {
  constructor(code, cause) {
    super(code === "SAVE_CORRUPT"
      ? "Saved data is corrupt. Preserve the save files and restore a backup before retrying."
      : "Saved data could not be accessed. Check storage permissions and available space, then retry.", { cause });
    this.name = "SaveStorageError";
    this.code = code;
    this.status = 500;
  }
}

async function readJson(filePath, fallback = null, validate = () => {}) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new SaveStorageError("SAVE_IO_ERROR", error);
  }
  try {
    const parsed = JSON.parse(raw);
    validate(parsed);
    return parsed;
  } catch (error) {
    throw new SaveStorageError("SAVE_CORRUPT", error);
  }
}

async function withFilesystemOwner(ownerId, operation) {
  return withOwnerIndexLock(getOwnerIndexPath(ownerId), async () => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof SaveStorageError || error.status === 400) throw error;
      throw new SaveStorageError("SAVE_IO_ERROR", error);
    }
  });
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
  })().catch((error) => {
    // Share one in-flight attempt, but do not permanently cache an outage.
    schemaReadyPromise = null;
    throw error;
  });

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
  const validate = (index) => {
    if (!index || !Array.isArray(index.slots)) throw new Error("Invalid slot index");
    if (index.activeSlotId !== null) assertKnownSlot(index.activeSlotId);
    for (const slot of saveSlots) {
      const entries = index.slots.filter((entry) => entry?.id === slot.id);
      if (entries.length !== 1 || (entries[0].lastUpdatedIso !== null &&
        (typeof entries[0].lastUpdatedIso !== "string" || !Number.isFinite(Date.parse(entries[0].lastUpdatedIso))))) {
        throw new Error("Invalid slot metadata");
      }
    }
  };
  const portable = await readJson(ownerIndexPath, null, validate);
  if (portable !== null) return portable;
  const legacyPath = getLegacyOwnerIndexPath(ownerId);
  return (path.basename(legacyPath).length <= 255 ? await readJson(legacyPath, null, validate) : null)
    || buildEmptyIndex(saveSlots);
}

async function writeSlotsIndex(index, ownerId) {
  const ownerIndexPath = getOwnerIndexPath(ownerId);
  await mkdir(path.dirname(ownerIndexPath), { recursive: true });
  await atomicWriteFile(ownerIndexPath, `${JSON.stringify(index, null, 2)}\n`);
}

async function getActiveSlotIdFromDatabase(ownerId, sql = getSql()) {
  const rows =
    await sql`select value from app_meta where key = ${`activeSlotId:${normalizeOwnerId(ownerId)}`}`;
  return rows[0]?.value?.slotId || null;
}

async function setActiveSlotIdInDatabase(slotId, ownerId, sql) {
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
    },

    async listSessions(ownerId = DEFAULT_OWNER_ID) {
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();
        const [rows, activeSlotId] = await Promise.all([
          sql`select slot_id, payload, last_updated_iso from sessions
            where slot_id in ${sql(saveSlots.map(({ id }) => getOwnedSlotKey(normalizedOwnerId, id)))}`,
          getActiveSlotIdFromDatabase(normalizedOwnerId),
        ]);

        const sessionsBySlotId = new Map(
          rows
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

      return withFilesystemOwner(normalizedOwnerId, async () => {
        const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
        const slots = await Promise.all(
          saveSlots.map(async ({ id, label }) => ({
            id,
            label,
            session: await readOwnedSession(normalizedOwnerId, id),
          }))
        );

        return {
          activeSlotId: index.activeSlotId,
          slots,
        };
      });
    },

    async loadSession(slotId, ownerId = DEFAULT_OWNER_ID) {
      if (slotId !== undefined && slotId !== null) assertKnownSlot(slotId);
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();
        return sql.begin(async (transaction) => {
          await transaction`select pg_advisory_xact_lock(hashtextextended(${normalizedOwnerId}, 0))`;
          const resolvedSlotId = slotId || (await getActiveSlotIdFromDatabase(normalizedOwnerId, transaction));
          if (!resolvedSlotId) return null;
          assertKnownSlot(resolvedSlotId);

          const rows = await transaction`select payload, last_updated_iso from sessions
            where slot_id = ${getOwnedSlotKey(normalizedOwnerId, resolvedSlotId)} limit 1`;
          const row = rows[0];
          if (!row?.payload) return null;

          await setActiveSlotIdInDatabase(resolvedSlotId, normalizedOwnerId, transaction);
          return {
            slotId: resolvedSlotId,
            session: normalizePayload(row.payload, row.last_updated_iso),
          };
        });
      }

      return withFilesystemOwner(normalizedOwnerId, async () => {
        const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
        const resolvedSlotId = slotId || index.activeSlotId;
        if (!resolvedSlotId) return null;
        assertKnownSlot(resolvedSlotId);

        const session = await readOwnedSession(normalizedOwnerId, resolvedSlotId);
        if (!session) return null;

        index.activeSlotId = resolvedSlotId;
        await writeSlotsIndex(index, normalizedOwnerId);

        return {
          slotId: resolvedSlotId,
          session,
        };
      });
    },

    async saveSession(slotId, payload, ownerId = DEFAULT_OWNER_ID) {
      assertKnownSlot(slotId);
      assertValidSession(payload);
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();

        await sql.begin(async (transaction) => {
          await transaction`select pg_advisory_xact_lock(hashtextextended(${normalizeOwnerId(ownerId)}, 0))`;
          await transaction`
            insert into sessions (slot_id, payload, last_updated_iso)
            values (${getOwnedSlotKey(normalizedOwnerId, slotId)}, ${transaction.json(payload)}, ${payload.lastUpdatedIso})
            on conflict (slot_id) do update
            set payload = excluded.payload,
                last_updated_iso = excluded.last_updated_iso
          `;

          await setActiveSlotIdInDatabase(slotId, normalizedOwnerId, transaction);
        });
        return;
      }

      return withFilesystemOwner(normalizedOwnerId, async () => {
        const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
        const slotPath = getOwnedSlotPath(normalizedOwnerId, slotId);
        await mkdir(path.dirname(slotPath), { recursive: true });
        await atomicWriteFile(slotPath, `${JSON.stringify(payload, null, 2)}\n`);
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
      });
    },

    async deleteSession(slotId, ownerId = DEFAULT_OWNER_ID) {
      assertKnownSlot(slotId);
      const normalizedOwnerId = normalizeOwnerId(ownerId);

      if (databaseEnabled) {
        await ensureDatabaseSchema();
        const sql = getSql();
        return sql.begin(async (transaction) => {
          await transaction`select pg_advisory_xact_lock(hashtextextended(${normalizeOwnerId(ownerId)}, 0))`;
          const activeSlotId = await getActiveSlotIdFromDatabase(normalizedOwnerId, transaction);

          await transaction`delete from sessions where slot_id = ${getOwnedSlotKey(normalizedOwnerId, slotId)}`;

          if (activeSlotId === slotId) {
            await setActiveSlotIdInDatabase(null, normalizedOwnerId, transaction);
          }

          return { deletedActiveSession: activeSlotId === slotId };
        });
      }

      return withFilesystemOwner(normalizedOwnerId, async () => {
        const index = await readSlotsIndex(saveSlots, normalizedOwnerId);
        await rm(getOwnedSlotPath(normalizedOwnerId, slotId), { force: true });
        // Explicit deletion removes the older representation too, so fallback
        // cannot resurrect a slot after deleting its portable replacement.
        const legacyPath = getLegacySlotPath(normalizedOwnerId, slotId);
        if (process.platform !== "win32" && path.basename(legacyPath).length <= 255) await rm(legacyPath, { force: true });
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
      });
    },

    getMode() {
      return databaseEnabled ? "database" : "filesystem";
    },
  };
}
