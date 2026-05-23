"""Aplikacja FastAPI: interfejs + endpoint analizy."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.requests import Request

from detektor.config import MODEL_IDS, Settings, get_settings
from detektor.humanize import attach_proposals, humanize_text
from detektor.llm import GeminiJudge
from detektor.llm.discovery import list_available_models
from detektor.llm.rewriter import GeminiRewriter
from detektor.models import Report
from detektor.pipeline import analyze_text

_BASE = Path(__file__).resolve().parent

app = FastAPI(title="Detektor AI slop", description="Wykrywanie AI slop w tekstach po polsku")
app.mount("/static", StaticFiles(directory=_BASE / "static"), name="static")
_templates = Jinja2Templates(directory=str(_BASE / "templates"))


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)
    model: str | None = None
    humanize: bool = False
    judge: bool = True


class RewriteRequest(BaseModel):
    quote: str = Field(min_length=1, max_length=2000)
    context: str = Field("", max_length=4000)
    reason: str = Field("", max_length=500)
    model: str | None = None


class HumanizeRequest(BaseModel):
    text: str = Field(min_length=1)
    model: str | None = None


def _with_model(settings: Settings, model: str | None) -> Settings:
    """Waliduje i nadpisuje model per-zadanie (bez mutacji globalnych ustawien)."""
    if not model:
        return settings
    allowed = MODEL_IDS | {m["id"] for m in list_available_models(settings)[0]}
    if model not in allowed:
        raise HTTPException(status_code=400, detail="Nieznany model LLM.")
    return settings.model_copy(update={"gemini_model": model})


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return _templates.TemplateResponse(request, "index.html")


@app.get("/api/models")
def models() -> dict:
    settings = get_settings()
    items, source = list_available_models(settings)
    return {"models": items, "default": settings.gemini_model, "source": source}


@app.post("/api/analyze", response_model=Report)
def analyze(req: AnalyzeRequest) -> Report:
    settings = get_settings()
    if len(req.text) > settings.max_text_chars:
        raise HTTPException(
            status_code=413,
            detail=f"Tekst za długi (max {settings.max_text_chars} znaków).",
        )
    settings = _with_model(settings, req.model)
    report = analyze_text(req.text, settings=settings, use_llm=req.judge)
    if req.humanize:
        error = attach_proposals(report, req.text, settings=settings)
        if error:
            report.notes.append(error)
    return report


@app.post("/api/rewrite")
def rewrite(req: RewriteRequest) -> dict:
    settings = _with_model(get_settings(), req.model)
    rewriter = GeminiRewriter(settings)
    if not rewriter.available():
        return {"proposals": [], "error": "LLM niedostępny — wpisz własną wersję."}
    proposals = rewriter.rewrite(req.quote, req.context, req.reason, n=3)
    return {"proposals": proposals, "error": None if proposals else rewriter.last_error}


@app.post("/api/humanize")
def humanize(req: HumanizeRequest) -> dict:
    settings = get_settings()
    if len(req.text) > settings.max_text_chars:
        raise HTTPException(
            status_code=413,
            detail=f"Tekst za długi (max {settings.max_text_chars} znaków).",
        )
    settings = _with_model(settings, req.model)
    new_text, changes, error = humanize_text(req.text, settings=settings)
    return {"text": new_text, "changes": changes, "error": error}


@app.get("/healthz")
def healthz() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "llm_available": GeminiJudge(settings).available(),
        "model": settings.gemini_model,
    }
