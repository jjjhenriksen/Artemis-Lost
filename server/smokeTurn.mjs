import "dotenv/config";
import { requestDmTurn, assertDmConfig } from "./api.js";

// Minimal hardcoded payload for the teammate-1 milestone: one action in, narration out.
const worldState = {
  mission: {
    id: "ARTEMIS-07",
    name: "Lost Signal",
    phase: "Crater approach - active",
    met: "T+14:22:07",
    objectives: ["Investigate anomaly signal", "Maintain crew safety"],
  },
  environment: {
    location: "Shackleton Crater Rim",
    hazards: ["Signal interference", "Terrain instability"],
    anomaly: "Apollo-band signal - 50yr dormant, geometric origin suspected",
  },
  systems: {
    o2: 71,
    power: 100,
    comms: 35,
    propulsion: 98,
    scrubber: "patched",
  },
  crew: [
    { id: "vasquez", name: "Vasquez", role: "Commander", health: 90, morale: 75, extra: { label: "Authority", value: 100 } },
    { id: "okafor", name: "Okafor", role: "Flight Engineer", health: 85, morale: 80, extra: { label: "O2 Sys", value: 71 } },
    { id: "reyes", name: "Reyes", role: "Science Officer", health: 95, morale: 85, extra: { label: "Scan Rng", value: 60 } },
    { id: "park", name: "Park", role: "Mission Specialist", health: 80, morale: 70, extra: { label: "EVA Suit", value: 30 } },
  ],
  eventLog: [
    { ts: "T+14:22", msg: "Anomaly signal detected - Shackleton Crater", type: "alert" },
    { ts: "T+14:18", msg: "Comms array degraded - unknown interference", type: "warn" },
  ],
};

const activeCrew = worldState.crew[0];
const action = "Have Reyes isolate the signal harmonics while Vasquez orders the rover to hold position.";
const conversationHistory = [
  { role: "dm", text: "Commander Vasquez, you have the conn. What are your orders?" },
];

try {
  assertDmConfig();
  // This mirrors the live API contract without needing the UI running.
  const result = await requestDmTurn({
    worldState,
    action,
    activeCrew,
    conversationHistory,
    currentTurn: 0,
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
