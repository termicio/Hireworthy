"use client";

import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import type { Application, ApplicationStatus } from "@/lib/api";
import { KANBAN_COLUMNS } from "@/lib/kanban";
import KanbanColumn from "@/components/kanban/KanbanColumn";

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDelete: (id: string) => void;
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return (KANBAN_COLUMNS as string[]).includes(value);
}

/** 4-column board with cross-column drag&drop. Touch activation requires a
 * short hold (250ms / 8px tolerance) so a plain tap-scroll on mobile isn't
 * hijacked into a drag — the KanbanCard status label remains the tap
 * fallback for changing status without dragging at all. */
export default function KanbanBoard({ applications, onStatusChange, onDelete }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeApp = applications.find((a) => a.id === active.id);
    if (!activeApp) return;

    // `over.id` is either a column id (dropped on empty/ghost area) or
    // another card's id (dropped on top of a card) — resolve to its column.
    let targetStatus: ApplicationStatus | null = null;
    if (isApplicationStatus(String(over.id))) {
      targetStatus = over.id as ApplicationStatus;
    } else {
      const overApp = applications.find((a) => a.id === over.id);
      if (overApp) targetStatus = overApp.status;
    }

    if (targetStatus && targetStatus !== activeApp.status) {
      onStatusChange(activeApp.id, targetStatus);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 sm:grid sm:grid-cols-4 sm:overflow-visible">
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            applications={applications.filter((a) => a.status === status)}
            onTapStatus={onStatusChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DndContext>
  );
}
