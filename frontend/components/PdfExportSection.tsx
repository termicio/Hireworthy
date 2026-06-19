"use client";

import { useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { PDFLayout } from "@/lib/api";
import { buildPreviewHtml } from "@/components/CVPreview";

const SWATCHES: { color: string | null; label: string }[] = [
  { color: "#1B2A4A", label: "Midnight Navy" },
  { color: "#2D5016", label: "Forest" },
  { color: "#6B2737", label: "Burgundy" },
  { color: "#4A5568", label: "Slate" },
  { color: null, label: "None" },
];

const A4_W = 794;
const A4_H = 1123;

interface Props {
  cvText: string;
}

export default function PdfExportSection({ cvText }: Props) {
  const [selectedLayout, setSelectedLayout] = useState<PDFLayout>("modern");
  const [selectedColor, setSelectedColor] = useState<string | null>("#1B2A4A");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const previewColRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(400);

  useEffect(() => {
    const el = previewColRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setPreviewWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setPreviewWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const scale = previewWidth / A4_W;
  const previewHeight = Math.round(A4_H * scale);

  const html = buildPreviewHtml(cvText, selectedLayout, selectedColor);

  function handleDownloadPDF() {
    const win = window.open("", "_blank");
    if (!win) {
      setPdfError("Popup blocked — allow popups for this site and try again.");
      return;
    }
    setPdfLoading(true);
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
      setPdfLoading(false);
    };
  }

  return (
    <div style={{ borderTop: "1px solid #222222", paddingTop: "1.5rem" }}>
      <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "#666666", textTransform: "uppercase", marginBottom: "1.25rem" }}>
        Export as PDF
      </p>

      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
        {/* Left: controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flexShrink: 0, width: "180px" }}>
          <div>
            <p style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "#555555", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Layout
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {(["classic", "modern", "split"] as PDFLayout[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedLayout(l)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    border: selectedLayout === l ? "none" : "1px solid #222222",
                    background: selectedLayout === l ? "#E8FF00" : "transparent",
                    color: selectedLayout === l ? "#080808" : "#666666",
                    textAlign: "left",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "#555555", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Accent colour
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {SWATCHES.map(({ color, label }) => (
                <button
                  key={label}
                  title={label}
                  onClick={() => setSelectedColor(color)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: color ?? "#444444",
                    border: selectedColor === color ? "2px solid #E8FF00" : "1px solid #333333",
                    cursor: "pointer",
                    padding: 0,
                    position: "relative",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {color === null && (
                    <span style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom right, transparent 45%, white 45%, white 55%, transparent 55%)",
                    }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{
              padding: "0.75rem 1rem",
              background: pdfLoading ? "#b3c700" : "#E8FF00",
              color: "#080808",
              border: "none",
              cursor: pdfLoading ? "not-allowed" : "pointer",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            {pdfLoading && <Loader2 size={12} className="animate-spin" />}
            {pdfLoading ? "Opening..." : "Download PDF →"}
          </button>

          {pdfError && <p style={{ color: "#FF3D00", fontSize: "0.7rem" }}>{pdfError}</p>}
        </div>

        {/* Right: A4 preview */}
        <div ref={previewColRef} style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "#555555", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Preview
          </p>
          <div style={{
            width: "100%",
            height: previewHeight,
            overflow: "hidden",
            border: "1px solid #222222",
            background: "#f5f5f5",
            position: "relative",
          }}>
            <iframe
              srcDoc={html}
              sandbox=""
              title="CV preview"
              style={{
                width: A4_W,
                height: A4_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                border: "none",
                display: "block",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
