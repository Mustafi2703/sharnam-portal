import { prisma } from "../prisma.js";

export type MatrixEmailLists = {
  to: string[];
  cc: string[];
  all: string[];
  csv: string;
};

function normEmail(raw: string | null | undefined): string | null {
  const e = (raw || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** All matrix contact emails for meetings / MoM / agenda (TO + CC, deduped). Merges TECHNICAL + COMMERCIAL by default. */
export async function getProjectMatrixEmails(
  projectId: string,
  matrixKind?: string | null,
): Promise<MatrixEmailLists> {
  const kinds =
    matrixKind && matrixKind.toUpperCase() !== "BOTH"
      ? [matrixKind.toUpperCase()]
      : ["TECHNICAL", "COMMERCIAL"];

  const rows = await prisma.communicationContact.findMany({
    where: { projectId, matrixKind: { in: kinds }, isSectionHeader: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const to: string[] = [];
  const cc: string[] = [];
  for (const r of rows) {
    const email = normEmail(r.email);
    if (!email) continue;
    if (r.mailRole === "TO") to.push(email);
    else cc.push(email);
  }

  const all = Array.from(new Set([...to, ...cc]));
  return { to, cc, all, csv: all.join(", ") };
}

/** Matrix To/CC limited to people already onboarded on this project (a portal login on the team). */
export async function getOnboardedMatrixEmails(
  projectId: string,
  matrixKind?: string | null,
): Promise<MatrixEmailLists> {
  const matrix = await getProjectMatrixEmails(projectId, matrixKind);
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { user: { select: { email: true } } },
  });
  const allowed = new Set(members.map((m) => normEmail(m.user.email)).filter((e): e is string => Boolean(e)));
  const to = matrix.to.filter((e) => allowed.has(e));
  const toSet = new Set(to);
  const cc = matrix.cc.filter((e) => allowed.has(e) && !toSet.has(e));
  const all = Array.from(new Set([...to, ...cc]));
  return { to, cc, all, csv: all.join(", ") };
}

/** Prefer explicit override, then matrix, then project notification list. */
export async function resolveMeetingRecipients(
  projectId: string,
  override?: string | null
): Promise<{ csv: string; to: string[]; cc: string[]; source: "override" | "matrix" | "project" | "none" }> {
  const trimmed = (override || "").trim();
  if (trimmed) {
    const to = trimmed.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    return { csv: trimmed, to, cc: [], source: "override" };
  }

  const listed = await getProjectMatrixEmails(projectId);
  const matrix = await getOnboardedMatrixEmails(projectId);
  if (matrix.all.length) return { csv: matrix.csv, to: matrix.to, cc: matrix.cc, source: "matrix" };
  if (listed.all.length) return { csv: "", to: [], cc: [], source: "none" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { notificationEmails: true },
  });
  const projectCsv = (project?.notificationEmails || "").trim();
  if (projectCsv) {
    const to = projectCsv.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    return { csv: projectCsv, to, cc: [], source: "project" };
  }

  return { csv: "", to: [], cc: [], source: "none" };
}


export type MeetingAttendee = {
  email: string;
  name?: string | null;
  company?: string | null;
  section?: string | null;
  mailRole: "TO" | "CC";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clean an attendee list from the request: valid unique emails, TO wins over CC. */
export function normalizeMeetingAttendees(raw: unknown): MeetingAttendee[] {
  if (!Array.isArray(raw)) return [];
  const byEmail = new Map<string, MeetingAttendee>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const email = normEmail(String(row.email || ""));
    if (!email || !EMAIL_RE.test(email)) continue;
    const mailRole: "TO" | "CC" = String(row.mailRole || "TO").toUpperCase() === "CC" ? "CC" : "TO";
    const prev = byEmail.get(email);
    if (prev && prev.mailRole === "TO") continue;
    byEmail.set(email, {
      email,
      name: row.name ? String(row.name).trim().slice(0, 120) : null,
      company: row.company ? String(row.company).trim().slice(0, 120) : null,
      section: row.section ? String(row.section).trim().slice(0, 40) : null,
      mailRole,
    });
  }
  return [...byEmail.values()].slice(0, 200);
}

export function parseMeetingAttendees(json?: string | null): MeetingAttendee[] {
  if (!json) return [];
  try {
    return normalizeMeetingAttendees(JSON.parse(json));
  } catch {
    return [];
  }
}

/**
 * Who gets a meeting's emails: the invited attendees when the meeting has them,
 * otherwise the onboarded communication-matrix To/CC (older meetings).
 */
export async function meetingRecipientLists(meeting: { projectId: string; attendeesJson?: string | null }): Promise<MatrixEmailLists> {
  const attendees = parseMeetingAttendees(meeting.attendeesJson);
  if (attendees.length) {
    const to = attendees.filter((a) => a.mailRole === "TO").map((a) => a.email);
    const toSet = new Set(to);
    const cc = attendees.filter((a) => a.mailRole === "CC" && !toSet.has(a.email)).map((a) => a.email);
    const all = Array.from(new Set([...to, ...cc]));
    return { to, cc, all, csv: all.join(", ") };
  }
  return getOnboardedMatrixEmails(meeting.projectId);
}
