import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { Button } from "./ui";

export type RegisterBrandProject = {
  id?: string;
  name?: string;
  clientName?: string;
  designConsultant?: string;
  contractorName?: string;
  pmcName?: string | null;
  location?: string | null;
  clientLogoUrl?: string | null;
};

type Props = {
  title: string;
  project?: RegisterBrandProject | null;
  token?: string | null;
  canEdit?: boolean;
  onProjectUpdated?: () => void | Promise<void>;
  legend?: ReactNode;
};

const DEFAULT_PMC = "Sharnam Project Development Consultants & Co. (SPDC)";

/** SPDC register header — fixed project / PMC / client band, all fields editable. */
export function RegisterBrandHeader({ title, project, token, canEdit, onProjectUpdated, legend }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({
    name: project?.name || "",
    clientName: project?.clientName || "",
    designConsultant: project?.designConsultant || "",
    pmcName: project?.pmcName || DEFAULT_PMC,
    contractorName: project?.contractorName || "",
    location: project?.location || "",
  });

  useEffect(() => {
    setMeta({
      name: project?.name || "",
      clientName: project?.clientName || "",
      designConsultant: project?.designConsultant || "",
      pmcName: project?.pmcName || DEFAULT_PMC,
      contractorName: project?.contractorName || "",
      location: project?.location || "",
    });
  }, [
    project?.name,
    project?.clientName,
    project?.designConsultant,
    project?.pmcName,
    project?.contractorName,
    project?.location,
  ]);

  async function patchField(key: keyof typeof meta, value: string) {
    if (!project?.id || !token) return;
    setErr("");
    setMeta((m) => ({ ...m, [key]: value }));
    try {
      await api(`/api/projects/${project.id}/settings`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ [key]: value || null }),
      });
      await onProjectUpdated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function uploadLogo(file: File) {
    if (!project?.id || !token) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/projects/${project.id}/client-logo`, { method: "POST", token, body: fd });
      await onProjectUpdated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setBusy(false);
    }
  }

  const logoSrc = project?.clientLogoUrl || null;
  const fields: Array<{ key: keyof typeof meta; label: string; highlight?: boolean; placeholder: string }> = [
    { key: "name", label: "Project", placeholder: "Project name" },
    { key: "clientName", label: "Client", highlight: true, placeholder: "Client / employer" },
    { key: "designConsultant", label: "Design Consultant", placeholder: "Architect / designer" },
    { key: "pmcName", label: "PM Consultant", placeholder: "PMC / SPDC" },
    { key: "contractorName", label: "Contractor", placeholder: "Main contractor" },
    { key: "location", label: "Location", placeholder: "Site / city" },
  ];

  return (
    <div className="border-b border-line bg-white shrink-0">
      <div className="grid lg:grid-cols-[8rem_1fr_14rem] gap-0 border-b border-line">
        <div className="p-3 border-r border-line bg-sand/50 flex flex-col items-center justify-center gap-1 min-h-[5rem]">
          {logoSrc ? (
            <img src={logoSrc} alt="Client logo" className="max-h-14 max-w-[6.5rem] object-contain" />
          ) : (
            <span className="text-[10px] font-semibold text-steel-muted uppercase tracking-wide text-center">Client LOGO</span>
          )}
          {canEdit && project?.id && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="!text-[10px] !py-0 !px-1"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {logoSrc ? "Change logo" : "Upload logo"}
              </Button>
            </>
          )}
        </div>
        <div className="p-4 flex items-center justify-center border-r border-line">
          <h2 className="font-display text-lg sm:text-xl font-bold text-brand-dark tracking-tight text-center">{title}</h2>
        </div>
        <div className="p-2 bg-brand-soft/30">{legend}</div>
      </div>
      {err && <p className="text-xs text-danger px-4 py-1 border-b border-line">{err}</p>}
      <div className="spdc-register-meta">
        {fields.map((f) => (
          <div
            key={f.key}
            className={`spdc-register-meta__cell${f.highlight ? " spdc-register-meta__cell--client" : ""}`}
          >
            <span className="spdc-register-meta__label">{f.label}</span>
            {canEdit && project?.id ? (
              <RegisterSheetCell
                value={meta[f.key]}
                className="spdc-register-meta__value !font-semibold min-w-[8rem]"
                placeholder={f.placeholder}
                onCommit={(v) => void patchField(f.key, v)}
              />
            ) : (
              <span className="spdc-register-meta__value" title={meta[f.key] || "—"}>
                {meta[f.key] || "—"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
