# DungeonMAIster

DungeonMAIster is a full-stack prototype for "Artemis Lost," a turn-based sci-fi mission simulator where an OpenAI model acts as the dungeon master for a stranded lunar crew.

The app now includes:
- a main menu with save-slot support
- full character creation for a four-role crew
- a launch sequence between setup and mission start
- human or autonomous control per crew role
- mission seed variation
- light/dark theme switching plus theme families
- role-aware tactical suggestions and follow-through previews
- evolving crew coordination and handoff state
- vault-backed prompt context
- structured state-delta updates from the DM

## Stack

- Frontend: React + Vite
- Backend: Express dev server
- Model provider: OpenAI Responses API
- Persistence: slot saves plus vault-backed session mirrors

## Run

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then fill in:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
DM_API_PORT=8787
```

Start development:

```bash
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run the production server locally:

```bash
npm run build
npm start
```

The production server serves both the built frontend and the `/api` routes from one Node process.

## Deploy

The repo is now set up for single-service deployment on hosts like Render or Railway.

Required environment variables:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Optional persistent storage variable:

```bash
DATA_DIR=/var/data/dungeonmaister
```

Optional durable database variable:

```bash
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

Operational endpoints:

- `GET /healthz`: deployment health probe for the combined app
- `GET /api/health`: runtime status including whether OpenAI is configured

Render path:

1. Create a new `Web Service` from this repo.
2. Use the included `render.yaml`, or set:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Health check path: `/healthz`
3. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
4. For durable saves, either:
   - set `DATABASE_URL` to a Neon/Postgres instance, or
   - mount a persistent disk and set `DATA_DIR` to a folder on that disk.

Deployment note:

- Static lore continues to load from the repository under `vault/static/`.
- With `DATABASE_URL` set, save slots are stored durably in Postgres.
- Dynamic session mirrors for prompt context still write to a configurable data root.
- If neither `DATABASE_URL` nor `DATA_DIR` is set, the app falls back to local `vault/dynamic/` behavior.
- Cheapest durable path: Neon Postgres via `DATABASE_URL`.

## Current Gameplay Flow

1. Choose a save slot from the main menu.
2. Create or load a mission.
3. Configure the crew, including `Human` or `Autonomous` per role.
4. Pick or reroll a mission seed.
5. Launch through the cinematic intro sequence.
6. Submit actions on human turns while autonomous roles auto-play theirs.
7. Use live tactical guidance, role-fit previews, and follow-through indicators to shape the next move.
8. The DM returns narration plus a partial `STATE_DELTA`.
9. The UI merges the update, applies local role and mission mechanics, resolves handoff-driven turn priority, updates the instrumented log, and autosaves.

## Major Systems

- Character creation with reroll, lock, and crew-dynamic inference
- Bank-driven crew generation with authored defaults
- Mission seeds with scenario-specific mission, environment, systems, and opening event logs
- Mission-specific mechanics with per-seed leverage windows
- Autonomous crew roles for underfilled games
- Role-specific tactical guidance and clickable action suggestions
- Role mechanics, handoff windows, delegation strength, and evolving crew coordination
- Instrumented event log with `command`, `system`, `sensor`, `trait`, and `risk` tags
- OpenAI-backed DM turn resolution
- Save slots and vault-backed session mirrors
- Theme system with persistent selection, light/dark variants, and themed launch treatment

## Project Structure

```txt
.
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── GAMEPLAY_LOOP.md
│   ├── INDEX.md
│   └── PROJECT_JOURNAL.md
├── server/
│   ├── api.js
│   ├── dmServer.mjs
│   ├── prompts.js
│   ├── sessionMirrors.js
│   ├── sessionStorageAdapter.js
│   ├── sessionStore.js
│   ├── storagePaths.js
│   └── vault.js
├── src/
│   ├── app/
│   │   └── App.jsx
│   ├── components/
│   │   ├── ActionInput.jsx
│   │   ├── CrewCard.jsx
│   │   ├── CrewStatusBar.jsx
│   │   ├── EventLog.jsx
│   │   ├── NarrationPanel.jsx
│   │   ├── RoleView.jsx
│   │   ├── RosterSummary.jsx
│   │   ├── ThemePicker.jsx
│   │   └── TurnIndicator.jsx
│   ├── game/
│   │   ├── crewCoordination.js
│   │   ├── missionMechanics.js
│   │   ├── roleMechanics.js
│   │   ├── themes.js
│   │   └── worldState.js
│   ├── hooks/
│   │   └── useTypewriter.js
│   ├── screens/
│   │   ├── CharacterCreation.jsx
│   │   ├── LaunchSequence.jsx
│   │   ├── MainMenu.jsx
│   │   └── UI.jsx
│   ├── services/
│   │   ├── dmApi.js
│   │   └── sessionApi.js
│   ├── styles/
│   │   └── styles.css
│   └── main.jsx
├── vault/
│   ├── dynamic/
│   └── static/
├── tests/
└── README.md
```

## Docs

- Overview: [docs/INDEX.md](docs/INDEX.md)
- Features: [docs/FEATURES.md](docs/FEATURES.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Gameplay loop: [docs/GAMEPLAY_LOOP.md](docs/GAMEPLAY_LOOP.md)
- Project journal: [docs/PROJECT_JOURNAL.md](docs/PROJECT_JOURNAL.md)
