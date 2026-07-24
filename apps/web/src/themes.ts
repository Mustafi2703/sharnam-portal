/** Locked modern UI — Blue · Red · Yellow · White · Black */
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
  display: '"Outfit", "Source Sans 3", system-ui, sans-serif',
  sans: '"Source Sans 3", "Outfit", system-ui, sans-serif',
};

/** Single live UI — modern SaaS chrome for Sharnam PMC */
export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "ui-2",
    number: 2,
    letter: "2",
    name: "Modern Signal",
    blurb: "Blue actions · red alerts · yellow attention · white surfaces · black chrome",
    icon: "◆",
    chip: "Modern",
    style: "blueprint",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#2563EB",
      "--color-brand-dark": "#1E3A8A",
      "--color-brand-soft": "#EFF6FF",
      "--color-brand-glow": "#FACC15",
      "--color-mark": "#DC2626",
      "--color-sand": "#F8FAFC",
      "--color-ink": "#0A0A0A",
      "--color-line": "#E5E7EB",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#0A0A0A",
      "--color-procore-blue": "#2563EB",
      "--color-steel-muted": "#6B7280",
      "--color-ok": "#2563EB",
      "--color-warn": "#CA8A04",
      "--color-danger": "#DC2626",
      "--ui-radius": "14px",
      "--ui-radius-sm": "10px",
      "--ui-nav-h": "60px",
      "--ui-gap": "1.5rem",
      "--font-display": F.display,
      "--font-sans": F.sans,
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
