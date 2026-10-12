import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { QapPickerLists } from "./QapPickerLists";
import { Input, Select } from "./ui";

type Item = { description: string; frequency: string; codeOfConformance: string; testAgency: string };
type Activity = { activity: string; items: Item[] };

/** Add QAP lines from the client's library: pick an activity, tick its checks — frequency, code and test agency fill in. */
export function QapLibraryModal({
  open,
  onClose,
  projectId,
  token,
  weeks,
  defaultWeek,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  token: string | null;
  weeks: string[];
  defaultWeek: string;
  onSaved: (msg: string) => void | Promise<void>;
}) {
  const [library, setLibrary] = useState<Activity[]>([]);
  const [activity, setActivity] = useState("");
  const [section, setSection] = useState("");
  const [week, setWeek] = useState(defaultWeek);
  const [picked, setPicked] = useState<number[]>([]);
  const [roles, setRoles] = useState({ contractorPerformer: "", contractorChecker: "", pmcRole: "", clientRole: "", records: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || library.length) return;
    void api<Activity[]>(`/api/checklist/project/${projectId}/qap/library`, { token })
      .then(setLibrary)
      .catch(() => setErr("The QAP library (Quality Assurance Plan Week 50.xlsx) could not be read."));
  }, [open, projectId, token, library.length]);
  useEffect(() => setWeek(defaultWeek), [defaultWeek]);

  const items = useMemo(() => library.find((a) => a.activity === activity)?.items || [], [library, activity]);

  async function save() {
    setErr("");
    if (!week.trim() || !section.trim() || !picked.length) {
      setErr("Pick a week, an activity and at least one check.");
      return;
    }
    setBusy(true);
    try {
      const out = await api<{ created: number }>(`/api/checklist/project/${projectId}/qap/lines`, {
        method: "POST",
        token,
        body: JSON.stringify({ weekLabel: week.trim(), section: section.trim(), lines: picked.map((i) => items[i]), ...roles }),
      });
      await onSaved(`${out.created} QAP line(s) added under ${section} (${week}).`);
      setPicked([]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add the lines");
    } finally {
      setBusy(false);
    }
  }

  const roleField = (key: keyof typeof roles, label: string, list: string, ph: string) => (
    <label className="register-form-field">
      <span>{label}</span>
      <Input value={roles[key]} list={list} onChange={(e) => setRoles({ ...roles, [key]: e.target.value })} placeholder={ph} />
    </label>
  );

  return (
    <RegisterEntryModal open={open} title="Add QAP lines from the library" onClose={onClose} onSave={() => void save()} saving={busy} size="3xl" saveLabel={`Add ${picked.length || ""} line(s)`}>
      <QapPickerLists />
      <div className="register-form-grid register-form-grid--wide">
        <label className="register-form-field">
          <span>Week</span>
          <Input value={week} onChange={(e) => setWeek(e.target.value)} list="qap-lib-weeks" placeholder="Week 50" />
          <datalist id="qap-lib-weeks">{weeks.map((w) => <option key={w} value={w} />)}</datalist>
        </label>
        <label className="register-form-field register-form-field--wide">
          <span>Activity (from the library)</span>
          <Select
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setSection(e.target.value);
              setPicked([]);
            }}
          >
            <option value="">Pick an activity…</option>
            {library.map((a) => (
              <option key={a.activity} value={a.activity}>
                {a.activity} ({a.items.length})
              </option>
            ))}
          </Select>
        </label>
        <label className="register-form-field register-form-field--wide">
          <span>Section name on the plan</span>
          <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Same as the activity, or your own heading" />
        </label>
      </div>

      {items.length ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">Checks — tick the ones this project needs</span>
            <span className="flex gap-3">
              <button type="button" className="text-brand font-semibold" onClick={() => setPicked(items.map((_, i) => i))}>Tick all</button>
              <button type="button" className="text-steel-muted" onClick={() => setPicked([])}>Clear</button>
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-line border border-line rounded-lg">
            {items.map((it, i) => (
              <label key={i} className="grid grid-cols-[auto_1fr] gap-x-3 px-3 py-2 text-sm cursor-pointer hover:bg-sand/40">
                <input type="checkbox" className="mt-1" checked={picked.includes(i)} onChange={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} />
                <span>
                  <span className="font-medium">{it.description}</span>
                  <span className="block text-[11px] text-steel-muted">
                    {[it.frequency && `Frequency: ${it.frequency}`, it.codeOfConformance && `Code: ${it.codeOfConformance}`, it.testAgency && `Agency: ${it.testAgency}`].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="register-form-section">
        <p className="register-form-section__title">Responsibility — applies to every ticked line (pick-lists)</p>
        <div className="register-form-grid">
          {roleField("contractorPerformer", "Contractor performer", "qap-pick-contractorPerformer", "Site Engr")}
          {roleField("contractorChecker", "Contractor checker", "qap-pick-contractorChecker", "QC Engr")}
          {roleField("pmcRole", "PMC checker", "qap-pick-pmcRole", "Witness / Review")}
          {roleField("clientRole", "Client checker", "qap-pick-clientRole", "Random / Witness")}
          {roleField("records", "Records to maintain", "qap-pick-records", "Work Check List")}
        </div>
      </div>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </RegisterEntryModal>
  );
}
