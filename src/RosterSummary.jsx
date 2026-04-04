import { memo } from "react";

function RosterSummary({ crew }) {
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
    </div>
  );
}

export default memo(RosterSummary);
