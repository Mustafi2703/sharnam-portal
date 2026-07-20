# Five UI directions — construction management ERP

Pick **one**. Implement by mapping tokens into `apps/web/src/index.css` (`--color-brand`, `--color-mark`, `--color-sand`, topbar, logo plate).  
Logo (`logo.png`) stays on a **light plate** for A–D; option E uses charcoal plate with orange mark.

Avoid: Procore blue flood, purple gradients, generic Inter-only stacks without a display font.

---

## Option A — Site Amber (recommended default)

**Feel:** Warm field office · safety-vest energy · clear ERP tables  

| Token | Hex | Use |
|-------|-----|-----|
| Brand | `#E4632A` | CTAs, active nav, selection |
| Mark | `#0B6A78` | Logo ticks, links secondary |
| Sand | `#FAF7F4` | Page wash |
| Ink | `#1C1C1C` | Text |
| Line | `#EADFD6` | Borders |
| Topbar | White | Light chrome |

**Fonts:** Syne (display) + Instrument Sans  
**Motifs:** Registration corner ticks · orange selected rings · construction photo tiles  
**Best for:** Matching logo cyan + orange ask without going dark

---

## Option B — Concrete Graphite

**Feel:** Spec-sheet / engineering desk · serious PMC  

| Token | Hex | Use |
|-------|-----|-----|
| Brand | `#3D4450` | Primary buttons |
| Mark | `#C45C26` | Accents / warnings soft |
| Sand | `#F0F1F2` | Cool concrete |
| Ink | `#16181C` | Text |
| Line | `#D5D8DC` | Borders |
| Topbar | `#F7F8F9` | Near-white |

**Fonts:** Space Grotesk + IBM Plex Sans  
**Motifs:** Hairline rules · mono drawing numbers · dense registers  
**Best for:** Clients who want “less orange, more engineer”

---

## Option C — Forest Site

**Feel:** Safety + sustainability · site green, not fintech green  

| Token | Hex | Use |
|-------|-----|-----|
| Brand | `#2F6F4E` | CTAs |
| Mark | `#E07A2F` | Highlights / badges |
| Sand | `#F4F6F3` | Soft sage wash |
| Ink | `#1A221C` | Text |
| Line | `#D7E0D8` | Borders |
| Topbar | White | |

**Fonts:** Fraunces (sparse display) + Source Sans 3  
**Motifs:** Soft cards · calm QA flows · day-log emphasis  
**Best for:** Safety / quality-heavy demos

---

## Option D — Blueprint White

**Feel:** Drawing office · airy · blueprint cyan as mark only  

| Token | Hex | Use |
|-------|-----|-----|
| Brand | `#1A1A1A` | Black CTAs |
| Mark | `#1B7B8C` | Logo / links / ticks |
| Sand | `#F5F7F8` | Cool white |
| Ink | `#121212` | Text |
| Line | `#DCE3E6` | Borders |
| Topbar | White + cyan underline | |

**Fonts:** Archivo + Public Sans  
**Motifs:** Blueprint grid ghost · sharp corners · GFC-first  
**Best for:** Drawings / GFC as hero product

---

## Option E — Night Shift Orange

**Feel:** Evening site cabin · high contrast · still ERP  

| Token | Hex | Use |
|-------|-----|-----|
| Brand | `#FF6B2C` | CTAs |
| Mark | `#2EC4B6` | Teal glow accents |
| Sand | `#1A1C1E` | Dark page (only this option) |
| Ink | `#F2F2F2` | Text |
| Line | `#2E3236` | Borders |
| Topbar | `#121314` | |

**Fonts:** Sora + DM Sans  
**Motifs:** Glow on focus · media tiles · night photos  
**Best for:** Only if stakeholders insist on dark mode  

---

## Decision checklist

When choosing, answer:

1. Light or dark chrome? (A–D light, E dark)  
2. Primary emotion: warm field (A), engineer (B), safety (C), drawings (D), night (E)  
3. Keep logo cyan visible? Prefer A or D  

**Reply with:** `Use Option X` — then agents apply tokens + upload modal + workspace focus under the skill.
