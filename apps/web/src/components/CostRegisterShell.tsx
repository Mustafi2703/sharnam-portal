import type { ReactNode } from "react";
import { Card } from "./ui";
import { RegisterScrollArea } from "./RegisterScrollArea";

export type CostSheetKind = "mb" | "bbs" | "monitoring";

type Props = {
  title: string;
  subtitle?: string;
  sheetKind: CostSheetKind;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

const PANEL_CLASS: Record<CostSheetKind, string> = {
  mb: "mb-entry-panel",
  bbs: "bbs-entry-panel",
  monitoring: "boq-editor",
};

/** Cube-style full-height cost register — themed header + scroll hint + inner scroll. */
export function CostRegisterShell({ title, subtitle, sheetKind, toolbar, children, footer }: Props) {
  return (
    <Card
      padding={false}
      className={`cost-register-shell cost-register-shell--${sheetKind} ${PANEL_CLASS[sheetKind]} spdc-register-panel register-editor-panel register-panel-fill relative flex flex-col flex-1 min-h-0 overflow-hidden`}
    >
      <div className="cost-register-shell__title-bar px-4 py-2.5 border-b shrink-0 text-left">
        <h3 className="cost-register-shell__title font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-[10px] text-steel-muted mt-0.5">{subtitle}</p>}
      </div>
      {toolbar && <div className="shrink-0 border-b border-line">{toolbar}</div>}
      <div className="cost-register-shell__scroll-hint register-scroll-hint shrink-0 px-4 py-1.5 border-b text-[10px]">
        Scroll ↔ ↕ for full SPDC sheet · all columns shown · white cells editable · saves on blur
      </div>
      <div className="sheet-register register-sheet-shell flex flex-col flex-1 min-h-0 overflow-hidden border-t border-line">
        <RegisterScrollArea tall className="flex-1 min-h-0">
          {children}
        </RegisterScrollArea>
      </div>
      {footer && <div className="shrink-0 border-t border-line">{footer}</div>}
    </Card>
  );
}
