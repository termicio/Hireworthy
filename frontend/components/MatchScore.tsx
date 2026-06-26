import { useEffect, useState } from "react";

interface MatchScoreProps {
  score: number;
}

export default function MatchScore({ score }: MatchScoreProps) {
  const [displayed, setDisplayed] = useState(0);
  const color = score >= 75 ? "#00FF88" : score >= 50 ? "#E8FF00" : "#FF3D00";
  const label = score >= 75 ? "Strong match" : score >= 50 ? "Partial match" : "Weak match";

  useEffect(() => {
    let start: number | null = null;
    const duration = 1000;
    const to = score;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(to * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Number */}
      <div className="flex items-end gap-4">
        <span
          className="font-display font-bold tabular leading-none"
          style={{ fontSize: "5rem", color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
        >
          {displayed}
        </span>
        <div className="flex flex-col pb-2 gap-0.5">
          <span
            className="font-mono uppercase tracking-widest font-semibold"
            style={{ fontSize: "0.65rem", color }}
          >
            {label}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#444444" }}>out of 100</span>
        </div>
      </div>

      {/* Bar */}
      <div className="w-full" style={{ height: "4px", background: "#222222" }}>
        <div
          style={{
            width: `${score}%`,
            height: "4px",
            background: color,
            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}
