"""Rytm zdan (burstiness): jednostajna dlugosc zdan to sygnal generowania."""

from __future__ import annotations

from statistics import mean, pstdev

from ..models import AnalyzerResult
from ..text.normalize import has_letter
from ..text.segmentation import Document
from .base import clamp


class RhythmAnalyzer:
    name = "rhythm"

    def analyze(self, doc: Document) -> AnalyzerResult:
        lengths = [sum(1 for t in s.tokens if has_letter(t.text)) for s in doc.sentences]
        lengths = [length for length in lengths if length > 0]
        if len(lengths) < 3:
            return AnalyzerResult(
                analyzer=self.name, score=0.0, metrics={"sentences": float(len(lengths))}
            )
        m = mean(lengths)
        sd = pstdev(lengths)
        cv = sd / m if m > 0 else 0.0
        # Niski wspolczynnik zmiennosci (jednostajnosc) -> wyzszy wynik.
        score = clamp((0.6 - cv) / 0.6 * 100)
        return AnalyzerResult(
            analyzer=self.name,
            score=score,
            metrics={
                "sentences": float(len(lengths)),
                "mean_len": round(m, 2),
                "stdev_len": round(sd, 2),
                "cv": round(cv, 3),
            },
        )
