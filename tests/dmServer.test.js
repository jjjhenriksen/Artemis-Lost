import request from "supertest";
import { createApp } from "../server/dmServer.mjs";

describe("dmServer", () => {
  test("serves health endpoints", async () => {
    const app = createApp();

    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("validates missing session payloads", async () => {
    const app = createApp();

    const res = await request(app).put("/api/session/slot-1").send({ turn: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing worldState or turn/);
  });

  test("returns session listings from injected dependencies", async () => {
    const listSessionsImpl = vi.fn(async () => ({ activeSlotId: "slot-1", slots: [] }));
    const app = createApp({
      listSessionsImpl,
    });

    const res = await request(app).get("/api/sessions").set("x-player-id", "player-a");
    expect(res.status).toBe(200);
    expect(res.body.activeSlotId).toBe("slot-1");
    expect(listSessionsImpl).toHaveBeenCalledWith("player-a");
  });

  test("validates turn requests before model execution", async () => {
    const app = createApp({
      assertConfig: () => {},
    });

    const res = await request(app).post("/api/turn").send({ action: "test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing worldState, action, or activeCrew/);
  });
});
