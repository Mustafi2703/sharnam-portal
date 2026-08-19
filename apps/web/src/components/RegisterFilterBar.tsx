import { Input, Select } from "./ui";

type FilterField = {
  key: string;
  label: string;
  type: "text" | "select" | "date";
  options?: string[];
  placeholder?: string;
};

type Props = {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear?: () => void;
};

/** Sticky filter row for large quality registers (SOR, cube, site logs). */
export function RegisterFilterBar({ fields, values, onChange, onClear }: Props) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-end gap-2 px-4 py-3 border-b border-line bg-white/95 backdrop-blur-sm">
      {fields.map((f) => (
        <div key={f.key} className="min-w-[7rem]">
          <label className="text-[10px] uppercase font-semibold text-steel-muted block mb-0.5">{f.label}</label>
          {f.type === "select" ? (
            <Select
              className="!py-1 !text-xs !w-full min-w-[7rem]"
              value={values[f.key] || "All"}
              onChange={(e) => onChange(f.key, e.target.value)}
            >
              <option value="All">All</option>
              {(f.options || []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.type === "date" ? "date" : "text"}
              className="!py-1 !text-xs"
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
      {onClear && (
        <button type="button" className="text-xs font-semibold text-brand px-2 py-1.5" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
