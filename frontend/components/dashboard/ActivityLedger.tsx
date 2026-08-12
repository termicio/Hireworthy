import type { Application } from "@/lib/api";
import { buildLedger } from "@/lib/dashboard";

interface ActivityLedgerProps {
  applications: Application[];
}

/** Chronological event ledger built from created_at/updated_at — the
 * backend has no dedicated event-log yet, so each row is either "saved"
 * (no status change since creation) or "→ {status}" (latest known state). */
export default function ActivityLedger({ applications }: ActivityLedgerProps) {
  const events = buildLedger(applications);

  return (
    <div style={{ background: "#111111", border: "1px solid #222222" }}>
      <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "#222222" }}>
        <p className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: "#F5F5F5" }}>
          Activity Ledger
        </p>
      </div>
      <div className="flex flex-col max-h-[360px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: "#444444" }}>No activity yet.</p>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-4 px-6 py-3 border-b border-border last:border-b-0"
            >
              <span className="font-mono tabular shrink-0" style={{ fontSize: "0.7rem", color: "#444444" }}>
                {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
              <span className="font-display font-semibold text-sm truncate shrink-0" style={{ color: "#F5F5F5", maxWidth: "40%" }}>
                {e.company}
              </span>
              <span className="text-xs truncate" style={{ color: "#666666" }}>{e.label}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
