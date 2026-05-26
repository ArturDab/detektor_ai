# HANDOFF — sesja: pełny redesign UI + usunięcie jednostronnych obramowań

Stan na koniec sesji. Fakty oparte na kodzie, git i testach. Założenia oznaczone jako ZAŁOŻENIE.

---

## 1. Co zmieniło się w tej sesji

### PR #21–#24: Pełny redesign UI wg kitu Figmy
**Kit:** „3 Free Text Editor App UI Kit" (Figma node `6468-23222`, file `tSeivvg2HNlSvpYzvPk5y5`).

#### Pliki zmienione (diff `bd544b6`→`6b74846`):
- `src/detektor/config.py` — dodano `CURATED_MODEL_IDS: tuple[str, ...]` (kurowana lista 4 modeli Gemini do UI).
- `src/detektor_web/app.py` — dodano `_is_image_model()`, `_curate()`, `_speed_hint()`, `_annotate()`; endpoint `/api/models` teraz zwraca tylko kurowane modele tekstowe z adnotacją szybkość/dokładność; default wraca do kuratowanej listy jeśli `gemini_model` poza nią.
- `src/detektor_web/templates/index.html` — picker modeli zmieniony z `<select>` na `<div id="model" class="model-radios">`; dodany `<div class="text-footer"><span id="word-count">`.
- `src/detektor_web/static/app.js`:
  - `selectedModel()` czyta zaznaczony radio (`input[name="model"]:checked`).
  - `loadModels()` renderuje `.model-radio` z radio inputem, kropką `.mr-dot`, etykietą `.mr-label`.
  - `setLeftMode("loading")` teraz: textarea zostaje (blada, `.dimmed`), nakładka `.text-loader` na wierzchu (mgła + białe badge).
  - `renderHighlighted()` wywołuje `formatParagraphs(html)` zamiast `.replace(/\n/g, "<br>")`.
  - Nowa funkcja `formatParagraphs(html)` — dzieli na `<p class="hl-p">`, nagłówki jako `.hl-p.hl-heading` (≤70 znaków, bez `[.!?,;:]` na końcu).
  - `renderFindings()` — nowa struktura: `.finding-head` (chip + analyzer), `.quote`, `.finding-msg`, `.sug`, `.show-props`.
  - IIFE na końcu pliku: live word-count.
- `src/detektor_web/static/style.css` — **pełny przepis** (~840 linii):
  - Tokeny: `--bg #f1f5f9` (slate-100), `--surface #fff`, `--surface-2 #f8fafc`, `--text #0f172a` (slate-900), `--text-body #334155`, `--muted #64748b`, `--accent #4f46e5` (indigo-600), `--accent-hover #4338ca`, `--accent-soft #eef2ff`, `--accent-soft-border #c7d2fe`.
  - `.col-right` = unified card (border+shadow); `.col-right .card { background:transparent; border:none; box-shadow:none }` strippuje dzieci.
  - `.results { display: contents }` — dzieci `.results` wpadają bezpośrednio do `.col-right`.
  - Sekcje panelu: `padding 18px 20px` + `border-bottom` jako divider; `.col-right .panel` z accordion-style h3.
  - Radiobuttony modelu: `.model-radio:has(input:checked)` z accent-soft tłem i indigo wypełnioną kropką.
  - Severity marks: `border-bottom: 2px solid` (nie border-left) w podświetleniach.
  - `.text-loader` = mgła (rgba 0.45) + białe badge `::before`.
  - `.hl-p`, `.hl-heading` — formatowanie artykułu w widoku analizy.

### PR #25: Usunięcie jednostronnych obramowań + textarea fill viewport
**Diff (`6b74846`→`9c97dc1`):** tylko `style.css`, 14 ins / 20 del.

Zmiany:
- `.popover`: usunięto `border-top: 3px solid var(--accent)` (indygowy pasek na górze).
- `.pop-quote`: usunięto `border-left: 3px solid var(--accent)`; zmieniono na `background: var(--accent-soft); border: 1px solid var(--accent-soft-border); border-radius: var(--radius-sm)`.
- `.col-right .verdict`: usunięto `border-left: 4px solid var(--muted-2)`; kolor nastroju teraz przez tło: `[data-tone="ok"] { background: #f0fdf4 }`, `[data-tone="warn"] { background: #fff7ed }`.
- `.finding .quote`: usunięto `border-left: 3px solid` i severity overrides (`.finding.sev-* .quote`); zamiast tego `border: 1px solid var(--border); border-radius: var(--radius-sm)`.
- `.note`: usunięto `border-left: 3px solid #f59e0b`; zmieniono tło na `#fffbeb`.
- `.text-box textarea`: `height: 62vh` → `height: calc(100vh - var(--topbar-h) - 200px)` (min-height 320px).
- `.text-box .highlighted`: `min-height: 62vh` → `min-height: 320px`; `max-height: calc(100vh - 200px)` → `max-height: calc(100vh - var(--topbar-h) - 200px)`.
- Responsive (`max-width: 900px`): textarea `height: 360px; max-height: 360px`.

---

## 2. Co aktualnie działa (fakty z kodu/testów)

