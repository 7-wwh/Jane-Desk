const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const AREAS = ["career", "health", "family", "learning", "finance", "other"];
const AREA_LABELS = {
  career: "Career",
  health: "Health",
  family: "Family",
  learning: "Learning",
  finance: "Finance",
  other: "Other",
};
const AREA_COLORS = {
  career: "#F97316",
  health: "#34D399",
  family: "#FBBF24",
  learning: "#C4B5FD",
  finance: "#67E8F9",
  other: "#9CA3AF",
};
const ENDPOINTS = {
  project: "/api/projects",
  learning: "/api/learnings",
  goal: "/api/goals",
  journal: "/api/journal",
};
const DAYS7 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  dashboard: null,
  projects: [],
  learnings: [],
  journal: [],
  timeline: [],
  projectFilter: "all",
  timelineLoaded: false,
  reportsDays: 7,
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function parseTags(tags) {
  return String(tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagChips(tags) {
  return parseTags(tags)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function emptyState(msg) {
  return `<p class="empty">${esc(msg)}</p>`;
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const body = await res.json();
      if (body.detail) {
        msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

let toastTimer;
function toast(message, kind = "success") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function fld(label, input, required) {
  const star = required ? ' <span class="req">*</span>' : "";
  return `<div class="field"><label>${label}${star}</label>${input}</div>`;
}

function dateInput(id, defaultValue) {
  return `<input class="input" id="${id}" type="date"${defaultValue ? ` value="${defaultValue}"` : ""}>`;
}

const FIELD_SETS = {
  project: [
    fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
    fld("Description", '<textarea class="input" id="qa-description" rows="3"></textarea>'),
    fld(
      "Status",
      '<select class="input" id="qa-status"><option value="active">Active</option><option value="backlog">Backlog</option><option value="paused">Paused</option><option value="done">Done</option></select>'
    ),
    fld(
      "Priority",
      '<select class="input" id="qa-priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select>'
    ),
    fld("Target date", dateInput("qa-target_date")),
    fld(
      "Tags (comma separated)",
      '<textarea class="input" id="qa-tags" rows="2" placeholder="design, api, follow-up"></textarea>'
    ),
  ].join(""),
  learning: [
    fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
    fld("Content", '<textarea class="input" id="qa-content" rows="4"></textarea>'),
    fld("Date", dateInput("qa-date", todayISO())),
    fld(
      "Tags (comma separated)",
      '<textarea class="input" id="qa-tags" rows="2" placeholder="python, backend"></textarea>'
    ),
    fld("Related project", '<input class="input" id="qa-related_project" type="text">'),
  ].join(""),
  goal: [
    fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
    fld(
      "Area",
      '<select class="input" id="qa-area">' +
        AREAS.map((a) => `<option value="${a}">${AREA_LABELS[a]}</option>`).join("") +
        "</select>"
    ),
    fld("Description", '<textarea class="input" id="qa-description" rows="3"></textarea>'),
    fld("Progress (%)", '<input class="input" id="qa-progress" type="number" min="0" max="100" value="0">'),
    fld("Target date", dateInput("qa-target_date")),
    fld(
      "Status",
      '<select class="input" id="qa-goal_status"><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select>'
    ),
  ].join(""),
  journal: [
    fld("Date", dateInput("qa-date", todayISO())),
    fld(
      "Type",
      '<select class="input" id="qa-jtype"><option value="note">Note</option><option value="milestone">Milestone</option><option value="reflection">Reflection</option></select>'
    ),
    fld("Content", '<textarea class="input" id="qa-content" rows="4"></textarea>', true),
    fld("Related entity", '<input class="input" id="qa-related_entity" type="text" placeholder="Optional">'),
  ].join(""),
};

/* ---------- Chart helpers ---------- */

function lastNDates(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
    );
  }
  return out;
}

function countByDate(items) {
  const counts = {};
  items.forEach((i) => {
    const key = String(i.date || "").slice(0, 10);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

function makeLinePath(points) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function lineChart({
  series,
  xLabels,
  width = 440,
  height = 170,
  pad = { top: 18, right: 14, bottom: 26, left: 16 },
  strokeWidth = 2.5,
  showDots = true,
  labelEvery = 1,
}) {
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const n = xLabels.length;

  const getX = (i) => pad.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const getY = (v) => pad.top + ih - (v / max) * ih;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Chart",
  });

  for (let i = 0; i < n; i++) {
    svg.appendChild(
      svgEl("line", {
        x1: getX(i), y1: pad.top, x2: getX(i) - 16, y2: height - pad.bottom,
        stroke: "rgba(255,255,255,0.10)", "stroke-dasharray": "2 5",
      })
    );
    const label = svgEl("text", { x: getX(i), y: height - 6, fill: "rgba(255,255,255,0.5)", "font-size": 9, "text-anchor": "middle" });
    label.textContent = i % labelEvery === 0 ? xLabels[i] : "";
    svg.appendChild(label);
  }

  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    const path = svgEl("path", {
      d: makeLinePath(pts),
      fill: "none",
      stroke: s.color,
      "stroke-width": strokeWidth,
      ...(s.dashed ? { "stroke-dasharray": "4 5" } : {}),
    });
    if (s.gradient && si === 0) {
      const grad = svgEl("linearGradient", { id: "lineGrad", x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
      [0, 0.5, 1].forEach((off, idx) => {
        const stop = svgEl("stop", {
          offset: `${off * 100}%`,
          "stop-color": idx === 1 ? "#fff" : "rgba(255,255,255,0.25)",
        });
        grad.appendChild(stop);
      });
      svg.appendChild(grad);
      path.setAttribute("stroke", "url(#lineGrad)");
      path.style.filter = "drop-shadow(0px 4px 6px rgba(255,255,255,0.18))";
    }
    svg.appendChild(path);

    if (showDots) {
      pts.forEach((p) => {
        svg.appendChild(
          svgEl("circle", {
            cx: p.x, cy: p.y, r: s.gradient ? 3.4 : 3,
            fill: s.gradient ? "rgba(255,255,255,0.85)" : s.color,
          })
        );
      });
    }
  });

  return svg;
}

function renderReportsChart() {
  const days = state.reportsDays;
  const dates = lastNDates(days);
  const learn = countByDate(state.learnings);
  const jour = countByDate(state.journal);
  const learnVals = dates.map((d) => learn[d] || 0);
  const jourVals = dates.map((d) => jour[d] || 0);

  $("#reports-learnings").textContent = learnVals.reduce((a, b) => a + b, 0);
  $("#reports-journal").textContent = jourVals.reduce((a, b) => a + b, 0);
  $("#reports-range").textContent = days === 7 ? "Last 7 days" : "Last 30 days";

  const labels = dates.map((d) => formatDate(d).split(",")[0]);
  const container = $("#reports-chart");
  container.innerHTML = "";
    container.appendChild(
      lineChart({
        series: [
          { values: learnVals, color: "#fff", gradient: true },
          { values: jourVals, color: "rgba(255,255,255,0.55)", dashed: true },
        ],
        xLabels: labels,
        labelEvery: days === 30 ? 5 : 1,
      })
    );

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  container.appendChild(tooltip);

  container.addEventListener("mousemove", (e) => {
    const b = container.getBoundingClientRect();
    const px = e.clientX - b.left;
    const iw = b.width;
    const idx = Math.min(dates.length - 1, Math.max(0, Math.round((px / iw) * (dates.length - 1))));
    if (!dates[idx]) return;
    tooltip.hidden = false;
    tooltip.style.left = `${(idx / (dates.length - 1)) * 100}%`;
    tooltip.innerHTML =
      `<div class="tt-title">${esc(formatDate(dates[idx]))}</div>` +
      `<div class="tt-row"><span>Learnings</span><b>${learn[dates[idx]] || 0}</b></div>` +
      `<div class="tt-row"><span>Journal</span><b>${jour[dates[idx]] || 0}</b></div>`;
  });
  container.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });
}

function renderWeeklyChart() {
  const counts = countByDate(state.learnings);
  const today = new Date();
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - ((today.getDay() + 7) % 7) + i);
    const iso =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    days.push(iso);
  }
  const thisWeek = days.map((d) => counts[d] || 0);
  const lastWeek = days.map((d) => {
    const dt = new Date(d + "T00:00:00");
    dt.setDate(dt.getDate() - 7);
    const iso =
      dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    return counts[iso] || 0;
  });

  $("#weekly-total").textContent = thisWeek.reduce((a, b) => a + b, 0);

  const container = $("#weekly-chart");
  container.innerHTML = "";
  const svg = lineChart({
    series: [
      { values: thisWeek, color: "#F97316" },
      { values: lastWeek, color: "#9CA3AF", dashed: true },
    ],
    xLabels: DAYS7,
    width: 320,
    height: 150,
    pad: { top: 12, right: 10, bottom: 24, left: 10 },
  });
  container.appendChild(svg);
}

