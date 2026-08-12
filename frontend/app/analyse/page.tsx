"use client";

import { useEffect, useRef, useState } from "react";
import { analyseCV } from "@/lib/api";
import MatchScore from "@/components/MatchScore";
import SaveApplicationModal from "@/components/SaveApplicationModal";
import CvInput from "@/components/CvInput";
import TailorSection from "@/components/TailorSection";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import SkeletonAnalyse from "@/components/SkeletonAnalyse";
import TopProgressBar from "@/components/TopProgressBar";
import { useCVContext } from "@/lib/cv-context";
import { Button } from "@/components/ui/button";

const inputStyle: React.CSSProperties = {
  background: "#111111",
  color: "#F5F5F5",
  padding: "12px",
  fontSize: "0.8rem",
  resize: "none",
  outline: "none",
  width: "100%",
  minHeight: "240px",
  fontFamily: "monospace",
  lineHeight: 1.6,
};

export default function AnalysePage() {
  const {
    cvText, setCvText, jobDescription, setJobDescription,
    analyseResult, setAnalyseResult, clearAll,
    resultIsStale, markResultStale, markResultFresh,
  } = useCVContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingCvText, setPendingCvText] = useState<string | null>(null);

  // On mount, a result already present in context was inherited from a
  // previous visit — flag it as stale so the banner shows. A fresh
  // submit later in this view will clear the flag again.
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    if (analyseResult !== null) markResultStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnalyse() {
    if (!cvText.trim() || !jobDescription.trim()) { setError("Fill in both fields first."); return; }
    setLoading(true); setError(null); setAnalyseResult(null); setSaved(false);
    try {
      setAnalyseResult(await analyseCV(cvText, jobDescription));
      markResultFresh();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); console.error(e); }
    finally { setLoading(false); }
  }

  function handleCvChange(newText: string) {
    if (analyseResult !== null) {
      setPendingCvText(newText);
    } else {
      setCvText(newText);
    }
  }

  const isDisabled = !(cvText.trim().length > 0 && jobDescription.trim().length > 0);
  const sectionHeadingStyle: React.CSSProperties = { fontSize: "0.65rem", color: "#666666" };

  return (
    <div>
      <TopProgressBar loading={loading} />
      {/* ── BEFORE RESULTS: centered single-column ── */}
      <div className="flex flex-col gap-10 max-w-4xl mx-auto">
      {/* Heading */}
      <div>
        <p className="uppercase tracking-widest font-medium mb-2" style={sectionHeadingStyle}>
          AI Analysis
        </p>
        <h1 className="page-h1 font-display font-bold uppercase" style={{ color: "#F5F5F5" }}>
          Analyse Match
        </h1>
      </div>

      {/* Banner — only when the result was inherited from a previous visit */}
      {analyseResult !== null && resultIsStale && (
        <div style={{ background: "#111111", border: "1px solid #222222", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "0.75rem", color: "#666666" }}>Showing previous results. Clear to run a new analysis.</p>
          <Button type="button" variant="ghost" onClick={clearAll} className="h-auto p-0 text-[0.7rem] text-[#E8FF00] hover:bg-transparent">CLEAR →</Button>
        </div>
      )}

      {/* Confirm dialog when pending */}
      {pendingCvText !== null && (
        <div style={{ background: "#111111", border: "1px solid #E8FF00", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "0.8rem", color: "#F5F5F5" }}>You have existing results. Replace CV and run new analysis?</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              type="button"
              variant="primary"
              onClick={() => { clearAll(); setCvText(pendingCvText); setPendingCvText(null); }}
              className="h-auto py-2 px-4 text-xs"
            >YES</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingCvText(null)}
              className="h-auto py-2 px-4 text-xs text-[#666666]"
            >NO</Button>
          </div>
        </div>
      )}

      {/* Skeleton — visible while loading */}
      {loading && <SkeletonAnalyse />}

      {/* Form — visible when no results and not loading */}
      {analyseResult === null && !loading && (
        <>
          {/* Two-column inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label
                className="uppercase tracking-widest font-bold"
                style={{ fontSize: "0.65rem", color: "#F5F5F5" }}
              >
                Your CV
              </label>
              <CvInput value={cvText} onChange={handleCvChange} minHeight={240} />
            </div>
            <div className="flex flex-col gap-2">
              {/* Spacer matching CvInput toggle button row height so labels align with textareas */}
              <div style={{ height: "26px" }} />
              <label
                className="uppercase tracking-widest font-bold"
                style={{ fontSize: "0.65rem", color: "#F5F5F5" }}
              >
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here…"
                className="border border-border focus:border-[#E8FF00]"
                style={inputStyle}
              />
            </div>
          </div>

          {error && <p style={{ color: "#FF3D00", fontSize: "0.8rem" }} className="-mt-6">{error}</p>}

          {/* CTA */}
          <Button
            type="button"
            variant="primary"
            onClick={handleAnalyse}
            disabled={isDisabled || loading}
            className="w-full h-auto py-4 text-sm"
          >
            {"Analyse →"}
          </Button>
        </>
      )}

      </div>{/* end centered form wrapper */}

      {/* ── AFTER RESULTS: two-column layout ── */}
      {analyseResult !== null && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ alignItems: "start" }}>
          {/* LEFT — results */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            {/* Score */}
            <div style={{ borderLeft: "2px solid #E8FF00", paddingLeft: "24px" }}>
              <MatchScore score={analyseResult.overall_score} />
              <CategoryBreakdown categories={analyseResult.categories} />
            </div>

            {/* Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>
                  Matched Keywords
                </p>
                <div className="flex flex-wrap gap-2">
                  {analyseResult.matched_keywords.map((kw) => (
                    <span
                      key={kw}
                      className="uppercase tracking-widest font-medium"
                      style={{
                        fontSize: "0.65rem",
                        background: "#1a1a00",
                        color: "#E8FF00",
                        padding: "4px 8px",
                        border: "1px solid #333300",
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>
                  Missing Keywords
                </p>
                <div className="flex flex-wrap gap-2">
                  {analyseResult.missing_keywords.map((kw) => (
                    <span
                      key={kw}
                      className="uppercase tracking-widest font-medium"
                      style={{
                        fontSize: "0.65rem",
                        background: "#1a0000",
                        color: "#FF3D00",
                        padding: "4px 8px",
                        border: "1px solid #330000",
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <p className="uppercase tracking-widest font-medium mb-4" style={sectionHeadingStyle}>
                Suggestions
              </p>
              <div className="flex flex-col gap-0">
                {analyseResult.suggestions.map((s, i) => (
                  <motion.div
                    key={i}
                    className="flex gap-5 py-5 border-b border-border border-l-2 border-l-border hover:border-l-[#E8FF00]"
                    style={{ paddingLeft: "20px" }}
                    whileHover={{ x: 6 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <span
                      className="font-mono font-bold tabular shrink-0 mt-0.5"
                      style={{ fontSize: "0.7rem", color: "#E8FF00" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: "#F5F5F5" }}>{s}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div>
              <p className="uppercase tracking-widest font-medium mb-3" style={sectionHeadingStyle}>
                Summary
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#999999" }}>{analyseResult.explanation}</p>
            </div>

            {/* Save */}
            {saved ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#00FF88" }}>
                <CheckCircle2 size={15} />
                Application saved
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowModal(true)}
                className="self-start h-auto py-3 px-5 border-[#E8FF00] text-[#E8FF00] hover:bg-[#E8FF00] hover:text-[#080808]"
              >
                Save Application →
              </Button>
            )}
          </div>

          {/* RIGHT — sticky */}
          <div className="lg:col-span-2" style={{ position: "sticky", top: "24px", alignSelf: "start", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* TailorSection */}
            <TailorSection
              cv={cvText}
              jobDescription={jobDescription}
              missingKeywords={analyseResult.missing_keywords}
              suggestions={analyseResult.suggestions}
            />
          </div>
        </div>
      )}

      <SaveApplicationModal
        matchScore={analyseResult?.overall_score ?? 0}
        jobDescription={jobDescription}
        missingKeywords={analyseResult?.missing_keywords}
        categories={analyseResult?.categories}
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); setSaved(true); }}
      />
    </div>
  );
}
