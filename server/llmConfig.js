const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6";

export function getLlmProvider() {
  const explicit = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (explicit === "openai" || explicit === "anthropic") {
    return explicit;
  }

  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return "anthropic";
  }

  return "openai";
}

export function getLlmConfig() {
  const provider = getLlmProvider();

  if (provider === "anthropic") {
    return {
      provider,
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL,
      apiUrl: "https://api.anthropic.com/v1/messages",
    };
  }

  return {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL,
    apiUrl: process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses",
  };
}

export function isLlmConfigured() {
  return Boolean(getLlmConfig().apiKey);
}
