export const EVENT_LOG_TYPES = {
  COMMAND: "command",
  SYSTEM: "system",
  SENSOR: "sensor",
  TRAIT: "trait",
  RISK: "risk",
};

const EVENT_TYPE_ALIASES = {
  action: EVENT_LOG_TYPES.COMMAND,
  command: EVENT_LOG_TYPES.COMMAND,
  system: EVENT_LOG_TYPES.SYSTEM,
  info: EVENT_LOG_TYPES.SYSTEM,
  status: EVENT_LOG_TYPES.SYSTEM,
  sensor: EVENT_LOG_TYPES.SENSOR,
  alert: EVENT_LOG_TYPES.SENSOR,
  telemetry: EVENT_LOG_TYPES.SENSOR,
  trait: EVENT_LOG_TYPES.TRAIT,
  behavior: EVENT_LOG_TYPES.TRAIT,
  risk: EVENT_LOG_TYPES.RISK,
  warn: EVENT_LOG_TYPES.RISK,
  warning: EVENT_LOG_TYPES.RISK,
  consequence: EVENT_LOG_TYPES.RISK,
};

export function normalizeEventType(type) {
  if (typeof type !== "string") {
    return EVENT_LOG_TYPES.SYSTEM;
  }

  return EVENT_TYPE_ALIASES[type.trim().toLowerCase()] || EVENT_LOG_TYPES.SYSTEM;
}

export function getEventTypeLabel(type) {
  switch (normalizeEventType(type)) {
    case EVENT_LOG_TYPES.COMMAND:
      return "Command";
    case EVENT_LOG_TYPES.SENSOR:
      return "Sensor";
    case EVENT_LOG_TYPES.TRAIT:
      return "Trait";
    case EVENT_LOG_TYPES.RISK:
      return "Risk";
    case EVENT_LOG_TYPES.SYSTEM:
    default:
      return "System";
  }
}
