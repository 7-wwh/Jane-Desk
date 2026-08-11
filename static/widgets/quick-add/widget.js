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
        '<select class="input" id="qa-status"><option value="wanted">Maybe</option><option value="planned">Next</option><option value="in_progress">Doing</option><option value="done">Done</option></select>'
      ),
      fld(
        "Priority",
        '<select class="input" id="qa-priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select>'
      ),
      fld("Due date", dateInput("qa-due_date")),
      fld("Begin date", dateInput("qa-begin_date")),
      fld("Duration (hours)", '<input class="input" id="qa-duration" type="number" min="0" max="8760" step="0.5" placeholder="Optional">'),
      fld("Branch path", '<input class="input" id="qa-branch_path" type="text" placeholder="e.g. work/2026/Q3 report">'),
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

function renderFields(defaults) {
  const type = $("#qa-type").value;
  const editing = state.editId != null && type === "task";
  $("#qa-fields").innerHTML = fieldsFor(type);
  if (defaults) {
    Object.entries(defaults).forEach(([k, v]) => {
      const el = $("#qa-" + k);
      if (el) el.value = v;
    });
  }
  if (editing) {
    const pid = $("#qa-project_id");
    if (pid) pid.disabled = true;
  }
  $("#modal-title").textContent = editing
    ? "Edit Task"
    : "Add " + type.charAt(0).toUpperCase() + type.slice(1);
  const submit = $("#quick-form").querySelector('[type="submit"]');
  if (submit) submit.textContent = editing ? "Save" : "Create";
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
  const submit = $("#quick-form").querySelector('[type="submit"]');
  if (submit) submit.textContent = "Create";
  state.editId = null;
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
    if (!val("title")) return { error: "Title is required" };
    const body = {
      title: val("title"),
      status: raw("status") || "wanted",
      priority: raw("priority") || "medium",
      due_date: raw("due_date") || null,
      begin_date: raw("begin_date") || null,
      duration: raw("duration") !== "" ? Math.max(0, Math.min(8760, parseFloat(raw("duration")) || 0)) : null,
      branch_path: val("branch_path"),
    };
    if (state.editId != null) {
      return { endpoint: `/api/tasks/${state.editId}`, method: "PUT", body };
    }
    const pid = val("project_id");
    if (!pid) return { error: "Project is required" };
    return {
      endpoint: `/api/projects/${pid}/tasks`,
      body,
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

function bindQuickAdd() {
  $("#qa-type").addEventListener("change", () => {
    state.editId = null;
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
      const wasEdit = state.editId != null;
      await fetchJSON(payload.endpoint, {
        method: payload.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      closeModal();
      toast(wasEdit ? "Task updated" : "Created " + $("#qa-type").value);
      await refreshAll();
    } catch (err) {
      toast("Failed: " + err.message, "error");
    }
  });
}

App.register("quick-add", { bind: bindQuickAdd });