/* ---------- Mind map widget ---------- */

function countProjects(roots) {
  let n = 0;
  (function walk(nodes) {
    nodes.forEach((node) => {
      n += (node.projects || []).length;
      walk(node.children || []);
    });
  })(roots);
  return n;
}

function mindFromBranch(b) {
  const node = { key: "b:" + b.path, label: b.name, kind: "branch", children: [] };
  (b.projects || []).forEach((p) => node.children.push(mindFromProject(p)));
  (b.tasks || []).forEach((t) => node.children.push(mindFromTask(t, true)));
  (b.children || []).forEach((c) => node.children.push(mindFromBranch(c)));
  return node;
}

function mindFromProject(p) {
  const proj = p.project;
  const node = {
    key: "p:" + proj.id,
    label: proj.title,
    kind: "project",
    status: proj.status,
    running: p.running,
    children: [],
  };
  (p.open_tasks || []).forEach((t) => node.children.push(mindFromTask(t, false)));
  return node;
}

function mindFromTask(t, showProject) {
  return {
    key: "task:" + t.id,
    label: t.title,
    kind: "task",
    status: t.status,
    priority: t.priority,
    running: t.running_session_id != null,
    tag: showProject ? t.project_title : "",
    children: [],
  };
}

function buildMindRoot(roots) {
  const root = { key: "root", label: "WORK", kind: "root", children: [] };
  (roots || []).forEach((b) => root.children.push(mindFromBranch(b)));
  return root;
}

function collectMindOpen(root) {
  const out = new Set(["root"]);
  (root.children || []).forEach((c) => out.add(c.key));
  (function walk(node, anc) {
    if (node.kind === "project" && node.running) {
      anc.forEach((k) => out.add(k));
      out.add(node.key);
    }
    (node.children || []).forEach((c) => walk(c, [...anc, node.key]));
  })(root, []);
  return out;
}

function applyMindOpen(root, openSet) {
  root.expanded = openSet.has(root.key);
  (root.children || []).forEach((c) => applyMindOpen(c, openSet));
}

const MIND_LEVEL_GAP = 200;
const MIND_ROW = 40;

function mindLayout(root) {
  const placed = [];
  let slot = 0;
  (function place(n, depth) {
    n._x = depth * MIND_LEVEL_GAP;
    const hasKids = (n.children && n.children.length) && n.expanded;
    if (!hasKids) {
      n._y = slot * MIND_ROW;
      n._top = n._bottom = n._y;
      slot++;
    } else {
      n.children.forEach((c) => place(c, depth + 1));
      n._top = n.children[0]._top;
      n._bottom = n.children[n.children.length - 1]._bottom;
      n._y = (n._top + n._bottom) / 2;
    }
    placed.push(n);
  })(root, 0);
  return { placed, h: Math.max(1, slot) * MIND_ROW + 60 };
}

