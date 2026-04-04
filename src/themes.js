export const DEFAULT_THEME_ID = "artemis";
export const THEME_STORAGE_KEY = "dungeonmaister-theme";
const LEGACY_THEME_IDS = {
  sh2025: "canopy",
  sh1991: "nocturne",
};

export const THEMES = [
  {
    id: "artemis",
    label: "Artemis",
    accent: "#6fd3ff",
    description: "Cold command-console blues with a sharper editorial sci-fi finish.",
  },
  {
    id: "canopy",
    label: "Canopy",
    accent: "#2d6a4f",
    description: "High-contrast sage, carbon, and gold with a clean signal-room edge.",
  },
  {
    id: "nocturne",
    label: "Nocturne",
    accent: "#8c3d4f",
    description: "Rose, smoke, and brass tuned into a sharper late-night noir interface.",
  },
];

export function isValidTheme(themeId) {
  return THEMES.some((theme) => theme.id === themeId);
}

export function getStoredTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const resolvedTheme = LEGACY_THEME_IDS[storedTheme] ?? storedTheme;
  return isValidTheme(resolvedTheme) ? resolvedTheme : DEFAULT_THEME_ID;
}
