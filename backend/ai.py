import os
from dotenv import load_dotenv
load_dotenv()

import anthropic
import json
from models import AnalyseResponse

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
