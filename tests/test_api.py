from fastapi.testclient import TestClient

from detektor.llm import GeminiJudge
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
