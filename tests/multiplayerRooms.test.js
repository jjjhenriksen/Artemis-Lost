// @vitest-environment node
import { createRoomService, createMemoryRoomRepository, assertValidRoom } from "../server/multiplayerRooms.js";

describe("private co-op room domain", () => {
  let repository, rooms, host;
  beforeEach(async () => {
    repository = createMemoryRoomRepository(); rooms = createRoomService({ repository });
    host = await rooms.create({ name: "Host", seatId: "vasquez" });
  });
  const join = (rooms, host, name = "Engineer", seatId = "okafor") => rooms.join(host.room.id, { name, seatId, inviteCode: host.inviteCode });

  test("creates canonical mission with secure hashed credentials and sanitized snapshots", async () => {
    const record = await repository.load(host.room.id);
    expect(host.token.length).toBeGreaterThanOrEqual(32);
    expect(host.inviteCode).not.toBe(host.token);
    expect(record.members[0].tokenHash).not.toBe(host.token);
    expect(record.inviteHash).not.toBe(host.inviteCode);
    expect(host.room.session.worldState.crew.map((m) => m.character.controller)).toEqual(["human", "bot", "bot", "bot"]);
    expect(JSON.stringify(host.room)).not.toMatch(/tokenHash|inviteHash|commandReceipts/);
    expect(JSON.stringify(host.room)).not.toContain(host.token);
    host.room.session.narration = "tampered";
    expect((await rooms.view(host.room.id, host.token)).session.narration).not.toBe("tampered");
  });
  test("requires invitation and room-specific credentials, including after reconnect", async () => {
    await expect(rooms.join(host.room.id, { name: "Intruder", inviteCode: "x".repeat(40) })).rejects.toMatchObject({ status: 401 });
    const other = await rooms.create({ name: "Other", seatId: "park" });
    await expect(rooms.view(host.room.id, other.token)).rejects.toMatchObject({ status: 401 });
    const freshService = createRoomService({ repository });
    expect((await freshService.view(host.room.id, host.token)).me.id).toBe(host.memberId);
    await expect(rooms.view("../../secret", host.token)).rejects.toMatchObject({ status: 400 });
  });
  test("serializes exclusive seat claims and releases old seats on switching", async () => {
    const outcomes = await Promise.allSettled([join(rooms, host, "A"), join(rooms, host, "B")]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((r) => r.status === "rejected").reason.status).toBe(409);
    const player = outcomes.find((r) => r.status === "fulfilled").value;
    const switched = await rooms.claimSeat(host.room.id, player.token, { seatId: "reyes" });
    expect(switched.session.worldState.crew.map((m) => m.character.controller)).toEqual(["human", "bot", "human", "bot"]);
    expect((await rooms.claimSeat(host.room.id, player.token, { seatId: "reyes" })).revision).toBe(switched.revision);
  });
  test("host-only start requires a human, then permits a vacant bot-seat claim", async () => {
    const guest = await join(rooms, host);
    await expect(rooms.start(host.room.id, guest.token)).rejects.toMatchObject({ status: 403 });
    expect((await rooms.start(host.room.id, host.token)).status).toBe("active");
    expect((await rooms.claimSeat(host.room.id, guest.token, { seatId: "park" })).me.seatId).toBe("park");
    const spectator = await rooms.create({ name: "Observer" });
    await expect(rooms.start(spectator.room.id, spectator.token)).rejects.toMatchObject({ code: "SEAT_REQUIRED" });
  });
  test("leaving revokes membership, transfers host and returns vacant seats to bots", async () => {
    const guest = await join(rooms, host);
    const remaining = await rooms.leave(host.room.id, host.token);
    expect(remaining.me).toBeNull(); expect(remaining.hostMemberId).toBe(guest.memberId);
    expect(remaining.session.worldState.crew[0].character.controller).toBe("bot");
    await expect(rooms.view(host.room.id, host.token)).rejects.toMatchObject({ status: 401 });
    await rooms.leave(host.room.id, guest.token);
    const closed = await repository.load(host.room.id);
    expect(closed.status).toBe("resolved"); expect(closed.hostMemberId).toBeNull();
    await expect(join(rooms, host)).rejects.toMatchObject({ code: "ROOM_CLOSED" });
  });
  test("bounded messages remain shared after their author leaves", async () => {
    const guest = await join(rooms, host);
    for (let i = 0; i < 103; i++) await rooms.chat(host.room.id, guest.token, { text: `Message ${i}` });
    await rooms.leave(host.room.id, guest.token);
    const view = await rooms.view(host.room.id, host.token);
    expect(view.messages).toHaveLength(100); expect(view.messages[0].text).toBe("Message 3");
    expect(view.messages.at(-1).name).toBe("Engineer");
    await expect(rooms.chat(host.room.id, host.token, { text: "a".repeat(1001) })).rejects.toMatchObject({ status: 400 });
  });
  test("failed callbacks and durable commits cannot mutate canonical memory state", async () => {
    const before = await repository.load(host.room.id);
    await expect(rooms.transaction(host.room.id, host.token, (room) => { room.session.narration = "bad"; throw new Error("provider failed"); })).rejects.toThrow("provider failed");
    expect(await repository.load(host.room.id)).toEqual(before);
    const save = repository.save;
    repository.save = async () => { throw new Error("disk failed"); };
    await expect(rooms.chat(host.room.id, host.token, { text: "not acknowledged" })).rejects.toThrow("disk failed");
    expect(await repository.load(host.room.id)).toEqual(before);
    repository.save = save;
    expect((await rooms.chat(host.room.id, host.token, { text: "retry" })).revision).toBe(1);
  });
  test("queues are shared across services with the same repository", async () => {
    const second = createRoomService({ repository });
    const views = await Promise.all([rooms.chat(host.room.id, host.token, { text: "One" }), second.chat(host.room.id, host.token, { text: "Two" })]);
    expect(views.map((v) => v.revision)).toEqual([1, 2]);
    expect((await rooms.view(host.room.id, host.token)).messages.map((m) => m.text)).toEqual(["One", "Two"]);
  });
  test.each([{ name: "" }, { name: "\nprivate" }, { name: "x".repeat(49) }, { name: "Valid", seatId: "administrator" }, { name: "Valid", seedId: "unknown" }])("rejects malformed creation input %j", async (input) => {
    await expect(rooms.create(input)).rejects.toMatchObject({ status: 400 });
  });
  test("validates stored identity, exclusive membership, controller and session invariants", async () => {
    const original = await repository.load(host.room.id);
    for (const mutate of [r => r.id = "bad", r => r.members.push({ ...r.members[0] }), r => r.session.turn = 4,
      r => r.session.worldState.crew[1].character.controller = "human", r => r.schemaVersion = 2]) {
      const record = structuredClone(original); mutate(record);
      expect(() => assertValidRoom(record, host.room.id)).toThrow("original record was preserved");
    }
  });
});
