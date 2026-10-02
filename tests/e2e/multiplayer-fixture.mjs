// Explicit test-only executable. Production createApp never selects a fixture
// narrator via an environment flag. This server binds loopback and fictional data.
import { appendFile } from "node:fs/promises";
import { createApp } from "../../server/dmServer.mjs";
import { createFileRoomRepository } from "../../server/multiplayerRepository.js";

if (!process.env.ARTEMIS_FIXTURE_DIRECTORY) throw new Error("An isolated fixture directory is required.");
const directory = process.env.ARTEMIS_FIXTURE_DIRECTORY;
const app = createApp({
  multiplayerRepository: createFileRoomRepository({ directory }),
  multiplayerRequestTurn: async ({ action }) => {
    await appendFile(`${directory}/provider-calls.ndjson`, JSON.stringify({ action }) + "\n");
    // Expose the difference between an invoked provider and a committed turn.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { narration: "Fixture mission control acknowledges the crew. All players see this shared turn.", stateDelta: {} };
  },
});
const server = app.listen(Number(process.env.ARTEMIS_FIXTURE_PORT || 0), "127.0.0.1", () => {
  console.log(JSON.stringify({ fixtureUrl: `http://127.0.0.1:${server.address().port}` }));
});
process.once("SIGTERM", () => server.close(() => process.exit(0)));
