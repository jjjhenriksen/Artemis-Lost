export function getNextTurnIndex(crew, currentTurn) {
  if (!Array.isArray(crew) || crew.length === 0) return 0;
  return (currentTurn + 1) % crew.length;
}

export function createActionLogEntry(worldState, activeCrew, action) {
  return {
    ts: worldState?.mission?.met || "T+00:00",
    msg: `${activeCrew.name}: "${action}"`,
    type: "action",
  };
}

export function prependCappedEntries(entries, newEntries, limit = 12) {
  // Normalize single entries and batches so callers can use the same helper either way.
  const normalizedNewEntries = Array.isArray(newEntries) ? newEntries : [newEntries];
  return [...normalizedNewEntries, ...entries].slice(0, limit);
}

export function appendConversationEntry(history, entry, limit = 24) {
  // Keep only the most recent turns to stop conversation history from growing forever.
  return [...history, entry].slice(-limit);
}
