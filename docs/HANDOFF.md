# HANDOFF — sesja UI dwukolumnowe + jedno okno tekstu + migracja na `main`

Stan na koniec sesji. Fakty oparte na kodzie, git, testach i Railway MCP.
Założenia oznaczone jako ZAŁOŻENIE.

## Gdzie jest kod (źródło prawdy)
- **Gałąź integracyjna: `main`**, HEAD **`7372d19`** (#12). PR-y celują w `main` (squash-merge).
- **Gałąź auto-deployu Railway: `claude/ai-slop-detection-tool-ye7nw`** = `7372d19` (fast-forward do `main`). Railway **wciąż** śledzi tę gałąź, nie `main`.
- Produkcja: deploy #12 **SUCCESS** (commit `7372d19`) — fix loadera jest live.
- Lokalne working tree: czyste; lokalny branch `claude/sweet-hawking-ujT6S` zresetowany na `origin/main`.
- **Przestarzałe (nie używać jako bazy):** `claude/railway-deployment-completion-iCbZt`.

## Co zmieniono w tej sesji (wszystko zmergowane do `main`)
1. **#10** Układ dwukolumnowy (lewa: tekst z podświetleniami; prawa: werdykt+wskaźniki+propozycje). Live przeliczanie ocen heurystycznie po edycji: backend `analyze_text(use_llm=...)` + `AnalyzeRequest.judge` (`/api/analyze {"judge": false}`); front `renderScores`/`refreshScores`. Przycisk „Kopiuj cały tekst". Stały slot podglądu (koniec „skakania" w liście propozycji).
2. **#11** Jedno okno tekstu w lewej kolumnie: textarea → nakładka ze spinnerem (`setLeftMode`) → podświetlony tekst z propozycjami; przycisk „Edytuj / wklej nowy". „Analizuj"+model+opcje na górze prawej kolumny; oceny ukryte do pierwszej analizy. Stały slot podglądu również w popoverze. Usunięto osobne okno wsadu i nieużywane CSS (`.input-pane/.controls/.actions`). Dodano zasadę auto-merge w `CLAUDE.md §0`.
3. **#12** Fix krytyczny: `.text-loader`/`.legend` (display:flex) były w CSS po `.hidden`(display:none) i przy równej specyficzności wygrywały → loader i legenda zasłaniały pole tekstu od startu. Naprawione: `.hidden { display: none !important; }`.
4. Utworzono gałąź `main` (z `claude/ai-slop-detection-tool-ye7nw`); PR-y #10–#12 zmergowane do `main`.

## Co działa (potwierdzone)
- 32/32 testów, ruff czysto, `node --check app.js` OK.
- Tryb heurystyczny (bez klucza): `/healthz`, `/api/models` (źródło `static`), `/api/analyze` (z `judge:true/false`), `/api/rewrite`, `/api/humanize` — graceful.
- `/api/analyze {"judge": false}` zwraca oceny heurystyczne, `llm_error=null` (zweryfikowane curl-em lokalnie).
- Deploy #12 SUCCESS; aplikacja wstała (logi: `Uvicorn running on 0.0.0.0:8080`).

## Co jeszcze nie działa / niepewne
- **Render nowego UI niezweryfikowany** — w środowisku brak Chromium/Playwright; sprawdzić wizualnie na produkcji (jedno okno, spinner tylko na czas analizy, prawa kolumna, live oceny, kopiowanie, popover bez „skakania").
- **Źródło deployu Railway = wciąż `claude/ai-slop-detection-tool-ye7nw`**, nie `main` (agent MCP rate-limited — nie dało się przełączyć z kontenera).
- **LLM na Flashu end-to-end** — nadal niepotwierdzone przez użytkownika (judge + humanizacja).

## Rekomendowane następne zadanie (dokładnie)
1. **Przełącz źródło deployu Railway na `main`**: panel Railway → projekt `detektor_ai` → service `web` → Settings → Source → Branch = `main`, zapisz i zdeployuj. (Albo Railway MCP `railway-agent`, gdy nie rate-limited: projectId `dc230d9e-ba34-44d2-8793-baa7ddae9924`, env `533baa05-7e6b-46c8-b942-d5c3c3f2bb40`, service `24b213f8-0457-4d60-a393-28eb4bd58102`.)
2. Po przełączeniu: zweryfikuj, że push do `main` sam wyzwala deploy (`list-deployments` → branch `main`).
3. Poproś użytkownika o test produkcji i potwierdź wizualnie nowy UI.
4. Potwierdź LLM Flash w logach (`get-logs`, brak `Gemini:`/`Gemini rewrite`); rozważ ustawienie env `GEMINI_MODEL` na Flash.

## Pliki najprawdopodobniej istotne w kolejnej sesji
- Front: `src/detektor_web/templates/index.html`, `src/detektor_web/static/app.js` (`setLeftMode`, `refreshScores`, `copyAll`, `PREVIEW_HINT`), `src/detektor_web/static/style.css` (`.hidden !important`, `.text-box/.text-loader`, `.two-col`, `.pop-preview`).
- Backend: `src/detektor_web/app.py` (`AnalyzeRequest.judge`), `src/detektor/pipeline.py` (`analyze_text(use_llm=...)`).
- LLM/humanizacja: `src/detektor/llm/{gemini_judge,rewriter,discovery}.py`, `src/detektor/humanize.py`, `src/detektor/config.py`.

## Komendy uruchomione w tej sesji i wyniki
- `.venv/bin/pytest -q` → **32 passed**. `.venv/bin/ruff check src tests` → **czysto**.
- `node --check src/detektor_web/static/app.js` → **OK**.
- Smoke: `uvicorn` + `curl /healthz` → `{"status":"ok","llm_available":false,"model":"gemini-3.1-pro-preview"}`; `/api/analyze {"judge":false}` → oceny heurystyczne, `llm_error:null`.
- Git: PR #10, #11, #12 → squash-merge do `main`; deploy przez fast-forward `claude/ai-slop-detection-tool-ye7nw` → `main`.
- Railway MCP `list-deployments`/`get-status`/`get-logs` → deploye #10/#11/#12 zbudowane, ostatni (#12) **SUCCESS**.
- Railway MCP `railway-agent` (zmiana gałęzi źródłowej) → **rate-limited** (nie wykonano).

## Komendy, które kolejna sesja powinna uruchomić
```bash
python -m venv .venv && .venv/bin/pip install -e ".[dev]"   # jeśli brak środowiska
.venv/bin/pytest -q
.venv/bin/ruff check src tests
PYTHONPATH=src .venv/bin/uvicorn detektor_web.app:app --reload   # smoke /healthz, /api/analyze
```
Na produkcji: po przełączeniu źródła na `main` — Railway MCP `get-status`/`get-logs`.

## Otwarte pytania / niepewności
- Czy użytkownik przełączył już źródło Railway na `main` w panelu? (Na koniec sesji: NIE — wciąż stara gałąź.)
- Czy `GEMINI_API_KEY` i jaki `GEMINI_MODEL` są ustawione na produkcji? ZAŁOŻENIE: klucz ustawiony; domyślny model `gemini-3.1-pro-preview` (użytkownik wybierał Flash per-żądanie w UI).
- Czy nowy UI renderuje się poprawnie na produkcji (układ, spinner, sticky prawa kolumna na różnych szerokościach)? Do potwierdzenia.
- Czy judge/humanizacja działają stabilnie na Flashu end-to-end?
