import type { ReactNode } from "react";
import { useConsultantTypes } from "../lib/consultantTypes";
import { ConsultantTypeSelect } from "./ConsultantTypesPanel";
import {
  accountKindHint,
  accountKindLabel,
  loginPathForAccount,
  roleFromAccountKind,
  type PortalAccountForm,
  type PortalAccountKind,
} from "../lib/portalAccounts";
import { Input, Select } from "./ui";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">{label}</span>
      {children}
    </label>
  );
}

const STAFF_ROLES = [
  { value: "office", label: "SPDC office — /login/office" },
  { value: "hr", label: "HR — /login/hr" },
  { value: "site_employee", label: "SPDC site — /login/site" },
  { value: "employee", label: "SPDC employee — /login/office" },
  { value: "admin", label: "Admin — /login/office" },
] as const;

type Props = {
  form: PortalAccountForm;
  onChange: (next: PortalAccountForm) => void;
  kind: PortalAccountKind;
  onKindChange?: (kind: PortalAccountKind) => void;
  allowKindSwitch?: boolean;
  allowAdminRole?: boolean;
  showActive?: boolean;
  passwordOptional?: boolean;
  token?: string | null;
  externalOnly?: boolean;
};

export function PortalAccountFields({
  form,
  onChange,
  kind,
  onKindChange,
  allowKindSwitch = true,
  allowAdminRole = false,
  showActive = false,
  passwordOptional = false,
  token = null,
  externalOnly = false,
}: Props) {
  const { types } = useConsultantTypes(token);
  const path = loginPathForAccount(form.role, kind);

  function setKind(next: PortalAccountKind) {
    const staffRole = kind === "staff" ? form.role : "office";
    onKindChange?.(next);
    onChange({
      ...form,
      role: roleFromAccountKind(next, staffRole === "client" || staffRole === "vendor" ? "office" : staffRole),
      empCode: next === "staff" ? form.empCode : "",
      department: next === "staff" ? form.department : "",
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-sand/40 px-3 py-2.5">
        <div className="text-sm font-semibold text-ink">{accountKindLabel(kind)}</div>
        <div className="text-xs text-steel-muted mt-0.5">
          Signs in at <span className="font-mono font-semibold text-ink">{path}</span>
        </div>
        <p className="text-xs text-steel-muted mt-1">{accountKindHint(kind)}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {allowKindSwitch ? (
          <Field label="Account type">
            <Select value={kind} onChange={(ev) => setKind(ev.target.value as PortalAccountKind)}>
              <option value="client">Client (owner)</option>
              <option value="stakeholder">Consultant / other stakeholder</option>
              <option value="vendor">Vendor / contractor</option>
              {!externalOnly ? <option value="staff">SPDC staff</option> : null}
            </Select>
          </Field>
        ) : null}

        {kind === "staff" ? (
          <Field label="Staff role">
            <Select value={form.role} onChange={(ev) => onChange({ ...form, role: ev.target.value })}>
              {STAFF_ROLES.filter((r) => r.value !== "admin" || allowAdminRole).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Full name">
          <Input
            required
            value={form.fullName}
            onChange={(ev) => onChange({ ...form, fullName: ev.target.value })}
            placeholder="Contact name"
          />
        </Field>
        <Field label="Login email">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(ev) => onChange({ ...form, email: ev.target.value })}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={form.phone}
            onChange={(ev) => onChange({ ...form, phone: ev.target.value })}
            placeholder="+91 …"
          />
        </Field>

        {kind === "client" ? (
          <Field label="Organisation">
            <Input
              value={form.designation}
              onChange={(ev) => onChange({ ...form, designation: ev.target.value })}
              placeholder="Owner company — e.g. Voltamp Transformers Ltd."
            />
          </Field>
        ) : null}

        {kind === "vendor" ? (
          <Field label="Company">
            <Input
              value={form.designation}
              onChange={(ev) => onChange({ ...form, designation: ev.target.value })}
              placeholder="Vendor / contractor company"
            />
          </Field>
        ) : null}

        {kind === "stakeholder" ? (
          <>
            <Field label="Firm / organisation">
              <Input
                value={form.designation}
                onChange={(ev) => onChange({ ...form, designation: ev.target.value })}
                placeholder="Consultant or partner firm"
              />
            </Field>
            <Field label="Trade / discipline">
              <ConsultantTypeSelect
                value={form.department}
                onChange={(department) => onChange({ ...form, department })}
                types={types}
              />
            </Field>
          </>
        ) : null}

        {kind === "staff" ? (
          <>
            <Field label="Emp code">
              <Input
                value={form.empCode}
                onChange={(ev) => onChange({ ...form, empCode: ev.target.value })}
                placeholder="Emp code"
              />
            </Field>
            <Field label="Department">
              <Input
                value={form.department}
                onChange={(ev) => onChange({ ...form, department: ev.target.value })}
                placeholder="Department"
              />
            </Field>
            <Field label="Designation">
              <Input
                value={form.designation}
                onChange={(ev) => onChange({ ...form, designation: ev.target.value })}
                placeholder="Designation"
              />
            </Field>
          </>
        ) : null}

        <Field label={passwordOptional ? "New password (optional)" : "Password"}>
          <Input
            type="password"
            value={form.password}
            onChange={(ev) => onChange({ ...form, password: ev.target.value })}
            autoComplete={passwordOptional ? "new-password" : "new-password"}
            placeholder={passwordOptional ? "Leave blank to keep current" : "Demo@1234"}
          />
        </Field>

        {showActive ? (
          <label className="flex items-center gap-2 text-sm sm:col-span-2 pt-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(ev) => onChange({ ...form, isActive: ev.target.checked })}
            />
            Active login
          </label>
        ) : null}
      </div>
    </div>
  );
}
