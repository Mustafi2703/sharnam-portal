/**
 * Open portal logins for project members and email shareable credentials.
 */
import { prisma } from "../prisma.js";
import { portalForRole, type RoleKey } from "@sharnam/shared";
import { ensurePortalLogin } from "./crmVendorCredentials.js";
import { queueProjectEmail } from "./email.js";
import { escapeHtml } from "./rfiEmailFormat.js";
import { sharnamEmailLogoHtml } from "./brandedExport.js";

function portalOrigin() {
  return (process.env.WEB_ORIGIN || process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

function loginPath(role: string) {
  if (role === "employee" || role === "stakeholder") return "/login/stakeholder";
  const portal = portalForRole((role as RoleKey) || "office");
  if (portal === "site") return "/login/site";
  if (portal === "client") return "/login/client";
  if (portal === "vendor") return "/login/vendor";
  if (portal === "admin") return "/login";
  return "/login/office";
}

function inviteHtml(opts: {
  name: string;
  projectCode: string;
  projectName: string;
  email: string;
  password: string;
  loginUrl: string;
  role: string;
}) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f7f8fa;font-family:Segoe UI,system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    ${sharnamEmailLogoHtml()}
    <div style="background:#fff;border:1px solid #e2e5eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#0b6a78;text-transform:uppercase;">Portal access</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#1a1d26;">${escapeHtml(opts.projectCode)}</h1>
      <p style="margin:0 0 16px;color:#5c6578;font-size:14px;line-height:1.5;">
        Dear ${escapeHtml(opts.name)},<br/><br/>
        Your ${escapeHtml(opts.role)} portal for <strong>${escapeHtml(opts.projectName)}</strong> is ready. Share these credentials with your team if needed.
      </p>
      <div style="margin:16px 0;padding:14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;font-size:13px;">
        <p style="margin:0;color:#374151;">Email: <strong>${escapeHtml(opts.email)}</strong><br/>
        Password: <strong>${escapeHtml(opts.password)}</strong><br/>
        Sign in: <a href="${escapeHtml(opts.loginUrl)}">${escapeHtml(opts.loginUrl)}</a></p>
      </div>
      <p style="margin:0;font-size:11px;color:#94a3b8;">Change the password after first sign-in. Keep this email if you need to share access.</p>
    </div>
  </div></body></html>`;
}

export async function emailPortalCredentials(opts: {
  projectId: string;
  createdById?: string;
  email: string;
  fullName: string;
  role: string;
  password: string;
}) {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project) return { skipped: true as const };
  const loginUrl = `${portalOrigin()}${loginPath(opts.role)}`;
  const html = inviteHtml({
    name: opts.fullName,
    projectCode: project.code,
    projectName: project.name,
    email: opts.email,
    password: opts.password,
    loginUrl,
    role: opts.role,
  });
  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Portal login — ${project.code}`,
    body: `Sign in at ${loginUrl}\nEmail: ${opts.email}\nPassword: ${opts.password}\nRole: ${opts.role}`,
    bodyHtml: html,
    context: "portal-invite",
    createdById: opts.createdById,
    toOverride: opts.email,
  });
}

/** Assign every listed person, open a login, email shareable password. */
export async function sendProjectPortalInvites(
  projectId: string,
  createdById: string,
  extra?: { email: string; fullName: string; role: RoleKey }[]
) {
  const sharePassword = process.env.SEED_PASSWORD || "Demo@1234";
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(sharePassword, 10);
  const sent: Array<{ email: string; role: string; password: string }> = [];

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, fullName: true, role: true } } },
  });

  for (const person of extra || []) {
    const login = await ensurePortalLogin({
      email: person.email,
      fullName: person.fullName,
      role: person.role,
    });
    if (!login) continue;
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: login.userId } },
      create: { projectId, userId: login.userId, role: person.role === "admin" ? "office" : person.role },
      update: {},
    });
    if (login.created) {
      await emailPortalCredentials({
        projectId,
        createdById,
        email: login.email,
        fullName: person.fullName,
        role: person.role,
        password: login.tempPassword || sharePassword,
      });
      sent.push({ email: login.email, role: person.role, password: login.tempPassword || sharePassword });
    }
  }

  for (const m of members) {
    await prisma.user.update({
      where: { id: m.user.id },
      data: { passwordHash: hash },
    });
    await emailPortalCredentials({
      projectId,
      createdById,
      email: m.user.email,
      fullName: m.user.fullName,
      role: m.user.role,
      password: sharePassword,
    });
    sent.push({ email: m.user.email, role: m.user.role, password: sharePassword });
  }

  return { sent, sharePassword, loginBase: portalOrigin() };
}

