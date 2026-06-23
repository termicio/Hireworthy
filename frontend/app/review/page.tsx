"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import CvInput from "@/components/CvInput";
import ReviewResultComponent from "@/components/ReviewResult";
import TailorSection from "@/components/TailorSection";
import { reviewCV } from "@/lib/api";
import { useCVContext } from "@/lib/cv-context";

export default function ReviewPage() {
  const { cvText, setCvText, reviewResult, setReviewResult, clearAll } = useCVContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCvText, setPendingCvText] = useState<string | null>(null);

  async function handleAnalyse() {
    setLoading(true);
    setError(null);
    try {
      setReviewResult(await reviewCV(cvText));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleCvChange(newText: string) {
    if (reviewResult !== null) {
      setPendingCvText(newText);
    } else {
      setCvText(newText);
    }
  }

  return (
    <div style={{ padding: "2rem 1rem" }}>

      {/* ── BEFORE RESULTS: centered single-column ── */}
      {reviewResult === null && (
        <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "#666666", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              CV Audit
            </p>
            <h1
              className="font-display font-bold uppercase"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)", color: "#F5F5F5", lineHeight: 1.1 }}
            >
              Review My CV
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#666666", marginTop: "0.5rem" }}>
              Get an honest AI assessment of your CV
            </p>
          </div>

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

          <CvInput value={cvText} onChange={handleCvChange} />

          {error && <p style={{ fontSize: "0.85rem", color: "#FF3D00" }}>{error}</p>}

          <button
            onClick={handleAnalyse}
            disabled={cvText.trim().length < 50 || loading}
            style={{
              background: cvText.trim().length < 50 || loading ? "#1a1a1a" : "#E8FF00",
              color: cvText.trim().length < 50 || loading ? "#444444" : "#080808",
              border: "none", padding: "1rem", width: "100%",
              cursor: cvText.trim().length < 50 || loading ? "not-allowed" : "pointer",
              fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.15em",
              textTransform: "uppercase", fontFamily: "inherit",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <Loader2 size={15} className="animate-spin" /> Analysing…
              </span>
            ) : "Analyse CV →"}
          </button>
        </div>
      )}

      {/* ── AFTER RESULTS: two-column layout ── */}
      {reviewResult !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Banner */}
          <div style={{ background: "#111111", border: "1px solid #222222", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "0.75rem", color: "#666666" }}>Showing previous results. Clear to run a new analysis.</p>
            <button onClick={clearAll} style={{ fontSize: "0.7rem", color: "#E8FF00", background: "none", border: "none", cursor: "pointer", fontWeight: 700, letterSpacing: "0.1em", fontFamily: "inherit" }}>CLEAR →</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ alignItems: "start" }}>
            {/* LEFT */}
            <div className="lg:col-span-3">
              <ReviewResultComponent result={reviewResult} />
            </div>
            {/* RIGHT — sticky */}
            <div className="lg:col-span-2" style={{ position: "sticky", top: "24px", alignSelf: "start", display: "flex", flexDirection: "column", gap: "16px" }}>
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
              <TailorSection cv={cvText} mode="general" jobDescription="" missingKeywords={[]} suggestions={[]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
