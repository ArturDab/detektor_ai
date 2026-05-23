# HANDOFF — sesja humanizacji + stabilizacja LLM

Stan na koniec sesji. Fakty oparte na kodzie, git, testach i logach Railway.
Założenia oznaczone jako ZAŁOŻENIE.

## Gdzie jest kod (źródło prawdy)
- Gałąź produkcyjna (auto-deploy): **`claude/ai-slop-detection-tool-ye7nw`**, HEAD **`06cd64f`** (#8).
- Lokalne working tree: czyste, gałąź `fix/humanize-latency` (= ef7d5d1, treściowo równe deployowej).
- **Przestarzałe (nie używać jako bazy):** `claude/railway-deployment-completion-iCbZt` (HEAD `3b7795f`).

## Co zmieniono w tej sesji (chronologicznie, wszystko zmergowane)
1. **#1** Diagnostyka błędu LLM (`Report.llm_error`, `GeminiJudge.last_error`) + jasny redesign UI, werdykt 2×2, schowany żargon.
2. **Geist** — typografia z Google Fonts.
3. **#3** Poprawki polskich znaków w komunikatach (heurystyki, UI) + dane YAML.
4. **#4** Wybór modelu LLM w panelu (`GET /api/models`, `model` w `/api/analyze`).
5. **#5** Dynamiczna lista modeli z Google API (`llm/discovery.py`) + fallback statyczny; więcej polskich znaków w `slop_phrases_pl.yaml`.
6. **#6** Humanizacja: `llm/rewriter.py`, `humanize.py`, `POST /api/rewrite`, `POST /api/humanize`; popover w UI, kolory fragmentów, „Humanizuj wszystko".
7. **#7** Propozycje liczone **od razu** przy analizie (opcja `humanize` w `/api/analyze`, `Finding.proposals`/`Finding.context`), podgląd zdania na hover, propozycje inline w „Wykryte fragmenty".
8. **#8** Zrównoleglenie przepisań (`ThreadPoolExecutor`), `rewrite_timeout_s=12`, `rewrite_concurrency=8`, limit fragmentów 8; czytelny komunikat przy timeout. Fix „Failed to fetch".

## Co działa (potwierdzone)
- Tryb heurystyczny (bez klucza) — analiza, wskaźniki, podświetlenia, fragmenty.
- Endpointy `/healthz`, `/api/models` (źródło `static` bez klucza), `/api/analyze`, `/api/rewrite`, `/api/humanize` — graceful bez klucza.
- UI: render zweryfikowany (Playwright): redesign, Geist, dropdown modeli, popover, inline propozycje, hover-podgląd, zastosowanie własnej wersji.
- 32/32 testów, ruff czysto.
- Deploy na Railway działa (auto-build po merge'u; ostatni deploy SUCCESS).

## Co jeszcze nie działa / niepewne
- **LLM judge z `gemini-3.1-pro-preview`**: wcześniej w UI „Ocena LLM nie powiodła się". Dokładnego powodu dla Pro nie zarejestrowano.
- **Z modelem `gemini-3-flash-preview`**: w logach brak błędu judge (analiza zwróciła 200) → ZAŁOŻENIE: judge działa na Flashu. Niepotwierdzone przez użytkownika end-to-end.
- **Humanizacja z propozycjami**: jeden rewrite na Flashu **timeoutował 20 s** (przed fixem). Po zrównolegleniu powinno być ~kilkanaście s — **niepotwierdzone na produkcji po #8**.

## Rekomendowane następne zadanie (dokładnie)
1. Poproś użytkownika, by wykonał na produkcji: (a) **sama analiza** modelem Flash, (b) **analiza z propozycjami**.
2. Przez Railway MCP pociągnij logi i potwierdź brak błędów `Gemini:`/`Gemini rewrite` oraz czas `POST /api/analyze`:
   - projectId `dc230d9e-ba34-44d2-8793-baa7ddae9924`, env `533baa05-7e6b-46c8-b942-d5c3c3f2bb40`, serviceId `24b213f8-0457-4d60-a393-28eb4bd58102`.
3. Jeśli judge działa stabilnie tylko na Flashu — zaproponuj zmianę env `GEMINI_MODEL` w Railway na model Flash (zmiana w panelu, nie w repo).
4. Jeśli „z propozycjami" nadal grozi timeoutem → przenieś generowanie propozycji w tło: `/api/analyze` zwraca od razu, front dociąga propozycje per fragment z `/api/rewrite` (już istnieje) leniwie/asynchronicznie.

## Pliki najprawdopodobniej istotne w kolejnej sesji
- `src/detektor/humanize.py`, `src/detektor/llm/rewriter.py`, `src/detektor/llm/gemini_judge.py`, `src/detektor/config.py`.
- `src/detektor_web/app.py` (endpointy), `src/detektor_web/static/app.js` (UI humanizacji), `templates/index.html`.
- `src/detektor/llm/discovery.py` (lista modeli).

## Komendy uruchomione w tej sesji i wyniki
- `pytest -q` → **32 passed**.
- `ruff check src tests` / `ruff format` → **czysto**.
- Render UI (Playwright/Chromium) → OK (redesign, popover, inline propozycje, hover-podgląd, zastosowanie zmiany).
- Railway MCP `get-status` → ostatni deploy **SUCCESS**.
- Railway MCP `get-logs` → `POST /api/analyze` 96 s (przed #8); `Gemini rewrite nieudany (model=gemini-3-flash-preview):` (timeout 20 s).

## Komendy, które kolejna sesja powinna uruchomić
```bash
uv venv && uv pip install -e ".[dev]"   # lub: python -m venv .venv && pip install -e ".[dev]"
pytest -q
ruff check src tests
PYTHONPATH=src uvicorn detektor_web.app:app --reload   # smoke /healthz, /api/analyze
```
Na produkcji: Railway MCP `get-logs` (deploy+http) po teście użytkownika.

## Otwarte pytania / niepewności
- Czy `GEMINI_API_KEY` jest ustawiony w Railway? ZAŁOŻENIE: tak (UI pokazywało „Ocena LLM…" => judge_available=True). Niepotwierdzone wprost.
- Jaki jest aktualny `GEMINI_MODEL` (env) na produkcji? Domyślnie `gemini-3.1-pro-preview`; użytkownik wybierał Flash w UI (per-żądanie, nie env).
- Czy judge i humanizacja działają stabilnie end-to-end na Flashu po #8? Do potwierdzenia logami + testem użytkownika.
- Czy Railway MCP będzie połączony w nowej sesji? Bywa rozłączony/rate-limited.
