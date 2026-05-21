from pathlib import Path

from detektor.config import Settings
from detektor.llm.schema import Dimensions, FlaggedPassageLLM, GeminiVerdict
from detektor.pipeline import analyze_text

_FIX = Path(__file__).parent / "fixtures"
SLOPPY = (_FIX / "sloppy_pl.txt").read_text(encoding="utf-8")
CLEAN = (_FIX / "clean_pl.txt").read_text(encoding="utf-8")


class FakeJudge:
    def __init__(self, verdict: GeminiVerdict | None = None, available: bool = True) -> None:
        self._verdict = verdict
        self._available = available

    def available(self) -> bool:
        return self._available

    def judge(self, text: str) -> GeminiVerdict | None:
        return self._verdict


def test_sloppy_outscores_clean_heuristics_only():
    s = Settings(enable_llm=False, gemini_api_key=None)
    sloppy = analyze_text(SLOPPY, settings=s, judge=FakeJudge(available=False))
    clean = analyze_text(CLEAN, settings=s, judge=FakeJudge(available=False))

    assert sloppy.slop.score > clean.slop.score
    assert sloppy.ai_provenance.score > clean.ai_provenance.score
    assert sloppy.slop.score > 45
    assert clean.slop.score < 30
    assert clean.ai_provenance.confidence <= s.heuristics_only_conf_cap_ai + 1e-9
    assert sloppy.llm_available is False
    assert sloppy.findings  # sa podswietlenia


def test_llm_blend_and_passage_location():
    verdict = GeminiVerdict(
        ai_likelihood=90,
        slop_score=85,
        confidence=0.8,
        dimensions=Dimensions(
            generic=80, cliche=70, low_information=60, repetition=50, unnatural_rhythm=40
        ),
        flagged_passages=[
            FlaggedPassageLLM(quote="Warto zauważyć", reason="frazes", suggestion="usun")
        ],
        overall_explanation="Tekst mocno generyczny.",
    )
    r = analyze_text(SLOPPY, settings=Settings(), judge=FakeJudge(verdict=verdict, available=True))
    assert r.llm_available is True
    assert r.llm_explanation.startswith("Tekst")
    assert r.dimensions["generic"] == 80
    assert any(f.analyzer == "llm" for f in r.findings)


def test_empty_text_is_safe():
    r = analyze_text("   ", settings=Settings(enable_llm=False), judge=FakeJudge(available=False))
    assert r.word_count == 0
    assert r.slop.score == 0
