# Features

This document summarizes the major player-facing and system-facing features currently implemented in DungeonMAIster.

## Core Play Loop

- four rotating crew roles share one mission state
- each turn sends the active crew member, recent conversation history, full world state, and vault context to the DM
- the DM returns narration plus a partial `STATE_DELTA`
- the frontend merges the delta, updates the event log, advances mission elapsed time, advances the turn, and autosaves

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
- shared visual tokens
- persistent theme selection
- themed status colors
- theme-aware UI surfaces
- restrained animated background atmosphere

## Live Console And Role Views

The console view is no longer static flavor text.

It now reflects:
- current MET
- mission/system pressure
- role-specific operational context
- current crew and anomaly state

## Vault-Backed Prompt Context

Prompt assembly can draw from:
- mission lore
- active location files
- active crew files
- anomaly material
- dynamic session markdown
- dynamic overrides

This keeps the DM grounded in the current run without hardcoding all narrative context into one giant prompt.
