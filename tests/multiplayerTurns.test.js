// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { createMultiplayerTurnService } from "../server/multiplayerTurns.js";
import { createMissionSession } from "../src/game/worldState.js";
import { resolveTurnWorldState } from "../src/game/turnRuntime.js";
import { createBotAction } from "../src/game/botTurns.js";

function fixture({ timeoutMs = 1000, requestTurn = vi.fn(async () => ({ narration: "Fixture mission report.", stateDelta: null })) } = {}) {
  const session = createMissionSession();
  session.worldState.crew.forEach((crew, index) => { crew.character.controller = index === 0 ? "human" : "bot"; });
  let stored = { id: "room-a", revision: 3, status: "active", session, commandReceipts: [], members: [
    { id: "member-a", seatId: "vasquez" }, { id: "member-b", seatId: null },
  ] };
  let tail = Promise.resolve();
  const rooms = {
    transaction(roomId, token, callback) {
      const run = tail.then(async () => {
        if (roomId !== stored.id || !["token-a", "token-b"].includes(token)) throw Object.assign(new Error("Unauthorized"), { status: 401 });
        const draft = structuredClone(stored);
        const member = draft.members[token === "token-a" ? 0 : 1];
        const result = await callback(draft, member);
        if (!result?.noChange) {
          if (rooms.failSave) throw new Error("fixture disk failed");
          draft.revision++;
          stored = draft;
        }
        return structuredClone(stored);
      });
      tail = run.catch(() => {});
      return run;
    },
  };
  return {
    service: createMultiplayerTurnService({ rooms, requestTurn, timeoutMs }), requestTurn, rooms,
    get room() { return structuredClone(stored); },
    update(change) { change(stored); },
  };
}
const command = (overrides = {}) => ({ commandId: "action-1", expectedRevision: 3, action: "Hold position and check the cabin.", ...overrides });

