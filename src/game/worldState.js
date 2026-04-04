import { EVENT_LOG_TYPES } from "./eventLogTypes.js";
import { CHARACTER_BANKS, CREW_TENSION_PATTERNS, SPECIAL_CREW_OVERRIDES } from "./characterBanks.js";
import { getMissionSeedById, MISSION_SEEDS } from "./missionSeeds.js";
import { clampPercent } from "./stateUtils.js";

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

const DEFAULT_MISSION_SEED = MISSION_SEEDS[0];

const CREW_BLUEPRINTS = [
  {
    id: "vasquez",
    role: "Commander",
    defaultName: "Kendall Harris",
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
    defaultName: "LouAnne Boyd",
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
    defaultName: "Trudi Qi",
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
    defaultName: "Nicole Wagner",
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
    tensionNote: overrides.tensionNote || "",
    controller: overrides.controller || "human",
  };
}

export const DEFAULT_CHARACTER_PROFILES = CREW_BLUEPRINTS.map((blueprint) =>
  createProfileFromBlueprint(blueprint)
);

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeMissionSeed(seed) {
  const resolved = typeof seed === "string" ? getMissionSeedById(seed) : seed || DEFAULT_MISSION_SEED;
  return resolved || DEFAULT_MISSION_SEED;
}

function hasAnyTag(entry, tags = []) {
  return entry?.tags?.some((tag) => tags.includes(tag));
}

function pickTaggedEntry(entries, preferredTags = [], usedTexts = new Set()) {
  const matching = entries.filter(
    (entry) => hasAnyTag(entry, preferredTags) && !usedTexts.has(entry.text)
  );
  if (matching.length > 0) return pickRandom(matching);

  const unused = entries.filter((entry) => !usedTexts.has(entry.text));
  if (unused.length > 0) return pickRandom(unused);

  return pickRandom(entries);
}

const TAG_KEYWORDS = {
  steady: ["calm", "clarity", "composure", "steady", "stabil", "discipline"],
  leader: ["command", "lead", "crew", "tempo", "triage", "decision"],
  empathetic: ["morale", "crew", "people", "compassion", "stabilization"],
  social: ["morale", "crew", "speaks", "vulnerability", "consensus"],
  procedural: ["procedure", "repair", "systems", "maintenance", "patch", "stabilization"],
  analytical: ["pattern", "analysis", "telemetry", "signal", "model", "geology"],
  curious: ["curiosity", "discovery", "anomaly", "signal", "meaning", "phenomena"],
  risk: ["risk", "edge", "eva", "surface", "hazard", "violent"],
  bold: ["decisive", "confident", "forward", "alive", "high-risk", "danger"],
  measured: ["disciplined", "deliberate", "balanced", "observation", "careful"],
  cautious: ["safety", "worst-case", "margin", "caution", "slipping"],
  control: ["control", "delegating", "consensus", "plan", "command"],
  obsessive: ["obsession", "vindicate", "walk away", "proof", "redefine"],
  closed: ["hides", "secrets", "admitting", "alone", "sound colder"],
  impulsive: ["reflex", "instinct", "faster", "forward"],
  rigid: ["commits", "pivots", "overcorrects", "doctrine"],
  intuitive: ["instinct", "meaning", "fragments"],
  self_erasing: ["injuries", "pain", "exhaustion", "relief"],
  reckless: ["risk", "dangerous", "pain", "highest-risk", "one more"],
};

