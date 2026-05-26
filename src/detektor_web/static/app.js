"use strict";

const $ = (id) => document.getElementById(id);

const SEV_LABEL = { high: "wysoki", medium: "średni", low: "niski", info: "info" };
const DIM_LABEL = {
  generic: "Generyczność",
  cliche: "Frazesy",
  low_information: "Niska informatywność",
  repetition: "Powtarzalność",
  unnatural_rhythm: "Nienaturalny rytm",
};

// Stan ostatniej analizy (mutowalny przy humanizacji fragmentow).
const CURRENT = { text: "", findings: [] };

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function selectedModel() {
  const r = document.querySelector('input[name="model"]:checked');
  return r && r.value ? r.value : undefined;
}

function colorFor(score) {
  if (score < 25) return getComputedStyle(document.documentElement).getPropertyValue("--green");
  if (score < 50) return getComputedStyle(document.documentElement).getPropertyValue("--yellow");
  if (score < 75) return getComputedStyle(document.documentElement).getPropertyValue("--orange");
  return getComputedStyle(document.documentElement).getPropertyValue("--red");
}

function bandSlop(score) {
  if (score < 25) return "Niski slop · dobra jakość";
  if (score < 50) return "Umiarkowany slop";
  if (score < 75) return "Podwyższony slop · sporo lania wody";
  return "Wysoki slop · słaba jakość";
}

function bandAi(score) {
  if (score < 25) return "Raczej człowiek";
  if (score < 50) return "Niejednoznaczne, raczej człowiek";
  if (score < 75) return "Możliwe AI";
  return "Prawdopodobnie AI";
}

function gauge(score) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  const color = colorFor(score).trim();
  return `<svg viewBox="0 0 120 120" class="gauge">
    <circle cx="60" cy="60" r="${r}" class="g-bg"></circle>
    <circle cx="60" cy="60" r="${r}" class="g-fg"
      style="stroke:${color};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"></circle>
    <text x="60" y="58" class="g-num">${score.toFixed(0)}</text>
    <text x="60" y="76" class="g-cap">/100</text>
  </svg>`;
}

function renderVerdict(r) {
  const slop = r.slop.score;
  const ai = r.ai_provenance.score;
  const slopHigh = slop >= 50;
  const aiHigh = ai >= 50;
  let headline;
  if (!slopHigh && !aiHigh) headline = "Dobra jakość, prawdopodobnie napisane przez człowieka.";
  else if (!slopHigh && aiHigh) headline = "Dobra jakość, ale są sygnały autorstwa AI.";
  else if (slopHigh && !aiHigh) headline = "Generyczny tekst — ale raczej ludzki.";
  else headline = "Generyczny tekst z wyraźnymi sygnałami AI.";

  $("verdict-headline").textContent = headline;
  $("verdict-sub").innerHTML =
    `Jakość/slop: <strong>${slop.toFixed(0)}/100</strong> ` +
    `(${bandSlop(slop)}) &nbsp;·&nbsp; ` +
    `Sygnał AI: <strong>${ai.toFixed(0)}/100</strong> (${bandAi(ai)})`;
  $("verdict").dataset.tone = slopHigh || aiHigh ? "warn" : "ok";
}

function breakdownHtml(items) {
  return items
    .map((b) => `${escapeHtml(b.name)}: ${b.score.toFixed(0)} (waga ${b.weight})`)
    .join(" &nbsp;|&nbsp; ");
}

// Zwraca HTML z podswietleniami; kazdy <mark> ma data-idx -> indeks w findings.
function renderHighlighted(text, findings) {
  const indexed = findings
    .map((f, i) => ({ f, i }))
    .filter((x) => x.f.end > x.f.start)
    .sort((a, b) => a.f.start - b.f.start || b.f.end - a.f.end);
  const chosen = [];
  let lastEnd = -1;
  for (const x of indexed) {
    if (x.f.start >= lastEnd) {
      chosen.push(x);
      lastEnd = x.f.end;
    }
  }
  let out = "";
  let cur = 0;
  for (const { f, i } of chosen) {
    out += escapeHtml(text.slice(cur, f.start));
    const seg = escapeHtml(text.slice(f.start, f.end));
    const tip = escapeHtml(f.message + (f.suggestion ? "  →  " + f.suggestion : ""));
    out += `<mark class="sev-${f.severity}" data-idx="${i}" title="${tip}">${seg}</mark>`;
    cur = f.end;
  }
  out += escapeHtml(text.slice(cur));
  return formatParagraphs(out);
}

