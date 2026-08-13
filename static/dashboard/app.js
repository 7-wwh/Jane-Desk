  /* =====================================================================
   * Check Box — New Dashboard · wired to the FastAPI backend
   * Fetches /api/work, /api/dashboard, /api/projects, /api/sessions/active
   * and re-renders the hero, task checklist, projects, stats and modal.
   * ===================================================================== */
  (function () {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];

    async function fetchJSON(url, options) {
      const res = await fetch(url, options);
      if (!res.ok) {
        let msg = res.statusText || "Request failed";
        try {
          const body = await res.json();
          if (body.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        } catch (_) {}
        throw new Error(msg);
      }
      if (res.status === 204) return null;
      return res.json();
    }
    window.fetchJSON = fetchJSON;

    const state = { work: null, dashboard: null, projects: [], activeSession: null, currentTaskId: null, daily: null };
    let currentFilter = "all";

    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function todayISO() {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function fmtDate(iso) {
      if (!iso) return "";
      const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
      return isNaN(d) ? "" : d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    function fmtHrs(secs) {
      if (!secs) return "0.0h";
      return (secs / 3600).toFixed(1) + "h";
    }
    function prioLabel(p) {
      return { high: "P0", medium: "P1", low: "P2" }[p] || "P1";
    }

    async function loadData() {
      try {
        const [work, dashboard, projects, activeSession, daily] = await Promise.all([
          fetchJSON("/api/work"),
          fetchJSON("/api/dashboard"),
          fetchJSON("/api/projects"),
          fetchJSON("/api/sessions/active"),
          fetchJSON("/api/daily-stats?days=2"),
        ]);
        state.work = work;
        state.dashboard = dashboard;
        state.projects = projects;
        state.activeSession = activeSession;
        state.daily = daily;
        renderAll();
      } catch (err) {
        if (typeof showToast === "function") showToast("Failed to load data: " + err.message);
      }
    }

    function renderAll() {
      renderGreeting();
      renderHeaderStats();
      renderTaskHoursPills();
      renderHero();
      renderTasks();
      renderProjectsAccordion();
      renderCategorySelect();
      renderHabitsPct();
    }

    function renderGreeting() {
      const d = $("#current-date-str");
      if (d) d.innerText = fmtDate((state.work && state.work.today) || todayISO());
    }

    function countDoneTotal() {
      const ap = (state.work && state.work.active_projects) || [];
      let done = 0, total = 0;
      ap.forEach((p) => { done += p.done || 0; total += p.total || 0; });
      return { done, total };
    }

    function allTasks() {
      const map = new Map();
      const add = (t) => { if (t && t.id != null && !map.has(t.id)) map.set(t.id, t); };
      if (state.work && state.work.current) add(state.work.current);
      ((state.work && state.work.upcoming) || []).forEach(add);
      ((state.work && state.work.active_projects) || []).forEach((p) => (p.open_tasks || []).forEach(add));
      return [...map.values()];
    }

    let liveStatsTimer = null;

    function isoShift(iso, days) {
      const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }

    function dailyStat(day) {
      const list = state.daily || [];
      return list.find((r) => r.date === day) || null;
    }

    // Styles the trend pill + corner arrow badge. direction: up|down|flat.
    // good = emerald (positive outcome), bad = rose. Flat = neutral, badge hidden.
    function setTrend(pillId, arrowId, text, direction, good, note) {
      const pill = document.getElementById(pillId);
      if (!pill) return;
      if (!text) {
        pill.classList.add("hidden");
        const a = document.getElementById(arrowId);
        if (a) a.classList.add("hidden");
        return;
      }
      pill.classList.remove("hidden");
      pill.classList.remove("text-emerald-700", "bg-emerald-100/80", "text-rose-700", "bg-rose-100/80", "text-stone-500", "bg-stone-200/70");
      const cls = direction === "flat"
        ? ["text-stone-500", "bg-stone-200/70"]
        : (good ? ["text-emerald-700", "bg-emerald-100/80"] : ["text-rose-700", "bg-rose-100/80"]);
      pill.classList.add(...cls);
      pill.innerText = text;

      const arrow = document.getElementById(arrowId);
      if (!arrow) return;
      if (direction === "flat") {
        arrow.classList.add("hidden");
        return;
      }
      arrow.classList.remove("hidden");
      arrow.classList.remove("bg-emerald-500", "bg-rose-500");
      arrow.classList.add(good ? "bg-emerald-500" : "bg-rose-500");
      const svg = arrow.querySelector(".trend-arrow");
      if (svg) {
        svg.innerHTML = direction === "up"
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"></path>'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>';
      }
      if (note) arrow.title = note;
    }

    function renderHeaderStats() {
      // ---- Today's Tasks: open tasks due today (value), vs yesterday (trend) ----
      let dueToday = 0;
      const today = (state.work && state.work.today) || todayISO();
      const yesterday = isoShift(today, -1);
      const tasks = (state.dashboard && state.dashboard.tasks_by_project) || {};
      Object.values(tasks).forEach((arr) =>
        arr.forEach((t) => { if (t.status !== "done" && t.due_date === today) dueToday++; })
      );
      const dueEl = $("#stat-due-today");
      if (dueEl) dueEl.innerText = String(dueToday);

      const dsToday = dailyStat(today);
      const dsYesterday = dailyStat(yesterday);
      if (dsToday) {
        const dueY = (dsYesterday && dsYesterday.tasks_due) || 0;
        const delta = dueToday - dueY;
        if (delta === 0) {
          setTrend("trend-pill-today", "trend-arrow-today", "±0%", "flat", true, "Same as yesterday");
        } else {
          const dir = delta > 0 ? "up" : "down";
          const text = dueY > 0
            ? (delta > 0 ? "+" : "-") + Math.round((Math.abs(delta) / dueY) * 100) + "%"
            : (delta > 0 ? "+" : "-") + Math.abs(delta);
          setTrend("trend-pill-today", "trend-arrow-today", text, dir, dir === "up", (delta > 0 ? "+" : "") + delta + " vs yesterday");
        }
      }

      // ---- Projects: active count (value), N on track (sub), fewer is better (trend) ----
      const activeProjs = (state.work && state.work.active_projects) || [];
      const projEl = $("#stat-projects");
      if (projEl) projEl.innerText = String(activeProjs.length);

      const activeY = dsYesterday && dsYesterday.active_projects != null ? dsYesterday.active_projects : null;
      if (activeY != null) {
        const delta = activeProjs.length - activeY;
        if (delta === 0) {
          setTrend("trend-pill-projects", "trend-arrow-projects", "±0", "flat", true, "Same as yesterday");
        } else {
          const dir = delta > 0 ? "up" : "down";
          setTrend(
            "trend-pill-projects", "trend-arrow-projects",
            (delta > 0 ? "+" : "") + delta, dir, delta < 0,
            delta < 0 ? "Fewer active projects — better focus" : "More active projects — try to focus"
          );
        }
      }

      // ---- Focus Score: % of waking hours worked today, vs yesterday ----
      renderFocusMetric();

      // ---- Deep work pill (existing) ----
      renderDeepWork();
      startLiveStats();
    }

    function renderFocusMetric() {
      const today = (state.work && state.work.today) || todayISO();
      const yesterday = isoShift(today, -1);
      const wake = Math.max(1, (typeof window.getSetting === "function" ? Number(window.getSetting("waking_hours")) || 16 : 16));
      const wakeSecs = wake * 3600;
      const dsToday = dailyStat(today);
      const dsYesterday = dailyStat(yesterday);
      let secsToday = (dsToday && dsToday.work_seconds) || 0;
      const secsYesterday = (dsYesterday && dsYesterday.work_seconds) || 0;
      if (state.activeSession && state.activeSession.session) {
        const st = new Date(state.activeSession.session.started_at);
        secsToday += Math.max(0, (Date.now() - st.getTime()) / 1000);
      }
      const pctToday = Math.min(100, Math.round((secsToday / wakeSecs) * 100));
      const pctYesterday = Math.min(100, Math.round((secsYesterday / wakeSecs) * 100));

      const focusEl = $("#stat-focus");
      if (focusEl) focusEl.innerText = pctToday + "%";
      const subEl = $("#stat-focus-sub");
      if (subEl) subEl.innerText = fmtHrs(secsToday) + " deep work";

      const diff = pctToday - pctYesterday;
      if (diff === 0) {
        setTrend("trend-pill-focus", "trend-arrow-focus", "±0%", "flat", true, "Same as yesterday");
      } else {
        setTrend(
          "trend-pill-focus", "trend-arrow-focus",
          (diff > 0 ? "+" : "") + diff + "%", diff > 0 ? "up" : "down", diff > 0,
          (diff > 0 ? "+" : "") + diff + "% vs yesterday"
        );
      }
    }

    function renderDeepWork() {
      let secs = 0;
      if (state.activeSession && state.activeSession.session) {
        const st = new Date(state.activeSession.session.started_at);
        secs = Math.max(0, (Date.now() - st.getTime()) / 1000);
      } else if (state.work && state.work.current) {
        secs = state.work.current.total_seconds || 0;
      }
      const el = $("#pill-deepwork");
      if (el) el.innerText = fmtHrs(secs);
    }

    function startLiveStats() {
      if (state.activeSession && state.activeSession.session) {
        if (liveStatsTimer) return;
        liveStatsTimer = setInterval(() => {
          renderDeepWork();
          renderFocusMetric();
        }, 1000);
      } else if (liveStatsTimer) {
        clearInterval(liveStatsTimer);
        liveStatsTimer = null;
      }
    }

    function renderHero() {
      const cur = (state.work && state.work.current) || null;
      state.currentTaskId = cur ? cur.id : null;
      const titleEl = $("#hero-task-title");
      if (!cur) {
        if (titleEl) titleEl.innerText = "No current task — you're all caught up!";
        const p = $(".hero-priority"); if (p) p.innerText = "—";
        const tag = $(".hero-tag"); if (tag) tag.innerText = "#idle";
        const desc = $(".hero-desc"); if (desc) desc.innerText = "Pick a task from the list to start a focus session.";
        const est = $(".hero-est"); if (est) est.innerText = "0h tracked";
        return;
      }
      if (titleEl) titleEl.innerText = cur.title;
      const prio = $(".hero-priority"); if (prio) prio.innerText = "Priority " + prioLabel(cur.priority);
      const tag = $(".hero-tag"); if (tag) tag.innerText = "#" + esc(cur.project_title || "task");
      const desc = $(".hero-desc");
      if (desc) desc.innerText = (cur.project_title ? "Project: " + cur.project_title : "No project") + (cur.due_date ? " · Due " + cur.due_date : "");
      const est = $(".hero-est"); if (est) est.innerText = fmtHrs(cur.total_seconds || 0) + " tracked";
    }

    function renderTasks() {
      const list = $("#task-list");
      if (!list) return;
      const tasks = allTasks();
      list.innerHTML = "";
      if (!tasks.length) {
        list.innerHTML = '<div class="text-xs text-stone-500 p-1.5">No open tasks yet.</div>';
      }

      // dynamic category filter buttons
      const ft = $(".task-filters");
      if (ft) {
        const cats = [...new Set(tasks.map((t) => t.project_title || "task").filter(Boolean))];
        ft.innerHTML = `<button class="task-filter-btn px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-900 text-white">All</button>` +
          cats.map((c) => `<button class="task-filter-btn px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200 text-stone-700 hover:bg-stone-300">#${esc(c)}</button>`).join("");
        $$(".task-filter-btn", ft).forEach((btn) => {
          btn.dataset.cat = btn.innerText === "All" ? "all" : btn.innerText.slice(1);
          if (currentFilter !== "all" && btn.dataset.cat === currentFilter) {
            btn.className = "task-filter-btn px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-900 text-white";
          }
          btn.addEventListener("click", () => filterTasks(btn.dataset.cat, btn));
        });
      }

      tasks.forEach((t) => {
        const done = t.status === "done";
        const time = t.due_date || "";
        const item = document.createElement("div");
        item.className = "task-item group flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors";
        item.dataset.id = String(t.id);
        item.dataset.category = t.project_title || "task";
        item.dataset.status = t.status;
        item.onclick = () => toggleTask(item);
        item.innerHTML =
          '<div class="flex items-center gap-2.5">' +
            '<div class="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 group-hover:text-white">' +
              '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="' +
              (done ? "M9 12l2 2 4-4" : "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707") +
              '"/></svg></div>' +
            '<div>' +
              '<div class="text-xs ' + (done ? "font-medium line-through text-stone-400" : "font-semibold text-stone-100") + ' task-text">' + esc(t.title) + "</div>" +
              '<div class="text-[9px] ' + (done ? "text-stone-500" : "text-stone-400") + '">' + (time ? time + " · " : "") + "#" + esc(t.project_title || "task") + "</div>" +
            "</div>" +
          "</div>" +
          '<div class="task-check w-4 h-4 rounded-full ' +
            (done ? "bg-[#F5C200] flex items-center justify-center text-stone-900" : "bg-stone-800 border border-stone-600") +
            '">' + (done ? '<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : "") + "</div>";
        if (currentFilter !== "all" && item.dataset.category !== currentFilter) item.style.display = "none";
        list.appendChild(item);
      });
      updateTaskProgressCounters();
    }

    function renderProjectsAccordion() {
      const box = $("#acc-projects");
      if (!box) return;
      const ap = (state.work && state.work.active_projects) || [];
      box.innerHTML = "";
      if (!ap.length) {
        box.innerHTML = '<div class="text-xs text-stone-500 p-1">No active projects.</div>';
        return;
      }
      ap.forEach((p) => {
        const pct = p.total ? Math.round(((p.done || 0) / p.total) * 100) : 0;
        const div = document.createElement("div");
        div.className = "p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-sm";
        div.innerHTML =
          '<div class="flex items-center justify-between text-xs font-bold text-stone-900 mb-1">' +
            "<span>" + esc(p.project.title) + "</span>" +
            '<span class="' + (pct >= 100 ? "text-green-600" : "text-amber-600") + '">' + pct + "%</span>" +
          "</div>" +
          '<div class="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">' +
            '<div class="h-full ' + (pct >= 100 ? "bg-green-500" : "bg-[#F5C200]") + ' rounded-full" style="width:' + pct + '%"></div>' +
          "</div>";
        box.appendChild(div);
      });
    }

    function renderCategorySelect() {
      const sel = $("#input-task-category");
      if (!sel) return;
      const opts = (state.projects || [])
        .map((p) => '<option value="' + p.id + '">' + esc(p.title) + "</option>")
        .join("");
      sel.innerHTML = opts || '<option value="">No projects yet</option>';
    }

    function renderHabitsPct() {
      const badges = $$("#acc-habits .habit-badge");
      const done = badges.filter((b) => b.innerText.trim().startsWith("✓")).length;
      const el = $("#pill-habits-pct");
      if (el) el.innerText = (badges.length ? Math.round((done / badges.length) * 100) : 0) + "%";
    }

    // Show total hours worked on each active task in the summary pills row,
    // color-coded by relative workload (red = overworked, green = underworked).
    function renderTaskHoursPills() {
      const box = $("#summary-pills");
      if (!box) return;
      const tasks = allTasks();
      if (!tasks.length) {
        box.innerHTML = '<div class="flex-1 min-w-[90px] bg-stone-200/70 border border-stone-300 text-stone-700 py-2 px-2 rounded-full flex items-center justify-between text-[10px] font-semibold"><span>Active Tasks</span><span class="bg-stone-300/80 px-1.5 py-0.5 rounded-full text-[9px] font-bold">0h</span></div>';
        return;
      }
      const hours = tasks.map((t) => (t.total_seconds || 0) / 3600);
      const maxH = Math.max.apply(null, hours) || 0;

      // Theme-aligned palette: warm stone neutrals + brand amber/yellow.
      // Depth of the brand color signals intensity (darkest = overworked).
      const palette = {
        none: { pill: "bg-stone-100/80 border border-stone-200 text-stone-500",       badge: "bg-stone-300 text-stone-600", note: "not started" },
        low:  { pill: "bg-amber-100/60 border border-amber-200 text-stone-700",        badge: "bg-amber-300 text-stone-700", note: "light effort" },
        mid:  { pill: "bg-amber-200/70 border border-amber-300 text-stone-800",        badge: "bg-amber-400 text-stone-900", note: "balanced" },
        over: { pill: "bg-stone-900    border border-stone-800 text-white",            badge: "bg-[#F5C200] text-stone-900", note: "overworked" },
      };

      // Width proportional to time spent — busier tasks get longer pills.
      function growFor(hrs) {
        if (maxH <= 0) return 1;
        return Math.max(hrs / maxH, 0.35);
      }

      function levelFor(hrs) {
        if (hrs <= 0) return "none";
        const ratio = maxH > 0 ? hrs / maxH : 0;
        if (ratio > 0.7) return "over";   // >= 70% of the busiest task
        if (ratio > 0.35) return "mid";   // moderate relative effort
        return "low";                     // light effort compared to peers
      }

      function pillHTML(t, hrs) {
        const lvl = palette[levelFor(hrs)];
        return '<div class="task-hours-pill ' + lvl.pill + ' py-2 px-2 rounded-full flex items-center justify-between text-[10px] font-semibold shadow-sm" style="flex:' + growFor(hrs).toFixed(2) + '" title="' +
          esc(t.title) + ' — ' + hrs.toFixed(1) + 'h (' + lvl.note + ')">' +
          '<span class="w-1.5 h-1.5 rounded-full ' + lvl.badge + ' flex-shrink-0"></span>' +
          '<span class="truncate mx-1.5">' + esc(t.title) + '</span>' +
          '<span class="' + lvl.badge + ' px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">' + hrs.toFixed(1) + 'h</span>' +
        '</div>';
      }

      // Always exactly 2 rows: split tasks evenly into two full-width flex rows,
      // each pill keeping its duration-proportional length.
      const half = Math.ceil(tasks.length / 2);
      const rows = [tasks.slice(0, half), tasks.slice(half)];

      box.innerHTML = rows.map((rowTasks) =>
        '<div class="flex items-center gap-1.5 w-full">' +
        rowTasks.map((t) => pillHTML(t, (t.total_seconds || 0) / 3600)).join("") +
        '</div>'
      ).join("");

    }

    function updateTaskProgressCounters() {
      const { done, total } = countDoneTotal();
      const counter = $("#task-counter");
      if (counter) counter.innerText = done + "/" + total;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const p = $("#pill-completed-pct");
      if (p) p.innerText = pct + "%";
      const todo = $("#pill-todo-count");
      if (todo) todo.innerText = String(total - done);
    }

    function toggleTask(element) {
      const id = element.dataset.id;
      const toDone = element.dataset.status !== "done";
      fetchJSON("/api/tasks/" + id + "/status?status=" + (toDone ? "done" : "wanted"), { method: "PATCH" })
        .then(loadData)
        .catch((e) => { if (typeof showToast === "function") showToast("Error: " + e.message); });
    }

    function filterTasks(cat, btnEl) {
      currentFilter = cat;
      $$(".task-filter-btn").forEach((b) => {
        b.className = "task-filter-btn px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200 text-stone-700 hover:bg-stone-300";
      });
      btnEl.className = "task-filter-btn px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-900 text-white";
      $$("#task-list .task-item").forEach((item) => {
        item.style.display = cat === "all" || item.dataset.category === cat ? "flex" : "none";
      });
    }

    function completeHeroTask() {
      if (!state.currentTaskId) {
        if (typeof showToast === "function") showToast("No current task to complete");
        return;
      }
      fetchJSON("/api/tasks/" + state.currentTaskId + "/status?status=done", { method: "PATCH" })
        .then(() => {
          if (typeof showToast === "function") showToast("🎉 Focus task completed! Great job.");
          return loadData();
        })
        .catch((e) => { if (typeof showToast === "function") showToast("Error: " + e.message); });
    }

    function handleAddTaskSubmit(e) {
      if (e && e.preventDefault) e.preventDefault();
      const title = $("#input-task-title");
      const pidEl = $("#input-task-category");
      const titleVal = title ? title.value.trim() : "";
      const pid = pidEl ? pidEl.value : "";
      if (!titleVal) { if (typeof showToast === "function") showToast("Enter a task title"); return; }
      if (!pid) { if (typeof showToast === "function") showToast("Select a project"); return; }
      fetchJSON("/api/projects/" + pid + "/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleVal, status: "wanted", priority: "medium" }),
      })
        .then(() => {
          if (typeof closeNewTaskModal === "function") closeNewTaskModal();
          if (title) title.value = "";
          if (typeof showToast === "function") showToast('Added task: "' + titleVal + '"');
          return loadData();
        })
        .catch((err) => { if (typeof showToast === "function") showToast("Error: " + err.message); });
    }

    // Override the prototype's hardcoded handlers with API-backed versions.
    window.completeHeroTask = completeHeroTask;
    window.toggleTask = toggleTask;
    window.filterTasks = filterTasks;
    window.updateTaskProgressCounters = updateTaskProgressCounters;
    window.handleAddTaskSubmit = handleAddTaskSubmit;

    loadData();
    window.loadData = loadData;
  })();

  /* =====================================================================
   * Tasks manager — All Tasks view (active / recently done / archived)
   * Lists every task (GET /api/tasks) and lets the user edit any field,
   * move it to another project, and manage tracked sessions.
   * ===================================================================== */
  (function () {
    const T = { tasks: [], projects: [], all: [], filter: "all", q: "", projectId: null, archiveDays: 30, editing: null, sessions: [] };

    const $t = (s) => document.querySelector(s);
    const $$t = (s) => [...document.querySelectorAll(s)];
    const attr = (el, k, v) => el.setAttribute(k, v);

    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function fmtHrs(secs) {
      if (!secs) return "0.0h";
      return (secs / 3600).toFixed(1) + "h";
    }
    function isoDate(v, fallback) { return (v || fallback || ""); }
    function prioBadge(p) {
      const map = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-800", low: "bg-stone-200 text-stone-600" };
      return '<span class="text-[9px] font-bold px-2 py-0.5 rounded-full ' + (map[p] || map.medium) + '">' + esc(p) + '</span>';
    }
    function statusBadge(s) {
      const map = {
        wanted: "bg-stone-200 text-stone-600",
        planned: "bg-amber-100 text-amber-800",
        in_progress: "bg-[#F5C200] text-stone-900",
        done: "bg-emerald-100 text-emerald-700",
      };
      return '<span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full ' + (map[s] || map.wanted) + '">' + esc(s.replace(/_/g, " ")) + '</span>';
    }

    function taskBucket(t) {
      if (t.status === "done") {
        const doneAt = t.done_at ? new Date(t.done_at) : null;
        const cutoff = Date.now() - T.archiveDays * 86400000;
        if (!doneAt || isNaN(doneAt)) {
          // No done_at recorded (pre-migration task): fall back to updated_at.
          const up = new Date(String(t.updated_at || "").replace(" ", "T"));
          return (!isNaN(up) && up.getTime() <= cutoff) ? "archived" : "recent";
        }
        return doneAt.getTime() <= cutoff ? "archived" : "recent";
      }
      return "open";
    }

    function bucketLabel(b) {
      return { open: "Open", recent: "Recently Done", archived: "Archived" }[b] || b;
    }
    function bucketIcon(b) {
      return { open: "🟡", recent: "🟢", archived: "⚪" }[b] || "";
    }

    function matchesFilters(t) {
      if (T.filter !== "all" && taskBucket(t) !== T.filter) return false;
      if (T.projectId && t.project_id !== T.projectId) return false;
      if (T.q && !(t.title || "").toLowerCase().includes(T.q.toLowerCase())) return false;
      return true;
    }

    function populateProjectSelect() {
      const sel = $t("#edit-task-project");
      if (!sel) return;
      sel.innerHTML = T.projects.map((p) =>
        '<option value="' + p.id + '">' + esc(p.title) + '</option>'
      ).join("");
      if (T.editing) sel.value = String(T.editing.project_id);
    }

    function projectRootFor(projectId) {
      const p = T.projects.find((x) => x.id === Number(projectId));
      if (!p) return null;
      return (p.branch_path || p.title || "").trim().replace(/\/+$/, "");
    }

    function refreshBranchOptions() {
      const projSel = $t("#edit-task-project");
      const sel = $t("#edit-task-branch");
      if (!sel) return;
      const root = projectRootFor(projSel ? projSel.value : "");
      const cur = T.editing ? (T.editing.branch_path || "").trim() : "";
      const seen = new Set();
      T.tasks.forEach((tk) => { if (tk.branch_path) seen.add(tk.branch_path.trim()); });
      T.projects.forEach((p) => { if (p.branch_path) seen.add(p.branch_path.trim().replace(/\/+$/, "")); });
      if (root) seen.add(root);

      const under = (b) => Boolean(b && (!root || b === root || b.startsWith(root + "/")));

      let html = '<option value="">No branch</option>';
      Array.from(seen).sort().forEach((b) => {
        if (under(b)) html += '<option value="' + esc(b) + '">' + esc(b) + '</option>';
      });
      html += '<option value="__new__">Add new branch…</option>';
      sel.innerHTML = html;

      // Always keep the task's current branch selectable so the value can't silently
      // fall back to empty (which used to be sent as null and 500 on the server).
      let wanted = cur;
      if (wanted && !Array.from(sel.options).some((o) => o.value === wanted)) {
        const opt = document.createElement("option");
        opt.value = wanted;
        opt.textContent = wanted;
        const addNew = sel.querySelector('option[value="__new__"]');
        sel.insertBefore(opt, addNew);
      }
      sel.value = wanted || "";
      taskBranchDropdownChanged();
    }

    function taskBranchDropdownChanged() {
      const sel = $t("#edit-task-branch");
      const wrap = $t("#edit-new-branch-wrap");
      if (!sel || !wrap) return;
      const isNew = sel.value === "__new__";
      wrap.classList.toggle("hidden", !isNew);
      if (isNew) {
        const inp = $t("#edit-task-branch-new");
        if (inp) inp.focus();
      }
    }

    function renderTasksList() {
      const listEl = $t("#tasks-list");
      const pillEl = $t("#tasks-summary-pill");
      if (!listEl) return;
      const visible = T.tasks.filter(matchesFilters);

      const open = T.tasks.filter((t) => taskBucket(t) === "open").length;
      const recent = T.tasks.filter((t) => taskBucket(t) === "recent").length;
      const archived = T.tasks.filter((t) => taskBucket(t) === "archived").length;
      if (pillEl) pillEl.innerHTML = `<span>${open} open</span><span class="w-1.5 h-1.5 rounded-full bg-[#F5C200]"></span><span>${recent} recent</span><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>${archived} archived</span>`;

      if (!visible.length) {
        listEl.innerHTML = '<div class="bg-stone-100/90 rounded-2xl border border-stone-200/80 p-5 text-center text-xs font-semibold text-stone-500">No tasks match this filter.</div>';
        return;
      }

      // Group by bucket
      const groups = {};
      visible.forEach((t) => { const b = taskBucket(t); (groups[b] = groups[b] || []).push(t); });

      listEl.innerHTML = ["open", "recent", "archived"].map((bucket) => {
        const items = (groups[bucket] || []).sort((a, b) => (a.status === "done") - (b.status === "done") || (b.updated_at || "").localeCompare(a.updated_at || ""));
        if (!items.length) return "";
        return '<div class="mb-5">' +
          '<div class="flex items-center gap-2 mb-2.5 px-1">' +
          '<span class="text-xs font-black text-stone-800">' + bucketIcon(bucket) + ' ' + bucketLabel(bucket) + '</span>' +
          '<span class="text-[10px] font-bold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">' + items.length + '</span>' +
          '</div>' +
          '<div class="space-y-2">' + items.map(taskRowHTML).join("") + '</div>' +
          '</div>';
      }).join("");
    }

    function taskRowHTML(t) {
      const proj = T.projects.find((p) => p.id === t.project_id);
      const branch = t.branch_path || (proj ? proj.branch_path : "");
      return '<div onclick="openEditTask(' + t.id + ')" class="task-row task-row-' + t.id + ' bg-white rounded-2xl border border-stone-200/80 shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group">' +
        '<div class="flex-1 min-w-[180px]">' +
        '<div class="flex items-center gap-2">' +
        '<span class="text-xs font-bold text-stone-900 task-title truncate">' + esc(t.title) + '</span>' +
        statusBadge(t.status) +
        '</div>' +
        '<div class="text-[10px] text-stone-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">' +
        '<span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>' + esc(proj ? proj.title : "Unknown project") + '</span>' +
        (branch ? '<span class="inline-flex items-center gap-1 opacity-70">' + esc(branch) + '</span>' : '') +
        '</div>' +
        '</div>' +
        '<div class="flex items-center gap-4 text-[11px] font-semibold text-stone-600">' +
        '<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-[#F5C200]"></span>' + fmtHrs(t.total_seconds) + '</span>' +
        '<span title="Due date">📅 ' + esc(isoDate(t.due_date, "—")) + '</span>' +
        prioBadge(t.priority) +
        '</div>' +
        '</div>';
    }

    async function loadTasksPage() {
      try {
        const [tasks, projects, settings] = await Promise.all([
          window.fetchJSON ? window.fetchJSON("/api/tasks") : null,
          window.fetchJSON ? window.fetchJSON("/api/projects") : null,
          window.fetchJSON ? window.fetchJSON("/api/settings") : null,
        ]);
        if (!tasks) return; // helpers not exposed; shouldn't happen
        T.tasks = tasks;
        T.projects = projects || [];
        if (settings && settings.settings && settings.settings.archive_days != null) {
          T.archiveDays = Math.max(1, Number(settings.settings.archive_days) || 30);
        }
        // Rebuild project filter dropdown preserving selection
        const psel = $t("#tasks-project-filter");
        if (psel) {
          const cur = psel.value;
          psel.innerHTML = '<option value="all">All Projects</option>' +
            T.projects.map((p) => '<option value="' + p.id + '">' + esc(p.title) + '</option>').join("");
          if (cur && [...psel.options].some((o) => o.value === cur)) psel.value = cur;
        }
        renderTasksList();
      } catch (err) {
        const listEl = $t("#tasks-list");
        if (listEl) listEl.innerHTML = '<div class="bg-stone-100/90 rounded-2xl border border-stone-200/80 p-5 text-center text-xs font-semibold text-red-500">Failed to load tasks: ' + esc(err.message) + '</div>';
      }
    }

    function tasksSetFilter(filter, btnEl) {
      T.filter = filter;
      $$t(".tasks-filter-btn").forEach((b) => {
        b.className = "tasks-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700";
      });
      btnEl.className = "tasks-filter-btn px-3 py-1.5 rounded-full text-xs font-extrabold bg-stone-900 text-white";
      renderTasksList();
    }

    function tasksFilterState() { return T; }

    async function openEditTask(id) {
      const task = T.tasks.find((t) => t.id === id);
      if (!task) return;
      T.editing = task;
      T.sessions = [];
      attr($t("#edit-task-title"), "value", task.title || "");
      attr($t("#edit-task-due"), "value", isoDate(task.due_date, ""));
      attr($t("#edit-task-begin"), "value", isoDate(task.begin_date, ""));
      // Themed date pickers for due / begin (first open builds them, later opens re-sync only).
      if (typeof window.initTimePicker === "function") {
        window.initTimePicker($t("#edit-task-due"), { mode: "date" });
        window.initTimePicker($t("#edit-task-begin"), { mode: "date" });
      }
      $t("#edit-task-status").value = task.status || "wanted";
      $t("#edit-task-priority").value = task.priority || "medium";
      $t("#edit-task-id-label").innerText = "#" + task.id;
      attr($t("#edit-task-duration"), "value", task.duration != null ? task.duration : "");
      populateProjectSelect();
      const wrap = $t("#edit-new-branch-wrap");
      if (wrap) wrap.classList.add("hidden");
      refreshBranchOptions();
      const sel = $t("#edit-task-branch");
      if (sel) sel.value = task.branch_path || "";
      $t("#edit-sessions-list").innerHTML = '<div class="text-[11px] text-stone-400 font-medium py-2 text-center">Loading sessions…</div>';

      const modalEl = $t("#edit-task-modal");
      modalEl.classList.remove("opacity-0", "pointer-events-none");
      $t("#edit-modal-box").classList.remove("scale-95");

      // Fetch sessions and check for a running session on this task.
      T.running = null;
      try {
        const data = await (window.fetchJSON ? window.fetchJSON("/api/tasks/" + id + "/sessions") : null);
        T.sessions = (data && data.sessions) ? data.sessions.map((s) => ({ ...s })) : [];
        (window.fetchJSON ? window.fetchJSON("/api/sessions/active") : Promise.resolve(null)).then((active) => {
          if (active && active.session && active.session.task_id === id) {
            T.running = { id: active.session.id, started_at: active.session.started_at };
            renderEditSessions();
          }
        }).catch(() => {});
      } catch (_) {
        T.sessions = [];
        if (typeof showToast === "function") showToast("Could not load sessions");
      }
      renderEditSessions();
    }

    function closeEditTaskModal() {
      flushPendingSessionSaves();
      if (typeof window.closeTimePopover === "function") window.closeTimePopover();
      const modalEl = $t("#edit-task-modal");
      modalEl.classList.add("opacity-0", "pointer-events-none");
      $t("#edit-modal-box").classList.add("scale-95");
      T.editing = null;
      T.sessions = [];
      T.running = null;
    }

    // ---------- Session time editing (auto-save) ----------

    function toUTC(local) {
      if (!local) return null;
      const d = new Date(local);
      return isNaN(d) ? null : d.toISOString();
    }

    function toLocalInput(iso) {
      if (!iso) return "";
      const d = new Date(String(iso).replace(" ", "T").replace("Z", ""));
      if (isNaN(d)) return "";
      const p = (n) => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    function setRowStatus(row, msg, cls) {
      const st = row.querySelector(".ses-status");
      if (!st) return;
      st.innerText = msg;
      st.className = "ses-status text-[9px] font-bold px-2 py-0.5 rounded-full " + cls;
      st.style.display = "inline-block";
    }

    function dateFieldWrap(label, inner) {
      return '<div class="flex flex-col gap-1 flex-1 min-w-[150px]">' +
        '<label class="text-[9px] font-bold text-stone-400 uppercase tracking-wider">' + label + '</label>' + inner + '</div>';
    }

    function timeInput(name, value) {
      return '<div class="pkr-wrap flex-1 min-w-0">' +
        '<input data-field="' + name + '" type="hidden" value="' + esc(toLocalInput(value)) + '" class="pkr-value">' +
        '</div>';
    }

    function deleteConfirmHTML() {
      return '<button type="button" class="ses-del ses-btn-icon text-stone-400 hover:text-red-500 p-1 transition-colors" title="Delete" aria-label="Delete">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
        '</button>' +
        '<span class="ses-confirm hidden items-center gap-1"><button type="button" class="ses-confirm-yes text-[10px] font-extrabold text-white bg-red-500 px-2 py-1 rounded-lg hover:bg-red-600">Remove</button>' +
        '<button type="button" class="ses-confirm-no text-[10px] font-bold text-stone-500 px-2 py-1 rounded-lg hover:bg-stone-100">Cancel</button></span>';
    }

    function fullRowHTML(s) {
      const sid = s && s.id ? s.id : "";
      const hrs = s && s.duration_seconds ? (s.duration_seconds / 3600).toFixed(2) : "";
      return '<div class="ses-row flex flex-wrap items-center gap-2 bg-white rounded-xl border border-stone-200 px-3 py-2" data-sid="' + sid + '">' +
        dateFieldWrap("Start", timeInput("started_at", s ? s.started_at : "")) +
        dateFieldWrap("End", timeInput("ended_at", s ? s.ended_at : "")) +
        dateFieldWrap("Hours", '<div class="flex-1 min-w-0">' +
        '<input data-field="duration_seconds" type="number" step="0.05" min="0" value="' + esc(hrs) + '" class="w-full text-[11px] p-2 rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/40">' +
        '</div>') +
        '<span class="ses-status text-[9px] font-bold text-stone-400" style="display:none"></span>' +
        deleteConfirmHTML() +
        '</div>';
    }

    function runningRowHTML(s) {
      const st = toLocalInput(s.started_at);
      return '<div class="ses-row ses-running flex flex-wrap items-center gap-2 bg-white rounded-xl border border-[#F5C200] px-3 py-2" data-sid="' + s.id + '" data-running="1" data-started_at="' + esc(st) + '">' +
        '<div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-[200px]">' +
        '<span class="ses-running-pill inline-flex items-center gap-1.5 text-[10px] font-extrabold text-stone-900 bg-[#F5C200] px-2.5 py-1 rounded-lg"><span class="w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse"></span>Running now</span>' +
        '<label class="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Started</label>' +
        '<span class="text-[11px] font-semibold text-stone-700">' + esc(st) + '</span>' +
        '</div>' +
        '<button type="button" class="ses-stop ml-auto text-[10px] font-extrabold text-white bg-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-800 active:scale-95 transition-all">Stop session</button>' +
        '</div>';
    }

    function buildSessionRow(s) {
      return fullRowHTML(s);
    }

    function durationFromTimes(row) {
      const get = (f) => row.querySelector('[data-field="' + f + '"]');
      const a = toUTC(get("started_at").value);
      const b = toUTC(get("ended_at").value);
      if (!a || !b) return NaN;
      const startTs = new Date(a).getTime();
      let endTs = new Date(b).getTime();
      if (endTs <= startTs) endTs += 86400000;
      return Math.max(0, (endTs - startTs) / 1000);
    }

    function rowDurationSeconds(row) {
      const get = (f) => row.querySelector('[data-field="' + f + '"]');
      if (row.dataset.running) {
        const st = row.dataset.started_at;
        return st ? Math.max(0, (Date.now() - toUTC(st)) / 1000) : 0;
      }
      const hrs = parseFloat(get("duration_seconds").value);
      if (!row.dataset.new) return isNaN(hrs) ? 0 : Math.max(0, hrs * 3600);
      const t = durationFromTimes(row);
      return isNaN(t) ? (isNaN(hrs) ? 0 : Math.max(0, hrs * 3600)) : t;
    }

    function rowSessionData(row) {
      if (row.dataset.running) return null;
      const get = (f) => row.querySelector('[data-field="' + f + '"]');
      const started_at = toUTC(get("started_at").value);
      const ended_at = toUTC(get("ended_at").value);
      const duration_seconds = rowDurationSeconds(row);
      if (!started_at || !ended_at || duration_seconds <= 0) return null;
      return { started_at, ended_at, duration_seconds };
    }

    function updateSessionsLive() {
      const totalEl = $t("#edit-sessions-total");
      const countEl = $t("#edit-sessions-count");
      let total = 0, count = 0;
      $$t("#edit-sessions-list .ses-row:not([data-running])").forEach((r) => {
        total += rowDurationSeconds(r);
        count += 1;
      });
      if (totalEl) totalEl.innerText = fmtHrs(total);
      if (countEl) countEl.innerText = String(count);
    }

    function renderEmptySessions() {
      $t("#edit-sessions-list").innerHTML =
        '<div class="ses-empty text-[11px] text-stone-500 font-medium py-3 text-center">No time logged yet.<br>Click <b>“+ Add Session”</b> and set the times — it saves automatically.</div>';
    }

    function renderEditSessions() {
      const listEl = $t("#edit-sessions-list");
      if (!listEl) return;
      const others = T.running ? T.sessions.filter((s) => s.id !== T.running.id) : T.sessions;
      if (T.running || others.length) {
        listEl.innerHTML = (T.running ? runningRowHTML(T.running) : "") + others.map(buildSessionRow).join("");
        $$t("#edit-sessions-list .ses-row").forEach(bindRowEvents);
        updateSessionsLive();
      } else {
        renderEmptySessions();
        if ($t("#edit-sessions-total")) $t("#edit-sessions-total").innerText = "0.0h";
        if ($t("#edit-sessions-count")) $t("#edit-sessions-count").innerText = "0";
      }
    }

    function bindRowEvents(row) {
      row.querySelectorAll("[data-field]").forEach((inp) => {
        if (inp._pkrHTMLEvent) return;
        inp._pkrHTMLEvent = true;
        inp.addEventListener("change", () => onSessionRowChange(row, inp));
      });
      ["started_at", "ended_at"].forEach((f) => {
        const inp = row.querySelector('[data-field="' + f + '"]');
        if (inp && typeof window.initTimePicker === "function") {
          window.initTimePicker(inp, { mode: "datetime" });
        }
      });
      const del = row.querySelector(".ses-del");
      if (del) del.addEventListener("click", () => onDeleteClick(row));
      const yes = row.querySelector(".ses-confirm-yes");
      if (yes) yes.addEventListener("click", () => deleteSessionRow(row));
      const no = row.querySelector(".ses-confirm-no");
      if (no) no.addEventListener("click", () => cancelDeleteSession(row));
      const stop = row.querySelector(".ses-stop");
      if (stop) stop.addEventListener("click", () => stopSession(Number(row.dataset.sid)));
    }

    function onSessionRowChange(row, fieldEl) {
      const get = (f) => row.querySelector('[data-field="' + f + '"]');
      window.clearTimeout(row._saveTimer);
      if (fieldEl.type !== "number") {
        const started = get("started_at").value;
        const ended = get("ended_at").value;
        if (started && ended) {
          const t = durationFromTimes(row);
          if (!isNaN(t)) get("duration_seconds").value = (t / 3600).toFixed(2);
        } else {
          setRowStatus(row, "Set an end time", "bg-amber-100 text-amber-800");
        }
      }
      row.dataset.dirty = "1";
      updateSessionsLive();
      setRowStatus(row, "Saving…", "bg-stone-200 text-stone-600");
      row._saveTimer = window.setTimeout(() => saveSessionRow(row), 900);
    }

    async function saveSessionRow(row, force, taskIdOverride) {
      window.clearTimeout(row._saveTimer);
      const taskId = taskIdOverride || (T.editing ? T.editing.id : null);
      if (!taskId) return;
      const data = rowSessionData(row);
      if (!data) {
        row.dataset.dirty = "1";
        setRowStatus(row, "Set an end time", "bg-amber-100 text-amber-800");
        return;
      }
      if ((row.dataset.saving === "1") && !force) return;
      row.dataset.saving = "1";
      row.dataset.dirty = "0";
      const sid = Number(row.dataset.sid || 0);
      const isNew = !!row.dataset.new;
      try {
        if (isNew) {
          const created = await window.fetchJSON("/api/tasks/" + taskId + "/sessions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          row.dataset.sid = String(created.id);
          delete row.dataset.new;
          T.sessions.push({ ...created });
        } else if (sid) {
          await window.fetchJSON("/api/sessions/" + sid, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const orig = T.sessions.find((x) => x.id === sid);
          if (orig) { orig.started_at = data.started_at; orig.ended_at = data.ended_at; orig.duration_seconds = data.duration_seconds; }
        }
        setRowStatus(row, "Saved ✓", "bg-emerald-100 text-emerald-700");
        updateSessionsLive();
      } catch (err) {
        row.dataset.dirty = "1";
        setRowStatus(row, "Not saved", "bg-red-100 text-red-700");
        if (typeof showToast === "function") showToast("Could not save session: " + err.message);
      } finally {
        delete row.dataset.saving;
      }
    }

    function flushPendingSessionSaves() {
      const rows = $$t("#edit-sessions-list .ses-row");
      const taskId = T.editing ? T.editing.id : null;
      if (!taskId) return Promise.resolve();
      return Promise.all(rows.map((row) => {
        if (row.dataset.running) return Promise.resolve();
        window.clearTimeout(row._saveTimer);
        if (!row.dataset.dirty && !row.dataset.new) return Promise.resolve();
        return saveSessionRow(row, true, taskId);
      }));
    }

    function addEditSessionRow() {
      const listEl = $t("#edit-sessions-list");
      if (!T.editing || !listEl) return;
      const emptyEl = listEl.querySelector(".ses-empty");
      if (emptyEl) emptyEl.remove();
      listEl.insertAdjacentHTML("beforeend", fullRowHTML(null));
      const row = listEl.lastElementChild;
      row.dataset.new = "1";
      row.dataset.dirty = "1";
      row.classList.add("bg-amber-50", "border-amber-200");
      row.classList.remove("bg-white", "border-stone-200");
      const now = new Date();
      const p = (n) => String(n).padStart(2, "0");
      row.querySelector('[data-field="started_at"]').value = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate()) + "T" + p(now.getHours()) + ":" + p(now.getMinutes());
      bindRowEvents(row);
      updateSessionsLive();
      const end = row.querySelector('[data-field="ended_at"]');
      if (end) {
        const trigger = row.querySelector('[data-field="ended_at"]') && end._pkr && end._pkr.wrap ? end._pkr.wrap.querySelector(".pkr-trigger") : null;
        if (trigger) trigger.focus();
      }
    }

    function removeSessionRow(row) {
      window.clearTimeout(row._saveTimer);
      if (typeof window.closeTimePopover === "function") window.closeTimePopover();
      const sid = Number(row.dataset.sid || 0);
      row.remove();
      if (sid) {
        T.sessions = T.sessions.filter((s) => s.id !== sid);
        window.fetchJSON("/api/sessions/" + sid, { method: "DELETE" }).then(() => {
          if (typeof showToast === "function") showToast("Session deleted");
        }).catch(() => {
          if (typeof showToast === "function") showToast("Could not delete session");
        });
      } else {
        if (typeof showToast === "function") showToast("Session removed");
      }
      updateSessionsLive();
      if (!$$t("#edit-sessions-list .ses-row").length) renderEditSessions();
    }

    function onDeleteClick(row) {
      if (row.dataset.new) { removeSessionRow(row); return; }
      if (row.classList.contains("ses-confirming")) return;
      row.classList.add("ses-confirming");
      const del = row.querySelector(".ses-del");
      const conf = row.querySelector(".ses-confirm");
      if (del) del.classList.add("hidden");
      if (conf) { conf.classList.remove("hidden"); conf.classList.add("flex"); }
    }

    function cancelDeleteSession(row) {
      row.classList.remove("ses-confirming");
      const del = row.querySelector(".ses-del");
      const conf = row.querySelector(".ses-confirm");
      if (del) del.classList.remove("hidden");
      if (conf) { conf.classList.remove("flex"); conf.classList.add("hidden"); }
    }

    function deleteSessionRow(row) {
      row.classList.remove("ses-confirming");
      removeSessionRow(row);
    }

    async function deleteEditSession(id) {
      const row = document.querySelector('#edit-sessions-list [data-sid="' + id + '"]');
      if (row) { deleteSessionRow(row); return; }
      window.fetchJSON("/api/sessions/" + id, { method: "DELETE" }).catch(() => {});
    }

    async function deleteEditTask() {
      if (!T.editing || !confirm("Delete this task permanently? Its sessions are removed too.")) return;
      try {
        await window.fetchJSON("/api/tasks/" + T.editing.id, { method: "DELETE" });
        closeEditTaskModal();
        if (typeof showToast === "function") showToast("Task deleted");
        await loadTasksPage();
        if (typeof loadData === "function") loadData();
      } catch (err) {
        if (typeof showToast === "function") showToast("Error: " + err.message);
      }
    }

    async function stopSession(sessionId) {
      if (typeof showToast === "function") showToast("Stopping session…");
      try {
        await window.fetchJSON("/api/sessions/" + sessionId + "/stop", { method: "POST" });
        await reloadSessions();
        if (typeof showToast === "function") showToast("Session stopped and logged");
      } catch (err) {
        if (typeof showToast === "function") showToast("Error: " + err.message);
      }
    }

    async function reloadSessions() {
      if (!T.editing) return;
      try {
        const data = await (window.fetchJSON ? window.fetchJSON("/api/tasks/" + T.editing.id + "/sessions") : null);
        T.sessions = (data && data.sessions) ? data.sessions.map((s) => ({ ...s })) : [];
        T.running = null;
        renderEditSessions();
        window.fetchJSON("/api/sessions/active").then((active) => {
          if (active && active.session && active.session.task_id === T.editing.id) {
            T.running = { id: active.session.id, started_at: active.session.started_at };
            renderEditSessions();
          }
        }).catch(() => {});
        if (typeof loadTasksPage === "function") loadTasksPage();
        if (typeof loadData === "function") loadData();
      } catch (_) {
        if (typeof showToast === "function") showToast("Could not reload sessions");
      }
    }

    async function saveEditTask() {
      const t = T.editing;
      if (!t) return;
      await flushPendingSessionSaves();
      const due = $t("#edit-task-due").value || null;
      const begin = $t("#edit-task-begin").value || null;
      const branch = $t("#edit-task-branch").value.trim();
      const dur = $t("#edit-task-duration").value;
      const payload = {
        title: $t("#edit-task-title").value.trim(),
        status: $t("#edit-task-status").value,
        priority: $t("#edit-task-priority").value,
        project_id: Number($t("#edit-task-project").value),
        due_date: due,
        begin_date: begin,
        branch_path: branch || null,
        duration: dur !== "" ? parseFloat(dur) : null,
      };
      try {
        await window.fetchJSON("/api/tasks/" + t.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const n = T.sessions.length;
        closeEditTaskModal();
        if (typeof showToast === "function") showToast("Task saved · " + n + " session" + (n === 1 ? "" : "s"));
        await loadTasksPage();
        if (typeof loadData === "function") loadData();
      } catch (err) {
        if (typeof showToast === "function") showToast("Error: " + err.message);
      }
    }

    // Expose globally for inline onclick handlers + the dashboard current-task widget.
    window.loadTasksPage = loadTasksPage;
    window.renderTasksList = renderTasksList;
    window.tasksSetFilter = tasksSetFilter;
    window.openEditTask = openEditTask;
    window.closeEditTaskModal = closeEditTaskModal;
    window.saveEditTask = saveEditTask;
    window.addEditSessionRow = addEditSessionRow;
    window.deleteSessionRow = deleteSessionRow;
    window.deleteEditSession = deleteEditSession;
    window.deleteEditTask = deleteEditTask;
    window.reloadSessions = reloadSessions;
    window.updateSessionsLive = updateSessionsLive;
    window.tasksFilterStateFunc = () => T;
    Object.defineProperty(window, "tasksFilterState", { get: () => T });  })();

