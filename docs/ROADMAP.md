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

### Faza 6 — Drobne UX (ZREALIZOWANA, #41)
- [x] Przyciski "Wklej przykład" / "Wyczyść" w nagłówku panelu tekstu.
- [x] `EXAMPLE_TEXT` w `app.js` (przykład PL).
- [x] `copyAll` z feedbackiem inline "Skopiowano ✓" (revert po 1.8 s).

### Faza 7 — Audyt web-design-guidelines (ZREALIZOWANA, #42)
- [x] A11y: skip-link "Przejdź do treści" → `#main`, `aria-label` na nav-prev/next/textarea/select, `aria-live="polite"` na statusach, `aria-hidden` na dekoracyjnej ikonie, `<meta name="theme-color">` light/dark.
- [x] Typografia: `…` zamiast `...` w placeholderze i "Analizuję…", `font-variant-numeric: tabular-nums` dla cyfr.
- [x] Interakcja: `touch-action: manipulation` w base `button` (eliminacja 300 ms tap-delay iOS).

---

## Faza 8 — REWOLUCJA GRAFICZNA (NOWY KIERUNEK)

**Zmiana kierunku po Fazie 7.** Material 3 + jasny błękit z Faz 1-7 to fundament — dobry, ale ograniczony charakter ("dashboard" zamiast "asystent piszący"). User zdecydował o **pełnej rewolucji**: nowa paleta (akcent zielony), nowy szkielet, nowy system komponentów, redesign wskaźników.

**Benchmark:** Grammarly (jedyny — 4 screeny od usera, opisy w `docs/DESIGN_SPEC.md` §13).

**Źródło prawdy:** [`docs/DESIGN_SPEC.md`](DESIGN_SPEC.md) — pełny spec (paleta light/dark, typografia, spacing, radius, elevation, motion, 15 komponentów, szkielet layoutu, matryca stanów). Faza 8.0 produkuje ten dokument; Fazy 8.1-8.9 to jego implementacja.

**Zostaje:** font Geist (sans + mono), mechanizm `[data-theme]` + `localStorage` + `<meta name="theme-color">`, semantyka HTML (skip-link, `aria-live`, role), helper `_asset_version` (cache-busting), `Cache-Control: no-store` na HTML.

**Nie ruszamy:** backend (heurystyki, LLM, endpointy, payloads), mechanika offsetów (`applyReplacement`, sync `<mark data-idx>` ↔ `CURRENT.findings`, `formatRichHtml`, `refreshScores`).

### Faza 8.0 — Research + Design Spec (W TOKU — ten PR)
- [x] Decyzje projektowe podjęte (zakres, benchmark, fundamenty, strefy zakazane).
- [x] `docs/DESIGN_SPEC.md` napisany (paleta, typografia, spacing, komponenty, szkielet).
- [x] `docs/design/screenshots/README.md` — placeholdery na PNG od usera.
- [ ] User wrzuca PNG screeny do `docs/design/screenshots/` po merge.
- [ ] User potwierdza akcent zielony (`#10894e`) lub proponuje alternatywę.

### Faza 8.1 — Tokeny + reset CSS
Wymiana fundamentu CSS: nowe `:root` + `[data-theme="dark"]` zgodnie ze spec. Stare nazwy zmiennych jako aliasy mapowane na nowe wartości (kompatybilność). Reset/normalize.

### Faza 8.2 — Layout / szkielet
Nowy grid (header + main 2-col), proporcje editor ~62% / sidebar ~38%, breakpointy ≥1280 / 960-1279 / <960 (best-effort). Sticky sidebar, semantyka `<header>`/`<main>`/`<aside>`.

### Faza 8.3 — Komponenty bazowe + typografia
`Button` (primary pill, secondary, ghost, icon × 3 rozmiary), `Input/Textarea`, `Select` (styled native), `Card`, `Badge`, `Popover` (skorupa + arrow + animacja), `Toast` (utility `showToast()` w app.js). Skala typograficzna podpięta globalnie.

### Faza 8.4 — Editor (lewa kolumna)
Nowy wygląd textarea (focus, placeholder, licznik znaków), spinner-overlay, `view`-mode (podświetlony tekst). `<mark>` w nowej kolorystyce severity. **Nie ruszamy** `setLeftMode`/`renderHighlighted`/`formatRichHtml` jako logiki.

### Faza 8.5 — Sidebar wyników (prawa kolumna)
Nowa hierarchia: controls → scores → findings → nav. Skorupa komponentów (treść w 8.6/8.7).

### Faza 8.6 — Wskaźniki (slop + AI provenance)
`ScoreCard` (slop = wiodący "writing score", duża liczba + progress bar — inspiracja Grammarly Writing quality 98/100). `AIIndicator` = osobny artefakt (segmented bar 5 segmentów + label jakościowy "Prawdopodobnie AI") — wyraźnie różny od ScoreCard. `DimensionRow` per wymiar z LLM.

### Faza 8.7 — Findings + propozycje + popover
Redesign listy findings + popovera (3 propozycje + custom input + diff inline token-level orig→sugg). **Najbardziej delikatna faza** — sync `<mark data-idx>` ↔ `CURRENT.findings` musi działać identycznie.

### Faza 8.8 — Motion + micro-interakcje + a11y polish
Tranzycje hover/focus, animacja popovera, fade-in podświetleń, mark flash po apply, focus-trap w popoverze, klawiatura w liście findings, `aria-live` po `refreshScores`. `prefers-reduced-motion` respect.

### Faza 8.9 — Audyt + fix
Run `.agents/skills/web-design-guidelines` na produkcji, fix znalezisk, finalny przegląd kontrastów na realnych PL (z `ą/ę/ż`), Lighthouse, removal aliasów ze starych nazw tokenów.

---

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
