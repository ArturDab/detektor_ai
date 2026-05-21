from detektor.config import Settings
from detektor.fusion import fuse
from detektor.models import AnalyzerResult

_NAMES = ["slop_phrases", "lexical_diversity", "rhythm", "structural", "punctuation_calque"]


def _results(score: float) -> list[AnalyzerResult]:
    return [AnalyzerResult(analyzer=n, score=score) for n in _NAMES]


def test_heuristics_only_caps_confidence_and_adds_note():
    s = Settings()
    r = fuse(
        text="x",
        word_count=400,
        results=_results(50.0),
        verdict=None,
        settings=s,
        judge_available=False,
    )
    assert r.ai_provenance.confidence <= s.heuristics_only_conf_cap_ai + 1e-9
    assert r.slop.confidence <= s.heuristics_only_conf_cap_slop + 1e-9
    assert r.llm_available is False
    assert any("niedostepny" in n.lower() for n in r.notes)
    # srednia wazona rownych wynikow = 50
    assert abs(r.slop.score - 50.0) < 1e-6


def test_llm_error_propagates_to_report_and_notes():
    s = Settings()
    r = fuse(
        text="x",
        word_count=400,
        results=_results(50.0),
        verdict=None,
        settings=s,
        judge_available=True,
        llm_error="NotFound: 404 model not found",
    )
    assert r.llm_error == "NotFound: 404 model not found"
    assert any("Powod: NotFound" in n for n in r.notes)


def test_bands_track_score():
    s = Settings()
    low = fuse(
        text="x",
        word_count=120,
        results=_results(10.0),
        verdict=None,
        settings=s,
        judge_available=False,
    )
    high = fuse(
        text="x",
        word_count=120,
        results=_results(90.0),
        verdict=None,
        settings=s,
        judge_available=False,
    )
    assert low.slop.band == "niski"
    assert high.slop.band == "wysoki"
