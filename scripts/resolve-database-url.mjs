/**
 * Build DATABASE_URL from Hostinger-friendly separate vars (avoids URL-encoding issues).
 * MYSQL_* vars take priority over legacy SQLite DATABASE_URL.
 */
export function resolveDatabaseUrl() {
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
    "localhost";
  const port = process.env.MYSQL_PORT?.trim() || process.env.DB_PORT?.trim() || "3306";

  if (user && password && database) {
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  const direct = process.env.DATABASE_URL?.trim();
  if (direct?.startsWith("mysql://")) return direct;

  if (direct?.startsWith("file:")) {
    return "";
  }

  return direct || "";
}

export function maskDatabaseUrl(url) {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

export function applyDatabaseUrl() {
  const url = resolveDatabaseUrl();
  if (url.startsWith("mysql://")) {
    process.env.DATABASE_URL = url;
    return url;
  }
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    delete process.env.DATABASE_URL;
  }
  return "";
}
