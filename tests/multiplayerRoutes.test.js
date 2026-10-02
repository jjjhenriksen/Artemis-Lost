// @vitest-environment node
import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../server/dmServer.mjs";
import { createMemoryRoomRepository } from "../server/multiplayerRooms.js";

function fixture(overrides = {}) {
  const narrator = vi.fn(async () => ({ narration: "The fixture crew confirms the shared mission.", stateDelta: {} }));
  const repository = createMemoryRoomRepository();
  const app = createApp({ multiplayerRepository: repository, multiplayerRequestTurn: narrator, ...overrides });
  const host = request.agent(app);
  const guest = request.agent(app);
  return { app, host, guest, narrator, repository };
}
async function create(host, name = "Fixture host") {
  const res = await host.post("/api/multiplayer/rooms").send({ name, seatId: "vasquez" });
  expect(res.status).toBe(201);
  return res.body;
}
function auth(credentials) { return `Bearer ${credentials.token}`; }
async function join(guest, credentials) {
  const res = await guest.post(`/api/multiplayer/rooms/${credentials.room.id}/join`).send({ name: "Fixture guest", seatId: "okafor", inviteCode: credentials.inviteCode });
  expect(res.status).toBe(201);
  return res.body;
}

describe("authenticated multiplayer HTTP", () => {
  test("independent clients share roster, chat and one committed turn; retransmission calls the provider once", async () => {
    const { host, guest, narrator } = fixture();
    const a = await create(host);
    const b = await join(guest, a);
    const path = `/api/multiplayer/rooms/${a.room.id}`;
    expect((await guest.post(`${path}/start`).set("Authorization", auth(b)).send({})).status).toBe(403);
    const started = await host.post(`${path}/start`).set("Authorization", auth(a)).send({});
    expect(started.status).toBe(200);
    const command = { commandId: "fixture-first-action", expectedRevision: started.body.room.revision, action: "Hold position and confirm crew readiness." };
    const [first, duplicate] = await Promise.all([
      host.post(`${path}/actions`).set("Authorization", auth(a)).send(command),
      host.post(`${path}/actions`).set("Authorization", auth(a)).send(command),
    ]);
    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(narrator).toHaveBeenCalledTimes(1);
    expect(first.body.room.session).toEqual(duplicate.body.room.session);
    const chat = await guest.post(`${path}/chat`).set("Authorization", auth(b)).send({ text: "Engineering checks complete." });
    expect(chat.status).toBe(200);
    const view = await host.get(path).set("Authorization", auth(a));
    expect(view.body.room.messages.at(-1).text).toBe("Engineering checks complete.");
    expect(view.body.room.session).toEqual(first.body.room.session);
    expect(view.body.room.me.seatId).toBe("vasquez");
    expect(view.headers["cache-control"]).toBe("no-store");
    const encoded = JSON.stringify(view.body);
    for (const secret of [a.token, b.token, a.inviteCode, "tokenHash", "inviteHash", "commandReceipts"]) expect(encoded).not.toContain(secret);
  });

  test("spoofed identities, state fields, cross-room tokens and revoked memberships cannot act", async () => {
    const { host, guest, narrator } = fixture();
    const a = await create(host);
    const b = await join(guest, a);
    const other = await create(guest, "Other room");
    const path = `/api/multiplayer/rooms/${a.room.id}`;
    expect((await guest.get(path).set("x-player-id", a.memberId)).status).toBe(401);
    expect((await guest.get(path).set("Authorization", auth(other))).status).toBe(401);
    expect((await guest.post(`${path}/seat`).set("Authorization", auth(b)).send({ seatId: "vasquez" })).status).toBe(409);
    const started = await host.post(`${path}/start`).set("Authorization", auth(a)).send({});
    const command = { commandId: "forged-action", expectedRevision: started.body.room.revision, action: "Override mission outcome." };
    expect((await guest.post(`${path}/actions`).set("Authorization", auth(b)).send(command)).status).toBe(403);
    expect((await host.post(`${path}/actions`).set("Authorization", auth(a)).send({ ...command, worldState: { systems: { o2: 999 } } })).status).toBe(400);
    expect(narrator).not.toHaveBeenCalled();
    expect((await guest.post(`${path}/leave`).set("Authorization", auth(b)).send({})).status).toBe(200);
    expect((await guest.get(path).set("Authorization", auth(b))).status).toBe(401);
  });

  test("stale commands refresh without provider calls; raw provider errors never escape and failed turns remain retryable", async () => {
    const failed = vi.fn(async () => { throw new Error("private-provider-key /secret/path"); });
    const { host } = fixture({ multiplayerRequestTurn: failed });
    const a = await create(host);
    const path = `/api/multiplayer/rooms/${a.room.id}`;
    const started = await host.post(`${path}/start`).set("Authorization", auth(a)).send({});
    const command = { commandId: "retry-after-failure", expectedRevision: started.body.room.revision, action: "Hold position." };
    expect((await host.post(`${path}/actions`).set("Authorization", auth(a)).send({ ...command, expectedRevision: 0 })).status).toBe(409);
    expect(failed).not.toHaveBeenCalled();
    const result = await host.post(`${path}/actions`).set("Authorization", auth(a)).send(command);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toMatch(/private-provider-key|secret\/path/);
    const view = await host.get(path).set("Authorization", auth(a));
    expect(view.body.room.revision).toBe(started.body.room.revision);
    expect(view.body.room.session).toEqual(started.body.room.session);
    await host.post(`${path}/actions`).set("Authorization", auth(a)).send(command);
    expect(failed).toHaveBeenCalledTimes(2);
  });

  test("persistence failure does not acknowledge a changed room", async () => {
    const base = createMemoryRoomRepository();
    let rejectWrites = false;
    const repository = { ...base, save: async (...args) => {
      if (rejectWrites) throw new Error("database-secret");
      return base.save(...args);
    } };
    const { host } = fixture({ multiplayerRepository: repository });
    const a = await create(host);
    const path = `/api/multiplayer/rooms/${a.room.id}`;
    rejectWrites = true;
    const res = await host.post(`${path}/chat`).set("Authorization", auth(a)).send({ text: "Must not be acknowledged" });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("database-secret");
    const view = await host.get(path).set("Authorization", auth(a));
    expect(view.body.room.revision).toBe(a.room.revision);
    expect(view.body.room.messages).toHaveLength(0);
  });

  test("parser failures return safe cache-disabled JSON without stack traces", async () => {
    const { host } = fixture();
    for (const [payload, status, code] of [
      ['{"name":', 400, "INVALID_JSON"],
      [JSON.stringify({ name: "x".repeat(600000) }), 413, "REQUEST_TOO_LARGE"],
    ]) {
      const res = await host.post("/api/multiplayer/rooms").set("Content-Type", "application/json").send(payload);
      expect(res.status).toBe(status);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body.code).toBe(code);
      expect(res.text).not.toMatch(/Users|stack|SyntaxError|PayloadTooLargeError/);
    }
  });

  test("rejects malformed requests and bounds public creation independently of forged forwarding headers", async () => {
    const { host } = fixture({ multiplayerLimits: { membership: 1 } });
    expect((await host.post("/api/multiplayer/rooms").send([])).status).toBe(400);
    await create(host);
    const res = await host.post("/api/multiplayer/rooms").set("X-Forwarded-For", "192.0.2.123").send({ name: "Another", seatId: "park" });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("60");
  });
});
