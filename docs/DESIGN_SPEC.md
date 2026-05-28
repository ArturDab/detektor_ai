# DESIGN SPEC — Faza 8 (rewolucja graficzna detektor_ai)

> **Status:** v1.0 — wsad do Faz 8.1-8.9.
> **Benchmark:** Grammarly (4 screeny od użytkownika, opisane w §13).
> **Zostaje:** font Geist (sans + mono), mechanizm `[data-theme]` + `localStorage` + `<meta name="theme-color">`, semantyka HTML (skip-link, `aria-live`, role).
> **Wymiana:** cała paleta (light + dark od zera), skala typograficzna, spacing/radius/elevation/motion, layout, system komponentów, wizualizacja wskaźników slop/AI.
> **Nie ruszamy:** `applyReplacement`, sync `<mark data-idx>` ↔ `CURRENT.findings`, `formatRichHtml`, `refreshScores`, kontrakty `/api/analyze|/api/rewrite|/api/humanize`.

---

## 1. Wizja produktu

**Tonacja:** asystent piszący, nie dashboard. Spokojny, klarowny, precyzyjny. Editor jest sceną główną, sidebar to dyskretny tło-aktor.

**Persona:** autor PL piszący długie teksty (3-15 tys. znaków). Wraca do tekstu wielokrotnie, czyta na pełnym oknie laptopa lub monitorze. Wartości: **klarowność hierarchii**, **komfort długiego czytania**, **odzew bez rozpraszania**.

**Trzy wartości wizualne:**
1. **Klarowność** — jedna główna metryka (writing quality) wiodąca, reszta podporządkowana. Surface biały/jasny, akcent stonowany.
2. **Spokój** — duża linia bazowa typografii (16px+), generous spacing, brak gradientów, animacje fast/base (120-200ms).
3. **Precyzja** — `tabular-nums` wszędzie, severity czytelnie kodowane kolorem + ikoną, kontrasty AA minimum.

**Czego unikamy:** ozdobników wizualnych (gradientów, shadowów bez funkcji, ikon dekoracyjnych), gęstości "panelowej", neon/fluo.

---

## 2. Paleta — Light

Tokeny semantyczne (NIE nazwy kolorów). Wartości HSL dla przewidywalnych pochodnych.

### Neutrale (8 stopni)
| Token | HSL / Hex | Użycie |
|---|---|---|
| `--surface-base` | `hsl(0 0% 100%)` `#ffffff` | tło `<body>`, edytor |
| `--surface-1` | `hsl(220 14% 99%)` `#fcfcfd` | sidebar tło |
| `--surface-2` | `hsl(220 14% 96%)` `#f3f4f6` | karty drugorzędne, hover-row |
| `--surface-3` | `hsl(220 13% 91%)` `#e5e7eb` | bordery |
| `--surface-4` | `hsl(220 9% 76%)` `#bcc1ca` | bordery aktywne, dividers |
| `--text-strong` | `hsl(222 47% 11%)` `#0f172a` | nagłówki, score number |
| `--text-base` | `hsl(220 26% 18%)` `#1f2937` | body |
| `--text-muted` | `hsl(220 9% 46%)` `#6b7280` | caption, label drugorzędny |

### Akcent — wybór: **zielony** (benchmark Grammarly + sygnał "asystent piszący")
| Token | HSL / Hex | Użycie |
|---|---|---|
| `--accent-primary` | `hsl(160 84% 30%)` `#10894e` | primary button, score-bar fill, brand |
| `--accent-primary-hover` | `hsl(160 84% 25%)` `#0c6e3f` | hover |
| `--accent-primary-active` | `hsl(160 84% 21%)` `#0a5e34` | active/pressed |
| `--accent-primary-subtle` | `hsl(160 64% 95%)` `#dffaee` | tło ghost button, mark accept hint |
| `--on-accent-primary` | `hsl(0 0% 100%)` `#ffffff` | tekst na primary |

### Severity (4 poziomy) — light
| Severity | `--sev-*-fg` | `--sev-*-bg-subtle` | `--sev-*-mark-bg` | `--sev-*-border` |
|---|---|---|---|---|
| **high** (critical) | `#b91c1c` | `#fef2f2` | `#fee2e2` | `#fca5a5` |
| **medium** (warning) | `#b45309` | `#fffbeb` | `#fef3c7` | `#fcd34d` |
| **low** (info) | `#1d4ed8` | `#eff6ff` | `#dbeafe` | `#93c5fd` |
| **info** (hint) | `#6b21a8` | `#faf5ff` | `#f3e8ff` | `#d8b4fe` |

### Funkcjonalne
| Token | Hex | Użycie |
|---|---|---|
| `--success` | `#16a34a` | toast „Zastosowano ✓" |
| `--warning` | `#d97706` | LLM error notes |
| `--error` | `#dc2626` | krytyczne alerty |
| `--info` | `#2563eb` | podpowiedzi |

