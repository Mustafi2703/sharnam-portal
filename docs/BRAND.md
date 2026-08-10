# Sharnam · Brand & UI Document

Rev **04** · Aug 2026

This doc is the single source of truth for how Sharnam looks. It covers the
mark, the type ladder, the colour system, motion, and the surface language we
use on the login page and inside the desks. **Login and inside must feel like
one product.** If a login page looks like something else, it is wrong.

---

## 1. The mark

We ship one brand mark. Two lockups.

- `/public/logo.png` — the wordmark for Sharnam. Only place we render the mark.
- Devanagari display: **शरणम्** — set in the display font, tight letter-spacing.
- Latin caps: **SHARNAM** — set in mono/monospace, widely tracked (`0.35em`).

Lockup rules
- Never re-colour the mark. Keep it as shipped.
- Never place the mark inside a solid tile or square. It reads on paper,
  it reads on a stage — it does not want a frame around it.
- Vertical order: mark on top, then Devanagari display, then Latin caps.
- Minimum height: **56 px** for the mark. Below that it becomes chrome.

Where the mark is used
| Surface | Component | Notes |
|---|---|---|
| Hub landing | `BrandLockup size="hero"` | Big, centered on masthead |
| Per-portal | `TopStrip` + `DeskStage__mark` | Chrome + subtle watermark |
| Inside app | `AppShell` chrome | Compact |

---

## 2. Colours (semantic tokens)

We prefer **semantic tokens over hex**. If you have to reach for a raw hex
value inside a feature, it means the token is missing — add one.

Base
| Token | Hex | Where |
|---|---|---|
| `--color-paper` | `#ffffff` | Card surface |
| `--color-sand`  | `#f0f2f4` | Page background |
| `--color-ink`   | `#121417` | Body text |
| `--color-line`  | `#d5dadd` | Card borders / dividers |
| `--color-steel-2` | `#2a2f38` | Secondary text |
| `--color-steel-muted` | `#64707c` | Muted labels |

Brand
| Token | Hex | Meaning |
|---|---|---|
| `--color-brand`      | `#0b6a78` | Primary teal — CTAs, active state |
| `--color-brand-dark` | `#085560` | Hover / focus |
| `--color-brand-soft` | `#e6f4f6` | Chip / tag background |
| `--color-brand-glow` | `#14b8a6` | Rarely used — accent only |

### Portal tones

Each portal carries its own tone. The tone is applied to the accent bar,
KPI card borders, tool-icon fill, and CTA button on that portal only.

| Portal | Tone | Character |
|---|---|---|
| Master | `#8B1E3A` | Deep garnet — authority |
| Office | `#0B6A78` | Brand teal — control desk |
| Site   | `#3D4450` | Steel — evidence / field |
| Employee | `#5B6470` | Slate — self-service |
| Vendor | `#7A5A2E` | Warm sepia — trade partner |
| Client | `#124A6B` | Ink blue — read-only pack |
| HR admin | `#6D28D9` | Iris — scoped desk |

Never invent a new portal colour. If a new portal is added, discuss the tone
before shipping.

### Dark mode

The stage adapts via `@media (prefers-color-scheme: dark)`. Card surfaces
darken to `rgba(20, 24, 30, 0.72)` with a `backdrop-filter: blur(6px)` and
the grid/wash opacity drops. No image assets are required for dark mode
because we do not use photos on the login stage — see §5.

---

## 3. Type ladder

We use two typefaces.
- **Display** (`--font-display`): headings, KPI values, Devanagari.
- **Mono** (`--font-mono`): tags, IDs, versions, codes, eyebrows.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hub headline (masthead) | `clamp(1.7rem, 3vw, 2.3rem)` | 650 | `-0.02em` |
| Section title | `1.05rem` | 650 | `-0.01em` |
| Card title | `1.15–1.35rem` | 650 | `-0.02em` |
| Eyebrow | `10px` | 700 | `0.16em`, uppercase |
| Body | `0.85rem` | 500 | normal |
| Tag / code | `10px` mono | 700 | `0.05em` |

Never mix eyebrows and titles on the same line — the eyebrow **sits above**.

---

## 4. Surface language

