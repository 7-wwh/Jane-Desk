(function () {
  let weekOffset = 0;
  const DAY_COUNT = 7;

  function parseDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    return new Date(iso + "T00:00:00");
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function windowDays() {
    const end = startOfToday();
    end.setDate(end.getDate() + weekOffset * DAY_COUNT);
    const days = [];
    for (let i = DAY_COUNT - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }

  function dayDiff(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function isoKey(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function barClass(task) {
    const running = isRunningTask(task);
    if (running) return "amber";
    if (task.status === "done") return "muted";
    if (task.priority === "high") return "dark";
    if (task.priority === "low") return "light";
    return "amber";
  }

  function renderSchedule(el) {
    const axis = el.querySelector(".timeline-x-axis");
    const grid = el.querySelector(".timeline-grid-lines");
    const body = el.querySelector(".timeline-body");
    const month = el.querySelector(".sched-month");
    if (!axis || !body) return;

    const days = windowDays();
    const todayKey = isoKey(startOfToday());

    axis.innerHTML = days
      .map((d) => {
        const key = isoKey(d);
        const active = key === todayKey ? " active" : "";
        return `<div class="timeline-date-cell${active}"><span class="day-name">${esc(
          d.toLocaleDateString(undefined, { weekday: "short" })
        )}</span><span class="day-num">${d.getDate()}</span></div>`;
      })
      .join("");

    if (grid) {
      grid.innerHTML = days
        .map((d) => {
          const active = isoKey(d) === todayKey ? " active-line" : "";
          return `<div class="grid-line${active}"></div>`;
        })
        .join("");
    }

    if (month) {
      const mid = days[Math.floor(days.length / 2)];
      month.textContent = mid.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }

    const roots = state.tree && state.tree.roots ? state.tree.roots : [];
    const tasks = collectLeaves(roots).filter((t) => {
      const start = parseDate(t.begin_date);
      const end = parseDate(t.due_date);
      return (start || end) && t.status !== "done";
    });

    const usable = tasks
      .map((t) => ({ task: t, start: parseDate(t.begin_date) || parseDate(t.due_date), end: parseDate(t.due_date) || parseDate(t.begin_date) }))
      .filter((t) => t.start && t.end && t.start <= t.end)
      .sort((a, b) => a.start - b.start);

    const winStart = days[0];
    const winEnd = new Date(days[days.length - 1]);
    winEnd.setHours(23, 59, 59, 999);

    const inWindow = usable.filter((t) => t.start <= winEnd && t.end >= winStart);

    if (!inWindow.length) {
      body.innerHTML = `<p class="work-empty">No dated tasks in this window.</p>`;
      return;
    }

    const rows = inWindow
      .map(({ task, start, end }) => {
        const leftIdx = Math.max(0, Math.min(DAY_COUNT - 1, dayDiff(winStart, start)));
        const rightIdx = Math.max(leftIdx, Math.min(DAY_COUNT - 1, dayDiff(winStart, end)));
        const left = (leftIdx / DAY_COUNT) * 100;
        const width = ((rightIdx - leftIdx + 1) / DAY_COUNT) * 100;
        const daysSpan = dayDiff(start, end) + 1;
        const cls = barClass(task);
        return `<div class="timeline-row">
          <div class="timeline-bar-wrapper" style="left: ${left.toFixed(2)}%; width: ${width.toFixed(2)}%;">
            <div class="timeline-bar ${cls}" data-task="${esc(task.title)}" data-span="${esc(isoKey(start))} → ${esc(isoKey(end))}">
              <span class="bar-dot ${cls}"></span>
              <span class="bar-title">${esc(task.title)}</span>
              <span class="bar-tag ${cls}">${daysSpan} Day${daysSpan === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>`;
      })
      .join("");

    const gridLines = grid
      ? `<div class="timeline-grid-lines">${grid.innerHTML}</div>`
      : "";

    body.innerHTML = gridLines + rows;
  }

  App.register("schedule", {
    bind(el) {
      const prev = el.querySelector("#sched-prev");
      const next = el.querySelector("#sched-next");
      if (prev) prev.addEventListener("click", () => { weekOffset -= 1; renderSchedule(el); });
      if (next) next.addEventListener("click", () => { weekOffset += 1; renderSchedule(el); });

      el.addEventListener("click", (e) => {
        const bar = e.target.closest(".timeline-bar");
        if (!bar) return;
        const name = bar.dataset.task;
        const span = bar.dataset.span;
        if (typeof toast === "function") toast(`Schedule: ${name} (${span})`, "info");
      });
    },
    render(el) {
      renderSchedule(el);
    },
  });
})();