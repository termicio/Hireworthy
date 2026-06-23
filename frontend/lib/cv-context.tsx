"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ReviewResult, AnalyseResult } from "@/lib/api";

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
}

const CVContext = createContext<CVState | null>(null);

export function CVProvider({ children }: { children: ReactNode }) {
  const [cvText, setCvText] = useState("");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [analyseResult, setAnalyseResult] = useState<AnalyseResult | null>(null);
  const [jobDescription, setJobDescription] = useState("");

  const clearAll = () => {
    setCvText("");
    setReviewResult(null);
    setAnalyseResult(null);
    setJobDescription("");
  };

  return (
    <CVContext.Provider
      value={{
        cvText, setCvText,
        reviewResult, setReviewResult,
        analyseResult, setAnalyseResult,
        jobDescription, setJobDescription,
        clearAll,
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
