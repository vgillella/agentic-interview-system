from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Interview Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers registered after task implementations
from routers import resume, voice, interview, report

app.include_router(resume.router, prefix="/api", tags=["resume"])
app.include_router(voice.router, prefix="/api", tags=["voice"])
app.include_router(interview.router, prefix="/api", tags=["interview"])
app.include_router(report.router, prefix="/api", tags=["report"])


@app.get("/health")
async def health():
    return {"status": "ok"}
