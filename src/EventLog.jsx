import { memo } from "react";
import { getEventTypeLabel, normalizeEventType } from "./eventLogTypes";

function EventLog({ eventLog, logRef }) {
  return (
    <>
      <div className="section-title section-title--mb-6">
        EVENT LOG
      </div>
      <div ref={logRef} className="event-log">
        {eventLog.map((event, index) => (
          <div key={`${event.ts}-${event.msg}-${index}`} className="event-log__row">
            <span className="event-log__timestamp">{event.ts}</span>
            <span
              className={`event-log__tag event-log__tag--${normalizeEventType(event.type)}`}
            >
              {getEventTypeLabel(event.type)}
            </span>
            <span
              className={`event-log__message${
                index === 0 ? " event-log__message--latest" : ""
              }`}
            >
              {event.msg}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export default memo(EventLog);
