const PLAYER_STORAGE_KEY = "artemis-lost-player-id";

function createPlayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `player-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPlayerId() {
  if (typeof window === "undefined") return "local-player";

  let playerId = window.localStorage.getItem(PLAYER_STORAGE_KEY);
  if (!playerId) {
    playerId = createPlayerId();
    window.localStorage.setItem(PLAYER_STORAGE_KEY, playerId);
  }

  return playerId;
}

function createSessionHeaders(extraHeaders = {}) {
  return {
    "x-player-id": getPlayerId(),
    ...extraHeaders,
  };
}

export async function listSessions() {
  const res = await fetch("/api/sessions", {
    headers: createSessionHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data;
}

export async function loadSession(slotId) {
  const res = await fetch(`/api/session/${slotId}`, {
    headers: createSessionHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data.session ?? null;
}

export async function saveSession(
  slotId,
  { worldState, narration, turn, conversationHistory, createdFromCharacterCreation }
) {
  const res = await fetch(`/api/session/${slotId}`, {
    method: "PUT",
    headers: createSessionHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      worldState,
      narration,
      turn,
      conversationHistory,
      createdFromCharacterCreation,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data.session ?? null;
}

export async function deleteSession(slotId) {
  const res = await fetch(`/api/session/${slotId}`, {
    method: "DELETE",
    headers: createSessionHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data;
}
