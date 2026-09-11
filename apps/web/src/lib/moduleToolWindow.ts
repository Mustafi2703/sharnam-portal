/** Open a module tool in a dedicated window so the hub stays on the desk. */

export const TOOL_WIN_PARAM = "win";

export function isToolWindow(search = typeof window !== "undefined" ? window.location.search : ""): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get(TOOL_WIN_PARAM) === "1") return true;
  return typeof window !== "undefined" && Boolean(window.opener && !window.opener.closed);
}

export function withToolWindowParam(href: string, force = false): string {
  if (!force && !isToolWindow()) return href;
  try {
    const url = new URL(href, typeof window !== "undefined" ? window.location.origin : "https://portal.local");
    url.searchParams.set(TOOL_WIN_PARAM, "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const join = href.includes("?") ? "&" : "?";
    return href.includes(`${TOOL_WIN_PARAM}=1`) ? href : `${href}${join}${TOOL_WIN_PARAM}=1`;
  }
}

export function moduleToolHref(projectId: string, to: string, query?: string): string {
  if (!to) return `/projects/${projectId}`;
  if (to.startsWith("/")) return query ? `${to}?${query}` : to;
  return `/projects/${projectId}/${to}${query ? `?${query}` : ""}`;
}

export function openModuleToolWindow(href: string, label: string): Window | null {
  const next = withToolWindowParam(href, true);
  const abs = next.startsWith("http") ? next : `${window.location.origin}${next}`;
  const name = `sharnam-tool-${label.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 36) || "page"}`;
  const opened = window.open(abs, name, "width=1440,height=920,scrollbars=yes,resizable=yes");
  return opened;
}

export function closeToolWindowOrGo(hubHref: string) {
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.focus();
    } catch {
      /* ignore */
    }
    window.close();
    return;
  }
  window.location.href = hubHref;
}

/** Keep `?win=1` on in-window navigations so chrome stays the edit workspace. */
export function searchWithToolWindow(search: string, pathname: string): string | null {
  const onHub = pathname.includes("/hub/");
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hasWin = params.get(TOOL_WIN_PARAM) === "1";
  if (onHub || hasWin) return null;
  params.set(TOOL_WIN_PARAM, "1");
  const next = params.toString();
  return next ? `?${next}` : `?${TOOL_WIN_PARAM}=1`;
}
