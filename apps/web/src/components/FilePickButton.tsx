/**
 * FilePickButton — accessible file picker with a real button (works on mobile Safari).
 */
import { useRef, type ChangeEvent, type ReactNode } from "react";

type Props = {
  accept?: string;
  capture?: "user" | "environment";
  multiple?: boolean;
  disabled?: boolean;
  onPick: (files: File[]) => void;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function FilePickButton({
  accept,
  capture,
  multiple,
  disabled,
  onPick,
  children,
  className = "",
  variant = "secondary",
}: Props) {
  const ref = useRef<HTMLInputElement | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (list.length) onPick(list);
  }

  return (
    <span className="file-pick-btn-wrap">
      <button
        type="button"
        disabled={disabled}
        className={`file-pick-btn file-pick-btn--${variant} ${className}`.trim()}
        onClick={() => ref.current?.click()}
      >
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        className="photo-capture__input"
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden
      />
    </span>
  );
}
