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

### Faza 0 — Plan (AKTYWNA)
- [ ] Wyciągnąć z kitu M3 tokeny: role kolorów (primary/secondary/tertiary,
      surface/surface-variant, error, on-*), typografia (display/headline/
      title/body/label scale), elevation (0–5), kształty (corner radii: none/
      xs/sm/md/lg/xl/full), spacing, stany (hover/focus/pressed/disabled).
- [ ] Zmapować komponenty M3 na elementy apki: buttons (filled/tonal/outlined/
      text), select → M3 menu/dropdown, checkbox/switch, cards, chips
      (severity), navigation/segmented buttons (← →), text fields, dialogs,
      snackbar (status), progress (spinner/linear).
- [ ] Zaprojektować docelowy układ + przepływ (wireframe opisowy w tym pliku).
- [ ] Przedstawić plan użytkownikowi do akceptacji PRZED kodowaniem.

### Faza 1 — Tokeny i fundament CSS
- [ ] Przepisać `:root` na role kolorów M3 + type scale + elevation + shape.
- [ ] Zdecydować o foncie (M3 = Roboto / Google Sans; obecnie Geist) — ustalić
      z użytkownikiem.

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

## Otwarte decyzje (do ustalenia z użytkownikiem)
1. Zakres palety: pełne role kolorów M3 czy adaptacja obecnego Indigo do M3?
2. Font: zostać przy Geist czy przejść na Roboto/Google Sans (M3)?
3. Light vs dark: czy wprowadzać dark theme (M3 ma role dla obu)?
4. Czy zachować dokładnie obecny układ 2-kolumnowy, czy M3 sugeruje inny
   (np. navigation rail / panele)?

## Notatki z analizy kitu
_(uzupełniać po pobraniu danych z Figma MCP)_
