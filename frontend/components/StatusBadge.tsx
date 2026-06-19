"use client";

import type { ApplicationStatus } from "@/lib/api";

const STATUS_ORDER: ApplicationStatus[] = ["applied", "interview", "offer", "rejected"];

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  applied: "bg-blue-900/40 text-blue-400 border-blue-700/40",
  interview: "bg-yellow-900/40 text-yellow-400 border-yellow-700/40",
  offer: "bg-green-900/40 text-green-400 border-green-700/40",
  rejected: "bg-red-900/40 text-red-400 border-red-700/40",
};

interface StatusBadgeProps {
  status: ApplicationStatus;
  onClick?: (next: ApplicationStatus) => void;
}

export default function StatusBadge({ status, onClick }: StatusBadgeProps) {
  function handleClick() {
    if (!onClick) return;
    const idx = STATUS_ORDER.indexOf(status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    onClick(next);
  }

  return (
    <button
      onClick={onClick ? handleClick : undefined}
      className={`border text-xs px-2.5 py-1 rounded-full font-medium capitalize transition-opacity hover:opacity-80 ${STATUS_STYLES[status]} ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {status}
    </button>
  );
}
