/** Theme options A–H — CSS variable maps for live preview / lock */
export type ThemeOption = {
  id: string;
  letter: string;
  name: string;
  blurb: string;
  vars: Record<string, string>;
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "a-amber",
    letter: "A",
    name: "Site Amber",
    blurb: "Recommended · orange + logo cyan",
    vars: {
      "--color-brand": "#e4632a",
      "--color-brand-dark": "#c24d1a",
      "--color-brand-soft": "#fff2eb",
      "--color-brand-glow": "#f4a574",
      "--color-mark": "#0b6a78",
      "--color-sand": "#faf7f4",
      "--color-ink": "#1c1c1c",
      "--color-line": "#eadfd6",
      "--color-procore-navy": "#2a2a2a",
      "--color-procore-blue": "#e4632a",
    },
  },
  {
    id: "b-graphite",
    letter: "B",
    name: "Concrete Graphite",
    blurb: "Steel chrome · orange sparks",
    vars: {
      "--color-brand": "#3d4450",
      "--color-brand-dark": "#2a3038",
      "--color-brand-soft": "#f0f1f3",
      "--color-brand-glow": "#8a919c",
      "--color-mark": "#e4632a",
      "--color-sand": "#f5f5f6",
      "--color-ink": "#1a1b1e",
      "--color-line": "#d8dce2",
      "--color-procore-navy": "#3d4450",
      "--color-procore-blue": "#e4632a",
    },
  },
  {
    id: "c-forest",
    letter: "C",
    name: "Forest Site",
    blurb: "Green field · warm secondary",
    vars: {
      "--color-brand": "#2f6f4e",
      "--color-brand-dark": "#24583d",
      "--color-brand-soft": "#eaf5ef",
      "--color-brand-glow": "#7ab894",
      "--color-mark": "#c45c26",
      "--color-sand": "#f6f8f5",
      "--color-ink": "#1a241e",
      "--color-line": "#d7e3da",
      "--color-procore-navy": "#1a241e",
      "--color-procore-blue": "#2f6f4e",
    },
  },
  {
    id: "d-blueprint",
    letter: "D",
    name: "Blueprint White",
    blurb: "Technical white · cyan lines",
    vars: {
      "--color-brand": "#1a1a1a",
      "--color-brand-dark": "#000000",
      "--color-brand-soft": "#f4f7fb",
      "--color-brand-glow": "#6b7280",
      "--color-mark": "#1e6b9f",
      "--color-sand": "#f7f9fc",
      "--color-ink": "#111827",
      "--color-line": "#d6dee8",
      "--color-procore-navy": "#1a1a1a",
      "--color-procore-blue": "#1e6b9f",
    },
  },
  {
    id: "e-night",
    letter: "E",
    name: "Night Shift Orange",
    blurb: "Dark chrome · night ops",
    vars: {
      "--color-brand": "#ff6b2c",
      "--color-brand-dark": "#e0551a",
      "--color-brand-soft": "#2a201c",
      "--color-brand-glow": "#ffb086",
      "--color-mark": "#ffb086",
      "--color-sand": "#141210",
      "--color-ink": "#f5ede6",
      "--color-line": "#2e2622",
      "--color-procore-navy": "#1a1614",
      "--color-procore-blue": "#ff6b2c",
    },
  },
  {
    id: "f-terracotta",
    letter: "F",
    name: "Terracotta Clay",
    blurb: "Warm clay paper",
    vars: {
      "--color-brand": "#c65d3a",
      "--color-brand-dark": "#a44a2c",
      "--color-brand-soft": "#fbf0ea",
      "--color-brand-glow": "#e0a08a",
      "--color-mark": "#5b4636",
      "--color-sand": "#fbf6f1",
      "--color-ink": "#2a211c",
      "--color-line": "#e8d5c8",
      "--color-procore-navy": "#2a211c",
      "--color-procore-blue": "#c65d3a",
    },
  },
  {
    id: "g-slate-gold",
    letter: "G",
    name: "Slate & Gold",
    blurb: "Premium charcoal + gold",
    vars: {
      "--color-brand": "#b8943f",
      "--color-brand-dark": "#95762f",
      "--color-brand-soft": "#f7f4ec",
      "--color-brand-glow": "#d4bc7a",
      "--color-mark": "#2f3640",
      "--color-sand": "#f4f2ed",
      "--color-ink": "#1c1f24",
      "--color-line": "#ddd6c8",
      "--color-procore-navy": "#2f3640",
      "--color-procore-blue": "#b8943f",
    },
  },
  {
    id: "h-coral-ink",
    letter: "H",
    name: "Coral Ink",
    blurb: "Coral accent · ink type",
    vars: {
      "--color-brand": "#e24b4a",
      "--color-brand-dark": "#c23a39",
      "--color-brand-soft": "#fff0ef",
      "--color-brand-glow": "#f0908f",
      "--color-mark": "#1b1b1b",
      "--color-sand": "#fffcfb",
      "--color-ink": "#161616",
      "--color-line": "#ecdad8",
      "--color-procore-navy": "#1b1b1b",
      "--color-procore-blue": "#e24b4a",
    },
  },
];

export const THEME_STORAGE_KEY = "sharnam_theme_option";

export function applyThemeOption(id: string) {
  const opt = THEME_OPTIONS.find((t) => t.id === id) || THEME_OPTIONS[0];
  const root = document.documentElement;
  Object.entries(opt.vars).forEach(([k, v]) => root.style.setProperty(k, v));
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
  return applyThemeOption("a-amber");
}
