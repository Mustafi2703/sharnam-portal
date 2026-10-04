import { useCallback, useEffect, useState } from "react";
import { SPDC_HIRING_ROLES, scorecardRoleForDesignation } from "@sharnam/shared";
import { api } from "../api";

export type HrmDepartmentRow = { id: string; code: string; name: string; headName?: string | null };
export type HrmDesignationRow = {
  id: string;
  title: string;
  department: string;
  scorecardRole?: string | null;
  loginRole: string;
  isActive: boolean;
  employees?: number;
};

export const LOGIN_TYPE_OPTIONS = [
  { value: "office", label: "Office login" },
  { value: "hr", label: "HR login" },
  { value: "site_employee", label: "Site login" },
] as const;

/** Open departments and roles from HRMS · Masters, for every picker in HRMS. */
export function useHrmOrg(token: string | null | undefined, opts: { includeClosedRoles?: boolean } = {}) {
  const [departments, setDepartments] = useState<HrmDepartmentRow[]>([]);
  const [designations, setDesignations] = useState<HrmDesignationRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const all = opts.includeClosedRoles ? "?all=1" : "";

  const reload = useCallback(async () => {
    const [d, r] = await Promise.all([
      api<HrmDepartmentRow[]>("/api/hrm/departments", { token }).catch(() => []),
      api<HrmDesignationRow[]>(`/api/hrm/designations${all}`, { token }).catch(() => []),
    ]);
    setDepartments(d);
    setDesignations(r);
    setLoaded(true);
  }, [token, all]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { departments, designations, loaded, reload };
}

/** Open roles under a department; keeps the current value listed so older records still show it. */
export function rolesForDepartment(designations: HrmDesignationRow[], department: string, current?: string | null): HrmDesignationRow[] {
  const rows = designations.filter((d) => d.isActive && (!department || d.department === department));
  if (current && !rows.some((r) => r.title === current)) {
    rows.push({ id: `current:${current}`, title: current, department, loginRole: "site_employee", isActive: true });
  }
  return rows;
}

export function withCurrentOption(names: string[], current?: string | null): string[] {
  return current && !names.includes(current) ? [...names, current] : names;
}

/** Interview scorecard column for a role: the master's choice first, then the built-in mapping. */
export function scorecardForRole(designations: HrmDesignationRow[], title: string | null | undefined): string {
  const t = (title || "").trim();
  const row = designations.find((d) => d.title === t);
  if (row?.scorecardRole && (SPDC_HIRING_ROLES as readonly string[]).includes(row.scorecardRole)) return row.scorecardRole;
  return scorecardRoleForDesignation(t);
}
