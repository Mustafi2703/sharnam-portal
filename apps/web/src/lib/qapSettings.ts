import { useCallback, useEffect, useState } from "react";
import { QAP_PICKERS } from "@sharnam/shared";
import { api } from "../api";

export type QapLibraryItem = { description: string; frequency: string; codeOfConformance: string; testAgency: string };
export type QapLibraryActivity = { activity: string; items: QapLibraryItem[] };
export type QapSettings = {
  library: QapLibraryActivity[];
  libraryCustom: boolean;
  standardLibraryActivities: number;
  pickers: Record<string, string[]>;
  pickersCustom: string[];
  editablePickers: string[];
};

export const QAP_PICKER_META: { key: string; title: string; hint: string }[] = [
  { key: "section", title: "Activity / section", hint: "Section headings offered when adding QAP lines." },
  { key: "frequency", title: "Frequency", hint: "How often a check is done (Daily, Each pour, Per lot…)." },
  { key: "codeOfConformance", title: "Code of conformance", hint: "IS codes, drawings or specifications the check follows." },
  { key: "testAgency", title: "Test agency", hint: "Who tests: site lab, NABL lab, manufacturer…" },
  { key: "contractorPerformer", title: "Contractor — performed by", hint: "Contractor role that performs the check." },
  { key: "contractorChecker", title: "Contractor — checked by", hint: "Contractor role that checks it." },
  { key: "pmcRole", title: "PMC (SPDC) role", hint: "SPDC's part: Witness, Review, Approve…" },
  { key: "clientRole", title: "Client role", hint: "Client's part: Random, Witness, Information…" },
  { key: "records", title: "Records", hint: "The record kept: Work Check List, Test report…" },
  { key: "remarks", title: "Remarks", hint: "Status remarks: Pending, Completed…" },
];

const cache = new Map<string, Promise<QapSettings>>();
const listeners = new Set<() => void>();

function fetchSettings(projectId: string, token: string | null) {
  let p = cache.get(projectId);
  if (!p) {
    p = api<QapSettings>(`/api/checklist/project/${projectId}/qap/settings`, { token });
    p.catch(() => cache.delete(projectId));
    cache.set(projectId, p);
  }
  return p;
}

/** Call after saving QAP settings so open QAP screens pick up the new library and pick-lists. */
export function invalidateQapSettings(projectId: string) {
  cache.delete(projectId);
  listeners.forEach((l) => l());
}

export function useQapSettings(projectId: string | undefined, token: string | null | undefined) {
  const [data, setData] = useState<QapSettings | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    fetchSettings(projectId, token ?? null)
      .then((d) => live && (setData(d), setError("")))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load QAP settings"));
    return () => {
      live = false;
    };
  }, [projectId, token, tick]);
  const reload = useCallback(() => {
    if (projectId) invalidateQapSettings(projectId);
  }, [projectId]);
  return { data, error, reload };
}

export function standardPickers(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(QAP_PICKERS).map(([k, v]) => [k, [...(v as readonly string[])]]));
}
