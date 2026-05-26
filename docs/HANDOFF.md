# HANDOFF — sesja: profesjonalna szata graficzna wg UI kit z Figmy

Stan na koniec sesji. Fakty oparte na kodzie, git i testach. Założenia oznaczone jako ZAŁOŻENIE.

## 0. Cel tej (kolejnej) sesji — PRIORYTET
**Opracować profesjonalną szatę graficzną detektora**, opartą o UI kit z Figmy:
- Plik: <https://www.figma.com/design/tSeivvg2HNlSvpYzvPk5y5/3-Free-Text-Editor-App-UI-Kit--Community-?node-id=6468-23222>
- Community: <https://www.figma.com/community/file/1393893644332354159/3-free-text-editor-app-ui-kit>
- Konkretny frame/node: **`6468-23222`** (zacznij od niego).

Zakres: redesign **wyłącznie warstwy wizualnej** (CSS + ewentualnie drobny markup/klasy) bez zmiany logiki analizy, endpointów, offsetów ani zachowania UI. Układ dwukolumnowy i wszystkie funkcje (jedno okno tekstu, popover propozycji, live oceny, kopiowanie, humanizacja) MUSZĄ działać jak dotąd.

## 1. KLUCZOWY blocker do sprawdzenia NA START
W poprzedniej sesji **nie było dostępu do Figmy** z kontenera. Użytkownik twierdzi, że właśnie dodał connector/MCP do Figmy — **najpierw to zweryfikuj**:
1. `ToolSearch` z query `figma` — czy są narzędzia `mcp__*figma*`?
2. Sprawdź OAuth: `cat ~/.claude/.credentials.json | python3 -c "import sys,json;print(list(json.load(sys.stdin).get('mcpOAuth',{}).keys()))"` — czy doszedł nowy provider?
3. Jeśli MCP wymaga auth → użyj `...__authenticate`, podaj użytkownikowi URL, potem `...__complete_authentication`.
4. Dopiero gdy masz dostęp: pobierz z node `6468-23222` **tokeny**: paleta kolorów (hex), typografia (font family/wagi/rozmiary), border-radius, cienie, spacing/grid, style komponentów (przyciski, inputy, karty, chipy).

**Co NIE działa z tego środowiska (sprawdzone w tej sesji):**
- `figma.com` i `api.figma.com` → **Host not in allowlist** (sieć sandboxa blokuje; allowlist: GitHub, npm, Google Fonts, api.anthropic.com). WebFetch → 403.
- Brak `FIGMA_TOKEN` w env. Brak Figma MCP. OAuth providers w tej sesji: tylko `wordpress`(d0d1de58), `asana`(d259b6d5), `github`.
- ⇒ Jeśli connector Figmy nadal nie działa: poproś użytkownika o **screenshoty** framów (wkleja jako obraz w czacie) albo **export tokenów** (Figma Inspect / plugin Variables→JSON). Nie zgaduj wyglądu kitu.

