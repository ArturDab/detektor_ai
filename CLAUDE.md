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

## 3. Aktualny stan implementacji (zweryfikowane: kod, 34/34 testów, ruff czysto, deploy #30 `cccb5df` z `main`, SUCCESS)
- Rdzeń: segmentacja PL, 5 heurystyk, fuzja w 2 wskaźniki, sędzia Gemini (`gemini_judge.py`). **Backend bez zmian logiki od dawna** — redesigny dotykają tylko CSS/JS/HTML/config.
- Endpointy: `GET /healthz`, `GET /api/models`, `POST /api/analyze` (param `humanize`, `judge`), `POST /api/rewrite`, `POST /api/humanize`.
- **Tryb heurystyczny na żądanie:** `analyze_text(..., use_llm=False)` / `/api/analyze {"judge": false}` pomija sędziego LLM — używane do live-przeliczania ocen.
- **UI = redesign v5 „compact bar + dwie kolumny"** (font Geist, paleta Slate + Indigo). UWAGA: poprzedni „unified panel" z `display:contents`, `.popover` i radiobuttonami modeli ZOSTAŁ USUNIĘTY — opis poniżej to stan faktyczny:
  - **Górna sticky belka analizy** (`#analysis-bar`, 2 kompaktowe rzędy po ~52px):
    - Rząd 1 (`.abar-controls`, zawsze widoczny): `Analizuj` · `<select id="model-select">` (kurowana lista modeli) · checkbox „Z propozycjami" · status.
    - Rząd 2 (`#abar-results`, po analizie): liczby Slop/AI (kolorowy tekst, nie SVG) · werdykt headline · `Kopiuj tekst` · `Humanizuj wszystko` · toggle „Szczegóły ▾".
    - Sekcja rozwijana (`#analysis-expand`): pełne gauge SVG, sub-werdykt, błąd LLM, komentarz LLM, wymiary jakości.
    - `--abar-h` aktualizowane przez `ResizeObserver` → poprawny `top` sticky prawej kolumny.
  - **Lewa kolumna** (`.col-left` / `.text-pane`): textarea (wsad) → nakładka spinner (`.text-loader`) → podświetlony tekst (`#highlighted`). `setLeftMode("edit"|"loading"|"view")`. Textarea wypełnia viewport (`calc(100vh - topbar - abar - 150px)`).
  - **Prawa kolumna** (`.col-right`, sticky, scroll): pasek nawigacji `#finding-nav` (← `1/N` → · ✓ Zastosuj · „Załaduj wszystkie (N)") → empty-state przed analizą (`#proposals-empty`) lub panel propozycji (`#proposals-panel` z `#findings`).
  - **Synchronizacja:** klik w `<mark>` w tekście → scroll do karty propozycji i odwrotnie (`navigateTo` → `scrollToFinding` + `scrollToMark`). Klawiatura: ←/→ nawigacja, Enter = zastosuj 1. propozycję.
  - **Formatowanie tekstu** (`formatRichHtml`): analiza linia-po-linii; nagłówek H2 gdy krótka linia (≤72 zn.) bez interpunkcji końcowej, po linii kończącej zdanie (`.!?…`) i NIE zaczynająca się polskim słowem-łącznikiem (`i/a/ale/oraz/...`). Listy `-`/`1.` → `<ul>`/`<ol>`. Markdown `#`/`##` → H1/H2.
  - **Bulk-load propozycji:** `loadAllProposals()` — przycisk „Załaduj wszystkie (N)" w `#finding-nav`, gdy część fragmentów nie ma jeszcze propozycji (np. analiza bez „Z propozycjami"); ładuje równolegle, znika gdy gotowe.
  - **Oceny na bieżąco:** `refreshScores()` przelicza heurystycznie (`judge:false`) po każdej zamianie propozycji — NIE rusza listy fragmentów ani podświetleń.
- Humanizacja: propozycje per fragment (3 + pole własne), podgląd przy najechaniu, przepisania równoległe.
- Diagnostyka błędu LLM: `Report.llm_error` + notatka „Powód: …".

## 4. Aktywna faza
**Planowanie całkowitego redesignu UI wg Material 3 Design Kit** (Figma file `FFoAwp47aqBCjbPUlz23lm`, node `58295-22726`). Cel: zachować obecne fundamenty (FastAPI + vanilla JS, dwie kolumny, sticky belka, synchronizacja mark↔finding), ale przeprojektować estetykę i dopracować UX — sprawność, niezawodność, szybkość, przyjemność użycia. **Najpierw plan** (układ + zachowanie), dopiero potem implementacja. Szczegóły i fazy: `docs/ROADMAP.md`. Render frontu lokalnie niemożliwy (brak Chromium) → weryfikacja na produkcji po deployu.

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
14. **Redesign v5 „compact bar + 2 kolumny":** pozioma sticky belka analizy (2 rzędy), `<select>` modeli zamiast radiobuttonów, kolorowe liczby zamiast SVG w belce, prawa kolumna = empty-state → propozycje, nawigacja ←/→ z synchronizacją mark↔finding, usunięto popover/`display:contents` (#27, #28).
15. **Fixy v5:** `formatRichHtml` wykrywa nagłówki w tekście z pojedynczymi `\n` (heurystyka polskich słów-łączników), `updateNav` przez `style.display` (nie `.hidden`), przycisk „Załaduj wszystkie (N)" do zbiorczego ładowania propozycji (#29, #30).

