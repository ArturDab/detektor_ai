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
  const sel = $("model");
  return sel && sel.value ? sel.value : undefined;
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
  return out.replace(/\n/g, "<br>");
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
      return `<li class="finding sev-${f.severity}">
        <div class="quote">${txt}</div>
        <div>${escapeHtml(f.message)}</div>
        ${sug}
        <div class="src">${escapeHtml(f.analyzer)} &middot; ${SEV_LABEL[f.severity] || f.severity}</div>
        <button class="show-props" data-idx="${i}">Propozycje zmiany</button>
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

function renderReport(r) {
  CURRENT.text = r.text;
  CURRENT.findings = (r.findings || []).map((f) => ({ ...f }));

  renderVerdict(r);
  renderLlmError(r.llm_error);

  $("gauge-slop").innerHTML = gauge(r.slop.score);
  $("band-slop").textContent = bandSlop(r.slop.score);
  $("conf-slop").textContent = `pewność: ${(r.slop.confidence * 100).toFixed(0)}%`;
  $("break-slop").innerHTML = breakdownHtml(r.slop.breakdown);

  $("gauge-ai").innerHTML = gauge(r.ai_provenance.score);
  $("band-ai").textContent = bandAi(r.ai_provenance.score);
  $("conf-ai").textContent = `pewność: ${(r.ai_provenance.confidence * 100).toFixed(0)}%`;
  $("break-ai").innerHTML = breakdownHtml(r.ai_provenance.breakdown);

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

function closePopover() {
  $("popover").classList.add("hidden");
  $("popover").dataset.idx = "";
}

function positionPopover(anchor) {
  const pop = $("popover");
  pop.classList.remove("hidden");
  const rect = anchor.getBoundingClientRect();
  const top = window.scrollY + rect.bottom + 6;
  let left = window.scrollX + rect.left;
  left = Math.min(left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 12);
  pop.style.top = `${top}px`;
  pop.style.left = `${Math.max(8, left)}px`;
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
  $("status").textContent = 'Zastosowano zmianę. Kliknij „Analizuj", aby odświeżyć oceny.';
}

async function openRewrite(idx, anchor) {
  const f = CURRENT.findings[idx];
  if (!f) return;
  const quote = CURRENT.text.slice(f.start, f.end);
  const pop = $("popover");
  pop.dataset.idx = String(idx);
  $("pop-quote").textContent = quote.length > 60 ? quote.slice(0, 60) + "…" : quote;
  $("pop-reason").textContent = f.message + (f.suggestion ? "  →  " + f.suggestion : "");
  $("pop-input").value = "";
  $("pop-list").innerHTML = "<div class='pop-empty'>Generuję propozycje…</div>";
  positionPopover(anchor);

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
  } catch (e) {
    if (pop.dataset.idx === String(idx)) {
      $("pop-list").innerHTML = "<div class='pop-empty'>Błąd pobierania propozycji.</div>";
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
  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model: selectedModel() }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Błąd ${resp.status}`);
    }
    const report = await resp.json();
    renderReport(report);
    $("status").textContent = `Gotowe (${report.word_count} słów).`;
  } catch (e) {
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
    const sel = $("model");
    sel.innerHTML = (data.models || [])
      .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`)
      .join("");
    const saved = localStorage.getItem("detektor_model");
    const ids = (data.models || []).map((m) => m.id);
    sel.value = ids.includes(saved) ? saved : data.default;
    if (!sel.value && ids.length) sel.value = ids[0];
    sel.addEventListener("change", () => localStorage.setItem("detektor_model", sel.value));
  } catch (e) {
    // Brak listy modeli - analiza pojdzie modelem domyslnym z serwera.
  }
}

// ---------- Wiazanie zdarzen ----------

$("analyze").addEventListener("click", analyze);
$("humanize-all").addEventListener("click", humanizeAll);

$("highlighted").addEventListener("click", (e) => {
  const mark = e.target.closest("mark[data-idx]");
  if (mark) openRewrite(Number(mark.dataset.idx), mark);
});

$("findings").addEventListener("click", (e) => {
  const btn = e.target.closest(".show-props");
  if (btn) openRewrite(Number(btn.dataset.idx), btn);
});

$("pop-close").addEventListener("click", closePopover);
$("pop-list").addEventListener("click", (e) => {
  const opt = e.target.closest(".pop-opt");
  if (!opt) return;
  const props = $("popover")._props || [];
  const j = Number(opt.dataset.prop);
  if (props[j] != null) applyReplacement(Number($("popover").dataset.idx), props[j]);
});
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

loadModels();
