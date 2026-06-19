"use client";

import { useEffect, useState, useCallback } from "react";
import { getApplications, updateApplication, deleteApplication, type Application, type ApplicationStatus } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Trash2, Loader2 } from "lucide-react";

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplications();
      setApps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  async function handleStatusChange(id: string, next: ApplicationStatus) {
    try {
      const updated = await updateApplication(id, { status: next });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      // keep current state on failure
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApplication(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // keep current state on failure
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 mt-8">
        <Loader2 size={18} className="animate-spin" /> Loading applications…
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 mt-8">{error}</p>;
  }

  if (apps.length === 0) {
    return <p className="text-slate-400 mt-8">No applications yet. Analyse a CV to get started.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-100">Applications</h1>
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#334155] text-slate-400">
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Match</th>
              <th className="text-left px-4 py-3 font-medium">Applied</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} className="border-b border-[#334155] last:border-0 hover:bg-[#0f172a]/40 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-200">{app.company}</td>
                <td className="px-4 py-3 text-slate-300">{app.role}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={app.status}
                    onClick={(next) => handleStatusChange(app.id, next)}
                  />
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {app.match_score != null ? (
                    <span className={app.match_score >= 70 ? "text-green-400" : app.match_score >= 50 ? "text-yellow-400" : "text-red-400"}>
                      {app.match_score}%
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(app.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(app.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
