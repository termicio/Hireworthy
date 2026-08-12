"use client";

import { BriefcaseBusiness } from "lucide-react";
import { useApplications } from "@/lib/hooks/useApplications";
import { KANBAN_COLUMNS } from "@/lib/kanban";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationsPage() {
  const { applications, loading, error, actionError, updateStatus, removeApplication } = useApplications();

  return (
    <div className="flex flex-col gap-10">
      {/* Heading */}
      <div>
        <p className="uppercase tracking-widest font-medium mb-2" style={{ fontSize: "0.65rem", color: "#666666" }}>
          Tracking
        </p>
        <h1 className="page-h1 font-display font-bold uppercase" style={{ color: "#F5F5F5" }}>
          Applications
        </h1>
      </div>

      {error && <p style={{ color: "#FF3D00" }} className="text-sm -mt-6">{error}</p>}
      {actionError && <p style={{ color: "#FF3D00" }} className="text-sm -mt-6">{actionError}</p>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {KANBAN_COLUMNS.map((s) => (
            <div key={s} className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" style={{ background: "#111111" }} />
              <Skeleton className="h-32 w-full" style={{ background: "#111111" }} />
              <Skeleton className="h-32 w-full" style={{ background: "#111111" }} />
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No Applications Yet"
          description="Go to Analyse to review a job posting and save your first application."
          ctaLabel="Go to Analyse →"
          ctaHref="/analyse"
        />
      ) : (
        <KanbanBoard applications={applications} onStatusChange={updateStatus} onDelete={removeApplication} />
      )}
    </div>
  );
}
