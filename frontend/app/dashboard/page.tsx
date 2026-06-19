"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getApplications, type Application } from "@/lib/api";
import HeatmapGrid from "@/components/HeatmapGrid";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return mon.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const PIE_COLORS: Record<string, string> = {
  applied:   "#444444",
  interview: "#E8FF00",
  offer:     "#00FF88",
  rejected:  "#FF3D00",
};

const tooltipStyle = {
  contentStyle: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 0,
    fontSize: 12,
    color: "#F5F5F5",
  },
  labelStyle: { color: "#666666" },
  itemStyle:  { color: "#E8FF00" },
  cursor: { fill: "#1a1a1a" },
};

interface StatCardProps {
  label: string;
  value: string | number;
}
function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-2 p-6"
      style={{ background: "#111111", borderLeft: "2px solid #222222" }}
    >
      <span
        className="font-display font-bold tabular leading-none"
        style={{ fontSize: "4.5rem", color: "#E8FF00", lineHeight: 1 }}
      >
        {value}
      </span>
      <span
        className="uppercase tracking-widest font-medium"
        style={{ fontSize: "0.65rem", color: "#666666" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    try { setApps(await getApplications()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const heatmapData = useMemo(() => {
    const dateMap: Record<string, number> = {};
    apps.forEach((a) => {
      const date = new Date(a.created_at).toISOString().split("T")[0];
      dateMap[date] = (dateMap[date] ?? 0) + 1;
    });
    return Object.entries(dateMap).map(([date, count]) => ({ date, count }));
  }, [apps]);

  if (loading) return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 w-72" style={{ background: "#111111" }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "#222222" }}>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" style={{ background: "#111111" }} />)}
      </div>
    </div>
  );

  if (error) return <p style={{ color: "#FF3D00" }} className="text-sm mt-8">{error}</p>;

  const total = apps.length;
  const scored = apps.filter((a) => a.match_score != null);
  const avgScore = scored.length === 0
    ? 0
    : Math.round(scored.reduce((s, a) => s + (a.match_score ?? 0), 0) / scored.length);
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const offers = apps.filter((a) => a.status === "offer").length;

  const weekMap: Record<string, number> = {};
  apps.forEach((a) => { const w = weekStart(a.created_at); weekMap[w] = (weekMap[w] ?? 0) + 1; });
  const barData = Object.entries(weekMap).map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week));

  const statusMap: Record<string, number> = {};
  apps.forEach((a) => { statusMap[a.status] = (statusMap[a.status] ?? 0) + 1; });
  const pieData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex flex-col gap-10">
      {/* Heading */}
      <div>
        <p className="uppercase tracking-widest font-medium mb-2" style={{ fontSize: "0.65rem", color: "#666666" }}>
          Overview
        </p>
        <h1
          className="font-display font-bold uppercase leading-none"
          style={{ fontSize: "3rem", color: "#F5F5F5" }}
        >
          Your Pipeline
        </h1>
      </div>

      {/* Stats — gap-px creates 1px dividers from the parent background */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "#222222" }}>
        <StatCard label="Applications" value={total} />
        <StatCard label="Avg Match" value={`${avgScore}%`} />
        <StatCard label="Interviews" value={interviews} />
        <StatCard label="Offers" value={offers} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "#222222" }}>
            <p className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: "#F5F5F5" }}>
              Applications / Week
            </p>
          </div>
          <div className="p-4">
            {barData.length === 0
              ? <p className="text-sm py-12 text-center" style={{ color: "#444444" }}>No data yet.</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barSize={24} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#444444", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#444444", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="#E8FF00" radius={0} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>

        {/* Pie chart */}
        <div style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "#222222" }}>
            <p className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: "#F5F5F5" }}>
              By Status
            </p>
          </div>
          <div className="p-4">
            {pieData.length === 0
              ? <p className="text-sm py-12 text-center" style={{ color: "#444444" }}>No data yet.</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? "#444444"} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>
          {/* Legend */}
          {pieData.length > 0 && (
            <div className="px-6 pb-5 flex flex-wrap gap-4">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 shrink-0" style={{ background: PIE_COLORS[entry.name] ?? "#444" }} />
                  <span className="capitalize" style={{ fontSize: "0.7rem", color: "#666666" }}>
                    {entry.name} · {entry.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stage breakdown */}
      {total > 0 && (
        <div style={{ border: "1px solid #222222" }}>
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "#222222" }}>
            <p className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: "#F5F5F5" }}>
              Stage Breakdown
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "#222222" }}>
            {(["applied", "interview", "offer", "rejected"] as const).map((s) => {
              const count = statusMap[s] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = PIE_COLORS[s];
              return (
                <div key={s} className="flex flex-col gap-3 p-5" style={{ background: "#111111" }}>
                  <div className="flex items-center justify-between">
                    <span className="capitalize uppercase tracking-widest" style={{ fontSize: "0.65rem", color: "#666666" }}>{s}</span>
                    <span className="font-display font-bold tabular" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-[3px]" style={{ background: "#222222" }}>
                    <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="font-mono tabular" style={{ fontSize: "0.7rem", color: "#444444" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ color: "#F5F5F5", fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>ACTIVITY</h2>
        <p style={{ color: "#666666", fontSize: "0.75rem", marginBottom: "1rem" }}>Applications submitted per day — last 6 months</p>
        <HeatmapGrid data={heatmapData} />
      </section>
    </div>
  );
}
