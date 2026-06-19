"use client";

import { useState } from "react";
import { createApplication } from "@/lib/api";
import { X } from "lucide-react";

interface SaveApplicationModalProps {
  matchScore: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function SaveApplicationModal({
  matchScore,
  onClose,
  onSaved,
}: SaveApplicationModalProps) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!company.trim() || !role.trim()) {
      setError("Company and role are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createApplication({ company: company.trim(), role: role.trim(), match_score: matchScore });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-slate-100 font-semibold text-lg">Save Application</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <input
          className="bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          className="bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder="Role / position"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 font-medium"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
