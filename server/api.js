import Anthropic from "@anthropic-ai/sdk";
import { extractTurnResult } from "../src/deltaParser.js";
import { createDmSystemPrompt, createDmUserPrompt } from "./prompts.js";
import { formatVaultContext, loadVaultContext } from "./vault.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function requestDmTurn({
  worldState,
  action,
  activeCrew,
  conversationHistory = [],
  currentTurn = 0,
}) {
  // Pull static lore and crew/location context into the prompt on each turn.
  const vaultContext = formatVaultContext(await loadVaultContext());

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
          vaultContext,
        }),
      },
    ],
  });

  // Anthropic responses arrive as content blocks; flatten the text blocks into one DM reply.
  const text = message.content
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n");

  return extractTurnResult(text);
}

export function assertDmConfig() {
  // Fail fast with a teammate-friendly message before we ever try to hit the API.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
  }
}
