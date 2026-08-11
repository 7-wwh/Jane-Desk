function renderUpcomingWork() {
  const w = state.work;
  const el = $("#work-upcoming");
  const list = (w && w.upcoming) || [];
  el.innerHTML = list.length
    ? list.map((t) => workRow(t, w.today)).join("")
    : `<p class="work-empty">Nothing queued — all clear.</p>`;
}

App.register("upcoming", { bind: () => {} });