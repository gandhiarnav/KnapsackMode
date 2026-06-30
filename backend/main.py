"""
KnapsackMode — FastAPI Backend Entry Point
Handles CORS, mounts all routers, and provides a health check endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import extract, allocate, studycard, quiz

load_dotenv()

app = FastAPI(
    title="KnapsackMode API",
    description="Last-Minute Exam/Interview Prep Compressor — Backend API",
    version="1.0.0",
)

import os

# Allow the Vite dev server and the deployed frontend to call this API
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    # Support both trailing slash and non-trailing slash
    allowed_origins.append(frontend_url)
    if frontend_url.endswith("/"):
        allowed_origins.append(frontend_url[:-1])
    else:
        allowed_origins.append(frontend_url + "/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router, prefix="/api")
app.include_router(allocate.router, prefix="/api")
app.include_router(studycard.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "KnapsackMode API"}
