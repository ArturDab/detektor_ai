"""Laczenie sub-score'ow heurystyk i oceny LLM w dwa finalne wskazniki."""

from __future__ import annotations

import re
from statistics import mean

from .config import Settings
from .llm.schema import GeminiVerdict
from .models import (
    AnalyzerResult,
    Finding,
    FlaggedPassage,
    IndexResult,
    Report,
    ScoreContribution,
    Severity,
    band_for,
)

# Wagi heurystyk per wskaznik (sumuja sie do 1.0). Tunowalne w jednym miejscu.
SLOP_WEIGHTS: dict[str, float] = {
    "slop_phrases": 0.35,
    "lexical_diversity": 0.25,
    "rhythm": 0.15,
    "structural": 0.15,
    "punctuation_calque": 0.10,
}
AI_WEIGHTS: dict[str, float] = {
    "punctuation_calque": 0.30,
    "rhythm": 0.25,
    "lexical_diversity": 0.20,
    "structural": 0.15,
    "slop_phrases": 0.10,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _weighted_index(
    scores: dict[str, float], weights: dict[str, float]
) -> tuple[float, list[float]]:
    num = den = 0.0
    used: list[float] = []
    for name, w in weights.items():
        if name in scores:
            num += scores[name] * w
            den += w
            used.append(scores[name])
    return (num / den if den else 0.0), used


def _agreement(scores: list[float]) -> float:
    if len(scores) < 2:
        return 0.6
    m = mean(scores)
    var = mean((s - m) ** 2 for s in scores)
    return max(0.0, min(1.0, 1 - var / 2500.0))


def _confidence(
    word_count: int, verdict_conf: float | None, agreement: float, cap: float | None
) -> float:
    length_factor = min(1.0, word_count / 300.0)
    base = (0.25 + 0.55 * length_factor) * (0.6 + 0.4 * agreement)
    if verdict_conf is not None:
        conf = 0.5 * base + 0.5 * verdict_conf
    else:
        conf = base
        if cap is not None:
            conf = min(conf, cap)
    return round(max(0.1, min(0.97, conf)), 2)


def _locate(text: str, quote: str) -> tuple[int, int] | None:
    quote = (quote or "").strip()
    if len(quote) < 4:
        return None
    idx = text.find(quote)
    if idx >= 0:
        return idx, idx + len(quote)
    parts = [re.escape(w) for w in quote.split() if w]
    if not parts:
        return None
    m = re.search(r"\s+".join(parts), text)
    return (m.start(), m.end()) if m else None


def _dedupe(findings: list[Finding]) -> list[Finding]:
    seen: set[tuple[int, int, str]] = set()
    out: list[Finding] = []
    for f in findings:
        key = (f.start, f.end, f.message)
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


def fuse(
    *,
    text: str,
    word_count: int,
    results: list[AnalyzerResult],
    verdict: GeminiVerdict | None,
    settings: Settings,
    judge_available: bool,
    llm_error: str | None = None,
) -> Report:
    scores = {r.analyzer: r.score for r in results}
    findings: list[Finding] = [f for r in results for f in r.findings]
    notes: list[str] = []

    heur_slop, slop_used = _weighted_index(scores, SLOP_WEIGHTS)
    heur_ai, ai_used = _weighted_index(scores, AI_WEIGHTS)

    flagged: list[FlaggedPassage] = []
    dimensions: dict[str, int] = {}
    explanation: str | None = None
    verdict_conf: float | None = None

    if verdict is not None:
        bs, ba = settings.llm_blend_slop, settings.llm_blend_ai
        slop_val = (1 - bs) * heur_slop + bs * verdict.slop_score
        ai_val = (1 - ba) * heur_ai + ba * verdict.ai_likelihood
        slop_break = [
            ScoreContribution(
                name="heurystyki", score=round(heur_slop, 1), weight=round(1 - bs, 2)
            ),
            ScoreContribution(
                name="LLM (Gemini)", score=float(verdict.slop_score), weight=round(bs, 2)
            ),
        ]
        ai_break = [
            ScoreContribution(name="heurystyki", score=round(heur_ai, 1), weight=round(1 - ba, 2)),
            ScoreContribution(
                name="LLM (Gemini)", score=float(verdict.ai_likelihood), weight=round(ba, 2)
            ),
        ]
        for p in verdict.flagged_passages:
            flagged.append(FlaggedPassage(quote=p.quote, reason=p.reason, suggestion=p.suggestion))
            loc = _locate(text, p.quote)
            if loc:
                findings.append(
                    Finding(
                        analyzer="llm",
                        label="llm_passage",
                        start=loc[0],
                        end=loc[1],
                        severity=Severity.medium,
                        message=p.reason,
                        suggestion=p.suggestion or None,
                        matched_text=p.quote[:120],
                    )
                )
        dimensions = verdict.dimensions.model_dump()
        explanation = verdict.overall_explanation
        verdict_conf = verdict.confidence
    else:
        slop_val, ai_val = heur_slop, heur_ai
        slop_break = [ScoreContribution(name="heurystyki", score=round(heur_slop, 1), weight=1.0)]
        ai_break = [ScoreContribution(name="heurystyki", score=round(heur_ai, 1), weight=1.0)]
        if judge_available:
            msg = "Ocena LLM nie powiodła się — wynik wyłącznie heurystyczny."
            if llm_error:
                msg += f" Powód: {llm_error}"
            notes.append(msg)
        else:
            notes.append(
                "LLM niedostępny (brak klucza/SDK) — ocena wyłącznie heurystyczna, niższa pewność."
            )

    if word_count < 30:
        notes.append("Tekst bardzo krótki — wyniki mają charakter orientacyjny.")

    slop_cap = None if verdict else settings.heuristics_only_conf_cap_slop
    ai_cap = None if verdict else settings.heuristics_only_conf_cap_ai
    slop_conf = _confidence(word_count, verdict_conf, _agreement(slop_used), slop_cap)
    ai_conf = _confidence(word_count, verdict_conf, _agreement(ai_used), ai_cap)

    findings = _dedupe(findings)
    findings.sort(key=lambda f: (f.start, f.end))

    return Report(
        text=text,
        word_count=word_count,
        slop=IndexResult(
            score=round(_clamp(slop_val), 1),
            confidence=slop_conf,
            band=band_for(slop_val),
            breakdown=slop_break,
        ),
        ai_provenance=IndexResult(
            score=round(_clamp(ai_val), 1),
            confidence=ai_conf,
            band=band_for(ai_val),
            breakdown=ai_break,
        ),
        findings=findings,
        flagged_passages=flagged,
        dimensions=dimensions,
        analyzer_scores={k: round(v, 1) for k, v in scores.items()},
        llm_available=verdict is not None,
        llm_explanation=explanation,
        llm_error=llm_error,
        notes=notes,
    )
