"""Klient sedziego Gemini: ustrukturyzowane JSON, timeout, retry, fallback.

Import SDK jest leniwy, dzieki czemu aplikacja dziala (tryb heurystyczny) nawet
bez zainstalowanego google-genai lub bez klucza API.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging

from ..config import Settings, get_settings
from .prompts import SYSTEM_INSTRUCTION, build_user_prompt
from .schema import GeminiVerdict

log = logging.getLogger(__name__)


class GeminiJudge:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.last_error: str | None = None

    def available(self) -> bool:
        s = self.settings
        if not s.enable_llm or not s.gemini_api_key:
            return False
        try:
            import google.genai  # noqa: F401
        except ImportError:
            return False
        return True

    def judge(self, text: str) -> GeminiVerdict | None:
        self.last_error = None
        if not self.available() or not text.strip():
            return None
        attempts = max(1, self.settings.llm_max_retries + 1)
        for i in range(attempts):
            try:
                return self._parse(self._generate(text))
            except Exception as exc:  # noqa: BLE001 - LLM zawsze opcjonalny
                self.last_error = f"{type(exc).__name__}: {exc}"[:300]
                log.warning("Gemini: proba %d/%d nieudana: %s", i + 1, attempts, exc)
        log.error(
            "Gemini: wszystkie proby nieudane (model=%s): %s",
            self.settings.gemini_model,
            self.last_error,
        )
        return None

    def _generate(self, text: str) -> str:
        """Wywolanie SDK; zwraca surowy JSON. Nadpisywane w testach (mock)."""
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=GeminiVerdict,
            temperature=0.0,
        )

        def _call():
            return client.models.generate_content(
                model=self.settings.gemini_model,
                contents=build_user_prompt(text),
                config=config,
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            response = executor.submit(_call).result(timeout=self.settings.llm_timeout_s)

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, GeminiVerdict):
            return parsed.model_dump_json()
        return response.text

    @staticmethod
    def _parse(raw: str | GeminiVerdict) -> GeminiVerdict:
        if isinstance(raw, GeminiVerdict):
            return raw
        return GeminiVerdict.model_validate(json.loads(raw))
