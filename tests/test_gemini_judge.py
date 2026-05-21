from detektor.config import Settings
from detektor.llm.gemini_judge import GeminiJudge
from detektor.llm.schema import GeminiVerdict


def test_unavailable_without_key():
    judge = GeminiJudge(Settings(gemini_api_key=None, enable_llm=True))
    assert judge.available() is False
    assert judge.judge("dowolny tekst") is None


def test_disabled_flag_blocks_llm():
    judge = GeminiJudge(Settings(gemini_api_key="abc", enable_llm=False))
    assert judge.available() is False


def test_judge_parses_generated_json(monkeypatch):
    judge = GeminiJudge(Settings(gemini_api_key="abc", enable_llm=True))
    monkeypatch.setattr(GeminiJudge, "available", lambda self: True)
    payload = GeminiVerdict(ai_likelihood=12, slop_score=34, confidence=0.5).model_dump_json()
    monkeypatch.setattr(GeminiJudge, "_generate", lambda self, text: payload)
    verdict = judge.judge("tekst")
    assert verdict is not None
    assert verdict.ai_likelihood == 12
    assert verdict.slop_score == 34


def test_judge_returns_none_on_error(monkeypatch):
    judge = GeminiJudge(Settings(gemini_api_key="abc", enable_llm=True))
    monkeypatch.setattr(GeminiJudge, "available", lambda self: True)

    def boom(self, text):
        raise RuntimeError("api down")

    monkeypatch.setattr(GeminiJudge, "_generate", boom)
    assert judge.judge("tekst") is None
    assert judge.last_error is not None
    assert "api down" in judge.last_error
