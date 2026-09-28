import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button } from "../components/ui";
import { canManageHrms } from "../lib/portalAccounts";
import { ExpenseVoucherPanel } from "../components/ExpenseVoucherPanel";

/** HR desk voucher register — same raise + approve flow as the employee page. */
export default function HrmsVouchersPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="danger"
            className="!px-2.5 !py-1.5 !text-xs !rounded-lg"
            onClick={() => {
              if (!window.confirm("Delete every expense voucher? Staff stay.")) return;
              void api("/api/hrm/registers/clear-ops", { method: "POST", token, body: JSON.stringify({ confirm: "CLEAR", which: "vouchers" }) })
                .then(() => setMsg("Vouchers deleted. Refresh the list."))
                .catch((err) => setMsg(err instanceof Error ? err.message : "Could not delete vouchers"));
            }}
          >
            Delete all vouchers
          </Button>
        </div>
      )}
      {msg ? <p className="text-sm text-ink">{msg}</p> : null}
      <ExpenseVoucherPanel variant="full" title="Raise / approve vouchers" />
    </div>
  );
}
