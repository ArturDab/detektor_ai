from fastapi.testclient import TestClient

from detektor.llm import GeminiJudge
from detektor.llm.rewriter import GeminiRewriter
from detektor_web.app import app

client = TestClient(app)


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_index_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "Detektor AI slop" in r.text


def test_analyze_endpoint(monkeypatch):
    monkeypatch.setattr(GeminiJudge, "available", lambda self: False)
    payload = {
        "text": "Warto zauważyć, że to jest przykładowy tekst do analizy w tym właśnie teście."
    }
    r = client.post("/api/analyze", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "slop" in data and "ai_provenance" in data
    assert data["llm_available"] is False


def test_analyze_rejects_empty():
    r = client.post("/api/analyze", json={"text": ""})
    assert r.status_code == 422


def test_models_endpoint():
    r = client.get("/api/models")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["models"], list) and data["models"]
    assert all("id" in m and "label" in m for m in data["models"])
    assert "default" in data


def test_analyze_rejects_unknown_model():
    r = client.post("/api/analyze", json={"text": "Przykładowy tekst.", "model": "nope-123"})
    assert r.status_code == 400


def test_analyze_accepts_known_model(monkeypatch):
    monkeypatch.setattr(GeminiJudge, "available", lambda self: False)
    r = client.post(
        "/api/analyze",
        json={"text": "Przykładowy tekst do analizy w teście.", "model": "gemini-2.5-flash"},
    )
    assert r.status_code == 200


def test_analyze_with_humanize_attaches_proposals(monkeypatch):
    monkeypatch.setattr(GeminiJudge, "available", lambda self: False)
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: True)
    monkeypatch.setattr(GeminiRewriter, "rewrite", lambda self, q, c="", r="", n=3: ["a", "b", "c"])
    text = "Warto zauważyć, że w dzisiejszym dynamicznie zmieniającym się świecie liczy się tempo."
    r = client.post("/api/analyze", json={"text": text, "humanize": True})
    assert r.status_code == 200
    findings = r.json()["findings"]
    assert any(f["proposals"] for f in findings)
    assert any(f["context"] for f in findings)


def test_rewrite_no_key(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: False)
    r = client.post("/api/rewrite", json={"quote": "warto zauważyć"})
    assert r.status_code == 200
    assert r.json()["proposals"] == []
    assert r.json()["error"]


def test_rewrite_with_mock(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: True)
    monkeypatch.setattr(
        GeminiRewriter, "rewrite", lambda self, q, c="", r="", n=3: ["wariant 1", "wariant 2"]
    )
    r = client.post("/api/rewrite", json={"quote": "warto zauważyć", "reason": "frazes"})
    assert r.status_code == 200
    assert r.json()["proposals"] == ["wariant 1", "wariant 2"]


def test_humanize_no_key(monkeypatch):
    monkeypatch.setattr(GeminiRewriter, "available", lambda self: False)
    r = client.post("/api/humanize", json={"text": "Warto zauważyć, że to tekst."})
    assert r.status_code == 200
    assert r.json()["text"] == "Warto zauważyć, że to tekst."
    assert r.json()["error"]
