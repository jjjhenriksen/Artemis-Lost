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
  const normalizedNewEntries = Array.isArray(newEntries) ? newEntries : [newEntries];
  return [...normalizedNewEntries, ...entries].slice(0, limit);
}

export function appendConversationEntry(history, entry, limit = 24) {
  return [...history, entry].slice(-limit);
}
