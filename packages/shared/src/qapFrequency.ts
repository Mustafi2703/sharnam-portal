/**
 * QAP frequency text from Quality Assurance Plan Week 50.
 * Unknown text becomes manual. Never throws.
 */

export type QapFrequency =
  | { kind: "perElement"; label: string }
  | { kind: "perLot" }
  | { kind: "perQuantity"; every: number; unit: "cum" | "sqm" | "nos" }
  | { kind: "perSource" }
  | { kind: "perPour" }
  | { kind: "periodic"; days: number }
  | { kind: "dueDate" }
  | { kind: "manual"; raw: string };

function norm(text: string | null | undefined): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ");
}

function unitOf(token: string): "cum" | "sqm" | "nos" | null {
  const u = token.toLowerCase();
  if (/sqm|sq\.?\s*m|m2|m²/.test(u)) return "sqm";
  if (/nos|no.?s|number/.test(u)) return "nos";
  if (/cum|cmt|m3|m³|cu/.test(u)) return "cum";
  return null;
}

export function parseQapFrequency(text: string | null | undefined): QapFrequency {
  const raw = String(text || "").trim();
  const t = norm(raw);
  if (!t) return { kind: "manual", raw: "" };

  if (/as per requirement|as per concreting|brand source change/.test(t)) {
    return { kind: "manual", raw };
  }
  if (/service agency due date/.test(t)) return { kind: "dueDate" };
  if (/once in every source|once initial start|once established|every source/.test(t)) {
    return { kind: "perSource" };
  }
  if (/pour start|each pour|every pour|per pour/.test(t)) return { kind: "perPour" };
  if (/once in a? ?month|once a month|monthly|per month/.test(t)) return { kind: "periodic", days: 30 };
  if (/^daily$|every day|once a day/.test(t)) return { kind: "periodic", days: 1 };
  if (/^weekly$|once a week|once in a week|per week/.test(t)) return { kind: "periodic", days: 7 };

  const qty = t.match(/([\d][\d,]*)\s*(sqm|sq\.?\s*m|m2|m²|nos|no'?s|numbers?|cum|cmt|m3|m³|cu\.?\s*m)/i);
  if (qty && /every|test\s*\/|1\s*test|per\s+\d/.test(t)) {
    const every = Number(qty[1].replace(/,/g, ""));
    const unit = unitOf(qty[2]);
    if (every > 0 && unit) return { kind: "perQuantity", every, unit };
  }

  if (/lot|consignment/.test(t)) return { kind: "perLot" };

  if (/^(each|every)\b|each structure|each layer|each trench|each joint|every layout|every foundation/.test(t)) {
    return { kind: "perElement", label: raw };
  }

  return { kind: "manual", raw };
}

export function frequencyLabel(freq: QapFrequency): string {
  switch (freq.kind) {
    case "perElement":
      return "Per element";
    case "perLot":
      return "Per lot";
    case "perQuantity":
      return `1 / ${freq.every} ${freq.unit}`;
    case "perSource":
      return "Per source";
    case "perPour":
      return "Per pour";
    case "periodic":
      return freq.days === 1 ? "Daily" : freq.days === 7 ? "Weekly" : "Monthly";
    case "dueDate":
      return "Due date";
    default:
      return "Manual";
  }
}

/** Numeric IRs expected in the period. Null means the portal does not count them (manual, per element, per lot). */
export function expectedIrCount(
  freq: QapFrequency,
  ctx: { quantity?: number; pours?: number; openSources?: number | null }
): number | null {
  if (freq.kind === "perQuantity") {
    const q = Number(ctx.quantity) || 0;
    if (q <= 0) return 0;
    return Math.ceil(q / freq.every);
  }
  if (freq.kind === "perPour") return Math.max(0, Math.round(Number(ctx.pours) || 0));
  if (freq.kind === "periodic") return 1;
  if (freq.kind === "perSource" || freq.kind === "dueDate") {
    return ctx.openSources == null ? 1 : Math.max(0, ctx.openSources);
  }
  return null;
}
