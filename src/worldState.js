import { EVENT_LOG_TYPES } from "./eventLogTypes";
import { CHARACTER_BANKS } from "./characterBanks";

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function createCrewMember({
  id,
  name,
  role,
  health,
  morale,
  extra,
  location,
  status,
  inventory,
  notes,
  character,
}) {
  return {
    id,
    name,
    role,
    health: clampPercent(health),
    morale: clampPercent(morale),
    extra: {
      label: extra.label,
      value: clampPercent(extra.value),
      detail: extra.detail,
      unit: extra.unit || "%",
    },
    location,
    status,
    inventory,
    notes,
    character,
  };
}

const MISSION_TEMPLATE = {
  id: "ARTEMIS-07",
  name: "Lost Signal",
  phase: "Crater approach - active",
  met: "T+14:22:07",
  objectives: [
    "Trace the dormant Apollo-band signal source.",
    "Keep the rover crew alive until a stable comms link is restored.",
    "Recover enough anomaly data to justify a return window.",
  ],
  briefing:
    "Artemis-07 diverted after receiving a structured radio pulse from Shackleton Crater. Mission control lost clean contact twelve minutes later.",
};

const ENVIRONMENT_TEMPLATE = {
  location: "Shackleton Crater Rim",
  hazards: ["Signal interference", "Knife-edge crater terrain", "Shadowed ice vents"],
  anomaly: "Apollo-band signal with repeating geometric carrier modulation",
  visibility: "Low-angle glare on the rim, deep shadow inside the crater",
  pressure: "EVA only",
};

const SYSTEMS_TEMPLATE = {
  o2: 71,
  power: 82,
  comms: 35,
  propulsion: 64,
  scrubber: "patched",
  thermal: 76,
  nav: 58,
};

const EVENT_LOG_TEMPLATE = [
  {
    ts: "T+14:22",
    msg: "Anomaly signal detected from Shackleton Crater interior.",
    type: EVENT_LOG_TYPES.SENSOR,
  },
  {
    ts: "T+14:19",
    msg: "Telemetry confirms the signal is repeating in deliberate geometric bursts.",
    type: EVENT_LOG_TYPES.SENSOR,
  },
  {
    ts: "T+14:18",
    msg: "Long-range comms degraded after the rover crossed the rim shadow line.",
    type: EVENT_LOG_TYPES.RISK,
  },
  {
    ts: "T+14:11",
    msg: "Okafor patched the primary scrubber bypass after a dust-line leak.",
    type: EVENT_LOG_TYPES.SYSTEM,
  },
  {
    ts: "T+13:55",
    msg: "Artemis-07 rover reached the crater rim with all crew nominal.",
    type: EVENT_LOG_TYPES.SYSTEM,
  },
];

const CREW_BLUEPRINTS = [
  {
    id: "vasquez",
    role: "Commander",
    defaultName: "Commander Alma Vasquez",
    defaultCallSign: "Aegis",
    defaultTrait: "Calm under cascading pressure",
    defaultSpecialty: "Command tempo and crisis triage",
    defaultFlaw: "Carries too much alone before delegating",
    defaultStake: "Will not lose another mission under their command",
    health: 92,
    morale: 78,
    extra: {
      label: "Authority",
      value: 88,
      detail: "Crew discipline and crisis command bandwidth",
    },
    location: "Command seat, rover cabin",
    status: "Coordinating the crater hold and crew assignments",
    inventory: ["Command slate", "Mission uplink keys", "Emergency flare tags"],
    notes:
      "Prioritizes crew survival over mission prestige. Keeping anxiety contained after the signal spike.",
    bankKey: "commander",
  },
  {
    id: "okafor",
    role: "Flight Engineer",
    defaultName: "Chief Engineer Tunde Okafor",
    defaultCallSign: "Patchbay",
    defaultTrait: "Turns panic into procedure",
    defaultSpecialty: "Life support stabilization and field repair",
    defaultFlaw: "Pushes damaged systems long past the safe window",
    defaultStake: "Knows the rover only gets one real failure before people start dying",
    health: 86,
    morale: 73,
    extra: {
      label: "O2 Sys",
      value: 71,
      detail: "Confidence in life support stability after the scrubber patch",
    },
    location: "Life-support maintenance alcove",
    status: "Monitoring scrubber leaks and power routing",
    inventory: ["Patch kit", "Diagnostic wafer", "Portable sealant gun"],
    notes:
      "Knows the patched scrubber can fail if dust clogs the bypass a second time.",
    bankKey: "flight_engineer",
  },
  {
    id: "reyes",
    role: "Science Officer",
    defaultName: "Dr. Imani Reyes",
    defaultCallSign: "Spectra",
    defaultTrait: "Curiosity sharp enough to feel dangerous",
    defaultSpecialty: "Signal analysis and anomaly interpretation",
    defaultFlaw: "Can chase understanding past the point of safety",
    defaultStake: "Believes this signal could redefine humanity's place on the moon",
    health: 95,
    morale: 81,
    extra: {
      label: "Scan Rng",
      value: 62,
      detail: "Effective scan confidence through interference noise",
    },
    location: "Sensor mast station",
    status: "Filtering anomaly harmonics from terrain reflections",
    inventory: ["Spectral tablet", "Core sampler", "Signal library"],
    notes:
      "Convinced the source is artificial and older than the current mission profile suggests.",
    bankKey: "science_officer",
  },
  {
    id: "park",
    role: "Mission Specialist",
    defaultName: "Lt. Hana Park",
    defaultCallSign: "Waypoint",
    defaultTrait: "Most comfortable at the edge of the risk envelope",
    defaultSpecialty: "EVA deployment and field improvisation",
    defaultFlaw: "Understates injuries if the mission still has momentum",
    defaultStake: "Needs this mission to prove the last surface accident was not a career-ending failure",
    health: 79,
    morale: 69,
    extra: {
      label: "EVA Suit",
      value: 34,
      detail: "Suit integrity after a micrometeor scoring hit",
    },
    location: "Airlock prep bench",
    status: "Prepping for a risky surface check near the rim beacon",
    inventory: ["Beacon spool", "Drill", "Backup relay", "Patch foam"],
    notes:
      "Most capable EVA operator on site, but the suit breach margin is uncomfortably thin.",
    bankKey: "mission_specialist",
  },
];

