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
  career: "#F5A623",
  health: "#6DC533",
  family: "#AAEB47",
  learning: "#E8E8E8",
  finance: "#C9A24A",
  other: "#5C5C5C",
};
const ENDPOINTS = {
  project: "/api/projects",
  learning: "/api/learnings",
  goal: "/api/goals",
  journal: "/api/journal",
};
const STATUS_COLORS = { active: "#AAEB47", backlog: "#9B9B9B", done: "#6DC533", paused: "#F5A623" };
const PRIO_COLORS = { high: "#F5A623", medium: "#AAEB47", low: "#6DC533" };
const JTYPE_COLORS = { milestone: "#6DC533", note: "#E8E8E8", reflection: "#F5A623" };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const CHART_GRID = "rgba(46,46,46,0.8)";
const CHART_LABEL = "#5C5C5C";
const CHART_TRACK = "#2E2E2E";
const DAYS7 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  work: null,
  dashboard: null,
  projects: [],
  learnings: [],
  journal: [],
  timeline: [],
  projectFilter: "all",
  timelineLoaded: false,
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

function isoFromDate(d) {
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

function projectOptions(selected) {
  if (!state.projects.length) return '<option value="">No projects yet</option>';
  return state.projects
    .map((p) => `<option value="${p.id}"${Number(selected) === p.id ? " selected" : ""}>${esc(p.title)}</option>`)
    .join("");
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
  task: () =>
    [
      fld("Project", `<select class="input" id="qa-project_id">${projectOptions()}</select>`, true),
      fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
      fld(
        "Status",
        '<select class="input" id="qa-status"><option value="wanted">Maybe</option><option value="planned">Next</option><option value="in_progress">Doing</option></select>'
      ),
      fld(
        "Priority",
        '<select class="input" id="qa-priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select>'
      ),
      fld("Due date", dateInput("qa-due_date")),
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

function fieldsFor(type) {
  const f = FIELD_SETS[type];
  return typeof f === "function" ? f() : f;
}

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

function monthKey(iso) {
  return String(iso || "").slice(0, 7);
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
        stroke: CHART_GRID, "stroke-dasharray": "2 5",
      })
    );
    const label = svgEl("text", { x: getX(i), y: height - 6, fill: CHART_LABEL, "font-size": 9, "text-anchor": "middle" });
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
          "stop-color": idx === 1 ? "#AAEB47" : "rgba(170,235,71,0.35)",
        });
        grad.appendChild(stop);
      });
      svg.appendChild(grad);
      path.setAttribute("stroke", "url(#lineGrad)");
      path.style.filter = "drop-shadow(0px 3px 5px rgba(170,235,71,0.3))";
    }
    svg.appendChild(path);

    if (showDots) {
      pts.forEach((p) => {
        svg.appendChild(
          svgEl("circle", {
            cx: p.x, cy: p.y, r: s.gradient ? 3.4 : 3,
            fill: s.gradient ? "#AAEB47" : s.color,
            stroke: s.gradient ? "#111111" : "none",
            "stroke-width": s.gradient ? 1.5 : 0,
          })
        );
      });
    }
  });

  return svg;
}

function donutSVG(parts, centerValue, centerLabel) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const r = 50, c = 2 * Math.PI * r;
  const svg = svgEl("svg", { viewBox: "0 0 120 120", role: "img" });
  svg.appendChild(svgEl("circle", { cx: 60, cy: 60, r, fill: "none", stroke: CHART_TRACK, "stroke-width": 14 }));
  let offset = 0;
  parts.forEach((p) => {
    if (p.value <= 0) return;
    const len = (p.value / total) * c;
    svg.appendChild(
      svgEl("circle", {
        cx: 60, cy: 60, r,
        fill: "none",
        stroke: p.color,
        "stroke-width": 14,
        "stroke-dasharray": `${len - 3} ${c - (len - 3)}`,
        "stroke-dashoffset": -offset,
      })
    );
    offset += len;
  });
  return { svg, total };
}

