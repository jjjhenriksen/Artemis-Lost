import { useState, useEffect, useRef } from "react";
import { requestDmTurn } from "./dmApi";
import { applyStateDelta } from "./applyStateDelta";
import {
  appendConversationEntry,
  createActionLogEntry,
  getNextTurnIndex,
} from "./gameLoop";

// ── World state seed ──────────────────────────────────────────────
const INITIAL_WORLD_STATE = {
  mission: {
    id: "ARTEMIS-07",
    name: "Lost Signal",
    phase: "Crater approach — active",
    met: "T+14:22:07",
    objectives: ["Investigate anomaly signal", "Maintain crew safety"],
  },
  environment: {
    location: "Shackleton Crater Rim",
    hazards: ["Signal interference", "Terrain instability"],
    anomaly: "Apollo-band signal — 50yr dormant, geometric origin suspected",
  },
  systems: {
    o2: 71,
    power: 100,
    comms: 35,
    propulsion: 98,
    scrubber: "patched",
  },
  crew: [
    { id: "vasquez", name: "Vasquez", role: "Commander",        health: 90, morale: 75, extra: { label: "Authority",  value: 100 } },
    { id: "okafor",  name: "Okafor",  role: "Flight Engineer",  health: 85, morale: 80, extra: { label: "O2 Sys",    value: 71  } },
    { id: "reyes",   name: "Reyes",   role: "Science Officer",  health: 95, morale: 85, extra: { label: "Scan Rng",  value: 60  } },
    { id: "park",    name: "Park",    role: "Mission Specialist",health: 80, morale: 70, extra: { label: "EVA Suit",  value: 30  } },
  ],
  eventLog: [
    { ts: "T+14:22", msg: "Anomaly signal detected — Shackleton Crater", type: "alert" },
    { ts: "T+14:18", msg: "Comms array degraded — unknown interference",  type: "warn"  },
    { ts: "T+13:55", msg: "Rover reached crater rim — all crew nominal",  type: "info"  },
    { ts: "T+12:30", msg: "Okafor patched O2 scrubber — leak sealed",     type: "info"  },
  ],
};

// ── Role-filtered views ───────────────────────────────────────────
function getViewForRole(ws, crewIndex) {
  const c = ws.crew[crewIndex];
  const s = ws.systems;
  const views = [
    // Commander
    [
      { key: "OBJECTIVE",  val: ws.mission.objectives[0] },
      { key: "PHASE",      val: ws.mission.phase },
      { key: "CREW READY", val: `${ws.crew.filter(m => m.health > 50).length}/${ws.crew.length}` },
      { key: "EVA STATUS", val: ws.crew[3].extra.value < 50 ? "Park suit integrity low" : "Nominal", warn: ws.crew[3].extra.value < 50 },
      { key: "UPLINK",     val: s.comms < 50 ? "Earth comms degraded" : "Nominal", warn: s.comms < 50 },
    ],
    // Flight Engineer
    [
      { key: "O2 LEVEL",   val: `${s.o2}% — ${s.o2 < 80 ? "monitor closely" : "nominal"}`, warn: s.o2 < 80 },
      { key: "PWR GRID",   val: s.power > 90 ? "Nominal" : `${s.power}% — reduced` },
      { key: "SCRUBBER",   val: s.scrubber === "patched" ? "Patched — holding" : "Nominal" },
      { key: "PROPULSION", val: s.propulsion > 90 ? "Nominal" : "Degraded", warn: s.propulsion < 90 },
      { key: "LIFE SUPP",  val: s.o2 > 60 && s.power > 80 ? "Green" : "At risk", warn: s.o2 < 60 || s.power < 80 },
    ],
    // Science Officer
    [
      { key: "ANOMALY SIG", val: ws.environment.anomaly.slice(0, 28) + "…" },
      { key: "GEOMETRY",    val: "Non-natural — deliberate" },
      { key: "SCAN RANGE",  val: `${c.extra.value}% — interference`, warn: c.extra.value < 70 },
      { key: "SAMPLES",     val: "0 collected" },
      { key: "HYPOTHESIS",  val: "Artificial origin likely" },
    ],
    // Mission Specialist
    [
      { key: "EVA SUIT",   val: `Integrity ${c.extra.value}% — ${c.extra.value < 40 ? "critical" : "ok"}`, warn: c.extra.value < 40 },
      { key: "COMMS RELAY",val: s.comms < 50 ? "Degraded" : "Nominal", warn: s.comms < 50 },
      { key: "EQUIPMENT",  val: "Drill, beacon, patch kit" },
      { key: "EARTH LINK", val: s.comms < 30 ? "Unavailable" : "Active", warn: s.comms < 30 },
      { key: "NEXT EVA",   val: c.extra.value < 40 ? "High risk" : "Cleared", warn: c.extra.value < 40 },
    ],
  ];
  return views[crewIndex];
}

