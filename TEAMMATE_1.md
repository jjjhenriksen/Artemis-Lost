# Teammate 1 Prompt

You are Teammate 1 for the "Artemis Lost" hackathon project.

Your role: AI Engine + Integration Lead.

Your mission is to own the DM engine, the Anthropic integration layer, and the glue that connects the rest of the system into a playable turn loop.

## What You Own

Primary files:
- `api.js`
- `gameLoop.js`
- `prompts.js`

Primary responsibilities:
- Build the Anthropic API wrapper.
- Design the DM system prompt, including persona, tone, role injection, and strict `STATE_DELTA` output instructions.
- Extract the `STATE_DELTA` block from model output and pass it to Teammate 2's merger logic.
- Implement turn management and `currentTurn` cycling.
- Serve as the integration point that wires together all four workstreams.
- Test and refine prompt quality, narration consistency, and structured output reliability.

## Core Requirements

- The API layer should accept:
  - world state
  - player action
  - conversation history
- It should return:
  - narration text
  - a parsable `STATE_DELTA`
- Your prompt must preserve a strong DM voice while still producing machine-readable state updates.
- Treat the world state shape and `STATE_DELTA` format below as the source of truth.

## Shared Contracts

World state shape:

```js
{
  mission:     { id, name, phase, met, objectives },
  environment: { location, hazards, anomaly },
  systems:     { o2, power, comms, propulsion, scrubber },
  crew:        [{ id, name, role, health, morale, extra }],
  eventLog:    [{ ts, msg, type }],
}
```

Expected `STATE_DELTA` format:

```txt
STATE_DELTA:
{
  "systems": { "o2": 68 },
  "crew": [{ "id": "park", "health": 70 }],
  "eventLog": [{ "ts": "T+14:30", "msg": "Park suited up for EVA", "type": "action" }]
}
```

## First Deliverable

By hour 0-8, produce a working API call that takes a hardcoded action and returns a narration string. No UI is required for this first milestone.

## Collaboration Notes

- Expect Teammate 2 to define the canonical world state schema and delta merge behavior.
- Expect Teammate 3 to consume filtered role views without hardcoding assumptions.
- Expect Teammate 4 to render narration, event history, and status data you help supply.
- If the model output format is unstable, improve the prompt before inventing brittle parsing hacks.

## Success Criteria

- A player action can be sent to the model.
- The response contains immersive narration.
- The response includes a valid `STATE_DELTA`.
- The delta can be handed off cleanly for application to world state.
- The turn loop can advance to the next crew member.

## AI-Assist Focus

Use AI help for:
- opening scenario lore
- DM persona copy
- prompt refinement

## Working Style

- Favor simple, debuggable interfaces over clever abstractions.
- Keep prompt contracts explicit.
- Optimize for end-to-end reliability so the full loop can integrate early.
