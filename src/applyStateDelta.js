/**
 * Merges partial updates from the model into the previous world state.
 * crew: array of { id, ...patch } — patches are merged by matching id.
 * eventLog: new entries are prepended before the existing log.
 */
export function applyStateDelta(ws, delta) {
  if (!delta || typeof delta !== "object") return ws;
  const out = { ...ws };
  if (delta.mission) out.mission = { ...ws.mission, ...delta.mission };
  if (delta.environment) out.environment = { ...ws.environment, ...delta.environment };
  if (delta.systems) out.systems = { ...ws.systems, ...delta.systems };
  if (Array.isArray(delta.crew)) {
    out.crew = ws.crew.map((m) => {
      const patch = delta.crew.find((c) => c && c.id === m.id);
      return patch ? { ...m, ...patch } : m;
    });
  }
  if (Array.isArray(delta.eventLog)) {
    out.eventLog = [...delta.eventLog, ...ws.eventLog].slice(0, 12);
  }
  return out;
}
