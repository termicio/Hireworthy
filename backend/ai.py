import os
from dotenv import load_dotenv
load_dotenv()

import anthropic
import json
from models import AnalyseResponse, CVHealthResponse, MatchCategory, HealthCategory

client = anthropic.AsyncAnthropic()

HEALTH_CATEGORIES = {
    "clarity":          {"label": "Clarity",          "weight": 0.25},
    "completeness":     {"label": "Completeness",     "weight": 0.25},
    "impact_language":  {"label": "Impact Language",  "weight": 0.30},
    "ats_friendliness": {"label": "ATS Friendliness", "weight": 0.20},
}

MATCH_CATEGORIES = {
    "skills_match":         {"label": "Skills Match",         "weight": 0.35},
    "experience_relevance": {"label": "Experience Relevance", "weight": 0.30},
    "seniority_fit":        {"label": "Seniority Fit",        "weight": 0.20},
    "education_fit":        {"label": "Education Fit",        "weight": 0.15},
}

ANALYSIS_PROMPT = """You are an expert technical recruiter with 10+ years of experience reviewing CVs.

Analyse the fit between the CV and job description below.

CV:
__CV__

Job Description:
__JD__

Evaluate the fit across exactly these 4 categories (use these exact name values):
- "skills_match": Do the candidate's technical skills, tools, and technologies match what the job requires?
- "experience_relevance": Is the candidate's work experience relevant to this role and industry?
- "seniority_fit": Does the candidate's level of experience match the seniority the job requires?
- "education_fit": Does the candidate's education background match job requirements or preferences?

For each category provide:
- "score": integer 0-100
- "evidence": one sentence citing specific CV content vs JD requirements
- "missing_keywords": list of keywords/skills from THIS category that are missing from the CV (may be empty)

Also provide:
- "matched_keywords": skills/keywords present in both CV and JD
- "missing_keywords" (top-level): all important keywords from JD absent from CV (union of per-category)
- "suggestions": exactly 3 specific, actionable CV improvements referencing actual CV/JD content
- "explanation": 2-3 sentence plain English summary of the overall fit

Scoring guide:
- 80-100: Strong match, requirement clearly met
- 60-79: Good match, minor gaps
- 40-59: Partial match, notable gaps
- 0-39: Weak match, significant gaps

Respond ONLY with valid JSON — no preamble, no markdown, no backticks. Use exactly these 4 category names, in this order:
{
  "categories": [
    {"name": "skills_match", "score": <int>, "evidence": "<one sentence>", "missing_keywords": [...]},
    {"name": "experience_relevance", "score": <int>, "evidence": "<one sentence>", "missing_keywords": []},
    {"name": "seniority_fit", "score": <int>, "evidence": "<one sentence>", "missing_keywords": []},
    {"name": "education_fit", "score": <int>, "evidence": "<one sentence>", "missing_keywords": []}
  ],
  "matched_keywords": [...],
  "missing_keywords": [...],
  "suggestions": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "explanation": "<2-3 sentence summary>"
}"""

