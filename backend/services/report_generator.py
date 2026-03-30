"""
Report Generator — compiles phase scores into a narrative report.
"""
import os
import json
from pathlib import Path
from openai import OpenAI

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def generate_report_narrative(
    student_name: str,
    phase2: dict,
    phase3: dict,
    phase4: dict,
    phase5: dict,
    overall: float,
) -> dict:
    template = (PROMPTS_DIR / "report_summary.txt").read_text()

    prompt = (template
        .replace("{student_name}", student_name)
        .replace("{p2_depth}", str(phase2.get("depth_level", 0)))
        .replace("{p2_hints}", str(phase2.get("hint_responsiveness", 0)))
        .replace("{p2_notes}", phase2.get("notes", ""))
        .replace("{p3_depth}", str(phase3.get("depth_level", 0)))
        .replace("{p3_hints}", str(phase3.get("hint_responsiveness", 0)))
        .replace("{p3_notes}", phase3.get("notes", ""))
        .replace("{p4_correct}", str(phase4.get("correct_count", 0)))
        .replace("{p4_total}", str(phase4.get("total_questions", 5)))
        .replace("{p5_visionary}", str(phase5.get("visionary", 0)))
        .replace("{p5_grounded}", str(phase5.get("grounded", 0)))
        .replace("{p5_teamplayer}", str(phase5.get("team_player", 0)))
        .replace("{p5_notes}", phase5.get("notes", ""))
        .replace("{overall}", str(overall))
    )

    response = client.responses.create(
        model="gpt-5.4",
        reasoning={"effort": "low"},
        input=[{"role": "user", "content": prompt}],
    )
    raw = response.output_text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