### Tabela kontrastów (light) — wymóg AA (4.5:1 body) / AAA (7:1 headings)
| Para | Ratio | Klasyfikacja |
|---|---|---|
| `--text-base` / `--surface-base` | ~14.2 | AAA ✓ |
| `--text-base` / `--surface-1` | ~14.0 | AAA ✓ |
| `--text-base` / `--surface-2` | ~13.2 | AAA ✓ |
| `--text-muted` / `--surface-base` | ~5.7 | AA ✓ (body) |
| `--accent-primary` / `--surface-base` | ~4.6 | AA ✓ (large text) |
| `--on-accent-primary` / `--accent-primary` | ~4.6 | AA ✓ (button text) |
| `--sev-high-fg` / `--surface-base` | ~7.4 | AAA ✓ |
| `--sev-medium-fg` / `--surface-base` | ~5.8 | AA ✓ |
| `--sev-low-fg` / `--surface-base` | ~8.7 | AAA ✓ |
| `--sev-info-fg` / `--surface-base` | ~9.2 | AAA ✓ |

Walidacja: skrypt audytu z Fazy 3 (`tools/check_contrast.py` jeśli istnieje, lub powtórzyć ręcznie). Każda zmiana paletty → re-run.

---

## 3. Paleta — Dark

Tło **nie** czyste `#000` (zbyt agresywne dla edytora długich tekstów). Neutral-900 z lekkim podtonem niebieskim.

### Neutrale (dark)
| Token | HSL / Hex | Użycie |
|---|---|---|
| `--surface-base` | `hsl(220 27% 8%)` `#0f1115` | `<body>`, edytor |
| `--surface-1` | `hsl(220 24% 11%)` `#161922` | sidebar tło |
| `--surface-2` | `hsl(220 20% 15%)` `#1f2330` | karty, hover-row |
| `--surface-3` | `hsl(220 15% 22%)` `#2e3340` | bordery |
| `--surface-4` | `hsl(220 12% 35%)` `#4a4f5e` | bordery aktywne |
| `--text-strong` | `hsl(220 20% 96%)` `#f1f3f8` | nagłówki, score |
| `--text-base` | `hsl(220 14% 88%)` `#dbdee5` | body |
| `--text-muted` | `hsl(220 9% 64%)` `#9aa1ad` | caption |

### Akcent (dark)
| Token | Hex | Użycie |
|---|---|---|
| `--accent-primary` | `#34d399` | primary, jaśniejszy w dark dla lepszej widoczności |
| `--accent-primary-hover` | `#2cc28a` | |
| `--accent-primary-active` | `#22a973` | |
| `--accent-primary-subtle` | `#0e3225` | tło ghost on dark |
| `--on-accent-primary` | `#0f1115` | tekst na primary (ciemny — primary jest jasny w dark) |

### Severity (dark)
| Severity | `--sev-*-fg` | `--sev-*-bg-subtle` | `--sev-*-mark-bg` | `--sev-*-border` |
|---|---|---|---|---|
| **high** | `#fca5a5` | `#2a1414` | `#3f1d1d` | `#7f1d1d` |
| **medium** | `#fcd34d` | `#2a200a` | `#3b2d10` | `#78350f` |
| **low** | `#93c5fd` | `#0e1d3d` | `#172a52` | `#1e3a8a` |
| **info** | `#d8b4fe` | `#251434` | `#3a1f4f` | `#5b21b6` |

### Funkcjonalne (dark)
`--success #34d399` · `--warning #fbbf24` · `--error #f87171` · `--info #60a5fa`.

### Kontrasty dark (sanity check obowiązkowy w 8.1)
Każdy `--sev-*-fg` na `--surface-base` ≥ 4.5; `--on-accent-primary #0f1115` na `--accent-primary #34d399` ≥ 4.5; `--text-base` na `--surface-base` ≥ 14.

### `<meta name="theme-color">`
- `media="(prefers-color-scheme: light)"` → `#ffffff`
- `media="(prefers-color-scheme: dark)"` → `#0f1115`

---

## 4. Severity scale — pełna anatomia

Cztery poziomy, każdy z 4 rolami tokenowymi (`fg`, `bg-subtle`, `mark-bg`, `border`). **Critical używamy oszczędnie** — tylko dla wysokiej pewności heurystyki.

- **high** — czerwony, podświetlenie `mark-bg` + 2px squiggle `border` jako `text-decoration-style: wavy`.
- **medium** — bursztynowy, `mark-bg` + 2px solid underline.
- **low** — niebieski, `mark-bg` + 1px dotted underline.
- **info** — fioletowy, tylko cienki underline 1px solid (bez mark-bg), do delikatnych podpowiedzi (np. "rozważ przeformułowanie").

Po edycji (`applyReplacement`) — zastosowany fragment dostaje **flash**: tło `--accent-primary-subtle` przez 600ms, fade-out. Sygnalizacja "zaakceptowano".

---

## 5. Typografia

**Font:** Geist Sans (już załadowany via Google Fonts), Geist Mono dla cytatów w popoverze i diff inline.

### Skala (rem; base font-size 16px → 1rem = 16px)
| Token | Rozmiar | Line-height | Weight | Użycie |
|---|---|---|---|---|
| `--font-display` | `2.5rem` (40px) | `1.15` | `600` | hero score number (writing quality 98) |
| `--font-h1` | `1.75rem` (28px) | `1.25` | `600` | topbar logo, ewentualne sekcje |
| `--font-h2` | `1.375rem` (22px) | `1.3` | `600` | sidebar panel titles |
| `--font-h3` | `1.125rem` (18px) | `1.4` | `600` | finding title, popover header |
| `--font-body-lg` | `1.0625rem` (17px) | `1.65` | `400` | **editor body** (komfort długiego czytania) |
| `--font-body` | `1rem` (16px) | `1.55` | `400` | sidebar body, finding rationale |
| `--font-body-sm` | `0.9375rem` (15px) | `1.55` | `400` | popover body, dimension row |
| `--font-caption` | `0.8125rem` (13px) | `1.45` | `500` | label, status, "Edited X ago" |
| `--font-label` | `0.75rem` (12px) | `1.4` | `600` letter-spacing `0.04em` uppercase | section labels, severity chip |
| `--font-mono` | `0.9375rem` (15px) | `1.55` | `400` | quoted text w popoverze, diff |

