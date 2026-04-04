function formatSaveSummary(session) {
  if (!session?.worldState) return "Empty slot.";

  const crewNames = session.worldState.crew.map((member) => member.name).join(", ");
  return `${session.worldState.mission.phase} | Turn ${session.turn} | Crew: ${crewNames}`;
}

export default function MainMenu({
  activeSession,
  slots,
  onDeleteSlot,
  onLoadSlot,
  onNewMission,
  onResumeMission,
}) {
  const hasActiveMission = Boolean(activeSession?.worldState);

  return (
    <div className="menu-shell">
      <div className="menu-panel">
        <div className="menu-panel__eyebrow">LUNAR INCIDENT COMMAND</div>
        <h1 className="menu-panel__title">DungeonMAIster</h1>
        <p className="menu-panel__copy">
          Build a crew, manage multiple save slots, and re-enter Artemis Lost from the
          exact point where the pressure was highest.
        </p>

        <div className="menu-actions">
          {hasActiveMission ? (
            <button className="menu-button menu-button--primary" onClick={onResumeMission}>
              Resume Active Mission
            </button>
          ) : null}
        </div>

        <div className="slot-grid">
          {slots.map((slot) => (
            <div key={slot.id} className="save-card">
              <div className="save-card__label">{slot.label.toUpperCase()}</div>
              {slot.session ? (
                <>
                  <div className="save-card__title">
                    {slot.session.worldState.mission.id} // {slot.session.worldState.mission.name}
                  </div>
                  <div className="save-card__body">{formatSaveSummary(slot.session)}</div>
                  <div className="save-card__meta">
                    Last updated: {slot.session.lastUpdatedIso || "Unknown"}
                  </div>
                  <div className="slot-actions">
                    <button className="menu-button menu-button--primary" onClick={() => onLoadSlot(slot.id)}>
                      Load
                    </button>
                    <button className="menu-button" onClick={() => onNewMission(slot.id)}>
                      Overwrite
                    </button>
                    <button className="menu-button menu-button--danger" onClick={() => onDeleteSlot(slot.id)}>
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="save-card__body">
                    No saved mission in this slot yet.
                  </div>
                  <div className="slot-actions">
                    <button className="menu-button menu-button--primary" onClick={() => onNewMission(slot.id)}>
                      New Mission
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
