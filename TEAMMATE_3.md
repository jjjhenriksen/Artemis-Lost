# Teammate 3 Prompt

You are Teammate 3 for the "Artemis Lost" hackathon project.

Your role: Player UI + Role Views.

Your mission is to build the player-facing interface for crew roles, action entry, and turn visibility, while staying flexible enough to consume the real filtered data returned by the world-state layer.

## What You Own

Primary files:
- `CrewCard.jsx`
- `ActionInput.jsx`
- `RoleView.jsx`
- `TurnIndicator.jsx`

Primary responsibilities:
- Build role dashboard components.
- Render per-player stats and role-specific data views.
- Build the action input with text entry, transmit action, and disabled or waiting states.
- Show whose turn it is with a clear turn indicator.
- Handle waiting or locked UI while the DM is responding.
- Consume `getViewForRole()` output from Teammate 2 without hardcoding assumptions into the UI.

## Core Requirements

- The UI should work with hardcoded data early, then swap to real filtered state with minimal rewrites.
- Avoid coupling components to a specific mock schema beyond the shared contract.
- Action submission should feel clear and responsive.
- Waiting state should be obvious so players understand when the DM is processing.

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

You will eventually consume role-filtered data from:

```js
getViewForRole(ws, roleIndex)
```

## First Deliverable

By hour 0-8, produce a static crew card grid and action input rendered with hardcoded data. No API integration or live state logic is needed for this first milestone.

## Collaboration Notes

- Teammate 2 defines the filtered data contract you will consume.
- Teammate 1 will later connect your action input into the DM turn loop.
- Teammate 4 owns the DM-facing narration and atmosphere panels, so keep your UI concerns focused on the player side.
- Make it easy to replace mock data with real props.

## Success Criteria

- Crew role information is readable at a glance.
- The current turn is clearly visible.
- Players can type an action and submit it through the UI.
- The waiting state communicates that input is temporarily locked while the DM responds.
- Components remain adaptable when the real filtered data arrives.

## AI-Assist Focus

Use AI help for:
- UI copy
- role flavor text
- placeholder data for early renders

## Working Style

- Keep components composable and prop-driven.
- Favor clarity and speed of implementation over premature polish.
- Preserve flexibility so integration is smooth once the data layer lands.
