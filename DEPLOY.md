# Handoff: wdrożenie na Railway

Dokument dla kolejnej sesji (z działającym Railway MCP). Aplikacja jest gotowa;
projekt na Railway już istnieje, repo jest podłączone — zostaje dokończyć deploy.

## STAN NA TERAZ (czytaj najpierw)
- Kod kompletny i wypchnięty. Najnowszy commit na gałęzi: ostatni na
  `claude/ai-slop-detection-tool-ye7nw` (repo `arturdab/detektor_ai`).
- GitHub repo `arturdab/detektor_ai` zostało **podłączone do Railway** przez
  użytkownika (GitHub App ma dostęp).
- Railway **projekt już utworzony** (NIE twórz drugiego):
  - projectId: `dc230d9e-ba34-44d2-8793-baa7ddae9924` (nazwa `detektor-ai`)
  - environment `production`: `533baa05-7e6b-46c8-b942-d5c3c3f2bb40`
  - workspace `arturdab`: `8180366c-03e0-4c95-99d5-d7a9322b83e1`
- W poprzedniej próbie powstała **zaślepka serwisu** `web`
  (`24b213f8-0457-4d60-a393-28eb4bd58102`), ale deploy się nie udał (repo nie było
  jeszcze podłączone) i `environmentStatusTool` pokazywał 0 serwisów. Najpierw
  sprawdź status; jeśli serwis jest pusty/zepsuty — napraw albo usuń i utwórz na nowo.

## DO ZROBIENIA (cel)
Dokończyć deploy z podłączonego repo i podać użytkownikowi publiczny URL.

1. (Railway MCP) Uwierzytelnij serwer, jeśli trzeba (OAuth — zwykle działa po
   reconnect). Sprawdź `list-projects` / `get-status` dla projektu wyżej.
2. Użyj `railway-agent` (projectId + environmentId jak wyżej): utwórz/napraw serwis
   `web` połączony z repo `arturdab/detektor_ai`, gałąź
   `claude/ai-slop-detection-tool-ye7nw` (Nixpacks: `requirements.txt` + Procfile
   + `.python-version` 3.11).
3. Ustaw zmienną serwisu `GEMINI_MODEL=gemini-3.1-pro-preview`. NIE ustawiaj
   `GEMINI_API_KEY` (chyba że użytkownik poda) — bez niego apka działa w trybie
   heurystyk.
4. Odpal deploy, śledź `get-status` / `get-logs` / `list-deployments`.
5. Wygeneruj publiczną domenę i podaj URL.
6. `accept-deploy` (akcja destrukcyjna) — POTWIERDŹ z użytkownikiem przed wykonaniem.

## Aplikacja
Detektor „AI slop" po polsku: FastAPI + heurystyki + Gemini 3.1 Pro. Dwa wskaźniki
(slop/jakość, prawdopodobieństwo AI), podświetlanie fragmentów. Działa też bez klucza.
- Entrypoint ASGI: `detektor_web.app:app` (binduje `0.0.0.0:$PORT`)
- Layout `src/`: pakiety `detektor` (rdzeń) + `detektor_web` (web)

## Pliki istotne dla buildu (w repo)
- `Procfile`: `web: PYTHONPATH=src uvicorn detektor_web.app:app --host 0.0.0.0 --port ${PORT:-8000}`
- `requirements.txt`, `.python-version` (`3.11`), `pyproject.toml`

## Zmienne środowiskowe (Railway)
- `GEMINI_API_KEY` — opcjonalnie; brak = tryb heurystyk
- `GEMINI_MODEL` — domyślnie `gemini-3.1-pro-preview`
- `PORT` — ustawia Railway; nie nadpisywać

## Weryfikacja po wdrożeniu
- `GET /healthz` → `{"status":"ok","llm_available":<bool>,"model":"..."}`
- `GET /` → strona „Detektor AI slop"
- `POST /api/analyze` z `{"text":"Warto zauważyć, że ..."}` → JSON: `slop`,
  `ai_provenance`, `findings`

## Fallback (gdyby MCP nie działał)
Railway CLI: `npm i -g @railway/cli`, `RAILWAY_TOKEN=<project token>`, `railway up`
z katalogu repo (sieć do Railway z kontenera działa, jest Node 22). Token tworzy
użytkownik: Railway → detektor-ai → Settings → Tokens.

## Stan jakości kodu (zweryfikowane wcześniej)
`pytest -q` 20/20, `ruff check`/`format` czysto, serwer i czysta instalacja w stylu
Railway przetestowane (`/healthz`, `/api/analyze` OK).

## Uruchomienie lokalne
```bash
uv venv && uv pip install -e ".[dev]"
uvicorn detektor_web.app:app --reload   # http://127.0.0.1:8000
```
