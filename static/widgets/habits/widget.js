(function () {
  function updateScore(el) {
    const s = state.stats;
    const badge = el.querySelector("#habits-score");
    if (!badge || !s) return;
    const total = s.done_tasks + s.open_tasks;
    const pct = total ? Math.round((s.done_tasks / total) * 100) : 0;
    badge.textContent = pct + "%";
  }

  function toggleHabit(item) {
    const isDone = item.classList.contains("done");
    const pill = item.querySelector(".habit-status-pill");

    if (isDone) {
      item.classList.remove("done");
      if (pill) pill.innerText = "Pending";
    } else {
      item.classList.add("done");
      if (pill) pill.innerText = "✓ Done";
      if (typeof toast === "function") toast("Habit completed!", "success");
    }
  }

  App.register("habits", {
    bind(el) {
      el.querySelectorAll(".habit-item").forEach((item) => {
        item.addEventListener("click", () => toggleHabit(item));
      });
      updateScore(el);
    },
    render(el) {
      updateScore(el);
    },
  });
})();