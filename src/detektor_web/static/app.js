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

const CURRENT = { text: "", findings: [] };
let ACTIVE_IDX = -1;
let DONE_COUNT = 0;

const EXAMPLE_TEXT = `W dzisiejszych czasach warto zauważyć, że sztuczna inteligencja odgrywa kluczową rolę w niemal każdej dziedzinie naszego życia. Nie ulega wątpliwości, że dynamiczny rozwój technologii niesie ze sobą szereg wyzwań, a jednocześnie otwiera przed nami zupełnie nowe możliwości. Należy podkreślić, że odpowiednie wykorzystanie tych narzędzi może przynieść wymierne korzyści zarówno dużym firmom, jak i zwykłym użytkownikom.

Z drugiej strony, nie sposób pominąć faktu, że wraz z postępem pojawiają się również istotne pytania natury etycznej. Warto pamiętać, że technologia sama w sobie jest neutralna — to wyłącznie od nas zależy, w jaki sposób ją wykorzystamy. Kluczowe znaczenie ma zatem holistyczne podejście, które uwzględnia różnorodne perspektywy oraz potrzeby wszystkich interesariuszy.

Podsumowując, przyszłość rysuje się w jasnych barwach. Musimy jednak nieustannie dostosowywać się do dynamicznie zmieniającej się rzeczywistości, aby w pełni wykorzystać drzemiący w tych rozwiązaniach potencjał.`;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function showToast({ text, variant = "success" }) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${variant}`;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = text;
  container.appendChild(el);
  const dismiss = () => {
    el.classList.add("toast-exit");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 300);
  };
  setTimeout(dismiss, 2000);
}

function selectedModel() {
  const sel = $("model-select");
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
  const sub = $("verdict-sub");
  sub.innerHTML =
    `Jakość/slop: <strong>${slop.toFixed(0)}/100</strong> ` +
    `(${bandSlop(slop)}) &nbsp;·&nbsp; ` +
    `Sygnał AI: <strong>${ai.toFixed(0)}/100</strong> (${bandAi(ai)})`;
  sub.classList.remove("hidden");
  $("abar-verdict").dataset.tone = slopHigh || aiHigh ? "warn" : "ok";
}

function breakdownHtml(items) {
  return items
    .map((b) => `${escapeHtml(b.name)}: ${b.score.toFixed(0)} (waga ${b.weight})`)
    .join(" &nbsp;|&nbsp; ");
}

// Builds highlighted HTML: inserts <mark> tags then formats into rich blocks.
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
  let flat = "";
  let cur = 0;
  for (const { f, i } of chosen) {
    flat += escapeHtml(text.slice(cur, f.start));
    const seg = escapeHtml(text.slice(f.start, f.end));
    const tip = escapeHtml(f.message + (f.suggestion ? "  →  " + f.suggestion : ""));
    flat += `<mark class="sev-${f.severity}" data-idx="${i}" title="${tip}">${seg}</mark>`;
    cur = f.end;
  }
  flat += escapeHtml(text.slice(cur));
  return formatRichHtml(flat);
}

// Formats HTML string (with embedded <mark> tags) into rich block structure.
// Handles single-\n text (no blank lines between headings and paragraphs).
function formatRichHtml(html) {
  const lines = html.split("\n");
  const parts = [];
  let paraBuf = [];

  // Polish continuation-word prefixes that mean this line continues a sentence
  const CONT = /^(i |a |ale |oraz |jednak |więc |dlatego |ponieważ |który |które |która |to |że |bo |lecz |czy |kiedy |gdy |po |na |w |z |do |się )/i;

  function flush() {
    if (!paraBuf.length) return;
    parts.push(`<p class="hl-p">${paraBuf.join("<br>")}</p>`);
    paraBuf = [];
  }

  // Returns true when the paragraph buffer "ended a sentence" (block boundary)
  function atBlockBoundary() {
    if (!paraBuf.length) return true;
    const last = paraBuf[paraBuf.length - 1].replace(/<[^>]+>/g, "").trim();
    return /[.!?…]["»\)]?$/.test(last);
  }

  for (const line of lines) {
    const plain = line.replace(/<[^>]+>/g, "").trim();
    if (!plain) { flush(); continue; }

    // Markdown heading
    if (/^#{1,2}\s/.test(plain)) {
      flush();
      const cls = plain.startsWith("## ") ? "hl-h2" : "hl-h1";
      parts.push(`<h3 class="${cls}">${line.replace(/^#+\s/, "")}</h3>`);
      continue;
    }

    // Bullet / numbered list
    if (/^[-*•]\s/.test(plain) || /^\d+[.)]\s/.test(plain)) {
      flush();
      const isOl = /^\d+[.)]\s/.test(plain);
      const inner = line.replace(/^[-*•]\s/, "").replace(/^\d+[.)]\s/, "");
      parts.push(`<${isOl ? "ol" : "ul"} class="${isOl ? "hl-ol" : "hl-ul"}"><li>${inner}</li></${isOl ? "ol" : "ul"}>`);
      continue;
    }

    // Heuristic heading: short line, no trailing punctuation,
    // at a block boundary, not a Polish continuation clause
    if (
      plain.length > 0 && plain.length <= 72 &&
      !/[.!?,;:]$/.test(plain) &&
      atBlockBoundary() &&
      !CONT.test(plain)
    ) {
      flush();
      parts.push(`<h3 class="hl-h2">${line}</h3>`);
      continue;
    }

    paraBuf.push(line);
  }
  flush();

  return parts.join("") || `<p class="hl-p">${html}</p>`;
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
      return `<div class="dimension-row">
        <span class="dim-label">${escapeHtml(label)}</span>
        <div class="dim-bar-track"><div class="dim-bar-fill" style="width:${v}%"></div></div>
        <span class="dim-value">${v}</span>
      </div>`;
    })
    .join("");
}

