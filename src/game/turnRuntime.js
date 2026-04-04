import { applyStateDelta } from "./applyStateDelta.js";
import {
  advanceMissionMet,
  createActionLogEntry,
  getCrewTurnIndexById,
  getNextTurnIndex,
  prependCappedEntries,
} from "./gameLoop.js";
import { createMissionTurnEffect } from "./missionMechanics.js";
import { applyMissionOutcome } from "./missionOutcome.js";
import { createRoleTurnEffect, getFollowThroughTurnTarget } from "./roleMechanics.js";

function createTurnBaseWorldState(worldState, activeCrew, actionText) {
  const advancedMet = advanceMissionMet(worldState?.mission?.met);
  const actionLogEntry = createActionLogEntry(worldState, activeCrew, actionText);

  return {
    ...worldState,
    mission: {
      ...worldState.mission,
      met: advancedMet,
    },
    eventLog: prependCappedEntries(worldState.eventLog, actionLogEntry),
  };
}

function applyDmStateDelta(baseWorldState, stateDelta) {
  if (!stateDelta) {
    return baseWorldState;
  }

  return applyStateDelta(baseWorldState, {
    ...stateDelta,
    mission: {
      ...(stateDelta.mission || {}),
      met: stateDelta?.mission?.met || baseWorldState.mission.met,
    },
  });
}

function applyLocalTurnEffects(worldState, activeCrew, actionText) {
  const roleEffect = createRoleTurnEffect(worldState, activeCrew, actionText);
  const roleResolvedWorldState = applyStateDelta(worldState, roleEffect.delta);
  const missionEffect = createMissionTurnEffect(roleResolvedWorldState, activeCrew, actionText);
  return applyStateDelta(roleResolvedWorldState, missionEffect.delta);
}

export function resolveNextTurnIndex(worldState, currentTurn, fallbackCrew = []) {
  const followThroughTarget = getFollowThroughTurnTarget(worldState);
  const priorityIndex = getCrewTurnIndexById(worldState?.crew, followThroughTarget?.id);

  if (priorityIndex >= 0 && priorityIndex !== currentTurn) {
    return priorityIndex;
  }

  return getNextTurnIndex(worldState?.crew || fallbackCrew, currentTurn);
}

export function resolveTurnWorldState({
  worldState,
  activeCrew,
  actionText,
  stateDelta = null,
  currentTurn,
}) {
  const baseWorldState = createTurnBaseWorldState(worldState, activeCrew, actionText);
  const dmResolvedWorldState = applyDmStateDelta(baseWorldState, stateDelta);
  const locallyResolvedWorldState = applyLocalTurnEffects(
    dmResolvedWorldState,
    activeCrew,
    actionText
  );
  const nextWorldState = applyMissionOutcome(locallyResolvedWorldState);
  const missionResolved = nextWorldState?.mission?.outcome?.status !== "active";
  const nextTurn = missionResolved
    ? currentTurn
    : resolveNextTurnIndex(nextWorldState, currentTurn, worldState?.crew || []);

  return {
    nextWorldState,
    nextTurn,
  };
}
