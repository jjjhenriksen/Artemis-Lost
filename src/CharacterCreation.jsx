import { useState } from "react";
import { DEFAULT_CHARACTER_PROFILES } from "./worldState";

function cloneProfiles(profiles) {
  return profiles.map((profile) => ({ ...profile }));
}

export default function CharacterCreation({ onBack, onStartMission, slotId }) {
  const [profiles, setProfiles] = useState(() => cloneProfiles(DEFAULT_CHARACTER_PROFILES));

  function updateProfile(id, field, value) {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === id ? { ...profile, [field]: value } : profile
      )
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
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
      }))
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

        <div className="creator-grid">
          {profiles.map((profile) => (
            <section key={profile.id} className="creator-card">
              <div className="creator-card__title">{profile.role}</div>

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

        <div className="creator-actions">
          <button type="button" className="menu-button" onClick={onBack}>
            Back To Menu
          </button>
          <button
            type="button"
            className="menu-button"
            onClick={() => setProfiles(cloneProfiles(DEFAULT_CHARACTER_PROFILES))}
          >
            Reset Defaults
          </button>
          <button type="submit" className="menu-button menu-button--primary">
            Launch Mission
          </button>
        </div>
      </form>
    </div>
  );
}
