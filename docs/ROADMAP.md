# ROADMAP — redesign UI wg Material 3 Design Kit

Plan całkowitego redesignu wizualnego narzędzia Detektor AI slop, zachowując
fundamenty aplikacji (FastAPI + vanilla JS, brak builda frontu). Dokument
żywy — aktualizować po każdej fazie.

## Źródło designu
- **Figma:** Material 3 Design Kit (Community), file `FFoAwp47aqBCjbPUlz23lm`,
  node startowy `58295-22726`.
- **Narzędzia:** Figma MCP — `get_design_context`, `get_variable_defs`,
  `get_screenshot`, `get_metadata`. Przed `use_figma` załadować skill
  `/figma-use`. (URL → fileKey + nodeId; `-` w node-id zamienić na `:`.)

## Cel nadrzędny (słowa użytkownika)
Doświadczenie **estetyczne, ale przede wszystkim sprawne, niezawodne, szybkie
i przyjemne w użytkowaniu**. Zachować fundamenty, poprawiać wszędzie, gdzie się
da. **Najpierw plan układu i zachowania, potem implementacja.**

## Fundamenty do zachowania (nie burzyć)
- Backend bez zmian logiki (endpointy, heurystyki, fuzja, LLM, offsety).
- Dwie kolumny: tekst (lewa) ↔ propozycje (prawa).
- Sticky belka analizy u góry; tryb heurystyczny live (`judge:false`).
- Synchronizacja `<mark>` ↔ karta propozycji (`navigateTo`).
- Stany lewej kolumny `setLeftMode("edit"|"loading"|"view")`.
- Graceful degradation bez `GEMINI_API_KEY`.

## Fazy

### Faza 0 — Plan (ZREALIZOWANA, zaakceptowana)
- [x] Wyciągnięto z kitu M3 tokeny (Figma MCP) — patrz „Notatki z analizy kitu".
- [x] Zmapowano komponenty M3 na elementy v5 — patrz tabela w notatkach.
- [x] Zaprojektowano docelowy układ + przepływ — wireframe opisowy w notatkach.
- [x] Plan przedstawiony i zaakceptowany (decyzje niżej).

### Faza 1 — Tokeny i fundament CSS (W TOKU)
- [x] Przepisano `:root` na neutralne tokeny M3 (powierzchnie, elevation, shape,
      akcent near-black) — zachowano nazwy zmiennych v5 i `--green/...` (app.js).
- [x] Font: **Geist** zostaje, mapowany na skalę typograficzną M3 (decyzja użytk.).
- [ ] Kolejne etapy (komponenty) — Faza 2.

### Faza 2 — Komponenty (ZREALIZOWANA, #33)
- [x] Przyciski → M3: pill-shape (stadium) + state-layery (inset overlay),
      „Analizuj" filled (FAB-like), Kopiuj/Humanizuj tonal, mini outlined.
- [x] Nawigacja `← →` → okrągłe icon-buttony; chipy severity pełny radius.
- [x] Select/checkbox/status — kształt M3 (focus-visible dodany w Fazie 3).

### Faza 3 — Dopracowanie UX i wydajność (ZREALIZOWANA, #35 + #36)
- [x] Stany + **motion wg M3** (easing/duration, wejścia paneli, „pop" aktywnej
      marki), **dostępność**: `:focus-visible` (ring) na elementach
      interaktywnych, `prefers-reduced-motion`.
