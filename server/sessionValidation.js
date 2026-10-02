export const SAVE_SLOTS = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
];

export class SessionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionValidationError";
    this.status = 400;
    this.code = "INVALID_SESSION";
  }
}

export function assertKnownSlot(slotId) {
  if (!SAVE_SLOTS.some((slot) => slot.id === slotId)) {
    const error = new SessionValidationError("Unknown save slot. Choose slot-1, slot-2, or slot-3.");
    error.code = "INVALID_SAVE_SLOT";
    throw error;
  }
}

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isString = (value) => typeof value === "string";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isTurn = (value) => Number.isSafeInteger(value) && value >= 0;
const isStrings = (value) => Array.isArray(value) && value.every(isString);

function requireValue(value, check, field) {
  if (!check(value)) throw new SessionValidationError(`Invalid session field: ${field}.`);
}

function optionalFields(record, fields, prefix) {
  for (const [field, check] of Object.entries(fields)) {
    if (record[field] !== undefined) requireValue(record[field], check, `${prefix}.${field}`);
  }
}

// Preserve extensible game state while rejecting values JSON cannot safely persist.
function assertJsonValue(value, depth = 0) {
  if (depth > 64) throw new SessionValidationError("Session state is nested too deeply.");
  if (value === null || isString(value) || typeof value === "boolean" || isNumber(value)) return;
  if (Array.isArray(value) || (isRecord(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
    for (const child of Object.values(value)) assertJsonValue(child, depth + 1);
    return;
  }
  throw new SessionValidationError("Session state must contain JSON values and finite numbers.");
}

export function assertValidSession(session) {
  requireValue(session, isRecord, "session");
  if (!session.worldState || session.turn === undefined) {
    throw new SessionValidationError("Missing worldState or turn");
  }
  requireValue(session.turn, isTurn, "turn");
  optionalFields(session, {
    narration: isString,
    createdFromCharacterCreation: (value) => typeof value === "boolean",
  }, "session");

  const world = session.worldState;
  requireValue(world, isRecord, "worldState");
  requireValue(world.mission, isRecord, "worldState.mission");
  requireValue(world.mission.phase, isString, "worldState.mission.phase");
  requireValue(world.mission.objectives, isStrings, "worldState.mission.objectives");
  optionalFields(world.mission, {
    id: isString, name: isString, met: isString, briefing: isString,
    seedId: isString, seedLabel: isString, seedSummary: isString, seedTone: isStrings,
    decisionPressure: isString, suggestedOpening: isString,
    relationshipLedger: (value) => isRecord(value) && Object.values(value).every(isNumber),
    outcome: (value) => isRecord(value) && ["active", "victory", "defeat"].includes(value.status)
      && isString(value.title) && isString(value.summary),
  }, "worldState.mission");

  requireValue(world.environment, isRecord, "worldState.environment");
  for (const field of ["location", "anomaly"]) {
    requireValue(world.environment[field], isString, `worldState.environment.${field}`);
  }
  requireValue(world.environment.hazards, isStrings, "worldState.environment.hazards");
  optionalFields(world.environment, { visibility: isString, pressure: isString }, "worldState.environment");

  requireValue(world.systems, isRecord, "worldState.systems");
  for (const field of ["o2", "power", "comms"]) {
    requireValue(world.systems[field], isNumber, `worldState.systems.${field}`);
  }
  for (const [field, value] of Object.entries(world.systems)) {
    requireValue(value, (v) => isNumber(v) || isString(v), `worldState.systems.${field}`);
  }
  optionalFields(world.systems, { propulsion: isNumber, thermal: isNumber, nav: isNumber, scrubber: isString }, "worldState.systems");

  requireValue(world.crew, Array.isArray, "worldState.crew");
  for (const member of world.crew) {
    requireValue(member, isRecord, "worldState.crew member");
    for (const field of ["id", "name", "role"]) requireValue(member[field], isString, `crew.${field}`);
    for (const field of ["health", "morale"]) requireValue(member[field], isNumber, `crew.${field}`);
    requireValue(member.extra, isRecord, "crew.extra");
    requireValue(member.extra.label, isString, "crew.extra.label");
    requireValue(member.extra.value, isNumber, "crew.extra.value");
    optionalFields(member.extra, { detail: isString, unit: isString }, "crew.extra");
    optionalFields(member, { location: isString, status: isString, notes: isString, inventory: isStrings }, "crew");
    if (member.character !== undefined) {
      requireValue(member.character, isRecord, "crew.character");
      optionalFields(member.character, {
        callSign: isString, trait: isString, specialty: isString, flaw: isString,
        personalStake: isString, tensionNote: isString,
        controller: (value) => ["human", "bot"].includes(value),
      }, "crew.character");
    }
  }

  requireValue(world.eventLog, Array.isArray, "worldState.eventLog");
  for (const event of world.eventLog) {
    requireValue(event, isRecord, "worldState.eventLog entry");
    for (const field of ["ts", "type", "msg"]) requireValue(event[field], isString, `eventLog.${field}`);
  }
  if (session.conversationHistory !== undefined) {
    requireValue(session.conversationHistory, Array.isArray, "conversationHistory");
    for (const entry of session.conversationHistory) {
      requireValue(entry, isRecord, "conversationHistory entry");
      requireValue(entry.role, (value) => ["system", "user", "assistant"].includes(value), "conversationHistory.role");
      requireValue(entry.content, isString, "conversationHistory.content");
      optionalFields(entry, { turn: isTurn, crewName: isString }, "conversationHistory");
    }
  }
  assertJsonValue(session);
}
