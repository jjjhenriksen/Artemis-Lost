# Gameplay Loop

This document describes the current end-to-end runtime flow for a mission turn.

## Mission Boot Flow

1. The app opens to the main menu.
2. The player creates or loads a mission from a save slot.
3. Character creation starts with a player insert: one chosen role, one typed name, and an optional callsign.
4. The remaining crew are generated around that player profile.
5. Each profile can then be assigned `Human` or `Autonomous`.
6. A mission seed is selected or rerolled.
7. The selected crew and mission seed are combined into a mission session.
8. The session is saved.
9. The launch sequence runs.
10. The in-mission UI boots from that state.

## Turn Flow

1. The current crew seat is selected from the active `turn` index.
2. The UI reads whether that role is human- or autonomously controlled.
3. On a human turn, the player enters an action manually.
4. On an autonomous turn, the client generates a role-aware action.
5. The action is immediately recorded as a `command` event-log entry.
6. The action is appended to recent conversation history.
7. The frontend sends this payload to `/api/turn`:
   - `worldState`
   - `action`
   - `activeCrew`
   - `conversationHistory`
   - `currentTurn`
8. The backend assembles the DM prompt with:
   - the selected crew and current world state
   - mission-seed context already embedded into `worldState`
   - vault static context
   - vault dynamic session context
9. The configured LLM provider (OpenAI or Anthropic) returns narration plus a `STATE_DELTA` block.
10. The backend extracts and normalizes the delta.
11. The frontend:
   - advances mission elapsed time
   - prepends the local command log entry
   - merges the returned delta
   - applies local role mechanics
   - applies local mission mechanics
   - evaluates mission outcome state
   - updates narration
   - appends the assistant response to conversation history
   - resolves initiative using follow-through and priority handoff rules
   - autosaves the session

## Local Turn Layers

After DM resolution, the client applies several deterministic layers locally:

1. role mechanics
2. support-window and relationship updates
3. mission-specific mechanics
4. mission outcome evaluation
5. follow-through turn targeting

This means some of the game feel now comes from local rules, not only from model narration.

## Data Sent To The Model

The model receives:
- the full live `worldState`
- the active crew member for the current turn
- recent conversation history
- the current turn index
- vault context assembled by the backend
- the current player or autonomous action

That means the model sees:
- the selected mission seed inside `worldState.mission`
- actual launched crew names and traits
- controller mode in crew character metadata
- current system pressure
- recent typed event-log history

## Data Returned By The Model

The server expects plain narration followed by a partial `STATE_DELTA`.

Typical delta shape:

```json
{
  "mission": { "phase": "Array intercept - unstable" },
  "systems": { "nav": 24, "comms": 41 },
  "crew": [{ "id": "reyes", "morale": 76 }],
  "eventLog": [
    {
      "ts": "T+18:08",
      "msg": "The reflector field rebounded the sweep into the rover's own nav stack.",
      "type": "risk"
    }
  ]
}
```

## Event Log Contract

Recent event-log entries are treated as a lightweight system trace.

Allowed event types:
- `command`
- `system`
- `sensor`
- `trait`
- `risk`

The frontend shows each entry with a typed badge. The backend prompt explicitly encourages:
- `trait` entries when personality changes the result
- `risk` entries when instability or downside increases

## Mission Clock

- mission elapsed time lives in `worldState.mission.met`
- the frontend advances it once per resolved turn
- this applies to both successful turns and failed DM requests

## Turn Order

- base turn order is round-robin
- commander-directed priority handoffs can immediately push initiative
- strong follow-through windows also jump turn order
- soft windows can also jump when the pair is not currently tense
- fragile windows fall back to standard round-robin

## Error Path

If the DM request fails:
- the human or bot action is still recorded
- mission elapsed time still advances
- the turn still advances
- the session still saves
- the narration panel shows the error state

This keeps the prototype playable even when the DM service is temporarily unavailable.

## Persistence Flow

After each resolved turn, the session is written to:
- the active browser-scoped slot record
- `vault/dynamic/session-state.md`
- `vault/dynamic/log.md`

If `DATABASE_URL` is configured, the canonical slot record is stored in Postgres. Otherwise it falls back to local storage. In both cases, the vault mirrors still support reload recovery and future prompt context.
