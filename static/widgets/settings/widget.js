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
  $("#set-tz").textContent = [tzName(), tzOffsetLabel()].filter(Boolean).join(" · ");
  $("#set-server").textContent = location.host || "local";
}

function bindSettings() {
  $("#set-clock").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.settings.clock24 = btn.dataset.value === "24";
    saveSettings();
    renderSettings();
    updateClock();
  });

  $("#set-precision").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.settings.precision = btn.dataset.value;
    saveSettings();
    renderSettings();
    syncTopbarTimer();
  });
}

App.register("settings", { bind: bindSettings });