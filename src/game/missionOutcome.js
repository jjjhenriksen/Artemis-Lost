import { EVENT_LOG_TYPES } from "./eventLogTypes.js";
import { getCrewByRole } from "./stateUtils.js";

const ACTIVE_OUTCOME = {
  status: "active",
  title: "",
  summary: "",
};

const PHASE_VICTORY_KEYWORDS = [
  "complete",
  "secured",
  "stable withdrawal",
  "return window",
  "sample recovered",
  "contained",
  "mapped",
  "confirmed",
  "retrieval",
];

const EVENT_VICTORY_KEYWORDS = [
  "secured",
  "stabilized",
  "mapped",
  "isolated",
  "recovered",
  "contained",
  "withdrawal route",
  "return window",
  "evidence collected",
  "signal source confirmed",
];

const OUTCOME_RULES = {
  "apollo-signal": {
    title: "Signal Secured",
    summary:
      "The crew has isolated the Apollo-band source and kept the mission stable enough to get home with something real.",
    systems: {
      comms: 48,
      o2: 20,
      power: 20,
    },
    roleTargets: [{ role: "Science Officer", extra: 66 }],
  },
  "cryovent-whisper": {
    title: "Vent Survey Complete",
    summary:
      "The crew has mapped the cryovent chamber and preserved enough thermal and EVA margin to withdraw safely.",
    systems: {
      thermal: 56,
      o2: 20,
      power: 20,
    },
    roleTargets: [{ role: "Mission Specialist", extra: 40 }],
  },
  "buried-array": {
    title: "Array Triangulated",
    summary:
      "The reflector field is no longer controlling the mission. The crew has a workable nav solution and a clear read on the buried array.",
    systems: {
      nav: 44,
      comms: 50,
      power: 20,
    },
    roleTargets: [{ role: "Science Officer", extra: 64 }],
  },
  "blackglass-breach": {
    title: "Seam Read Secured",
    summary:
      "The crew has characterized the blackglass seam and kept shielding margin intact long enough to come back alive with evidence.",
    systems: {
      thermal: 58,
      o2: 20,
      power: 20,
    },
    roleTargets: [{ role: "Mission Specialist", extra: 42 }],
  },
};

function isResolved(outcome) {
  return outcome?.status === "victory" || outcome?.status === "defeat";
}

function includesAny(text = "", keywords = []) {
  const normalized = String(text).toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function hasEnoughFunctionalCrew(worldState) {
  return (worldState?.crew || []).filter((member) => member.health > 25).length >= 3;
}

function isCatastrophicFailure(worldState) {
  const systems = worldState?.systems || {};
  const incapacitatedCrew = (worldState?.crew || []).filter((member) => member.health <= 15).length;

  return (
    systems.o2 <= 8 ||
    systems.power <= 8 ||
    (systems.comms <= 5 && systems.nav <= 5) ||
    incapacitatedCrew >= 2 ||
    !hasEnoughFunctionalCrew(worldState)
  );
}

function hasCompletionSignal(worldState) {
  const phaseText = worldState?.mission?.phase || "";
  if (includesAny(phaseText, PHASE_VICTORY_KEYWORDS)) return true;

  return (worldState?.eventLog || []).slice(0, 5).some((entry) => {
    if (!entry?.msg) return false;
    return includesAny(entry.msg, EVENT_VICTORY_KEYWORDS);
  });
}

function meetsSystemTargets(worldState, systemTargets = {}) {
  return Object.entries(systemTargets).every(
    ([key, minimum]) => (worldState?.systems?.[key] || 0) >= minimum
  );
}

function meetsRoleTargets(worldState, roleTargets = []) {
  return roleTargets.every(({ role, extra = 0 }) => {
    const member = getCrewByRole(worldState, role);
    return (member?.extra?.value || 0) >= extra;
  });
}

export function getMissionOutcome(worldState) {
  const currentOutcome = worldState?.mission?.outcome || ACTIVE_OUTCOME;
  if (isResolved(currentOutcome)) return currentOutcome;

  if (isCatastrophicFailure(worldState)) {
    return {
      status: "defeat",
      title: "Mission Lost",
      summary:
        "The crew no longer has enough life support, power, or healthy personnel to keep the operation viable.",
    };
  }

  const rule = OUTCOME_RULES[worldState?.mission?.seedId];
  if (!rule) return ACTIVE_OUTCOME;

  const victory =
    hasEnoughFunctionalCrew(worldState) &&
    meetsSystemTargets(worldState, rule.systems) &&
    (meetsRoleTargets(worldState, rule.roleTargets) || hasCompletionSignal(worldState));

  if (!victory) {
    return ACTIVE_OUTCOME;
  }

  return {
    status: "victory",
    title: rule.title,
    summary: rule.summary,
  };
}

export function applyMissionOutcome(worldState) {
  const outcome = getMissionOutcome(worldState);
  const previousOutcome = worldState?.mission?.outcome || ACTIVE_OUTCOME;
  const justResolved = previousOutcome.status === "active" && outcome.status !== "active";

  const nextWorldState = {
    ...worldState,
    mission: {
      ...worldState.mission,
      outcome,
    },
  };

  if (!justResolved) {
    return nextWorldState;
  }

  return {
    ...nextWorldState,
    eventLog: [
      {
        ts: worldState?.mission?.met || "T+00:00",
        type: outcome.status === "victory" ? EVENT_LOG_TYPES.COMMAND : EVENT_LOG_TYPES.RISK,
        msg: `${outcome.title}. ${outcome.summary}`,
      },
      ...(worldState?.eventLog || []),
    ],
  };
}
