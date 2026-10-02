import { afterEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { getLlmConfig, getLlmProvider, isLlmConfigured } from "../server/llmConfig.js";

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
  test.each(["opena", "claude", "azure", "undefined"])("rejects explicit unsupported provider %s even when valid keys are configured", (provider) => {
    process.env.LLM_PROVIDER = provider;
    process.env.OPENAI_API_KEY = "fictional-openai-key";
    process.env.ANTHROPIC_API_KEY = "fictional-anthropic-key";
    for (const getConfig of [getLlmProvider, getLlmConfig, isLlmConfigured]) {
      expect(getConfig).toThrow(/Unsupported LLM_PROVIDER/);
      try { getConfig(); } catch (error) {
        expect(error).toMatchObject({ status: 503, code: "INVALID_LLM_PROVIDER" });
        expect(error.message).not.toContain("fictional-");
      }
    }
  });

  test.each([[" OpenAI ", "openai"], ["ANTHROPIC", "anthropic"]])("keeps valid explicit selection %s independent of available keys", (configured, selected) => {
    process.env.LLM_PROVIDER = configured;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(getLlmProvider()).toBe(selected);
    expect(isLlmConfigured()).toBe(false);
  });

  test.each([undefined, "", "   "])("uses key-based selection only for absent or blank values: %s", (value) => {
    if (value === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = value;
    process.env.ANTHROPIC_API_KEY = "fictional-anthropic-key";
    delete process.env.OPENAI_API_KEY;
    expect(getLlmProvider()).toBe("anthropic");
    process.env.OPENAI_API_KEY = "fictional-openai-key";
    expect(getLlmProvider()).toBe("openai");
  });

  test("invalid configuration prevents the real server from starting instead of selecting a paid provider", () => {
    const result = spawnSync(process.execPath, ["server/dmServer.mjs"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 10000,
      env: { ...process.env, LLM_PROVIDER: "fixture-invalid-provider", DATABASE_URL: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", DM_API_PORT: "0" },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported LLM_PROVIDER");
    expect(result.stdout).not.toMatch(/listening on/);
  });

});
