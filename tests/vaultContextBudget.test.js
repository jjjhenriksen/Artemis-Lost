// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, test, vi } from "vitest";
import { createMissionSession } from "../src/game/worldState.js";
import { formatVaultContext, getVaultContextBudget } from "../server/vault.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

test("per-section and total context budgets include metadata even when every section is huge", () => {
  const context = Object.fromEntries(["location", "crew", "missionBrief", "anomaly", "sessionState", "log", "npcOverride", "locationDelta"]
    .map((key) => [key, `${key}:` + "🌘é漢".repeat(30000)]));
  const budget = { sectionMaxBytes: 4000, totalMaxBytes: 4096 };
  const formatted = formatVaultContext(context, budget);
  expect(Buffer.byteLength(formatted)).toBeLessThanOrEqual(budget.totalMaxBytes);
  for (const section of formatted.split(/^## /m).slice(1)) {
    expect(Buffer.byteLength(section.slice(section.indexOf("\n") + 1).trimEnd())).toBeLessThanOrEqual(budget.sectionMaxBytes);
    expect(section).toContain("Context truncated:");
    expect(section).not.toContain("�");
  }
});

test("long synthetic saves keep full persisted logs while prompts retain recent entries within configured budgets", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artemis-context-budget-"));
  vi.stubEnv("DATA_DIR", directory); vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("VAULT_SECTION_MAX_BYTES", "1024"); vi.stubEnv("VAULT_TOTAL_MAX_BYTES", "4096");
  vi.resetModules();
  const store = await import("../server/sessionStore.js");
  const { getOwnerMirrorPaths } = await import("../server/sessionMirrors.js");
  const vault = await import("../server/vault.js");
  const { requestDmTurn } = await import("../server/api.js");
  const session = createMissionSession();
  session.conversationHistory = Array.from({ length: 300 }, (_, i) => ({ role: "user", content: `ENTRY_${i}_MARKER ${"x".repeat(80)}` }));
  try {
    await store.saveSession("slot-1", session, "fixture-long-session");
    const logPath = getOwnerMirrorPaths("fixture-long-session").logMdPath;
    const before = await readFile(logPath, "utf8");
    const formatted = vault.formatVaultContext(await vault.loadVaultContext({ ownerId: "fixture-long-session", worldState: session.worldState, activeCrew: session.worldState.crew[0] }));
    expect(Buffer.byteLength(formatted)).toBeLessThanOrEqual(4096);
    expect(formatted).toContain("ENTRY_299_MARKER");
    expect(formatted).not.toContain("ENTRY_0_MARKER");
    expect(formatted).toContain("[Context truncated: older material omitted.]");
    vi.stubEnv("LLM_PROVIDER", "openai");
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ narration: "Fictional bounded report", stateDelta: {} }) }) }));
    vi.stubGlobal("fetch", fetch);
    await requestDmTurn({ ownerId: "fixture-long-session", worldState: session.worldState, activeCrew: session.worldState.crew[0], action: "Check the cabin", conversationHistory: session.conversationHistory });
    const prompt = JSON.parse(fetch.mock.calls[0][1].body).input;
    const contextStart = prompt.indexOf("Vault mission context:");
    const contextEnd = prompt.indexOf("\n\nPlayer action:", contextStart);
    expect(prompt.slice(contextStart, contextEnd)).toBe(formatted);
    expect(Buffer.byteLength(prompt.slice(contextStart, contextEnd))).toBeLessThanOrEqual(4096);
    expect(await readFile(logPath, "utf8")).toBe(before);
    expect(before).toContain("ENTRY_0_MARKER");
    expect((await store.loadSession("slot-1", "fixture-long-session")).conversationHistory).toHaveLength(300);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test.each(["0", "-1", "Infinity", "12.5", "bad", "999999999"])("rejects invalid configured budget %s", (value) => {
  expect(() => getVaultContextBudget({ VAULT_SECTION_MAX_BYTES: value })).toThrow(/bounded integers/);
  expect(() => getVaultContextBudget({ VAULT_TOTAL_MAX_BYTES: value })).toThrow(/bounded integers/);
});
