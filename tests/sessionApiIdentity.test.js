import { createMissionSession } from "../src/game/worldState.js";

beforeEach(() => { vi.resetModules(); window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function verifyStableNetworkIdentity() {
  const api = await import("../src/services/sessionApi.js");
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ slots: [], session: createMissionSession() }) });
  vi.stubGlobal("fetch", fetch);
  await api.listSessions();
  await api.loadSession("slot-1");
  await api.saveSession("slot-1", createMissionSession());
  await api.deleteSession("slot-1");
  const playerIds = fetch.mock.calls.map(([, options]) => options.headers["x-player-id"]);
  expect(new Set(playerIds).size).toBe(1);
  expect(playerIds[0]).toMatch(/^[a-zA-Z0-9-]+$/);
  expect(playerIds[0]).not.toBe("local-player");
  expect(api.getPlayerId()).toBe(playerIds[0]);
  expect(fetch.mock.calls[2][1].headers["Content-Type"]).toBe("application/json");
  return playerIds[0];
}

test("preserves the existing stored identity across actual session requests", async () => {
  window.localStorage.setItem("artemis-lost-player-id", "existing-player-123");
  expect(await verifyStableNetworkIdentity()).toBe("existing-player-123");
});

test("denied localStorage getter uses a stable tab identity and allows requests", async () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  await verifyStableNetworkIdentity();
});

test("denied getItem and setItem use one identity across all requests", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  await verifyStableNetworkIdentity();
});

test("quota failures do not generate a new identity for every request", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage full", "QuotaExceededError"); });
  await verifyStableNetworkIdentity();
});

test("an existing identity remains stable if storage becomes unavailable later", async () => {
  window.localStorage.setItem("artemis-lost-player-id", "existing-player-123");
  const api = await import("../src/services/sessionApi.js");
  expect(api.getPlayerId()).toBe("existing-player-123");
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  expect(await verifyStableNetworkIdentity()).toBe("existing-player-123");
});

test("a fallback identity persists when browser storage becomes available again", async () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  const api = await import("../src/services/sessionApi.js");
  const fallbackId = api.getPlayerId();
  read.mockRestore(); write.mockRestore();
  expect(api.getPlayerId()).toBe(fallbackId);
  expect(window.localStorage.getItem("artemis-lost-player-id")).toBe(fallbackId);
});
