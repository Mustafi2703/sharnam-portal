import type { ReactNode } from "react";
import { Card } from "./ui";
import { RegisterScrollArea } from "./RegisterScrollArea";

type Props = {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Cube-style full-height cost register — sheet header + scroll hint + inner scroll. */
export function CostRegisterShell({ title, subtitle, toolbar, children, footer }: Props) {
  return (
    <Card padding={false} className="spdc-register-panel register-editor-panel register-panel-fill relative flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line bg-sand/40 shrink-0 text-left">
        <h3 className="font-semibold text-sm text-ink">{title}</h3>
        {subtitle && <p className="text-[10px] text-steel-muted mt-0.5">{subtitle}</p>}
      </div>
      {toolbar && <div className="shrink-0 border-b border-line">{toolbar}</div>}
      <div className="register-scroll-hint shrink-0 px-4 py-1.5 border-b border-line text-[10px] text-steel-muted">
        Scroll ↔ ↕ for full SPDC sheet · white cells editable · saves on blur
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
