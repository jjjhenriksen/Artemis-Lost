import { useEffect, useRef, useState } from "react";
import ActionInput from "./ActionInput";
import CrewCard from "./CrewCard";
import CrewStatusBar from "./CrewStatusBar";
import NarrationPanel from "./NarrationPanel";
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
import { loadSession, saveSession as persistSession } from "./sessionApi";
import { INITIAL_WORLD_STATE, OPENING_NARRATION } from "./worldState";

export default function ArtemisLost() {
  const [ws, setWs] = useState(INITIAL_WORLD_STATE);
  const [turn, setTurn] = useState(0);
  const [narration, setNarration] = useState(OPENING_NARRATION);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sessionReady, setSessionReady] = useState(false);
  const inputRef = useRef(null);

  const activeCrew = ws.crew[turn];
  const roleView = getViewForRole(ws, turn);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const session = await loadSession();
      if (cancelled) return;

      if (session && session.worldState) {
        setWs(session.worldState);
        setNarration(session.narration || OPENING_NARRATION);
        setTurn(typeof session.turn === "number" ? session.turn : 0);
        setConversationHistory(session.conversationHistory || []);
      }

      setSessionReady(true);
    }

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    persistSession({
      worldState: ws,
      narration,
      turn,
      conversationHistory,
    }).catch(() => {});
  }, [conversationHistory, narration, sessionReady, turn, ws]);

  function completeTurn() {
    setWaiting(false);
    setTurn((currentTurn) => getNextTurnIndex(ws.crew, currentTurn));
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
      setNarration(
        `Could not reach the DM service.\n\n${result.error}\n\nCheck that both dev servers are running (\`npm run dev\`), your .env has ANTHROPIC_API_KEY, and ANTHROPIC_MODEL matches an available model.`
      );
      setWs((prev) => ({
        ...prev,
        eventLog: prependCappedEntries(prev.eventLog, newLog),
      }));
      completeTurn();
      return;
    }

    const { narration: nextText, stateDelta } = result;
    setWs((prev) => {
      const withAction = {
        ...prev,
        eventLog: prependCappedEntries(prev.eventLog, newLog),
      };
      return applyStateDelta(withAction, stateDelta);
    });
    setNarration(nextText);
    setConversationHistory((prev) =>
      appendConversationEntry(prev, {
        role: "assistant",
        turn,
        crewName: activeCrew.name,
        content: nextText,
      })
    );
    completeTurn();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <div className="app-header__eyebrow">
            {ws.mission.id} // {ws.mission.name.toUpperCase()}
          </div>
          <div className="app-header__title">Artemis Lost</div>
        </div>

        <CrewStatusBar mission={ws.mission} systems={ws.systems} />
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
