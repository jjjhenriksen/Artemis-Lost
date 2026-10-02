const PLAYER_STORAGE_KEY = "artemis-lost-player-id";
let memoryPlayerId;

function createPlayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `player-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPlayerId() {
  if (typeof window === "undefined") return "local-player";

  try {
    const storedPlayerId = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    if (storedPlayerId) {
      memoryPlayerId = storedPlayerId;
      return storedPlayerId;
    }
  } catch {
    // Privacy settings can deny both the storage getter and individual reads.
    // Do not overwrite an existing identity that could not be read.
    memoryPlayerId ||= createPlayerId();
    return memoryPlayerId;
  }

  memoryPlayerId ||= createPlayerId();
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, memoryPlayerId);
  } catch {
    // Keep one identity for this tab when writes are denied or quota is full.
  }
  return memoryPlayerId;
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
