# Gameplay Loop

This document describes the current end-to-end turn flow in the prototype.

## Turn Flow

1. The frontend loads with a seeded `INITIAL_WORLD_STATE`.
2. The active crew member is selected from the current `turn` index.
3. The UI renders a role-specific dashboard using `getViewForRole(ws, turn)`.
4. The player types an action and submits it.
5. The frontend adds the player action to the local event log.
6. The frontend appends the move to recent conversation history.
7. The frontend sends `worldState`, `action`, `activeCrew`, `conversationHistory`, and `currentTurn` to the DM API.
8. The backend adds vault context and sends that prompt to Anthropic using a strict JSON contract.
9. The model returns:
   - `narration`
   - `stateDelta`
10. The backend validates and sanitizes the returned delta shape.
11. The frontend merges the delta into local state.
12. The UI updates the narration panel, system data, and event log.
13. The turn advances to the next crew member.
14. The current session is written to `vault/dynamic`.

## Data Sent To The Model

The request payload includes:
- the full current world state
- the active crew member
- the player action for the current turn
- recent conversation history
- the current turn index

This gives the model enough context to narrate the result and suggest structured updates.

## Data Returned By The Model

The server expects the model to return JSON with:

```json
{
  "narration": "Narrative text shown to the players",
  "stateDelta": {
    "systems": { "o2": 68 },
    "crew": [{ "id": "park", "health": 70 }],
    "eventLog": [
      {
        "ts": "T+14:30",
        "msg": "Park suited up for EVA",
        "type": "action"
      }
    ]
  }
}
```

## Error Handling

If the DM request fails:
- the frontend shows an error message in the narration area
- the player's action is still added to the event log
- the turn still advances
- the session still persists so the failed turn is visible after refresh

That behavior keeps the prototype moving, though later you may want a retry path or a failed-turn state instead.

## Current Strengths

- Fast to iterate on during prototyping
- Clear action to response loop
- Structured delta updates make state changes easier to reason about
- Works well for incremental polishing of narration and atmosphere
- Session state survives reloads through the local session store
- Vault markdown can now influence the DM prompt

## Current Risks

- The model still controls a meaningful amount of update structure
- Failed responses currently advance the turn, which may or may not be desired long term
- Prompt assembly currently loads broad vault context rather than selecting only the most relevant documents
