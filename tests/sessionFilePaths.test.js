// @vitest-environment node
import path from "node:path";
import { getPortableSlotRelativePath, decodePortableSlotRelativePath, normalizeOwnerId } from "../server/sessionFilePaths.js";

test("portable mapping round-trips normalized owners and avoids Windows reserved names", () => {
  const owners = ["player", "LOCAL-player", "con", "aux", "nul", "com1", "lpt9", "owner_1", "owner--slot-2", "a".repeat(300), "a".repeat(64), "a".repeat(65)];
  const paths = new Set();
  for (const owner of owners) for (const slot of ["slot-1", "slot-2", "slot-3"]) {
    const relative = getPortableSlotRelativePath(owner, slot);
    const components = relative.split(path.sep);
    for (const component of components) {
      expect(component).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
      expect(component).not.toMatch(/[. ]$/);
      expect(component.length).toBeLessThanOrEqual(66);
      expect(component).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i);
    }
    expect(decodePortableSlotRelativePath(path.win32.join(...components))).toEqual({ ownerId: normalizeOwnerId(owner), slotId: slot });
    const insensitive = relative.toLowerCase();
    expect(paths.has(insensitive)).toBe(false); paths.add(insensitive);
  }
});

test("fixed-size owner chunks prevent prefix/segment ambiguity", () => {
  const short = getPortableSlotRelativePath("a".repeat(64), "slot-1");
  const long = getPortableSlotRelativePath("a".repeat(65), "slot-1");
  expect(short).not.toBe(long);
  expect(decodePortableSlotRelativePath(long).ownerId).toBe("a".repeat(65));
});

test.each(["../slot-1.json", "owners-v1/o-CON/slot-1.json", "owners-v1/o-a/o-b/slot-1.json", "owners-v1/o-player/slot-4.json"])("rejects noncanonical portable path %s", (relative) => {
  expect(() => decodePortableSlotRelativePath(relative)).toThrow();
});
