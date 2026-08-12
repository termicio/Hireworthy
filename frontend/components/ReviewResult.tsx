"use client";

import { AlertTriangle, Zap } from "lucide-react";
import type { ReviewResult } from "@/lib/api";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import AnimatedScore from "@/components/AnimatedScore";

interface Props {
  result: ReviewResult;
}

function scoreColor(score: number): string {
  if (score < 50) return "#FF3D00";
  if (score < 75) return "#E8FF00";
  return "#00FF88";
}

const headingStyle: import("react").CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  color: "#666666",
  textTransform: "uppercase",
  fontWeight: 500,
  marginBottom: "0.75rem",
};

export default function ReviewResult({ result }: Props) {
  const color = scoreColor(result.overall_score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* A — Overall Score */}
      <div>
        <p style={headingStyle}>Overall Score</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <AnimatedScore score={result.overall_score} color={color} fontSize="4rem" />
          <span style={{ fontSize: "1.5rem", color: "#666666", paddingBottom: "0.5rem" }}>/100</span>
        </div>
        <div style={{ width: "100%", background: "#222222", height: "8px" }}>
          <div style={{ width: `${result.overall_score}%`, background: color, height: "100%", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* B — CV Health Categories */}
      <div>
        <p style={headingStyle}>CV Health Categories</p>
        <CategoryBreakdown categories={result.categories} />
      </div>

      {/* C — Bullet Point Analysis */}
      <div>
        <p style={headingStyle}>Bullet Point Analysis</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {result.weak_bullets.map((bullet, i) => (
            <div key={i}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div>
                  <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#666666", fontFamily: "monospace", marginBottom: "0.25rem" }}>ORIGINAL</p>
                  <p style={{ fontSize: "0.8rem", color: "#F5F5F5", lineHeight: 1.5 }}>{bullet.original}</p>
                </div>
                <div>
                  <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#666666", fontFamily: "monospace", marginBottom: "0.25rem" }}>WHY IT&apos;S WEAK</p>
                  <p style={{ fontSize: "0.8rem", color: "#F5F5F5", lineHeight: 1.5 }}>{bullet.reason}</p>
                </div>
                <div>
                  <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#666666", fontFamily: "monospace", marginBottom: "0.25rem" }}>REWRITTEN</p>
                  <p style={{ fontSize: "0.8rem", color: "#E8FF00", lineHeight: 1.5 }}>{bullet.rewritten}</p>
                </div>
              </div>
              {i < result.weak_bullets.length - 1 && (
                <div style={{ borderTop: "1px solid #222222", marginTop: "1.25rem" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* D — Red Flags */}
      {result.red_flags.length > 0 && (
        <div>
          <p style={headingStyle}>Red Flags</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {result.red_flags.map((flag, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <AlertTriangle size={14} style={{ color: "#FF3D00", flexShrink: 0, marginTop: "2px" }} />
                <p style={{ fontSize: "0.8rem", color: "#FF3D00", lineHeight: 1.5 }}>{flag}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E — Quick Wins */}
      <div>
        <p style={headingStyle}>Quick Wins</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {result.quick_wins.map((win, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.65rem", color: "#666666", fontWeight: 700, flexShrink: 0, marginTop: "2px", minWidth: "1rem" }}>{i + 1}</span>
              <Zap size={14} style={{ color: "#E8FF00", flexShrink: 0, marginTop: "2px" }} />
              <p style={{ fontSize: "0.8rem", color: "#E8FF00", lineHeight: 1.5 }}>{win}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
