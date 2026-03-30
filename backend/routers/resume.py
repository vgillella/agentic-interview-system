import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from db.client import get_supabase
from services.pdf_parser import parse_resume_pdf

router = APIRouter()

SECTION_KEYS = ["name", "contact", "summary", "education", "experience", "projects", "skills", "awards"]


@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """Upload a resume PDF, parse it via OpenAI, store sections in Supabase."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    try:
        sections = await parse_resume_pdf(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {e}")

    # Create a session for this resume
    session_id = str(uuid.uuid4())
    db = get_supabase()

    # Insert session row
    db.table("interview_sessions").insert({
        "id": session_id,
        "student_name": sections.get("name", "Unknown"),
    }).execute()

    # Insert one row per section
    rows = [
        {
            "session_id": session_id,
            "section_name": key,
            "content": sections.get(key, ""),
        }
        for key in SECTION_KEYS
        if sections.get(key)
    ]
    if rows:
        db.table("resume_sections").insert(rows).execute()

    return {
        "session_id": session_id,
        "student_name": sections.get("name"),
        "sections": {k: sections.get(k, "") for k in SECTION_KEYS},
    }


@router.get("/session/{session_id}/resume")
async def get_resume(session_id: str):
    """Retrieve parsed resume sections for a session."""
    db = get_supabase()
    result = db.table("resume_sections").select("*").eq("session_id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {row["section_name"]: row["content"] for row in result.data}
