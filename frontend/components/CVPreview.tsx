"use client";

import type { PDFLayout } from "@/lib/api";

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeColor(color: string | null): string | null {
  if (color && /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color)) return color;
  return null;
}

function accentBg(accent: string): string {
  if (!accent || accent.length < 7) return "#f7f7f7";
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#f7f7f7";
  return `rgba(${r},${g},${b},0.08)`;
}

interface CVLine { type: "header" | "bullet" | "body"; text: string; }
interface ParsedCV { name: string; title: string; lines: CVLine[]; }
interface Section { header: string | null; lines: CVLine[]; }

const SECTION_KEYWORDS = new Set([
  "EDUCATION","EXPERIENCE","CONTACT","SKILLS","SKILL","PROJECTS","PROJECT",
  "SUMMARY","OBJECTIVE","WORK","EMPLOYMENT","CERTIFICATIONS","CERTIF",
  "LANGUAGES","LANGUAGE","AWARDS","PUBLICATIONS","REFERENCES","PROFILE",
  "ABOUT","INTERESTS","HOBBIES","ACHIEVEMENTS","VOLUNTEERING","VOLUNTEER",
]);

function isContactLine(line: string): boolean {
  return /@|tel:|telefon|e-mail|\+\d{2,}|https?:\/\//i.test(line);
}

function isSectionHeader(line: string): boolean {
  const up = line.toUpperCase().trim().replace(/[:\s]/g, "");
  return SECTION_KEYWORDS.has(up) || [...SECTION_KEYWORDS].some(k => up === k);
}

function detectName(lines: string[]): { name: string; nameIdx: number } {
  for (let i = 0; i < lines.length && i < 10; i++) {
    const line = lines[i];
    if (line.length < 3) continue;
    if (isContactLine(line)) continue;
    if (isSectionHeader(line)) continue;
    const words = line.split(/\s+/);
    const isTitleCase = words.length >= 1 && words.every(w => /^[A-ZÁÉÍÓÚÀÈÌÒÙÄËÏÖÜ]/.test(w));
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
    if ((isTitleCase || isAllCaps) && line.length < 40) {
      return { name: line, nameIdx: i };
    }
  }
  // Fallback: longest capitalised line in first 5 lines
  let best = { line: lines[0] ?? "", idx: 0 };
  for (let i = 1; i < Math.min(5, lines.length); i++) {
    if (/^[A-Z]/.test(lines[i]) && lines[i].length > best.line.length && !isContactLine(lines[i])) {
      best = { line: lines[i], idx: i };
    }
  }
  return { name: best.line, nameIdx: best.idx };
}

function detectTitle(lines: string[], afterIdx: number): { title: string; titleIdx: number } {
  for (let i = afterIdx + 1; i < lines.length && i < afterIdx + 6; i++) {
    const line = lines[i];
    if (line.length < 2) continue;
    if (isContactLine(line)) continue;
    if (isSectionHeader(line)) continue;
    if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length > 4) continue;
    return { title: line, titleIdx: i };
  }
  return { title: "", titleIdx: afterIdx };
}

