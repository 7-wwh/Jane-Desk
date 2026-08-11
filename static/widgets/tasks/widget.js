function sortLeaves(leaves, mode) {
  leaves = [...leaves];
  const dueKey = (t) => (t.due_date ? new Date(t.due_date + "T00:00:00").getTime() : Infinity);
  if (mode === "alpha") {
    leaves.sort((a, b) => (a.title || "").localeCompare(b.title || "") || PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  } else if (mode === "priority") {
    leaves.sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || dueKey(a) - dueKey(b));
  } else {
    leaves.sort((a, b) => dueKey(a) - dueKey(b) || PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || (a.title || "").localeCompare(b.title || ""));
  }
  return leaves;
}

function renderProjectsWork() {
  const w = state.work;
  const el = $("#work-projects");
  if (w && $("#work-sort")) {
    $$("#work-sort .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === state.workSort));
  }
  const roots = state.tree && state.tree.roots ? state.tree.roots : [];
  const all = sortLeaves(collectLeaves(roots), state.workSort);
  $("#work-projects-count").textContent = all.length ? `· ${all.length}` : "";
  if (!all.length) {
    el.innerHTML = `<p class="work-empty">No tasks yet. Add one with +.</p>`;
    return;
  }
  el.innerHTML = all.map((t) => workRow(t, w && w.today)).join("");
}

function bindWorkSort() {
  $("#work-sort").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.workSort = btn.dataset.value;
    renderProjectsWork();
  });
}

App.register("tasks", { bind: bindWorkSort });