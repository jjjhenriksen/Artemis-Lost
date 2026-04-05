import { useState } from "react";
import TelemetryBackdrop from "../components/TelemetryBackdrop.jsx";

function formatSaveSummary(session) {
  if (!session?.worldState) return "No mission record on file.";

  const crewNames = session.worldState.crew.map((member) => member.name).join(", ");
  return `${session.worldState.mission.phase} | Turn ${session.turn} | Crew: ${crewNames}`;
}

export default function MainMenu({
  activeSession,
  activeSlotId,
  slots,
  onContinue,
  onDeleteSlot,
  onLoadSlot,
  onNewMission,
  onResumeMission,
}) {
  const hasActiveMission = Boolean(activeSession?.worldState);
  const hasContinueSlot = Boolean(activeSlotId);
  const continueSlot = slots.find((slot) => slot.id === activeSlotId)?.session;
  const [pendingDeleteSlot, setPendingDeleteSlot] = useState(null);

  return (
    <div className="menu-shell">
      <TelemetryBackdrop variant="menu" />
      <div className="menu-panel">
        <div className="menu-panel__eyebrow">LUNAR INCIDENT COMMAND</div>
        <h1 className="menu-panel__title">Artemis Lost</h1>
        <p className="menu-panel__copy">
          Assemble a field crew, review the latest incident records, and take command before the next window closes.
        </p>

        <div className="menu-actions">
          {hasContinueSlot ? (
            <button className="menu-button menu-button--primary" onClick={onContinue}>
              Continue {activeSlotId.toUpperCase()}
            </button>
          ) : null}
          {hasActiveMission ? (
            <button className="menu-button menu-button--primary" onClick={onResumeMission}>
              Resume Active Mission
            </button>
          ) : null}
        </div>

        {continueSlot ? (
          <div className="continue-card">
            <div className="save-card__label">CURRENT OPERATION</div>
            <div className="save-card__title">
              {continueSlot.worldState.mission.id} // {continueSlot.worldState.mission.name}
            </div>
            <div className="save-card__body">{formatSaveSummary(continueSlot)}</div>
          </div>
        ) : null}

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
                    Last contact: {slot.session.lastUpdatedIso || "Unlogged"}
                  </div>
                  <div className="slot-actions">
                    <button
                      className="menu-button menu-button--primary"
                      onClick={() => onLoadSlot(slot.id)}
                    >
                      Load
                    </button>
                    <button className="menu-button" onClick={() => onNewMission(slot.id)}>
                      Overwrite
                    </button>
                    <button
                      className="menu-button menu-button--danger"
                      onClick={() => setPendingDeleteSlot(slot)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="save-card__body">No mission record in this berth yet.</div>
                  <div className="slot-actions">
                    <button
                      className="menu-button menu-button--primary"
                      onClick={() => onNewMission(slot.id)}
                    >
                      New Mission
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {pendingDeleteSlot ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-panel">
              <div className="menu-panel__eyebrow">CONFIRM DELETE</div>
              <div className="modal-panel__title">Delete {pendingDeleteSlot.label}?</div>
              <div className="modal-panel__copy">
                This will permanently erase the operation record assigned to this berth.
              </div>
              <div className="creator-actions">
                <button className="menu-button" onClick={() => setPendingDeleteSlot(null)}>
                  Cancel
                </button>
                <button
                  className="menu-button menu-button--danger"
                  onClick={() => {
                    onDeleteSlot(pendingDeleteSlot.id);
                    setPendingDeleteSlot(null);
                  }}
                >
                  Delete Record
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