function renderDonut(el, parts, centerValue, centerLabel) {
  const { svg } = donutSVG(parts, centerValue, centerLabel);
  const wrap = document.createElement("div");
  wrap.className = "donut-row";
  const dWrap = document.createElement("div");
  dWrap.className = "donut-wrap";
  dWrap.appendChild(svg);
  const center = document.createElement("div");
  center.className = "donut-center";
  center.innerHTML = `<b>${centerValue}</b><span>${esc(centerLabel)}</span>`;
  dWrap.appendChild(center);
  wrap.appendChild(dWrap);

  const legend = document.createElement("div");
  legend.className = "donut-legend";
  parts.forEach((p) => {
    const item = document.createElement("div");
    item.className = "donut-item";
    item.innerHTML =
      `<span><span class="ldot" style="background:${p.color}"></span>${esc(p.label)}</span>` +
      `<b>${p.value}</b>`;
    legend.appendChild(item);
  });
  wrap.appendChild(legend);
  el.innerHTML = "";
  el.appendChild(wrap);
}

function renderHBar(el, items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  el.innerHTML = `<div class="hbar">` +
    items
      .map(
        (i) => `<div class="hbar-row">
          <span class="hbar-label" title="${esc(i.label)}">${esc(i.label)}</span>
          <div class="hbar-track"><div class="hbar-fill" style="background:${i.color};width:${Math.round((i.value / max) * 100)}%"></div></div>
          <span class="hbar-val">${i.value}</span>
        </div>`
      )
      .join("") +
    `</div>`;
}

/* ---------- Shared tab renderers ---------- */

function tasksFor(projectId) {
  const map = (state.dashboard && state.dashboard.tasks_by_project) || {};
  return map[String(projectId)] || [];
}

function taskCheckbox(task, opts = {}) {
  const done = task.status === "done";
  return `<button class="checkbox${done ? " checked" : ""}" data-action="task-toggle" data-id="${task.id}" data-project="${task.project_id}" aria-label="${done ? "Completed" : "Mark done"}" title="Toggle done">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
  </button>`;
}

function daysLabel(iso, today) {
  if (!iso) return { text: "no deadline", cls: "" };
  const ms = new Date(iso + "T00:00:00") - new Date(today + "T00:00:00");
  const d = Math.round(ms / 86400000);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, cls: "overdue" };
  if (d === 0) return { text: "due today", cls: "today" };
  if (d === 1) return { text: "due tomorrow", cls: "" };
  return { text: `due in ${d}d`, cls: "" };
}

function renderProjectsCharts() {
  const statusCounts = { active: 0, backlog: 0, done: 0, paused: 0 };
  const prioCounts = { high: 0, medium: 0, low: 0 };
  state.projects.forEach((p) => {
    if (statusCounts[p.status] !== undefined) statusCounts[p.status]++;
    if (prioCounts[p.priority] !== undefined) prioCounts[p.priority]++;
  });

  renderDonut(
    $("#projects-status"),
    ["active", "backlog", "done", "paused"].map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: statusCounts[s],
      color: STATUS_COLORS[s],
    })),
    state.projects.length,
    "projects"
  );
  renderHBar(
    $("#projects-priority"),
    ["high", "medium", "low"].map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: prioCounts[s],
      color: PRIO_COLORS[s],
    }))
  );
}