### Reguły globalne
- `font-feature-settings: "ss01", "cv11"` (Geist stylistic sets — sprawdzić CSS Google Fonts URL).
- `font-variant-numeric: tabular-nums` dla wszystkich liczb (score, licznik znaków, "1/N" w nav).
- Heading `text-wrap: balance` (gdzie wspierane).
- Body `text-wrap: pretty` w edytorze.
- Polskie znaki: walidacja na `ą/ę/ż/ź/ć/ń/ó/ś/ł` — szczególnie diakrytyki w score number i caption (Geist obsługuje, ale screenshot test).

### Weights
- **400** — body
- **500** — caption, link, label
- **600** — headings, score, button label, finding title
- (NIE używamy 700+, bo Geist 600 jest już mocny)

---

## 6. Spacing

Skala 4px-base. Wartości w `rem`.

| Token | px | Użycie |
|---|---|---|
| `--space-0` | 0 | reset |
| `--space-1` | 2 | hairline, separator |
| `--space-2` | 4 | inline gap min |
| `--space-3` | 8 | inline gap |
| `--space-4` | 12 | stack-sm, button padding-y |
| `--space-5` | 16 | stack-md, card padding |
| `--space-6` | 20 | inline-lg |
| `--space-7` | 24 | stack-lg, sekcje sidebar |
| `--space-8` | 32 | section gap, container padding |
| `--space-9` | 40 | editor padding-x |
| `--space-10` | 56 | hero spacing |
| `--space-11` | 72 | landmark gap |
| `--space-12` | 96 | (rezerwa) |

### Tokeny semantyczne
- `--space-inline-sm: var(--space-3)` — przyciski obok siebie
- `--space-inline-md: var(--space-4)` — chip + label
- `--space-stack-sm: var(--space-3)` — paragraph spacing
- `--space-stack-md: var(--space-5)` — między elementami w karcie
- `--space-stack-lg: var(--space-7)` — między sekcjami sidebara
- `--space-section: var(--space-8)` — sekcje main
- `--space-page: var(--space-9)` — padding strony

---

## 7. Radius

| Token | px | Użycie |
|---|---|---|
| `--radius-xs` | 4 | mark, chip mały |
| `--radius-sm` | 6 | input, select |
| `--radius-md` | 10 | button, card |
| `--radius-lg` | 16 | popover, panel sidebar |
| `--radius-pill` | 9999 | severity chip, score bar, primary button (Grammarly pill style) |

**Decyzja:** primary CTA "Analizuj" = `--radius-pill` (jak Grammarly green button). Secondary buttons = `--radius-md`. Karty/popover = `--radius-lg`.

---

## 8. Elevation

Cztery poziomy. **Każdy poziom = border-color + shadow**, NIE same shadowy (w dark mode same shadowy są niewidoczne).

| Token | Light | Dark | Użycie |
|---|---|---|---|
| `--elev-flat` | brak shadow, `1px solid var(--surface-3)` | brak shadow, `1px solid var(--surface-3)` | flat card, input |
| `--elev-card` | `0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)` + `1px solid var(--surface-3)` | `0 1px 2px rgba(0,0,0,.35)` + `1px solid var(--surface-3)` | sidebar card, finding-item |
| `--elev-popover` | `0 4px 12px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.10)` + `1px solid var(--surface-3)` | `0 4px 12px rgba(0,0,0,.50), 0 8px 24px rgba(0,0,0,.45)` + `1px solid var(--surface-3)` | popover, toast |
| `--elev-modal` | `0 8px 24px rgba(0,0,0,.12), 0 24px 48px rgba(0,0,0,.16)` | `0 8px 24px rgba(0,0,0,.55), 0 24px 48px rgba(0,0,0,.50)` | (rezerwa — modal jeśli zajdzie potrzeba) |

---

## 9. Motion

### Czasy
| Token | ms | Użycie |
|---|---|---|
| `--dur-fast` | 120 | hover state-layer, button press |
| `--dur-base` | 200 | popover enter/exit, mode switch, accordion |
| `--dur-slow` | 320 | page transitions (jeśli dodamy), score number tween |

### Easingi
| Token | Wartość | Użycie |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | standard wejść |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | toggle, accordion |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | mark "flash" po apply, score number bounce |

### `prefers-reduced-motion`
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Wzorce
- **Hover** — color/bg-color transition tylko, brak transform.
- **Press** — `transform: scale(0.97)` na 80ms, ease-out.
- **Popover enter** — `opacity 0 → 1` + `translateY(4px → 0)`, `--dur-base` `--ease-out`.
- **Score number** — animowany tween wartości (`requestAnimationFrame`) tylko w `--dur-fast`, NIE przy `prefers-reduced-motion`.
- **Mark flash po apply** — bg `--accent-primary-subtle` → transparent, `--dur-slow` `--ease-spring`.

---

