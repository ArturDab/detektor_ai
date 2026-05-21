"""Punkt wejscia rdzenia: tekst -> Raport. Nie importuje warstwy web."""

from __future__ import annotations

from .config import Settings, get_settings
from .fusion import fuse
from .heuristics import default_analyzers
from .llm import GeminiJudge
from .models import Report
from .text import segment


def analyze_text(
    text: str,
    settings: Settings | None = None,
    judge: GeminiJudge | None = None,
) -> Report:
    """Przeanalizuj tekst i zwroc kompletny raport (heurystyki + opcjonalnie LLM)."""
    settings = settings or get_settings()
    text = text or ""

    doc = segment(text, use_spacy=settings.use_spacy)
    results = [analyzer.analyze(doc) for analyzer in default_analyzers(settings)]

    if judge is None:
        judge = GeminiJudge(settings)
    judge_available = judge.available()
    verdict = judge.judge(text) if judge_available else None

    return fuse(
        text=text,
        word_count=doc.word_count,
        results=results,
        verdict=verdict,
        settings=settings,
        judge_available=judge_available,
    )
