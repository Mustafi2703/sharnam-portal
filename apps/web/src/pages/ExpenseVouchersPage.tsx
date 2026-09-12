import { useParams } from "react-router-dom";
import { ExpenseVoucherPanel } from "../components/ExpenseVoucherPanel";
import { PageHeader } from "../components/ui";
import { useAuth } from "../auth";

/** Expense / petty voucher — every employee. Site staff use daily line items. */
export default function ExpenseVouchersPage() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const isSite = user?.role === "site_employee";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={projectId ? "Daily submittals" : "HR · Expenses"}
        title={isSite || projectId ? "Daily expense voucher" : "Expense vouchers"}
        subtitle={
          isSite || projectId
            ? "Raise today's site expenses with line items. HR Head approves — same register as the office voucher desk."
            : "Every employee can raise an expense or petty voucher. Add line items, submit, and wait for HR approval."
        }
      />
      <ExpenseVoucherPanel
        variant={isSite || projectId ? "daily" : "full"}
        defaultProjectId={projectId}
      />
    </div>
  );
}
