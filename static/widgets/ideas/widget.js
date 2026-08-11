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

async function ideaStart(projectId) {
  try {
    await fetchJSON(`/api/projects/${projectId}/start`, { method: "POST" });
    toast("Idea started");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

App.register("ideas", { bind: () => {} });