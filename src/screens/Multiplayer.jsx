import { useCallback, useEffect, useRef, useState } from "react";
import RoleView from "../components/RoleView.jsx";
import { getViewForRole } from "../game/roleFilters.js";
import { createCommandId, loadRoomCredentials, multiplayerRequest, saveRoomCredentials, subscribeToRoom } from "../services/multiplayerApi.js";
import "../styles/multiplayer.css";

const SEATS = [
  ["vasquez", "Commander"], ["okafor", "Flight Engineer"],
  ["reyes", "Science Officer"], ["park", "Mission Specialist"],
];

function SeatSelect({ id, value, onChange, members = [], memberId, disabled }) {
  return <label htmlFor={id}>Crew seat
    <select id={id} value={value || ""} onChange={(event) => onChange(event.target.value || null)} disabled={disabled}>
      <option value="">Observer</option>
      {SEATS.map(([seatId, role]) => {
        const owner = members.find((member) => member.seatId === seatId && member.id !== memberId);
        return <option key={seatId} value={seatId} disabled={Boolean(owner)}>{role}{owner ? ` — ${owner.name}` : ""}</option>;
      })}
    </select>
  </label>;
}

function EntryForm({ busy, onEnter }) {
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [seatId, setSeatId] = useState("vasquez");
  const [roomId, setRoomId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  return <section className="coop-panel" aria-labelledby="coop-entry-title">
    <h2 id="coop-entry-title">Assemble your crew</h2>
    <p>Share one mission with friends. Unclaimed seats are flown by AI, with each turn advanced by your crew.</p>
    <div className="coop-actions">
      <button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")} disabled={busy}>Create a room</button>
      <button type="button" aria-pressed={mode === "join"} onClick={() => setMode("join")} disabled={busy}>Join a room</button>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); onEnter(mode, { name: name.trim(), seatId, roomId: roomId.trim(), inviteCode: inviteCode.trim() }); }}>
      <label htmlFor="coop-name">Display name<input id="coop-name" autoComplete="nickname" required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
      <SeatSelect id="coop-entry-seat" value={seatId} onChange={setSeatId} disabled={busy} />
      {mode === "join" ? <>
        <label htmlFor="coop-room-id">Room ID<input id="coop-room-id" autoComplete="off" required value={roomId} onChange={(event) => setRoomId(event.target.value)} disabled={busy} /></label>
        <label htmlFor="coop-invite">Invite code<input id="coop-invite" autoComplete="off" required maxLength={128} value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} disabled={busy} /></label>
      </> : null}
      <button className="coop-primary" disabled={busy}>{busy ? "Connecting…" : mode === "create" ? "Create private room" : "Join crew"}</button>
    </form>
  </section>;
}

function CrewRoster({ room, busy, onSeat, onStart }) {
  const isHost = room.me?.id === room.hostMemberId;
  return <section className="coop-panel" aria-labelledby="coop-roster-title">
    <h2 id="coop-roster-title">Crew roster</h2>
    <ul className="coop-roster">
      {SEATS.map(([seatId, role]) => {
        const member = room.members.find((person) => person.seatId === seatId);
        return <li key={seatId}><strong>{role}</strong><span>{member ? `${member.name}${member.id === room.me?.id ? " (you)" : ""}` : "AI crew"}</span></li>;
      })}
      {room.members.filter((member) => !member.seatId).map((member) => <li key={member.id}><strong>Observer</strong><span>{member.name}{member.id === room.me?.id ? " (you)" : ""}</span></li>)}
    </ul>
    <SeatSelect id="coop-own-seat" value={room.me?.seatId} members={room.members} memberId={room.me?.id} onChange={onSeat} disabled={busy || room.status === "resolved"} />
    {room.status === "lobby" ? isHost
      ? <button className="coop-primary" onClick={onStart} disabled={busy}>Start shared mission</button>
      : <p>Waiting for the host to start the mission.</p> : null}
  </section>;
}