const PREVIEW_HINT = `<span class="prop-preview-hint">Najedź na propozycję, aby zobaczyć ją w zdaniu.</span>`;

function renderFindings(findings) {
  $("findings-count").textContent = `(${findings.length})`;
  if (!findings.length) {
    $("findings").innerHTML = "<li class='finding finding-empty'>Brak wykrytych sygnałów — świetna robota!</li>";
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
      } else if (f._loading) {
        action = `<div class="props-loading"><span class="spinner-sm"></span> Generuję propozycje…</div>`;
      } else {
        action = `<button class="load-props" data-idx="${i}">Załaduj propozycje</button>`;
      }
      return `<li class="finding sev-${f.severity}" data-idx="${i}">
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
  applyActiveClass();
}

function applyActiveClass() {
  document.querySelectorAll("#findings li.finding").forEach((li) => {
    li.classList.toggle("active", Number(li.dataset.idx) === ACTIVE_IDX);
  });
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

function renderScores(r) {
  renderVerdict(r);

  // Compact bar: colored numbers
  const slopNum = $("bar-num-slop");
  slopNum.textContent = r.slop.score.toFixed(0);
  slopNum.style.color = colorFor(r.slop.score).trim();

  const aiNum = $("bar-num-ai");
  aiNum.textContent = r.ai_provenance.score.toFixed(0);
  aiNum.style.color = colorFor(r.ai_provenance.score).trim();

  // Gauge jakości (Grammarly-like): jakość = 100 − slop. Wysoka = zielona.
  const quality = Math.max(0, Math.min(100, Math.round(100 - r.slop.score)));
  const gNum = $("gauge-num");
  if (gNum) gNum.textContent = String(quality);
  const gauge = document.querySelector(".gauge");
  if (gauge) {
    gauge.style.setProperty("--pct", String(quality));
    gauge.style.setProperty("--gauge-color", colorFor(r.slop.score).trim());
    gauge.dataset.level = r.slop.score < 33 ? "ok" : r.slop.score < 66 ? "warn" : "bad";
  }

  // ScoreCard v2 — slop
  const scNum = $("sc-num-slop");
  if (scNum) {
    scNum.textContent = r.slop.score.toFixed(0);
    scNum.style.color = colorFor(r.slop.score).trim();
    const fill = $("sc-bar-slop");
    fill.style.width = `${r.slop.score}%`;
    fill.dataset.level = r.slop.score < 33 ? "ok" : r.slop.score < 66 ? "warn" : "bad";
  }
  $("band-slop").textContent = bandSlop(r.slop.score);
  $("conf-slop").textContent = `pewność: ${(r.slop.confidence * 100).toFixed(0)}%`;
  $("break-slop").innerHTML = breakdownHtml(r.slop.breakdown);

  // AIIndicator — segmented bar
  const aiSegs = $("ai-segments");
  if (aiSegs) {
    const s = r.ai_provenance.score;
    const n = Math.round(s / 10);
    const cls = s < 33 ? "active-low" : s < 66 ? "active-medium" : "active-high";
    aiSegs.innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<span class="ai-seg${i < n ? ` ${cls}` : ""}"></span>`
    ).join("");
    $("ai-value").textContent = `${s.toFixed(0)} / 100`;
  }
  $("band-ai").textContent = bandAi(r.ai_provenance.score);
  $("conf-ai").textContent = `pewność: ${(r.ai_provenance.confidence * 100).toFixed(0)}%`;
  $("break-ai").innerHTML = breakdownHtml(r.ai_provenance.breakdown);
}

