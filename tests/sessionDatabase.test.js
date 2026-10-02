// @vitest-environment node
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMissionSession } from "../src/game/worldState.js";
import { SAVE_SLOTS } from "../server/sessionValidation.js";

// Never use DATABASE_URL from the developer's environment. This suite requires
// a separate, explicit test endpoint and isolates itself in a disposable schema.
const testUrl = process.env.ARTEMIS_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("real PostgreSQL session transactions", () => {
  let admin, control, adapter, root, schema;
  const clients = [];
  beforeAll(async () => {
    schema = `artemis_test_${randomUUID().replaceAll("-", "")}`;
    root = await mkdtemp(path.join(os.tmpdir(), "artemis-db-"));
    admin = postgres(testUrl, { ssl: false });
    await admin.unsafe(`create schema ${schema}`);
    control = postgres(testUrl, { ssl: false, connection: { search_path: schema } });
    vi.stubEnv("DATA_DIR", root);
    vi.stubEnv("DATABASE_URL", testUrl);
    vi.resetModules();
    vi.doMock("postgres", () => ({ default: (url, options) => {
      const client = postgres(url, { ...options, ssl: false, connection: { search_path: schema } });
      clients.push(client);
      return client;
    } }));
    const { createSessionStorageAdapter } = await import("../server/sessionStorageAdapter.js");
    adapter = createSessionStorageAdapter(SAVE_SLOTS);
    await adapter.ensurePaths();
    await control`create table fault_control (enabled boolean not null)`;
    await control`insert into fault_control values (false)`;
    await control.unsafe(`
      create function reject_meta_write() returns trigger language plpgsql as $$
      begin
        if (select enabled from fault_control) then
          raise exception 'injected active-slot write failure';
        end if;
        return new;
      end $$;
      create trigger inject_failure before insert or update on app_meta
      for each row execute function reject_meta_write();
    `);
  });
  beforeEach(async () => {
    await control`update fault_control set enabled = false`;
    await control`truncate sessions, app_meta`;
  });
  afterAll(async () => {
    vi.doUnmock("postgres");
    vi.unstubAllEnvs();
    await Promise.all(clients.map((client) => client.end({ timeout: 1 })));
    if (control) await control.end({ timeout: 1 });
    if (admin) {
      if (schema) await admin.unsafe(`drop schema if exists ${schema} cascade`);
      await admin.end({ timeout: 1 });
    }
    if (root) await rm(root, { recursive: true, force: true });
  });

  const payload = (narration = "Original") => ({ ...createMissionSession(), narration, lastUpdatedIso: "2026-01-01T00:00:00.000Z" });
  async function snapshot() {
    return {
      sessions: await control`select slot_id, payload, last_updated_iso from sessions order by slot_id`,
      meta: await control`select key, value from app_meta order by key`,
    };
  }

  test("commits successful saves and deletion with active metadata", async () => {
    await adapter.saveSession("slot-1", payload(), "owner-a");
    await adapter.saveSession("slot-2", payload("Second"), "owner-a");
    await adapter.saveSession("slot-1", payload("Other owner"), "owner-b");
    expect((await adapter.listSessions("owner-a")).activeSlotId).toBe("slot-2");
    expect((await adapter.deleteSession("slot-1", "owner-a")).deletedActiveSession).toBe(false);
    expect((await adapter.listSessions("owner-a")).activeSlotId).toBe("slot-2");
    expect((await adapter.deleteSession("slot-2", "owner-a")).deletedActiveSession).toBe(true);
    expect((await adapter.listSessions("owner-a")).activeSlotId).toBeNull();
    expect((await adapter.loadSession("slot-1", "owner-b")).session.narration).toBe("Other owner");
  });

  test("loading an older slot updates listing and subsequent default load for only its owner", async () => {
    await adapter.saveSession("slot-1", payload("Older"), "owner-a");
    await adapter.saveSession("slot-2", payload("Newer"), "owner-a");
    await adapter.saveSession("slot-2", payload("Other player"), "owner-b");
    expect((await adapter.loadSession("slot-1", "owner-a")).session.narration).toBe("Older");
    expect((await adapter.listSessions("owner-a")).activeSlotId).toBe("slot-1");
    expect(await adapter.loadSession(undefined, "owner-a")).toMatchObject({ slotId: "slot-1", session: { narration: "Older" } });
    expect((await adapter.listSessions("owner-b")).activeSlotId).toBe("slot-2");
    expect(await adapter.loadSession("slot-3", "owner-a")).toBeNull();
    expect((await adapter.listSessions("owner-a")).activeSlotId).toBe("slot-1");
  });

  test("failed activation cannot acknowledge a loaded slot or replace the active pointer", async () => {
    await adapter.saveSession("slot-1", payload("Older"), "owner-a");
    await adapter.saveSession("slot-2", payload("Active"), "owner-a");
    const before = await snapshot();
    await control`update fault_control set enabled = true`;
    await expect(adapter.loadSession("slot-1", "owner-a")).rejects.toThrow("injected active-slot write failure");
    expect(await snapshot()).toEqual(before);
    await control`update fault_control set enabled = false`;
    expect((await adapter.loadSession(undefined, "owner-a")).slotId).toBe("slot-2");
  });

  test("rolls back an existing slot replacement when metadata fails", async () => {
    await adapter.saveSession("slot-1", payload(), "owner-a");
    await adapter.saveSession("slot-2", payload("Active"), "owner-a");
    const before = await snapshot();
    await control`update fault_control set enabled = true`;
    await expect(adapter.saveSession("slot-1", payload("Must roll back"), "owner-a"))
      .rejects.toThrow("injected active-slot write failure");
    expect(await snapshot()).toEqual(before);
  });

  test("rolls back a new slot insertion when metadata fails", async () => {
    await adapter.saveSession("slot-1", payload(), "owner-a");
    const before = await snapshot();
    await control`update fault_control set enabled = true`;
    await expect(adapter.saveSession("slot-2", payload("Must not exist"), "owner-a"))
      .rejects.toThrow("injected active-slot write failure");
    expect(await snapshot()).toEqual(before);
  });

  test("rolls back active slot deletion when metadata cleanup fails", async () => {
    await adapter.saveSession("slot-1", payload(), "owner-a");
    const before = await snapshot();
    await control`update fault_control set enabled = true`;
    await expect(adapter.deleteSession("slot-1", "owner-a"))
      .rejects.toThrow("injected active-slot write failure");
    expect(await snapshot()).toEqual(before);
    await control`update fault_control set enabled = false`;
    await adapter.deleteSession("slot-1", "owner-a");
    expect((await snapshot()).sessions).toHaveLength(0);
    expect((await snapshot()).meta[0].value).toEqual({ slotId: null });
  });
});

