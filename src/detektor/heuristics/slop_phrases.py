"""Analizator gestosci fraz "AI slop" (sterowany leksykonem YAML)."""

from __future__ import annotations

import re

from ..data import load_slop_phrases
from ..models import AnalyzerResult, Finding, Severity
from ..text.segmentation import Document
from .base import per_1k, saturating


class SlopPhraseAnalyzer:
    name = "slop_phrases"

    def __init__(self, entries: list[dict] | None = None, density_k: float = 8.0) -> None:
        raw = entries if entries is not None else load_slop_phrases()
        self.density_k = density_k
        self.entries = []
        for e in raw:
            self.entries.append(
                {
                    "regex": re.compile(e["pattern"], re.IGNORECASE | re.UNICODE),
                    "message": e.get("message", ""),
                    "suggestion": e.get("suggestion"),
                    "severity": Severity(e.get("severity", "medium")),
                    "weight": float(e.get("weight", 1.0)),
                }
            )

    def analyze(self, doc: Document) -> AnalyzerResult:
        findings: list[Finding] = []
        weighted = 0.0
        seen: set[tuple[int, int]] = set()
        for e in self.entries:
            for m in e["regex"].finditer(doc.text):
                span = (m.start(), m.end())
                if span in seen:
                    continue
                seen.add(span)
                weighted += e["weight"]
                findings.append(
                    Finding(
                        analyzer=self.name,
                        label="slop_phrase",
                        start=m.start(),
                        end=m.end(),
                        severity=e["severity"],
                        message=e["message"],
                        suggestion=e["suggestion"],
                        matched_text=m.group(0),
                    )
                )
        density = per_1k(weighted, doc.word_count)
        score = saturating(density, self.density_k)
        findings.sort(key=lambda f: f.start)
        return AnalyzerResult(
            analyzer=self.name,
            score=score,
            findings=findings,
            metrics={
                "hits": float(len(findings)),
                "weighted_hits": round(weighted, 2),
                "density_per_1k": round(density, 2),
            },
        )
