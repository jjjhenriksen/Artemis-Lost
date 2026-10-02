import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { createMissionSession } from "../../src/game/worldState.js";

const target = process.env.INTERRUPT_TARGET;
const originalOpen = fs.open;
const originalWriteFile = fs.writeFile;
async function checkpoint() {
  process.send({ partialWritten: true });
  process.on("message", () => {});
  await new Promise(() => {});
}

// Intercept after real partial bytes reach disk, then let the parent SIGKILL.
// Both direct writes (the regression) and temporary writes take this path.
fs.writeFile = async (file, content, options) => {
  if (file === target) {
    await originalWriteFile(file, String(content).slice(0, 12), options);
    await checkpoint();
  }
  return originalWriteFile(file, content, options);
};
fs.open = async (file, ...args) => {
  const handle = await originalOpen(file, ...args);
  if (String(file).startsWith(`${target}.`) && String(file).endsWith(".tmp")) {
    const write = handle.writeFile.bind(handle);
    handle.writeFile = async (content, options) => {
      await write(String(content).slice(0, 12), options);
      await handle.sync();
      await checkpoint();
    };
  }
  return handle;
};
syncBuiltinESMExports();

const { createSessionStorageAdapter } = await import("../../server/sessionStorageAdapter.js");
const slots = [1, 2, 3].map((n) => ({ id: `slot-${n}`, label: `Slot ${n}` }));
const adapter = createSessionStorageAdapter(slots);
await adapter.ensurePaths();
await adapter.saveSession("slot-1", {
  ...createMissionSession(), narration: "Interrupted replacement", lastUpdatedIso: "2026-02-01T00:00:00.000Z",
}, "player");
throw new Error("Expected an interrupted write");
