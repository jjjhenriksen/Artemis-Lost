import { useEffect } from "react";

const DEFAULT_DURATION_MS = 7200;
const REDUCED_MOTION_DURATION_MS = 1200;

export default function LaunchSequence({ session, slotId, onComplete }) {
  const mission = session?.worldState?.mission || {};
  const crew = session?.worldState?.crew || [];
  const roster = crew.map((member) => ({
    id: member.id,
    role: member.role,
    name: member.name,
    callSign: member.character?.callSign || "n/a",
  }));

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : DEFAULT_DURATION_MS;
    const timer = window.setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <section className="launch-screen" aria-label="Mission launch sequence">
      <div className="launch-screen__sky" aria-hidden="true">
        <div className="launch-screen__stars launch-screen__stars--near" />
        <div className="launch-screen__stars launch-screen__stars--far" />
        <div className="launch-screen__planet" />
        <div className="launch-screen__moon" />
        <div className="launch-screen__trail launch-screen__trail--left" />
        <div className="launch-screen__trail launch-screen__trail--right" />
      </div>

      <div className="launch-screen__hud">
        <div className="launch-screen__eyebrow">LAUNCH COMMIT</div>
        <h1 className="launch-screen__title">{mission.name || "Artemis Lost"}</h1>
        <p className="launch-screen__copy">
          {mission.briefing || "Crew locked. Mission vectors aligned. Light the engines."}
        </p>
        <div className="launch-screen__meta">
          <span>{mission.id || "ARTEMIS-07"}</span>
          <span>{mission.seedLabel || "Mission profile armed"}</span>
          <span>Save slot {slotId}</span>
        </div>
      </div>

      <div className="launch-pad" aria-hidden="true">
        <div className="launch-pad__tower launch-pad__tower--left" />
        <div className="launch-pad__tower launch-pad__tower--right" />
        <div className="launch-pad__service-arm" />
        <div className="launch-pad__smoke launch-pad__smoke--one" />
        <div className="launch-pad__smoke launch-pad__smoke--two" />
        <div className="launch-pad__smoke launch-pad__smoke--three" />

        <div className="rocket">
          <div className="rocket__contrail" />
          <div className="rocket__body">
            <div className="rocket__tip" />
            <div className="rocket__window rocket__window--top" />
            <div className="rocket__window rocket__window--mid" />
            <div className="rocket__fin rocket__fin--left" />
            <div className="rocket__fin rocket__fin--right" />
            <div className="rocket__engine" />
          </div>
          <div className="rocket__flame rocket__flame--core" />
          <div className="rocket__flame rocket__flame--glow" />
        </div>

        <div className="launch-pad__ground" />
      </div>

      <div className="launch-screen__manifest">
        <div className="launch-screen__manifest-title">Crew aboard</div>
        <div className="launch-screen__manifest-list">
          {roster.map((member) => (
            <div key={member.id} className="launch-screen__manifest-item">
              <span>{member.role}</span>
              <span>
                {member.name} // {member.callSign}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="launch-screen__skip" onClick={() => onComplete?.()}>
        Skip Launch
      </button>
    </section>
  );
}
