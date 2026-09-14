/** Safe trim for form fields that may be null from the API. */
export function trimField(v: string | null | undefined): string {
  return String(v ?? "").trim();
}