function createProfileFromBlueprint(blueprint, overrides = {}) {
  return {
    id: blueprint.id,
    role: blueprint.role,
    name: overrides.name || blueprint.defaultName,
    callSign: overrides.callSign || blueprint.defaultCallSign,
    trait: overrides.trait || blueprint.defaultTrait,
    specialty: overrides.specialty || blueprint.defaultSpecialty,
    flaw: overrides.flaw || blueprint.defaultFlaw,
    personalStake: overrides.personalStake || blueprint.defaultStake,
  };
}

export const DEFAULT_CHARACTER_PROFILES = CREW_BLUEPRINTS.map((blueprint) =>
  createProfileFromBlueprint(blueprint)
);

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function createRandomCharacterProfiles() {
  return CREW_BLUEPRINTS.map((blueprint) => {
    const roleBank = CHARACTER_BANKS[blueprint.bankKey] || {};
    const selected = {
      name: pickRandom(roleBank.names || [blueprint.defaultName]),
      callSign: pickRandom(roleBank.callSigns || [blueprint.defaultCallSign]),
      trait: pickRandom(CHARACTER_BANKS.global.traits || [blueprint.defaultTrait]),
      specialty: pickRandom(roleBank.specialties || [blueprint.defaultSpecialty]),
      flaw: pickRandom(CHARACTER_BANKS.global.flaws || [blueprint.defaultFlaw]),
      personalStake: pickRandom(roleBank.stakes || [blueprint.defaultStake]),
    };

    return createProfileFromBlueprint(blueprint, selected);
  });
}

function getCharacterProfileMap(profiles = DEFAULT_CHARACTER_PROFILES) {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

export function createInitialWorldState(profiles = DEFAULT_CHARACTER_PROFILES) {
  const profilesById = getCharacterProfileMap(profiles);

  return {
    mission: { ...MISSION_TEMPLATE },
    environment: { ...ENVIRONMENT_TEMPLATE },
    systems: { ...SYSTEMS_TEMPLATE },
    crew: CREW_BLUEPRINTS.map((blueprint) => {
      const profile = profilesById.get(blueprint.id) || {};
      const name = profile.name?.trim() || blueprint.defaultName;
      const callSign = profile.callSign?.trim() || blueprint.defaultCallSign;
      const trait = profile.trait?.trim() || blueprint.defaultTrait;
      const specialty = profile.specialty?.trim() || blueprint.defaultSpecialty;
      const flaw = profile.flaw?.trim() || blueprint.defaultFlaw;
      const personalStake = profile.personalStake?.trim() || blueprint.defaultStake;

      return createCrewMember({
        ...blueprint,
        name,
        extra: {
          ...blueprint.extra,
          detail: specialty,
        },
        notes: `${blueprint.notes} Trait: ${trait}. Flaw: ${flaw}. Stake: ${personalStake}. Call sign: ${callSign}.`,
        character: {
          callSign,
          trait,
          specialty,
          flaw,
          personalStake,
        },
      });
    }),
    eventLog: EVENT_LOG_TEMPLATE.map((entry) => ({ ...entry })),
  };
}

export function createOpeningNarration(worldState) {
  const commander = worldState?.crew?.[0]?.name || "Commander Vasquez";
  const engineer = worldState?.crew?.[1]?.name || "Okafor";
  const scientist = worldState?.crew?.[2]?.name || "Reyes";
  const specialist = worldState?.crew?.[3]?.name || "Park";

  return `The rover eases to a halt on the knife-edge rim of Shackleton Crater, and every speaker in the cabin hisses with an impossible transmission. The signal is old Apollo-band hardware, dead for decades, yet it is pulsing from the darkness below with machine-perfect rhythm.

${scientist} has already stripped the noise away once and the pattern only became stranger. ${engineer} warns the scrubber patch may not survive a long delay. ${specialist} is halfway into a damaged EVA suit. ${commander}, the crew is looking to you.`;
}

export function createMissionSession(profiles = DEFAULT_CHARACTER_PROFILES) {
  const worldState = createInitialWorldState(profiles);
  return {
    worldState,
    narration: createOpeningNarration(worldState),
    turn: 0,
    conversationHistory: [
      {
        role: "system",
        turn: 0,
        crewName: worldState.crew[0]?.name || "n/a",
        content: "Mission initialized from character roster.",
      },
    ],
    createdFromCharacterCreation: true,
  };
}

export const INITIAL_WORLD_STATE = createInitialWorldState();
export const OPENING_NARRATION = createOpeningNarration(INITIAL_WORLD_STATE);
