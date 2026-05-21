"""Wspolne struktury danych przenoszone end-to-end (rdzen -> web/UI)."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Severity(StrEnum):
    info = "info"
    low = "low"
    medium = "medium"
    high = "high"


class Finding(BaseModel):
    """Pojedyncze wykrycie z offsetami znakowymi do podswietlenia w UI."""

    analyzer: str
    label: str
    start: int
    end: int
    severity: Severity = Severity.medium
    message: str
    suggestion: str | None = None
    matched_text: str | None = None


class AnalyzerResult(BaseModel):
    """Wynik pojedynczego analizatora heurystycznego."""

    analyzer: str
    score: float = Field(ge=0, le=100)  # wyzej = gorzej
    findings: list[Finding] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)


class FlaggedPassage(BaseModel):
    """Fragment wskazany przez LLM (do panelu sugestii)."""

    quote: str
    reason: str
    suggestion: str = ""


class ScoreContribution(BaseModel):
    name: str
    score: float
    weight: float


class IndexResult(BaseModel):
    """Jeden z dwoch finalnych wskaznikow (0-100) wraz z pewnoscia."""

    score: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    band: str
    breakdown: list[ScoreContribution] = Field(default_factory=list)


class Report(BaseModel):
    text: str
    word_count: int
    slop: IndexResult
    ai_provenance: IndexResult
    findings: list[Finding] = Field(default_factory=list)
    flagged_passages: list[FlaggedPassage] = Field(default_factory=list)
    dimensions: dict[str, int] = Field(default_factory=dict)
    analyzer_scores: dict[str, float] = Field(default_factory=dict)
    llm_available: bool = False
    llm_explanation: str | None = None
    llm_error: str | None = None
    notes: list[str] = Field(default_factory=list)


def band_for(score: float) -> str:
    """Slowny opis poziomu wskaznika po polsku."""
    if score < 25:
        return "niski"
    if score < 50:
        return "umiarkowany"
    if score < 75:
        return "podwyzszony"
    return "wysoki"
