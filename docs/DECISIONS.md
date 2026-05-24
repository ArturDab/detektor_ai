# DECISIONS — kluczowe decyzje projektowe i procesowe

## Wdrożenie: natywna integracja GitHub↔Railway (nie CLI/MCP do uploadu)
- **Powód:** sieć kontenera Claude Code blokuje hosty Railway („Host not in allowlist"), więc `railway up` z sandboxa nie działa; Railway MCP OAuth bywa niedostępny.
- **Rozwiązanie:** repo `arturdab/detektor_ai` podłączone do Railway; **push/merge na gałąź `claude/ai-slop-detection-tool-ye7nw`** wyzwala auto-build (serwer↔serwer, niezależnie od sandboxa).
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

## Deploy: fast-forward gałęzi śledzonej przez Railway do `main`
- **Stan:** Railway nadal auto-deployuje z `claude/ai-slop-detection-tool-ye7nw` (źródła w panelu nie przełączono na `main` — agent MCP był rate-limited).
- **Mechanizm deployu (do czasu migracji):** po merge do `main` wypchnij `main` na gałąź śledzoną (fast-forward), co wyzwala auto-build:
  ```bash
  git fetch origin main
  git push origin origin/main:refs/heads/claude/ai-slop-detection-tool-ye7nw
  ```
- **TODO:** przełączyć źródło Railway na `main` (panel: service `web` → Settings → Source → Branch), wtedy push do `main` deployuje wprost.

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
