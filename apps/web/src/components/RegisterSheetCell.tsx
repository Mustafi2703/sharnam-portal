import { useEffect, useId, useState } from "react";

type Props = {
  value?: string | number | null;
  onCommit: (v: string) => void;
  type?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

/** Controlled-ish cell input — keeps focus while typing; saves on blur/Enter without parent reload. */
export function RegisterSheetCell({
  value,
  onCommit,
  type = "text",
  className = "",
  disabled,
  placeholder,
}: Props) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value ?? ""));
  }, [value, focused]);

  if (disabled) {
    const shown = value == null || value === "" ? "—" : String(value);
    return <span className="register-sheet-cell__readonly">{shown}</span>;
  }

  return (
    <input
      type={type}
      value={draft}
      placeholder={placeholder}
      className={`register-sheet-cell ${className}`}
      step={type === "number" ? "any" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const prev = String(value ?? "");
        if (draft !== prev) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

type SelectProps = {
  value?: string | null;
  options: string[];
  onCommit: (v: string) => void;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
};

export function RegisterSheetSelect({
  value,
  options,
  onCommit,
  disabled,
  className = "",
  allowCustom = true,
}: SelectProps) {
  const listId = useId().replace(/:/g, "");
  const current = (value || "").trim();
  const opts = [...options];
  if (current && !opts.includes(current)) opts.push(current);

  if (disabled) {
    return current ? <span className="register-sheet-cell__readonly">{current}</span> : <span className="qap-role-empty">·</span>;
  }

  if (allowCustom) {
    return (
      <>
        <input
          list={listId}
          defaultValue={current}
          className={`register-sheet-cell ${className}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== current) onCommit(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="—"
        />
        <datalist id={listId}>
          {opts.filter(Boolean).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <select
      className={`register-sheet-cell register-sheet-cell--select ${className}`}
      value={current}
      onChange={(e) => onCommit(e.target.value)}
    >
      {opts.map((o) => (
        <option key={o || "__empty"} value={o}>
          {o || "—"}
        </option>
      ))}
    </select>
  );
}
