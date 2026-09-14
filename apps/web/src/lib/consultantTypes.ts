import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { STAKEHOLDER_CONSULTANT_TRADES } from "./vendorTypes";

export const FALLBACK_CONSULTANT_TYPES = [...STAKEHOLDER_CONSULTANT_TRADES];

export async function fetchConsultantTypes(token: string | null): Promise<string[]> {
  if (!token) return [...FALLBACK_CONSULTANT_TYPES];
  const r = await api<{ types: string[] }>("/api/vendors/consultant-types", { token }).catch(() => null);
  return r?.types?.length ? r.types : [...FALLBACK_CONSULTANT_TYPES];
}

export function useConsultantTypes(token: string | null) {
  const [types, setTypes] = useState<string[]>([...FALLBACK_CONSULTANT_TYPES]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    setTypes(await fetchConsultantTypes(token));
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addType(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ types: string[] }>("/api/vendors/consultant-types", {
        method: "POST",
        token,
        body: JSON.stringify({ name: trimmed }),
      });
      setTypes(r.types || []);
      setMsg(`Added ${trimmed}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add type");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function renameType(from: string, to: string) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ types: string[] }>("/api/vendors/consultant-types", {
        method: "PATCH",
        token,
        body: JSON.stringify({ from, to }),
      });
      setTypes(r.types || []);
      setMsg(`Renamed to ${to.trim()}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not rename type");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function removeType(name: string) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ types: string[] }>(
        `/api/vendors/consultant-types?name=${encodeURIComponent(name)}`,
        { method: "DELETE", token }
      );
      setTypes(r.types || []);
      setMsg(`Removed ${name}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not remove type");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return { types, busy, msg, reload, addType, renameType, removeType };
}
