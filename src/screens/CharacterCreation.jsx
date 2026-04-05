import { useMemo, useState } from "react";
import TelemetryBackdrop from "../components/TelemetryBackdrop.jsx";
import {
  DEFAULT_CHARACTER_PROFILES,
  deriveCrewDynamics,
  generateCrewAroundPlayer,
  getCallSignExamplesForRole,
  rerollCharacterProfile,
  rerollCharacterProfiles,
  resolveMissionSeed,
} from "../game/worldState.js";
import { MISSION_SEEDS, pickMissionSeed, getMissionSeedById } from "../game/missionSeeds.js";

function cloneProfiles(profiles) {
  return profiles.map((profile) => ({ ...profile }));
}

export default function CharacterCreation({
  onBack,
  onStartMission,
  slotId,
}) {
  const [profiles, setProfiles] = useState(() => []);
  const [lockedProfileIds, setLockedProfileIds] = useState(() => new Set());
  const [playerRole, setPlayerRole] = useState(DEFAULT_CHARACTER_PROFILES[0]?.role || "Commander");
  const [playerName, setPlayerName] = useState("");
  const [playerCallSign, setPlayerCallSign] = useState("");
  const [hasGeneratedCrew, setHasGeneratedCrew] = useState(false);
  const [missionSeed, setMissionSeed] = useState(() => pickMissionSeed());
  const crewDynamics = useMemo(() => deriveCrewDynamics(profiles), [profiles]);
  const resolvedMissionSeed = useMemo(
    () => resolveMissionSeed(missionSeed, profiles),
    [missionSeed, profiles]
  );
  const lockedCount = lockedProfileIds.size;
  const humanCount = profiles.filter((profile) => profile.controller !== "bot").length;
  const roleOptions = DEFAULT_CHARACTER_PROFILES.map((profile) => ({
    id: profile.id,
    role: profile.role,
  }));
  const playerCallSignExamples = getCallSignExamplesForRole(playerRole);

  function handleGenerateCrew() {
    const generatedProfiles = generateCrewAroundPlayer({
      playerName,
      playerRole,
      playerCallSign,
    });
    const selectedProfile = generatedProfiles.find((profile) => profile.role === playerRole);
    setProfiles(generatedProfiles);
    setLockedProfileIds(new Set(selectedProfile ? [selectedProfile.id] : []));
    setHasGeneratedCrew(true);
  }

  function toggleLockedProfile(id) {
    setLockedProfileIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateProfile(id, field, value) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === id ? { ...profile, [field]: value } : profile
      )
    );
  }

  function rerollSingleProfile(profileId) {
    if (lockedProfileIds.has(profileId)) return;
    setProfiles((current) => rerollCharacterProfile(current, profileId));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!hasGeneratedCrew) return;
    onStartMission(
      slotId,
      profiles.map((profile) => ({
        ...profile,
        name: profile.name.trim(),
        callSign: profile.callSign.trim(),
        trait: profile.trait.trim(),
        specialty: profile.specialty.trim(),
        flaw: profile.flaw.trim(),
        personalStake: profile.personalStake.trim(),
        controller: profile.controller === "bot" ? "bot" : "human",
      })),
      missionSeed
    );
  }

  return (
    <div className="menu-shell">
      <TelemetryBackdrop variant="creator" />
      <form className="creator-panel" onSubmit={handleSubmit}>
        <div className="menu-panel__eyebrow">CREW ASSEMBLY</div>
        <h1 className="menu-panel__title">Crew Assembly</h1>
        <p className="menu-panel__copy">
          Lock in who is riding this operation before the hatch seals. The crew you choose will carry the whole mission.
        </p>
        <div className="creator-slot">Assigned berth: {slotId}</div>
        <div className="creator-slot">
          Human-controlled roles: {humanCount} / {profiles.length || DEFAULT_CHARACTER_PROFILES.length}
        </div>

        {!hasGeneratedCrew ? (
          <div className="creator-seed">
            <div className="creator-seed__header">
              <div>
                <div className="section-title section-title--mb-6">PLAYER INSERT</div>
                <div className="creator-seed__title">Claim your station before the roster fills</div>
              </div>
            </div>
            <div className="creator-seed__summary">
              Choose the station you will hold, enter the name you want on the manifest, and command will fill the remaining seats around you.
            </div>
            <label className="creator-field">
              <span>Your role</span>
              <select
                className="creator-input"
                value={playerRole}
                onChange={(event) => setPlayerRole(event.target.value)}
              >
                {roleOptions.map((option) => (
                  <option key={option.id} value={option.role}>
                    {option.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="creator-field">
              <span>Your name</span>
              <input
                className="creator-input"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Type your own name"
                required
              />
            </label>
            <label className="creator-field">
              <span>Your call sign</span>
              <input
                className="creator-input"
                value={playerCallSign}
                onChange={(event) => setPlayerCallSign(event.target.value)}
                placeholder={playerCallSignExamples.join(" / ")}
              />
            </label>
            <div className="creator-seed__summary">
              Call sign examples for {playerRole}: {playerCallSignExamples.join(", ")}.
              A few recognized names will still use their preset callsigns.
            </div>
            <div className="creator-actions">
              <button type="button" className="menu-button" onClick={onBack}>
                Back To Menu
              </button>
              <button
                type="button"
                className="menu-button menu-button--primary"
                onClick={handleGenerateCrew}
                disabled={!playerName.trim()}
              >
                Generate Crew
              </button>
            </div>
          </div>
        ) : null}

        {hasGeneratedCrew && crewDynamics.summary ? (
          <div className="creator-dynamics">
            <div className="section-title section-title--mb-6">CREW DYNAMIC</div>
            <div className="creator-dynamics__copy">{crewDynamics.summary}</div>
          </div>
        ) : null}

        {hasGeneratedCrew ? (
        <div className="creator-seed">
          <div className="creator-seed__header">
            <div>
              <div className="section-title section-title--mb-6">INCIDENT PROFILE</div>
              <div className="creator-seed__title">{resolvedMissionSeed.label}</div>
            </div>
            <button
              type="button"
              className="menu-button"
              onClick={() => setMissionSeed((current) => pickMissionSeed(current?.id))}
            >
              Reroll Mission
            </button>
          </div>
          <div className="creator-seed__summary">{resolvedMissionSeed.summary}</div>
          <div className="creator-seed__summary">{resolvedMissionSeed.decisionPressure}</div>
          <div className="creator-seed__summary">
            Suggested opening: {resolvedMissionSeed.suggestedOpening}
          </div>
          <div className="creator-seed__meta">
            <span>{resolvedMissionSeed.environment.location}</span>
            <span>{resolvedMissionSeed.environment.pressure}</span>
            <span>{resolvedMissionSeed.mission.phase}</span>
            <span>{resolvedMissionSeed.tone.join(" / ")}</span>
          </div>
        </div>
        ) : null}

        {hasGeneratedCrew ? (
        <div className="creator-grid">
          {profiles.map((profile) => (
            <section key={profile.id} className="creator-card">
              <div className="creator-card__header">
                <div className="creator-card__title">{profile.role}</div>
                <div className="creator-card__controls">
                  <button
                    type="button"
                    className={`creator-pill ${profile.controller !== "bot" ? "creator-pill--active" : ""}`}
                    onClick={() => updateProfile(profile.id, "controller", "human")}
                  >
                    Human
                  </button>
                  <button
                    type="button"
                    className={`creator-pill ${profile.controller === "bot" ? "creator-pill--active" : ""}`}
                    onClick={() => updateProfile(profile.id, "controller", "bot")}
                  >
                    Autonomous
                  </button>
                  <button
                    type="button"
                    className={`creator-pill ${lockedProfileIds.has(profile.id) ? "creator-pill--active" : ""}`}
                    onClick={() => toggleLockedProfile(profile.id)}
                  >
                    {lockedProfileIds.has(profile.id) ? "Locked" : "Unlocked"}
                  </button>
                  <button
                    type="button"
                    className="creator-pill"
                    onClick={() => rerollSingleProfile(profile.id)}
                    disabled={lockedProfileIds.has(profile.id)}
                    title={
                      lockedProfileIds.has(profile.id)
                        ? "Unlock this crew member before rerolling."
                        : "Reroll this crew member."
                    }
                  >
                    Reroll This
                  </button>
                </div>
              </div>

              <label className="creator-field">
                <span>Name</span>
                <input
                  className="creator-input"
                  value={profile.name}
                  onChange={(event) => updateProfile(profile.id, "name", event.target.value)}
                  required
                />
              </label>

              <label className="creator-field">
                <span>Call Sign</span>
                <input
                  className="creator-input"
                  value={profile.callSign}
                  onChange={(event) =>
                    updateProfile(profile.id, "callSign", event.target.value)
                  }
                  required
                />
              </label>

              <label className="creator-field">
                <span>Core Trait</span>
                <input
                  className="creator-input"
                  value={profile.trait}
                  onChange={(event) => updateProfile(profile.id, "trait", event.target.value)}
                  required
                />
              </label>

              <label className="creator-field">
                <span>Specialty</span>
                <input
                  className="creator-input"
                  value={profile.specialty}
                  onChange={(event) =>
                    updateProfile(profile.id, "specialty", event.target.value)
                  }
                  required
                />
              </label>

              <label className="creator-field">
                <span>Flaw</span>
                <input
                  className="creator-input"
                  value={profile.flaw}
                  onChange={(event) => updateProfile(profile.id, "flaw", event.target.value)}
                  required
                />
              </label>

              <label className="creator-field">
                <span>Personal Stake</span>
                <textarea
                  className="creator-input creator-input--textarea"
                  value={profile.personalStake}
                  onChange={(event) =>
                    updateProfile(profile.id, "personalStake", event.target.value)
                  }
                  rows={3}
                  required
                />
              </label>
            </section>
          ))}
        </div>
        ) : null}

        {hasGeneratedCrew ? (
        <div className="creator-actions">
          <button type="button" className="menu-button" onClick={onBack}>
            Back To Menu
          </button>
          <button
            type="button"
            className="menu-button"
            onClick={() => {
              setProfiles([]);
              setLockedProfileIds(new Set());
              setPlayerRole(DEFAULT_CHARACTER_PROFILES[0]?.role || "Commander");
              setPlayerName("");
              setPlayerCallSign("");
              setHasGeneratedCrew(false);
              setMissionSeed(getMissionSeedById(MISSION_SEEDS[0]?.id));
            }}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            className="menu-button"
            onClick={() => setProfiles((current) => rerollCharacterProfiles(current, lockedProfileIds))}
          >
            Reroll Crew{lockedCount ? ` (${lockedCount} locked)` : ""}
          </button>
          <button
            type="submit"
            className="menu-button menu-button--primary"
            disabled={humanCount === 0}
          >
            Launch Mission
          </button>
        </div>
        ) : null}
      </form>
    </div>
  );
}
