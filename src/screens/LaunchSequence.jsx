import { useEffect, useMemo, useState } from "react";

const DEFAULT_COUNTDOWN_STEP_MS = 1000;
const DEFAULT_ASCENT_DURATION_MS = 7200;
const REDUCED_MOTION_DURATION_MS = 1200;
const COUNTDOWN_START = 10;

const LAUNCH_STAGES = [
  { time: "T-06", label: "Fuel lines pressurized" },
  { time: "T-03", label: "Crew harnesses locked" },
  { time: "T-00", label: "Main engines commit" },
  { time: "T+04", label: "Tower clear" },
  { time: "T+11", label: "Orbital burn alignment" },
];

export default function LaunchSequence({ session, slotId, themeId, themes, onComplete }) {
  const [readyToContinue, setReadyToContinue] = useState(false);
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_START);
  const [elapsedMs, setElapsedMs] = useState(0);
  const mission = session?.worldState?.mission || {};
  const crew = session?.worldState?.crew || [];
  const slotLabel = session?.slotLabel || slotId?.replace(/^slot-/, "Slot ") || "Slot 1";
  const activeTheme = themes?.find((theme) => theme.id === themeId) || themes?.[0] || null;
  const roster = crew.map((member) => ({
    id: member.id,
    role: member.role,
    name: member.name,
    callSign: member.character?.callSign || "n/a",
  }));
  const telemetry = [
    { label: "Flight theme", value: activeTheme?.label || "Artemis", tone: "info" },
    { label: "Crew loaded", value: `${roster.length} specialists`, tone: "good" },
    { label: "Mission phase", value: mission.phase || "Launch window", tone: "info" },
    {
      label: "Risk pressure",
      value: mission.decisionPressure || "Window tightening across all systems.",
      tone: "warn",
    },
  ];
  const countdownDurationMs = useMemo(
    () => DEFAULT_COUNTDOWN_STEP_MS * COUNTDOWN_START,
    []
  );
  const totalDurationMs = useMemo(
    () => countdownDurationMs + DEFAULT_ASCENT_DURATION_MS,
    [countdownDurationMs]
  );
  const ascentElapsedMs = Math.max(0, elapsedMs - countdownDurationMs);
  const ascentProgress = Math.min(1, ascentElapsedMs / DEFAULT_ASCENT_DURATION_MS);
  const easedAscentProgress = 1 - (1 - ascentProgress) ** 3;
  const altitudeKm = ascentProgress <= 0 ? 0 : 184 * easedAscentProgress;
  const velocityKmPerSecond =
    ascentProgress <= 0 ? 0 : 7.6 * Math.min(1, 0.12 + ascentProgress * 0.98);
  const isRocketClearingFrame = readyToContinue || ascentProgress >= 0.965;
  const progressLabel =
    countdownValue > 0
      ? "Final countdown holding ascent systems in commit posture"
      : ascentProgress < 0.16
        ? "Main engines lit. Hold-down clamps released."
        : ascentProgress < 0.34
          ? "Vehicle clearing tower and building vertical velocity"
          : ascentProgress < 0.58
            ? "Guidance locked. Climbing through upper atmosphere corridor"
            : ascentProgress < 0.82
              ? "Ascent profile stabilizing toward orbital insertion"
              : "Vehicle off camera. Finalizing orbital burn alignment";

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : totalDurationMs;
    const startedAt = window.performance.now();
    const timer = window.setTimeout(() => {
      setReadyToContinue(true);
      setElapsedMs(totalDurationMs);
    }, duration);

    if (prefersReducedMotion) {
      setCountdownValue(0);
      setElapsedMs(totalDurationMs);
      return () => window.clearTimeout(timer);
    }

    const elapsedTimer = window.setInterval(() => {
      const nextElapsed = Math.min(totalDurationMs, window.performance.now() - startedAt);
      setElapsedMs(nextElapsed);
    }, 120);

    const countdownTimer = window.setInterval(() => {
      setCountdownValue((current) => {
        if (current <= 0) {
          window.clearInterval(countdownTimer);
          return 0;
        }
        return current - 1;
      });
    }, DEFAULT_COUNTDOWN_STEP_MS);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(elapsedTimer);
      window.clearInterval(countdownTimer);
    };
  }, []);

  return (
    <section
      className="launch-screen"
      aria-label="Mission launch sequence"
      style={
        {
          "--launch-start-delay": `${countdownDurationMs}ms`,
          "--launch-ascent-duration": `${DEFAULT_ASCENT_DURATION_MS}ms`,
          "--launch-sequence-duration": `${totalDurationMs}ms`,
        }
      }
    >
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
        <div className="launch-screen__theme">
          <span
            className="launch-screen__theme-swatch"
            style={{ "--launch-theme-accent": activeTheme?.accent || "#6fd3ff" }}
          />
          <div>
            <div className="launch-screen__theme-label">
              Interface theme: {activeTheme?.label || "Artemis"}
            </div>
            <div className="launch-screen__theme-copy">
              {activeTheme?.description || "Mission control visuals calibrated for ascent."}
            </div>
          </div>
        </div>
        <div className="launch-screen__meta">
          <span>{mission.id || "ARTEMIS-07"}</span>
          <span>{mission.seedLabel || "Mission profile armed"}</span>
          <span>{slotLabel}</span>
        </div>
        <div className="launch-screen__timeline">
          {LAUNCH_STAGES.map((stage) => (
            <div key={stage.time} className="launch-screen__timeline-item">
              <span>{stage.time}</span>
              <span>{stage.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="launch-screen__viewport">
        <div className="launch-screen__viewport-header">
          <span>Launch feed // pad camera 02</span>
          <span>Theme sync {activeTheme?.label || "Artemis"}</span>
        </div>
        <div className="launch-screen__viewport-frame" aria-hidden="true">
          <span className="launch-screen__viewport-corner launch-screen__viewport-corner--tl" />
          <span className="launch-screen__viewport-corner launch-screen__viewport-corner--tr" />
          <span className="launch-screen__viewport-corner launch-screen__viewport-corner--bl" />
          <span className="launch-screen__viewport-corner launch-screen__viewport-corner--br" />
          <div className="launch-screen__viewport-grid" />
        </div>
        {!readyToContinue ? (
          <div
            className="launch-screen__countdown"
            aria-live="polite"
          >
            <span
              className="launch-screen__countdown-value"
              style={{
                animationName:
                  countdownValue % 2 === 0
                    ? "launchCountdownPulseA"
                    : "launchCountdownPulseB",
              }}
            >
              {countdownValue}
            </span>
          </div>
        ) : null}
        <div
          className={`launch-pad${isRocketClearingFrame ? " launch-pad--complete" : ""}`}
          aria-hidden="true"
        >
          <div className="launch-pad__halo" />
          <div className="launch-pad__shockwave" />
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
              <div className="rocket__spine" />
              <div className="rocket__band rocket__band--top" />
              <div className="rocket__band rocket__band--mid" />
              <div className="rocket__band rocket__band--low" />
              <div className="rocket__wing rocket__wing--left" />
              <div className="rocket__wing rocket__wing--right" />
              <div className="rocket__engine" />
            </div>
            <div className="rocket__flame rocket__flame--core" />
            <div className="rocket__flame rocket__flame--glow" />
          </div>

          <div className="launch-pad__ground" />
          <div className="launch-pad__readout launch-pad__readout--left">
            <span>Altitude</span>
            <strong>{altitudeKm.toFixed(1)} km</strong>
          </div>
          <div className="launch-pad__readout launch-pad__readout--right">
            <span>Velocity</span>
            <strong>{velocityKmPerSecond.toFixed(1)} km/s</strong>
          </div>
        </div>
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
        <div className="launch-screen__telemetry">
          {telemetry.map((item) => (
            <div
              key={item.label}
              className={`launch-screen__telemetry-item launch-screen__telemetry-item--${item.tone}`}
            >
              <div className="launch-screen__telemetry-label">{item.label}</div>
              <div className="launch-screen__telemetry-value">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="launch-screen__progress">
          <div className="launch-screen__progress-label">
            {progressLabel}
          </div>
          <div className="launch-screen__progress-bar">
            <span />
          </div>
        </div>
      </div>

      <div className="launch-screen__actions">
        {!readyToContinue ? (
          <button type="button" className="launch-screen__skip" onClick={() => onComplete?.()}>
            Skip Launch
          </button>
        ) : null}
        <button
          type="button"
          className="launch-screen__continue"
          onClick={() => onComplete?.()}
          disabled={!readyToContinue}
        >
          {readyToContinue ? "Continue To Mission" : "Launch In Progress"}
        </button>
      </div>
    </section>
  );
}
