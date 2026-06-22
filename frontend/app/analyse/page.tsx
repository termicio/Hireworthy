"use client";

import { useState } from "react";
import { analyseCV, type AnalyseResult } from "@/lib/api";
import MatchScore from "@/components/MatchScore";
import SaveApplicationModal from "@/components/SaveApplicationModal";
import CvInput from "@/components/CvInput";
import TailorSection from "@/components/TailorSection";
import { Loader2, CheckCircle2 } from "lucide-react";

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
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleAnalyse() {
    if (!cv.trim() || !jd.trim()) { setError("Fill in both fields first."); return; }
    setLoading(true); setError(null); setResult(null); setSaved(false);
    try { setResult(await analyseCV(cv, jd)); }
    catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setLoading(false); }
  }

  return (
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

      {/* Two-column inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label
            className="uppercase tracking-widest font-bold"
            style={{ fontSize: "0.65rem", color: "#F5F5F5" }}
          >
            Your CV
          </label>
          <CvInput value={cv} onChange={setCv} minHeight={240} />
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="uppercase tracking-widest font-bold"
            style={{ fontSize: "0.65rem", color: "#F5F5F5" }}
          >
            Job Description
          </label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
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
        disabled={loading || !(cv.trim().length > 0 && jd.trim().length > 0)}
        className="flex items-center justify-center gap-2 w-full py-4 uppercase tracking-widest font-display font-bold text-sm transition-opacity"
        style={{
          background: loading ? "#b3c700" : (!(cv.trim().length > 0 && jd.trim().length > 0) ? "#1a1a1a" : "#E8FF00"),
          color: !(cv.trim().length > 0 && jd.trim().length > 0) && !loading ? "#444444" : "#080808",
          cursor: loading || !(cv.trim().length > 0 && jd.trim().length > 0) ? "not-allowed" : "pointer",
          letterSpacing: "0.1em",
        }}
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {loading ? "Analysing…" : "Analyse →"}
      </button>

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-8">
          {/* Score */}
          <div style={{ borderLeft: "2px solid #E8FF00", paddingLeft: "24px" }}>
            <MatchScore score={result.match_score} />
          </div>

          {/* Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="uppercase tracking-widest font-medium mb-3" style={{ fontSize: "0.65rem", color: "#666666" }}>
                Matched Keywords
              </p>
              <div className="flex flex-wrap gap-2">
                {result.matched_keywords.map((kw) => (
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
                {result.missing_keywords.map((kw) => (
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
              {result.suggestions.map((s, i) => (
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
            <p className="text-sm leading-relaxed" style={{ color: "#999999" }}>{result.summary}</p>
          </div>

          {/* Tailor */}
          <TailorSection
            cv={cv}
            jobDescription={jd}
            missingKeywords={result.missing_keywords}
            suggestions={result.suggestions}
          />

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
      )}

      <SaveApplicationModal
        matchScore={result?.match_score ?? 0}
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); setSaved(true); }}
      />
    </div>
  );
}
