import { Link, useSearchParams } from "react-router-dom";
import { FINANCE_PACKAGES, type FinancePackage } from "@sharnam/finance/disciplines";

type Props = {
  projectId: string;
  tab: string;
  activeKey?: string | null;
  rollups?: Array<{ key: string; raCount: number; materialCount: number; billedWithoutGst: number }>;
};

export function FinanceDisciplineStrip({ projectId, tab, activeKey, rollups }: Props) {
  const [params] = useSearchParams();
  const discipline = activeKey ?? params.get("discipline") ?? "all";

  function hrefFor(key: string) {
    const q = new URLSearchParams(params);
    q.set("tab", tab);
    if (key === "all") q.delete("discipline");
    else q.set("discipline", key);
    return `/projects/${projectId}/finance?${q.toString()}`;
  }

  function countFor(pkg: FinancePackage) {
    const row = rollups?.find((r) => r.key === pkg.key);
    if (!row) return null;
    return pkg.billKind === "ra" ? row.raCount : row.materialCount;
  }

  const pillClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
      active
        ? "border-brand bg-brand-soft text-brand-dark"
        : "border-line bg-paper text-steel-muted hover:border-brand/40"
    }`;

  return (
    <div className="flex flex-wrap gap-2">
      <Link to={hrefFor("all")} className={pillClass(discipline === "all")}>
        All disciplines
      </Link>
      {FINANCE_PACKAGES.map((pkg) => {
        const active = discipline === pkg.key;
        const n = countFor(pkg);
        return (
          <Link key={pkg.key} to={hrefFor(pkg.key)} className={pillClass(active)} title={pkg.sheetName}>
            {pkg.label}
            {n != null && n > 0 && (
              <span className="rounded-full bg-white/80 px-1.5 text-[10px] text-ink">{n}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
