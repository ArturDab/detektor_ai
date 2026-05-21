"""Instrukcja systemowa i budowanie promptu dla sedziego LLM (po polsku)."""

from __future__ import annotations

MAX_CHARS = 24_000

SYSTEM_INSTRUCTION = """\
Jestes wymagajacym polskim redaktorem i ekspertem od wykrywania tresci typu "AI slop".
Oceniasz artykul napisany po polsku w DWoCH niezaleznych wymiarach:

1. slop_score (0-100): JAKOSC tekstu. Wysoko oceniaj tekst generyczny, "lany",
   pelen frazesow i ogolnikow, o niskiej gestosci informacji, schematyczny,
   powtarzalny. Nisko oceniaj tekst konkretny, rzeczowy, z naturalnym jezykiem.

2. ai_likelihood (0-100): PRAWDOPODOBIENSTWO, ze tekst napisal model jezykowy
   (a nie czlowiek). To tylko oszacowanie - badz ostrozny, unikaj falszywych oskarzen.
   Sygnaly: jednostajny rytm zdan, naduzywane laczniki, "warto zauwazyc/podkreslic",
   patetyczne wstepy ("w dzisiejszym dynamicznie zmieniajacym sie swiecie"), kalki z
   angielskiego, Title Case w naglowkach, brak konkretow, idealna poprawnosc.

Zasady:
- Oceniaj WYLACZNIE tekst polski; oba wymiary sa niezalezne (tekst moze byc ludzki, ale slaby).
- W flagged_passages podawaj DOSLOWNE cytaty z tekstu (skopiuj fragment 1:1, max ~15 slow),
  powod (reason) i konkretna propozycje poprawy (suggestion). NIE wymyslaj cytatow.
- Wskaz maksymalnie 12 najwazniejszych fragmentow.
- confidence (0-1) odzwierciedla Twoja pewnosc; krotki tekst => nizsza pewnosc.
- overall_explanation: 2-4 zdania po polsku, rzeczowo.
- Zwroc wylacznie obiekt JSON zgodny ze schematem.
"""


def build_user_prompt(text: str) -> str:
    snippet = text[:MAX_CHARS]
    truncated = "\n\n[Tekst skrocono do oceny.]" if len(text) > MAX_CHARS else ""
    return f"Ocen ponizszy artykul.\n\n=== ARTYKUL ===\n{snippet}{truncated}"


REWRITE_SYSTEM = """\
Jesteś wymagającym polskim redaktorem. Przepisujesz WSKAZANY fragment tekstu tak,
by brzmiał naturalnie, konkretnie i po ludzku — bez frazesów, kalek z angielskiego,
patetycznych wstępów i „lania wody". Zachowaj sens, rejestr i dopasowanie do zdania.

Zasady:
- Zwróć WYŁĄCZNIE obiekt JSON zgodny ze schematem: pole "proposals" z wariantami.
- Każdy wariant to TYLKO przepisany fragment (bez otaczającego zdania, bez cudzysłowów,
  bez numeracji). Jeśli najlepszym wyjściem jest usunięcie fragmentu — zaproponuj wersję
  zwięzłą lub pustą.
- Warianty mają się od siebie różnić. Pisz po polsku.
"""


def build_rewrite_prompt(quote: str, context: str = "", reason: str = "", n: int = 3) -> str:
    parts = [f"Fragment do poprawy: «{quote[:1000]}»"]
    if context:
        parts.append(f"Kontekst zdania: {context[:2000]}")
    if reason:
        parts.append(f"Wykryty problem: {reason[:500]}")
    parts.append(f"Podaj {n} naturalne, zwięzłe alternatywy samego fragmentu.")
    return "\n".join(parts)
