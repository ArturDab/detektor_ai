"""Mikro-sygnaly: wycieki modelu, kalki z angielskiego, przecinek po lacznikach.

Wycieki ("jako model jezykowy"...) to niemal pewny dowod autorstwa AI i mocno
zasilaja wskaznik POCHODZENIA.
"""

from __future__ import annotations

import re

from ..models import AnalyzerResult, Finding, Severity
from ..text.segmentation import Document
from .base import clamp, per_1k, saturating

_FLAGS = re.IGNORECASE | re.UNICODE

_LEAKS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"\bjako (?:model językowy|sztuczna inteligencja|AI)\b", _FLAGS),
        "Wyciek: tekst ujawnia, ze pisal go model AI.",
    ),
    (
        re.compile(
            r"\bnie (?:mam|posiadam) dostępu do (?:internetu|danych|informacji|aktualnych)", _FLAGS
        ),
        "Wyciek: typowa formula asystenta AI.",
    ),
    (
        re.compile(r"\bwedług mojej wiedzy na dzień\b", _FLAGS),
        "Wyciek: formula o dacie wiedzy modelu.",
    ),
    (
        re.compile(r"\b(?:data|dzień) ostatniej aktualizacji\b", _FLAGS),
        "Wyciek: odwolanie do aktualizacji modelu.",
    ),
    (re.compile(r"\bas an AI language model\b", _FLAGS), "Wyciek: angielska formula modelu AI."),
    (
        re.compile(
            r"\bnie jestem w stanie (?:przeglądać|przeszukiwać) (?:internetu|sieci)\b", _FLAGS
        ),
        "Wyciek: formula asystenta AI.",
    ),
]

_CALQUES: list[tuple[re.Pattern, str, str | None]] = [
    (
        re.compile(
            r"\bdedykowan\w+ (?:rozwiązan|narzędz|ofert|usług)\w+\b|\boferta dedykowan\w+\b",
            _FLAGS,
        ),
        "Kalka 'dedykowany' (z ang. dedicated).",
        "Uzyj: przeznaczony/stworzony dla.",
    ),
    (re.compile(r"\bw oparciu o\b", _FLAGS), "Biurokratyzm/kalka.", "Uzyj: na podstawie."),
    (
        re.compile(r"\b(?:adres\w+|zaadres\w+) (?:problem|potrzeb|wyzwani|kwesti)\w*\b", _FLAGS),
        "Kalka 'adresowac' (z ang. address).",
        "Uzyj: odpowiadac na / rozwiazywac.",
    ),
    (re.compile(r"\bna ten moment\b", _FLAGS), "Kalka 'at the moment'.", "Uzyj: obecnie / teraz."),
    (
        re.compile(r"\bdostarcza\w* wartoś\w+\b", _FLAGS),
        "Korpokalka 'dostarczac wartosc'.",
        "Napisz konkretnie, co to daje.",
    ),
]

_COMMA_AFTER = re.compile(
    r"^(?:Dodatkowo|Ponadto|Niemniej|Jednakże|Mianowicie|Reasumując|Podsumowując|"
    r"Co więcej|Z kolei|Tym samym|W rezultacie|W konsekwencji|W efekcie)\s*,",
    re.IGNORECASE | re.UNICODE,
)


class PunctuationCalqueAnalyzer:
    name = "punctuation_calque"

    def analyze(self, doc: Document) -> AnalyzerResult:
        text = doc.text
        wc = doc.word_count
        findings: list[Finding] = []
        leak_count = 0
        calque_count = 0
        comma_count = 0

        for regex, message in _LEAKS:
            for m in regex.finditer(text):
                leak_count += 1
                findings.append(
                    Finding(
                        analyzer=self.name,
                        label="model_leak",
                        start=m.start(),
                        end=m.end(),
                        severity=Severity.high,
                        message=message,
                        matched_text=m.group(0),
                    )
                )

        for regex, message, suggestion in _CALQUES:
            for m in regex.finditer(text):
                calque_count += 1
                findings.append(
                    Finding(
                        analyzer=self.name,
                        label="calque",
                        start=m.start(),
                        end=m.end(),
                        severity=Severity.low,
                        message=message,
                        suggestion=suggestion,
                        matched_text=m.group(0),
                    )
                )

        for s in doc.sentences:
            m = _COMMA_AFTER.match(s.text)
            if m:
                comma_count += 1
                findings.append(
                    Finding(
                        analyzer=self.name,
                        label="comma_after_adverb",
                        start=s.start + m.start(),
                        end=s.start + m.end(),
                        severity=Severity.info,
                        message="Przecinek po laczniku na poczatku zdania (typowy tik AI).",
                        matched_text=m.group(0),
                    )
                )

        if leak_count > 0:
            score = 100.0
        else:
            density = per_1k(calque_count + comma_count, wc)
            score = saturating(density, 10.0)

        findings.sort(key=lambda f: f.start)
        return AnalyzerResult(
            analyzer=self.name,
            score=clamp(score),
            findings=findings,
            metrics={
                "leaks": float(leak_count),
                "calques": float(calque_count),
                "comma_after_adverb": float(comma_count),
            },
        )
