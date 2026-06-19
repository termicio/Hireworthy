"use client";

import { useState } from "react";
import { analyseCV, type AnalyseResult } from "@/lib/api";
import MatchScore from "@/components/MatchScore";
import SaveApplicationModal from "@/components/SaveApplicationModal";
import { Loader2 } from "lucide-react";

export default function AnalysePage() {
  const [cv, setCv] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleAnalyse() {
    if (!cv.trim() || !jd.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const data = await analyseCV(cv, jd);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Analyse CV Match</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-slate-400 font-medium">Your CV</label>
          <textarea
            className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-64"
            placeholder="Paste your CV here…"
            value={cv}
            onChange={(e) => setCv(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-slate-400 font-medium">Job Description</label>
          <textarea
            className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-64"
            placeholder="Paste the job description here…"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleAnalyse}
        disabled={loading}
        className="self-start flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Analysing…" : "Analyse Match"}
      </button>

      {result && (
        <div className="flex flex-col gap-6 bg-[#1e293b] border border-[#334155] rounded-2xl p-6">
          <div className="flex flex-col items-center">
            <MatchScore score={result.match_score} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-2">Matched Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.matched_keywords.map((kw) => (
                  <span key={kw} className="bg-green-900/40 text-green-400 border border-green-700/40 text-xs px-2 py-1 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-2">Missing Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.missing_keywords.map((kw) => (
                  <span key={kw} className="bg-red-900/40 text-red-400 border border-red-700/40 text-xs px-2 py-1 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Suggestions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.suggestions.map((s, i) => (
                <div key={i} className="bg-[#0f172a] border border-[#334155] rounded-xl p-3 text-sm text-slate-300">
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Summary</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
          </div>

          {saved ? (
            <p className="text-green-400 text-sm font-medium">Application saved!</p>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="self-start bg-[#0f172a] border border-[#334155] hover:border-indigo-500 text-slate-200 font-medium px-5 py-2 rounded-xl text-sm transition-colors"
            >
              Save Application
            </button>
          )}
        </div>
      )}

      {showModal && result && (
        <SaveApplicationModal
          matchScore={result.match_score}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setSaved(true);
          }}
        />
      )}
    </div>
  );
}