/** One briefing: project card + everyone assigned + login hint. */
export async function emailProjectSetupBrief(opts: {
  projectId: string;
  createdById?: string;
  extraTo?: string[];
}) {
  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
    include: {
      members: { include: { user: { select: { fullName: true, email: true, role: true } } } },
      vendors: { include: { vendor: { select: { name: true, partyType: true, email: true, primaryContactName: true } } } },
    },
  });
  if (!project) return { skipped: true as const, sent: [] as string[] };

  const peopleRows = project.members
    .map(
      (m) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(m.user.fullName)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(m.user.email)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(m.role || m.user.role)}</td></tr>`
    )
    .join("");
  const partyRows = project.vendors
    .map(
      (pv) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(pv.vendor.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(pv.vendor.partyType || pv.tradeRole || "")}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(pv.vendor.email || "—")}</td></tr>`
    )
    .join("");

  const loginBase = portalOrigin();
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f7f8fa;font-family:Segoe UI,system-ui,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    ${sharnamEmailLogoHtml()}
    <div style="background:#fff;border:1px solid #e2e5eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#0b6a78;text-transform:uppercase;">Project onboarded</p>
      <h1 style="margin:0 0 8px;font-size:20px;color:#1a1d26;">${escapeHtml(project.code)}</h1>
      <p style="margin:0 0 16px;color:#5c6578;font-size:14px;line-height:1.5;">
        ${escapeHtml(project.name)} is set up on the शरणम् portal. Use the client portal to review progress, raise concerns, and sign reports. Do not upload drawings or open Cost from the client desk.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 16px;">
        <tr><td style="padding:6px 8px;color:#6b7280;">Client</td><td style="padding:6px 8px;">${escapeHtml(project.clientName || "—")} · ${escapeHtml(project.clientEmail || "—")}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Location</td><td style="padding:6px 8px;">${escapeHtml(project.location || "—")}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">PMC / contractor</td><td style="padding:6px 8px;">${escapeHtml(project.pmcName || "Sharnam PMC")} · ${escapeHtml(project.contractorName || "—")}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Client login</td><td style="padding:6px 8px;"><a href="${escapeHtml(loginBase)}/login/client">${escapeHtml(loginBase)}/login/client</a></td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Office login</td><td style="padding:6px 8px;"><a href="${escapeHtml(loginBase)}/login/office">${escapeHtml(loginBase)}/login/office</a></td></tr>
      </table>
      <h2 style="margin:16px 0 8px;font-size:14px;color:#1a1d26;">People</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">${peopleRows || "<tr><td>No members yet</td></tr>"}</table>
      <h2 style="margin:16px 0 8px;font-size:14px;color:#1a1d26;">Companies</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">${partyRows || "<tr><td>No companies yet</td></tr>"}</table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">Default first password is Demo@1234 unless a personal invite said otherwise. Change it after first sign-in.</p>
    </div>
  </div></body></html>`;

  const recipients = new Set<string>();
  if (project.clientEmail) recipients.add(project.clientEmail.trim().toLowerCase());
  for (const extra of opts.extraTo || []) {
    if (extra) recipients.add(extra.trim().toLowerCase());
  }
  for (const part of String(project.notificationEmails || "").split(/[,;]/)) {
    const e = part.trim().toLowerCase();
    if (e.includes("@")) recipients.add(e);
  }

  const sent: string[] = [];
  for (const to of recipients) {
    await queueProjectEmail({
      projectId: opts.projectId,
      subject: `Project set up — ${project.code} · ${project.name}`,
      body: `${project.code} ${project.name} is live. Client: ${project.clientName}. Login ${loginBase}/login/client`,
      bodyHtml: html,
      context: "project-setup",
      createdById: opts.createdById,
      toOverride: to,
    });
    sent.push(to);
  }
  return { skipped: false as const, sent };
}
