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
const ENDPOINTS = {
  project: "/api/projects",
  learning: "/api/learnings",
  goal: "/api/goals",
  journal: "/api/journal",
};
const PRIO_COLORS = { high: "#F5A623", medium: "#AAEB47", low: "#6DC533" };
const DEFAULT_SETTINGS = { clock24: false, precision: "sec" };

const state = {
  work: null,
  projects: [],
  activeSession: null,
  tree: null,
  mindRoot: null,
  tab: "work",
  settings: { ...DEFAULT_SETTINGS },
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

function formatDate(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  if (!d) return String(iso);
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

function parseISO(iso) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + "T00:00:00");
  const hasTZ = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasTZ ? iso : iso + "Z");
  return isNaN(d.getTime()) ? null : d;
}

function tzOffsetLabel() {
  const off = new Date().getTimezoneOffset();
  const sign = off <= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}${m === "00" ? "" : ":" + m}`;
}

function tzName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch (_) {
    return "";
  }
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

/* ---------- Settings ---------- */

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem("checkboxSettings") || "{}")) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem("checkboxSettings", JSON.stringify(state.settings));
  } catch (_) {}
}

function renderSettings() {
  const s = state.settings;
  $$("#set-clock .seg-btn").forEach((b) => b.classList.toggle("active", (b.dataset.value === "24") === s.clock24));
  $$("#set-precision .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === s.precision));
  $("#set-tz").textContent = [tzName(), tzOffsetLabel()].filter(Boolean).join(" · ");
  $("#set-server").textContent = location.host || "local";
}

/* ---------- Quick-add form ---------- */

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

/* ---------- Work screen ---------- */

function daysLabel(iso, today) {
  if (!iso) return { text: "no deadline", cls: "" };
  const ms = new Date(iso + "T00:00:00") - new Date(today + "T00:00:00");
  const d = Math.round(ms / 86400000);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, cls: "overdue" };
  if (d === 0) return { text: "due today", cls: "today" };
  if (d === 1) return { text: "due tomorrow", cls: "" };
  return { text: `due in ${d}d`, cls: "" };
}

function workCheckbox(task, label) {
  return `<button class="checkbox" data-action="task-finish" data-id="${task.id}" aria-label="${label || "Mark done"}" title="Mark done">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
  </button>`;
}

function workTaskMeta(t, today) {
  const dl = daysLabel(t.due_date, today);
  return `${dl.cls ? `<span class="work-due ${dl.cls}">${esc(dl.text)}</span>` : ""}`;
}

function fmtDur(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

function liveClock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function liveText(startedAtIso) {
  const start = parseISO(startedAtIso);
  if (!start) return "0:00";
  const sec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  if (state.settings.precision === "min" && sec >= 60) return fmtDur(sec);
  return liveClock(sec);
}

function liveRoll(startedAtIso) {
  const start = parseISO(startedAtIso);
  if (!start) return "0:00";
  const sec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  return liveClock(sec);
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function isRunningTask(t) {
  return state.activeSession && state.activeSession.task_id === t.id;
}

function timeLabel(t) {
  const running = isRunningTask(t);
  const dur = running ? liveText(state.activeSession.started_at) : fmtDur(t.total_seconds);
  return `<span class="work-time${running ? " live" : ""}"${running ? ` data-live="${t.id}" data-count="${t.session_count || 0}"` : ""} data-action="session-open" data-id="${t.id}" role="button" tabindex="0" title="Session history">&#9202; ${t.session_count || 0} &middot; ${dur}</span>`;
}

function playButton(t) {
  const running = isRunningTask(t);
  if (running) {
    return `<button class="btn-icon btn-play active" data-action="session-stop" data-id="${state.activeSession.session_id}" title="Stop timer" aria-label="Stop timer"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>`;
  }
  return `<button class="btn-icon btn-play" data-action="session-start" data-id="${t.id}" title="Start timer" aria-label="Start timer"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>`;
}

