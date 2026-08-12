"use client";

import { useRef, useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { PDFLayout } from "@/lib/api";
import { buildPreviewHtml, buildPrintFragment } from "@/components/CVPreview";
import { Button } from "@/components/ui/button";

const SWATCHES: { color: string | null; label: string }[] = [
  { color: "#1B2A4A", label: "Midnight Navy" },
  { color: "#2D5016", label: "Forest" },
  { color: "#6B2737", label: "Burgundy" },
  { color: "#4A5568", label: "Slate" },
  { color: null, label: "None" },
];

const A4_W = 794;
const A4_H = 1123;

// SSR-safe wykrycie klienta bez setState w efekcie
// (react-hooks/set-state-in-effect): na serwerze false, na kliencie true.
const emptySubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

interface Props {
  cvText: string;
}

export default function PdfExportSection({ cvText }: Props) {
  const [selectedLayout, setSelectedLayout] = useState<PDFLayout>("modern");
  const [selectedColor, setSelectedColor] = useState<string | null>("#1B2A4A");
  const mounted = useMounted();

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
  const printFragment = buildPrintFragment(cvText, selectedLayout, selectedColor);

  function handleDownloadPDF() {
    window.print();
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
              {(["classic", "modern"] as PDFLayout[]).map((l) => (
                <Button
                  key={l}
                  type="button"
                  size="sm"
                  variant={selectedLayout === l ? "primary" : "secondary"}
                  onClick={() => setSelectedLayout(l)}
                  className="justify-start"
                >
                  {l}
                </Button>
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

          <Button
            type="button"
            variant="primary"
            onClick={handleDownloadPDF}
            className="h-auto py-3 px-4 text-[0.65rem]"
          >
            Download PDF →
          </Button>
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

      {/* Print-only fragment, portaled to <body> so @media print can isolate it
          from the rest of the app (sidebar, nav, this very form) without a
          separate window — avoids the window.open()+print() renderer hang. */}
      {mounted &&
        createPortal(
          <div
            id="pdf-print-root"
            style={{
              display: "none",
              ...cssStringToObject(printFragment.containerStyle),
            }}
            dangerouslySetInnerHTML={{ __html: printFragment.innerHtml }}
          />,
          document.body
        )}
    </div>
  );
}

/** Parses a flat `"prop:value;prop:value"` CSS string into a React style object. */
function cssStringToObject(css: string): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const [prop, ...rest] = decl.split(":");
    if (!prop || rest.length === 0) continue;
    const camelProp = prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[camelProp] = rest.join(":").trim();
  }
  return style as React.CSSProperties;
}
