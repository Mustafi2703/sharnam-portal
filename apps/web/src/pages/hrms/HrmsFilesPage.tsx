import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, mediaUrl } from "../../api";
import { useAuth } from "../../auth";
import { UploadModal } from "../../components/UploadModal";
import { Badge, Button, Card, Select } from "../../components/ui";
import { canManageHrms } from "../../lib/portalAccounts";

const FILE_KINDS = ["PAN", "Aadhaar", "Bank", "PF-ESIC", "Offer", "Appointment", "Promotion", "Payslip", "Medical", "BGV", "ID-card", "Other"];
const HR_VAULT_ROOT = "06_HR_AND_ADMIN/06.02_Employee_Files";

function vaultFolderName(person: StaffRow | undefined) {
  if (!person) return "—";
  const code = person.profile?.empCode?.trim();
  const raw = code || person.fullName;
  return raw.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48) || "Unfiled";
}

type StaffRow = {
  id: string;
  fullName: string;
  email: string;
  profile?: { empCode?: string | null; designation?: string | null } | null;
};

type FileRow = {
  id: string;
  category: string;
  title: string;
  fileUrl: string;
  storagePath?: string | null;
  issuedOn?: string | null;
  createdAt: string;
};

/** Per-employee HRMS vault — multiple files land under 06.02 Employee Files on Drive. */
export default function HrmsFilesPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [searchParams] = useSearchParams();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [hiring, setHiring] = useState<Array<{ id: string; candidate?: { fullName: string }; onboard?: { userId?: string | null } }>>([]);
  const [userId, setUserId] = useState(searchParams.get("userId") || "");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("PAN");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [provisionBusy, setProvisionBusy] = useState(false);

  const loadStaff = useCallback(async () => {
    const [rows, pipeline] = await Promise.all([
      api<StaffRow[]>("/api/hrm/employees", { token }).catch(() => []),
      api<Array<{ id: string; candidate?: { fullName: string }; onboard?: { userId?: string | null } }>>(
        "/api/hrm/hiring-pipeline",
        { token },
      ).catch(() => []),
    ]);
    setStaff(rows);
    setHiring(pipeline);
    const fromUrl = searchParams.get("userId");
    if (fromUrl) setUserId(fromUrl);
    else setUserId((prev) => prev || rows[0]?.id || "");
  }, [token, searchParams]);

  const loadFiles = useCallback(async () => {
    if (!userId) {
      setFiles([]);
      return;
    }
    const rows = await api<FileRow[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(userId)}`, { token }).catch(() => []);
    setFiles(rows);
  }, [token, userId]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const person = staff.find((s) => s.id === userId);
  const vaultPath = person ? `_HR/${HR_VAULT_ROOT}/${vaultFolderName(person)}/` : null;
  const hiringForUser = useMemo(
    () => hiring.filter((o) => o.onboard?.userId === userId),
    [hiring, userId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const pack = [file, ...extraFiles].filter(Boolean) as File[];
    if (!pack.length) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("userId", userId);
      fd.append("category", category);
      if (title.trim()) fd.append("title", title.trim());
      for (const f of pack) fd.append("files", f);
      await api("/api/hrm/employee-files", { method: "POST", token, body: fd });
      setMsgTone("ok");
      setMsg(`${pack.length} file(s) filed for ${person?.fullName || "employee"}.`);
      setOpen(false);
      setFile(null);
      setExtraFiles([]);
      setTitle("");
      await loadFiles();
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm text-steel-muted">
            Per-employee HR DMS on SharePoint / Drive — PAN, signed appointment, payslips, BGV. Files land under{" "}
            <span className="font-mono text-xs">_HR/{HR_VAULT_ROOT}/{"{empCode or name}"}/Letters|Onboarding|Documents</span>.
          </p>
          <Link to="/hrm/documents" className="text-xs text-brand font-semibold underline mt-1 inline-block">
            Appointment letters register →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-steel-muted">
            Employee
            <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="!min-w-[220px]">
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                  {s.profile?.empCode ? ` · ${s.profile.empCode}` : ""}
                </option>
              ))}
            </Select>
          </label>
          <Button type="button" onClick={() => setOpen(true)} disabled={!userId}>
            Upload files
          </Button>
          {canManage ? (
            <Button
              type="button"
              variant="secondary"
              disabled={provisionBusy}
              onClick={async () => {
                setProvisionBusy(true);
                setMsg("");
                try {
                  const out = await api<{ provisioned: number; employees: Array<{ docsSynced: number }> }>(
                    "/api/hrm/employees/provision-vaults",
                    {
                      method: "POST",
                      token,
                      body: JSON.stringify(userId ? { userId } : {}),
                    },
                  );
                  const synced = out.employees.reduce((n, e) => n + (e.docsSynced || 0), 0);
                  setMsgTone("ok");
                  setMsg(
                    userId
                      ? `Vault ready for ${person?.fullName || "employee"}${synced ? ` · ${synced} file(s) re-filed` : ""}.`
                      : `Vault folders ready for ${out.provisioned} employee(s)${synced ? ` · ${synced} file(s) re-filed` : ""}.`,
                  );
                  await loadFiles();
                } catch (err) {
                  setMsgTone("err");
                  setMsg(err instanceof Error ? err.message : "Could not provision vaults");
                } finally {
                  setProvisionBusy(false);
                }
              }}
            >
              {provisionBusy ? "Provisioning…" : userId ? "Ensure vault folder" : "Provision all vaults"}
            </Button>
          ) : null}
        </div>
      </div>

      {canManage && !vaultPath ? (
        <Card className="!p-3 text-xs text-amber-900 bg-amber-50 border-amber-200">
          No vault folder yet for this employee. Click <strong>Ensure vault folder</strong> before uploading — existing
          documents will be re-filed under <span className="font-mono">_HR/06.02 Employee Files/{"{empCode}"}/Documents/</span> with
          names like <span className="font-mono">PAN_SPDC-001_scan_2026-09-15.pdf</span>.
        </Card>
      ) : null}

      {vaultPath ? (
        <Card className="!p-3 text-xs text-steel-muted font-mono break-all">
          SharePoint path: <span className="text-ink">{vaultPath}</span>
          <span className="block font-sans text-[11px] mt-1 normal-case">
            Subfolders: Letters · Onboarding · Documents
          </span>
        </Card>
      ) : null}

      {hiringForUser.length ? (
        <Card className="!p-3 text-xs text-steel-muted">
          Active hiring for this employee — appointment and onboarding docs are filed here once the candidate signs and HR uploads.
        </Card>
      ) : null}

      {msg ? (
        <p
          className={
            msgTone === "err"
              ? "text-sm rounded-lg px-3 py-2 text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]"
              : "text-sm text-ok bg-brand-soft/40 border border-brand/20 px-3 py-2 rounded-lg"
          }
        >
          {msg}
        </p>
      ) : null}

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">
          {person?.fullName || "Select an employee"} · {files.length} file{files.length === 1 ? "" : "s"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-sand/30 text-left text-xs uppercase tracking-wide text-steel-muted">
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">File</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-line/60">
                  <td className="px-4 py-2.5">
                    <Badge tone="brand">{f.category}</Badge>
                  </td>
                  <td className="px-4 py-2.5">{f.title}</td>
                  <td className="px-4 py-2.5 text-xs text-steel-muted">
                    {new Date(f.issuedOn || f.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={mediaUrl(f.fileUrl)} target="_blank" rel="noreferrer" className="text-brand underline text-xs">
                      Open
                    </a>
                    {f.storagePath ? (
                      <div className="text-[10px] text-steel-muted font-mono mt-0.5 truncate max-w-[220px]" title={f.storagePath}>
                        {f.storagePath}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!files.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-steel-muted">
                    No files yet for this person.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <UploadModal
        open={open}
        title="File employee documents"
        context={person ? `${person.fullName} · ${person.email}` : undefined}
        file={file}
        onFile={setFile}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
        primaryLabel="Upload to Drive"
        busy={busy}
        onClose={() => {
          setOpen(false);
          setFile(null);
          setExtraFiles([]);
        }}
        onSubmit={(e) => void submit(e)}
        fields={[
          {
            kind: "select",
            name: "category",
            label: "Document kind",
            value: category,
            onChange: setCategory,
            options: FILE_KINDS,
          },
          {
            kind: "text",
            name: "title",
            label: "Title (optional)",
            value: title,
            onChange: setTitle,
            placeholder: "Defaults to the file name",
          },
          {
            kind: "custom",
            node: (
              <label className="block text-xs text-steel-muted">
                Extra files (same kind)
                <input
                  type="file"
                  multiple
                  className="mt-1 block w-full text-sm"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                  onChange={(ev) => setExtraFiles(Array.from(ev.target.files || []))}
                />
              </label>
            ),
          },
        ]}
      />
    </div>
  );
}
