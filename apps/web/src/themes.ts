/** Five distinct PMC UI systems — different fonts, density, and colour stories */
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
  jakarta: '"Plus Jakarta Sans", "Source Sans 3", system-ui, sans-serif',
  source: '"Source Sans 3", "Plus Jakarta Sans", system-ui, sans-serif',
  plex: '"IBM Plex Sans", "Source Sans 3", system-ui, sans-serif',
  plexMono: '"IBM Plex Mono", ui-monospace, monospace',
  outfit: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
  dm: '"DM Sans", "Source Sans 3", system-ui, sans-serif',
  libre: '"Libre Baskerville", Georgia, serif',
};

export const LIVE_UI_OPTIONS: ThemeOption[] = [
  {
    id: "ui-1",
    number: 1,
    letter: "1",
    name: "Clear Blue",
    blurb: "Recommended · soft blue PMC desk · Plus Jakarta headlines",
    icon: "◆",
    chip: "Blue",
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
      "--font-display": F.jakarta,
      "--font-sans": F.source,
    },
  },
  {
    id: "ui-2",
    number: 2,
    letter: "2",
    name: "Navy Desk",
    blurb: "Dense register · IBM Plex · sharp corners · charcoal chrome",
    icon: "▣",
    chip: "Navy",
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
  {
    id: "ui-3",
    number: 3,
    letter: "3",
    name: "Site Green",
    blurb: "Field / QA feel · Outfit headlines · rounded green panels",
    icon: "▲",
    chip: "Green",
    style: "forest",
    density: "comfortable",
    radius: "pill",
    vars: {
      "--color-brand": "#15803D",
      "--color-brand-dark": "#14532D",
      "--color-brand-soft": "#ECFDF5",
      "--color-brand-glow": "#6EE7B7",
      "--color-mark": "#1D4ED8",
      "--color-sand": "#F0FDF4",
      "--color-ink": "#052E16",
      "--color-line": "#BBF7D0",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#14532D",
      "--color-procore-blue": "#15803D",
      "--color-steel-muted": "#3F6212",
      "--color-ok": "#16A34A",
      "--color-danger": "#DC2626",
      "--ui-radius": "16px",
      "--ui-radius-sm": "999px",
      "--ui-nav-h": "70px",
      "--ui-gap": "1.65rem",
      "--font-display": F.outfit,
      "--font-sans": F.source,
    },
  },
  {
    id: "ui-4",
    number: 4,
    letter: "4",
    name: "White Office",
    blurb: "Serif display · paper-white · hairline rules · Libre Baskerville",
    icon: "◇",
    chip: "Paper",
    style: "blueprint",
    density: "comfortable",
    radius: "sharp",
    vars: {
      "--color-brand": "#1E3A8A",
      "--color-brand-dark": "#172554",
      "--color-brand-soft": "#FFFFFF",
      "--color-brand-glow": "#BFDBFE",
      "--color-mark": "#B91C1C",
      "--color-sand": "#FFFFFF",
      "--color-ink": "#111827",
      "--color-line": "#D1D5DB",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#111827",
      "--color-procore-blue": "#1E3A8A",
      "--color-steel-muted": "#6B7280",
      "--color-ok": "#166534",
      "--color-danger": "#991B1B",
      "--ui-radius": "0px",
      "--ui-radius-sm": "0px",
      "--ui-nav-h": "72px",
      "--ui-gap": "1.75rem",
      "--font-display": F.libre,
      "--font-sans": F.source,
    },
  },
  {
    id: "ui-5",
    number: 5,
    letter: "5",
    name: "Signal Red",
    blurb: "Action-first · DM Sans · red CTAs · blue nav · high contrast",
    icon: "●",
    chip: "Red",
    style: "amber",
    density: "comfortable",
    radius: "soft",
    vars: {
      "--color-brand": "#DC2626",
      "--color-brand-dark": "#991B1B",
      "--color-brand-soft": "#FEF2F2",
      "--color-brand-glow": "#FCA5A5",
      "--color-mark": "#1D4ED8",
      "--color-sand": "#FFF7ED",
      "--color-ink": "#1C1917",
      "--color-line": "#FECACA",
      "--color-paper": "#FFFFFF",
      "--color-procore-navy": "#1E3A8A",
      "--color-procore-blue": "#DC2626",
      "--color-steel-muted": "#78716C",
      "--color-ok": "#16A34A",
      "--color-danger": "#7F1D1D",
      "--ui-radius": "12px",
      "--ui-radius-sm": "8px",
      "--ui-nav-h": "64px",
      "--ui-gap": "1.4rem",
      "--font-display": F.dm,
      "--font-sans": F.dm,
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