function hexLayout(total) {
  const dirs = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ];
  const coords = [[0, 0]];
  let ring = 1;
  while (coords.length < total) {
    let q = ring, r = 0;
    for (const [dq, dr] of dirs) {
      for (let i = 0; i < ring; i++) {
        coords.push([q, r]);
        q += dq;
        r += dr;
      }
    }
    ring++;
  }
  return coords.slice(0, total);
}

function renderHexAreas() {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const byArea = {};
  goals.forEach((g) => {
    const a = AREAS.includes(g.area) ? g.area : "other";
    byArea[a] = (byArea[a] || 0) + 1;
  });
  const present = AREAS.filter((a) => byArea[a]);

  const total = Math.max(1, present.length * 3);
  const coords = hexLayout(total);
  const size = 8;
  const hw = Math.sqrt(3) * size;
  const hh = 2 * size;
  const vert = hh * 0.75;
  const horiz = hw;

  const xs = coords.map(([q, r]) => q * horiz + (r % 2 === 1 ? horiz / 2 : 0));
  const ys = coords.map(([, r]) => r * vert);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const w = maxX - minX + horiz + 12;
  const h = maxY - minY + hh + 12;

  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%" });
  const g = svgEl("g", { transform: `translate(${6 - minX}, ${6 - minY})` });

  const sorted = present.slice().sort((a, b) => (byArea[b] || 0) - (byArea[a] || 0));
  coords.forEach(([q, r], i) => {
    const x = q * horiz + (r % 2 === 1 ? horiz / 2 : 0);
    const y = r * vert;
    const area = sorted[i % sorted.length];
    const intensity = byArea[area] >= 3 ? 1 : byArea[area] === 2 ? 0.72 : 0.5;
    const color = AREA_COLORS[area] || AREA_COLORS.other;
    const pts =
      `${x},${y - size} ${x + hw / 2},${y - size / 2} ${x + hw / 2},${y + size / 2} ` +
      `${x},${y + size} ${x - hw / 2},${y + size / 2} ${x - hw / 2},${y - size / 2}`;
    g.appendChild(
      svgEl("polygon", {
        points: pts,
        fill: color,
        "fill-opacity": intensity,
        stroke: "rgba(255,255,255,0.85)",
        "stroke-width": 1.2,
      })
    );
  });

  svg.appendChild(g);
  const wrap = $("#hex-cluster");
  wrap.innerHTML = "";
  wrap.appendChild(svg);

  $("#hex-list").innerHTML = present.length
    ? present
        .map(
          (a) =>
            `<div class="hex-item"><span><span class="ldot" style="background:${AREA_COLORS[a]}"></span>${AREA_LABELS[a]}</span><b>${byArea[a]}</b></div>`
        )
        .join("")
    : `<div class="hex-item"><span style="color:var(--ink-faint)">No goals yet</span></div>`;
}

