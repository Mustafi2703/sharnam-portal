/**
 * Who may answer an RFI, and who may close it after that answer is checked.
 * The assigned party (portal user or the same email) answers.
 * The person who raised it, or Sharnam office, can also answer.
 * Close is only after an answer exists, and only for the raiser or office.
 */

export type RfiActor = {
  id: string;
  role: string;
  email?: string | null;
  fullName?: string | null;
};

export type RfiAccessRow = {
  status?: string | null;
  assignedToId?: string | null;
  assigneeEmail?: string | null;
  createdById?: string | null;
  assignedTo?: { id?: string | null; email?: string | null } | null;
  createdBy?: { id?: string | null; email?: string | null } | null;
  responses?: { id?: string; isOfficialResponse?: boolean | null }[] | null;
};

function sameEmail(a?: string | null, b?: string | null) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  return !!left && left === right;
}

export function rfiAccess(user: RfiActor, rfi: RfiAccessRow) {
  const office = user.role === "admin" || user.role === "office";
  const assignee =
    (!!rfi.assignedToId && rfi.assignedToId === user.id) ||
    (!!rfi.assignedTo?.id && rfi.assignedTo.id === user.id) ||
    sameEmail(rfi.assigneeEmail, user.email) ||
    sameEmail(rfi.assignedTo?.email, user.email);
  const creator = rfi.createdById === user.id || rfi.createdBy?.id === user.id;
  const hasAnswer = (rfi.responses || []).some((row) => row && (row.isOfficialResponse || row.id));
  const open = rfi.status !== "Closed";
  return {
    office,
    assignee,
    creator,
    hasAnswer,
    canAnswer: open && (office || assignee || creator),
    canClose: open && hasAnswer && (office || creator),
  };
}
