# HANDOFF — koniec sesji „M3 dopracowanie + dark + UX + audyt"; start kolejnej = planowanie nowej szaty graficznej

Stan na koniec sesji. Fakty oparte na kodzie, git, testach i deployach Railway. Założenia oznaczone jako ZAŁOŻENIE.

---

## 1. Co zmieniło się od poprzedniego handoffu

Poprzedni handoff bazował na `main = cccb5df` (PR #30, redesign v5). Od tego czasu scalono **9 PR-ów do `main`**, kończąc na `39dbe00` (PR #42, Faza 7). Skondensowany ślad:

| PR | Sha (squash) | Skrót |
|---|---|---|
| #33 | `41e51a0` | **Redesign M3 — Faza 2:** pill-shape + state-layery (przyciski, ikony, chipy). |
| #34 | `00e4c82` | **Redesign M3 — Faza 3:** jasna błękitna paleta + mocniejsze akcenty (zamiast neutralnego monochromu). |
| #35 | `9463343` | **Faza 3 motion + dostępność:** easing/duration M3, wejścia paneli, `:focus-visible` rings, `prefers-reduced-motion`. |
| #36 | `836a70c` | **Faza 3 domknięcie WCAG AA:** audyt kontrastów (skrypt), `--muted-2` podniesiony, `--on-accent-soft = #1e40af` dla etykiet tonalnych. |
| #37 | `cb852fe` | **Faza 5 cache-busting:** `?v=<sha1[:8]>` dla `style.css`/`app.js` (helper `_asset_version` w `app.py`). |
| #38 | `f75cec9` | **Faza 5 dark mode (M3):** ciemna rampa tokenów w `:root[data-theme="dark"]`, toggle `#theme-toggle` w topbarze (inline skrypt w `<head>` przed CSS → brak FOUC, `localStorage` + `prefers-color-scheme`), `color-scheme: dark`. |
| #39 | `cfdf95e` | **Fix:** HTML serwowany z `Cache-Control: no-store, max-age=0, must-revalidate` (każdy deploy widoczny od razu) + widoczniejszy przełącznik motywu. |
| #40 | `7c081e0` | **Dodanie skilla** `.agents/skills/web-design-guidelines` (vercel-labs/agent-skills) — pobiera świeże Web Interface Guidelines z GitHub i wykonuje audyt. |
| #41 | `dd5addab` | **Faza 6 — drobne UX:** przyciski „Wklej przykład" (`#load-example`) / „Wyczyść" (`#clear-text`) w nagłówku panelu tekstu, `EXAMPLE_TEXT` w `app.js`, `copyAll` z wyraźnym feedbackiem „Skopiowano ✓" (revert po 1.8 s). |
| #42 | `39dbe006` | **Faza 7 — audyt web-design-guidelines + fixy:** a11y (`aria-label` na nav-prev/next/textarea/select, `aria-live="polite"` na statusach, `aria-hidden` na dekoracyjnej ikonie, **skip-link** „Przejdź do treści" → `#main`, `<meta name="theme-color">` dla light/dark), typografia (`…` zamiast `...` w placeholderze i „Analizuję…", `font-variant-numeric: tabular-nums` dla cyfr), interakcja (`touch-action: manipulation` w base `button` — eliminacja 300 ms tap-delay iOS). |

W tej konkretnej sesji (od ostatniego promptu użytkownika) wykonano: **PR #42 — Faza 7** (audyt skillem + fixy a11y/typo/touch); poprzednie PR-y z tabeli mogły zostać scalone w wcześniejszych częściach tej samej rozmowy lub w sesjach poprzednich — historia chatu jest skompaktowana, więc nie odtwarzam dat per-tura. Co liczy się dla kolejnej sesji to **stan na `main`** — opisany w §2.

---

## 2. Co aktualnie działa (fakty z kodu/testów/deployu)

- **34/34 testów zielone** (`.venv/bin/pytest -q`), ruff czysto (`ruff check src tests`), `node --check src/detektor_web/static/app.js` OK.
- **Backend bez zmian logiki** — endpointy/heurystyki/LLM/offsety jak wcześniej. Wszystkie zmiany od `cccb5df` dotyczą tylko `static/`, `templates/`, `app.py` (helper cache-busting + `Cache-Control: no-store` na HTML).
- **`main` = `39dbe006`** (PR #42 scalony squashem).
- **Railway deploy `39dbe006` = SUCCESS** (deployment `2674ed6a-a3ce-...`, 2026-05-28 10:28 UTC, branch `main`).
- **Kurowana lista modeli** działa (`CURATED_MODEL_IDS` w `src/detektor/config.py`, endpoint `GET /api/models`).
- **Cache-busting**: każdy build dostaje świeży hash w URL `style.css?v=...`/`app.js?v=...`; HTML wysyłany `no-store` (deploy widać bez `Ctrl+Shift+R`).
- **Dark mode**: w pełni działa (light ↔ dark przez toggle w topbarze, persisted w `localStorage`, fallback do `prefers-color-scheme`); brak FOUC dzięki inline-skryptowi w `<head>` przed CSS.
- **A11y (Faza 7)**: skip-link (Tab od początku strony skacze do `#main`), `aria-live="polite"` na `#status`/`#humanize-status`/`#nav-done`, `aria-label` na nav-prev/next i polach formularza, `<meta name="theme-color">` light/dark.
- **Typografia/touch (Faza 7)**: cyfry mają `tabular-nums` (brak skoków szerokości), placeholder/„Analizuję…" używają `…`, base `button` ma `touch-action: manipulation`.

### Rozmiary plików (po Fazie 7)
- `src/detektor_web/static/app.js` — **811** linii.
- `src/detektor_web/static/style.css` — **1151** linii.
- `src/detektor_web/templates/index.html` — **198** linii.
- `src/detektor_web/app.py` — **181** linii.

---

## 3. Co niezweryfikowane / założenia

- **ZAŁOŻENIE:** Wygląd po Fazie 7 na produkcji jest poprawny — render lokalny niemożliwy (brak Chromium). Skip-link, `theme-color`, oraz dark/light togg... — wszystko liczone i sprawdzone w surowym HTML/CSS/JS, ale **nie potwierdzone wizualnie** od deployu `39dbe006`.
- **ZAŁOŻENIE:** Heurystyka nagłówków `formatRichHtml` daje estetyczny wynik na realnych artykułach — przetestowano logicznie, nie wizualnie.
- **ZAŁOŻENIE:** LLM (Gemini Flash) działa end-to-end na produkcji — niepotwierdzone w tej sesji. `gemini-3.1-pro-preview` historycznie zwracał błąd, Flash jest preferowany ale nie ma logu potwierdzającego.
- **ZAŁOŻENIE:** Audyt M3 kontrastu dark (#38) jest matematycznie OK (skrypt podobny do #36), ale **wizualnie nie sprawdzony**.

---

## 4. Rekomendowane następne zadanie

> **Użytkownik zapowiedział w prompcie kończącym sesję:** „W kolejnym kroku opracujemy zupełnie nową szatę graficzną dla aplikacji. (…) Będę Cię prosił o analizę, rekomendacje i opracowanie szczegółowego planu. Ale zrobimy to już w osobnej konwersacji."

**Zadanie dla kolejnej sesji (Faza 8 — planowanie nowej szaty):**

1. **Analiza obecnego UI** (Faza 7 = stan po audycie web-design-guidelines):
   - Mocne strony: 2 kolumny, sticky belka, synchronizacja mark↔finding, dark mode, a11y baseline, font Geist, paleta jasny błękit + dark M3.
   - Słabe strony / pole do poprawy (do potwierdzenia z użytkownikiem): układ belki (2 rzędy ~52 px), gęstość informacji, hierarchia wizualna, rozmieszczenie akcji wtórnych, hover/focus na rzadkich kontrolkach, feedback przy długich operacjach, formatowanie ramek (np. propozycje), prezentacja wskaźników (kolorowy tekst vs gauge).
2. **Rekomendacje** (do dyskusji z użytkownikiem):
   - Czy zostajemy przy fundamentach v5 (2 kolumny + sticky belka) czy rozważamy nowy szkielet (np. centered editor + side panels jak Notion/Linear)?
   - Paleta: jasny błękit M3 vs nowa (neutralna / kolorowa / brandowa)?
   - Font: Geist vs alternatywa (Inter / IBM Plex / własna)?
   - System komponentów: kontynuacja M3 czy własny token-set?
   - Stopień animacji/motion: M3 baseline vs bogatsze przejścia (z poszanowaniem `prefers-reduced-motion`).
3. **Szczegółowy plan implementacji** w fazach (analogicznie do dotychczasowych — każda faza = osobny PR do `main`).
4. **Plan zapisać w `docs/ROADMAP.md`** jako Faza 8 (i kolejne), z mapowaniem komponentów i tokenów.

**Tryb pracy w kolejnej sesji:** użytkownik **wyraźnie poprosił o plan przed implementacją** — w odróżnieniu od domyślnego trybu „implementuj i wdroż" z `CLAUDE.md §0`. Nie zaczynać kodu przed akceptacją planu.

---

## 5. Pliki najprawdopodobniej istotne w kolejnej sesji

### Front (główny obszar zmian)
- `src/detektor_web/static/style.css` — tokeny w `:root` (light) + `:root[data-theme="dark"]` (dark); sekcje: `.topbar`, `.analysis-bar`/`.abar-*`, `.col-left`/`.col-right`, `.finding`/`.finding-nav`, `.highlighted .hl-*`, `#theme-toggle`, **Faza 7 audit block na końcu** (`.skip-link`, `tabular-nums`).
- `src/detektor_web/static/app.js` — `formatRichHtml`, `renderScores`, `renderReport`, `navigateTo`/`scrollToFinding`/`scrollToMark`, `updateNav`, `loadAllProposals`, `setLeftMode`, `loadModels`, `selectedModel`, `EXAMPLE_TEXT`, `updateInputButtons`, `copyAll` (feedback ✓), theme toggle (`applyTheme`).
- `src/detektor_web/templates/index.html` — `<head>` (inline theme script przed CSS, `theme-color` light/dark), skip-link, `<main id="main">`, `#analysis-bar`/`.abar-controls`/`.abar-results`/`#analysis-expand`, `#load-example`/`#clear-text`, `#finding-nav`, `#proposals-empty`/`#proposals-panel`, `<select id="model-select">`, `#word-count`.

### Backend (raczej bez zmian)
- `src/detektor_web/app.py` — `_curate()`, `_speed_hint()`, `_with_model()`, `_asset_version()` (cache-busting), `Cache-Control: no-store` na HTML, endpointy.
- `src/detektor/config.py` — `CURATED_MODEL_IDS`, `gemini_model`.

### Dokumentacja i skille
- `docs/ROADMAP.md` — rozszerzyć o Fazę 8 (planowanie + implementacja nowej szaty).
- `docs/DECISIONS.md` — zapisać decyzje projektowe nowej szaty (paleta/font/komponenty/szkielet).
- `.agents/skills/web-design-guidelines/SKILL.md` — gotowy do uruchomienia audytu po każdej fazie.
- Figma MCP — gdyby nowa szata wynikała z konkretnego designu w Figmie (przed `use_figma` załadować skill `/figma-use`).

---

## 6. Komendy uruchomione w tej sesji i wyniki

```
.venv/bin/pytest -q                          → 34 passed (kilka razy)
.venv/bin/ruff check src tests               → All checks passed!
node --check src/detektor_web/static/app.js  → OK
GitHub merge PR #42 (squash)                 → 39dbe006, merged
Railway list-deployments                     → 39dbe006 SUCCESS (10:28 UTC, branch main)
```

W poprzednich częściach tej rozmowy (zgodnie z git log) scalono również PR-y #33–#41 do `main`. Każdy z nich zakończył się SUCCESS na Railway (per `list-deployments` widoczna była ostatnia `REMOVED` historia tylko z `dd5addab`/#41, wcześniejsze poza oknem).

---

## 7. Komendy do uruchomienia w kolejnej sesji

```bash
# Sanity (przed dowolną zmianą):
.venv/bin/pytest -q
.venv/bin/ruff check src tests
node --check src/detektor_web/static/app.js

# Nowy dev-branch na świeżym main:
git fetch origin main && git checkout -B <nowa-nazwa> origin/main

# Uruchomienie audytu po fazie:
# (skill .agents/skills/web-design-guidelines — pobiera świeże guidelines z GitHub)

# Deploy Railway: po merge PR → list-deployments
#   project  dc230d9e-ba34-44d2-8793-baa7ddae9924
#   env      533baa05-7e6b-46c8-b942-d5c3c3f2bb40
#   service  24b213f8-0457-4d60-a393-28eb4bd58102

# Aplikacja produkcyjna (sandbox jej nie zcurluje — sprawdzasz w przeglądarce):
# https://detektor-ai.up.railway.app
```

---

## 8. Otwarte pytania i niepewności

1. **Zakres nowej szaty graficznej** — pełna zmiana (paleta + font + szkielet + komponenty), czy tylko poszczególne warstwy (np. tylko paleta i szkielet, font zostaje)?
2. **Inspiracja / źródło designu** — Figma kit (jaki?), własna wizja użytkownika, czy generujemy od zera w oparciu o brief?
3. **LLM Flash end-to-end** — przy okazji deploy nowej szaty potwierdzić, że `gemini-3.5-flash` / `gemini-3-flash-preview` działa w prod (logi Railway pod `Gemini:`/`Gemini rewrite`); rozważyć zmianę domyślnego `GEMINI_MODEL` z `gemini-3.1-pro-preview` na Flash.
4. **Auto-merge dalej nie działa** (brak branch protection) → merge przez `merge_pull_request` (squash) ręcznie. Nie próbować naprawiać.
5. **Wizualna weryfikacja Fazy 7** — przed startem nowej szaty użytkownik może chcieć potwierdzić skip-link (Tab od początku strony), `theme-color` (mobile chrome), `tabular-nums` (brak skoków cyfr w licznikach), `touch-action` (brak 300 ms delay iOS).
6. **Przeterminowane gałęzie** — nie używać `claude/railway-deployment-completion-iCbZt` ani starych dev-branche jako bazy. Zawsze branchować z `origin/main`.
