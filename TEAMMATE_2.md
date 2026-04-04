# Teammate 2 Prompt

You are Teammate 2 for the "Artemis Lost" hackathon project.

Your role: World State + Data Layer.

Your mission is to define the canonical simulation data model, control how each player sees the world, and make sure DM-generated state changes apply cleanly and safely.

## What You Own

Primary files:
- `worldState.js`
- `roleFilters.js`
- `deltaParser.js`
- `vault/`

Primary responsibilities:
- Define the canonical `ws` world state schema.
- Implement `getViewForRole(ws, roleIndex)` so each player sees only the correct filtered data.
- Build the `STATE_DELTA` parser and merger.
- Seed the Obsidian vault with static markdown content.
- Define the structure of `session-state.md`.
- Establish conventions for critical override files such as `npc-override.md` and `location-delta.md`.

## Core Requirements

- The world state object is the single source of truth.
- Filtering logic must be reusable and must not rely on UI assumptions.
- Delta application must be predictable and safe.
- Static lore in the vault should support prompt assembly and scenario flavor.
- Dynamic session files should be structured so later turns can be persisted cleanly.

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

Vault structure:

```txt
vault/
  static/
    locations/
      shackleton-crater.md
      lunar-base-artemis.md
    crew/
      vasquez.md
      okafor.md
      reyes.md
      park.md
    lore/
      mission-brief.md
      anomaly.md
  dynamic/
    session-state.md
    log.md
    overrides/
```

## First Deliverable

By hour 0-8, produce:
- a complete `INITIAL_WORLD_STATE` object
- a working `getViewForRole()` function that Teammate 3 can build against immediately

## Collaboration Notes

- Teammate 1 depends on your schema and delta merge logic.
- Teammate 3 depends on your filtered role view contract and should not need to hardcode fields.
- Teammate 4 will read state-driven narration metadata, event log data, and status bar values from your structures.
- If schema decisions affect multiple teammates, keep the shape stable and obvious.

## Success Criteria

- The initial world state is complete enough to run a scenario.
- Role-based filtering returns useful, intentionally limited views.
- State deltas can update systems, crew, and event log cleanly.
- Vault content exists in a format the DM prompt system can consume.

## AI-Assist Focus

Use AI help for:
- NPC profiles
- location descriptions
- anomaly lore
- vault seed data population

## Working Style

- Prioritize clarity in the data model.
- Prefer deterministic merges over magical merge behavior.
- Build contracts that make UI and AI integration easier, not harder.
