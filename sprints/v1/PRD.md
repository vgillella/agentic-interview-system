# Sprint v1 — PRD: AI-Powered Mock Interview Agent

## Overview
Build a full-stack AI mock interview agent that takes a student's resume PDF, parses it via OpenAI, and conducts a structured 5-phase interview (background → deep technical drill-down → second project drill-down → ML factual Q&A → behavioral). The interviewer speaks in a cloned voice (ElevenLabs), listens via Whisper STT, detects anxiety through speech patterns, and generates a final scored report at the end.

## Goals
- Student can upload a resume PDF; it is parsed into structured sections and persisted in Supabase
- Interview flows through all 5 phases with GPT-5.4 driving adaptive, Socratic questioning
- Voice I/O works end-to-end: student speaks → Whisper → GPT-5.4 → ElevenLabs TTS playback
- Anxiety detection pauses the interview and offers a calm nudge when speech is too fast/stuttered
- Final report is generated with per-phase scores and displayed in the UI

## User Stories
- As a student, I want to upload my resume and have the AI parse it automatically, so I don't have to manually enter my background
- As a student, I want to be interviewed with increasingly deep technical questions based on my actual projects, so I can find the real boundaries of my knowledge
- As a student, I want to speak my answers aloud and hear the interviewer's voice, so the session feels like a real interview
- As a student, I want the interviewer to pause and comfort me if I sound anxious, so I can reset and continue without pressure
- As a student, I want a detailed final report with scores per phase, so I know exactly where to improve

## Technical Architecture

### Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: FastAPI (Python 3.11)
- **LLM**: GPT-5.4 via OpenAI Responses API (`reasoning={"effort": "low"}`)
- **PDF Parsing**: OpenAI Files API (vision-capable multimodal parsing)
- **STT**: OpenAI Whisper API (`whisper-1`)
- **TTS**: ElevenLabs API (Voice ID: `OyLxfN4QfmkHrgD1bWBP` — Vishnu's cloned voice)
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384-dim) for ML question similarity search
- **Database**: Supabase (PostgreSQL)
- **Secrets**: `.env` file, never committed (`.gitignore`)

### Component Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │ PDF Upload   │  │  Chat UI +    │  │  Final Report    │ │
│  │ Component    │  │  Voice I/O    │  │  Dashboard       │ │
│  └──────┬───────┘  └──────┬────────┘  └──────────────────┘ │
└─────────┼─────────────────┼───────────────────────────────────┘
          │  REST/HTTP       │ REST + WebSocket (audio)
┌─────────▼─────────────────▼───────────────────────────────────┐
│                        FastAPI Backend                         │
│                                                                │
│  ┌─────────────┐   ┌──────────────────────────────────────┐  │
│  │ PDF Parser  │   │       Interview Engine                │  │
│  │ (OpenAI     │   │  ┌──────────────────────────────┐    │  │
│  │  Files API) │   │  │  Phase State Machine         │    │  │
│  └──────┬──────┘   │  │  Phase 1: Background         │    │  │
│         │          │  │  Phase 2: Project Drill-down │    │  │
│  ┌──────▼──────┐   │  │  Phase 3: 2nd Project Drill  │    │  │
│  │  Supabase   │   │  │  Phase 4: ML Q&A (embeddings)│    │  │
│  │  (sections, │   │  │  Phase 5: Behavioral         │    │  │
│  │   sessions, │   │  └──────────────────────────────┘    │  │
│  │   reports)  │   │  GPT-5.4 (reasoning model)           │  │
│  └─────────────┘   └──────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────┐   ┌────────────────┐   ┌───────────────┐   │
│  │ Whisper STT  │   │ ElevenLabs TTS │   │ ML Questions  │   │
│  │ + Anxiety    │   │ (Vishnu voice) │   │ Bank (.md +   │   │
│  │ Detection    │   │                │   │ embeddings)   │   │
│  └──────────────┘   └────────────────┘   └───────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. Student uploads PDF → FastAPI → OpenAI Files API → structured JSON sections → Supabase (`resume_sections` table)
2. Interview session created → Supabase (`interview_sessions` table)
3. Student speaks → browser MediaRecorder → audio blob → `/api/transcribe` → Whisper → text + anxiety flag
4. If anxious: system injects pause prompt; else: text → GPT-5.4 with phase context + conversation history → question
5. GPT-5.4 response → `/api/synthesize` → ElevenLabs → audio bytes → browser plays back
6. After Phase 5: GPT-5.4 evaluates all phases → final report JSON → Supabase (`interview_reports` table) → displayed in UI

### Supabase Schema
```sql
resume_sections    (id, session_id, section_name, content, created_at)
interview_sessions (id, student_name, resume_id, current_phase, conversation_history, created_at)
interview_reports  (id, session_id, phase1_notes, phase2_score, phase3_score, phase4_score, phase5_score, overall_score, report_json, created_at)
```

### Phase Details

| Phase | Focus | Evaluation Metric |
|-------|-------|-------------------|
| 1 | Background / "Tell me about yourself" | No formal score — warm-up |
| 2 | Deep Socratic drill on top project (Russian Doll) | Depth score: levels reached before breakdown; hint responsiveness |
| 3 | Socratic drill on 2nd project / research internship | Same as Phase 2 |
| 4 | 4–5 ML factual questions (embedding similarity → field-matched) | Correct answers / total (0–100%) |
| 5 | Behavioral (vision, challenges, teamwork, questions for interviewer) | Visionary (0–10), Grounded (0–10), Team Player (0–10) |

### Interviewer Persona (Prompt Guidelines)
- Professional, measured tone — never enthusiastic or over-agreeable
- No filler affirmations: never "great answer", "incredible", "let's move on"
- Process the answer silently; ask the next logical question
- Give hints only when student is clearly stuck (2+ failed attempts at a sub-question)
- Anxiety detected → override next response with: "Take a moment. There's no rush. Whenever you're ready, we'll continue."

### ML Questions Bank
- Source: `https://github.com/andrewekhalel/MLQuestions` (80 Q&A: 67 ML + 13 NLP)
- Stored locally as `backend/data/ml_questions.md`
- Embedded at startup with `all-MiniLM-L6-v2` (384-dim), stored as numpy array
- Field detection: extract dominant domain from resume (NLP / CV / general ML) → cosine similarity → top-5 questions selected

## Out of Scope (v2+)
- Video feed + facial expression anxiety detection
- CI/CD pipeline (GitHub Actions → AWS)
- Anti-cheating system
- Multi-user auth / organization features
- Real-time WebSocket streaming of TTS audio
- Fine-tuned domain-specific evaluation models

## Dependencies
- OpenAI API key (GPT-5.4 + Whisper + Files API)
- ElevenLabs API key + Voice ID `OyLxfN4QfmkHrgD1bWBP`
- Supabase project + service role key
- `sentence-transformers` library (Python)
- Node.js 18+ and Python 3.11+
