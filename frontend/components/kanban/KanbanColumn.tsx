"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Application, ApplicationStatus } from "@/lib/api";
import { COLUMN_ACCENT, COLUMN_LABELS } from "@/lib/kanban";
import KanbanCard from "@/components/kanban/KanbanCard";
import KanbanCardGhost from "@/components/kanban/KanbanCardGhost";

interface KanbanColumnProps {
  status: ApplicationStatus;
  applications: Application[];
  onTapStatus: (id: string, next: ApplicationStatus) => void;
  onDelete: (id: string) => void;
}

export default function KanbanColumn({ status, applications, onTapStatus, onDelete }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const accent = COLUMN_ACCENT[status];

  return (
    <div
      className="flex flex-col shrink-0 w-[80vw] sm:w-auto snap-start"
      style={{ minWidth: 0 }}
    >
      <div
        className="flex items-center justify-between px-1 pb-3 mb-3"
        style={{ borderBottom: `2px solid ${accent}` }}
      >
        <span className="font-display font-bold uppercase tracking-widest text-sm" style={{ color: "#F5F5F5" }}>
          {COLUMN_LABELS[status]}
        </span>
        <span className="font-mono tabular text-xs" style={{ color: accent }}>
          {applications.length}
        </span>
      </div>

      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="flex flex-col gap-3 min-h-[120px] p-1 transition-colors"
          style={{
            background: isOver ? "rgba(232,255,0,0.05)" : "transparent",
            outline: isOver ? `1px dashed ${accent}` : "1px dashed transparent",
            outlineOffset: "-1px",
          }}
        >
          {applications.length === 0 ? (
            <KanbanCardGhost status={status} />
          ) : (
            applications.map((app) => (
              <KanbanCard key={app.id} application={app} onTapStatus={onTapStatus} onDelete={onDelete} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
