import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { portalAccountKind } from "../lib/portalAccounts";
import { vendorDesk } from "../lib/vendorTypes";
import { useConsultantTypes } from "../lib/consultantTypes";
import { ConsultantTypeSelect } from "./ConsultantTypesPanel";
import { SearchableSelect } from "./SearchableSelect";
import { Button, Input, Select } from "./ui";

export const MATRIX_ORG_SECTIONS = ["Client", "PMC", "Consultant", "Contractor", "Other"] as const;
export type MatrixOrgSection = (typeof MATRIX_ORG_SECTIONS)[number];

export const EMPTY_MATRIX_FORM = {
  orgSection: "Client" as string,
  orgName: "",
  personName: "",
  designation: "",
  company: "",
  spoc: "",
  mobile: "",
  email: "",
  mailRole: "CC",
  officeAddress: "",
  bothMatrices: true,
  createDirectory: "none" as "none" | "user" | "vendor" | "both",
  userRole: "site_employee",
  vendorPartyType: "Client",
};

export type MatrixFormState = typeof EMPTY_MATRIX_FORM;

export type MatrixUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  profile?: { department?: string | null } | null;
};

export type MatrixVendor = {
  id: string;
  name: string;
  partyType?: string;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
  businessPhone?: string | null;
  address?: string | null;
  city?: string | null;
};

type AssignedVendor = { vendorId: string; partyType?: string; name?: string };

type Props = {
  form: MatrixFormState;
  onChange: (next: MatrixFormState) => void;
  users: MatrixUser[];
  vendors: MatrixVendor[];
  assignedVendors?: AssignedVendor[];
  project?: {
    clientName?: string | null;
    clientEmail?: string | null;
    clientContactName?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    designConsultant?: string | null;
    contractorName?: string | null;
    pmcName?: string | null;
  } | null;
  projectId: string;
  token: string;
  editing?: boolean;
  onMsg: (msg: string) => void;
  onDirectoryChange?: () => Promise<void> | void;
  allowCreateCompany?: boolean;
};

export function partyForSection(section: string) {
  if (section === "Client") return "Client";
  if (section === "PMC") return "PMC";
  if (section === "Consultant") return "Consultant";
  if (section === "Contractor") return "Contractor";
  return "Vendor";
}

export function roleForSection(section: string) {
  if (section === "Client") return "client";
  if (section === "Contractor") return "vendor";
  if (section === "Consultant") return "employee";
  return "site_employee";
}

function vendorMatchesSection(v: MatrixVendor, section: string) {
  const desk = vendorDesk(v.partyType);
  if (section === "Client") return desk === "client";
  if (section === "Consultant") return desk === "consultant" && v.partyType !== "PMC";
  if (section === "PMC") return v.partyType === "PMC";
  if (section === "Contractor") return desk === "vendor";
  return true;
}

function userMatchesSection(u: MatrixUser, section: string) {
  const kind = portalAccountKind(u.role, u.profile);
  if (section === "Client") return kind === "client";
  if (section === "Contractor") return kind === "vendor";
  if (section === "Consultant") return kind === "stakeholder";
  if (section === "PMC") return kind === "staff";
  return true;
}

function sectionNoun(section: string) {
  if (section === "Client") return "client";
  if (section === "Consultant") return "consultant";
  if (section === "PMC") return "PMC firm";
  if (section === "Contractor") return "vendor / contractor";
  return "company";
}

