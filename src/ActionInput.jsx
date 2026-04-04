import TurnIndicator from "./TurnIndicator";
import { getRoleGuidance } from "./roleGuidance";
import {
  getRoleAlignmentPreview,
  getRoleMechanicSummary,
  getRoleSupportPreview,
} from "./roleMechanics";

function formatSetupStrength(strength) {
  if (strength === "strong") return "strong";
  if (strength === "fragile") return "fragile";
  return "soft";
}

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
  worldState,
  uiState,
}) {
  const roleGuidance = getRoleGuidance(worldState, activeCrew);
  const roleMechanicSummary = getRoleMechanicSummary(activeCrew);
  const roleAlignmentPreview = getRoleAlignmentPreview(activeCrew, input);
  const roleSupportPreview = getRoleSupportPreview(worldState, activeCrew, input);

  return (
    <div className="action-input">
      <div className="section-title section-title--mb-6">
        ACTION INPUT
      </div>

      <TurnIndicator
        activeCrew={activeCrew}
        waiting={waiting}
        coordinationAlert={uiState?.coordinationAlert}
      />

      <div className={`action-input__panel${waiting ? " action-input__panel--waiting" : ""}`}>
        {!waiting && !isBotTurn ? (
          <div className="action-input__focus">
            <div className="action-input__focus-label">TACTICAL FOCUS</div>
            <div className="action-input__focus-copy">{roleGuidance.focus}</div>
            <div className="action-input__hint">
              Role leverage: {roleMechanicSummary}
            </div>
            <div
              className={`action-input__alignment action-input__alignment--${roleAlignmentPreview.level}`}
            >
              <div className="action-input__alignment-chip">{roleAlignmentPreview.label}</div>
              <div className="action-input__alignment-copy">{roleAlignmentPreview.detail}</div>
            </div>
            {roleSupportPreview.incoming || roleSupportPreview.outgoing ? (
              <div className="action-input__support">
                {roleSupportPreview.delegationProfile ? (
                  <div className="action-input__support-row">
                    <span className="action-input__support-label">Command style</span>
                    <span className="action-input__support-copy">
                      {roleSupportPreview.delegationProfile.label[0].toUpperCase() +
                        roleSupportPreview.delegationProfile.label.slice(1)}
                      .
                    </span>
                  </div>
                ) : null}
                {roleSupportPreview.relationshipProfile ? (
                  <div className="action-input__support-row">
                    <span className="action-input__support-label">Crew fit</span>
                    <span className="action-input__support-copy">
                      {roleSupportPreview.relationshipProfile.label[0].toUpperCase() +
                        roleSupportPreview.relationshipProfile.label.slice(1)}
                      .
                    </span>
                  </div>
                ) : null}
                {roleSupportPreview.incoming ? (
                  <div className="action-input__support-row">
                    <span className="action-input__support-label">Incoming setup</span>
                    <span className="action-input__support-copy">
                      {roleSupportPreview.incoming.sourceCrewName} has opened a{" "}
                      {roleSupportPreview.incoming.strength} window for {activeCrew.name}.
                    </span>
                  </div>
                ) : null}
                {roleSupportPreview.outgoing ? (
                  <div className="action-input__support-row">
                    <span className="action-input__support-label">Follow-through</span>
                    <span className="action-input__support-copy">
                      {roleSupportPreview.outgoing.priorityHandoff
                        ? `This command hands initiative to ${roleSupportPreview.outgoing.targetCrewName} next with a ${formatSetupStrength(roleSupportPreview.outgoing.strength)} setup.`
                        : `This move can tee up ${roleSupportPreview.outgoing.targetCrewName} next${
                            roleSupportPreview.outgoing.strength
                              ? ` with a ${formatSetupStrength(roleSupportPreview.outgoing.strength)} setup`
                              : ""
                          }.`}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

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

        {!waiting && !isBotTurn && roleGuidance.suggestions.length > 0 ? (
          <div className="action-input__suggestions">
            {roleGuidance.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="action-input__suggestion"
                onClick={() => onChange(suggestion)}
              >
                {suggestion}
              </button>
            ))}
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
