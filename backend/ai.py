import os
from dotenv import load_dotenv
load_dotenv()

import anthropic
import json
from models import AnalyseResponse, ReviewResponse

client = anthropic.AsyncAnthropic()

ANALYSIS_PROMPT = """You are an expert technical recruiter with 10+ years of experience reviewing CVs.

Analyse the fit between the CV and job description below.

CV:
__CV__

Job Description:
__JD__

Respond ONLY with a valid JSON object — no preamble, no markdown, no backticks. Use this exact structure:
{
  "match_score": <integer 0-100>,
  "matched_keywords": [<skills/keywords present in both CV and JD>],
  "missing_keywords": [<important skills/keywords in JD but absent from CV>],
  "suggestions": [
    "<specific, actionable CV improvement 1>",
    "<specific, actionable CV improvement 2>",
    "<specific, actionable CV improvement 3>"
  ],
  "summary": "<2-sentence plain English summary of the match>"
}

Scoring guide:
- 80-100: Strong match, most key requirements met
- 60-79: Good match, a few gaps
- 40-59: Partial match, notable gaps
- 0-39: Weak match, significant skills missing

Be specific in suggestions — reference actual content from the CV and JD, not generic advice."""

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
- Naturally incorporate these missing keywords from the job description: __MISSING_KEYWORDS__
  Only add them where they genuinely fit existing experience — never fabricate
- Address these recruiter suggestions: __SUGGESTIONS__
- Mirror the language and terminology used in the job description where appropriate

Original CV:
__CV__

Job Description:
__JD__

STRICT RULES:
- Never invent experience, companies, dates, or qualifications not in the original
- Only rewrite and restructure existing content
- Keep all contact information exactly as-is
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
   non-standard date formats, and missing keywords from the job description.

2. Human recruiters spend 6-10 seconds on a first pass. Clarity, specificity,
   and strong action verbs matter enormously.

Your job is to give brutally honest feedback that addresses BOTH — but never use
the word "ATS" or technical jargon in your output. Translate every technical issue
into plain human advice about "reaching more recruiters" or "making it easier to find".

CV to review:
__CV__

---

Evaluate across exactly these 5 sections (use these exact names):
"Contact Info", "Summary/Objective", "Experience", "Skills", "Education"

For each section score 0-100 and give ONE sentence explaining the score.
When scoring, penalize:
- Missing or hard-to-find contact info
- Vague bullet points without numbers or outcomes
- Skills listed without context (just a word dump)
- Non-standard section names that systems might miss
- Dates in inconsistent or ambiguous formats

Identify exactly 3 of the weakest bullet points. For each:
- "original": exact quote from the CV
- "reason": why it is weak (too vague, no metric, passive voice, generic)
- "rewritten": stronger version — do NOT invent facts not in the original

Identify red flags. Check for:
- Multi-column or table layout (translate as: "Your CV layout may not display correctly for all employers — a single-column format reaches more recruiters")
- No quantified achievements anywhere
- Gaps in employment dates
- Generic filler phrases ("passionate about", "team player", "hard worker")
- Missing LinkedIn or GitHub when relevant for the role
- Section headers that are creative but non-standard (e.g. "My Journey" instead of "Experience")
- Dates written as text instead of numbers ("two years" vs "2022-2024")
- CV longer than 2 pages for under 5 years experience
- Photo or personal info (age, marital status) that varies by country norms

Identify exactly 3 quick wins — highest-impact fixes ordered by impact.
Frame each as a specific action: "Add X to Y section" not "improve your skills section".

Respond ONLY with valid JSON — no preamble, no markdown, no backticks:
{
  "overall_score": <integer 0-100>,
  "sections": [
    {"name": "Contact Info", "score": <integer>, "comment": "<one sentence>"},
    {"name": "Summary/Objective", "score": <integer>, "comment": "<one sentence>"},
    {"name": "Experience", "score": <integer>, "comment": "<one sentence>"},
    {"name": "Skills", "score": <integer>, "comment": "<one sentence>"},
    {"name": "Education", "score": <integer>, "comment": "<one sentence>"}
  ],
  "weak_bullets": [
    {"original": "<exact quote>", "reason": "<why weak>", "rewritten": "<stronger version>"},
    {"original": "<exact quote>", "reason": "<why weak>", "rewritten": "<stronger version>"},
    {"original": "<exact quote>", "reason": "<why weak>", "rewritten": "<stronger version>"}
  ],
  "red_flags": ["<plain human advice, no ATS jargon>"],
  "quick_wins": ["<specific action 1>", "<specific action 2>", "<specific action 3>"]
}

Scoring guide:
- 80-100: Strong CV, minor improvements only
- 60-79: Good foundation, clear gaps to fix
- 40-59: Significant issues affecting both readability and discoverability
- 0-39: Needs substantial rework before sending to employers"""


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
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = _strip_fences(response.content[0].text)
    data = json.loads(raw)
    return AnalyseResponse(**data)


async def review_cv(cv: str) -> ReviewResponse:
    prompt = REVIEW_PROMPT.replace("__CV__", cv)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = _strip_fences(response.content[0].text)
    data = json.loads(raw)
    return ReviewResponse(**data)


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
