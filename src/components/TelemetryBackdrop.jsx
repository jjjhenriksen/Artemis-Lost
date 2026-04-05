export default function TelemetryBackdrop({ variant = "default" }) {
  return (
    <div
      className={`telemetry-backdrop telemetry-backdrop--${variant}`}
      aria-hidden="true"
    >
      <div className="telemetry-backdrop__field telemetry-backdrop__field--a" />
      <div className="telemetry-backdrop__field telemetry-backdrop__field--b" />
      <div className="telemetry-backdrop__scan telemetry-backdrop__scan--a" />
      <div className="telemetry-backdrop__scan telemetry-backdrop__scan--b" />
      <div className="telemetry-backdrop__cluster telemetry-backdrop__cluster--alpha">
        <span>STACK // NOMINAL</span>
        <span>LINK // TRACKING</span>
        <span>DRIFT // 0.02 DEG</span>
      </div>
      <div className="telemetry-backdrop__cluster telemetry-backdrop__cluster--beta">
        <span>GUIDANCE // HOLD</span>
        <span>THERMAL // STABLE</span>
        <span>CHANNEL // OPEN</span>
      </div>
      <div className="telemetry-backdrop__cluster telemetry-backdrop__cluster--gamma">
        <span>ATTITUDE // GREEN</span>
        <span>LATENCY // LOW</span>
        <span>SOLUTION // LIVE</span>
      </div>
    </div>
  );
}
