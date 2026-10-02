import { requestDmTurn, requestAutonomousAction } from "../src/services/dmApi.js";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });
test("solo DM and AI actions use the same existing player partition as saved sessions", async () => {
  window.localStorage.setItem("artemis-lost-player-id", "fixture-player");
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ narration: "Fixture", action: "Fixture" }) }));
  vi.stubGlobal("fetch", fetch);
  await requestDmTurn({ worldState: {}, activeCrew: {}, action: "Fixture" });
  await requestAutonomousAction({ worldState: {}, activeCrew: {} });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [, init] of fetch.mock.calls) expect(init.headers["x-player-id"]).toBe("fixture-player");
});

test("client callers retain distinguishable retryable timeout information", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 504, json: async () => ({ error: "Timed out", code: "TURN_TIMEOUT", retryable: true }) })));
  for (const invoke of [requestDmTurn, requestAutonomousAction]) {
    expect(await invoke({ worldState: {}, activeCrew: {}, action: "Fixture" })).toMatchObject({ code: "TURN_TIMEOUT", retryable: true, status: 504 });
  }
});
