from detektor.config import Settings
from detektor.humanize import humanize_text
from detektor.llm.rewriter import GeminiRewriter


def test_humanize_no_key_returns_unchanged():
    s = Settings(gemini_api_key=None, enable_llm=True)
    text = "Warto zauważyć, że to jest tekst."
    out, changes, error = humanize_text(text, settings=s)
    assert out == text
    assert changes == []
    assert error and "niedostępny" in error.lower()


def test_humanize_applies_rewrites(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: True)
    monkeypatch.setattr(GeminiRewriter, "rewrite", lambda self, q, c="", r="", n=3: ["ZMIANA"])
    s = Settings(gemini_api_key="abc", enable_llm=True)
    text = "Warto zauważyć, że w dzisiejszym dynamicznie zmieniającym się świecie liczy się tempo."
    out, changes, error = humanize_text(text, settings=s)
    assert error is None
    assert changes, "spodziewano sie co najmniej jednej zmiany"
    assert "ZMIANA" in out
    assert out != text


def test_rewriter_parses_json(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: True)
    monkeypatch.setattr(
        GeminiRewriter, "_generate", lambda self, q, c, r, n: '{"proposals": ["a", "b", "a"]}'
    )
    r = GeminiRewriter(Settings(gemini_api_key="abc", enable_llm=True))
    out = r.rewrite("warto zauważyć", n=3)
    assert out == ["a", "b"]  # dedup


def test_rewriter_unavailable_returns_empty():
    r = GeminiRewriter(Settings(gemini_api_key=None, enable_llm=True))
    assert r.rewrite("cokolwiek") == []
