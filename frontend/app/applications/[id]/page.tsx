"use client";

import { use, useEffect, useState } from "react";
import { FileWarning } from "lucide-react";
import { getApplication, getAnalyses, type Application, type Analysis } from "@/lib/api";
import { useCVContext } from "@/lib/cv-context";
import AppDetailHeader from "@/components/application-detail/AppDetailHeader";
import ScoreProgressChart from "@/components/application-detail/ScoreProgressChart";
import AnalysisList from "@/components/application-detail/AnalysisList";
import ReanalysePanel from "@/components/application-detail/ReanalysePanel";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  // Next 16: dynamic route params are a Promise, even in Client Components —
  // read with React's `use()` (see docs/agent-runs raport, "Next 16 —
  // ustalenia").
  params: Promise<{ id: string }>;
}

export default function ApplicationDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { cvText } = useCVContext();

  const [application, setApplication] = useState<Application | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // setState tylko w asynchronicznych callbackach efektu — patrz
  // lib/hooks/useApplications.ts (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    Promise.all([getApplication(id), getAnalyses(id)])
      .then(([app, hist]) => {
        if (cancelled) return;
        setApplication(app);
        setAnalyses(hist);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load application.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  function handleAnalysed(analysis: Analysis) {
    setAnalyses((prev) => [...prev, analysis]);
    setApplication((prev) => (prev ? { ...prev, match_score: analysis.overall_score } : prev));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" style={{ background: "#111111" }} />
        <Skeleton className="h-16 w-96" style={{ background: "#111111" }} />
        <Skeleton className="h-64 w-full" style={{ background: "#111111" }} />
      </div>
    );
  }

  if (error || !application) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Application Not Found"
        description={error ?? "This application could not be loaded."}
        ctaLabel="Back to Applications →"
        ctaHref="/applications"
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <AppDetailHeader application={application} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ alignItems: "start" }}>
        <div className="lg:col-span-3 flex flex-col gap-8">
          <ScoreProgressChart analyses={analyses} />
          <AnalysisList analyses={analyses} />
        </div>

        <div className="lg:col-span-2" style={{ position: "sticky", top: "24px", alignSelf: "start" }}>
          <ReanalysePanel
            applicationId={application.id}
            initialCv={cvText}
            onAnalysed={handleAnalysed}
          />
        </div>
      </div>
    </div>
  );
}
