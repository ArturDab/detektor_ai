# HANDOFF — sesja: redesign v5 (compact bar) + fixy + przygotowanie do redesignu Material 3

Stan na koniec sesji. Fakty oparte na kodzie, git, testach i deployach Railway. Założenia oznaczone jako ZAŁOŻENIE.

---

## 1. Co zmieniło się w tej sesji

### PR #27 (kontekst wejściowy): pozioma belka + nawigacja + bogaty format
Scalony przed właściwą pracą tej sesji (`f8163e1`). Przeniósł kontrolki/oceny na poziomą belkę, dodał nawigację fragmentów i wstępny rich-format tekstu. Stanowił bazę, którą ta sesja przebudowała.

### PR #28: Redesign v5 „compact bar + 2 kolumny" (`b36573c`)
Pełne przepisanie `index.html`, `app.js`, `style.css`. Najważniejsze:
- **Belka analizy** (`#analysis-bar`) = 2 kompaktowe rzędy (~52px każdy): `.abar-controls` (Analizuj, `<select id="model-select">`, checkbox „Z propozycjami", status) + `#abar-results` (liczby Slop/AI jako kolorowy tekst, werdykt, Kopiuj/Humanizuj, toggle „Szczegóły ▾"). Sekcja `#analysis-expand` chowa pełne gauge SVG + sub-werdykt + LLM + wymiary.
- **Model picker:** `<select>` zamiast 4 radiobuttonów (oszczędność miejsca).
- **Brak duplikacji:** liczby w belce, gauge SVG tylko w rozwijanej sekcji.
- **Prawa kolumna:** `#proposals-empty` (empty-state przed analizą) → `#proposals-panel` (po). Pasek `#finding-nav` (← `N/M` →, ✓ Zastosuj).
- **Synchronizacja scroll:** `navigateTo(idx)` → `scrollToFinding` + `scrollToMark`; klawiatura ←/→/Enter.
- **Usunięto:** `.popover`, `.results { display: contents }`, radiobuttony modeli.
- **`--abar-h`** aktualizowane przez `ResizeObserver`.

### PR #29 + #30: Fixy v5
- **#29** (`84ff93c`): pierwsza wersja fixu formatowania (split po pustych liniach), `renderReport` w `try/catch`, przycisk „Załaduj wszystkie (N)" (`loadAllProposals`), `nav-done` bez `margin-left:auto`.
- **#30** (`cccb5df`, aktualny `main`): **właściwy fix** — `formatRichHtml` przetwarza linia-po-linii (tekst z przeglądarki ma pojedyncze `\n`, brak pustych linii); nagłówek H2 wykrywany gdy krótka linia (≤72 zn.) bez interpunkcji końcowej, po linii kończącej zdanie (`.!?…`), niezaczynająca się polskim słowem-łącznikiem (`i/a/ale/oraz/jednak/...`). `updateNav` ustawia `style.display = "flex"/"none"` zamiast klasy `.hidden`; `#finding-nav` w HTML startuje z `style="display:none"`.

---

## 2. Co aktualnie działa (fakty z kodu/testów/deployu)

