# DECISIONS — kluczowe decyzje projektowe i procesowe

## Wdrożenie: natywna integracja GitHub↔Railway (nie CLI/MCP do uploadu)
- **Powód:** sieć kontenera Claude Code blokuje hosty Railway („Host not in allowlist"), więc `railway up` z sandboxa nie działa; Railway MCP OAuth bywa niedostępny.
- **Rozwiązanie:** repo `arturdab/detektor_ai` podłączone do Railway; **merge PR do gałęzi `main`** wyzwala auto-build (serwer↔serwer, niezależnie od sandboxa).
- **Diagnostyka/operacje na Railway:** przez Railway MCP (`railway-agent`, `get-status`, `get-logs`), bo wywołania idą przez api.anthropic.com.

## Workflow gałęzi: `main` jako gałąź integracyjna (od sesji UI)
- **Zmiana procesu:** wcześniej integrowano w `claude/ai-slop-detection-tool-ye7nw`. Na życzenie użytkownika utworzono gałąź **`main`** (z `claude/ai-slop-detection-tool-ye7nw`) i to ona jest teraz gałęzią integracyjną. PR-y celują w `main`, squash-merge.
- **Powód poprzedniego problemu:** po squash-merge lokalny dev-branch rozjeżdża się historią z gałęzią docelową → PR z niego daje duplikaty/konflikty.
- **Rozwiązanie (sprawdzone w tej sesji):** dev-branch opieraj na `origin/main`; po każdym squash-merge przebazuj go:
  ```bash
  git stash            # jeśli są lokalne zmiany
  git checkout -B <dev-branch> origin/main
  git stash pop
  git add -A && git commit -m "..."
  git push -u origin <dev-branch> --force-with-lease
  # PR -> base main -> squash-merge (merge_pull_request, bo repo nie ma checków CI)
  ```
- **Nie używać** `claude/railway-deployment-completion-iCbZt` jako bazy (przestarzała).

## Deploy: Railway auto-deployuje wprost z `main` (ZMIGROWANE)
- **Stan aktualny:** źródło Railway przełączone na gałąź `main`. Merge PR do `main` (squash) → auto-build Nixpacks → deploy. Potwierdzone: deploye #28/#29/#30 mają w `meta.branch` = `main` i kończą się SUCCESS.
- **Mechanizm fast-forward na starą gałąź już NIE jest potrzebny** (był obejściem, gdy źródłem była `claude/ai-slop-detection-tool-ye7nw`).
- „Wait for CI" w panelu MUSI być OFF (brak CI w repo).
- Zmiana gałęzi-triggera możliwa tylko z panelu Railway UI (nie z MCP).

## UI v5: rezygnacja z `display:contents` i popovera (ZASTĘPUJE wcześniejszy unified panel)
- **Decyzja:** redesign v5 (PR #27/#28) porzucił „unified panel" oparty na `.results { display: contents }` oraz pływający `.popover`. Zamiast tego: jawna pozioma sticky belka analizy (`#analysis-bar`, 2 rzędy) + prawa kolumna z inline'owymi propozycjami (`#proposals-panel`) i empty-state.
- **`--abar-h`** (token `:root`) aktualizowane przez `ResizeObserver` → poprawny `top`/`max-height` sticky `.col-right` niezależnie od wysokości belki.
- **`#finding-nav` przez `style.display`** (inline z JS w `updateNav`), nie przez klasę `.hidden` — eliminuje problemy ze specyficznością CSS, które powodowały, że pasek nawigacji się nie pokazywał.
- **`<select>` modeli** zamiast radiobuttonów (kompaktowość). Kolorowe liczby Slop/AI w belce; pełne gauge SVG tylko w sekcji rozwijanej (brak duplikacji).
- **`formatRichHtml`** analizuje tekst linia-po-linii (tekst wklejany z przeglądarki ma pojedyncze `\n`, nie `\n\n`); nagłówki wykrywane heurystyką z listą polskich słów-łączników.

## Live przeliczanie ocen (tryb heurystyczny bez LLM)
- **Decyzja:** po zastosowaniu propozycji oceny przeliczane natychmiast w trybie heurystycznym, pełna ocena LLM dopiero na żądanie („Analizuj").
- **Implementacja:** `analyze_text(..., use_llm=False)` pomija sędziego (verdict=None, judge_available=False); `/api/analyze` przyjmuje `judge: bool = True`. Front: `refreshScores()` wywołuje `/api/analyze {judge:false}` i aktualizuje TYLKO wskaźniki (`renderScores`), nie rusza listy fragmentów ani podświetleń (te zarządzane lokalnie po offsetach).

## UI: jedno okno tekstu + utility `.hidden`
- **Jedno okno** w lewej kolumnie zamiast osobnego pola wsadu i widoku podświetleń: textarea/spinner/highlighted przełączane `setLeftMode("edit"|"loading"|"view")`.
- **`.hidden { display: none !important }`** — konieczne, bo `.text-loader`/`.legend` ustawiają `display:flex` i (będąc później w pliku, równa specyficzność) nadpisywały zwykłe `.hidden{display:none}`; efektem był loader zasłaniający pole tekstu od startu (#12).

## Auto-merge
- Zasada w `CLAUDE.md §0`: zawsze włączać auto-merge (squash) i oznaczać PR jako gotowy. Repo nie ma jednak żadnych checków CI, więc `enable_pr_auto_merge` zgłasza „already clean" — w praktyce PR scala się od razu przez `merge_pull_request` (squash).

## LLM zawsze opcjonalny (graceful degradation)
- Bez `GEMINI_API_KEY`/SDK lub przy błędzie: analiza działa na samych heurystykach (z obniżoną pewnością); humanizacja oferuje pole własne + podpowiedź heurystyki.
- Błędy LLM są **przechwytywane i raportowane** (`last_error` → `Report.llm_error` / notatka „Powód: …"), nie wywalają żądania.

## Model LLM wybierany per-żądanie
- `GET /api/models` zwraca listę (dynamiczną z Google API, fallback statyczny `MODEL_CHOICES`) + domyślny z env `GEMINI_MODEL`.
- `/api/analyze`, `/api/rewrite`, `/api/humanize` przyjmują `model` (walidacja wobec listy dynamicznej ∪ statycznej), nadpisując ustawienia kopią (`settings.model_copy`), bez mutacji singletona.

## Humanizacja
- **Propozycje liczone w trakcie analizy** (opcja `humanize=true`), nie na klik — by pojawiały się od razu. Dołączane do `Finding.proposals` (+ `Finding.context` = zdanie).
- **Przepisania równoległe** (`ThreadPoolExecutor`, `rewrite_concurrency`), osobny `rewrite_timeout_s` (krótszy niż `llm_timeout_s` sędziego), limit fragmentów (8) — by request nie ciągnął się minutami.
- Zastosowanie zmian: od końca tekstu (malejące offsety), front aktualizuje offsety lokalnie po każdej podmianie.

## Heurystyki sterowane danymi
- Frazy slop i łączniki w `data/*.yaml` — rozszerzalne bez zmian w kodzie. Regexy/klucze są wrażliwe; w korektach językowych ruszać tylko teksty `message`/`suggestion`.

## Model identity / sekrety
- Tokeny/klucze tylko w panelu Railway lub sekretach GitHub — nigdy w repo ani w czacie. (W trakcie sesji użytkownik wkleił token Railway w czacie → zalecono rotację; token i tak był bezużyteczny z sandboxa.)

## Cache-busting + no-cache HTML (Faza 5, #37 + #39)
- **Problem:** użytkownik widział stary UI po deployu, bo przeglądarka cachowała `style.css`/`app.js`. Wymóg „Ctrl+Shift+R" psuł doświadczenie.
- **Rozwiązanie:**
  - Helper `_asset_version(path)` w `src/detektor_web/app.py` zwraca `sha1(plik)[:8]` (mtime jako fallback). Wstrzykiwany do szablonu jako `style_v` / `app_v`; w `index.html` osadzony jako `?v=...`. Każda zmiana pliku → nowy hash → nowy URL → świeży pobór.
  - HTML serwowany endpointem `/` z nagłówkiem `Cache-Control: no-store, max-age=0, must-revalidate` (#39) — gwarantuje, że nowe wartości `?v=...` dotrą natychmiast (bez tego HTML też mógł być cached i utrzymywać stare hashe).
- **Pułapka:** jeśli ktoś przywróci cache na HTML, użytkownik utknie ze starymi hashami `?v=...` aż przeglądarka zwolni cache.

## Dark mode (Faza 5, #38)
- **Decyzja:** dwa motywy (light/dark) zarządzane przez atrybut `data-theme` na `<html>`. Tokeny ciemnego motywu w scoped selektorze `:root[data-theme="dark"]`; twarde kolory (marki, chipy, alerty, podgląd, nakładki) nadpisywane scoped w sekcji dark.
- **Brak FOUC:** inline-skrypt w `<head>` PRZED `<link rel="stylesheet">` ustawia `data-theme` na podstawie `localStorage("theme")` (z fallbackiem do `prefers-color-scheme`). Skrypt MUSI być synchroniczny — w przeciwnym razie pojawia się flash białego ekranu.
- **`color-scheme: dark`** w `:root[data-theme="dark"]` — naprawia natywne kontrolki (scrollbar, select, inputs) na Windows dark mode.
- **Toggle**: `#theme-toggle` w topbarze, `aria-pressed`, `:focus-visible`. `applyTheme` (w `app.js`) ustawia `data-theme`, zapisuje `localStorage`, aktualizuje `aria-pressed`. Musi pozostać idempotentne.
- **Kontrast WCAG AA**: cała ciemna paleta została przeliczona skryptem audytowym (jak w #36); wszystkie pary tekst/tło ≥ 4.5.

## Skill audytu web-design-guidelines (Faza 5/7, #40 + #42)
- **Decyzja:** dodano `.agents/skills/web-design-guidelines/SKILL.md` (z `vercel-labs/agent-skills`). Skill przed każdym uruchomieniem pobiera świeże **Web Interface Guidelines** z GitHub (`vercel-labs/web-interface-guidelines/main/command.md`) i wykonuje audyt frontu w formacie `file:line - issue`.
- **Powód:** pojedyncze źródło prawdy dla zasad UI; guidelines są aktualizowane częściej niż projekt — pobieranie na żądanie chroni przed driftem.
- **Workflow:** uruchomić skill po każdej fazie redesignu; naprawiać findingi pewne/niskiego ryzyka, świadomie odrzucać te o większym koszcie (np. wirtualizacja gdy lista <50, refaktor `<mark>` → `<button>`).

## Faza 7 — a11y/typo/touch baseline (#42)
- **A11y minima:** każdy nowy widok MUSI mieć — skip-link → `#main`, `<meta name="theme-color">` light/dark, `aria-label` na ikonowych przyciskach (glify w `<span aria-hidden="true">`), `aria-live="polite"` na statusach asynchronicznych, `aria-hidden` na czysto dekoracyjnych elementach. To minimum dla każdej nowej szaty (Faza 8+).
- **Typografia minima:** `…` (U+2026) zamiast `...` w widocznych tekstach; `font-variant-numeric: tabular-nums` na cyfrach porównywanych/aktualizowanych live (liczniki, wskaźniki, czasy).
- **Touch minima:** `touch-action: manipulation` w base `button` (eliminacja 300 ms tap-delay iOS) — nie ruszać bez powodu.
- **Świadomie pominięte i czemu** (do ewentualnego przemyślenia w Fazie 8): wirtualizacja findings (zwykle <50, premature), refaktor `<mark>` → `<button>` (zmienia offsety/styling, klawiatura już działa przez globalne ←/→/Enter), `confirm()` przy „Wyczyść" (może irytować przy szybkiej pracy).
