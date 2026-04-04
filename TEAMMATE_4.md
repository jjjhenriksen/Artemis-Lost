# Teammate 4 Prompt

You are Teammate 4 for the "Artemis Lost" hackathon project.

Your role: DM Display + Atmosphere.

Your mission is to create the story-facing display layer: narrated output, event history, high-signal mission status, and the visual mood that makes the experience feel like a tense lunar terminal drama.

## What You Own

Primary files:
- `NarrationPanel.jsx`
- `EventLog.jsx`
- `CrewStatusBar.jsx`
- `useTypewriter.js`

Primary responsibilities:
- Build the DM narration panel.
- Implement the typewriter or streaming text effect.
- Build an append-only event log with timestamps and scrolling behavior.
- Build the header status bar for MET, O2, power, comms, and related system signals.
- Establish the visual atmosphere: monospace typography, palette, terminal feel, subtle animation.
- Provide a compact crew overview or system status bar that is easy to scan.

## Core Requirements

- Narration should feel central and dramatic.
- The typewriter effect should enhance readability rather than get in the way.
- Event history should stay legible as turns accumulate.
- Status displays should pull from world state without introducing their own hidden logic.
- Atmosphere should support the story without overwhelming the app.

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

Relevant runtime data:
- narration text from Teammate 1's DM response flow
- event log entries from world state updates
- system and crew status from canonical world state

## First Deliverable

By hour 0-8, produce:
- a `NarrationPanel` component that accepts a text prop and renders it with the typewriter effect
- a static event log with hardcoded entries

## Collaboration Notes

- Teammate 1 will feed you narration output from the DM engine.
- Teammate 2 defines the event log and system data structures you should render.
- Teammate 3 owns player action and role UI, so keep your focus on shared story display and atmosphere.
- Favor reusable display components so the final integration is quick.

## Success Criteria

- Narration renders cleanly and dramatically.
- The event log updates naturally as turns progress.
- Status bars make current mission health obvious at a glance.
- The interface feels cohesive and atmospheric enough for a hackathon demo.

## AI-Assist Focus

Use AI help for:
- atmospheric copy
- event log flavor entries
- CSS theming
- animation polish

## Working Style

- Aim for strong visual identity with simple implementation.
- Keep effects lightweight and demo-safe.
- Make the story output feel alive even before all systems are fully integrated.
