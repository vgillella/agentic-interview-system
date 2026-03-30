"""
ML Questions Bank
- Parses ml_questions.md into (question, answer) pairs
- Embeds them with all-MiniLM-L6-v2 (384-dim)
- Provides cosine-similarity search to retrieve field-relevant questions
"""
import re
import os
import json
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer

DATA_DIR = Path(__file__).parent.parent / "data"
QUESTIONS_FILE = DATA_DIR / "ml_questions.md"
EMBEDDINGS_FILE = DATA_DIR / "ml_questions_embeddings.npy"
QUESTIONS_JSON = DATA_DIR / "ml_questions_parsed.json"

_model: SentenceTransformer | None = None
_embeddings: np.ndarray | None = None
_questions: list[dict] | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _parse_questions() -> list[dict]:
    """Parse markdown into list of {id, question, answer, tags} dicts."""
    text = QUESTIONS_FILE.read_text(encoding="utf-8")
    qa_pairs = []

    # Split on numbered question headers: #### N) Question text
    blocks = re.split(r"(?=####\s+\d+\))", text)
    for block in blocks:
        block = block.strip()
        if not block.startswith("####"):
            continue
        # Extract question
        first_line_match = re.match(r"####\s+\d+\)\s+(.+?)(?:\s*\[\[src\]\].*)?$", block, re.MULTILINE)
        if not first_line_match:
            continue
        question = first_line_match.group(1).strip()
        # Everything after the first line is the answer
        lines = block.split("\n", 1)
        answer = lines[1].strip() if len(lines) > 1 else ""
        # Remove any trailing "---" separators
        answer = re.sub(r"\n---\s*$", "", answer).strip()

        # Auto-tag
        tags = []
        lower = (question + " " + answer).lower()
        if any(w in lower for w in ["nlp", "language model", "bert", "transformer", "text", "token", "embedding", "word2vec", "n-gram", "perplexity", "stemm", "lemma"]):
            tags.append("nlp")
        if any(w in lower for w in ["convolution", "cnn", "image", "segmentation", "object detection", "optical flow", "pooling", "rcnn", "cbir"]):
            tags.append("computer_vision")
        if any(w in lower for w in ["lstm", "rnn", "recurrent", "gru", "sequence"]):
            tags.append("sequence_models")
        if any(w in lower for w in ["gradient", "backprop", "loss", "optimizer", "learning rate", "momentum", "sgd", "adam"]):
            tags.append("optimization")
        if any(w in lower for w in ["bias", "variance", "regularization", "overfit", "underfit", "cross-validation", "evaluation", "precision", "recall", "f1", "roc", "auc"]):
            tags.append("fundamentals")
        if not tags:
            tags.append("general_ml")

        qa_pairs.append({
            "id": len(qa_pairs) + 1,
            "question": question,
            "answer": answer,
            "tags": tags,
        })

    return qa_pairs


def _load_or_build():
    global _embeddings, _questions
    if _questions is not None and _embeddings is not None:
        return

    # Load or parse questions
    if QUESTIONS_JSON.exists():
        _questions = json.loads(QUESTIONS_JSON.read_text())
    else:
        _questions = _parse_questions()
        QUESTIONS_JSON.write_text(json.dumps(_questions, indent=2))

    # Load or compute embeddings
    if EMBEDDINGS_FILE.exists():
        _embeddings = np.load(str(EMBEDDINGS_FILE))
    else:
        model = _get_model()
        texts = [q["question"] for q in _questions]
        _embeddings = model.encode(texts, normalize_embeddings=True)
        np.save(str(EMBEDDINGS_FILE), _embeddings)


def search_questions(field: str, top_k: int = 5) -> list[dict]:
    """
    Return top_k questions most relevant to the given ML field/topic string.
    field: e.g. "natural language processing", "computer vision", "reinforcement learning"
    """
    _load_or_build()
    model = _get_model()
    query_emb = model.encode([field], normalize_embeddings=True)
    scores = (_embeddings @ query_emb.T).flatten()  # cosine similarity (already normalized)
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [_questions[i] for i in top_indices]


def get_all_questions() -> list[dict]:
    _load_or_build()
    return _questions


def detect_field(resume_sections: dict) -> str:
    """Infer ML domain from resume text."""
    combined = " ".join([
        resume_sections.get("experience", ""),
        resume_sections.get("projects", ""),
        resume_sections.get("skills", ""),
    ]).lower()

    scores = {
        "natural language processing": sum(combined.count(w) for w in ["nlp", "bert", "gpt", "language model", "text", "transformer", "llm", "rag", "hugging"]),
        "computer vision": sum(combined.count(w) for w in ["computer vision", "opencv", "yolo", "image", "detection", "segmentation", "cnn", "resnet"]),
        "reinforcement learning": sum(combined.count(w) for w in ["reinforcement", "rl", "reward", "policy", "q-learning", "gym"]),
        "machine learning": 1,  # default fallback
    }
    return max(scores, key=scores.get)
