# CLAUDE.md — Detektor AI slop (PL)

Zwięzły, operacyjny przewodnik dla Claude Code. Szczegóły sesyjne: `docs/HANDOFF.md`.
Decyzje: `docs/DECISIONS.md`. Pełny opis funkcji: `README.md`.

## 0. Zasady odpowiedzi
- **Na końcu KAŻDEJ odpowiedzi** dodaj klikalny link do aplikacji produkcyjnej: <https://detektor-ai.up.railway.app>
- **Zawsze włączaj auto-merge** na tworzonych PR-ach (`enable_pr_auto_merge`, metoda `squash`) i oznaczaj PR jako gotowy do scalenia, aby scalał się automatycznie po spełnieniu wymagań.
- **Domyślny tryb pracy = „implementuj i wdróż" (opcja 1).** Po zaakceptowaniu kierunku/zadania prowadź pełen cykl bez dopytywania: kod → `pytest` + `ruff` + `node --check` → commit → PR → auto-merge (squash) → **merge do `main` = deploy** (Railway auto-deployuje z `main`). NIE zatrzymuj się na „sam plan" ani „wstrzymaj deploy", chyba że użytkownik wyraźnie poprosi inaczej dla konkretnego zadania.
- **Po każdym handoffie** (aktualizacji `docs/HANDOFF.md`) wklej jego **pełną treść nowej sekcji** bezpośrednio w odpowiedzi w czacie jako blok kodu gotowy do skopiowania — nie tylko podsumowanie, nie tylko tabela. Użytkownik musi móc skopiować go wprost z czatu do nowej konwersacji.

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

## 3. Aktualny stan implementacji (zweryfikowane: kod, 34/34 testów, ruff czysto, Faza 8 ukończona)
- Rdzeń: segmentacja PL, 5 heurystyk, fuzja w 2 wskaźniki, sędzia Gemini (`gemini_judge.py`). **Backend bez zmian logiki** — Faza 8 dotyka tylko CSS/JS/HTML.
- Endpointy: `GET /healthz`, `GET /api/models`, `POST /api/analyze` (param `humanize`, `judge`), `POST /api/rewrite`, `POST /api/humanize`.
- **Tryb heurystyczny na żądanie:** `analyze_text(..., use_llm=False)` / `/api/analyze {"judge": false}` pomija sędziego LLM — używane do live-przeliczania ocen.
- **UI = Faza 8 „Material 3 / Grammarly"** (font Geist, akcent zielony `#10894e` / `#34d399` dark). Stan po Fazach 8.1–8.9:
  - **Topbar** (sticky, `--topbar-h: 56px`): logo + `<select id="model-select">` (prawa strona) + theme-toggle.
  - **Prawa kolumna `.col-right`** (sticky, scroll): `.sidebar-controls` (Analizuj + Z propozycjami + status) → `#abar-results` (ScoreBar: kolorowe liczby Slop/AI + werdykt + akcje + toggle Szczegóły) → `#analysis-expand` (`.score-card-v2` slop + `.ai-indicator` AI segmented bar + `.dimension-list` wymiary LLM) → `#finding-nav` (← N/M → · ✓ Zastosuj · Załaduj wszystkie) → `#proposals-empty` / `#proposals-panel`.
  - **Lewa kolumna** (`.col-left` / `.text-pane`): textarea → spinner → `#highlighted`. `setLeftMode("edit"|"loading"|"view")`.
  - **ScoreCard v2:** duża liczba + pasek (`data-level: ok/warn/bad`). **AIIndicator:** 10-segmentowy pasek (`active-low/medium/high`). **DimensionRow:** `.dimension-list` + `.dimension-row` z paskiem i wartością.
  - **FindingItem:** left-border severity stripe (`.sev-high` = czerwony, `.sev-medium` = bursztyn, `.sev-low/.sev-info` = niebieski). Active = zielony left-border + shadow.
  - **Word diff preview:** `wordDiff()` → `previewHTML()` — hover propozycji pokazuje diff inline (`.diff-del` przekreślone czerwone / `.diff-ins` zielone tło).
  - **Motion 8.8:** `mark.mark-applied` flash (CSS z 8.4, trigger JS w 8.8), `.score-pop` po `refreshScores`, `#highlighted` fade-in przy trybie view.
  - **Synchronizacja:** klik `<mark>` → `navigateTo(idx)` → `scrollToFinding` + `scrollToMark`. Klawiatura: ←/→ / Enter.
  - **Bulk-load:** `loadAllProposals()` — ładuje równolegle, znika gdy gotowe.
  - **Live oceny:** `refreshScores(judge:false)` po każdej zamianie — NIE rusza findings/podświetleń.
- Humanizacja: propozycje per fragment (3 + pole własne), diff inline, przepisania równoległe.
- Diagnostyka błędu LLM: `Report.llm_error` + notatka „Powód: …".

