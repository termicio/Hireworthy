import AnimatedScore from "@/components/AnimatedScore";

interface MatchScoreProps {
  score: number;
}

export default function MatchScore({ score }: MatchScoreProps) {
  const color = score >= 75 ? "#00FF88" : score >= 50 ? "#E8FF00" : "#FF3D00";
  const label = score >= 75 ? "Strong match" : score >= 50 ? "Partial match" : "Weak match";

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Number */}
      <div className="flex items-end gap-4">
        <AnimatedScore score={score} color={color} fontSize="5rem" />
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