// Dzieli zaznaczony HTML na akapity (po pustych liniach), wykrywa krotkie linie
// bez konczacej interpunkcji jako naglowki. Marki (<mark>) zostaja nietkniete.
function formatParagraphs(html) {
  const blocks = html.split(/\n[ \t]*\n+/);
  const parts = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const plain = block.replace(/<[^>]+>/g, "").trim();
    const oneLine = !block.includes("\n");
    const isHeading =
      oneLine && plain.length > 0 && plain.length <= 70 && !/[.!?,;:]$/.test(plain);
    const inner = block.replace(/\n/g, "<br>");
    parts.push(`<p class="hl-p${isHeading ? " hl-heading" : ""}">${inner}</p>`);
  }
  return parts.join("") || `<p class="hl-p">${html.replace(/\n/g, "<br>")}</p>`;
}

function renderDimensions(dimensions) {
  const keys = Object.keys(dimensions || {});
  if (!keys.length) {
    $("dimensions").textContent = "Brak danych z LLM (tryb heurystyczny).";
    return;
  }
  $("dimensions").innerHTML = keys
    .map((k) => {
      const v = dimensions[k];
      const label = DIM_LABEL[k] || k;
      return `<div class="dim-row"><span>${escapeHtml(label)}</span>
        <span class="dim-bar"><span class="dim-fill" style="width:${v}%"></span></span>
        <span>${v}</span></div>`;
    })
    .join("");
}

function renderFindings(findings) {
  $("findings-count").textContent = `(${findings.length})`;
  if (!findings.length) {
    $("findings").innerHTML = "<li class='finding'>Brak wykrytych sygnałów.</li>";
    return;
  }
  $("findings").innerHTML = findings
    .map((f, i) => {
      const sug = f.suggestion ? `<div class="sug">→ ${escapeHtml(f.suggestion)}</div>` : "";
      const txt = f.matched_text ? escapeHtml(f.matched_text) : "";
      let action;
      if (f.proposals && f.proposals.length) {
        const opts = f.proposals
          .map((p, j) => `<button class="prop-opt" data-idx="${i}" data-prop="${j}">${escapeHtml(p)}</button>`)
          .join("");
        action = `<div class="props">${opts}</div>
          <div class="prop-preview" data-idx="${i}">${PREVIEW_HINT}</div>
          <button class="regen-btn" data-idx="${i}">↻ Nowy zestaw propozycji</button>
          <div class="prop-custom-inline">
            <input type="text" data-idx="${i}" placeholder="Wpisz własną wersję..." />
            <button class="prop-custom-apply" data-idx="${i}">Zastosuj</button>
          </div>`;
      } else {
        action = `<button class="show-props" data-idx="${i}">Propozycje zmiany</button>`;
      }
      return `<li class="finding sev-${f.severity}">
        <div class="finding-head">
          <span class="chip sev-${f.severity}">${SEV_LABEL[f.severity] || f.severity}</span>
          <span class="finding-analyzer">${escapeHtml(f.analyzer)}</span>
        </div>
        ${txt ? `<div class="quote">${txt}</div>` : ""}
        <div class="finding-msg">${escapeHtml(f.message)}</div>
        ${sug}
        ${action}
      </li>`;
    })
    .join("");
}

function renderNotes(notes) {
  const info = (notes || []).filter((n) => !n.startsWith("Ocena LLM nie powiodła"));
  $("notes").innerHTML = info.map((n) => `<div class="note">${escapeHtml(n)}</div>`).join("");
}

