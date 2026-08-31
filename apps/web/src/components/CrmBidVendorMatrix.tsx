import { Badge, Button } from "./ui";
import { RegisterSheetFrame } from "./RegisterSheetFrame";

type Discipline = { key: string; label: string; sheetName: string };

type Slot = {
  id: string;
  vendorLabel: string;
  discipline: string;
  fileName?: string | null;
  sheetId?: string | null;
  sharePointUrl?: string | null;
};

type Row = {
  vendorLabel: string;
  slots: { discipline: Discipline; slot?: Slot | null }[];
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

type Props = {
  disciplines: Discipline[];
  vendorMatrix: Row[];
  grandTotals?: Record<string, number>;
  lowestVendor?: string;
  onOpenSlot: (slot: Slot) => void;
  onUploadSlot: (slot: Slot) => void;
};

/** Vendor × discipline BOQ matrix — R2 receipt grid. */
export function CrmBidVendorMatrix({
  disciplines,
  vendorMatrix,
  grandTotals,
  lowestVendor,
  onOpenSlot,
  onUploadSlot,
}: Props) {
  if (!vendorMatrix.length) return null;

  return (
    <RegisterSheetFrame
      title="Vendor BOQ matrix"
      sheetLabel="05.05 Bid receipt · discipline slots"
      rowCount={vendorMatrix.length}
      className="min-h-[240px]"
    >
      <table className="sheet-register__table min-w-[900px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-inherit min-w-[140px]">Vendor</th>
            {disciplines.map((d) => (
              <th key={d.key} className="text-center min-w-[100px]">
                <div className="font-semibold">{d.label}</div>
                <div className="text-[9px] font-mono font-normal text-steel-muted">{d.sheetName}</div>
              </th>
            ))}
            <th className="text-right min-w-[100px]">Grand total</th>
            <th className="text-center min-w-[80px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {vendorMatrix.map(({ vendorLabel, slots }) => {
            const filled = slots.filter((s) => s.slot?.sheetId || s.slot?.fileName).length;
            const total = grandTotals?.[vendorLabel] || 0;
            const isLowest = lowestVendor === vendorLabel;
            return (
              <tr key={vendorLabel} className={isLowest ? "bg-ok/5" : undefined}>
                <td className="sticky left-0 z-10 bg-inherit font-semibold">
                  {vendorLabel}
                  {isLowest && (
                    <span className="ml-1">
                      <Badge tone="ok">L1</Badge>
                    </span>
                  )}
                  <div className="text-[10px] text-steel-muted font-normal font-mono">
                    {filled}/{slots.length} BOQs
                  </div>
                </td>
                {slots.map(({ discipline, slot }) => (
                  <td key={discipline.key} className="text-center">
                    {!slot ? (
                      <span className="text-steel-muted">—</span>
                    ) : slot.sheetId ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="!text-[10px] !py-0.5 !px-2 !min-h-0"
                        onClick={() => onOpenSlot(slot)}
                      >
                        Fill ✓
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="!text-[10px] !py-0.5 !px-2 !min-h-0"
                        onClick={() => onUploadSlot(slot)}
                      >
                        Upload
                      </Button>
                    )}
                  </td>
                ))}
                <td className="text-right font-mono text-xs tabular-nums">{total ? formatINR(total) : "—"}</td>
                <td className="text-center text-[10px]">
                  {filled === slots.length ? (
                    <span className="text-ok font-semibold">Complete</span>
                  ) : filled > 0 ? (
                    <span className="text-brand">Partial</span>
                  ) : (
                    <span className="text-steel-muted">Pending</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </RegisterSheetFrame>
  );
}
