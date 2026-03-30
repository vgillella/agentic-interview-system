"""
Evaluation engine — scores each phase using GPT-5.4.
"""
import os
import json
from pathlib import Path
from openai import AsyncOpenAI

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])


async def _call_gpt(prompt: str) -> dict:
    response = await client.responses.create(
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


def _extract_phase_messages(conversation: list[dict], role: str) -> list[str]:
    return [m["content"] for m in conversation if m["role"] == role]


async def evaluate_phase2(conversation: list[dict], phase_number: int = 2) -> dict:
    template = (PROMPTS_DIR / "eval_phase2.txt").read_text()
    conv_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in conversation])
    prompt = template.replace("{phase_number}", str(phase_number)).replace("{conversation}", conv_text)
    return await _call_gpt(prompt)


async def evaluate_phase3(conversation: list[dict]) -> dict:
    return await evaluate_phase2(conversation, phase_number=3)


async def evaluate_phase4(conversation: list[dict], phase4_questions: list[dict]) -> dict:
    template = (PROMPTS_DIR / "eval_phase4.txt").read_text()

    qa_text = "\n".join([
        f"{i+1}. Q: {q['question']}\n   A: {q['answer']}"
        for i, q in enumerate(phase4_questions)
    ])

    # Extract only candidate responses (user messages in phase 4)
    candidate_msgs = _extract_phase_messages(conversation, "user")
    responses_text = "\n".join([f"{i+1}. {r}" for i, r in enumerate(candidate_msgs)])

    prompt = (template
              .replace("{questions_and_answers}", qa_text)
              .replace("{candidate_responses}", responses_text))
    return await _call_gpt(prompt)


async def evaluate_phase5(conversation: list[dict]) -> dict:
    template = (PROMPTS_DIR / "eval_phase5.txt").read_text()
    conv_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in conversation])
    return await _call_gpt(template.replace("{conversation}", conv_text))


def compute_overall_score(
    phase2: dict,
    phase3: dict,
    phase4: dict,
    phase5: dict,
) -> float:
    """
    Weighted overall score (0–100):
      Phase 2: 30%  (depth_level/10 * 100)
      Phase 3: 20%  (depth_level/10 * 100)
      Phase 4: 25%  (correct_count/total * 100)
      Phase 5: 25%  (avg of visionary, grounded, team_player / 10 * 100)
    """
    p2 = (phase2.get("depth_level", 0) / 10) * 100
    p3 = (phase3.get("depth_level", 0) / 10) * 100

    total_q = phase4.get("total_questions", 5) or 5
    correct = phase4.get("correct_count", 0) + 0.5 * phase4.get("partial_count", 0)
    p4 = (correct / total_q) * 100

    p5_avg = (
        phase5.get("visionary", 0) +
        phase5.get("grounded", 0) +
        phase5.get("team_player", 0)
    ) / 3
    p5 = (p5_avg / 10) * 100

    return round(0.30 * p2 + 0.20 * p3 + 0.25 * p4 + 0.25 * p5, 2)
