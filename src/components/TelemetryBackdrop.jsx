const TELEMETRY_PHRASES = [
  "I CAN BUT PERISH IF I GO",
  "I AM RESOLVED TO TRY",
  "FOR IF I STAY AWAY I KNOW",
  "I MUST FOREVER DIE",
  "I CAN BUT PERISH IF I GO",
  "I AM RESOLVED TO TRY",
  "FOR IF I STAY AWAY I KNOW",
  "I MUST FOREVER DIE",
  "I CAN BUT PERISH IF I GO",
  "I AM RESOLVED TO TRY",
];

function toBinaryString(text) {
  return text
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
}

const BINARY_COLUMNS = TELEMETRY_PHRASES.map(toBinaryString);

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
