import { createPortal } from "react-dom";
import { Button } from "./ui";

export type ActionReason = {
  title: string;
  message: string;
  detail?: string;
};

/** Modal explaining why a bid/action button failed or cannot run. */
export function ActionReasonDialog({
  reason,
  onClose,
}: {
  reason: ActionReason | null;
  onClose: () => void;
}) {
  if (!reason) return null;
  return createPortal(
    <div className="register-modal" role="alertdialog" aria-modal="true" aria-labelledby="action-reason-title" onClick={onClose}>
      <div className="register-modal__panel register-modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="register-modal__head">
          <h3 id="action-reason-title" className="font-semibold text-ink text-base">
            {reason.title}
          </h3>
          <button type="button" className="text-steel-muted hover:text-ink text-2xl leading-none px-2" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="register-modal__body space-y-3">
          <p className="text-sm text-ink leading-relaxed">{reason.message}</p>
          {reason.detail ? (
            <pre className="text-xs text-steel-muted whitespace-pre-wrap break-words rounded-lg border border-line bg-sand/40 p-3">
              {reason.detail}
            </pre>
          ) : null}
        </div>
        <div className="register-modal__foot">
          <Button type="button" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function actionReasonFromError(title: string, err: unknown): ActionReason {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return { title, message };
}
