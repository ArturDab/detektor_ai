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


def test_rewriter_matches_terminal_punctuation(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: True)
    monkeypatch.setattr(
        GeminiRewriter,
        "_generate",
        lambda self, q, c, r, n: '{"proposals": ["Nowa wersja", "Inna wersja."]}',
    )
    r = GeminiRewriter(Settings(gemini_api_key="abc", enable_llm=True))
    # Cytat z kropka -> obie propozycje musza miec kropke.
    assert r.rewrite("Czas odłożyć snobizm na bok.", n=3) == ["Nowa wersja.", "Inna wersja."]
    # Cytat bez koncowej interpunkcji (srodek zdania) -> kropka usunieta.
    assert r.rewrite("warto zauważyć", n=3) == ["Nowa wersja", "Inna wersja"]


def test_rewriter_retries_once_when_empty(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: True)
    calls = {"n": 0}

    def _gen(self, q, c, r, n):
        calls["n"] += 1
        return '{"proposals": []}' if calls["n"] == 1 else '{"proposals": ["OK."]}'

    monkeypatch.setattr(GeminiRewriter, "_generate", _gen)
    r = GeminiRewriter(Settings(gemini_api_key="abc", enable_llm=True))
    assert r.rewrite("Zdanie.", n=3) == ["OK."]
    assert calls["n"] == 2
