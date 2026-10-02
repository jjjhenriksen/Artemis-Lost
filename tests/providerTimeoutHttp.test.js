// @vitest-environment node
import request from "supertest";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "../server/dmServer.mjs";
import { createMissionSession } from "../src/game/worldState.js";
import { getProviderTimeoutMs } from "../server/providerTimeout.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const session = createMissionSession();
const input = { worldState: session.worldState, activeCrew: session.worldState.crew[0], action: "Fixture action" };

test.each(["openai", "anthropic"])("%s stalled DM and autonomous requests abort and return retryable HTTP 504", async (provider) => {
  vi.stubEnv("LLM_PROVIDER", provider); vi.stubEnv("LLM_TIMEOUT_MS", "5");
  const fetch = vi.fn((_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Fixture aborted", "AbortError")), { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  const app = createApp({ assertConfig: () => {} });
  for (const endpoint of ["/api/turn", "/api/autonomous-action"]) {
    const response = await request(app).post(endpoint).set("x-player-id", "fixture-timeout-only").send(input);
    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({ code: "TURN_TIMEOUT", retryable: true });
    expect(fetch.mock.calls.at(-1)[1].signal.aborted).toBe(true);
  }
  expect(fetch).toHaveBeenCalledTimes(2);
});

test.each(["openai", "anthropic"])("%s stalled response body also obeys its configured deadline", async (provider) => {
  vi.stubEnv("LLM_PROVIDER", provider); vi.stubEnv("LLM_TIMEOUT_MS", "5");
  const fetch = vi.fn(async (_, { signal }) => ({ ok: true, json: () => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Fixture body aborted", "AbortError")), { once: true });
  }) }));
  vi.stubGlobal("fetch", fetch);
  const response = await request(createApp({ assertConfig: () => {} })).post("/api/turn").set("x-player-id", "fixture-timeout-only").send(input);
  expect(response.status).toBe(504);
  expect(response.body).toMatchObject({ code: "TURN_TIMEOUT", retryable: true });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});

test.each(["0", "-1", "120001", "Infinity", "NaN", "1.5", "bad"])("rejects invalid timeout %s before any provider fetch", async (value) => {
  vi.stubEnv("LLM_TIMEOUT_MS", value);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const response = await request(createApp({ assertConfig: () => {} })).post("/api/turn").set("x-player-id", "fixture-timeout-only").send(input);
  expect(response.status).toBe(503);
  expect(response.body.code).toBe("INVALID_PROVIDER_TIMEOUT");
  expect(fetch).not.toHaveBeenCalled();
});

test("timeout configuration is validated, bounded and exported", () => {
  expect(getProviderTimeoutMs(1)).toBe(1);
  expect(getProviderTimeoutMs(120000)).toBe(120000);
  expect(getProviderTimeoutMs("")).toBe(30000);
  expect(() => getProviderTimeoutMs(0)).toThrow(/between 1 and 120000/);
});