## 10. Komponenty (anatomia)

Dla każdego: warianty + stany (rest/hover/focus/active/disabled/loading).

### 10.1 Button
**Warianty:** `primary` (pill, accent bg, white text) · `secondary` (md radius, surface-2 bg, text-base) · `ghost` (transparent bg, text-base, hover surface-2) · `icon` (square 36×36, ghost).

**Rozmiary:** `sm` (28h padding 4/12) · `md` (36h padding 8/16) · `lg` (44h padding 10/20).

**Stany:**
- rest: jak wyżej
- hover: `--accent-primary-hover` (primary) / `surface-2` (ghost) / underline (link)
- focus-visible: `box-shadow: 0 0 0 3px var(--accent-primary-subtle)`
- active: `--accent-primary-active` (primary) + `transform: scale(0.97)`
- disabled: `opacity: 0.45`, `cursor: not-allowed`
- loading: spinner SVG inline 16px na lewo od labela; button disabled

### 10.2 Input / Textarea
**Anatomia:** `--surface-base` bg · `1px solid --surface-3` · `--radius-sm` · padding `12/16`.

**Stany:**
- hover: `border-color: --surface-4`
- focus-visible: `border-color: --accent-primary`, `box-shadow: 0 0 0 3px --accent-primary-subtle`
- error: `border-color: --error`
- disabled: `bg --surface-2`, `text-muted`

Textarea editor: bez border (border zniknie w `view`-mode), `font-body-lg`, padding `--space-7 --space-9`.

### 10.3 Select
**Decyzja:** **stylowany native** `<select>` (bez customu — zachowamy a11y klawiatury for free). Strzałka chevron via `background-image` SVG. Jeśli w 8.3 okaże się że styling jest niewystarczający (np. options nie da się stylować) → fallback do custom z `<button>` + `<ul role="listbox">` + obsługą ArrowUp/Down/Enter/Escape.

### 10.4 Card
**Anatomia:** `--surface-base` bg · `--elev-card` · `--radius-lg` · padding `--space-7`.

**Warianty:** `default` · `interactive` (hover: `--elev-popover` + `cursor: pointer`).

### 10.5 Popover
**Anatomia:** `--surface-base` bg · `--elev-popover` · `--radius-lg` · padding `--space-7` · max-width `420px` · arrow 8px wystająca w stronę kotwicy.

**Pozycjonowanie:** `position: fixed` (NIE absolute) — żeby nie konfliktować ze scroll-containerem editora/sidebara. JS oblicza pozycję względem kotwicy + flip jeśli wychodzi poza viewport.

**Stany:** enter (opacity+translateY) · open (interaktywny, focus trap) · closing.

### 10.6 Badge / Severity Chip
**Anatomia:** pill (`--radius-pill`) · `--font-label` · padding `2/8`.

**Warianty:**
- `severity-high` — `bg: --sev-high-bg-subtle`, `color: --sev-high-fg`, `border: 1px solid --sev-high-border`
- `severity-medium`, `severity-low`, `severity-info` — analogicznie
- `count` — `bg: --surface-3`, `color: --text-base` — dla licznika "2" obok kategorii

### 10.7 ScoreCard (slop — wiodący wskaźnik)
**Anatomia (inspiracja Grammarly "Writing quality"):**
- Label `"Jakość pisania"` (`--font-caption` `--text-muted` uppercase letter-spacing)
- Score number `"NN"` (`--font-display`, `--text-strong`, `tabular-nums`)
- Etykieta `"/100"` obok (`--font-body-sm`, `--text-muted`)
- Progress bar pod liczbą: track `--surface-3`, fill `--accent-primary` (jeśli score ≥70) / `--warning` (40-69) / `--error` (<40); height 6px; `--radius-pill`; transition `width --dur-base --ease-out`
- (Opcjonalny) info icon obok labela — tooltip wyjaśnia liczbę

**Wariant kompaktowy** (w `<details>` lub na mobile): sama liczba + bar, bez labela.

### 10.8 AIIndicator (AI provenance — odrębny artefakt)
**Anatomia:** wyraźnie różny od ScoreCard, żeby user nie mylił dwóch metryk.
- Label `"Ślad AI w tekście"` (`--font-caption`)
- **Segmented bar** (5 segmentów `--radius-pill`): każdy segment 20% szerokości; wypełnione od lewej liczba=round(score/20); color: niski (0-40) `--info`, średni (40-70) `--warning`, wysoki (70-100) `--error`
- Wartość numeryczna `"NN%"` po prawej (`--font-h3`, `tabular-nums`)
- Etykieta jakościowa pod barem: `"Tekst wygląda na ludzki"` / `"Prawdopodobnie AI"` / `"Bardzo prawdopodobne AI"`

**Decyzja:** segmented bar (nie circular gauge) — radykalnie różny od ScoreCard, łatwy do skanowania jednym spojrzeniem.

### 10.9 DimensionRow (per-wymiar z LLM)
**Anatomia:** wiersz w `<ul>` — label po lewej, mini-bar po prawej (60px), wartość 0-100.
- `<li>`: flex, `padding --space-3 0`, bottom-border `--surface-3`
- Label: `--font-body-sm` `--text-base`
- Bar: jak ScoreCard ale wysokość 4px, szerokość 60px
- Wartość: `--font-caption` `tabular-nums`

