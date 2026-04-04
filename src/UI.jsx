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
import { requestDmTurn } from "./dmApi";
import {
  advanceMissionMet,
  appendConversationEntry,
  createActionLogEntry,
  getNextTurnIndex,
  prependCappedEntries,
} from "./gameLoop";
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
      const nextWorldState = {
        ...ws,
        mission: {
          ...ws.mission,
          met: advancedMet,
        },
        eventLog: prependCappedEntries(ws.eventLog, newLog),
      };
      const nextTurn = getNextTurnIndex(ws.crew, turn);

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
    const nextWorldState = applyStateDelta(
      {
        ...ws,
        mission: {
          ...ws.mission,
          met: advancedMet,
        },
        eventLog: prependCappedEntries(ws.eventLog, newLog),
      },
      {
        ...stateDelta,
        mission: {
          ...(stateDelta.mission || {}),
          met: stateDelta?.mission?.met || advancedMet,
        },
      }
    );
    const nextTurn = getNextTurnIndex(ws.crew, turn);

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
      return;
    }

    const plannedAction = createBotAction(ws, activeCrew);
    setBotPreview(plannedAction);

    const timer = window.setTimeout(() => {
      resolveTurn(plannedAction);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeCrew, isBotTurn, waiting, ws]);

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
            Lunar anomaly command interface
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
        <div className="app-grid__main">
          <NarrationPanel text={narration} eventLog={ws.eventLog} uiState={uiState} />

          <ActionInput
            activeCrew={activeCrew}
            input={input}
            inputRef={inputRef}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            onSubmit={handleSubmit}
            waiting={waiting}
            isBotTurn={isBotTurn}
            botPreview={botPreview}
          />
        </div>

        <div className="sidebar-panel">
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

          <RoleView
            activeCrew={activeCrew}
            roleView={roleView}
            worldState={ws}
            activeTurn={turn}
            uiState={uiState}
          />
          <RosterSummary crew={ws.crew} />
        </div>
      </div>
    </div>
  );
}
