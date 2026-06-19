"use client";

import { useEffect, useState, useCallback } from "react";
import { getApplications, type Application } from "@/lib/api";
import { Loader2, BriefcaseBusiness, TrendingUp, Users, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="text-indigo-400">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const PIE_COLORS: Record<string, string> = {
  applied: "#60a5fa",
  interview: "#facc15",
  offer: "#4ade80",
  rejected: "#f87171",
};

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApps(await getApplications());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 mt-8">
        <Loader2 size={18} className="animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error) return <p className="text-red-400 mt-8">{error}</p>;

  const total = apps.length;
  const avgScore =
    total === 0
      ? 0
      : Math.round(
          apps.filter((a) => a.match_score != null).reduce((s, a) => s + (a.match_score ?? 0), 0) /
            Math.max(1, apps.filter((a) => a.match_score != null).length)
        );
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const offers = apps.filter((a) => a.status === "offer").length;

  // Bar chart: applications per week
  const weekMap: Record<string, number> = {};
  apps.forEach((a) => {
    const w = getWeekLabel(a.created_at);
    weekMap[w] = (weekMap[w] ?? 0) + 1;
  });
  const barData = Object.entries(weekMap)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Pie chart: by status
  const statusMap: Record<string, number> = {};
  apps.forEach((a) => { statusMap[a.status] = (statusMap[a.status] ?? 0) + 1; });
  const pieData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={total} icon={<BriefcaseBusiness size={22} />} />
        <StatCard label="Avg Match Score" value={`${avgScore}%`} icon={<TrendingUp size={22} />} />
        <StatCard label="Interviews" value={interviews} icon={<Users size={22} />} />
        <StatCard label="Offers" value={offers} icon={<Award size={22} />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">Applications per Week</h2>
          {barData.length === 0 ? (
            <p className="text-slate-500 text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <XAxis dataKey="week" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#a5b4fc" }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 mb-4">Applications by Status</h2>
          {pieData.length === 0 ? (
            <p className="text-slate-500 text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? "#6366f1"} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 12 }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
