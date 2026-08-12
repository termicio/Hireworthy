"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ReviewResult, AnalyseResult } from "@/lib/api";

const STORAGE_KEY = "hireworthy:cv-context";

interface PersistedState {
  cvText: string;
  reviewResult: ReviewResult | null;
  analyseResult: AnalyseResult | null;
  jobDescription: string;
}

// Walidacja kształtu wyników: zapis z uszkodzonej/starszej wersji schematu
// nie może crashować stron wyników (.categories.map itd.). Nieprawidłowy
// wynik degradujemy do null, ratując samo CV i opis stanowiska.
function isAnalyseResult(v: unknown): v is AnalyseResult {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.overall_score === "number" && Array.isArray(r.categories)
    && Array.isArray(r.missing_keywords) && Array.isArray(r.matched_keywords)
    && Array.isArray(r.suggestions);
}

function isReviewResult(v: unknown): v is ReviewResult {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.overall_score === "number" && Array.isArray(r.categories)
    && Array.isArray(r.weak_bullets) && Array.isArray(r.red_flags)
    && Array.isArray(r.quick_wins);
}

function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.cvText === "string" && typeof v.jobDescription === "string";
}

interface CVState {
  cvText: string;
  setCvText: (text: string) => void;
  reviewResult: ReviewResult | null;
  setReviewResult: (result: ReviewResult | null) => void;
  analyseResult: AnalyseResult | null;
  setAnalyseResult: (result: AnalyseResult | null) => void;
  jobDescription: string;
  setJobDescription: (text: string) => void;
  clearAll: () => void;
  /** True when the currently held result was inherited from a previous
   * visit (i.e. the page mounted with a result already in context),
   * false right after a fresh submit in this view. Drives the
   * "Showing previous results" banner. */
  resultIsStale: boolean;
  markResultStale: () => void;
  markResultFresh: () => void;
}

const CVContext = createContext<CVState | null>(null);

export function CVProvider({ children }: { children: ReactNode }) {
  const [cvText, setCvText] = useState("");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [analyseResult, setAnalyseResult] = useState<AnalyseResult | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [resultIsStale, setResultIsStale] = useState(false);

  // Guards writes until the initial sessionStorage read has completed, so
  // the first render (empty state, required to match SSR output and avoid
  // hydration mismatch) doesn't immediately overwrite whatever was saved.
  const didHydrate = useRef(false);

  // Hydrate from sessionStorage once, client-side only. The read happens in
  // an async microtask callback (not synchronously in the effect body) so
  // this satisfies react-hooks/set-state-in-effect while still running
  // after the SSR-matching first paint — a returning visit should show the
  // "Showing previous results" banner (resultIsStale = true), a brand new
  // session should not.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const raw = sessionStorage.getItem(STORAGE_KEY);
      didHydrate.current = true;
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isPersistedState(parsed)) return;
        const analyse = isAnalyseResult(parsed.analyseResult) ? parsed.analyseResult : null;
        const review = isReviewResult(parsed.reviewResult) ? parsed.reviewResult : null;
        setCvText(parsed.cvText);
        setReviewResult(review);
        setAnalyseResult(analyse);
        setJobDescription(parsed.jobDescription);
        if (analyse !== null || review !== null) {
          setResultIsStale(true);
        }
      } catch {
        // Corrupted storage entry — ignore and keep defaults.
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Persist on every change, once the initial hydration read has happened.
  useEffect(() => {
    if (!didHydrate.current) return;
    const data: PersistedState = { cvText, reviewResult, analyseResult, jobDescription };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [cvText, reviewResult, analyseResult, jobDescription]);

  const clearAll = () => {
    setCvText("");
    setReviewResult(null);
    setAnalyseResult(null);
    setJobDescription("");
    setResultIsStale(false);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <CVContext.Provider
      value={{
        cvText, setCvText,
        reviewResult, setReviewResult,
        analyseResult, setAnalyseResult,
        jobDescription, setJobDescription,
        clearAll,
        resultIsStale,
        markResultStale: () => setResultIsStale(true),
        markResultFresh: () => setResultIsStale(false),
      }}
    >
      {children}
    </CVContext.Provider>
  );
}

export function useCVContext(): CVState {
  const ctx = useContext(CVContext);
  if (!ctx) throw new Error("useCVContext must be used within CVProvider");
  return ctx;
}
