/**
 * Email vendors / contractors when a comparative bid package is opened.
 */
import { prisma } from "../prisma.js";
import { escapeHtml, fmtEmailDate } from "./rfiEmailFormat.js";
import { sendGraphHtmlMail } from "./graphHtmlMail.js";
import { queueProjectEmail } from "./email.js";
import { sharnamEmailLogoHtml } from "./brandedExport.js";

function parseEmails(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

function portalOrigin() {
  return (process.env.WEB_ORIGIN || process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function bidInviteEmailHtml(opts: {
  projectCode: string;
  projectName: string;
  packageTitle: string;
  revisionLabel: string;
  vendorName: string;
  disciplineLabels: string[];
  dueDate?: Date | null;
  uploadUrl: string;
  loginUrl?: string;
  portalEmail?: string;
  tempPassword?: string;
  loginCreated?: boolean;
}) {
  const discList = opts.disciplineLabels.map((d) => `<li>${escapeHtml(d)}</li>`).join("");
  const loginBlock =
    opts.loginCreated && opts.portalEmail && opts.tempPassword
      ? `<div style="margin:16px 0;padding:14px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;font-size:13px;">
      <p style="margin:0 0 8px;font-weight:700;color:#0f766e;">Your contractor portal login</p>
      <p style="margin:0;color:#374151;">Email: <strong>${escapeHtml(opts.portalEmail)}</strong><br/>
      Temporary password: <strong>${escapeHtml(opts.tempPassword)}</strong><br/>
      Sign in at: <a href="${escapeHtml(opts.loginUrl || opts.uploadUrl)}">${escapeHtml(opts.loginUrl || "Portal login")}</a></p>
      <p style="margin:8px 0 0;font-size:11px;color:#64748b;">Change your password after first sign-in.</p>
    </div>`
      : opts.portalEmail
        ? `<p style="margin:0 0 16px;font-size:12px;color:#64748b;">Sign in with your existing portal account: <strong>${escapeHtml(opts.portalEmail)}</strong></p>`
        : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#f7f8fa;font-family:Segoe UI,system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    ${sharnamEmailLogoHtml()}
    <div style="background:#fff;border:1px solid #e2e5eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#0b6a78;text-transform:uppercase;">Comparative bid opened</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#1a1d26;">${escapeHtml(opts.packageTitle)}</h1>
      <p style="margin:0 0 16px;color:#5c6578;font-size:14px;line-height:1.5;">
        Dear ${escapeHtml(opts.vendorName)},<br/><br/>
        Sharnam PMC has opened a discipline-wise BOQ bid for <strong>${escapeHtml(opts.projectCode)}</strong> — ${escapeHtml(opts.projectName)}.
        Please fill or upload your BOQ sheets (Comparative Statement R2 format) for the disciplines assigned to you.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px;">
        <tr><td style="padding:6px 0;color:#5c6578;width:120px;">Project</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(opts.projectCode)}</td></tr>
        <tr><td style="padding:6px 0;color:#5c6578;">Revision</td><td style="padding:6px 0;">${escapeHtml(opts.revisionLabel)}</td></tr>
        ${opts.dueDate ? `<tr><td style="padding:6px 0;color:#5c6578;">Due date</td><td style="padding:6px 0;">${fmtEmailDate(opts.dueDate)}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#1a1d26;">Your discipline BOQ sheets</p>
      <ul style="margin:0 0 20px;padding-left:18px;color:#374151;font-size:13px;">${discList}</ul>
      ${loginBlock}
      <a href="${escapeHtml(opts.uploadUrl)}" style="display:inline-block;background:#0b6a78;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Open bid portal → upload BOQs</a>
      <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;">You can also fill BOQs online in the portal or upload Excel matching the R2 template tabs.</p>
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">— Sharnam Project Development Consultants · Portal notification</p>
  </div></body></html>`;
}

export async function notifyBidPackageOpened(opts: {
  bidPackageId: string;
  openedByUserId: string;
  dueDate?: Date | null;
  /** Notify only these vendor labels (for late-added bidders). */
  vendorLabelsOnly?: string[];
  /** Create portal logins when email is set on vendor record. */
  createLogins?: boolean;
}) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: opts.bidPackageId },
    include: {
      project: { select: { id: true, code: true, name: true, emailEnabled: true } },
      vendorBoqs: {
        include: { vendor: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!pkg) throw new Error("Bid package not found");
  if (!pkg.project) throw new Error("Link a project before opening the bid");

  const { parseDisciplinesJson } = await import("./comparativeStatement.js");
  const disciplines = parseDisciplinesJson(pkg.disciplinesJson);
  const discByKey = Object.fromEntries(disciplines.map((d) => [d.key, d.label]));

  const byVendor = new Map<string, { vendorId: string | null; email: string | null; disciplines: Set<string> }>();
  for (const slot of pkg.vendorBoqs) {
    const key = slot.vendorLabel;
    if (!byVendor.has(key)) {
      byVendor.set(key, {
        vendorId: slot.vendorId,
        email: slot.vendor?.email || null,
        disciplines: new Set(),
      });
    }
    const label = discByKey[slot.discipline] || slot.discipline;
    byVendor.get(key)!.disciplines.add(label);
  }

  const uploadBase = `${portalOrigin()}/crm/vendor-bids?pkg=${encodeURIComponent(pkg.id)}`;
  const loginUrl = `${portalOrigin()}/login/vendor`;
  const results: { vendor: string; email: string | null; sent: boolean; loginCreated?: boolean; error?: string }[] = [];
  const { ensureVendorPortalLogin } = await import("./crmVendorCredentials.js");

  const vendorFilter = opts.vendorLabelsOnly?.length ? new Set(opts.vendorLabelsOnly) : null;

  for (const [vendorName, info] of byVendor) {
    if (vendorFilter && !vendorFilter.has(vendorName)) continue;

    let loginCreated = false;
    let tempPassword: string | undefined;
    let portalEmail = info.email;

    if (opts.createLogins !== false && info.email) {
      const login = await ensureVendorPortalLogin({ email: info.email, name: vendorName }).catch(() => null);
      if (login) {
        portalEmail = login.email;
        loginCreated = login.created;
        tempPassword = login.tempPassword;
      }
    }

    const emails = parseEmails(portalEmail);
    const html = bidInviteEmailHtml({
      projectCode: pkg.project.code,
      projectName: pkg.project.name,
      packageTitle: pkg.title,
      revisionLabel: pkg.revisionLabel,
      vendorName,
      disciplineLabels: [...info.disciplines],
      dueDate: opts.dueDate ?? pkg.dueDate,
      uploadUrl: uploadBase,
      loginUrl,
      portalEmail: portalEmail || undefined,
      tempPassword,
      loginCreated,
    });
    const subject = `Comparative bid opened — ${pkg.project.code} · ${pkg.title}`;
    const plain = [
      `Comparative bid opened for ${pkg.project.code} — ${pkg.title}.`,
      `Disciplines: ${[...info.disciplines].join(", ")}`,
      `Upload BOQs: ${uploadBase}`,
    ].join("\n");

    if (emails.length) {
      try {
        await sendGraphHtmlMail({ to: emails, subject: `[${pkg.project.code}] ${subject}`, bodyHtml: html });
        results.push({ vendor: vendorName, email: emails.join(", "), sent: true, loginCreated });
      } catch (err) {
        results.push({
          vendor: vendorName,
          email: emails.join(", "),
          sent: false,
          loginCreated,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      results.push({ vendor: vendorName, email: null, sent: false, loginCreated, error: "no_email" });
    }
  }

  if (pkg.project.emailEnabled) {
    const summary = [...byVendor.keys()].join(", ");
    await queueProjectEmail({
      projectId: pkg.project.id,
      subject: `Bid opened — ${pkg.title}`,
      body: `Comparative bid opened for vendors: ${summary}\n\nVendor portal: ${uploadBase}`,
      bodyHtml: `<p>Bid package <strong>${escapeHtml(pkg.title)}</strong> opened.</p><p>Bidders notified: ${escapeHtml(summary)}</p>`,
      context: "crm.bid.open",
      createdById: opts.openedByUserId,
    }).catch(() => {});
  }

  return { notified: results.filter((r) => r.sent).length, total: results.length, results };
}