function renderWeekdayChart() {
  const learn = countByDate(state.learnings);
  const jour = countByDate(state.journal);
  const today = new Date();
  const values = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - ((today.getDay() - i + 7) % 7));
    const iso =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    values.push((learn[iso] || 0) + (jour[iso] || 0));
  }
  const max = Math.max(1, ...values);
  const wrap = $("#weekday-chart");
  wrap.innerHTML = values
    .map((v, i) => {
      const hot = i === today.getDay();
      const pct = Math.max(6, Math.round((v / max) * 100));
      return `<div class="wd-col${hot ? " hot" : ""}">
        <div class="wd-bar-wrap"><div class="wd-bar" style="height:${pct}%"></div></div>
        <span class="wd-value">${v}</span>
        <span class="wd-label">${DAYS7[i]}</span>
      </div>`;
    })
    .join("");
}

function renderProjectStatus() {
  const counts = { active: 0, backlog: 0, done: 0, paused: 0 };
  state.projects.forEach((p) => {
    const s = counts[p.status] !== undefined ? p.status : "backlog";
    counts[s]++;
  });
  const total = Math.max(1, state.projects.length);
  const labels = { active: "Active", backlog: "Backlog", done: "Done", paused: "Paused" };
  const segs = ["active", "backlog", "done", "paused"]
    .map(
      (s) =>
        `<div class="seg seg-${s}" style="flex:${counts[s]}" title="${labels[s]}: ${counts[s]}"></div>`
    )
    .join("");
  const legend = ["active", "backlog", "done", "paused"]
    .map(
      (s) =>
        `<div class="seg-legend-item"><span><span class="legend-dot seg-${s}" style="background:var(--${s === "active" ? "orange" : s === "backlog" ? "orange-mid" : s === "done" ? "orange-soft" : "ink-faint"})"></span>${labels[s]}</span><b>${counts[s]}</b></div>`
    )
    .join("");

  $("#proj-status-body").innerHTML =
    `<div class="widget-metric">${total}</div><div class="widget-sub">Total projects</div>` +
    `<div class="seg-bar">${segs}</div>` +
    `<div class="seg-legend">${legend}</div>`;
}

