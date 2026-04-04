export async function loadSession() {
  const res = await fetch("/api/session");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || `Request failed (${res.status})` };
  }
  return data.session ?? null;
}

export async function saveSession({
  worldState,
  narration,
  turn,
  conversationHistory,
  createdFromCharacterCreation,
}) {
  const res = await fetch("/api/session", {
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
