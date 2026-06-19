interface MatchScoreProps {
  score: number;
}

export default function MatchScore({ score }: MatchScoreProps) {
  const color =
    score >= 70
      ? "text-green-400 stroke-green-400"
      : score >= 50
      ? "text-yellow-400 stroke-yellow-400"
      : "text-red-400 stroke-red-400";

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#334155" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          className={color}
        />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="bold" className={color} fill="currentColor">
          {score}
        </text>
      </svg>
      <span className="text-slate-400 text-sm">Match Score</span>
    </div>
  );
}
