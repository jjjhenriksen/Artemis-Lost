import { useEffect, useMemo, useRef, useState } from "react";
import ActionInput from "../components/ActionInput.jsx";
import { createBotAction } from "../game/botTurns.js";
import CrewCard from "../components/CrewCard.jsx";
import CrewStatusBar from "../components/CrewStatusBar.jsx";
import NarrationPanel from "../components/NarrationPanel.jsx";
import RosterSummary from "../components/RosterSummary.jsx";
import RoleView from "../components/RoleView.jsx";
import TelemetryBackdrop from "../components/TelemetryBackdrop.jsx";
import { requestAutonomousAction, requestDmTurn } from "../services/dmApi.js";
import { appendConversationEntry } from "../game/gameLoop.js";
import { getMissionOutcome } from "../game/missionOutcome.js";
import { getViewForRole } from "../game/roleFilters.js";
import { saveSession as persistSession } from "../services/sessionApi.js";
import { resolveTurnWorldState } from "../game/turnRuntime.js";
import { getUiState } from "../game/uiState.js";
import { INITIAL_WORLD_STATE, OPENING_NARRATION } from "../game/worldState.js";
import MissionResolution from "./MissionResolution.jsx";

function createFallbackSession() {
  return {
    worldState: INITIAL_WORLD_STATE,
    narration: OPENING_NARRATION,
    turn: 0,
    conversationHistory: [
      {
        role: "assistant",
        turn: 0,
        crewName: INITIAL_WORLD_STATE.crew[0]?.name || "Vasquez",
        content: OPENING_NARRATION,
      },
    ],
    createdFromCharacterCreation: false,
  };
}

function RecoveryAlert({ message, label, onRetry, disabled = false }) {
  return <div className="mission-alert" role="alert" style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
    <p>{message}</p>
    <button className="header-button" style={{ minHeight: "2.75rem", fontSize: "inherit", justifySelf: "start" }} disabled={disabled} onClick={onRetry}>{label}</button>
  </div>;
}

