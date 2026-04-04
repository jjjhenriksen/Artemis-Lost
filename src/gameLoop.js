import { EVENT_LOG_TYPES } from "./eventLogTypes";

function parseMet(met) {
  const match = typeof met === "string" ? met.match(/^T\+(\d+):(\d{2})(?::(\d{2}))?$/) : null;
  if (!match) return null;

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: match[3] ? Number(match[3]) : null,
  };
}

function formatMet({ hours, minutes, seconds }) {
  const hh = String(Math.max(0, hours)).padStart(2, "0");
  const mm = String(Math.max(0, minutes)).padStart(2, "0");

  if (seconds == null) {
    return `T+${hh}:${mm}`;
  }

  const ss = String(Math.max(0, seconds)).padStart(2, "0");
  return `T+${hh}:${mm}:${ss}`;
}

export function getNextTurnIndex(crew, currentTurn) {
  if (!Array.isArray(crew) || crew.length === 0) return 0;
  return (currentTurn + 1) % crew.length;
}

export function createActionLogEntry(worldState, activeCrew, action) {
  return {
    ts: worldState?.mission?.met || "T+00:00",
    msg: `${activeCrew.name}: "${action}"`,
    type: EVENT_LOG_TYPES.COMMAND,
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

export function advanceMissionMet(currentMet, minutesToAdd = 1) {
  const parsed = parseMet(currentMet);
  if (!parsed) return currentMet || "T+00:01";

  const nextTotalMinutes = parsed.hours * 60 + parsed.minutes + minutesToAdd;

  return formatMet({
    hours: Math.floor(nextTotalMinutes / 60),
    minutes: nextTotalMinutes % 60,
    seconds: parsed.seconds,
  });
}
