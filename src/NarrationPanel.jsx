import { useEffect, useRef } from "react";
import EventLog from "./EventLog";
import { useTypewriter } from "./useTypewriter";

export default function NarrationPanel({ text, eventLog }) {
  const { displayed, done } = useTypewriter(text);
  const logRef = useRef(null);

  useEffect(() => {
    // New log entries are prepended, so keep the viewport pinned to the top.
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [eventLog]);

  return (
    <div className="narration-panel">
      <div className="section-title section-title--with-divider">
        MISSION CONTROL // DM CHANNEL
      </div>
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
