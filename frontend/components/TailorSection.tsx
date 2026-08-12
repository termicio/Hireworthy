"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { tailorCV, tailorCVGeneral } from "@/lib/api";
import PdfExportSection from "@/components/PdfExportSection";
import { Button } from "@/components/ui/button";

interface Props {
  cv: string;
  jobDescription: string;
  missingKeywords: string[];
  suggestions: string[];
  mode?: "general" | "targeted";
}

export default function TailorSection({ cv, jobDescription, missingKeywords, suggestions, mode = "targeted" }: Props) {
  const [tailoring, setTailoring] = useState(false);
  const [tailoredCv, setTailoredCv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const buttonLabel = mode === "general" ? "FIX & OPTIMISE CV →" : "Tailor CV →";
  const subtext =
    mode === "general"
      ? "Rewrites your CV for ATS compatibility and stronger bullet points."
      : "Rewrites your bullet points to match this role — without inventing experience.";

  async function handleTailor() {
    if (mode === "general") {
      if (!cv.trim()) {
        setError("CV is required.");
        return;
      }
    } else {
      if (!cv.trim() || !jobDescription.trim()) {
        setError("CV and job description are required.");
        return;
      }
    }
    setTailoring(true);
    setError(null);
    setTailoredCv(null);
    try {
      const result =
        mode === "general"
          ? await tailorCVGeneral(cv)
          : await tailorCV({
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
    <div className="flex flex-col gap-4" style={{ paddingTop: "2rem" }}>
      <div>
        <p
          className="uppercase tracking-widest font-medium mb-1"
          style={{ fontSize: "0.65rem", color: "#666666" }}
        >
          Auto-Tailor Your CV
        </p>
        <p style={{ fontSize: "0.8rem", color: "#999999" }}>
          {subtext}
        </p>
      </div>

      <Button
        type="button"
        variant="primary"
        onClick={handleTailor}
        disabled={tailoring}
        className="w-full h-auto py-4 text-sm"
      >
        {tailoring && <Loader2 size={15} className="animate-spin" />}
        {tailoring ? "Rewriting your CV…" : buttonLabel}
      </Button>

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

          <Button
            type="button"
            variant="secondary"
            onClick={handleCopy}
            className="self-start h-auto py-3 px-5 border-[#E8FF00] text-[#E8FF00] hover:bg-[#E8FF00] hover:text-[#080808]"
          >
            {copied ? "Copied!" : "Copy Tailored CV →"}
          </Button>

          <PdfExportSection cvText={tailoredCv} />
        </div>
      )}
    </div>
  );
}
