import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui";

export type SearchableOption = {
  value: string;
  label: string;
  sublabel?: string;
  /** Extra tokens (phone, trade, city) included in name search. */
  keywords?: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  className?: string;
  emptyOption?: string;
};

export function matchesSearch(hay: string, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return hay.toLowerCase().includes(needle);
}

/** Always-on name search — people and companies, not only lists longer than 8. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search by name…",
  required,
  className,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const deferredQ = useDeferredValue(q);
  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.sublabel || ""} ${o.keywords || ""}`;
      return hay.toLowerCase().includes(needle);
    });
  }, [options, deferredQ]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(next: string) {
    onChange(next);
    const row = options.find((o) => o.value === next);
    setQ(row?.label || "");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className || ""}`}>
      <Input
        placeholder={searchPlaceholder || placeholder}
        value={open ? q : selected?.label || q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setQ(selected?.label || q);
        }}
        autoComplete="off"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {selected && !open && selected.sublabel ? (
        <p className="text-[11px] text-steel-muted truncate mt-0.5">{selected.sublabel}</p>
      ) : null}
      {open && (
        <ul
          className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-paper shadow-lg text-sm"
          role="listbox"
        >
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`w-full text-left px-3 py-2 hover:bg-sand ${o.value === value ? "bg-brand-soft" : ""}`}
                onClick={() => pick(o.value)}
              >
                <span className="font-medium block truncate">{o.label}</span>
                {o.sublabel ? <span className="text-[11px] text-steel-muted block truncate">{o.sublabel}</span> : null}
              </button>
            </li>
          ))}
          {!filtered.length && (
            <li className="px-3 py-3 text-xs text-steel-muted">No name match for “{q.trim() || "…"}”.</li>
          )}
        </ul>
      )}
      {required ? <input type="hidden" value={value} required /> : null}
    </div>
  );
}