// ── Stat bar ──────────────────────────────────────────────────────
function StatBar({ label, value }) {
  const color = value > 70 ? "#1D9E75" : value > 40 ? "#EF9F27" : "#E24B4A";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#5a7a99", marginBottom: 3 }}>
      <span style={{ width: 28, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: "#1e3a5f", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

// ── Crew card ─────────────────────────────────────────────────────
function CrewCard({ member, isActive }) {
  return (
    <div style={{
      background: isActive ? "#0d1825" : "#0d1219",
      border: `1px solid ${isActive ? "#378ADD" : "#1e3a5f"}`,
      borderRadius: 6,
      padding: 10,
      transition: "all 0.2s",
    }}>
      {isActive && (
        <div style={{
          display: "inline-block", fontSize: 9, background: "#378ADD22",
          color: "#378ADD", border: "1px solid #378ADD55", borderRadius: 3,
          padding: "1px 6px", letterSpacing: 1, marginBottom: 6,
        }}>ACTIVE TURN</div>
      )}
      <div style={{ fontSize: 12, color: "#e8f4ff", fontWeight: 500, marginBottom: 2 }}>{member.name}</div>
      <div style={{ fontSize: 10, color: isActive ? "#378ADD" : "#3a5a7a", letterSpacing: 1, marginBottom: 8 }}>
        {member.role.toUpperCase()}
      </div>
      <StatBar label="HLTH" value={member.health} />
      <StatBar label={member.extra.label.slice(0, 4).toUpperCase()} value={member.extra.value} />
    </div>
  );
}

// ── Typewriter hook ───────────────────────────────────────────────
function useTypewriter(text, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return { displayed, done };
}

// ── DM narration panel ────────────────────────────────────────────
const OPENING = `The rover crests the rim of Shackleton Crater and your displays flood with interference. Whatever is down there, it's broadcasting on a frequency that shouldn't exist — one reserved for Apollo-era transponders, silent for fifty years.\n\nDr. Reyes pulls up the geological scan. The anomaly isn't natural. Geometric. Deliberate.\n\nCommander Vasquez, you have the conn. What are your orders?`;

function NarrationPanel({ text, eventLog }) {
  const { displayed, done } = useTypewriter(text);
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0; }, [eventLog]);

  return (
    <div style={{ background: "#0a0e14", padding: 16, borderRight: "1px solid #1e3a5f", display: "flex", flexDirection: "column", minHeight: 520 }}>
      <div style={{ fontSize: 10, color: "#378ADD", letterSpacing: 2, marginBottom: 10, borderBottom: "1px solid #1e3a5f", paddingBottom: 6 }}>
        MISSION CONTROL // DM CHANNEL
      </div>
      <div style={{ flex: 1, lineHeight: 1.8, color: "#b0c4d8", fontSize: 13, marginBottom: 16, whiteSpace: "pre-wrap" }}>
        {displayed}
        {!done && <span style={{ display: "inline-block", width: 8, height: 14, background: "#378ADD", verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />}
      </div>
      <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: "#378ADD", letterSpacing: 2, marginBottom: 6 }}>EVENT LOG</div>
        <div ref={logRef} style={{ maxHeight: 120, overflow: "hidden" }}>
          {eventLog.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "2px 0" }}>
              <span style={{ color: "#1e3a5f", flexShrink: 0 }}>{e.ts}</span>
              <span style={{ color: i === 0 ? "#5DCAA5" : "#4a7a9a" }}>{e.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────
export default function ArtemisLost() {
  const [ws, setWs] = useState(INITIAL_WORLD_STATE);
  const [turn, setTurn] = useState(0);
  const [narration, setNarration] = useState(OPENING);
  const [conversationHistory, setConversationHistory] = useState([
    { role: "dm", text: OPENING },
  ]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const inputRef = useRef(null);

  const activeCrew = ws.crew[turn];
  const roleView = getViewForRole(ws, turn);

  async function handleSubmit() {
    if (!input.trim() || waiting) return;
    const action = input.trim();
    setInput("");
    setWaiting(true);

    const newLog = createActionLogEntry(ws, activeCrew, action);
    const nextHistory = appendConversationEntry(conversationHistory, {
      role: "player",
      text: `${activeCrew.name} (${activeCrew.role}): ${action}`,
    });

    const result = await requestDmTurn({
      worldState: ws,
      action,
      activeCrew,
      conversationHistory: nextHistory,
      currentTurn: turn,
    });

    if (result.error) {
      setNarration(
        `Could not reach the DM service.\n\n${result.error}\n\nCheck that both dev servers are running (\`npm run dev\`), your .env has ANTHROPIC_API_KEY, and ANTHROPIC_MODEL matches an available model.`
      );
      setWs((prev) => ({
        ...prev,
        eventLog: [newLog, ...prev.eventLog].slice(0, 12),
      }));
      setConversationHistory(nextHistory);
      setWaiting(false);
      setTurn((t) => getNextTurnIndex(ws.crew, t));
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    const { narration: nextText, stateDelta } = result;
    setWs((prev) => {
      const withAction = {
        ...prev,
        eventLog: [newLog, ...prev.eventLog].slice(0, 12),
      };
      return applyStateDelta(withAction, stateDelta);
    });
    setNarration(nextText);
    setConversationHistory(
      appendConversationEntry(nextHistory, {
        role: "dm",
        text: nextText,
      })
    );
    setWaiting(false);
    setTurn((t) => getNextTurnIndex(ws.crew, t));
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .al-input::placeholder { color: #2a4a6a; }
        .al-input:focus { outline: none; border-color: #378ADD; }
        .al-btn:hover { background: #378ADD44 !important; }
        .al-btn:active { transform: scale(0.97); }
      `}</style>

      <div style={{ background: "#0a0e14", color: "#c8d6e5", fontFamily: "'Share Tech Mono', 'Courier New', monospace", fontSize: 13, minHeight: 640 }}>

        {/* Header */}
        <div style={{ background: "#0d1219", borderBottom: "1px solid #1e3a5f", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#378ADD", letterSpacing: 2 }}>{ws.mission.id} // {ws.mission.name.toUpperCase()}</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#e8f4ff", letterSpacing: 1 }}>Artemis Lost</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { label: "MET",   val: ws.mission.met,                    warn: false },
              { label: "O2",    val: `${ws.systems.o2}%`,               warn: ws.systems.o2 < 80 },
              { label: "PWR",   val: ws.systems.power > 90 ? "NOMINAL" : `${ws.systems.power}%`, warn: ws.systems.power < 80 },
              { label: "COMMS", val: ws.systems.comms < 50 ? "DEGRADED" : "NOMINAL", warn: ws.systems.comms < 50 },
            ].map(s => (
              <div key={s.label} style={{ fontSize: 11, color: "#5a7a99", letterSpacing: 1 }}>
                {s.label} <span style={{ color: s.warn ? "#EF9F27" : "#1D9E75" }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplate: "auto 1fr / 1fr 320px", gap: 1, background: "#1e3a5f22" }}>

          {/* DM panel — spans both rows */}
          <div style={{ gridRow: "1 / 3" }}>
            <NarrationPanel text={narration} eventLog={ws.eventLog} />
          </div>

          {/* Crew status */}
          <div style={{ background: "#0a0e14", padding: 12 }}>
            <div style={{ fontSize: 10, color: "#378ADD", letterSpacing: 2, marginBottom: 10, borderBottom: "1px solid #1e3a5f", paddingBottom: 6 }}>
              CREW STATUS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {ws.crew.map((m, i) => <CrewCard key={m.id} member={m} isActive={i === turn} />)}
            </div>

            {/* Role view */}
            <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: "#378ADD", letterSpacing: 2, marginBottom: 8 }}>
                {activeCrew.role.toUpperCase()} VIEW
              </div>
              {roleView.map(({ key, val, warn }) => (
                <div key={key} style={{ fontSize: 11, lineHeight: 1.8 }}>
                  <span style={{ color: "#5a7a99" }}>{key.padEnd(11, "\u00a0")}</span>
                  <span style={{ color: warn ? "#EF9F27" : "#5DCAA5" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action input */}
          <div style={{ background: "#0d1219", borderTop: "1px solid #1e3a5f", padding: 12 }}>
            <div style={{ fontSize: 10, color: "#378ADD", letterSpacing: 2, marginBottom: 6 }}>ACTION INPUT</div>
            <div style={{ fontSize: 11, color: "#5DCAA5", marginBottom: 8 }}>
              {waiting ? "Waiting for DM response…" : `${activeCrew.name} (${activeCrew.role.toUpperCase()}) — your move`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef}
                className="al-input"
                style={{ flex: 1, background: "#0a0e14", border: "1px solid #1e3a5f", borderRadius: 4, color: "#c8d6e5", fontFamily: "inherit", fontSize: 12, padding: "8px 10px" }}
                placeholder={waiting ? "…" : `What does ${activeCrew.name} do?`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={waiting}
              />
              <button
                className="al-btn"
                style={{ background: "#378ADD22", border: "1px solid #378ADD55", color: "#378ADD", fontFamily: "inherit", fontSize: 11, letterSpacing: 1, padding: "0 14px", borderRadius: 4, cursor: "pointer", transition: "background 0.15s" }}
                onClick={handleSubmit}
                disabled={waiting}
              >
                TRANSMIT
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
