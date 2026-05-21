# Handoff: wdrożenie na Railway

Dokument dla kolejnej sesji (z dostępem do Railway). Aplikacja jest gotowa
do wdrożenia — pozostaje uruchomić ją na Railway i uzyskać publiczny URL.

## Co to za aplikacja
Detektor „AI slop" w tekstach po polsku: FastAPI + heurystyki + sędzia LLM
(Gemini 3.1 Pro). Zwraca dwa wskaźniki (slop/jakość, prawdopodobieństwo AI),
podświetla fragmenty, działa też bez klucza API (tryb heurystyk).

- Entrypoint ASGI: `detektor_web.app:app`
- Layout `src/`: pakiety `detektor` (rdzeń) + `detektor_web` (web)

## Repo i gałąź
- Repo: `arturdab/detektor_ai`
- Gałąź roboczą i wdrożeniową: **`claude/ai-slop-detection-tool-ye7nw`**
- UWAGA: nie ma gałęzi `main` — powyższa jest jedyną/domyślną. Jeśli Railway
  prosi o gałąź, wskaż właśnie ją. (PR-a nie da się otworzyć do czasu istnienia
  gałęzi bazowej.)

## Stan (zweryfikowane)
- `pytest -q` → 20/20 (LLM mockowany, suite offline)
- `ruff check .` i `ruff format --check .` → czysto
- Serwer lokalny i czysta instalacja w stylu Railway (deps z `requirements.txt`,
  start z `PYTHONPATH=src`) — `/healthz`, `/`, `/static`, `POST /api/analyze` OK
- Sieć do Railway z kontenera działa (`backboard.railway.app` → 403 = osiągalny),
  Node 22 + npm/npx dostępne (gdyby trzeba było CLI)

## Pliki istotne dla buildu (już w repo)
- `Procfile`: `web: PYTHONPATH=src uvicorn detektor_web.app:app --host 0.0.0.0 --port ${PORT:-8000}`
- `requirements.txt` — zależności runtime
- `.python-version` → `3.11`
- `pyproject.toml` — pakiety `src/detektor`, `src/detektor_web`

## Zmienne środowiskowe (ustawić w Railway)
- `GEMINI_API_KEY` — opcjonalnie; bez niego aplikacja działa w trybie heurystyk
- `GEMINI_MODEL` — opcjonalnie, domyślnie `gemini-3.1-pro-preview`
- `PORT` — ustawia Railway automatycznie; Procfile go używa (nie nadpisywać ręcznie)

## Plan wdrożenia (Railway MCP)
Dostępne narzędzia: `whoami`, `list-projects`, `create-project`, `list-services`,
`list-deployments`, `get-status`, `get-logs`, `redeploy`, `accept-deploy`,
`railway-agent`. Do złożonych/wieloetapowych operacji preferuj `railway-agent`.

1. `whoami` — potwierdź konto/zespół.
2. Utwórz projekt (`create-project`) lub użyj istniejącego (`list-projects`),
   wdrażając z repo GitHub `arturdab/detektor_ai`, gałąź
   `claude/ai-slop-detection-tool-ye7nw` (Nixpacks zbuduje wg `requirements.txt`
   + `.python-version`, start z `Procfile`).
3. Ustaw zmienne env (przynajmniej `GEMINI_API_KEY`, jeśli użytkownik poda).
4. Śledź build/run: `get-status`, `get-logs`, `list-deployments`.
5. Wygeneruj publiczną domenę i podaj URL użytkownikowi.
6. Akcje destrukcyjne (`accept-deploy`) — potwierdź z użytkownikiem przed wykonaniem.

Fallback (gdyby MCP zawiódł): Railway CLI — `npm i -g @railway/cli`,
`RAILWAY_TOKEN=<project token>`, `railway up` z katalogu repo.

## Weryfikacja po wdrożeniu
- `GET /healthz` → `{"status":"ok","llm_available":<bool>,"model":"..."}`
- `GET /` → strona „Detektor AI slop"
- `POST /api/analyze` z `{"text":"Warto zauważyć, że ..."}` → JSON z `slop`,
  `ai_provenance`, `findings`

## Uruchomienie lokalne (gdyby potrzebne)
```bash
uv venv && uv pip install -e ".[dev]"
uvicorn detektor_web.app:app --reload   # http://127.0.0.1:8000
```
