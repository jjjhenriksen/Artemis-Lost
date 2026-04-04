export const DEFAULT_THEME_FAMILY_ID = "artemis";
export const DEFAULT_THEME_MODE = "dark";
export const DEFAULT_THEME_ID = `${DEFAULT_THEME_FAMILY_ID}-${DEFAULT_THEME_MODE}`;
export const THEME_STORAGE_KEY = "dungeonmaister-theme";

const LEGACY_THEME_IDS = {
  sh2025: "canopy-dark",
  sh1991: "nocturne-dark",
  artemis: "artemis-dark",
  canopy: "canopy-dark",
  nocturne: "nocturne-dark",
};

export const THEME_MODES = [
  {
    id: "dark",
    label: "Dark",
    description: "Low-light command deck contrast.",
  },
  {
    id: "light",
    label: "Light",
    description: "Day-shift control room brightness.",
  },
];

export const THEME_FAMILIES = [
  {
    id: "artemis",
    label: "Artemis",
    accent: "#6fd3ff",
    descriptions: {
      dark: "Cold command-console blues with a sharper editorial sci-fi finish.",
      light: "Steel-blue daylight instrumentation with a cleaner control-room read.",
    },
  },
  {
    id: "canopy",
    label: "Canopy",
    accent: "#2d6a4f",
    descriptions: {
      dark: "High-contrast sage, carbon, and gold with a clean signal-room edge.",
      light: "Muted sage and field-manual khaki tuned for a brighter operations deck.",
    },
  },
  {
    id: "nocturne",
    label: "Nocturne",
    accent: "#8c3d4f",
    descriptions: {
      dark: "Rose, smoke, and brass tuned into a sharper late-night noir interface.",
      light: "Dusty rose and brass under soft daylight with a warmer editorial finish.",
    },
  },
];

export const THEMES = THEME_FAMILIES.flatMap((family) =>
  THEME_MODES.map((mode) => ({
    ...family,
    id: buildThemeId(family.id, mode.id),
    familyId: family.id,
    mode: mode.id,
    modeLabel: mode.label,
    description: family.descriptions?.[mode.id] || family.descriptions?.[DEFAULT_THEME_MODE] || "",
  }))
);

export function buildThemeId(familyId = DEFAULT_THEME_FAMILY_ID, mode = DEFAULT_THEME_MODE) {
  return `${familyId}-${mode}`;
}

export function getThemeFamilyId(themeId = DEFAULT_THEME_ID) {
  const normalized = LEGACY_THEME_IDS[themeId] ?? themeId;
  const [familyId] = String(normalized).split("-");
  return THEME_FAMILIES.some((theme) => theme.id === familyId)
    ? familyId
    : DEFAULT_THEME_FAMILY_ID;
}

export function getThemeMode(themeId = DEFAULT_THEME_ID) {
  const normalized = LEGACY_THEME_IDS[themeId] ?? themeId;
  const [, mode] = String(normalized).split("-");
  return THEME_MODES.some((entry) => entry.id === mode) ? mode : DEFAULT_THEME_MODE;
}

export function getThemeById(themeId = DEFAULT_THEME_ID) {
  return THEMES.find((theme) => theme.id === themeId) || THEMES[0];
}

export function isValidTheme(themeId) {
  return THEMES.some((theme) => theme.id === themeId);
}

export function getStoredTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const resolvedTheme = LEGACY_THEME_IDS[storedTheme] ?? storedTheme;
  return isValidTheme(resolvedTheme) ? resolvedTheme : DEFAULT_THEME_ID;
}
