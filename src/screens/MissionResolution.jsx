import { useEffect, useState } from "react";
import TelemetryBackdrop from "../components/TelemetryBackdrop.jsx";

const DEFAULT_RESOLUTION_DURATION_MS = 4400;
const REDUCED_MOTION_DURATION_MS = 1200;

export default function MissionResolution({
  worldState,
  narration,
  slotId,
  onReturnToMenu,
  onReviewMission,
}) {
  const [readyToContinue, setReadyToContinue] = useState(false);
  const mission = worldState?.mission || {};
  const crew = worldState?.crew || [];
  const outcome = mission?.outcome || { status: "active", title: "", summary: "" };
  const healthyCrewCount = crew.filter((member) => member.health > 25).length;
  const isVictory = outcome.status === "victory";
  const systemSummary = [
    `O2 ${worldState?.systems?.o2 ?? 0}%`,
    `PWR ${worldState?.systems?.power ?? 0}%`,
    `COMMS ${worldState?.systems?.comms ?? 0}%`,
  ].join(" // ");

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => setReadyToContinue(true),
      prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : DEFAULT_RESOLUTION_DURATION_MS
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section
      className={`resolution-screen resolution-screen--${outcome.status}`}
      aria-label="Mission resolution"
    >
      <TelemetryBackdrop variant={isVictory ? "victory" : "defeat"} />
      <div className="resolution-screen__sky" aria-hidden="true">
        <div className="resolution-screen__orb resolution-screen__orb--planet" />
        <div className="resolution-screen__orb resolution-screen__orb--horizon" />
        {isVictory ? (
          <>
            <div className="resolution-screen__spray resolution-screen__spray--left" />
            <div className="resolution-screen__spray resolution-screen__spray--right" />
          </>
        ) : null}
      </div>

      <div className="resolution-screen__panel">
        <div className="resolution-screen__eyebrow">
          {outcome.status === "victory" ? "RECOVERY CONFIRMED" : "MISSION TERMINATION"}
        </div>
        <h1 className="resolution-screen__title">{outcome.title || "Mission End"}</h1>
        <p className="resolution-screen__copy">{outcome.summary}</p>

        <div className="resolution-screen__meta">
          <span>{mission.id || "ARTEMIS-07"}</span>
          <span>{mission.name || "Artemis Lost"}</span>
          <span>{slotId || "berth-1"}</span>
        </div>

        <div className="resolution-screen__sequence" aria-hidden="true">
          {isVictory ? (
            <div className="resolution-screen__capsule resolution-screen__capsule--recovery">
              <div className="resolution-screen__capsule-body" />
              <div className="resolution-screen__capsule-window" />
              <div className="resolution-screen__impact-ring" />
              <div className="resolution-screen__impact-column resolution-screen__impact-column--left" />
              <div className="resolution-screen__impact-column resolution-screen__impact-column--right" />
              <div className="resolution-screen__droplets resolution-screen__droplets--left">
                <span />
                <span />
                <span />
              </div>
              <div className="resolution-screen__droplets resolution-screen__droplets--right">
                <span />
                <span />
                <span />
              </div>
              <div className="resolution-screen__capsule-wake" />
            </div>
          ) : (
            <div className="resolution-screen__capsule resolution-screen__capsule--drift">
              <div className="resolution-screen__capsule-body" />
              <div className="resolution-screen__capsule-window" />
              <div className="resolution-screen__capsule-beacon" />
              <div className="resolution-screen__capsule-trail" />
            </div>
          )}
        </div>

        <div className="resolution-screen__summary-grid">
          <div className="resolution-screen__card">
            <div className="resolution-screen__card-label">Recovery state</div>
            <div className="resolution-screen__card-value">
              {isVictory ? "Splashdown nominal" : "Drift beacon active"}
            </div>
            <div className="resolution-screen__card-copy">
              Crew viable: {healthyCrewCount}/{crew.length}. {systemSummary}
            </div>
          </div>

          <div className="resolution-screen__card">
            <div className="resolution-screen__card-label">Mission record</div>
            <div className="resolution-screen__card-value">
              {mission.phase || "Final state logged"}
            </div>
            <div className="resolution-screen__card-copy">
              {outcome.status === "victory" ? "Recovery brief in progress." : "Loss brief in progress."}
            </div>
          </div>
        </div>

        <div className="resolution-screen__narration">
          {(narration || "").split("\n")[0]}
        </div>

        <div className="resolution-screen__actions">
          <button
            type="button"
            className="resolution-screen__button resolution-screen__button--secondary"
            onClick={onReviewMission}
            disabled={!readyToContinue}
          >
            Review Debrief
          </button>
          <button
            type="button"
            className="resolution-screen__button"
            onClick={onReturnToMenu}
            disabled={!readyToContinue}
          >
            Return To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
