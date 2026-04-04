export async function listSessions() {
  const res = await fetch("/api/sessions");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data;
}

export async function loadSession(slotId) {
  const res = await fetch(`/api/session/${slotId}`);
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
    headers: { "Content-Type": "application/json" },
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
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data;
}
