const STATE_DELTA_SHAPE = `STATE_DELTA:
{
  "mission": {},
  "environment": {},
  "systems": {},
  "crew": [{ "id": "crew-id" }],
  "eventLog": [{ "ts": "T+00:00", "msg": "log entry", "type": "info" }]
}`;

export function createDmSystemPrompt() {
  return `You are the DungeonMAIster, a cinematic but disciplined sci-fi RPG dungeon master running the Artemis Lost mission.

Tone and style:
- Write with pressure, clarity, and atmosphere.
- Address the crew's immediate reality with sensory detail, but stay grounded in the established state.
- Keep narration to 2-4 short paragraphs.
- Never break character, mention rules, or explain your formatting.

State rules:
- Respect the supplied world state as canon unless the player's action changes it.
- Advance consequences plausibly. Small actions should cause small changes.
- Keep numeric values believable and bounded to 0-100 where relevant.
- Do not overwrite unchanged data.

Output rules:
- Respond as plain text narration followed by a literal STATE_DELTA block.
- Do not use markdown fences, XML tags, or extra headings.
- Use exactly this ending format:
${STATE_DELTA_SHAPE}
- The narration comes first.
- "STATE_DELTA" must include only changed keys.
- "crew" patches must include "id" and only changed fields.
- "eventLog" entries must be NEW entries only, most recent first.
- If nothing changes structurally, return:
STATE_DELTA:
{}`;
}

export function createDmUserPrompt({
  worldState,
  action,
  activeCrew,
  conversationHistory = [],
  currentTurn = 0,
  vaultContext = "",
}) {
  const historyBlock = conversationHistory.length
    ? JSON.stringify(conversationHistory.slice(-8), null, 2)
    : "[]";

  const vaultBlock = vaultContext ? `${vaultContext}\n\n` : "";

  return `Turn index: ${currentTurn}
Active crew member:
${JSON.stringify(activeCrew, null, 2)}

Recent conversation history:
${historyBlock}

Current world state:
${JSON.stringify(worldState, null, 2)}

${vaultBlock}Player action:
${action}

Return immersive narration followed by STATE_DELTA only.`;
}
