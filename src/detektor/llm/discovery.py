"""Dynamiczne pobieranie listy modeli Gemini z API Google (z fallbackiem).

Jesli jest klucz i SDK, pytamy API o modele wspierajace generateContent.
W razie braku klucza/SDK lub bledu — zwracamy statyczna liste z config.MODEL_CHOICES.
"""

from __future__ import annotations

import logging
import time

from ..config import MODEL_CHOICES, Settings

log = logging.getLogger(__name__)

_TTL_S = 3600.0
_cache: dict[str, object] = {"ts": 0.0, "models": None}


def _fetch_from_google(settings: Settings) -> list[dict[str, str]] | None:
    if not settings.gemini_api_key:
        return None
    try:
        from google import genai
    except ImportError:
        return None
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        out: list[dict[str, str]] = []
        for m in client.models.list():
            name = (getattr(m, "name", "") or "").split("/")[-1]
            if not name.startswith("gemini"):
                continue
            methods = (
                getattr(m, "supported_actions", None)
                or getattr(m, "supported_generation_methods", None)
                or []
            )
            if "generateContent" not in set(methods):
                continue
            label = getattr(m, "display_name", None) or name
            out.append({"id": name, "label": label})
        # Deduplikacja po id, zachowujac kolejnosc.
        seen: set[str] = set()
        uniq = [x for x in out if not (x["id"] in seen or seen.add(x["id"]))]
        return uniq or None
    except Exception as exc:  # noqa: BLE001 - lista modeli zawsze opcjonalna
        log.warning("Nie udalo sie pobrac listy modeli z Google: %s", exc)
        return None


def list_available_models(settings: Settings) -> tuple[list[dict[str, str]], str]:
    """Zwraca (lista_modeli, zrodlo) gdzie zrodlo to 'google' albo 'static'."""
    now = time.time()
    cached = _cache.get("models")
    if cached and now - float(_cache["ts"]) < _TTL_S:  # type: ignore[arg-type]
        return cached, "google"  # type: ignore[return-value]

    fetched = _fetch_from_google(settings)
    if fetched:
        _cache["models"] = fetched
        _cache["ts"] = now
        return fetched, "google"
    return list(MODEL_CHOICES), "static"