### 10.10 FindingItem
**Anatomia:**
- `<li>` z `--elev-flat` na hover `--elev-card`, `--radius-md`, padding `--space-5`
- Header row: severity chip + finding type label + akcja "..." (kebab menu — placeholder)
- Quote: `--font-mono` `--text-base` w bloku z `border-left: 3px solid --sev-{X}-border` + padding-left `--space-5`
- Rationale: `--font-body-sm` `--text-muted` (LLM/heurystyka explanation)
- Action row: primary button "Pokaż propozycje" (otwiera popover) lub inline diff jeśli mieści się

**Stan aktywny** (nawigacja prev/next dotarła do tego item-a): `border-left: 3px solid --accent-primary`, scroll-into-view.

### 10.11 Popover content (propozycje humanizacji)
- Header: severity chip + tytuł `--font-h3`
- Quote: ten sam blok co w FindingItem
- Diff inline (decyzja w 8.7): token-level color-coding (`bg --sev-high-bg-subtle` dla usunięć z `text-decoration: line-through`, `bg --accent-primary-subtle` dla wstawień). Render Diff-Match-Patch lub własny token diff (po word boundary).
- Lista propozycji (3 sztuki) — każda jako `<button class="suggestion">`: text + `--surface-2` bg, hover `--accent-primary-subtle`, click → `applyReplacement(idx, text)` + close popover.
- Input "Wpisz własną wersję" + Enter (lub submit button) — submit przez `applyReplacement`.
- "Odrzuć" link na dole — close popover bez zmiany.

### 10.12 Toast
**Anatomia:** floating bottom-right; `--surface-base` bg, `--elev-popover`, `--radius-md`, padding `--space-4 --space-5`; ikon (success ✓ / error ⚠) + text `--font-body-sm`; auto-dismiss po 2000ms; ARIA `role="status"` `aria-live="polite"`.

**Wywołanie z JS:** `showToast({ text, variant: "success"|"error" })`. Zastępuje obecny inline ✓ przy "Kopiuj".

### 10.13 Skip-link
**Anatomia:** `position: absolute; top: -40px; left: 8px`; po focus `top: 8px`; `--accent-primary` bg, white text, `--radius-md`, padding `--space-4 --space-5`. Target: `#main`.

### 10.14 ThemeToggle
**Anatomia:** icon button 36×36; ikona ☀ (w dark — kliknij żeby przejść na light) / 🌙 (w light); `aria-label="Przełącz na ciemny motyw"` / `"jasny"`. Toggle klasy `[data-theme]` na `<html>` + persist `localStorage["detektor.theme"]`. Init w `<head>` inline scripcie **przed** CSS (no FOUC).

### 10.15 Loading overlay (editor)
**Anatomia:** absolute over textarea/rendered; `--surface-base` bg z `backdrop-filter: blur(2px)` + opacity 0.85; spinner SVG 24px `--accent-primary`; tekst "Analizuję…" `--font-body` `--text-muted`. ARIA `aria-busy="true"` `aria-live="polite"`.

---

## 11. Szkielet layoutu

