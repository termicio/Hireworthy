"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getApplications, updateApplication, deleteApplication,
  type Application, type ApplicationStatus,
} from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";

function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "#444444", fontFamily: "monospace" }}>—</span>;
  const color = score >= 70 ? "#00FF88" : score >= 50 ? "#E8FF00" : "#FF3D00";
  return (
    <span className="font-mono font-bold tabular" style={{ color, fontSize: "0.85rem" }}>
      {score}%
    </span>
  );
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true); setError(null);
    try { setApps(await getApplications()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  async function handleStatusChange(id: string, next: ApplicationStatus) {
    try {
      const updated = await updateApplication(id, { status: next });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch { /* keep state */ }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApplication(id);
      setApps((prev) => prev.filter((a) => a.id !== id));
    } catch { /* keep state */ }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Heading */}
      <div>
        <p className="uppercase tracking-widest font-medium mb-2" style={{ fontSize: "0.65rem", color: "#666666" }}>
          Tracking
        </p>
        <h1 className="font-display font-bold uppercase leading-none" style={{ fontSize: "3rem", color: "#F5F5F5" }}>
          Applications
        </h1>
      </div>

      {error && <p style={{ color: "#FF3D00" }} className="text-sm -mt-6">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-px" style={{ background: "#222222" }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14" style={{ background: "#111111" }} />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <p
            className="font-display font-bold uppercase tracking-widest"
            style={{ fontSize: "1.5rem", color: "#222222" }}
          >
            No Applications Yet
          </p>
          <p style={{ color: "#444444", fontSize: "0.85rem" }}>
            Go to Analyse to review a job posting and save your first application.
          </p>
          <a
            href="/analyse"
            className="uppercase tracking-widest font-display font-bold px-6 py-3 text-sm"
            style={{ background: "#E8FF00", color: "#080808" }}
          >
            Go to Analyse →
          </a>
        </div>
      ) : (
        <div style={{ border: "1px solid #222222" }}>
          {/* Table header */}
          <div
            className="grid text-left"
            style={{
              gridTemplateColumns: "1.5fr 2fr 120px 80px 110px 48px",
              borderBottom: "1px solid #222222",
              padding: "0 16px",
            }}
          >
            {["Company", "Role", "Status", "Match", "Date", ""].map((h) => (
              <div
                key={h}
                className="py-3 uppercase tracking-widest font-medium"
                style={{ fontSize: "0.65rem", color: "#444444" }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {apps.map((app) => (
            <div
              key={app.id}
              className="accent-row grid items-center"
              style={{
                gridTemplateColumns: "1.5fr 2fr 120px 80px 110px 48px",
                borderBottom: "1px solid #1a1a1a",
                padding: "0 16px",
                minHeight: "56px",
                background: "#111111",
              }}
            >
              <span className="font-display font-semibold text-sm" style={{ color: "#F5F5F5" }}>
                {app.company}
              </span>
              <span className="text-sm" style={{ color: "#666666" }}>{app.role}</span>
              <span>
                <StatusBadge status={app.status} onClick={(n) => handleStatusChange(app.id, n)} />
              </span>
              <span><ScoreChip score={app.match_score} /></span>
              <span className="font-mono tabular text-xs" style={{ color: "#444444" }}>
                {new Date(app.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short", year: "2-digit",
                })}
              </span>
              <span>
                <button
                  onClick={() => handleDelete(app.id)}
                  aria-label="Delete"
                  className="flex items-center justify-center w-8 h-8 transition-colors"
                  style={{ color: "#333333" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FF3D00")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#333333")}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
