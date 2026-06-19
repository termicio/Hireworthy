"use client";

import type { PDFLayout } from "@/lib/api";

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeColor(color: string | null): string | null {
  if (color && /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color)) return color;
  return null;
}

interface CVLine { type: "header" | "bullet" | "body"; text: string; }
interface ParsedCV { name: string; title: string; lines: CVLine[]; }
interface Section { header: string | null; lines: CVLine[]; }

function parseCV(cvText: string): ParsedCV {
  const lines = cvText.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { name: "", title: "", lines: [] };

  const name = lines[0] ?? "";
  const title = lines[1] ?? "";
  const result: CVLine[] = [];

  let i = 2;
  while (i < lines.length) {
    const line = lines[i];
    const nextLine = lines[i + 1] ?? "";
    const nextIsUnderline = nextLine.length > 0 && [...nextLine.replace(/ /g, "")].every(c => c === "-" || c === "=");
    const hasLetters = /[a-zA-Z]/.test(line);
    const allCaps = hasLetters && line === line.toUpperCase() && line.length < 60;

    if (allCaps || nextIsUnderline) {
      result.push({ type: "header", text: line });
      i += nextIsUnderline ? 2 : 1;
    } else if (/^[•\-*]/.test(line)) {
      result.push({ type: "bullet", text: line.replace(/^[•\-*]\s*/, "") });
      i++;
    } else {
      result.push({ type: "body", text: line });
      i++;
    }
  }
  return { name, title, lines: result };
}

function groupSections(parsed: ParsedCV): Section[] {
  const sections: Section[] = [];
  let currentHeader: string | null = null;
  let currentLines: CVLine[] = [];

  for (const line of parsed.lines) {
    if (line.type === "header") {
      sections.push({ header: currentHeader, lines: currentLines });
      currentHeader = line.text;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections.push({ header: currentHeader, lines: currentLines });
  return sections.filter(s => s.header !== null || s.lines.length > 0);
}

export function buildPreviewHtml(cvText: string, layout: PDFLayout, color: string | null): string {
  const parsed = parseCV(cvText);
  const name = escape(parsed.name);
  const title = escape(parsed.title);
  const accent = safeColor(color) ?? "";

  if (layout === "classic") {
    const headerColor = accent || "#1a1a1a";
    const hrColor = accent || "#cccccc";
    let sectionHtml = "";
    for (const line of parsed.lines) {
      const t = escape(line.text);
      if (line.type === "header") {
        sectionHtml += `<div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:${headerColor};margin-top:18px;margin-bottom:2px">${t}</div><hr style="border:none;border-top:1px solid ${hrColor};margin:2px 0 6px"/>`;
      } else if (line.type === "bullet") {
        sectionHtml += `<div style="padding-left:16px;font-size:11px;color:#222;margin:2px 0">• ${t}</div>`;
      } else {
        sectionHtml += `<div style="font-size:11px;color:#222;margin:2px 0">${t}</div>`;
      }
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:white;width:794px;min-height:1123px;padding:48px;color:#1a1a1a}</style></head><body><div style="text-align:center;margin-bottom:16px"><div style="font-size:28px;font-weight:bold;color:${headerColor}">${name}</div><div style="font-size:12px;color:#444;margin-top:4px">${title}</div></div><hr style="border:none;border-top:1px solid ${hrColor};margin-bottom:16px"/>${sectionHtml}</body></html>`;
  }

  if (layout === "modern") {
    const accentCol = accent || "#333333";
    let sectionHtml = "";
    for (const line of parsed.lines) {
      const t = escape(line.text);
      if (line.type === "header") {
        sectionHtml += `<div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:${accentCol};border-bottom:2px solid ${accentCol};padding-bottom:4px;margin-top:20px;margin-bottom:6px">${t}</div>`;
      } else if (line.type === "bullet") {
        sectionHtml += `<div style="padding-left:12px;font-size:10px;color:#333;margin:2px 0">• ${t}</div>`;
      } else {
        sectionHtml += `<div style="font-size:10px;color:#333;margin:2px 0">${t}</div>`;
      }
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:white;width:794px;min-height:1123px;padding:48px;color:#111}</style></head><body><div style="border-left:3px solid ${accentCol};padding-left:12px;margin-bottom:12px"><div style="font-size:32px;font-weight:bold;color:#111">${name}</div><div style="font-size:10px;color:#666;margin-top:4px">${title}</div></div>${sectionHtml}</body></html>`;
  }

  // split
  const accentCol = accent || "#333333";
  const sections = groupSections(parsed);
  const leftSections = sections.filter(s => s.header?.toUpperCase().includes("SKILL"));
  const rightSections = sections.filter(s => !s.header?.toUpperCase().includes("SKILL"));

  const renderSection = (s: Section): string => {
    const h = s.header ? escape(s.header) : "";
    let html = h ? `<div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:${accentCol};letter-spacing:1px;margin-top:14px;margin-bottom:4px">${h}</div>` : "";
    for (const line of s.lines) {
      const t = escape(line.text);
      html += line.type === "bullet"
        ? `<div style="font-size:9px;color:#333;padding-left:10px;margin:2px 0">• ${t}</div>`
        : `<div style="font-size:9px;color:#333;margin:2px 0">${t}</div>`;
    }
    return html;
  };

  const leftHtml = `<div style="font-size:16px;font-weight:bold;color:#111;margin-bottom:4px">${name}</div><div style="font-size:9px;color:#555;margin-bottom:12px">${title}</div>${leftSections.map(renderSection).join("")}`;
  const rightHtml = rightSections.map(renderSection).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:white;width:794px;min-height:1123px;display:flex}</style></head><body><div style="width:32%;background:#f0f0f0;padding:24px;min-height:1123px">${leftHtml}</div><div style="width:68%;padding:24px;min-height:1123px">${rightHtml}</div></body></html>`;
}

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
            width: W,
            height: H,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            border: "none",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
