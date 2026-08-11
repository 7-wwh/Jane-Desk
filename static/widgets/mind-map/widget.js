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

function mindDescendantCount(n) {
  let c = 0;
  (n.children || []).forEach((ch) => {
    c += 1 + mindDescendantCount(ch);
  });
  return c;
}

const MIND_LEVEL_GAP = 230;
const MIND_ROW = 46;

function mindLayout(root) {
  const placed = [];
  let slot = 0;
  (function place(n, depth) {
    n._x = depth * MIND_LEVEL_GAP;
    if (!n.expanded || !n.children.length) {
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
  return { placed, h: Math.max(1, slot) * MIND_ROW + 24 };
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
  state.mindClosing = !expand;
  renderMindMap();
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
  const nodesHtml = placed
    .map((n) => {
      const open = !!n.expanded;
      const hasKids = n.children && n.children.length;
      const count = hasKids ? mindDescendantCount(n) : 0;
      return `<div class="mind-node kind-${n.kind}${n.running ? " running" : ""}${n.status ? " st-" + n.status : ""}${open ? " open" : ""}" data-key="${esc(n.key)}" style="left:${Math.round(n._x)}px;top:${Math.round(n._y)}px">
        <span class="mind-label">${esc(n.label)}</span>
        ${n.tag ? `<span class="mind-tag">${esc(n.tag)}</span>` : ""}
        ${hasKids ? `<span class="mind-count${open ? "" : " hint"}">${open ? "&#9662;" : "&#9656;"}${count}</span>` : ""}
      </div>`;
    })
    .join("");
  el.innerHTML = `<div class="mind-wrap">${nodesHtml}</div>`;
  const wrap = el.querySelector(".mind-wrap");
  const nodeEls = [...wrap.querySelectorAll(".mind-node")];
  let maxRight = 0;
  placed.forEach((n, i) => {
    n._w = nodeEls[i].offsetWidth || 80;
    maxRight = Math.max(maxRight, n._x + n._w);
  });
  const w = Math.round(maxRight + 24);
  const hh = Math.round(h);
  wrap.style.width = w + "px";
  wrap.style.height = hh + "px";
  const edges = [];
  let maxDepth = 0;
  (function collect(n, depth) {
    if (!n.expanded) return;
    (n.children || []).forEach((c) => {
      edges.push({ x1: n._x + n._w, y1: n._y, x2: c._x, y2: c._y, depth });
      maxDepth = Math.max(maxDepth, depth);
      collect(c, depth + 1);
    });
  })(state.mindRoot, 0);
  const lines = edges
    .map((e) => `<path d="${mindConnector(e.x1, e.y1, e.x2, e.y2)}" fill="none" class="mind-line"/>`)
    .join("");
  const closing = state.mindClosing;
  const pulses = edges
    .map((e) => {
      const d = mindConnector(e.x1, e.y1, e.x2, e.y2);
      const t = closing ? (maxDepth - e.depth) * 0.14 : e.depth * 0.14;
      const kp = closing ? "keyPoints=\"1;0\" keyTimes=\"0;1\"" : "";
      return `<circle class="mind-pulse" r="3.4">
        <animateMotion dur="0.55s" begin="${t}s" fill="freeze" path="${d}" ${kp}/>
        <animate attributeName="opacity" dur="0.7s" begin="${t}s" fill="freeze" values="0;1;1;0" keyTimes="0;0.1;0.75;1"/>
      </circle>`;
    })
    .join("");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "mind-svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", hh);
  svg.setAttribute("viewBox", `0 0 ${w} ${hh}`);
  svg.innerHTML = lines + pulses;
  wrap.prepend(svg);
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
  updateTreeToggleLabel(state.mindRoot ? mindAllExpanded(state.mindRoot) : true);
}

const MIND_ZOOM_MIN = 0.25;
const MIND_ZOOM_MAX = 3;
const MIND_ZOOM_STEP = 1.12;

function applyMindPan(wrap) {
  if (!wrap) return;
  wrap.style.transform = `translate(${state.mindPan.x}px, ${state.mindPan.y}px) scale(${state.mindZoom})`;
}

function mindHomePan(el, w, hh) {
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  if (cw <= 0 || ch <= 0) return null;
  return {
    x: w <= cw ? (cw - w) / 2 : 0,
    y: hh <= ch ? (ch - hh) / 2 : 0,
  };
}

function resetMindView(el) {
  const wrap = el.querySelector(".mind-wrap");
  if (!wrap) return;
  const home = mindHomePan(el, wrap.offsetWidth, wrap.offsetHeight);
  if (!home) return;
  state.mindZoom = 1;
  state.mindPan.x = home.x;
  state.mindPan.y = home.y;
  applyMindPan(wrap);
}

function zoomMindAt(el, cx, cy, factor) {
  const wrap = el.querySelector(".mind-wrap");
  if (!wrap) return;
  const old = state.mindZoom;
  const next = Math.min(MIND_ZOOM_MAX, Math.max(MIND_ZOOM_MIN, old * factor));
  if (next === old) return;
  const p = state.mindPan;
  const wx = (cx - p.x) / old;
  const wy = (cy - p.y) / old;
  state.mindZoom = next;
  p.x = cx - wx * next;
  p.y = cy - wy * next;
  applyMindPan(wrap);
}

function bindMindMap() {
  const mindTree = $("#work-tree");
  if (mindTree) {
    const onPanMove = (e) => {
      if (!state.panStart) return;
      const dx = e.clientX - state.panStart.x;
      const dy = e.clientY - state.panStart.y;
      if (Math.hypot(dx, dy) > 4) state.mindDragged = true;
      state.mindPan.x = state.panStart.px + dx;
      state.mindPan.y = state.panStart.py + dy;
      applyMindPan(mindTree.querySelector(".mind-wrap"));
    };
    const clearPan = () => {
      if (!state.panStart) return;
      state.panStart = null;
      mindTree.classList.remove("panning");
      document.removeEventListener("pointermove", onPanMove);
      document.removeEventListener("pointerup", onPanUp);
      document.removeEventListener("pointercancel", onPanEnd);
    };
    const onPanEnd = () => clearPan();
    const onPanUp = () => {
      const key = panNodeKey;
      const moved = state.mindDragged;
      clearPan();
      if (moved || !key) return;
      const node = findMindNode(state.mindRoot, key);
      if (node && node.children && node.children.length) {
        node.expanded = !node.expanded;
        state.mindClosing = !node.expanded;
        renderMindMap();
      }
    };
    let panNodeKey = null;
    mindTree.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      state.mindDragged = false;
      panNodeKey = e.target.closest(".mind-node") ? e.target.closest(".mind-node").dataset.key : null;
      state.panStart = {
        x: e.clientX,
        y: e.clientY,
        px: state.mindPan.x,
        py: state.mindPan.y,
      };
      mindTree.classList.add("panning");
      document.addEventListener("pointermove", onPanMove);
      document.addEventListener("pointerup", onPanUp);
      document.addEventListener("pointercancel", onPanEnd);
    });
    mindTree.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = mindTree.getBoundingClientRect();
        const factor = e.deltaY < 0 ? MIND_ZOOM_STEP : 1 / MIND_ZOOM_STEP;
        zoomMindAt(mindTree, e.clientX - rect.left, e.clientY - rect.top, factor);
      },
      { passive: false }
    );
    mindTree.addEventListener("dblclick", (e) => {
      if (e.target.closest(".mind-node")) return;
      resetMindView(mindTree);
    });
  }
}

App.register("mind-map", { bind: bindMindMap });