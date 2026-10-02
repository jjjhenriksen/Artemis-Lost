import { ensureSessionMirrorPaths, syncActiveMirror, normalizeSoloOwner as normalizeOwnerId } from "./sessionMirrors.js";
import { createSessionStorageAdapter } from "./sessionStorageAdapter.js";
import { SAVE_SLOTS, assertKnownSlot, assertValidSession } from "./sessionValidation.js";
export { SAVE_SLOTS } from "./sessionValidation.js";

const storageAdapter = createSessionStorageAdapter(SAVE_SLOTS);
function withSlotMetadata(slotId, session) {
  const slot = SAVE_SLOTS.find((entry) => entry.id === slotId);
  return {
    ...session,
    slotId,
    slotLabel: slot?.label || slotId,
  };
}

function toSessionPayload(session) {
  return {
    worldState: session.worldState,
    narration: session.narration ?? "",
    turn: session.turn,
    conversationHistory: session.conversationHistory ?? [],
    createdFromCharacterCreation: Boolean(session.createdFromCharacterCreation),
    lastUpdatedIso: new Date().toISOString(),
  };
}

export async function ensureSessionPaths(ownerId) {
  await Promise.all([storageAdapter.ensurePaths(), ensureSessionMirrorPaths(normalizeOwnerId(ownerId))]);
}

export async function listSessions(ownerId) {
  await ensureSessionPaths(ownerId);
  const listing = await storageAdapter.listSessions(normalizeOwnerId(ownerId));

  return {
    activeSlotId: listing.activeSlotId,
    slots: listing.slots.map(({ id, label, session }) => ({
      id,
      label,
      session: session ? withSlotMetadata(id, session) : null,
    })),
  };
}

export async function loadSession(slotId, ownerId) {
  if (slotId !== undefined && slotId !== null) assertKnownSlot(slotId);
  await ensureSessionPaths(ownerId);
  const loaded = await storageAdapter.loadSession(slotId, normalizeOwnerId(ownerId));
  if (!loaded) return null;

  await syncActiveMirror(loaded.slotId, loaded.session, withSlotMetadata, normalizeOwnerId(ownerId));
  return withSlotMetadata(loaded.slotId, loaded.session);
}

export async function saveSession(slotId, session, ownerId) {
  assertKnownSlot(slotId);
  assertValidSession(session);
  await ensureSessionPaths(ownerId);

  const payload = toSessionPayload(session);
  await storageAdapter.saveSession(slotId, payload, normalizeOwnerId(ownerId));
  await syncActiveMirror(slotId, payload, withSlotMetadata, normalizeOwnerId(ownerId));

  return withSlotMetadata(slotId, payload);
}

export async function deleteSession(slotId, ownerId) {
  assertKnownSlot(slotId);
  await ensureSessionPaths(ownerId);
  const { deletedActiveSession } = await storageAdapter.deleteSession(slotId, normalizeOwnerId(ownerId));

  if (deletedActiveSession) {
    await syncActiveMirror(null, null, withSlotMetadata, normalizeOwnerId(ownerId));
  }

  return { slotId, deleted: true };
}

export function getSessionBackendMode() {
  return storageAdapter.getMode();
}
