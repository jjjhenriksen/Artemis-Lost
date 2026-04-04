import { mergeStateDelta } from "./deltaParser.js";

export function applyStateDelta(worldState, delta) {
  return mergeStateDelta(worldState, delta);
}
