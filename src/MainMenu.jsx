function formatSaveSummary(session) {
  if (!session?.worldState) return "No mission data available.";

  const crewNames = session.worldState.crew.map((member) => member.name).join(", ");
  return `${session.worldState.mission.phase} | Turn ${session.turn} | Crew: ${crewNames}`;
}

export default function MainMenu({
  activeSession,
  savedSession,
  onLoadSave,
  onNewMission,
  onResumeMission,
}) {
  const hasActiveMission = Boolean(activeSession?.worldState);
  const hasSavedMission = Boolean(savedSession?.worldState);

  return (
    <div className="menu-shell">
      <div className="menu-panel">
        <div className="menu-panel__eyebrow">LUNAR INCIDENT COMMAND</div>
        <h1 className="menu-panel__title">DungeonMAIster</h1>
        <p className="menu-panel__copy">
          Build a crew, drop into Artemis Lost, and let the DM run the pressure curve.
        </p>

        <div className="menu-actions">
          {hasActiveMission ? (
            <button className="menu-button menu-button--primary" onClick={onResumeMission}>
              Resume Active Mission
            </button>
          ) : null}

          <button className="menu-button menu-button--primary" onClick={onNewMission}>
            New Mission
          </button>

          <button
            className="menu-button"
            onClick={onLoadSave}
            disabled={!hasSavedMission}
          >
            Load Saved Mission
          </button>
        </div>

        <div className="save-card">
          <div className="save-card__label">SAVE SLOT</div>
          {hasSavedMission ? (
            <>
              <div className="save-card__title">
                {savedSession.worldState.mission.id} // {savedSession.worldState.mission.name}
              </div>
              <div className="save-card__body">{formatSaveSummary(savedSession)}</div>
              <div className="save-card__meta">
                Last updated: {savedSession.lastUpdatedIso || "Unknown"}
              </div>
            </>
          ) : (
            <div className="save-card__body">
              No saved mission detected yet. Create a crew to generate your first save slot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
