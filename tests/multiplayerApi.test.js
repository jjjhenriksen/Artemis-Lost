import { loadRoomCredentials, multiplayerRequest, saveRoomCredentials, subscribeToRoom } from "../src/services/multiplayerApi.js";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); saveRoomCredentials(null); });

test("unavailable browser storage keeps credentials in memory without throwing", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(saveRoomCredentials({ roomId: "room", token: "secret" })).toBe(false);
  expect(loadRoomCredentials()).toMatchObject({ roomId: "room", token: "secret", version: 1 });
  saveRoomCredentials(null);
  expect(loadRoomCredentials()).toBeNull();
});

test("requests send credentials only in the bearer header and expose safe API errors", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Seat occupied", code: "SEAT_TAKEN" }) });
  vi.stubGlobal("fetch", fetch);
  await expect(multiplayerRequest("/rooms/room/seat", { method: "POST", token: "secret", body: { seatId: "park" } })).rejects.toMatchObject({ status: 409, code: "SEAT_TAKEN" });
  expect(fetch).toHaveBeenCalledWith("/api/multiplayer/rooms/room/seat", expect.objectContaining({ cache: "no-store", headers: { "Content-Type": "application/json", Authorization: "Bearer secret" }, body: '{"seatId":"park"}' }));
});

test("readable browser storage honors a removed or invalid credential record", () => {
  saveRoomCredentials({ roomId: "room", token: "secret" });
  window.localStorage.removeItem("artemis-coop-v1");
  expect(loadRoomCredentials()).toBeNull();
  saveRoomCredentials({ roomId: "room", token: "secret" });
  window.localStorage.setItem("artemis-coop-v1", '{"version":2,"roomId":"wrong","token":"old"}');
  expect(loadRoomCredentials()).toBeNull();
  saveRoomCredentials({ roomId: "room", token: "secret" });
  window.localStorage.setItem("artemis-coop-v1", "broken json");
  expect(loadRoomCredentials()).toBeNull();
});

test("polling never overlaps a slow read and cleanup ignores a late response", async () => {
  vi.useFakeTimers();
  let resolve;
  const request = vi.fn(() => new Promise((done) => { resolve = done; }));
  const onRoom = vi.fn();
  const stop = subscribeToRoom({ roomId: "room", token: "secret" }, { request, onRoom, onError: vi.fn() });
  await vi.advanceTimersByTimeAsync(5000);
  expect(request).toHaveBeenCalledTimes(1);
  stop();
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  resolve({ room: { revision: 1 } });
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(5000);
  expect(onRoom).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

test("polling pauses during commands and resumes one read per interval", async () => {
  vi.useFakeTimers();
  let busy = true;
  const request = vi.fn().mockResolvedValue({ room: { revision: 1 } });
  const stop = subscribeToRoom({ roomId: "room", token: "secret" }, { request, onRoom: vi.fn(), onError: vi.fn(), isBusy: () => busy });
  await vi.advanceTimersByTimeAsync(1000);
  expect(request).not.toHaveBeenCalled();
  busy = false;
  await vi.advanceTimersByTimeAsync(1000);
  expect(request).toHaveBeenCalledTimes(1);
  stop();
});

test("network calls abort at the bounded timeout", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))));
  const result = multiplayerRequest("/rooms/room").catch((error) => error);
  await vi.advanceTimersByTimeAsync(15000);
  expect(await result).toMatchObject({ name: "AbortError" });
});
