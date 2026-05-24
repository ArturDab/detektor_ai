# CLAUDE.md — Detektor AI slop (PL)

Zwięzły, operacyjny przewodnik dla Claude Code. Szczegóły sesyjne: `docs/HANDOFF.md`.
Decyzje: `docs/DECISIONS.md`. Pełny opis funkcji: `README.md`.

## 0. Zasady odpowiedzi
- **Na końcu KAŻDEJ odpowiedzi** dodaj klikalny link do aplikacji produkcyjnej: <https://detektor-ai.up.railway.app>
- **Zawsze włączaj auto-merge** na tworzonych PR-ach (`enable_pr_auto_merge`, metoda `squash`) i oznaczaj PR jako gotowy do scalenia, aby scalał się automatycznie po spełnieniu wymagań.

## 1. Opis projektu
Webowe narzędzie wykrywające „AI slop" w artykułach **po polsku**. Zwraca dwa
niezależne wskaźniki 0–100 (**slop/jakość** oraz **prawdopodobieństwo autorstwa AI**),
podświetla problematyczne fragmenty i pozwala je **humanizować** (przepisać po ludzku).
Hybryda: deterministyczne heurystyki + opcjonalny sędzia LLM (Gemini).

## 2. Stack i runtime
- Python 3.11; FastAPI + uvicorn; Jinja2; pydantic v2 + pydantic-settings; pyyaml; `google-genai`.
- Frontend: szablon Jinja2 + **vanilla JS** + CSS (font **Geist** z Google Fonts). Brak frameworka JS, brak builda frontu.
- Testy: pytest (LLM mockowany, suite działa offline). Lint/format: ruff. **Typecheck: brak** (nie skonfigurowano mypy).
- Hosting: **Railway**, projekt `detektor_ai`, env `production`, service `web`. Wdrożenie przez **natywną integrację GitHub↔Railway** → auto-build (Nixpacks). Entrypoint: `detektor_web.app:app`, port z `$PORT`.
- **Gałąź integracyjna = `main`** (PR-y celują w `main`, squash-merge). **UWAGA:** Railway nadal auto-deployuje z gałęzi **`claude/ai-slop-detection-tool-ye7nw`** (źródła w panelu Railway jeszcze nie przełączono na `main` — patrz §6/§7). Deploy = fast-forward tej gałęzi do `main` (patrz §9).
- Klucz `GEMINI_API_KEY` ustawiany w panelu Railway (NIE w repo). Bez klucza apka działa w trybie heurystyk.

## 3. Aktualny stan implementacji (zweryfikowane: kod, 32/32 testów, ruff czysto, deploy #12 SUCCESS)
- Rdzeń: segmentacja PL, 5 heurystyk, fuzja w 2 wskaźniki, sędzia Gemini (`gemini_judge.py`).
- Endpointy: `GET /healthz`, `GET /api/models`, `POST /api/analyze` (param `humanize`, `judge`), `POST /api/rewrite`, `POST /api/humanize`.
- **Tryb heurystyczny na żądanie:** `analyze_text(..., use_llm=False)` / `/api/analyze {"judge": false}` pomija sędziego LLM (szybko, bez kosztu) — używane do live-przeliczania ocen.
- **UI (układ dwukolumnowy):**
  - Lewa kolumna = **jedno okno tekstu**: textarea (wsad) → nakładka ze spinnerem na czas analizy → podświetlony tekst z propozycjami w tym samym oknie. Przycisk „Edytuj / wklej nowy" wraca do edycji. Stany: `setLeftMode("edit"|"loading"|"view")` w `app.js`.
  - Prawa kolumna (sticky) = „Analizuj" + wybór modelu + opcje na górze; werdykt 2×2, dwa wskaźniki, wymiary, lista propozycji — **ukryte do pierwszej analizy**.
  - **Oceny na bieżąco:** po zastosowaniu propozycji `refreshScores()` przelicza wskaźniki heurystycznie (`judge=false`), bez czekania/kosztu; pełna ocena LLM po ponownym „Analizuj".
  - **„Kopiuj cały tekst"** (sticky pasek akcji) + „Humanizuj wszystko".
