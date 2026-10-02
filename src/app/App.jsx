import { lazy, Suspense, useEffect, useState } from "react";
import CharacterCreation from "../screens/CharacterCreation.jsx";
import LaunchSequence from "../screens/LaunchSequence.jsx";
import MainMenu from "../screens/MainMenu.jsx";
import MissionResolution from "../screens/MissionResolution.jsx";
import { deleteSession, listSessions, loadSession, saveSession } from "../services/sessionApi.js";
import {
  getStoredTheme,
  getThemeFamilyId,
  getThemeMode,
  THEMES,
  THEME_STORAGE_KEY,
} from "../game/themes.js";
import ArtemisLost from "../screens/UI.jsx";
import { createMissionSession } from "../game/worldState.js";

const Multiplayer = lazy(() => import("../screens/Multiplayer.jsx"));

function getResolutionPreviewMode() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview");
  return preview === "victory" || preview === "defeat" ? preview : null;
}

function createResolutionPreviewSession(status) {
  const session = createMissionSession();
  const isVictory = status === "victory";

  return {
    ...session,
    narration: isVictory
      ? "Recovery forces have visual on the capsule as it breaks the surface hard, throws spray high, and settles into a stable retrieval posture."
      : "No recovery call answers. The capsule drifts cold beyond the return corridor while the last telemetry packet keeps repeating into the dark.",
    worldState: {
      ...session.worldState,
      systems: isVictory
        ? {
            ...session.worldState.systems,
            o2: 63,
            power: 58,
            comms: 71,
            nav: 64,
            thermal: 68,
          }
        : {
            ...session.worldState.systems,
            o2: 4,
            power: 6,
            comms: 9,
            nav: 11,
            thermal: 22,
          },
      crew: (session.worldState.crew || []).map((member, index) => ({
        ...member,
        health: isVictory ? [78, 72, 69, 75][index] ?? member.health : [18, 11, 7, 24][index] ?? member.health,
      })),
      mission: {
        ...session.worldState.mission,
        met: isVictory ? "T+00:08" : "T+00:06",
        phase: isVictory ? "Recovery corridor secured" : "Return corridor lost",
        outcome: isVictory
          ? {
              status: "victory",
              title: "Signal Secured",
              summary:
                "The crew got home with the source isolated, the evidence intact, and just enough margin left to make retrieval possible.",
            }
          : {
              status: "defeat",
              title: "Mission Lost",
              summary:
                "The return window collapsed before the crew could claw the mission back into survivable territory.",
            },
      },
    },
  };
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [slots, setSlots] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [pendingSlotId, setPendingSlotId] = useState("slot-1");
  const [gameInstanceKey, setGameInstanceKey] = useState(0);
  const [themeId, setThemeId] = useState(getStoredTheme);
  const [resolutionPreviewMode, setResolutionPreviewMode] = useState(getResolutionPreviewMode);

  async function refreshSlots() {
    const response = await listSessions();
    if (!response?.error) {
      setSlots(response.slots || []);
      setActiveSlotId(response.activeSlotId || null);
    }
  }

  useEffect(() => {
    if (resolutionPreviewMode) {
      return undefined;
    }

    let cancelled = false;

    async function hydrateMenu() {
      const response = await listSessions();
      if (cancelled || response?.error) {
        setScreen("menu");
        return;
      }

      setSlots(response.slots || []);
      setActiveSlotId(response.activeSlotId || null);
      setScreen("menu");
    }

    hydrateMenu();

    return () => {
      cancelled = true;
    };
  }, [resolutionPreviewMode]);

  useEffect(() => {
    const previewMode = getResolutionPreviewMode();
    if (!previewMode) return;

    setActiveSession(createResolutionPreviewSession(previewMode));
    setActiveSlotId("preview-slot");
    setScreen("resolution-preview");
  }, []);

  useEffect(() => {
    const themeFamily = getThemeFamilyId(themeId);
    const themeMode = getThemeMode(themeId);
    document.documentElement.dataset.theme = themeId;
    document.documentElement.dataset.themeFamily = themeFamily;
    document.documentElement.dataset.themeMode = themeMode;
    document.body.dataset.theme = themeId;
    document.body.dataset.themeFamily = themeFamily;
    document.body.dataset.themeMode = themeMode;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, themeId); } catch { /* Theme remains active when browser storage is unavailable. */ }
  }, [themeId]);

  function launchSession(slotId, session) {
    setActiveSession(session);
    setActiveSlotId(slotId);
    setGameInstanceKey((current) => current + 1);
    setScreen("game");
  }

  function beginLaunchSequence(slotId, session) {
    setActiveSession(session);
    setActiveSlotId(slotId);
    setScreen("launch");
  }

  async function handleStartMission(slotId, profiles, missionSeed) {
    const session = createMissionSession(profiles, missionSeed);
    const saved = await saveSession(slotId, session);
    if (saved?.error) return;
    await refreshSlots();
    beginLaunchSequence(slotId, saved);
  }

  async function handleLoadSlot(slotId) {
    const session = await loadSession(slotId);
    if (!session?.worldState) return;
    await refreshSlots();
    launchSession(slotId, session);
  }

  async function handleContinue() {
    if (!activeSlotId) return;
    await handleLoadSlot(activeSlotId);
  }

  async function handleDeleteSlot(slotId) {
    await deleteSession(slotId);
    if (activeSlotId === slotId) {
      setActiveSession(null);
      setActiveSlotId(null);
    }
    await refreshSlots();
  }

  function handleResumeMission() {
    if (!activeSession?.worldState) return;
    setScreen("game");
  }

  async function handleSessionPersisted(session) {
    setActiveSession(session);
    setActiveSlotId(session.slotId);
    await refreshSlots();
  }

  function handleExitResolutionPreview() {
    const url = new URL(window.location.href);
    url.searchParams.delete("preview");
    window.history.replaceState({}, "", url);
    setResolutionPreviewMode(null);
    setActiveSession(null);
    setActiveSlotId(null);
    setScreen("menu");
  }

  if (screen === "loading") {
    return <div className="menu-loading">Booting mission systems...</div>;
  }

  if (screen === "create") {
    return (
      <CharacterCreation
        slotId={pendingSlotId}
        themeId={themeId}
        themes={THEMES}
        onThemeChange={setThemeId}
        onBack={() => setScreen("menu")}
        onStartMission={handleStartMission}
      />
    );
  }

  if (screen === "multiplayer") {
    return <Suspense fallback={<div className="menu-loading" role="status">Connecting to shared mission control…</div>}><Multiplayer onBack={() => setScreen("menu")} /></Suspense>;
  }

  if (screen === "launch" && activeSession?.worldState) {
    return (
      <LaunchSequence
        session={activeSession}
        slotId={activeSlotId}
        themeId={themeId}
        themes={THEMES}
        onComplete={() => launchSession(activeSlotId, activeSession)}
      />
    );
  }

  if (screen === "game" && activeSession?.worldState) {
    return (
      <ArtemisLost
        key={gameInstanceKey}
        initialSession={activeSession}
        slotId={activeSlotId}
        themeId={themeId}
        themes={THEMES}
        onThemeChange={setThemeId}
        onExitToMenu={() => setScreen("menu")}
        onSessionPersisted={handleSessionPersisted}
      />
    );
  }

  if (
    screen === "resolution-preview" &&
    resolutionPreviewMode &&
    activeSession?.worldState?.mission?.outcome?.status
  ) {
    return (
      <MissionResolution
        worldState={activeSession.worldState}
        narration={activeSession.narration}
        slotId={activeSlotId}
        themeId={themeId}
        themes={THEMES}
        onReviewMission={handleExitResolutionPreview}
        onReturnToMenu={handleExitResolutionPreview}
      />
    );
  }

  return (
    <MainMenu
      activeSession={activeSession}
      activeSlotId={activeSlotId}
      slots={slots}
      themeId={themeId}
      themes={THEMES}
      onThemeChange={setThemeId}
      onContinue={handleContinue}
      onDeleteSlot={handleDeleteSlot}
      onLoadSlot={handleLoadSlot}
      onNewMission={(slotId) => {
        setPendingSlotId(slotId);
        setScreen("create");
      }}
      onResumeMission={handleResumeMission}
      onMultiplayer={() => setScreen("multiplayer")}
    />
  );
}
