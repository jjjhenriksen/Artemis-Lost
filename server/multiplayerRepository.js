import path from "node:path";
import { mkdir, open, readFile, lstat, rm } from "node:fs/promises";
import postgres from "postgres";
import { atomicWriteFile } from "./atomicFile.js";
import { dynamicVaultRoot } from "./storagePaths.js";
import { assertRoomId, assertValidRoom, roomError } from "./multiplayerRooms.js";

const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const conflict = () => roomError(409, "REVISION_CONFLICT", "The room changed or is busy. Refresh and try again.");
const corrupt = () => roomError(500, "INVALID_ROOM_RECORD", "Stored room data is invalid. The original record was preserved.");
const storageFailure = () => roomError(503, "ROOM_STORAGE_UNAVAILABLE", "Room storage is unavailable. Your last saved mission was preserved.");
function serialized(room) {
  assertValidRoom(room);
  const data = JSON.stringify(room);
  if (Buffer.byteLength(data) > MAX_RECORD_BYTES) throw roomError(413, "ROOM_TOO_LARGE", "Room data exceeds the storage limit.");
  return data;
}
function assertRevision(room, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || room.revision !== expectedRevision + 1) throw conflict();
}
function safeError(error) {
  if (error.status && error.code) return error;
  return storageFailure();
}

export function createFileRoomRepository({ directory } = {}) {
  if (!directory) throw new TypeError("A multiplayer storage directory is required.");
  const root = path.resolve(directory);
  const filename = (id) => { assertRoomId(id); return path.join(root, `${id}.json`); };
  async function load(id) {
    const file = filename(id);
    try {
      const stats = await lstat(file);
      if (!stats.isFile() || stats.size > MAX_RECORD_BYTES) throw corrupt();
      let record;
      try { record = JSON.parse(await readFile(file, "utf8")); } catch { throw corrupt(); }
      return assertValidRoom(record, id);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw safeError(error);
    }
  }
  // Exclusive creation is atomic across processes. Never steal an existing lock:
  // a crashed writer can leave one behind; an operator must inspect/remove it.
  async function locked(id, operation) {
    const lockfile = `${filename(id)}.lock`;
    let handle;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      try { handle = await open(lockfile, "wx", 0o600); }
      catch (error) { if (error.code === "EEXIST") throw conflict(); throw error; }
      return await operation();
    } catch (error) { throw safeError(error); }
    finally {
      if (handle) {
        await handle.close().catch(() => {});
        await rm(lockfile, { force: true }).catch(() => {});
      }
    }
  }
  return {
    load,
    async create(room) {
      const data = serialized(room);
      return locked(room.id, async () => {
        if (await load(room.id)) throw roomError(409, "ROOM_CONFLICT", "Room already exists.");
        await atomicWriteFile(filename(room.id), data);
      });
    },
    async save(room, expectedRevision) {
      const data = serialized(room); assertRevision(room, expectedRevision);
      return locked(room.id, async () => {
        const previous = await load(room.id);
        if (!previous || previous.revision !== expectedRevision) throw conflict();
        await atomicWriteFile(filename(room.id), data);
      });
    },
  };
}

export function createPostgresRoomRepository({ databaseUrl, sql: injectedSql } = {}) {
  if (!injectedSql && !databaseUrl) throw new TypeError("A database URL or SQL client is required.");
  let sql = injectedSql, initialized;
  function client() {
    return sql ||= postgres(databaseUrl, { max: 4, ssl: databaseUrl.includes("sslmode=require") ? "require" : "prefer" });
  }
  async function ready() {
    if (!initialized) {
      initialized = client()`create table if not exists multiplayer_rooms (
        room_id uuid primary key, revision bigint not null check (revision >= 0), payload jsonb not null
      )`.catch((error) => { initialized = undefined; throw error; });
    }
    await initialized;
  }
  async function operation(callback) {
    try { await ready(); return await callback(client()); }
    catch (error) { throw safeError(error); }
  }
  return {
    async create(room) {
      const data = serialized(room);
      return operation(async (db) => {
        const rows = await db`insert into multiplayer_rooms (room_id, revision, payload)
          values (${room.id}, ${room.revision}, ${db.json(JSON.parse(data))}::jsonb) on conflict (room_id) do nothing returning room_id`;
        if (!rows.length) throw roomError(409, "ROOM_CONFLICT", "Room already exists.");
      });
    },
    async load(id) {
      assertRoomId(id);
      return operation(async (db) => {
        const rows = await db`select revision, payload from multiplayer_rooms where room_id = ${id}`;
        if (!rows.length) return null;
        const room = assertValidRoom(rows[0].payload, id);
        if (Number(rows[0].revision) !== room.revision) throw corrupt();
        return room;
      });
    },
    async save(room, expectedRevision) {
      const data = serialized(room); assertRevision(room, expectedRevision);
      return operation(async (db) => {
        const rows = await db`update multiplayer_rooms set revision = ${room.revision}, payload = ${db.json(JSON.parse(data))}::jsonb
          where room_id = ${room.id} and revision = ${expectedRevision} returning room_id`;
        if (!rows.length) throw conflict();
      });
    },
    async close() { if (sql && !injectedSql) await sql.end({ timeout: 5 }); },
  };
}

// Construction is deliberately lazy: importing or probing server health writes
// no directories and opens no database connections.
export function createMultiplayerRepository({ directory, databaseUrl = process.env.DATABASE_URL } = {}) {
  if (databaseUrl) return createPostgresRoomRepository({ databaseUrl });
  return createFileRoomRepository({ directory: directory || process.env.MULTIPLAYER_STORAGE_DIR || path.join(dynamicVaultRoot, "multiplayer") });
}
