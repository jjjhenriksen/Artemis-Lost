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
const COLUMN_LAYOUT = [
  { left: "3.5%", top: "-12%", scale: 0.94, className: "telemetry-backdrop__column--1" },
  { left: "11.8%", top: "-4%", scale: 1.08, className: "telemetry-backdrop__column--3" },
  { left: "21.2%", top: "-16%", scale: 0.88, className: "telemetry-backdrop__column--2" },
  { left: "30.4%", top: "-7%", scale: 1.02, className: "telemetry-backdrop__column--4" },
  { left: "38.1%", top: "-20%", scale: 1.12, className: "telemetry-backdrop__column--2" },
  { left: "47.6%", top: "-9%", scale: 0.92, className: "telemetry-backdrop__column--1" },
  { left: "58.8%", top: "-14%", scale: 1.05, className: "telemetry-backdrop__column--3" },
  { left: "69.1%", top: "-5%", scale: 0.9, className: "telemetry-backdrop__column--4" },
  { left: "79.6%", top: "-18%", scale: 1.14, className: "telemetry-backdrop__column--2" },
  { left: "90.4%", top: "-8%", scale: 0.86, className: "telemetry-backdrop__column--1" },
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
          (() => {
            const layout = COLUMN_LAYOUT[index];
            return (
          <div
            key={`${variant}-${index}`}
            className={`telemetry-backdrop__column ${layout.className}`}
            style={{
              left: layout.left,
              top: layout.top,
              transform: `scale(${layout.scale})`,
              animationDelay: `${index * -1.35}s`,
            }}
          >
            <span>{bits}</span>
            <span>{bits}</span>
          </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}
