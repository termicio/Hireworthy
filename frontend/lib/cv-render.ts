import type { PDFLayout } from "@/lib/api";
import { parseCV, type CVLine } from "@/lib/cv-parse";

export function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeColor(color: string | null): string | null {
  if (color && /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color)) return color;
  return null;
}

/**
 * Renders a single parsed CV line as an HTML fragment for one of the layouts.
 * All user/AI-controlled text is passed through `escape()` and only ever placed
 * as element text content — never interpolated into an HTML attribute.
 */
function renderLine(line: CVLine, layout: PDFLayout, mutedColor: string): string {
  if (line.kind === "bullet") {
    const t = escape(line.text);
    const pad = layout === "modern" ? 12 : 16;
    return `<div style="padding-left:${pad}px;font-size:10.5px;color:#222;margin:3px 0;line-height:1.35">• ${t}</div>`;
  }

  if (line.kind === "entry") {
    const role = escape(line.role);
    const org = line.org ? escape(line.org) : null;
    const dates = line.dates ? escape(line.dates) : null;

    // Unified across layouts: "Company — Role" on ONE line (company bold,
    // role regular weight; serif italic in classic), dates on the line below.
    const roleStyle = layout === "classic"
      ? `font-weight:400;font-style:italic`
      : `font-weight:400;color:${mutedColor}`;
    const orgRoleHtml = org
      ? `<div style="font-weight:700;font-size:11px;color:#1a1a1a">${org} — <span style="${roleStyle}">${role}</span></div>`
      : `<div style="font-weight:700;font-size:11px;color:#1a1a1a">${role}</div>`;

    const datesHtml = dates
      ? `<div style="font-size:9.5px;font-weight:500;color:${mutedColor};letter-spacing:0.02em;white-space:nowrap;margin-top:2px">${dates}</div>`
      : "";

    return `<div style="margin-top:13px;margin-bottom:2px">${orgRoleHtml}${datesHtml}</div>`;
  }

  // body
  const t = escape(line.text);
  return `<div style="font-size:10.5px;color:#222;margin:2px 0;line-height:1.4">${t}</div>`;
}

function renderHeader(text: string, color: string, style: "underline" | "border"): string {
  const t = escape(text);
  const base = `font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${color};margin-top:18px;margin-bottom:8px`;
  if (style === "border") {
    return `<div class="section-header" style="${base};border-bottom:0.5px solid ${color};padding-bottom:4px">${t}</div>`;
  }
  return `<div class="section-header" style="${base}">${t}</div><hr style="border:none;border-top:0.5px solid ${color};margin:0 0 6px"/>`;
}

interface CVFragment {
  /** Inner HTML of the CV body — no <html>/<head>/<body> wrapper, safe to inject via dangerouslySetInnerHTML. */
  innerHtml: string;
  /** Inline CSS declarations (no selector) to apply to the fragment's root container. */
  containerStyle: string;
}

/** Builds the CV markup shared by the iframe preview and the print stylesheet. */
export function buildCVFragment(cvText: string, layout: PDFLayout, color: string | null): CVFragment {
  const parsed = parseCV(cvText);
  const name = escape(parsed.name);
  const title = escape(parsed.title);
  const accent = safeColor(color) ?? "";
  // Muted colour used for role/dates secondary text — kept dark enough
  // for print contrast (~#475569 minimum) on the white A4 background.
  const mutedColor = "#475569";

  if (layout === "classic") {
    const headerColor = accent || "#1a1a1a";
    const hrColor = accent || "#cccccc";
    let sectionHtml = "";
    for (const line of parsed.lines) {
      sectionHtml += line.kind === "header"
        ? renderHeader(line.text, headerColor, "underline")
        : renderLine(line, layout, mutedColor);
    }
    return {
      innerHtml: `<div style="text-align:center;margin-bottom:16px"><div class="cv-name" style="font-size:26px;font-weight:bold;color:${headerColor}">${name}</div>${title ? `<div style="font-size:10.5px;font-weight:bold;color:#555;margin-top:4px">${title}</div>` : ""}</div><hr style="border:none;border-top:1.5px solid ${hrColor};margin-bottom:16px"/>${sectionHtml}`,
      containerStyle: `font-family:Georgia,serif;background:white;width:794px;min-height:1123px;padding:48px;color:#1a1a1a;box-sizing:border-box`,
    };
  }

  // modern
  const accentCol = accent || "#333333";
  let sectionHtml = "";
  for (const line of parsed.lines) {
    sectionHtml += line.kind === "header"
      ? renderHeader(line.text, accentCol, "border")
      : renderLine(line, layout, mutedColor);
  }
  return {
    innerHtml: `<div style="border-left:3px solid ${accentCol};padding-left:12px;margin-bottom:16px"><div class="cv-name" style="font-size:26px;font-weight:bold;color:#111">${name}</div>${title ? `<div style="font-size:10.5px;font-weight:bold;color:#555;margin-top:4px">${title}</div>` : ""}</div>${sectionHtml}`,
    containerStyle: `font-family:Arial,Helvetica,sans-serif;background:white;width:794px;min-height:1123px;padding:48px;color:#111;box-sizing:border-box`,
  };
}

export function buildPreviewHtml(cvText: string, layout: PDFLayout, color: string | null): string {
  const { innerHtml, containerStyle } = buildCVFragment(cvText, layout, color);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}</style></head><body style="${containerStyle}">${innerHtml}</body></html>`;
}

/**
 * Builds the CV fragment used by the print stylesheet (@media print).
 * Returned as raw HTML + inline container style so it can be rendered directly
 * in the main document (no iframe), which `window.print()` can reliably capture.
 */
export function buildPrintFragment(cvText: string, layout: PDFLayout, color: string | null) {
  return buildCVFragment(cvText, layout, color);
}
