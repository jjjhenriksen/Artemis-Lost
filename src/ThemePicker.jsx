import {
  buildThemeId,
  getThemeById,
  getThemeFamilyId,
  getThemeMode,
  THEME_FAMILIES,
  THEME_MODES,
} from "./themes";

export default function ThemePicker({
  themeId,
  onThemeChange,
  title = "VISUAL THEME",
  compact = false,
}) {
  const activeTheme = getThemeById(themeId);
  const activeMode = getThemeMode(themeId);
  const activeFamilyId = getThemeFamilyId(themeId);
  const isLightMode = activeMode === "light";

  if (compact) {
    return (
      <section className="theme-picker theme-picker--compact">
        <div className="theme-picker__chip-row">
          <button
            type="button"
            className="theme-picker__chip theme-picker__chip--mode"
            onClick={() =>
              onThemeChange(buildThemeId(activeFamilyId, isLightMode ? "dark" : "light"))
            }
            aria-pressed={isLightMode}
            aria-label={`Switch to ${isLightMode ? "dark" : "light"} mode`}
            title={THEME_MODES.find((mode) => mode.id === activeMode)?.description}
          >
            <span className="theme-picker__chip-icon" aria-hidden="true">
              {isLightMode ? "☀" : "☾"}
            </span>
            <span className="theme-picker__chip-text">{isLightMode ? "Light" : "Dark"}</span>
          </button>
          <span className="theme-picker__chip theme-picker__chip--label">{title}</span>
          <label className="theme-picker__chip theme-picker__chip--select">
            <span className="theme-picker__sr-only">Theme</span>
            <span
              className="theme-picker__summary-swatch theme-picker__summary-swatch--compact"
              style={{ "--theme-accent": activeTheme.accent }}
              aria-hidden="true"
            />
            <select
              className="theme-picker__chip-select"
              value={activeFamilyId}
              onChange={(event) => onThemeChange(buildThemeId(event.target.value, activeMode))}
              aria-label="Theme family"
            >
              {THEME_FAMILIES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
            <span className="theme-picker__caret" aria-hidden="true">
              ▾
            </span>
          </label>
        </div>
      </section>
    );
  }

  return (
    <section className="theme-picker">
      <div className="theme-picker__label">{title}</div>
      <div className="theme-picker__controls">
        <div className="theme-picker__field">
          <span className="theme-picker__field-label">Mode</span>
          <button
            type="button"
            className={`theme-picker__mode-switch${isLightMode ? " theme-picker__mode-switch--light" : ""}`}
            onClick={() =>
              onThemeChange(buildThemeId(activeFamilyId, isLightMode ? "dark" : "light"))
            }
            aria-pressed={isLightMode}
            aria-label={`Switch to ${isLightMode ? "dark" : "light"} mode`}
          >
            <span className="theme-picker__mode-icon" aria-hidden="true">
              {isLightMode ? "☀" : "☾"}
            </span>
            <span className="theme-picker__mode-track">
              <span className="theme-picker__mode-thumb" />
            </span>
            <span className="theme-picker__mode-copy">
              {THEME_MODES.find((mode) => mode.id === activeMode)?.description}
            </span>
          </button>
        </div>

        <label className="theme-picker__field">
          <span className="theme-picker__field-label">Theme</span>
          <span className="theme-picker__select-wrap">
            <select
              className="theme-picker__select"
              value={activeFamilyId}
              onChange={(event) => onThemeChange(buildThemeId(event.target.value, activeMode))}
            >
              {THEME_FAMILIES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
            <span className="theme-picker__caret" aria-hidden="true">
              ▾
            </span>
          </span>
        </label>
      </div>

      <div className="theme-picker__summary" title={activeTheme.description}>
        <span
          className="theme-picker__summary-swatch"
          style={{ "--theme-accent": activeTheme.accent }}
          aria-hidden="true"
        />
        <span className="theme-picker__summary-copy">
          <span className="theme-picker__summary-title">
            {activeTheme.label} / {activeTheme.modeLabel}
          </span>
          {!compact ? (
            <span className="theme-picker__summary-description">{activeTheme.description}</span>
          ) : null}
        </span>
      </div>

      <div className="theme-picker__preview" aria-hidden="true">
        <span className="theme-picker__preview-swatch theme-picker__preview-swatch--surface" />
        <span className="theme-picker__preview-swatch theme-picker__preview-swatch--panel" />
        <span className="theme-picker__preview-swatch theme-picker__preview-swatch--accent" />
      </div>
    </section>
  );
}
