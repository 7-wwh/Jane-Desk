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

const state = {
  dashboard: null,
  projects: [],
  learnings: [],
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

function renderOverview(d) {
  $("#today").textContent = formatDate(d.today);
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

async function loadTimeline() {
  try {
    state.timeline = await fetchJSON("/api/timeline");
    renderTimeline();
  } catch (err) {
    toast("Failed to load timeline: " + err.message, "error");
  }
}

async function refreshAll() {
  await Promise.all([loadDashboard(), loadProjects(), loadLearnings()]);
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

async function init() {
  $("#today").textContent = formatDate(todayISO());
  bindEvents();
  await refreshAll();
}

init();
