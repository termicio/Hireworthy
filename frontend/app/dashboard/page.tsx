"use client";

import { useEffect, useState, useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { getApplications, type Application } from "@/lib/api";
import { buildWeeklyCounts } from "@/lib/dashboard";
import HeatmapGrid from "@/components/HeatmapGrid";
import EmptyState from "@/components/EmptyState";
import NarrativeHeader from "@/components/dashboard/NarrativeHeader";
import ConversionFunnel from "@/components/dashboard/ConversionFunnel";
import ActivityLedger from "@/components/dashboard/ActivityLedger";
import WeeklySparkline from "@/components/dashboard/WeeklySparkline";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // setState tylko w asynchronicznych callbackach — patrz useApplications.ts
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    getApplications()
      .then((data) => { if (!cancelled) setApps(data); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const heatmapData = useMemo(() => {
    const dateMap: Record<string, number> = {};
    apps.forEach((a) => {
      const date = new Date(a.created_at).toISOString().split("T")[0];
      dateMap[date] = (dateMap[date] ?? 0) + 1;
    });
    return Object.entries(dateMap).map(([date, count]) => ({ date, count }));
  }, [apps]);

  const weeklyCounts = useMemo(() => buildWeeklyCounts(apps), [apps]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" style={{ background: "#111111" }} />
        <Skeleton className="h-14 w-72" style={{ background: "#111111" }} />
        <Skeleton className="h-6 w-full max-w-2xl" style={{ background: "#111111" }} />
        <Skeleton className="h-64 w-full" style={{ background: "#111111" }} />
        <Skeleton className="h-64 w-full" style={{ background: "#111111" }} />
      </div>
    );
  }

  if (error) return <p style={{ color: "#FF3D00" }} className="text-sm mt-8">{error}</p>;

  if (apps.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="Nothing To Show Yet"
        description="Analyse a CV against a job description to start tracking your pipeline."
        ctaLabel="Start an Analysis →"
        ctaHref="/analyse"
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <NarrativeHeader applications={apps} />

      {/* Context bar — sparkline of weekly volume */}
      <WeeklySparkline data={weeklyCounts} />

      <ConversionFunnel applications={apps} />

      <ActivityLedger applications={apps} />

      <section style={{ marginTop: "0.5rem" }}>
        <h2 style={{ color: "#F5F5F5", fontSize: "0.75rem", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>ACTIVITY</h2>
        <p style={{ color: "#666666", fontSize: "0.75rem", marginBottom: "1rem" }}>Applications submitted per day — last 6 months</p>
        <HeatmapGrid data={heatmapData} />
      </section>
    </div>
  );
}
