import type { ApplicationStatus } from "@/lib/api";

export const KANBAN_COLUMNS: ApplicationStatus[] = ["applied", "interview", "offer", "rejected"];

export const COLUMN_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export const COLUMN_ACCENT: Record<ApplicationStatus, string> = {
  applied: "#444444",
  interview: "#E8FF00",
  offer: "#00FF88",
  rejected: "#FF3D00",
};

export function scoreColor(score: number | null): string {
  if (score == null) return "#444444";
  if (score >= 70) return "#00FF88";
  if (score >= 50) return "#E8FF00";
  return "#FF3D00";
}

/** Advance a status forward, cycling back to "applied" after "rejected". Used
 * as the tap/click fallback on mobile where drag is not the primary input. */
export function nextStatus(status: ApplicationStatus): ApplicationStatus {
  const idx = KANBAN_COLUMNS.indexOf(status);
  return KANBAN_COLUMNS[(idx + 1) % KANBAN_COLUMNS.length];
}
