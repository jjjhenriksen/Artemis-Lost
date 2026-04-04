import { useEffect, useState } from "react";
import CharacterCreation from "./CharacterCreation";
import MainMenu from "./MainMenu";
import { loadSession, saveSession } from "./sessionApi";
import ArtemisLost from "./UI.jsx";
import { createMissionSession } from "./worldState";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [savedSession, setSavedSession] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [gameInstanceKey, setGameInstanceKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function hydrateMenu() {
      const session = await loadSession();
      if (cancelled) return;

      if (session?.worldState) {
        setSavedSession(session);
      }

      setScreen("menu");
    }

    hydrateMenu();

    return () => {
      cancelled = true;
    };
  }, []);

  function launchSession(session) {
    setActiveSession(session);
    setGameInstanceKey((current) => current + 1);
    setScreen("game");
  }

  async function handleStartMission(profiles) {
    const session = createMissionSession(profiles);
    await saveSession(session);
    setSavedSession(session);
    launchSession(session);
  }

  async function handleLoadSave() {
    const session = await loadSession();
    if (!session?.worldState) return;
    setSavedSession(session);
    launchSession(session);
  }

  function handleResumeMission() {
    if (!activeSession?.worldState) return;
    setScreen("game");
  }

  function handleSessionPersisted(session) {
    setSavedSession(session);
    setActiveSession(session);
  }

  if (screen === "loading") {
    return <div className="menu-loading">Booting mission systems...</div>;
  }

  if (screen === "create") {
    return (
      <CharacterCreation
        onBack={() => setScreen("menu")}
        onStartMission={handleStartMission}
      />
    );
  }

  if (screen === "game" && activeSession?.worldState) {
    return (
      <ArtemisLost
        key={gameInstanceKey}
        initialSession={activeSession}
        onExitToMenu={() => setScreen("menu")}
        onSessionPersisted={handleSessionPersisted}
      />
    );
  }

  return (
    <MainMenu
      activeSession={activeSession}
      savedSession={savedSession}
      onLoadSave={handleLoadSave}
      onNewMission={() => setScreen("create")}
      onResumeMission={handleResumeMission}
    />
  );
}