/* ---------- Card renderers ---------- */

function projectCard(p) {
  const prio = p.priority || "medium";
  const done = p.status === "done";
  return `<article class="card project-card">
    <div class="card-head">
      <h3 class="card-title">${esc(p.title)}</h3>
      <span class="badge badge-prio prio-${esc(prio)}">${esc(prio)}</span>
    </div>
    ${p.description ? `<p class="card-text">${esc(p.description)}</p>` : ""}
    <div class="card-meta">
      ${p.target_date ? `<span class="meta">Target: ${esc(formatDate(p.target_date))}</span>` : ""}
      ${!done && p.status !== "active" ? `<span class="badge badge-status">${esc(p.status)}</span>` : ""}
    </div>
    <div class="chips">${tagChips(p.tags)}</div>
    <div class="card-actions">
      ${done ? `<span class="meta">Done</span>` : `<button class="btn btn-sm" data-action="done" data-type="project" data-id="${p.id}">Mark done</button>`}
      <button class="btn btn-sm btn-danger" data-action="delete" data-type="project" data-id="${p.id}">Delete</button>
    </div>
  </article>`;
}

function journalCard(j) {
  return `<article class="card journal-card">
    <div class="card-head">
      <span class="badge badge-jtype jt-${esc(j.type)}">${esc(j.type)}</span>
      <span class="meta">${esc(formatDate(j.date))}</span>
    </div>
    <p class="card-text">${esc(j.content)}</p>
    ${j.related_entity ? `<div class="card-meta"><span class="meta">${esc(j.related_entity)}</span></div>` : ""}
    <div class="card-actions">
      <button class="btn btn-sm btn-danger" data-action="delete" data-type="journal" data-id="${j.id}">Delete</button>
    </div>
  </article>`;
}

function goalCard(g) {
  const p = Math.max(0, Math.min(100, Math.round(Number(g.progress) || 0)));
  return `<article class="card goal-card">
    <div class="card-head">
      <h3 class="card-title">${esc(g.title)}</h3>
      <span class="badge badge-goal-status gs-${esc(g.status)}">${esc(g.status)}</span>
    </div>
    ${g.description ? `<p class="card-text">${esc(g.description)}</p>` : ""}
    <div class="progress-wrap">
      <div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill" style="width:${p}%"></div>
      </div>
      <span class="progress-pct">${p}%</span>
    </div>
    ${g.target_date ? `<div class="card-meta"><span class="meta">Target: ${esc(formatDate(g.target_date))}</span></div>` : ""}
  </article>`;
}

