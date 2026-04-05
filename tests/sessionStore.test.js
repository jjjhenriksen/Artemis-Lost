import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function importSessionStoreWithEnv(env = {}, postgresImpl = null) {
  vi.resetModules();

  const originalEnv = {
    DATA_DIR: process.env.DATA_DIR,
    DATABASE_URL: process.env.DATABASE_URL,
    RENDER_DISK_ROOT: process.env.RENDER_DISK_ROOT,
  };

  for (const [key, value] of Object.entries({
    DATA_DIR: undefined,
    DATABASE_URL: undefined,
    RENDER_DISK_ROOT: undefined,
    ...env,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  if (postgresImpl) {
    vi.doMock("postgres", () => ({ default: postgresImpl }));
  } else {
    vi.doUnmock("postgres");
  }

  const module = await import("../server/sessionStore.js");

  return {
    ...module,
    restoreEnv() {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      vi.doUnmock("postgres");
    },
  };
}

function createMockPostgres() {
  const state = {
    sessions: new Map(),
    meta: new Map(),
  };

  function sql(strings, ...values) {
    const query = strings.join(" ").toLowerCase().replace(/\s+/g, " ").trim();

    if (query.startsWith("create table")) return Promise.resolve([]);

    if (query.includes("select value from app_meta")) {
      return Promise.resolve(
        state.meta.has("activeSlotId") ? [{ value: state.meta.get("activeSlotId") }] : []
      );
    }

    if (query.includes("insert into app_meta")) {
      state.meta.set("activeSlotId", values[0]);
      return Promise.resolve([]);
    }

    if (query.includes("select slot_id, payload, last_updated_iso from sessions")) {
      return Promise.resolve(
        [...state.sessions.entries()].map(([slotId, row]) => ({
          slot_id: slotId,
          payload: row.payload,
          last_updated_iso: row.lastUpdatedIso,
        }))
      );
    }

    if (query.includes("select payload, last_updated_iso from sessions where slot_id")) {
      const row = state.sessions.get(values[0]);
      return Promise.resolve(
        row
          ? [{ payload: row.payload, last_updated_iso: row.lastUpdatedIso }]
          : []
      );
    }

    if (query.includes("insert into sessions")) {
      state.sessions.set(values[0], {
        payload: values[1],
        lastUpdatedIso: new Date(values[2]),
      });
      return Promise.resolve([]);
    }

    if (query.includes("delete from sessions where slot_id")) {
      state.sessions.delete(values[0]);
      return Promise.resolve([]);
    }

    throw new Error(`Unhandled query in mock postgres: ${query}`);
  }

  sql.json = (value) => value;
  return sql;
}

describe("sessionStore", () => {
  test("persists and loads sessions in filesystem mode", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "dungeonmaister-fs-"));
    const sessionStore = await importSessionStoreWithEnv({ DATA_DIR: dataDir });

    try {
      expect(sessionStore.getSessionBackendMode()).toBe("filesystem");

      const payload = {
        worldState: { mission: { phase: "Test", objectives: [] }, systems: { o2: 80, power: 80, comms: 80 }, crew: [], environment: { location: "Nowhere", anomaly: "None", hazards: [] }, eventLog: [] },
        narration: "Ready",
        turn: 0,
        conversationHistory: [],
      };

      await sessionStore.saveSession("slot-1", payload, "player-a");
      const loaded = await sessionStore.loadSession("slot-1", "player-a");
      const listing = await sessionStore.listSessions("player-a");

      expect(loaded.slotId).toBe("slot-1");
      expect(loaded.narration).toBe("Ready");
      expect(listing.activeSlotId).toBe("slot-1");
      expect(listing.slots.find((slot) => slot.id === "slot-1").session).toBeTruthy();
    } finally {
      sessionStore.restoreEnv();
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test("uses database mode when DATABASE_URL is configured", async () => {
    const sessionStore = await importSessionStoreWithEnv(
      { DATABASE_URL: "postgres://example?sslmode=require" },
      () => createMockPostgres()
    );

    try {
      expect(sessionStore.getSessionBackendMode()).toBe("database");

      await sessionStore.saveSession("slot-2", {
        worldState: { mission: { phase: "DB Test", objectives: [] }, systems: { o2: 70, power: 70, comms: 70 }, crew: [], environment: { location: "Nowhere", anomaly: "None", hazards: [] }, eventLog: [] },
        narration: "Database ready",
        turn: 1,
        conversationHistory: [],
      }, "player-b");

      const loaded = await sessionStore.loadSession("slot-2", "player-b");
      expect(loaded.slotId).toBe("slot-2");
      expect(loaded.narration).toBe("Database ready");
    } finally {
      sessionStore.restoreEnv();
    }
  });

  test("isolates sessions by player id", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "dungeonmaister-isolated-"));
    const sessionStore = await importSessionStoreWithEnv({ DATA_DIR: dataDir });

    try {
      await sessionStore.saveSession(
        "slot-1",
        {
          worldState: { mission: { phase: "Alpha", objectives: [] }, systems: { o2: 90, power: 90, comms: 90 }, crew: [], environment: { location: "A", anomaly: "None", hazards: [] }, eventLog: [] },
          narration: "Player A save",
          turn: 0,
          conversationHistory: [],
        },
        "player-a"
      );

      await sessionStore.saveSession(
        "slot-1",
        {
          worldState: { mission: { phase: "Beta", objectives: [] }, systems: { o2: 55, power: 55, comms: 55 }, crew: [], environment: { location: "B", anomaly: "None", hazards: [] }, eventLog: [] },
          narration: "Player B save",
          turn: 0,
          conversationHistory: [],
        },
        "player-b"
      );

      const listingA = await sessionStore.listSessions("player-a");
      const listingB = await sessionStore.listSessions("player-b");

      expect(listingA.slots.find((slot) => slot.id === "slot-1").session.narration).toBe("Player A save");
      expect(listingB.slots.find((slot) => slot.id === "slot-1").session.narration).toBe("Player B save");
    } finally {
      sessionStore.restoreEnv();
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
