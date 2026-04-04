import { useRef, useState } from "react";
import ActionInput from "./ActionInput";
import CrewCard from "./CrewCard";
import CrewStatusBar from "./CrewStatusBar";
import NarrationPanel from "./NarrationPanel";
import RosterSummary from "./RosterSummary";
import RoleView from "./RoleView";
import { applyStateDelta } from "./applyStateDelta";
import { requestDmTurn } from "./dmApi";
import {
  appendConversationEntry,
  createActionLogEntry,
  getNextTurnIndex,
  prependCappedEntries,
} from "./gameLoop";
import { getViewForRole } from "./roleFilters";
import { saveSession as persistSession } from "./sessionApi";
import { INITIAL_WORLD_STATE, OPENING_NARRATION } from "./worldState";

function createFallbackSession() {
  return {
    worldState: INITIAL_WORLD_STATE,
    narration: OPENING_NARRATION,
    turn: 0,
    conversationHistory: [],
    createdFromCharacterCreation: false,
  };
}

export default function ArtemisLost({
  initialSession,
  slotId,
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
  const inputRef = useRef(null);

  const activeCrew = ws.crew[turn];
  const roleView = getViewForRole(ws, turn);

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

  async function handleSubmit() {
    if (!input.trim() || waiting) return;

    const action = input.trim();
    setInput("");
    setWaiting(true);

    const newLog = createActionLogEntry(ws, activeCrew, action);
    const nextConversationHistory = appendConversationEntry(conversationHistory, {
      role: "user",
      turn,
      crewName: activeCrew.name,
      content: action,
    });
    setConversationHistory(nextConversationHistory);

    const result = await requestDmTurn({
      worldState: ws,
      action,
      activeCrew,
      conversationHistory: nextConversationHistory,
      currentTurn: turn,
    });

    if (result.error) {
      const errorNarration = `Could not reach the DM service.\n\n${result.error}\n\nCheck that both dev servers are running (\`npm run dev\`), your .env has ANTHROPIC_API_KEY, and ANTHROPIC_MODEL matches an available model.`;
      const nextWorldState = {
        ...ws,
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
    const assistantHistory = appendConversationEntry(nextConversationHistory, {
      role: "assistant",
      turn,
      crewName: activeCrew.name,
      content: nextText,
    });
    const nextWorldState = applyStateDelta(
      {
        ...ws,
        eventLog: prependCappedEntries(ws.eventLog, newLog),
      },
      stateDelta
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

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="app-shell">
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
        </div>

        <div className="app-header__controls">
          <CrewStatusBar mission={ws.mission} systems={ws.systems} />
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
          <NarrationPanel text={narration} eventLog={ws.eventLog} />
        </div>

        <div className="sidebar-panel">
          <div>
          <div className="section-title section-title--with-divider">CREW STATUS</div>
          </div>
          <div className="crew-grid">
            {ws.crew.map((member, index) => (
              <CrewCard key={member.id} member={member} isActive={index === turn} />
            ))}
          </div>

          <RoleView activeCrew={activeCrew} roleView={roleView} />
          <RosterSummary crew={ws.crew} />
        </div>

        <ActionInput
          activeCrew={activeCrew}
          input={input}
          inputRef={inputRef}
          onChange={setInput}
          onKeyDown={handleKeyDown}
          onSubmit={handleSubmit}
          waiting={waiting}
        />
      </div>
    </div>
  );
}
