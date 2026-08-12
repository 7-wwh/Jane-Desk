function currentTask(w) {
  if (!w) return null;
  if (w.last_started) return w.last_started;
  if (w.current) return w.current;
  return null;
}

function updateFlipClock() {
  const c = currentTask(state.work);
  const flip = $("#current-flip");
  if (!c || !flip) return;
  if (isRunningTask(c)) {
    const started = parseISO(state.activeSession.started_at);
    if (started) setFlipClock(Math.floor((Date.now() - started.getTime()) / 1000), true);
  }
}

const FLIP_MS = 560;

function flipMarkup() {
  const cols = ["h", "m", "s"];
  const boxes = cols.map((c) => {
    const id = "fc-" + c;
    return `<div class="fc-col" id="${id}-col"><div class="fc-digit fc-d${c}" data-c="${c}"><div class="fc-flip"><span class="fc-face fc-top">00</span><span class="fc-face fc-bottom">00</span></div></div></div>`;
  });
  const sep = '<span class="fc-sep"></span>';
  return `<div id="current-flip" class="flip-clock" aria-label="Duration worked">${boxes[0]}${sep}${boxes[1]}${sep}${boxes[2]}</div>`;
}

function flipSet(col, value) {
  const digit = document.querySelector(".fc-d" + col);
  if (!digit) return;
  if (digit.dataset.value === value) return;
  const flip = digit.querySelector(".fc-flip");
  const top = flip.querySelector(".fc-top");
  const bottom = flip.querySelector(".fc-bottom");
  const wasFront = !digit.dataset.face || digit.dataset.face === "top" ? "top" : "bottom";
  const back = wasFront === "top" ? bottom : top;
  const front = wasFront === "top" ? top : bottom;
  back.textContent = value;
  digit.dataset.face = wasFront === "top" ? "bottom" : "top";
  digit.style.transition = "none";
  digit.classList.remove("flipped");
  void digit.offsetWidth;
  digit.style.transition = "";
  requestAnimationFrame(() => {
    digit.classList.add("flipped");
    setTimeout(() => {
      front.textContent = value;
      back.textContent = value;
      digit.style.transition = "none";
      digit.classList.remove("flipped");
      digit.dataset.face = "top";
      digit.dataset.value = value;
      void digit.offsetWidth;
      digit.style.transition = "";
    }, FLIP_MS + 40);
  });
}

function setFlipClock(sec, running) {
  const parts = fmtHMS(sec);
  ["h", "m", "s"].forEach((c, i) => flipSet(c, parts[i]));
}

function renderCurrent() {
  const w = state.work;
  const el = $("#work-current");
  const c = currentTask(w);
  const hero = document.querySelector(".work-hero-card");
  if (hero) hero.classList.toggle("running", !!c && isRunningTask(c));
  if (!c) {
    el.innerHTML = `<p class="work-empty">Nothing on your list. Start an idea below or add a task.</p>`;
    return;
  }
  const running = isRunningTask(c);
  const started = running && state.activeSession ? parseISO(state.activeSession.started_at) : null;
  const baseSec = started ? Math.floor((Date.now() - started.getTime()) / 1000) : c.total_seconds || 0;
  const pc = PRIO_TEXT[c.priority] || "#6B6460";
  const pb = PRIO_BG[c.priority] || "var(--color-surface-hi)";
  el.innerHTML = `
    ${w.needs_start && !running ? `<p class="hero-hint">Nothing in progress — start this next task:</p>` : ""}
    <div class="hero-body">
      <div class="hero-top">
        <h2 class="hero-title">${esc(c.title)}</h2>
        <span class="task-chip task-prio" style="--chip:${pc};--chip-bg:${pb}">${esc(c.priority)}</span>
      </div>
      <p class="hero-meta">${esc(c.project_title)}${c.due_date ? ` · ${workTaskMeta(c, w.today)}` : ""}</p>
      ${flipMarkup()}
      <div class="hero-meta">${timeLabel(c)}</div>
      <div class="hero-actions">
        ${!running ? `<button class="btn btn-primary btn-lure" data-action="session-start" data-id="${c.id}">Start</button>` : playButton(c)}
        <button class="btn btn-sm" data-action="task-edit" data-id="${c.id}">Edit</button>
        <button class="btn btn-done" data-action="task-finish" data-id="${c.id}">Done</button>
      </div>
    </div>`;
  setFlipClock(baseSec, !!running);
}

App.register("current-task", { bind: () => {} });