function renderLlmError(err) {
  const box = $("llm-error");
  if (err) {
    box.innerHTML =
      `<strong>Ocena LLM nie powiodła się — wynik wyłącznie heurystyczny.</strong>` +
      `<div class="alert-detail">Powód: ${escapeHtml(err)}</div>`;
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

// Aktualizuje wylacznie wskazniki (gauge/werdykt/breakdown) — uzywane tez przy
// przeliczaniu na biezaco, bez ruszania listy fragmentow/podswietlen.
function renderScores(r) {
  renderVerdict(r);

  $("gauge-slop").innerHTML = gauge(r.slop.score);
  $("band-slop").textContent = bandSlop(r.slop.score);
  $("conf-slop").textContent = `pewność: ${(r.slop.confidence * 100).toFixed(0)}%`;
  $("break-slop").innerHTML = breakdownHtml(r.slop.breakdown);

  $("gauge-ai").innerHTML = gauge(r.ai_provenance.score);
  $("band-ai").textContent = bandAi(r.ai_provenance.score);
  $("conf-ai").textContent = `pewność: ${(r.ai_provenance.confidence * 100).toFixed(0)}%`;
  $("break-ai").innerHTML = breakdownHtml(r.ai_provenance.breakdown);
}

function renderReport(r) {
  CURRENT.text = r.text;
  CURRENT.findings = (r.findings || []).map((f) => ({ ...f }));

  renderScores(r);
  renderLlmError(r.llm_error);
  renderNotes(r.notes);

  const llmBox = $("llm-explanation");
  if (r.llm_explanation) {
    llmBox.innerHTML = `<strong>Komentarz LLM:</strong> ${escapeHtml(r.llm_explanation)}`;
    llmBox.classList.remove("hidden");
  } else {
    llmBox.classList.add("hidden");
  }

  renderDimensions(r.dimensions);
  $("highlighted").innerHTML = renderHighlighted(CURRENT.text, CURRENT.findings);
  renderFindings(CURRENT.findings);

  $("results").classList.remove("hidden");
}

// ---------- Humanizacja: popover + zastosowanie ----------

let _popAnchor = null;

function closePopover() {
  $("popover").classList.add("hidden");
  $("popover").dataset.idx = "";
  _popAnchor = null;
}

// Pozycjonuje popover (position: fixed) tak, by NIGDY nie wyszedl poza viewport.
// Bez argumentu przelicza pozycje dla zapamietanej kotwicy (po zmianie wysokosci tresci).
function positionPopover(anchor) {
  const pop = $("popover");
  pop.classList.remove("hidden");
  if (anchor) _popAnchor = anchor;
  if (!_popAnchor) return;

  const margin = 8;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const rect = _popAnchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;

  // Poziomo: wyrownaj do lewej krawedzi kotwicy, ale trzymaj w viewport.
  let left = Math.min(rect.left, vw - pw - margin);
  left = Math.max(margin, left);

  // Pionowo: domyslnie pod kotwica; jesli sie nie miesci -> nad nia; na koniec przytnij.
  let top = rect.bottom + 6;
  if (top + ph > vh - margin) {
    const above = rect.top - ph - 6;
    top = above >= margin ? above : Math.max(margin, vh - ph - margin);
  }
  top = Math.max(margin, top);

  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

function applyReplacement(idx, replacement) {
  const f = CURRENT.findings[idx];
  if (!f) return;
  const start = f.start;
  const end = f.end;
  CURRENT.text = CURRENT.text.slice(0, start) + replacement + CURRENT.text.slice(end);
  const delta = replacement.length - (end - start);
  CURRENT.findings.splice(idx, 1);
  for (const g of CURRENT.findings) {
    if (g.start >= end) {
      g.start += delta;
      g.end += delta;
    }
  }
  $("text").value = CURRENT.text;
  $("highlighted").innerHTML = renderHighlighted(CURRENT.text, CURRENT.findings);
  renderFindings(CURRENT.findings);
  closePopover();
  refreshScores();
}

// Przelicza oceny na biezaco (tryb heurystyczny, bez LLM) po edycji fragmentu.
// Aktualizuje tylko wskazniki — lista propozycji i podswietlenia pozostaja lokalne.
let _scoreSeq = 0;
async function refreshScores() {
  const seq = ++_scoreSeq;
  $("status").textContent = "Przeliczam oceny…";
  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: CURRENT.text, model: selectedModel(), judge: false }),
    });
    if (!resp.ok || seq !== _scoreSeq) return;
    const r = await resp.json();
    if (seq !== _scoreSeq) return;
    renderScores(r);
    $("status").textContent =
      'Oceny przeliczone heurystycznie. „Pełna ocena (LLM)" uruchamia sędziego.';
  } catch (e) {
    if (seq === _scoreSeq) $("status").textContent = "Nie udało się przeliczyć ocen.";
  }
}

