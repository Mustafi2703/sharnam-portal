/** Dedicated popup for checklist / NCR / drawing-check fills — never navigate the current tool window. */

export const STANDALONE_FORM_FEATURES =
  "popup=yes,width=1400,height=920,scrollbars=yes,resizable=yes";

export function isStandaloneFormPath(pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  return (
    /\/checklist\/fill\//.test(pathname) ||
    /\/drawings\/precheck\/?$/.test(pathname) ||
    /\/ncr-form\//.test(pathname)
  );
}

export function openStandaloneFormWindow(pathOrUrl: string, name: string): Window | null {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${window.location.origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  const safeName = `${name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 36)}-${Date.now().toString(36)}`;

  let win: Window | null = null;
  try {
    win = window.open("about:blank", safeName, STANDALONE_FORM_FEATURES);
  } catch {
    win = null;
  }

  if (!win || win === window) {
    window.alert("Allow pop-ups for this site so the checklist opens in a separate window — same as Drawing Check.");
    return null;
  }

  try {
    win.location.replace(url);
    win.focus();
  } catch {
    try {
      win.location.href = url;
    } catch {
      win.close();
      window.alert("Allow pop-ups for this site so the checklist opens in a separate window.");
      return null;
    }
  }

  return win;
}
