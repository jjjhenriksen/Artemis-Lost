import express from "express";
import { createRoomService } from "./multiplayerRooms.js";
import { createMultiplayerTurnService } from "./multiplayerTurns.js";

function fail(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

function body(req, allowed) {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== "object") {
    fail(400, "INVALID_BODY", "Send a JSON object.");
  }
  if (Object.keys(req.body).some((key) => !allowed.includes(key))) {
    fail(400, "UNKNOWN_FIELD", "This request contains unsupported fields.");
  }
  return req.body;
}

function token(req) {
  const authorization = req.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9_-]{22,256}$/.test(authorization)) {
    fail(401, "MEMBERSHIP_REQUIRED", "Rejoin with your room membership.");
  }
  return authorization.slice(7);
}

// Intentionally process-local. Proxy trust is disabled, so spoofed forwarding
// headers cannot avoid these limits. A clustered deployment needs a shared limiter.
function createLimiter({ now, limit, windowMs, maxKeys = 4096 }) {
  const counts = new Map();
  return (key) => {
    const time = now();
    for (const [id, entry] of counts) {
      if (entry.until <= time) counts.delete(id);
    }
    let entry = counts.get(key);
    if (!entry) {
      if (counts.size >= maxKeys) fail(429, "RATE_LIMITED", "Please wait before trying again.");
      entry = { count: 0, until: time + windowMs };
      counts.set(key, entry);
    }
    if (++entry.count > limit) fail(429, "RATE_LIMITED", "Please wait before trying again.");
  };
}

export function createMultiplayerRouter({ repository, requestTurn, now = Date.now, limits = {} }) {
  const router = express.Router();
  const rooms = createRoomService({ repository });
  const turns = createMultiplayerTurnService({ rooms, requestTurn });
  const membershipLimit = createLimiter({ now, limit: limits.membership ?? 30, windowMs: 60_000 });
  const mutationLimit = createLimiter({ now, limit: limits.mutations ?? 120, windowMs: 60_000 });
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    next();
  });

  function route(method, path, fields, operation, { credentials = false, publicRoute = false } = {}) {
    router[method](path, async (req, res) => {
      try {
        const input = method === "get" ? undefined : body(req, fields);
        const membership = publicRoute ? undefined : token(req);
        if (method !== "get") {
          (publicRoute ? membershipLimit : mutationLimit)(req.ip);
        }
        const result = await operation(req.params.id, membership, input);
        res.status(credentials ? 201 : 200).json(credentials ? result : { room: result });
      } catch (error) {
        const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
          ? error.status : 503;
        // Never send provider responses, paths, database details or arbitrary errors.
        const messages = {
          400: "Check the room request and try again.",
          401: "Your room membership is unavailable. Rejoin the room.",
          403: "This room action is not available to your seat.",
          404: "This room could not be found.",
          409: "The room changed or this seat is occupied. Refresh and try again.",
          429: "Please wait before trying again.",
          503: "The mission service is temporarily unavailable. Your saved turn is unchanged.",
        };
        if (status === 429) res.set("Retry-After", "60");
        res.status(status).json({
          error: messages[status] || "The room request failed.",
          code: status === 503 ? "SERVICE_UNAVAILABLE" :
            (/^[A-Z_]{1,64}$/.test(error.code || "") ? error.code : `ROOM_${status}`),
        });
      }
    });
  }

  route("post", "/rooms", ["name", "seatId", "seedId"], (_id, _token, input) => rooms.create(input), { publicRoute: true, credentials: true });
  route("post", "/rooms/:id/join", ["inviteCode", "name", "seatId"], (id, _token, input) => rooms.join(id, input), { publicRoute: true, credentials: true });
  route("get", "/rooms/:id", [], (id, memberToken) => rooms.view(id, memberToken));
  route("post", "/rooms/:id/seat", ["seatId"], (id, memberToken, input) => rooms.claimSeat(id, memberToken, input));
  route("post", "/rooms/:id/start", [], (id, memberToken) => rooms.start(id, memberToken));
  route("post", "/rooms/:id/leave", [], (id, memberToken) => rooms.leave(id, memberToken));
  route("post", "/rooms/:id/chat", ["text"], (id, memberToken, input) => rooms.chat(id, memberToken, input));
  route("post", "/rooms/:id/actions", ["commandId", "expectedRevision", "action", "bot"], (id, memberToken, input) => turns.execute(id, memberToken, input));
  return router;
}
