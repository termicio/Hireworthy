import re
from typing import Optional


def _escape(text: str) -> str:
    """Escape HTML special characters. & must be first to avoid double-escaping."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


_SECTION_KEYWORDS = {
    "EDUCATION", "EXPERIENCE", "CONTACT", "SKILLS", "SKILL", "PROJECTS", "PROJECT",
    "SUMMARY", "OBJECTIVE", "WORK", "EMPLOYMENT", "CERTIFICATIONS", "CERTIF",
    "LANGUAGES", "LANGUAGE", "AWARDS", "PUBLICATIONS", "REFERENCES", "PROFILE",
    "ABOUT", "INTERESTS", "HOBBIES", "ACHIEVEMENTS", "VOLUNTEERING", "VOLUNTEER",
}

_LEFT_KEYWORDS = ["SKILL", "CONTACT", "LANGUAGE", "PROFIL", "ABOUT"]

_RIGHT_ORDER = [
    "SUMMARY", "PROFILE", "ABOUT", "OBJECTIVE",
    "EXPERIENCE", "EMPLOYMENT", "WORK",
    "EDUCATION", "CERTIF", "PROJECT", "AWARD", "PUBLICATION", "REFERENCE", "INTEREST", "HOBBIE",
]


def _is_contact_line(line: str) -> bool:
    return bool(re.search(r'@|tel:|telefon|e-mail|\+\d{2,}|https?://', line, re.IGNORECASE))


def _is_section_header(line: str) -> bool:
    up = re.sub(r'[:\s]', '', line.upper().strip())
    return up in _SECTION_KEYWORDS or any(up == k for k in _SECTION_KEYWORDS)


def _detect_name(lines: list[str]) -> tuple[str, int]:
    for i, line in enumerate(lines[:10]):
        if len(line) < 3:
            continue
        if _is_contact_line(line):
            continue
        if _is_section_header(line):
            continue
        words = line.split()
        is_title_case = len(words) >= 1 and all(w and w[0].isupper() for w in words)
        is_all_caps = line == line.upper() and any(c.isalpha() for c in line)
        if (is_title_case or is_all_caps) and len(line) < 40:
            return line, i
    # Fallback: longest capitalised line in first 5 lines
    best_line, best_idx = (lines[0] if lines else ""), 0
    for i, line in enumerate(lines[:5]):
        if line and line[0].isupper() and len(line) > len(best_line) and not _is_contact_line(line):
            best_line, best_idx = line, i
    return best_line, best_idx


def _detect_title(lines: list[str], after_idx: int) -> tuple[str, int]:
    for i in range(after_idx + 1, min(len(lines), after_idx + 6)):
        line = lines[i]
        if len(line) < 2:
            continue
        if _is_contact_line(line):
            continue
        if _is_section_header(line):
            continue
        if line == line.upper() and any(c.isalpha() for c in line) and len(line) > 4:
            continue
        return line, i
    return "", after_idx


def _section_right_order(header: Optional[str]) -> int:
    if not header:
        return 0
    h = header.upper()
    for i, k in enumerate(_RIGHT_ORDER):
        if k in h:
            return i
    return len(_RIGHT_ORDER)


def parse_cv(cv_text: str) -> dict:
    """
    Returns: { name, title, lines: [{type, text}] }
    Uses improved name detection: skips contact lines, section headers, short lines.
    """
    lines = [l.strip() for l in cv_text.split("\n")]
    lines = [l for l in lines if l]

    if not lines:
        return {"name": "", "title": "", "lines": []}

    name, name_idx = _detect_name(lines)
    title, title_idx = _detect_title(lines, name_idx)

    result_lines = []
    start = title_idx + 1 if title_idx > name_idx else name_idx + 1

    i = start
    while i < len(lines):
        line = lines[i]
        stripped_next = lines[i + 1].replace(" ", "") if i + 1 < len(lines) else ""
        next_is_underline = bool(stripped_next) and all(c in "-=" for c in stripped_next)
        has_letters = any(c.isalpha() for c in line)
        all_caps = has_letters and line == line.upper() and len(line) < 60

        if all_caps or next_is_underline:
            result_lines.append({"type": "header", "text": line})
            i += 2 if next_is_underline else 1
        elif line.startswith(("•", "-", "*")):
            text = re.sub(r"^[•\-*]\s*", "", line, count=1)
            result_lines.append({"type": "bullet", "text": text})
            i += 1
        else:
            result_lines.append({"type": "body", "text": line})
            i += 1

    return {"name": name, "title": title, "lines": result_lines}


def group_sections(parsed: dict) -> list:
    """Group lines into sections. Each section: { header: str|None, lines: [{type,text}] }"""
    sections = []
    current_header = None
    current_lines = []

    for line in parsed["lines"]:
        if line["type"] == "header":
            sections.append({"header": current_header, "lines": current_lines})
            current_header = line["text"]
            current_lines = []
        else:
            current_lines.append(line)

    sections.append({"header": current_header, "lines": current_lines})
    return [s for s in sections if s["header"] or s["lines"]]


def _accent_bg(accent: str) -> str:
    """Return a light tint (8% opacity) of the accent color, or #f7f7f7 fallback."""
    if not accent or len(accent) < 7:
        return "#f7f7f7"
    try:
        r = int(accent[1:3], 16)
        g = int(accent[3:5], 16)
        b = int(accent[5:7], 16)
        return f"rgba({r},{g},{b},0.08)"
    except ValueError:
        return "#f7f7f7"


