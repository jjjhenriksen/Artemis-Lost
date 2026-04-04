import { EVENT_LOG_TYPES } from "./eventLogTypes.js";

const SYSTEM_KEYS = ["o2", "power", "comms", "thermal", "nav", "propulsion"];

const ROLE_KEYWORDS = {
  Commander: [
    "order",
    "direct",
    "command",
    "coordinate",
    "fallback",
    "hold",
    "triage",
    "crew",
    "plan",
  ],
  "Flight Engineer": [
    "repair",
    "patch",
    "reroute",
    "stabilize",
    "seal",
    "diagnostic",
    "power",
    "scrubber",
    "system",
  ],
  "Science Officer": [
    "scan",
    "analyze",
    "signal",
    "sample",
    "spectral",
    "calibrate",
    "read",
    "pattern",
    "anomaly",
  ],
  "Mission Specialist": [
    "eva",
    "route",
    "anchor",
    "secure",
    "deploy",
    "scout",
    "surface",
    "suit",
    "beacon",
  ],
};

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function getCrewById(worldState, crewId) {
  return worldState?.crew?.find((member) => member.id === crewId);
}

function getWeakestSystemKey(worldState) {
  return SYSTEM_KEYS.filter((key) => typeof worldState?.systems?.[key] === "number").sort(
    (left, right) => worldState.systems[left] - worldState.systems[right]
  )[0];
}

function getLowestMoraleCrew(worldState) {
  return [...(worldState?.crew || [])].sort((left, right) => left.morale - right.morale)[0];
}

function isActionRoleAligned(role, actionText = "") {
  const normalized = actionText.toLowerCase();
  return (ROLE_KEYWORDS[role] || []).some((keyword) => normalized.includes(keyword));
}

function createCrewPatch(member, fields) {
  if (!member) return null;
  return {
    id: member.id,
    ...fields,
  };
}

function createCommanderEffect(worldState, activeCrew, effectStrength) {
  const targetCrew = getLowestMoraleCrew(worldState) || activeCrew;
  const moraleBoost = effectStrength + 1;
  const commsBoost = Math.max(1, effectStrength - 1);

  return {
    delta: {
      systems: {
        comms: clampPercent((worldState?.systems?.comms || 0) + commsBoost),
      },
      crew: [
        createCrewPatch(targetCrew, {
          morale: clampPercent((targetCrew?.morale || 0) + moraleBoost),
        }),
      ].filter(Boolean),
      eventLog: [
        {
          ts: worldState?.mission?.met || "T+00:00",
          type: EVENT_LOG_TYPES.COMMAND,
          msg: `${activeCrew.name} steadies the crew tempo, lifting ${targetCrew?.name || "crew"} morale and tightening relay discipline.`,
        },
      ],
    },
  };
}

function createEngineerEffect(worldState, activeCrew, effectStrength) {
  const targetSystem = getWeakestSystemKey(worldState) || "power";
  const systemBoost = effectStrength + 1;

  return {
    delta: {
      systems: {
        [targetSystem]: clampPercent((worldState?.systems?.[targetSystem] || 0) + systemBoost),
      },
      eventLog: [
        {
          ts: worldState?.mission?.met || "T+00:00",
          type: EVENT_LOG_TYPES.SYSTEM,
          msg: `${activeCrew.name} buys margin back in ${targetSystem.toUpperCase()} with disciplined field stabilization.`,
        },
      ],
    },
  };
}

function createScienceEffect(worldState, activeCrew, effectStrength) {
  const liveCrew = getCrewById(worldState, activeCrew.id) || activeCrew;
  const supportSystem =
    (worldState?.systems?.nav || 0) <= (worldState?.systems?.comms || 0) ? "nav" : "comms";
  const insightBoost = effectStrength + 1;
  const systemBoost = Math.max(1, effectStrength - 1);

  return {
    delta: {
      systems: {
        [supportSystem]: clampPercent((worldState?.systems?.[supportSystem] || 0) + systemBoost),
      },
      crew: [
        createCrewPatch(liveCrew, {
          extra: {
            value: clampPercent((liveCrew?.extra?.value || 0) + insightBoost),
          },
        }),
      ].filter(Boolean),
      eventLog: [
        {
          ts: worldState?.mission?.met || "T+00:00",
          type: EVENT_LOG_TYPES.SENSOR,
          msg: `${activeCrew.name} converts noisy anomaly data into usable telemetry, sharpening ${supportSystem.toUpperCase()} confidence.`,
        },
      ],
    },
  };
}

