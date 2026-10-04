import { useEffect, useRef, useState } from "react";
import { isRecentError, subscribeActivity, type ActivitySnapshot } from "../lib/activityTracker";

export type StatusTone = "ok" | "warn" | "danger" | "info";

const DANGER_RE =
  /\b(could ?n[o']t|cannot|can't|failed|failure|unable|error|denied|forbidden|unauthori[sz]ed|not allowed|not found|invalid|timed out|rejected by|conflict|already exists|too large|exceeds)\b/i;
const WARN_RE =
  /^(choose|select|pick|enter|add at least|add a|fill|upload a|please|provide|type|set a|first )|\b(is required|are required|required\.|must be|must have|need(s)? to|before you|missing|not ready|not yet|pending sync|kept locally)\b/i;

/** Decide tone for a free-text status message (pages often keep only a string). */
export function inferStatusTone(text: string): StatusTone {
  const t = text.trim();
  if (!t) return "info";
  if (isRecentError(t) || DANGER_RE.test(t)) return "danger";
  if (WARN_RE.test(t)) return "warn";
  return "ok";
}

function ToneIcon({ tone }: { tone: StatusTone }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };
  if (tone === "danger")
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" strokeLinecap="round" />
      </svg>
    );
  if (tone === "warn")
    return (
      <svg {...common} aria-hidden>
        <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
      </svg>
    );
  if (tone === "info")
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.6 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Inline status line for page-level `msg` strings.
 * Errors render red (role=alert), validation hints amber, success green.
 */
export function StatusNote({
  msg,
  tone,
  className = "",
  onClose,
  compact = false,
}: {
  msg?: string | null;
  tone?: StatusTone;
  className?: string;
  onClose?: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const resolved = msg ? tone ?? inferStatusTone(msg) : "info";

  // Errors and warnings that land off-screen get scrolled into view.
  useEffect(() => {
    if (!msg || resolved === "ok" || resolved === "info") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [msg, resolved]);

  if (!msg) return null;
  return (
    <div
      ref={ref}
      className={`status-note status-note--${resolved}${compact ? " status-note--compact" : ""} ${className}`}
      role={resolved === "danger" ? "alert" : "status"}
      aria-live={resolved === "danger" ? "assertive" : "polite"}
    >
      <span className="status-note__icon">
        <ToneIcon tone={resolved} />
      </span>
      <span className="status-note__text">{msg}</span>
      {onClose ? (
        <button type="button" className="status-note__close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      ) : null}
    </div>
  );
}

/** Fixed bottom bar while writes are running — tells people to wait instead of re-clicking. */
export function GlobalActivityBar() {
  const [s, setS] = useState<ActivitySnapshot>({ writes: 0, reads: 0, sharepointWrites: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeActivity(setS), []);

  // Only show after a short delay so instant saves don't flash the bar.
  useEffect(() => {
    if (s.writes === 0) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(t);
  }, [s.writes]);

  const loading = s.reads > 0 || s.writes > 0;

  return (
    <>
      <div className={`global-progress${loading ? " is-active" : ""}`} aria-hidden />
      {visible ? (
        <div className="global-saving" role="status" aria-live="polite">
          <span className="global-saving__spinner" aria-hidden />
          <span>
            <strong>{s.sharepointWrites > 0 ? "Writing to SharePoint…" : "Saving…"}</strong>
            <span className="global-saving__hint">
              {s.sharepointWrites > 0
                ? " This can take up to a minute. Please wait — don't click again or close the tab."
                : " Please wait — don't click again."}
            </span>
          </span>
        </div>
      ) : null}
    </>
  );
}
