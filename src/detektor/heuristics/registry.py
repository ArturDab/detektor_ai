"""Domyslny, uporzadkowany zestaw aktywnych analizatorow."""

from __future__ import annotations

from ..config import Settings, get_settings
from .base import Analyzer
from .lexical_diversity import LexicalDiversityAnalyzer
from .punctuation_calque import PunctuationCalqueAnalyzer
from .rhythm import RhythmAnalyzer
from .slop_phrases import SlopPhraseAnalyzer
from .structural import StructuralAnalyzer


def default_analyzers(settings: Settings | None = None) -> list[Analyzer]:
    settings = settings or get_settings()
    return [
        SlopPhraseAnalyzer(density_k=settings.slop_density_k),
        LexicalDiversityAnalyzer(),
        RhythmAnalyzer(),
        StructuralAnalyzer(),
        PunctuationCalqueAnalyzer(),
    ]