## 6. Następne działania (priorytetowo)
1. **Zaplanować redesign Material 3** (`docs/ROADMAP.md`): wyciągnąć tokeny/komponenty z kitu Figma (kolory, typografia, elevation, kształty, stany), zaprojektować docelowy układ i przepływ, dopiero potem implementować etapami. Każdy etap = osobny PR do `main`, weryfikacja na produkcji.
2. **Zweryfikować v5 na produkcji** (wizualnie): formatowanie tekstu (nagłówki/akapity/listy), widoczność i synchronizacja paska `#finding-nav`, empty-state, `<select>` modeli, „Załaduj wszystkie".
3. **Potwierdzić LLM Flash end-to-end** — logi Railway pod `Gemini:`/`Gemini rewrite` dla `gemini-3-flash-preview`/`gemini-3.5-flash`.
4. Rozważyć zmianę domyślnego `GEMINI_MODEL` (env Railway) z `gemini-3.1-pro-preview` na Flash (szybciej, mniej błędów).
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
- **Layout v5:** górna sticky belka `#analysis-bar`; prawa kolumna `.col-right` jest sticky z `top: calc(topbar + --abar-h + 12px)`; `--abar-h` utrzymywane przez `ResizeObserver`. NIE używać już `display:contents` ani `.popover` (usunięte).
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
- `src/detektor_web/` — `app.py` (`_curate()`, `_speed_hint()`, `_with_model()`), `templates/index.html` (`#analysis-bar` 2-rzędy, `#finding-nav`, `#proposals-empty`/`#proposals-panel`, `<select id="model-select">`, `word-count`), `static/app.js` (~738 linii: `setLeftMode`, `refreshScores`, `formatRichHtml`, `renderScores`, `navigateTo`/`scrollToFinding`/`scrollToMark`, `updateNav`, `loadAllProposals`, `loadModels`, `selectedModel`), `static/style.css` (~898 linii, tokeny w `:root`).
- `tests/` — pytest. `pyproject.toml`, `requirements.txt`, `Procfile`, `.python-version`, `.env.example`.

## 11. Strefy ostrożności (nie ruszać bez potrzeby)
- **Offsety:** `fusion._locate`, `humanize` (zmiany od końca), `app.js applyReplacement` — łatwo zepsuć podświetlenia.
- **`llm/schema.py`** — zmiana psuje parsowanie structured-output Gemini.
- **`heuristics/*.py` i `data/*.yaml`** — nie zmieniać regexów/kluczy; tylko teksty `message`/`suggestion`.
- **`Procfile`, `.python-version`, `requirements.txt`** — wpływają na build Railway.
- **CSS — krytyczne reguły:**
  - `.hidden { display: none !important }` — MUSI mieć `!important`; inne reguły ustawiają `display` z niższą specyficznością.
  - `--abar-h` (token w `:root`) jest nadpisywane z JS (`ResizeObserver`) — od niego zależy `top`/`max-height` sticky `.col-right`. Nie hardkodować wysokości belki w innych regułach.
  - `#finding-nav` jest sterowany z JS przez `style.display` (inline) — reguła CSS dla `.finding-nav` nie powinna wymuszać `display`.
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
`main` = `cccb5df` (#30); Railway deploy SUCCESS (commit `cccb5df`, 2026-05-27 11:25 UTC). W tej sesji przeprowadzono **redesign v5 „compact bar + 2 kolumny"** (#27, #28): pozioma sticky belka analizy (2 rzędy), `<select>` modeli zamiast radiobuttonów, kolorowe liczby Slop/AI zamiast SVG w belce, prawa kolumna z empty-state → propozycjami, nawigacja ←/→ z synchronizacją mark↔finding, **usunięto popover i `display:contents`**. Następnie fixy (#29, #30): `formatRichHtml` poprawnie wykrywa nagłówki w tekście z pojedynczymi `\n` (heurystyka polskich słów-łączników), `updateNav` przez `style.display`, przycisk „Załaduj wszystkie (N)". **Następny krok:** zaplanować całkowity redesign wg **Material 3 Design Kit** (Figma `FFoAwp47aqBCjbPUlz23lm`) — najpierw plan układu i zachowania (`docs/ROADMAP.md`), potem implementacja etapami. Pełny handoff: `docs/HANDOFF.md`.
