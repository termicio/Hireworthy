import re
from typing import Optional


def _escape(text: str) -> str:
    """Escape HTML special characters. & must be first to avoid double-escaping."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def parse_cv(cv_text: str) -> dict:
    """
    Returns: { name, title, lines: [{type, text}] }
    - name: first non-empty line
    - title: second non-empty line
    - lines: remaining, classified as header/bullet/body
    """
    lines = [l.strip() for l in cv_text.split("\n")]
    lines = [l for l in lines if l]  # remove empty

    if not lines:
        return {"name": "", "title": "", "lines": []}

    name = lines[0] if len(lines) > 0 else ""
    title = lines[1] if len(lines) > 1 else ""

    result_lines = []
    i = 2
    while i < len(lines):
        line = lines[i]
        # Check if next line is a markdown underline (---)
        stripped_next = lines[i + 1].replace(" ", "") if i + 1 < len(lines) else ""
        next_is_underline = bool(stripped_next) and all(c in "-=" for c in stripped_next)
        # ALL CAPS detection: has letters, all letters are uppercase, under 60 chars
        has_letters = any(c.isalpha() for c in line)
        all_caps = has_letters and line == line.upper() and len(line) < 60

        if all_caps or next_is_underline:
            result_lines.append({"type": "header", "text": line})
            if next_is_underline:
                i += 2  # skip the underline
            else:
                i += 1
        elif line.startswith(("•", "-", "*")):
            text = re.sub(r"^[•\-*]\s*", "", line, count=1)
            result_lines.append({"type": "bullet", "text": text})
            i += 1
        else:
            result_lines.append({"type": "body", "text": line})
            i += 1

    return {"name": name, "title": title, "lines": result_lines}


def group_sections(parsed: dict) -> list:
    """
    Group lines into sections. Each section: { header: str|None, lines: [{type,text}] }
    Lines before first header form an 'intro' section (header=None).
    """
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


def _render_lines(lines: list, body_style: str, bullet_indent: str = "16px") -> str:
    """Render a list of {type, text} lines as HTML."""
    html = ""
    for line in lines:
        t = _escape(line["text"])
        if line["type"] == "bullet":
            html += f'<div style="padding-left:{bullet_indent};margin:2px 0;font-size:inherit">• {t}</div>\n'
        else:
            html += f'<div style="{body_style};margin:2px 0">{t}</div>\n'
    return html


def build_html(cv_text: str, layout: str, color: Optional[str]) -> str:
    parsed = parse_cv(cv_text)
    name = _escape(parsed["name"])
    title = _escape(parsed["title"])
    accent = color or ""

    if layout == "classic":
        header_color = accent if accent else "#1a1a1a"
        hr_color = accent if accent else "#cccccc"
        section_html = ""
        for line in parsed["lines"]:
            t = _escape(line["text"])
            if line["type"] == "header":
                section_html += f'''<div style="font-size:11px;font-weight:bold;text-transform:uppercase;
                    letter-spacing:1px;color:{header_color};margin-top:18px;margin-bottom:2px">{t}</div>
                    <hr style="border:none;border-top:1px solid {hr_color};margin:2px 0 6px"/>\n'''
            elif line["type"] == "bullet":
                section_html += f'<div style="padding-left:16px;font-size:11px;color:#222;margin:2px 0">• {t}</div>\n'
            else:
                section_html += f'<div style="font-size:11px;color:#222;margin:2px 0">{t}</div>\n'

        return f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Georgia, serif; background: white; width: 794px; min-height: 1123px; padding: 48px; color: #1a1a1a; }}
  @page {{ size: A4; margin: 0; }}
</style></head><body>
<div style="text-align:center;margin-bottom:16px">
  <div style="font-size:28px;font-weight:bold;color:{header_color}">{name}</div>
  <div style="font-size:12px;color:#444;margin-top:4px">{title}</div>
</div>
<hr style="border:none;border-top:1px solid {hr_color};margin-bottom:16px"/>
{section_html}
</body></html>'''

    elif layout == "modern":
        accent_col = accent if accent else "#333333"
        section_html = ""
        for line in parsed["lines"]:
            t = _escape(line["text"])
            if line["type"] == "header":
                section_html += f'''<div style="font-size:10px;font-weight:bold;text-transform:uppercase;
                    color:{accent_col};border-bottom:2px solid {accent_col};padding-bottom:4px;
                    margin-top:20px;margin-bottom:6px">{t}</div>\n'''
            elif line["type"] == "bullet":
                section_html += f'<div style="padding-left:12px;font-size:10px;color:#333;margin:2px 0">• {t}</div>\n'
            else:
                section_html += f'<div style="font-size:10px;color:#333;margin:2px 0">{t}</div>\n'

        return f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: white; width: 794px; min-height: 1123px; padding: 48px; color: #111; }}
  @page {{ size: A4; margin: 0; }}
</style></head><body>
<div style="border-left:3px solid {accent_col};padding-left:12px;margin-bottom:12px">
  <div style="font-size:32px;font-weight:bold;color:#111">{name}</div>
  <div style="font-size:10px;color:#666;margin-top:4px">{title}</div>
</div>
{section_html}
</body></html>'''

    else:  # split
        accent_col = accent if accent else "#333333"
        # Fallback bg for split left column
        bg_left_safe = "#f0f0f0"  # weasyprint may not support color-mix

        sections = group_sections(parsed)
        left_sections = []
        right_sections = []
        for s in sections:
            if s["header"] and "SKILL" in s["header"].upper():
                left_sections.append(s)
            else:
                right_sections.append(s)

        def render_section(s: dict) -> str:
            h = _escape(s["header"]) if s["header"] else ""
            html = ""
            if h:
                html += f'<div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:{accent_col};letter-spacing:1px;margin-top:14px;margin-bottom:4px">{h}</div>\n'
            for line in s["lines"]:
                t = _escape(line["text"])
                if line["type"] == "bullet":
                    html += f'<div style="font-size:9px;color:#333;padding-left:10px;margin:2px 0">• {t}</div>\n'
                else:
                    html += f'<div style="font-size:9px;color:#333;margin:2px 0">{t}</div>\n'
            return html

        left_html = f'''<div style="font-size:16px;font-weight:bold;color:#111;margin-bottom:4px">{name}</div>
<div style="font-size:9px;color:#555;margin-bottom:12px">{title}</div>\n'''
        left_html += "".join(render_section(s) for s in left_sections)

        right_html = "".join(render_section(s) for s in right_sections)

        return f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: Arial, Helvetica, sans-serif; background: white; width: 794px; min-height: 1123px; display: flex; }}
  @page {{ size: A4; margin: 0; }}
</style></head><body>
<div style="width:32%;background:{bg_left_safe};padding:24px;min-height:1123px">{left_html}</div>
<div style="width:68%;padding:24px;min-height:1123px">{right_html}</div>
</body></html>'''