async function copyAll() {
  const text = $("text").value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    $("humanize-status").textContent = "Skopiowano cały tekst do schowka.";
  } catch (e) {
    $("text").select();
    $("humanize-status").textContent = "Zaznaczono tekst — skopiuj ręcznie (Ctrl/Cmd+C).";
  }
}

const PREVIEW_HINT = `<span class="prop-preview-hint">Najedź na propozycję, aby zobaczyć ją w zdaniu.</span>`;

function previewHTML(f, proposal) {
  const quote = CURRENT.text.slice(f.start, f.end);
  const ctx =
    f.context ||
    CURRENT.text.slice(Math.max(0, f.start - 100), Math.min(CURRENT.text.length, f.end + 100));
  const marked = `<mark class="preview-new">${escapeHtml(proposal)}</mark>`;
  const i = ctx.indexOf(quote);
  if (i < 0) return marked;
  return escapeHtml(ctx.slice(0, i)) + marked + escapeHtml(ctx.slice(i + quote.length));
}

function renderPopProposals(props) {
  const pop = $("popover");
  pop._props = props;
  $("pop-list").innerHTML = props
    .map((p, j) => `<button class="pop-opt" data-prop="${j}">${escapeHtml(p)}</button>`)
    .join("");
  positionPopover();
}

// Pobiera nowy zestaw propozycji z LLM dla danego fragmentu.
async function fetchProposals(f) {
  const nextCh = CURRENT.text[f.end] || '';
  if (/^[.!?…]$/.test(nextCh)) f.end += 1;
  let quote = CURRENT.text.slice(f.start, f.end);
  const ctxStart = Math.max(0, f.start - 80);
  const ctxEnd = Math.min(CURRENT.text.length, f.end + 80);
  const resp = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quote,
      context: CURRENT.text.slice(ctxStart, ctxEnd),
      reason: f.message || "",
      model: selectedModel(),
    }),
  });
  return resp.json();
}

// Generuje nowy zestaw propozycji dla fragmentu (przycisk „Nowy zestaw…").
// Aktualizuje liste i — jesli otwarty dla tego fragmentu — popover.
async function regenerateProposals(idx, btn) {
  const f = CURRENT.findings[idx];
  if (!f) return;
  const orig = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generuję…";
  }
  try {
    const data = await fetchProposals(f);
    const props = data.proposals || [];
    if (props.length) {
      f.proposals = props;
      renderFindings(CURRENT.findings);
      const pop = $("popover");
      if (pop.dataset.idx === String(idx) && !pop.classList.contains("hidden")) {
        renderPopProposals(props);
      }
    } else {
      if (btn) {
        btn.disabled = false;
        btn.textContent = orig;
      }
      const err = data.error ? ` (${data.error})` : "";
      $("humanize-status").textContent = "Nie udało się wygenerować nowych propozycji." + err;
    }
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = orig;
    }
    $("humanize-status").textContent = "Błąd generowania propozycji.";
  }
}

async function openRewrite(idx, anchor) {
  const f = CURRENT.findings[idx];
  if (!f) return;
  const nextCh = CURRENT.text[f.end] || '';
  if (/^[.!?…]$/.test(nextCh)) f.end += 1;
  const quote = CURRENT.text.slice(f.start, f.end);
  const pop = $("popover");
  pop.dataset.idx = String(idx);
  $("pop-quote").textContent = quote.length > 60 ? quote.slice(0, 60) + "…" : quote;
  $("pop-reason").textContent = f.message + (f.suggestion ? "  →  " + f.suggestion : "");
  $("pop-input").value = "";
  $("pop-preview").innerHTML = PREVIEW_HINT;
  positionPopover(anchor);

  // Propozycje policzone juz przy analizie -> pokazujemy od razu, bez dogenerowywania.
  if (f.proposals && f.proposals.length) {
    renderPopProposals(f.proposals);
    return;
  }

  $("pop-list").innerHTML = "<div class='pop-empty'>Generuję propozycje…</div>";
  try {
    const ctxStart = Math.max(0, f.start - 80);
    const ctxEnd = Math.min(CURRENT.text.length, f.end + 80);
    const resp = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote,
        context: CURRENT.text.slice(ctxStart, ctxEnd),
        reason: f.message || "",
        model: selectedModel(),
      }),
    });
    const data = await resp.json();
    // Popover mogl zostac zamkniety lub przelaczony w miedzyczasie.
    if (pop.dataset.idx !== String(idx) || pop.classList.contains("hidden")) return;
    const props = data.proposals || [];
    if (props.length) {
      $("pop-list").innerHTML = props
        .map((p, j) => `<button class="pop-opt" data-prop="${j}">${escapeHtml(p)}</button>`)
        .join("");
      pop._props = props;
    } else {
      const hint = f.suggestion
        ? `Podpowiedź: ${escapeHtml(f.suggestion)}`
        : "Brak propozycji LLM — wpisz własną wersję poniżej.";
      const err = data.error ? ` (${escapeHtml(data.error)})` : "";
      $("pop-list").innerHTML = `<div class='pop-empty'>${hint}${err}</div>`;
    }
    positionPopover();
  } catch (e) {
    if (pop.dataset.idx === String(idx)) {
      $("pop-list").innerHTML = "<div class='pop-empty'>Błąd pobierania propozycji.</div>";
      positionPopover();
    }
  }
}

