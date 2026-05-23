# DECISIONS — kluczowe decyzje projektowe i procesowe

## Wdrożenie: natywna integracja GitHub↔Railway (nie CLI/MCP do uploadu)
- **Powód:** sieć kontenera Claude Code blokuje hosty Railway („Host not in allowlist"), więc `railway up` z sandboxa nie działa; Railway MCP OAuth bywa niedostępny.
- **Rozwiązanie:** repo `arturdab/detektor_ai` podłączone do Railway; **push/merge na gałąź `claude/ai-slop-detection-tool-ye7nw`** wyzwala auto-build (serwer↔serwer, niezależnie od sandboxa).
- **Diagnostyka/operacje na Railway:** przez Railway MCP (`railway-agent`, `get-status`, `get-logs`), bo wywołania idą przez api.anthropic.com.

## Workflow gałęzi: branch z HEAD deployowego + cherry-pick + squash-merge
- **Powód:** wczesne PR-y mergowano squashem; lokalna „gałąź dev" rozjechała się historią z gałęzią deployową → PR z niej dawał konflikty.
- **Rozwiązanie (sprawdzone):**
  ```bash
  git add -A && git commit -m "..."
  M=$(git rev-parse HEAD)
  git fetch origin claude/ai-slop-detection-tool-ye7nw
  git checkout -b feat/x origin/claude/ai-slop-detection-tool-ye7nw
  git cherry-pick "$M"
  git push -u origin feat/x
  # PR -> base claude/ai-slop-detection-tool-ye7nw -> squash-merge
  ```
- **Nie używać** `claude/railway-deployment-completion-iCbZt` jako bazy (przestarzała).

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