Sharnam's UI is a series of surfaces. Every surface follows the same rules.

- **Card:** `background: --color-paper`, `border: 1px solid --color-line`,
  `border-radius: var(--ui-radius)`, soft double shadow.
- **Tone accent:** a 3-px bar on the top of the card in the portal's tone.
- **Padding:** 1.15rem for content-heavy cards, 0.75rem for tight bento tiles.
- **Grid:** 12-column implied. Bento uses `repeat(3, minmax(0, 1fr))` at
  desktop, `2` at tablet, `1` at mobile.
- **Motion:** 160ms `ease` on hover; 1.3s crossfade for slideshows; page
  transitions inherit the default browser behaviour.

Inputs
- Height ≥ 44 px on mobile. `border-radius: var(--ui-radius)`, `1px` border,
  `inset` shadow. Focus ring: 3px halo in the portal tone at 22% alpha.

Buttons
- Primary: solid tone fill, white text, 700 weight, glow-shadow in the same tone.
- Secondary: paper background, tone-coloured text, 1px tone-alpha border.
- Never use gradient buttons.

---

## 5. Login page — the rule that matters

**The login page must look like the inside of the product.** Not a marketing
splash. Not a hero photo carousel. A calm, tone-coloured "desk" that shows
the client what they'll see once they sign in.

This is why we deliberately do **not** ship photo heroes on the login page:

- Photos rarely look right in dark mode — they were shot in daylight,
  their light temperature fights the OS chrome.
- Photos are brittle — a missing asset in `/public/heroes/` produces a
  blank rectangle in production; a token-driven mockup can't fail like that.
- Photos are not our product — they misrepresent what the user is about
  to open.

Instead, the login left panel is a `DeskStage` component (see
`apps/web/src/pages/PortalLogins.tsx`). It renders:

1. Fake browser chrome — three OSX-style dots + a URL pill.
2. A real inside surface card with the portal tone as its accent bar.
3. A `PageHeader`-style row — eyebrow + title + project code + tone icon.
4. Three KPI stat cards with tone-coloured left borders.
5. A six-tile bento of the tools this portal owns.
6. A dashed-top activity ledger.
7. A very faint Sharnam watermark bottom-left.

Behind everything: a portal-tone radial wash + a faint blueprint grid,
masked out at the edges. Both work in light and dark modes.

No portal switcher chip row lives on the sign-in card. Each portal has
its own permanent link (`/login/<key>`). The only nav element on the
per-portal page is "← All portals" back to the hub.

---

## 6. Chrome (top strip + footer)

- **TopStrip** — brand lockup on the left, ISO badges centred, revision
  tag on the right. Always visible on the login surface.
- **TrustFooter** — a policy ticker that rotates the ten most important
  standards this portal enforces. On mobile, the "Standards" label hides
  and the ticker keeps rolling.
- The masthead on the hub landing shows the full brand lockup + tagline.

---

## 7. Content voice

- **Present tense, no marketing.** "Every project is set up from Master ·
  then modules open per charter." not "Streamline your project setup."
- **Numbers are always concrete.** "12 open RFIs" not "many RFIs".
- **Codes are always monospace.** `SPDC-DEMO-01`, `A-04 R2`, `COP-19`.
- **Devanagari is respected.** शरणम् appears in the masthead and the
  DeskStage watermark. It is not translated.

---

## 8. What good looks like

- Every desk (login or inside) reads as the **same product** at a glance.
- If you screenshot the login and paste it next to the project home,
  they belong to the same design system.
- Nothing on the login page is decorative — every element earns its space.
- Dark mode changes tokens, not layout. The composition stays the same.

## 9. What to avoid

- **No hero photo carousels.** We tried, they aged poorly.
- **No gradients as decoration.** Only for radial-wash on the desk stage,
  and only in the portal tone.
- **No glassmorphism / heavy blur.** One tasteful `backdrop-filter: blur(6px)`
  on the dark-mode desk surface — nowhere else.
- **No portal switcher inside the sign-in card.** Users pick their portal
  on the hub, then commit to it.
- **No emoji.** Ever.

---

Ownership: engineering + design. Update this doc **before** you ship a
brand-level change.
