// Root re-export so teammate docs can point at api.js without caring about server layout.
export {
  assertDmConfig,
  extractTurnResult,
  requestDmTurn,
} from "./server/api.js";
