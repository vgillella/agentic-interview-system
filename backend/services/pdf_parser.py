"""
Parse a resume PDF using the OpenAI Files API (vision-capable).
Returns a dict of section_name -> content.
"""
import os
import json
import base64
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

PARSE_PROMPT = """You are a resume parser. Extract ALL content from this resume PDF and return it as a JSON object with these exact keys:
{
  "name": "Full name of the candidate",
  "contact": "Email, phone, LinkedIn, GitHub etc.",
  "summary": "Professional summary or objective (empty string if absent)",
  "education": "All education entries with institution, degree, dates, GPA",
  "experience": "All work experience / internships with company, role, dates, bullet points",
  "projects": "All projects with title, tech stack, description, bullet points",
  "skills": "All technical skills, tools, languages, frameworks",
  "awards": "Certifications, honors, publications (empty string if absent)",
  "raw_text": "Full resume text as a single string"
}

Return ONLY valid JSON, no markdown fences, no explanation."""


async def parse_resume_pdf(file_bytes: bytes, filename: str) -> dict:
    """Upload PDF to OpenAI and extract structured sections."""
    # Encode as base64 data URL for the vision model
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    data_url = f"data:application/pdf;base64,{b64}"

    response = await client.responses.create(
        model="gpt-5.4",
        input=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": filename,
                        "file_data": data_url,
                    },
                    {
                        "type": "input_text",
                        "text": PARSE_PROMPT,
                    },
                ],
            }
        ],
    )

    raw = response.output_text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
