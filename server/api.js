import { extractTurnResult } from "../src/deltaParser.js";
import {
  createAutonomousCrewSystemPrompt,
  createAutonomousCrewUserPrompt,
  createDmSystemPrompt,
  createDmUserPrompt,
} from "./prompts.js";
import { formatVaultContext, loadVaultContext } from "./vault.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function extractResponseText(payload) {
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

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: createDmSystemPrompt(),
      input: createDmUserPrompt({
        worldState,
        action,
        activeCrew,
        conversationHistory,
        currentTurn,
        vaultContext,
      }),
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `OpenAI request failed (${res.status})`;
    throw new Error(message);
  }

  const text = extractResponseText(payload);
  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

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

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: createAutonomousCrewSystemPrompt(),
      input: createAutonomousCrewUserPrompt({
        worldState,
        activeCrew,
        conversationHistory,
        currentTurn,
        vaultContext,
      }),
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `OpenAI request failed (${res.status})`;
    throw new Error(message);
  }

  const text = extractResponseText(payload);
  if (!text) {
    throw new Error("OpenAI returned an empty autonomous action");
  }

  return text.replace(/\s+/g, " ").trim();
}

export function assertDmConfig() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
  }
}
