"use client";

import { useState } from "react";

interface DayData {
  date: string;
  count: number;
}

interface Props {
  data: DayData[];
}

const COLORS = { 0: "#1a1a1a", 1: "#4a5a00", 2: "#8aaa00" } as const;

function getColor(count: number): string {
  if (count >= 3) return "#E8FF00";
  return COLORS[count as 0 | 1 | 2] ?? "#1a1a1a";
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Mon=0 … Sun=6
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  return mon;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS: Record<number, string> = { 0: "Mon", 2: "Wed", 4: "Fri" };
const WEEKS = 26;
const DAYS = 7;

export default function HeatmapGrid({ data }: Props) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  // Build lookup map
  const countMap = new Map<string, number>();
  data.forEach(({ date, count }) => countMap.set(date, count));

  // Compute grid start: Monday of week 25 weeks ago
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMonday = getMonday(today);
  const startDate = new Date(todayMonday);
  startDate.setDate(todayMonday.getDate() - (WEEKS - 1) * 7);

  // Build 26*7 date strings
  const dates: string[] = [];
  for (let i = 0; i < WEEKS * DAYS; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(toDateString(d));
  }

  // Build month labels per column (week index)
  const monthLabels: Array<string | null> = [];
  for (let w = 0; w < WEEKS; w++) {
    const firstOfWeek = new Date(startDate);
    firstOfWeek.setDate(startDate.getDate() + w * 7);
    if (w === 0 || firstOfWeek.getDate() <= 7) {
      monthLabels.push(MONTH_ABBR[firstOfWeek.getMonth()]);
    } else {
      monthLabels.push(null);
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ display: "flex", gap: "4px" }}>
        {/* Day labels column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "18px" }}>
          {Array.from({ length: DAYS }, (_, row) => (
            <div
              key={row}
              style={{
                width: "24px",
                height: "12px",
                fontSize: "9px",
                color: "#666666",
                display: "flex",
                alignItems: "center",
              }}
            >
              {DAY_LABELS[row] ?? ""}
            </div>
          ))}
        </div>

        {/* Grid columns */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {/* Month labels row */}
          <div style={{ display: "flex", gap: "2px" }}>
            {monthLabels.map((label, w) => (
              <div
                key={w}
                style={{
                  width: "12px",
                  height: "14px",
                  fontSize: "9px",
                  color: "#666666",
                  overflow: "visible",
                  whiteSpace: "nowrap",
                }}
              >
                {label ?? ""}
              </div>
            ))}
          </div>

          {/* Cell grid: row-major render via columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${WEEKS}, 12px)`,
              gridTemplateRows: `repeat(${DAYS}, 12px)`,
              gap: "2px",
              gridAutoFlow: "column",
            }}
          >
            {dates.map((date) => {
              const count = countMap.get(date) ?? 0;
              return (
                <div
                  key={date}
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: 0,
                    background: getColor(count),
                    cursor: count > 0 ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => setTooltip({ date, count, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 8,
            top: tooltip.y - 36,
            pointerEvents: "none",
            background: "#111111",
            border: "1px solid #222222",
            color: "#F5F5F5",
            fontSize: "0.7rem",
            padding: "4px 8px",
            borderRadius: 0,
            zIndex: 50,
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.date} — {tooltip.count === 1 ? "1 application" : `${tooltip.count} applications`}
        </div>
      )}
    </div>
  );
}