function renderTagFreq(el) {
  const freq = {};
  state.learnings.forEach((l) => parseTags(l.tags).forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  state.projects.forEach((p) => parseTags(p.tags).forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  const items = Object.entries(freq)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  if (!items.length) {
    el.innerHTML = emptyState("No tags yet.");
    return;
  }
  renderHBar(el, items.map((i, idx) => ({ ...i, color: ["#AAEB47", "#E8E8E8", "#F5A623", "#6DC533", "#C9A24A", "#9B9B9B"][idx % 6] })));
}

function renderGoalsByArea(el) {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const byArea = {};
  goals.forEach((g) => {
    const a = AREAS.includes(g.area) ? g.area : "other";
    byArea[a] = byArea[a] || [];
    byArea[a].push(Number(g.progress) || 0);
  });
  const items = Object.entries(byArea).map(([area, progs]) => ({
    label: AREA_LABELS[area] || area,
    value: Math.round(progs.reduce((s, p) => s + p, 0) / progs.length),
    color: AREA_COLORS[area] || AREA_COLORS.other,
  }));
  if (!items.length) {
    el.innerHTML = emptyState("No goals yet.");
    return;
  }
  renderHBar(el, items);
}

function renderMonthlyBars(el) {
  const counts = {};
  state.learnings.concat(state.journal).forEach((i) => {
    const k = monthKey(i.date);
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  const months = Object.keys(counts).sort().slice(-8);
  if (!months.length) {
    el.innerHTML = emptyState("No entries yet.");
    return;
  }
  const max = Math.max(1, ...months.map((m) => counts[m]));
  el.innerHTML = `<div class="hbar">` +
    months
      .map((m) => {
        const label = new Date(m + "-01").toLocaleDateString(undefined, { month: "short", year: "2-digit" });
        return `<div class="hbar-row">
          <span class="hbar-label">${label}</span>
          <div class="hbar-track"><div class="hbar-fill" style="background:#6DC533;width:${Math.round((counts[m] / max) * 100)}%"></div></div>
          <span class="hbar-val">${counts[m]}</span>
        </div>`;
      })
      .join("") +
    `</div>`;
}

/* ---------- Projects tab ---------- */

function projectTaskList(p) {
  const tasks = tasksFor(p.id);
  if (!tasks.length) {
    return `<div class="proj-tasks empty-tasks">No tasks yet.</div>`;
  }
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pct = Math.round((doneCount / tasks.length) * 100);
  const rows = tasks
    .map(
      (t) => `<div class="pt-row${t.status === "done" ? " done" : ""}">
        ${taskCheckbox(t)}
        <span class="pt-title">${esc(t.title)}</span>
        <span class="pt-state pt-${esc(t.status)}">${esc(t.status)}</span>
      </div>`
    )
    .join("");
  return `<div class="proj-progress">
      <span class="proj-progress-label">${doneCount}/${tasks.length} done</span>
      <div class="proj-progress-track"><div class="proj-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="proj-tasks">${rows}</div>`;
}

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
    <div class="proj-task-block">
      ${done ? "" : projectTaskList(p)}
      <div class="add-task">
        <input class="input add-task-input" type="text" placeholder="Add a task..." aria-label="Add a task to ${esc(p.title)}" maxlength="200" autocomplete="off">
        <button class="btn btn-sm add-task-btn" data-action="task-add" data-id="${p.id}">Add</button>
      </div>
    </div>
    <div class="card-actions">
      ${done ? `<span class="meta">Done</span>` : `<button class="btn btn-sm" data-action="done" data-type="project" data-id="${p.id}">Mark done</button>`}
      <button class="btn btn-sm btn-danger" data-action="delete" data-type="project" data-id="${p.id}">Delete</button>
    </div>
  </article>`;
}

function colBlock(title, items) {
  return `<section class="project-col" aria-label="${esc(title)}">
    <h3 class="col-title">${esc(title)} <span class="count">${items.length}</span></h3>
    <div class="card-grid">${items.length ? items.map(projectCard).join("") : emptyState("Nothing here yet.")}</div>
  </section>`;
}

function renderProjectTree() {
  const rows = state.projects
    .map((p) => {
      const tasks = tasksFor(p.id);
      const total = tasks.length;
      const done = tasks.filter((t) => t.status === "done").length;
      const open = total - done;
      const overdue = tasks.some((t) => t.status !== "done" && t.due_date && t.due_date < todayISO());
      const pct = total ? Math.round((done / total) * 100) : 0;
      const sc = STATUS_COLORS[p.status] || "#9B9B9B";
      const pc = PRIO_COLORS[p.priority] || "#9B9B9B";
      return `<div class="tree-row">
        <div class="tree-label">
          <span class="tree-status" style="background:${sc}"></span>
          <span class="tree-name" title="${esc(p.title)}">${esc(p.title)}</span>
          <span class="tree-meta">${esc(p.status)} · ${esc(p.priority)}</span>
        </div>
        <div class="tree-bar-track">
          <div class="tree-bar-fill ${overdue ? "warn" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="tree-count ${overdue ? "overdue" : ""}">${done}/${total} done${overdue ? " · overdue" : ""}</div>
      </div>`;
    })
    .join("");
  $("#project-tree").innerHTML = rows || `<p class="empty">No projects yet. Add one to begin.</p>`;
}

function renderProjects() {
  renderProjectTree();
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

/* ---------- Goals / Knowledge / Timeline tabs ---------- */

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

function renderGoalsAreaChart() {
  renderGoalsByArea($("#goals-area-chart"));
}

function renderKnowledgeCharts() {
  renderTagFreq($("#knowledge-tags"));
  const dates = lastNDates(60);
  const counts = countByDate(state.learnings);
  const vals = dates.map((d) => counts[d] || 0);
  const labels = dates.map((d) => formatDate(d).split(",")[0]);
  const container = $("#knowledge-trend");
  container.innerHTML = "";
  container.appendChild(
    lineChart({
      series: [{ values: vals, color: "#AAEB47" }],
      xLabels: labels,
      labelEvery: 9,
    })
  );
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
  if (!list.length) {
    $("#learn-list").innerHTML = emptyState("No learnings match your filters.");
    return;
  }
  const groups = {};
  list.forEach((l) => {
    const key = l.related_project || "Unattributed";
    (groups[key] = groups[key] || []).push(l);
  });
  const ledger = Object.keys(groups)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((proj) => {
      const atoms = groups[proj]
        .map(
          (l) => `<div class="atom-row">
            <span class="atom-date">${esc(formatDate(l.date))}</span>
            <div class="atom-body">
              <p class="atom-title">${esc(l.title)}</p>
              ${l.content ? `<p class="atom-text">${esc(l.content)}</p>` : ""}
              <div class="chips">${tagChips(l.tags)}</div>
            </div>
            <button class="btn btn-sm btn-danger" data-action="delete" data-type="learning" data-id="${l.id}">Delete</button>
          </div>`
        )
        .join("");
      return `<section class="atom-group">
        <h3 class="atom-group-title">${esc(proj)} <span class="count">${groups[proj].length}</span></h3>
        <div class="atom-list">${atoms}</div>
      </section>`;
    })
    .join("");
  $("#learn-list").innerHTML = ledger;
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

function renderTimeline() {
  const list = state.timeline;
  $("#timeline-count").textContent = list.length ? `${list.length} items` : "";
  $("#timeline-list").innerHTML = list.length
    ? list.map(timelineItem).join("")
    : emptyState("Timeline is empty.");
}

function renderTimelineMonthly() {
  renderMonthlyBars($("#timeline-monthly"));
}

/* ---------- WORK SCREEN ---------- */

function workCheckbox(task, label) {
  return `<button class="checkbox" data-action="task-finish" data-id="${task.id}" aria-label="${label || "Mark done"}" title="Mark done">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
  </button>`;
}

function workTaskMeta(t, today) {
  const dl = daysLabel(t.due_date, today);
  return `${dl.cls ? `<span class="work-due ${dl.cls}">${esc(dl.text)}</span>` : ""}`;
}

function workRow(t, today) {
  const pc = PRIO_COLORS[t.priority] || "#9B9B9B";
  return `<div class="work-row">
    <span class="brief-prio" style="background:${pc}"></span>
    <div class="work-row-body">
      <p class="work-title">${esc(t.title)} <span class="work-project">${esc(t.project_title)}</span></p>
      ${workTaskMeta(t, today)}
    </div>
    <button class="btn btn-sm" data-action="task-start" data-id="${t.id}">Start</button>
    ${workCheckbox(t)}
  </div>`;
}

function renderCurrent() {
  const w = state.work;
  const el = $("#work-current");
  const c = w && w.current;
  if (!c) {
    el.innerHTML = `<p class="work-empty">Nothing on your list. Start an idea below or add a task.</p>`;
    return;
  }
  const pc = PRIO_COLORS[c.priority] || "#9B9B9B";
  el.innerHTML = `
    ${w.needs_start ? `<p class="hero-hint">Nothing in progress — start this next one:</p>` : ""}
    <div class="hero-body">
      <div class="hero-top">
        <h2 class="hero-title">${esc(c.title)}</h2>
        <span class="task-chip task-prio" style="--chip:${pc}">${esc(c.priority)}</span>
      </div>
      <p class="hero-meta">${esc(c.project_title)}${c.due_date ? ` · ${workTaskMeta(c, w.today)}` : ""}</p>
      <div class="hero-actions">
        ${w.needs_start ? `<button class="btn btn-primary" data-action="task-start" data-id="${c.id}">Start</button>` : ""}
        <button class="btn" data-action="task-finish" data-id="${c.id}">Done</button>
      </div>
    </div>`;
}

function renderUpcomingWork() {
  const w = state.work;
  const el = $("#work-upcoming");
  const list = (w && w.upcoming) || [];
  el.innerHTML = list.length
    ? list.map((t) => workRow(t, w.today)).join("")
    : `<p class="work-empty">Nothing queued — all clear.</p>`;
}

function renderProjectsWork() {
  const w = state.work;
  const el = $("#work-projects");
  const list = (w && w.active_projects) || [];
  $("#work-projects-count").textContent = list.length ? `· ${list.length}` : "";
  if (!list.length) {
    el.innerHTML = `<p class="work-empty">No active projects. Start an idea below.</p>`;
    return;
  }
  el.innerHTML = list
    .map((ap) => {
      const p = ap.project;
      const pct = ap.total ? Math.round((ap.done / ap.total) * 100) : 0;
      const tasks = (ap.open_tasks || [])
        .map((t) => {
          const pc = PRIO_COLORS[t.priority] || "#9B9B9B";
          return `<div class="wp-task">
            <span class="brief-prio" style="background:${pc}"></span>
            <span class="wp-task-title">${esc(t.title)}</span>
            ${workTaskMeta(t, w.today)}
            <button class="btn btn-sm" data-action="task-start" data-id="${t.id}">Start</button>
            ${workCheckbox(t)}
          </div>`;
        })
        .join("");
      return `<div class="wp-project ${ap.overdue ? "overdue" : ""}">
        <div class="wp-head">
          <span class="wp-title" title="${esc(p.title)}">${esc(p.title)}</span>
          <span class="wp-count">${ap.done}/${ap.total} done</span>
        </div>
        <div class="proj-progress-track"><div class="proj-progress-fill ${ap.overdue ? "warn" : ""}" style="width:${pct}%"></div></div>
        ${tasks ? `<div class="wp-tasks">${tasks}</div>` : `<p class="work-empty">No tasks yet.</p>`}
        <div class="add-task">
          <input class="input add-task-input" type="text" placeholder="Add a task..." aria-label="Add a task to ${esc(p.title)}" maxlength="200" autocomplete="off">
          <button class="btn btn-sm add-task-btn" data-action="task-add" data-id="${p.id}">Add</button>
        </div>
      </div>`;
    })
    .join("");
}

function renderIdeas() {
  const w = state.work;
  const el = $("#work-ideas");
  const list = (w && w.ideas) || [];
  el.innerHTML = list.length
    ? list
        .map((idea) => {
          const p = idea.project;
          return `<div class="idea-row">
            <div class="idea-body">
              <p class="work-title">${esc(p.title)}</p>
              ${idea.top_task ? `<p class="idea-task">${esc(idea.top_task.title)}</p>` : ""}
            </div>
            <button class="btn btn-sm" data-action="idea-start" data-id="${p.id}">Start</button>
          </div>`;
        })
        .join("")
    : `<p class="work-empty">No ideas yet. Capture one with + New.</p>`;
}

function renderWork() {
  renderCurrent();
  renderUpcomingWork();
  renderProjectsWork();
  renderIdeas();
}

/* ---------- Clock ---------- */

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

/* ---------- Data loading ---------- */

async function loadWork() {
  try {
    state.work = await fetchJSON("/api/work");
    renderWork();
  } catch (err) {
    toast("Failed to load work: " + err.message, "error");
  }
}

async function loadDashboard() {
  try {
    state.dashboard = await fetchJSON("/api/dashboard");
    renderGoals();
    renderGoalsAreaChart();
  } catch (err) {
    toast("Failed to load dashboard: " + err.message, "error");
  }
}

async function loadProjects() {
  try {
    state.projects = await fetchJSON("/api/projects");
    renderProjects();
    renderProjectsCharts();
  } catch (err) {
    toast("Failed to load projects: " + err.message, "error");
  }
}

async function loadLearnings() {
  try {
    state.learnings = await fetchJSON("/api/learnings");
    renderLearnings();
    renderKnowledgeCharts();
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
    renderTimelineMonthly();
  } catch (err) {
    toast("Failed to load timeline: " + err.message, "error");
  }
}

async function refreshAll() {
  await Promise.all([loadWork(), loadDashboard(), loadProjects(), loadLearnings(), loadJournal()]);
  if (state.timelineLoaded) await loadTimeline();
}

/* ---------- Actions ---------- */

async function startTask(taskId) {
  try {
    await fetchJSON(`/api/tasks/${taskId}/start`, { method: "POST" });
    toast("Now in progress");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function finishTask(taskId) {
  try {
    await fetchJSON(`/api/tasks/${taskId}/status?status=done`, { method: "PATCH" });
    toast("Task done");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function ideaStart(projectId) {
  try {
    await fetchJSON(`/api/projects/${projectId}/start`, { method: "POST" });
    toast("Idea started");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function toggleTask(taskId, projectId) {
  try {
    const task = tasksFor(projectId).find((t) => t.id === taskId);
    const next = task && task.status === "done" ? "wanted" : "done";
    await fetchJSON(`/api/tasks/${taskId}/status?status=${encodeURIComponent(next)}`, { method: "PATCH" });
    toast(next === "done" ? "Task done" : "Task reopened");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function addTask(projectId, inputEl) {
  const title = (inputEl.value || "").trim();
  if (!title) return;
  try {
    await fetchJSON(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "wanted", priority: "medium" }),
    });
    toast("Task added");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
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

/* ---------- Tabs, filters, modal ---------- */

const PAGE_TITLES = { work: "Work", projects: "Projects", goals: "Goals", knowledge: "Knowledge", timeline: "Timeline" };

function switchTab(tab) {
  state.tab = tab;
  $$(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  $$(".side-icon").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
  $("#page-title").textContent = PAGE_TITLES[tab] || tab;
  $("#sub-project-filters").hidden = tab !== "projects";
  if (tab === "timeline") {
    if (!state.timelineLoaded) {
      state.timelineLoaded = true;
      loadTimeline();
    } else {
      renderTimeline();
      renderTimelineMonthly();
    }
  }
  if (tab === "knowledge" && !$("#knowledge-tags").hasChildNodes()) {
    renderKnowledgeCharts();
  }
  if (tab === "goals" && state.dashboard && !$("#goals-area-chart").hasChildNodes()) {
    renderGoalsAreaChart();
  }
}

function setProjectFilter(f) {
  state.projectFilter = f;
  $$(".filter-pill").forEach((p) => p.classList.toggle("active", p.dataset.filter === f));
  renderProjects();
}

function renderFields(defaults) {
  const type = $("#qa-type").value;
  $("#qa-fields").innerHTML = fieldsFor(type);
  if (defaults) {
    Object.entries(defaults).forEach(([k, v]) => {
      const el = $("#qa-" + k);
      if (el) el.value = v;
    });
  }
  $("#modal-title").textContent = "Add " + type.charAt(0).toUpperCase() + type.slice(1);
}

function openModal(type, defaults) {
  $("#qa-type").value = type;
  renderFields(defaults);
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
  if (type === "task") {
    const pid = val("project_id");
    if (!val("title")) return { error: "Title is required" };
    if (!pid) return { error: "Project is required" };
    return {
      endpoint: `/api/projects/${pid}/tasks`,
      body: {
        title: val("title"),
        status: raw("status") || "wanted",
        priority: raw("priority") || "medium",
        due_date: raw("due_date") || null,
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
  $$(".side-icon").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("add-task-input")) {
      e.preventDefault();
      const card = e.target.closest(".project-card, .wp-project");
      const id = card ? Number(card.querySelector(".add-task-btn").dataset.id) : null;
      if (id) addTask(id, e.target);
    }
  });

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
      else if (kind === "task-toggle") toggleTask(Number(id), Number(action.dataset.project));
      else if (kind === "task-start") startTask(Number(id));
      else if (kind === "task-finish") finishTask(Number(id));
      else if (kind === "idea-start") ideaStart(Number(id));
      else if (kind === "new-idea") openModal("project", { status: "backlog" });
      else if (kind === "task-add") {
        const card = action.closest(".project-card, .wp-project");
        addTask(Number(id), card ? card.querySelector(".add-task-input") : null);
      }
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
