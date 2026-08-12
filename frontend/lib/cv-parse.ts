// Parser for the plain-text CV convention produced by the tailoring prompts
// (see backend/ai.py -- ENTRY FORMATTING block) plus a heuristic fallback for
// CVs pasted in free form (no convention).
//
// Entry convention (new, em-dash + date-only-line):
//   Company -- Job Title
//   Mon YYYY - Mon YYYY
//   bullet
//   bullet
//
// The parser never assumes the convention was followed -- if detection fails,
// the line is treated as plain body text, same as today's behaviour.

export type CVLine =
  | { kind: "header"; text: string }
  | { kind: "entry"; org: string | null; role: string; dates: string | null }
  | { kind: "bullet"; text: string }
  | { kind: "body"; text: string };

export interface ParsedCV {
  name: string;
  title: string;
  lines: CVLine[];
}

const SECTION_KEYWORDS = new Set([
  "EDUCATION", "EXPERIENCE", "CONTACT", "SKILLS", "SKILL", "PROJECTS", "PROJECT",
  "SUMMARY", "OBJECTIVE", "WORK", "EMPLOYMENT", "CERTIFICATIONS", "CERTIF",
  "LANGUAGES", "LANGUAGE", "AWARDS", "PUBLICATIONS", "REFERENCES", "PROFILE",
  "ABOUT", "INTERESTS", "HOBBIES", "ACHIEVEMENTS", "VOLUNTEERING", "VOLUNTEER",
]);

// Month name (abbreviated or full), used inside date ranges.
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";
// A single date token: optional month + 4-digit year, or "Present"/"Current".
const DATE_TOKEN = `(?:${MONTH}\\s*)?\\d{4}`;
// A full date RANGE (two tokens or a token + Present/Current) -- never a bare year.
const DATE_RANGE = new RegExp(
  `${DATE_TOKEN}\\s*[–-]\\s*(?:Present|Current|${DATE_TOKEN})`,
  "i"
);
// Same pattern anchored to the end of a line (old-format fallback: dates trail the line).
const DATE_RANGE_AT_END = new RegExp(`(${DATE_RANGE.source})\\s*$`, "i");
// A line that is ONLY a date range (new-format convention: dates on their own line).
const DATE_ONLY_LINE = new RegExp(`^\\s*${DATE_RANGE.source}\\s*$`, "i");
// A line that is ONLY a single date token (e.g. graduation year "2021").
// Weaker signal than a range -- accepted as entry dates ONLY when the line
// above carries the em-dash convention (see parseCV), never in fallback paths.
const SINGLE_DATE_ONLY_LINE = new RegExp(`^\\s*${DATE_TOKEN}\\s*$`, "i");

// Em dash used as the "Company -- Role" separator in the new convention.
const EM_DASH_SEP = " — ";

function isContactLine(line: string): boolean {
  return /@|tel:|telefon|e-mail|\+\d{2,}|https?:\/\//i.test(line);
}

function isSectionHeader(line: string): boolean {
  const up = line.toUpperCase().trim().replace(/[:\s]/g, "");
  return SECTION_KEYWORDS.has(up) || [...SECTION_KEYWORDS].some((k) => up === k);
}