function nameLooksLike(a?: string | null, b?: string | null) {
  const x = String(a || "").trim().toLowerCase();
  const y = String(b || "").trim().toLowerCase();
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

function preferredVendor(
  section: string,
  vendors: MatrixVendor[],
  assigned: AssignedVendor[],
  project: Props["project"],
): MatrixVendor | null {
  const scoped = vendors.filter((v) => vendorMatchesSection(v, section));
  const assignedIds = new Set(
    assigned
      .filter((a) => vendorMatchesSection({ id: a.vendorId, name: a.name || "", partyType: a.partyType }, section))
      .map((a) => a.vendorId),
  );
  const onJob = scoped.filter((v) => assignedIds.has(v.id));
  const pool = onJob.length ? onJob : scoped;
  if (section === "Client") {
    const hit =
      pool.find((v) => v.email && project?.clientEmail && v.email.toLowerCase() === project.clientEmail.toLowerCase()) ||
      pool.find((v) => nameLooksLike(v.name, project?.clientName));
    if (hit) return hit;
  }
  if (section === "Consultant") {
    const hit = pool.find((v) => nameLooksLike(v.name, project?.designConsultant));
    if (hit) return hit;
  }
  if (section === "Contractor") {
    const hit = pool.find((v) => nameLooksLike(v.name, project?.contractorName));
    if (hit) return hit;
  }
  if (section === "PMC") {
    const hit = pool.find((v) => nameLooksLike(v.name, project?.pmcName) || /sharnam/i.test(v.name));
    if (hit) return hit;
  }
  if (onJob.length === 1) return onJob[0];
  if (pool.length === 1) return pool[0];
  return null;
}

function fillFromVendor(form: MatrixFormState, v: MatrixVendor): MatrixFormState {
  const section =
    v.partyType === "Client"
      ? "Client"
      : v.partyType === "PMC"
        ? "PMC"
        : v.partyType === "Consultant" || v.partyType === "Designer"
          ? "Consultant"
          : v.partyType === "Contractor" || v.partyType === "Vendor"
            ? "Contractor"
            : form.orgSection;
  const person = v.primaryContactName || form.personName || v.name;
  return {
    ...form,
    orgSection: section,
    orgName: v.name,
    company: v.name,
    personName: person,
    email: v.email || form.email,
    mobile: v.businessPhone || form.mobile,
    designation: v.trade || form.designation,
    officeAddress: [v.address, v.city].filter(Boolean).join(", ") || form.officeAddress,
    spoc: v.primaryContactName || person || form.spoc,
    createDirectory: "none",
    vendorPartyType: v.partyType || partyForSection(section),
    userRole: roleForSection(section),
  };
}

function fillFromProjectCard(form: MatrixFormState, project: Props["project"]): MatrixFormState {
  if (!project) return form;
  if (form.orgSection === "Client" && (project.clientName || project.clientEmail)) {
    return {
      ...form,
      orgName: project.clientName || form.orgName,
      company: project.clientName || form.company,
      personName: project.clientContactName || form.personName,
      email: project.clientEmail || form.email,
      mobile: project.clientPhone || form.mobile,
      officeAddress: project.clientAddress || form.officeAddress,
      spoc: project.clientContactName || form.spoc,
      mailRole: "TO",
    };
  }
  if (form.orgSection === "PMC" && project.pmcName) {
    return { ...form, orgName: project.pmcName, company: project.pmcName };
  }
  if (form.orgSection === "Consultant" && project.designConsultant) {
    return { ...form, orgName: project.designConsultant, company: project.designConsultant };
  }
  if (form.orgSection === "Contractor" && project.contractorName) {
    return { ...form, orgName: project.contractorName, company: project.contractorName };
  }
  return form;
}

function fillFromUser(form: MatrixFormState, u: MatrixUser): MatrixFormState {
  const kind = portalAccountKind(u.role, u.profile);
  const section = kind === "client" ? "Client" : kind === "vendor" ? "Contractor" : kind === "stakeholder" ? "Consultant" : "PMC";
  return {
    ...form,
    orgSection: form.orgSection || section,
    personName: u.fullName,
    email: u.email,
    mobile: u.phone || form.mobile,
    designation: form.designation || u.role.replace(/_/g, " "),
    spoc: form.spoc || u.fullName,
    userRole: u.role === "client" || u.role === "vendor" || u.role === "office" || u.role === "employee" ? u.role : "site_employee",
  };
}

/** Searchable, auto-filled matrix fields — company / person / SPOC / email stay editable after pick. */
export function MatrixPartyFields({
  form,
  onChange,
  users,
  vendors,
  assignedVendors = [],
  project,
  projectId,
  token,
  editing,
  onMsg,
  onDirectoryChange,
  allowCreateCompany = true,
}: Props) {
  const { types: consultantTypes } = useConsultantTypes(token);
  const [pickVendorId, setPickVendorId] = useState("");
  const [pickUserId, setPickUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newCo, setNewCo] = useState({ name: "", contact: "", email: "", phone: "", trade: "" });
  const autoKey = useRef("");

  const sectionVendors = useMemo(
    () => vendors.filter((v) => vendorMatchesSection(v, form.orgSection)),
    [vendors, form.orgSection],
  );

  const sectionUsers = useMemo(
    () => users.filter((u) => userMatchesSection(u, form.orgSection)),
    [users, form.orgSection],
  );

  const peopleOptions = useMemo(() => {
    const rows = sectionUsers.map((u) => ({
      value: `user:${u.id}`,
      label: u.fullName,
      sublabel: [u.email, u.phone].filter(Boolean).join(" · "),
      keywords: `${u.fullName} ${u.email} ${u.phone || ""} ${u.role}`,
    }));
    const picked = sectionVendors.find((v) => v.id === pickVendorId) || sectionVendors.find((v) => v.name === form.company);
    if (picked?.primaryContactName) {
      const key = `vendor:${picked.id}`;
      if (!rows.some((r) => r.label === picked.primaryContactName && r.sublabel?.includes(picked.email || ""))) {
        rows.unshift({
          value: key,
          label: picked.primaryContactName,
          sublabel: [picked.email, picked.businessPhone].filter(Boolean).join(" · "),
          keywords: `${picked.primaryContactName} ${picked.email || ""} ${picked.businessPhone || ""} ${picked.name}`,
        });
      }
    }
    return rows;
  }, [sectionUsers, sectionVendors, pickVendorId, form.company]);

  useEffect(() => {
    if (editing) return;
    const hit = preferredVendor(form.orgSection, vendors, assignedVendors, project);
    const key = hit
      ? `${form.orgSection}:${hit.id}`
      : `${form.orgSection}:card:${project?.clientName || ""}:${project?.pmcName || ""}:${project?.designConsultant || ""}:${project?.contractorName || ""}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    if (!hit) {
      onChange(fillFromProjectCard(form, project));
      return;
    }
    setPickVendorId(hit.id);
    const next = fillFromVendor(form, hit);
    const person = sectionUsers.find((u) => u.email && hit.email && u.email.toLowerCase() === hit.email.toLowerCase());
    onChange(person ? fillFromUser(next, person) : next);
    if (person) setPickUserId(`user:${person.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when section / directory identity changes
  }, [form.orgSection, vendors, assignedVendors, project, editing]);

  useEffect(() => {
    if (!editing) return;
    const v =
      vendors.find((x) => form.email && x.email && x.email.toLowerCase() === form.email.toLowerCase()) ||
      vendors.find((x) => x.name === form.company);
    if (v) setPickVendorId(v.id);
    const u = users.find((x) => form.email && x.email.toLowerCase() === form.email.toLowerCase());
    if (u) setPickUserId(`user:${u.id}`);
  }, [editing, form.email, form.company, vendors, users]);

  function changeSection(section: string) {
    autoKey.current = "";
    setPickVendorId("");
    setPickUserId("");
    setAdding(false);
    onChange({
      ...EMPTY_MATRIX_FORM,
      orgSection: section,
      bothMatrices: form.bothMatrices,
      mailRole: section === "Client" ? "TO" : "CC",
      vendorPartyType: partyForSection(section),
      userRole: roleForSection(section),
    });
  }

  function applyVendor(id: string, row?: MatrixVendor) {
    const v = row || vendors.find((x) => x.id === id);
    if (!v) return;
    setPickVendorId(v.id);
    const next = fillFromVendor(form, v);
    const person = users.find((u) => u.email && v.email && u.email.toLowerCase() === v.email.toLowerCase());
    onChange(person ? fillFromUser(next, person) : next);
    setPickUserId(person ? `user:${person.id}` : v.primaryContactName ? `vendor:${v.id}` : "");
  }

  function applyPerson(value: string) {
    setPickUserId(value);
    if (value.startsWith("user:")) {
      const u = users.find((x) => x.id === value.slice(5));
      if (u) onChange(fillFromUser(form, u));
      return;
    }
    if (value.startsWith("vendor:")) {
      const v = vendors.find((x) => x.id === value.slice(7));
      if (v) onChange(fillFromVendor(form, v));
    }
  }

  async function createCompany(seedName?: string) {
    const name = (seedName || newCo.name || form.company).trim();
    if (!name) {
      onMsg("Company name is required.");
      setAdding(true);
      if (seedName) setNewCo((c) => ({ ...c, name: seedName }));
      return;
    }
    setSavingNew(true);
    try {
      const partyType = partyForSection(form.orgSection);
      const created = await api<MatrixVendor>("/api/vendors", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          partyType,
          primaryContactName: newCo.contact || form.personName,
          email: newCo.email || form.email,
          businessPhone: newCo.phone || form.mobile,
          trade: newCo.trade || form.designation,
          address: form.officeAddress,
          createLogin: false,
        }),
      });
      await api(`/api/vendors/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorId: created.id, tradeRole: newCo.trade || form.designation || partyType }),
      }).catch(() => null);
      await onDirectoryChange?.();
      applyVendor(created.id, created);
      setAdding(false);
      setNewCo({ name: "", contact: "", email: "", phone: "", trade: "" });
      onMsg(`${created.name} saved on ${sectionNoun(form.orgSection)} list and this project. Fields filled — edit if needed, then add to the matrix.`);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not add company");
    } finally {
      setSavingNew(false);
    }
  }

  const noun = sectionNoun(form.orgSection);

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Party</span>
          <Select value={form.orgSection} onChange={(e) => changeSection(e.target.value)}>
            {MATRIX_ORG_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1 sm:col-span-1 lg:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Company · search {noun}s</span>
          <SearchableSelect
            key={`co-${form.orgSection}`}
            options={sectionVendors.map((v) => ({
              value: v.id,
              label: v.name,
              sublabel: [v.primaryContactName, v.email, v.trade].filter(Boolean).join(" · "),
              keywords: [v.name, v.email, v.partyType, v.primaryContactName, v.trade, v.city].filter(Boolean).join(" "),
            }))}
            value={pickVendorId}
            onChange={(id) => applyVendor(id)}
            placeholder={`Select ${noun}…`}
            searchPlaceholder={`Search ${noun} by company, contact, email…`}
            footerAction={
              editing || !allowCreateCompany
                ? undefined
                : { label: `+ New ${noun}`, onClick: () => setAdding(true) }
            }
            onCreate={
              editing || !allowCreateCompany
                ? undefined
                : (q) => {
                    setNewCo((c) => ({ ...c, name: q }));
                    setAdding(true);
                  }
            }
            createLabel={`Save as new ${noun}`}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Name · search people</span>
          <SearchableSelect
            key={`nm-${form.orgSection}-${pickVendorId}`}
            options={peopleOptions}
            value={pickUserId}
            onChange={applyPerson}
            placeholder="Select a person…"
            searchPlaceholder="Search name, email, phone…"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Name (editable)</span>
          <Input placeholder="Name" value={form.personName} onChange={(e) => onChange({ ...form, personName: e.target.value, spoc: form.spoc || e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Designation</span>
          {form.orgSection === "Consultant" ? (
            <ConsultantTypeSelect value={form.designation} onChange={(designation) => onChange({ ...form, designation })} types={consultantTypes} />
          ) : (
            <Input placeholder="Designation" value={form.designation} onChange={(e) => onChange({ ...form, designation: e.target.value })} />
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Company (editable)</span>
          <Input placeholder="Company" value={form.company} onChange={(e) => onChange({ ...form, company: e.target.value, orgName: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">SPOC · search people</span>
          <SearchableSelect
            options={peopleOptions.map((o) => ({ ...o, value: o.label }))}
            value={form.spoc}
            onChange={(spoc) => {
              const person = peopleOptions.find((o) => o.label === spoc);
              const u = person?.value.startsWith("user:") ? users.find((x) => x.id === person.value.slice(5)) : null;
              onChange({ ...form, spoc, ...(u?.phone && !form.mobile ? { mobile: u.phone } : {}) });
            }}
            allowCustom
            placeholder="SPOC"
            searchPlaceholder="Search SPOC by name…"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Mobile</span>
          <Input placeholder="Mobile" value={form.mobile} onChange={(e) => onChange({ ...form, mobile: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">E-mail · search people</span>
          <SearchableSelect
            options={peopleOptions
              .map((o) => {
                const email = o.sublabel?.split(" · ")[0] || "";
                if (!email || !email.includes("@")) return null;
                return { value: email, label: email, sublabel: o.label, keywords: `${email} ${o.label}` };
              })
              .filter((o): o is { value: string; label: string; sublabel: string; keywords: string } => Boolean(o))}
            value={form.email}
            onChange={(email) => {
              const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
              const v = vendors.find((x) => x.email && x.email.toLowerCase() === email.toLowerCase());
              if (u) onChange(fillFromUser(form, u));
              else if (v) applyVendor(v.id, v);
              else onChange({ ...form, email });
            }}
            allowCustom
            placeholder="E-mail"
            searchPlaceholder="Search email…"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">General mail</span>
          <Select value={form.mailRole} onChange={(e) => onChange({ ...form, mailRole: e.target.value })}>
            <option value="TO">TO</option>
            <option value="CC">CC</option>
          </Select>
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">Office address</span>
          <Input placeholder="Office address" value={form.officeAddress} onChange={(e) => onChange({ ...form, officeAddress: e.target.value })} />
        </label>
      </div>

      {adding && allowCreateCompany && !editing ? (
        <div className="rounded-xl border border-line bg-sand/40 p-3 grid sm:grid-cols-2 gap-2">
          <p className="sm:col-span-2 text-xs text-steel-muted">
            Add a {noun} here — stays on this matrix. Do not switch to CRM directories.
          </p>
          <Input placeholder="Company name" value={newCo.name} onChange={(e) => setNewCo({ ...newCo, name: e.target.value })} />
          <Input placeholder="Contact person" value={newCo.contact} onChange={(e) => setNewCo({ ...newCo, contact: e.target.value })} />
          <Input type="email" placeholder="Email (optional)" value={newCo.email} onChange={(e) => setNewCo({ ...newCo, email: e.target.value })} />
          <Input placeholder="Phone (optional)" value={newCo.phone} onChange={(e) => setNewCo({ ...newCo, phone: e.target.value })} />
          {form.orgSection === "Consultant" ? (
            <div className="sm:col-span-2">
              <ConsultantTypeSelect value={newCo.trade} onChange={(trade) => setNewCo({ ...newCo, trade })} types={consultantTypes} />
            </div>
          ) : (
            <Input placeholder="Trade / type (optional)" value={newCo.trade} onChange={(e) => setNewCo({ ...newCo, trade: e.target.value })} />
          )}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="button" disabled={savingNew} onClick={() => void createCompany()}>
              Save {noun} and fill row
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-steel-muted">
        Company, name, email, phone, and address fill from the selected {noun} or person. Change any field before saving.
        Need a company that is not in the list? Use + New {noun} — you stay on this matrix.
      </p>
    </div>
  );
}