function renderReport(r) {
  CURRENT.text = r.text;
  CURRENT.findings = (r.findings || []).map((f) => ({ ...f }));
  ACTIVE_IDX = CURRENT.findings.length > 0 ? 0 : -1;
  DONE_COUNT = 0;

  try {
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
  } catch (e) {
    console.error("renderReport render error:", e);
  }

  // Always show results and nav, regardless of render errors
  $("abar-results").classList.remove("hidden");
  $("proposals-empty").classList.add("hidden");
  $("proposals-panel").classList.remove("hidden");
  updateNav();

  if (CURRENT.findings.length > 0 && !CURRENT.findings[0].proposals) {
    loadProposalsForFinding(0);
  }
}

// ---------- Navigation ----------

function navigateTo(idx) {
  if (CURRENT.findings.length === 0) return;
  idx = Math.max(0, Math.min(CURRENT.findings.length - 1, idx));
  ACTIVE_IDX = idx;
  applyActiveClass();
  scrollToFinding(idx);
  scrollToMark(idx);
  updateNav();
  const f = CURRENT.findings[idx];
  if (f && !f.proposals && !f._loading) loadProposalsForFinding(idx);
}

function scrollToFinding(idx) {
  const li = document.querySelector(`#findings li.finding[data-idx="${idx}"]`);
  if (!li) return;
  const col = document.querySelector(".col-right");
  if (col) {
    const navH = $("finding-nav").offsetHeight || 0;
    const top = li.offsetTop - navH - 8;
    col.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  } else {
    li.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function scrollToMark(idx) {
  document.querySelectorAll("mark.mark-active").forEach((m) => m.classList.remove("mark-active"));
  const mark = document.querySelector(`mark[data-idx="${idx}"]`);
  if (mark) {
    mark.classList.add("mark-active");
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function updateNav() {
  const total = CURRENT.findings.length;
  const nav = $("finding-nav");
  if (!total) {
    nav.style.display = "none";
    return;
  }
  // Force display:flex directly — bypasses any CSS class specificity issues
  nav.style.display = "flex";
  $("nav-pos").textContent = `${ACTIVE_IDX + 1} / ${total}`;
  $("nav-prev").disabled = ACTIVE_IDX <= 0;
  $("nav-next").disabled = ACTIVE_IDX >= total - 1;
  const f = CURRENT.findings[ACTIVE_IDX];
  $("nav-apply").disabled = !f || !f.proposals || !f.proposals.length;
  $("nav-done").textContent = DONE_COUNT > 0 ? `${DONE_COUNT} zastosowano` : "";

  // Show/hide bulk-load button
  const btn = $("load-all-props");
  if (btn) {
    const unloaded = CURRENT.findings.filter((g) => !g.proposals && !g._loading).length;
    btn.classList.toggle("hidden", unloaded === 0);
    if (!btn.disabled) btn.textContent = `Załaduj wszystkie (${unloaded})`;
  }
}

function loadAllProposals() {
  const btn = $("load-all-props");
  const idxs = CURRENT.findings
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !f.proposals && !f._loading)
    .map(({ i }) => i);
  if (!idxs.length) return;
  if (btn) { btn.disabled = true; btn.textContent = `Ładuję ${idxs.length}…`; }
  idxs.forEach((idx) => loadProposalsForFinding(idx));
}

async function loadProposalsForFinding(idx) {
  const f = CURRENT.findings[idx];
  if (!f || f._loading || (f.proposals && f.proposals.length)) return;
  f._loading = true;
  renderFindings(CURRENT.findings);
  updateNav();
  try {
    const data = await fetchProposals(f);
    if (CURRENT.findings[idx] !== f) return;
    f.proposals = data.proposals || [];
    f._loading = false;
    renderFindings(CURRENT.findings);
    updateNav();
    // Re-enable bulk button once all loads finish
    const btn = $("load-all-props");
    if (btn && btn.disabled && !CURRENT.findings.some((g) => g._loading)) {
      btn.disabled = false;
    }
  } catch (e) {
    if (CURRENT.findings[idx] === f) {
      f._loading = false;
      renderFindings(CURRENT.findings);
      const btn = $("load-all-props");
      if (btn && btn.disabled && !CURRENT.findings.some((g) => g._loading)) {
        btn.disabled = false;
      }
    }
  }
}

// ---------- Humanization: apply + fetch ----------

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
  DONE_COUNT++;
  ACTIVE_IDX = CURRENT.findings.length === 0 ? -1 : Math.min(idx, CURRENT.findings.length - 1);
  renderFindings(CURRENT.findings);
  updateNav();
  refreshScores();
  if (ACTIVE_IDX >= 0) {
    setTimeout(() => {
      scrollToFinding(ACTIVE_IDX);
      const nextMark = document.querySelector(`mark[data-idx="${ACTIVE_IDX}"]`);
      if (nextMark) {
        nextMark.classList.add("mark-applied");
        setTimeout(() => nextMark.classList.remove("mark-applied"), 650);
      }
    }, 80);
  }
}

function triggerScorePop() {
  ["gauge-num", "sc-num-slop", "bar-num-slop", "ai-value", "bar-num-ai"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.remove("score-pop");
    void el.offsetWidth;
    el.classList.add("score-pop");
  });
}

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
    triggerScorePop();
    $("status").textContent =
      'Oceny przeliczone heurystycznie. „Pełna ocena (LLM)" uruchamia sędziego.';
  } catch (e) {
    if (seq === _scoreSeq) $("status").textContent = "Nie udało się przeliczyć ocen.";
  }
}

