// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { afterEach, expect, test, vi } from "vitest";
import { createMissionSession } from "../src/game/worldState.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

test("alternating synthetic players isolate mirrors, overrides and both provider prompt paths; legacy files survive", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artemis-owner-vault-"));
  vi.stubEnv("DATA_DIR", directory); vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("LLM_PROVIDER", "openai");
  vi.resetModules();
  const store = await import("../server/sessionStore.js");
  const { getOwnerMirrorPaths } = await import("../server/sessionMirrors.js");
  const { loadVaultContext } = await import("../server/vault.js");
  const { createApp } = await import("../server/dmServer.mjs");
  const root = path.join(directory, "vault", "dynamic");
  for (const owner of ["CON", "PRN", "NUL", "../player-a", "\\..\\player-b", "x".repeat(300)]) {
    const scoped = getOwnerMirrorPaths(owner).root;
    const relative = path.relative(path.join(root, "players"), scoped);
    expect(relative.startsWith("..") || path.isAbsolute(relative)).toBe(false);
    expect(relative.split(path.sep).every((component) => component.length <= 66)).toBe(true);
    expect(relative).toContain("owners-v1");
  }
  await mkdir(path.join(root, "overrides"), { recursive: true });
  for (const file of ["session.json", "session-state.md", "log.md", "overrides/npc-override.md", "overrides/location-delta.md"]) {
    await writeFile(path.join(root, file), "UNIDENTIFIED_LEGACY_PRIVATE_MARKER");
  }
  const prompts = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    prompts.push(JSON.parse(init.body).input);
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ narration: "Fixture narration", stateDelta: {} }) }) };
  }));
  const app = createApp({ assertConfig: () => {} });
  try {
    for (const owner of ["player-a", "player-b", "player-a", "player-b"]) {
      const marker = `${owner.toUpperCase()}_PRIVATE_MARKER`;
      const session = createMissionSession();
      session.narration = marker;
      session.conversationHistory = [{ role: "user", content: marker }];
      await store.saveSession("slot-1", session, owner);
      await store.loadSession("slot-1", owner);
      const paths = getOwnerMirrorPaths(owner);
      await writeFile(paths.npcOverridePath, `${marker}_NPC`);
      await writeFile(paths.locationDeltaPath, `${marker}_LOCATION`);
      expect(await readFile(paths.sessionJsonPath, "utf8")).toContain(marker);
      const payload = { worldState: session.worldState, activeCrew: session.worldState.crew[0], action: "Check the cabin", conversationHistory: [], currentTurn: 0, ownerId: "forged-other-player" };
      for (const endpoint of ["/api/turn", "/api/autonomous-action"]) {
        const response = await request(app).post(endpoint).set("x-player-id", owner).send(payload);
        expect(response.status).toBe(200);
        const prompt = prompts.at(-1);
        expect(prompt).toContain(marker);
        expect(prompt).toContain(`${marker}_NPC`);
        expect(prompt).not.toContain(owner === "player-a" ? "PLAYER-B_PRIVATE_MARKER" : "PLAYER-A_PRIVATE_MARKER");
        expect(prompt).not.toContain("UNIDENTIFIED_LEGACY_PRIVATE_MARKER");
      }
    }
    const session = createMissionSession();
    const relativeOtherOwner = path.relative(path.join(root, "players"), getOwnerMirrorPaths("player-b").root).split(path.sep).join("/");
    const traversal = { worldState: session.worldState, activeCrew: { ...session.worldState.crew[0], id: `../../dynamic/players/${relativeOtherOwner}/session-state` }, action: "Check the cabin" };
    for (const endpoint of ["/api/turn", "/api/autonomous-action"]) {
      expect((await request(app).post(endpoint).set("x-player-id", "player-a").send(traversal)).status).toBe(200);
      expect(prompts.at(-1)).not.toContain("PLAYER-B_PRIVATE_MARKER");
    }
    const badOverride = getOwnerMirrorPaths("player-a").locationDeltaPath;
    await rm(badOverride);
    await mkdir(badOverride);
    await expect(loadVaultContext({ worldState: session.worldState, activeCrew: session.worldState.crew[0], ownerId: "player-a" }))
      .rejects.toMatchObject({ status: 503, code: "CONTEXT_UNAVAILABLE" });
    await rm(badOverride, { recursive: true });
    await request(app).post("/api/turn").send({ worldState: session.worldState, activeCrew: session.worldState.crew[0], action: "No identity" });
    expect(prompts.at(-1)).not.toMatch(/PLAYER-[AB]_PRIVATE_MARKER|UNIDENTIFIED_LEGACY_PRIVATE_MARKER/);
    await store.deleteSession("slot-1", "player-a");
    expect(await readFile(getOwnerMirrorPaths("player-a").logMdPath, "utf8")).not.toContain("PLAYER-A_PRIVATE_MARKER");
    expect(await readFile(getOwnerMirrorPaths("player-b").logMdPath, "utf8")).toContain("PLAYER-B_PRIVATE_MARKER");
    for (const file of ["session.json", "session-state.md", "log.md", "overrides/npc-override.md", "overrides/location-delta.md"]) {
      expect(await readFile(path.join(root, file), "utf8")).toBe("UNIDENTIFIED_LEGACY_PRIVATE_MARKER");
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
