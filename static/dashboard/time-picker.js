/* =====================================================================
   * Themed date + time picker — CHECK BOX dashboard
   * Vanilla JS: focused mini-calendar with today-dot + amber selected
   * cluster, and an iOS-style snapping scroll-wheel time selector.
   * Upgrades a hidden <input> into { trigger pill + popover }, always
   * writing back the local "YYYY-MM-DD" / "YYYY-MM-DDTHH:MM" value.
   * ===================================================================== */
  (function () {
    "use strict";

    const pad = (n) => String(n).padStart(2, "0");
    const ITEM_H = 42;                     // wheel item height (px), keep in sync with CSS
    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const WD = ["Su","Mo","Tu","We","Th","Fr","Sa"];

    const ICON_CAL = '<svg class="pkr-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
    const ICON_PREV = '<svg class="pkr-nav-ico" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>';
    const ICON_NEXT = '<svg class="pkr-nav-ico" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>';

    let openPopEl = null;
    let openInput = null;
    let popCleanup = null;

    function parseLocal(v) {
      if (v == null || v === "") return null;
      const d = new Date(String(v).slice(0, 16).replace(" ", "T"));
      return isNaN(d) ? null : d;
    }
    function dateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function dateTimeStr(d) { return dateStr(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    function fmtTrigger(d, withTime) {
      const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      return withTime ? label + " \u00b7 " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : label;
    }

    function closePopover() {
      if (popCleanup) { popCleanup(); popCleanup = null; }
      if (openPopEl) { openPopEl.remove(); openPopEl = null; }
      openInput = null;
    }

    // ---------------------------------------------------------------- picker

    function initTimePicker(input, opts) {
      if (!input || !input.tagName) return;
      opts = opts || {};
      const mode = opts.mode === "date" ? "date" : "datetime";

      if (input._pkr) {
        // Reopening modal: openEditTask re-sets the value attribute; snap the
        // dirty property back so the displayed + committed value stays in sync.
        const attrVal = input.getAttribute("value");
        if (attrVal !== null && attrVal !== input.value) input.value = attrVal;
        syncLabel(input);
        return;
      }   // already built → just refresh display

      let wrap = input.parentElement;
      if (!wrap || !wrap.classList.contains("pkr-wrap")) {
        const nw = document.createElement("div");
        nw.className = "pkr-wrap flex-1 min-w-0";
        input.parentNode.insertBefore(nw, input);
        nw.appendChild(input);
        wrap = nw;
      }
      input.classList.add("pkr-value");
      input._pkr = { opts, wrap, mode };

      const trig = document.createElement("button");
      trig.type = "button";
      trig.className = "pkr-trigger";
      trig.innerHTML = ICON_CAL + '<span class="pkr-label truncate"></span>';
      wrap.appendChild(trig);

      trig.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (openInput === input) { closePopover(); return; }
        openPopover(input, trig);
      });

      syncLabel(input);
    }

    function syncLabel(input) {
      const p = input._pkr; if (!p) return;
      const lbl = p.wrap && p.wrap.querySelector(".pkr-label");
      if (!lbl) return;
      const d = parseLocal(input.value);
      if (!d) {
        lbl.textContent = p.mode === "date" ? "No date" : "Set date & time";
        lbl.classList.add("pkr-label-empty");
      } else {
        lbl.textContent = fmtTrigger(d, p.mode === "datetime");
        lbl.classList.remove("pkr-label-empty");
      }
    }

    function focusTimePicker(input) {
      const p = input && input._pkr;
      if (p && p.wrap) { const t = p.wrap.querySelector(".pkr-trigger"); if (t) t.focus(); }
    }

    // ---------------------------------------------------------------- wheel

    function buildWheel(values, initialIdx, onStep) {
      const col = document.createElement("div");
      col.className = "pkr-wheel-col";
      col.tabIndex = 0;
      values.forEach((v, i) => {
        const item = document.createElement("div");
        item.className = "pkr-wheel-item";
        item.textContent = pad(v);
        item.dataset.active = i === initialIdx ? "1" : "0";
        item.addEventListener("pointerdown", () => col.focus());
        col.appendChild(item);
      });

      const count = values.length;

      function center() { return Math.max(0, Math.min(count - 1, Math.round(col.scrollTop / ITEM_H))); }
      function syncActive() {
        const c = center();
        if (c === col._last) return;
        col._last = c;
        [...col.children].forEach((el, i) => { el.dataset.active = i === c ? "1" : "0"; });
        onStep(c);
      }
      function animate(to) {
        if (to === col.scrollTop) return;
        const from = col.scrollTop;
        const diff = to - from;
        cancelAnimationFrame(col._raf);
        const start = performance.now();
        const dur = 170;
        (function step(now) {
          const k = Math.min(1, (now - start) / dur);
          const ease = 1 - Math.pow(1 - k, 3);
          col.scrollTop = from + diff * ease;
          if (k < 1) col._raf = requestAnimationFrame(step);
        })(performance.now());
      }
      function stepBy(dir) {
        const t = Math.max(0, Math.min(count - 1, center() + dir));
        animate(t * ITEM_H);
      }

      col.addEventListener("scroll", syncActive, { passive: true });
      col.addEventListener("wheel", (e) => {
        e.preventDefault();
        const steps = Math.max(-3, Math.min(3, Math.round(e.deltaY / 100))) || (e.deltaY > 0 ? 1 : -1);
        stepBy(steps);
      }, { passive: false });
      col.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); stepBy(-1); }
        else if (e.key === "ArrowDown") { e.preventDefault(); stepBy(1); }
      });
      col.addEventListener("focus", () => col.classList.add("pkr-col-focus"));
      col.addEventListener("blur", () => col.classList.remove("pkr-col-focus"));

      col.scrollTop = initialIdx * ITEM_H;
      col._last = initialIdx;
      [...col.children].forEach((el, i) => { el.dataset.active = i === initialIdx ? "1" : "0"; });

      return { el: col, set: (idx) => { animate(Math.max(0, Math.min(count - 1, idx)) * ITEM_H); } };
    }

    // -------------------------------------------------------------- popover

    function openPopover(input, trig) {
      closePopover();
      const p = input._pkr;
      const mode = p.mode;

      const cur = parseLocal(input.value) || new Date();
      let selDate = parseLocal(input.value);                       // selected day (may be null when cleared)
      const y = selDate ? selDate.getFullYear() : cur.getFullYear();
      const m = selDate ? selDate.getMonth() : cur.getMonth();

      let hour = cur.getHours(), minute = cur.getMinutes();
      if (selDate) { hour = selDate.getHours(); minute = selDate.getMinutes(); }

      let fireTimer = null;

      function fireEvents() {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      function syncValue(writeLabel) {
        if (selDate) {
          if (mode === "datetime") selDate = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), hour, minute);
          input.value = mode === "date" ? dateStr(selDate) : dateTimeStr(selDate);
        } else {
          input.value = "";
        }
        if (writeLabel !== false) syncLabel(input);
      }
      function commitNow() {
        syncValue();
        fireEvents();
      }
      function commitSoon() {
        syncValue();
        window.clearTimeout(fireTimer);
        fireTimer = window.setTimeout(fireEvents, 320);
      }

      // --- popover shell ---
      const pop = document.createElement("div");
      pop.className = "pkr-pop";
      document.body.appendChild(pop);

      // header with month nav
      const head = document.createElement("div");
      head.className = "pkr-head";
      const title = document.createElement("span");
      title.className = "pkr-title";
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "pkr-nav-btn";
      prev.innerHTML = ICON_PREV;
      prev.title = "Previous month";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "pkr-nav-btn";
      next.innerHTML = ICON_NEXT;
      next.title = "Next month";
      head.appendChild(prev);
      head.appendChild(title);
      head.appendChild(next);
      pop.appendChild(head);

      // weekday labels
      const week = document.createElement("div");
      week.className = "pkr-week-row";
      week.innerHTML = WD.map((w) => '<span class="pkr-week-label">' + w + '</span>').join("");
      pop.appendChild(week);

      // day grid
      const grid = document.createElement("div");
      grid.className = "pkr-grid";
      pop.appendChild(grid);

      // time wheels
      // ensure the wheel has a base date if the user spins time before picking a day
      function ensureSelDate() {
        if (!selDate) selDate = new Date(state_y, state_m, 1, hour, minute);
      }

      let hourWheel = null, minWheel = null;
      if (mode === "datetime") {
        const wheels = document.createElement("div");
        wheels.className = "pkr-wheels";
        hourWheel = buildWheel(range24(), hour, (v) => {
          hour = v; ensureSelDate(); commitSoon();
        });
        minWheel = buildWheel(range60(), minute, (v) => {
          minute = v; ensureSelDate(); commitSoon();
        });
        hourWheel.el.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); minWheel.el.focus(); } });
        minWheel.el.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") { e.preventDefault(); hourWheel.el.focus(); } });
        wheels.appendChild(hourWheel.el);
        const colon = document.createElement("span");
        colon.className = "pkr-colon";
        colon.textContent = ":";
        wheels.appendChild(colon);
        wheels.appendChild(minWheel.el);
        const center = document.createElement("div");
        center.className = "pkr-wheel-center";
        wheels.appendChild(center);
        pop.appendChild(wheels);
      }

      // footer quick actions
      const foot = document.createElement("div");
      foot.className = "pkr-foot";
      const nowBtn = document.createElement("button");
      nowBtn.type = "button";
      nowBtn.className = "pkr-quick pkr-now";
      nowBtn.textContent = mode === "date" ? "Today" : "Now";
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "pkr-quick pkr-clear";
      clearBtn.textContent = "Clear";
      foot.appendChild(nowBtn);
      foot.appendChild(clearBtn);
      pop.appendChild(foot);

      let state_y = y, state_m = m;
      title.textContent = MONTHS[state_m] + " " + state_y;

      // --- calendar render ---
      function renderGrid() {
        grid.innerHTML = "";
        const first = new Date(state_y, state_m, 1);
        const lead = first.getDay();
        const dim = new Date(state_y, state_m + 1, 0).getDate();
        const today = new Date();

        for (let i = 0; i < lead; i++) {
          const b = document.createElement("span");
          b.className = "pkr-block";
          grid.appendChild(b);
        }
        for (let d = 1; d <= dim; d++) {
          const nd = new Date(state_y, state_m, d);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "pkr-day";
          btn.dataset.iso = dateStr(nd);
          if (selDate && dateStr(selDate) === dateStr(nd)) btn.classList.add("pkr-sel");
          if (today.getFullYear() === nd.getFullYear() && today.getMonth() === nd.getMonth() && today.getDate() === d) {
            btn.classList.add("pkr-today");
          }
          btn.textContent = String(d);
          btn.addEventListener("click", () => {
            selDate = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate(), hour, minute);
            commitNow();
            renderGrid();
            if (mode === "date") {
              setTimeout(closePopover, 60);
            } else {
              hourWheel.set(hour);
              minWheel.set(minute);
            }
          });
          grid.appendChild(btn);
        }
      }

      function setMonth(dm) {
        const nd = new Date(state_y, state_m + dm, 1);
        state_y = nd.getFullYear();
        state_m = nd.getMonth();
        title.textContent = MONTHS[state_m] + " " + state_y;
        renderGrid();
      }

      prev.addEventListener("click", () => setMonth(-1));
      next.addEventListener("click", () => setMonth(1));

      nowBtn.addEventListener("click", () => {
        const n = new Date();
        selDate = n;
        hour = n.getHours(); minute = n.getMinutes();
        state_y = n.getFullYear(); state_m = n.getMonth();
        title.textContent = MONTHS[state_m] + " " + state_y;
        commitNow();
        renderGrid();
        if (mode === "datetime") { hourWheel.set(hour); minWheel.set(minute); }
        if (mode === "date") setTimeout(closePopover, 60);
      });

      clearBtn.addEventListener("click", () => {
        selDate = null;
        window.clearTimeout(fireTimer);
        input.value = "";
        syncLabel(input);
        fireEvents();
        renderGrid();
        setTimeout(closePopover, 40);
      });

      renderGrid();
      positionPop();
      requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add("pkr-open")));

      openPopEl = pop;
      openInput = input;

      function positionPop() {
        const r = trig.getBoundingClientRect();
        const w = pop.offsetWidth || 300;
        const h = pop.offsetHeight;
        let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
        let top = r.bottom + 8;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
        pop.style.left = left + "px";
        pop.style.top = top + "px";
      }

      // close on outside click / escape / any scroll
      const onDocDown = (e) => {
        if (e.target && e.target.closest && e.target.closest(".pkr-pop")) return;
        const t = e.target;
        const inTrig = openInput && openInput._pkr && openInput._pkr.wrap && openInput._pkr.wrap.contains(t);
        if (!inTrig) closePopover();
      };
      const onKey = (e) => { if (e.key === "Escape") closePopover(); };
      const onScroll = (e) => {
        if (!openPopEl) return;
        const et = e.target;
        if (et && et.closest && et.closest(".pkr-pop")) return;   // ignore wheel columns scrolling inside
        closePopover();
      };
      const interval = window.setInterval(positionPop, 140);
      document.addEventListener("pointerdown", onDocDown, true);
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("scroll", onScroll, true);

      popCleanup = function () {
        window.clearInterval(interval);
        document.removeEventListener("pointerdown", onDocDown, true);
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("scroll", onScroll, true);
        window.clearTimeout(fireTimer);
      };
    }

    function range24() { const a = []; for (let i = 0; i < 24; i++) a.push(i); return a; }
    function range60() { const a = []; for (let i = 0; i < 60; i++) a.push(i); return a; }

    // ---------------------------------------------------------------- export

    window.initTimePicker = initTimePicker;
    window.focusTimePicker = focusTimePicker;
    window.syncTimePickers = function () {
      document.querySelectorAll(".pkr-value").forEach((inp) => { if (inp._pkr) syncLabel(inp); });
    };

    // reassignable close used by popover teardown is scoped above; expose a safe one
    window.closeTimePopover = function () { closePopover(); };
  })();