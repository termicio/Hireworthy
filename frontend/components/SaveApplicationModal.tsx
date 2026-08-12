"use client";

import { useState } from "react";
import { createApplication, type MatchCategory } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SaveApplicationModalProps {
  matchScore: number;
  jobDescription?: string;
  missingKeywords?: string[];
  categories?: MatchCategory[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SaveApplicationModal({
  matchScore, jobDescription, missingKeywords, categories, open, onClose, onSaved,
}: SaveApplicationModalProps) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!company.trim() || !role.trim()) { setError("Both fields are required."); return; }
    setSaving(true); setError(null);
    try {
      await createApplication({
        company: company.trim(),
        role: role.trim(),
        job_description: jobDescription,
        match_score: matchScore,
        missing_keywords: missingKeywords,
        categories,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ background: "#111111", border: "1px solid #222222", maxWidth: 400 }}
      >
        <DialogHeader className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid #222222" }}>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display font-bold uppercase tracking-widest text-sm" style={{ color: "#F5F5F5" }}>
              Save Application
            </DialogTitle>
            <button onClick={onClose} style={{ color: "#444444" }} className="hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          {[
            { id: "company", label: "Company", value: company, set: setCompany, placeholder: "e.g. Stripe" },
            { id: "role",    label: "Role",    value: role,    set: setRole,    placeholder: "e.g. Senior Engineer" },
          ].map(({ id, label, value, set, placeholder }) => (
            <div key={id} className="flex flex-col gap-1.5">
              <label
                htmlFor={id}
                className="uppercase tracking-widest font-medium"
                style={{ fontSize: "0.65rem", color: "#666666" }}
              >
                {label}
              </label>
              <input
                id={id}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="border border-border focus:border-[#E8FF00]"
                style={{
                  background: "#080808",
                  color: "#F5F5F5",
                  padding: "10px 12px",
                  fontSize: "0.875rem",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>
          ))}

          {error && <p style={{ color: "#FF3D00", fontSize: "0.8rem" }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-auto py-2.5 text-xs text-[#666666]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-auto py-2.5 text-xs"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
