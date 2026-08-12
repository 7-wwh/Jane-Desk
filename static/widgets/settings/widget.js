function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem("checkboxSettings") || "{}")) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem("checkboxSettings", JSON.stringify(state.settings));
  } catch (_) {}
}

function renderSettings() {
  const s = state.settings;
  $$("#set-clock .seg-btn").forEach((b) => b.classList.toggle("active", (b.dataset.value === "24") === s.clock24));
  $$("#set-precision .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === s.precision));
  const name = $("#set-user-name"); if (name) name.value = s.user_name || "Alex";
  const weekly = $("#set-weekly-hours"); if (weekly) weekly.value = s.weekly_focus_hours ?? 40;
  const daily = $("#set-daily-target"); if (daily) daily.value = s.daily_task_target ?? 8;
  $("#set-tz").textContent = [tzName(), tzOffsetLabel()].filter(Boolean).join(" · ");
  $("#set-server").textContent = location.host || "local";
}

function bindSettings() {
  $("#set-clock").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.settings.clock24 = btn.dataset.value === "24";
    saveSettingsToServer({ clock24: state.settings.clock24 }, true);
    renderSettings();
    updateClock();
  });

  $("#set-precision").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.settings.precision = btn.dataset.value;
    saveSettingsToServer({ precision: state.settings.precision }, true);
    renderSettings();
    syncTopbarTimer();
  });

  const name = $("#set-user-name");
  if (name) {
    name.addEventListener("change", (e) => {
      const v = e.target.value.trim() || "Alex";
      saveSettingsToServer({ user_name: v }, true);
      renderSettings();
      updateGreeting();
    });
  }
  const weekly = $("#set-weekly-hours");
  if (weekly) {
    weekly.addEventListener("change", (e) => {
      const v = Math.min(168, Math.max(1, parseInt(e.target.value, 10) || 40));
      saveSettingsToServer({ weekly_focus_hours: v }, true);
      renderSettings();
    });
  }
  const daily = $("#set-daily-target");
  if (daily) {
    daily.addEventListener("change", (e) => {
      const v = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 8));
      saveSettingsToServer({ daily_task_target: v }, true);
      renderSettings();
    });
  }
}

App.register("settings", { bind: bindSettings });