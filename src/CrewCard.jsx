import { memo } from "react";

function getStatColor(value) {
  if (value > 70) return "var(--stat-health)";
  if (value > 40) return "var(--stat-warning)";
  return "var(--stat-critical)";
}

function StatBar({ label, value, tone }) {
  const color = tone ?? getStatColor(value);

  return (
    <div className="stat-bar">
      <span className="stat-bar__label">{label}</span>
      <div className="stat-bar__track">
        <div
          className="stat-bar__fill"
          style={{ "--fill-width": `${value}%`, "--fill-color": color }}
        />
      </div>
      <span className="stat-bar__value">{value}%</span>
    </div>
  );
}

function CrewCard({ member, isActive, uiState }) {
  const accent = isActive ? "var(--stat-accent-active)" : "var(--stat-accent-idle)";
  // The third bar stays schema-light so Teammate 2 can keep driving it from `extra`.
  const extraLabel = member.extra.label.toUpperCase();
  const controllerLabel = member.character?.controller === "bot" ? "AUTONOMOUS" : "HUMAN";
  const stressLevel =
    member.health < 55 || member.morale < 50
      ? "critical"
      : member.health < 70 || member.morale < 65
        ? "warn"
        : "stable";

  return (
    <div
      className={`crew-card crew-card--${stressLevel} crew-card--scene-${uiState?.dangerLevel || "guarded"}${
        isActive ? " crew-card--active" : ""
      }`}
    >
      <div className="crew-card__header">
        <div>
          <div className="crew-card__name">{member.name}</div>
          <div className={`crew-card__role${isActive ? " crew-card__role--active" : ""}`}>
            {member.role.toUpperCase()}
          </div>
          <div className="crew-card__controller">{controllerLabel} CONTROL</div>
        </div>

        <div className={`crew-card__pill${isActive ? " crew-card__pill--active" : ""}`}>
          {isActive ? "ACTIVE TURN" : "STANDBY"}
        </div>
      </div>

      <div className="crew-card__message">
        {isActive
          ? "Crew channel open. Awaiting command priority and field action."
          : "Monitoring systems and holding for assignment handoff."}
      </div>

      <StatBar label="HEALTH" value={member.health} />
      <StatBar label="MORALE" value={member.morale} tone="var(--stat-morale)" />
      <StatBar label={extraLabel.slice(0, 6)} value={member.extra.value} tone={accent} />
    </div>
  );
}

export default memo(CrewCard);