function learningCard(l) {
  return `<article class="card learning-card">
    <div class="card-head">
      <h3 class="card-title">${esc(l.title)}</h3>
      <span class="meta">${esc(formatDate(l.date))}</span>
    </div>
    ${l.content ? `<p class="card-text">${esc(l.content)}</p>` : ""}
    <div class="chips">${tagChips(l.tags)}</div>
    ${l.related_project ? `<div class="card-meta"><span class="meta">Project: ${esc(l.related_project)}</span></div>` : ""}
    <div class="card-actions">
      <button class="btn btn-sm btn-danger" data-action="delete" data-type="learning" data-id="${l.id}">Delete</button>
    </div>
  </article>`;
}

function timelineItem(t) {
  return `<article class="card timeline-item ${"kind-" + esc(t.kind)}">
    <div class="timeline-head">
      <span class="badge badge-kind ${"kind-" + esc(t.kind)}">${esc(t.kind)}</span>
      <span class="meta">${esc(formatDate(t.date))}</span>
    </div>
    <h3 class="card-title">${esc(t.title)}</h3>
    ${t.body ? `<p class="card-text timeline-body">${esc(t.body)}</p>` : ""}
    ${parseTags(t.tags).length ? `<div class="chips">${tagChips(t.tags)}</div>` : ""}
  </article>`;
}

/* ---------- Renderers ---------- */

