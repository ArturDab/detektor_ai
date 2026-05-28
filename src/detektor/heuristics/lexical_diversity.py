"""Roznorodnosc leksykalna i powtarzalnosc (MATTR, powtorki, n-gramy)."""

from __future__ import annotations

from collections import Counter
from statistics import mean

from ..models import AnalyzerResult, Finding, Severity
from ..text.normalize import has_letter, normalize_token
from ..text.segmentation import Document
from .base import clamp

_COMMON_OPENERS = {"to", "a", "i", "w", "na", "z", "że", "co", "ale", "oraz", "the"}


def _is_capitalized(token: str) -> bool:
    """Token zaczyna sie od wielkiej litery (pierwszy znak alfabetyczny)."""
    for ch in token:
        if ch.isalpha():
            return ch.isupper()
    return False


def _looks_like_proper_name(toks: list) -> bool:
    """Para otwierajaca wyglada jak nazwa wlasna/tytul (Title Case oba slowa).

    Powtorzony tytul gry/marki (np. 'Zero Parades', 'Invincible VS',
    'Mortal Kombat') to nie monotonia, lecz naturalne odwolanie do tematu.
    Frazesy ('W dzisiejszych czasach', 'Nalezy podkreslic') maja drugie
    slowo z malej litery, wiec nadal sa wykrywane.
    """
    return _is_capitalized(toks[0].text) and _is_capitalized(toks[1].text)


class LexicalDiversityAnalyzer:
    name = "lexical_diversity"

    def __init__(self, window: int = 50) -> None:
        self.window = window

    def analyze(self, doc: Document) -> AnalyzerResult:
        words = [normalize_token(t.text) for t in doc.word_tokens]
        n = len(words)
        if n < 20:
            return AnalyzerResult(
                analyzer=self.name, score=0.0, metrics={"tokens": float(n), "mattr": 0.0}
            )

        mattr = self._mattr(words)
        score_ttr = clamp((0.78 - mattr) / 0.30 * 100)

        findings, score_open = self._repeated_openings(doc)
        score_ngram = self._ngram_score(words)

        score = clamp(0.5 * score_ttr + 0.3 * score_open + 0.2 * score_ngram)
        findings.sort(key=lambda f: f.start)
        return AnalyzerResult(
            analyzer=self.name,
            score=score,
            findings=findings,
            metrics={
                "tokens": float(n),
                "mattr": round(mattr, 3),
                "score_ttr": round(score_ttr, 1),
                "score_openings": round(score_open, 1),
                "score_ngram": round(score_ngram, 1),
            },
        )

    def _mattr(self, words: list[str]) -> float:
        w = self.window
        if len(words) <= w:
            return len(set(words)) / len(words)
        ratios = [len(set(words[i : i + w])) / w for i in range(len(words) - w + 1)]
        return mean(ratios)

    def _repeated_openings(self, doc: Document) -> tuple[list[Finding], float]:
        findings: list[Finding] = []
        groups: dict[tuple[str, str], list] = {}
        eligible = 0
        for s in doc.sentences:
            toks = [t for t in s.tokens if has_letter(t.text)]
            if len(toks) < 2:
                continue
            eligible += 1
            key = (normalize_token(toks[0].text), normalize_token(toks[1].text))
            groups.setdefault(key, []).append((s, toks))
        repeated = 0
        for key, items in groups.items():
            if key[0] in _COMMON_OPENERS:
                continue
            # Pomijamy powtorzone nazwy wlasne/tytuly (Title Case) — to nie
            # monotonia, lecz naturalne odwolanie do tematu tekstu.
            if _looks_like_proper_name(items[0][1]):
                continue
            if len(items) >= 2:
                repeated += len(items)
                for _s, toks in items:
                    findings.append(
                        Finding(
                            analyzer=self.name,
                            label="repeated_opening",
                            start=toks[0].start,
                            end=toks[1].end,
                            severity=Severity.low,
                            message=f"Powtarzalny początek: '{toks[0].text} {toks[1].text}'.",
                            suggestion="Zróżnicuj początki kolejnych zdań.",
                        )
                    )
        ratio = repeated / eligible if eligible else 0.0
        return findings, clamp(ratio * 180)

    def _ngram_score(self, words: list[str], n: int = 4) -> float:
        if len(words) < n * 2:
            return 0.0
        grams = [tuple(words[i : i + n]) for i in range(len(words) - n + 1)]
        counts = Counter(grams)
        dup = sum(v - 1 for v in counts.values() if v > 1)
        ratio = dup / len(grams)
        return clamp(ratio * 400)
