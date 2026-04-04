import { useEffect, useMemo, useRef, useState } from "react";
import ActionInput from "../components/ActionInput.jsx";
import { createBotAction } from "../game/botTurns.js";
import CrewCard from "../components/CrewCard.jsx";
import CrewStatusBar from "../components/CrewStatusBar.jsx";
import NarrationPanel from "../components/NarrationPanel.jsx";
import RosterSummary from "../components/RosterSummary.jsx";
import RoleView from "../components/RoleView.jsx";
import ThemePicker from "../components/ThemePicker.jsx";
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

export default function ArtemisLost({
  initialSession,
  slotId,
  themeId,
  themes,
  onThemeChange,
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
  const [showResolutionScreen, setShowResolutionScreen] = useState(false);
  const inputRef = useRef(null);

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
    const persisted = await persistSession(slotId, payload);
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
    if (!action.trim() || waiting || missionResolved) return;
    const actionText = action.trim();

    setWaiting(true);

    const nextConversationHistory = appendConversationEntry(conversationHistory, {
      role: "user",
      turn,
      crewName: activeCrew.name,
      content: actionText,
    });
    setConversationHistory(nextConversationHistory);

    const result = await requestDmTurn({
      worldState: ws,
      action: actionText,
      activeCrew,
      conversationHistory: nextConversationHistory,
      currentTurn: turn,
    });

    if (result.error) {
      const errorNarration = `Could not reach the DM service.\n\n${result.error}\n\nCheck that both dev servers are running (\`npm run dev\`), your .env has OPENAI_API_KEY, and OPENAI_MODEL matches an available model.`;
      const { nextWorldState, nextTurn } = resolveTurnWorldState({
        worldState: ws,
        activeCrew,
        actionText,
        currentTurn: turn,
      });
      const nextOutcome = nextWorldState?.mission?.outcome || missionOutcome;
      const resolvedNarration =
        missionOutcome.status === "active" && nextOutcome.status !== "active"
          ? `${errorNarration}\n\n${nextOutcome.title}: ${nextOutcome.summary}`
          : errorNarration;

      setNarration(resolvedNarration);
      setWs(nextWorldState);
      await saveCurrentSession({
        worldState: nextWorldState,
        narration: resolvedNarration,
        turn: nextTurn,
        conversationHistory: nextConversationHistory,
      });
      completeTurn(nextTurn);
      return;
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
  }

  async function handleSubmit() {
    if (!input.trim() || waiting || isBotTurn || missionResolved) return;
    const action = input.trim();
    setInput("");
    await resolveTurn(action);
  }

  useEffect(() => {
    if (!isBotTurn || waiting || !activeCrew || missionResolved) {
      setBotPreview("");
      setBotPreviewLoading(false);
      return;
    }

    let cancelled = false;
    const fallbackAction = createBotAction(ws, activeCrew);
    setBotPreview(fallbackAction);
    setBotPreviewLoading(true);

    async function hydrateAutonomousAction() {
      const result = await requestAutonomousAction({
        worldState: ws,
        activeCrew,
        conversationHistory,
        currentTurn: turn,
      });

      if (cancelled) return;

      if (!result?.error && typeof result?.action === "string" && result.action.trim()) {
        setBotPreview(result.action.trim());
      }
      setBotPreviewLoading(false);
    }

    hydrateAutonomousAction();

    return () => {
      cancelled = true;
    };
  }, [activeCrew, conversationHistory, isBotTurn, turn, waiting, ws, missionResolved]);

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
      <div className="app-shell__glow app-shell__glow--left" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--right" aria-hidden="true" />
      <div className="app-header">
        <div>
          <div className="app-header__eyebrow">
            {ws.mission.id} // {ws.mission.name.toUpperCase()}
          </div>
          <div className="app-header__title">Artemis Lost</div>
          <div className="app-header__subtitle">
            {uiState.headerSubtitle}
          </div>
          <div className="app-header__slot">
            Active save slot: {initialSession?.slotLabel || slotId}
          </div>
        </div>

        <div className="app-header__controls">
          <CrewStatusBar mission={ws.mission} systems={ws.systems} uiState={uiState} />
          <ThemePicker
            compact
            themeId={themeId}
            themes={themes}
            onThemeChange={onThemeChange}
            title="THEME"
          />
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
          />
        </div>

        <div className="app-grid__action">
          <ActionInput
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
          />
        </div>

        <div className="sidebar-panel app-grid__bottom">
          <div className="bottom-deck">
            <div className="bottom-deck__card">
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

            <div className="bottom-deck__card">
              <RoleView
                activeCrew={activeCrew}
                roleView={roleView}
                worldState={ws}
                activeTurn={turn}
                uiState={uiState}
              />
            </div>
          </div>
          <RosterSummary crew={ws.crew} worldState={ws} />
        </div>
      </div>
    </div>
  );
}
