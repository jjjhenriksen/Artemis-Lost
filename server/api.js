import { extractTurnResult } from "../src/game/deltaParser.js";
import {
  createAutonomousCrewSystemPrompt,
  createAutonomousCrewUserPrompt,
  createDmSystemPrompt,
  createDmUserPrompt,
} from "./prompts.js";
import { getLlmConfig } from "./llmConfig.js";
import { formatVaultContext, loadVaultContext } from "./vault.js";

function extractOpenAiResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const fragments = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        fragments.push(content.text);
      }
      if (content?.type === "text" && typeof content.text === "string") {
        fragments.push(content.text);
      }
    }
  }

  return fragments.join("\n").trim();
}

function extractAnthropicResponseText(payload) {
  const fragments = [];
  for (const block of payload?.content || []) {
    if (block?.type === "text" && typeof block.text === "string") {
      fragments.push(block.text);
    }
  }
  return fragments.join("\n").trim();
}

function getProviderErrorMessage(provider, payload, status) {
  return (
    payload?.error?.message ||
    payload?.message ||
    payload?.error?.type ||
    `${provider} request failed (${status})`
  );
}

async function requestLlmText({ systemPrompt, userPrompt }) {
  const { provider, apiKey, model, apiUrl } = getLlmConfig();

  if (provider === "anthropic") {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(getProviderErrorMessage("Anthropic", payload, res.status));
    }

    const text = extractAnthropicResponseText(payload);
    if (!text) {
      throw new Error("Anthropic returned an empty response");
    }

    return text;
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input: userPrompt,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getProviderErrorMessage("OpenAI", payload, res.status));
  }

  const text = extractOpenAiResponseText(payload);
  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  return text;
}

export async function requestDmTurn({
  worldState,
  action,
  activeCrew,
  conversationHistory = [],
  currentTurn = 0,
}) {
  const vaultContext = formatVaultContext(
    await loadVaultContext({
      worldState,
      activeCrew,
    })
  );

  const text = await requestLlmText({
    systemPrompt: createDmSystemPrompt(),
    userPrompt: createDmUserPrompt({
      worldState,
      action,
      activeCrew,
      conversationHistory,
      currentTurn,
      vaultContext,
    }),
  });

  return extractTurnResult(text);
}

export async function requestAutonomousCrewAction({
  worldState,
  activeCrew,
  conversationHistory = [],
  currentTurn = 0,
}) {
  const vaultContext = formatVaultContext(
    await loadVaultContext({
      worldState,
      activeCrew,
    })
  );

  const text = await requestLlmText({
    systemPrompt: createAutonomousCrewSystemPrompt(),
    userPrompt: createAutonomousCrewUserPrompt({
      worldState,
      activeCrew,
      conversationHistory,
      currentTurn,
      vaultContext,
    }),
  });

  return text.replace(/\s+/g, " ").trim();
}

export function assertDmConfig() {
  const { provider, apiKey } = getLlmConfig();

  if (apiKey) {
    return;
  }

  if (provider === "anthropic") {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env, set LLM_PROVIDER=anthropic, and add your key."
    );
  }

  throw new Error(
    "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key, or switch to Claude with LLM_PROVIDER=anthropic."
  );
}