async function fetchProposals(f) {
  const nextCh = CURRENT.text[f.end] || "";
  if (/^[.!?…]$/.test(nextCh)) f.end += 1;
  const quote = CURRENT.text.slice(f.start, f.end);
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

async function regenerateProposals(idx, btn) {
  const f = CURRENT.findings[idx];
  if (!f) return;
  const orig = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "Generuję…"; }
  try {
    const data = await fetchProposals(f);
    const props = data.proposals || [];
    if (props.length) {
      f.proposals = props;
      renderFindings(CURRENT.findings);
      updateNav();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      $("humanize-status").textContent =
        "Nie udało się wygenerować nowych propozycji." + (data.error ? ` (${data.error})` : "");
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    $("humanize-status").textContent = "Błąd generowania propozycji.";
  }
}

async function copyAll() {
  const text = $("text").value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast({ text: "Tekst skopiowany ✓", variant: "success" });
  } catch (e) {
    $("text").select();
    showToast({ text: "Zaznaczono tekst — skopiuj ręcznie (Ctrl/Cmd+C).", variant: "error" });
  }
}

function wordDiff(orig, sugg) {
  const ow = orig.split(/\s+/);
  const sw = sugg.split(/\s+/);
  let p = 0;
  while (p < ow.length && p < sw.length && ow[p] === sw[p]) p++;
  let s = 0;
  while (s < ow.length - p && s < sw.length - p && ow[ow.length - 1 - s] === sw[sw.length - 1 - s]) s++;
  const prefix   = ow.slice(0, p).join(" ");
  const removed  = ow.slice(p, s ? ow.length - s : ow.length).join(" ");
  const inserted = sw.slice(p, s ? sw.length - s : sw.length).join(" ");
  const suffix   = s ? ow.slice(ow.length - s).join(" ") : "";
  let html = "";
  if (prefix)   html += escapeHtml(prefix) + " ";
  if (removed)  html += `<del class="diff-del">${escapeHtml(removed)}</del> `;
  if (inserted) html += `<ins class="diff-ins">${escapeHtml(inserted)}</ins>`;
  if (suffix)   html += " " + escapeHtml(suffix);
  return html.trim() || escapeHtml(sugg);
}

