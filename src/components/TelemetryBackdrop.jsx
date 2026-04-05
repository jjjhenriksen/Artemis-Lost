const TELEMETRY_PHRASES = [
  "I CAN BUT PERISH IF I GO",
  "I AM RESOLVED TO TRY",
  "FOR IF I STAY AWAY I KNOW",
  "I MUST FOREVER DIE",
  "A LAND OF DEEPEST SHADE",
  "UNPIERCED BY HUMAN THOUGHT",
  "THE DREARY REGIONS OF THE DEAD",
  "WHERE ALL THINGS ARE FORGOT",
  "THE DAY IS PAST AND GONE",
  "THE EVENING SHADES APPEAR",
  "MAY WE ALL REMEMBER WELL",
  "THE NIGHT OF DEATH DRAWS NEAR"
];

function toBinaryString(text) {
  return text
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
}

const BINARY_COLUMNS = TELEMETRY_PHRASES.map(toBinaryString);
const FULL_COLUMN_LAYOUT = [
  { left: "3.5%", top: "-12%", scale: 0.94, className: "telemetry-backdrop__column--1" },
  { left: "7.1%", top: "-6%", scale: 0.82, className: "telemetry-backdrop__column--4" },
  { left: "10.2%", top: "-4%", scale: 1.08, className: "telemetry-backdrop__column--3" },
  { left: "13.9%", top: "-18%", scale: 0.86, className: "telemetry-backdrop__column--1" },
  { left: "17.6%", top: "-16%", scale: 0.88, className: "telemetry-backdrop__column--2" },
  { left: "21.9%", top: "-9%", scale: 0.8, className: "telemetry-backdrop__column--4" },
  { left: "25.9%", top: "-7%", scale: 1.02, className: "telemetry-backdrop__column--4" },
  { left: "29.8%", top: "-19%", scale: 0.9, className: "telemetry-backdrop__column--1" },
  { left: "33.4%", top: "-20%", scale: 1.12, className: "telemetry-backdrop__column--2" },
  { left: "37.2%", top: "-11%", scale: 0.84, className: "telemetry-backdrop__column--3" },
  { left: "41.8%", top: "-9%", scale: 0.92, className: "telemetry-backdrop__column--1" },
  { left: "46.1%", top: "-17%", scale: 0.78, className: "telemetry-backdrop__column--4" },
  { left: "50.7%", top: "-14%", scale: 1.05, className: "telemetry-backdrop__column--3" },
  { left: "54.4%", top: "-7%", scale: 0.86, className: "telemetry-backdrop__column--2" },
  { left: "59.4%", top: "-5%", scale: 0.9, className: "telemetry-backdrop__column--4" },
  { left: "63.2%", top: "-20%", scale: 0.82, className: "telemetry-backdrop__column--1" },
  { left: "67.8%", top: "-18%", scale: 1.14, className: "telemetry-backdrop__column--2" },
  { left: "71.4%", top: "-9%", scale: 0.88, className: "telemetry-backdrop__column--3" },
  { left: "76.2%", top: "-8%", scale: 0.86, className: "telemetry-backdrop__column--1" },
  { left: "80.1%", top: "-18%", scale: 0.8, className: "telemetry-backdrop__column--4" },
  { left: "84.1%", top: "-15%", scale: 1.04, className: "telemetry-backdrop__column--3" },
  { left: "87.6%", top: "-7%", scale: 0.84, className: "telemetry-backdrop__column--2" },
  { left: "91.3%", top: "-6%", scale: 0.9, className: "telemetry-backdrop__column--4" },
  { left: "95.2%", top: "-16%", scale: 0.78, className: "telemetry-backdrop__column--1" },
];

const APP_SIDE_COLUMN_LAYOUT = [
  { left: "1.8%", top: "-12%", scale: 0.96, className: "telemetry-backdrop__column--1" },
  { left: "4.6%", top: "-6%", scale: 0.84, className: "telemetry-backdrop__column--4" },
  { left: "7.2%", top: "-17%", scale: 1.06, className: "telemetry-backdrop__column--3" },
  { left: "9.8%", top: "-8%", scale: 0.88, className: "telemetry-backdrop__column--2" },
  { left: "12.3%", top: "-20%", scale: 1.12, className: "telemetry-backdrop__column--2" },
  { left: "15.1%", top: "-10%", scale: 0.9, className: "telemetry-backdrop__column--1" },
  { left: "84.1%", top: "-14%", scale: 1.04, className: "telemetry-backdrop__column--3" },
  { left: "86.9%", top: "-7%", scale: 0.84, className: "telemetry-backdrop__column--2" },
  { left: "89.7%", top: "-18%", scale: 1.08, className: "telemetry-backdrop__column--4" },
  { left: "92.2%", top: "-9%", scale: 0.88, className: "telemetry-backdrop__column--1" },
  { left: "94.6%", top: "-16%", scale: 0.98, className: "telemetry-backdrop__column--3" },
  { left: "97.1%", top: "-6%", scale: 0.8, className: "telemetry-backdrop__column--4" },
];

export default function TelemetryBackdrop({ variant = "default" }) {
  const layout = variant === "app" ? APP_SIDE_COLUMN_LAYOUT : FULL_COLUMN_LAYOUT;

  return (
    <div
      className={`telemetry-backdrop telemetry-backdrop--${variant}`}
      aria-hidden="true"
    >
      <div className="telemetry-backdrop__noise" />
      <div className="telemetry-backdrop__scanline telemetry-backdrop__scanline--top" />
      <div className="telemetry-backdrop__scanline telemetry-backdrop__scanline--bottom" />
      <div className="telemetry-backdrop__columns">
        {layout.map((columnLayout, index) => {
          const bits = BINARY_COLUMNS[index % BINARY_COLUMNS.length];
          return (
          <div
            key={`${variant}-${index}`}
            className={`telemetry-backdrop__column ${columnLayout.className}`}
            style={{
              left: columnLayout.left,
              top: columnLayout.top,
              transform: `scale(${columnLayout.scale})`,
              animationDelay: `${index * -1.35}s`,
            }}
          >
            <span>{bits}</span>
            <span>{bits}</span>
            <span>{bits}</span>
            <span>{bits}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
