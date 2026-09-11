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