function previewHTML(f, proposal) {
  const quote = CURRENT.text.slice(f.start, f.end);
  const ctx =
    f.context ||
    CURRENT.text.slice(Math.max(0, f.start - 80), Math.min(CURRENT.text.length, f.end + 80));
  const i = ctx.indexOf(quote);
  const diffHtml = wordDiff(quote, proposal);
  if (i < 0) return `<span class="diff-ins">${escapeHtml(proposal)}</span>`;
  return (
    escapeHtml(ctx.slice(0, i)) +
    `<span class="diff-wrap">${diffHtml}</span>` +
    escapeHtml(ctx.slice(i + quote.length))
  );
}

// Widoczność przycisków „Wklej przykład" / „Wyczyść": tylko w trybie edycji,
// zależnie od tego, czy pole jest puste. Wołane z setLeftMode i przy wpisywaniu.
function updateInputButtons() {
  const ta = $("text");
  const editing = !ta.classList.contains("hidden");
  const hasText = ta.value.trim().length > 0;
  const ex = $("load-example");
  const cl = $("clear-text");
  if (ex) ex.classList.toggle("hidden", !(editing && !hasText));
  if (cl) cl.classList.toggle("hidden", !(editing && hasText));
}

function setLeftMode(mode) {
  $("text").classList.toggle("hidden", mode === "view");
  $("text").classList.toggle("dimmed", mode === "loading");
  $("text-loader").classList.toggle("hidden", mode !== "loading");
  $("highlighted").classList.toggle("hidden", mode !== "view");
  $("legend").classList.toggle("hidden", mode !== "view");
  $("edit-text").classList.toggle("hidden", mode !== "view");
  updateInputButtons();
}

