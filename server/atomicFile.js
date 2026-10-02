import { open, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// A sibling temporary file keeps rename on the same filesystem. Readers see
// either the previous complete file or the replacement, even if writing stops.
export async function atomicWriteFile(targetPath, content) {
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, targetPath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true });
  }
}

// All adapter instances in this server share the queue. Rejections release it,
// and different owners remain independent. This covers load/delete as well as
// save so an older index snapshot cannot overwrite newer slot metadata.
const pendingUpdates = new Map();
export async function withOwnerIndexLock(indexPath, operation) {
  const previous = pendingUpdates.get(indexPath) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  pendingUpdates.set(indexPath, current);
  try {
    return await current;
  } finally {
    if (pendingUpdates.get(indexPath) === current) pendingUpdates.delete(indexPath);
  }
}
