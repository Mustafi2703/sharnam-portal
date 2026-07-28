/** Light / dark colour mode — keeps Sharnam teal design system intact */
export type ColorMode = "light" | "dark";

export const COLOR_MODE_KEY = "sharnam_color_mode";
export const SIDEBAR_HIDDEN_KEY = "sharnam_sidebar_hidden";

const LIGHT: Record<string, string> = {
  "--color-brand": "#0f766e",
  "--color-brand-dark": "#0d5f59",
  "--color-brand-soft": "#ecfdf8",
  "--color-brand-glow": "#2dd4bf",
  "--color-mark": "#dc2626",
  "--color-accent": "#0f766e",
  "--color-steel": "#1a1d26",
  "--color-steel-2": "#2a2f3a",
  "--color-steel-muted": "#4b5563",
  "--color-sand": "#eef6f4",
  "--color-ink": "#111827",
  "--color-paper": "#ffffff",
  "--color-line": "#d5e5e1",
  "--color-ok": "#059669",
  "--color-warn": "#b45309",
  "--color-danger": "#dc2626",
  "--color-procore-navy": "#0f766e",
  "--color-procore-blue": "#126e82",
  "--wd-chrome": "#ffffff",
  "--wd-chrome-border": "#d5e5e1",
  "--side-bg": "#ffffff",
  "--side-hover": "#f0fdfa",
  "--login-panel-bg": "#f7fbfa",
  "--login-panel-muted": "#4b5563",
  "--ui-radius": "14px",
  "--ui-radius-sm": "10px",
  "--ui-nav-h": "48px",
  "--ui-chrome-h": "48px",
  "--ui-gap": "1.5rem",
  "--font-display": '"Outfit", "Source Sans 3", system-ui, sans-serif',
  "--font-sans": '"Source Sans 3", "Outfit", system-ui, sans-serif',
};

const DARK: Record<string, string> = {
  "--color-brand": "#2dd4bf",
  "--color-brand-dark": "#5eead4",
  "--color-brand-soft": "#134e4a",
  "--color-brand-glow": "#99f6e4",
  "--color-mark": "#fb7185",
  "--color-accent": "#2dd4bf",
  "--color-steel": "#e5e7eb",
  "--color-steel-2": "#cbd5e1",
  "--color-steel-muted": "#94a3b8",
  "--color-sand": "#0f1419",
  "--color-ink": "#f1f5f9",
  "--color-paper": "#1a222d",
  "--color-line": "#2a3544",
  "--color-ok": "#34d399",
  "--color-warn": "#fbbf24",
  "--color-danger": "#f87171",
  "--color-procore-navy": "#2dd4bf",
  "--color-procore-blue": "#5eead4",
  "--wd-chrome": "#151b24",
  "--wd-chrome-border": "#2a3544",
  "--side-bg": "#151b24",
  "--side-hover": "#1e2936",
  "--login-panel-bg": "#151b24",
  "--login-panel-muted": "#94a3b8",
  "--ui-radius": "14px",
  "--ui-radius-sm": "10px",
  "--ui-nav-h": "48px",
  "--ui-chrome-h": "48px",
  "--ui-gap": "1.5rem",
  "--font-display": '"Outfit", "Source Sans 3", system-ui, sans-serif',
  "--font-sans": '"Source Sans 3", "Outfit", system-ui, sans-serif',
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

/** Boot: apply saved light/dark */
export function loadSavedTheme() {
  return applyColorMode(getColorMode());
}

/** @deprecated — legacy UI pack pages redirect to login; stubs keep imports compiling */
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
    blurb: "Bright teal surfaces for daytime office use.",
    icon: "☀",
    chip: "Light",
    style: "forest",
    density: "comfortable",
    radius: "soft",
    vars: LIGHT,
  },
  {
    id: "dark",
    number: 2,
    letter: "D",
    name: "Dark",
    blurb: "Deep charcoal chrome for night shifts.",
    icon: "☾",
    chip: "Dark",
    style: "night",
    density: "comfortable",
    radius: "soft",
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