## 4. Aktywna faza
**Faza 8 UKOŃCZONA (PR #52–#57, merge do `main`).** Weryfikacja wizualna na produkcji po deployu (brak Chromium lokalnie). Następny priorytet: potwierdzenie działania LLM Flash end-to-end + ewentualne dalsze poprawki UX na podstawie produkcji.

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
13. **Pełny redesign UI wg kitu „3 Free Text Editor"** (Geist + Slate + Indigo, unified right panel, `display:contents`, popover, radiobuttony modeli) (#21–#25).
14. **Redesign v5 „compact bar + 2 kolumny”** (#27–#30).
16. **Faza 8 — rewolucja graficzna „Material 3 / Grammarly”** (#48–#57): tokeny CSS + akcent zielony (8.1), layout/grid (8.2), komponenty + toast (8.3), editor marks (8.4), sidebar controls bez `#analysis-bar` (8.5), ScoreCard v2 + AIIndicator + DimensionRow CSS+JS (8.6), findings left-stripe + word-diff preview (8.7), motion micro-interactions (8.8), dead-code cleanup (8.9).

## 6. Następne działania (priorytetowo)
1. **Zweryfikować Fazę 8 na produkcji** (wizualnie) po deploy — brak Chromium lokalnie.
2. **Potwierdzić LLM Flash end-to-end** — logi Railway pod `Gemini:`/`Gemini rewrite`.
3. Rozważyć zmianę domyślnego `GEMINI_MODEL` (env Railway) z `gemini-3.1-pro-preview` na Flash.
4. (Opcjonalnie) usunąć legacy CSS aliasy (`--bg`, `--surface`, `--accent` itp.) po weryfikacji wizualnej.
5. (Opcjonalnie) typecheck (mypy/pyright).

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
- **Konflikt merge = "save → reset → restore"** (gdy main awansował przed push): skopiuj zmienione pliki do /tmp, `git checkout -B branch origin/main`, przywróć pliki, commit, `push --force-with-lease`. Sprawdzone wielokrotnie w tej sesji (PR #28/#29/#30).
- **Layout Faza 8:** brak `#analysis-bar`; prawa kolumna `.col-right` sticky `top: calc(var(--topbar-h) + 12px)`. NIE używać `display:contents`, `.popover`, `--abar-h` (usunięte w 8.5/8.9).
- **`#finding-nav` przez `style.display`** (nie `.hidden`) — `updateNav()` ustawia `flex`/`none` bezpośrednio, by ominąć problemy ze specyficznością CSS.
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
- `src/detektor_web/` — `app.py` (`_curate()`, `_speed_hint()`, `_with_model()`), `templates/index.html` (`.sidebar-controls`, `#abar-results`, `#analysis-expand` z `.score-card-v2`/`.ai-indicator`/`.dimension-list`, `#finding-nav`, `#proposals-empty`/`#proposals-panel`), `static/app.js` (~830 linii: `setLeftMode`, `refreshScores`, `formatRichHtml`, `renderScores`, `renderDimensions`, `wordDiff`, `previewHTML`, `triggerScorePop`, `navigateTo`/`scrollToFinding`/`scrollToMark`, `updateNav`, `loadAllProposals`), `static/style.css` (~1640 linii, tokeny kanoniczne `--color-*` + aliasy).
- `tests/` — pytest. `pyproject.toml`, `requirements.txt`, `Procfile`, `.python-version`, `.env.example`.

## 11. Strefy ostrożności (nie ruszać bez potrzeby)
- **Offsety:** `fusion._locate`, `humanize` (zmiany od końca), `app.js applyReplacement` — łatwo zepsuć podświetlenia.
- **`llm/schema.py`** — zmiana psuje parsowanie structured-output Gemini.
- **`heuristics/*.py` i `data/*.yaml`** — nie zmieniać regexów/kluczy; tylko teksty `message`/`suggestion`.
- **`Procfile`, `.python-version`, `requirements.txt`** — wpływają na build Railway.
- **CSS — krytyczne reguły:**
  - `.hidden { display: none !important }` — MUSI mieć `!important`; inne reguły ustawiają `display` z niższą specyficznością.
  - `#finding-nav` jest sterowany z JS przez `style.display` (inline) — reguła CSS dla `.finding-nav` nie powinna wymuszać `display`.
  - Legacy aliasy `--accent`, `--bg`, `--surface` itp. wciąż aktywne w CSS — nie usuwać bez pełnego search-and-replace.
- **`app.js`:**
  - `setLeftMode` steruje widocznością textarea/spinnera/podświetleń; `refreshScores` celowo NIE rusza listy fragmentów ani podświetleń.
  - `formatRichHtml` — heurystyka nagłówków jest delikatna (polskie słowa-łączniki, próg 72 zn., koniec zdania `.!?…`). Zmiana progu/regexu może zepsuć podział na akapity vs nagłówki.
  - `renderReport` owija render w `try/catch`, by `updateNav()` zawsze się wykonał i pasek nawigacji zawsze się pojawił.

## 12. Checklista weryfikacyjna (przed uznaniem zmiany za gotową)
- [ ] `.venv/bin/pytest -q` → 34 zielone.
- [ ] `.venv/bin/ruff check src tests` → czysto; `ruff format src`.
- [ ] `node --check src/detektor_web/static/app.js` → OK (przy zmianach JS).
- [ ] Serwer wstaje; `GET /healthz` → `{"status":"ok","llm_available":...,"model":...}`.
- [ ] `POST /api/analyze` → `slop`, `ai_provenance`, `findings`; `{"judge": false}` → brak `llm_error`.
- [ ] Render frontu: **lokalnie niemożliwy (brak Chromium)** — zweryfikuj na produkcji po deployu.
- [ ] Deploy: scal PR do `main` (squash) → Railway auto-build; sprawdź `list-deployments` (branch `main`, SUCCESS).

## 13. Najnowsza nota handoff
`main` po Fazie 8 (#52–#57 squash-merge, 2026-05-28). **Faza 8 UKOŃCZONA**: kompletny redesign graficzny (Material 3 / Grammarly) wdrożony przez 9 faz. Backend bez zmian. Weryfikacja wizualna na produkcji konieczna (brak Chromium lokalnie). Następny krok: deploy + weryfikacja + LLM Flash end-to-end. Pełny handoff: `docs/HANDOFF.md`.