function createSpecialistEffect(worldState, activeCrew, effectStrength) {
  const liveCrew = getCrewById(worldState, activeCrew.id) || activeCrew;
  const suitBoost = effectStrength + 1;
  const healthBoost = Math.max(1, effectStrength - 1);

  return {
    delta: {
      crew: [
        createCrewPatch(liveCrew, {
          health: clampPercent((liveCrew?.health || 0) + healthBoost),
          extra: {
            value: clampPercent((liveCrew?.extra?.value || 0) + suitBoost),
          },
        }),
      ].filter(Boolean),
      eventLog: [
        {
          ts: worldState?.mission?.met || "T+00:00",
          type: EVENT_LOG_TYPES.RISK,
          msg: `${activeCrew.name} turns field improvisation into safer footing, recovering EVA margin for the next move.`,
        },
      ],
    },
  };
}

export function createRoleTurnEffect(worldState, activeCrew, actionText = "") {
  if (!worldState || !activeCrew?.role) {
    return { delta: {} };
  }

  const effectStrength = isActionRoleAligned(activeCrew.role, actionText) ? 4 : 2;

  switch (activeCrew.role) {
    case "Commander":
      return createCommanderEffect(worldState, activeCrew, effectStrength);
    case "Flight Engineer":
      return createEngineerEffect(worldState, activeCrew, effectStrength);
    case "Science Officer":
      return createScienceEffect(worldState, activeCrew, effectStrength);
    case "Mission Specialist":
      return createSpecialistEffect(worldState, activeCrew, effectStrength);
    default:
      return { delta: {} };
  }
}

export function getRoleMechanicSummary(activeCrew) {
  switch (activeCrew?.role) {
    case "Commander":
      return "Aligned command actions restore comms discipline and raise the lowest crew morale.";
    case "Flight Engineer":
      return "Aligned engineering actions recover the weakest ship system faster.";
    case "Science Officer":
      return "Aligned science actions improve scan confidence and sharpen nav or comms telemetry.";
    case "Mission Specialist":
      return "Aligned field actions recover EVA margin and help the specialist absorb physical strain.";
    default:
      return "Role-aligned actions create a small mechanical edge each turn.";
  }
}

function getRoleOpportunity(worldState, activeCrew) {
  switch (activeCrew?.role) {
    case "Commander":
      return `Crew cohesion is fragile and comms are at ${worldState?.systems?.comms ?? "unknown"}%.`;
    case "Flight Engineer":
      return `The weakest live system is ${String(getWeakestSystemKey(worldState) || "power").toUpperCase()}.`;
    case "Science Officer":
      return `The anomaly is ${worldState?.environment?.anomaly || "behaving unpredictably"}, and telemetry confidence remains contested.`;
    case "Mission Specialist":
      return `The immediate physical hazard is ${worldState?.environment?.hazards?.[0] || worldState?.environment?.visibility || "terrain instability"}.`;
    default:
      return "The next move should reduce pressure without wasting the crew's narrow margin.";
  }
}

export function getRolePromptBrief(worldState, activeCrew, actionText = "") {
  const aligned = isActionRoleAligned(activeCrew?.role, actionText);
  const roleSummary = getRoleMechanicSummary(activeCrew);
  const roleOpportunity = getRoleOpportunity(worldState, activeCrew);

  return {
    aligned,
    summary: roleSummary,
    opportunity: roleOpportunity,
    framing: aligned
      ? "The action is role-aligned, so treat success as more efficient, controlled, and lower-cost unless the fiction clearly justifies complications."
      : "The action is off-role or only weakly aligned, so it may still work, but it should usually carry more friction, delay, exposure, or collateral pressure than a role-native move.",
  };
}
