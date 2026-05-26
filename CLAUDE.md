# CLAUDE.md — Detektor AI slop (PL)

Zwięzły, operacyjny przewodnik dla Claude Code. Szczegóły sesyjne: `docs/HANDOFF.md`.
Decyzje: `docs/DECISIONS.md`. Pełny opis funkcji: `README.md`.

## 0. Zasady odpowiedzi
- **Na końcu KAŻDEJ odpowiedzi** dodaj klikalny link do aplikacji produkcyjnej: <https://detektor-ai.up.railway.app>
- **Zawsze włączaj auto-merge** na tworzonych PR-ach (`enable_pr_auto_merge`, metoda `squash`) i oznaczaj PR jako gotowy do scalenia, aby scalał się automatycznie po spełnieniu wymagań.
- **Po każdym handoffie** (aktualizacji `docs/HANDOFF.md`) wklej jego **pełną treść** bezpośrednio w odpowiedzi w czacie — nie tylko podsumowanie.

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
- **Gałąź integracyjna = `main`** (PR-y celują w `main`, squash-merge). **Railway auto-deployuje z `main`** (panel: service `web` → Settings → Source → Branch = `main`, „Auto deploys when pushed to GitHub" = ON, „Wait for CI" = OFF — brak CI w repo). Deploy = po prostu merge PR do `main`.
- Klucz `GEMINI_API_KEY` ustawiany w panelu Railway (NIE w repo). Bez klucza apka działa w trybie heurystyk.

## 3. Aktualny stan implementacji (zweryfikowane: kod, 34/34 testów, ruff czysto, deploy #25 z `main`)
- Rdzeń: segmentacja PL, 5 heurystyk, fuzja w 2 wskaźniki, sędzia Gemini (`gemini_judge.py`).
- Endpointy: `GET /healthz`, `GET /api/models`, `POST /api/analyze` (param `humanize`, `judge`), `POST /api/rewrite`, `POST /api/humanize`.
- **Tryb heurystyczny na żądanie:** `analyze_text(..., use_llm=False)` / `/api/analyze {"judge": false}` pomija sędziego LLM — używane do live-przeliczania ocen.
- **UI (układ dwukolumnowy) — po pełnym redesignie wg kitu Figmy (Geist + Slate + Indigo):**
  - Lewa kolumna = karta `text-pane`: textarea (wsad) → nakładka spinner → podświetlony tekst. Textarea wypełnia viewport (`calc(100vh - topbar - 200px)`). Przycisk „Edytuj / wklej nowy" wraca do edycji. Stany: `setLeftMode("edit"|"loading"|"view")`.
  - Prawa kolumna = **unified panel card** (`.col-right`): sekcje (controls, results-bar, verdict, scores, llm-box, panels) to bezpośrednie dzieci `.col-right`, dzięki `.results { display: contents }`. Sticky scroll; sekcje rozdzielone `border-bottom`.
  - Radiobuttony do wyboru modelu (kurowana lista 3–4 modeli Gemini, bez modeli do generowania obrazów).
  - Formatowanie tekstu: `formatParagraphs()` dzieli na `<p class="hl-p">` i wykrywa nagłówki (`.hl-heading` ≤70 znaków, bez kropki na końcu).
  - **Brak jednostronnych obramowań dekoracyjnych** — popover, pop-quote, verdict, finding .quote, .note mają symetryczne bordy lub tło (kolor nastroju werdyktu = tło: ok=zielony, warn=bursztynowy).
  - **Oceny na bieżąco:** `refreshScores()` przelicza heurystycznie po każdej zamianie propozycji.
  - **„Kopiuj cały tekst"** (sticky pasek akcji) + „Humanizuj wszystko".
- Humanizacja: propozycje per fragment (3 + pole własne), podgląd w stałym slocie, przepisania równoległe.
- Diagnostyka błędu LLM: `Report.llm_error` + notatka „Powód: …".

## 4. Aktywna faza
Weryfikacja wizualna redesignu na produkcji (render lokalny niemożliwy — brak Chromium). Równolegle otwarte: potwierdzenie sędziego/humanizacji na Flash end-to-end.

