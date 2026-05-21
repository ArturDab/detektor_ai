"""Konfiguracja aplikacji (czytana z .env / zmiennych srodowiskowych)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Modele Gemini wybieralne w UI (id musi byc rozpoznawane przez API klucza).
# Modele "live"/voice pomijamy - nie nadaja sie do strukturalnego JSON.
MODEL_CHOICES: list[dict[str, str]] = [
    {"id": "gemini-3.5-flash", "label": "Gemini 3.5 Flash — najnowszy, szybki"},
    {"id": "gemini-3-flash-preview", "label": "Gemini 3 Flash (preview)"},
    {"id": "gemini-3.1-flash-lite", "label": "Gemini 3.1 Flash-Lite — najszybszy, tani"},
    {"id": "gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro (preview)"},
    {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro — reasoning"},
    {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash — zbalansowany"},
]

MODEL_IDS: frozenset[str] = frozenset(m["id"] for m in MODEL_CHOICES)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- LLM (Gemini) ---
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-pro-preview"
    enable_llm: bool = True
    llm_timeout_s: float = 20.0
    llm_max_retries: int = 1
    # Humanizacja: krotszy timeout i rownoleglosc, by request nie ciagnal sie minutami.
    rewrite_timeout_s: float = 12.0
    rewrite_concurrency: int = 8

    # --- Segmentacja ---
    use_spacy: bool = False

    # --- Wejscie ---
    max_text_chars: int = 100_000

    # --- Fuzja: udzial LLM w finalnym wskazniku (reszta = heurystyki) ---
    llm_blend_slop: float = 0.5
    llm_blend_ai: float = 0.6

    # --- Kalibracja ---
    # Wspolczynnik krzywej nasycenia dla gestosci fraz slop (na 1000 slow).
    slop_density_k: float = 8.0
    # Maks. pewnosc wskaznikow w trybie "tylko heurystyki".
    heuristics_only_conf_cap_slop: float = 0.75
    heuristics_only_conf_cap_ai: float = 0.6


@lru_cache
def get_settings() -> Settings:
    return Settings()
