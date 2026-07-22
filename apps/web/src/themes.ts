/** Five live PMC UI systems — finalized professional palette: blue / red / white / green */
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

/** Plus Jakarta for headlines · Source Sans for body — clear, professional PMC chrome */
const FONT_DISPLAY = '"Plus Jakarta Sans", "Source Sans 3", system-ui, sans-serif';
const FONT_SANS = '"Source Sans 3", "Plus Jakarta Sans", system-ui, sans-serif';

export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "ui-1",
    number: 1,
    letter: "1",
    name: "Clear Blue",
    blurb: "Recommended · blue primary · red signal · green OK · white paper",
    style: "blueprint",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#1D4ED8",
      "--color-brand-dark": "#1E3A8A",
      "--color-brand-soft": "#EFF6FF",
      "--color-brand-glow": "#93C5FD",
      "--color-mark": "#DC2626",
      "--color-sand": "#F8FAFC",
      "--color-ink": "#0F172A",
      "--color-line": "#E2E8F0",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1E3A8A",
      "--color-procore-blue": "#1D4ED8",
      "--color-steel-muted": "#64748B",
      "--color-ok": "#15803D",
      "--color-danger": "#DC2626",
      "--ui-radius": "10px",
      "--ui-radius-sm": "6px",
      "--ui-nav-h": "68px",
      "--ui-gap": "1.5rem",
      "--font-display": FONT_DISPLAY,
      "--font-sans": FONT_SANS,
    },
  },
  {
    id: "ui-2",
    number: 2,
    letter: "2",
    name: "Navy Desk",
    blurb: "Deep navy chrome · blue links · green status · crisp registers",
    style: "graphite",
    density: "comfortable",
    radius: "sharp",
    vars: {
      "--color-brand": "#2563EB",
      "--color-brand-dark": "#1E40AF",
      "--color-brand-soft": "#F1F5F9",
      "--color-brand-glow": "#60A5FA",
      "--color-mark": "#B91C1C",
      "--color-sand": "#F1F5F9",
      "--color-ink": "#0F172A",
      "--color-line": "#CBD5E1",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#0F172A",
      "--color-procore-blue": "#2563EB",
      "--color-steel-muted": "#64748B",
      "--color-ok": "#16A34A",
      "--color-danger": "#DC2626",
      "--ui-radius": "6px",
      "--ui-radius-sm": "4px",
      "--ui-nav-h": "68px",
      "--ui-gap": "1.35rem",
      "--font-display": FONT_DISPLAY,
      "--font-sans": FONT_SANS,
    },
  },
  {
    id: "ui-3",
    number: 3,
    letter: "3",
    name: "Site Green",
    blurb: "Green primary · blue secondary · red alerts · white surfaces",
    style: "forest",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#15803D",
      "--color-brand-dark": "#14532D",
      "--color-brand-soft": "#F0FDF4",
      "--color-brand-glow": "#86EFAC",
      "--color-mark": "#1D4ED8",
      "--color-sand": "#F8FAFC",
      "--color-ink": "#14532D",
      "--color-line": "#DCFCE7",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#14532D",
      "--color-procore-blue": "#15803D",
      "--color-steel-muted": "#4B5563",
      "--color-ok": "#16A34A",
      "--color-danger": "#DC2626",
      "--ui-radius": "12px",
      "--ui-radius-sm": "8px",
      "--ui-nav-h": "68px",
      "--ui-gap": "1.5rem",
      "--font-display": FONT_DISPLAY,
      "--font-sans": FONT_SANS,
    },
  },
  {
    id: "ui-4",
    number: 4,
    letter: "4",
    name: "White Office",
    blurb: "White-first · blue brand · red mark · green confirmation",
    style: "blueprint",
    density: "comfortable",
    radius: "sharp",
    vars: {
      "--color-brand": "#1E40AF",
      "--color-brand-dark": "#1E3A8A",
      "--color-brand-soft": "#FFFFFF",
      "--color-brand-glow": "#93C5FD",
      "--color-mark": "#DC2626",
      "--color-sand": "#FFFFFF",
      "--color-ink": "#111827",
      "--color-line": "#E5E7EB",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1E3A8A",
      "--color-procore-blue": "#1E40AF",
      "--color-steel-muted": "#6B7280",
      "--color-ok": "#15803D",
      "--color-danger": "#B91C1C",
      "--ui-radius": "8px",
      "--ui-radius-sm": "4px",
      "--ui-nav-h": "72px",
      "--ui-gap": "1.6rem",
      "--font-display": FONT_DISPLAY,
      "--font-sans": FONT_SANS,
    },
  },
  {
    id: "ui-5",
    number: 5,
    letter: "5",
    name: "Signal Red",
    blurb: "Red CTAs · blue nav · green OK · white content panels",
    style: "amber",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#DC2626",
      "--color-brand-dark": "#B91C1C",
      "--color-brand-soft": "#FEF2F2",
      "--color-brand-glow": "#FCA5A5",
      "--color-mark": "#1D4ED8",
      "--color-sand": "#F8FAFC",
      "--color-ink": "#111827",
      "--color-line": "#FEE2E2",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1E3A8A",
      "--color-procore-blue": "#DC2626",
      "--color-steel-muted": "#6B7280",
      "--color-ok": "#16A34A",
      "--color-danger": "#991B1B",
      "--ui-radius": "10px",
      "--ui-radius-sm": "6px",
      "--ui-nav-h": "68px",
      "--ui-gap": "1.5rem",
      "--font-display": FONT_DISPLAY,
      "--font-sans": FONT_SANS,
    },
  },
];

export const THEME_OPTIONS: ThemeOption[] = [...LIVE_UI_OPTIONS];
export const THEME_STORAGE_KEY = "sharnam_theme_option";
/** Recommended finalized look */
export const RECOMMENDED_UI = "ui-1";

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
  return applyThemeOption(RECOMMENDED_UI);
}
