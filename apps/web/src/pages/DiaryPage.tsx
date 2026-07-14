import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";

type Log = {
  id: string;
  logDate: string;
  weatherCondition?: string;
  status: string;
  createdBy?: { fullName?: string };
  manpower: { id: string; companyName: string; workerCount: number; hoursWorked: number; comments?: string }[];
  equipment: { id: string; companyName: string; equipmentType: string; hoursUsed?: number }[];
  notes: { id: string; noteText: string }[];
};

export default function DiaryPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [log, setLog] = useState<Log | null>(null);
  const [manpower, setManpower] = useState({
    companyName: user?.fullName || "",
    workerCount: 1,
    hoursWorked: 8,
    comments: "",
  });
  const [equipment, setEquipment] = useState({ companyName: "", equipmentType: "", hoursUsed: 8 });
  const [note, setNote] = useState("");
  const [weather, setWeather] = useState("Clear");
  const canEdit = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  const load = async () => {
    const existing = await api<Log | null>(`/api/diary/project/${id}/date/${date}`, { token });
    setLog(existing);
  };

  useEffect(() => {
    void load();
  }, [id, date, token]);

  const openLog = async () => {
    const created = await api<Log>(`/api/diary/project/${id}`, {
      method: "POST",
      token,
      body: JSON.stringify({ date, weatherCondition: weather }),
    });
    setLog(created);
    await load();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Field"
          title="Employee day log"
          subtitle="Per-day site log — weather, manpower (employees/vendors), equipment, and notes. One log maintained per calendar day."
        />
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            Date
            <Input type="date" className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-sm">
            Weather
            <Input className="mt-1" value={weather} onChange={(e) => setWeather(e.target.value)} />
          </label>
          {canEdit && (
            <Button type="button" onClick={openLog}>
              {log ? "Open / refresh day" : "Create day log"}
            </Button>
          )}
          {log && log.status === "Open" && canEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await api(`/api/diary/${log.id}/complete`, { method: "POST", token });
                await load();
              }}
            >
              Complete day
            </Button>
          )}
          {log && <Badge tone={log.status === "Open" ? "warn" : "ok"}>{log.status}</Badge>}
        </div>
      </Card>

      {log && (
        <div className="space-y-4">
          <p className="text-sm text-steel-muted">
            Day of {new Date(log.logDate).toLocaleDateString()} · Weather: {log.weatherCondition || "—"}
          </p>

          <Card className="space-y-3">
            <h2 className="font-semibold">Manpower / employees on site</h2>
            <ul className="text-sm space-y-1">
              {log.manpower.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 border-b border-line py-1">
                  <span>
                    <strong>{m.companyName}</strong>: {m.workerCount} × {m.hoursWorked}h
                    {m.comments ? ` — ${m.comments}` : ""}
                  </span>
                </li>
              ))}
              {!log.manpower.length && <li className="text-steel-muted">No entries yet</li>}
            </ul>
            {canEdit && log.status === "Open" && (
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Employee / company name"
                  value={manpower.companyName}
                  onChange={(e) => setManpower({ ...manpower, companyName: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Workers"
                  value={manpower.workerCount}
                  onChange={(e) => setManpower({ ...manpower, workerCount: Number(e.target.value) })}
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Work done / comments"
                  value={manpower.comments}
                  onChange={(e) => setManpower({ ...manpower, comments: e.target.value })}
                />
                <Button
                  type="button"
                  variant="dark"
                  className="sm:col-span-2"
                  onClick={async () => {
                    await api(`/api/diary/${log.id}/manpower`, { method: "POST", token, body: JSON.stringify(manpower) });
                    setManpower({ companyName: user?.fullName || "", workerCount: 1, hoursWorked: 8, comments: "" });
                    await load();
                  }}
                >
                  Add employee / manpower entry
                </Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Equipment</h2>
            <ul className="text-sm space-y-1">
              {log.equipment.map((m) => (
                <li key={m.id}>
                  {m.companyName}: {m.equipmentType} ({m.hoursUsed ?? "—"}h)
                </li>
              ))}
            </ul>
            {canEdit && log.status === "Open" && (
              <div className="grid sm:grid-cols-3 gap-2">
                <Input placeholder="Company" value={equipment.companyName} onChange={(e) => setEquipment({ ...equipment, companyName: e.target.value })} />
                <Input placeholder="Type e.g. Excavator" value={equipment.equipmentType} onChange={(e) => setEquipment({ ...equipment, equipmentType: e.target.value })} />
                <Button
                  type="button"
                  variant="dark"
                  onClick={async () => {
                    await api(`/api/diary/${log.id}/equipment`, { method: "POST", token, body: JSON.stringify(equipment) });
                    setEquipment({ companyName: "", equipmentType: "", hoursUsed: 8 });
                    await load();
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Notes</h2>
            <ul className="text-sm space-y-1">
              {log.notes.map((n) => (
                <li key={n.id}>{n.noteText}</li>
              ))}
            </ul>
            {canEdit && log.status === "Open" && (
              <div className="flex gap-2">
                <Input className="flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation" />
                <Button
                  type="button"
                  variant="dark"
                  onClick={async () => {
                    await api(`/api/diary/${log.id}/notes`, { method: "POST", token, body: JSON.stringify({ noteText: note }) });
                    setNote("");
                    await load();
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
