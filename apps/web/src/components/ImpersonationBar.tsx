import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { homePathForUser } from "../lib/portalAccounts";

function roleLabel(role?: string | null) {
  return String(role || "").replace("_", " ");
}

/** Fixed reminder while an admin is signed in as another login, with one click back. */
export function ImpersonationBar() {
  const { user, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!user?.impersonatedBy) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] pointer-events-none">
      <div className="mx-auto max-w-4xl m-3 pointer-events-auto rounded-xl border border-amber-500/60 bg-amber-50 text-amber-950 shadow-lg px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 dark:bg-amber-950 dark:text-amber-100">
        <span className="text-[10px] font-mono uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded">
          Test mode
        </span>
        <span className="text-sm min-w-0">
          Signed in as <strong>{user.fullName}</strong>{" "}
          <span className="text-xs opacity-80">
            ({user.email} · {roleLabel(user.role)})
          </span>
        </span>
        {err ? <span className="text-xs font-semibold text-danger">{err}</span> : null}
        <button
          type="button"
          disabled={busy}
          className="ml-auto text-sm font-semibold underline decoration-2 underline-offset-2 disabled:opacity-60"
          onClick={() => {
            setBusy(true);
            setErr("");
            void stopImpersonation()
              .then((me) => navigate(homePathForUser(me), { replace: true }))
              .catch((e) => setErr(e instanceof Error ? e.message : "Could not switch back"))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Switching…" : `Back to ${user.impersonatedBy.fullName}`}
        </button>
      </div>
    </div>
  );
}
