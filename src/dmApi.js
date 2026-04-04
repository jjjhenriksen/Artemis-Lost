/**
 * Calls the local dev proxy (see server/dmServer.mjs). Same-origin /api in dev via Vite proxy.
 */
export async function requestDmTurn({ worldState, action, activeCrew }) {
  const res = await fetch("/api/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldState, action, activeCrew }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: data.error || data.message || `Request failed (${res.status})`,
    };
  }
  return data;
}