function detectName(lines: string[]): { name: string; nameIdx: number } {
  for (let i = 0; i < lines.length && i < 10; i++) {
    const line = lines[i];
    if (line.length < 3) continue;
    if (isContactLine(line)) continue;
    if (isSectionHeader(line)) continue;
    const words = line.split(/\s+/);
    const isTitleCase = words.length >= 1 && words.every((w) => /^[A-ZÁÉÍÓÚÀÈÌÒÙÄËÏÖÜ]/.test(w));
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

/** Splits "Company -- Role" into { org, role }. No em-dash -> whole string is the role. */
function splitOrgRole(text: string): { org: string | null; role: string } {
  const idx = text.indexOf(EM_DASH_SEP);
  if (idx === -1) return { org: null, role: text.trim() };
  return { org: text.slice(0, idx).trim(), role: text.slice(idx + EM_DASH_SEP.length).trim() };
}

/** Best-effort split for the old "Role -- Company | dates" / "Role, Company" fallback shapes. */
function splitOrgRoleFallback(text: string): { org: string | null; role: string } {
  const emDashIdx = text.indexOf(EM_DASH_SEP);
  if (emDashIdx !== -1) {
    return { role: text.slice(0, emDashIdx).trim(), org: text.slice(emDashIdx + EM_DASH_SEP.length).trim() };
  }
  const atMatch = text.match(/\s+at\s+/i);
  if (atMatch && atMatch.index !== undefined) {
    return { role: text.slice(0, atMatch.index).trim(), org: text.slice(atMatch.index + atMatch[0].length).trim() };
  }
  const commaIdx = text.indexOf(",");
  if (commaIdx !== -1) {
    return { role: text.slice(0, commaIdx).trim(), org: text.slice(commaIdx + 1).trim() };
  }
  return { org: null, role: text.trim() };
}

const MAX_FALLBACK_ENTRY_LEN = 80;

// Common degree abbreviations (B.Sc., M.Sc., Ph.D., B.A., M.A., ...) -- their
// internal periods must not be mistaken for sentence-ending punctuation by
// looksLikeSentence(). Strips short dotted tokens like "B.Sc." or "Ph.D."
// before checking for sentence-like punctuation.
const DEGREE_ABBREVIATION = /\b(?:[A-Z][a-z]?\.){1,3}/g;

/** True if a line reads like a full sentence (fallback disqualifier), not a title line. */
function looksLikeSentence(line: string): boolean {
  const withoutDegrees = line.replace(DEGREE_ABBREVIATION, "");
  return /[a-z]\.\s+[A-Z]/.test(withoutDegrees) || /[a-z]\.\s*$/.test(withoutDegrees.trim().slice(0, -1));
}

export function parseCV(cvText: string): ParsedCV {
  const rawLines = cvText.split("\n").map((l) => l.trim()).filter(Boolean);
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
    const nextIsUnderline = nextLine.length > 0 && [...nextLine.replace(/ /g, "")].every((c) => c === "-" || c === "=");
    const hasLetters = /[a-zA-Z]/.test(line);
    const allCaps = hasLetters && line === line.toUpperCase() && line.length < 60;
    const isBullet = /^[•\-*]/.test(line);

    // Header and bullet detection MUST run before entry detection -- an
    // ALL-CAPS section title or a "- bullet" line must never be parsed as an entry.
    if (allCaps || nextIsUnderline) {
      result.push({ kind: "header", text: line });
      i += nextIsUnderline ? 2 : 1;
      continue;
    }

    if (isBullet) {
      result.push({ kind: "bullet", text: line.replace(/^[•\-*]\s*/, "") });
      i++;
      continue;
    }

    // Path A -- new convention: an entry header line (with or without a
    // "Company -- Role" em-dash -- no company means the line is just the role)
    // followed by a line that is ONLY a date range. Guard against a plain
    // body paragraph accidentally followed by a stray date-only line by
    // requiring the header candidate to be short and not a full sentence.
    if (DATE_ONLY_LINE.test(nextLine) && line.length <= MAX_FALLBACK_ENTRY_LEN && !looksLikeSentence(line)) {
      const { org, role } = splitOrgRole(line);
      result.push({ kind: "entry", org, role, dates: nextLine.trim() });
      i += 2;
      continue;
    }

    // Path A -- single-year variant: "Company -- Role" + bare year below
    // (typical for education: graduation year). The em-dash is REQUIRED here;
    // a bare year after an arbitrary line stays body text (anti-false-positive).
    if (
      line.includes(EM_DASH_SEP) &&
      SINGLE_DATE_ONLY_LINE.test(nextLine) &&
      line.length <= MAX_FALLBACK_ENTRY_LEN &&
      !looksLikeSentence(line)
    ) {
      const { org, role } = splitOrgRole(line);
      result.push({ kind: "entry", org, role, dates: nextLine.trim() });
      i += 2;
      continue;
    }

    // Path A (no dates known) -- "Company -- Role" line with no date-only line
    // after it, but the line right after IS a bullet (so this reads as a header,
    // not body prose). Requires the em-dash so a plain body line right before
    // a bullet list isn't misread -- the no-em-dash+no-dates case is covered by
    // the Path B fallback below.
    if (line.includes(EM_DASH_SEP) && /^[•\-*]/.test(nextLine)) {
      const { org, role } = splitOrgRole(line);
      result.push({ kind: "entry", org, role, dates: null });
      i++;
      continue;
    }

    // Path B -- old-format fallback: date range trails at the END of the line.
    const trailingMatch = line.match(DATE_RANGE_AT_END);
    if (!allCaps && trailingMatch && trailingMatch.index !== undefined) {
      const dates = trailingMatch[1].trim();
      const rest = line.slice(0, trailingMatch.index).trim().replace(/[|,–-]\s*$/, "").trim();
      const { org, role } = splitOrgRoleFallback(rest);
      result.push({ kind: "entry", org, role, dates });
      i++;
      continue;
    }

    // Path B -- old-format fallback: no trailing date, but next non-empty line
    // is a bullet, and this line is short and not a full sentence -- treat as
    // a header-less entry (role only). Must contain real words: a bare year /
    // date-ish line ("2020") before bullets is NOT an entry heading.
    const hasWords = (line.match(/[a-zA-Z]/g) ?? []).length >= 3;
    if (/^[•\-*]/.test(nextLine) && hasWords && line.length <= MAX_FALLBACK_ENTRY_LEN && !looksLikeSentence(line)) {
      const { org, role } = splitOrgRoleFallback(line);
      result.push({ kind: "entry", org, role, dates: null });
      i++;
      continue;
    }

    result.push({ kind: "body", text: line });
    i++;
  }
  return { name, title, lines: result };
}