### Desktop ≥ 1280px (główny target)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR  (h=56px, sticky)                                                   │
│  [Logo "detektor_ai"]                          [Model select] [Theme]       │
├──────────────────────────────────────────────────┬──────────────────────────┤
│  EDITOR PANE  (flex 1, max-width 820px center)   │  SIDEBAR  (w=380px)      │
│                                                  │  (sticky, max-h 100vh)   │
│  ┌──────────────────────────────────────────┐    │  ┌────────────────────┐  │
│  │  Toolbar:                                │    │  │ ControlsCard       │  │
│  │  [Wklej przykład] [Wyczyść]  word: 0     │    │  │ [Analizuj──→]      │  │
│  │  ────────────────────────────────────    │    │  │ ☑ Z propozycjami   │  │
│  │                                          │    │  │ status: ...        │  │
│  │  <textarea / overlay / rendered>         │    │  └────────────────────┘  │
│  │                                          │    │                          │
│  │  [body-lg, padding --space-9]            │    │  ┌────────────────────┐  │
│  │                                          │    │  │ ScoreCard (slop)   │  │
│  │  ▌ podświetlenia <mark>...</mark>        │    │  │  ████████░ 87/100  │  │
│  │                                          │    │  └────────────────────┘  │
│  │                                          │    │  ┌────────────────────┐  │
│  │                                          │    │  │ AIIndicator        │  │
│  │                                          │    │  │  ▮▮▮▯▯ 52%        │  │
│  │                                          │    │  └────────────────────┘  │
│  │                                          │    │                          │
│  │                                          │    │  Findings (N)            │
│  │                                          │    │  ┌────────────────────┐  │
│  │                                          │    │  │ FindingItem ●      │  │
│  │                                          │    │  │ FindingItem ●      │  │
│  │                                          │    │  │ FindingItem ●      │  │
│  │                                          │    │  └────────────────────┘  │
│  │                                          │    │                          │
│  │                                          │    │  AnalysisBar (sticky bot)│
│  │                                          │    │  [←] 3/12 [→] [✓ Apply] │
│  └──────────────────────────────────────────┘    │                          │
│                                                  │  [Kopiuj] [Humanizuj all]│
└──────────────────────────────────────────────────┴──────────────────────────┘
```

### Tablet 960-1279px
Sidebar `w=340px`, editor max-width skaluje proporcjonalnie. Brak innych zmian.

### Mobile < 960px
**Decyzja:** **best-effort** (target = desktop). Stack pionowy: sidebar **na górze**, sticky, collapsed do `ControlsCard` + scores; ekspand "Findings (N) ▾" rozwija listę. Editor pod spodem. AnalysisBar = `position: fixed; bottom: 0; left: 0; right: 0`.

### Topbar — anatomia
- Logo: ikon (16×16 SVG) + tekst "detektor_ai" (`--font-h1`); brand colored
- Środek: nic (Grammarly trzyma tam title dokumentu — my nie mamy dokumentów)
- Prawo: ModelSelect (kompakt, `--font-caption`) + ThemeToggle

**Decyzja (open question #3 z planu):** ModelSelect w topbarze **nie** w sidebarze — bo to globalna decyzja per-session, nie kontekstowa do analizy.

### Editor toolbar (mały pasek nad textarea)
- Lewo: `[Wklej przykład]` `[Wyczyść]` (ghost sm buttons)
- Prawo: `<span class="word-count">N słów</span>` `--font-caption` `--text-muted`

### Right rail (Grammarly-like icons) — **rezygnujemy w v1.0**
Grammarly ma pionowy pasek ikon (chat, proofreader, authorship, …). My nie mamy tylu narzędzi — dodanie pustego rail = wizualny szum. Zostawiamy single-sidebar. Jeśli w przyszłości pojawi się drugi widok (np. "Heurystyki vs LLM"), wracamy do tematu.

---

## 12. Stany interakcyjne (matryca)

Dla każdego komponentu interaktywnego: rest / hover / focus-visible / active / disabled / loading. Stany **muszą** być widoczne dla użytkownika klawiatury (focus-visible obowiązkowo).

| Komponent | rest | hover | focus-visible | active | disabled | loading |
|---|---|---|---|---|---|---|
| `Button primary` | accent bg, on-accent text | accent-hover | `0 0 0 3px accent-subtle` | accent-active, `scale(0.97)` | opacity 0.45 | spinner SVG inline |
| `Button secondary` | surface-2 bg, text-base | surface-3 bg | `0 0 0 3px accent-subtle` | surface-4 bg | opacity 0.45 | spinner |
| `Button ghost` | transparent | surface-2 bg | `0 0 0 3px accent-subtle` | surface-3 bg | opacity 0.45 | spinner |
| `Button icon` | transparent | surface-2 bg | `0 0 0 3px accent-subtle` | surface-3 bg | opacity 0.45 | rotujący spinner |
| `Input/Textarea` | border surface-3 | border surface-4 | border accent, ring 3px subtle | (jak focus) | bg surface-2 | n/a |
| `Select` (native styled) | jak input | jak input | jak input | (browser) | jak input | n/a |
| `Card interactive` | elev-card | elev-popover, lekkie translateY(-1px) | ring 3px subtle | elev-card, scale(0.99) | opacity 0.6 | n/a |
| `Suggestion in popover` | surface-2 bg | accent-subtle bg, accent-primary text | ring 3px subtle | accent-subtle 90% | opacity 0.45 | n/a |
| `FindingItem` | elev-flat | elev-card | ring 3px subtle on left-border | scroll-into-view | opacity 0.6 | skeleton (8.3) |
| `mark` (w edytorze) | sev mark-bg + underline | brightness(0.95) (CSS filter) | n/a (focus na buttonie w aria) | n/a | n/a | n/a |
| `ThemeToggle` | jak icon button | jak | jak | jak | n/a | n/a |

---

## 13. Screeny Grammarly (referencje)

User wrzucił 4 screeny w turze z DESIGN_SPEC.md. Plan: po merge tego PR-a, user kopiuje pliki PNG do `docs/design/screenshots/` (placeholdery niżej). Tu opisy:

### `grammarly-01-proofreader.png` (główny widok edytora + sidebar)
- **Topbar** ~56px: home + doc icon + tytuł "Invincible VS Overview"; right: Try Pro badge (gradient navy/violet, gwiazdka), Share, AI chat icon, "..." menu.
- **Editor**: white bg, czarny tekst body, comfort reading, dużo padding boczny. Czerwone `<mark>` z subtle bg + 2px wavy underline na "krytycznych błędach"; mały kółko-marker `●` w lewym marginesie z labelem "Fix a critical mistake" (kotwica do popovera).
- **Inline popover** (floating nad markiem): white card z arrow w górę, `--elev-popover`, lekka shadow, `--radius-lg`. Header: zielone logo Grammarly + "Fix a critical mistake" `--font-h3`. Body: oryginał z propozycją (zielone tło na wstawce — diff inline word-level). Action row: "Accept" (green pill primary, `--radius-pill`) + "Dismiss" (text link). Copy icon w prawym górnym rogu karty.
- **Sidebar prawa** ~360px: white bg, top — zielone logo + "Grammarly Proofreader" `--font-h2`. "Writing quality" + info icon → `98 / 100` `--font-display` `tabular-nums`. Progress bar pod liczbą — cienki (~4px), zielony fill, gray track, `--radius-pill`. "Filter by category" label `--font-label`. Lista filtrów: każdy wiersz = severity dot (`●` kolorowy 8px) + label `--font-body-sm` + count badge po prawej (surface-3 bg pill). Active wiersz = lekkie tło `surface-2`.
- **Icon rail** prawej krawędzi ~52px: pionowa kolumna 12 ikon, aktywna ma zielony pill bg za ikoną.
- **Toast bottom-right** "Try our AI detection" — card z dismiss x, info ikon + label + arrow CTA.
- **Avatar** "AD" prawy dolny róg.

### `grammarly-02-ai-chat.png` (AI Chat panel)
- Sidebar zmieniony — header: chat ikon + "AI Chat" + x close.
- Empty state: greeting tekst "Hi Artur..." `--font-body` `--text-base`.
- Card link "Grammarly Proofreader" — same writing quality 98 + severity chips "● 2 Correctness" (czerwony) "● 2 Clarity" (niebieski).
- Subtekst: "Get tailored suggestions to improve your writing in Grammarly Proofreader." `--text-muted`.
- Input "Ask AI" + send icon button (zielony enabled).

### `grammarly-03-dashboard.png` (lista dokumentów)
- Left nav ~250px: wordmark "grammarly" + "Free" badge. Items: "Docs" (active), "Version history", "Trash", "Account", "Apps" (4 count). Bottom: Support, Sign out + email.
- Main: marketing banner "Use Grammarly everywhere you write" + integration logos + green CTA "Get the app" + dismiss x.
- "Docs" h1 + green primary button `+ New doc` (`--radius-pill`) + secondary `Upload`. Search box po prawej.
- "Today" section header `--font-label`.
- Doc card 280×200: thumbnail icon centered + tytuł `--font-h3` + "Edited 22 minutes ago" `--font-caption` `--text-muted` + "..." menu.

### `grammarly-04-authorship.png` (panel autorstwa)
- Sidebar: niebieski "@" icon + "Authorship" title `--font-h2`.
- Paragraph opisujący feature `--font-body-sm` `--text-muted`.
- "Typed by a human" label + "0%". Progress bar **fioletowy** wypełniony (tu sztuczka: bar pokazuje sumę "Copied or generated" jako violet, dlatego 100%).
- Trzy sekcje z badge'ami procentowymi:
  - `0%` **Started as human writing** (zielony badge): typed unmodified / rephrased / corrected
  - `100%` **Copied or generated** (fioletowy badge): AI-generated / corrected / **Copied from source 100%**
  - `0%` **Unknown**: untracked text
- CTA: green primary "Open full report" pełnej szerokości na dole.

### Wnioski przeniesione do spec
1. **Pill-shape primary** (CTA "Analizuj" + "Open full report" analog) → przyjęte (§7, §10.1).
2. **Score number duża + progress bar pod** → przyjęte (§10.7).
3. **Severity dots + count chips w liście kategorii** → przyjęte (§10.6, §10.10).
4. **Inline floating popover nad markiem** (zamiast w bok) z arrow → przyjęte (§10.5, §10.11).
5. **Sidebar single-column z multiple cards** (nie tabs) → przyjęte (§11).
6. **Right icon rail** → **odrzucone w v1.0** (nie mamy tyle narzędzi — sztuczne).
7. **Marketing banner / dashboard / left nav** → **N/A** (single-page app bez auth).
8. **AI Chat z empty state + greeting** → wzorzec na nasz "stan przed pierwszą analizą" (empty proposals panel).
9. **Diff inline word-level w popoverze** (zielone wstawki) → przyjęte (§10.11) — implementacja w 8.7.
10. **Tabular score 98/100 z `tabular-nums`** → przyjęte (§5).
11. **Authorship purple bar** → **N/A** — nie kopiujemy Authorship feature.

---

## 14. Open questions zamknięte w v1.0

| Pytanie | Decyzja | Sekcja |
|---|---|---|
| Score wiodący — liczba 0-100 czy litera A/B/C? | **0-100** (spójność z payloadem, dokładność) | §10.7 |
| Custom select vs styled native? | **Styled native** (a11y for free); fallback na custom w 8.3 jeśli styling niewystarczający | §10.3 |
| ModelSelect w topbarze czy sidebarze? | **Topbar** (decyzja per-session, nie kontekstowa) | §11 |
| Mobile < 960 — target czy best-effort? | **Best-effort** (sidebar na górę stack, AnalysisBar fixed-bottom) | §11 |
| Right icon rail (Grammarly-like)? | **Odrzucone v1.0** | §11, §13 |
| Score animation przy live-refresh? | **Tak**, `--dur-fast`, respect `prefers-reduced-motion` | §9 |
| Diff inline w popoverze? | **Token-level** (lepsze UX) | §10.11 |
| Logo/brand? | **Wordmark "detektor_ai"** z Geist + mała ikon SVG (do zaprojektowania w 8.0 follow-up albo użycie czystego wordmark) | §11 |
| Akcent primary — który kolor? | **Zielony** `#10894e` (light) / `#34d399` (dark) — inspiracja Grammarly + sygnał "asystent piszący" | §2, §3 |

