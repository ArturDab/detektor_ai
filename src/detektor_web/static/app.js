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
const DIM_HINT = {
  generic: "Jak bardzo tekst jest ogólnikowy i mógłby pasować do dowolnego tematu.",
  cliche: "Liczba utartych zwrotów i komunałów („w dzisiejszych czasach”, „kluczową rolę”).",
  low_information: "Ile zdań nie wnosi konkretnej, nowej treści.",
  repetition: "Jak często powracają te same słowa i schematy zdań.",
  unnatural_rhythm: "Czy zdania mają mechaniczną, jednostajną długość typową dla AI.",
};

const CURRENT = { text: "", findings: [], humanize: false };
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

function bandHuman(h) {
  if (h >= 75) return "Najpewniej napisane przez człowieka";
  if (h >= 50) return "Raczej człowiek, ale są sygnały AI";
  if (h >= 25) return "Sporo sygnałów AI";
  return "Najpewniej napisane przez AI";
}

// Kolor dla ocen „im więcej, tym lepiej" (np. ludzki): wysoko = zielono.
function colorForGood(good) {
  return colorFor(100 - good);
}

// Przyjazne etykiety dla analizatorów warstwy językowej (wyższy wynik = gorzej).
const LANG_LABEL = {
  slop_phrases: "Frazesy i klisze",
  structural: "Szablonowość struktury",
  lexical_diversity: "Powtarzalność słownictwa",
  rhythm: "Rytm i długość zdań",
  punctuation_calque: "Kalki interpunkcyjne",
  low_information: "Niska informatywność",
  information: "Niska informatywność",
};

// Werdykt ekspercki: komentarz LLM, a w trybie heurystycznym zdanie z danych.
function renderExpertVerdict(r) {
  const el = $("verdict-text");
  if (!el) return;
  if (r.llm_explanation) {
    el.textContent = r.llm_explanation;
    return;
  }
  const human = Math.round(100 - r.ai_provenance.score);
  const slop = r.slop.score;
  const auth =
    human >= 50
      ? "Tekst wygląda na pisany przez człowieka"
      : "Tekst nosi wyraźne znamiona generowania przez AI";
  const lang =
    slop < 33
      ? "język jest konkretny i naturalny"
      : slop < 66
      ? "język bywa sztampowy, sporo ogólników"
      : "dużo „lania wody”, frazesów i szablonowych zwrotów";
  el.textContent = `${auth}; ${lang}.`;
}

function breakdownHtml(items) {
  return items
    .map((b) => `${escapeHtml(b.name)}: ${b.score.toFixed(0)} (waga ${b.weight})`)
    .join(" &nbsp;|&nbsp; ");
}