async function analyze() {
  const text = $("text").value.trim();
  if (!text) { $("status").textContent = "Wklej najpierw tekst."; return; }
  $("analyze").disabled = true;
  $("analyze").classList.add("loading");
  $("status").textContent = "Analizuję…";
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

async function loadModels() {
  try {
    const resp = await fetch("/api/models");
    if (!resp.ok) return;
    const data = await resp.json();
    const sel = $("model-select");
    const models = data.models || [];
    const ids = models.map((m) => m.id);
    const saved = localStorage.getItem("detektor_model");
    const active = ids.includes(saved) ? saved : (ids.includes(data.default) ? data.default : ids[0]);
    sel.innerHTML = models
      .map((m) => {
        const selected = m.id === active ? " selected" : "";
        return `<option value="${escapeHtml(m.id)}"${selected}>${escapeHtml(m.label)}</option>`;
      })
      .join("");
    sel.addEventListener("change", () => {
      localStorage.setItem("detektor_model", sel.value);
    });
  } catch (e) {
    // No model list — analysis uses server default.
  }
}

// ---------- Event binding ----------

$("analyze").addEventListener("click", analyze);
$("humanize-all").addEventListener("click", humanizeAll);
$("copy-all").addEventListener("click", copyAll);
$("edit-text").addEventListener("click", () => {
  $("text").value = CURRENT.text || $("text").value;
  setLeftMode("edit");
  $("text").focus();
});

$("load-example").addEventListener("click", () => {
  const ta = $("text");
  ta.value = EXAMPLE_TEXT;
  setLeftMode("edit");
  ta.dispatchEvent(new Event("input"));
  ta.focus();
});

$("clear-text").addEventListener("click", () => {
  const ta = $("text");
  ta.value = "";
  setLeftMode("edit");
  $("status").textContent = "";
  ta.dispatchEvent(new Event("input"));
  ta.focus();
});

$("bar-details-toggle").addEventListener("click", () => {
  const expand = $("analysis-expand");
  const btn = $("bar-details-toggle");
  const isOpen = !expand.classList.contains("hidden");
  expand.classList.toggle("hidden", isOpen);
  btn.setAttribute("aria-expanded", String(!isOpen));
  btn.textContent = isOpen ? "Szczegóły ▾" : "Szczegóły ▴";
});

$("highlighted").addEventListener("click", (e) => {
  const mark = e.target.closest("mark[data-idx]");
  if (mark) navigateTo(Number(mark.dataset.idx));
});

$("findings").addEventListener("click", (e) => {
  const load = e.target.closest(".load-props");
  if (load) { loadProposalsForFinding(Number(load.dataset.idx)); return; }

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
  if (regen) { regenerateProposals(Number(regen.dataset.idx), regen); return; }

  const li = e.target.closest("li.finding");
  if (li && !e.target.closest("button") && !e.target.closest("input")) {
    navigateTo(Number(li.dataset.idx));
  }
});

$("findings").addEventListener("mouseover", (e) => {
  const opt = e.target.closest(".prop-opt");
  if (!opt) return;
  const f = CURRENT.findings[Number(opt.dataset.idx)];
  const prev = opt.closest(".finding").querySelector(".prop-preview");
  if (f && prev) prev.innerHTML = previewHTML(f, f.proposals[Number(opt.dataset.prop)]);
});
$("findings").addEventListener("mouseout", (e) => {
  const opt = e.target.closest(".prop-opt");
  if (opt) opt.closest(".finding").querySelector(".prop-preview").innerHTML = PREVIEW_HINT;
});

$("nav-prev").addEventListener("click", () => navigateTo(ACTIVE_IDX - 1));
$("nav-next").addEventListener("click", () => navigateTo(ACTIVE_IDX + 1));
$("load-all-props").addEventListener("click", loadAllProposals);
$("nav-apply").addEventListener("click", () => {
  const f = CURRENT.findings[ACTIVE_IDX];
  if (f && f.proposals && f.proposals.length) applyReplacement(ACTIVE_IDX, f.proposals[0]);
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
  if (CURRENT.findings.length === 0) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); navigateTo(ACTIVE_IDX - 1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); navigateTo(ACTIVE_IDX + 1); }
  else if (e.key === "Enter" && ACTIVE_IDX >= 0) {
    const f = CURRENT.findings[ACTIVE_IDX];
    if (f && f.proposals && f.proposals.length) { e.preventDefault(); applyReplacement(ACTIVE_IDX, f.proposals[0]); }
  }
});


// Word / character count
(function () {
  const ta = $("text");
  const el = $("word-count");
  if (!ta || !el) return;
  function update() {
    updateInputButtons();
    const val = ta.value;
    if (!val.trim()) { el.textContent = ""; return; }
    const words = val.trim().split(/\s+/).length;
    el.textContent = `${words.toLocaleString("pl-PL")} słów · ${val.length.toLocaleString("pl-PL")} znaków`;
  }
  ta.addEventListener("input", update);
  update();
}());

// Przełącznik motywu (jasny/ciemny). Stan: data-theme na <html> + localStorage.
// Wstępny motyw ustawia inline-skrypt w <head> (bez FOUC); tu tylko obsługa kliknięć.
(function () {
  const btn = document.getElementById("theme-toggle");
  function current() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (btn) btn.setAttribute("aria-pressed", String(theme === "dark"));
  }
  apply(current());
  if (btn) {
    btn.addEventListener("click", function () {
      const next = current() === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      let stored = null;
      try { stored = localStorage.getItem("theme"); } catch (err) {}
      if (stored !== "light" && stored !== "dark") apply(e.matches ? "dark" : "light");
    });
  } catch (e) {}
}());

loadModels();
