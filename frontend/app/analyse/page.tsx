"use client";

import { useState } from "react";
import { analyseCV } from "@/lib/api";
import MatchScore from "@/components/MatchScore";
import SaveApplicationModal from "@/components/SaveApplicationModal";
import CvInput from "@/components/CvInput";
import TailorSection from "@/components/TailorSection";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useCVContext } from "@/lib/cv-context";

const inputStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #222222",
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
  const { cvText, setCvText, jobDescription, setJobDescription, analyseResult, setAnalyseResult, clearAll } = useCVContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingCvText, setPendingCvText] = useState<string | null>(null);

  async function handleAnalyse() {
    if (!cvText.trim() || !jobDescription.trim()) { setError("Fill in both fields first."); return; }
    setLoading(true); setError(null); setAnalyseResult(null); setSaved(false);
    try { setAnalyseResult(await analyseCV(cvText, jobDescription)); }
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

  return (
    <div>
      {/* ── BEFORE RESULTS: centered single-column ── */}
      <div className="flex flex-col gap-10 max-w-4xl mx-auto">
      {/* Heading */}
      <div>
        <p className="uppercase tracking-widest font-medium mb-2" style={{ fontSize: "0.65rem", color: "#666666" }}>
          AI Analysis
        </p>
        <h1 className="font-display font-bold uppercase leading-none" style={{ fontSize: "3rem", color: "#F5F5F5" }}>
          Analyse Match
        </h1>
      </div>

      {/* Banner when results exist */}
      {analyseResult !== null && (
        <div style={{ background: "#111111", border: "1px solid #222222", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "0.75rem", color: "#666666" }}>Showing previous results. Clear to run a new analysis.</p>
          <button onClick={clearAll} style={{ fontSize: "0.7rem", color: "#E8FF00", background: "none", border: "none", cursor: "pointer", fontWeight: 700, letterSpacing: "0.1em", fontFamily: "inherit" }}>CLEAR →</button>
        </div>
      )}

      {/* Confirm dialog when pending */}
      {pendingCvText !== null && (
        <div style={{ background: "#111111", border: "1px solid #E8FF00", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "0.8rem", color: "#F5F5F5" }}>You have existing results. Replace CV and run new analysis?</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { clearAll(); setCvText(pendingCvText); setPendingCvText(null); }}
              style={{ background: "#E8FF00", color: "#080808", border: "none", padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" }}
            >YES</button>
            <button
              onClick={() => setPendingCvText(null)}
              style={{ background: "transparent", color: "#666666", border: "1px solid #333333", padding: "8px 16px", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" }}
            >NO</button>
          </div>
        </div>
      )}

      {/* Form — visible when no results */}
      {analyseResult === null && (
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
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#E8FF00")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#222222")}
              />
            </div>
          </div>

          {error && <p style={{ color: "#FF3D00", fontSize: "0.8rem" }} className="-mt-6">{error}</p>}

          {/* CTA */}
          <button
            onClick={handleAnalyse}
            disabled={loading || !(cvText.trim().length > 0 && jobDescription.trim().length > 0)}
            className="flex items-center justify-center gap-2 w-full py-4 uppercase tracking-widest font-display font-bold text-sm transition-opacity"
            style={{
              background: loading ? "#b3c700" : (!(cvText.trim().length > 0 && jobDescription.trim().length > 0) ? "#1a1a1a" : "#E8FF00"),
              color: !(cvText.trim().length > 0 && jobDescription.trim().length > 0) && !loading ? "#444444" : "#080808",
              cursor: loading || !(cvText.trim().length > 0 && jobDescription.trim().length > 0) ? "not-allowed" : "pointer",
              letterSpacing: "0.1em",
            }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Analysing…" : "Analyse →"}
          </button>
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
              <MatchScore score={analyseResult.match_score} />
            </div>

            {/* Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="uppercase tracking-widest font-medium mb-3" style={{ fontSize: "0.65rem", color: "#666666" }}>
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
                <p className="uppercase tracking-widest font-medium mb-3" style={{ fontSize: "0.65rem", color: "#666666" }}>
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
              <p className="uppercase tracking-widest font-medium mb-4" style={{ fontSize: "0.65rem", color: "#666666" }}>
                Suggestions
              </p>
              <div className="flex flex-col gap-0" style={{ borderTop: "1px solid #222222" }}>
                {analyseResult.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex gap-5 py-5"
                    style={{ borderBottom: "1px solid #222222", borderLeft: "2px solid #222222", paddingLeft: "20px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = "#E8FF00")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = "#222222")}
                  >
                    <span
                      className="font-mono font-bold tabular shrink-0 mt-0.5"
                      style={{ fontSize: "0.7rem", color: "#E8FF00" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: "#F5F5F5" }}>{s}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div>
              <p className="uppercase tracking-widest font-medium mb-3" style={{ fontSize: "0.65rem", color: "#666666" }}>
                Summary
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#999999" }}>{analyseResult.summary}</p>
            </div>

            {/* Save */}
            {saved ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#00FF88" }}>
                <CheckCircle2 size={15} />
                Application saved
              </div>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                className="self-start uppercase tracking-widest font-display font-bold text-xs px-5 py-3 transition-colors"
                style={{ border: "1px solid #E8FF00", color: "#E8FF00", background: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#E8FF00"; e.currentTarget.style.color = "#080808"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#E8FF00"; }}
              >
                Save Application →
              </button>
            )}
          </div>

          {/* RIGHT — sticky */}
          <div className="lg:col-span-2" style={{ position: "sticky", top: "24px", alignSelf: "start", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* CV Preview */}
            <div style={{ background: "#111111", border: "1px solid #222222", padding: "16px" }}>
              <p style={{ fontSize: "0.6rem", color: "#666666", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>Your CV</p>
              <p style={{ fontSize: "0.75rem", color: "#444444", lineHeight: 1.5, fontFamily: "monospace", whiteSpace: "pre-wrap", overflow: "hidden" }}>
                {cvText.split("\n").slice(0, 3).join("\n")}
              </p>
              <button
                onClick={clearAll}
                style={{ marginTop: "12px", fontSize: "0.65rem", color: "#666666", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.1em", fontFamily: "inherit", textTransform: "uppercase" }}
              >
                EDIT CV ↓
              </button>
            </div>
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
        matchScore={analyseResult?.match_score ?? 0}
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); setSaved(true); }}
      />
    </div>
  );
}
