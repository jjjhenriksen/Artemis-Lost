// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const fault = vi.hoisted(() => ({ stage: null }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal();
  const fail = () => { throw Object.assign(new Error("injected disk failure"), { code: "ENOSPC" }); };
  return {
    ...fs,
    open: async (...args) => {
      const handle = await fs.open(...args);
      return {
        writeFile: async (content, encoding) => {
          if (fault.stage === "write") {
            await handle.writeFile(String(content).slice(0, 5), encoding);
            fail();
          }
          return handle.writeFile(content, encoding);
        },
        sync: () => fault.stage === "sync" ? fail() : handle.sync(),
        close: () => handle.close(),
      };
    },
    rename: (...args) => fault.stage === "rename" ? fail() : fs.rename(...args),
  };
});
import { atomicWriteFile, withOwnerIndexLock } from "../server/atomicFile.js";

let root;
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), "artemis-atomic-")); });
afterEach(async () => { fault.stage = null; await rm(root, { recursive: true, force: true }); });

test.each(["write", "sync", "rename"])("a %s failure preserves bytes and removes temporary files", async (stage) => {
  const file = path.join(root, "save.json");
  await writeFile(file, '{"previous":true}\n');
  fault.stage = stage;
  await expect(atomicWriteFile(file, '{"replacement":true}\n')).rejects.toMatchObject({ code: "ENOSPC" });
  expect(await readFile(file, "utf8")).toBe('{"previous":true}\n');
  expect(await readdir(root)).toEqual(["save.json"]);
});

test("replaces an existing file completely", async () => {
  const file = path.join(root, "save.json");
  await writeFile(file, "previous");
  await atomicWriteFile(file, '{"replacement":true}\n');
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ replacement: true });
  expect(await readdir(root)).toEqual(["save.json"]);
});

test("a failed owner update releases the queue for the next operation", async () => {
  const first = withOwnerIndexLock("synthetic-owner", async () => { throw new Error("failed"); });
  const next = withOwnerIndexLock("synthetic-owner", async () => "next succeeded");
  await expect(first).rejects.toThrow("failed");
  await expect(next).resolves.toBe("next succeeded");
});
