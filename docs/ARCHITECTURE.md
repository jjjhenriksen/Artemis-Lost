# Architecture

Artemis Lost is a small full-stack app with a React frontend, a local Express DM server, and a vault-backed session layer.

## High-Level Modules

### App Shell And Navigation

- [src/app/App.jsx](../src/app/App.jsx): app entry, screen routing, theme persistence, and save-slot hydration
- [src/screens/MainMenu.jsx](../src/screens/MainMenu.jsx): front-door flow for new mission, continue, load, and delete
- [src/screens/CharacterCreation.jsx](../src/screens/CharacterCreation.jsx): crew editing, lock/reroll controls, human-vs-autonomous role assignment, and mission-seed preview
- [src/screens/LaunchSequence.jsx](../src/screens/LaunchSequence.jsx): cinematic transition between setup and live mission
- [src/screens/UI.jsx](../src/screens/UI.jsx): in-mission turn orchestration, autosave, autonomous-turn auto-play, and DM integration

### World-State And Scenario Layer

- [src/game/worldState.js](../src/game/worldState.js): crew blueprints, mission-session creation, seed resolution, opening narration, and world-state creation
- [src/game/missionSeeds.js](../src/game/missionSeeds.js): scenario-seed definitions and mission-seed helpers
- [src/game/missionMechanics.js](../src/game/missionMechanics.js): seed-specific leverage windows and local mission effects
- [src/game/characterBanks.js](../src/game/characterBanks.js): names, call signs, traits, flaws, specialties, stakes, and tension patterns
- [src/game/botTurns.js](../src/game/botTurns.js): autonomous-action generation for underfilled crews
- [src/game/gameLoop.js](../src/game/gameLoop.js): turn helpers, MET advancement, conversation helpers, and log-entry creation
- [src/game/stateUtils.js](../src/game/stateUtils.js): shared state selectors and numeric clamping helpers

### Presentation Layer

- [src/components/NarrationPanel.jsx](../src/components/NarrationPanel.jsx): DM narration plus event-log panel
- [src/components/EventLog.jsx](../src/components/EventLog.jsx): instrumented log rendering
- [src/components/ActionInput.jsx](../src/components/ActionInput.jsx): human-turn controls and autonomous-turn status
- [src/components/CrewCard.jsx](../src/components/CrewCard.jsx): crew cards, status bars, and controller badges
- [src/components/RosterSummary.jsx](../src/components/RosterSummary.jsx): crew dossier with trait, flaw, and controller mode
- [src/components/RoleView.jsx](../src/components/RoleView.jsx): active-role console and operational context
- [src/components/CrewStatusBar.jsx](../src/components/CrewStatusBar.jsx): mission/system header strip
- [src/components/ThemePicker.jsx](../src/components/ThemePicker.jsx): shared theme-switching control
- [src/game/roleFilters.js](../src/game/roleFilters.js): role-specific view selection and console brief generation
- [src/game/uiState.js](../src/game/uiState.js): derived UI-facing state for headers, alerts, and action-panel previews
- [src/styles/styles.css](../src/styles/styles.css): shared tokens, themes, component styles, and ambient background treatment
- [src/game/themes.js](../src/game/themes.js): theme registry and storage helpers

### Role And Coordination Systems

- [src/game/roleSemantics.js](../src/game/roleSemantics.js): role-alignment keywords and follow-through targeting rules
- [src/game/roleGuidance.js](../src/game/roleGuidance.js): tactical focus generation and suggested commands
- [src/game/crewCoordination.js](../src/game/crewCoordination.js): delegation profiles, crew-fit scoring, handoff windows, and coordination alerts
- [src/game/roleMechanics.js](../src/game/roleMechanics.js): local per-role effects and public role/coordination selectors

### DM Integration Layer

- [src/services/dmApi.js](../src/services/dmApi.js): browser request helper for `/api/turn`
- [server/dmServer.mjs](../server/dmServer.mjs): Express API for DM turns and sessions
- [server/api.js](../server/api.js): OpenAI Responses API call path and response extraction
- [server/prompts.js](../server/prompts.js): system and user prompt assembly rules
- [src/game/deltaParser.js](../src/game/deltaParser.js): normalizes model output into safe state deltas
- [src/game/applyStateDelta.js](../src/game/applyStateDelta.js): merges validated deltas into local state

### Session And Vault Layer

- [src/services/sessionApi.js](../src/services/sessionApi.js): load/save/delete/list session helpers
- [server/sessionStore.js](../server/sessionStore.js): public slot persistence orchestration and payload normalization
- [server/sessionStorageAdapter.js](../server/sessionStorageAdapter.js): storage backend adapter for filesystem vs database session persistence
- [server/sessionMirrors.js](../server/sessionMirrors.js): active-session markdown and JSON mirrors for prompt context
- [server/vault.js](../server/vault.js): static/dynamic vault loading and prompt-context assembly

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

- base turn order is round-robin across the four crew seats
- follow-through windows can now override round-robin and jump initiative to the targeted role
- each role can be `human` or `autonomous`
- human seats expose the text action input
- autonomous roles generate a role-aware action automatically and submit it through the same DM path
- the session must contain at least one human-controlled role

## Local Gameplay Systems

The frontend no longer relies only on the DM for progression. It also applies local gameplay layers after DM resolution:

- role mechanics: aligned actions create role-specific numeric benefits
- mission mechanics: certain seeds expose bespoke leverage windows with custom local bonuses
- crew coordination: handoff windows, delegation strength, and trust/friction evolve over time
- derived UI state: action recommendations and warnings are computed from the live world state before submission

## Event Log Model

The event log is now typed and instrumented. Supported types are:
- `command`
- `system`
- `sensor`
- `trait`
- `risk`

These types are normalized in the delta parser and rendered as badges in the UI.

## Save And Vault Model

Persistent state now has separate concerns:

- the session store orchestrates slot-level save/load/delete behavior
- the storage adapter decides whether canonical saves live in local JSON files or the configured database backend
- the mirror layer writes active prompt-context artifacts into `vault/dynamic/`
- `vault/dynamic/session-state.md` keeps a handoff-friendly state snapshot
- `vault/dynamic/log.md` keeps recent conversation history
- `vault/dynamic/session.json` keeps the currently active structured session mirror

The prompt layer also loads relevant static lore from `vault/static/`.

## Prompt Contract

The DM prompt now explicitly encodes:
- structured `STATE_DELTA` output
- mission-seed pressure and atmosphere
- crew traits, flaws, stakes, and tension
- role specialization and off-role friction
- active crew coordination and follow-through context
- typed event-log expectations

Trait-driven outcomes are expected to produce `trait` log entries when personality materially affects the turn result.
