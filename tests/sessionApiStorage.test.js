import { getPortableSlotRelativePath } from "../server/sessionFilePaths.js";
// @vitest-environment node
import request from "supertest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMissionSession } from "../src/game/worldState.js";

let root, app, saved, store;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "artemis-api-"));
  vi.stubEnv("DATA_DIR", root);
  vi.stubEnv("DATABASE_URL", "");
  vi.resetModules();
  store = await import("../server/sessionStore.js");
  const { createApp } = await import("../server/dmServer.mjs");
  app = createApp();
  saved = await store.saveSession("slot-1", createMissionSession(), "player");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

async function snapshot(directory = root) {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await snapshot(file));
    else files[path.relative(root, file)] = await readFile(file, "utf8");
  }
  return files;
}

test("malformed API saves retain every existing slot, index and mirror byte", async () => {
  const before = await snapshot();
  for (const mutate of [
    (s) => { s.worldState.environment = null; },
    (s) => { s.narration = {}; },
    (s) => { s.conversationHistory = [null]; },
    (s) => { s.turn = -1; },
  ]) {
    const payload = createMissionSession();
    mutate(payload);
    const response = await request(app).put("/api/session/slot-1").set("x-player-id", "player").send(payload);
    expect(response.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  }
});

test("valid full fixture round-trips through the API and mirror generation", async () => {
  const response = await request(app).put("/api/session/slot-2").set("x-player-id", "player").send(createMissionSession());
  expect(response.status).toBe(200);
  const loaded = await request(app).get("/api/session/slot-2").set("x-player-id", "player");
  expect(loaded.body.session.worldState).toEqual(response.body.session.worldState);
  expect((await snapshot())["vault/dynamic/session-state.md"]).toContain("slot: slot-2");
  expect(saved.slotId).toBe("slot-1");
});

test("distinguishes a missing save from corrupt save responses without exposing paths", async () => {
  const absent = await request(app).get("/api/session/slot-3").set("x-player-id", "player");
  expect(absent.status).toBe(200);
  expect(absent.body).toEqual({ session: null });
  const file = path.join(root, "vault/dynamic/slots", getPortableSlotRelativePath("player", "slot-1"));
  await writeFile(file, "broken");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await request(app).get("/api/session/slot-1").set("x-player-id", "player");
  expect(response.status).toBe(500);
  expect(response.body.code).toBe("SAVE_CORRUPT");
  expect(response.body.error).toMatch(/restore a backup/);
  expect(response.body.error).not.toContain(root);
  expect(await readFile(file, "utf8")).toBe("broken");
});
