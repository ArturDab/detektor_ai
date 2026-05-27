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

### Faza 2 — Komponenty
- [ ] Belka analizy, przyciski, select, checkbox, status → komponenty M3.
- [ ] Karty propozycji + chipy severity + pasek nawigacji → M3.
- [ ] Empty-state, gauge/score, sekcja rozwijana → M3.

### Faza 3 — Dopracowanie UX i wydajność
- [ ] Stany (hover/focus/pressed), animacje/motion wg M3, dostępność (focus
      ring, kontrast, klawiatura).
- [ ] Płynność: brak migotania przy `renderReport`, szybkie przełączanie
      trybów, lazy/parallel load propozycji.

### Faza 4 — Weryfikacja
- [ ] Produkcja (brak Chromium lokalnie) — feedback użytkownika.
- [ ] Sanity: pytest / ruff / node --check przy każdej zmianie JS/CSS.

## Decyzje (USTALONE z użytkownikiem)
1. **Paleta: neutralny monochrom + struktura M3.** Akcent near-black `#171717`
   (nie Indigo, nie fiolet M3); powierzchnie/elevation/kształt/stany wg M3.
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