TAILOR_PROMPT = """You are an expert CV writer who knows exactly how both
humans and automated hiring systems evaluate CVs.

Your task is to rewrite this CV to fix THREE categories of problems:

CATEGORY 1 — ATS compatibility (automated systems):
- Convert any multi-column or table layout to clean single-column format
- Standardise section headers to: CONTACT, SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS
- Convert dates to consistent format: "Jan 2022 – Mar 2024" or "2022 – 2024"
- Remove any decorative elements described in text (icons, borders, columns)
- Ensure all content is in the main text body, not in headers/footers/sidebars

CATEGORY 2 — Human readability:
- Rewrite vague bullet points to start with strong action verbs
- Add metrics and outcomes wherever the original implies them without stating them
  DO NOT invent specific numbers that aren't implied — use ranges or qualitative improvements
- Remove filler phrases: "passionate about", "team player", "hard worker", "results-driven"
- Ensure every bullet answers: what did you DO, and what was the RESULT

CATEGORY 3 — Job match (keyword alignment):
- Scan the original CV for existing experience, tools, or projects that RELATE to these missing keywords: __MISSING_KEYWORDS__
  If a keyword genuinely maps to something already written in the original CV, use that terminology when rewriting that section.
  If there is NO existing content that relates to a keyword — skip it entirely.
- Address these recruiter suggestions ONLY by improving how existing experience is described — never by adding new experience: __SUGGESTIONS__
- Mirror the language and terminology of the job description, but only within sections and content that already exist in the original CV.

WHAT "NEVER FABRICATE" MEANS — CONCRETE RULES:
- Do NOT add new projects that are not in the original CV
- Do NOT add new companies or roles that are not in the original CV
- Do NOT add skills or tools to the SKILLS section that are not in the original CV
- Do NOT write phrases like "hands-on exploration of X", "actively developing knowledge of X", or "introductory experience with X" for any technology not mentioned in the original CV
- If the original CV has 2 projects — the tailored CV must have exactly 2 projects
- If the original CV has no AWS — the tailored CV must have no AWS
- A keyword from MISSING_KEYWORDS that has no anchor in the original CV must not appear anywhere in the tailored CV

Original CV:
__CV__

Job Description:
__JD__

ENTRY FORMATTING (experience & education):
- Start every job or education entry with a header line containing ONLY the organisation
  and the role/degree, in this exact shape:
    Company — Job Title
  Use an em dash " — " between the company (or school) and the role. If there is no
  company (e.g. a personal project), omit the " — Company" part and keep just the title.
- Put the employment (or study) dates ALONE on the very next line, with nothing else on it:
    Mon YYYY – Mon YYYY
  Use an en dash " – " inside the range, and "Present" for ongoing roles
  (e.g. "Jan 2023 – Present"). Abbreviate months to three letters (Jan, Feb, Mar, ...).
  If no date is known, omit this line entirely.
- Put achievements on the following lines as bullet points starting with "• ".
- Keep SECTION titles in ALL CAPS on their own line (EXPERIENCE, EDUCATION, SKILLS, ...).
- Do NOT use markdown (no **, no #, no backticks). Output plain text only.

STRICT RULES:
- Never invent experience, companies, dates, qualifications, or technologies not present in the original CV
- Only rewrite and restructure existing content — never add new content
- Keep all contact information exactly as-is
- The tailored CV must contain the same number of jobs and projects as the original
- Before returning, mentally check: does every item in PROJECTS and EXPERIENCE exist in the original CV? If not, remove it.
- Return ONLY the full rewritten CV text — no explanations, no preamble, no markdown fences
- Write in the same language as the original CV"""

TAILOR_GENERAL_PROMPT = """You are an expert CV writer who knows exactly how both
humans and automated hiring systems evaluate CVs.

Your task is to rewrite this CV to fix TWO categories of problems:

CATEGORY 1 — ATS compatibility (automated systems):
- Convert any multi-column or table layout to clean single-column format
- Standardise section headers to: CONTACT, SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS
- Convert dates to consistent format: "Jan 2022 – Mar 2024" or "2022 – 2024"
- Remove any decorative elements described in text (icons, borders, columns)
- Ensure all content is in the main text body, not in headers/footers/sidebars

CATEGORY 2 — Human readability:
- Rewrite vague bullet points to start with strong action verbs
- Add metrics and outcomes wherever the original implies them without stating them
  (e.g. "helped improve performance" → "Reduced page load time by 40% through...")
  DO NOT invent specific numbers that aren't implied — use ranges or qualitative improvements
- Remove filler phrases: "passionate about", "team player", "hard worker", "results-driven"
- Ensure every bullet answers: what did you DO, and what was the RESULT

Original CV:
__CV__

ENTRY FORMATTING (experience & education):
- Start every job or education entry with a header line containing ONLY the organisation
  and the role/degree, in this exact shape:
    Company — Job Title
  Use an em dash " — " between the company (or school) and the role. If there is no
  company (e.g. a personal project), omit the " — Company" part and keep just the title.
- Put the employment (or study) dates ALONE on the very next line, with nothing else on it:
    Mon YYYY – Mon YYYY
  Use an en dash " – " inside the range, and "Present" for ongoing roles
  (e.g. "Jan 2023 – Present"). Abbreviate months to three letters (Jan, Feb, Mar, ...).
  If no date is known, omit this line entirely.
- Put achievements on the following lines as bullet points starting with "• ".
- Keep SECTION titles in ALL CAPS on their own line (EXPERIENCE, EDUCATION, SKILLS, ...).
- Do NOT use markdown (no **, no #, no backticks). Output plain text only.

STRICT RULES:
- Never invent experience, companies, dates, or qualifications not in the original
- Only rewrite and restructure existing content
- Keep all contact information exactly as-is
- Return ONLY the full rewritten CV text — no explanations, no preamble, no markdown fences
- Write in the same language as the original CV"""


