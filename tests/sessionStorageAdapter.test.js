// @vitest-environment node
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMissionSession } from "../src/game/worldState.js";
import { getPortableSlotRelativePath, getPortableOwnerRelativePath } from "../server/sessionFilePaths.js";

const slots = [1, 2, 3].map((n) => ({ id: `slot-${n}`, label: `Slot ${n}` }));
let root;
let adapter;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "artemis-adapter-"));
  vi.stubEnv("DATA_DIR", root);
  vi.stubEnv("DATABASE_URL", "");
  vi.resetModules();
  const { createSessionStorageAdapter } = await import("../server/sessionStorageAdapter.js");
  adapter = createSessionStorageAdapter(slots);
  await adapter.ensurePaths();
  await mkdir(path.dirname(slotPath()), { recursive: true });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
const payload = () => ({ ...createMissionSession(), lastUpdatedIso: new Date().toISOString() });
const slotPath = () => path.join(root, "vault/dynamic/slots", getPortableSlotRelativePath("player", "slot-1"));
const legacySlotPath = () => path.join(root, "vault/dynamic/slots/player:slot-1.json");
const indexPath = () => path.join(root, "vault/dynamic/slots", getPortableOwnerRelativePath("player"), "index.json");
const legacyIndexPath = () => path.join(root, "vault/dynamic/slots/player-index.json");

test("only a missing save is an empty slot", async () => {
  expect(await adapter.loadSession("slot-1", "player")).toBeNull();
});

