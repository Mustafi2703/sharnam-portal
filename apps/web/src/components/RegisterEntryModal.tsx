import type { ReactNode } from "react";
import { Button } from "./ui";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
};

/** Reusable modal for register add/edit — pairs with inline forms on the same page. */
const MODAL_WIDTH = { md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-5xl" } as const;

export function RegisterEntryModal({ open, title, onClose, onSave, saving, size = "md", children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className={`w-full ${MODAL_WIDTH[size]} max-h-[90vh] overflow-y-auto rounded-xl bg-paper border border-line shadow-xl`}>
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