function inferTagsFromText(text = "") {
  const normalized = text.toLowerCase();
  return Object.entries(TAG_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
    .map(([tag]) => tag);
}

function inferProfileTags(profile = {}) {
  const parts = [profile.trait, profile.flaw, profile.specialty, profile.personalStake].filter(Boolean);
  return new Set(parts.flatMap((part) => inferTagsFromText(part)));
}

function scorePatternForProfiles(pattern, profilesByRole) {
  return pattern.roles.reduce((score, role, index) => {
    const profile = profilesByRole.get(role);
    if (!profile) return score;

    const tags = inferProfileTags(profile);
    const preferred = pattern.preferredTags[index] || [];
    return score + preferred.filter((tag) => tags.has(tag)).length;
  }, 0);
}

export function deriveCrewDynamics(profiles = []) {
  const profilesByRole = new Map(profiles.map((profile) => [profile.role, profile]));
  let bestPattern = null;
  let bestScore = 0;

  CREW_TENSION_PATTERNS.forEach((pattern) => {
    const score = scorePatternForProfiles(pattern, profilesByRole);
    if (score > bestScore) {
      bestPattern = pattern;
      bestScore = score;
    }
  });

  const notesById = {};
  let summary = "";

  if (bestPattern && bestScore > 0) {
    summary = bestPattern.summary;
    bestPattern.roles.forEach((role) => {
      const profile = profilesByRole.get(role);
      if (profile?.id) {
        notesById[profile.id] = bestPattern.summary;
      }
    });
  }

  return { summary, notesById };
}

export function createRandomCharacterProfiles() {
  return rerollCharacterProfiles(DEFAULT_CHARACTER_PROFILES);
}

export function rerollCharacterProfiles(
  currentProfiles = DEFAULT_CHARACTER_PROFILES,
  lockedProfileIds = []
) {
  const usedNames = new Set();
  const usedCallSigns = new Set();
  const usedTraits = new Set();
  const usedFlaws = new Set();
  const selectedProfiles = new Map();
  const lockedIds = new Set(lockedProfileIds);
  const existingProfilesById = new Map(currentProfiles.map((profile) => [profile.id, profile]));
  const tensionPattern = Math.random() < 0.55 ? pickRandom(CREW_TENSION_PATTERNS) : null;
  const tensionRoles = new Map(
    tensionPattern
      ? tensionPattern.roles.map((role, index) => [role, tensionPattern.preferredTags[index]])
      : []
  );

  CREW_BLUEPRINTS.forEach((blueprint) => {
    if (!lockedIds.has(blueprint.id)) return;
    const lockedProfile = existingProfilesById.get(blueprint.id);
    if (!lockedProfile) return;

    usedNames.add(lockedProfile.name);
    usedCallSigns.add(lockedProfile.callSign);
    usedTraits.add(lockedProfile.trait);
    usedFlaws.add(lockedProfile.flaw);
    selectedProfiles.set(
      blueprint.id,
      createProfileFromBlueprint(blueprint, {
        ...lockedProfile,
        tensionNote: tensionRoles.has(blueprint.role) ? tensionPattern?.summary || "" : "",
      })
    );
  });

  CREW_BLUEPRINTS.forEach((blueprint) => {
    if (selectedProfiles.has(blueprint.id)) return;
    const roleBank = CHARACTER_BANKS[blueprint.bankKey] || {};
    const candidateNames = roleBank.names || CHARACTER_BANKS.global.facultyNames || [blueprint.defaultName];
    const currentProfile = existingProfilesById.get(blueprint.id);
    const availableNames = candidateNames.filter(
      (name) => !usedNames.has(name)
    );
    const availableCallSigns = (roleBank.callSigns || [blueprint.defaultCallSign]).filter(
      (callSign) => !usedCallSigns.has(callSign)
    );
    const preferredTags = tensionRoles.get(blueprint.role) || [];
    const traitEntry = pickTaggedEntry(CHARACTER_BANKS.global.traits, preferredTags, usedTraits);
    const flawEntry = pickTaggedEntry(CHARACTER_BANKS.global.flaws, preferredTags, usedFlaws);

    const selected = {
      name: pickRandom(availableNames.length > 0 ? availableNames : candidateNames),
      callSign: pickRandom(
        availableCallSigns.length > 0 ? availableCallSigns : roleBank.callSigns || [blueprint.defaultCallSign]
      ),
      trait: traitEntry.text,
      specialty: pickRandom(roleBank.specialties || [blueprint.defaultSpecialty]),
      flaw: flawEntry.text,
      personalStake: pickRandom(roleBank.stakes || [blueprint.defaultStake]),
      controller: currentProfile?.controller === "bot" ? "bot" : "human",
    };
    const specialOverride = SPECIAL_CREW_OVERRIDES[selected.name];
    if (specialOverride?.callSigns?.length) {
      const specialCallSigns = specialOverride.callSigns.filter(
        (callSign) => !usedCallSigns.has(callSign)
      );
      if (specialCallSigns.length > 0) {
        selected.callSign = pickRandom(specialCallSigns);
      }
    }

    usedNames.add(selected.name);
    usedCallSigns.add(selected.callSign);
    usedTraits.add(selected.trait);
    usedFlaws.add(selected.flaw);

    selectedProfiles.set(
      blueprint.id,
      createProfileFromBlueprint(blueprint, {
        ...selected,
        tensionNote: tensionRoles.has(blueprint.role) ? tensionPattern.summary : "",
      })
    );
  });

  return CREW_BLUEPRINTS.map((blueprint) => selectedProfiles.get(blueprint.id));
}

export function rerollCharacterProfile(currentProfiles, targetProfileId) {
  const lockedIds = (currentProfiles || [])
    .map((profile) => profile.id)
    .filter((profileId) => profileId !== targetProfileId);
  return rerollCharacterProfiles(currentProfiles, lockedIds);
}

function withDerivedCrewDynamics(profiles = DEFAULT_CHARACTER_PROFILES) {
  const normalizedProfiles = profiles.map((profile) => ({
    ...profile,
    name: profile.name?.trim() || "",
    callSign: profile.callSign?.trim() || "",
    trait: profile.trait?.trim() || "",
    specialty: profile.specialty?.trim() || "",
    flaw: profile.flaw?.trim() || "",
    personalStake: profile.personalStake?.trim() || "",
    controller: profile.controller === "bot" ? "bot" : "human",
  }));
  const { notesById } = deriveCrewDynamics(normalizedProfiles);

  return normalizedProfiles.map((profile) => ({
    ...profile,
    tensionNote: profile.tensionNote?.trim() || notesById[profile.id] || "",
    controller: profile.controller === "bot" ? "bot" : "human",
  }));
}

function getCharacterProfileMap(profiles = DEFAULT_CHARACTER_PROFILES) {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

function getShortCrewName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Crew";
  return parts[parts.length - 1];
}

function buildCrewTemplateValues(profilesById) {
  const commander = profilesById.get("vasquez")?.name || "Commander Vasquez";
  const engineer = profilesById.get("okafor")?.name || "Chief Engineer";
  const scientist = profilesById.get("reyes")?.name || "Science Officer";
  const specialist = profilesById.get("park")?.name || "Mission Specialist";

  return {
    commander,
    engineer,
    scientist,
    specialist,
    commanderShort: getShortCrewName(commander),
    engineerShort: getShortCrewName(engineer),
    scientistShort: getShortCrewName(scientist),
    specialistShort: getShortCrewName(specialist),
  };
}

function applyCrewTemplates(value, templateValues) {
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => templateValues[key] || "");
}