test.each(["{ broken", "null", "{}"])("reports malformed save %s and retains its bytes", async (content) => {
  await writeFile(slotPath(), content);
  await expect(adapter.loadSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  await expect(adapter.listSessions("player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  expect(await readFile(slotPath(), "utf8")).toBe(content);
});

test("reports an unreadable save separately from absence", async () => {
  // A directory gives a real, portable EISDIR without relying on user privileges.
  await mkdir(slotPath());
  await expect(adapter.loadSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_IO_ERROR" });
});

test("serializes concurrent owner saves without losing either timestamp", async () => {
  const first = { ...payload(), lastUpdatedIso: "2026-01-01T00:00:00.000Z" };
  const second = { ...payload(), lastUpdatedIso: "2026-01-02T00:00:00.000Z" };
  await Promise.all([
    adapter.saveSession("slot-1", first, "player"),
    adapter.saveSession("slot-2", second, "player"),
  ]);
  const index = JSON.parse(await readFile(indexPath(), "utf8"));
  expect(index.slots.slice(0, 2).map((slot) => slot.lastUpdatedIso)).toEqual([first.lastUpdatedIso, second.lastUpdatedIso]);
});

test("rejects a corrupt owner index before replacing a saved slot", async () => {
  const saved = payload();
  await adapter.saveSession("slot-1", saved, "player");
  const bytes = await readFile(slotPath(), "utf8");
  await writeFile(indexPath(), "broken");
  await expect(adapter.saveSession("slot-1", payload(), "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  expect(await readFile(slotPath(), "utf8")).toBe(bytes);
  await expect(adapter.deleteSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  expect(await readFile(slotPath(), "utf8")).toBe(bytes);
});

test.each(["slot", "index"])("SIGKILL during %s writing preserves the previous complete file", async (kind) => {
  const { fork } = await import("node:child_process");
  const { once } = await import("node:events");
  await adapter.saveSession("slot-1", payload(), "player");
  const target = kind === "slot" ? slotPath() : indexPath();
  const previous = await readFile(target, "utf8");
  const child = fork(new URL("./helpers/interruptedSave.mjs", import.meta.url), {
    env: { ...process.env, DATA_DIR: root, DATABASE_URL: "", INTERRUPT_TARGET: target },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr.on("data", (data) => { stderr += data; });
  try {
    const checkpoint = await Promise.race([
      once(child, "message").then(([message]) => message),
      once(child, "exit").then(() => { throw new Error(`Writer exited before interruption: ${stderr}`); }),
    ]);
    expect(checkpoint.partialWritten).toBe(true);
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    expect((await exited)[1]).toBe("SIGKILL");
    expect(await readFile(target, "utf8")).toBe(previous);
    expect(() => JSON.parse(previous)).not.toThrow();
    expect((await adapter.loadSession("slot-1", "player")).session).toBeTruthy();
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
});

test("reports permission denial with a safe actionable message", async () => {
  vi.resetModules();
  vi.doMock("node:fs/promises", async (importOriginal) => {
    const fs = await importOriginal();
    return { ...fs, readFile: async (file, ...args) => {
      if (file === slotPath()) throw Object.assign(new Error(`EACCES private path ${file}`), { code: "EACCES" });
      return fs.readFile(file, ...args);
    } };
  });
  try {
    const { createSessionStorageAdapter } = await import("../server/sessionStorageAdapter.js");
    const unreadable = createSessionStorageAdapter(slots);
    await expect(unreadable.loadSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_IO_ERROR" });
    try {
      await unreadable.loadSession("slot-1", "player");
    } catch (error) {
      expect(error.message).toMatch(/permissions/);
      expect(error.message).not.toContain(root);
    }
  } finally {
    vi.doUnmock("node:fs/promises");
  }
});


test("filesystem parity: loading an older slot updates listing and subsequent default load", async () => {
  await adapter.saveSession("slot-1", { ...payload(), narration: "Older" }, "player");
  await adapter.saveSession("slot-2", { ...payload(), narration: "Newer" }, "player");
  await adapter.saveSession("slot-2", { ...payload(), narration: "Other player" }, "other-player");
  expect((await adapter.loadSession("slot-1", "player")).session.narration).toBe("Older");
  expect((await adapter.listSessions("player")).activeSlotId).toBe("slot-1");
  expect(await adapter.loadSession(undefined, "player")).toMatchObject({ slotId: "slot-1", session: { narration: "Older" } });
  expect((await adapter.listSessions("other-player")).activeSlotId).toBe("slot-2");
  expect(await adapter.loadSession("slot-3", "player")).toBeNull();
  expect((await adapter.listSessions("player")).activeSlotId).toBe("slot-1");
});


test.skipIf(process.platform === "win32")("legacy saves remain readable and are preserved on portable replacement", async () => {
  const legacy = { ...payload(), narration: "Legacy mission" };
  const bytes = JSON.stringify(legacy);
  await writeFile(legacySlotPath(), bytes);
  expect((await adapter.listSessions("player")).slots[0].session.narration).toBe("Legacy mission");
  expect((await adapter.loadSession("slot-1", "player")).session.narration).toBe("Legacy mission");
  await adapter.saveSession("slot-1", { ...payload(), narration: "Portable replacement" }, "player");
  expect(await readFile(legacySlotPath(), "utf8")).toBe(bytes);
  expect((await adapter.loadSession("slot-1", "player")).session.narration).toBe("Portable replacement");
  expect(await adapter.deleteSession("slot-1", "player")).toMatchObject({ deletedActiveSession: true });
  await expect(readFile(legacySlotPath())).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(slotPath())).rejects.toMatchObject({ code: "ENOENT" });
  expect(await adapter.loadSession("slot-1", "player")).toBeNull();
});

test.skipIf(process.platform === "win32")("migration fallback preserves corrupt legacy data and never hides corrupt portable data", async () => {
  await writeFile(legacySlotPath(), "broken legacy bytes");
  await expect(adapter.loadSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  expect(await readFile(legacySlotPath(), "utf8")).toBe("broken legacy bytes");
  await adapter.saveSession("slot-1", payload(), "player");
  expect(await readFile(legacySlotPath(), "utf8")).toBe("broken legacy bytes");
  await writeFile(legacySlotPath(), JSON.stringify(payload()));
  await writeFile(slotPath(), "broken portable bytes");
  await expect(adapter.loadSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  expect(await readFile(slotPath(), "utf8")).toBe("broken portable bytes");
});

test.skipIf(process.platform === "win32")("deleting a legacy-only slot cannot resurrect it on a later list", async () => {
  await writeFile(legacySlotPath(), JSON.stringify(payload()));
  await adapter.loadSession("slot-1", "player");
  await adapter.deleteSession("slot-1", "player");
  expect((await adapter.listSessions("player")).slots[0].session).toBeNull();
});


test.skipIf(process.platform === "win32")("legacy active index supports default resume and is preserved on migration", async () => {
  const saved = payload();
  const legacyIndex = JSON.stringify({ activeSlotId: "slot-1", slots: slots.map((s) => ({ ...s, lastUpdatedIso: s.id === "slot-1" ? saved.lastUpdatedIso : null })) });
  await writeFile(legacySlotPath(), JSON.stringify(saved));
  await writeFile(legacyIndexPath(), legacyIndex);
  expect((await adapter.loadSession(undefined, "player")).slotId).toBe("slot-1");
  expect(await readFile(legacyIndexPath(), "utf8")).toBe(legacyIndex);
  expect(JSON.parse(await readFile(indexPath(), "utf8")).activeSlotId).toBe("slot-1");
});

test("long owner identities use bounded components for saves and active indexes", async () => {
  const owner = "a".repeat(300);
  await adapter.saveSession("slot-1", { ...payload(), narration: "Long owner" }, owner);
  expect((await adapter.loadSession(undefined, owner)).session.narration).toBe("Long owner");
  expect((await adapter.listSessions(owner)).activeSlotId).toBe("slot-1");
  await adapter.deleteSession("slot-1", owner);
  expect(await adapter.loadSession(undefined, owner)).toBeNull();
});

test.skipIf(process.platform === "win32")("corrupt legacy index blocks migration writes and preserves all original bytes", async () => {
  const original = JSON.stringify(payload());
  await writeFile(legacySlotPath(), original);
  await writeFile(legacyIndexPath(), "broken legacy index");
  await expect(adapter.saveSession("slot-1", payload(), "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  await expect(adapter.deleteSession("slot-1", "player")).rejects.toMatchObject({ code: "SAVE_CORRUPT" });
  expect(await readFile(legacyIndexPath(), "utf8")).toBe("broken legacy index");
  expect(await readFile(legacySlotPath(), "utf8")).toBe(original);
  await expect(readFile(slotPath())).rejects.toMatchObject({ code: "ENOENT" });
});
