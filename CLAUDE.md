# CLAUDE.md — Detektor AI slop (PL)

Zwięzły, operacyjny przewodnik dla Claude Code. Szczegóły sesyjne: `docs/HANDOFF.md`.
Decyzje: `docs/DECISIONS.md`. Pełny opis funkcji: `README.md`.

## 0. Zasady odpowiedzi
- **Na końcu KAŻDEJ odpowiedzi** dodaj klikalny link do aplikacji produkcyjnej: <https://detektor-ai.up.railway.app>
- **Zawsze włączaj auto-merge** na tworzonych PR-ach (`enable_pr_auto_merge`, metoda `squash`) i oznaczaj PR jako gotowy do scalenia, aby scalał się automatycznie po spełnieniu wymagań.
- **Domyślny tryb pracy = „implementuj i wdróż" (opcja 1).** Po zaakceptowaniu kierunku/zadania prowadź pełen cykl bez dopytywania: kod → `pytest` + `ruff` + `node --check` → commit → PR → auto-merge (squash) → **merge do `main` = deploy** (Railway auto-deployuje z `main`). NIE zatrzymuj się na „sam plan" ani „wstrzymaj deploy", chyba że użytkownik wyraźnie poprosi inaczej dla konkretnego zadania.
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

## 3. Aktualny stan implementacji (zweryfikowane: 34/34 testów, ruff czysto, node --check OK, deploy #42 `39dbe00` z `main`, SUCCESS 2026-05-28 10:28 UTC)
- Rdzeń: segmentacja PL, 5 heurystyk, fuzja w 2 wskaźniki, sędzia Gemini (`gemini_judge.py`). **Backend bez zmian logiki od dawna** — redesigny dotykają tylko CSS/JS/HTML/config + `app.py` (cache-busting + `Cache-Control` na HTML).
- Endpointy: `GET /healthz`, `GET /api/models`, `POST /api/analyze` (param `humanize`, `judge`), `POST /api/rewrite`, `POST /api/humanize`.
- **Tryb heurystyczny na żądanie:** `analyze_text(..., use_llm=False)` / `/api/analyze {"judge": false}` pomija sędziego LLM — używane do live-przeliczania ocen.
- **UI = redesign v5 + M3 dark + audyt a11y (Faza 7)** (font Geist, jasny błękit M3 light / ciemna rampa M3 dark, pill-shape + state-layery):
  - **Cache-busting**: `?v=<sha1[:8]>` przy `style.css`/`app.js` (helper `_asset_version` w `app.py`); HTML serwowany `Cache-Control: no-store, max-age=0, must-revalidate` → każdy deploy widoczny od razu, bez hard refresh.
  - **Dark mode (M3)**: tokeny w `:root[data-theme="dark"]`, toggle `#theme-toggle` w topbarze (`aria-pressed`, `:focus-visible`), inline-skrypt w `<head>` przed CSS (bez FOUC, `localStorage` + `prefers-color-scheme`), `color-scheme: dark` dla natywnych kontrolek.
  - **Górna sticky belka analizy** (`#analysis-bar`, 2 kompaktowe rzędy po ~52 px):
    - Rząd 1 (`.abar-controls`, zawsze widoczny): `Analizuj` · `<select id="model-select">` (kurowana lista modeli) · checkbox „Z propozycjami" · status.
    - Rząd 2 (`#abar-results`, po analizie): liczby Slop/AI (kolorowy tekst + `tabular-nums`) · werdykt headline · `Kopiuj tekst` (z feedbackiem „Skopiowano ✓") · `Humanizuj wszystko` · toggle „Szczegóły ▾".
    - Sekcja rozwijana (`#analysis-expand`): pełne gauge SVG, sub-werdykt, błąd LLM, komentarz LLM, wymiary jakości.
    - `--abar-h` aktualizowane przez `ResizeObserver` → poprawny `top` sticky prawej kolumny.
  - **Lewa kolumna** (`.col-left` / `.text-pane`): textarea (wsad) → nakładka spinner (`.text-loader`) → podświetlony tekst (`#highlighted`). `setLeftMode("edit"|"loading"|"view")`. Textarea wypełnia viewport. Nagłówek panelu ma przyciski **`Wklej przykład`** (`#load-example`) i **`Wyczyść`** (`#clear-text`) — `updateInputButtons` pokazuje właściwy stan w trybie edycji.
  - **Prawa kolumna** (`.col-right`, sticky, scroll): pasek nawigacji `#finding-nav` (← `1/N` → · ✓ Zastosuj · „Załaduj wszystkie (N)") → empty-state przed analizą (`#proposals-empty`) lub panel propozycji (`#proposals-panel` z `#findings`).
  - **Synchronizacja:** klik w `<mark>` w tekście → scroll do karty propozycji i odwrotnie (`navigateTo` → `scrollToFinding` + `scrollToMark`). Klawiatura: ←/→ nawigacja, Enter = zastosuj 1. propozycję.
  - **Formatowanie tekstu** (`formatRichHtml`): analiza linia-po-linii; H2 gdy krótka linia (≤72 zn.) bez interpunkcji końcowej, po linii kończącej zdanie (`.!?…`) i NIE zaczynająca się polskim słowem-łącznikiem (`i/a/ale/oraz/...`). Listy `-`/`1.` → `<ul>`/`<ol>`. Markdown `#`/`##` → H1/H2.
  - **Bulk-load propozycji:** `loadAllProposals()` — przycisk „Załaduj wszystkie (N)" w `#finding-nav`, gdy część fragmentów nie ma propozycji; ładuje równolegle, znika gdy gotowe.
  - **Oceny na bieżąco:** `refreshScores()` przelicza heurystycznie (`judge:false`) po każdej zamianie propozycji — NIE rusza listy fragmentów ani podświetleń.
  - **A11y (Faza 7)**: skip-link „Przejdź do treści" → `#main`; `<meta name="theme-color">` light/dark; `aria-label` na ikonowych nav-prev/next (glify w `<span aria-hidden="true">`), na `<textarea>` i `<select>`; `aria-live="polite"` na `#status`/`#humanize-status`/`#nav-done`; `aria-hidden` na dekoracyjnej `.empty-icon`.
  - **Typografia/touch (Faza 7)**: `…` zamiast `...` w placeholderze i „Analizuję…"; `font-variant-numeric: tabular-nums` dla cyfr (`.word-count`, `.bar-score-num`, `.g-num`); `touch-action: manipulation` w base `button` (eliminacja 300 ms tap-delay iOS).
- Humanizacja: propozycje per fragment (3 + pole własne), podgląd przy najechaniu, przepisania równoległe.
- Diagnostyka błędu LLM: `Report.llm_error` + notatka „Powód: …".

## 4. Aktywna faza
**Przygotowanie do nowej szaty graficznej (planowanie w kolejnej sesji).** Użytkownik w prompcie kończącym tę sesję zapowiedział: „W kolejnym kroku opracujemy zupełnie nową szatę graficzną dla aplikacji (…) Będę Cię prosił o analizę, rekomendacje i opracowanie szczegółowego planu. Ale zrobimy to już w osobnej konwersacji." Cel: nowy układ + estetyka + UX (intuicyjniejsze reakcje na działania użytkownika, lepsze formatowanie tekstów/ramek, nowa belka górna), z zachowaniem fundamentów (FastAPI + vanilla JS, brak builda frontu). **Wyjątek od trybu „implementuj i wdroż" (§0):** kolejna sesja zaczyna się od analizy/rekomendacji/planu — NIE od kodu. Bieżąca roadmapa M3 (Fazy 0–7) zamknięta; nowa szata będzie kolejną iteracją (Faza 8+). Szczegóły handoffu: `docs/HANDOFF.md`. Render frontu lokalnie niemożliwy (brak Chromium) → weryfikacja na produkcji po deployu.

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
16. **Redesign M3 (komponenty + motion + WCAG):** pill-shape + state-layery (#33), jasna błękitna paleta (#34), motion + `:focus-visible` + `prefers-reduced-motion` (#35), audyt kontrastu WCAG AA + `--muted-2`/`--on-accent-soft` (#36).
17. **Faza 5 (cache-busting + dark mode + no-cache HTML):** `?v=<sha1[:8]>` przy `style.css`/`app.js` (#37), dark mode M3 + toggle bez FOUC w `<head>` + `color-scheme` (#38), HTML `Cache-Control: no-store` + widoczniejszy toggle (#39).
18. **Skill `web-design-guidelines` (Vercel)** dodany do `.agents/skills/` (#40) — pobiera świeże guidelines z GitHub przy każdym uruchomieniu.
19. **Faza 6 — drobne UX (#41):** przyciski „Wklej przykład" / „Wyczyść" w panelu tekstu, `EXAMPLE_TEXT`, feedback „Skopiowano ✓" w `copyAll`.
20. **Faza 7 — audyt web-design-guidelines + fixy (#42):** a11y (skip-link, `theme-color`, `aria-label`/`aria-live`/`aria-hidden`), typografia (`…`, `tabular-nums`), interakcja (`touch-action: manipulation`).

## 6. Następne działania (priorytetowo)
1. **Nowa szata graficzna — analiza, rekomendacje, szczegółowy plan** (w kolejnej sesji, na życzenie użytkownika). Wynik = `docs/ROADMAP.md` Faza 8 (układ, paleta/font/komponenty/szkielet, fazy implementacyjne). **Nie zaczynać kodu przed akceptacją planu.**
2. **Weryfikacja wizualna Fazy 7 na produkcji**: skip-link (Tab od początku), `theme-color` (mobile chrome), `tabular-nums` (brak skoków cyfr), `touch-action` (brak 300 ms tap-delay iOS); kontrast dark mode (M3) na realnych ekranach.
3. **Potwierdzić LLM Flash end-to-end** — logi Railway pod `Gemini:`/`Gemini rewrite` dla `gemini-3.5-flash` / `gemini-3-flash-preview`.
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
- **Konflikt merge = "save → reset → restore"** (gdy main awansował przed push): skopiuj zmienione pliki do /tmp, `git checkout -B branch origin/main`, przywróć pliki, commit, `push --force-with-lease`. Sprawdzone wielokrotnie.
- **Layout v5:** górna sticky belka `#analysis-bar`; prawa kolumna `.col-right` jest sticky z `top: calc(topbar + --abar-h + 12px)`; `--abar-h` utrzymywane przez `ResizeObserver`. NIE używać już `display:contents` ani `.popover` (usunięte).
- **`#finding-nav` przez `style.display`** (nie `.hidden`) — `updateNav()` ustawia `flex`/`none` bezpośrednio, by ominąć problemy ze specyficznością CSS.
- **Live oceny** = `/api/analyze` z `judge=false`; lista fragmentów/podświetlenia zarządzane lokalnie.
- **Cache-busting**: `?v=<sha1[:8]>` w URL-ach `style.css`/`app.js` (helper `_asset_version` w `app.py`, wstrzykiwane do szablonu). HTML serwowany `Cache-Control: no-store, max-age=0, must-revalidate` — każdy deploy widoczny od razu, bez hard refresh.
- **Dark mode**: `data-theme="dark"` na `<html>` (ustawiane inline-skryptem w `<head>` PRZED CSS — bez FOUC; `localStorage("theme")` + fallback `prefers-color-scheme`). Tokeny dark w `:root[data-theme="dark"]`; `color-scheme: dark` dla natywnych kontrolek (scrollbar/select/inputs); twarde kolory (marki, chipy, alerty, podgląd, nakładki) nadpisane scoped.
- **A11y baseline (Faza 7)**: skip-link → `#main`, `<meta name="theme-color">` light/dark, `aria-label` na ikonowych nav/textarea/select, `aria-live="polite"` na statusach, `aria-hidden` na dekoracji; `touch-action: manipulation` w base `button`; `font-variant-numeric: tabular-nums` na cyfrach.
- **Skill audytu (`.agents/skills/web-design-guidelines`)** — pobiera świeże guidelines z GitHub przy każdym uruchomieniu; uruchamiać po każdej fazie redesignu.
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
- `src/detektor_web/` — `app.py` (181 linii; `_curate()`, `_speed_hint()`, `_with_model()`, **`_asset_version()`** + `Cache-Control: no-store` na HTML), `templates/index.html` (198 linii; inline theme-script w `<head>` przed CSS, `theme-color` light/dark, skip-link, `<main id="main">`, `#analysis-bar` 2-rzędy, `#load-example`/`#clear-text`, `#finding-nav`, `#proposals-empty`/`#proposals-panel`, `<select id="model-select">`, `#theme-toggle`, `word-count`), `static/app.js` (811 linii: `setLeftMode`, `refreshScores`, `formatRichHtml`, `renderScores`, `navigateTo`/`scrollToFinding`/`scrollToMark`, `updateNav`, `loadAllProposals`, `loadModels`, `selectedModel`, `EXAMPLE_TEXT`, `updateInputButtons`, `copyAll` z feedbackiem, theme toggle `applyTheme`), `static/style.css` (1151 linii; tokeny w `:root` + `:root[data-theme="dark"]`, blok Fazy 7 na końcu: `.skip-link`, `tabular-nums`, `touch-action`).
- `.agents/skills/web-design-guidelines/SKILL.md` — skill audytu (pobiera świeże Web Interface Guidelines z GitHub).
- `tests/` — pytest. `pyproject.toml`, `requirements.txt`, `Procfile`, `.python-version`, `.env.example`.

## 11. Strefy ostrożności (nie ruszać bez potrzeby)
- **Offsety:** `fusion._locate`, `humanize` (zmiany od końca), `app.js applyReplacement` — łatwo zepsuć podświetlenia.
- **`llm/schema.py`** — zmiana psuje parsowanie structured-output Gemini.
- **`heuristics/*.py` i `data/*.yaml`** — nie zmieniać regexów/kluczy; tylko teksty `message`/`suggestion`.
- **`Procfile`, `.python-version`, `requirements.txt`** — wpływają na build Railway.
- **`app.py` cache-busting / no-cache HTML:**
  - `_asset_version()` zwraca `sha1(plik)[:8]` — zmiana pliku → nowy hash → nowy URL. NIE zmieniać formatu bez ostrożności (front osadza `?v=...`).
  - HTML serwowany z `Cache-Control: no-store, max-age=0, must-revalidate` — gwarantuje, że nowy `?v=...` dociera od razu. Jeśli przywrócisz cache na HTML, użytkownik utknie ze starym hashem.
- **CSS — krytyczne reguły:**
  - `.hidden { display: none !important }` — MUSI mieć `!important`; inne reguły ustawiają `display` z niższą specyficznością.
  - `--abar-h` (token w `:root`) jest nadpisywane z JS (`ResizeObserver`) — od niego zależy `top`/`max-height` sticky `.col-right`. Nie hardkodować wysokości belki w innych regułach.
  - `#finding-nav` jest sterowany z JS przez `style.display` (inline) — reguła CSS dla `.finding-nav` nie powinna wymuszać `display`.
  - **`:root[data-theme="dark"]`** — tokeny dark scoped; `color-scheme: dark` MUSI tam zostać (inaczej Windows dark mode psuje natywne kontrolki).
  - Twarde kolory (marki, chipy, alerty, podgląd, nakładki) są nadpisywane scoped w sekcji dark — nie cofać bez audytu kontrastu.
- **HTML:**
  - **Inline theme-script w `<head>` PRZED `<link rel="stylesheet">`** — bez tego pojawi się FOUC (flash białego ekranu) przy `data-theme="dark"`. Skrypt musi być synchroniczny.
  - `<meta name="theme-color">` jest podwójny (light + dark media queries) — utrzymywać oba.
  - Skip-link `<a class="skip-link" href="#main">` MUSI mieć target `id="main"` na `<main>`.
- **`app.js`:**
  - `setLeftMode` steruje widocznością textarea/spinnera/podświetleń; `refreshScores` celowo NIE rusza listy fragmentów ani podświetleń.
  - `formatRichHtml` — heurystyka nagłówków jest delikatna (polskie słowa-łączniki, próg 72 zn., koniec zdania `.!?…`). Zmiana progu/regexu może zepsuć podział na akapity vs nagłówki.
  - `renderReport` owija render w `try/catch`, by `updateNav()` zawsze się wykonał i pasek nawigacji zawsze się pojawił.
  - `applyTheme` musi pozostać idempotentne (ustawia `data-theme`, zapisuje `localStorage`, aktualizuje `aria-pressed`).

## 12. Checklista weryfikacyjna (przed uznaniem zmiany za gotową)
- [ ] `.venv/bin/pytest -q` → 34 zielone.
- [ ] `.venv/bin/ruff check src tests` → czysto; `ruff format src`.
- [ ] `node --check src/detektor_web/static/app.js` → OK (przy zmianach JS).
- [ ] Serwer wstaje; `GET /healthz` → `{"status":"ok","llm_available":...,"model":...}`.
- [ ] `POST /api/analyze` → `slop`, `ai_provenance`, `findings`; `{"judge": false}` → brak `llm_error`.
- [ ] Render frontu: **lokalnie niemożliwy (brak Chromium)** — zweryfikuj na produkcji po deployu.
- [ ] Deploy: scal PR do `main` (squash) → Railway auto-build; sprawdź `list-deployments` (branch `main`, SUCCESS).

## 13. Najnowsza nota handoff
`main` = `39dbe00` (#42); Railway deploy SUCCESS (commit `39dbe00`, 2026-05-28 10:28 UTC). Od poprzedniego handoffu (`cccb5df`) scalono 9 PR-ów do `main`: redesign M3 komponenty (#33), jasna paleta (#34), motion + a11y (#35), WCAG AA (#36), cache-busting (#37), dark mode + toggle bez FOUC (#38), HTML no-cache + widoczniejszy toggle (#39), skill `web-design-guidelines` (#40), Faza 6 UX (Wklej przykład / Wyczyść / feedback kopiowania — #41), Faza 7 audyt skillem + fixy a11y/typo/touch (#42). **Następny krok (w osobnej sesji, na życzenie użytkownika):** analiza obecnego UI, rekomendacje i **szczegółowy plan nowej szaty graficznej** (paleta/font/komponenty/szkielet + fazy implementacyjne). **Nie zaczynać kodu przed akceptacją planu** — wyjątek od domyślnego trybu „implementuj i wdroż". Pełny handoff: `docs/HANDOFF.md`.
