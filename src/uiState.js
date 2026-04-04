import { EVENT_LOG_TYPES, normalizeEventType } from "./eventLogTypes";

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

export function getUiState(worldState) {
  return {
    dangerLevel: getDangerLevel(worldState),
    dominantFailure: getDominantFailure(worldState),
    anomalyIntensity: getAnomalyIntensity(worldState),
    latestAlert: getLatestAlert(worldState?.eventLog || []),
  };
}