function mindConnector(x1, y1, x2, y2) {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function findMindNode(n, key) {
  if (n.key === key) return n;
  for (const c of n.children || []) {
    const found = findMindNode(c, key);
    if (found) return found;
  }
  return null;
}

function mindAllExpanded(root) {
  if (!root.expanded) return false;
  for (const c of root.children || []) {
    if (!mindAllExpanded(c)) return false;
  }
  return true;
}

function updateTreeToggleLabel(expanded) {
  const btn = $("#work-tree-toggle");
  if (btn) btn.textContent = expanded ? "Collapse" : "Expand";
}

function toggleMindTree() {
  const root = state.mindRoot;
  if (!root) return;
  const expand = !mindAllExpanded(root);
  (function walk(n, isRoot) {
    n.expanded = isRoot || expand;
    (n.children || []).forEach((c) => walk(c, false));
  })(root, true);
  renderMindMap();
}

function ensureMindSkeleton(el) {
  let wrap = el.querySelector("#mm-wrap");
  if (!wrap) {
    el.innerHTML =
      `<div class="mm-wrap" id="mm-wrap"><svg class="mm-svg" id="mm-svg"></svg></div>` +
      `<div class="mm-hint">Scroll to zoom · drag to pan · click nodes to expand</div>`;
    wrap = el.querySelector("#mm-wrap");
  }
  return wrap;
}

function renderMindMap() {
  const el = $("#work-tree");
  const t = state.tree;
  if (!t) return;
  $("#tree-count").textContent = t.roots && t.roots.length ? `· ${countProjects(t.roots)}` : "";
  if (!t.roots || !t.roots.length) {
    el.innerHTML = `<p class="work-empty">No projects yet. Add one with +.</p>`;
    updateTreeToggleLabel(true);
    return;
  }
  if (!state.mindRoot) {
    state.mindRoot = buildMindRoot(t.roots);
    applyMindOpen(state.mindRoot, collectMindOpen(state.mindRoot));
  }
  const { placed, h } = mindLayout(state.mindRoot);
  const wrap = ensureMindSkeleton(el);
  const svgEl = document.getElementById("mm-svg");

  [...wrap.querySelectorAll(".mn")].forEach((n) => n.remove());

  let html = "";
  placed.forEach((n) => {
    const open = !!n.expanded;
    const kids = n.children && n.children.length;
    const cls = ["mn", n.kind, n.status || "", n.running ? "running" : "", open && kids ? "open" : ""]
      .filter(Boolean)
      .join(" ");
    const dot = n.kind === "project" || n.kind === "task" ? `<span class="mn-dot"></span>` : "";
    const toggle = kids ? `<span class="mn-toggle">›</span>` : "";
    html +=
      `<div class="${cls}" data-key="${esc(n.key)}" style="left:${Math.round(n._x)}px;top:${Math.round(n._y)}px">` +
      `${dot}<span>${esc(n.label)}</span>${toggle}</div>`;
  });
  wrap.insertAdjacentHTML("beforeend", html);

  const nodeEls = [...wrap.querySelectorAll(".mn")];
  let maxRight = 0;
  placed.forEach((n, i) => {
    n._w = nodeEls[i] ? nodeEls[i].offsetWidth || 100 : 100;
    maxRight = Math.max(maxRight, n._x + n._w);
  });
  const w = Math.round(maxRight + 40);
  const hh = Math.round(h);
  wrap.style.width = w + "px";
  wrap.style.height = hh + "px";
  svgEl.setAttribute("width", w);
  svgEl.setAttribute("height", hh);
  svgEl.setAttribute("viewBox", `0 0 ${w} ${hh}`);

  const edges = [];
  (function collect(n) {
    if (!n.expanded) return;
    (n.children || []).forEach((c) => {
      edges.push({ x1: n._x + n._w, y1: n._y, x2: c._x, y2: c._y });
      collect(c);
    });
  })(state.mindRoot);
  svgEl.innerHTML = edges.map((e) => `<path d="${mindConnector(e.x1, e.y1, e.x2, e.y2)}" class="me"/>`).join("");

  if (!state.mindInitialized) {
    const home = mindHomePan(el, w, hh);
    if (home) {
      state.mindZoom = 1;
      state.mindPan.x = home.x;
      state.mindPan.y = home.y;
      state.mindInitialized = true;
    }
  }
  applyMindPan(wrap);
  updateTreeToggleLabel(mindAllExpanded(state.mindRoot));
}

const MIND_ZOOM_MIN = 0.25;
const MIND_ZOOM_MAX = 3;

function applyMindPan(wrap) {
  if (!wrap) return;
  wrap.style.transform = `translate(${state.mindPan.x}px, ${state.mindPan.y}px) scale(${state.mindZoom})`;
}

function mindHomePan(el, w, hh) {
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  if (cw <= 0 || ch <= 0) return null;
  return {
    x: w <= cw ? (cw - w) / 2 : 60,
    y: hh <= ch ? (ch - hh) / 2 : 60,
  };
}

function resetMindView(el) {
  const wrap = el.querySelector("#mm-wrap");
  if (!wrap) return;
  const home = mindHomePan(el, wrap.offsetWidth, wrap.offsetHeight);
  if (!home) return;
  state.mindZoom = 1;
  state.mindPan.x = home.x;
  state.mindPan.y = home.y;
  applyMindPan(wrap);
}

function bindMindMap() {
  const canvas = $("#work-tree");
  if (!canvas) return;

  const resetBtn = $("#mm-reset");
  if (resetBtn) resetBtn.addEventListener("click", () => resetMindView(canvas));

  let panStart = null;
  let panMoved = false;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    panMoved = false;
    panStart = { x: e.clientX, y: e.clientY, px: state.mindPan.x, py: state.mindPan.y };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("panning");
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!panStart) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    if (Math.hypot(dx, dy) > 4) panMoved = true;
    if (panMoved) {
      state.mindPan.x = panStart.px + dx;
      state.mindPan.y = panStart.py + dy;
      applyMindPan(canvas.querySelector("#mm-wrap"));
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!panStart) return;
    const wasDrag = panMoved;
    panStart = null;
    canvas.classList.remove("panning");
    if (wasDrag) return;

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = hit && hit.closest(".mn");
    if (!nodeEl) return;
    const k = nodeEl.dataset.key;
    const n = findMindNode(state.mindRoot, k);
    if (n && n.children && n.children.length) {
      n.expanded = !n.expanded;
      renderMindMap();
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const old = state.mindZoom;
    const next = Math.min(MIND_ZOOM_MAX, Math.max(MIND_ZOOM_MIN, old * factor));
    if (next === old) return;
    const p = state.mindPan;
    const wx = (e.clientX - rect.left - p.x) / old;
    const wy = (e.clientY - rect.top - p.y) / old;
    state.mindZoom = next;
    p.x = e.clientX - rect.left - wx * next;
    p.y = e.clientY - rect.top - wy * next;
    applyMindPan(canvas.querySelector("#mm-wrap"));
  }, { passive: false });

  canvas.addEventListener("dblclick", (e) => {
    if (e.target.closest(".mn")) return;
    resetMindView(canvas);
  });
}

App.register("mind-map", { bind: bindMindMap });
