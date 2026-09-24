import { FONTS } from "./fonts";

export interface Theme {
  id: string;
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  card: string;
  wordColor: string;
  progressColor: string;
  fontFamily: string;
  displayFontFamily: string;
  radius: number;
}

const minimalLight: Theme = {
  id: "minimal-light",
  background: "#f7f7f5",
  foreground: "#18181b",
  accent: "#2563eb",
  muted: "#6b7280",
  card: "#ffffff",
  wordColor: "#111827",
  progressColor: "#2563eb",
  fontFamily: FONTS.inter,
  displayFontFamily: FONTS.poppins,
  radius: 28,
};

const boldDark: Theme = {
  id: "bold-dark",
  background: "#0b1020",
  foreground: "#f8fafc",
  accent: "#f43f5e",
  muted: "#94a3b8",
  card: "#141b2e",
  wordColor: "#ffffff",
  progressColor: "#f43f5e",
  fontFamily: FONTS.poppins,
  displayFontFamily: FONTS.poppins,
  radius: 32,
};

const chalkboard: Theme = {
  id: "chalkboard",
  background: "#1f3b2c",
  foreground: "#f4f1e8",
  accent: "#ffd166",
  muted: "#c7d2c9",
  card: "#264a37",
  wordColor: "#fffef7",
  progressColor: "#ffd166",
  fontFamily: FONTS.patrick,
  displayFontFamily: FONTS.patrick,
  radius: 20,
};

export const THEMES: Record<string, Theme> = {
  [minimalLight.id]: minimalLight,
  [boldDark.id]: boldDark,
  [chalkboard.id]: chalkboard,
};

export const DEFAULT_THEME = minimalLight;

export function getTheme(id: string): Theme {
  return THEMES[id] ?? DEFAULT_THEME;
}
