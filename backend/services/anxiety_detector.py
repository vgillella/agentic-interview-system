"""
Anxiety Detection
Analyses transcribed text for signs of anxiety:
- Excessive filler words / disfluencies (um, uh, like, you know)
- Very short word count (gave up / blanked)
- Repetitive stuttering patterns (word word word)
"""
import re


FILLER_WORDS = {"um", "uh", "you know", "i mean", "sort of", "kind of", "hmm", "err"}
STUTTER_PATTERN = re.compile(r"\b(\w+)\b(?:\s+\1\b){2,}", re.IGNORECASE)


def detect_anxiety(transcript: str) -> bool:
    """
    Returns True if the transcript signals significant anxiety.
    Heuristic: filler density > 25% of words, OR 3+ consecutive repeated words.
    Excludes "like"/"ah" — too common in normal technical speech.
    Only triggers on responses of 10+ words to avoid false positives on short answers.
    """
    if not transcript:
        return False

    text = transcript.lower()
    words = text.split()
    total = len(words)

    if total < 10:
        return False

    # Count fillers
    filler_count = sum(1 for w in words if w in FILLER_WORDS)
    # Check multi-word fillers
    for phrase in ["you know", "i mean", "sort of", "kind of"]:
        filler_count += text.count(phrase)

    filler_density = filler_count / total

    # Check stutter (repeated consecutive words)
    has_stutter = bool(STUTTER_PATTERN.search(text))

    return filler_density > 0.25 or has_stutter


ANXIETY_MESSAGE = (
    "Take a moment — there's no rush. "
    "Whenever you're ready, we can continue."
)
