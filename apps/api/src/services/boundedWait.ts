/**
 * Wait for a SharePoint sync only as long as the hosting gateway allows (it drops requests after ~60 s).
 * The row is already saved before the sync starts, so when SharePoint is slow the request answers with
 * `pending: true` and the filing finishes in the background; errors are logged, never thrown.
 */
export async function boundedSync<T>(label: string, work: Promise<T>, ms = 20_000): Promise<{ result: T | null; pending: boolean }> {
  work.catch((err) => console.warn(`[${label}] SharePoint sync failed:`, err instanceof Error ? err.message : err));
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  const result = await Promise.race([work.catch(() => null), timeout]);
  return { result, pending: result === null };
}
