/** Five live PMC UI systems — clean fonts, Procore-like density tokens */
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

export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "ui-1",
    number: 1,
    letter: "1",
    name: "Site Amber",
    blurb: "Warm field office · clear registers · Sharnam orange + cyan",
    style: "amber",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#E4632A",
      "--color-brand-dark": "#C24D1A",
      "--color-brand-soft": "#FFF4ED",
      "--color-brand-glow": "#F4A574",
      "--color-mark": "#0B6A78",
      "--color-sand": "#F7F4F0",
      "--color-ink": "#1A1A1A",
      "--color-line": "#E6DDD4",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1C2430",
      "--color-procore-blue": "#E4632A",
      "--color-steel-muted": "#6B6560",
      "--ui-radius": "10px",
      "--ui-radius-sm": "6px",
      "--ui-nav-h": "56px",
      "--ui-gap": "1.25rem",
      "--font-display": '"Syne", "DM Sans", system-ui, sans-serif',
      "--font-sans": '"DM Sans", "Instrument Sans", system-ui, sans-serif',
    },
  },
  {
    id: "ui-2",
    number: 2,
    letter: "2",
    name: "Concrete Graphite",
    blurb: "Engineering desk · dense tables · steel primary",
    style: "graphite",
    density: "compact",
    radius: "sharp",
    vars: {
      "--color-brand": "#3D4450",
      "--color-brand-dark": "#2A3038",
      "--color-brand-soft": "#F0F2F4",
      "--color-brand-glow": "#C45C26",
      "--color-mark": "#C45C26",
      "--color-sand": "#F0F1F3",
      "--color-ink": "#14171C",
      "--color-line": "#D4D8DD",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1E2430",
      "--color-procore-blue": "#3D4450",
      "--color-steel-muted": "#64708A",
      "--ui-radius": "4px",
      "--ui-radius-sm": "2px",
      "--ui-nav-h": "52px",
      "--ui-gap": "1rem",
      "--font-display": '"Space Grotesk", "IBM Plex Sans", system-ui, sans-serif',
      "--font-sans": '"IBM Plex Sans", system-ui, sans-serif',
    },
  },
  {
    id: "ui-3",
    number: 3,
    letter: "3",
    name: "Forest Site",
    blurb: "Safety-green room · calm QA · clay accents",
    style: "forest",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#2F6F4E",
      "--color-brand-dark": "#24583D",
      "--color-brand-soft": "#EAF3EE",
      "--color-brand-glow": "#7AB894",
      "--color-mark": "#D97706",
      "--color-sand": "#F3F6F2",
      "--color-ink": "#152019",
      "--color-line": "#D3DDD6",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1A2B22",
      "--color-procore-blue": "#2F6F4E",
      "--color-steel-muted": "#5C6B62",
      "--ui-radius": "12px",
      "--ui-radius-sm": "8px",
      "--ui-nav-h": "56px",
      "--ui-gap": "1.35rem",
      "--font-display": '"Fraunces", "Source Sans 3", Georgia, serif',
      "--font-sans": '"Source Sans 3", system-ui, sans-serif',
    },
  },
  {
    id: "ui-4",
    number: 4,
    letter: "4",
    name: "Blueprint Desk",
    blurb: "Drawing office · airy white · cyan registration",
    style: "blueprint",
    density: "comfortable",
    radius: "sharp",
    vars: {
      "--color-brand": "#1A1A1A",
      "--color-brand-dark": "#0A0A0A",
      "--color-brand-soft": "#EEF5F7",
      "--color-brand-glow": "#1B7B8C",
      "--color-mark": "#1B7B8C",
      "--color-sand": "#F4F7F8",
      "--color-ink": "#121212",
      "--color-line": "#D5E0E4",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#0F1C22",
      "--color-procore-blue": "#1B7B8C",
      "--color-steel-muted": "#5A6B72",
      "--ui-radius": "2px",
      "--ui-radius-sm": "0px",
      "--ui-nav-h": "54px",
      "--ui-gap": "1.25rem",
      "--font-display": '"Archivo", "Public Sans", system-ui, sans-serif',
      "--font-sans": '"Public Sans", system-ui, sans-serif',
    },
  },
  {
    id: "ui-5",
    number: 5,
    letter: "5",
    name: "Night Shift",
    blurb: "Evening site cabin · high contrast · orange CTAs",
    style: "night",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#FF6B2C",
      "--color-brand-dark": "#E0551A",
      "--color-brand-soft": "#2A221E",
      "--color-brand-glow": "#FFB086",
      "--color-mark": "#2EC4B6",
      "--color-sand": "#141618",
      "--color-ink": "#F0EEEA",
      "--color-line": "#2E3338",
      "--color-paper": "#1C1F23",
      "--color-procore-navy": "#0A0C0E",
      "--color-procore-blue": "#FF6B2C",
      "--color-steel-muted": "#9AA3AD",
      "--ui-radius": "10px",
      "--ui-radius-sm": "6px",
      "--ui-nav-h": "56px",
      "--ui-gap": "1.25rem",
      "--font-display": '"Sora", "DM Sans", system-ui, sans-serif',
      "--font-sans": '"DM Sans", system-ui, sans-serif',
    },
  },
];

export const THEME_OPTIONS: ThemeOption[] = [...LIVE_UI_OPTIONS];

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
