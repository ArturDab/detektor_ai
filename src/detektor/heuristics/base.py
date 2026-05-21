"""Protokol analizatora + wspolne funkcje pomocnicze."""

from __future__ import annotations

from typing import Protocol

from ..models import AnalyzerResult
from ..text.segmentation import Document


class Analyzer(Protocol):
    name: str

    def analyze(self, doc: Document) -> AnalyzerResult: ...


def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def per_1k(count: float, word_count: int) -> float:
    if word_count <= 0:
        return 0.0
    return count / word_count * 1000.0


def saturating(rate_per_1k: float, k: float) -> float:
    """Krzywa nasycenia: gestosc -> 0..100 (kumulacja markerow dominuje)."""
    return clamp(k * rate_per_1k)
