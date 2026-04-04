import { memo } from "react";
import { getConsoleBrief } from "./roleFilters";

const ROLE_FLAVOR = {
  Commander: "You hold the tempo. Weigh the signal, the crew, and the cost of every order.",
  "Flight Engineer":
    "Your console catches the strain first. Keep fragile systems alive long enough for the plan to work.",
  "Science Officer":
    "Patterns hide inside the noise. Separate discovery from danger before curiosity outruns caution.",
  "Mission Specialist":
    "You operate where the risk becomes physical. Every tool choice is a bet against the environment.",
};

function RoleView({ activeCrew, roleView, worldState, activeTurn, uiState }) {
  return (
    <div className={`role-view role-view--${uiState?.dangerLevel || "guarded"}`}>
      <div className="section-title section-title--mb-10">
        {activeCrew.role.toUpperCase()} VIEW
      </div>

      <div className="role-view__console">
        <div className="role-view__console-title">{activeCrew.name} console</div>
        <div className="role-view__console-copy role-view__console-copy--prefix">
          {uiState?.consolePrefix}
        </div>
        <div className="role-view__console-copy">
          {getConsoleBrief(worldState, activeTurn)}
        </div>
        <div className="role-view__console-copy role-view__console-copy--flavor">
          {ROLE_FLAVOR[activeCrew.role] ?? "Role-specific telemetry incoming."}
        </div>
      </div>

      <div className="role-view__list">
        {/* Render the filter output generically so upstream role logic can evolve safely. */}
        {roleView.map(({ key, val, warn }) => (
          <div
            key={key}
            className={`role-view__item${warn ? " role-view__item--warn" : ""}`}
          >
            <div className="role-view__key">{key}</div>
            <div className={`role-view__value${warn ? " role-view__value--warn" : ""}`}>
              {val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(RoleView);
