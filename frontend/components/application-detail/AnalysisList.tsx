import type { Analysis } from "@/lib/api";
import { scoreColor } from "@/lib/kanban";

interface AnalysisListProps {
  analyses: Analysis[];
}

/** Chronological list of every analysis run for this application — most
 * recent first, each with its date, score chip and missing keyword tags. */
export default function AnalysisList({ analyses }: AnalysisListProps) {
  const sectionHeadingStyle: React.CSSProperties = { fontSize: "0.65rem", color: "#666666" };

  if (analyses.length === 0) {
    return (
      <div>
        <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>Analysis History</p>
        <p style={{ color: "#444444", fontSize: "0.8rem" }}>No analyses recorded yet.</p>
      </div>
    );
  }

  const ordered = [...analyses].reverse();

  return (
    <div>
      <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>Analysis History</p>
      <div className="flex flex-col gap-0">
        {ordered.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="font-mono tabular" style={{ fontSize: "0.7rem", color: "#666666" }}>
                {new Date(a.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="font-mono font-bold tabular" style={{ fontSize: "0.85rem", color: scoreColor(a.overall_score) }}>
                {a.overall_score}%
              </span>
            </div>
            {a.missing_keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {a.missing_keywords.map((kw) => (
                  <span
                    key={kw}
                    className="uppercase tracking-widest font-medium"
                    style={{ fontSize: "0.6rem", background: "#1a0000", color: "#FF3D00", padding: "3px 7px", border: "1px solid #330000" }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
