"""Schemat ustrukturyzowanej odpowiedzi sedziego LLM (Gemini)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Dimensions(BaseModel):
    generic: int = Field(0, ge=0, le=100)
    cliche: int = Field(0, ge=0, le=100)
    low_information: int = Field(0, ge=0, le=100)
    repetition: int = Field(0, ge=0, le=100)
    unnatural_rhythm: int = Field(0, ge=0, le=100)


class FlaggedPassageLLM(BaseModel):
    quote: str
    reason: str
    suggestion: str = ""


class GeminiVerdict(BaseModel):
    ai_likelihood: int = Field(ge=0, le=100)
    slop_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    dimensions: Dimensions = Field(default_factory=Dimensions)
    flagged_passages: list[FlaggedPassageLLM] = Field(default_factory=list)
    overall_explanation: str = ""


class RewriteProposals(BaseModel):
    """Propozycje przepisania fragmentu na bardziej ludzki."""

    proposals: list[str] = Field(default_factory=list)
