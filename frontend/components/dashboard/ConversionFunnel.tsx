"use client";

import { motion } from "framer-motion";
import type { Application } from "@/lib/api";
import { buildFunnel, rejectedCount } from "@/lib/dashboard";

interface ConversionFunnelProps {
  applications: Application[];
}

const STAGE_COLOR: Record<string, string> = { applied: "#444444", interview: "#E8FF00", offer: "#00FF88" };

/** Dominant, full-width Applied -> Interview -> Offer funnel. Rejected is
 * shown separately below as a thin bar, since it isn't a forward step. */
export default function ConversionFunnel({ applications }: ConversionFunnelProps) {
  const stages = buildFunnel(applications);
  const rejected = rejectedCount(applications);
  const total = applications.length || 1;
  const maxCount = stages[0]?.count || 1;

  return (
    <div style={{ background: "#111111", border: "1px solid #222222" }}>
      <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: "#222222" }}>
        <p className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: "#F5F5F5" }}>
          Conversion Funnel
        </p>
      </div>

      <div className="flex flex-col gap-4 p-6">
        {stages.map((stage) => (
          <div key={stage.status} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="uppercase tracking-widest font-medium" style={{ fontSize: "0.65rem", color: "#666666" }}>
                {stage.label}
              </span>
              <div className="flex items-baseline gap-3">
                {stage.conversionFromPrevious !== null && (
                  <span className="font-mono tabular" style={{ fontSize: "0.7rem", color: "#444444" }}>
                    {stage.conversionFromPrevious}% conversion
                  </span>
                )}
                <span className="font-display font-bold tabular" style={{ fontSize: "1.25rem", color: STAGE_COLOR[stage.status] }}>
                  {stage.count}
                </span>
              </div>
            </div>
            <div className="h-6 w-full" style={{ background: "#1a1a1a" }}>
              <motion.div
                className="h-full"
                style={{ background: STAGE_COLOR[stage.status] }}
                initial={{ width: 0 }}
                animate={{ width: `${(stage.count / maxCount) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}

        {/* Rejected — separate, not part of the forward funnel */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
          <div className="flex items-baseline justify-between">
            <span className="uppercase tracking-widest font-medium" style={{ fontSize: "0.65rem", color: "#666666" }}>
              Rejected
            </span>
            <span className="font-mono tabular" style={{ fontSize: "0.85rem", color: "#FF3D00" }}>
              {rejected} · {Math.round((rejected / total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full" style={{ background: "#1a1a1a" }}>
            <motion.div
              className="h-full"
              style={{ background: "#FF3D00" }}
              initial={{ width: 0 }}
              animate={{ width: `${(rejected / total) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
