import type { ReactNode } from "react";
import { Button } from "./ui";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  size?: "md" | "lg" | "xl" | "2xl";
  saveLabel?: string;
  children: ReactNode;
};

/** Reusable modal for register add/edit — pairs with inline forms on the same page. */
const MODAL_PANEL = { md: "register-modal__panel--md", lg: "register-modal__panel--lg", xl: "register-modal__panel--xl", "2xl": "register-modal__panel--2xl" } as const;

export function RegisterEntryModal({ open, title, onClose, onSave, saving, size = "xl", saveLabel = "Save", children }: Props) {
  if (!open) return null;
  return (
    <div
      className="register-modal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`register-modal__panel ${MODAL_PANEL[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="register-modal__head">
          <h3 className="font-semibold text-ink text-base sm:text-lg">{title}</h3>
          <button type="button" className="text-steel-muted hover:text-ink text-2xl leading-none px-2" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="register-modal__body space-y-4">{children}</div>
        <div className="register-modal__foot">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