async function humanizeAll() {
  const text = $("text").value.trim();
  if (!text) return;
  const btn = $("humanize-all");
  btn.disabled = true;
  $("humanize-status").textContent = "Humanizuję cały tekst…";
  try {
    const resp = await fetch("/api/humanize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model: selectedModel() }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Błąd ${resp.status}`);
    }
    const data = await resp.json();
    if (data.changes && data.changes.length) {
      $("text").value = data.text;
      $("humanize-status").textContent = `Zmieniono ${data.changes.length} fragmentów. Odświeżam ocenę…`;
      await analyze();
      $("humanize-status").textContent = `Zhumanizowano ${data.changes.length} fragmentów.`;
    } else {
      $("humanize-status").textContent = data.error || "Brak fragmentów do humanizacji.";
    }
  } catch (e) {
    $("humanize-status").textContent = "Błąd: " + e.message;
  } finally {
    btn.disabled = false;
  }
}

// Tryby lewego okna: edycja (textarea), ladowanie (spinner), podglad (podswietlenia).
function setLeftMode(mode) {
  // Textarea widoczna w trybie edycji ORAZ ladowania (blado w tle pod loaderem).
  $("text").classList.toggle("hidden", mode === "view");
  $("text").classList.toggle("dimmed", mode === "loading");
  $("text-loader").classList.toggle("hidden", mode !== "loading");
  $("highlighted").classList.toggle("hidden", mode !== "view");
  $("legend").classList.toggle("hidden", mode !== "view");
  $("edit-text").classList.toggle("hidden", mode !== "view");
}

