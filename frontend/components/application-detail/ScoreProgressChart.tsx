"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Analysis } from "@/lib/api";

interface ScoreProgressChartProps {
  analyses: Analysis[];
}

/** Progression of overall_score across all analyses for this application,
 * chronologically (backend already returns them sorted ascending by
 * created_at). Needs at least two points to be a meaningful line. */
export default function ScoreProgressChart({ analyses }: ScoreProgressChartProps) {
  const sectionHeadingStyle: React.CSSProperties = { fontSize: "0.65rem", color: "#666666" };

  if (analyses.length < 2) {
    return (
      <div>
        <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>Score Progression</p>
        <p style={{ color: "#444444", fontSize: "0.8rem" }}>
          Not enough data yet — run a re-analysis to start tracking progress over time.
        </p>
      </div>
    );
  }

  const data = analyses.map((a) => ({
    date: new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    score: a.overall_score,
  }));

  return (
    <div>
      <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>Score Progression</p>
      <div style={{ width: "100%", height: "220px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#222222" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#666666" }} axisLine={{ stroke: "#222222" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#666666" }} axisLine={{ stroke: "#222222" }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 0, fontSize: 11, color: "#F5F5F5" }}
              formatter={(value) => [`${value}`, "score"]}
            />
            <Line type="monotone" dataKey="score" stroke="#E8FF00" strokeWidth={2} dot={{ r: 3, fill: "#E8FF00" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
