# Detektor AI slop (PL)

Narzędzie webowe do wykrywania **AI slop** w artykułach po polsku. Łączy szybkie
heurystyki językowe z oceną modelu **Gemini 3.1 Pro**. Zwraca dwa niezależne
wskaźniki (0–100) wraz z pewnością, podświetla problematyczne fragmenty i podaje
sugestie poprawy.

- **Slop / jakość** – generyczność, frazesy, wata słowna, powtarzalność, niska informatywność.
- **Prawdopodobieństwo AI** – szacunek, na ile tekst wygląda na pisany przez model
  (to *oszacowanie z pasmem niepewności*, nie dowód).

## Jak działa

Hybryda. Heurystyki działają zawsze, lokalnie i deterministycznie (gęstość fraz
slop, różnorodność leksykalna, rytm zdań, sygnały strukturalne, kalki/wycieki).
Sędzia LLM (Gemini) dokłada ocenę niuansów. Bez klucza API lub przy błędzie Gemini
narzędzie nadal działa w trybie „tylko heurystyki" (z obniżoną pewnością).

## Wymagania

- Python 3.11+
- Opcjonalnie klucz Google Gemini API (Google AI Studio)

## Instalacja

```bash
uv venv
uv pip install -e ".[dev]"
```

## Konfiguracja

```bash
cp .env.example .env
# uzupełnij GEMINI_API_KEY (bez niego = tryb heurystyczny)
```

Najważniejsze zmienne (`.env`):

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `GEMINI_API_KEY` | – | Klucz API; brak = tryb heurystyczny |
| `GEMINI_MODEL` | `gemini-3.1-pro-preview` | Model sędziego LLM |
| `ENABLE_LLM` | `true` | Włącza/wyłącza warstwę LLM |
| `LLM_BLEND_SLOP` / `LLM_BLEND_AI` | `0.5` / `0.6` | Udział LLM w finalnym wskaźniku |
| `USE_SPACY` | `false` | Użyj spaCy zamiast segmentera regex |

## Uruchomienie

```bash
uvicorn detektor_web.app:app --reload
# otwórz http://127.0.0.1:8000
```

## API

```bash
curl -X POST http://127.0.0.1:8000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"text": "Twój artykuł po polsku..."}'
```

Odpowiedź zawiera `slop`, `ai_provenance` (score/confidence/band/breakdown),
`findings` (z offsetami do podświetlenia), `flagged_passages`, `dimensions`
(z LLM), `analyzer_scores`, `notes`. Endpoint `GET /healthz` zwraca status i
dostępność LLM.

## Rozszerzanie leksykonu

Frazy slop i łączniki to edytowalne pliki YAML — bez zmian w kodzie:

- `src/detektor/data/slop_phrases_pl.yaml`
- `src/detektor/data/connectors_pl.yaml`

## Testy i jakość kodu

```bash
pytest -q
ruff check .
ruff format .
```

## Struktura

```
src/detektor/        # rdzeń analityczny (niezależny od web)
  text/              # segmentacja PL (regex + skróty, opcjonalnie spaCy)
  heuristics/        # analizatory + leksykony YAML
  llm/               # sędzia Gemini (schemat, prompt, klient)
  fusion.py          # łączenie heurystyk + LLM w 2 wskaźniki
  pipeline.py        # punkt wejścia: tekst -> Report
src/detektor_web/    # FastAPI + interfejs (Jinja2 + vanilla JS)
tests/               # pytest (LLM mockowany, suite działa offline)
```

## Ograniczenia

Wykrywanie autorstwa AI jest z natury zawodne (zwłaszcza dla polszczyzny) i łatwe
do obejścia. Traktuj wskaźnik pochodzenia jako sygnał pomocniczy, nie werdykt —
nie służy do „oskarżania" autorów.
