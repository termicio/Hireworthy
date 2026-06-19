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

TAILOR_PROMPT = """You are an expert CV writer. Your task is to rewrite the provided CV so it better matches the job description.

CV:
__CV__

Job Description:
__JD__

Missing Keywords to incorporate:
__MISSING_KEYWORDS__

Suggested improvements:
__SUGGESTIONS__

Rules:
- Naturally weave the missing keywords into existing bullet points where they genuinely fit
- NEVER invent false experience, dates, companies, or skills the candidate does not have
- Preserve the overall structure and sections of the original CV
- Only expand or rephrase existing content — do not add new roles or qualifications
- Return ONLY the full rewritten CV text with no preamble, no explanation, no markdown fences"""


REVIEW_PROMPT = """You are a ruthlessly honest, senior technical recruiter with 15+ years of experience. Your job is to give a frank, critical audit of a CV — no encouragement, no softening, no empty praise. If something is weak, say so clearly.

CV to review:
__CV__

Evaluate the CV across exactly these 5 sections (use these exact names): "Contact Info", "Summary/Objective", "Experience", "Skills", "Education". For each section give a score 0-100 and a one-sentence comment explaining the score.

Identify exactly 3 of the weakest bullet points in the CV. For each provide:
- "original": the exact quote from the CV
- "reason": why this bullet is weak (vague, no metrics, passive voice, generic, etc.)
- "rewritten": a stronger version — do NOT invent facts, dates, or numbers not present in the original

Identify any red flags (gaps in employment dates, no quantifiable results anywhere, typos, generic filler phrases, missing contact info, etc.). This list can be empty if there are genuinely no red flags.

Identify exactly 3 quick wins — the 3 highest-impact improvements the candidate could make today, ordered from most impactful to least.

Respond ONLY with a valid JSON object — no preamble, no markdown, no backticks. Use this exact structure:
{
  "overall_score": <integer 0-100>,
  "sections": [
    {"name": "Contact Info", "score": <integer 0-100>, "comment": "<one sentence>"},
    {"name": "Summary/Objective", "score": <integer 0-100>, "comment": "<one sentence>"},
    {"name": "Experience", "score": <integer 0-100>, "comment": "<one sentence>"},
    {"name": "Skills", "score": <integer 0-100>, "comment": "<one sentence>"},
    {"name": "Education", "score": <integer 0-100>, "comment": "<one sentence>"}
  ],
  "weak_bullets": [
    {"original": "<exact quote>", "reason": "<why it is weak>", "rewritten": "<stronger version>"},
    {"original": "<exact quote>", "reason": "<why it is weak>", "rewritten": "<stronger version>"},
    {"original": "<exact quote>", "reason": "<why it is weak>", "rewritten": "<stronger version>"}
  ],
  "red_flags": ["<specific problem>"],
  "quick_wins": ["<most impactful fix>", "<second fix>", "<third fix>"]
}"""


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
