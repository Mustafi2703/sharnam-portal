import type { ReactNode } from "react";

export const REGISTER_EMPTY_MSG =
  "No rows yet — upload the client Excel or use + Add row in the toolbar.";

type EmptyRowProps = {
  colSpan: number;
  message?: string;
};

/** Placeholder row inside a register tbody when the sheet has no data yet. */
export function RegisterEmptyRow({ colSpan, message = REGISTER_EMPTY_MSG }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty">
        {message}
      </td>
    </tr>
  );
}

type Props = {
  /** Sheet tab title shown in the green header bar */
  title: string;
  /** Client workbook / tab name (e.g. FINDINGS) */
  sheetLabel?: string;
  rowCount?: number;
  children: ReactNode;
  className?: string;
};

/** Excel-style register shell — header band + scrollable grid (always visible). */
export function RegisterSheetFrame({
  title,
  sheetLabel,
  rowCount,
  children,
  className = "",
}: Props) {
  return (
    <div className={`sheet-register register-sheet-frame register-panel-fill flex flex-col flex-1 min-h-0 overflow-hidden ${className}`}>
      <div className="sheet-register__head shrink-0">
        <span>{title}</span>
        <span className="text-steel-muted font-normal normal-case tracking-normal text-xs">
          {sheetLabel ? `${sheetLabel} · ` : ""}
          {rowCount != null ? `${rowCount} rows` : ""}
        </span>
      </div>
      <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
