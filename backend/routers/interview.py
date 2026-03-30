import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.client import get_supabase
from services.interview_engine import generate_response, get_phase4_questions

router = APIRouter()


class MessageRequest(BaseModel):
    session_id: str
    user_message: str


class StartRequest(BaseModel):
    session_id: str


@router.post("/interview/start")
async def start_interview(req: StartRequest):
    """Initialize phase 1 and get the first interviewer question."""
    db = get_supabase()
    session = db.table("interview_sessions").select("*").eq("id", req.session_id).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    resume_sections = _get_resume_sections(db, req.session_id)

    # Get opening question (empty conversation = interviewer speaks first)
    response_text, phase_complete = await generate_response(
        phase=1,
        conversation_history=[],
        resume_sections=resume_sections,
    )

    # Save opening message
    history = [{"role": "assistant", "content": response_text}]
    db.table("interview_sessions").update({
        "current_phase": 1,
        "conversation_history": json.dumps(history),
    }).eq("id", req.session_id).execute()

    return {
        "message": response_text,
        "phase": 1,
        "phase_complete": False,
    }


@router.post("/interview/message")
async def send_message(req: MessageRequest):
    """Process a candidate message and return the next interviewer response."""
    db = get_supabase()
    session = db.table("interview_sessions").select("*").eq("id", req.session_id).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    data = session.data
    current_phase = data.get("current_phase", 1)
    history = json.loads(data.get("conversation_history") or "[]")

    # Append user message
    history.append({"role": "user", "content": req.user_message})

    resume_sections = _get_resume_sections(db, req.session_id)

    # Fetch phase 4 questions if needed
    phase4_questions = None
    if current_phase == 4:
        phase_scores = json.loads(data.get("phase_scores") or "{}")
        phase4_questions = phase_scores.get("phase4_questions") or get_phase4_questions(resume_sections)
        if not phase_scores.get("phase4_questions"):
            phase_scores["phase4_questions"] = phase4_questions
            db.table("interview_sessions").update({
                "phase_scores": json.dumps(phase_scores),
            }).eq("id", req.session_id).execute()

    response_text, phase_complete = await generate_response(
        phase=current_phase,
        conversation_history=history,
        resume_sections=resume_sections,
        phase4_questions=phase4_questions,
    )

    history.append({"role": "assistant", "content": response_text})
    next_phase = current_phase

    if phase_complete:
        if current_phase < 5:
            next_phase = current_phase + 1
        else:
            # Interview complete
            db.table("interview_sessions").update({
                "current_phase": 6,
                "status": "complete",
                "conversation_history": json.dumps(history),
            }).eq("id", req.session_id).execute()
            return {
                "message": response_text,
                "phase": 6,
                "phase_complete": True,
                "interview_complete": True,
            }

    db.table("interview_sessions").update({
        "current_phase": next_phase,
        "conversation_history": json.dumps(history),
    }).eq("id", req.session_id).execute()

    return {
        "message": response_text,
        "phase": next_phase,
        "phase_complete": phase_complete,
        "interview_complete": False,
    }


def _get_resume_sections(db, session_id: str) -> dict:
    result = db.table("resume_sections").select("*").eq("session_id", session_id).execute()
    return {row["section_name"]: row["content"] for row in (result.data or [])}
