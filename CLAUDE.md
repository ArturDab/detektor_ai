# CLAUDE.md — Detektor AI slop (PL)

Zwięzły, operacyjny przewodnik dla Claude Code. Szczegóły sesyjne: `docs/HANDOFF.md`.
Decyzje: `docs/DECISIONS.md`. Pełny opis funkcji: `README.md`.

## 0. Zasady odpowiedzi
- **Na końcu KAŻDEJ odpowiedzi** dodaj klikalny link do aplikacji produkcyjnej: <https://detektor-ai.up.railway.app>

## 1. Opis projektu
Webowe narzędzie wykrywające „AI slop" w artykułach **po polsku**. Zwraca dwa
niezależne wskaźniki 0–100 (**slop/jakość** oraz **prawdopodobieństwo autorstwa AI**),
podświetla problematyczne fragmenty i pozwala je **humanizować** (przepisać po ludzku).
Hybryda: deterministyczne heurystyki + opcjonalny sędzia LLM (Gemini).

## 2. Stack i runtime
- Python 3.11; FastAPI + uvicorn; Jinja2; pydantic v2 + pydantic-settings; pyyaml; `google-genai`.
- Frontend: szablon Jinja2 + **vanilla JS** + CSS (font **Geist** z Google Fonts). Brak frameworka JS, brak builda frontu.
- Testy: pytest (LLM mockowany, suite działa offline). Lint/format: ruff. **Typecheck: brak** (nie skonfigurowano mypy).
- Hosting: **Railway**, projekt `detektor_ai`. Wdrożenie przez **natywną integrację GitHub↔Railway**: push/merge na gałąź `claude/ai-slop-detection-tool-ye7nw` → auto-build (Nixpacks). Entrypoint: `detektor_web.app:app`, port z `$PORT`.
- Klucz `GEMINI_API_KEY` ustawiany w panelu Railway (NIE w repo). Bez klucza apka działa w trybie heurystyk.

## 3. Aktualny stan implementacji (zweryfikowane: kod, 32/32 testów, ruff czysto)
- Rdzeń: segmentacja PL, 5 heurystyk, fuzja w 2 wskaźniki, sędzia Gemini (`gemini_judge.py`).
- Endpointy: `GET /healthz`, `GET /api/models`, `POST /api/analyze`, `POST /api/rewrite`, `POST /api/humanize`.
- UI: dwa wskaźniki + werdykt 2×2, jasny redesign (Geist), wybór modelu LLM (dropdown), opcja „Z propozycjami humanizacji".
- Humanizacja: propozycje per fragment (3 + pole własne), podgląd zdania na hover, klik we fragment (popover), „Humanizuj wszystko". Przepisania **równoległe**.
- Diagnostyka błędu LLM: `Report.llm_error` + notatka z „Powód: …".
- Polskie znaki w komunikatach heurystyk/UI/YAML poprawione.

## 4. Aktywna faza
Stabilizacja warstwy LLM na produkcji: potwierdzić, że sędzia i humanizacja działają z modelem **Flash**, i dostroić latencję/UX humanizacji.