def build_html(cv_text: str, layout: str, color: Optional[str]) -> str:
    parsed = parse_cv(cv_text)
    name = _escape(parsed["name"])
    title = _escape(parsed["title"])
    accent = color or ""

    title_html = f'<div style="font-size:10.5px;font-weight:bold;color:#555;margin-top:4px">{title}</div>' if title else ""

    if layout == "classic":
        header_color = accent if accent else "#1a1a1a"
        hr_color = accent if accent else "#cccccc"
        section_html = ""
        for line in parsed["lines"]:
            t = _escape(line["text"])
            if line["type"] == "header":
                section_html += (
                    f'<div class="section-header" style="font-size:11px;font-weight:bold;'
                    f'text-transform:uppercase;letter-spacing:0.12em;color:{header_color};'
                    f'margin-top:20px;margin-bottom:8px">{t}</div>'
                    f'<hr style="border:none;border-top:0.5px solid {header_color};margin:0 0 6px"/>\n'
                )
            elif line["type"] == "bullet":
                section_html += f'<div style="padding-left:16px;font-size:10px;color:#222;margin:4px 0;line-height:1.6">• {t}</div>\n'
            else:
                section_html += f'<div style="font-size:10px;color:#222;margin:2px 0;line-height:1.6">{t}</div>\n'

        return f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Georgia, serif; background: white; width: 794px; min-height: 1123px; padding: 48px; color: #1a1a1a; }}
  @page {{ size: A4; margin: 0; }}
</style></head><body>
<div style="text-align:center;margin-bottom:16px">
  <div class="cv-name" style="font-size:26px;font-weight:bold;color:{header_color}">{name}</div>
  {title_html}
</div>
<hr style="border:none;border-top:1.5px solid {hr_color};margin-bottom:16px"/>
{section_html}
</body></html>'''

    elif layout == "modern":
        accent_col = accent if accent else "#333333"
        section_html = ""
        for line in parsed["lines"]:
            t = _escape(line["text"])
            if line["type"] == "header":
                section_html += (
                    f'<div class="section-header" style="font-size:11px;font-weight:bold;'
                    f'text-transform:uppercase;letter-spacing:0.12em;color:{accent_col};'
                    f'border-bottom:0.5px solid {accent_col};padding-bottom:4px;'
                    f'margin-top:20px;margin-bottom:8px">{t}</div>\n'
                )
            elif line["type"] == "bullet":
                section_html += f'<div style="padding-left:12px;font-size:10px;color:#333;margin:4px 0;line-height:1.6">• {t}</div>\n'
            else:
                section_html += f'<div style="font-size:10px;color:#333;margin:2px 0;line-height:1.6">{t}</div>\n'

        return f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: white; width: 794px; min-height: 1123px; padding: 48px; color: #111; }}
  @page {{ size: A4; margin: 0; }}
</style></head><body>
<div style="border-left:3px solid {accent_col};padding-left:12px;margin-bottom:16px">
  <div class="cv-name" style="font-size:26px;font-weight:bold;color:#111">{name}</div>
  {title_html}
</div>
{section_html}
</body></html>'''

    else:  # split
        accent_col = accent if accent else "#333333"
        bg_left = _accent_bg(accent) if accent else "#f7f7f7"

        sections = group_sections(parsed)
        left_sections = [
            s for s in sections
            if any(k in (s["header"] or "").upper() for k in _LEFT_KEYWORDS)
        ]
        left_set = set(id(s) for s in left_sections)
        right_sections = sorted(
            [s for s in sections if id(s) not in left_set],
            key=lambda s: _section_right_order(s["header"]),
        )

        def render_section(s: dict) -> str:
            h = _escape(s["header"]) if s["header"] else ""
            html = ""
            if h:
                html += (
                    f'<div class="section-header" style="font-size:11px;font-weight:bold;'
                    f'text-transform:uppercase;letter-spacing:0.12em;color:{accent_col};'
                    f'border-bottom:0.5px solid {accent_col};padding-bottom:2px;'
                    f'margin-top:20px;margin-bottom:8px">{h}</div>\n'
                )
            for line in s["lines"]:
                t = _escape(line["text"])
                if line["type"] == "bullet":
                    html += f'<div style="font-size:10px;color:#333;padding-left:10px;margin:4px 0;line-height:1.6">• {t}</div>\n'
                else:
                    html += f'<div style="font-size:10px;color:#333;margin:2px 0;line-height:1.6">{t}</div>\n'
            return html

        title_left = f'<div style="font-size:10.5px;font-weight:bold;color:#555;margin-bottom:12px">{title}</div>' if title else ""
        left_html = (
            f'<div class="cv-name" style="font-size:26px;font-weight:bold;color:#111;margin-bottom:4px">{name}</div>\n'
            f'{title_left}'
            + "".join(render_section(s) for s in left_sections)
        )
        right_html = "".join(render_section(s) for s in right_sections)

        return f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: white; width: 794px; min-height: 1123px; display: flex; }}
  @page {{ size: A4; margin: 0; }}
</style></head><body>
<div style="width:30%;background:{bg_left};padding:16px;min-height:1123px">{left_html}</div>
<div style="width:70%;padding:16px;min-height:1123px">{right_html}</div>
</body></html>'''
