import { ExpenseVoucherPanel } from "../components/ExpenseVoucherPanel";
import { FieldDeskHome } from "../components/FieldDeskHome";

/** Site landing — attendance, leave, calendar, documents, and separation. */
export default function SiteAttendancePage() {
  return (
    <div className="space-y-8">
      <FieldDeskHome variant="site" />
      <div className="max-w-3xl mx-auto">
        <ExpenseVoucherPanel variant="daily" title="Daily expense voucher" />
      </div>
    </div>
  );
}
