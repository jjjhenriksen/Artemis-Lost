# Architecture

DungeonMAIster is a small full-stack app with a React frontend, a local Express DM server, and a vault-backed session layer.

## High-Level Modules

### App Shell And Navigation

- [src/App.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/App.jsx): app entry, screen routing, theme persistence, save-slot hydration
- [src/MainMenu.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/MainMenu.jsx): front-door flow for new mission, continue, load, and delete
- [src/CharacterCreation.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/CharacterCreation.jsx): crew editing, lock/reroll controls, human-vs-autonomous role assignment, mission-seed preview
- [src/UI.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/UI.jsx): in-mission turn orchestration, autosave, autonomous-turn auto-play, and DM integration

### World-State And Scenario Layer

- [src/worldState.js](/Users/jacquelinehenriksen/DungeonMAIster/src/worldState.js): crew blueprints, mission-session creation, seed resolution, opening narration, and world-state creation
- [src/missionSeeds.js](/Users/jacquelinehenriksen/DungeonMAIster/src/missionSeeds.js): scenario-seed definitions and mission-seed helpers
- [src/characterBanks.js](/Users/jacquelinehenriksen/DungeonMAIster/src/characterBanks.js): names, call signs, traits, flaws, specialties, stakes, and tension patterns
- [src/botTurns.js](/Users/jacquelinehenriksen/DungeonMAIster/src/botTurns.js): autonomous-action generation for underfilled crews
- [src/gameLoop.js](/Users/jacquelinehenriksen/DungeonMAIster/src/gameLoop.js): turn helpers, MET advancement, conversation helpers, and log-entry creation

### Presentation Layer

- [src/NarrationPanel.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/NarrationPanel.jsx): DM narration plus event-log panel
- [src/EventLog.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/EventLog.jsx): instrumented log rendering
- [src/ActionInput.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/ActionInput.jsx): human-turn controls and autonomous-turn status
- [src/CrewCard.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/CrewCard.jsx): crew cards, status bars, and controller badges
- [src/RosterSummary.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/RosterSummary.jsx): crew dossier with trait, flaw, and controller mode
- [src/RoleView.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/RoleView.jsx): active-role console and operational context
- [src/CrewStatusBar.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/CrewStatusBar.jsx): mission/system header strip
- [src/ThemePicker.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/ThemePicker.jsx): shared theme-switching control
- [src/roleFilters.js](/Users/jacquelinehenriksen/DungeonMAIster/src/roleFilters.js): role-specific view selection and console brief generation
- [src/styles.css](/Users/jacquelinehenriksen/DungeonMAIster/src/styles.css): shared tokens, themes, component styles, and ambient background treatment
- [src/themes.js](/Users/jacquelinehenriksen/DungeonMAIster/src/themes.js): theme registry and storage helpers

### DM Integration Layer

- [src/dmApi.js](/Users/jacquelinehenriksen/DungeonMAIster/src/dmApi.js): browser request helper for `/api/turn`
- [server/dmServer.mjs](/Users/jacquelinehenriksen/DungeonMAIster/server/dmServer.mjs): Express API for DM turns and sessions
- [server/api.js](/Users/jacquelinehenriksen/DungeonMAIster/server/api.js): OpenAI Responses API call path and response extraction
- [server/prompts.js](/Users/jacquelinehenriksen/DungeonMAIster/server/prompts.js): system and user prompt assembly rules
- [src/deltaParser.js](/Users/jacquelinehenriksen/DungeonMAIster/src/deltaParser.js): normalizes model output into safe state deltas
- [src/applyStateDelta.js](/Users/jacquelinehenriksen/DungeonMAIster/src/applyStateDelta.js): merges validated deltas into local state

### Session And Vault Layer

- [src/sessionApi.js](/Users/jacquelinehenriksen/DungeonMAIster/src/sessionApi.js): load/save/delete/list session helpers
- [server/sessionStore.js](/Users/jacquelinehenriksen/DungeonMAIster/server/sessionStore.js): slot persistence and vault markdown mirrors
- [server/vault.js](/Users/jacquelinehenriksen/DungeonMAIster/server/vault.js): static/dynamic vault loading and prompt-context assembly

## Runtime Responsibilities

### Frontend

The frontend owns:
- menu and character-creation flow
- selected theme
- current `worldState`
- active `turn`
- current narration
- local conversation history
- autosave coordination
- autonomous-turn auto-play
- event-log and role-view rendering

### Backend

The backend owns:
- environment validation
- session loading and saving
- vault-context assembly
- OpenAI request execution
- DM response parsing and normalization
- safe `STATE_DELTA` extraction

## World-State Contract

The current `worldState` shape is centered around:

```js
{
  mission: {
    id,
    name,
    phase,
    met,
    objectives,
    seedId,
    seedLabel,
    seedSummary,
    seedTone,
    decisionPressure,
    suggestedOpening,
  },
  environment: {
    location,
    hazards,
    anomaly,
    visibility,
    pressure,
  },
  systems: {
    o2,
    power,
    comms,
    propulsion,
    scrubber,
    thermal,
    nav,
  },
  crew: [
    {
      id,
      name,
      role,
      health,
      morale,
      extra,
      notes,
      character: {
        callSign,
        trait,
        specialty,
        flaw,
        personalStake,
        tensionNote,
        controller,
      },
    },
  ],
  eventLog: [{ ts, msg, type }],
}
```

## Mission Seed Contract

Mission seeds are data-first scenario packets. Each seed includes:

```js
{
  id,
  label,
  summary,
  tone,
  decisionPressure,
  suggestedOpening,
  mission,
  environment,
  systems,
  eventLog,
}
```

Before launch, a seed is resolved against the selected crew so placeholder text like `{engineerShort}` becomes the actual launched roster name.

## Turn And Control Model

- turn order is still round-robin across the four crew seats
- each role can be `human` or `autonomous`
- human seats expose the text action input
- autonomous roles generate a role-aware action automatically and submit it through the same DM path
- the session must contain at least one human-controlled role

## Event Log Model

The event log is now typed and instrumented. Supported types are:
- `command`
- `system`
- `sensor`
- `trait`
- `risk`

These types are normalized in the delta parser and rendered as badges in the UI.

## Save And Vault Model

Persistent state is stored in slot JSON files and mirrored into vault markdown:

- slot JSON keeps the canonical session payload
- `vault/dynamic/session-state.md` keeps a handoff-friendly state snapshot
- `vault/dynamic/log.md` keeps recent conversation history
- `vault/dynamic/slots/` stores multi-slot save files

The prompt layer also loads relevant static lore from `vault/static/`.

## Prompt Contract

The DM prompt now explicitly encodes:
- structured `STATE_DELTA` output
- mission-seed pressure and atmosphere
- crew traits, flaws, stakes, and tension
- typed event-log expectations

Trait-driven outcomes are expected to produce `trait` log entries when personality materially affects the turn result.
