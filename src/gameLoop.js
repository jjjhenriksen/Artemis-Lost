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

export function appendConversationEntry(history, entry) {
  return [...history, entry].slice(-12);
}
