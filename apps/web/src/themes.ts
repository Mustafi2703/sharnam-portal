/** Light / dark — logo teal (#0B6A78) + graphite Procore chrome + amber mark */
export type ColorMode = "light" | "dark";

export const COLOR_MODE_KEY = "sharnam_color_mode";
export const SIDEBAR_HIDDEN_KEY = "sharnam_sidebar_hidden";

/** Matches logo cyan/teal + construction amber */
const LIGHT: Record<string, string> = {
  "--color-brand": "#0B6A78",
  "--color-brand-dark": "#085560",
  "--color-brand-soft": "#E6F4F6",
  "--color-brand-glow": "#14B8A6",
  "--color-mark": "#C45C26",
  "--color-accent": "#0B6A78",
  "--color-steel": "#16181C",
  "--color-steel-2": "#2A2F38",
  "--color-steel-muted": "#5C6570",
  "--color-sand": "#F0F2F4",
  "--color-ink": "#121417",
  "--color-paper": "#FFFFFF",
  "--color-line": "#D5DADD",
  "--color-ok": "#0F766E",
  "--color-warn": "#B45309",
  "--color-danger": "#C0352B",
  "--color-procore-navy": "#2C3340",
  "--color-procore-blue": "#0B6A78",
  "--color-kpi-1": "#0B6A78",
  "--color-kpi-2": "#C45C26",
  "--color-kpi-3": "#2563EB",
  "--color-kpi-4": "#7C3AED",
  "--color-kpi-5": "#059669",
  "--color-kpi-6": "#DB2777",
  "--wd-chrome": "#FFFFFF",
  "--wd-chrome-border": "#D5DADD",
  "--side-bg": "#1C222B",
  "--side-fg": "#E8ECF0",
  "--side-muted": "#9AA3AE",
  "--side-hover": "#2A323E",
  "--side-active": "#0B6A78",
  "--side-active-bg": "rgba(11, 106, 120, 0.22)",
  "--side-border": "#2E3642",
  "--login-panel-bg": "#FFFFFF",
  "--login-panel-muted": "#5C6570",
  "--ui-radius": "8px",
  "--ui-radius-sm": "6px",
  "--ui-nav-h": "52px",
  "--ui-chrome-h": "52px",
  "--ui-gap": "1.25rem",
  "--font-display": '"Space Grotesk", "Source Sans 3", system-ui, sans-serif',
  "--font-sans": '"IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
};

const DARK: Record<string, string> = {
  "--color-brand": "#2EC4B6",
  "--color-brand-dark": "#5EEAD4",
  "--color-brand-soft": "#0F2A2E",
  "--color-brand-glow": "#5EEAD4",
  "--color-mark": "#F0783A",
  "--color-accent": "#2EC4B6",
  "--color-steel": "#E8ECF0",
  "--color-steel-2": "#CBD5E1",
  "--color-steel-muted": "#94A3B8",
  "--color-sand": "#0C0E11",
  "--color-ink": "#F1F5F9",
  "--color-paper": "#161A20",
  "--color-line": "#2A313C",
  "--color-ok": "#34D399",
  "--color-warn": "#FBBF24",
  "--color-danger": "#F87171",
  "--color-procore-navy": "#2EC4B6",
  "--color-procore-blue": "#5EEAD4",
  "--color-kpi-1": "#2EC4B6",
  "--color-kpi-2": "#F0783A",
  "--color-kpi-3": "#60A5FA",
  "--color-kpi-4": "#A78BFA",
  "--color-kpi-5": "#34D399",
  "--color-kpi-6": "#F472B6",
  "--wd-chrome": "#12151A",
  "--wd-chrome-border": "#2A313C",
  "--side-bg": "#0A0C0F",
  "--side-fg": "#F1F5F9",
  "--side-muted": "#94A3B8",
  "--side-hover": "#1A1F27",
  "--side-active": "#2EC4B6",
  "--side-active-bg": "rgba(46, 196, 182, 0.18)",
  "--side-border": "#1E2430",
  "--login-panel-bg": "#12151A",
  "--login-panel-muted": "#94A3B8",
  "--ui-radius": "8px",
  "--ui-radius-sm": "6px",
  "--ui-nav-h": "52px",
  "--ui-chrome-h": "52px",
  "--ui-gap": "1.25rem",
  "--font-display": '"Space Grotesk", "Source Sans 3", system-ui, sans-serif',
  "--font-sans": '"IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
};

export function getColorMode(): ColorMode {
  try {
    const m = localStorage.getItem(COLOR_MODE_KEY);
    if (m === "dark" || m === "light") return m;
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyColorMode(mode: ColorMode) {
  const root = document.documentElement;
  const vars = mode === "dark" ? DARK : LIGHT;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;
  try {
    localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  return mode;
}

export function toggleColorMode(): ColorMode {
  const next = getColorMode() === "dark" ? "light" : "dark";
  return applyColorMode(next);
}

export function loadSavedTheme() {
  return applyColorMode(getColorMode());
}

export type ThemeOption = {
  id: string;
  number: 1 | 2 | 3 | 4 | 5;
  letter: string;
  name: string;
  blurb: string;
  icon: string;
  chip: string;
  style: "amber" | "graphite" | "forest" | "blueprint" | "night";
  density: "comfortable" | "compact";
  radius: "soft" | "sharp" | "pill";
  vars: Record<string, string>;
};

export const THEME_STORAGE_KEY = COLOR_MODE_KEY;
export const RECOMMENDED_UI = "light";

export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "light",
    number: 1,
    letter: "L",
    name: "Light",
    blurb: "Graphite Procore light — logo teal chrome.",
    icon: "☀",
    chip: "Light",
    style: "graphite",
    density: "comfortable",
    radius: "sharp",
    vars: LIGHT,
  },
  {
    id: "dark",
    number: 2,
    letter: "D",
    name: "Dark",
    blurb: "Night desk — high contrast for site/office.",
    icon: "☾",
    chip: "Dark",
    style: "night",
    density: "comfortable",
    radius: "sharp",
    vars: DARK,
  },
];

export const THEME_OPTIONS = LIVE_UI_OPTIONS;

export function getLiveOption(numOrId?: string | number) {
  const key = String(numOrId ?? getColorMode());
  return (
    LIVE_UI_OPTIONS.find((o) => o.id === key || String(o.number) === key) ||
    LIVE_UI_OPTIONS[getColorMode() === "dark" ? 1 : 0]
  );
}

export function applyThemeOption(id?: string) {
  const mode: ColorMode = id === "dark" || id === "2" ? "dark" : "light";
  applyColorMode(mode);
  return getLiveOption(mode);
}
