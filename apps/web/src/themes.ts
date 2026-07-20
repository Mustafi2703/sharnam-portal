/** Five live construction UI systems — colors + structural style (no stock photos) */
export type ThemeOption = {
  id: string;
  number: 1 | 2 | 3 | 4 | 5;
  letter: string;
  name: string;
  blurb: string;
  style: "amber" | "graphite" | "forest" | "blueprint" | "night";
  density: "comfortable" | "compact";
  radius: "soft" | "sharp" | "pill";
  vars: Record<string, string>;
};

/** Options 1–5 shown on Render /options and /ui/1…/ui/5 */
export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "ui-1",
    number: 1,
    letter: "1",
    name: "Site Amber",
    blurb: "Warm PMC desk · soft cards · Sharnam orange + cyan",
    style: "amber",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#e4632a",
      "--color-brand-dark": "#c24d1a",
      "--color-brand-soft": "#fff2eb",
      "--color-brand-glow": "#f4a574",
      "--color-mark": "#0b6a78",
      "--color-sand": "#faf7f4",
      "--color-ink": "#1c1c1c",
      "--color-line": "#eadfd6",
      "--color-paper": "#ffffff",
      "--color-procore-navy": "#2a2a2a",
      "--color-procore-blue": "#e4632a",
      "--ui-radius": "12px",
      "--ui-radius-sm": "8px",
      "--font-display": '"Syne", "Instrument Sans", system-ui, sans-serif',
    },
  },
  {
    id: "ui-2",
    number: 2,
    letter: "2",
    name: "Graphite Procore",
    blurb: "Dense tool chrome · sharp corners · steel + orange sparks",
    style: "graphite",
    density: "compact",
    radius: "sharp",
    vars: {
      "--color-brand": "#f97316",
      "--color-brand-dark": "#ea580c",
      "--color-brand-soft": "#fff7ed",
      "--color-brand-glow": "#fdba74",
      "--color-mark": "#334155",
      "--color-sand": "#f1f5f9",
      "--color-ink": "#0f172a",
      "--color-line": "#cbd5e1",
      "--color-paper": "#ffffff",
      "--color-procore-navy": "#1e293b",
      "--color-procore-blue": "#f97316",
      "--ui-radius": "4px",
      "--ui-radius-sm": "2px",
      "--font-display": '"IBM Plex Sans", "Instrument Sans", system-ui, sans-serif',
    },
  },
  {
    id: "ui-3",
    number: 3,
    letter: "3",
    name: "Forest Field",
    blurb: "Site-green energy · roomy layout · clay secondary",
    style: "forest",
    density: "comfortable",
    radius: "pill",
    vars: {
      "--color-brand": "#2f6f4e",
      "--color-brand-dark": "#24583d",
      "--color-brand-soft": "#eaf5ef",
      "--color-brand-glow": "#7ab894",
      "--color-mark": "#c45c26",
      "--color-sand": "#f4f7f2",
      "--color-ink": "#142019",
      "--color-line": "#cfe0d4",
      "--color-paper": "#ffffff",
      "--color-procore-navy": "#1a2e22",
      "--color-procore-blue": "#2f6f4e",
      "--ui-radius": "16px",
      "--ui-radius-sm": "999px",
      "--font-display": '"Fraunces", "Syne", Georgia, serif',
    },
  },
  {
    id: "ui-4",
    number: 4,
    letter: "4",
    name: "Blueprint Desk",
    blurb: "Technical white · hairline rules · cyan registration marks",
    style: "blueprint",
    density: "compact",
    radius: "sharp",
    vars: {
      "--color-brand": "#0f172a",
      "--color-brand-dark": "#020617",
      "--color-brand-soft": "#eff6ff",
      "--color-brand-glow": "#93c5fd",
      "--color-mark": "#0284c7",
      "--color-sand": "#f8fafc",
      "--color-ink": "#0c1222",
      "--color-line": "#bfdbfe",
      "--color-paper": "#ffffff",
      "--color-procore-navy": "#0f172a",
      "--color-procore-blue": "#0284c7",
      "--ui-radius": "2px",
      "--ui-radius-sm": "0px",
      "--font-display": '"Space Grotesk", "IBM Plex Sans", system-ui, sans-serif',
    },
  },
  {
    id: "ui-5",
    number: 5,
    letter: "5",
    name: "Night Shift",
    blurb: "Dark ops chrome · high-contrast orange · night site",
    style: "night",
    density: "compact",
    radius: "soft",
    vars: {
      "--color-brand": "#ff6b2c",
      "--color-brand-dark": "#e0551a",
      "--color-brand-soft": "#2a201c",
      "--color-brand-glow": "#ffb086",
      "--color-mark": "#ffb086",
      "--color-sand": "#12100e",
      "--color-ink": "#f5ede6",
      "--color-line": "#3a322c",
      "--color-paper": "#1c1815",
      "--color-procore-navy": "#0c0a09",
      "--color-procore-blue": "#ff6b2c",
      "--ui-radius": "10px",
      "--ui-radius-sm": "6px",
      "--font-display": '"Syne", "Instrument Sans", system-ui, sans-serif',
    },
  },
];

/** Full catalog (includes legacy letters for /themes) */
export const THEME_OPTIONS: ThemeOption[] = [
  ...LIVE_UI_OPTIONS,
  {
    id: "f-terracotta",
    number: 1,
    letter: "F",
    name: "Terracotta Clay",
    blurb: "Warm clay paper",
    style: "amber",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#c65d3a",
      "--color-brand-dark": "#a44a2c",
      "--color-brand-soft": "#fbf0ea",
      "--color-brand-glow": "#e0a08a",
      "--color-mark": "#5b4636",
      "--color-sand": "#fbf6f1",
      "--color-ink": "#2a211c",
      "--color-line": "#e8d5c8",
      "--color-paper": "#ffffff",
      "--color-procore-navy": "#2a211c",
      "--color-procore-blue": "#c65d3a",
      "--ui-radius": "12px",
      "--ui-radius-sm": "8px",
      "--font-display": '"Syne", system-ui, sans-serif',
    },
  },
];

export const THEME_STORAGE_KEY = "sharnam_theme_option";

export function getLiveOption(numOrId: string | number) {
  const n = String(numOrId);
  return (
    LIVE_UI_OPTIONS.find((t) => String(t.number) === n || t.id === n || t.letter === n) ||
    LIVE_UI_OPTIONS[0]
  );
}

export function applyThemeOption(id: string) {
  const opt =
    LIVE_UI_OPTIONS.find((t) => t.id === id || String(t.number) === id || t.letter === id) ||
    THEME_OPTIONS.find((t) => t.id === id) ||
    LIVE_UI_OPTIONS[0];
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
  try {
    const id = localStorage.getItem(THEME_STORAGE_KEY);
    if (id) return applyThemeOption(id);
  } catch {
    /* ignore */
  }
  return applyThemeOption("ui-1");
}
