import json
from fastapi import APIRouter, HTTPException
from db.client import get_supabase
from services.evaluator import (
    evaluate_phase2, evaluate_phase3, evaluate_phase4, evaluate_phase5, compute_overall_score
)
from services.report_generator import generate_report_narrative

router = APIRouter()


@router.post("/report/{session_id}")
async def generate_report(session_id: str):
    """
    Evaluate all phases and persist the final report.
    Returns the complete report JSON.
    """
    db = get_supabase()

    session = db.table("interview_sessions").select("*").eq("id", session_id).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    data = session.data
    full_history = json.loads(data.get("conversation_history") or "[]")
    student_name = data.get("student_name", "Candidate")
    phase_scores_stored = json.loads(data.get("phase_scores") or "{}")

    # Split conversation history into phases by approximate message counts
    # Phase boundaries are detected by the phase transitions stored in history
    # We pass the full conversation to each evaluator; GPT uses context clues
    phase4_questions = phase_scores_stored.get("phase4_questions", [])

    # Run all evaluations
    p2 = await evaluate_phase2(full_history)
    p3 = await evaluate_phase3(full_history)
    p4 = await evaluate_phase4(full_history, phase4_questions) if phase4_questions else {
        "correct_count": 0, "partial_count": 0, "total_questions": 5
    }
    p5 = await evaluate_phase5(full_history)

    overall = compute_overall_score(p2, p3, p4, p5)

    narrative = await generate_report_narrative(student_name, p2, p3, p4, p5, overall)

    # Check if report already exists
    existing = db.table("interview_reports").select("id").eq("session_id", session_id).execute()

    report_data = {
        "session_id": session_id,
        "phase1_notes": "Background phase — no formal score.",
        "phase2_score": json.dumps(p2),
        "phase3_score": json.dumps(p3),
        "phase4_score": json.dumps(p4),
        "phase5_score": json.dumps(p5),
        "overall_score": overall,
        "report_json": json.dumps(narrative),
    }

    if existing.data:
        db.table("interview_reports").update(report_data).eq("session_id", session_id).execute()
    else:
        db.table("interview_reports").insert(report_data).execute()

    return {
        "session_id": session_id,
        "student_name": student_name,
        "overall_score": overall,
        "phase2_score": p2,
        "phase3_score": p3,
        "phase4_score": p4,
        "phase5_score": p5,
        "report_json": narrative,
    }


@router.get("/report/{session_id}")
async def get_report(session_id: str):
    """Retrieve a previously generated report."""
    db = get_supabase()
    result = db.table("interview_reports").select("*").eq("session_id", session_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found. Generate it first.")

    row = result.data
    return {
        "session_id": session_id,
        "overall_score": row["overall_score"],
        "phase2_score": json.loads(row["phase2_score"]) if isinstance(row["phase2_score"], str) else row["phase2_score"],
        "phase3_score": json.loads(row["phase3_score"]) if isinstance(row["phase3_score"], str) else row["phase3_score"],
        "phase4_score": json.loads(row["phase4_score"]) if isinstance(row["phase4_score"], str) else row["phase4_score"],
        "phase5_score": json.loads(row["phase5_score"]) if isinstance(row["phase5_score"], str) else row["phase5_score"],
        "report_json": json.loads(row["report_json"]) if isinstance(row["report_json"], str) else row["report_json"],
    }
