const STORAGE_KEY = "artemis-coop-v1";
let memoryCredentials = null;

export function loadRoomCredentials() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch { return memoryCredentials; }
  try {
    const saved = JSON.parse(raw || "null");
    if (saved?.version === 1 && typeof saved.roomId === "string" && typeof saved.token === "string") {
      memoryCredentials = saved;
    } else memoryCredentials = null;
  } catch { memoryCredentials = null; }
  return memoryCredentials;
}

export function saveRoomCredentials(credentials) {
  memoryCredentials = credentials ? { ...credentials, version: 1 } : null;
  try {
    if (memoryCredentials) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCredentials));
    else window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createCommandId() {
  return crypto.randomUUID();
}

export async function multiplayerRequest(path, { method = "GET", body, token, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), path.endsWith("/actions") ? 90000 : 15000);
  try {
    const response = await fetch(`/api/multiplayer${path}`, {
      method,
      cache: "no-store",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "The room request failed. Try reconnecting.");
      error.status = response.status;
      error.code = data.code;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

// A recursive timer prevents overlapping reads; cleanup also guards late responses.
export function subscribeToRoom(credentials, { onRoom, onError, isBusy = () => false, request = multiplayerRequest, interval = 1000 }) {
  let stopped = false;
  let timer;
  let controller;
  async function poll() {
    if (stopped) return;
    if (!isBusy()) {
      controller = new AbortController();
      try {
        const { room } = await request(`/rooms/${encodeURIComponent(credentials.roomId)}`, { token: credentials.token, signal: controller.signal });
        if (!stopped) onRoom(room);
      } catch (error) {
        if (!stopped) onError(error);
      }
    }
    if (!stopped) timer = setTimeout(poll, interval);
  }
  void poll();
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
}