REVIEW_PROMPT = """You are a ruthlessly honest senior recruiter with 15+ years of experience.
You review CVs knowing two things most candidates don't:

1. Most CVs are first screened by automated systems before a human ever sees them.
   These systems struggle with: tables, multiple columns, images, unusual section headers,
   non-standard date formats, and missing keywords.

2. Human recruiters spend 6-10 seconds on a first pass. Clarity, specificity,
   and strong action verbs matter enormously.

Give brutally honest feedback — never use technical jargon, translate every issue into
plain human advice about "reaching more recruiters" or "making it easier to find".

CV to review:
__CV__

---

Evaluate across exactly these 4 categories (use these exact name values):
- "clarity": Is the CV easy to read, well-structured, consistent formatting, clear dates?
- "completeness": Does the CV have all essential sections (contact, summary, experience, education, skills)? Links, GitHub, portfolio?
- "impact_language": Do bullets describe achievements and results, not just duties? Are there numbers and outcomes?
- "ats_friendliness": Is the CV in a clean single-column format that automated systems can parse? No tables, columns, images?

For each category provide:
- "score": integer 0-100
- "evidence": one sentence with a specific observation from the CV
- "tips": list of 1-3 concrete, specific fixes (empty list if no tips needed)

When scoring, penalize:
- clarity: inconsistent date formats, unclear section order, walls of text
- completeness: missing contact info, no summary, no links when relevant
- impact_language: bullets starting with "responsible for", no metrics, generic phrases like "team player"
- ats_friendliness: multi-column layout, tables, images, creative section headers, non-standard formatting

Also provide:
- "weak_bullets": exactly 3 of the weakest bullet points
  Each: "original" (exact quote), "reason" (why weak), "rewritten" (stronger version — no invented facts)
- "red_flags": list of issues (plain human advice, no technical jargon)
  Check for: layout issues, no quantified achievements, employment gaps, generic filler phrases,
  missing LinkedIn/GitHub, non-standard section headers, text dates ("two years"), CV > 2 pages for <5yr experience
- "quick_wins": exactly 3 highest-impact fixes, ordered by impact, as specific actions

Respond ONLY with valid JSON — no preamble, no markdown, no backticks. Use exactly these 4 category names, in this order:
{
  "categories": [
    {"name": "clarity", "score": <int>, "evidence": "<one sentence>", "tips": ["..."]},
    {"name": "completeness", "score": <int>, "evidence": "<one sentence>", "tips": ["..."]},
    {"name": "impact_language", "score": <int>, "evidence": "<one sentence>", "tips": ["..."]},
    {"name": "ats_friendliness", "score": <int>, "evidence": "<one sentence>", "tips": []}
  ],
  "weak_bullets": [
    {"original": "<exact quote>", "reason": "<why weak>", "rewritten": "<stronger version>"},
    {"original": "<exact quote>", "reason": "<why weak>", "rewritten": "<stronger version>"},
    {"original": "<exact quote>", "reason": "<why weak>", "rewritten": "<stronger version>"}
  ],
  "red_flags": ["<plain human advice>"],
  "quick_wins": ["<specific action 1>", "<specific action 2>", "<specific action 3>"]
}

Scoring guide:
- 80-100: Strong, minor improvements only
- 60-79: Good foundation, clear gaps
- 40-59: Significant issues
- 0-39: Needs substantial rework"""


def _enrich(categories: list[dict], weights: dict) -> tuple[list[dict], int]:
    enriched = []
    for c in categories:
        if c["name"] not in weights:
            raise ValueError(f"Unexpected category name from LLM: {c['name']!r}")
        meta = weights[c["name"]]
        clamped_score = min(100.0, max(0.0, float(c["score"])))
        enriched.append({**c, "score": clamped_score, "label": meta["label"], "weight": meta["weight"]})
    overall = min(100, max(0, round(sum(c["score"] * weights[c["name"]]["weight"] for c in enriched))))
    return enriched, overall


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if model wraps response in them."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # drop first line (``` or ```json) and last line (```)
        inner = lines[1:] if lines[-1].strip() == "```" else lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        text = "\n".join(inner).strip()
    return text


