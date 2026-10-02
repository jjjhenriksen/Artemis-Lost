import path from "node:path";
import { assertKnownSlot } from "./sessionValidation.js";

export const DEFAULT_OWNER_ID = "local-player";
export function normalizeOwnerId(ownerId) {
  if (!ownerId || typeof ownerId !== "string") return DEFAULT_OWNER_ID;
  const normalized = ownerId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return normalized || DEFAULT_OWNER_ID;
}

// Fixed-size, prefixed path components avoid Windows reserved names and length
// limits without hashing (and therefore without possible hash collisions).
// Concatenating owner chunks restores the exact existing logical owner identity.
export function getPortableOwnerRelativePath(ownerId) {
  const owner = normalizeOwnerId(ownerId);
  const chunks = owner.match(/.{1,64}/g).map((chunk) => `o-${chunk}`);
  return path.join("owners-v1", ...chunks);
}

export function getPortableSlotRelativePath(ownerId, slotId) {
  assertKnownSlot(slotId);
  return path.join(getPortableOwnerRelativePath(ownerId), `${slotId}.json`);
}

export function decodePortableSlotRelativePath(relativePath) {
  if (typeof relativePath !== "string") throw new TypeError("Invalid save path.");
  const pieces = relativePath.split(/[\\/]/);
  const filename = pieces.pop(), version = pieces.shift();
  if (version !== "owners-v1" || !pieces.length || !/^slot-[123]\.json$/.test(filename || "")
    || pieces.some((part, index) => !/^o-[a-z0-9_-]{1,64}$/.test(part)
      || (index < pieces.length - 1 && part.length !== 66))) throw new TypeError("Invalid save path.");
  return { ownerId: pieces.map((part) => part.slice(2)).join(""), slotId: filename.slice(0, -5) };
}
