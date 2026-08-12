(function () {
  let timerInterval = null;
  let timerSeconds = 1500;
  let totalSecondsMode = 1500;
  let isTimerRunning = false;

  function formatTime(secs) {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  function updateArc(el) {
    const arc = el.querySelector("#widget-timer-arc");
    if (!arc) return;
    const percentage = (timerSeconds / totalSecondsMode) * 100;
    arc.setAttribute("stroke-dasharray", `${percentage}, 100`);
  }

  function renderTimer(el) {
    const display = el.querySelector("#widget-timer-display");
    if (display) display.innerText = formatTime(timerSeconds);
    updateArc(el);
  }

  function toggleTimer(el) {
    const playIcon = el.querySelector("#widget-play-icon");
    if (isTimerRunning) {
      pauseTimer(el);
    } else {
      isTimerRunning = true;
      if (typeof toast === "function") toast("Focus Timer started", "info");
      if (playIcon) {
        playIcon.innerHTML = `<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clip-rule="evenodd"/>`;
      }
      timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
          timerSeconds--;
          renderTimer(el);
        } else {
          pauseTimer(el);
          if (typeof toast === "function") toast("🎉 Focus session complete! Take a break.", "success");
        }
      }, 1000);
    }
  }

  function pauseTimer(el) {
    isTimerRunning = false;
    clearInterval(timerInterval);
    const playIcon = el.querySelector("#widget-play-icon");
    if (playIcon) {
      playIcon.innerHTML = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>`;
    }
  }

  function resetTimer(el) {
    pauseTimer(el);
    timerSeconds = totalSecondsMode;
    renderTimer(el);
    if (typeof toast === "function") toast("Timer reset", "info");
  }

  function setMode(el, mode, btnEl) {
    pauseTimer(el);
    el.querySelectorAll(".timer-mode-btn").forEach((b) => b.classList.remove("active"));
    btnEl.classList.add("active");

    const statusLabel = el.querySelector("#widget-timer-status");
    if (mode === "focus") {
      totalSecondsMode = 1500;
      if (statusLabel) statusLabel.innerText = "DEEP WORK";
    } else {
      totalSecondsMode = 300;
      if (statusLabel) statusLabel.innerText = "REST BREAK";
    }
    timerSeconds = totalSecondsMode;
    renderTimer(el);
  }

  App.register("focus-timer", {
    bind(el) {
      const playBtn = el.querySelector("#widget-btn-play");
      const pauseBtn = el.querySelector("#widget-btn-pause");
      const resetBtn = el.querySelector("#btn-reset-timer");

      if (playBtn) playBtn.addEventListener("click", () => toggleTimer(el));
      if (pauseBtn) pauseBtn.addEventListener("click", () => pauseTimer(el));
      if (resetBtn) resetBtn.addEventListener("click", () => resetTimer(el));

      el.querySelectorAll(".timer-mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => setMode(el, btn.dataset.mode, btn));
      });

      renderTimer(el);
    },
  });
})();
