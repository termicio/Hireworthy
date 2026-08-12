import type { Application } from "@/lib/api";

export interface FunnelStage {
  status: "applied" | "interview" | "offer";
  label: string;
  count: number;
  /** Conversion rate from the previous stage (null for the first stage). */
  conversionFromPrevious: number | null;
}

export interface LedgerEvent {
  id: string;
  date: string;
  company: string;
  role: string;
  label: string;
}

export interface WeekPoint {
  weekStartDate: string;
  week: string;
  count: number;
}

/** Applied -> Interview -> Offer funnel. Every application that has moved
 * past "applied" (interview/offer/rejected) counts as having reached the
 * Applied stage; Interview/Offer count applications currently at or beyond
 * that stage. Rejected is intentionally excluded — it isn't a forward step. */
export function buildFunnel(applications: Application[]): FunnelStage[] {
  const total = applications.length;
  const reachedInterview = applications.filter((a) => a.status === "interview" || a.status === "offer").length;
  const reachedOffer = applications.filter((a) => a.status === "offer").length;

  const stages: Array<{ status: FunnelStage["status"]; label: string; count: number }> = [
    { status: "applied", label: "Applied", count: total },
    { status: "interview", label: "Interview", count: reachedInterview },
    { status: "offer", label: "Offer", count: reachedOffer },
  ];

  return stages.map((stage, i) => ({
    ...stage,
    conversionFromPrevious: i === 0 ? null : stages[i - 1].count === 0
      ? 0
      : Math.round((stage.count / stages[i - 1].count) * 100),
  }));
}

export function rejectedCount(applications: Application[]): number {
  return applications.filter((a) => a.status === "rejected").length;
}

/** Chronological ledger built from available timestamps only (created_at,
 * updated_at). No dedicated event-log exists on the backend yet — if
 * updated_at differs from created_at we show the current status as the
 * latest event, otherwise just "saved". */
export function buildLedger(applications: Application[]): LedgerEvent[] {
  return [...applications]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((a) => ({
      id: a.id,
      date: a.updated_at,
      company: a.company,
      role: a.role,
      label: a.updated_at === a.created_at ? "saved" : `→ ${a.status}`,
    }));
}

function weekStartISO(dateStr: string): string {
  const d = new Date(dateStr);
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return mon.toISOString().split("T")[0];
}

function formatWeekLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Weekly application counts, sorted chronologically by the real week-start
 * date (not the formatted label) — carried over from the Phase 1 bugfix. */
export function buildWeeklyCounts(applications: Application[]): WeekPoint[] {
  const weekMap: Record<string, number> = {};
  applications.forEach((a) => {
    const w = weekStartISO(a.created_at);
    weekMap[w] = (weekMap[w] ?? 0) + 1;
  });
  return Object.entries(weekMap)
    .map(([weekStartDate, count]) => ({ weekStartDate, week: formatWeekLabel(weekStartDate), count }))
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
}

export function averageScore(applications: Application[]): number {
  const scored = applications.filter((a) => a.match_score != null);
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((s, a) => s + (a.match_score ?? 0), 0) / scored.length);
}

/** Applications created within the last 7 days. */
export function applicationsThisWeek(applications: Application[]): number {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return applications.filter((a) => now - new Date(a.created_at).getTime() <= weekMs).length;
}

/** Company waiting longest at "applied" with no movement — used by the
 * narrative header's follow-up nudge. Null if nothing is waiting. */
export function longestWaiting(applications: Application[]): { company: string; days: number } | null {
  const waiting = applications.filter((a) => a.status === "applied");
  if (waiting.length === 0) return null;
  const oldest = waiting.reduce((a, b) => (new Date(a.created_at) < new Date(b.created_at) ? a : b));
  const days = Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / (24 * 60 * 60 * 1000));
  return { company: oldest.company, days };
}
