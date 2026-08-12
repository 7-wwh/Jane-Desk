(function () {
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

  function sessionDuration(sess, now) {
    if (sess.ended_at) return Math.max(0, sess.duration_seconds || 0);
    const start = parseISO(sess.started_at);
    return start ? Math.max(0, (now.getTime() - start.getTime()) / 1000) : 0;
  }

  function focusByDay(sessions) {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        seconds: 0,
      });
    }
    (sessions || []).forEach((sess) => {
      const start = parseISO(sess.started_at);
      if (!start) return;
      const key = start.toDateString();
      const day = days.find((x) => x.date.toDateString() === key);
      if (day) day.seconds += sessionDuration(sess, now);
    });
    const todayKey = days[days.length - 1].date.toDateString();
    const weekTotal = days.reduce((sum, d) => sum + d.seconds, 0);
    const today = days.find((x) => x.date.toDateString() === todayKey).seconds;
    return { days, weekTotal, today };
  }

  function barMarkup(day, maxSec, isToday) {
    const sec = Math.round(day.seconds);
    const pct = maxSec > 0 ? Math.max(3, (sec / maxSec) * 100) : 0;
    const cls = isToday
      ? "highlight"
      : sec > 0
        ? "active-dark"
        : "";
    const hours = (sec / 3600).toFixed(1);
    return `<div class="chart-col" data-day="${esc(
      day.date.toLocaleDateString(undefined, { weekday: "long" })
    )}" data-hours="${hours}">
      <div class="bar-track"><div class="bar-fill ${cls}" style="height: ${pct}%;"></div></div>
      <span class="day-label${isToday ? " today" : ""}">${DAY_LETTERS[day.date.getDay()]}</span>
    </div>`;
  }

  function renderAnalytics(el) {
    if (!state.stats && !state.work) return;
    const sessions = (state.stats && state.stats.sessions) || [];
    const { days, weekTotal, today } = focusByDay(sessions);
    const maxSec = Math.max(...days.map((d) => d.seconds), 1);

    const number = el.querySelector(".analytics-number");
    if (number) number.textContent = fmtDur(weekTotal);

    const badge = el.querySelector(".today-badge");
    if (badge) badge.textContent = `${fmtDur(today)} today`;

    const bars = el.querySelector(".chart-bars");
    if (bars) {
      bars.innerHTML = days
        .map((d, i) => barMarkup(d, maxSec, i === days.length - 1))
        .join("");
    }
  }

  App.register("analytics", {
    bind(el) {
      const breakdownBtn = el.querySelector("#btn-analytics-breakdown");
      if (breakdownBtn) {
        breakdownBtn.addEventListener("click", () => {
          if (typeof toast === "function") {
            toast("Weekly output is live focus time from your work sessions", "info");
          }
        });
      }

      el.addEventListener("click", (e) => {
        const col = e.target.closest(".chart-col");
        if (!col) return;
        const day = col.dataset.day;
        const hours = col.dataset.hours;
        if (typeof toast === "function") {
          toast(`${day}: ${hours}h focus logged`, "info");
        }
      });
    },
    render(el) {
      renderAnalytics(el);
    },
  });
})();