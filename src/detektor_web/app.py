"""Aplikacja FastAPI: interfejs + endpoint analizy."""

from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.requests import Request

from detektor.config import CURATED_MODEL_IDS, MODEL_IDS, Settings, get_settings
from detektor.humanize import attach_proposals, humanize_text
from detektor.llm import GeminiJudge
from detektor.llm.discovery import list_available_models
from detektor.llm.rewriter import GeminiRewriter
from detektor.models import Report
from detektor.pipeline import analyze_text

_BASE = Path(__file__).resolve().parent
_STATIC = _BASE / "static"


def _asset_version(filename: str) -> str:
    """Krótki hash treści pliku statycznego do cache-bustingu (?v=...).

    Liczony raz przy starcie — w produkcji każdy deploy = nowy kontener z
    nową treścią pliku → nowy hash → przeglądarka pobiera świeżą wersję.
    """
    try:
        data = (_STATIC / filename).read_bytes()
    except OSError:
        return "0"
    return hashlib.sha1(data, usedforsecurity=False).hexdigest()[:8]


_ASSET_VERSIONS = {name: _asset_version(name) for name in ("style.css", "app.js")}

app = FastAPI(title="Detektor AI slop", description="Wykrywanie AI slop w tekstach po polsku")
app.mount("/static", StaticFiles(directory=_STATIC), name="static")
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
    return _templates.TemplateResponse(request, "index.html", {"assets": _ASSET_VERSIONS})


def _speed_hint(model_id: str) -> str:
    """Krotka adnotacja kompromisu szybkosc/dokladnosc po id modelu."""
    mid = model_id.lower()
    if "lite" in mid:
        return "najszybsza analiza, najmniej dokładna"
    if "flash" in mid:
        return "szybsza analiza, mniej dokładna"
    if "pro" in mid:
        return "wolniejsza analiza, dokładniejsza"
    return ""


def _annotate(items: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in items:
        hint = _speed_hint(m["id"])
        label = f"{m['label']} — {hint}" if hint else m["label"]
        out.append({"id": m["id"], "label": label})
    return out


def _is_image_model(model_id: str) -> bool:
    mid = model_id.lower()
    return "image" in mid or "imagen" in mid


def _curate(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Zaweza liste do 3-4 wyselekcjonowanych, tekstowych modeli (bez generowania
    obrazow). Bierze modele z CURATED_MODEL_IDS, ktore sa realnie dostepne."""
    available = {m["id"]: m for m in items}
    curated = [available[mid] for mid in CURATED_MODEL_IDS if mid in available]
    if curated:
        return curated
    # Fallback: zadne z wyselekcjonowanych nie pasuje do dostepnych nazw -> pokaz
    # do 4 dostepnych modeli tekstowych (z wykluczeniem generowania obrazow).
    return [m for m in items if not _is_image_model(m["id"])][:4]


@app.get("/api/models")
def models() -> dict:
    settings = get_settings()
    items, source = list_available_models(settings)
    curated = _curate(items)
    default = settings.gemini_model
    if curated and default not in {m["id"] for m in curated}:
        default = curated[0]["id"]
    return {"models": _annotate(curated), "default": default, "source": source}


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