function updateClock() {
  const now = new Date();
  const options = {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  $("#today").textContent = now.toLocaleDateString("en-US", options).replace(",", " -");
}

function renderOverview(d) {
  $("#overview-sub").textContent =
    d.active_projects.length
      ? `${d.active_projects.length} active project${d.active_projects.length > 1 ? "s" : ""} · ${d.goals.filter((g) => g.status === "active").length} goals in motion`
      : "Your life, one glance.";

  const active = d.active_projects || [];
  const backlog = d.backlog || [];
  const learnings = d.recent_learnings || [];
  const goals = d.goals || [];
  const journalToday = (d.journal || []).filter((j) => j.date === d.today);

  $("#overview-projects").innerHTML = active.length
    ? active.map(projectCard).join("")
    : emptyState("No active projects. Start one with the + New button.");
  $("#overview-projects-count").textContent = active.length ? `${active.length} active` : "";

  $("#overview-journal").innerHTML = journalToday.length
    ? journalToday.map(journalCard).join("")
    : emptyState("No journal entries for today yet.");
  $("#overview-journal-count").textContent = journalToday.length ? `${journalToday.length} entries` : "";

  const stats = [
    { value: active.length, label: "Active projects" },
    { value: backlog.length, label: "Backlog" },
    { value: goals.filter((g) => g.status === "active").length, label: "Active goals" },
    { value: learnings.length, label: "Learnings" },
    { value: journalToday.length, label: "Journal today" },
  ];
  $("#stat-strip").innerHTML = stats
    .map((s) => `<div class="stat"><span class="stat-value">${s.value}</span><span class="stat-label">${s.label}</span></div>`)
    .join("");

  renderReportsChart();
  renderWeeklyChart();
  renderHexAreas();
  renderWeekdayChart();
  renderProjectStatus();
}

function colBlock(title, items) {
  return `<section class="project-col" aria-label="${esc(title)}">
    <h3 class="col-title">${esc(title)} <span class="count">${items.length}</span></h3>
    <div class="card-grid">${items.length ? items.map(projectCard).join("") : emptyState("Nothing here yet.")}</div>
  </section>`;
}

function renderProjects() {
  const f = state.projectFilter;
  const all = state.projects;
  const labels = { active: "Active", backlog: "Backlog / Roadmap", done: "Done", paused: "Paused" };
  const cols = $("#projects-cols");
  if (f === "all") {
    cols.classList.remove("single");
    cols.innerHTML =
      colBlock("Active", all.filter((p) => p.status === "active")) +
      colBlock("Backlog / Roadmap", all.filter((p) => p.status === "backlog"));
  } else {
    cols.classList.add("single");
    cols.innerHTML = colBlock(labels[f] || f, all.filter((p) => p.status === f));
  }
}

function renderGoals() {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const groups = {};
  AREAS.forEach((a) => (groups[a] = []));
  goals.forEach((g) => (groups[g.area] || groups.other).push(g));
  let html = "";
  AREAS.forEach((a) => {
    const list = groups[a];
    if (!list.length) return;
    html += `<section class="goal-area goal-area-${esc(a)}">
      <h3 class="goal-area-title">${AREA_LABELS[a] || a} <span class="count">${list.length}</span></h3>
      <div class="goal-grid">${list.map(goalCard).join("")}</div>
    </section>`;
  });
  $("#goals-list").innerHTML = html || emptyState("No goals yet. Add one with the + New button.");
}

function renderLearnings() {
  const tag = $("#learn-tag-filter").value.trim().toLowerCase();
  const date = $("#learn-date-filter").value;
  const list = state.learnings
    .filter((l) => {
      if (tag && !(l.tags || "").toLowerCase().includes(tag)) return false;
      if (date && l.date !== date) return false;
      return true;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $("#learn-list").innerHTML = list.length
    ? `<div class="card-grid">${list.map(learningCard).join("")}</div>`
    : emptyState("No learnings match your filters.");
}

function renderTimeline() {
  const list = state.timeline;
  $("#timeline-count").textContent = list.length ? `${list.length} items` : "";
  $("#timeline-list").innerHTML = list.length
    ? list.map(timelineItem).join("")
    : emptyState("Timeline is empty.");
}

/* ---------- Data loading ---------- */

async function loadDashboard() {
  try {
    state.dashboard = await fetchJSON("/api/dashboard");
    renderOverview(state.dashboard);
    renderGoals();
  } catch (err) {
    toast("Failed to load dashboard: " + err.message, "error");
  }
}

async function loadProjects() {
  try {
    state.projects = await fetchJSON("/api/projects");
    renderProjects();
  } catch (err) {
    toast("Failed to load projects: " + err.message, "error");
  }
}

async function loadLearnings() {
  try {
    state.learnings = await fetchJSON("/api/learnings");
    renderLearnings();
  } catch (err) {
    toast("Failed to load learnings: " + err.message, "error");
  }
}

async function loadJournal() {
  try {
    state.journal = await fetchJSON("/api/journal");
  } catch (err) {
    toast("Failed to load journal: " + err.message, "error");
  }
}

async function loadTimeline() {
  try {
    state.timeline = await fetchJSON("/api/timeline");
    renderTimeline();
  } catch (err) {
    toast("Failed to load timeline: " + err.message, "error");
  }
}

async function refreshAll() {
  await Promise.all([loadDashboard(), loadProjects(), loadLearnings(), loadJournal()]);
  if (state.timelineLoaded) await loadTimeline();
}

async function markDone(type, id) {
  try {
    await fetchJSON(`${ENDPOINTS[type]}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    toast("Marked as done");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function deleteItem(type, id) {
  const names = { project: "project", learning: "learning", goal: "goal", journal: "journal entry" };
  if (!confirm(`Delete this ${names[type] || type}?`)) return;
  try {
    await fetchJSON(`${ENDPOINTS[type]}/${id}`, { method: "DELETE" });
    toast("Deleted");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

function switchTab(tab) {
  state.tab = tab;
  $$(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
  if (tab === "timeline") {
    if (!state.timelineLoaded) {
      state.timelineLoaded = true;
      loadTimeline();
    } else {
      renderTimeline();
    }
  }
}

function setProjectFilter(f) {
  state.projectFilter = f;
  $$(".filter-pill").forEach((p) => p.classList.toggle("active", p.dataset.filter === f));
  renderProjects();
}

function renderFields() {
  const type = $("#qa-type").value;
  $("#qa-fields").innerHTML = FIELD_SETS[type];
  $("#modal-title").textContent = "Add " + type.charAt(0).toUpperCase() + type.slice(1);
}

function openModal(type) {
  $("#qa-type").value = type;
  renderFields();
  $("#modal-backdrop").hidden = false;
  document.body.classList.add("modal-open");
  const first = $("#qa-fields input, #qa-fields select, #qa-fields textarea");
  (first || $("#modal-close")).focus();
}

function closeModal() {
  $("#modal-backdrop").hidden = true;
  document.body.classList.remove("modal-open");
  $("#quick-form").reset();
}

function hideMenu() {
  $("#new-menu").hidden = true;
  $("#new-btn").setAttribute("aria-expanded", "false");
}

function buildPayload() {
  const type = $("#qa-type").value;
  const val = (id) => ($("#qa-" + id) ? $("#qa-" + id).value.trim() : "");
  const raw = (id) => ($("#qa-" + id) ? $("#qa-" + id).value : "");
  const tags = raw("tags")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const date = raw("date") || todayISO();
  if (type === "project") {
    if (!val("title")) return { error: "Title is required" };
    return {
      endpoint: ENDPOINTS.project,
      body: {
        title: val("title"),
        description: val("description"),
        status: raw("status") || "active",
        priority: raw("priority") || "medium",
        target_date: raw("target_date") || null,
        tags,
      },
    };
  }
  if (type === "learning") {
    if (!val("title")) return { error: "Title is required" };
    return {
      endpoint: ENDPOINTS.learning,
      body: {
        title: val("title"),
        content: val("content"),
        date,
        tags,
        related_project: val("related_project"),
      },
    };
  }
  if (type === "goal") {
    if (!val("title")) return { error: "Title is required" };
    return {
      endpoint: ENDPOINTS.goal,
      body: {
        area: raw("area") || "other",
        title: val("title"),
        description: val("description"),
        progress: Math.max(0, Math.min(100, parseFloat(raw("progress")) || 0)),
        target_date: raw("target_date") || null,
        status: raw("goal_status") || "active",
      },
    };
  }
  if (!val("content")) return { error: "Content is required" };
  return {
    endpoint: ENDPOINTS.journal,
    body: {
      date,
      type: raw("jtype") || "note",
      content: val("content"),
      related_entity: val("related_entity"),
    },
  };
}

function bindEvents() {
  $("#new-btn").addEventListener("click", () => {
    const menu = $("#new-menu");
    menu.hidden = !menu.hidden;
    $("#new-btn").setAttribute("aria-expanded", String(!menu.hidden));
  });

  $$(".new-item").forEach((item) =>
    item.addEventListener("click", () => {
      hideMenu();
      openModal(item.dataset.qatype);
    })
  );

  $$(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  $$(".filter-pill").forEach((pill) =>
    pill.addEventListener("click", () => setProjectFilter(pill.dataset.filter))
  );

  $("#learn-tag-filter").addEventListener("input", renderLearnings);
  $("#learn-date-filter").addEventListener("input", renderLearnings);
  $("#learn-filter-clear").addEventListener("click", () => {
    $("#learn-tag-filter").value = "";
    $("#learn-date-filter").value = "";
    renderLearnings();
  });

  $("#reports-range").addEventListener("click", () => {
    state.reportsDays = state.reportsDays === 7 ? 30 : 7;
    renderReportsChart();
  });

  $$(".side-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const which = btn.dataset.side;
      if (which === "fullscreen") {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen && document.exitFullscreen();
        }
      } else if (which === "theme") {
        toast("Theme toggle coming soon", "error");
      } else if (which === "bell") {
        toast("You're all caught up");
      } else if (which === "message") {
        toast("No new messages");
      } else if (which === "lang") {
        toast("English only for now");
      }
    })
  );

  $("#qa-type").addEventListener("change", () => {
    $("#quick-form").reset();
    renderFields();
  });

  $("#quick-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    if (payload.error) {
      toast(payload.error, "error");
      return;
    }
    try {
      await fetchJSON(payload.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      closeModal();
      toast("Created " + $("#qa-type").value);
      await refreshAll();
    } catch (err) {
      toast("Failed: " + err.message, "error");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      hideMenu();
    }
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".new-wrap").contains(e.target)) hideMenu();
    if (e.target === $("#modal-backdrop")) closeModal();
    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      closeModal();
      return;
    }
    const action = e.target.closest("[data-action]");
    if (action) {
      const { action: kind, type, id } = action.dataset;
      if (kind === "done") markDone(type, id);
      else if (kind === "delete") deleteItem(type, id);
    }
  });
}

function init() {
  updateClock();
  setInterval(updateClock, 60000);
  bindEvents();
  refreshAll();
}

init();
