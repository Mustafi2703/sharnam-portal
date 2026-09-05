import { useMemo, useState } from "react";
import { Input } from "./ui";
import { parseVendorBidDisciplines } from "../lib/crmBidDisciplines";

export type SearchableItem = {
  id: string;
  label: string;
  sublabel?: string;
  meta?: string;
  /** For vendor rows — show discipline tags */
  trade?: string | null;
};

type Props = {
  items: SearchableItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  maxHeightClass?: string;
};

export function SearchableCheckboxList({
  items,
  selectedIds,
  onChange,
  placeholder = "Search by name, email, trade…",
  emptyMessage = "No matches.",
  maxHeightClass = "max-h-44",
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => {
      const hay = [i.label, i.sublabel, i.meta, i.trade].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <div className="space-y-2">
      <Input
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="!text-sm"
      />
      <div className={`overflow-y-auto border rounded-xl p-2 space-y-1 ${maxHeightClass}`}>
        {!filtered.length && <p className="text-xs text-steel-muted px-1 py-2">{emptyMessage}</p>}
        {filtered.map((item) => {
          const tags = item.trade ? parseVendorBidDisciplines(item.trade) : [];
          return (
            <label key={item.id} className="flex items-start gap-2 text-sm py-1 px-1 rounded-lg hover:bg-sand/40 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={selectedIds.includes(item.id)}
                onChange={(e) => {
                  onChange(
                    e.target.checked ? [...selectedIds, item.id] : selectedIds.filter((x) => x !== item.id)
                  );
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{item.label}</span>
                {item.sublabel && <span className="text-steel-muted"> · {item.sublabel}</span>}
                {item.meta && <div className="text-[10px] font-mono text-steel-muted truncate">{item.meta}</div>}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((t) => (
                      <span key={t} className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-soft text-brand-dark">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                {!tags.length && item.trade && (
                  <div className="text-[10px] text-steel-muted mt-0.5 line-clamp-1">{item.trade}</div>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-steel-muted font-mono">
        {selectedIds.length} selected · {filtered.length} shown
        {q.trim() ? ` · filtered from ${items.length}` : ` · ${items.length} total`}
      </p>
    </div>
  );
}
