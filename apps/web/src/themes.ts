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
  "--color-steel-muted": "#3F4752",
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
  "--chart-1": "#0B6A78",
  "--chart-2": "#C45C26",
  "--chart-3": "#2563EB",
  "--chart-4": "#7C3AED",
  "--chart-5": "#059669",
  "--chart-6": "#DB2777",
  "--wd-chrome": "#FFFFFF",
  "--wd-chrome-border": "#D5DADD",
  "--side-bg": "#F7F9FB",
  "--side-fg": "#121417",
  "--side-muted": "#3F4752",
  "--side-hover": "#E8EEF2",
  "--side-active": "#0B6A78",
  "--side-active-bg": "rgba(11, 106, 120, 0.12)",
  "--side-border": "#D5DADD",
  "--login-panel-bg": "#FFFFFF",
  "--login-panel-muted": "#5C6570",
  "--ui-radius": "8px",
  "--ui-radius-sm": "6px",
  "--ui-nav-h": "52px",
  "--ui-chrome-h": "52px",
  "--ui-gap": "1.25rem",
  "--font-display": '"Sora", "Space Grotesk", "Source Sans 3", system-ui, sans-serif',
  "--font-sans": '"Manrope", "IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
};

const DARK: Record<string, string> = {
  "--color-brand": "#0F766E",
  "--color-brand-dark": "#7EE8DC",
  "--color-brand-soft": "#143840",
  "--color-brand-glow": "#2EC4B6",
  "--color-mark": "#F0783A",
  "--color-accent": "#7EE8DC",
  "--color-steel": "#E8ECF0",
  "--color-steel-2": "#D5DEE8",
  "--color-steel-muted": "#C5D0DC",
  "--color-sand": "#10141A",
  "--color-ink": "#F4F7FB",
  "--color-paper": "#1A2129",
  "--color-line": "#3A4554",
  "--color-ok": "#34D399",
  "--color-warn": "#FBBF24",
  "--color-danger": "#F87171",
  "--color-procore-navy": "#7EE8DC",
  "--color-procore-blue": "#2EC4B6",
  "--color-kpi-1": "#2EC4B6",
  "--color-kpi-2": "#F0783A",
  "--color-kpi-3": "#60A5FA",
  "--color-kpi-4": "#A78BFA",
  "--color-kpi-5": "#34D399",
  "--color-kpi-6": "#F472B6",
  "--chart-1": "#2EC4B6",
  "--chart-2": "#F0783A",
  "--chart-3": "#60A5FA",
  "--chart-4": "#A78BFA",
  "--chart-5": "#34D399",
  "--chart-6": "#F472B6",
  "--wd-chrome": "#10141A",
  "--wd-chrome-border": "#3A4554",
  "--side-bg": "#0E1218",
  "--side-fg": "#F4F7FB",
  "--side-muted": "#C5D0DC",
  "--side-hover": "#1C2430",
  "--side-active": "#7EE8DC",
  "--side-active-bg": "rgba(14, 118, 110, 0.35)",
  "--side-border": "#2A3442",
  "--login-panel-bg": "#1A2129",
  "--login-panel-muted": "#C5D0DC",
  "--ui-radius": "8px",
  "--ui-radius-sm": "6px",
  "--ui-nav-h": "52px",
  "--ui-chrome-h": "52px",
  "--ui-gap": "1.25rem",
  "--font-display": '"Sora", "Space Grotesk", "Source Sans 3", system-ui, sans-serif',
  "--font-sans": '"Manrope", "IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
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
  // Reset module overlay tokens; route handlers re-apply accent when needed
  root.style.setProperty("--wd-accent", vars["--color-brand"]);
  root.style.removeProperty("--mod-accent");
  root.style.removeProperty("--mod-soft");
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
  applyColorMode(next);
  const accent = document.documentElement.dataset.moduleAccent;
  const soft = document.documentElement.dataset.moduleSoft;
  if (accent && soft) {
    applyModuleAccent(accent, soft);
  }
  return next;
}

export function loadSavedTheme() {
  return applyColorMode(getColorMode());
}

/** Fired after light/dark flip so project modules can re-apply accent on top. */
export const MODULE_THEME_EVENT = "sharnam:module-theme";

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(hex: string, toward: string, amount: number) {
  const a = parseHex(hex);
  const b = parseHex(toward);
  if (!a || !b) return hex;
  return toHex(
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount
  );
}

function withAlpha(hex: string, alpha: number) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Apply module accent across chrome, buttons, charts, and action panel.
 * Construction amber stays as secondary contrast (--color-mark / kpi-2).
 */
export function applyModuleAccent(accent: string, soft: string) {
  const root = document.documentElement;
  const dark = getColorMode() === "dark";
  // Fill is dark enough for white button text; brand-dark is light enough to read on paper.
  const fill = dark ? mixHex(accent, "#0B0E13", 0.42) : accent;
  const ink = dark ? mixHex(accent, "#ffffff", 0.48) : mixHex(accent, "#000000", 0.28);
  const softBg = dark ? mixHex(accent, "#0B0E13", 0.78) : soft;
  const glow = dark ? mixHex(accent, "#ffffff", 0.28) : mixHex(accent, "#ffffff", 0.35);
  const kpi2 = dark ? "#F0783A" : "#C45C26";
  const kpi3 = mixHex(accent, "#2563EB", 0.45);
  const kpi4 = mixHex(accent, "#7C3AED", 0.4);
  const kpi5 = mixHex(accent, "#059669", 0.35);
  const kpi6 = mixHex(accent, "#DB2777", 0.4);

  root.style.setProperty("--mod-accent", fill);
  root.style.setProperty("--mod-soft", softBg);
  root.style.setProperty("--color-brand", fill);
  root.style.setProperty("--color-brand-dark", ink);
  root.style.setProperty("--color-brand-soft", softBg);
  root.style.setProperty("--color-brand-glow", glow);
  root.style.setProperty("--color-accent", dark ? ink : accent);
  root.style.setProperty("--color-procore-blue", dark ? ink : accent);
  root.style.setProperty("--side-active", dark ? ink : accent);
  root.style.setProperty("--side-active-bg", withAlpha(accent, dark ? 0.28 : 0.22));
  root.style.setProperty("--wd-accent", fill);
  root.style.setProperty("--color-kpi-1", dark ? ink : accent);
  root.style.setProperty("--color-kpi-2", kpi2);
  root.style.setProperty("--color-kpi-3", kpi3);
  root.style.setProperty("--color-kpi-4", kpi4);
  root.style.setProperty("--color-kpi-5", kpi5);
  root.style.setProperty("--color-kpi-6", kpi6);
  root.style.setProperty("--chart-1", dark ? ink : accent);
  root.style.setProperty("--chart-2", kpi2);
  root.style.setProperty("--chart-3", kpi3);
  root.style.setProperty("--chart-4", kpi4);
  root.style.setProperty("--chart-5", kpi5);
  root.style.setProperty("--chart-6", kpi6);
  root.dataset.moduleAccent = accent;
  root.dataset.moduleSoft = soft;
}

export function clearModuleAccent() {
  const root = document.documentElement;
  delete root.dataset.moduleAccent;
  delete root.dataset.moduleSoft;
  applyColorMode(getColorMode());
}

export function notifyModuleTheme() {
  try {
    window.dispatchEvent(new Event(MODULE_THEME_EVENT));
  } catch {
    /* ignore */
  }
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
