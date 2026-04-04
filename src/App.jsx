import { useEffect, useState } from "react";
import CharacterCreation from "./CharacterCreation";
import LaunchSequence from "./LaunchSequence";
import MainMenu from "./MainMenu";
import { deleteSession, listSessions, loadSession, saveSession } from "./sessionApi";
import { getStoredTheme, THEMES, THEME_STORAGE_KEY } from "./themes";
import ArtemisLost from "./UI.jsx";
import { createMissionSession } from "./worldState";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [slots, setSlots] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [pendingSlotId, setPendingSlotId] = useState("slot-1");
  const [gameInstanceKey, setGameInstanceKey] = useState(0);
  const [themeId, setThemeId] = useState(getStoredTheme);

  async function refreshSlots() {
    const response = await listSessions();
    if (!response?.error) {
      setSlots(response.slots || []);
      setActiveSlotId(response.activeSlotId || null);
    }
  }

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    document.body.dataset.theme = themeId;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
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

  if (screen === "launch" && activeSession?.worldState) {
    return (
      <LaunchSequence
        session={activeSession}
        slotId={activeSlotId}
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
    />
  );
}
