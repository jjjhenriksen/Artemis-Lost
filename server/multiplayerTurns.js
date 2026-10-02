import { createHash } from "node:crypto";
import { createBotAction } from "../src/game/botTurns.js";
import { resolveTurnWorldState } from "../src/game/turnRuntime.js";
import { assertValidSession } from "./sessionValidation.js";

function fail(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

function normalizeCommand(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some((key) => !["commandId", "expectedRevision", "action", "bot"].includes(key))) {
    fail(400, "INVALID_COMMAND", "Send only commandId, expectedRevision, action and bot.");
  }
  const { commandId, expectedRevision, bot = false } = input;
  if (typeof commandId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(commandId)
    || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof bot !== "boolean") {
    fail(400, "INVALID_COMMAND", "Provide a valid command ID and room revision.");
  }
  if (bot && input.action !== undefined && input.action !== "") {
    fail(400, "INVALID_COMMAND", "AI actions are chosen by the server.");
  }
  if (!bot && (typeof input.action !== "string" || !input.action.trim() || input.action.length > 2000)) {
    fail(400, "INVALID_COMMAND", "An action must contain 1–2000 characters.");
  }
  const action = bot ? null : input.action.trim();
  return {
    commandId, expectedRevision, bot, action,
    fingerprint: createHash("sha256").update(JSON.stringify({ expectedRevision, bot, action })).digest("hex"),
  };
}

// Provider prose can suggest game changes, but never changes turn ownership,
// elapsed mission time or the deterministic outcome calculation.
function safeDelta(delta, worldState) {
  if (delta == null) return null;
  if (typeof delta !== "object" || Array.isArray(delta)) {
    fail(502, "INVALID_NARRATION", "The narration service returned an invalid turn.");
  }
  const copy = structuredClone(delta);
  if (copy.mission) {
    for (const field of ["met", "outcome", "id", "name", "seedId", "seedLabel", "seedSummary", "seedTone"]) {
      delete copy.mission[field];
    }
  }
  if (copy.crew !== undefined) {
    if (!Array.isArray(copy.crew)) fail(502, "INVALID_NARRATION", "The narration service returned an invalid crew update.");
    copy.crew = copy.crew.filter((entry) => worldState.crew.some((crew) => crew.id === entry?.id))
      .map((entry) => {
        const { role, name, character, ...remaining } = entry;
        return remaining;
      });
  }
  return copy;
}

async function boundedTurn(requestTurn, payload, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => requestTurn({ ...payload, signal: controller.signal, timeoutMs })),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error("The narration service timed out. Retry the turn."), {
            status: 504, code: "TURN_TIMEOUT",
          }));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error?.code === "TURN_TIMEOUT") throw error;
    fail(502, "TURN_PROVIDER_FAILED", "The narration service is unavailable. Retry the turn.");
  } finally {
    clearTimeout(timer);
  }
}

export function createMultiplayerTurnService({ rooms, requestTurn, timeoutMs = 30000 }) {
  if (!rooms?.transaction || typeof requestTurn !== "function"
    || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) {
    throw new Error("Multiplayer turns require rooms, a narrator and a bounded timeout.");
  }
  return {
    async execute(roomId, token, input) {
      const command = normalizeCommand(input);
      return rooms.transaction(roomId, token, async (room, member) => {
        const receipt = room.commandReceipts.find((entry) => entry.memberId === member.id && entry.commandId === command.commandId);
        if (receipt) {
          if (receipt.fingerprint !== command.fingerprint) fail(409, "COMMAND_REUSED", "This command ID was already used for another action.");
          return { noChange: true };
        }
        if (room.status !== "active") fail(409, "MISSION_NOT_ACTIVE", "Start an active mission before taking a turn.");
        if (room.revision !== command.expectedRevision) fail(409, "STALE_REVISION", "The room changed. Refresh before acting.");
        const session = room.session;
        const activeCrew = session.worldState.crew[session.turn];
        if (!activeCrew) fail(409, "INVALID_TURN", "The mission has no active crew seat.");
        const seatClaimed = room.members.some((entry) => entry.seatId === activeCrew.id);
        if (command.bot) {
          if (seatClaimed || activeCrew.character?.controller !== "bot") fail(403, "HUMAN_TURN", "The active player must take this turn.");
        } else if (member.seatId !== activeCrew.id || activeCrew.character?.controller !== "human") {
          fail(403, "NOT_YOUR_TURN", "Only the player in the active crew seat may act.");
        }
        const actionText = command.bot ? createBotAction(session.worldState, activeCrew) : command.action;
        const history = [...session.conversationHistory, {
          role: "user", turn: session.turn, crewName: activeCrew.name, content: actionText,
        }].slice(-16);
        const result = await boundedTurn(requestTurn, structuredClone({
          worldState: session.worldState, activeCrew, action: actionText,
          conversationHistory: history, currentTurn: session.turn, sharedRoom: true,
        }), timeoutMs);
        if (!result || typeof result.narration !== "string" || !result.narration.trim() || result.narration.length > 32000) {
          fail(502, "INVALID_NARRATION", "The narration service returned an invalid turn.");
        }
        const { nextWorldState, nextTurn } = resolveTurnWorldState({
          worldState: session.worldState, activeCrew, actionText,
          currentTurn: session.turn, stateDelta: safeDelta(result.stateDelta, session.worldState),
        });
        const outcome = nextWorldState.mission.outcome;
        const narration = outcome.status === "active" ? result.narration.trim()
          : `${result.narration.trim()}\n\n${outcome.title}: ${outcome.summary}`;
        const nextSession = {
          ...session, worldState: nextWorldState, turn: nextTurn, narration,
          conversationHistory: [...history, {
            role: "assistant", turn: session.turn, crewName: activeCrew.name, content: result.narration.trim(),
          }].slice(-16),
        };
        try { assertValidSession(nextSession); }
        catch { fail(502, "INVALID_NARRATION", "The narration service returned an invalid game state."); }
        room.session = nextSession;
        room.status = outcome.status === "active" ? "active" : "resolved";
        room.commandReceipts = [...room.commandReceipts, {
          memberId: member.id, commandId: command.commandId, fingerprint: command.fingerprint,
        }].slice(-256);
        return {};
      });
    },
  };
}
