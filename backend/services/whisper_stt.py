"""
Whisper STT — transcribes audio bytes and returns text.
"""
import io
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio using OpenAI Whisper."""
    ext = "webm" if "webm" in mime_type else "wav"
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = f"recording.{ext}"

    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="en",
    )
    return transcript.text.strip()
