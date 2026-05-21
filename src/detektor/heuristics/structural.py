"""Sygnaly strukturalne: listy, Title Case w naglowkach, myslniki, laczniki."""

from __future__ import annotations

import re

from ..data import load_connectors
from ..models import AnalyzerResult, Finding, Severity
from ..text.segmentation import Document
from .base import clamp, per_1k, saturating

_BULLET = re.compile(r"^\s*(?:[-*•–—‣·]|\d+[.)]|[a-zA-Z]\))\s+")
_WORD = re.compile(r"\w+", re.UNICODE)
_EMDASH = re.compile(r"\s[—–]\s|—")
_SENT_END_CHARS = ".!?…:"


class StructuralAnalyzer:
    name = "structural"

    def __init__(self, connectors: list[str] | None = None) -> None:
        conns = connectors if connectors is not None else load_connectors()
        alts = sorted((re.escape(c) for c in conns), key=len, reverse=True)
        self.conn_re = re.compile(r"\b(?:" + "|".join(alts) + r")\b", re.IGNORECASE | re.UNICODE)

    def analyze(self, doc: Document) -> AnalyzerResult:
        text = doc.text
        wc = doc.word_count
        findings: list[Finding] = []

        nonblank = 0
        bullet_lines = 0
        title_headings = 0
        offset = 0
        for line in text.splitlines(keepends=True):
            stripped = line.strip()
            if stripped:
                nonblank += 1
                if _BULLET.match(line):
                    bullet_lines += 1
                elif self._is_title_case_heading(stripped):
                    title_headings += 1
                    line_start = offset + (len(line) - len(line.lstrip()))
                    findings.append(
                        Finding(
                            analyzer=self.name,
                            label="title_case_heading",
                            start=line_start,
                            end=line_start + len(stripped),
                            severity=Severity.medium,
                            message="Naglowek w stylu Title Case (kalka z ang.).",
                            suggestion="W polszczyznie naglowki pisz zdaniowo.",
                            matched_text=stripped[:80],
                        )
                    )
            offset += len(line)

        # Laczniki na poczatku zdan -> findings + zliczenie do gestosci.
        conn_total = 0
        for s in doc.sentences:
            conn_total += len(self.conn_re.findall(s.text))
            head = self.conn_re.match(s.text)
            if head:
                findings.append(
                    Finding(
                        analyzer=self.name,
                        label="connector",
                        start=s.start + head.start(),
                        end=s.start + head.end(),
                        severity=Severity.low,
                        message=f"Schematyczny lacznik na poczatku zdania: '{head.group(0)}'.",
                        suggestion="Ogranicz laczniki-przejscia; lacz mysli naturalnie.",
                        matched_text=head.group(0),
                    )
                )

        emdash_count = len(_EMDASH.findall(text))
        list_ratio = bullet_lines / nonblank if nonblank else 0.0

        score_list = clamp((list_ratio - 0.15) * 160)
        score_emdash = saturating(per_1k(emdash_count, wc), 12.0)
        score_conn = saturating(per_1k(conn_total, wc), 4.0)
        score_title = clamp(title_headings * 25)
        score = clamp(
            0.30 * score_conn + 0.25 * score_emdash + 0.25 * score_list + 0.20 * score_title
        )

        findings.sort(key=lambda f: f.start)
        return AnalyzerResult(
            analyzer=self.name,
            score=score,
            findings=findings,
            metrics={
                "list_ratio": round(list_ratio, 3),
                "emdash_per_1k": round(per_1k(emdash_count, wc), 2),
                "connectors_per_1k": round(per_1k(conn_total, wc), 2),
                "title_headings": float(title_headings),
            },
        )

    @staticmethod
    def _is_title_case_heading(line: str) -> bool:
        core = line.lstrip("#").strip() if line.startswith("#") else line
        if core and core[-1] in _SENT_END_CHARS:
            return False
        words = _WORD.findall(core)
        if not (3 <= len(words) <= 9):
            return False
        capitalized = sum(1 for w in words[1:] if w[:1].isupper() and not w.isupper())
        return capitalized >= max(2, int((len(words) - 1) * 0.6))
