const SPDC_PMC = "Sharnam Project Development Consultants & Co.";

/** Project · client · PMC, without repeating a name when the project is called after its client. */
export function matrixSubtitle(project?: { name?: string | null; clientName?: string | null; pmcName?: string | null } | null): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [project?.name, project?.clientName ? `Client: ${project.clientName}` : "", `PMC: ${project?.pmcName || SPDC_PMC}`]) {
    const text = String(raw || "").trim();
    const key = text.replace(/^(client|pmc):\s*/i, "").toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    parts.push(text);
  }
  return parts.join(" · ") || "—";
}
