import type { HealthCategory, MatchCategory } from "@/lib/api";

interface Props {
  categories: (HealthCategory | MatchCategory)[];
}

function barColor(score: number): string {
  if (score < 50) return "#FF3D00";
  if (score < 75) return "#E8FF00";
  return "#00FF88";
}

export default function CategoryBreakdown({ categories }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {categories.map((cat) => {
        const color = barColor(cat.score);
        return (
          <div
            key={cat.name}
            style={{ background: "#111111", border: "1px solid #222222", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {/* Label + score */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#666666", textTransform: "uppercase", fontWeight: 500 }}>
                {cat.label}
              </p>
              <span style={{ fontSize: "1rem", fontWeight: 700, color, fontFamily: "monospace" }}>{Math.round(cat.score)}</span>
            </div>
            {/* Progress bar */}
            <div style={{ width: "100%", background: "#222222", height: "4px" }}>
              <div style={{ width: `${cat.score}%`, background: color, height: "100%", transition: "width 0.4s ease" }} />
            </div>
            {/* Evidence */}
            <p style={{ fontSize: "0.75rem", color: "#F5F5F5", lineHeight: 1.5 }}>{cat.evidence}</p>
            {/* Tips (HealthCategory) */}
            {"tips" in cat && cat.tips.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {cat.tips.map((tip, i) => (
                  <li key={i} style={{ fontSize: "0.75rem", color: "#999999", lineHeight: 1.5 }}>{tip}</li>
                ))}
              </ul>
            )}
            {/* Missing keywords (MatchCategory) */}
            {"missing_keywords" in cat && cat.missing_keywords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {cat.missing_keywords.map((kw) => (
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
        );
      })}
    </div>
  );
}
