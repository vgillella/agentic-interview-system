"""
ElevenLabs TTS — synthesize text using Vishnu's cloned voice.
"""
import os
from elevenlabs.client import ElevenLabs

_client: ElevenLabs | None = None


def _get_client() -> ElevenLabs:
    global _client
    if _client is None:
        _client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    return _client


def synthesize_speech(text: str) -> bytes:
    """Return MP3 audio bytes for the given text."""
    voice_id = os.environ["ELEVENLABS_VOICE_ID"]
    client = _get_client()

    audio_generator = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
        voice_settings={
            "stability": 0.55,
            "similarity_boost": 0.80,
            "style": 0.10,
            "use_speaker_boost": True,
        },
    )
    return b"".join(audio_generator)
