import { afterEach, describe, expect, test } from "vitest";
import { getLlmConfig, getLlmProvider } from "../server/llmConfig.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("llmConfig", () => {
  test("defaults to OpenAI when no provider is set", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(getLlmProvider()).toBe("openai");
    expect(getLlmConfig().provider).toBe("openai");
    expect(getLlmConfig().apiUrl).toContain("openai.com");
  });

  test("uses Anthropic when only ANTHROPIC_API_KEY is set", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";

    expect(getLlmProvider()).toBe("anthropic");
    expect(getLlmConfig().provider).toBe("anthropic");
    expect(getLlmConfig().apiUrl).toContain("anthropic.com");
  });

  test("respects explicit LLM_PROVIDER=anthropic", () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";

    expect(getLlmProvider()).toBe("anthropic");
    expect(getLlmConfig().apiKey).toBe("anthropic-key");
  });
});
