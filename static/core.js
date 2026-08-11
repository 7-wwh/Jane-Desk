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
  mindClosing: false,
  mindPan: { x: 0, y: 0 },
  mindZoom: 1,
  mindInitialized: false,
  mindDragged: false,
  panStart: null,
  editId: null,
  flipPrev: null,
  workSort: "deadline",
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

const PRIO_RANK = { high: 0, medium: 1, low: 2 };

function fmtHMS(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [
    String(h).padStart(2, "0"),
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ];
}

function collectLeaves(roots) {
  const out = [];
  (function walk(nodes) {
    nodes.forEach((node) => {
      if (node.projects) {
        node.projects.forEach((p) => {
          (p.open_tasks || []).forEach((t) => out.push(t));
        });
      }
      (node.tasks || []).forEach((t) => out.push(t));
      walk(node.children || []);
    });
  })(roots);
  return out;
}

function isRunningTask(t) {
  return state.activeSession && state.activeSession.task_id === t.id;
}

function findTaskById(id) {
  const roots = state.tree && state.tree.roots ? state.tree.roots : [];
  return collectLeaves(roots).find((t) => t.id === id) || null;
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
    <button class="btn-icon btn-edit" data-action="task-edit" data-id="${t.id}" title="Edit task" aria-label="Edit task"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
   </div>`;
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
    updateFlipClock();
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

function hideMenu() {
  $("#new-menu").hidden = true;
  $("#new-btn").setAttribute("aria-expanded", "false");
}

/* ---------- Widget core / boot ---------- */

const App = {
  widgets: {},
  register(name, widget) {
    App.widgets[name] = widget;
  },
};

async function injectParts() {
  const parts = $$(".widget-part");
  await Promise.all(
    parts.map(async (el) => {
      const name = el.dataset.part;
      try {
        const res = await fetch("/widgets/" + name + "/index.html");
        if (!res.ok) throw new Error(res.status + " " + res.statusText);
        el.innerHTML = await res.text();
        const widget = App.widgets[name];
        if (widget && typeof widget.bind === "function") widget.bind(el);
      } catch (err) {
        toast("Failed to load " + name + ": " + err.message, "error");
      }
    })
  );
}

/* ---------- Global bindings ---------- */

function bindCore() {
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

  const timerPill = $("#topbar-timer");
  timerPill.addEventListener("mouseenter", () => {
    timerRolling = true;
    syncTopbarTimer();
  });
  timerPill.addEventListener("mouseleave", () => {
    timerRolling = false;
    syncTopbarTimer();
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
      else if (kind === "task-edit") {
        const t = findTaskById(Number(id));
        if (t) {
          state.editId = t.id;
          openModal("task", {
            project_id: t.project_id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date || "",
            begin_date: t.begin_date || "",
            duration: t.duration ?? "",
            branch_path: t.branch_path || "",
          });
        }
      }
      else if (kind === "tree-toggle") toggleMindTree();
    }
  });
}

/* ---------- Boot ---------- */

async function boot() {
  bindCore();
  await injectParts();
  renderSettings();
  updateClock();
  setInterval(updateClock, 60000);
  startTicker();
  await refreshAll();
}

App.boot = boot;