import { useMemo, useState } from "react";
import ThemePicker from "../components/ThemePicker.jsx";
import {
  DEFAULT_CHARACTER_PROFILES,
  deriveCrewDynamics,
  generateCrewAroundPlayer,
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
  themeId,
  themes,
  onThemeChange,
}) {
  const [profiles, setProfiles] = useState(() => []);
  const [lockedProfileIds, setLockedProfileIds] = useState(() => new Set());
  const [playerRole, setPlayerRole] = useState(DEFAULT_CHARACTER_PROFILES[0]?.role || "Commander");
  const [playerName, setPlayerName] = useState("");
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

  function handleGenerateCrew() {
    const generatedProfiles = generateCrewAroundPlayer({
      playerName,
      playerRole,
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
      <form className="creator-panel" onSubmit={handleSubmit}>
        <div className="menu-panel__eyebrow">CREW ASSEMBLY</div>
        <h1 className="menu-panel__title">Character Creation</h1>
        <p className="menu-panel__copy">
          Tune the four rover specialists before the mission starts. These identities are
          carried into the save file, vault context, and DM prompt.
        </p>
        <div className="creator-slot">Target save slot: {slotId}</div>
        <div className="creator-slot">
          Human-controlled roles: {humanCount} / {profiles.length || DEFAULT_CHARACTER_PROFILES.length}
        </div>

        <ThemePicker
          themeId={themeId}
          themes={themes}
          onThemeChange={onThemeChange}
          title="INTERFACE THEME"
        />

        {!hasGeneratedCrew ? (
          <div className="creator-seed">
            <div className="creator-seed__header">
              <div>
                <div className="section-title section-title--mb-6">PLAYER INSERT</div>
                <div className="creator-seed__title">Claim one station before the roster rolls</div>
              </div>
            </div>
            <div className="creator-seed__summary">
              Choose the specialty you want to play, type your own name, and the rest of the crew
              will be generated around you.
            </div>
            <label className="creator-field">
              <span>Your specialty</span>
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
              <div className="section-title section-title--mb-6">MISSION SEED</div>
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
