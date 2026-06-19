"use client";

import type { ApplicationStatus } from "@/lib/api";

const STATUS_ORDER: ApplicationStatus[] = ["applied", "interview", "offer", "rejected"];

const STATUS_STYLES: Record<ApplicationStatus, React.CSSProperties> = {
  applied:   { background: "#1a1a1a", color: "#666666", border: "1px solid #444444" },
  interview: { background: "#E8FF00", color: "#080808", border: "1px solid #E8FF00" },
  offer:     { background: "#00FF88", color: "#080808", border: "1px solid #00FF88" },
  rejected:  { background: "#FF3D00", color: "#080808", border: "1px solid #FF3D00" },
};

interface StatusBadgeProps {
  status: ApplicationStatus;
  onClick?: (next: ApplicationStatus) => void;
}

export default function StatusBadge({ status, onClick }: StatusBadgeProps) {
  function handleClick() {
    if (!onClick) return;
    const idx = STATUS_ORDER.indexOf(status);
    onClick(STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]);
  }

  return (
    <button
      onClick={onClick ? handleClick : undefined}
      title={onClick ? "Click to advance" : undefined}
      style={{
        ...STATUS_STYLES[status],
        fontSize: "0.65rem",
        letterSpacing: "0.1em",
        padding: "3px 8px",
        cursor: onClick ? "pointer" : "default",
        textTransform: "uppercase",
        fontWeight: 600,
        fontFamily: "inherit",
      }}
    >
      {status}
    </button>
  );
}
