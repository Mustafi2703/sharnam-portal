/** Locked product UI — Graphite Procore (ui-2 / Navy Desk) */
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

const F = {
  plex: '"IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
};

/** Single live UI — matches https://sharnam-portal.onrender.com/ui/2 */
export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "ui-2",
    number: 2,
    letter: "2",
    name: "Graphite Procore",
    blurb: "Dense register · IBM Plex · sharp corners · charcoal chrome",
    icon: "▣",
    chip: "Procore",
    style: "graphite",
    density: "compact",
    radius: "sharp",
    vars: {
      "--color-brand": "#2563EB",
      "--color-brand-dark": "#0F172A",
      "--color-brand-soft": "#E2E8F0",
      "--color-brand-glow": "#60A5FA",
      "--color-mark": "#B91C1C",
      "--color-sand": "#E8EDF3",
      "--color-ink": "#020617",
      "--color-line": "#94A3B8",
      "--color-paper": "#F8FAFC",
      "--color-procore-navy": "#020617",
      "--color-procore-blue": "#2563EB",
      "--color-steel-muted": "#475569",
      "--color-ok": "#15803D",
      "--color-danger": "#DC2626",
      "--ui-radius": "4px",
      "--ui-radius-sm": "2px",
      "--ui-nav-h": "56px",
      "--ui-gap": "1.1rem",
      "--font-display": F.plex,
      "--font-sans": F.plex,
    },
  },
];

export const THEME_OPTIONS: ThemeOption[] = [...LIVE_UI_OPTIONS];
export const THEME_STORAGE_KEY = "sharnam_theme_option";
export const RECOMMENDED_UI = "ui-2";

export function getLiveOption(_numOrId?: string | number) {
  return LIVE_UI_OPTIONS[0];
}

export function applyThemeOption(_id?: string) {
  const opt = LIVE_UI_OPTIONS[0];
  const root = document.documentElement;
  Object.entries(opt.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-ui-style", opt.style);
  root.setAttribute("data-ui-density", opt.density);
  root.setAttribute("data-ui-radius", opt.radius);
  root.setAttribute("data-ui-option", String(opt.number));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, opt.id);
  } catch {
    /* ignore */
  }
  return opt;
}

export function loadSavedTheme() {
  return applyThemeOption(RECOMMENDED_UI);
}