// Removes overlapping findings, keeping one <mark>-able finding per text span.
// Used as the single source of truth so the proposals panel and the text
// highlights stay 1:1 (each highlighted fragment ↔ exactly one finding card).
function dedupeFindings(findings) {
  const indexed = findings
    .map((f) => f)
    .filter((f) => f.end > f.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen = [];
  let lastEnd = -1;
  for (const f of indexed) {
    if (f.start >= lastEnd) {
      chosen.push(f);
      lastEnd = f.end;
    }
  }
  return chosen;
}

// Builds highlighted HTML: inserts <mark> tags then formats into rich blocks.
// Expects `findings` already deduped (see dedupeFindings); index i matches the
// proposals panel order, so mark[data-idx] ↔ finding card stay in sync.
function renderHighlighted(text, findings) {
  const ordered = findings
    .map((f, i) => ({ f, i }))
    .filter((x) => x.f.end > x.f.start)
    .sort((a, b) => a.f.start - b.f.start);
  let flat = "";
  let cur = 0;
  for (const { f, i } of ordered) {
    if (f.start < cur) continue; // safety: skip any residual overlap
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
      const hint = DIM_HINT[k] || "";
      return `<div class="dimension-row"${hint ? ` title="${escapeHtml(hint)}"` : ""}>
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
        const err = f._error ? `<div class="props-error">${escapeHtml(f._error)}</div>` : "";
        action = `${err}
          <button class="load-props" data-idx="${i}">${f._error ? "Spróbuj ponownie" : "Załaduj propozycje"}</button>
          <div class="prop-custom-inline">
            <input type="text" data-idx="${i}" placeholder="Wpisz własną wersję..." />
            <button class="prop-custom-apply" data-idx="${i}">Zastosuj</button>
          </div>`;
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

function bucketSlop(s) {
  if (s < 25) return "bardzo dobra";
  if (s < 50) return "przyzwoita";
  if (s < 75) return "przeciętna";
  return "słaba";
}
function bucketAi(s) {
  if (s < 25) return "raczej napisał ją człowiek";
  if (s < 50) return "trudno jednoznacznie ocenić — raczej człowiek";
  if (s < 75) return "część fragmentów wygląda na pisane przez AI";
  return "tekst najpewniej powstał z pomocą AI";
}
function renderHumanSummary(r) {
  const box = $("analysis-summary");
  if (!box) return;
  const slop = r.slop.score;
  const ai = r.ai_provenance.score;
  const quality = Math.max(0, Math.min(100, Math.round(100 - slop)));
  const n = CURRENT.findings.length;
  const problems =
    n === 0
      ? "Nie znaleźliśmy fragmentów wymagających poprawy."
      : `Do poprawy: <strong>${n}</strong> ${n === 1 ? "fragment" : n < 5 ? "fragmenty" : "fragmentów"}.`;
  box.innerHTML =
    `Jakość tekstu jest <strong>${bucketSlop(slop)}</strong> (${quality}/100). ` +
    `Jeśli chodzi o autorstwo — ${bucketAi(ai)} (${ai.toFixed(0)}/100). ${problems}`;
  box.classList.remove("hidden");
}

function renderLanguageLayer(scores) {
  const box = $("lang-layer");
  if (!box) return;
  const entries = Object.entries(scores || {});
  if (!entries.length) {
    box.innerHTML = '<div class="muted">Brak danych.</div>';
    return;
  }
  box.innerHTML = entries
    .map(([k, v]) => {
      const val = Math.max(0, Math.min(100, Math.round(v)));
      const label = LANG_LABEL[k] || k;
      const level = val < 33 ? "ok" : val < 66 ? "warn" : "bad";
      return `<div class="metric-row metric-row-lang">
        <span class="metric-lbl">${escapeHtml(label)}</span>
        <div class="metric-bar-track"><div class="metric-bar-fill" data-level="${level}" style="width:${val}%"></div></div>
        <span class="metric-num-sm">${val}</span>
      </div>`;
    })
    .join("");
}

function renderStats(r) {
  const grid = $("stats-grid");
  if (!grid) return;
  const text = r.text || "";
  const words = r.word_count || (text.trim() ? text.trim().split(/\s+/).length : 0);
  const sentences = (text.match(/[.!?…]+(?=\s|$)/g) || []).length || (text.trim() ? 1 : 0);
  const avg = sentences ? Math.round(words / sentences) : 0;
  const problems = CURRENT.findings.length;
  const conf = Math.round(((r.slop.confidence + r.ai_provenance.confidence) / 2) * 100);
  const tiles = [
    ["Słowa", words],
    ["Zdania", sentences],
    ["Śr. długość zdania", `${avg} sł.`],
    ["Wykryte problemy", problems],
    ["Pewność oceny", `${conf}%`],
  ];
  grid.innerHTML = tiles
    .map(
      ([l, v]) =>
        `<div class="stat-tile"><span class="stat-val">${escapeHtml(String(v))}</span><span class="stat-lbl">${escapeHtml(l)}</span></div>`
    )
    .join("");
}

function renderScores(r) {
  renderExpertVerdict(r);
  renderHumanSummary(r);

  const ai = r.ai_provenance.score;
  const slop = r.slop.score;
  const human = Math.max(0, Math.min(100, Math.round(100 - ai)));

  // Gauge: jak bardzo tekst jest ludzki (wysoko = zielono)
  const gNum = $("gauge-num");
  if (gNum) gNum.textContent = String(human);
  const gauge = document.querySelector("#abar-results .gauge");
  if (gauge) {
    gauge.style.setProperty("--pct", String(human));
    gauge.style.setProperty("--gauge-color", colorForGood(human).trim());
    gauge.dataset.level = human >= 66 ? "ok" : human >= 33 ? "warn" : "bad";
  }
  const hb = $("human-band");
  if (hb) hb.textContent = bandHuman(human);

  // AI slop — liczba + pasek
  const slopNum = $("slop-num");
  if (slopNum) {
    slopNum.textContent = slop.toFixed(0);
    slopNum.style.color = colorFor(slop).trim();
  }
  const slopBar = $("slop-bar");
  if (slopBar) {
    slopBar.style.width = `${slop}%`;
    slopBar.dataset.level = slop < 33 ? "ok" : slop < 66 ? "warn" : "bad";
  }
  const sb = $("slop-band");
  if (sb) sb.textContent = bandSlop(slop);

  // Warstwa językowa + statystyki
  renderLanguageLayer(r.analyzer_scores);
  renderStats(r);
}

function renderReport(r) {
  CURRENT.text = r.text;
  // Dedupe overlapping findings so the proposals panel matches the highlights
  // 1:1 — multiple analyzers often flag the same span (np. „W dzisiejszych
  // czasach"), które wcześniej dawały karty propozycji bez podświetlenia.
  CURRENT.findings = dedupeFindings((r.findings || []).map((f) => ({ ...f })));
  ACTIVE_IDX = CURRENT.findings.length > 0 ? 0 : -1;
  DONE_COUNT = 0;

  try {
    renderScores(r);
    renderLlmError(r.llm_error);
    renderNotes(r.notes);

    renderDimensions(r.dimensions);
    const dimSec = $("dim-sec");
    if (dimSec) {
      dimSec.classList.toggle("hidden", !(r.dimensions && Object.keys(r.dimensions).length));
    }

    $("highlighted").innerHTML = renderHighlighted(CURRENT.text, CURRENT.findings);
    renderFindings(CURRENT.findings);
  } catch (e) {
    console.error("renderReport render error:", e);
  }

  // Swap placeholders → realne wyniki (kolumna analizy + propozycje)
  document.body.classList.add("analyzed");
  $("analysis-empty").classList.add("hidden");
  $("abar-results").classList.remove("hidden");
  $("analysis-report").classList.remove("hidden");
  $("proposals-empty").classList.add("hidden");
  $("proposals-panel").classList.remove("hidden");
  updateNav();

  // Safeguard: gdy user wybrał propozycje, dociągnij je dla WSZYSTKICH
  // fragmentów (z retry), by żaden zaznaczony fragment nie został pominięty.
  if (CURRENT.humanize) ensureAllProposals();
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

// Safeguard: dociąga propozycje dla wszystkich fragmentów, które ich nie mają
// i nie skończyły się trwałym błędem — by żaden zaznaczony fragment nie został
// pominięty (np. gdy część rewrite'ów padła timeoutem).
function ensureAllProposals() {
  CURRENT.findings.forEach((f, i) => {
    if (!f._loading && (!f.proposals || !f.proposals.length) && !f._error) {
      loadProposalsForFinding(i);
    }
  });
}

function _bulkBtnMaybeReenable() {
  const btn = $("load-all-props");
  if (btn && btn.disabled && !CURRENT.findings.some((g) => g._loading)) btn.disabled = false;
}

async function loadProposalsForFinding(idx) {
  const f = CURRENT.findings[idx];
  if (!f || f._loading || (f.proposals && f.proposals.length)) return;
  f._loading = true;
  f._error = null;
  renderFindings(CURRENT.findings);
  updateNav();
  try {
    const data = await fetchProposals(f);
    if (CURRENT.findings[idx] !== f) return;
    f.proposals = data.proposals || [];
    if (!f.proposals.length) {
      // Auto-retry raz, zanim poddamy się i pokażemy pole własnej wersji.
      f._tries = (f._tries || 0) + 1;
      if (f._tries < 2) {
        f._loading = false;
        return loadProposalsForFinding(idx);
      }
      f._error = data.error || "Nie udało się wygenerować propozycji — wpisz własną wersję.";
    } else {
      f._error = null;
    }
    f._loading = false;
    renderFindings(CURRENT.findings);
    updateNav();
    _bulkBtnMaybeReenable();
  } catch (e) {
    if (CURRENT.findings[idx] === f) {
      f._tries = (f._tries || 0) + 1;
      f._loading = false;
      if (f._tries < 2) return loadProposalsForFinding(idx);
      f._error = "Błąd połączenia — spróbuj ponownie lub wpisz własną wersję.";
      renderFindings(CURRENT.findings);
      _bulkBtnMaybeReenable();
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
  ["gauge-num", "slop-num"].forEach((id) => {
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
      f._error = null;
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
    const choice = document.querySelector('input[name="suggest"]:checked');
    const humanize = choice ? choice.value === "yes" : false;
    CURRENT.humanize = humanize;
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

$("analysis-collapse").addEventListener("click", () => {
  const aside = $("col-analysis");
  const btn = $("analysis-collapse");
  const collapsed = aside.classList.toggle("collapsed");
  btn.setAttribute("aria-expanded", String(!collapsed));
});

$("highlighted").addEventListener("click", (e) => {
  const mark = e.target.closest("mark[data-idx]");
  if (mark) navigateTo(Number(mark.dataset.idx));
});

$("findings").addEventListener("click", (e) => {
  const load = e.target.closest(".load-props");
  if (load) {
    const li = CURRENT.findings[Number(load.dataset.idx)];
    if (li) li._tries = 0; // ręczne kliknięcie → znów pozwól na auto-retry
    loadProposalsForFinding(Number(load.dataset.idx));
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

// ---------- Świadomy wybór trybu: blokuj „Analizuj" do wyboru sugestii ----------
(function () {
  const radios = document.querySelectorAll('input[name="suggest"]');
  const analyzeBtn = $("analyze");
  radios.forEach((el) =>
    el.addEventListener("change", () => {
      if (analyzeBtn) analyzeBtn.disabled = false;
      const st = $("status");
      if (st && st.textContent.startsWith("Wybierz")) st.textContent = "";
    })
  );
  const st = $("status");
  if (st && analyzeBtn && analyzeBtn.disabled) {
    st.textContent = "Wybierz tryb analizy powyżej.";
  }
}());

loadModels();
