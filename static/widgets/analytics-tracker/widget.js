(function () {
  const defaultChartData = [
    { heightPct: 30, highlight: false, value: "0.30%" },
    { heightPct: 35, highlight: false, value: "0.35%" },
    { heightPct: 38, highlight: false, value: "0.38%" },
    { heightPct: 50, highlight: false, value: "0.50%" },
    { heightPct: 65, highlight: false, value: "0.65%" },
    { heightPct: 92, highlight: true, value: "3.62%" },
    { heightPct: 98, highlight: false, value: "0.98%" },
    { heightPct: 65, highlight: false, value: "0.65%" },
    { heightPct: 45, highlight: false, value: "0.45%" },
    { heightPct: 38, highlight: false, value: "0.38%" },
    { heightPct: 35, highlight: false, value: "0.35%" },
    { heightPct: 32, highlight: false, value: "0.32%" },
    { heightPct: 30, highlight: false, value: "0.30%" },
    { heightPct: 32, highlight: false, value: "0.32%" },
    { heightPct: 35, highlight: false, value: "0.35%" },
    { heightPct: 38, highlight: false, value: "0.38%" },
    { heightPct: 36, highlight: false, value: "0.36%" },
    { heightPct: 52, highlight: true, value: "0.52%" },
    { heightPct: 88, highlight: false, value: "0.88%" },
  ];

  let currentScale = 1;

  function toast(el, text) {
    const t = el.querySelector(".at-toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  function renderBars(el, data, sticky) {
    const container = el.querySelector("#bars-container");
    const chartWrap = el.querySelector("#chart-wrapper");
    const tooltip = el.querySelector("#chart-tooltip");
    const tooltipText = el.querySelector("#tooltip-text");
    const tooltipDot = el.querySelector("#tooltip-dot");
    if (!container) return;

    container.innerHTML = "";
    data.forEach((bar) => {
      const wrap = document.createElement("div");
      wrap.className = "at-bar";
      const fill = document.createElement("div");
      fill.className = "at-bar-fill " + (bar.highlight ? "highlight" : "dark");
      fill.style.height = Math.min(100, Math.max(10, bar.heightPct * currentScale)) + "%";
      wrap.appendChild(fill);
      container.appendChild(wrap);

      wrap.addEventListener("mouseenter", () => {
        if (!tooltip || !chartWrap || !sticky) return;
        tooltipText.textContent = bar.value;
        tooltipDot.classList.toggle("highlight", bar.highlight);
        const barRect = fill.getBoundingClientRect();
        const wrapRect = chartWrap.getBoundingClientRect();
        tooltip.style.left = (barRect.left - wrapRect.left) + (barRect.width / 2) + "px";
        tooltip.style.top = (barRect.top - wrapRect.top) + "px";
        tooltip.classList.remove("hidden");
      });
      wrap.addEventListener("mouseleave", () => {
        if (tooltip) tooltip.classList.add("hidden");
      });
    });
  }

  App.register("analytics-tracker", {
    bind(el) {
      const sticky = document.querySelector(".app") !== null;
      renderBars(el, defaultChartData, sticky);
      el.querySelectorAll(".at-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          el.querySelectorAll(".at-tab").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          toast(el, "Switched to " + btn.dataset.tab);
          const modified = defaultChartData.map((d) => ({
            ...d,
            heightPct: Math.min(100, Math.max(15, d.heightPct + (Math.floor(Math.random() * 16) - 8))),
          }));
          renderBars(el, modified, sticky);
        });
      });
      window.addEventListener("resize", () => {
        const t = el.querySelector("#chart-tooltip");
        if (t) t.classList.add("hidden");
      });
    },
    render(el) {
      renderBars(el, defaultChartData, true);
    },
  });
})();