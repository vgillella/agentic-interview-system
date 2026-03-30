from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from services.whisper_stt import transcribe_audio
from services.anxiety_detector import detect_anxiety, ANXIETY_MESSAGE
from services.elevenlabs_tts import synthesize_speech

router = APIRouter()


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Accept audio blob, return transcript + anxiety flag."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    transcript = await transcribe_audio(audio_bytes, audio.content_type or "audio/webm")
    anxious = detect_anxiety(transcript)

    return {
        "transcript": transcript,
        "anxiety_detected": anxious,
        "anxiety_message": ANXIETY_MESSAGE if anxious else None,
    }


class SynthesizeRequest(BaseModel):
    text: str


@router.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    """Synthesize text to MP3 using ElevenLabs cloned voice."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        audio_bytes = synthesize_speech(req.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    return Response(content=audio_bytes, media_type="audio/mpeg")
