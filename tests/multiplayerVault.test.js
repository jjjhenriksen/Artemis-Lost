// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile }));
import { loadVaultContext, formatVaultContext } from "../server/vault.js";
import { dynamicVaultRoot, staticVaultRoot } from "../server/storagePaths.js";

beforeEach(() => {
  readFile.mockReset();
  readFile.mockImplementation(async (file) => String(file).startsWith(dynamicVaultRoot)
    ? "ANOTHER_PLAYER_PRIVATE_SESSION_MARKER" : "Fictional static lore");
});
const input = { worldState: { environment: { location: "South Rim Vent Shelf" } }, activeCrew: { id: "vasquez" } };

describe("shared room vault isolation", () => {
  test("reads only static lore and never singleton solo state, log or overrides", async () => {
    const context = await loadVaultContext({ ...input, sharedRoom: true });
    expect(readFile).toHaveBeenCalledTimes(4);
    expect(readFile.mock.calls.every(([file]) => String(file).startsWith(staticVaultRoot))).toBe(true);
    expect(formatVaultContext(context)).toContain("Fictional static lore");
    expect(formatVaultContext(context)).not.toContain("ANOTHER_PLAYER_PRIVATE_SESSION_MARKER");
    for (const key of ["sessionState", "log", "npcOverride", "locationDelta"]) expect(context[key]).toBeUndefined();
  });
  test("existing solo path still loads its dynamic vault context", async () => {
    const context = await loadVaultContext(input);
    expect(readFile).toHaveBeenCalledTimes(8);
    expect(context.sessionState).toBe("ANOTHER_PLAYER_PRIVATE_SESSION_MARKER");
    expect(context.npcOverride).toBe("ANOTHER_PLAYER_PRIVATE_SESSION_MARKER");
  });
});
