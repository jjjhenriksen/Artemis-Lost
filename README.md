# Artemis Lost

Artemis Lost is a full-stack sci-fi command game where an OpenAI-powered mission director reacts to a stranded lunar crew in crisis. Players assemble a crew, launch into the incident, and steer the story through role-based decisions, autonomous crew roles, evolving handoffs, and end-of-mission resolution.

The app now includes:
- a main menu with save-slot support
- player-first character creation for a four-role crew
- a launch sequence between setup and mission start
- human or autonomous control per crew role
- mission seed variation
- role-aware tactical suggestions and follow-through previews
- evolving crew coordination and handoff state
- win/loss resolution with distinct end screens
- durable save support through Postgres
- vault-backed prompt context
- structured state-delta updates from the DM

## Stack

- Frontend: React + Vite
- Backend: Express / Node server
- Model provider: OpenAI Responses API or Anthropic Claude Messages API
- Persistence: browser-scoped slot saves plus vault-backed session mirrors

## Run

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then fill in either OpenAI or Claude:

```bash
# OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini

# Or Claude
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=your_key_here
# ANTHROPIC_MODEL=claude-sonnet-4-6

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
npm install
npm test
```

If you see `ERR_REQUIRE_ESM` from `html-encoding-sniffer`, reinstall dependencies so `jsdom@25` is used (not `jsdom@29`).

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
# OpenAI
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini

# Or Claude
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-6
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
- `GET /api/health`: runtime status including `llmConfigured`, `llmProvider`, and active model

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
- Save slots are scoped per browser/user via a local player id, so deployed users do not share the same three slots.
- Dynamic session mirrors for prompt context still write to a configurable data root.
- If neither `DATABASE_URL` nor `DATA_DIR` is set, the app falls back to local `vault/dynamic/` behavior.
- Cheapest durable path: Neon Postgres via `DATABASE_URL`.

## Current Gameplay Flow

1. Choose a save slot from the main menu.
2. Create or load a mission.
3. Claim one crew role by entering the player name and callsign.
4. Generate the remaining crew around that player profile.
5. Review or reroll the mission seed and crew details.
6. Launch through the cinematic intro sequence.
7. Submit actions on human turns while autonomous roles auto-play theirs.
8. Use live tactical guidance, role-fit previews, and follow-through indicators to shape the next move.
9. The DM returns narration plus a partial `STATE_DELTA`.
10. The UI merges the update, applies local role and mission mechanics, resolves handoff-driven turn priority, updates the instrumented log, autosaves, and checks for mission resolution.

## Major Systems

- Character creation with player insert, reroll, lock, and crew-dynamic inference
- Bank-driven crew generation with featured faculty easter eggs and authored overrides
- Mission seeds with scenario-specific mission, environment, systems, and opening event logs
- Mission-specific mechanics with per-seed leverage windows
- Autonomous crew roles for underfilled games
- Role-specific tactical guidance and clickable action suggestions
- Role mechanics, handoff windows, delegation strength, and evolving crew coordination
- Initiative overrides driven by handoffs and crew fit
- Instrumented event log with `command`, `system`, `sensor`, `trait`, and `risk` tags
- OpenAI-backed DM turn resolution
- Mission outcome rules with victory and defeat resolution screens
- Save slots, per-user persistence isolation, and vault-backed session mirrors

## Project Structure

```txt
.
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── GAMEPLAY_LOOP.md
│   └── INDEX.md
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
│   │   ├── TelemetryBackdrop.jsx
│   │   └── TurnIndicator.jsx
│   ├── game/
│   │   ├── crewCoordination.js
│   │   ├── missionOutcome.js
│   │   ├── missionMechanics.js
│   │   ├── roleMechanics.js
│   │   ├── themes.js
│   │   ├── turnRuntime.js
│   │   └── worldState.js
│   ├── hooks/
│   │   └── useTypewriter.js
│   ├── screens/
│   │   ├── CharacterCreation.jsx
│   │   ├── LaunchSequence.jsx
│   │   ├── MainMenu.jsx
│   │   ├── MissionResolution.jsx
│   │   └── UI.jsx
│   ├── services/
│   │   ├── dmApi.js
│   │   └── sessionApi.js
│   ├── styles/
│   │   ├── interface.css
│   │   ├── motion.css
│   │   ├── responsive.css
│   │   ├── styles.css
│   │   └── tokens.css
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
