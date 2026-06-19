import os
from dotenv import load_dotenv
load_dotenv()

import anthropic
import json
from models import AnalyseResponse

client = anthropic.Anthropic()

ANALYSIS_PROMPT = """You are an expert technical recruiter with 10+ years of experience reviewing CVs.

Analyse the fit between the CV and job description below.

CV:
{cv}

Job Description:
{job_description}

Respond ONLY with a valid JSON object — no preamble, no markdown, no backticks. Use this exact structure:
{{
  "match_score": <integer 0-100>,
  "matched_keywords": [<skills/keywords present in both CV and JD>],
  "missing_keywords": [<important skills/keywords in JD but absent from CV>],
  "suggestions": [
    "<specific, actionable CV improvement 1>",
    "<specific, actionable CV improvement 2>",
    "<specific, actionable CV improvement 3>"
  ],
  "summary": "<2-sentence plain English summary of the match>"
}}

Scoring guide:
- 80-100: Strong match, most key requirements met
- 60-79: Good match, a few gaps
- 40-59: Partial match, notable gaps
- 0-39: Weak match, significant skills missing

Be specific in suggestions — reference actual content from the CV and JD, not generic advice."""


async def analyse_cv(cv: str, job_description: str) -> AnalyseResponse:
    prompt = ANALYSIS_PROMPT.format(cv=cv, job_description=job_description)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()

    # Strip accidental markdown fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    data = json.loads(raw)
    return AnalyseResponse(**data)
