"use client";

import type { PDFLayout } from "@/lib/api";
import { buildPreviewHtml, buildPrintFragment } from "@/lib/cv-render";

// Re-exported for PdfExportSection.tsx, which renders the same fragment
// into the print portal (#pdf-print-root) outside of this component's tree.
export { buildPreviewHtml, buildPrintFragment };

interface Props { cvText: string; layout: PDFLayout; color: string | null; }

export default function CVPreview({ cvText, layout, color }: Props) {
  const html = buildPreviewHtml(cvText, layout, color);
  const SCALE = 0.38;
  const W = 794;
  const H = 1123;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#666666", textTransform: "uppercase" }}>
        Preview
      </span>
      <div style={{
        width: Math.round(W * SCALE),
        height: Math.round(H * SCALE),
        overflow: "visible",
        border: "1px solid #222222",
        background: "#f5f5f5",
        position: "relative",
        willChange: "transform",
        isolation: "isolate",
      }}>
        <iframe
          srcDoc={html}
          sandbox=""
          title="CV preview"
          style={{
            width: W,
            height: H,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            border: "none",
            display: "block",
            willChange: "transform",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            WebkitFontSmoothing: "antialiased",
            imageRendering: "crisp-edges",
          }}
        />
      </div>
    </div>
  );
}
