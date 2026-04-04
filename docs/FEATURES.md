# Features

This document summarizes the major player-facing and system-facing features currently implemented in Artemis Lost.

## Core Play Loop

- four rotating crew roles share one mission state
- each turn sends the active crew member, recent conversation history, full world state, and vault context to the DM
- the DM returns narration plus a partial `STATE_DELTA`
- the frontend merges the delta, applies local role and mission systems, resolves handoff-driven initiative, and autosaves

## Character Creation

Character creation now acts as the front door to a mission run.

Players can:
- edit all four crew profiles
- change name, call sign, trait, specialty, flaw, and personal stake
- reroll the whole crew
- reroll a single crew member
- lock individual crew cards before rerolling
- set each role to `Human` or `Autonomous`

The character creation screen also shows:
- live crew-dynamic inference based on the entered traits and flaws
- a mission-seed preview
- mission tone, pressure, and suggested opening move
- the current human-controlled role count

## Autonomous Crew Roles

The game can now run with fewer than four human players.

- each crew role can be marked as `Human` or `Autonomous`
- autonomous roles automatically act when their turn comes up
- autonomous actions are role-aware and generated from mission state
- at least one human-controlled role is required to launch a mission

Controller status is visible in:
- character creation
- crew cards
- the roster dossier
- the action-input panel during autonomous turns

## Crew Generation And Dynamics

Crew generation is now bank-driven rather than preset-only.

- names, call signs, traits, flaws, specialties, and personal stakes come from reusable content banks
- rerolls avoid some obvious duplication
- rerolls can create built-in interpersonal tension patterns
- player-authored crews also get inferred crew dynamics based on their entered text

Those dynamics are written into character notes so the DM can use them later.

## Mission Seeds

The mission engine now supports scenario seeds.

Each mission seed includes:
- `id`
- `label`
- `summary`
- `tone`
- `decisionPressure`
- `suggestedOpening`
- `mission`
- `environment`
- `systems`
- `eventLog`

Current seeds include:
- `Apollo Echo`
- `Cryovent Whisper`
- `Buried Array`
- `Blackglass Breach`

Mission seeds are resolved against the selected crew before launch, so seeded text uses the actual roster names rather than assuming the default cast.

## Launch Sequence

Mission start now includes a dedicated launch transition between setup and play.

- theme-aware cinematic launch treatment
- stronger full-screen transition between character creation and gameplay
- explicit continue control at the end of the sequence
- reduced-motion and skip support

## Role Guidance And Action Suggestions

The action panel is now an actual tactical layer rather than a plain text box.

- each role gets a live tactical focus summary
- suggested action chips are generated from role and mission context
- role fit is previewed before submission
- mission-specific opportunity is previewed before submission

## Role Mechanics And Handoffs

Role differences now matter mechanically.

- command actions improve comms and stabilize the crew
- engineering actions recover the weakest system
- science actions improve scan confidence and support telemetry
- specialist actions recover EVA margin and reduce physical strain
- turns can open follow-through windows for another role
- stronger handoffs can reorder turn flow instead of always staying round-robin

## Crew Coordination

Crew relationships are now part of the running mission state.

- commander handoff strength depends on personality
- pair synergy can read as `trusted`, `standard`, or `tense`
- successful or failed follow-through changes that relationship over time
- the UI surfaces active handoffs, pair state, and top-level coordination alerts

## Mission-Specific Mechanics

Mission seeds now have bespoke local payoff rules, not just flavor.

- certain seeds reward specific roles more strongly
- mission leverage is previewed in the action panel
- aligned actions can trigger seed-specific boosts to systems, health, or role meters

## Event Log Instrumentation

The event log is now a lightweight system trace rather than plain narrative text.

Supported event types:
- `command`
- `system`
- `sensor`
- `trait`
- `risk`

The log renders each entry with a small typed badge and keeps recent entries capped.

## Trait Consequences

Traits and flaws are now part of the DM contract.

The prompt explicitly tells the DM to:
- treat personality as gameplay material
- let traits, flaws, specialties, stakes, and crew tension shape outcomes
- emit `trait` event-log entries when personality materially changes what happens

## Session And Save System

The app supports:
- a main menu
- save slots
- continue/load/delete flows
- in-game save
- autosave after resolved turns

Session state is written into:
- slot JSON save files
- `vault/dynamic/session-state.md`
- `vault/dynamic/log.md`

## Theme System

The interface supports multiple color themes:
- `Artemis`
- `Canopy`
- `Nocturne`

The theme system includes:
- light and dark variants for each family
- persistent theme selection
- themed status colors
- theme-aware UI surfaces
- theme-aware launch visuals
- restrained animated background atmosphere

## Live Console And Role Views

The console view is no longer static flavor text.

It now reflects:
- current MET
- mission/system pressure
- role-specific operational context
- current crew and anomaly state
- live coordination and handoff pressure

## Vault-Backed Prompt Context

Prompt assembly can draw from:
- mission lore
- active location files
- active crew files
- anomaly material
- dynamic session markdown
- dynamic overrides

This keeps the DM grounded in the current run without hardcoding all narrative context into one giant prompt.
