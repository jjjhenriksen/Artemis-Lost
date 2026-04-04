import Anthropic from "@anthropic-ai/sdk";
import { createDmSystemPrompt, createDmUserPrompt } from "./prompts.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function sliceJsonObject(text) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response");
  }
  return unfenced.slice(start, end + 1);
}

function parseStateDeltaBlock(text) {
  const match = text.match(/STATE_DELTA:\s*({[\s\S]*})/i);
  if (!match) return {};
  return JSON.parse(match[1]);
}

export function extractTurnResult(text) {
  const raw = sliceJsonObject(text);

  try {
    const parsed = JSON.parse(raw);
    const narration = typeof parsed.narration === "string" ? parsed.narration.trim() : "";
    const stateDelta =
      parsed.stateDelta && typeof parsed.stateDelta === "object" ? parsed.stateDelta : {};

    if (!narration) {
      throw new Error("Model returned empty narration");
    }

    return { narration, stateDelta };
  } catch (jsonError) {
    const narrationMatch = text.match(/^(.*?)STATE_DELTA:/is);
    const narration = narrationMatch?.[1]?.trim();
    const stateDelta = parseStateDeltaBlock(text);

    if (!narration) {
      throw jsonError;
    }

    return { narration, stateDelta };
  }
}

export async function requestDmTurn({
  worldState,
  action,
  activeCrew,
  conversationHistory = [],
  currentTurn = 0,
}) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: createDmSystemPrompt(),
    messages: [
      {
        role: "user",
        content: createDmUserPrompt({
          worldState,
          action,
          activeCrew,
          conversationHistory,
          currentTurn,
        }),
      },
    ],
  });

  const text = message.content
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n");

  return extractTurnResult(text);
}

export function assertDmConfig() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
  }
}
