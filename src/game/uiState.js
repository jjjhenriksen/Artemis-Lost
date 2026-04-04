import { EVENT_LOG_TYPES, normalizeEventType } from "./eventLogTypes.js";
import { getMissionMechanicSummary, getMissionOpportunityPreview } from "./missionMechanics.js";
import { getMissionOutcome } from "./missionOutcome.js";
import { getRoleGuidance } from "./roleGuidance.js";
import { getTopCoordinationAlert } from "./roleMechanics.js";
import {
  getRoleAlignmentPreview,
  getRoleMechanicSummary,
  getRoleSupportPreview,
} from "./roleMechanics.js";

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

function getActionPanelState(worldState, activeCrew, input = "") {
  if (!activeCrew) {
    return {
      roleGuidance: {
        focus: "Stabilize the mission state and create one safe, decisive next move.",
        suggestions: [],
      },
      roleMechanicSummary: "Role-aligned actions create a small mechanical edge each turn.",
      roleAlignmentPreview: {
        level: "neutral",
        label: "Awaiting vector",
        detail: "Role-aligned wording will usually resolve cleaner than a stretch play.",
      },
      roleSupportPreview: {
        incoming: null,
        delegationProfile: null,
        relationshipProfile: null,
        outgoing: null,
      },
      missionMechanicSummary: "Mission pressure is shaping what counts as the highest-leverage move.",
      missionOpportunityPreview: {
        level: "neutral",
        label: "Mission pressure",
        detail: "This mission still has distinct constraints, but no bespoke trigger is in focus for this role.",
      },
    };
  }

  return {
    roleGuidance: getRoleGuidance(worldState, activeCrew),
    roleMechanicSummary: getRoleMechanicSummary(activeCrew),
    roleAlignmentPreview: getRoleAlignmentPreview(activeCrew, input),
    roleSupportPreview: getRoleSupportPreview(worldState, activeCrew, input),
    missionMechanicSummary: getMissionMechanicSummary(worldState, activeCrew),
    missionOpportunityPreview: getMissionOpportunityPreview(worldState, activeCrew, input),
  };
}

export function getUiState(worldState, options = {}) {
  const { activeCrew = null, input = "" } = options;
  const dangerLevel = getDangerLevel(worldState);
  const dominantFailure = getDominantFailure(worldState);
  const failureCopy = getFailureCopy(dominantFailure, dangerLevel);
  const missionOutcome = getMissionOutcome(worldState);

  return {
    dangerLevel,
    dominantFailure,
    anomalyIntensity: getAnomalyIntensity(worldState),
    latestAlert: getLatestAlert(worldState?.eventLog || []),
    coordinationAlert: getTopCoordinationAlert(worldState),
    headerSubtitle:
      missionOutcome.status === "victory"
        ? missionOutcome.summary
        : missionOutcome.status === "defeat"
          ? missionOutcome.summary
          : failureCopy.subtitle,
    consolePrefix: failureCopy.consolePrefix,
    missionOutcome,
    actionPanel: getActionPanelState(worldState, activeCrew, input),
  };
}
