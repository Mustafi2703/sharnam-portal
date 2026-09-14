const API_BASE = import.meta.env.VITE_API_URL || "";

export function apiBase(): string {
  return API_BASE;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit & { token?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  const headers = new Headers(opts.headers || {});
  if (!(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);

  const timeoutMs = opts.timeoutMs ?? 55_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { timeoutMs: _omit, ...fetchOpts } = opts;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      throw new ApiError(
        "API request was redirected (check portal URL / VITE_API_URL — use https://portal.spdc.in on the same host).",
        res.status
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.error || res.statusText || "Request failed", res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s — try again in a moment.`, 504);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

/** Prefix API host for /uploads and relative Drive paths so letter previews actually open. */
export function mediaUrl(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE.replace(/\/$/, "");
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}
