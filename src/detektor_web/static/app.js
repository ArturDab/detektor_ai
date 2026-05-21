"use strict";

const $ = (id) => document.getElementById(id);

const SEV_LABEL = { high: "wysoki", medium: "sredni", low: "niski", info: "info" };
const DIM_LABEL = {
  generic: "Generycznosc",
  cliche: "Frazesy",
  low_information: "Niska informatywnosc",
  repetition: "Powtarzalnosc",
  unnatural_rhythm: "Nienaturalny rytm",
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function colorFor(score) {
  if (score < 25) return getComputedStyle(document.documentElement).getPropertyValue("--green");
  if (score < 50) return getComputedStyle(document.documentElement).getPropertyValue("--yellow");
  if (score < 75) return getComputedStyle(document.documentElement).getPropertyValue("--orange");
  return getComputedStyle(document.documentElement).getPropertyValue("--red");
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

function breakdownHtml(items) {
  return items
    .map((b) => `${escapeHtml(b.name)}: ${b.score.toFixed(0)} (waga ${b.weight})`)
    .join(" &nbsp;|&nbsp; ");
}

function renderHighlighted(text, findings) {
  const sorted = [...findings].sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen = [];
  let lastEnd = -1;
  for (const f of sorted) {
    if (f.start >= lastEnd && f.end > f.start) {
      chosen.push(f);
      lastEnd = f.end;
    }
  }
  let out = "";
  let cur = 0;
  for (const f of chosen) {
    out += escapeHtml(text.slice(cur, f.start));
    const seg = escapeHtml(text.slice(f.start, f.end));
    const tip = escapeHtml(f.message + (f.suggestion ? "  →  " + f.suggestion : ""));
    out += `<mark class="sev-${f.severity}" title="${tip}">${seg}</mark>`;
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
    $("findings").innerHTML = "<li class='finding'>Brak wykrytych sygnalow.</li>";
    return;
  }
  $("findings").innerHTML = findings
    .map((f) => {
      const sug = f.suggestion ? `<div class="sug">→ ${escapeHtml(f.suggestion)}</div>` : "";
      const txt = f.matched_text ? escapeHtml(f.matched_text) : "";
      return `<li class="finding">
        <div class="quote">${txt}</div>
        <div>${escapeHtml(f.message)}</div>
        ${sug}
        <div class="src">${escapeHtml(f.analyzer)} &middot; ${SEV_LABEL[f.severity] || f.severity}</div>
      </li>`;
    })
    .join("");
}

function renderNotes(notes) {
  $("notes").innerHTML = (notes || [])
    .map((n) => `<div class="note">${escapeHtml(n)}</div>`)
    .join("");
}

function renderReport(r) {
  $("gauge-slop").innerHTML = gauge(r.slop.score);
  $("band-slop").textContent = r.slop.band;
  $("conf-slop").textContent = `pewnosc: ${(r.slop.confidence * 100).toFixed(0)}%`;
  $("break-slop").innerHTML = breakdownHtml(r.slop.breakdown);

  $("gauge-ai").innerHTML = gauge(r.ai_provenance.score);
  $("band-ai").textContent = r.ai_provenance.band;
  $("conf-ai").textContent = `pewnosc: ${(r.ai_provenance.confidence * 100).toFixed(0)}%`;
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
  $("highlighted").innerHTML = renderHighlighted(r.text, r.findings);
  renderFindings(r.findings);

  $("results").classList.remove("hidden");
}

async function analyze() {
  const text = $("text").value.trim();
  if (!text) {
    $("status").textContent = "Wklej najpierw tekst.";
    return;
  }
  $("analyze").disabled = true;
  $("status").textContent = "Analizuje...";
  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Blad ${resp.status}`);
    }
    const report = await resp.json();
    renderReport(report);
    $("status").textContent = `Gotowe (${report.word_count} slow).`;
  } catch (e) {
    $("status").textContent = "Blad: " + e.message;
  } finally {
    $("analyze").disabled = false;
  }
}

$("analyze").addEventListener("click", analyze);
