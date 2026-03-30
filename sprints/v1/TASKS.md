# Sprint v1 — Tasks

## Status: Not Started

---

- [ ] Task 1: Project scaffolding — React + FastAPI + env config + Supabase schema (P0)
  - Acceptance: `npm run dev` (frontend) and `uvicorn main:app` (backend) both start without errors; Supabase tables (`resume_sections`, `interview_sessions`, `interview_reports`) are created; `.env` and `secrets.md` are in `.gitignore`
  - Files: `frontend/` (Vite + React + Tailwind), `backend/` (FastAPI), `backend/.env.example`, `.gitignore`, `backend/db/supabase_schema.sql`

- [ ] Task 2: PDF upload + OpenAI parsing → structured resume sections in Supabase (P0)
  - Acceptance: Student uploads a PDF in the UI; backend calls OpenAI Files API to parse it into named sections (Education, Experience, Projects, Skills); sections are stored in Supabase `resume_sections`; parsed sections are returned to the frontend
  - Files: `backend/routers/resume.py`, `backend/services/pdf_parser.py`, `frontend/src/components/ResumeUpload.tsx`

- [ ] Task 3: ML questions bank — download, store as markdown, generate 384-dim embeddings (P0)
  - Acceptance: `backend/data/ml_questions.md` exists with all 80 Q&A from the GitHub source; a startup script generates and saves embeddings as `backend/data/ml_questions_embeddings.npy`; a `search_questions(field, top_k=5)` function returns the most relevant questions for a given ML domain
  - Files: `backend/data/ml_questions.md`, `backend/services/questions_bank.py`, `backend/data/ml_questions_embeddings.npy`

- [ ] Task 4: GPT-5.4 interview engine — phase state machine + all 5 phase prompt templates (P0)
  - Acceptance: A `InterviewEngine` class manages phase transitions (1→2→3→4→5→done); each phase has a dedicated system prompt enforcing the correct persona (professional, no affirmations, Socratic drill-down for phases 2–3, factual grading for phase 4, behavioral for phase 5); hints are injected after 2 failed attempts; the engine accepts conversation history and returns the next interviewer message
  - Files: `backend/services/interview_engine.py`, `backend/prompts/phase1.txt`, `backend/prompts/phase2.txt`, `backend/prompts/phase3.txt`, `backend/prompts/phase4.txt`, `backend/prompts/phase5.txt`

- [ ] Task 5: Voice I/O — Whisper STT endpoint + anxiety detection + ElevenLabs TTS endpoint (P0)
  - Acceptance: `POST /api/transcribe` accepts an audio blob, returns transcribed text + `anxiety_detected: bool` (triggered when speech rate > threshold or disfluency markers found in transcript); `POST /api/synthesize` accepts text, calls ElevenLabs with voice ID `OyLxfN4QfmkHrgD1bWBP`, returns audio bytes; both endpoints work end-to-end
  - Files: `backend/routers/voice.py`, `backend/services/whisper_stt.py`, `backend/services/elevenlabs_tts.py`, `backend/services/anxiety_detector.py`

- [ ] Task 6: React chat UI with voice controls — record, transcribe, play TTS, phase indicator (P0)
  - Acceptance: UI shows current phase label; student can press-and-hold mic button to record; on release, audio is sent to `/api/transcribe`; transcribed text appears in chat; interviewer response text is sent to `/api/synthesize` and played back automatically; anxiety pause UI shows a calming message overlay when `anxiety_detected=true`; conversation history scrolls cleanly
  - Files: `frontend/src/components/ChatInterface.tsx`, `frontend/src/components/VoiceRecorder.tsx`, `frontend/src/components/PhaseIndicator.tsx`, `frontend/src/hooks/useInterview.ts`

- [ ] Task 7: Evaluation engine — per-phase scoring with GPT-5.4 (P1)
  - Acceptance: After each phase completes, a `evaluate_phase(phase, conversation)` function calls GPT-5.4 to produce a structured score JSON; Phase 2 & 3: `depth_level` (1–10) + `hint_responsiveness` (0–1); Phase 4: `correct_count` / `total_questions`; Phase 5: `visionary` (0–10), `grounded` (0–10), `team_player` (0–10); scores are stored per-session in Supabase
  - Files: `backend/services/evaluator.py`, `backend/prompts/eval_phase2.txt`, `backend/prompts/eval_phase4.txt`, `backend/prompts/eval_phase5.txt`

- [ ] Task 8: Final report generation + React report dashboard (P1)
  - Acceptance: After Phase 5, `POST /api/report/{session_id}` triggers GPT-5.4 to compile all phase scores into a narrative final report (strengths, gaps, recommendations); report JSON is saved to Supabase `interview_reports`; React displays a clean report page with per-phase score cards, depth visualization for phases 2–3, and a written summary
  - Files: `backend/routers/report.py`, `backend/services/report_generator.py`, `frontend/src/pages/Report.tsx`, `frontend/src/components/ScoreCard.tsx`

---

## Notes
- All API keys loaded from `backend/.env` — never hardcoded
- GPT-5.4 called via `client.responses.create(model="gpt-5.4", reasoning={"effort": "low"}, input=[...])`
- ElevenLabs Voice ID: `OyLxfN4QfmkHrgD1bWBP`
- Supabase service role key used only server-side (never exposed to frontend)
- ML questions sourced from: https://github.com/andrewekhalel/MLQuestions (80 total: 67 ML + 13 NLP)
