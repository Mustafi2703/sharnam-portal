import { useEffect, useState } from "react";
import { apiBase } from "../api";
import { useAuth } from "../auth";

/**
 * Object URL for the project's client logo, served by the API so every portal user sees it
 * (the stored SharePoint URL only renders for people signed in to SharePoint).
 * `version` is the project's `clientLogoUrl`; it changes on every upload, so a new logo is fetched straight away.
 */
export function useClientLogo(
  projectId: string | null | undefined,
  version: string | null | undefined,
  token?: string | null,
): string | null {
  const auth = useAuth();
  const bearer = token || auth.token;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !version || !bearer) {
      setSrc(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    const v = encodeURIComponent(version.slice(-80));
    fetch(`${apiBase()}/api/projects/${projectId}/client-logo/image?v=${v}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, version, bearer]);

  return src;
}