---

## 15. Niezamknięte open questions (do dopytania przed kolejnymi fazami)

~~1. **Akcent zielony**~~ — **POTWIERDZONE** `#10894e` (light) / `#34d399` (dark). Wdrożone w Fazie 8.1.
~~2. **Ikon SVG dla logo**~~ — **WDROŻONE** w Fazie 8.1: lupa (magnifying glass) z centralnym punktem jako SVG inline w `<h1>`. `currentColor` → adaptuje się do motywu (kolor = `var(--accent)`).
~~3. **Severity 4 czy 3 poziomy?**~~ — **POTWIERDZONE** 3 poziomy: `info` scalony z `low`. Obie klasy (`sev-info`, `sev-low`) mapują na niebieski. Wdrożone w Fazie 8.1 (tokeny) i w 8.4 (wizualne scalenie marks).
~~4. **Empty state**~~ — **ILUSTRACJA** (user potwierdził). Do projektu w Fazie 8.5 (sidebar).
5. **Skill audit** — przewidziany po 8.6, 8.7, 8.9; ale można odpalić wcześniej (po 8.1 tokenach).

---

## 16. Verification per faza

Każdy PR Fazy 8.x:
1. `.venv/bin/pytest -q` → 34 zielone.
2. `.venv/bin/ruff check src tests && .venv/bin/ruff format src --check`.
3. `node --check src/detektor_web/static/app.js`.
4. **Smoke kontraktowy** (devtools po deploy):
   - klik `<mark>` → popover → wybór propozycji → tekst się zmienia
   - `refreshScores` aktualizuje wskaźniki po `applyReplacement`
   - "Kopiuj cały tekst" zwraca toast ✓
   - klawiatura ←/→/Enter w nav działa
   - Tab od początku strony skacze przez skip-link do `#main`
   - theme toggle persistuje w `localStorage`, brak FOUC po refreshu
