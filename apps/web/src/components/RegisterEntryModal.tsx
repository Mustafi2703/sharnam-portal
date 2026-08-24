import type { ReactNode } from "react";
import { Button } from "./ui";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  size?: "md" | "lg" | "xl" | "2xl";
  children: ReactNode;
};

/** Reusable modal for register add/edit — pairs with inline forms on the same page. */
const MODAL_WIDTH = { md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-6xl", "2xl": "max-w-7xl" } as const;

export function RegisterEntryModal({ open, title, onClose, onSave, saving, size = "lg", children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/45" role="dialog" aria-modal="true">
      <div className={`w-full ${MODAL_WIDTH[size]} max-h-[94vh] overflow-y-auto rounded-xl bg-paper border border-line shadow-2xl`}>
        <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-line bg-paper">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button type="button" className="text-steel-muted hover:text-ink text-xl leading-none" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="sticky bottom-0 flex flex-wrap gap-2 justify-end px-5 py-4 border-t border-line bg-sand/30">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
