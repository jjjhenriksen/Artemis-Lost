// @vitest-environment node
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { createRoomService } from "../server/multiplayerRooms.js";
import { createPostgresRoomRepository } from "../server/multiplayerRepository.js";

// Opt-in disposable endpoint only. Never connect to a developer DATABASE_URL.
const testUrl = process.env.ARTEMIS_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("real PostgreSQL co-op persistence", () => {
  let admin, firstClient, secondClient, schema, repository, other, rooms, host;
  beforeAll(async () => {
    schema = `multiplayer_test_${randomUUID().replaceAll("-", "")}`;
    admin = postgres(testUrl, { ssl: false });
    await admin.unsafe(`create schema ${schema}`);
    firstClient = postgres(testUrl, { ssl: false, connection: { search_path: schema } });
    secondClient = postgres(testUrl, { ssl: false, connection: { search_path: schema } });
    repository = createPostgresRoomRepository({ sql: firstClient });
    other = createPostgresRoomRepository({ sql: secondClient });
    rooms = createRoomService({ repository });
  });
  beforeEach(async () => {
    host = await rooms.create({ name: "Database Host", seatId: "vasquez" });
  });
  afterAll(async () => {
    await Promise.all([firstClient?.end({ timeout: 1 }), secondClient?.end({ timeout: 1 })]);
    if (admin) { await admin.unsafe(`drop schema if exists ${schema} cascade`); await admin.end({ timeout: 1 }); }
  });
  test("reconstructs the room and authenticates original members with a fresh SQL client", async () => {
    await rooms.start(host.room.id, host.token);
    const before = await rooms.chat(host.room.id, host.token, { text: "Persisted" });
    expect(await createRoomService({ repository: other }).view(host.room.id, host.token)).toEqual(before);
    const rows = await firstClient`select payload from multiplayer_rooms where room_id = ${host.room.id}`;
    expect(rows[0].payload.members[0].tokenHash).not.toBe(host.token);
    expect(JSON.stringify(before)).not.toContain(rows[0].payload.members[0].tokenHash);
  });
  test("database CAS admits exactly one competing writer", async () => {
    const original = await repository.load(host.room.id);
    const a = structuredClone(original), b = structuredClone(original);
    a.revision++; b.revision++; a.session.narration = "A"; b.session.narration = "B";
    const results = await Promise.allSettled([repository.save(a, 0), other.save(b, 0)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected").reason).toMatchObject({ status: 409 });
    expect((await repository.load(host.room.id)).revision).toBe(1);
  });
  test("database failure rolls back state, turn and revision before acknowledgement", async () => {
    const before = await repository.load(host.room.id);
    await firstClient.unsafe(`create or replace function refuse_room_update() returns trigger language plpgsql as $$
      begin raise exception 'isolated injected storage failure'; end $$;
      create trigger fail_room_write before update on multiplayer_rooms for each row execute function refuse_room_update();`);
    try {
      await expect(rooms.transaction(host.room.id, host.token, (room) => {
        room.session.turn = 1; room.session.narration = "Must roll back";
      })).rejects.toMatchObject({ code: "ROOM_STORAGE_UNAVAILABLE", status: 503 });
      expect(await repository.load(host.room.id)).toEqual(before);
    } finally { await firstClient.unsafe("drop trigger fail_room_write on multiplayer_rooms"); }
    expect((await rooms.chat(host.room.id, host.token, { text: "Retry" })).revision).toBe(1);
  });
  test("invalid persisted schema is reported and preserved", async () => {
    await firstClient`update multiplayer_rooms set payload = ${firstClient.json({ schemaVersion: 99 })}::jsonb where room_id = ${host.room.id}`;
    await expect(repository.load(host.room.id)).rejects.toMatchObject({ code: "INVALID_ROOM_RECORD" });
    const rows = await firstClient`select payload from multiplayer_rooms where room_id = ${host.room.id}`;
    expect(rows[0].payload).toEqual({ schemaVersion: 99 });
  });
});
