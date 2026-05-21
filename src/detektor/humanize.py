"""Humanizacja: automatyczne przepisanie wykrytych fragmentow na bardziej ludzkie."""

from __future__ import annotations

import concurrent.futures

from .config import Settings, get_settings
from .llm.rewriter import GeminiRewriter
from .models import Finding, Report
from .pipeline import analyze_text
from .text import segment

_CTX = 80  # ile znakow kontekstu z kazdej strony fragmentu
_MAX_FRAGMENTS = 8  # limit wywolan LLM na jedna humanizacje


def _rewrite_many(
    rewriter: GeminiRewriter,
    settings: Settings,
    jobs: list[tuple[Finding, str, str]],
    n: int,
) -> dict[int, list[str]]:
    """Rownolegle przepisuje fragmenty. Klucz wyniku: id(finding)."""
    if not jobs:
        return {}
    workers = max(1, min(len(jobs), settings.rewrite_concurrency))

    def _one(job: tuple[Finding, str, str]) -> tuple[int, list[str]]:
        f, quote, ctx = job
        return id(f), rewriter.rewrite(quote, ctx, f.message or "", n=n)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        return dict(ex.map(_one, jobs))


def _pick_fragments(findings: list[Finding]) -> list[Finding]:
    """Nienakladajace sie fragmenty (greedy), posortowane po offsetach."""
    chosen: list[Finding] = []
    last_end = -1
    for f in sorted(findings, key=lambda f: (f.start, -f.end)):
        if f.end > f.start and f.start >= last_end:
            chosen.append(f)
            last_end = f.end
    return chosen[:_MAX_FRAGMENTS]


def attach_proposals(
    report: Report,
    text: str,
    settings: Settings | None = None,
    rewriter: GeminiRewriter | None = None,
) -> str | None:
    """Dolacza 3 propozycje + zdanie-kontekst do wykrytych fragmentow (in-place).

    Zwraca komunikat bledu, gdy LLM niedostepny; w przeciwnym razie None.
    """
    settings = settings or get_settings()
    rewriter = rewriter or GeminiRewriter(settings)
    if not rewriter.available():
        return "LLM niedostępny — propozycje wymagają klucza API."

    doc = segment(text, use_spacy=settings.use_spacy)
    sents = [(s.start, s.start + len(s.text), s.text) for s in doc.sentences]

    def sentence_for(start: int, end: int) -> str:
        for a, b, t in sents:
            if a <= start and end <= b:
                return t
        return text[max(0, start - _CTX) : min(len(text), end + _CTX)]

    chosen = _pick_fragments(report.findings)
    jobs: list[tuple[Finding, str, str]] = []
    for f in chosen:
        ctx = sentence_for(f.start, f.end)
        f.context = ctx
        jobs.append((f, text[f.start : f.end], ctx))
    props_by = _rewrite_many(rewriter, settings, jobs, n=3)
    for f in chosen:
        f.proposals = props_by.get(id(f), [])
    return None


def humanize_text(
    text: str,
    settings: Settings | None = None,
    rewriter: GeminiRewriter | None = None,
) -> tuple[str, list[dict], str | None]:
    """Zwraca (nowy_tekst, lista_zmian, blad). Kazda zmiana: {quote, replacement}."""
    settings = settings or get_settings()
    rewriter = rewriter or GeminiRewriter(settings)
    if not rewriter.available():
        return text, [], "LLM niedostępny — humanizacja wymaga klucza API."

    report = analyze_text(text, settings=settings)
    chosen = _pick_fragments(report.findings)
    if not chosen:
        return text, [], None

    jobs: list[tuple[Finding, str, str]] = [
        (f, text[f.start : f.end], text[max(0, f.start - _CTX) : min(len(text), f.end + _CTX)])
        for f in chosen
    ]
    props_by = _rewrite_many(rewriter, settings, jobs, n=1)

    changes: list[dict] = []
    new_text = text
    # Od konca, by offsety z oryginalu pozostaly wazne dla wczesniejszych fragmentow.
    for f in sorted(chosen, key=lambda f: f.start, reverse=True):
        quote = text[f.start : f.end]
        props = props_by.get(id(f), [])
        if props and props[0] != quote:
            new_text = new_text[: f.start] + props[0] + new_text[f.end :]
            changes.append({"quote": quote, "replacement": props[0]})

    changes.reverse()
    return new_text, changes, rewriter.last_error if not changes else None
