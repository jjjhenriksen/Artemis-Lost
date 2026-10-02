import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createMissionSession, DEFAULT_CHARACTER_PROFILES } from "../src/game/worldState.js";
import { MISSION_SEEDS } from "../src/game/missionSeeds.js";
import { assertValidSession } from "./sessionValidation.js";

export const MULTIPLAYER_SEATS = Object.freeze(["vasquez", "okafor", "reyes", "park"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const clone = (value) => structuredClone(value);
export function roomError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
export function assertRoomId(id) {
  if (typeof id !== "string" || !UUID.test(id)) throw roomError(400, "INVALID_ROOM_ID", "Invalid room identifier.");
}
function text(value, limit, label) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit || /[\u0000-\u001f\u007f]/.test(value)) {
    throw roomError(400, "INVALID_INPUT", `Enter ${label} of 1–${limit} characters.`);
  }
  return value.trim();
}
function seat(value) {
  if (value !== null && !MULTIPLAYER_SEATS.includes(value)) throw roomError(400, "INVALID_SEAT", "Choose a crew seat or spectator.");
  return value;
}
const hash = (secret) => createHash("sha256").update(secret).digest("hex");
function matches(secret, digest) {
  return typeof secret === "string" && secret.length >= 16 && secret.length <= 256 && HASH.test(digest || "")
    && timingSafeEqual(Buffer.from(hash(secret), "hex"), Buffer.from(digest, "hex"));
}
const secret = () => randomBytes(32).toString("base64url");
function assertSeatAvailable(room, seatId, memberId) {
  if (seatId && room.members.some((m) => m.seatId === seatId && m.id !== memberId)) {
    throw roomError(409, "SEAT_OCCUPIED", "That crew seat is already occupied.");
  }
}
function syncControllers(room) {
  for (const crew of room.session.worldState.crew) {
    crew.character.controller = room.members.some((m) => m.seatId === crew.id) ? "human" : "bot";
  }
}
function authenticatedMember(room, token) {
  const member = room.members.find((m) => matches(token, m.tokenHash));
  if (!member) throw roomError(401, "UNAUTHORIZED", "Room credentials are invalid or have been revoked.");
  return member;
}

// The record is private storage. Validation is shared by memory and durable adapters.
export function assertValidRoom(room, expectedId = room?.id) {
  const invalid = () => { throw roomError(500, "INVALID_ROOM_RECORD", "Stored room data is invalid. The original record was preserved."); };
  try {
    assertRoomId(expectedId);
    if (!room || room.schemaVersion !== 1 || room.id !== expectedId || !HASH.test(room.inviteHash)
      || !Number.isSafeInteger(room.revision) || room.revision < 0 || !["lobby", "active", "resolved"].includes(room.status)
      || !Array.isArray(room.members) || room.members.length > 16
      || typeof room.createdAt !== "string" || !Number.isFinite(Date.parse(room.createdAt))
      || typeof room.updatedAt !== "string" || !Number.isFinite(Date.parse(room.updatedAt))) invalid();
    const ids = new Set(), seats = new Set(), tokens = new Set();
    for (const member of room.members) {
      assertRoomId(member.id); text(member.name, 48, "a name"); seat(member.seatId);
      if (!HASH.test(member.tokenHash) || ids.has(member.id) || tokens.has(member.tokenHash) || (member.seatId && seats.has(member.seatId))) invalid();
      ids.add(member.id); tokens.add(member.tokenHash); if (member.seatId) seats.add(member.seatId);
    }
    if (room.members.length ? !ids.has(room.hostMemberId) : room.hostMemberId !== null || room.status !== "resolved") invalid();
    assertValidSession(room.session);
    if (typeof room.session.narration !== "string" || !Array.isArray(room.session.conversationHistory)
      || room.session.conversationHistory.length > 16 || room.session.turn >= 4
      || room.session.worldState.crew.length !== 4) invalid();
    for (const [index, crew] of room.session.worldState.crew.entries()) {
      if (crew.id !== MULTIPLAYER_SEATS[index] || crew.character?.controller !== (seats.has(crew.id) ? "human" : "bot")) invalid();
    }
    if (!Array.isArray(room.messages) || room.messages.length > 100 || !Array.isArray(room.commandReceipts) || room.commandReceipts.length > 256) invalid();
    for (const message of room.messages) {
      assertRoomId(message.id); assertRoomId(message.memberId); text(message.name, 48, "a name"); text(message.text, 1000, "a message");
      if (!Number.isFinite(Date.parse(message.at))) invalid();
    }
    for (const receipt of room.commandReceipts) {
      assertRoomId(receipt.memberId);
      if (typeof receipt.commandId !== "string" || !/^[\x20-\x7e]{1,80}$/.test(receipt.commandId)
        || typeof receipt.fingerprint !== "string" || receipt.fingerprint.length > 4096) invalid();
    }
  } catch { invalid(); }
  return room;
}

export function snapshot(room, memberId) {
  const members = room.members.map(({ id, name, seatId }) => ({ id, name, seatId }));
  return clone({ id: room.id, revision: room.revision, status: room.status, hostMemberId: room.hostMemberId,
    members, session: room.session, messages: room.messages, me: members.find((m) => m.id === memberId) || null });
}

