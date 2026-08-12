"use client";

import { useEffect, useRef, useState } from "react";
import CvInput from "@/components/CvInput";
import SkeletonReview from "@/components/SkeletonReview";
import TopProgressBar from "@/components/TopProgressBar";
import ReviewResultComponent from "@/components/ReviewResult";
import TailorSection from "@/components/TailorSection";
import { reviewCV } from "@/lib/api";
import { useCVContext } from "@/lib/cv-context";
import { Button } from "@/components/ui/button";

export default function ReviewPage() {
  const {
    cvText, setCvText, reviewResult, setReviewResult, clearAll,
    resultIsStale, markResultStale, markResultFresh,
  } = useCVContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCvText, setPendingCvText] = useState<string | null>(null);

  // On mount, a result already present in context was inherited from a
  // previous visit — flag it as stale so the banner shows. A fresh
  // submit later in this view will clear the flag again.
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    if (reviewResult !== null) markResultStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnalyse() {
    setLoading(true);
    setError(null);
    try {
      setReviewResult(await reviewCV(cvText));
      markResultFresh();
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

  const isDisabled = cvText.trim().length < 50;

  return (
    <div style={{ padding: "2rem 1rem" }}>
      <TopProgressBar loading={loading} />

      {/* Skeleton — visible while loading */}
      {loading && <SkeletonReview />}

      {/* ── BEFORE RESULTS: centered single-column ── */}
      {reviewResult === null && !loading && (
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

          <CvInput value={cvText} onChange={handleCvChange} />

          {error && <p style={{ fontSize: "0.85rem", color: "#FF3D00" }}>{error}</p>}

          <Button
            type="button"
            variant="primary"
            onClick={handleAnalyse}
            disabled={isDisabled || loading}
            className="w-full h-auto py-4 text-[0.75rem]"
          >
            {"Analyse CV →"}
          </Button>
        </div>
      )}

      {/* ── AFTER RESULTS: two-column layout ── */}
      {reviewResult !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Banner — only when the result was inherited from a previous visit */}
          {resultIsStale && (
            <div style={{ background: "#111111", border: "1px solid #222222", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: "0.75rem", color: "#666666" }}>Showing previous results. Clear to run a new analysis.</p>
              <Button type="button" variant="ghost" onClick={clearAll} className="h-auto p-0 text-[0.7rem] text-[#E8FF00] hover:bg-transparent">CLEAR →</Button>
            </div>
          )}

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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearAll}
                  className="mt-3 h-auto p-0 text-[0.65rem] text-[#666666] hover:bg-transparent hover:text-[#666666]"
                >
                  EDIT CV ↓
                </Button>
              </div>
              <TailorSection cv={cvText} mode="general" jobDescription="" missingKeywords={[]} suggestions={[]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
