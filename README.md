# DungeonMAIster

DungeonMAIster is a lightweight prototype for "Artemis Lost," a turn-based sci-fi roleplaying experience where a language model acts as the dungeon master for a stranded lunar mission.

The current app is a React + Vite frontend with a small Express development server that proxies requests to Anthropic. A player submits an action, the DM responds with narration plus a structured state delta, and the UI applies those changes to the shared mission state.

## Current Stack

- Frontend: React + Vite
- Backend: Express dev server
- Model provider: Anthropic API
- State model: in-memory world state with delta-based updates

## Project Structure

```txt
.
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GAMEPLAY_LOOP.md
│   ├── INDEX.md
│   └── team/
├── server/
│   └── dmServer.mjs
├── src/
│   ├── App.jsx
│   ├── ActionInput.jsx
│   ├── CrewCard.jsx
│   ├── CrewStatusBar.jsx
│   ├── EventLog.jsx
│   ├── NarrationPanel.jsx
│   ├── RoleView.jsx
│   ├── TurnIndicator.jsx
│   ├── UI.jsx
│   ├── applyStateDelta.js
│   ├── dmApi.js
│   ├── roleFilters.js
│   ├── sessionApi.js
│   ├── styles.css
│   ├── useTypewriter.js
│   └── worldState.js
├── vault/
│   ├── dynamic/
│   └── static/
├── index.html
├── package.json
└── vite.config.js
```

## Getting Started

### Development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with your Anthropic credentials:

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
DM_API_PORT=8787
```

3. Start the app:

```bash
npm run dev
```

What this does:
- starts the Vite frontend
- starts the local DM API server at `localhost:8787`
- proxies frontend `/api` requests to the local DM server

### Build And Preview

To test the production build locally:

```bash
npm run build
npm run preview
```

Then open the preview URL printed by Vite in your terminal.

### Opening The Built HTML Directly

The build now uses relative asset paths, so [dist/index.html](/Users/jacquelinehenriksen/DungeonMAIster/dist/index.html) can be opened directly to inspect the UI shell.

However, direct file opening is only suitable for static UI viewing. DM turn requests to `/api/turn` still require a running server setup, so interactive gameplay should be tested with:

```bash
npm run dev
```

or:

```bash
npm run preview
```

with the DM API server running.

## How It Works

1. The frontend renders a seeded mission state and a role-based UI.
2. A player enters an action for the active crew member.
3. The frontend includes recent conversation history and the current turn index when posting to `/api/turn`.
4. The Express server calls Anthropic with a structured system prompt.
5. The server enriches the prompt with vault content and validates the model output.
6. The model returns JSON containing:
   - `narration`
   - `stateDelta`
7. The frontend merges `stateDelta` into the current world state, advances the turn, and persists the updated session.

## Documentation

- Overview and navigation: [docs/INDEX.md](/Users/jacquelinehenriksen/DungeonMAIster/docs/INDEX.md)
- Architecture notes: [docs/ARCHITECTURE.md](/Users/jacquelinehenriksen/DungeonMAIster/docs/ARCHITECTURE.md)
- Turn loop and data flow: [docs/GAMEPLAY_LOOP.md](/Users/jacquelinehenriksen/DungeonMAIster/docs/GAMEPLAY_LOOP.md)
- Team planning docs: [docs/team/TEAM_RESPONSIBILITIES.md](/Users/jacquelinehenriksen/DungeonMAIster/docs/team/TEAM_RESPONSIBILITIES.md)

## Current Status

The prototype already includes:
- a seeded mission world state
- role-specific UI panels
- DM narration rendering
- event log updates
- state-delta application
- Anthropic-backed turn requests through a local server
- conversation history passed through the DM loop
- vault-backed session persistence in `vault/dynamic`
- prompt context assembled from `vault/static`
- centralized shared UI styling in `src/styles.css`

The next natural improvements are:
- adding a visible "reset session" control in the UI
- surfacing session save/load status to the player
- expanding vault-driven prompt assembly with more scene-aware file selection

## Notes

The current implementation keeps most gameplay logic in [src/UI.jsx](/Users/jacquelinehenriksen/DungeonMAIster/src/UI.jsx), which makes iteration fast but leaves room for cleanup as the prototype grows.