async def analyse_cv(cv: str, job_description: str) -> AnalyseResponse:
    prompt = (
        ANALYSIS_PROMPT
        .replace("__CV__", cv)
        .replace("__JD__", job_description)
    )
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = _strip_fences(response.content[0].text)
    try:
        data = json.loads(raw)
        categories, overall_score = _enrich(data["categories"], MATCH_CATEGORIES)
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        import logging
        logging.getLogger(__name__).error("analyse_cv parse error: %s\nRaw LLM output: %s", exc, raw)
        raise
    return AnalyseResponse(
        overall_score=overall_score,
        categories=categories,
        matched_keywords=data.get("matched_keywords", []),
        explanation=data["explanation"],
        missing_keywords=data.get("missing_keywords", []),
        suggestions=data.get("suggestions", []),
    )


async def review_cv(cv: str) -> CVHealthResponse:
    prompt = REVIEW_PROMPT.replace("__CV__", cv)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = _strip_fences(response.content[0].text)
    try:
        data = json.loads(raw)
        categories, overall_score = _enrich(data["categories"], HEALTH_CATEGORIES)
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        import logging
        logging.getLogger(__name__).error("review_cv parse error: %s\nRaw LLM output: %s", exc, raw)
        raise
    return CVHealthResponse(
        overall_score=overall_score,
        categories=categories,
        weak_bullets=data.get("weak_bullets", []),
        red_flags=data.get("red_flags", []),
        quick_wins=data.get("quick_wins", []),
    )


async def tailor_cv(
    cv: str,
    job_description: str,
    missing_keywords: list[str],
    suggestions: list[str],
) -> str:
    keywords_text = ", ".join(missing_keywords) if missing_keywords else "None"
    suggestions_text = "\n".join(f"- {s}" for s in suggestions) if suggestions else "None"

    prompt = (
        TAILOR_PROMPT
        .replace("__CV__", cv)
        .replace("__JD__", job_description)
        .replace("__MISSING_KEYWORDS__", keywords_text)
        .replace("__SUGGESTIONS__", suggestions_text)
    )

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text.strip()


async def tailor_cv_general(cv: str) -> str:
    prompt = TAILOR_GENERAL_PROMPT.replace("__CV__", cv)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


CV_CLEAN_PROMPT = """You are a CV text cleaner. You receive raw text extracted from a PDF.
Your ONLY job is to fix extraction artifacts — do not rewrite, improve, or summarise anything.

Fix ONLY these specific issues:

1. Merged or split words from line breaks:
   "Soft-\\nware Engineer" → "Software Engineer"
   "Pythonand SQL" → "Python and SQL"

2. Spaced-out characters in headers:
   "E D U C A T I O N" → "EDUCATION"
   "W O R K E X P E R I E N C E" → "WORK EXPERIENCE"

3. Bullet points split across lines — rejoin them into single lines:
   "Developed a machine learning\\nmodel for medical imaging"
   → "Developed a machine learning model for medical imaging"

4. PDF artifacts: random isolated characters, page numbers appearing mid-text,
   repeated headers/footers, watermarks

5. Contact info that got merged:
   "john@email.com790 690 377" → "john@email.com\\n790 690 377"

6. Section headers that lost their formatting and merged with content:
   "EDUCATIONLodz University" → "EDUCATION\\nLodz University"

RULES:
- Preserve ALL original content — every word, date, company name, skill
- Do not rewrite bullet points or improve language
- Do not add or remove any information
- Do not change the structure or order of sections
- Return ONLY the cleaned CV text, nothing else, no explanations

Raw CV text to clean:
__CV__"""


async def clean_cv_text_ai(raw_text: str) -> str:
    """
    Fast cleaning pass using claude-haiku-4-5 before main analysis.
    Fixes PDF extraction artifacts without modifying content.

    Why Haiku: cleaning is pattern-matching, not reasoning — cheapest model suffices.
    Why 50% safety check: prevents accidental summarisation (if model misbehaves,
      returning dramatically shorter text means content was lost — fall back to original).
    Why we clean pasted text too: users paste from Word/Google Docs which introduce
      their own artifacts (smart quotes, invisible chars, broken line breaks).
    """
    if len(raw_text.strip()) < 100:
        return raw_text

    prompt = CV_CLEAN_PROMPT.replace("__CV__", raw_text)

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )

    cleaned = response.content[0].text.strip()

    # If cleaned text is >50% shorter than original, something went wrong — return original
    if len(cleaned) < len(raw_text) * 0.5:
        return raw_text

    return cleaned