- [x] **Kontrast (WCAG AA)** — audyt współczynników (#36): tekst/akcent OK;
      podniesiono `--muted-2` (2.53 → ≥4.5 na surface/surface-2) i dodano
      `--on-accent-soft` `#1e40af` (7.15 na accent-soft) dla etykiet tonalnych
      (Kopiuj/Humanizuj/Załaduj). Borderki dekoracyjne (cień + niebieski
      focus-ring) — poza zakresem kontrastu tekstu.
- [~] Płynność: animacje wejścia tylko dla paneli jednorazowych/toggle;
      findings świadomie BEZ animacji (re-render przy apply/refresh →
      anty-migotanie). Szybkość przełączania / lazy-load — wg feedbacku z prod.

### Faza 4 — Weryfikacja
- [ ] Produkcja (brak Chromium lokalnie) — feedback użytkownika.
- [ ] Sanity: pytest / ruff / node --check przy każdej zmianie JS/CSS.

### Faza 5 — Dark mode + cache-busting (ZREALIZOWANA, #37 + #38)
Fundamenty (layout, JS, offsety) bez zmian; każdy etap = osobny PR → `main`.
- [x] **Cache-busting** (#37): `?v=<sha1[:8]>` treści pliku przy `style.css`/
      `app.js` (helper `_asset_version` w `app.py`, wstrzykiwane do szablonu).
      Każdy deploy widoczny natychmiast, bez `Ctrl/Cmd+Shift+R`.
- [x] **Dark tokens (M3)** (#38): ciemna rampa w `:root[data-theme="dark"]` —
      surface `#161c26`/bg `#0e131b`, on-surface jasny, primary `#8ab4f8`,
      `--accent-soft`/`--on-accent-soft`/semantyczne przeliczone; twarde kolory
      (marki, chipy, alerty, podgląd, nakładki) nadpisane scoped.
- [x] **Przełącznik motywu** (#38): inline-skrypt w `<head>` (bez FOUC,
      `prefers-color-scheme` + `localStorage`), toggle w topbarze
      (`#theme-toggle`, `aria-pressed`, `:focus-visible`, `color-scheme`).
- [x] **Audyt kontrastu AA** ciemnej palety (skrypt jak w #36 — wszystkie ≥4.5).
- [ ] (opcjonalnie) backend/LLM: potwierdzić Gemini Flash end-to-end, rozważyć
      domyślny `GEMINI_MODEL` = Flash.

> Weryfikacja wizualna dark (kontrast policzony, ale render lokalnie niemożliwy
> — brak Chromium) do potwierdzenia na produkcji po deployu #38.

## Decyzje (USTALONE z użytkownikiem)
1. **Paleta: jasny błękit + struktura M3.** (AKTUALIZACJA #34 — wcześniej
   neutralny monochrom.) Primary `#2563eb` (vivid blue), powierzchnie z
   błękitnym podtonem, focus-ring/elevation w błękicie; mocniejsze akcenty
   (Analizuj/Kopiuj/ramki/zaznaczenia/gauge). Struktura M3 jak wcześniej.
2. **Font: Geist** (zostaje), mapowany na skalę typograficzną M3 (nie Roboto).
3. **Tryb: tylko jasny** na teraz; tokeny na zmiennych — dark do dodania później.
4. **Układ: 2 kolumny + sticky belka analizy zostają** (fundament). Bez nav rail.
5. **Kolory semantyczne (severity/gauge): własne, dostrojone** — poza core M3.
6. **Deploy = merge PR do `main`** (Railway auto-deploy z `main`).

## Notatki z analizy kitu (Figma MCP, node 58295-22726 „Toolbars")

Node startowy to strona **„Toolbars"** kitu — zawiera komponenty pasków akcji
+ przyciski oraz **globalne zmienne (tokeny) M3** wspólne dla całego kitu.
Tokeny ✓ = potwierdzone w tym node; ○ = kanoniczny M3 baseline.
Primary `#6750A4` jednoznacznie identyfikuje domyślny motyw M3.

### Role kolorów M3 (z kitu) → mapowanie na neutral (nasz wybór)
| Rola M3 | Hex w kicie | Nasza wartość (neutral) |
|---|---|---|
| primary / on-primary | `#6750A4` ✓ / `#FFFFFF` ✓ | `#171717` / `#FFFFFF` |
| primary-container / on- | `#EADDFF` ✓ / `#4F378A` ✓ | `#F4F4F5` / `#171717` |
| secondary-container / on- | `#E8DEF8` ✓ / `#4A4459` ✓ | `#F0F0F0` / `#2B2B2B` |
| tertiary-container / on- | `#FFD8E4` ✓ / `#633B48` ✓ | (nieużywane) |
| surface / on-surface | `#FEF7FF` ○ / `#1D1B20` ○ | `#FFFFFF` / `#171717` |
| surface-container / -high / -highest | `#F3EDF7` ✓ / `#ECE6F0` ○ / `#E6E0E9` ✓ | `#FAFAFA` / `#F4F4F5` / `#E8E8E8` |
| on-surface-variant / outline / outline-variant | `#49454F` ✓ / `#79747E` ○ / `#CAC4D0` ○ | `#6B7280` / `#9CA3AF` / `#E5E7EB` |
| error / error-container | `#B3261E` ○ / `#F9DEDC` ○ | `#DC2626` / `#FEF2F2` |

### Typografia
- **label-large** ✓: Roboto Medium `14px` / lh `20px` / tracking `0.1px`. → u nas
  **Geist 500**, te same metryki (etykiety przycisków).
- Skala M3 (○): Display 57/45/36 · Headline 32/28/24 · Title 22/16/14 ·
  Body 16/14/12 · Label 14/12/11.

### Elevation, kształt, stany
- **Elevation L3** ✓ (floating toolbar): `0 1 3 #0000004D, 0 4 8 spread3 #00000026`.
  → u nas neutralne cienie `--shadow-sm/--shadow/--shadow-lg` (poziomy M3 1–3).
- **Corner/Large = 16px** ✓. Skala: xs4 · sm8 · md12 · lg16 · xl28 · full. v5 ma
  `--radius-lg 16 / --radius 12 / --radius-sm 8` — zgodne z M3.
- **Stany** ✓ (warianty kitu): Enabled/Hovered/Focused/Pressed/Disabled +
  Selected. Opacities M3: hover 8% · focus 10% · pressed 10% · disabled 38%/12%.
- **Komponenty w node:** Toolbar (docked/floating, std/vibrant, h/v), FAB,
  Icon button (+toggleable), Button toggleable (pill, label).

### Mapowanie komponentów M3 → elementy v5
| Komponent M3 | Element v5 | Selektor |
|---|---|---|
| Docked Toolbar | sticky `#analysis-bar` (rzędy controls/results) | `.analysis-bar` |
| Filled button + (extended) FAB | `Analizuj` | `#analyze` |
| Tonal / outlined button | `Kopiuj`, `Humanizuj`, `Szczegóły ▾` | `.btn-secondary`, `.btn-mini` |
| Segmented / icon buttons | nawigacja `← 1/N →`, `✓ Zastosuj` | `.finding-nav .nav-btn` |
| Menu / dropdown | wybór modelu | `#model-select` |
| Checkbox | „Z propozycjami" | `#with-humanize` |
| Card | karty score, panele propozycji | `.card`, `.score-card` |
| Chips (severity) | legenda + podświetlenia | `.chip.sev-*`, `mark.sev-*` |
| Progress (circular) | spinner analizy | `.spinner-lg`, `.text-loader` |
| Text field | textarea wsadu | `#text` |

### Wireframe docelowy (układ + przepływ — bez zmian struktury)
Zachowujemy szkielet v5; redesign jest tokenowy/komponentowy (neutral M3):
```
┌───────────────────────────────────────────────────────────┐
│ TOPBAR (surface, sticky): ▢ logo  Detektor AI [PL]  subtitle │
├───────────────────────────────────────────────────────────┤
│ ANALYSIS BAR = docked Toolbar (sticky, surface-container):  │
│  rząd1: [Analizuj▣FAB] [Model▾] [☑ Z propozycjami] · status │
│  rząd2: [Slop|AI] [werdykt…] [Kopiuj][Humanizuj] [Szczeg.▾] │
│  ▼ rozwijane: gauge SVG · sub-werdykt · LLM · wymiary        │
├──────────────────────────────┬────────────────────────────┤
│ LEWA (Card/text field):      │ PRAWA (sticky):             │
│  textarea → spinner →         │  [← 1/N →][✓ Zastosuj][…]  │
│  podświetlony tekst (mark)    │  empty-state ✦ / karty      │
│  word-count                   │  propozycji (Card+chips)    │
└──────────────────────────────┴────────────────────────────┘
```
**Przepływ bez zmian:** `setLeftMode(edit→loading→view)`, sync `mark↔finding`
(`navigateTo`), live `refreshScores(judge:false)`, klawiatura ←/→/Enter,
`loadAllProposals`. Zmiana M3 = wizualna (kolory/elevation/kształt/stany).

### Faza 6 — Drobne UX (ZREALIZOWANA, #41)
- [x] **Przykładowy tekst**: przycisk „Wklej przykład" (`#load-example`) w nagłówku
      panelu tekstu wypełnia textarea polskim tekstem „slop" do demo
      (`EXAMPLE_TEXT` w `app.js`).
- [x] **Wyczyść** (`#clear-text`): pojawia się gdy textarea ma treść (w trybie
      edycji); `updateInputButtons()` synchronizuje stan z `setLeftMode` i
      licznikiem słów.
- [x] **Feedback kopiowania**: `copyAll` po sukcesie pokazuje na przycisku
      „Skopiowano ✓" (revert do oryginalnej etykiety po 1.8 s).
- [x] Zapamiętywanie wyboru modelu działa od wcześniej (`loadModels` +
      `localStorage`).

### Faza 7 — Audyt web-design-guidelines (Vercel) + fixy (ZREALIZOWANA, #42)
- [x] **Skill** `.agents/skills/web-design-guidelines` uruchomiony — pobiera
      świeże guidelines z `vercel-labs/web-interface-guidelines`.
- [x] **A11y**: `aria-label` na przyciskach ikonowych (`#nav-prev`/`#nav-next` —
      glify w `<span aria-hidden="true">`), na `<textarea>`/`<select>`;
      `aria-live="polite"` na `#status`/`#humanize-status`/`#nav-done`;
      `aria-hidden` na dekoracyjnej `.empty-icon`; **skip-link** „Przejdź do
      treści" → `#main` (off-screen, widoczny przy focusie); `<meta name="theme-color">`
      light/dark.
- [x] **Typografia**: `…` zamiast `...` (placeholder, „Analizuję…");
      `font-variant-numeric: tabular-nums` na `.word-count`/`.bar-score-num`/`.g-num`.
- [x] **Touch**: `touch-action: manipulation` w base `button` — eliminacja 300 ms
      tap-delay iOS.
- [~] Świadomie pominięte: wirtualizacja findings (zwykle <50; premature), marki
      jako `<button>` (większy refaktor offsetów; klawiatura już działa przez
      ←/→/Enter), `confirm()` na „Wyczyść" (może irytować).

### Faza 8 — Nowa szata graficzna (W PRZYGOTOWANIU; planowanie w kolejnej sesji)
Użytkownik zapowiedział (prompt kończący sesję): „W kolejnym kroku opracujemy
zupełnie nową szatę graficzną dla aplikacji. Z mądrzejszym układem, bardziej
intuicyjnym rozkładem elementów, ciekawszą szatą wizualną, lepszym UI/UX, nową
belką górną, upiększonym formatowaniem tekstów, ramek, bardziej intuicyjnymi
reakcjami na działania użytkownika." Praca zaczyna się w **osobnej konwersacji**
od analizy/rekomendacji/planu — NIE od kodu.

**Etapy planowania (do wykonania w kolejnej sesji):**
- [ ] **Analiza obecnego UI**: mocne strony (2 kolumny, sticky belka, sync
      mark↔finding, dark mode M3, a11y baseline) vs słabe (do potwierdzenia z
      użytkownikiem — gęstość belki, hierarchia wizualna, formatowanie ramek,
      prezentacja wskaźników).
- [ ] **Rekomendacje** (do dyskusji): szkielet (2 kolumny vs centered editor +
      side panels), paleta (jasny błękit M3 vs nowa), font (Geist vs alternatywa),
      system komponentów (kontynuacja M3 vs własny), motion (M3 vs bogatsze).
- [ ] **Szczegółowy plan implementacji** w fazach — każda faza = osobny PR do
      `main`, weryfikacja na produkcji.
- [ ] Plan zapisać w tym dokumencie jako Faza 8+ (tokeny, komponenty, kroki).

**Fundamenty do zachowania** (jak w Fazie 0): backend bez zmian logiki, dwie
kolumny tekst↔propozycje, sticky belka analizy, sync `<mark>` ↔ propozycja,
`setLeftMode`, live `judge:false`, graceful degradation bez `GEMINI_API_KEY`.
