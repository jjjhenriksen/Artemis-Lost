const BINARY_COLUMNS = [
  "0100101101010010010011010101001001011010010010",
  "1010010010110101001001011010100100101101010010",
  "0010110101001001011010010010110101001011010010",
  "1101001001011010100100101101001001011010010010",
  "0101010010010110101001001011010010010110100100",
  "1001001011010010010110101001001011010100100101",
  "0110100100101101010010010110100100101101010010",
  "1011010010010110100100101101010010010110101001",
  "0010010110101001001011010010010110100100101101",
  "1100100101101010010010110100100101101001001011",
];

export default function TelemetryBackdrop({ variant = "default" }) {
  return (
    <div
      className={`telemetry-backdrop telemetry-backdrop--${variant}`}
      aria-hidden="true"
    >
      <div className="telemetry-backdrop__noise" />
      <div className="telemetry-backdrop__scanline telemetry-backdrop__scanline--top" />
      <div className="telemetry-backdrop__scanline telemetry-backdrop__scanline--bottom" />
      <div className="telemetry-backdrop__columns">
        {BINARY_COLUMNS.map((bits, index) => (
          <div
            key={`${variant}-${index}`}
            className={`telemetry-backdrop__column telemetry-backdrop__column--${(index % 4) + 1}`}
            style={{
              left: `${4 + index * 9.4}%`,
              animationDelay: `${index * -1.35}s`,
            }}
          >
            <span>{bits}</span>
            <span>{bits}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