export function resolveMissionSeed(seedInput, profiles = DEFAULT_CHARACTER_PROFILES) {
  const profilesById = getCharacterProfileMap(profiles);
  const seed = normalizeMissionSeed(seedInput);
  const templateValues = buildCrewTemplateValues(profilesById);

  return {
    ...seed,
    label: applyCrewTemplates(seed.label, templateValues),
    summary: applyCrewTemplates(seed.summary, templateValues),
    decisionPressure: applyCrewTemplates(seed.decisionPressure || "", templateValues),
    suggestedOpening: applyCrewTemplates(seed.suggestedOpening || "", templateValues),
    mission: {
      ...seed.mission,
      briefing: applyCrewTemplates(seed.mission?.briefing || "", templateValues),
      objectives: (seed.mission?.objectives || []).map((objective) =>
        applyCrewTemplates(objective, templateValues)
      ),
    },
    environment: {
      ...seed.environment,
      location: applyCrewTemplates(seed.environment?.location || "", templateValues),
      anomaly: applyCrewTemplates(seed.environment?.anomaly || "", templateValues),
      visibility: applyCrewTemplates(seed.environment?.visibility || "", templateValues),
      pressure: applyCrewTemplates(seed.environment?.pressure || "", templateValues),
      hazards: (seed.environment?.hazards || []).map((hazard) =>
        applyCrewTemplates(hazard, templateValues)
      ),
    },
    eventLog: (seed.eventLog || []).map((entry) => ({
      ...entry,
      msg: applyCrewTemplates(entry.msg, templateValues),
    })),
  };
}

export function createInitialWorldState(profiles = DEFAULT_CHARACTER_PROFILES) {
  return createInitialWorldStateForSeed(profiles, DEFAULT_MISSION_SEED);
}