5. **Kontrasty AA** — `tools/check_contrast.py` (jeśli istnieje) lub manualny audyt.
6. **Audyt** skillem `.agents/skills/web-design-guidelines` po fazach 8.1, 8.6, 8.7, 8.9.
7. **Render**: lokalnie niemożliwy (brak Chromium); weryfikacja na <https://detektor-ai.up.railway.app> po SUCCESS deploy (Railway MCP `get-status`/`get-logs`).

---

## 17. Pliki do utworzenia / zmiany w kolejnych fazach (mapa)

| Faza | Pliki |
|---|---|
| 8.0 (ten PR) | `docs/DESIGN_SPEC.md`, `docs/design/screenshots/.gitkeep`, update `docs/ROADMAP.md`, update `docs/HANDOFF.md` |
| 8.1 | `src/detektor_web/static/style.css` (top ~150L: nowe tokeny + reset + aliasy starych nazw) |
| 8.2 | `src/detektor_web/templates/index.html` (semantyka), `static/style.css` (grid + breakpointy) |
| 8.3 | `static/style.css` (button, input, select, card, badge, popover, toast), `static/app.js` (`showToast` utility) |
| 8.4 | `templates/index.html` (editor pane), `static/style.css` (.editor*), `static/app.js` (drobne klasy w `setLeftMode`) |
| 8.5 | `templates/index.html` (sidebar), `static/style.css` (.sidebar*), `static/app.js` (klasy w `renderReport`) |
| 8.6 | `static/style.css` (.score-card, .ai-indicator, .dimension-row), `static/app.js` (`renderScores` HTML — bez zmian źródła danych) |
| 8.7 | `static/style.css` (.finding-item, .popover, .suggestion, .diff), `static/app.js` (HTML/klasy — **NIE** `applyReplacement`) |
| 8.8 | `static/style.css` (motion + a11y polish), `static/app.js` (focus-trap, klawiatura) |
| 8.9 | dowolny — fix po audycie |

---

## 18. Nazewnictwo CSS

**Konwencja:** BEM-light z prefiksami funkcjonalnymi.
- Komponenty: `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--sm`
- Block: `.score-card`, `.score-card__number`, `.score-card__bar`, `.score-card--compact`
- Stany: `.is-active`, `.is-loading`, `.is-disabled` (modyfikatory stanowe)
- Severity: `.sev-high`, `.sev-medium`, `.sev-low`, `.sev-info` (legacy — utrzymujemy nazwy z app.js)
- Utility: `.sr-only`, `.skip-link`, `.hidden` (`display: none !important` — utrzymujemy)

**Tokeny CSS:** snake-case z prefiksami: `--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*` (alias dla `--elev-*`), `--dur-*`, `--ease-*`. Stare nazwy (`--accent`, `--bg`, `--card`, `--text`, `--green`, `--yellow`, ...) zostają **jako aliasy** w Fazie 8.1, do removal w 8.9.

---

## 19. Faza 8.1 — zrealizowane (tokeny CSS + logo)

- [x] Akcent zielony `#10894e` (light) / `#34d399` (dark) wdrożony.
- [x] Logo SVG (lupa z centralnym punktem) inline w `<h1>`, `currentColor`.
- [x] Severity scalona do 3 poziomów: `sev-info` = `sev-low` (oba niebieski).
- [x] Nowe canonical tokeny `--color-*`, `--space-*`, `--radius-xs/pill`, `--dur-*`, `--ease-*`.
- [x] Legacy aliases (`--accent`, `--bg`, `--surface`, ...) zachowane dla kompatybilności reszty CSS.
- [x] Dark mode: nowe tokeny + dark green accent + ciemne surfaces bez błękitu.
- [x] Severity w dark mode: `sev-low` zmienione z żółtego na niebieski.
- [ ] User wrzuca PNG screeny do `docs/design/screenshots/grammarly-{01..04}.png` (pliki nie są dostępne w konwersacji jako pliki — należy ręcznie skopiować do tego katalogu po merge).

---

<https://detektor-ai.up.railway.app>