function workRow(t, today) {
  const pc = PRIO_COLORS[t.priority] || "#9B9B9B";
  return `<div class="work-row">
    <span class="brief-prio" style="background:${pc}"></span>
    <div class="work-row-body">
      <p class="work-title">${esc(t.title)} <span class="work-project">${esc(t.project_title)}</span></p>
      ${workTaskMeta(t, today)}
      ${timeLabel(t)}
    </div>
    <button class="btn btn-sm" data-action="task-start" data-id="${t.id}">Start</button>
    ${playButton(t)}
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
      <div class="hero-meta">${timeLabel(c)}</div>
      <div class="hero-actions">
        ${w.needs_start ? `<button class="btn btn-primary" data-action="task-start" data-id="${c.id}">Start</button>` : ""}
        ${playButton(c)}
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
            <div class="wp-task-meta">${workTaskMeta(t, w.today)}${timeLabel(t)}</div>
            <button class="btn btn-sm" data-action="task-start" data-id="${t.id}">Start</button>
            ${playButton(t)}
            ${workCheckbox(t)}
          </div>`;
        })
        .join("");
      return `<div class="wp-project ${ap.overdue ? "overdue" : ""}">
        <div class="wp-head">
          <span class="wp-title" title="${esc(p.title)}">${esc(p.title)}</span>
          <span class="wp-head-actions">
            <span class="wp-count">${ap.done}/${ap.total} done</span>
            <button class="wp-close" data-action="project-close" data-id="${p.id}" data-open="${ap.open_tasks.length}" title="Close project">Close</button>
          </span>
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

/* ---------- Mind map ---------- */

function countProjects(roots) {
  let n = 0;
  (function walk(nodes) {
    nodes.forEach((node) => {
      n += (node.projects || []).length;
      walk(node.children || []);
    });
  })(roots);
  return n;
}

function mindFromBranch(b) {
  const node = { key: "b:" + b.path, label: b.name, kind: "branch", children: [] };
  (b.projects || []).forEach((p) => node.children.push(mindFromProject(p)));
  (b.tasks || []).forEach((t) => node.children.push(mindFromTask(t, true)));
  (b.children || []).forEach((c) => node.children.push(mindFromBranch(c)));
  return node;
}

function mindFromProject(p) {
  const proj = p.project;
  const node = {
    key: "p:" + proj.id,
    label: proj.title,
    kind: "project",
    status: proj.status,
    running: p.running,
    children: [],
  };
  (p.open_tasks || []).forEach((t) => node.children.push(mindFromTask(t, false)));
  return node;
}

function mindFromTask(t, showProject) {
  return {
    key: "task:" + t.id,
    label: t.title,
    kind: "task",
    status: t.status,
    priority: t.priority,
    running: t.running_session_id != null,
    tag: showProject ? t.project_title : "",
    children: [],
  };
}

function buildMindRoot(roots) {
  const root = { key: "root", label: "WORK", kind: "root", children: [] };
  (roots || []).forEach((b) => root.children.push(mindFromBranch(b)));
  return root;
}

function collectMindOpen(root) {
  const out = new Set(["root"]);
  (root.children || []).forEach((c) => out.add(c.key));
  (function walk(node, anc) {
    if (node.kind === "project" && node.running) {
      anc.forEach((k) => out.add(k));
      out.add(node.key);
    }
    (node.children || []).forEach((c) => walk(c, [...anc, node.key]));
  })(root, []);
  return out;
}

function applyMindOpen(root, openSet) {
  root.expanded = openSet.has(root.key);
  (root.children || []).forEach((c) => applyMindOpen(c, openSet));
}

const MIND_LEVEL_GAP = 230;
const MIND_ROW = 46;

function mindDescendantCount(n) {
  let c = 0;
  (n.children || []).forEach((ch) => {
    c += 1 + mindDescendantCount(ch);
  });
  return c;
}

function mindLayout(root) {
  const placed = [];
  let slot = 0;
  (function place(n, depth) {
    n._x = depth * MIND_LEVEL_GAP;
    if (!n.expanded || !n.children.length) {
      n._y = slot * MIND_ROW;
      n._top = n._bottom = n._y;
      slot++;
    } else {
      n.children.forEach((c) => place(c, depth + 1));
      n._top = n.children[0]._top;
      n._bottom = n.children[n.children.length - 1]._bottom;
      n._y = (n._top + n._bottom) / 2;
    }
    placed.push(n);
  })(root, 0);
  return { placed, h: Math.max(1, slot) * MIND_ROW + 24 };
}

function mindConnector(x1, y1, x2, y2) {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function findMindNode(n, key) {
  if (n.key === key) return n;
  for (const c of n.children || []) {
    const found = findMindNode(c, key);
    if (found) return found;
  }
  return null;
}

function renderMindMap() {
  const el = $("#work-tree");
  const t = state.tree;
  if (!t) return;
  $("#tree-count").textContent = t.roots && t.roots.length ? `· ${countProjects(t.roots)}` : "";
  if (!t.roots || !t.roots.length) {
    el.innerHTML = `<p class="work-empty">No projects yet. Add one with +.</p>`;
    return;
  }
  if (!state.mindRoot) {
    state.mindRoot = buildMindRoot(t.roots);
    applyMindOpen(state.mindRoot, collectMindOpen(state.mindRoot));
  }
  const { placed, h } = mindLayout(state.mindRoot);
  const nodesHtml = placed
    .map((n) => {
      const open = !!n.expanded;
      const hasKids = n.children && n.children.length;
      const count = hasKids ? mindDescendantCount(n) : 0;
      return `<div class="mind-node kind-${n.kind}${n.running ? " running" : ""}${n.status ? " st-" + n.status : ""}${open ? " open" : ""}" data-key="${esc(n.key)}" style="left:${Math.round(n._x)}px;top:${Math.round(n._y)}px">
        <span class="mind-label">${esc(n.label)}</span>
        ${n.tag ? `<span class="mind-tag">${esc(n.tag)}</span>` : ""}
        ${hasKids ? `<span class="mind-count${open ? "" : " hint"}">${open ? "&#9662;" : "&#9656;"}${count}</span>` : ""}
      </div>`;
    })
    .join("");
  el.innerHTML = `<div class="mind-wrap">${nodesHtml}</div>`;
  const wrap = el.querySelector(".mind-wrap");
  const nodeEls = [...wrap.querySelectorAll(".mind-node")];
  let maxRight = 0;
  placed.forEach((n, i) => {
    n._w = nodeEls[i].offsetWidth || 80;
    maxRight = Math.max(maxRight, n._x + n._w);
  });
  const w = Math.round(maxRight + 24);
  const hh = Math.round(h);
  wrap.style.width = w + "px";
  wrap.style.height = hh + "px";
  const edges = [];
  (function collect(n) {
    if (!n.expanded) return;
    (n.children || []).forEach((c) => {
      edges.push({ x1: n._x + n._w, y1: n._y, x2: c._x, y2: c._y });
      collect(c);
    });
  })(state.mindRoot);
  const lines = edges
    .map((e) => `<path d="${mindConnector(e.x1, e.y1, e.x2, e.y2)}" fill="none" class="mind-line"/>`)
    .join("");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "mind-svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", hh);
  svg.setAttribute("viewBox", `0 0 ${w} ${hh}`);
  svg.innerHTML = lines;
  wrap.prepend(svg);
  if (el.clientWidth > 0 && el.clientHeight > 0) {
    const fit = Math.min(el.clientWidth / w, el.clientHeight / hh, 1);
    if (fit < 1 && fit >= 0.72) {
      wrap.style.transform = `translate(-50%, -50%) scale(${fit})`;
    }
  }
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
    hour12: !state.settings.clock24,
  };
  $("#today").textContent = now.toLocaleDateString("en-US", options).replace(",", " -");
}

/* ---------- Data loading ---------- */

async function loadWork() {
  try {
    state.work = await fetchJSON("/api/work");
  } catch (err) {
    toast("Failed to load work: " + err.message, "error");
  }
}

async function loadProjects() {
  try {
    state.projects = await fetchJSON("/api/projects");
  } catch (err) {
    toast("Failed to load projects: " + err.message, "error");
  }
}

async function loadActiveSession() {
  try {
    const s = await fetchJSON("/api/sessions/active");
    state.activeSession = s
      ? { task_id: s.session.task_id, session_id: s.session.id, started_at: s.session.started_at, task_title: s.task_title || "" }
      : null;
  } catch (err) {
    state.activeSession = null;
  }
  syncTopbarTimer();
}

async function loadTree() {
  try {
    state.tree = await fetchJSON("/api/tree");
  } catch (err) {
    toast("Failed to load tree: " + err.message, "error");
  }
}

async function refreshAll() {
  await Promise.all([loadWork(), loadProjects(), loadActiveSession(), loadTree()]);
  state.mindRoot = null;
  renderWork();
  renderMindMap();
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

let tickTimer = null;
let timerRolling = false;
function syncTopbarTimer() {
  const pill = $("#topbar-timer");
  if (!pill) return;
  if (!state.activeSession) {
    pill.hidden = true;
    return;
  }
  pill.hidden = false;
  $("#topbar-timer-name").textContent = state.activeSession.task_title || "";
  $("#topbar-timer-val").textContent = timerRolling
    ? liveRoll(state.activeSession.started_at)
    : liveText(state.activeSession.started_at);
}

function startTicker() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    syncTopbarTimer();
    if (!state.activeSession) return;
    $$("[data-live]").forEach((el) => {
      if (Number(el.dataset.live) === state.activeSession.task_id) {
        el.textContent = "⏱ " + (el.dataset.count || 0) + " · " + liveText(state.activeSession.started_at);
      }
    });
    $$("[data-session-live]").forEach((el) => {
      el.textContent = liveText(state.activeSession.started_at);
    });
  }, 1000);
}

async function startSession(taskId) {
  try {
    await fetchJSON(`/api/tasks/${taskId}/sessions/start`, { method: "POST" });
    toast("Timer started");
    await loadActiveSession();
    startTicker();
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function stopSession(sessionId) {
  try {
    await fetchJSON(`/api/sessions/${sessionId}/stop`, { method: "POST" });
    toast("Timer stopped");
    await loadActiveSession();
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function openSessions(taskId) {
  try {
    const d = await fetchJSON(`/api/tasks/${taskId}/sessions`);
    const running = state.activeSession && state.activeSession.task_id === taskId ? state.activeSession.session_id : null;
    const rows = d.sessions.length
      ? d.sessions
          .map(
            (s) => `<div class="session-row${s.id === running ? " running" : ""}">
            <span class="session-date">${esc(formatDate(s.started_at))}</span>
            <span class="session-time">${esc(fmtTime(s.started_at))} &rarr; ${s.ended_at ? esc(fmtTime(s.ended_at)) : `<span class="session-now">now</span>`}</span>
            <span class="session-dur">${s.ended_at ? esc(fmtDur(s.duration_seconds)) : `<span class="session-live" data-session-live>${esc(liveText(s.started_at))}</span>`}</span>
            <button class="btn btn-sm btn-danger" data-action="session-delete" data-id="${s.id}" data-task="${taskId}">Delete</button>
          </div>`
          )
          .join("")
      : `<p class="work-empty">No sessions yet.</p>`;
    const tzHint = [tzName(), tzOffsetLabel()].filter(Boolean).join(" · ");
    $("#sessions-title").textContent = "Sessions";
    $("#sessions-body").innerHTML = `
      <p class="session-tz" title="Backend stores UTC; these are converted to your local time.">Times in your timezone &middot; ${esc(tzHint)}</p>
      <p class="session-summary">${esc(fmtDur(d.total_seconds))} total &middot; ${d.session_count} session${d.session_count === 1 ? "" : "s"}</p>
      <div class="session-head"><span>Date</span><span>Start &rarr; End</span><span>Duration</span><span></span></div>
      <div class="session-list">${rows}</div>`;
    $("#sessions-backdrop").hidden = false;
    document.body.classList.add("modal-open");
  } catch (err) {
    toast("Failed to load sessions: " + err.message, "error");
  }
}

function closeSessions() {
  $("#sessions-backdrop").hidden = true;
  document.body.classList.remove("modal-open");
}

async function deleteSession(sessionId, taskId) {
  try {
    await fetchJSON(`/api/sessions/${sessionId}`, { method: "DELETE" });
    toast("Session deleted");
    await loadActiveSession();
    await refreshAll();
    if (taskId) openSessions(taskId);
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function closeProject(projectId, openTasks) {
  if (openTasks > 0 && !window.confirm(`This project has ${openTasks} open task${openTasks === 1 ? "" : "s"}. Close the whole project anyway?`)) {
    return;
  }
  try {
    await fetchJSON(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    toast("Project closed");
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

/* ---------- Tabs, modal ---------- */

function switchTab(tab) {
  state.tab = tab;
  $$(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
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

  $("#set-clock").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.settings.clock24 = btn.dataset.value === "24";
    saveSettings();
    renderSettings();
    updateClock();
  });

  $("#set-precision").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.settings.precision = btn.dataset.value;
    saveSettings();
    renderSettings();
    syncTopbarTimer();
  });

  const timerPill = $("#topbar-timer");
  timerPill.addEventListener("mouseenter", () => {
    timerRolling = true;
    syncTopbarTimer();
  });
  timerPill.addEventListener("mouseleave", () => {
    timerRolling = false;
    syncTopbarTimer();
  });

  document.addEventListener("click", (e) => {
    const nodeEl = e.target.closest(".mind-node");
    if (nodeEl && state.mindRoot) {
      const node = findMindNode(state.mindRoot, nodeEl.dataset.key);
      if (node && node.children && node.children.length) {
        node.expanded = !node.expanded;
        renderMindMap();
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("add-task-input")) {
      e.preventDefault();
      const card = e.target.closest(".wp-project");
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
      if (!$("#sessions-backdrop").hidden) closeSessions();
      else closeModal();
      hideMenu();
    }
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".new-wrap").contains(e.target)) hideMenu();
    if (e.target === $("#modal-backdrop")) closeModal();
    if (e.target === $("#sessions-backdrop")) closeSessions();
    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      closeModal();
      return;
    }
    const action = e.target.closest("[data-action]");
    if (action) {
      const { action: kind, type, id } = action.dataset;
      if (kind === "task-start") startTask(Number(id));
      else if (kind === "task-finish") finishTask(Number(id));
      else if (kind === "idea-start") ideaStart(Number(id));
      else if (kind === "session-start") startSession(Number(id));
      else if (kind === "session-stop") stopSession(Number(id));
      else if (kind === "session-open") openSessions(Number(id));
      else if (kind === "session-delete") deleteSession(Number(id), Number(action.dataset.task));
      else if (kind === "session-close") closeSessions();
      else if (kind === "new-idea") openModal("project", { status: "backlog" });
      else if (kind === "task-add") {
        const card = action.closest(".wp-project");
        addTask(Number(id), card ? card.querySelector(".add-task-input") : null);
      }
      else if (kind === "project-close") closeProject(Number(id), Number(action.dataset.open));
    }
  });
}

function init() {
  state.settings = loadSettings();
  updateClock();
  setInterval(updateClock, 60000);
  bindEvents();
  renderSettings();
  startTicker();
  refreshAll();
}

init();