## 2. Stan kodu (źródło prawdy)
- Gałąź integracyjna **`main`**, HEAD **`772915d`** (#18). Railway auto-deployuje z `main` (trigger ON, Wait for CI OFF).
- Dev-branch tej linii prac: **`claude/sweet-bardeen-5TAH9`** = `origin/main` (zsynchronizowany, czysty).
- Testy: **34 passed**; ruff czysto; `node --check app.js` OK.
- Ostatnie scalone PR-y: #16 (humanizacja: interpunkcja/retry/regeneracja), #17 (kropka w propozycjach na końcu zdania), #18 (popover nie wychodzi poza viewport: `position: fixed` + przycinanie do viewportu).

## 3. Powierzchnia designu do zmiany (gdzie są style)
- **`src/detektor_web/static/style.css`** — całość wyglądu. Tokeny w `:root` (obecnie light theme):
  - `--bg #fafafa`, `--card #fff`, `--text #171717`, `--muted #6b7280`, `--border #eaeaea`, `--accent #171717` (czarny), severity: `--green/yellow/orange/red`, `--radius 12px`, `--shadow`, `--font-sans "Geist"`, `--font-mono "Geist Mono"`.
  - Sekcje: `.topbar`, `.layout/.two-col/.col-left/.col-right`, `.panel/.card`, `.text-pane/.text-box/.highlighted/.text-loader`, `.controls-card`, `.results/.results-bar`, `.verdict`, `.scores/.score-card/.gauge-wrap`, `.findings/.finding`, `.popover/.pop-*`, `.chip.sev-*`.
- **`src/detektor_web/templates/index.html`** — markup + ładowanie fontu (Google Fonts: Geist/Geist Mono, linie 7–13). Jeśli kit używa innego fontu → podmień `<link>` i `--font-sans`.
- **`src/detektor_web/static/app.js`** — logika; **nie zmieniać** offsetów/`setLeftMode`/`refreshScores`/`positionPopover`. Jeśli redesign wymaga nowych klas/elementów, dodawaj ostrożnie.

## 4. Twarde ograniczenia (z CLAUDE.md)
- **Aplikacja po polsku.** Wszystkie teksty UI PL.
- **`.hidden { display: none !important; }`** MUSI zostać (inne reguły ustawiają `display` i nadpisałyby je — był bug: loader/legenda zasłaniały pole).
- **Render lokalnie niemożliwy** (brak Chromium/Playwright) — zmiany wizualne weryfikuje się **dopiero na produkcji po deployu**. Powiedz to użytkownikowi wprost.
- Deploy = **squash-merge PR do `main`** → Railway auto-build. Na PR-ach włączaj auto-merge (squash); brak CI ⇒ w praktyce scalaj ręcznie `merge_pull_request`. Każdą odpowiedź kończ linkiem do produkcji.
- Strefy ostrożności: nie ruszać regexów/kluczy w `heuristics/*.py` i `data/*.yaml`; nie psuć logiki offsetów (`fusion._locate`, `humanize`, `app.js applyReplacement`); nie zmieniać `llm/schema.py`.

## 5. Rekomendowane kroki kolejnej sesji (po kolei)
1. Zweryfikuj dostęp do Figmy (sekcja 1). Jeśli brak → poproś o screenshoty/tokeny i wstrzymaj redesign do ich otrzymania.
2. Wyciągnij tokeny z node `6468-23222`; zmapuj je na `:root` w `style.css` (kolory, font, radius, shadow, spacing).
3. Zaktualizuj `index.html` (font `<link>` jeśli inny) i przeprojektuj komponenty w `style.css` zgodnie z kitem — zachowując strukturę DOM i klasy.
4. Sanity: `node --check app.js`, `ruff format/check`, `pytest -q` (powinno zostać 34 — design nie dotyka backendu).
5. Nowy branch oparty na `origin/main`, PR → `main`, scal (squash). Poproś użytkownika o wizualną weryfikację na produkcji (golden path: wklej tekst → Analizuj → podświetlenia → popover → Humanizuj → Kopiuj).

## 6. Komendy
```bash
.venv/bin/pytest -q
.venv/bin/ruff check src tests && .venv/bin/ruff format src
node --check src/detektor_web/static/app.js
PYTHONPATH=src .venv/bin/uvicorn detektor_web.app:app --reload   # smoke /healthz
git checkout -B <nowy-dev-branch> origin/main
# deploy: PR -> main (squash). Railway MCP: get-status / get-logs / list-deployments.
```

## 7. Otwarte pytania
- Czy connector Figmy działa już z kontenera? (Koniec tej sesji: NIE potwierdzono — czekamy na nową konwersację.)
- Który z 3 wariantów w „3 Free Text Editor App UI Kit" jest docelowy? (Node `6468-23222` to punkt startowy — potwierdź z użytkownikiem, czy to właściwy wariant.)
- Dark mode czy light? (Obecnie light. Kit może być dark — ustalić po podejrzeniu designu.)
