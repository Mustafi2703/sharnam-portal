/**
 * Email vendors / contractors when a comparative bid package is opened.
 */
import { prisma } from "../prisma.js";
import { escapeHtml, fmtEmailDate } from "./rfiEmailFormat.js";
import { sendGraphHtmlMail } from "./graphHtmlMail.js";
import { portalMailLive, queueProjectEmail } from "./email.js";
import { sharnamEmailLogoHtml } from "./brandedExport.js";

function parseEmails(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  packageBoq?: boolean;
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
        Sharnam PMC has opened a bid for <strong>${escapeHtml(opts.projectCode)}</strong> — ${escapeHtml(opts.projectName)}.
        ${
          opts.packageBoq
            ? "Download the package BOQ workbook (Excel), fill Rate and Amount, and upload that same .xlsx file. The workbook is stored in SharePoint."
            : "Upload your BOQ as an Excel workbook (.xlsx). The file is saved to SharePoint."
        }
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px;">
        <tr><td style="padding:6px 0;color:#5c6578;width:120px;">Project</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(opts.projectCode)}</td></tr>
        ${opts.packageBoq ? "" : `<tr><td style="padding:6px 0;color:#5c6578;">Revision</td><td style="padding:6px 0;">${escapeHtml(opts.revisionLabel)}</td></tr>`}
        ${opts.dueDate ? `<tr><td style="padding:6px 0;color:#5c6578;">Quote by</td><td style="padding:6px 0;font-weight:600;">${fmtEmailDate(opts.dueDate)}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#1a1d26;">${opts.packageBoq ? "Your BOQ" : "Your discipline BOQ sheets"}</p>
      <ul style="margin:0 0 20px;padding-left:18px;color:#374151;font-size:13px;">${discList}</ul>
      ${loginBlock}
      <a href="${escapeHtml(opts.uploadUrl)}" style="display:inline-block;background:#0b6a78;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Open the portal and upload the Excel BOQ</a>
      <p style="margin:16px 0 0;font-size:13px;color:#374151;">Sign in at <a href="${escapeHtml(opts.loginUrl || opts.uploadUrl)}">${escapeHtml(opts.loginUrl || opts.uploadUrl)}</a>, then upload the Excel BOQ (.xlsx) at <a href="${escapeHtml(opts.uploadUrl)}">${escapeHtml(opts.uploadUrl)}</a>.</p>
      <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">${
        opts.packageBoq
          ? "Download the BOQ, fill Rate and Amount, then upload that Excel file. Leave the item numbers and descriptions as issued. The upload is saved to SharePoint."
          : "Upload the Excel BOQ (.xlsx). It is saved to SharePoint. You can also fill the BOQ in the portal."
      }</p>
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
  /**
   * When set, email only these addresses. Unticked recipients are skipped.
   * Addresses that are not on a vendor of this package are ignored.
   */
  recipientEmails?: string[];
  /** Create portal logins when email is set on vendor record. */
  createLogins?: boolean;
}) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: opts.bidPackageId },
    include: {
      project: { select: { id: true, code: true, name: true, emailEnabled: true } },
      vendorBoqs: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              email: true,
              contacts: { select: { email: true, fullName: true } },
            },
          },
        },
      },
    },
  });
  if (!pkg) throw new Error("Bid package not found");
  if (!pkg.project) throw new Error("Link a project before opening the bid");

  const { parseDisciplinesJson } = await import("./comparativeStatement.js");
  const disciplines = parseDisciplinesJson(pkg.disciplinesJson);
  const discByKey = Object.fromEntries(disciplines.map((d) => [d.key, d.label]));

  const byVendor = new Map<
    string,
    { vendorId: string | null; email: string | null; contactEmails: string[]; disciplines: Set<string> }
  >();
  for (const slot of pkg.vendorBoqs) {
    const key = slot.vendorLabel;
    if (!byVendor.has(key)) {
      byVendor.set(key, {
        vendorId: slot.vendorId,
        email: slot.vendor?.email || null,
        contactEmails: (slot.vendor?.contacts || []).map((c) => c.email),
        disciplines: new Set(),
      });
    }
    const label = discByKey[slot.discipline] || slot.discipline;
    byVendor.get(key)!.disciplines.add(label);
  }

  const allow = opts.recipientEmails
    ? new Set(opts.recipientEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))
    : null;

  const uploadBase = `${portalOrigin()}/crm/vendor-bids?pkg=${encodeURIComponent(pkg.id)}`;
  const loginUrl = `${portalOrigin()}/login/vendor`;
  const results: {
    vendor: string;
    email: string | null;
    sent: boolean;
    loginCreated?: boolean;
    tempPassword?: string;
    projectAccess?: boolean;
    error?: string;
  }[] = [];
  const { ensureVendorPortalLogin, grantVendorProjectAccess } = await import("./crmVendorCredentials.js");

  const vendorFilter = opts.vendorLabelsOnly?.length ? new Set(opts.vendorLabelsOnly) : null;

  for (const [vendorName, info] of byVendor) {
    if (vendorFilter && !vendorFilter.has(vendorName)) continue;

    const knownEmails = [
      ...new Set(
        [
          ...parseEmails(info.email),
          ...(allow ? info.contactEmails.flatMap((e) => parseEmails(e)) : []),
        ].map((e) => e.toLowerCase()),
      ),
    ];
    const emails = allow ? knownEmails.filter((e) => allow.has(e.toLowerCase())) : knownEmails;
    if (allow && !emails.length) {
      if (!knownEmails.length) {
        results.push({
          vendor: vendorName,
          email: null,
          sent: false,
          error: "no_email",
        });
      }
      continue;
    }

    let loginCreated = false;
    let tempPassword: string | undefined;
    let portalEmail = info.email;
    const loginTarget =
      info.email && emails.some((e) => e.toLowerCase() === info.email!.trim().toLowerCase())
        ? info.email.trim()
        : emails[0];

    if (opts.createLogins !== false && loginTarget) {
      const found = await ensureVendorPortalLogin({
        email: loginTarget,
        name: vendorName,
        vendorId: info.vendorId,
      }).catch(() => null);
      // An email that already belongs to a client / consultant / staff login is not made a bidder.
      const login = found?.role === "vendor" ? found : null;
      if (login) {
        portalEmail = login.email;
        loginCreated = login.created;
        tempPassword = login.tempPassword;
        await grantVendorProjectAccess({
          projectId: pkg.project.id,
          vendorId: info.vendorId,
          userId: login.userId,
        }).catch(() => {});
      }
    } else if (info.vendorId) {
      await grantVendorProjectAccess({
        projectId: pkg.project.id,
        vendorId: info.vendorId,
      }).catch(() => {});
    }

    const html = bidInviteEmailHtml({
      projectCode: pkg.project.code,
      projectName: pkg.project.name,
      packageTitle: pkg.title,
      revisionLabel: pkg.revisionLabel,
      packageBoq: Boolean(pkg.boqLinesJson),
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

    if (emails.length && portalMailLive() && pkg.project.emailEnabled) {
      try {
        await withTimeout(
          sendGraphHtmlMail({ to: emails, subject: `[${pkg.project.code}] ${subject}`, bodyHtml: html }),
          8000,
          "bid_invite_mail",
        );
        results.push({
          vendor: vendorName,
          email: emails.join(", "),
          sent: true,
          loginCreated,
          tempPassword,
          projectAccess: Boolean(info.vendorId || loginCreated),
        });
      } catch (err) {
        results.push({
          vendor: vendorName,
          email: emails.join(", "),
          sent: false,
          loginCreated,
          tempPassword,
          projectAccess: Boolean(info.vendorId),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      results.push({
        vendor: vendorName,
        email: emails.join(", ") || null,
        sent: false,
        loginCreated,
        tempPassword,
        projectAccess: Boolean(info.vendorId),
        error: emails.length ? "mail_held" : "no_email",
      });
    }
  }

  if (pkg.project.emailEnabled) {
    const summary = [...byVendor.keys()].join(", ");
    const quoteBy = opts.dueDate ?? pkg.dueDate;
    const quoteLine = quoteBy ? `Quote by: ${fmtEmailDate(quoteBy)}` : "";
    await queueProjectEmail({
      projectId: pkg.project.id,
      subject: `Bid opened — ${pkg.title}`,
      body: `Comparative bid opened for vendors: ${summary}\n${quoteLine}\nUpload the Excel BOQ (.xlsx) — saved to SharePoint.\nVendor portal: ${uploadBase}\nSign in: ${loginUrl}`,
      bodyHtml: `<p>Bid package <strong>${escapeHtml(pkg.title)}</strong> opened.</p><p>Bidders notified: ${escapeHtml(summary)}</p>${quoteBy ? `<p>Quote by: ${escapeHtml(fmtEmailDate(quoteBy))}</p>` : ""}<p>Upload the Excel BOQ (.xlsx). It is saved to SharePoint.</p><p><a href="${escapeHtml(uploadBase)}">${escapeHtml(uploadBase)}</a></p>`,
      context: "crm.bid.open",
      createdById: opts.openedByUserId,
    }).catch(() => {});
  }

  const missingEmail = results.filter((r) => r.error === "no_email").map((r) => r.vendor);
  const accessSlips = results
    .filter((r) => r.email && r.tempPassword)
    .map((r) => ({ vendor: r.vendor, email: r.email!, tempPassword: r.tempPassword! }));
  return {
    notified: results.filter((r) => r.sent).length,
    total: results.length,
    results,
    missingEmail,
    accessSlips,
  };
}
