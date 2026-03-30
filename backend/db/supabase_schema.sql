-- Resume sections parsed from uploaded PDF
CREATE TABLE IF NOT EXISTS resume_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    section_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview sessions tracking phase and conversation
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT,
    resume_id UUID,
    current_phase INTEGER DEFAULT 1,
    conversation_history JSONB DEFAULT '[]'::jsonb,
    phase_scores JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final evaluation reports per session
CREATE TABLE IF NOT EXISTS interview_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id),
    phase1_notes TEXT,
    phase2_score JSONB,
    phase3_score JSONB,
    phase4_score JSONB,
    phase5_score JSONB,
    overall_score NUMERIC(5,2),
    report_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resume_sections_session ON resume_sections(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_session ON interview_reports(session_id);