export function createInitialWorldStateForSeed(
  profiles = DEFAULT_CHARACTER_PROFILES,
  missionSeed = DEFAULT_MISSION_SEED
) {
  const profilesById = getCharacterProfileMap(profiles);
  const seed = resolveMissionSeed(missionSeed, profiles);

  return {
    mission: {
      id: "ARTEMIS-07",
      seedId: seed.id,
      seedLabel: seed.label,
      seedSummary: seed.summary,
      seedTone: seed.tone || [],
      decisionPressure: seed.decisionPressure || "",
      suggestedOpening: seed.suggestedOpening || "",
      outcome: {
        status: "active",
        title: "",
        summary: "",
      },
      ...seed.mission,
    },
    environment: { ...seed.environment },
    systems: { ...seed.systems },
    crew: CREW_BLUEPRINTS.map((blueprint) => {
      const profile = profilesById.get(blueprint.id) || {};
      const name = profile.name?.trim() || blueprint.defaultName;
      const callSign = profile.callSign?.trim() || blueprint.defaultCallSign;
      const trait = profile.trait?.trim() || blueprint.defaultTrait;
      const specialty = profile.specialty?.trim() || blueprint.defaultSpecialty;
      const flaw = profile.flaw?.trim() || blueprint.defaultFlaw;
      const personalStake = profile.personalStake?.trim() || blueprint.defaultStake;
      const tensionNote = profile.tensionNote?.trim();
      const controller = profile.controller === "bot" ? "bot" : "human";

      return createCrewMember({
        ...blueprint,
        name,
        extra: {
          ...blueprint.extra,
          detail: specialty,
        },
        notes: `${blueprint.notes} Trait: ${trait}. Flaw: ${flaw}. Stake: ${personalStake}. Call sign: ${callSign}.${tensionNote ? ` Crew tension: ${tensionNote}.` : ""}`,
        character: {
          callSign,
          trait,
          specialty,
          flaw,
          personalStake,
          tensionNote,
          controller,
        },
      });
    }),
    eventLog: (seed.eventLog || []).map((entry) => ({
      ...entry,
      type: entry.type || EVENT_LOG_TYPES.SYSTEM,
    })),
  };
}

export function createOpeningNarration(worldState) {
  const commander = worldState?.crew?.[0]?.name || "Commander Vasquez";
  const engineer = worldState?.crew?.[1]?.name || "Okafor";
  const scientist = worldState?.crew?.[2]?.name || "Reyes";
  const specialist = worldState?.crew?.[3]?.name || "Park";
  const location = worldState?.environment?.location || "the crater rim";
  const anomaly = worldState?.environment?.anomaly || "an impossible signal";
  const visibility = worldState?.environment?.visibility || "hard, hostile lunar light";
  const pressure = worldState?.environment?.pressure || "EVA pressure";
  const briefing = worldState?.mission?.briefing || "The mission state has become unstable.";
  const objective = worldState?.mission?.objectives?.[0] || "Find the source before the window closes.";
  const decisionPressure = worldState?.mission?.decisionPressure || "Make the next call before the window collapses.";
  const suggestedOpening = worldState?.mission?.suggestedOpening || "";
  const seedTone = worldState?.mission?.seedTone?.length
    ? worldState.mission.seedTone.join(", ")
    : "procedural, high-pressure";

  return `Artemis-07 settles into a tense hold at ${location}. ${briefing} Outside the hull, ${visibility.toLowerCase()}, and every instrument on board keeps circling back to the same impossible fact: ${anomaly}.

${scientist} has already pushed the first pass of analysis and only made the situation stranger. ${engineer} is tracking how long the rover can keep absorbing this strain. ${specialist} is poised to move the moment the order comes. ${commander}, the crew is reading you for the next call.

Primary pressure: ${pressure}. Immediate objective: ${objective}. Decision pressure: ${decisionPressure}. Tone target: ${seedTone}.${suggestedOpening ? ` Suggested opening move: ${suggestedOpening}` : ""}`;
}

export function createMissionSession(
  profiles = DEFAULT_CHARACTER_PROFILES,
  missionSeed = DEFAULT_MISSION_SEED
) {
  const resolvedProfiles = withDerivedCrewDynamics(profiles);
  const seed = normalizeMissionSeed(missionSeed);
  const worldState = createInitialWorldStateForSeed(resolvedProfiles, seed);
  return {
    worldState,
    narration: createOpeningNarration(worldState),
    turn: 0,
    conversationHistory: [
      {
        role: "system",
        turn: 0,
        crewName: worldState.crew[0]?.name || "n/a",
        content: `Mission initialized from character roster under seed ${seed.label}.`,
      },
    ],
    createdFromCharacterCreation: true,
  };
}

export const INITIAL_WORLD_STATE = createInitialWorldStateForSeed(
  DEFAULT_CHARACTER_PROFILES,
  DEFAULT_MISSION_SEED
);
export const OPENING_NARRATION = createOpeningNarration(INITIAL_WORLD_STATE);
