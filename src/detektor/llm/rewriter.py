"""Przepisywanie fragmentow na bardziej ludzkie (humanizacja) przez Gemini.

Wzorzec jak GeminiJudge: leniwy import SDK, timeout, lapanie bledow.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging

from ..config import Settings, get_settings
from .prompts import REWRITE_SYSTEM, build_rewrite_prompt
from .schema import RewriteProposals

log = logging.getLogger(__name__)


class GeminiRewriter:
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

    def rewrite(self, quote: str, context: str = "", reason: str = "", n: int = 3) -> list[str]:
        self.last_error = None
        if not self.available() or not quote.strip():
            return []
        try:
            raw = self._generate(quote, context, reason, n)
            parsed = raw if isinstance(raw, RewriteProposals) else RewriteProposals.model_validate(
                json.loads(raw)
            )
            seen: set[str] = set()
            out: list[str] = []
            for p in parsed.proposals:
                p = p.strip()
                if p and p not in seen:
                    seen.add(p)
                    out.append(p)
            return out[:n]
        except Exception as exc:  # noqa: BLE001 - humanizacja zawsze opcjonalna
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            log.warning("Gemini rewrite nieudany (model=%s): %s", self.settings.gemini_model, exc)
            return []

    def _generate(self, quote: str, context: str, reason: str, n: int) -> str | RewriteProposals:
        """Wywolanie SDK; zwraca surowy JSON. Nadpisywane w testach (mock)."""
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        config = types.GenerateContentConfig(
            system_instruction=REWRITE_SYSTEM,
            response_mime_type="application/json",
            response_schema=RewriteProposals,
            temperature=0.8,
        )

        def _call():
            return client.models.generate_content(
                model=self.settings.gemini_model,
                contents=build_rewrite_prompt(quote, context, reason, n),
                config=config,
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            response = executor.submit(_call).result(timeout=self.settings.llm_timeout_s)

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, RewriteProposals):
            return parsed
        return response.text
