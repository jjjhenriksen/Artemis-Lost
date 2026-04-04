import { useEffect, useMemo, useRef, useState } from "react";
import ActionInput from "./ActionInput";
import { createBotAction } from "./botTurns";
import CrewCard from "./CrewCard";
import CrewStatusBar from "./CrewStatusBar";
import NarrationPanel from "./NarrationPanel";
import RosterSummary from "./RosterSummary";
import RoleView from "./RoleView";
import ThemePicker from "./ThemePicker";
import { applyStateDelta } from "./applyStateDelta";
import { requestAutonomousAction, requestDmTurn } from "./dmApi";
import {
  advanceMissionMet,
  appendConversationEntry,
  createActionLogEntry,
  getCrewTurnIndexById,
  getNextTurnIndex,
  prependCappedEntries,
} from "./gameLoop";
import { createMissionTurnEffect } from "./missionMechanics";
import { createRoleTurnEffect, getFollowThroughTurnTarget } from "./roleMechanics";
import { getViewForRole } from "./roleFilters";
import { saveSession as persistSession } from "./sessionApi";
import { getUiState } from "./uiState";
import { INITIAL_WORLD_STATE, OPENING_NARRATION } from "./worldState";

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
  const inputRef = useRef(null);

  const activeCrew = ws.crew[turn];
  const roleView = useMemo(() => getViewForRole(ws, turn), [ws, turn]);
  const uiState = useMemo(() => getUiState(ws), [ws]);
  const isBotTurn = activeCrew?.character?.controller === "bot";

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

  function resolveNextTurnIndex(nextWorldState) {
    const followThroughTarget = getFollowThroughTurnTarget(nextWorldState);
    const priorityIndex = getCrewTurnIndexById(nextWorldState?.crew, followThroughTarget?.id);

    if (priorityIndex >= 0 && priorityIndex !== turn) {
      return priorityIndex;
    }

    return getNextTurnIndex(nextWorldState?.crew || ws.crew, turn);
  }

  async function resolveTurn(action) {
    if (!action.trim() || waiting) return;
    const actionText = action.trim();

    setWaiting(true);

    const newLog = createActionLogEntry(ws, activeCrew, actionText);
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
      const advancedMet = advanceMissionMet(ws.mission.met);
      const baseWorldState = {
        ...ws,
        mission: {
          ...ws.mission,
          met: advancedMet,
        },
        eventLog: prependCappedEntries(ws.eventLog, newLog),
      };
      const roleEffect = createRoleTurnEffect(baseWorldState, activeCrew, actionText);
      const roleResolvedWorldState = applyStateDelta(baseWorldState, roleEffect.delta);
      const missionEffect = createMissionTurnEffect(roleResolvedWorldState, activeCrew, actionText);
      const nextWorldState = applyStateDelta(roleResolvedWorldState, missionEffect.delta);
      const nextTurn = resolveNextTurnIndex(nextWorldState);

      setNarration(errorNarration);
      setWs(nextWorldState);
      await saveCurrentSession({
        worldState: nextWorldState,
        narration: errorNarration,
        turn: nextTurn,
        conversationHistory: nextConversationHistory,
      });
      completeTurn(nextTurn);
      return;
    }

    const { narration: nextText, stateDelta } = result;
    const advancedMet = advanceMissionMet(ws.mission.met);
    const assistantHistory = appendConversationEntry(nextConversationHistory, {
      role: "assistant",
      turn,
      crewName: activeCrew.name,
      content: nextText,
    });
    const baseWorldState = {
      ...ws,
      mission: {
        ...ws.mission,
        met: advancedMet,
      },
      eventLog: prependCappedEntries(ws.eventLog, newLog),
    };
    const dmResolvedWorldState = applyStateDelta(
      baseWorldState,
      {
        ...stateDelta,
        mission: {
          ...(stateDelta.mission || {}),
          met: stateDelta?.mission?.met || advancedMet,
        },
      }
    );
    const roleEffect = createRoleTurnEffect(dmResolvedWorldState, activeCrew, actionText);
    const roleResolvedWorldState = applyStateDelta(dmResolvedWorldState, roleEffect.delta);
    const missionEffect = createMissionTurnEffect(roleResolvedWorldState, activeCrew, actionText);
    const nextWorldState = applyStateDelta(roleResolvedWorldState, missionEffect.delta);
    const nextTurn = resolveNextTurnIndex(nextWorldState);

    setWs(nextWorldState);
    setNarration(nextText);
    setConversationHistory(assistantHistory);
    await saveCurrentSession({
      worldState: nextWorldState,
      narration: nextText,
      turn: nextTurn,
      conversationHistory: assistantHistory,
    });
    completeTurn(nextTurn);
  }

  async function handleSubmit() {
    if (!input.trim() || waiting || isBotTurn) return;
    const action = input.trim();
    setInput("");
    await resolveTurn(action);
  }

  useEffect(() => {
    if (!isBotTurn || waiting || !activeCrew) {
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
  }, [activeCrew, conversationHistory, isBotTurn, turn, waiting, ws]);

  async function handleAdvanceAutonomousTurn() {
    if (!isBotTurn || !botPreview || waiting || !narrationReady) return;
    await resolveTurn(botPreview);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
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
            worldState={ws}
            uiState={uiState}
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
