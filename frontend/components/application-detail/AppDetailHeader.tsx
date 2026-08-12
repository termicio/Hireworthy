import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Application } from "@/lib/api";
import { COLUMN_ACCENT, COLUMN_LABELS, scoreColor } from "@/lib/kanban";
import AnimatedScore from "@/components/AnimatedScore";

interface AppDetailHeaderProps {
  application: Application;
}

/** Company, role, status badge, created date and the current score — the
 * score reuses AnimatedScore so a fresh re-analysis (Phase 5) animates the
 * delta here too, without any extra plumbing. */
export default function AppDetailHeader({ application }: AppDetailHeaderProps) {
  const accent = COLUMN_ACCENT[application.status];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-2 w-fit uppercase tracking-widest font-medium hover:text-[#E8FF00] transition-colors"
        style={{ fontSize: "0.7rem", color: "#666666" }}
      >
        <ArrowLeft size={13} /> Back to Applications
      </Link>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span
            className="uppercase tracking-widest font-bold w-fit"
            style={{ fontSize: "0.65rem", color: accent, border: `1px solid ${accent}`, padding: "3px 8px" }}
          >
            {COLUMN_LABELS[application.status]}
          </span>
          <h1 className="page-h1 font-display font-bold" style={{ color: "#F5F5F5" }}>
            {application.company}
          </h1>
          <p className="text-sm" style={{ color: "#666666" }}>{application.role}</p>
          <p className="font-mono tabular" style={{ fontSize: "0.7rem", color: "#444444" }}>
            Applied {new Date(application.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        {application.match_score != null && (
          <AnimatedScore score={application.match_score} color={scoreColor(application.match_score)} fontSize="3.5rem" />
        )}
      </div>
    </div>
  );
}
