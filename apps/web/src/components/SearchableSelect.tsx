import { useMemo, useState } from "react";
import { Input, Select } from "./ui";

export type SearchableOption = {
  value: string;
  label: string;
  sublabel?: string;
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

/** Searchable user/person picker — filter by name or email before selecting. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search name or email…",
  required,
  className,
  emptyOption = "",
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.sublabel || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [options, q]);

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      {options.length > 8 && (
        <Input
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="!text-sm"
        />
      )}
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        <option value="">{emptyOption || placeholder}</option>
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.sublabel ? ` · ${o.sublabel}` : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}
