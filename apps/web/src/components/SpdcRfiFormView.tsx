import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, TextArea } from "./ui";
import { RfiFieldChecklist, RfiProgressBar, RfiStageStepper } from "./RfiProgressBar";
import { downloadAuthFile } from "../lib/downloadReport";
import { rfiProgress } from "../lib/rfiProgress";
import { buildSpdcRegisterRow, TEST_RFI_NOTIFY_EMAILS } from "../lib/rfiRegisterColumns";
import { parseFormDataJson } from "../lib/inspectionRequestForms";

type ProjectLite = {
  name?: string;
  code?: string;
  clientName?: string | null;
};

type Props = {
  rfi: any;
  project?: ProjectLite | null;
  token: string | null;
  canRespond: boolean;
  canClose: boolean;
  fillLink?: string;
  onReload: () => Promise<void>;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 border border-line bg-white">
      <div className="text-[10px] uppercase tracking-wide text-steel-muted px-2 pt-1.5">{label}</div>
      <div className="px-2 pb-1.5 text-sm whitespace-pre-wrap break-words">{value?.trim() ? value : "—"}</div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <h3 className="bg-[#0b6a78] text-white text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5">
        {n}. {title}
      </h3>
      {children}
    </div>
  );
}

export function SpdcRfiFormView({ rfi, project, token, canRespond, canClose, fillLink, onReload }: Props) {
  const [answer, setAnswer] = useState("");
  const [emails, setEmails] = useState(TEST_RFI_NOTIFY_EMAILS);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const progress = rfiProgress(rfi);
  const row = buildSpdcRegisterRow(rfi);
  const form = parseFormDataJson(rfi.formDataJson);
  const fileBase = String(rfi.number || "RFI").replace(/[^\w.-]+/g, "_");

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setMsg("");
    try {
      await fn();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line overflow-hidden bg-white">
        <div className="bg-[#1a1d26] text-white px-4 py-3 flex items-center gap-4">
          <img
            src="/logo-transparent.png"
            alt="Sharnam"
            className="h-12 w-auto max-w-[8rem] object-contain bg-white rounded-md p-1.5"
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-teal-200">
              Sharnam Project Development Consultants &amp; Co.
            </div>
            <h2 className="font-display text-lg leading-tight mt-0.5">Request for Information (RFI)</h2>
          </div>
        </div>
        <div className="px-4 py-2 text-[11px] text-steel-muted flex flex-wrap justify-between gap-2 border-b border-line bg-sand/30">
          <span>Form No: SPDC/QMS/F-RFI-01</span>
          <span>Form Rev: R0</span>
          <span className="font-mono text-brand font-semibold">{rfi.number}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!!busy}
          onClick={() =>
            run("xlsx", () => downloadAuthFile(`/api/rfis/${rfi.id}/download.xlsx`, token, `${fileBase}-RFI-Form.xlsx`))
          }
        >
          {busy === "xlsx" ? "Preparing…" : "Download Excel form"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!!busy}
          onClick={() =>
            run("html", () => downloadAuthFile(`/api/rfis/${rfi.id}/download.html`, token, `${fileBase}-RFI-Form.html`))
          }
        >
          {busy === "html" ? "Preparing…" : "Download HTML"}
        </Button>
        <Badge tone="brand">{rfi.rfiKind || "RequestForInformation"}</Badge>
        <Badge>{rfi.status}</Badge>
        <Badge tone="brand">Ball: {rfi.ballInCourt}</Badge>
      </div>

      <div className="space-y-2">
        <RfiStageStepper progress={progress} />
        <RfiProgressBar progress={progress} />
        <RfiFieldChecklist progress={progress} />
      </div>

      <Section n="1" title="Project particulars">
        <div className="grid sm:grid-cols-2">
          <Field label="Project" value={project?.name || project?.code} />
          <Field label="Employer / Client" value={form.employerClient || project?.clientName} />
          <Field label="Contract No" value={form.contractNo || project?.code} />
          <Field label="Project Management" value="Sharnam Project Development Consultants & Co., Vadodara" />
          <Field label="Package" value={row.PACKAGE} />
        </div>
      </Section>

      <Section n="2" title="RFI particulars">
        <div className="grid sm:grid-cols-2">
          <Field label="RFI No" value={row["RFI NO"]} />
          <Field label="Revision" value={row.REV} />
          <Field label="Date raised" value={row["DATE RAISED"]} />
          <Field label="Priority" value={row.PRIORITY} />
          <Field label="Reply required by" value={row["REPLY REQUIRED BY"]} />
          <Field label="Response time (days)" value={row["SLA DAYS"]} />
          <Field label="Originator" value={row.ORIGINATOR} />
          <Field label="Discipline" value={row.DISCIPLINE} />
          <Field label="Category" value={row.CATEGORY} />
          <Field label="Responsible party" value={row["RESPONSIBLE PARTY"]} />
          <div className="sm:col-span-2">
            <Field label="Subject" value={row.SUBJECT} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Location / grid / level" value={row["LOCATION / GRID"]} />
          </div>
          <Field label="Drawing ref" value={row["DWG REF"]} />
          <Field label="Drawing rev" value={row["DWG REV"]} />
          <div className="sm:col-span-2">
            <Field label="Specification clause" value={row["SPEC CLAUSE"]} />
          </div>
        </div>
      </Section>

      <Section n="3" title="Query raised">
        <div className="p-3 text-sm whitespace-pre-wrap bg-[#fffef6] min-h-[4.5rem]">{row["QUERY RAISED"]}</div>
      </Section>

      <Section n="4" title="Solution proposed by originator (required)">
        <div className="p-3 text-sm whitespace-pre-wrap bg-[#fffef6] min-h-[4rem]">
          {row["CONTRACTOR'S PROPOSED SOLUTION"]}
        </div>
      </Section>

      <Section n="5" title="Impact claimed by originator">
        <div className="grid sm:grid-cols-2">
          <Field label="Cost impact claimed" value={row["COST IMPACT"]} />
          <Field label="Estimated amount (INR)" value={row["EST. COST (INR)"]} />
          <Field label="Time impact claimed" value={row["TIME IMPACT"]} />
          <Field label="Estimated delay (days)" value={row["EST. DELAY (d)"]} />
        </div>
        <p className="text-[11px] text-steel-muted px-3 py-2">
          A claimed impact does not create an entitlement. If the response changes scope, raise a change notice separately.
        </p>
      </Section>

      <Section n="6" title="Response">
        <div className="p-3 text-sm whitespace-pre-wrap min-h-[4rem]">{row.RESPONSE}</div>
        <div className="grid sm:grid-cols-2">
          <Field label="Responded by" value={row["RESPONDED BY"]} />
          <Field label="Date of response" value={row["DATE RESPONDED"]} />
        </div>
        {rfi.responses?.length > 1 && (
          <ul className="border-t border-line divide-y divide-line">
            {rfi.responses.map((resp: any) => (
              <li key={resp.id} className="px-3 py-2 text-sm">
                <div className="text-[11px] text-steel-muted">
                  {resp.respondedBy?.fullName} · {new Date(resp.createdAt).toLocaleString()}
                  {resp.isOfficialResponse ? " · official" : ""}
                </div>
                <div className="mt-0.5">{resp.responseText}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n="7" title="PMC review & close-out">
        <div className="grid sm:grid-cols-2">
          <Field label="Status" value={row.STATUS} />
          <Field label="Date closed" value={row["DATE CLOSED"]} />
          <Field label="Days taken" value={row["DAYS TAKEN"]} />
          <Field label="SLA status" value={row["SLA STATUS"]} />
          <Field label="Change / VO reference" value={row["CHANGE / VO REF"]} />
          <Field label="Attachments" value={row.ATTACHMENTS} />
          <div className="sm:col-span-2">
            <Field label="PMC remarks" value={row["PMC REMARKS"]} />
          </div>
        </div>
      </Section>

      <Section n="8" title="Signatures">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {[
            ["Raised by (Contractor)", row.ORIGINATOR, row["DATE RAISED"]],
            ["Reviewed by (SPDC PMC)", "Name / Signature / Date", ""],
            ["Responded by (Consultant)", row["RESPONDED BY"], row["DATE RESPONDED"]],
            ["Accepted & closed by (SPDC PMC)", row.STATUS === "Closed" ? "SPDC PMC" : "", row["DATE CLOSED"]],
          ].map(([label, name, date]) => (
            <div key={label} className="border border-line p-3 min-h-[5.5rem]">
              <div className="font-semibold text-steel-muted mb-3">{label}</div>
              <div>{name || "Name"}</div>
              <div className="text-steel-muted mt-1">{date || "Signature / Date"}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-steel-muted px-3 py-2">
          Distribution: Contractor / Design Consultant / Employer's Representative / SPDC Document Control.
        </p>
      </Section>

      {fillLink && (rfi.linkedAssignmentId || rfi.linkedChecklistItemId) && (
        <div className="rounded-lg border-2 border-brand bg-brand-soft/40 p-4 text-sm space-y-2">
          <div className="font-semibold text-xs uppercase tracking-wider text-brand">Linked checklist</div>
          <Link to={fillLink}>
            <Button type="button" className="!text-sm">
              Fill checklist form →
            </Button>
          </Link>
        </div>
      )}

      {rfi.status !== "Closed" && (
        <div className="rounded-xl border border-line p-4 space-y-2 bg-sand/20">
          <h3 className="font-semibold text-sm">Send / follow-up</h3>
          <p className="text-xs text-steel-muted">
            Sends the branded RFI to the project notification list plus any extra addresses below.
          </p>
          <input
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Extra emails, comma-separated"
          />
          <TextArea rows={2} placeholder="Follow-up note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run("follow", async () => {
                const result = await api<any>(`/api/rfis/${rfi.id}/follow-up`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ extraEmails: emails, note }),
                });
                const skipped = result?.email?.skipped;
                const status = result?.email?.email?.status || result?.email?.transport;
                setMsg(
                  skipped
                    ? `Email skipped (${result.email.reason || "disabled"}). Check project email settings.`
                    : `Follow-up ${status || "queued"} to ${emails}.`
                );
              })
            }
          >
            {busy === "follow" ? "Sending…" : "Send follow-up"}
          </Button>
        </div>
      )}

      {canRespond && rfi.status !== "Closed" && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("respond", async () => {
              await api(`/api/rfis/${rfi.id}/respond`, {
                method: "POST",
                token,
                body: JSON.stringify({ responseText: answer, isOfficialResponse: true }),
              });
              setAnswer("");
              await onReload();
            });
          }}
        >
          <TextArea rows={3} placeholder="Official response (section 6)" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
          <div className="flex gap-2">
            <Button type="submit" disabled={!!busy}>
              {busy === "respond" ? "Saving…" : "Submit response"}
            </Button>
            {canClose && (
              <Button
                type="button"
                variant="secondary"
                disabled={!!busy}
                onClick={() =>
                  run("close", async () => {
                    await api(`/api/rfis/${rfi.id}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({ status: "Closed", ballInCourt: "Creator" }),
                    });
                    await onReload();
                  })
                }
              >
                Close RFI
              </Button>
            )}
          </div>
        </form>
      )}

      {!canRespond && rfi.status !== "Closed" && (
        <p className="text-xs text-steel-muted bg-sand/50 p-3 rounded-lg">
          Respond / close is for Communication Matrix parties — ask Sharnam office under Comms → Matrix.
        </p>
      )}

      {msg && <p className="text-sm text-brand">{msg}</p>}
    </div>
  );
}
