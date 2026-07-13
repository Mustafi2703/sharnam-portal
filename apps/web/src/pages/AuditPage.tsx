import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Navigate } from "react-router-dom";

export default function AuditPage() {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  if (user?.role !== "admin" && user?.role !== "office") return <Navigate to="/" replace />;

  useEffect(() => {
    api<any[]>("/api/audit", { token }).then(setEvents).catch(console.error);
  }, [token]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Audit trail</h1>
      <p className="text-steel-muted">Logins, checklist submits, drawing uploads, cost imports.</p>
      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-sand/50 text-left">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-black/5">
                <td className="p-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="p-3">{e.user?.fullName || "—"}</td>
                <td className="p-3 font-medium">{e.action}</td>
                <td className="p-3 text-steel-muted">
                  {e.entity} {e.entityId ? `· ${e.entityId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