function MissionConsole({ room, busy, pending, onCommand, onRetry }) {
  const [action, setAction] = useState("");
  const world = room.session.worldState;
  const activeCrew = world.crew[room.session.turn];
  const ownIndex = world.crew.findIndex((member) => member.id === room.me?.seatId);
  const ownCrew = world.crew[ownIndex];
  const botTurn = activeCrew && !room.members.some((member) => member.seatId === activeCrew.id);
  const ownTurn = activeCrew?.id === room.me?.seatId;
  async function submit(bot = false) {
    const accepted = await onCommand(bot ? "" : action.trim(), bot);
    if (accepted) setAction("");
  }
  return <section className="coop-panel coop-mission" aria-labelledby="coop-mission-title">
    <h2 id="coop-mission-title">{world.mission.name}</h2>
    <p className="coop-telemetry">MET {world.mission.met} · {world.mission.phase}</p>
    <p className="coop-narration">{room.session.narration}</p>
    {room.status === "resolved" ? <div role="status"><h3>{world.mission.outcome?.title || "Mission resolved"}</h3><p>{world.mission.outcome?.summary}</p></div> : <p role="status">Current turn: {activeCrew?.role || "Awaiting crew"}{ownTurn ? " — your console" : botTurn ? " — AI crew" : " — waiting for your crewmate"}</p>}
    {ownCrew ? <RoleView activeCrew={ownCrew} roleView={getViewForRole(world, ownIndex)} worldState={world} activeTurn={ownIndex} /> : <p>Observer mode: follow the mission and coordinate in crew chat. Claim an open seat to take a console.</p>}
    {pending ? <div className="coop-pending"><p>Your last command has not been acknowledged. Retry it to recover the result without advancing twice.</p><button onClick={onRetry} disabled={busy}>Retry last command</button></div> : room.status === "active" ? ownTurn
      ? <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="coop-action">Your action<textarea id="coop-action" required maxLength={2000} value={action} onChange={(event) => setAction(event.target.value)} disabled={busy} /></label>
        <button className="coop-primary" disabled={busy}>{busy ? "Resolving turn…" : "Send action"}</button>
      </form>
      : botTurn ? <button className="coop-primary" onClick={() => void submit(true)} disabled={busy}>{busy ? "Resolving turn…" : "Advance AI turn"}</button> : null : null}
  </section>;
}

function CrewChat({ room, busy, onChat }) {
  const [text, setText] = useState("");
  return <section className="coop-panel" aria-labelledby="coop-chat-title">
    <h2 id="coop-chat-title">Crew chat</h2>
    <ol className="coop-chat" aria-label="Crew messages" aria-live="polite" aria-relevant="additions">
      {room.messages.map((message) => <li key={message.id}><strong>{message.name}</strong><p>{message.text}</p></li>)}
    </ol>
    {room.messages.length === 0 ? <p>No messages yet. Coordinate your next move here.</p> : null}
    <form onSubmit={async (event) => { event.preventDefault(); if (await onChat(text.trim())) setText(""); }}>
      <label htmlFor="coop-chat-input">Message to crew<textarea id="coop-chat-input" required maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} disabled={busy} /></label>
      <button disabled={busy}>Send message</button>
    </form>
  </section>;
}

