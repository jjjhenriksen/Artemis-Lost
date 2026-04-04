/**
 * @typedef {"sensor" | "risk" | "system" | "command" | "trait"} MissionSeedEventType
 */

/**
 * @typedef {Object} MissionSeed
 * @property {string} id
 * @property {string} label
 * @property {string} summary
 * @property {string[]} tone
 * @property {string} decisionPressure
 * @property {string} suggestedOpening
 * @property {{
 *   name: string,
 *   phase: string,
 *   met: string,
 *   objectives: string[],
 *   briefing: string
 * }} mission
 * @property {{
 *   location: string,
 *   hazards: string[],
 *   anomaly: string,
 *   visibility: string,
 *   pressure: string
 * }} environment
 * @property {{
 *   o2: number,
 *   power: number,
 *   comms: number,
 *   propulsion: number,
 *   scrubber: string,
 *   thermal: number,
 *   nav: number
 * }} systems
 * @property {{ ts: string, msg: string, type: MissionSeedEventType }[]} eventLog
 */

/** @type {MissionSeed[]} */
export const MISSION_SEEDS = [
  {
    id: "apollo-signal",
    label: "Apollo Echo",
    summary:
      "A dead Apollo-band transmission is pulsing from the crater darkness in deliberate intervals.",
    tone: ["procedural", "mysterious", "high-risk"],
    decisionPressure:
      "Decide whether to hold position, isolate the signal, or commit to a dangerous crater descent before comms collapse further.",
    suggestedOpening:
      "Assign {engineerShort} to harden rover systems while {scientistShort} confirms whether the Apollo-band pattern is actually intentional.",
    mission: {
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
    },
    environment: {
      location: "Shackleton Crater Rim",
      hazards: ["Signal interference", "Knife-edge crater terrain", "Shadowed ice vents"],
      anomaly: "Apollo-band signal with repeating geometric carrier modulation",
      visibility: "Low-angle glare on the rim, deep shadow inside the crater",
      pressure: "EVA only",
    },
    systems: {
      o2: 71,
      power: 82,
      comms: 35,
      propulsion: 64,
      scrubber: "patched",
      thermal: 76,
      nav: 58,
    },
    eventLog: [
      {
        ts: "T+14:22",
        msg: "Anomaly signal detected from Shackleton Crater interior.",
        type: "sensor",
      },
      {
        ts: "T+14:19",
        msg: "Telemetry confirms the signal is repeating in deliberate geometric bursts.",
        type: "sensor",
      },
      {
        ts: "T+14:18",
        msg: "Long-range comms degraded after the rover crossed the rim shadow line.",
        type: "risk",
      },
      {
        ts: "T+14:11",
        msg: "{engineerShort} patched the primary scrubber bypass after a dust-line leak.",
        type: "system",
      },
      {
        ts: "T+13:55",
        msg: "Artemis-07 rover reached the crater rim with all crew nominal.",
        type: "system",
      },
    ],
  },
  {
    id: "cryovent-whisper",
    label: "Cryovent Whisper",
    summary:
      "A buried ice vent is venting patterned vibrations through the regolith and scrambling the rover's instrument stack.",
    tone: ["procedural", "fragile", "scientific"],
    decisionPressure:
      "Choose whether to descend, sample, or withdraw before suit margin and thermal stability slip past recovery.",
    suggestedOpening:
      "Have {scientistShort} map the resonance pattern while {specialistShort} confirms whether the vent shelf can support a controlled EVA approach.",
    mission: {
      name: "Subsurface Murmur",
      phase: "Vent perimeter hold",
      met: "T+09:41:18",
      objectives: [
        "Map the subsurface vent chamber before the signal collapses.",
        "Stabilize rover heat flow against the crater's cold sink.",
        "Decide whether to descend, sample, or withdraw before suit margin is lost.",
      ],
      briefing:
        "Artemis-07 halted after passive seismic arrays picked up a repeating cryovent resonance beneath the south rim shelf.",
    },
    environment: {
      location: "South Rim Vent Shelf",
      hazards: ["Cryogenic blowback", "Regolith collapse pockets", "Instrument frost"],
      anomaly: "Subsurface cryovent resonance with non-random harmonic spacing",
      visibility: "High reflectance glare over fractured ice and drifting plume haze",
      pressure: "Partial EVA window",
    },
    systems: {
      o2: 76,
      power: 67,
      comms: 61,
      propulsion: 59,
      scrubber: "cycling cold-loaded filters",
      thermal: 49,
      nav: 72,
    },
    eventLog: [
      {
        ts: "T+09:41",
        msg: "Seismic probes registered a harmonic rise under the vent shelf.",
        type: "sensor",
      },
      {
        ts: "T+09:36",
        msg: "Thermal control lost efficiency after the rover entered cryogenic plume drift.",
        type: "risk",
      },
      {
        ts: "T+09:29",
        msg: "{scientistShort} isolated the resonance from rover engine noise and confirmed an internal cadence.",
        type: "sensor",
      },
      {
        ts: "T+09:18",
        msg: "Forward mast optics iced over and were cleared with a manual heater cycle.",
        type: "system",
      },
      {
        ts: "T+09:03",
        msg: "Artemis-07 stopped on the vent shelf after detecting under-ice voids.",
        type: "system",
      },
    ],
  },
  {
    id: "buried-array",
    label: "Buried Array",
    summary:
      "A pre-Artemis reflector field is waking up under the regolith and bouncing telemetry in impossible directions.",
    tone: ["procedural", "disorienting", "systems-heavy"],
    decisionPressure:
      "Stabilize navigation and decide whether to probe the buried array or back away before guidance errors strand the rover.",
    suggestedOpening:
      "Send {engineerShort} to isolate the nav stack while {commanderShort} coordinates a cautious sensor sweep for the buried reflector nodes.",
    mission: {
      name: "Silent Reflector",
      phase: "Array intercept",
      met: "T+18:07:42",
      objectives: [
        "Locate the reflector nodes causing telemetry ghosts.",
        "Protect the rover from guidance errors during surface movement.",
        "Determine whether the array is passive debris or an active system.",
      ],
      briefing:
        "Navigation drift forced Artemis-07 into a hard stop when its own telemetry started returning from impossible bearings.",
    },
    environment: {
      location: "Eastern Regolith Fan",
      hazards: ["Telemetry ghosts", "Loose dust shelves", "Hidden metallic debris"],
      anomaly: "Subsurface reflector lattice scattering active rover signals",
      visibility: "Flat silver dust under knife-bright sunlight with intermittent black shadow pockets",
      pressure: "Cabin secure, EVA risky",
    },
    systems: {
      o2: 84,
      power: 74,
      comms: 48,
      propulsion: 57,
      scrubber: "stable",
      thermal: 71,
      nav: 31,
    },
    eventLog: [
      {
        ts: "T+18:07",
        msg: "Navigation returns began echoing from impossible positions across the regolith fan.",
        type: "sensor",
      },
      {
        ts: "T+18:02",
        msg: "Autonav drift exceeded safe tolerance and forced a manual stop.",
        type: "risk",
      },
      {
        ts: "T+17:56",
        msg: "{specialistShort} marked a debris-safe path after lidar started double-reporting terrain edges.",
        type: "system",
      },
      {
        ts: "T+17:49",
        msg: "{engineerShort} isolated the nav stack from the external relay bus to stop recursive feedback.",
        type: "system",
      },
      {
        ts: "T+17:34",
        msg: "Artemis-07 entered the eastern fan while pursuing a weak beacon remnant.",
        type: "system",
      },
    ],
  },
  {
    id: "blackglass-breach",
    label: "Blackglass Breach",
    summary:
      "A vitrified impact seam is shedding heat and radio noise like it is still remembering the strike.",
    tone: ["procedural", "ominous", "volatile"],
    decisionPressure:
      "Decide whether the crew pushes closer for evidence or preserves shielding margin before the seam destabilizes the whole shelf.",
    suggestedOpening:
      "Put {specialistShort} on fallback-line prep and task {scientistShort} with separating the seam's machine-band pulses from the thermal bloom.",
    mission: {
      name: "Blackglass Memory",
      phase: "Impact seam survey",
      met: "T+11:58:03",
      objectives: [
        "Characterize the hot seam before it destabilizes surrounding terrain.",
        "Keep suit and rover shielding within survivable margins.",
        "Recover enough evidence to decide whether the seam is natural or artificial.",
      ],
      briefing:
        "A fresh orbital overpass flagged a blackglass fault line emitting intermittent heat spikes and machine-band static from the crater wall.",
    },
    environment: {
      location: "North Wall Fracture Shelf",
      hazards: ["Radiant hot spots", "Glass-slick footing", "Localized EMI bursts"],
      anomaly: "Impact glass seam emitting thermal pulses and broadband machine static",
      visibility: "Mirror-dark glass under intermittent plume shimmer and reflected cabin light",
      pressure: "Shielded EVA only",
    },
    systems: {
      o2: 68,
      power: 79,
      comms: 42,
      propulsion: 62,
      scrubber: "stable but dust-loaded",
      thermal: 54,
      nav: 66,
    },
    eventLog: [
      {
        ts: "T+11:58",
        msg: "The north wall seam flared above predicted temperature and flooded the comm band with static.",
        type: "sensor",
      },
      {
        ts: "T+11:54",
        msg: "Suit shielding margins dropped after the first close approach to the glass shelf.",
        type: "risk",
      },
      {
        ts: "T+11:46",
        msg: "{scientistShort} identified narrowband pulses inside the thermal noise bloom.",
        type: "sensor",
      },
      {
        ts: "T+11:39",
        msg: "{specialistShort} anchored a fallback line after the shelf surface turned slick under cabin light.",
        type: "system",
      },
      {
        ts: "T+11:21",
        msg: "Artemis-07 repositioned to survey a newly exposed fracture in the crater wall.",
        type: "system",
      },
    ],
  },
];

export function getMissionSeedById(seedId) {
  return MISSION_SEEDS.find((seed) => seed.id === seedId) || MISSION_SEEDS[0];
}

export function pickMissionSeed(excludeSeedId = null) {
  const pool = excludeSeedId
    ? MISSION_SEEDS.filter((seed) => seed.id !== excludeSeedId)
    : MISSION_SEEDS;
  return pool[Math.floor(Math.random() * pool.length)] || MISSION_SEEDS[0];
}
