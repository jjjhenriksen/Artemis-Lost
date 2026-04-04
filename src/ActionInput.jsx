import TurnIndicator from "./TurnIndicator";

export default function ActionInput({
  activeCrew,
  input,
  inputRef,
  onChange,
  onKeyDown,
  onSubmit,
  waiting,
  isBotTurn,
  botPreview,
  botPreviewLoading,
  narrationReady,
}) {
  return (
    <div className="action-input">
      <div className="section-title section-title--mb-6">
        ACTION INPUT
      </div>

      <TurnIndicator activeCrew={activeCrew} waiting={waiting} />

      <div className={`action-input__panel${waiting ? " action-input__panel--waiting" : ""}`}>
        <div className={`action-input__hint${waiting ? " action-input__hint--waiting" : ""}`}>
          {waiting
            ? "The DM is resolving the last move. Controls are temporarily locked."
            : isBotTurn
              ? botPreviewLoading
                ? `${activeCrew.name} is in autonomous mode and drafting a response from mission context.`
                : narrationReady
                ? `${activeCrew.name} is in autonomous mode. Advance when you're ready for the next turn.`
                : `${activeCrew.name} is in autonomous mode and waiting for the DM channel to finish transmitting.`
              : `Queue a concise action for ${activeCrew.name}. Short, decisive commands read best.`}
        </div>

        {isBotTurn && botPreview ? (
          <div className="action-input__bot-preview">
            {botPreviewLoading ? "Drafting autonomous action..." : "Autonomous action:"} {botPreview}
          </div>
        ) : null}

        <div className="action-input__row">
          <textarea
            ref={inputRef}
            className="al-input"
            placeholder={
              waiting
                ? "Command link locked while the DM responds..."
                : isBotTurn
                  ? botPreviewLoading
                    ? "Autonomous planner is drafting the next action..."
                    : narrationReady
                    ? `${activeCrew.name} is preparing an autonomous response...`
                    : "Autonomous handoff is waiting on the current narration..."
                  : `What does ${activeCrew.name} do?`
            }
            value={input}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={waiting || isBotTurn}
            rows={5}
          />
          <button
            className="al-btn"
            onClick={onSubmit}
            disabled={waiting || (isBotTurn && (!narrationReady || botPreviewLoading))}
          >
            {waiting
              ? "AWAITING DM"
              : isBotTurn
                ? botPreviewLoading
                  ? "DRAFTING TURN"
                  : narrationReady
                  ? "CONTINUE AUTONOMOUS TURN"
                  : "READING CHANNEL"
                : "TRANSMIT"}
          </button>
        </div>
      </div>
    </div>
  );
}
