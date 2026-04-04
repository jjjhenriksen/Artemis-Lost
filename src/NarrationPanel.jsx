import { memo, useEffect, useRef } from "react";
import EventLog from "./EventLog";
import { useTypewriter } from "./useTypewriter";

function NarrationPanel({ text, eventLog, uiState, onTypewriterDone }) {
  const { displayed, done } = useTypewriter(text);
  const logRef = useRef(null);

  useEffect(() => {
    // New log entries are prepended, so keep the viewport pinned to the top.
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [eventLog]);

  useEffect(() => {
    onTypewriterDone?.(done);
  }, [done, onTypewriterDone]);

  return (
    <div className={`narration-panel narration-panel--${uiState?.dangerLevel || "guarded"}`}>
      <div className="section-title section-title--with-divider">
        MISSION CONTROL // DM CHANNEL
      </div>
      {uiState?.latestAlert ? (
        <div className={`mission-alert mission-alert--${uiState.latestAlert.type}`}>
          <span className="mission-alert__label">
            {uiState.latestAlert.label} // {uiState.latestAlert.ts}
          </span>
          <span className="mission-alert__message">{uiState.latestAlert.msg}</span>
        </div>
      ) : null}
      <div className="narration-panel__body">
        {displayed}
        {!done ? <span className="narration-panel__cursor" /> : null}
      </div>
      <div className="narration-panel__footer">
        <EventLog eventLog={eventLog} logRef={logRef} />
      </div>
    </div>
  );
}

export default memo(NarrationPanel);
