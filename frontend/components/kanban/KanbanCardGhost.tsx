import Link from "next/link";
import type { ApplicationStatus } from "@/lib/api";

interface KanbanCardGhostProps {
  status: ApplicationStatus;
}

/** Empty-column placeholder. Only the "applied" column gets a CTA back to
 * /analyse — the other columns are simply reached by moving a card there. */
export default function KanbanCardGhost({ status }: KanbanCardGhostProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center px-4 py-8"
      style={{ border: "1px dashed #222222" }}
    >
      <p style={{ fontSize: "0.7rem", color: "#333333" }}>No applications here</p>
      {status === "applied" && (
        <Link href="/analyse" style={{ fontSize: "0.7rem", color: "#E8FF00" }}>
          Analyse a job →
        </Link>
      )}
    </div>
  );
}
