import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.DM_API_PORT || 8787);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const SYSTEM = `You are the DM for a tense sci-fi mission RPG (lunar anomaly, crew survival).
Respond with ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:
{"narration":"string","stateDelta":{}}

Rules:
- narration: immersive second-person or neutral omniscient, 2–5 short paragraphs; advance the situation based on the action.
- stateDelta: optional. Only include keys that change. Allowed top-level keys: mission, environment, systems, crew, eventLog.
- crew: an array of objects with at least "id" plus fields to update (health, morale, extra, name, role).
- eventLog: optional array of NEW log entries { "ts": string, "msg": string, "type": "info"|"warn"|"alert"|"action" } to prepend (most recent first).
- Keep numbers plausible (0–100 for percentages). Do not repeat the full world state; only deltas.`;

const app = express();
app.use(express.json({ limit: "512kb" }));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function extractJsonObject(text) {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(unfenced.slice(start, end + 1));
}

app.post("/api/turn", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({
      error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
    });
    return;
  }

  try {
    const { worldState, action, activeCrew } = req.body || {};
    if (!worldState || !action || !activeCrew) {
      res.status(400).json({ error: "Missing worldState, action, or activeCrew" });
      return;
    }

    const userContent = `Current world state (JSON):\n${JSON.stringify(worldState, null, 2)}\n\nActive crew member: ${activeCrew.name} (${activeCrew.role})\nPlayer action:\n${action}\n\nReturn JSON only.`;

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const block = message.content[0];
    const text = block?.type === "text" ? block.text : "";
    const parsed = extractJsonObject(text);
    const narration = typeof parsed.narration === "string" ? parsed.narration : "";
    const stateDelta = parsed.stateDelta && typeof parsed.stateDelta === "object" ? parsed.stateDelta : {};

    if (!narration) {
      res.status(502).json({ error: "Model returned empty narration" });
      return;
    }

    res.json({ narration, stateDelta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`DM API listening on http://localhost:${PORT}`);
});
