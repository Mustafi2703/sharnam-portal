import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Log = {
  id: string;
  logDate: string;
  weatherCondition?: string;
  status: string;
  manpower: { id: string; companyName: string; workerCount: number; hoursWorked: number; comments?: string }[];
  equipment: { id: string; companyName: string; equipmentType: string; hoursUsed?: number }[];
  notes: { id: string; noteText: string }[];
};

export default function DiaryPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [log, setLog] = useState<Log | null>(null);
  const [manpower, setManpower] = useState({ companyName: "", workerCount: 10, hoursWorked: 8, comments: "" });
  const [equipment, setEquipment] = useState({ companyName: "", equipmentType: "", hoursUsed: 8 });
  const [note, setNote] = useState("");
  const [weather, setWeather] = useState("Clear");

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
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <h1 className="font-display text-4xl mt-1">Daily Diary</h1>
        <p className="text-steel-muted">Site log — weather, manpower, equipment, notes.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end bg-white rounded-2xl border border-black/5 p-4">
        <label className="text-sm">
          Date
          <input type="date" className="block mt-1 rounded-xl border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          Weather
          <input className="block mt-1 rounded-xl border px-3 py-2" value={weather} onChange={(e) => setWeather(e.target.value)} />
        </label>
        <button onClick={openLog} className="rounded-xl bg-brand text-white px-4 py-2 text-sm">
          {log ? "Update / open" : "Create day log"}
        </button>
        {log && log.status === "Open" && (
          <button
            className="rounded-xl border border-brand text-brand px-4 py-2 text-sm"
            onClick={async () => {
              await api(`/api/diary/${log.id}/complete`, { method: "POST", token });
              await load();
            }}
          >
            Complete & distribute
          </button>
        )}
      </div>

      {log && (
        <div className="space-y-4">
          <div className="text-sm text-steel-muted">
            Status: <span className="font-medium text-ink">{log.status}</span> · Weather: {log.weatherCondition || "—"}
          </div>

          <section className="rounded-2xl bg-white border border-black/5 p-4 space-y-3">
            <h2 className="font-semibold">Manpower</h2>
            <ul className="text-sm space-y-1">
              {log.manpower.map((m) => (
                <li key={m.id}>
                  {m.companyName}: {m.workerCount} workers × {m.hoursWorked}h {m.comments ? `— ${m.comments}` : ""}
                </li>
              ))}
            </ul>
            <div className="grid sm:grid-cols-2 gap-2">
              <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Company" value={manpower.companyName} onChange={(e) => setManpower({ ...manpower, companyName: e.target.value })} />
              <input type="number" className="rounded-xl border px-3 py-2 text-sm" placeholder="Workers" value={manpower.workerCount} onChange={(e) => setManpower({ ...manpower, workerCount: Number(e.target.value) })} />
              <input className="rounded-xl border px-3 py-2 text-sm sm:col-span-2" placeholder="Comments" value={manpower.comments} onChange={(e) => setManpower({ ...manpower, comments: e.target.value })} />
              <button
                className="rounded-xl bg-steel text-white px-3 py-2 text-sm sm:col-span-2"
                onClick={async () => {
                  await api(`/api/diary/${log.id}/manpower`, { method: "POST", token, body: JSON.stringify(manpower) });
                  setManpower({ companyName: "", workerCount: 10, hoursWorked: 8, comments: "" });
                  await load();
                }}
              >
                Add manpower
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-black/5 p-4 space-y-3">
            <h2 className="font-semibold">Equipment</h2>
            <ul className="text-sm space-y-1">
              {log.equipment.map((m) => (
                <li key={m.id}>
                  {m.companyName}: {m.equipmentType} ({m.hoursUsed ?? "—"}h)
                </li>
              ))}
            </ul>
            <div className="grid sm:grid-cols-3 gap-2">
              <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Company" value={equipment.companyName} onChange={(e) => setEquipment({ ...equipment, companyName: e.target.value })} />
              <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Type e.g. Excavator" value={equipment.equipmentType} onChange={(e) => setEquipment({ ...equipment, equipmentType: e.target.value })} />
              <button
                className="rounded-xl bg-steel text-white px-3 py-2 text-sm"
                onClick={async () => {
                  await api(`/api/diary/${log.id}/equipment`, { method: "POST", token, body: JSON.stringify(equipment) });
                  setEquipment({ companyName: "", equipmentType: "", hoursUsed: 8 });
                  await load();
                }}
              >
                Add
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-black/5 p-4 space-y-3">
            <h2 className="font-semibold">Notes</h2>
            <ul className="text-sm space-y-1">
              {log.notes.map((n) => (
                <li key={n.id}>{n.noteText}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input className="flex-1 rounded-xl border px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation" />
              <button
                className="rounded-xl bg-steel text-white px-3 py-2 text-sm"
                onClick={async () => {
                  await api(`/api/diary/${log.id}/notes`, { method: "POST", token, body: JSON.stringify({ noteText: note }) });
                  setNote("");
                  await load();
                }}
              >
                Add
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
