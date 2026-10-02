// @vitest-environment node
import http from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
const { loadVaultContext } = vi.hoisted(() => ({ loadVaultContext: vi.fn(async () => ({})) }));
vi.mock("../server/vault.js", () => ({ loadVaultContext, formatVaultContext: () => "Fictional vault context" }));
import { requestDmTurn, requestAutonomousCrewAction } from "../server/api.js";
import { createMissionSession } from "../src/game/worldState.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
function payload(options = {}) {
  const session = createMissionSession();
  return { worldState: session.worldState, activeCrew: session.worldState.crew[0], action: "Fixture action", ...options };
}
const resultText = JSON.stringify({ narration: "Fictional provider report", stateDelta: { systems: { power: 80 } } });

describe("bounded provider calls", () => {
  test.each(["openai", "anthropic"])("passes abort signals and keeps %s response compatibility", async (provider) => {
    vi.stubEnv("LLM_PROVIDER", provider);
    const fetchFixture = vi.fn(async () => ({ ok: true, json: async () => provider === "openai"
      ? { output_text: resultText } : { content: [{ type: "text", text: resultText }] } }));
    vi.stubGlobal("fetch", fetchFixture);
    const result = await requestDmTurn(payload({ sharedRoom: true }));
    expect(result.narration).toBe("Fictional provider report");
    expect(loadVaultContext).toHaveBeenCalledWith(expect.objectContaining({ sharedRoom: true }));
    expect(fetchFixture.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchFixture.mock.calls[0][1].signal.aborted).toBe(false);
  });

  test.each(["openai", "anthropic"])("aborts a stalled %s fetch", async (provider) => {
    vi.stubEnv("LLM_PROVIDER", provider);
    const fetchFixture = vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("fixture aborted")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchFixture);
    await expect(requestDmTurn(payload({ sharedRoom: true, timeoutMs: 10 }))).rejects.toMatchObject({ status: 504, code: "TURN_TIMEOUT" });
    expect(fetchFixture.mock.calls[0][1].signal.aborted).toBe(true);
  });

  test("cancels an actual stalled HTTP connection without a real provider request", async () => {
    let connection;
    let acceptRequest;
    const received = new Promise((resolve) => { acceptRequest = resolve; });
    const server = http.createServer((request) => { connection = request.socket; acceptRequest(); });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_URL", `http://127.0.0.1:${server.address().port}/fixture`);
    try {
      const promise = requestDmTurn(payload({ sharedRoom: true, timeoutMs: 100 }));
      const closed = received.then(() => new Promise((resolve) => connection.once("close", resolve)));
      await expect(promise).rejects.toMatchObject({ status: 504, code: "TURN_TIMEOUT" });
      await closed;
      expect(connection.destroyed).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("caller cancellation propagates to the provider", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("fixture cancelled")), { once: true });
      controller.abort();
    })));
    await expect(requestDmTurn(payload({ signal: controller.signal }))).rejects.toMatchObject({ code: "TURN_TIMEOUT" });
  });

  test("solo DM and autonomous response formats remain compatible", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ output: [{ content: [{ type: "output_text", text: resultText }] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: " Check the   cabin. " }) }));
    expect((await requestDmTurn(payload())).narration).toBe("Fictional provider report");
    expect(loadVaultContext.mock.calls[0][0].sharedRoom).toBe(false);
    expect(await requestAutonomousCrewAction(payload())).toBe("Check the cabin.");
  });
});
