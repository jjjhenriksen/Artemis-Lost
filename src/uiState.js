import { EVENT_LOG_TYPES, normalizeEventType } from "./eventLogTypes.js";
import { getTopCoordinationAlert } from "./roleMechanics";

function getDangerLevel(worldState) {
  const warningCount = [
    worldState?.systems?.o2 < 65,
    worldState?.systems?.power < 65,
    worldState?.systems?.comms < 40,
    worldState?.systems?.thermal < 60,
    worldState?.systems?.nav < 45,
    worldState?.crew?.some((member) => member.health < 60),
    worldState?.crew?.some((member) => member.morale < 55),
  ].filter(Boolean).length;

  if (warningCount >= 4) return "critical";
  if (warningCount >= 2) return "elevated";
  return "guarded";
}

function getDominantFailure(worldState) {
  const candidates = [
    ["o2", worldState?.systems?.o2],
    ["power", worldState?.systems?.power],
    ["comms", worldState?.systems?.comms],
    ["thermal", worldState?.systems?.thermal],
    ["nav", worldState?.systems?.nav],
  ].filter(([, value]) => typeof value === "number");

  return candidates.sort((a, b) => a[1] - b[1])[0]?.[0] || "comms";
}

function getAnomalyIntensity(worldState) {
  const anomalyText = `${worldState?.environment?.anomaly || ""} ${
    worldState?.mission?.seedSummary || ""
  }`.toLowerCase();
  const threatWords = ["impossible", "volatile", "machine", "ghost", "signal", "static"];
  const score = threatWords.filter((word) => anomalyText.includes(word)).length;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function getLatestAlert(eventLog = []) {
  const entry = eventLog.find((event) => {
    const type = normalizeEventType(event?.type);
    return type === EVENT_LOG_TYPES.RISK || type === EVENT_LOG_TYPES.TRAIT;
  });

  if (!entry) return null;

  const type = normalizeEventType(entry.type);
  return {
    type,
    ts: entry.ts,
    msg: entry.msg,
    label: type === EVENT_LOG_TYPES.TRAIT ? "Trait Trigger" : "Risk Alert",
  };
}

function getFailureCopy(dominantFailure, dangerLevel) {
  const byFailure = {
    comms: {
      subtitle:
        dangerLevel === "critical"
          ? "Signal discipline under blackout pressure"
          : "Comms degradation shaping command tempo",
      consolePrefix:
        dangerLevel === "critical"
          ? "Signal integrity is collapsing. Keep instructions short and verifiable."
          : "Relay noise is shaping the decision space.",
    },
    thermal: {
      subtitle:
        dangerLevel === "critical"
          ? "Thermal margin is becoming the mission clock"
          : "Heat load is constraining every move",
      consolePrefix:
        dangerLevel === "critical"
          ? "Thermal containment is the first priority. Everything else is secondary."
          : "Thermal behavior is eating into safe operating margin.",
    },
    o2: {
      subtitle:
        dangerLevel === "critical"
          ? "Life-support clock is overriding mission ambition"
          : "Oxygen reserve is narrowing the action envelope",
      consolePrefix:
        dangerLevel === "critical"
          ? "Life-support conservation now governs every decision."
          : "Oxygen reserve is reducing how long the crew can stay aggressive.",
    },
    power: {
      subtitle:
        dangerLevel === "critical"
          ? "Power loss is forcing triage across the stack"
          : "Power budgeting is driving command decisions",
      consolePrefix:
        dangerLevel === "critical"
          ? "Power scarcity is dictating what stays alive in the stack."
          : "Power routing is now part of every tactical call.",
    },
    nav: {
      subtitle:
        dangerLevel === "critical"
          ? "Navigation confidence is breaking down"
          : "Navigation drift is destabilizing movement planning",
      consolePrefix:
        dangerLevel === "critical"
          ? "Positional trust is compromised. Confirm every movement assumption."
          : "Navigation drift is making each move less reliable.",
    },
  };

  return (
    byFailure[dominantFailure] || {
      subtitle: "Mission pressure is shifting the command picture",
      consolePrefix: "Operational conditions are changing faster than the crew can ignore.",
    }
  );
}

export function getUiState(worldState) {
  const dangerLevel = getDangerLevel(worldState);
  const dominantFailure = getDominantFailure(worldState);
  const failureCopy = getFailureCopy(dominantFailure, dangerLevel);

  return {
    dangerLevel,
    dominantFailure,
    anomalyIntensity: getAnomalyIntensity(worldState),
    latestAlert: getLatestAlert(worldState?.eventLog || []),
    coordinationAlert: getTopCoordinationAlert(worldState),
    headerSubtitle: failureCopy.subtitle,
    consolePrefix: failureCopy.consolePrefix,
  };
}