- **34 testów zielone** (`pytest -q`), ruff czysto, `node --check app.js` OK.
- **Backend bez zmian logiki** — endpointy, heurystyki, LLM, offsets działają jak przed redesignem (redesign dotknął tylko CSS/JS/HTML/config).
- **PR #25 zmergowany** do `main` (`9c97dc1`). Railway auto-deploy z `main` uruchomiony.
- **Kurowana lista modeli** działa: `CURATED_MODEL_IDS = ("gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite")` → endpoint `/api/models` zwraca tylko dostępne z tej listy z adnotacją szybkości.

---

## 3. Co niezweryfikowane / założenia

- **ZAŁOŻENIE:** Wizualny wygląd redesignu na produkcji jest poprawny — render lokalny niemożliwy (brak Chromium/Playwright). Nie ma pewności że: unified panel wygląda jak zamierzono, radiobuttony działają poprawnie, formatowanie akapitów/nagłówków jest estetyczne, textarea jest odpowiednio duże, brak artefaktów CSS.
- **ZAŁOŻENIE:** LLM (Gemini Flash) działa end-to-end na produkcji — nie potwierdzono w tej sesji. W poprzednich sesjach `gemini-3-flash-preview` nie zwracał błędu w logach Railway, ale nie było pełnej weryfikacji sędzia→wynik→propozycje.
- **ZAŁOŻENIE:** Railway auto-deploy z `main` po merge #25 zakończył się SUCCESS — sprawdź `list-deployments` Railway MCP.

---

## 4. Rekomendowane następne zadanie

**Weryfikacja wizualna redesignu na produkcji** (https://detektor-ai.up.railway.app):

Golden path do sprawdzenia:
1. Otwórz stronę — sprawdź: Geist font, unified card w prawej kolumnie, radiobuttony modeli z adnotacjami.
2. Wklej tekst (kilka akapitów) → Analizuj — sprawdź: textarea blade (nie znika) podczas analizy, spinner+badge na wierzchu.
3. Po analizie: podświetlony tekst z `<p>` i nagłówkami, brak border-top na popoverze po kliknięciu fragmentu, karta finding bez border-left na .quote.
4. Werdykt: brak lewego borderu, zielone/bursztynowe tło wg tonu.
5. Kopiuj cały tekst, Humanizuj.

Jeśli cokolwiek wygląda źle → napraw CSS i utwórz nowy PR do `main`.

---

## 5. Pliki istotne w kolejnej sesji

- `src/detektor_web/static/style.css` — tokeny `:root`, `.col-right`, `.results`, `.popover`, `.finding`, `.verdict`
- `src/detektor_web/static/app.js` — `setLeftMode`, `formatParagraphs`, `loadModels`, `renderFindings`
- `src/detektor_web/templates/index.html` — struktura HTML (radiobuttony, word-count)
- `src/detektor/config.py` — `CURATED_MODEL_IDS`
- `src/detektor_web/app.py` — `_curate()`, `_speed_hint()`

---

## 6. Komendy uruchomione w tej sesji i wyniki

```
.venv/bin/pytest -q               → 34 passed
.venv/bin/ruff check src tests    → All checks passed!
node --check src/detektor_web/static/app.js  → OK
git rebase origin/main            → skipped d3a0016 (już w main jako #24), zachował 015af3b
git push --force-with-lease       → OK
GitHub merge PR #25 (squash)      → sha 9c97dc1, merged: true
```

---

## 7. Komendy do uruchomienia w kolejnej sesji

```bash
# Sprawdź deploy Railway:
# Railway MCP → list-deployments (project dc230d9e..., env 533baa05..., service 24b213f8...)
# Oczekiwane: branch "main", status SUCCESS, commit 9c97dc1

# Nowy dev-branch (jeśli potrzebne zmiany):
git checkout -B <nowa-nazwa> origin/main

# Standardowe sanity:
.venv/bin/pytest -q
.venv/bin/ruff check src tests
node --check src/detektor_web/static/app.js
```

---

## 8. Otwarte pytania i niepewności

1. **Czy redesign wygląda dobrze na produkcji?** — jedyna forma weryfikacji to własne oczy na https://detektor-ai.up.railway.app. Zapytaj użytkownika o feedback przed kolejnymi zmianami CSS.
2. **Czy LLM (Flash) działa end-to-end?** — sprawdź logi Railway pod `Gemini:`/`Gemini rewrite`. Jeśli błędy → debug `gemini_judge.py`/`rewriter.py`.
3. **Czy textarea jest odpowiednio duże?** — `calc(100vh - 60px - 200px)` = ~640px na typowym laptopie (768px viewport). Jeśli za duże/małe, popraw stałą 200px w CSS.
4. **Domyślny model na Railway** — env `GEMINI_MODEL` ustawiony na `gemini-3.1-pro-preview` (wolny, był problem). Rozważyć zmianę na `gemini-3.5-flash` w panelu Railway.
5. **Auto-merge nie działa** — brak branch protection na `main` → `enable_pr_auto_merge` rzuca błąd. Merge zawsze ręczny przez `merge_pull_request` (squash). Nie próbować naprawiać — to wymaga konfiguracji GitHub repo (poza zakresem).
