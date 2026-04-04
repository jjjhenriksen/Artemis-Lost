function getCrewReference(name = "", fallback = "crew") {
  const cleaned = String(name).trim();
  return cleaned || fallback;
}

function getTopSystemPressure(systems = {}) {
  const numericSystems = [
    ["O2", systems.o2],
    ["power", systems.power],
    ["comms", systems.comms],
    ["propulsion", systems.propulsion],
    ["thermal", systems.thermal],
    ["nav", systems.nav],
  ].filter(([, value]) => typeof value === "number");

  return numericSystems.sort((a, b) => a[1] - b[1])[0]?.[0] || "systems";
}

function getObjective(worldState) {
  return worldState?.mission?.objectives?.[0] || "stabilize the mission state";
}

function getHazard(worldState) {
  return worldState?.environment?.hazards?.[0] || worldState?.environment?.anomaly || "the anomaly";
}

function createCommanderAction(worldState, crew) {
  const engineer = crew[1];
  const scientist = crew[2];
  return `Coordinate ${getCrewReference(engineer?.name, "the engineer")} to stabilize ${getTopSystemPressure(worldState?.systems)} while ${getCrewReference(scientist?.name, "the science lead")} verifies the anomaly pattern and reports whether we should press toward ${getObjective(worldState)}.`;
}

function createEngineerAction(worldState, crew, activeCrew) {
  const hazard = getHazard(worldState);
  return `${getCrewReference(activeCrew.name, "The engineer")} reroutes load through the safest available bus, checks for failure around ${hazard}, and reports what system margin we can recover before the next move.`;
}

function createScientistAction(worldState, crew, activeCrew) {
  const anomaly = worldState?.environment?.anomaly || "the signal";
  return `${getCrewReference(activeCrew.name, "The science lead")} isolates the cleanest possible read on ${anomaly}, compares it against the last sweep, and flags whether the crew is looking at a real pattern, a trap, or environmental noise.`;
}

function createSpecialistAction(worldState, crew, activeCrew) {
  const hazard = getHazard(worldState);
  return `${getCrewReference(activeCrew.name, "The specialist")} scouts the safest approach around ${hazard}, secures a fallback path, and confirms what physical move the crew can attempt without burning the whole safety margin.`;
}

export function createBotAction(worldState, activeCrew) {
  if (!activeCrew) return "Hold position, assess the immediate hazard, and report the safest next move.";

  switch (activeCrew.role) {
    case "Commander":
      return createCommanderAction(worldState, worldState?.crew || []);
    case "Flight Engineer":
      return createEngineerAction(worldState, worldState?.crew || [], activeCrew);
    case "Science Officer":
      return createScientistAction(worldState, worldState?.crew || [], activeCrew);
    case "Mission Specialist":
      return createSpecialistAction(worldState, worldState?.crew || [], activeCrew);
    default:
      return `${getCrewReference(activeCrew.name, "The crew lead")} assesses the situation, prioritizes ${getObjective(worldState)}, and reports the safest next move for the crew.`;
  }
}
