import { useCallback, useEffect, useState } from "react";

/** Keeps register rows in local state so inline edits do not reload the whole sheet. */
export function useLocalRegisterRows<T extends { id: string }>(rows: T[]) {
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const mergeRow = useCallback((id: string, patch: Partial<T>) => {
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const mergeMany = useCallback((ids: string[], patch: Partial<T>) => {
    const idSet = new Set(ids);
    setLocalRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, ...patch } : r)));
  }, []);

  return { localRows, setLocalRows, mergeRow, mergeMany };
}