export default function Multiplayer({ onBack, request = multiplayerRequest }) {
  const [credentials, setCredentials] = useState(loadRoomCredentials);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [reconnect, setReconnect] = useState(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const actionController = useRef(null);
  const credentialsRef = useRef(credentials);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; actionController.current?.abort(); };
  }, []);

  const remember = useCallback((next) => {
    credentialsRef.current = next;
    setStorageAvailable(saveRoomCredentials(next));
    setCredentials(next);
  }, []);
  const acceptRoom = useCallback((next) => {
    setRoom((current) => current?.id === next.id && current.revision > next.revision ? current : next);
    setConnected(true);
  }, []);
  const showFailure = useCallback((failure) => {
    if (failure.status === 401 || failure.status === 404) {
      remember(null); setRoom(null); setConnected(false);
      setError("Your room membership is no longer available. Join again with an invite.");
    } else {
      setConnected(false);
      setError(failure.name === "AbortError" ? "Connection timed out. Reconnect to check the room." : failure.message || "Connection lost. Reconnect to keep playing.");
    }
  }, [remember]);

  useEffect(() => {
    if (!credentials) return undefined;
    return subscribeToRoom(credentials, {
      request, isBusy: () => busyRef.current,
      onRoom: (next) => { acceptRoom(next); setError((current) => current.startsWith("Connection") ? "" : current); },
      onError: showFailure,
    });
  }, [credentials?.roomId, credentials?.token, reconnect, request, acceptRoom, showFailure]);

  async function perform(path, body, { credentials: override, onSuccess, onFailure } = {}) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError("");
    const auth = override || credentialsRef.current;
    actionController.current = new AbortController();
    try {
      const data = await request(path, { method: "POST", body, token: auth?.token, signal: actionController.current.signal });
      if (!mounted.current) return false;
      onSuccess?.(data);
      if (data.room && path.split("/").at(-1) !== "leave") acceptRoom(data.room);
      return true;
    } catch (failure) {
      if (mounted.current) { onFailure?.(failure); showFailure(failure); }
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const roomPath = credentials ? `/rooms/${encodeURIComponent(credentials.roomId)}` : "";
  async function enter(mode, fields) {
    const { roomId, inviteCode, ...body } = fields;
    await perform(mode === "create" ? "/rooms" : `/rooms/${encodeURIComponent(roomId)}/join`, mode === "create" ? body : { ...body, inviteCode }, {
      onSuccess: (data) => remember({ roomId: data.room.id, memberId: data.memberId, token: data.token, inviteCode: data.inviteCode }),
    });
  }
  async function sendCommand(action, bot, retry = false) {
    const pending = retry ? credentialsRef.current?.pending : { commandId: createCommandId(), expectedRevision: room.revision, action, bot };
    if (!pending || busyRef.current) return false;
    if (!retry) remember({ ...credentialsRef.current, pending });
    return perform(`${roomPath}/actions`, pending, {
      onSuccess: () => remember({ ...credentialsRef.current, pending: null }),
      onFailure: (failure) => {
        if (failure.status === 400 || failure.status === 403 || failure.status === 409) {
          remember({ ...credentialsRef.current, pending: null });
          setReconnect((value) => value + 1);
        }
      },
    });
  }
  return <main className="coop-shell">
    <header className="coop-header"><div><p className="coop-eyebrow">ARTEMIS LOST / PRIVATE CO-OP</p><h1>Shared mission control</h1></div><button onClick={onBack} disabled={busy}>Back to menu</button></header>
    <div className="coop-status" role="status">{busy ? "Contacting mission control…" : credentials ? connected ? "Connected · shared mission saved on server" : "Reconnecting to your crew…" : "Create a private room or join your crew."}</div>
    {error ? <div className="coop-error" role="alert"><p>{error}</p>{credentials ? <button onClick={() => { setError(""); setReconnect((value) => value + 1); }} disabled={busy}>Reconnect</button> : null}</div> : null}
    {!storageAvailable ? <p className="coop-notice">Browser storage is unavailable. You can keep playing in this tab, but closing it will lose your membership key.</p> : null}
    {!credentials ? <EntryForm busy={busy} onEnter={enter} /> : room ? <>
      <section className="coop-room-details" aria-label="Room details"><p>Room ID: <code>{room.id}</code></p>
        {credentials.inviteCode ? <p>Invite code: <code>{credentials.inviteCode}</code><span className="coop-muted"> Share this code and the room ID only with your crew.</span></p> : null}
        <button onClick={() => void perform(`${roomPath}/leave`, {}, { onSuccess: () => { remember(null); setRoom(null); setConnected(false); } })} disabled={busy}>Leave room</button>
      </section>
      <div className="coop-grid"><CrewRoster room={room} busy={busy || !connected || Boolean(credentials.pending)} onSeat={(seatId) => void perform(`${roomPath}/seat`, { seatId })} onStart={() => void perform(`${roomPath}/start`, {})} />
        {room.status !== "lobby" ? <MissionConsole room={room} busy={busy || !connected} pending={credentials.pending} onCommand={sendCommand} onRetry={() => void sendCommand("", false, true)} /> : <section className="coop-panel"><h2>Preflight</h2><p>Invite your friends and claim crew seats. The host launches the mission when your party is ready. Empty seats remain AI crew.</p></section>}
        <CrewChat room={room} busy={busy || !connected || Boolean(credentials.pending)} onChat={(text) => perform(`${roomPath}/chat`, { text })} />
      </div>
    </> : <section className="coop-panel"><h2>Restoring your mission</h2><p>Your room key is saved in this browser. Mission control will restore the shared state when connected.</p><button onClick={() => setReconnect((value) => value + 1)} disabled={busy}>Reconnect</button><button onClick={() => { remember(null); setRoom(null); }}>Forget saved membership</button></section>}
  </main>;
}
