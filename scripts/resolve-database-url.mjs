/**
 * Build DATABASE_URL from Hostinger-friendly separate vars (avoids URL-encoding issues).
 * MYSQL_* vars take priority over legacy SQLite DATABASE_URL.
 */
export function normalizeMysqlHost() {
  const host = process.env.MYSQL_HOST?.trim() || process.env.DB_HOST?.trim();
  if (!host || host === "localhost") {
    process.env.MYSQL_HOST = "127.0.0.1";
  }
}

export function resolveDatabaseUrl() {
  normalizeMysqlHost();

  const user =
    process.env.MYSQL_USER?.trim() ||
    process.env.DB_USER?.trim() ||
    process.env.MYSQL_USERNAME?.trim();
  const password =
    process.env.MYSQL_PASSWORD?.trim() ||
    process.env.DB_PASSWORD?.trim();
  const database =
    process.env.MYSQL_DATABASE?.trim() ||
    process.env.DB_NAME?.trim() ||
    process.env.MYSQL_DB?.trim();
  const host =
    process.env.MYSQL_HOST?.trim() ||
    process.env.DB_HOST?.trim() ||
    "127.0.0.1";
  const port = process.env.MYSQL_PORT?.trim() || process.env.DB_PORT?.trim() || "3306";

  if (user && password && database) {
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  const direct = process.env.DATABASE_URL?.trim();
  if (direct?.startsWith("mysql://")) {
    if (direct.includes("@localhost:")) {
      return direct.replace("@localhost:", "@127.0.0.1:");
    }
    return direct;
  }

  if (direct?.startsWith("file:")) {
    return "";
  }

  return direct || "";
}

export function maskDatabaseUrl(url) {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

function withMysqlPoolParams(url) {
  if (!url.startsWith("mysql://")) return url;
  let normalized = url.includes("@localhost:")
    ? url.replace("@localhost:", "@127.0.0.1:")
    : url;
  const params = new URLSearchParams();
  if (!normalized.includes("connection_limit=")) params.set("connection_limit", "5");
  if (!normalized.includes("pool_timeout=")) params.set("pool_timeout", "20");
  const qs = params.toString();
  if (!qs) return normalized;
  return normalized + (normalized.includes("?") ? "&" : "?") + qs;
}

export function applyDatabaseUrl() {
  const url = withMysqlPoolParams(resolveDatabaseUrl());
  if (url.startsWith("mysql://")) {
    process.env.DATABASE_URL = url;
    return url;
  }
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    delete process.env.DATABASE_URL;
  }
  return "";
}