- **34 testów zielone** (`pytest -q`), ruff czysto, `node --check app.js` OK (uruchomione w tej sesji).
- **Backend bez zmian logiki** — endpointy, heurystyki, LLM, offsety jak wcześniej.
- **`main` = `cccb5df`** (PR #30 zmergowany squashem).
- **Railway deploy `cccb5df` = SUCCESS** (deployment `d491b612...`, 2026-05-27 11:25 UTC, branch `main`).
- **Kurowana lista modeli** działa (`CURATED_MODEL_IDS` w `config.py`, endpoint `/api/models`).
- `app.js` ~738 linii, `style.css` ~898 linii.

---

## 3. Co niezweryfikowane / założenia

- **ZAŁOŻENIE:** Wygląd v5 na produkcji jest poprawny — render lokalny niemożliwy (brak Chromium). Użytkownik w trakcie sesji zgłaszał, że nie widzi zmian (cache) oraz że tekst nie miał formatowania → naprawione w #30, ale **nie potwierdzono wizualnie po deploy `cccb5df`**.
- **ZAŁOŻENIE:** Heurystyka nagłówków `formatRichHtml` daje estetyczny wynik na realnych artykułach — przetestowano logicznie, nie wizualnie.
- **ZAŁOŻENIE:** LLM (Gemini Flash) działa end-to-end na produkcji — niepotwierdzone w tej sesji.

---

## 4. Rekomendowane następne zadanie

**Zaplanować całkowity redesign UI wg Material 3 Design Kit** (Figma file `FFoAwp47aqBCjbPUlz23lm`, node `58295-22726`). Kolejność:
1. Wyciągnąć z kitu tokeny i komponenty (kolory/role, typografia, elevation, kształty/rogi, stany komponentów, spacing). Użyć Figma MCP (`get_design_context`, `get_variable_defs`, `get_screenshot`) — przed `use_figma` załadować skill `/figma-use`.
2. Zaprojektować docelowy układ i przepływ narzędzia (zachowując fundamenty: dwie kolumny, sticky belka, synchronizacja mark↔finding, tryb heurystyczny live). Spisać w `docs/ROADMAP.md`.
3. Przedstawić plan użytkownikowi PRZED implementacją (użytkownik wyraźnie prosił: „Zacznijmy od zaplanowania").
4. Implementacja etapami — każdy etap osobny PR do `main`, weryfikacja na produkcji.

Cel nadrzędny (słowa użytkownika): doświadczenie **estetyczne, ale przede wszystkim sprawne, niezawodne, szybkie i przyjemne**.

---

## 5. Pliki istotne w kolejnej sesji

- `src/detektor_web/static/style.css` — tokeny `:root`, `.analysis-bar`/`.abar-*`, `.col-left`/`.col-right`, `.finding`/`.finding-nav`, `.highlighted .hl-*`.
- `src/detektor_web/static/app.js` — `formatRichHtml`, `renderScores`, `renderReport`, `navigateTo`/`scrollToFinding`/`scrollToMark`, `updateNav`, `loadAllProposals`, `setLeftMode`, `loadModels`, `selectedModel`.
- `src/detektor_web/templates/index.html` — struktura belki, nav, empty-state, `<select>` modeli.
- `src/detektor/config.py` — `CURATED_MODEL_IDS`, `gemini_model`.
- `src/detektor_web/app.py` — `_curate()`, `_speed_hint()`, endpointy.
- `docs/ROADMAP.md` — roadmapa redesignu M3 (utworzona w tej sesji).

---

## 6. Komendy uruchomione w tej sesji i wyniki

```
.venv/bin/pytest -q                          → 34 passed (wielokrotnie)
.venv/bin/ruff check src tests               → All checks passed!
node --check src/detektor_web/static/app.js  → OK
GitHub merge PR #28 (squash)                 → b36573c, merged
GitHub merge PR #29 (squash)                 → 84ff93c, merged
GitHub merge PR #30 (squash)                 → cccb5df, merged
Railway list-deployments                     → cccb5df SUCCESS (11:25 UTC)
```

Uwaga procesowa: kilka PR-ów wymagało wzorca „save → reset `origin/main` → restore → force-with-lease", bo `main` awansował między push a merge (konflikt 405 przy merge).

---

## 7. Komendy do uruchomienia w kolejnej sesji

```bash
# Sanity:
.venv/bin/pytest -q
.venv/bin/ruff check src tests
node --check src/detektor_web/static/app.js

# Nowy dev-branch na świeżym main:
git fetch origin main && git checkout -B <nowa-nazwa> origin/main

# Deploy Railway: Railway MCP list-deployments
#   project dc230d9e-ba34-44d2-8793-baa7ddae9924
#   env     533baa05-7e6b-46c8-b942-d5c3c3f2bb40
#   service 24b213f8-0457-4d60-a393-28eb4bd58102
```

---

## 8. Otwarte pytania i niepewności

1. **Czy v5 wygląda dobrze po deploy `cccb5df`?** — poprosić użytkownika o screen/feedback (cache: hard refresh `Ctrl/Cmd+Shift+R`).
2. **Zakres redesignu M3** — czy pełna zmiana palety/typografii (odejście od Geist+Indigo na rzecz ról kolorów M3 i Roboto/M3 type scale), czy tylko wybrane komponenty? Doprecyzować z użytkownikiem w fazie planu.
3. **Czy LLM Flash działa end-to-end?** — sprawdzić logi Railway pod `Gemini:`/`Gemini rewrite`.
4. **Domyślny model** `GEMINI_MODEL=gemini-3.1-pro-preview` (wolny) — rozważyć Flash w panelu Railway.
5. **Auto-merge nie działa** (brak branch protection) → merge zawsze ręczny `merge_pull_request` (squash). Nie próbować naprawiać.