describe.skipIf(!testUrl)("schema initialization recovery without process restart", () => {
  let admin, adapter, root, schema;
  const clients = [], queries = [];
  beforeAll(async () => {
    schema = `artemis_retry_${randomUUID().replaceAll("-", "")}`;
    root = await mkdtemp(path.join(os.tmpdir(), "artemis-db-retry-"));
    admin = postgres(testUrl, { ssl: false });
    vi.stubEnv("DATA_DIR", root); vi.stubEnv("DATABASE_URL", testUrl); vi.resetModules();
    vi.doMock("postgres", () => ({ default: (url, options) => {
      const client = postgres(url, { ...options, ssl: false, connection: { search_path: schema },
        debug: (_, query) => { if (/create table/i.test(query)) queries.push(query); } });
      clients.push(client); return client;
    } }));
    const { createSessionStorageAdapter } = await import("../server/sessionStorageAdapter.js");
    adapter = createSessionStorageAdapter(SAVE_SLOTS);
  });
  afterAll(async () => {
    vi.doUnmock("postgres"); vi.unstubAllEnvs();
    await Promise.all(clients.map((client) => client.end({ timeout: 1 })));
    if (admin) { await admin.unsafe(`drop schema if exists ${schema} cascade`); await admin.end({ timeout: 1 }); }
    if (root) await rm(root, { recursive: true, force: true });
  });
  test("shares a failed real database attempt, retries after recovery and caches success", async () => {
    // The isolated search_path schema does not exist yet: PostgreSQL actually
    // rejects CREATE TABLE. Recovery creates it without restarting the adapter.
    const failures = await Promise.allSettled([adapter.ensurePaths(), adapter.ensurePaths()]);
    expect(failures.every((result) => result.status === "rejected")).toBe(true);
    expect(failures[0].reason).toMatchObject({ code: "3F000" });
    expect(queries).toHaveLength(1);
    await admin.unsafe(`create schema ${schema}`);
    await Promise.all([adapter.ensurePaths(), adapter.ensurePaths()]);
    expect(queries).toHaveLength(3);
    const payload = { ...createMissionSession(), narration: "Recovered", lastUpdatedIso: "2026-01-01T00:00:00.000Z" };
    await adapter.saveSession("slot-1", payload, "retry-player");
    expect((await adapter.loadSession(undefined, "retry-player")).session.narration).toBe("Recovered");
    expect((await adapter.listSessions("retry-player")).activeSlotId).toBe("slot-1");
    await adapter.ensurePaths();
    expect(queries).toHaveLength(3);
  });
});