export function createMemoryRoomRepository() {
  const records = new Map();
  return {
    async create(room) {
      assertValidRoom(room);
      if (records.has(room.id)) throw roomError(409, "ROOM_CONFLICT", "Room already exists.");
      records.set(room.id, clone(room));
    },
    async load(id) { assertRoomId(id); return records.has(id) ? clone(records.get(id)) : null; },
    async save(room, expectedRevision) {
      assertValidRoom(room);
      if (records.get(room.id)?.revision !== expectedRevision || room.revision !== expectedRevision + 1) {
        throw roomError(409, "REVISION_CONFLICT", "The room changed. Refresh and try again.");
      }
      records.set(room.id, clone(room));
    },
  };
}

const queuesByRepository = new WeakMap();
export function createRoomService({ repository, now = () => new Date().toISOString() }) {
  if (!repository) throw new TypeError("A room repository is required.");
  const queues = queuesByRepository.get(repository) || new Map();
  queuesByRepository.set(repository, queues);
  async function locked(id, operation) {
    assertRoomId(id);
    const current = (queues.get(id) || Promise.resolve()).catch(() => {}).then(operation);
    queues.set(id, current);
    try { return await current; } finally { if (queues.get(id) === current) queues.delete(id); }
  }
  async function load(id) {
    assertRoomId(id);
    const room = await repository.load(id);
    if (!room) throw roomError(404, "ROOM_NOT_FOUND", "Room not found.");
    return assertValidRoom(room, id);
  }
  async function mutate(id, authorize, operation) {
    return locked(id, async () => {
      const previous = await load(id);
      const room = clone(previous);
      const member = authorize(room);
      const result = await operation(room, member);
      if (!result?.noChange) {
        room.revision = previous.revision + 1;
        room.updatedAt = now();
        assertValidRoom(room, id);
        await repository.save(room, previous.revision);
      }
      return snapshot(result?.noChange ? previous : room, member?.id);
    });
  }
  const transaction = (id, token, operation) => mutate(id, (room) => authenticatedMember(room, token), operation);
  return {
    snapshot,
    transaction,
    async create({ name, seatId = null, seedId } = {}) {
      name = text(name, 48, "a name"); seat(seatId);
      const seed = seedId === undefined ? MISSION_SEEDS[0] : MISSION_SEEDS.find((s) => s.id === seedId);
      if (!seed) throw roomError(400, "INVALID_SEED", "Unknown mission seed.");
      const token = secret(), inviteCode = secret(), memberId = randomUUID();
      const room = { schemaVersion: 1, id: randomUUID(), inviteHash: hash(inviteCode), hostMemberId: memberId,
        revision: 0, status: "lobby", members: [{ id: memberId, name, tokenHash: hash(token), seatId }],
        session: createMissionSession(DEFAULT_CHARACTER_PROFILES, seed), messages: [], commandReceipts: [], createdAt: now(), updatedAt: now() };
      syncControllers(room);
      assertValidRoom(room);
      await repository.create(room);
      return { room: snapshot(room, memberId), memberId, token, inviteCode };
    },
    async join(id, { inviteCode, name, seatId = null } = {}) {
      name = text(name, 48, "a name"); seat(seatId);
      const token = secret(), memberId = randomUUID();
      const room = await mutate(id, (record) => {
        if (!matches(inviteCode, record.inviteHash)) throw roomError(401, "INVALID_INVITE", "Invalid room invitation.");
        if (!record.members.length) throw roomError(409, "ROOM_CLOSED", "This room is closed.");
        if (record.members.length >= 16) throw roomError(409, "ROOM_FULL", "Room membership is full.");
        return { id: memberId };
      }, (record) => {
        assertSeatAvailable(record, seatId);
        record.members.push({ id: memberId, name, tokenHash: hash(token), seatId });
        syncControllers(record);
      });
      return { room, memberId, token };
    },
    async view(id, token) { const room = await load(id); return snapshot(room, authenticatedMember(room, token).id); },
    async claimSeat(id, token, { seatId } = {}) {
      seat(seatId);
      return transaction(id, token, (room, member) => {
        assertSeatAvailable(room, seatId, member.id);
        if (member.seatId === seatId) return { noChange: true };
        member.seatId = seatId; syncControllers(room);
      });
    },
    async start(id, token) {
      return transaction(id, token, (room, member) => {
        if (member.id !== room.hostMemberId) throw roomError(403, "HOST_REQUIRED", "Only the host can start the mission.");
        if (room.status !== "lobby") throw roomError(409, "MISSION_STARTED", "The mission has already started.");
        if (!room.members.some((m) => m.seatId)) throw roomError(409, "SEAT_REQUIRED", "Claim a crew seat before starting.");
        room.status = "active";
      });
    },
    async leave(id, token) {
      return transaction(id, token, (room, member) => {
        room.members = room.members.filter((m) => m.id !== member.id);
        if (room.hostMemberId === member.id) room.hostMemberId = room.members[0]?.id || null;
        if (!room.members.length) room.status = "resolved";
        syncControllers(room);
      });
    },
    async chat(id, token, { text: message } = {}) {
      message = text(message, 1000, "a message");
      return transaction(id, token, (room, member) => {
        room.messages = [...room.messages, { id: randomUUID(), memberId: member.id, name: member.name, text: message, at: now() }].slice(-100);
      });
    },
  };
}
