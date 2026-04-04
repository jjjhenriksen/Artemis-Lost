# Artemis Lost — Team Responsibilities

Hackathon duration: 48 hours. Stack: React + Vite, Anthropic API, Obsidian markdown vault.

---

## Teammate 1 — (AI Engine + Integration Lead)

**Primary files:** `api.js`, `gameLoop.js`, `prompts.js`

### Responsibilities
- Anthropic API wrapper — single function that takes world state + player action + conversation history and returns narration + state delta
- DM system prompt design — persona, tone, STATE_DELTA instruction, role injection
- STATE_DELTA extraction — parse the LLM response and hand structured changes to Teammate 2's merger function
- Turn manager — `currentTurn` cycling logic, game loop orchestration
- Glue layer — wires all four workstreams together at integration point
- Prompt testing — iterate on DM voice and consistency using AI-assisted generation

### Hour 0–8 deliverable
A working API call that takes a hardcoded action and returns a narration string. No UI needed yet.

### AI-assist focus
Opening scenario lore, DM persona copy, prompt refinement.

---

## Teammate 2 — World State + Data Layer

**Primary files:** `worldState.js`, `roleFilters.js`, `deltaParser.js`, `vault/`

### Responsibilities
- World state JSON schema — the canonical `ws` object structure (crew, systems, mission, environment, eventLog)
- Role filter functions — `getViewForRole(ws, roleIndex)` returning the filtered data each player sees
- State delta parser + merger — takes the `STATE_DELTA` block from the DM response and applies it cleanly to world state
- Obsidian vault seed data — writes the static markdown files (locations, crew profiles, mission brief) the DM prompt assembler reads from
- `session-state.md` schema — defines the dynamic file structure written each turn
- Critical change override files — `npc-override.md`, `location-delta.md` conventions

### Hour 0–8 deliverable
A complete `INITIAL_WORLD_STATE` object and working `getViewForRole()` function Teammate 3 can build against immediately.

### AI-assist focus
NPC profiles, location descriptions, anomaly lore, seed data population.

---

## Teammate 3 — Player UI + Role Views

**Primary files:** `CrewCard.jsx`, `ActionInput.jsx`, `RoleView.jsx`, `TurnIndicator.jsx`

### Responsibilities
- Role dashboard components — per-player stat bars, role view data display
- Action input — text field, Transmit button, disabled/waiting state
- Turn indicator — active turn badge, whose-turn-is-it display
- Waiting state — locked UI with visual feedback while DM is responding
- Consuming `getViewForRole()` — renders whatever Teammate 2's filter returns, no hardcoding

### Hour 0–8 deliverable
Static crew card grid and action input that renders with hardcoded data — no API or state logic needed yet.

### AI-assist focus
UI copy, role flavor text, placeholder data for early renders.

---

## Teammate 4 — DM Display + Atmosphere

**Primary files:** `NarrationPanel.jsx`, `EventLog.jsx`, `CrewStatusBar.jsx`, `useTypewriter.js`

### Responsibilities
- DM narration panel — the main left-side story display
- Typewriter / streaming effect — `useTypewriter` hook, cursor blink animation
- Event log — append-only turn history, timestamped, scrollable
- Header status bar — MET clock, O2, power, comms pulled from world state
- Visual atmosphere — monospace font, color palette, terminal aesthetic, CSS animations
- Crew overview bar — compact system-wide status readable at a glance

### Hour 0–8 deliverable
A `NarrationPanel` that accepts a text prop and renders it with the typewriter effect. Static event log with hardcoded entries.

### AI-assist focus
Atmospheric copy, event log flavor entries, CSS theming and animation polish.

---

## Shared Contracts (agree on these at Hour 0)

### World state shape
```js
{
  mission:     { id, name, phase, met, objectives },
  environment: { location, hazards, anomaly },
  systems:     { o2, power, comms, propulsion, scrubber },
  crew:        [{ id, name, role, health, morale, extra }],
  eventLog:    [{ ts, msg, type }],
}
```

### STATE_DELTA format (returned by DM at end of response)
```
STATE_DELTA:
{
  "systems": { "o2": 68 },
  "crew": [{ "id": "park", "health": 70 }],
  "eventLog": [{ "ts": "T+14:30", "msg": "Park suited up for EVA", "type": "action" }]
}
```

### Obsidian vault structure
```
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
    overrides/          ← critical changes only
```

---

## Timeline

| Milestone | Hour | Goal |
|---|---|---|
| Kickoff + contracts agreed | 0 | World state schema locked, vault structure decided |
| Parallel build | 0–8 | Each teammate has a working stub for their deliverable |
| First integration | 8 | API call works end-to-end with stub UI |
| Loop closes | 24 | Action → DM → state update → turn advance — ugly but working |
| First full playtest | 26 | All four roles, real narration, real state changes |
| Polish + bug fix | 36 | Typewriter, animations, role views, event log all solid |
| Demo prep | 44 | Rehearse the opening scenario, fix anything that breaks live |
| Submission | 48 | Ship it |

---

## Integration Checklist (Hour 24 gate)

- [ ] Player can type an action and hit Transmit
- [ ] Anthropic API call fires with world state + action
- [ ] DM returns narration and STATE_DELTA
- [ ] State delta applied to world state
- [ ] Narration appears in DM panel with typewriter effect
- [ ] Event log updates
- [ ] Turn advances to next crew member
- [ ] Role view updates to show new active player's data

If all eight boxes are checked at hour 24, you're on track. Everything after is polish.