async function analyze() {
  const text = $("text").value.trim();
  if (!text) {
    $("status").textContent = "Wklej najpierw tekst.";
    return;
  }
  $("analyze").disabled = true;
  $("analyze").classList.add("loading");
  $("status").textContent = "Analizuję...";
  closePopover();
  setLeftMode("loading");
  try {
    const humanize = $("with-humanize").checked;
    if (humanize) $("status").textContent = "Analizuję i generuję propozycje…";
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model: selectedModel(), humanize }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Błąd ${resp.status}`);
    }
    const report = await resp.json();
    renderReport(report);
    setLeftMode("view");
    $("status").textContent = `Gotowe (${report.word_count} słów).`;
  } catch (e) {
    setLeftMode("edit");
    $("status").textContent = "Błąd: " + e.message;
  } finally {
    $("analyze").disabled = false;
    $("analyze").classList.remove("loading");
  }
}

async function loadModels() {
  try {
    const resp = await fetch("/api/models");
    if (!resp.ok) return;
    const data = await resp.json();
    const box = $("model");
    const models = data.models || [];
    const ids = models.map((m) => m.id);
    const saved = localStorage.getItem("detektor_model");
    const active = ids.includes(saved) ? saved : (ids.includes(data.default) ? data.default : ids[0]);
    box.innerHTML = models
      .map((m) => {
        const checked = m.id === active ? " checked" : "";
        return `<label class="model-radio">
          <input type="radio" name="model" value="${escapeHtml(m.id)}"${checked} />
          <span class="mr-dot"></span>
          <span class="mr-label">${escapeHtml(m.label)}</span>
        </label>`;
      })
      .join("");
    box.addEventListener("change", (e) => {
      const r = e.target.closest('input[name="model"]');
      if (r) localStorage.setItem("detektor_model", r.value);
    });
  } catch (e) {
    // Brak listy modeli - analiza pojdzie modelem domyslnym z serwera.
  }
}

// ---------- Wiazanie zdarzen ----------

$("analyze").addEventListener("click", analyze);
$("humanize-all").addEventListener("click", humanizeAll);
$("copy-all").addEventListener("click", copyAll);
$("edit-text").addEventListener("click", () => {
  $("text").value = CURRENT.text || $("text").value;
  setLeftMode("edit");
  closePopover();
  $("text").focus();
});

$("highlighted").addEventListener("click", (e) => {
  const mark = e.target.closest("mark[data-idx]");
  if (mark) openRewrite(Number(mark.dataset.idx), mark);
});

$("findings").addEventListener("click", (e) => {
  const show = e.target.closest(".show-props");
  if (show) {
    openRewrite(Number(show.dataset.idx), show);
    return;
  }
  const opt = e.target.closest(".prop-opt");
  if (opt) {
    const f = CURRENT.findings[Number(opt.dataset.idx)];
    if (f && f.proposals) applyReplacement(Number(opt.dataset.idx), f.proposals[Number(opt.dataset.prop)]);
    return;
  }
  const capply = e.target.closest(".prop-custom-apply");
  if (capply) {
    const input = capply.closest(".finding").querySelector("input[data-idx]");
    const val = input ? input.value.trim() : "";
    if (val) applyReplacement(Number(capply.dataset.idx), val);
    return;
  }
  const regen = e.target.closest(".regen-btn");
  if (regen) regenerateProposals(Number(regen.dataset.idx), regen);
});

$("findings").addEventListener("mouseover", (e) => {
  const opt = e.target.closest(".prop-opt");
  if (!opt) return;
  const f = CURRENT.findings[Number(opt.dataset.idx)];
  const prev = opt.closest(".finding").querySelector(".prop-preview");
  if (f && prev) {
    prev.innerHTML = previewHTML(f, f.proposals[Number(opt.dataset.prop)]);
  }
});
$("findings").addEventListener("mouseout", (e) => {
  const opt = e.target.closest(".prop-opt");
  if (opt) opt.closest(".finding").querySelector(".prop-preview").innerHTML = PREVIEW_HINT;
});

$("pop-close").addEventListener("click", closePopover);
$("pop-regen").addEventListener("click", () => {
  const idx = Number($("popover").dataset.idx);
  if (!Number.isNaN(idx)) regenerateProposals(idx, $("pop-regen"));
});
$("pop-list").addEventListener("click", (e) => {
  const opt = e.target.closest(".pop-opt");
  if (!opt) return;
  const props = $("popover")._props || [];
  const j = Number(opt.dataset.prop);
  if (props[j] != null) applyReplacement(Number($("popover").dataset.idx), props[j]);
});
$("pop-list").addEventListener("mouseover", (e) => {
  const opt = e.target.closest(".pop-opt");
  if (!opt) return;
  const f = CURRENT.findings[Number($("popover").dataset.idx)];
  const props = $("popover")._props || [];
  const j = Number(opt.dataset.prop);
  if (f && props[j] != null) {
    $("pop-preview").innerHTML = previewHTML(f, props[j]);
  }
});
$("pop-list").addEventListener("mouseout", () => ($("pop-preview").innerHTML = PREVIEW_HINT));
$("pop-apply").addEventListener("click", () => {
  const val = $("pop-input").value.trim();
  if (val) applyReplacement(Number($("popover").dataset.idx), val);
});
$("pop-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("pop-apply").click();
});

document.addEventListener("click", (e) => {
  const pop = $("popover");
  if (pop.classList.contains("hidden")) return;
  if (pop.contains(e.target)) return;
  if (e.target.closest("mark[data-idx]") || e.target.closest(".show-props")) return;
  closePopover();
});

window.addEventListener("resize", () => {
  if (!$("popover").classList.contains("hidden")) positionPopover();
});

// Word / character count
(function () {
  const ta = $("text");
  const el = $("word-count");
  if (!ta || !el) return;
  function update() {
    const val = ta.value;
    if (!val.trim()) { el.textContent = ""; return; }
    const words = val.trim().split(/\s+/).length;
    el.textContent = `${words.toLocaleString("pl-PL")} słów · ${val.length.toLocaleString("pl-PL")} znaków`;
  }
  ta.addEventListener("input", update);
  update();
}());

loadModels();
