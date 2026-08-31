import { useCallback, useEffect, useState } from "react";
import { formatIstPunchTime } from "@sharnam/shared";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card } from "./ui";

/** One-tap office attendance — no selfie or GPS. Auto clock-out at 18:00 IST. */
export function OfficeClockInCard() {
  const { token, user } = useAuth();
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isOffice = user?.role === "admin" || user?.role === "office";
  const load = useCallback(async () => {
    const today = await api<any>("/api/hrm/attendance/today", { token }).catch(() => null);
    setRow(today);
  }, [token]);

  useEffect(() => {
    if (isOffice) void load();
  }, [isOffice, load]);

  if (!isOffice) return null;

  async function punch(kind: "in" | "out") {
    setBusy(true);
    setMsg("");
    try {
      const updated = await api<any>("/api/hrm/attendance", {
        method: "POST",
        token,
        body: JSON.stringify({ kind }),
      });
      setRow(updated);
      const t = kind === "in" ? updated.checkIn : updated.checkOut;
      setMsg(`${kind === "in" ? "Checked in" : "Checked out"} at ${formatIstPunchTime(t)}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Punch failed");
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = Boolean(row?.checkIn);
  const checkedOut = Boolean(row?.checkOut);

  return (
    <Card className="!p-4 border-brand/20 bg-brand-soft/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm text-ink">Today&apos;s attendance</h2>
          <p className="text-xs text-steel-muted mt-0.5">
            Simple clock-in for office. Open punches auto close at 18:00 IST.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge tone={checkedIn ? "ok" : "warn"}>
              In {formatIstPunchTime(row?.checkIn)}
            </Badge>
            <Badge tone={checkedOut ? "ok" : "neutral"}>
              Out {formatIstPunchTime(row?.checkOut)}
            </Badge>
          </div>
          {msg && <p className="text-xs mt-2 text-brand-dark">{msg}</p>}
        </div>
        <div className="flex gap-2">
          <Button type="button" disabled={busy || checkedIn} onClick={() => void punch("in")}>
            {busy ? "…" : "Clock in"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !checkedIn || checkedOut}
            onClick={() => void punch("out")}
          >
            Clock out
          </Button>
        </div>
      </div>
    </Card>
  );
}
