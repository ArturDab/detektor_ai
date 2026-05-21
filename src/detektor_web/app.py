"""Aplikacja FastAPI: interfejs + endpoint analizy."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.requests import Request

from detektor.config import get_settings
from detektor.llm import GeminiJudge
from detektor.models import Report
from detektor.pipeline import analyze_text

_BASE = Path(__file__).resolve().parent

app = FastAPI(title="Detektor AI slop", description="Wykrywanie AI slop w tekstach po polsku")
app.mount("/static", StaticFiles(directory=_BASE / "static"), name="static")
_templates = Jinja2Templates(directory=str(_BASE / "templates"))


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return _templates.TemplateResponse(request, "index.html")


@app.post("/api/analyze", response_model=Report)
def analyze(req: AnalyzeRequest) -> Report:
    settings = get_settings()
    if len(req.text) > settings.max_text_chars:
        raise HTTPException(
            status_code=413,
            detail=f"Tekst za długi (max {settings.max_text_chars} znaków).",
        )
    return analyze_text(req.text, settings=settings)


@app.get("/healthz")
def healthz() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "llm_available": GeminiJudge(settings).available(),
        "model": settings.gemini_model,
    }
