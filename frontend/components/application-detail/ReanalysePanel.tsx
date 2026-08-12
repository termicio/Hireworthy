"use client";

import { useState } from "react";
import { reanalyseApplication, type Analysis } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ReanalysePanelProps {
  applicationId: string;
  initialCv: string;
  onAnalysed: (analysis: Analysis) => void;
}

const textareaStyle: React.CSSProperties = {
  background: "#111111",
  color: "#F5F5F5",
  padding: "12px",
  fontSize: "0.8rem",
  resize: "none",
  outline: "none",
  width: "100%",
  minHeight: "180px",
  fontFamily: "monospace",
  lineHeight: 1.6,
};

/** CV textarea (pre-filled from cv-context when available) + a button that
 * triggers a fresh analysis against the application's stored job
 * description. On success, the parent re-fetches/updates the analyses list
 * and the score animates its delta via AnimatedScore in AppDetailHeader. */
export default function ReanalysePanel({ applicationId, initialCv, onAnalysed }: ReanalysePanelProps) {
  const [cv, setCv] = useState(initialCv);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReanalyse() {
    if (cv.trim().length < 50) { setError("CV must be at least 50 characters."); return; }
    setLoading(true); setError(null);
    try {
      const analysis = await reanalyseApplication(applicationId, cv);
      onAnalysed(analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-analysis failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="uppercase tracking-widest font-medium" style={{ fontSize: "0.65rem", color: "#666666" }}>
        Re-analyse with Updated CV
      </p>
      <textarea
        value={cv}
        onChange={(e) => setCv(e.target.value)}
        placeholder="Paste your updated CV here…"
        className="border border-border focus:border-[#E8FF00]"
        style={textareaStyle}
      />
      {error && <p style={{ color: "#FF3D00", fontSize: "0.75rem" }}>{error}</p>}
      <Button
        type="button"
        variant="primary"
        onClick={handleReanalyse}
        disabled={loading || cv.trim().length === 0}
        className="w-full h-auto py-3 text-sm"
      >
        {loading ? "Analysing…" : "Re-analyse →"}
      </Button>
    </div>
  );
}