## 5. Ukończone fazy
1. Rdzeń heurystyk + fuzja + sędzia LLM (+ tryb bez klucza).
2. Wdrożenie na Railway (live, auto-deploy z GitHub).
3. Diagnostyka błędu LLM + redesign UI (Geist) + werdykt 2×2.
4. Wybór modelu w panelu + dynamiczna lista modeli z Google API (fallback statyczny).
5. Poprawa polskich znaków (heurystyki, dane YAML, UI).
6. Humanizacja: propozycje, podgląd, „Humanizuj wszystko".
7. Zrównoleglenie przepisań (fix „Failed to fetch").
8. Układ dwukolumnowy, live przeliczanie ocen, „Kopiuj cały tekst", stały slot podglądu (#10).
9. Jedno okno tekstu (wsad/spinner/podświetlenia), fix `.hidden` (#11–#12).
10. Gałąź `main` + auto-merge (squash); migracja źródła deployu Railway na `main` (#13–#14).
11. Fix timeoutu propozycji (`rewrite_timeout_s` 12→30 s) + etykiety modeli (#14).
12. Fix popovera (wychodzi poza viewport → `position: fixed` + przycinanie) (#18).
13. **Pełny redesign UI wg kitu Figmy** (Geist + Slate + Indigo, unified right panel, accordion, `display:contents` na `.results`, karty findings/popover, radiobuttony modeli, `formatParagraphs`) (#21–#24).
14. **Usunięcie jednostronnych obramowań + textarea wypełnia viewport** (#25).

## 6. Następne działania (priorytetowo)
1. **Zweryfikować nowy UI na produkcji** (wizualnie, bo render lokalnie niemożliwy): unified panel, karty propozycji, radiobuttony modeli, formatowanie tekstu (akapity/nagłówki), brak indygowego paska na popoverze, textarea duże, werdykt bez lewego bordera.
2. **Potwierdzić LLM Flash end-to-end** — sprawdzić logi Railway pod `Gemini:`/`Gemini rewrite` dla modelu `gemini-3-flash-preview` lub `gemini-3.5-flash`.
3. Rozważyć zmianę domyślnego `GEMINI_MODEL` (env Railway) z `gemini-3.1-pro-preview` na Flash (szybciej, mniej błędów).
4. (Opcjonalnie) typecheck (mypy/pyright); propozycje w tle dla modeli Pro.

## 7. Znane problemy / blokery / ryzyka
- **Brak Chromium/Playwright** — zmian frontu NIE da się zweryfikować lokalnie; wyłącznie na produkcji po deployu.
- **Sieć sandboxa blokuje hosty Railway** (`*.up.railway.app` → „Host not in allowlist"): brak curla produkcji. Operacje Railway → Railway MCP.
- **Railway agent (MCP) bywa rate-limited** („Agent usage limit reached"). `get-status`/`get-logs`/`list-deployments` działają niezależnie.
- **Zmiana gałęzi-triggera Railway tylko z panelu UI** (nie MCP). „Wait for CI" MUSI być OFF.
- **LLM judge z `gemini-3.1-pro-preview` wcześniej zwracał błąd** — ZAŁOŻENIE, że Flash działa (niepotwierdzone end-to-end po redesignie).
- Brak CI/checków w repo → `enable_pr_auto_merge` wymaga branch protection (nie skonfigurowanej) → w praktyce merge ręczny `merge_pull_request` (squash).
- Przestarzałe gałęzie (nie używać jako bazy): `claude/railway-deployment-completion-iCbZt`, stare dev-branche sesji redesignu.

## 8. Ważne decyzje architektoniczne (skrót; pełne w docs/DECISIONS.md)
- Deploy = **natywna integracja GitHub↔Railway** (nie CLI/MCP — sandbox nie ma sieci do Railway).
- **`main` = gałąź integracyjna**; dev-branch opieraj na `origin/main`, PR → `main`, squash-merge. Po squashu: `git checkout -B <dev> origin/main` (force-with-lease po push).
- **Konflikt merge = "save CSS → reset → restore"** (gdy main awansował przed push): wyciągnij zmienione pliki do /tmp, `git checkout -B branch origin/main`, przywróć pliki, commit, push.
- **`.results { display: contents }`** — dzieci `.results` renderują bezpośrednio jako dzieci `.col-right`, co umożliwia sticky results-bar i jednolite obramowanie panelu bez zagnieżdżania kart.
- **Live oceny** = `/api/analyze` z `judge=false`; lista fragmentów/podświetlenia zarządzane lokalnie.
- LLM zawsze opcjonalny; graceful degradation do heurystyk. Model per-żądanie.

## 9. Kluczowe komendy
```bash
# Install
python -m venv .venv && .venv/bin/pip install -e ".[dev]"   # lub: uv venv && uv pip install -e ".[dev]"
# Dev server
PYTHONPATH=src .venv/bin/uvicorn detektor_web.app:app --reload   # http://127.0.0.1:8000
# Test / lint / format
.venv/bin/pytest -q                        # 34 testów
.venv/bin/ruff check src tests
.venv/bin/ruff format src
node --check src/detektor_web/static/app.js   # sanity JS (brak builda)
# Typecheck: brak (nie skonfigurowano). Baza/migracje: brak (apka bezstanowa).

# Deploy: scal PR do main (squash) → Railway auto-build z main.
# Railway MCP: get-status / get-logs / list-deployments
#   (project dc230d9e..., env 533baa05..., service 24b213f8...)
# GitHub MCP: create_pull_request → merge_pull_request (squash)
#   auto-merge NIE działa (brak branch protection) → merge ręcznie
```

## 10. Ważne pliki i katalogi
- `src/detektor/` — rdzeń: `pipeline.py`, `fusion.py`, `models.py`, `config.py` (`CURATED_MODEL_IDS`), `humanize.py`.
  - `heuristics/` + `data/*.yaml` — analizatory i leksykony.
  - `llm/` — `gemini_judge.py`, `rewriter.py`, `discovery.py`, `prompts.py`, `schema.py`.
- `src/detektor_web/` — `app.py` (`_curate()`, `_speed_hint()`, `_with_model()`), `templates/index.html` (radiobuttony modelu, `word-count`), `static/app.js` (`setLeftMode`, `refreshScores`, `formatParagraphs`, `loadModels`, `selectedModel`), `static/style.css` (~840 linii, tokeny w `:root`).
- `tests/` — pytest. `pyproject.toml`, `requirements.txt`, `Procfile`, `.python-version`, `.env.example`.

## 11. Strefy ostrożności (nie ruszać bez potrzeby)
- **Offsety:** `fusion._locate`, `humanize` (zmiany od końca), `app.js applyReplacement` — łatwo zepsuć podświetlenia.
- **`llm/schema.py`** — zmiana psuje parsowanie structured-output Gemini.
- **`heuristics/*.py` i `data/*.yaml`** — nie zmieniać regexów/kluczy; tylko teksty `message`/`suggestion`.
- **`Procfile`, `.python-version`, `requirements.txt`** — wpływają na build Railway.
- **CSS — krytyczne reguły:**
  - `.hidden { display: none !important }` — MUSI mieć `!important`; inne reguły ustawiają `display` z niższą specyficznością.
  - `.results { display: contents }` + `.results.hidden { display: none !important }` — umożliwia unified panel; nie dodawać `display` do `.results` w innych regułach.
  - `.col-right .card { background: transparent; border: none; box-shadow: none }` — strippuje indywidualne style kart wewnątrz prawej kolumny.
  - Reguły `.panel` MUSZĄ być scoped do `.col-right .panel` — inaczej wyciekają do `.text-pane-head h3` (był bug: chevron i kreska w lewej kolumnie).
  - `.col-right .results-bar { background: var(--surface-2) }` — musi mieć przynajmniej równą specyficzność co `.col-right .card { background: transparent }`, inaczej pasek akcji staje się przezroczysty.
- **`app.js`:** `setLeftMode` steruje widocznością textarea/spinnera/podświetleń; `refreshScores` celowo NIE rusza listy fragmentów ani podświetleń.

## 12. Checklista weryfikacyjna (przed uznaniem zmiany za gotową)
- [ ] `.venv/bin/pytest -q` → 34 zielone.
- [ ] `.venv/bin/ruff check src tests` → czysto; `ruff format src`.
- [ ] `node --check src/detektor_web/static/app.js` → OK (przy zmianach JS).
- [ ] Serwer wstaje; `GET /healthz` → `{"status":"ok","llm_available":...,"model":...}`.
- [ ] `POST /api/analyze` → `slop`, `ai_provenance`, `findings`; `{"judge": false}` → brak `llm_error`.
- [ ] Render frontu: **lokalnie niemożliwy (brak Chromium)** — zweryfikuj na produkcji po deployu.
- [ ] Deploy: scal PR do `main` (squash) → Railway auto-build; sprawdź `list-deployments` (branch `main`, SUCCESS).

## 13. Najnowsza nota handoff
`main` = `9c97dc1` (#25); Railway auto-deploy uruchomiony po merge. W tej sesji: **pełny redesign UI wg kitu Figmy** (Geist + Slate + Indigo, unified right panel z `display:contents`, radiobuttony modeli, `formatParagraphs`, kurowana lista modeli `CURATED_MODEL_IDS`) w PR-ach #21–#24; następnie **usunięcie jednostronnych obramowań** (popover `border-top`, pop-quote/verdict/finding-quote `border-left`, note `border-left`) + **textarea wypełnia viewport** (`calc(100vh - topbar - 200px)`) w PR #25. **Najpilniejsze:** wizualna weryfikacja na produkcji (brak Chromium lokalnie). Pełny handoff: `docs/HANDOFF.md`.
