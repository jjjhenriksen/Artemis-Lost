import request from "supertest";
import { createApp } from "../server/dmServer.mjs";
import { createMissionSession } from "../src/game/worldState.js";

const malformed = [
  ["negative turn", (s) => { s.turn = -1; }],
  ["nonfinite turn", (s) => { s.turn = Infinity; }],
  ["fractional turn", (s) => { s.turn = 1.5; }],
  ["missing environment", (s) => { delete s.worldState.environment; }],
  ["object location", (s) => { s.worldState.environment.location = {}; }],
  ["invalid hazards", (s) => { s.worldState.environment.hazards = "dust"; }],
  ["invalid objectives", (s) => { s.worldState.mission.objectives = [42]; }],
  ["invalid systems", (s) => { s.worldState.systems.o2 = "full"; }],
  ["invalid crew extra", (s) => { s.worldState.crew[0].extra = null; }],
  ["invalid event", (s) => { s.worldState.eventLog = [null]; }],
  ["invalid history", (s) => { s.conversationHistory = {}; }],
  ["invalid history entry", (s) => { s.conversationHistory = [{ role: "user", content: {} }]; }],
  ["invalid narration", (s) => { s.narration = 12; }],
  ["invalid creation flag", (s) => { s.createdFromCharacterCreation = "true"; }],
];

describe("session request validation", () => {
  test.each(malformed)("rejects %s before saving", async (_name, mutate) => {
    const saveSessionImpl = vi.fn();
    const app = createApp({ saveSessionImpl });
    const payload = createMissionSession();
    mutate(payload);
    const response = await request(app).put("/api/session/slot-1").send(payload);
    expect(response.status).toBe(400);
    expect(saveSessionImpl).not.toHaveBeenCalled();
  });

  test.each(["get", "put", "delete"])("rejects unknown slot on %s before storage", async (method) => {
    const deps = { loadSessionImpl: vi.fn(), saveSessionImpl: vi.fn(), deleteSessionImpl: vi.fn() };
    const response = await request(createApp(deps))[method]("/api/session/not-a-slot").send(createMissionSession());
    expect(response.status).toBe(400);
    for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled();
  });

  test("accepts a full mission fixture", async () => {
    const saveSessionImpl = vi.fn(async (_slot, session) => session);
    const payload = createMissionSession();
    const response = await request(createApp({ saveSessionImpl })).put("/api/session/slot-1")
      .set("x-player-id", "synthetic-owner").send(payload);
    expect(response.status).toBe(200);
    expect(saveSessionImpl).toHaveBeenCalledWith("slot-1", payload, "synthetic-owner");
  });
});

test("validates all mission seeds and real local turn updates", async () => {
  const { assertValidSession } = await import("../server/sessionValidation.js");
  const { MISSION_SEEDS } = await import("../src/game/missionSeeds.js");
  const { resolveTurnWorldState } = await import("../src/game/turnRuntime.js");
  for (const seed of MISSION_SEEDS) {
    const session = createMissionSession(undefined, seed);
    expect(() => assertValidSession(session)).not.toThrow();
    const { nextWorldState, nextTurn } = resolveTurnWorldState({
      worldState: session.worldState, activeCrew: session.worldState.crew[0],
      actionText: "Delegate repairs to the flight engineer and stabilize the rover", currentTurn: 0,
    });
    expect(() => assertValidSession({ ...session, worldState: nextWorldState, turn: nextTurn })).not.toThrow();
  }
});
