/**
 * Global request activity — powers the "Saving…" bar and click-locking so users
 * don't press the same button again while a SharePoint / DB write is still running.
 *
 * - Wraps window.fetch once (covers api() and every direct fetch call).
 * - A button that starts a write (POST/PUT/PATCH/DELETE) gets `data-busy` until the
 *   write — and any follow-up writes it chains — finish. CSS shows a spinner and a
 *   capture-phase listener swallows repeat clicks.
 * - Remembers recent API error messages so <StatusNote> can show them in red even
 *   when a page stores them in a plain `msg` string.
 */

type Listener = (s: ActivitySnapshot) => void;

export type ActivitySnapshot = {
  /** Writes in flight (POST/PUT/PATCH/DELETE). */
  writes: number;
  /** Reads in flight (GET). */
  reads: number;
  /** Writes in flight that look like SharePoint / document generation work. */
  sharepointWrites: number;
};

const SHAREPOINT_HINT = /sharepoint|graph|letters?|generate|upload|files|documents|sync|drive|export|pack/i;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Keep the button locked briefly after the last write so chained calls stay covered. */
const RELEASE_GRACE_MS = 450;
/** A write that starts this soon after a click is attributed to that click. */
const CLICK_WINDOW_MS = 600;

let snapshot: ActivitySnapshot = { writes: 0, reads: 0, sharepointWrites: 0 };
const listeners = new Set<Listener>();

function emit(patch: Partial<ActivitySnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l(snapshot));
}

export function subscribeActivity(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot);
  return () => listeners.delete(fn);
}

export function getActivity(): ActivitySnapshot {
  return snapshot;
}

/* ---------- recent error registry (for StatusNote tone) ---------- */

const recentErrors = new Map<string, number>();
const ERROR_TTL_MS = 5 * 60_000;

export function rememberError(message: string) {
  const key = message.trim();
  if (!key) return;
  recentErrors.set(key, Date.now());
  if (recentErrors.size > 50) {
    const oldest = recentErrors.keys().next().value;
    if (oldest !== undefined) recentErrors.delete(oldest);
  }
}

export function isRecentError(message: string): boolean {
  const ts = recentErrors.get(message.trim());
  return ts !== undefined && Date.now() - ts < ERROR_TTL_MS;
}

/* ---------- click session: which button owns the in-flight write ---------- */

type ClickSession = {
  el: HTMLElement;
  clickedAt: number;
  active: number;
  started: boolean;
  releaseTimer?: ReturnType<typeof setTimeout>;
};

let session: ClickSession | null = null;

function clickableFrom(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("button, [role='button'], input[type='submit'], a.btn, .btn");
}

function lockElement(el: HTMLElement) {
  el.setAttribute("data-busy", "1");
  el.setAttribute("aria-busy", "true");
}

function unlockElement(el: HTMLElement) {
  el.removeAttribute("data-busy");
  el.removeAttribute("aria-busy");
}

function joinSession(): ClickSession | null {
  if (!session) return null;
  const s = session;
  const fresh = Date.now() - s.clickedAt <= CLICK_WINDOW_MS;
  // Join if this write follows the click directly, or chains onto a still-busy session.
  if (!(fresh || s.started)) return null;
  if (s.releaseTimer) {
    clearTimeout(s.releaseTimer);
    s.releaseTimer = undefined;
  }
  s.active += 1;
  if (!s.started) {
    s.started = true;
    lockElement(s.el);
  }
  return s;
}

function leaveSession(s: ClickSession) {
  s.active -= 1;
  if (s.active > 0) return;
  s.releaseTimer = setTimeout(() => {
    unlockElement(s.el);
    if (session === s) session = null;
  }, RELEASE_GRACE_MS);
}

let installed = false;

export function installActivityTracker() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Capture phase: swallow repeat clicks on a locked button; otherwise start a session.
  document.addEventListener(
    "click",
    (event) => {
      const el = clickableFrom(event.target);
      if (!el) return;
      if (el.closest("[data-busy]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (session && session.started && session.active > 0) return; // another save owns the lock
      if (session?.releaseTimer) {
        clearTimeout(session.releaseTimer);
        unlockElement(session.el);
      }
      session = { el, clickedAt: Date.now(), active: 0, started: false };
    },
    true,
  );

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isWrite = WRITE_METHODS.has(method);
    const isSp = isWrite && SHAREPOINT_HINT.test(url);
    const owner = isWrite ? joinSession() : null;

    if (isWrite) emit({ writes: snapshot.writes + 1, sharepointWrites: snapshot.sharepointWrites + (isSp ? 1 : 0) });
    else emit({ reads: snapshot.reads + 1 });

    try {
      return await nativeFetch(input, init);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") rememberError(err.message);
      throw err;
    } finally {
      if (isWrite) {
        emit({
          writes: Math.max(0, snapshot.writes - 1),
          sharepointWrites: Math.max(0, snapshot.sharepointWrites - (isSp ? 1 : 0)),
        });
      } else {
        emit({ reads: Math.max(0, snapshot.reads - 1) });
      }
      if (owner) leaveSession(owner);
    }
  };

  // Don't let people close the tab mid-write.
  window.addEventListener("beforeunload", (event) => {
    if (snapshot.writes > 0) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
