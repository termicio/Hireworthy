"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { uploadPDF } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (v: string) => void;
  minHeight?: number;
}

const baseInputStyle: React.CSSProperties = {
  background: "#111111",
  color: "#F5F5F5",
  padding: "12px",
  fontSize: "0.8rem",
  resize: "none",
  outline: "none",
  width: "100%",
  fontFamily: "monospace",
  lineHeight: 1.6,
};

export default function CvInput({ value, onChange, minHeight = 280 }: Props) {
  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("File must be a PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB).");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadPDF(file);
      onChange(result.text);
      setFilename(file.name);
      setMode("text");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle */}
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "text" ? "primary" : "secondary"}
          onClick={() => setMode("text")}
        >
          Paste text
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "pdf" ? "primary" : "secondary"}
          onClick={() => setMode("pdf")}
        >
          Upload PDF
        </Button>
      </div>

      {mode === "text" ? (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste your CV here…"
            className="border border-border focus:border-[#E8FF00]"
            style={{ ...baseInputStyle, minHeight: `${minHeight}px` }}
          />
          <p style={{ fontSize: "0.75rem", color: "#666666", marginTop: "8px" }}>
            {value.trim() === "" ? "0" : value.trim().split(/\s+/).length} words
          </p>
          {filename && (
            <p style={{ fontSize: "0.7rem", color: "#666666" }}>
              Loaded: {filename}{" "}
              <button
                onClick={() => { setMode("pdf"); setFilename(null); }}
                style={{ color: "#E8FF00", background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem" }}
              >
                Change file
              </button>
            </p>
          )}
        </>
      ) : (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              background: "#111111",
              border: `2px dashed ${isDragging ? "#E8FF00" : "#222222"}`,
              minHeight: `${minHeight}px`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              gap: "8px",
              transition: "border-color 0.15s",
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" style={{ color: "#E8FF00" }} />
                <p style={{ fontSize: "0.75rem", color: "#666666" }}>Extracting text…</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.8rem", color: "#F5F5F5" }}>Drop PDF here or click to upload</p>
                <p style={{ fontSize: "0.7rem", color: "#666666" }}>Max 5 MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={handleInputChange}
          />
        </>
      )}

      {error && <p style={{ color: "#FF3D00", fontSize: "0.75rem" }}>{error}</p>}
    </div>
  );
}