export default function ArtemisLost({
  initialSession,
  slotId,
  themeId,
  themes,
  onExitToMenu,
  onSessionPersisted,
}) {
  const session = initialSession?.worldState ? initialSession : createFallbackSession();

  const [ws, setWs] = useState(session.worldState);
  const [turn, setTurn] = useState(session.turn || 0);
  const [narration, setNarration] = useState(session.narration || OPENING_NARRATION);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState(
    session.conversationHistory || []
  );
  const [saveState, setSaveState] = useState("idle");
  const [botPreview, setBotPreview] = useState("");
  const [narrationReady, setNarrationReady] = useState(false);
  const [botPreviewLoading, setBotPreviewLoading] = useState(false);
  const [turnError, setTurnError] = useState("");
  const [botPreviewError, setBotPreviewError] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [showResolutionScreen, setShowResolutionScreen] = useState(false);
  const inputRef = useRef(null);
  const turnPendingRef = useRef(false);
  const plannedPreviewRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const activeCrew = ws.crew[turn];
  const roleView = useMemo(() => getViewForRole(ws, turn), [ws, turn]);
  const uiState = useMemo(
    () =>
      getUiState(ws, {
        activeCrew,
        input,
      }),
    [activeCrew, input, ws]
  );
  const isBotTurn = activeCrew?.character?.controller === "bot";
  const missionOutcome = getMissionOutcome(ws);
  const missionResolved = missionOutcome.status !== "active";

  function buildSessionPayload(overrides = {}) {
    return {
      worldState: overrides.worldState ?? ws,
      narration: overrides.narration ?? narration,
      turn: overrides.turn ?? turn,
      conversationHistory: overrides.conversationHistory ?? conversationHistory,
      createdFromCharacterCreation:
        overrides.createdFromCharacterCreation ?? session.createdFromCharacterCreation,
    };
  }

  async function saveCurrentSession(overrides = {}) {
    const payload = buildSessionPayload(overrides);
    setSaveState("saving");
    let persisted;
    try { persisted = await persistSession(slotId, payload); }
    catch { if (mountedRef.current) setSaveState("error"); return; }
    if (!mountedRef.current) return;
    if (!persisted?.error) {
      setSaveState("saved");
      onSessionPersisted?.(persisted);
      window.setTimeout(() => setSaveState("idle"), 1200);
    } else {
      setSaveState("error");
    }
  }

  function completeTurn(nextTurn) {
    setWaiting(false);
    setTurn(nextTurn);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  useEffect(() => {
    if (missionResolved) {
      setShowResolutionScreen(true);
    }
  }, [missionResolved]);

  async function resolveTurn(action) {
    if (!action.trim() || turnPendingRef.current || missionResolved) return false;
    const actionText = action.trim();

    turnPendingRef.current = true;
    setWaiting(true);
    setTurnError("");

    const nextConversationHistory = appendConversationEntry(conversationHistory, {
      role: "user",
      turn,
      crewName: activeCrew.name,
      content: actionText,
    });
    let result;
    try {
      result = await requestDmTurn({
        worldState: ws, action: actionText, activeCrew,
        conversationHistory: nextConversationHistory, currentTurn: turn,
      });
      if (!mountedRef.current) { turnPendingRef.current = false; return false; }
      if (result?.error || typeof result?.narration !== "string") throw new Error("Narration unavailable");
    } catch {
      turnPendingRef.current = false;
      if (mountedRef.current) {
        setWaiting(false);
        setTurnError("Mission control could not resolve this action. Your mission and action are unchanged. Retry when connected.");
        inputRef.current?.focus();
      }
      return false;
    }

    const { narration: nextText, stateDelta } = result;
    const assistantHistory = appendConversationEntry(nextConversationHistory, {
      role: "assistant",
      turn,
      crewName: activeCrew.name,
      content: nextText,
    });
    const { nextWorldState, nextTurn } = resolveTurnWorldState({
      worldState: ws,
      activeCrew,
      actionText,
      stateDelta,
      currentTurn: turn,
    });
    const nextOutcome = nextWorldState?.mission?.outcome || missionOutcome;
    const resolvedNarration =
      missionOutcome.status === "active" && nextOutcome.status !== "active"
        ? `${nextText}\n\n${nextOutcome.title}: ${nextOutcome.summary}`
        : nextText;

    setWs(nextWorldState);
    setNarration(resolvedNarration);
    setConversationHistory(assistantHistory);
    await saveCurrentSession({
      worldState: nextWorldState,
      narration: resolvedNarration,
      turn: nextTurn,
      conversationHistory: assistantHistory,
    });
    completeTurn(nextTurn);
    turnPendingRef.current = false;
    return true;
  }

  async function handleSubmit() {
    if (!input.trim() || waiting || isBotTurn || missionResolved) return;
    const action = input.trim();
    if (await resolveTurn(action)) setInput("");
  }

  useEffect(() => {
    if (waiting) return undefined;
    if (!isBotTurn || !activeCrew || missionResolved) {
      setBotPreview("");
      setBotPreviewLoading(false);
      setBotPreviewError("");
      plannedPreviewRef.current = null;
      return;
    }

    const planned = plannedPreviewRef.current;
    if (planned?.worldState === ws && planned.turn === turn && planned.attempt === previewAttempt) return undefined;
    plannedPreviewRef.current = { worldState: ws, turn, attempt: previewAttempt };

    let cancelled = false;
    let finished = false;
    const fallbackAction = createBotAction(ws, activeCrew);
    setBotPreview(fallbackAction);
    setBotPreviewLoading(true);
    setBotPreviewError("");

    async function hydrateAutonomousAction() {
      try {
        const result = await requestAutonomousAction({ worldState: ws, activeCrew, conversationHistory, currentTurn: turn });
        if (cancelled) return;
        if (result?.error || typeof result?.action !== "string" || !result.action.trim()) throw new Error("Autonomous plan unavailable");
        setBotPreview(result.action.trim());
      } catch {
        if (cancelled) return;
        setBotPreview("");
        setBotPreviewError("The AI crew could not prepare an action. Your mission is unchanged. Retry planning when connected.");
      } finally {
        finished = true;
        if (!cancelled) setBotPreviewLoading(false);
      }
    }

    hydrateAutonomousAction();

    return () => {
      cancelled = true;
      if (!finished) plannedPreviewRef.current = null;
    };
  }, [activeCrew, conversationHistory, isBotTurn, turn, waiting, ws, missionResolved, previewAttempt]);

  async function handleAdvanceAutonomousTurn() {
    if (!isBotTurn || !botPreview || waiting || !narrationReady || missionResolved) return;
    await resolveTurn(botPreview);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  if (showResolutionScreen && missionResolved) {
    return (
      <MissionResolution
        worldState={ws}
        narration={narration}
        slotId={initialSession?.slotLabel || slotId}
        themeId={themeId}
        themes={themes}
        onReviewMission={() => setShowResolutionScreen(false)}
        onReturnToMenu={onExitToMenu}
      />
    );
  }

  return (
    <div
      className={`app-shell app-shell--${uiState.dangerLevel} app-shell--failure-${uiState.dominantFailure} app-shell--anomaly-${uiState.anomalyIntensity}`}
    >
      <TelemetryBackdrop variant="app" />
      <div className="app-shell__glow app-shell__glow--left" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--right" aria-hidden="true" />
      <div className="app-header panel-boot" style={{ "--boot-delay": "40ms" }}>
        <div>
          <div className="app-header__eyebrow">
            {ws.mission.id} // {ws.mission.name.toUpperCase()}
          </div>
          <div className="app-header__title">Artemis Lost</div>
          <div className="app-header__subtitle">
            {uiState.headerSubtitle}
          </div>
          <div className="app-header__slot">
            Assigned berth: {initialSession?.slotLabel || slotId}
          </div>
        </div>

        <div className="app-header__controls">
          <CrewStatusBar mission={ws.mission} systems={ws.systems} uiState={uiState} />
          <div className="header-actions">
            <div className={`save-indicator save-indicator--${saveState}`}>
              {saveState === "saving"
                ? "Saving..."
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : "Autosave ready"}
            </div>
            <button className="header-button" onClick={() => saveCurrentSession()}>
              Save
            </button>
            <button className="header-button" onClick={onExitToMenu}>
              Menu
            </button>
          </div>
        </div>
      </div>

      <div className="app-grid">
        <div className="app-grid__narration">
          <NarrationPanel
            text={narration}
            eventLog={ws.eventLog}
            uiState={uiState}
            onTypewriterDone={setNarrationReady}
            listening={waiting}
          />
        </div>

        <div className="app-grid__action" style={{ flexDirection: "column" }}>
          {turnError ? <RecoveryAlert message={turnError} label="Retry action" disabled={waiting} onRetry={isBotTurn ? handleAdvanceAutonomousTurn : handleSubmit} /> : null}
          {botPreviewError ? <RecoveryAlert message={botPreviewError} label="Retry AI planning" onRetry={() => setPreviewAttempt((attempt) => attempt + 1)} /> : <ActionInput
            activeCrew={activeCrew}
            input={input}
            inputRef={inputRef}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            onSubmit={isBotTurn ? handleAdvanceAutonomousTurn : handleSubmit}
            waiting={waiting}
            isBotTurn={isBotTurn}
            botPreview={botPreview}
            botPreviewLoading={botPreviewLoading}
            narrationReady={narrationReady}
            uiState={uiState}
            missionResolved={missionResolved}
          />}
        </div>

        <div className="sidebar-panel app-grid__bottom">
          <div className="bottom-deck">
            <div className="bottom-deck__card panel-boot" style={{ "--boot-delay": "320ms" }}>
              <div>
                <div className="section-title section-title--with-divider">CREW STATUS</div>
              </div>
              <div className="crew-grid">
                {ws.crew.map((member, index) => (
                  <CrewCard
                    key={member.id}
                    member={member}
                    isActive={index === turn}
                    uiState={uiState}
                  />
                ))}
              </div>
            </div>

            <div className="bottom-deck__card panel-boot" style={{ "--boot-delay": "400ms" }}>
              <RoleView
                activeCrew={activeCrew}
                roleView={roleView}
                worldState={ws}
                activeTurn={turn}
                uiState={uiState}
              />
            </div>
          </div>
          <div className="panel-boot" style={{ "--boot-delay": "480ms" }}>
            <RosterSummary crew={ws.crew} worldState={ws} />
          </div>
        </div>
      </div>
    </div>
  );
}
