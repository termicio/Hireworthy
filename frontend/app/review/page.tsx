"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import CvInput from "@/components/CvInput";
import ReviewResultComponent from "@/components/ReviewResult";
import PdfExportSection from "@/components/PdfExportSection";
import { reviewCV, type ReviewResult } from "@/lib/api";

export default function ReviewPage() {
  const [cv, setCv] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  async function handleAnalyse() {
    setLoading(true);
    setError(null);
    try {
      setResult(await reviewCV(cv));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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

      <CvInput value={cv} onChange={setCv} />

      <button
        onClick={handleAnalyse}
        disabled={cv.trim().length < 50 || loading}
        style={{
          background: cv.trim().length < 50 || loading ? "#333333" : "#E8FF00",
          color: cv.trim().length < 50 || loading ? "#666666" : "#080808",
          border: "none",
          padding: "1rem",
          width: "100%",
          cursor: cv.trim().length < 50 || loading ? "not-allowed" : "pointer",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          fontFamily: "inherit",
        }}
      >
        Analyse CV →
      </button>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "2rem" }}>
          <Loader2 size={20} className="animate-spin" style={{ color: "#E8FF00" }} />
          <p style={{ fontSize: "0.85rem", color: "#666666" }}>Analysing your CV...</p>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "0.85rem", color: "#FF3D00" }}>{error}</p>
      )}

      {result !== null && <ReviewResultComponent result={result} />}
      {result !== null && <PdfExportSection cvText={cv} />}
    </div>
  );
}
