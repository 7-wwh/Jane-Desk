(function () {
  function renderProjects(el) {
    const container = el.querySelector("#projects-overview-list");
    if (!container) return;

    const w = state.work;
    const active =
      (w && w.active_projects) ||
      (state.projects || []).filter((p) => p.status === "active");
    if (!active || active.length === 0) {
      container.innerHTML = `<p class="work-empty">No active projects yet. Add one with +.</p>`;
      return;
    }

    container.innerHTML = active
      .slice(0, 5)
      .map((item, idx) => {
        const p = item.project || item;
        const done = item.done != null ? item.done : 0;
        const total = item.total != null ? item.total : 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const isAmber = pct >= 50 && pct < 80;
        return `
        <div class="project-progress-item" title="${esc(p.title)}">
          <div class="project-progress-head">
            <span class="project-name">${esc(p.title)}</span>
            <span class="project-pct ${isAmber ? "text-amber" : ""}">${pct}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${isAmber ? "bg-amber" : pct >= 80 ? "bg-green" : "bg-dark"}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  App.register("projects-overview", {
    bind(el) {
      renderProjects(el);
    },
    render(el) {
      renderProjects(el);
    },
  });
})();