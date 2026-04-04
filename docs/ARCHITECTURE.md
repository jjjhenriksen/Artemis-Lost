# Architecture

This project is currently a small full-stack prototype with one frontend app and one local DM server.

## High-Level Layout

- [src/App.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/App.jsx): minimal app entry that renders the main UI
- [src/UI.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/UI.jsx): primary gameplay container and turn orchestration
- [src/worldState.js](/Users/jacquelinehenriksen/DungeonMAIster/src/worldState.js): seeded mission state and opening narration
- [src/roleFilters.js](/Users/jacquelinehenriksen/DungeonMAIster/src/roleFilters.js): role-specific dashboard data selection
- [src/NarrationPanel.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/NarrationPanel.jsx): DM narration display and event-log shell
- [src/EventLog.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/EventLog.jsx): recent mission history display
- [src/CrewCard.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/CrewCard.jsx): crew summary cards and stat bars
- [src/RoleView.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/RoleView.jsx): active role telemetry panel
- [src/ActionInput.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/ActionInput.jsx): player input form and waiting-state handling
- [src/TurnIndicator.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/TurnIndicator.jsx): active-turn status line
- [src/CrewStatusBar.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/CrewStatusBar.jsx): mission header metrics
- [src/useTypewriter.js](/Users/jacquelinehenriksen/DungeonMAIster/src/useTypewriter.js): narration typing effect hook
- [src/dmApi.js](/Users/jacquelinehenriksen/DungeonMAIster/src/dmApi.js): browser-side helper for posting turn requests to the local API
- [src/sessionApi.js](/Users/jacquelinehenriksen/DungeonMAIster/src/sessionApi.js): browser-side helpers for loading and saving the current session
- [src/applyStateDelta.js](/Users/jacquelinehenriksen/DungeonMAIster/src/applyStateDelta.js): merges model-generated state changes into the current world state
<<<<<<< Updated upstream
- [src/deltaParser.js](/Users/jacquelinehenriksen/DungeonMAIster/src/deltaParser.js): canonical state-delta parsing, normalization, and merge rules
=======
- [src/styles.css](/Users/jacquelinehenriksen/DungeonMAIster/src/styles.css): shared UI theme tokens and component classes
- [server/api.js](/Users/jacquelinehenriksen/DungeonMAIster/server/api.js): Anthropic wrapper plus DM response extraction and validation
>>>>>>> Stashed changes
- [server/dmServer.mjs](/Users/jacquelinehenriksen/DungeonMAIster/server/dmServer.mjs): Express server that validates input, calls Anthropic, and returns structured narration plus state updates
- [server/sessionStore.js](/Users/jacquelinehenriksen/DungeonMAIster/server/sessionStore.js): persists gameplay state into `vault/dynamic`
- [server/vault.js](/Users/jacquelinehenriksen/DungeonMAIster/server/vault.js): loads static and dynamic vault markdown into prompt context

## Runtime Responsibilities

### Frontend

The React app currently owns:
- the current world state in memory
- active-turn selection
- composition of presentational gameplay components
- local action submission flow
- conversation history tracking
- loading and saving session snapshots through the local API
- application of returned `stateDelta` objects

The refactor now separates seeded data, role filtering, and major UI surfaces into their own modules, while keeping the game loop orchestration in one place.

### Backend

The local Express server currently owns:
- reading environment variables
- constructing the Anthropic system prompt
- loading vault markdown context for prompt assembly
- sending the current world state and player action to the model
- extracting JSON from the model response
- validating and sanitizing returned state deltas
- persisting session files under `vault/dynamic`
- returning normalized `narration` and `stateDelta` data to the UI

## Current World State Contract

The app centers around a shared `worldState` object with these top-level areas:

```js
{
  mission:     { id, name, phase, met, objectives },
  environment: { location, hazards, anomaly },
  systems:     { o2, power, comms, propulsion, scrubber },
  crew:        [{ id, name, role, health, morale, extra }],
  eventLog:    [{ ts, msg, type }],
}
```

## State Update Model

The backend asks the model to return JSON in this shape:

```json
{
  "narration": "string",
  "stateDelta": {}
}
```

`stateDelta` is partial. Only changed fields should be returned. The frontend then merges those changes into the previous state using [src/applyStateDelta.js](/Users/jacquelinehenriksen/DungeonMAIster/src/applyStateDelta.js).

Merge behavior today:
- `mission`, `environment`, and `systems` are shallow-merged
- `crew` entries are matched and patched by `id`, with nested `extra` merged safely
- `eventLog` entries are prepended, deduplicated, normalized, and capped to 12 items

## Vault Contract

Artemis prompt content is organized under `vault/static/` and `vault/dynamic/`.

- `vault/static/locations/`: durable location descriptions
- `vault/static/crew/`: durable crew reference profiles
- `vault/static/lore/`: durable mission and anomaly lore
- `vault/dynamic/session-state.md`: markdown mirror of the active world state
- `vault/dynamic/log.md`: concise turn history
- `vault/dynamic/overrides/`: narrow session-only overrides such as NPC or location deltas

## Implemented Support Systems

- session snapshots are stored in `vault/dynamic/session.json`
- human-readable session handoff files are written to `vault/dynamic/session-state.md` and `vault/dynamic/log.md`
- the DM prompt is enriched with static lore, crew, location, and dynamic override content from the vault
- shared styling now lives in [src/styles.css](/Users/jacquelinehenriksen/DungeonMAIster/src/styles.css)

## Known Structural Gaps

- the session system does not yet expose reset, import, or save-status controls in the UI
- vault prompt assembly currently loads broad context rather than selecting only the most relevant files
- there is still no formal test coverage around the DM response validation path

## Recommended Refactor Path

1. Add visible session-management controls in the frontend.
2. Narrow vault prompt assembly to location-, role-, or event-relevant files.
3. Add tests around DM response parsing and session serialization.
4. Separate more domain logic such as turn progression and event-log capping into dedicated helpers if gameplay rules grow.
