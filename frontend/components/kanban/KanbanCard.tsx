"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Application, ApplicationStatus } from "@/lib/api";
import { scoreColor, nextStatus, COLUMN_LABELS } from "@/lib/kanban";

interface KanbanCardProps {
  application: Application;
  onTapStatus: (id: string, next: ApplicationStatus) => void;
  onDelete: (id: string) => void;
}

/** Draggable card. Whole card is the drag handle; the status label doubles
 * as a tap-to-advance fallback for mobile (long-press activates drag via
 * TouchSensor, a plain tap on the badge cycles status instead). */
export default function KanbanCard({ application, onTapStatus, onDelete }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      animate={{ scale: isDragging ? 1.03 : 1 }}
      className="flex flex-col gap-3 p-4 cursor-grab active:cursor-grabbing touch-manipulation"
      data-dragging={isDragging || undefined}
    >
      <div
        className="flex flex-col gap-3 p-0"
        style={{
          background: "#111111",
          border: "1px solid #222222",
          boxShadow: isDragging ? "0 12px 24px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <div className="flex flex-col gap-1 p-4 pb-0">
          <Link
            href={`/applications/${application.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="font-display font-semibold text-sm truncate hover:text-[#E8FF00] transition-colors w-fit"
            style={{ color: "#F5F5F5" }}
          >
            {application.company}
          </Link>
          <span className="text-xs truncate" style={{ color: "#666666" }}>{application.role}</span>
        </div>

        <div className="flex items-center justify-between px-4 pb-4">
          <span className="font-mono tabular text-[0.7rem]" style={{ color: "#444444" }}>
            {new Date(application.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </span>
          <span className="font-mono font-bold tabular text-[0.8rem]" style={{ color: scoreColor(application.match_score) }}>
            {application.match_score != null ? `${application.match_score}%` : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between px-4 pb-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTapStatus(application.id, nextStatus(application.status)); }}
            title="Tap to advance status"
            className="uppercase tracking-widest font-semibold"
            style={{ fontSize: "0.6rem", color: "#666666" }}
          >
            {COLUMN_LABELS[application.status]} →
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(application.id); }}
            aria-label="Delete"
            className="text-[#333333] hover:text-[#FF3D00]"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
