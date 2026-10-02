// @vitest-environment node
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createRoomService, createMemoryRoomRepository } from "../server/multiplayerRooms.js";
import { createFileRoomRepository, createMultiplayerRepository } from "../server/multiplayerRepository.js";

describe("durable co-op filesystem storage", () => {
  let directory, repository, rooms, host;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "artemis-room-"));
    repository = createFileRoomRepository({ directory }); rooms = createRoomService({ repository });
    host = await rooms.create({ name: "Host", seatId: "vasquez" });
  });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
  const filename = (directory, id) => path.join(directory, `${id}.json`);
  test("fresh server restores credentials, bot seats, narration, turn, receipts and chat", async () => {
    const guest = await rooms.join(host.room.id, { name: "Guest", seatId: "okafor", inviteCode: host.inviteCode });
    await rooms.start(host.room.id, host.token);
    await rooms.transaction(host.room.id, host.token, (room) => {
      room.session.turn = 1; room.session.narration = "Saved turn";
      room.commandReceipts.push({ memberId: host.memberId, commandId: "action-one", fingerprint: "request-one" });
    });
    const before = await rooms.chat(host.room.id, guest.token, { text: "Ready" });
    const fresh = createRoomService({ repository: createFileRoomRepository({ directory }) });
    expect(await fresh.view(host.room.id, guest.token)).toEqual(before);
    await fresh.leave(host.room.id, guest.token);
    await expect(fresh.view(host.room.id, guest.token)).rejects.toMatchObject({ status: 401 });
    expect((await fresh.view(host.room.id, host.token)).session.turn).toBe(1);
  });
  test("compare-and-swap across independent adapters never loses concurrent writes", async () => {
    const other = createFileRoomRepository({ directory });
    const original = await repository.load(host.room.id);
    const first = structuredClone(original), second = structuredClone(original);
    first.revision++; second.revision++; first.session.narration = "First"; second.session.narration = "Second";
    const attempts = await Promise.allSettled([repository.save(first, 0), other.save(second, 0)]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find((r) => r.status === "rejected").reason.status).toBe(409);
    const saved = await repository.load(host.room.id);
    expect(saved.revision).toBe(1); expect(["First", "Second"]).toContain(saved.session.narration);
    await expect(repository.save(first, 0)).rejects.toMatchObject({ status: 409 });
    expect(await readdir(directory)).toEqual([`${host.room.id}.json`]);
  });
  test("file CAS remains exclusive across independent server processes", async () => {
    const original = await repository.load(host.room.id);
    original.revision++;
    const script = `import {createFileRoomRepository} from ${JSON.stringify(new URL("../server/multiplayerRepository.js", import.meta.url).href)};
      const repo=createFileRoomRepository({directory:process.argv[1]});
      try { await repo.save(JSON.parse(process.argv[2]),0); process.stdout.write('saved'); }
      catch(error) { process.stdout.write(String(error.status)); }`;
    const run = () => promisify(execFile)(process.execPath, ["--input-type=module", "-e", script, directory, JSON.stringify(original)]);
    const results = await Promise.all([run(), run()]);
    expect(results.map((r) => r.stdout).sort()).toEqual(["409", "saved"]);
    expect((await repository.load(host.room.id)).revision).toBe(1);
  });
  test.each(["{interrupted", JSON.stringify({ schemaVersion: 99 }), "null"])("preserves corrupt record bytes: %s", async (data) => {
    const file = filename(directory, host.room.id);
    await writeFile(file, data);
    await expect(repository.load(host.room.id)).rejects.toMatchObject({ code: "INVALID_ROOM_RECORD" });
    await expect(repository.create((await createFixture()).record)).resolves.toBeUndefined();
    await expect(repository.save({ ...(await createFixture()).record, id: host.room.id, revision: 1 }, 0)).rejects.toMatchObject({ code: "INVALID_ROOM_RECORD" });
    expect(await readFile(file, "utf8")).toBe(data);
  });
  test("rejects mismatched file identity and symlinks without overwriting source", async () => {
    const file = filename(directory, host.room.id);
    const data = JSON.stringify((await createFixture()).record);
    await writeFile(file, data);
    await expect(repository.load(host.room.id)).rejects.toMatchObject({ code: "INVALID_ROOM_RECORD" });
    await rm(file); const foreign = path.join(directory, "foreign.json"); await writeFile(foreign, data); await symlink(foreign, file);
    await expect(repository.load(host.room.id)).rejects.toMatchObject({ code: "INVALID_ROOM_RECORD" });
    expect(await readFile(foreign, "utf8")).toBe(data);
  });
  test("refuses orphan lock without stealing it and preserves last committed state", async () => {
    const lock = `${filename(directory, host.room.id)}.lock`;
    await writeFile(lock, "orphan lock for operator review");
    await expect(rooms.chat(host.room.id, host.token, { text: "blocked" })).rejects.toMatchObject({ status: 409 });
    expect((await rooms.view(host.room.id, host.token)).revision).toBe(0);
    expect(await readFile(lock, "utf8")).toContain("operator review");
  });
  test("rejects traversal before filesystem operations and constructs lazy defaults", async () => {
    await expect(repository.load("../secret")).rejects.toMatchObject({ code: "INVALID_ROOM_ID" });
    const unused = path.join(directory, "unused");
    createMultiplayerRepository({ directory: unused, databaseUrl: "" });
    expect(await readdir(directory)).not.toContain("unused");
    expect(await repository.load(randomUUID())).toBeNull();
  });
});
async function createFixture() {
  const memory = createMemoryRoomRepository(); const service = createRoomService({ repository: memory });
  const credentials = await service.create({ name: "Fixture", seatId: "vasquez" });
  return { ...credentials, record: await memory.load(credentials.room.id) };
}
