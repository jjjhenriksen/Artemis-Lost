import { ensureSessionMirrorPaths, syncActiveMirror } from "./sessionMirrors.js";
import { createSessionStorageAdapter } from "./sessionStorageAdapter.js";

export const SAVE_SLOTS = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
];

const storageAdapter = createSessionStorageAdapter(SAVE_SLOTS);
const DEFAULT_OWNER_ID = "local-player";

function normalizeOwnerId(ownerId) {
  if (!ownerId || typeof ownerId !== "string") return DEFAULT_OWNER_ID;
  const normalized = ownerId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return normalized || DEFAULT_OWNER_ID;
}

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
    narration: session.narration,
    turn: session.turn,
    conversationHistory: session.conversationHistory ?? [],
    createdFromCharacterCreation: Boolean(session.createdFromCharacterCreation),
    lastUpdatedIso: new Date().toISOString(),
  };
}

function assertKnownSlot(slotId) {
  if (!SAVE_SLOTS.some((slot) => slot.id === slotId)) {
    throw new Error(`Unknown save slot: ${slotId}`);
  }
}

export async function ensureSessionPaths() {
  await Promise.all([storageAdapter.ensurePaths(), ensureSessionMirrorPaths()]);
}

export async function listSessions(ownerId) {
  await ensureSessionPaths();
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
  await ensureSessionPaths();
  const loaded = await storageAdapter.loadSession(slotId, normalizeOwnerId(ownerId));
  if (!loaded) return null;

  await syncActiveMirror(loaded.slotId, loaded.session, withSlotMetadata);
  return withSlotMetadata(loaded.slotId, loaded.session);
}

export async function saveSession(slotId, session, ownerId) {
  await ensureSessionPaths();
  assertKnownSlot(slotId);

  const payload = toSessionPayload(session);
  await storageAdapter.saveSession(slotId, payload, normalizeOwnerId(ownerId));
  await syncActiveMirror(slotId, payload, withSlotMetadata);

  return withSlotMetadata(slotId, payload);
}

export async function deleteSession(slotId, ownerId) {
  await ensureSessionPaths();
  const { deletedActiveSession } = await storageAdapter.deleteSession(slotId, normalizeOwnerId(ownerId));

  if (deletedActiveSession) {
    await syncActiveMirror(null, null, withSlotMetadata);
  }

  return { slotId, deleted: true };
}

export function getSessionBackendMode() {
  return storageAdapter.getMode();
}
