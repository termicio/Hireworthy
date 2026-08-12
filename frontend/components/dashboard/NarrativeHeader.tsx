import type { Application } from "@/lib/api";
import { applicationsThisWeek, averageScore, longestWaiting } from "@/lib/dashboard";
import NumberMarker from "@/components/dashboard/NumberMarker";

interface NarrativeHeaderProps {
  applications: Application[];
}

/** Editorial nagłówek: składa lead-akapit z realnych danych zamiast
 * pokazywać cztery statyczne stat-cardy. */
export default function NarrativeHeader({ applications }: NarrativeHeaderProps) {
  const thisWeek = applicationsThisWeek(applications);
  const avg = averageScore(applications);
  const waiting = longestWaiting(applications);

  return (
    <div className="flex flex-col gap-4">
      <p className="uppercase tracking-widest font-medium" style={{ fontSize: "0.65rem", color: "#666666" }}>
        Overview
      </p>
      <h1 className="page-h1 font-display font-bold uppercase" style={{ color: "#F5F5F5" }}>
        Your Pipeline
      </h1>
      <p className="text-lg leading-relaxed max-w-2xl" style={{ color: "#999999" }}>
        <NumberMarker>{thisWeek}</NumberMarker> application{thisWeek === 1 ? "" : "s"} this week.
        Average match <NumberMarker>{avg}%</NumberMarker>.{" "}
        {waiting
          ? <>
              <NumberMarker>{waiting.company}</NumberMarker> is waiting {waiting.days} day{waiting.days === 1 ? "" : "s"} for a follow-up.
            </>
          : "Nothing is waiting on a follow-up right now."}
      </p>
    </div>
  );
}