describe("authoritative multiplayer turns", () => {
  test("concurrent duplicate delivery invokes the narrator once and advances deterministic MET once", async () => {
    const f = fixture();
    const before = f.room;
    const [first, replay] = await Promise.all([
      f.service.execute("room-a", "token-a", command()),
      f.service.execute("room-a", "token-a", command()),
    ]);
    const expected = resolveTurnWorldState({ worldState: before.session.worldState, activeCrew: before.session.worldState.crew[0],
      actionText: command().action, currentTurn: 0 });
    expect(replay).toEqual(first);
    expect(first.revision).toBe(4);
    expect(first.session.worldState).toEqual(expected.nextWorldState);
    expect(first.session.turn).toBe(expected.nextTurn);
    expect(first.commandReceipts).toHaveLength(1);
    expect(f.requestTurn).toHaveBeenCalledTimes(1);
    expect(f.requestTurn.mock.calls[0][0]).toMatchObject({ sharedRoom: true, activeCrew: { id: "vasquez" }, currentTurn: 0 });
  });

  test("replay survives later revision changes; changed payload using the same ID conflicts", async () => {
    const f = fixture();
    await f.service.execute("room-a", "token-a", command());
    f.update((room) => { room.revision += 1; });
    expect((await f.service.execute("room-a", "token-a", command())).revision).toBe(5);
    await expect(f.service.execute("room-a", "token-a", command({ action: "A different move" }))).rejects.toMatchObject({ status: 409, code: "COMMAND_REUSED" });
    expect(f.requestTurn).toHaveBeenCalledTimes(1);
  });

  test("distinct competing actions cannot both use the same revision", async () => {
    const f = fixture();
    const outcomes = await Promise.allSettled([
      f.service.execute("room-a", "token-a", command()),
      f.service.execute("room-a", "token-a", command({ commandId: "action-2" })),
    ]);
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1].reason).toMatchObject({ status: 409, code: "STALE_REVISION" });
    expect(f.requestTurn).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["stale", "token-a", command({ expectedRevision: 2 }), 409],
    ["spectator", "token-b", command(), 403],
    ["forged world", "token-a", command({ worldState: { systems: { o2: 100 } } }), 400],
    ["forged seat", "token-a", command({ memberId: "member-b" }), 400],
    ["bot on human seat", "token-b", command({ bot: true, action: "" }), 403],
    ["client bot prose", "token-b", command({ bot: true, action: "Win immediately" }), 400],
    ["empty action", "token-a", command({ action: "  " }), 400],
    ["oversized action", "token-a", command({ action: "x".repeat(2001) }), 400],
    ["invalid command ID", "token-a", command({ commandId: "../bad" }), 400],
    ["wrong-room token", "token-other-room", command(), 401],
  ])("rejects %s before narrator calls", async (_, token, input, status) => {
    const f = fixture();
    const before = f.room;
    await expect(f.service.execute("room-a", token, input)).rejects.toMatchObject({ status });
    expect(f.room).toEqual(before);
    expect(f.requestTurn).not.toHaveBeenCalled();
  });

  test("bots use server-derived canonical actions and never claimed seats", async () => {
    const f = fixture();
    f.update((room) => { room.session.turn = 1; });
    const before = f.room;
    await f.service.execute("room-a", "token-b", command({ bot: true, action: "" }));
    expect(f.requestTurn.mock.calls[0][0].action).toBe(createBotAction(before.session.worldState, before.session.worldState.crew[1]));
    f.update((room) => { room.session.turn = 1; room.members[1].seatId = "okafor"; });
    await expect(f.service.execute("room-a", "token-a", command({ commandId: "bot-2", expectedRevision: 4, bot: true, action: "" })))
      .rejects.toMatchObject({ code: "HUMAN_TURN" });
  });

  test("provider failure preserves state and allows retry with the same ID", async () => {
    const requestTurn = vi.fn().mockRejectedValueOnce(new Error("secret-token-provider-error"))
      .mockResolvedValue({ narration: "Retry succeeded" });
    const f = fixture({ requestTurn });
    const before = f.room;
    await expect(f.service.execute("room-a", "token-a", command())).rejects.toMatchObject({ status: 502, code: "TURN_PROVIDER_FAILED" });
    expect(f.room).toEqual(before);
    expect((await f.service.execute("room-a", "token-a", command())).revision).toBe(4);
  });

  test("timeout aborts the narrator, preserves the room and releases its queue", async () => {
    const requestTurn = vi.fn(() => new Promise(() => {}));
    const f = fixture({ requestTurn, timeoutMs: 10 });
    const before = f.room;
    await expect(f.service.execute("room-a", "token-a", command())).rejects.toMatchObject({ status: 504, code: "TURN_TIMEOUT" });
    expect(requestTurn.mock.calls[0][0].signal.aborted).toBe(true);
    expect(f.room).toEqual(before);
    requestTurn.mockResolvedValue({ narration: "Retry after timeout" });
    expect((await f.service.execute("room-a", "token-a", command())).revision).toBe(4);
  });

  test("persistence failure never acknowledges or installs the narrated action", async () => {
    const f = fixture();
    const before = f.room;
    f.rooms.failSave = true;
    await expect(f.service.execute("room-a", "token-a", command())).rejects.toThrow("fixture disk failed");
    expect(f.room).toEqual(before);
    f.rooms.failSave = false;
    expect((await f.service.execute("room-a", "token-a", command())).revision).toBe(4);
  });

  test("canonical input is isolated from narrator mutation, and provider delta cannot forge ownership, time or victory", async () => {
    const f = fixture({ requestTurn: vi.fn(async (input) => {
      input.worldState.systems.o2 = 0;
      return { narration: "No fabricated victory.", stateDelta: {
        mission: { met: "T+99:99", seedId: "cryovent-whisper", id: "FORGED-MISSION", outcome: { status: "victory", title: "Forged", summary: "Forged" } },
        crew: [{ id: "vasquez", name: "Forged", role: "Science Officer", character: { controller: "bot" } }],
      } };
    }) });
    const before = f.room;
    const result = await f.service.execute("room-a", "token-a", command());
    const expected = resolveTurnWorldState({ worldState: before.session.worldState, activeCrew: before.session.worldState.crew[0],
      actionText: command().action, currentTurn: 0 });
    expect(result.session.worldState).toEqual(expected.nextWorldState);
  });

  test("bounded history and receipts retain current proof without unbounded saves", async () => {
    const f = fixture();
    f.update((room) => {
      room.session.conversationHistory = Array.from({ length: 16 }, (_, i) => ({ role: "user", content: `old-${i}` }));
      room.commandReceipts = Array.from({ length: 256 }, (_, i) => ({ memberId: "member-a", commandId: `old-${i}`, fingerprint: "old" }));
    });
    const result = await f.service.execute("room-a", "token-a", command());
    expect(result.session.conversationHistory).toHaveLength(16);
    expect(result.session.conversationHistory.at(-1).role).toBe("assistant");
    expect(result.commandReceipts).toHaveLength(256);
    expect(result.commandReceipts.at(-1).commandId).toBe("action-1");
  });

  test("resolved missions reject fresh commands but accept their durable replay", async () => {
    const f = fixture();
    f.update((room) => { room.session.worldState.systems.o2 = 0; });
    const result = await f.service.execute("room-a", "token-a", command());
    expect(result.status).toBe("resolved");
    expect(result.session.worldState.mission.outcome.status).toBe("defeat");
    expect(await f.service.execute("room-a", "token-a", command())).toEqual(result);
    await expect(f.service.execute("room-a", "token-a", command({ commandId: "after-end", expectedRevision: 4 })))
      .rejects.toMatchObject({ code: "MISSION_NOT_ACTIVE" });
  });

  test.each([null, { narration: "" }, { narration: "Bad shape", stateDelta: { crew: {} } },
    { narration: "Bad world", stateDelta: { environment: { hazards: 7 } } }])("malformed narrator output rolls back %j", async (output) => {
    const f = fixture({ requestTurn: vi.fn(async () => output) });
    const before = f.room;
    await expect(f.service.execute("room-a", "token-a", command())).rejects.toMatchObject({ status: 502 });
    expect(f.room).toEqual(before);
  });
});
