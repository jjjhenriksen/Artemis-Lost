import { memo } from "react";
import { getCrewCoordinationSnapshot } from "./roleMechanics";

function formatLedger(ledger) {
  if (ledger > 0) return `+${ledger}`;
  return String(ledger);
}

function RosterSummary({ crew, worldState }) {
  const coordination = getCrewCoordinationSnapshot(worldState);
  const activeSupportWindow = worldState?.mission?.supportWindow || null;

  return (
    <div className="roster-summary">
      <div className="section-title section-title--mb-10">CREW DOSSIER</div>
      <div className="roster-summary__list">
        {crew.map((member) => (
          <div key={member.id} className="roster-summary__item">
            <div className="roster-summary__name">
              {member.name} <span>{member.character?.callSign || member.role}</span>
            </div>
            <div className="roster-summary__line">
              Controller: {member.character?.controller === "bot" ? "Autonomous" : "Human"}
            </div>
            <div className="roster-summary__line">
              Trait: {member.character?.trait || "Unavailable"}
            </div>
            <div className="roster-summary__line">
              Flaw: {member.character?.flaw || "Unavailable"}
            </div>
          </div>
        ))}
      </div>
      <div className="roster-summary__state">
        <div className="section-title section-title--mb-10">LIVE COORDINATION</div>
        <div className="roster-summary__state-card">
          <div className="roster-summary__state-label">Active handoff</div>
          <div className="roster-summary__state-copy">
            {activeSupportWindow
              ? `${activeSupportWindow.sourceCrewName} -> ${activeSupportWindow.targetCrewName} (${activeSupportWindow.strength}${activeSupportWindow.priorityHandoff ? ", priority" : ""})`
              : "No live follow-through window."}
          </div>
        </div>
        <div className="roster-summary__coordination-list">
          {coordination.map((entry) => (
            <div key={entry.key} className="roster-summary__coordination-row">
              <div className="roster-summary__coordination-names">
                {entry.sourceCrewName} {"->"} {entry.targetCrewName}
              </div>
              <div
                className={`roster-summary__coordination-state roster-summary__coordination-state--${entry.state}`}
              >
                {entry.state}
              </div>
              <div className="roster-summary__coordination-ledger">
                {formatLedger(entry.ledger)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(RosterSummary);