- Humanizacja: propozycje per fragment (3 + pole własne), podgląd zdania w **stałym slocie** (nie „skacze") — w liście i w popoverze, klik we fragment (popover), „Humanizuj wszystko". Przepisania **równoległe**.
- Diagnostyka błędu LLM: `Report.llm_error` + notatka z „Powód: …". Polskie znaki w heurystykach/UI/YAML OK.

## 4. Aktywna faza
Migracja produkcji na gałąź `main` (przełączyć źródło deployu Railway na `main`) + weryfikacja nowego UI na produkcji. Równolegle wciąż otwarte: potwierdzenie sędziego/humanizacji na modelu **Flash** end-to-end.

## 5. Ukończone fazy
1. Rdzeń heurystyk + fuzja + sędzia LLM (+ tryb bez klucza).
2. Wdrożenie na Railway (live, auto-deploy z GitHub).
3. Diagnostyka błędu LLM + jasny redesign UI (Geist) + werdykt 2×2.
4. Wybór modelu w panelu + dynamiczna lista modeli z Google API (fallback statyczny).
5. Poprawa polskich znaków (heurystyki, dane YAML, UI).
6. Humanizacja: propozycje, podgląd, „Humanizuj wszystko".
7. Zrównoleglenie przepisań (fix „Failed to fetch").
8. Układ dwukolumnowy, live przeliczanie ocen (`use_llm`/`judge`), „Kopiuj cały tekst", stały slot podglądu (#10).
9. Jedno okno tekstu (wsad/spinner/podświetlenia), sterowanie+oceny w prawej kolumnie, fix popovera (#11); fix `.hidden` (loader/legenda zasłaniały pole — #12).
10. Utworzenie gałęzi `main` + zasada auto-merge (squash) w §0.

## 6. Następne działania (priorytetowo)
1. **Przełączyć źródło deployu Railway na `main`** (panel: service `web` → Settings → Source → Branch = `main`) — z kontenera się nie udało (agent rate-limited). Do tego czasu deploy = fast-forward `claude/ai-slop-detection-tool-ye7nw` do `main` (§9).
2. **Zweryfikować nowy UI na produkcji** (render lokalnie niemożliwy — brak Chromium): jedno okno (wsad→spinner→podświetlenia), prawa kolumna z „Analizuj", live oceny, kopiowanie, popover bez „skakania".
3. **Potwierdzić LLM na produkcji** modelem Flash (np. `gemini-3-flash-preview` / `gemini-3.5-flash`); sprawdzić logi Railway pod `Gemini:`/`Gemini rewrite`.
4. Rozważyć zmianę domyślnego `GEMINI_MODEL` (env Railway) z `gemini-3.1-pro-preview` na Flash.
5. (Opcjonalnie) propozycje w tle, jeśli „z propozycjami" grozi timeoutem; dodać typecheck (mypy/pyright).

## 7. Znane problemy / blokery / ryzyka
- **Railway nadal śledzi `claude/ai-slop-detection-tool-ye7nw`, nie `main`.** Migracja źródła wymaga panelu Railway lub agenta (gdy nie rate-limited).
- **Railway agent (MCP) bywa rate-limited** („Agent usage limit reached") — w tej sesji nie dało się nim zmienić gałęzi źródłowej. `get-status`/`get-logs`/`list-deployments` działały.
- **Sieć sandboxa blokuje hosty Railway** (`*.up.railway.app` itp. → „Host not in allowlist"): brak curla produkcji/CLI. Dozwolone: GitHub, npm, Google Fonts, api.anthropic.com. Operacje na Railway → Railway MCP.
- **Brak Chromium/Playwright w tym środowisku** — zmian frontu NIE da się zweryfikować renderem lokalnie; weryfikacja dopiero po deployu na produkcji.
- **LLM judge z `gemini-3.1-pro-preview` wcześniej zwracał błąd**; z `gemini-3-flash-preview` brak błędu w logach → ZAŁOŻENIE, że Flash działa (niepotwierdzone end-to-end).
- Humanizacja jest LLM-zależna: bez klucza/modelu propozycje puste (degradacja: pole własne + podpowiedź heurystyki).
- Brak skonfigurowanego CI/checków w repo → auto-merge nie ma na co czekać; w praktyce PR scala się od razu (squash) ręcznym `merge_pull_request`.
- Przestarzałe gałęzie (nie używać jako bazy): `claude/railway-deployment-completion-iCbZt`.

## 8. Ważne decyzje architektoniczne (skrót; pełne w docs/DECISIONS.md)
- Deploy = **natywna integracja GitHub↔Railway** (nie CLI/MCP), bo sandbox nie ma sieci do Railway.
- **`main` to gałąź integracyjna**; dev-branch opieraj na `origin/main`, PR → `main`, squash-merge. Po squashu lokalny dev-branch przebazuj na `origin/main` (`git checkout -B <dev> origin/main`, force-with-lease).
- **Deploy obecnie = fast-forward** gałęzi `claude/ai-slop-detection-tool-ye7nw` do `main` (`git push origin origin/main:refs/heads/claude/ai-slop-detection-tool-ye7nw`) — do czasu przełączenia źródła Railway na `main`.
- **Live oceny** = drugie wywołanie `/api/analyze` z `judge=false` (heurystyki), aktualizuje tylko wskaźniki; lista fragmentów/podświetlenia zarządzane lokalnie po stronie frontu.
- LLM zawsze opcjonalny; graceful degradation do heurystyk. Model per-żądanie (domyślny z env `GEMINI_MODEL`). Heurystyki sterowane YAML.

## 9. Kluczowe komendy
```bash
# Install
python -m venv .venv && .venv/bin/pip install -e ".[dev]"   # lub: uv venv && uv pip install -e ".[dev]"
# Dev server
PYTHONPATH=src .venv/bin/uvicorn detektor_web.app:app --reload   # http://127.0.0.1:8000
# Test / lint / format
.venv/bin/pytest -q
.venv/bin/ruff check src tests
.venv/bin/ruff format src
# JS: brak builda; sanity: node --check src/detektor_web/static/app.js
# Typecheck: brak (nie skonfigurowano). Baza/migracje: brak (apka bezstanowa).

# Deploy na produkcję (do czasu przełączenia źródła Railway na main):
git fetch origin main
git push origin origin/main:refs/heads/claude/ai-slop-detection-tool-ye7nw   # fast-forward -> auto-build
# status/logi: Railway MCP get-status / get-logs (project dc230d9e..., env 533baa05..., service 24b213f8...)
```

## 10. Ważne pliki i katalogi
- `src/detektor/` — rdzeń (bez web): `pipeline.py` (`analyze_text`, param `use_llm`), `fusion.py`, `models.py`, `config.py`, `humanize.py`.
  - `heuristics/` + `data/*.yaml` — analizatory i leksykony.
  - `llm/` — `gemini_judge.py`, `rewriter.py`, `discovery.py`, `prompts.py`, `schema.py`.
- `src/detektor_web/` — `app.py` (endpointy; `AnalyzeRequest.judge`), `templates/index.html` (układ dwukolumnowy), `static/app.js` (`setLeftMode`, `refreshScores`, `copyAll`, `PREVIEW_HINT`), `static/style.css`.
- `tests/` — pytest. `pyproject.toml`, `requirements.txt`, `Procfile`, `.python-version`, `.env.example`.
- `DEPLOY.md` — historyczny handoff Railway.

## 11. Strefy ostrożności (nie ruszać bez potrzeby)
- W `heuristics/*.py` i `data/*.yaml`: **nie zmieniać regexów, kluczy ani wzorców** — tylko teksty `message`/`suggestion`.
- Logika offsetów: `fusion._locate`, `humanize` (zmiany od końca), `app.js` `applyReplacement` (przesuwanie offsetów). Łatwo zepsuć podświetlenia.
- Schematy structured-output (`llm/schema.py`) — zmiana psuje parsowanie odpowiedzi Gemini.
- `Procfile`, `.python-version`, `requirements.txt` — wpływają na build Railway.
- **CSS:** utility `.hidden` MUSI mieć `display: none !important` — inne reguły (`.text-loader`, `.legend`) ustawiają `display` i przy równej specyficzności by je nadpisały (był bug: loader zasłaniał pole tekstu).
- `app.js`: `setLeftMode` steruje widocznością textarea/spinnera/podświetleń; `refreshScores` celowo NIE rusza listy fragmentów ani podświetleń (tylko wskaźniki).

## 12. Checklista weryfikacyjna (przed uznaniem zmiany za gotową)
- [ ] `.venv/bin/pytest -q` → zielone (obecnie 32).
- [ ] `.venv/bin/ruff check src tests` → czysto; `ruff format src`.
- [ ] `node --check src/detektor_web/static/app.js` → OK (zmiany JS).
- [ ] Serwer wstaje; `GET /healthz` zwraca `{"status":"ok","llm_available":...,"model":...}`.
- [ ] `POST /api/analyze` zwraca `slop`, `ai_provenance`, `findings`; `{"judge": false}` → bez `llm_error`.
- [ ] Render frontu: **lokalnie niemożliwy (brak Chromium)** — zweryfikuj na produkcji po deployu.
- [ ] Deploy: fast-forward `claude/ai-slop-detection-tool-ye7nw` → `main`; po deployu sprawdź logi przez Railway MCP.

## 13. Najnowsza nota handoff
`main` = `7372d19` (#12); produkcja na tym commicie (deploy #12 SUCCESS). W tej sesji: układ dwukolumnowy + live oceny + kopiowanie (#10), jedno okno tekstu ze spinnerem + sterowanie/oceny w prawej kolumnie + fix popovera (#11), fix `.hidden` (loader zasłaniał pole — #12), utworzenie gałęzi `main` i zasada auto-merge. **Najpilniejsze:** przełączyć źródło deployu Railway na `main` (panel) i zweryfikować nowy UI na produkcji. Pełny handoff: `docs/HANDOFF.md`.
