import { memo } from "react";

function CrewStatusBar({ mission, systems, uiState }) {
  const statusItems = [
    { label: "MET", val: mission.met, warn: false },
    { label: "O2", val: `${systems.o2}%`, warn: systems.o2 < 80 },
    {
      label: "PWR",
      val: systems.power > 90 ? "NOMINAL" : `${systems.power}%`,
      warn: systems.power < 80,
    },
    {
      label: "COMMS",
      val: systems.comms < 50 ? "DEGRADED" : "NOMINAL",
      warn: systems.comms < 50,
    },
    { label: "STATE", val: uiState?.dangerLevel?.toUpperCase() || "GUARDED", warn: uiState?.dangerLevel !== "guarded" },
  ];

  return (
    <div className={`status-strip status-strip--${uiState?.dangerLevel || "guarded"}`}>
      {statusItems.map((item) => (
        <div key={item.label} className="status-strip__item">
          {item.label}{" "}
          <span
            className={
              item.warn ? "status-strip__value--warn" : "status-strip__value--good"
            }
          >
            {item.val}
          </span>
        </div>
      ))}
    </div>
  );
}

export default memo(CrewStatusBar);