function parseCV(cvText: string): ParsedCV {
  const rawLines = cvText.split("\n").map(l => l.trim()).filter(Boolean);
  if (!rawLines.length) return { name: "", title: "", lines: [] };

  const { name, nameIdx } = detectName(rawLines);
  const { title, titleIdx } = detectTitle(rawLines, nameIdx);

  const result: CVLine[] = [];
  let i = titleIdx + 1;
  // Ensure we don't re-parse the name/title lines
  if (i <= nameIdx) i = nameIdx + 1;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const nextLine = rawLines[i + 1] ?? "";
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

const LEFT_KEYWORDS = ["SKILL", "CONTACT", "LANGUAGE", "PROFIL", "ABOUT"];

const RIGHT_ORDER = [
  "SUMMARY","PROFILE","ABOUT","OBJECTIVE",
  "EXPERIENCE","EMPLOYMENT","WORK",
  "EDUCATION","CERTIF","PROJECT","AWARD","PUBLICATION","REFERENCE","INTEREST","HOBBIE",
];

function sectionRightOrder(header: string | null): number {
  if (!header) return 0;
  const h = header.toUpperCase();
  const idx = RIGHT_ORDER.findIndex(k => h.includes(k));
  return idx === -1 ? RIGHT_ORDER.length : idx;
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
        sectionHtml += `<div class="section-header" style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${headerColor};margin-top:20px;margin-bottom:8px">${t}</div><hr style="border:none;border-top:0.5px solid ${hrColor};margin:0 0 6px"/>`;
      } else if (line.type === "bullet") {
        sectionHtml += `<div style="padding-left:16px;font-size:10px;color:#222;margin:4px 0;line-height:1.6">• ${t}</div>`;
      } else {
        sectionHtml += `<div style="font-size:10px;color:#222;margin:2px 0;line-height:1.6">${t}</div>`;
      }
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:white;width:794px;min-height:1123px;padding:48px;color:#1a1a1a}</style></head><body><div style="text-align:center;margin-bottom:16px"><div class="cv-name" style="font-size:26px;font-weight:bold;color:${headerColor}">${name}</div>${title ? `<div style="font-size:10.5px;font-weight:bold;color:#555;margin-top:4px">${title}</div>` : ""}</div><hr style="border:none;border-top:1.5px solid ${hrColor};margin-bottom:16px"/>${sectionHtml}</body></html>`;
  }

  if (layout === "modern") {
    const accentCol = accent || "#333333";
    let sectionHtml = "";
    for (const line of parsed.lines) {
      const t = escape(line.text);
      if (line.type === "header") {
        sectionHtml += `<div class="section-header" style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${accentCol};border-bottom:0.5px solid ${accentCol};padding-bottom:4px;margin-top:20px;margin-bottom:8px">${t}</div>`;
      } else if (line.type === "bullet") {
        sectionHtml += `<div style="padding-left:12px;font-size:10px;color:#333;margin:4px 0;line-height:1.6">• ${t}</div>`;
      } else {
        sectionHtml += `<div style="font-size:10px;color:#333;margin:2px 0;line-height:1.6">${t}</div>`;
      }
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:white;width:794px;min-height:1123px;padding:48px;color:#111}</style></head><body><div style="border-left:3px solid ${accentCol};padding-left:12px;margin-bottom:16px"><div class="cv-name" style="font-size:26px;font-weight:bold;color:#111">${name}</div>${title ? `<div style="font-size:10.5px;font-weight:bold;color:#555;margin-top:4px">${title}</div>` : ""}</div>${sectionHtml}</body></html>`;
  }

  // split
  const accentCol = accent || "#333333";
  const leftBg = accent ? accentBg(accent) : "#f7f7f7";
  const sections = groupSections(parsed);

  const leftSections = sections.filter(s => {
    const h = s.header?.toUpperCase() ?? "";
    return LEFT_KEYWORDS.some(k => h.includes(k));
  });
  const leftSet = new Set(leftSections);
  const rightSections = sections
    .filter(s => !leftSet.has(s))
    .sort((a, b) => sectionRightOrder(a.header) - sectionRightOrder(b.header));

  const renderSection = (s: Section): string => {
    const h = s.header ? escape(s.header) : "";
    let html = h
      ? `<div class="section-header" style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${accentCol};border-bottom:0.5px solid ${accentCol};padding-bottom:2px;margin-top:20px;margin-bottom:8px">${h}</div>`
      : "";
    for (const line of s.lines) {
      const t = escape(line.text);
      html += line.type === "bullet"
        ? `<div style="font-size:10px;color:#333;padding-left:10px;margin:4px 0;line-height:1.6">• ${t}</div>`
        : `<div style="font-size:10px;color:#333;margin:2px 0;line-height:1.6">${t}</div>`;
    }
    return html;
  };

  const leftHtml = `<div class="cv-name" style="font-size:26px;font-weight:bold;color:#111;margin-bottom:4px">${name}</div>${title ? `<div style="font-size:10.5px;font-weight:bold;color:#555;margin-bottom:12px">${title}</div>` : ""}${leftSections.map(renderSection).join("")}`;
  const rightHtml = rightSections.map(renderSection).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:white;width:794px;min-height:1123px;display:flex}</style></head><body><div style="width:30%;background:${leftBg};padding:16px;min-height:1123px">${leftHtml}</div><div style="width:70%;padding:16px;min-height:1123px">${rightHtml}</div></body></html>`;
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