## 5. Ukończone fazy
1. Rdzeń heurystyk + fuzja + sędzia LLM (+ tryb bez klucza).
2. Wdrożenie na Railway (live, auto-deploy z GitHub).
3. Diagnostyka błędu LLM + jasny redesign UI (Geist) + werdykt 2×2.
4. Wybór modelu w panelu + dynamiczna lista modeli z Google API (fallback statyczny).
5. Poprawa polskich znaków (heurystyki, dane YAML, UI).
6. Humanizacja: propozycje, podgląd, „Humanizuj wszystko".
7. Zrównoleglenie przepisań (fix „Failed to fetch").

## 6. Następne działania (priorytetowo)
1. **Potwierdzić działanie LLM na produkcji** z modelem Flash (np. `gemini-3-flash-preview` / `gemini-3.5-flash`). Po analizie sprawdzić logi Railway pod kątem błędów `Gemini:`/`Gemini rewrite`.
2. Rozważyć zmianę domyślnego `GEMINI_MODEL` (env w Railway) z `gemini-3.1-pro-preview` na model Flash (Pro bywał wolny/zawodny).
3. Jeśli analiza „z propozycjami" nadal grozi timeoutem (~judge 20 s + przepisania): **przenieść generowanie propozycji w tło** (analiza wraca od razu, propozycje doczytywane osobno przez `/api/rewrite`).
4. (Opcjonalnie) dodać typecheck (mypy/pyright) do toolingu.

## 7. Znane problemy / blokery / ryzyka
- **Sieć sandboxa Claude Code blokuje hosty Railway** (`railway.com`, `backboard.railway.app`, `*.up.railway.app` → „Host not in allowlist"). Nie da się: curlnąć produkcji, użyć Railway CLI z kontenera. Dozwolone: GitHub, npm, Google Fonts, api.anthropic.com. **Do operacji na Railway używaj Railway MCP** (`railway-agent`, `get-status`, `get-logs`).
- Railway MCP (OAuth) bywa **niestabilny / rate-limited**; reconnectuje się okresowo. ZAŁOŻENIE: wymaga aktywnego konektora Railway w aplikacji web.
- **LLM judge z `gemini-3.1-pro-preview` wcześniej zwracał błąd** („Ocena LLM nie powiodła się"); dokładnego powodu dla modelu Pro nie zarejestrowano (prawdopodobnie timeout/model). Z `gemini-3-flash-preview` w logach **brak błędu judge** → ZAŁOŻENIE, że Flash działa (niepotwierdzone end-to-end przez użytkownika).
- Humanizacja jest LLM-zależna: bez działającego klucza/modelu propozycje są puste (degradacja: pole własne + podpowiedź heurystyki).
- Wyznaczona gałąź dev `claude/railway-deployment-completion-iCbZt` jest **przestarzała** — nie używać jej jako bazy.

## 8. Ważne decyzje architektoniczne (skrót; pełne w docs/DECISIONS.md)
- Deploy = **natywna integracja GitHub↔Railway** (nie CLI/MCP), bo sandbox nie ma sieci do Railway.
- Workflow gałęzi: zmiany ląduj **od gałęzi `origin/claude/ai-slop-detection-tool-ye7nw` (HEAD) + cherry-pick + PR + squash-merge**. PR z lokalnej gałęzi sprzed squashy => konflikty.
- LLM zawsze opcjonalny; graceful degradation do heurystyk.
- Model wybierany per-żądanie (walidacja wobec listy dynamicznej ∪ statycznej); domyślny z env `GEMINI_MODEL`.
- Heurystyki sterowane leksykonami YAML (edytowalne bez zmian w kodzie).

## 9. Kluczowe komendy
```bash
# Install
uv venv && uv pip install -e ".[dev]"        # (w sesji użyto python -m venv .venv + pip)
# Dev server
PYTHONPATH=src uvicorn detektor_web.app:app --reload   # http://127.0.0.1:8000
# Test / lint / format
pytest -q
ruff check src tests
ruff format src
# Typecheck: brak (nie skonfigurowano)
# Baza danych / migracje: brak (aplikacja bezstanowa)
```

## 10. Ważne pliki i katalogi
- `src/detektor/` — rdzeń (bez zależności od web): `pipeline.py`, `fusion.py`, `models.py`, `config.py`, `humanize.py`.
  - `heuristics/` + `data/*.yaml` — analizatory i leksykony.
  - `llm/` — `gemini_judge.py` (sędzia), `rewriter.py` (humanizacja), `discovery.py` (lista modeli), `prompts.py`, `schema.py`.
- `src/detektor_web/` — `app.py` (FastAPI, endpointy), `templates/index.html`, `static/app.js`, `static/style.css`.
- `tests/` — pytest. `pyproject.toml`, `requirements.txt`, `Procfile`, `.python-version`, `.env.example`.
- `DEPLOY.md` — historyczny handoff Railway (wdrożenie już zrobione).

## 11. Strefy ostrożności (nie ruszać bez potrzeby)
- W `heuristics/*.py` i `data/*.yaml`: **nie zmieniać regexów, kluczy ani wzorców** — tylko teksty `message`/`suggestion`.
- Logika offsetów: `fusion._locate`, `humanize` (zastosowanie zmian od końca), oraz `app.js` `applyReplacement` (przesuwanie offsetów). Łatwo zepsuć podświetlenia.
- Schematy structured-output (`llm/schema.py`) — zmiana psuje parsowanie odpowiedzi Gemini.
- `Procfile`, `.python-version`, `requirements.txt` — wpływają na build Railway.

## 12. Checklista weryfikacyjna (przed uznaniem zmiany za gotową)
- [ ] `pytest -q` → zielone (obecnie 32).
- [ ] `ruff check src tests` → czysto; `ruff format src`.
- [ ] Serwer wstaje; `GET /healthz` zwraca `{"status":"ok","llm_available":...,"model":...}`.
- [ ] `POST /api/analyze` zwraca `slop`, `ai_provenance`, `findings`.
- [ ] Zmiany frontu zweryfikowane renderem (Playwright/Chromium dostępny w sandboxie).
- [ ] Wdrożenie: zmiana na gałęzi `claude/ai-slop-detection-tool-ye7nw`; po deployu sprawdzić logi przez Railway MCP.

## 13. Najnowsza nota handoff
Wszystko zmergowane do `claude/ai-slop-detection-tool-ye7nw` (HEAD `06cd64f`, #8). Ostatnia zmiana: zrównoleglenie przepisań humanizacji (fix „Failed to fetch": `/api/analyze` z propozycjami trwał 96 s sekwencyjnie). Następny krok: potwierdzić LLM na Flashu i ewentualnie przenieść propozycje w tło. Pełny handoff: `docs/HANDOFF.md`.
