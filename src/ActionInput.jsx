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
              ? `${activeCrew.name} is running in autonomous mode and will act automatically this turn.`
              : `Queue a concise action for ${activeCrew.name}. Short, decisive commands read best.`}
        </div>

        {isBotTurn && botPreview ? (
          <div className="action-input__bot-preview">Autonomous action: {botPreview}</div>
        ) : null}

        <div className="action-input__row">
          <textarea
            ref={inputRef}
            className="al-input"
            placeholder={
              waiting
                ? "Command link locked while the DM responds..."
                : isBotTurn
                  ? `${activeCrew.name} is preparing an autonomous response...`
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
            disabled={waiting || isBotTurn}
          >
            {waiting ? "AWAITING DM" : isBotTurn ? "AUTONOMOUS TURN" : "TRANSMIT"}
          </button>
        </div>
      </div>
    </div>
  );
}
