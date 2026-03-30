"""
Interview Engine
Manages the 5-phase interview state machine and calls GPT-5.4 for each response.
"""
import os
import json
from pathlib import Path
from openai import OpenAI
from services.questions_bank import search_questions, detect_field

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def _read_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _system_prompt(phase: int, resume_sections: dict, phase4_questions: list | None = None) -> str:
    base = _read_prompt("system_base.txt")
    phase_prompt = _read_prompt(f"phase{phase}.txt")

    if phase == 4 and phase4_questions:
        phase_prompt = phase_prompt.replace(
            "{questions_json}",
            json.dumps([{"question": q["question"], "answer": q["answer"]} for q in phase4_questions], indent=2)
        )

    resume_ctx = "\n\n".join([
        f"[{k.upper()}]\n{v}"
        for k, v in resume_sections.items()
        if v and k != "raw_text"
    ])

    return f"{base}\n\n{phase_prompt}\n\nCANDIDATE RESUME:\n{resume_ctx}"


def generate_response(
    phase: int,
    conversation_history: list[dict],
    resume_sections: dict,
    phase4_questions: list | None = None,
) -> tuple[str, bool]:
    """
    Call GPT-5.4 and return (response_text, phase_complete).
    phase_complete is True when the model outputs <phase_complete>.
    """
    system = _system_prompt(phase, resume_sections, phase4_questions)

    messages = [{"role": "system", "content": system}] + conversation_history

    response = client.responses.create(
        model="gpt-5.4",
        reasoning={"effort": "low"},
        input=messages,
    )

    text = response.output_text.strip()
    phase_complete = "<phase_complete>" in text
    clean_text = text.replace("<phase_complete>", "").strip()
    return clean_text, phase_complete


def get_phase4_questions(resume_sections: dict) -> list[dict]:
    """Select 5 ML questions relevant to the candidate's field."""
    field = detect_field(resume_sections)
    return search_questions(field, top_k=5)
