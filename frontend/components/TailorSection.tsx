"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { tailorCV } from "@/lib/api";
import PdfExportSection from "@/components/PdfExportSection";

interface Props {
  cv: string;
  jobDescription: string;
  missingKeywords: string[];
  suggestions: string[];
}

export default function TailorSection({ cv, jobDescription, missingKeywords, suggestions }: Props) {
  const [tailoring, setTailoring] = useState(false);
  const [tailoredCv, setTailoredCv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleTailor() {
    if (!cv.trim() || !jobDescription.trim()) {
      setError("CV and job description are required.");
      return;
    }
    setTailoring(true);
    setError(null);
    setTailoredCv(null);
    try {
      const result = await tailorCV({
        cv,
        job_description: jobDescription,
        missing_keywords: missingKeywords,
        suggestions,
      });
      setTailoredCv(result.tailored_cv);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tailoring failed.");
    } finally {
      setTailoring(false);
    }
  }

  async function handleCopy() {
    if (!tailoredCv) return;
    try {
      await navigator.clipboard.writeText(tailoredCv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — silently ignore
    }
  }

  const scrollableText: React.CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    color: "#F5F5F5",
    padding: "12px",
    fontSize: "0.75rem",
    fontFamily: "monospace",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowY: "auto",
    maxHeight: "360px",
  };

  return (
    <div className="flex flex-col gap-4" style={{ borderTop: "1px solid #222222", paddingTop: "2rem" }}>
      <div>
        <p
          className="uppercase tracking-widest font-medium mb-1"
          style={{ fontSize: "0.65rem", color: "#666666" }}
        >
          Auto-Tailor Your CV
        </p>
        <p style={{ fontSize: "0.8rem", color: "#999999" }}>
          Rewrites your bullet points to match this role — without inventing experience.
        </p>
      </div>

      <button
        onClick={handleTailor}
        disabled={tailoring}
        className="flex items-center justify-center gap-2 w-full py-4 uppercase tracking-widest font-display font-bold text-sm"
        style={{
          background: tailoring ? "#b3c700" : "#E8FF00",
          color: "#080808",
          cursor: tailoring ? "not-allowed" : "pointer",
          letterSpacing: "0.1em",
          border: "none",
        }}
      >
        {tailoring && <Loader2 size={15} className="animate-spin" />}
        {tailoring ? "Rewriting your CV…" : "Tailor CV →"}
      </button>

      {error && <p style={{ color: "#FF3D00", fontSize: "0.8rem" }}>{error}</p>}

      {tailoredCv && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <p
                className="uppercase tracking-widest font-medium"
                style={{ fontSize: "0.65rem", color: "#666666" }}
              >
                Original
              </p>
              <div style={scrollableText}>{cv}</div>
            </div>
            <div className="flex flex-col gap-2">
              <p
                className="uppercase tracking-widest font-medium"
                style={{ fontSize: "0.65rem", color: "#E8FF00" }}
              >
                Tailored
              </p>
              <div style={scrollableText}>{tailoredCv}</div>
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="self-start uppercase tracking-widest font-display font-bold text-xs px-5 py-3 transition-colors"
            style={{ border: "1px solid #E8FF00", color: "#E8FF00", background: "transparent", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#E8FF00"; e.currentTarget.style.color = "#080808"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#E8FF00"; }}
          >
            {copied ? "Copied!" : "Copy Tailored CV →"}
          </button>

          <PdfExportSection cvText={tailoredCv} />
        </div>
      )}
    </div>
  );
}
