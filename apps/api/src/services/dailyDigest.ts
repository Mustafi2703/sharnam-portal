/**
 * Morning project digest — plain-language summary + deep links for SPDC leadership.
 */
import { prisma } from "../prisma.js";
import { graphConfig } from "./graph.js";
import { sendGraphHtmlMail } from "./graphHtmlMail.js";

const DEFAULT_RECIPIENTS = ["operations@spdc.in", "nirav@spdc.in"];

function portalBase() {
  return (process.env.WEB_ORIGIN || process.env.PUBLIC_WEB_URL || "http://localhost:5173").replace(/\/$/, "");
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function sinceYesterday() {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function buildDailyDigestHtml(opts?: { projectCode?: string }) {
  const since = sinceYesterday();
  const base = portalBase();
  const projects = await prisma.project.findMany({
    where: opts?.projectCode ? { code: opts.projectCode } : { status: { not: "Archived" } },
    orderBy: { code: "asc" },
    take: 20,
  });

  const sections: string[] = [];
  sections.push(
    `<p style="font-family:Segoe UI,sans-serif;font-size:15px;color:#1a1a1a">Good morning — here is what changed on the portal since midnight IST (${fmtDate(new Date())}).</p>`,
  );
  sections.push(
    `<p style="font-family:Segoe UI,sans-serif;font-size:13px;color:#555">Sign in with your SPDC account to open any link below. Password is shared separately for UAT.</p>`,
  );

  for (const p of projects) {
    const [auditCount, dprCount, rfiOpen, meetings, bidOpen, lessons] = await Promise.all([
      prisma.auditEvent.count({
        where: { entity: "Project", entityId: p.id, createdAt: { gte: since } },
      }),
      prisma.dailyLog.count({ where: { projectId: p.id, createdAt: { gte: since } } }),
      prisma.rfi.count({ where: { projectId: p.id, status: { in: ["Open", "Pending"] } } }),
      prisma.meeting.count({ where: { projectId: p.id, meetingDate: { gte: since } } }),
      prisma.crmBidPackage.count({ where: { projectId: p.id, status: { in: ["Open", "Evaluation"] } } }),
      prisma.lessonLearnt.count({ where: { projectId: p.id } }),
    ]);

    const recentAudit = await prisma.auditEvent.findMany({
      where: { entity: "Project", entityId: p.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { fullName: true, email: true } } },
    });

    const bullets: string[] = [];
    if (auditCount) bullets.push(`${auditCount} portal action(s) logged`);
    if (dprCount) bullets.push(`${dprCount} daily progress record(s) added`);
    if (meetings) bullets.push(`${meetings} meeting(s) scheduled or updated`);
    if (rfiOpen) bullets.push(`${rfiOpen} RFIs still open`);
    if (bidOpen) bullets.push(`${bidOpen} bid package(s) awaiting vendor BOQs`);
    if (!bullets.length) bullets.push("No major changes overnight — registers are up to date.");

    const activityLines = recentAudit
      .map((a) => {
        const who = a.user?.fullName || a.user?.email || "System";
        const when = new Date(a.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        return `<li>${esc(when)} · ${esc(who)} · ${esc(a.action)}</li>`;
      })
      .join("");

    sections.push(`
      <div style="margin:20px 0;padding:16px;border:1px solid #e0e0e0;border-radius:8px;font-family:Segoe UI,sans-serif">
        <h2 style="margin:0 0 8px;font-size:17px;color:#0B6A78">${esc(p.code)} — ${esc(p.name)}</h2>
        <p style="margin:0 0 10px;font-size:14px;color:#333">${bullets.join(" · ")} · ${lessons} lessons learnt on file</p>
        ${activityLines ? `<ul style="margin:8px 0 12px;padding-left:20px;font-size:13px;color:#444">${activityLines}</ul>` : ""}
        <p style="margin:0;font-size:13px">
          <a href="${base}/projects/${p.id}" style="color:#0B6A78;font-weight:600">Open project</a>
          &nbsp;·&nbsp;
          <a href="${base}/projects/${p.id}/progress" style="color:#0B6A78">Progress</a>
          &nbsp;·&nbsp;
          <a href="${base}/projects/${p.id}/comms?tab=matrix" style="color:#0B6A78">Comms</a>
          &nbsp;·&nbsp;
          <a href="${base}/projects/${p.id}/closure?tab=lessons" style="color:#0B6A78">Lessons</a>
          &nbsp;·&nbsp;
          <a href="${base}/crm/bids" style="color:#0B6A78">Bids</a>
        </p>
      </div>
    `);
  }

  sections.push(
    `<p style="font-family:Segoe UI,sans-serif;font-size:12px;color:#888;margin-top:24px">— शरणम् Portal · automated digest · reply to operations@spdc.in if anything looks wrong</p>`,
  );

  return sections.join("\n");
}

export async function sendDailyDigest(opts?: {
  recipients?: string[];
  projectCode?: string;
  preview?: boolean;
}) {
  const recipients = opts?.recipients?.length ? opts.recipients : DEFAULT_RECIPIENTS;
  const html = await buildDailyDigestHtml({ projectCode: opts?.projectCode });
  const subject = `[SPDC Portal] Morning summary — ${fmtDate(new Date())}`;
  const cfg = graphConfig();

  if (opts?.preview || !cfg.configured || process.env.GRAPH_MAIL_ENABLED === "false") {
    return { preview: true as const, subject, html, recipients, sent: false };
  }

  await sendGraphHtmlMail({ to: recipients, subject, bodyHtml: html });
  return { preview: false as const, subject, recipients, sent: true };
}
