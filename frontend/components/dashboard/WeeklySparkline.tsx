import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { WeekPoint } from "@/lib/dashboard";

interface WeeklySparklineProps {
  data: WeekPoint[];
}

/** Small, axis-free sparkline replacing the old full-size weekly bar chart —
 * demoted to a context strip since the funnel is now the dominant visual. */
export default function WeeklySparkline({ data }: WeeklySparklineProps) {
  if (data.length === 0) {
    return <span style={{ fontSize: "0.7rem", color: "#444444" }}>No weekly data yet.</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="uppercase tracking-widest font-medium shrink-0" style={{ fontSize: "0.65rem", color: "#666666" }}>
        Applications / Week
      </span>
      <div style={{ width: "160px", height: "32px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="week" hide />
            <Tooltip
              contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 0, fontSize: 11, color: "#F5F5F5" }}
              formatter={(value) => [value, "applications"]}
            />
            <Line type="monotone" dataKey="count" stroke="#E8FF00" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
