import uuid
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException
from db.client import get_supabase
from services.pdf_parser import parse_resume_pdf

router = APIRouter()

SECTION_KEYS = ["name", "contact", "summary", "education", "experience", "projects", "skills", "awards"]


async def _parse_and_store(session_id: str, file_bytes: bytes, filename: str):
    """Background task: parse PDF with OpenAI and store sections in Supabase."""
    try:
        sections = await parse_resume_pdf(file_bytes, filename)
        db = get_supabase()

        # Update session with student name and mark as parsed
        db.table("interview_sessions").update({
            "student_name": sections.get("name", "Candidate"),
            "status": "ready",
        }).eq("id", session_id).execute()

        rows = [
            {"session_id": session_id, "section_name": key, "content": sections.get(key, "")}
            for key in SECTION_KEYS
            if sections.get(key)
        ]
        if rows:
            db.table("resume_sections").insert(rows).execute()
    except Exception:
        # Mark session as failed so frontend can detect it
        try:
            get_supabase().table("interview_sessions").update({
                "status": "parse_failed"
            }).eq("id", session_id).execute()
        except Exception:
            pass


@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload a resume PDF. Returns session_id immediately.
    PDF parsing happens in the background — poll /session/{id}/status for readiness.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    # Create session immediately so the frontend can proceed
    session_id = str(uuid.uuid4())
    db = get_supabase()
    db.table("interview_sessions").insert({
        "id": session_id,
        "student_name": "Candidate",
        "status": "parsing",
    }).execute()

    # Parse PDF in the background — don't block the HTTP response
    asyncio.create_task(_parse_and_store(session_id, file_bytes, file.filename))

    return {
        "session_id": session_id,
        "student_name": "Candidate",
        "status": "parsing",
    }


@router.get("/session/{session_id}/status")
async def get_session_status(session_id: str):
    """Poll this endpoint until status == 'ready' before starting the interview."""
    db = get_supabase()
    result = db.table("interview_sessions").select("id,student_name,status").eq("id", session_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found.")
    return result.data


@router.get("/session/{session_id}/resume")
async def get_resume(session_id: str):
    """Retrieve parsed resume sections for a session."""
    db = get_supabase()
    result = db.table("resume_sections").select("*").eq("session_id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {row["section_name"]: row["content"] for row in result.data}
