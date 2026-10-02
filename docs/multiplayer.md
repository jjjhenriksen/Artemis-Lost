# Private co-op missions

Choose **Play co-op** from the menu. Create a private room, choose a display name
and crew seat, then share the room ID and invitation code with your friends.
They choose **Join a room** and an available seat. The host starts the shared
mission. Commander, Flight Engineer, Science Officer and Mission Specialist
are exclusive seats; unclaimed seats use AI. Observers can follow the mission
and participate in crew chat. A room supports four crew players and up to
16 members including observers.

Each player receives their own role console. Only the player holding the
current human seat can submit its action. Any member can explicitly advance
an unclaimed AI seat. Existing role follow-through rules can change the next
seat, so follow the current-turn indicator. A resolved mission remains available
for the party to read and discuss.

The party deliberately shares narration, mission state and chat. This release
has no secret per-seat clues. Other rooms, solo save files and solo vault
session overrides are excluded from co-op narration and room snapshots.

## Reconnect and invitations

Your browser stores a private membership key locally. Refreshing or restarting
the server restores your seat and shared mission when that key remains available.
Keep invitation codes private. Membership keys are never placed in URLs or
rendered in the page. Clearing browser storage loses your membership key;
this release does not provide account recovery or transfer a claimed seat to
another device. Browser storage failure allows the current tab to continue,
but closing that tab loses its key.

If an action's response is lost, use **Retry last command**. The command ID
and original revision persist across reloads. The server replays an acknowledged
command without another provider call or mission advance. It retains the latest
256 receipts; older revisions still cannot advance as stale commands. A rejected
stale/forbidden command refreshes state so you can decide your next action.

Leaving revokes the membership key and returns that seat to AI. If the host
leaves, ownership transfers to the next member. The last member leaving closes
the room; its saved record is retained and invitations cannot reopen it.

## Storage and deployment

Use **one server process** for authoritative turn execution. Requests to the same
room serialize in that process. Durable revision checks prevent two processes
from committing competing updates, but multiple processes could call the paid
narrator before one loses that conflict. Clustered execution needs database-backed
coordination before scaling this feature.

`DATABASE_URL` selects PostgreSQL storage. Otherwise records live under
`MULTIPLAYER_STORAGE_DIR`, or `vault/dynamic/multiplayer` beneath the configured
`DATA_DIR`/persistent root. Local development data is ignored by Git. Use durable
storage and HTTPS in deployment; bearer membership and invitation credentials
must travel over a protected connection. Back up the dedicated room directory
or the PostgreSQL `multiplayer_rooms` table according to your hosting policy.

File writes use atomic replacement and exclusive locks with revision checks.
Corrupt records remain untouched and report an error instead of becoming new
missions. After a writer crash, an orphaned `UUID.json.lock` fails safely. Confirm
that the relevant writer is stopped, preserve the original record, and inspect
that room before removing only its orphaned lock. The application never steals
locks or silently overwrites corrupt saves.

Create/join requests are limited to 30 per minute per source IP; mutations to 120.
Limits are process-local and forwarding headers are not trusted. A proxy or
clustered deployment should install a shared limiter with explicitly configured
trusted proxies. Polling snapshots once per second does not invoke a model.
Action/provider work has a 30-second deadline and aborts the network request on
timeout. Provider failures do not acknowledge a changed mission.

## API contract

All routes are under `/api/multiplayer`. Creation and joining return credentials
once. All remaining operations require `Authorization: Bearer <membership-key>`.
Do not use the solo `x-player-id` header as multiplayer authentication.

| Method | Route | JSON fields |
| --- | --- | --- |
| POST | `/rooms` | name, seatId, optional seedId |
| POST | `/rooms/:id/join` | inviteCode, name, seatId |
| GET | `/rooms/:id` | — |
| POST | `/rooms/:id/seat` | seatId (null for observer) |
| POST | `/rooms/:id/start` | {} |
| POST | `/rooms/:id/leave` | {} |
| POST | `/rooms/:id/chat` | text |
| POST | `/rooms/:id/actions` | commandId, expectedRevision, action, optional bot |

Seat IDs are `vasquez`, `okafor`, `reyes`, `park`. Bot commands use `bot:true`
and omit action text or send an empty string; the server chooses their action.
Snapshots return `{room}` with shared session/messages/roster, revision and the
caller's `me` seat. Creation/join additionally return memberId/token; creation
also returns inviteCode. Unsupported fields, including supplied world state,
are rejected. Error responses are bounded JSON with a code and no-store headers.

## Repeatable proof

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:multiplayer:e2e
```

For real database regression checks, set `ARTEMIS_TEST_DATABASE_URL` to a dedicated
test database. Tests create isolated schemas. Never point it at production.
GitHub Actions supplies PostgreSQL 17 and runs both regression and browser checks.

The browser harness starts an owned loopback server with a fictional narrator
and temporary storage, uses two isolated browser contexts, deliberately drops
an already-committed response, verifies exactly-once replay, exercises human/AI
turns and chat, restarts the fixture process, and verifies stored identity,
mission and replay receipts. It also checks another room's denied access,
revocation after leave, own-seat consoles, 320px overflow, keyboard focus,
reduced-motion mode and automated WCAG A/AA checks on the entry, lobby, active and resolved
co-op screens.
Screenshots and machine-readable proof are retained in `output/playwright`;
GitHub Actions uploads that directory for seven days.

This proves the real UI/HTTP/storage flow using isolated fictional data. It does
not establish a live paid-provider game, deployment, Safari support or Internet
latency behavior. The fixture narrator is injected in a separate test executable
and cannot be enabled by a production environment switch.
