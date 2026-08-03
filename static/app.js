const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const AREAS = ["career", "health", "family", "learning", "finance", "other"];
const AREA_LABELS = {
  career: "Career",
  health: "Health",
  family: "Family",
  learning: "Learning",
  finance: "Finance",
  other: "Other",
};
const AREA_COLORS = {
  career: "#F5A623",
  health: "#6DC533",
  family: "#AAEB47",
  learning: "#E8E8E8",
  finance: "#C9A24A",
  other: "#5C5C5C",
};
const ENDPOINTS = {
  project: "/api/projects",
  learning: "/api/learnings",
  goal: "/api/goals",
  journal: "/api/journal",
};
const STATUS_COLORS = { active: "#AAEB47", backlog: "#9B9B9B", done: "#6DC533", paused: "#F5A623" };
const PRIO_COLORS = { high: "#F5A623", medium: "#AAEB47", low: "#6DC533" };
const JTYPE_COLORS = { milestone: "#6DC533", note: "#E8E8E8", reflection: "#F5A623" };
const CHART_GRID = "rgba(46,46,46,0.8)";
const CHART_LABEL = "#5C5C5C";
const CHART_TRACK = "#2E2E2E";
const DAYS7 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  dashboard: null,
  projects: [],
  learnings: [],
  journal: [],
  timeline: [],
  projectFilter: "all",
  timelineLoaded: false,
  growthDays: 30,
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function parseTags(tags) {
  return String(tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagChips(tags) {
  return parseTags(tags)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function isoFromDate(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function emptyState(msg) {
  return `<p class="empty">${esc(msg)}</p>`;
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const body = await res.json();
      if (body.detail) {
        msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

let toastTimer;
function toast(message, kind = "success") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function fld(label, input, required) {
  const star = required ? ' <span class="req">*</span>' : "";
  return `<div class="field"><label>${label}${star}</label>${input}</div>`;
}

function dateInput(id, defaultValue) {
  return `<input class="input" id="${id}" type="date"${defaultValue ? ` value="${defaultValue}"` : ""}>`;
}

const FIELD_SETS = {
  project: [
    fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
    fld("Description", '<textarea class="input" id="qa-description" rows="3"></textarea>'),
    fld(
      "Status",
      '<select class="input" id="qa-status"><option value="active">Active</option><option value="backlog">Backlog</option><option value="paused">Paused</option><option value="done">Done</option></select>'
    ),
    fld(
      "Priority",
      '<select class="input" id="qa-priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select>'
    ),
    fld("Target date", dateInput("qa-target_date")),
    fld(
      "Tags (comma separated)",
      '<textarea class="input" id="qa-tags" rows="2" placeholder="design, api, follow-up"></textarea>'
    ),
  ].join(""),
  learning: [
    fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
    fld("Content", '<textarea class="input" id="qa-content" rows="4"></textarea>'),
    fld("Date", dateInput("qa-date", todayISO())),
    fld(
      "Tags (comma separated)",
      '<textarea class="input" id="qa-tags" rows="2" placeholder="python, backend"></textarea>'
    ),
    fld("Related project", '<input class="input" id="qa-related_project" type="text">'),
  ].join(""),
  goal: [
    fld("Title", '<input class="input" id="qa-title" type="text" maxlength="200" autocomplete="off">', true),
    fld(
      "Area",
      '<select class="input" id="qa-area">' +
        AREAS.map((a) => `<option value="${a}">${AREA_LABELS[a]}</option>`).join("") +
        "</select>"
    ),
    fld("Description", '<textarea class="input" id="qa-description" rows="3"></textarea>'),
    fld("Progress (%)", '<input class="input" id="qa-progress" type="number" min="0" max="100" value="0">'),
    fld("Target date", dateInput("qa-target_date")),
    fld(
      "Status",
      '<select class="input" id="qa-goal_status"><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select>'
    ),
  ].join(""),
  journal: [
    fld("Date", dateInput("qa-date", todayISO())),
    fld(
      "Type",
      '<select class="input" id="qa-jtype"><option value="note">Note</option><option value="milestone">Milestone</option><option value="reflection">Reflection</option></select>'
    ),
    fld("Content", '<textarea class="input" id="qa-content" rows="4"></textarea>', true),
    fld("Related entity", '<input class="input" id="qa-related_entity" type="text" placeholder="Optional">'),
  ].join(""),
};

/* ---------- Chart helpers ---------- */

function lastNDates(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
    );
  }
  return out;
}

function countByDate(items) {
  const counts = {};
  items.forEach((i) => {
    const key = String(i.date || "").slice(0, 10);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

function makeLinePath(points) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function lineChart({
  series,
  xLabels,
  width = 440,
  height = 170,
  pad = { top: 18, right: 14, bottom: 26, left: 16 },
  strokeWidth = 2.5,
  showDots = true,
  labelEvery = 1,
}) {
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const n = xLabels.length;

  const getX = (i) => pad.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const getY = (v) => pad.top + ih - (v / max) * ih;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Chart",
  });

  for (let i = 0; i < n; i++) {
    svg.appendChild(
      svgEl("line", {
        x1: getX(i), y1: pad.top, x2: getX(i) - 16, y2: height - pad.bottom,
        stroke: CHART_GRID, "stroke-dasharray": "2 5",
      })
    );
    const label = svgEl("text", { x: getX(i), y: height - 6, fill: CHART_LABEL, "font-size": 9, "text-anchor": "middle" });
    label.textContent = i % labelEvery === 0 ? xLabels[i] : "";
    svg.appendChild(label);
  }

  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    const path = svgEl("path", {
      d: makeLinePath(pts),
      fill: "none",
      stroke: s.color,
      "stroke-width": strokeWidth,
      ...(s.dashed ? { "stroke-dasharray": "4 5" } : {}),
    });
    if (s.gradient && si === 0) {
      const grad = svgEl("linearGradient", { id: "lineGrad", x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
      [0, 0.5, 1].forEach((off, idx) => {
        const stop = svgEl("stop", {
          offset: `${off * 100}%`,
          "stop-color": idx === 1 ? "#AAEB47" : "rgba(170,235,71,0.35)",
        });
        grad.appendChild(stop);
      });
      svg.appendChild(grad);
      path.setAttribute("stroke", "url(#lineGrad)");
      path.style.filter = "drop-shadow(0px 3px 5px rgba(170,235,71,0.3))";
    }
    svg.appendChild(path);

    if (showDots) {
      pts.forEach((p) => {
        svg.appendChild(
          svgEl("circle", {
            cx: p.x, cy: p.y, r: s.gradient ? 3.4 : 3,
            fill: s.gradient ? "#AAEB47" : s.color,
            stroke: s.gradient ? "#111111" : "none",
            "stroke-width": s.gradient ? 1.5 : 0,
          })
        );
      });
    }
  });

  return svg;
}

function renderGrowthChart() {
  const days = state.growthDays;
  const dates = lastNDates(days);
  const learn = countByDate(state.learnings);
  const jour = countByDate(state.journal);
  $("#growth-range").textContent = days === 30 ? "Last 30 days" : "Last 90 days";

  const all = state.learnings.concat(state.journal);
  const byDate = {};
  all.forEach((i) => {
    const k = String(i.date || "").slice(0, 10);
    if (k) byDate[k] = (byDate[k] || 0) + 1;
  });

  const series = { learn: [], jour: [], total: [] };
  let cumL = 0, cumJ = 0;
  dates.forEach((d) => {
    cumL += learn[d] || 0;
    cumJ += jour[d] || 0;
    series.learn.push(cumL);
    series.jour.push(cumJ);
    series.total.push(cumL + cumJ);
  });

  const labels = dates.map((d) => formatDate(d).split(",")[0]);
  const container = $("#growth-chart");
  container.innerHTML = "";
  container.appendChild(
    lineChart({
      series: [
        { values: series.total, color: "#AAEB47", gradient: true },
        { values: series.learn, color: "#E8E8E8" },
        { values: series.jour, color: "#6DC533", dashed: true },
      ],
      xLabels: labels,
      labelEvery: days === 30 ? 4 : 9,
    })
  );
}

function donutSVG(parts, centerValue, centerLabel) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const r = 50, c = 2 * Math.PI * r;
  const svg = svgEl("svg", { viewBox: "0 0 120 120", role: "img" });
  svg.appendChild(svgEl("circle", { cx: 60, cy: 60, r, fill: "none", stroke: CHART_TRACK, "stroke-width": 14 }));
  let offset = 0;
  parts.forEach((p) => {
    if (p.value <= 0) return;
    const len = (p.value / total) * c;
    svg.appendChild(
      svgEl("circle", {
        cx: 60, cy: 60, r,
        fill: "none",
        stroke: p.color,
        "stroke-width": 14,
        "stroke-dasharray": `${len - 3} ${c - (len - 3)}`,
        "stroke-dashoffset": -offset,
      })
    );
    offset += len;
  });
  return { svg, total };
}

function renderDonut(el, parts, centerValue, centerLabel) {
  const { svg } = donutSVG(parts, centerValue, centerLabel);
  const wrap = document.createElement("div");
  wrap.className = "donut-row";
  const dWrap = document.createElement("div");
  dWrap.className = "donut-wrap";
  dWrap.appendChild(svg);
  const center = document.createElement("div");
  center.className = "donut-center";
  center.innerHTML = `<b>${centerValue}</b><span>${esc(centerLabel)}</span>`;
  dWrap.appendChild(center);
  wrap.appendChild(dWrap);

  const legend = document.createElement("div");
  legend.className = "donut-legend";
  parts.forEach((p) => {
    const item = document.createElement("div");
    item.className = "donut-item";
    item.innerHTML =
      `<span><span class="ldot" style="background:${p.color}"></span>${esc(p.label)}</span>` +
      `<b>${p.value}</b>`;
    legend.appendChild(item);
  });
  wrap.appendChild(legend);
  el.innerHTML = "";
  el.appendChild(wrap);
}

function renderHBar(el, items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  el.innerHTML = `<div class="hbar">` +
    items
      .map(
        (i) => `<div class="hbar-row">
          <span class="hbar-label" title="${esc(i.label)}">${esc(i.label)}</span>
          <div class="hbar-track"><div class="hbar-fill" style="background:${i.color};width:${Math.round((i.value / max) * 100)}%"></div></div>
          <span class="hbar-val">${i.value}</span>
        </div>`
      )
      .join("") +
    `</div>`;
}

function renderActivityHeatmap() {
  const counts = {};
  state.learnings.concat(state.journal).forEach((i) => {
    const k = String(i.date || "").slice(0, 10);
    if (k) counts[k] = (counts[k] || 0) + 1;
  });

  const weeks = 16;
  const cell = 11, gap = 3;
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDayOffset = ((end.getDay() + 1) % 7);
  const totalDays = weeks * 7 + startDayOffset;
  const start = new Date(end);
  start.setDate(end.getDate() - totalDays + 1);

  const dayLabel = svgEl("text", { x: 0, y: 8, fill: CHART_LABEL, "font-size": 9 });
  dayLabel.textContent = "Mon";
  const w = weeks * (cell + gap) + 14;
  const h = 7 * (cell + gap);
  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" });

  const max = Math.max(1, ...Object.values(counts));
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const col = Math.floor(i / 7);
    const row = i % 7;
    const iso = isoFromDate(d);
    const v = counts[iso] || 0;
    const inRange = d <= end && d >= start;
    const alpha = !inRange ? 0 : v === 0 ? 0.15 : 0.3 + (v / max) * 0.7;
    svg.appendChild(
      svgEl("rect", {
        x: col * (cell + gap) + 14,
        y: row * (cell + gap),
        width: cell,
        height: cell,
        rx: 2.5,
        fill: v > 0 ? "#6DC533" : CHART_TRACK,
        "fill-opacity": String(alpha),
      })
    );
    if (v > 0) {
      const title = svgEl("title", {});
      title.textContent = `${formatDate(iso)} — ${v} entry${v > 1 ? "s" : ""}`;
      svg.lastChild.appendChild(title);
    }
  }
  svg.prepend(dayLabel);
  $("#heatmap-chart").innerHTML = "";
  $("#heatmap-chart").appendChild(svg);
  const withActivity = Object.values(counts).filter((v) => v > 0).length;
  $("#heatmap-sub").textContent = `${withActivity} active days in the last ${weeks * 7} days`;
}

function monthKey(iso) {
  return String(iso || "").slice(0, 7);
}

function renderMonthlyBars(el) {
  const counts = {};
  state.learnings.concat(state.journal).forEach((i) => {
    const k = monthKey(i.date);
    if (k) counts[k] = (counts[k] || 0) + 1;
  });
  const months = Object.keys(counts).sort().slice(-8);
  if (!months.length) {
    el.innerHTML = emptyState("No entries yet.");
    return;
  }
  const max = Math.max(1, ...months.map((m) => counts[m]));
  el.innerHTML = `<div class="hbar">` +
    months
      .map((m) => {
        const label = new Date(m + "-01").toLocaleDateString(undefined, { month: "short", year: "2-digit" });
        return `<div class="hbar-row">
          <span class="hbar-label">${label}</span>
          <div class="hbar-track"><div class="hbar-fill" style="background:#6DC533;width:${Math.round((counts[m] / max) * 100)}%"></div></div>
          <span class="hbar-val">${counts[m]}</span>
        </div>`;
      })
      .join("") +
    `</div>`;
}

function renderTagFreq(el) {
  const freq = {};
  state.learnings.forEach((l) => parseTags(l.tags).forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  state.projects.forEach((p) => parseTags(p.tags).forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  const items = Object.entries(freq)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  if (!items.length) {
    el.innerHTML = emptyState("No tags yet.");
    return;
  }
  renderHBar(el, items.map((i, idx) => ({ ...i, color: ["#AAEB47", "#E8E8E8", "#F5A623", "#6DC533", "#C9A24A", "#9B9B9B"][idx % 6] })));
}

function renderGoalsByArea(el) {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const byArea = {};
  goals.forEach((g) => {
    const a = AREAS.includes(g.area) ? g.area : "other";
    byArea[a] = byArea[a] || [];
    byArea[a].push(Number(g.progress) || 0);
  });
  const items = Object.entries(byArea).map(([area, progs]) => ({
    label: AREA_LABELS[area] || area,
    value: Math.round(progs.reduce((s, p) => s + p, 0) / progs.length),
    color: AREA_COLORS[area] || AREA_COLORS.other,
  }));
  if (!items.length) {
    el.innerHTML = emptyState("No goals yet.");
    return;
  }
  renderHBar(el, items);
}

function renderWeeklyChart() {
  const counts = countByDate(state.learnings);
  const today = new Date();
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - ((today.getDay() + 7) % 7) + i);
    const iso =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    days.push(iso);
  }
  const thisWeek = days.map((d) => counts[d] || 0);
  const lastWeek = days.map((d) => {
    const dt = new Date(d + "T00:00:00");
    dt.setDate(dt.getDate() - 7);
    const iso =
      dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    return counts[iso] || 0;
  });

  $("#weekly-total").textContent = thisWeek.reduce((a, b) => a + b, 0);

  const container = $("#weekly-chart");
  container.innerHTML = "";
  const svg = lineChart({
    series: [
      { values: thisWeek, color: "#AAEB47" },
      { values: lastWeek, color: "#5C5C5C", dashed: true },
    ],
    xLabels: DAYS7,
    width: 320,
    height: 150,
    pad: { top: 12, right: 10, bottom: 24, left: 10 },
  });
  container.appendChild(svg);
}

function hexLayout(total) {
  const dirs = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ];
  const coords = [[0, 0]];
  let ring = 1;
  while (coords.length < total) {
    let q = ring, r = 0;
    for (const [dq, dr] of dirs) {
      for (let i = 0; i < ring; i++) {
        coords.push([q, r]);
        q += dq;
        r += dr;
      }
    }
    ring++;
  }
  return coords.slice(0, total);
}

function renderHexAreas() {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const byArea = {};
  goals.forEach((g) => {
    const a = AREAS.includes(g.area) ? g.area : "other";
    byArea[a] = (byArea[a] || 0) + 1;
  });
  const present = AREAS.filter((a) => byArea[a]);

  const total = Math.max(1, present.length * 3);
  const coords = hexLayout(total);
  const size = 8;
  const hw = Math.sqrt(3) * size;
  const hh = 2 * size;
  const vert = hh * 0.75;
  const horiz = hw;

  const xs = coords.map(([q, r]) => q * horiz + (r % 2 === 1 ? horiz / 2 : 0));
  const ys = coords.map(([, r]) => r * vert);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const w = maxX - minX + horiz + 12;
  const h = maxY - minY + hh + 12;

  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%" });
  const g = svgEl("g", { transform: `translate(${6 - minX}, ${6 - minY})` });

  const sorted = present.slice().sort((a, b) => (byArea[b] || 0) - (byArea[a] || 0));
  coords.forEach(([q, r], i) => {
    const x = q * horiz + (r % 2 === 1 ? horiz / 2 : 0);
    const y = r * vert;
    const area = sorted[i % sorted.length];
    const intensity = byArea[area] >= 3 ? 1 : byArea[area] === 2 ? 0.72 : 0.5;
    const color = AREA_COLORS[area] || AREA_COLORS.other;
    const pts =
      `${x},${y - size} ${x + hw / 2},${y - size / 2} ${x + hw / 2},${y + size / 2} ` +
      `${x},${y + size} ${x - hw / 2},${y + size / 2} ${x - hw / 2},${y - size / 2}`;
    g.appendChild(
      svgEl("polygon", {
        points: pts,
        fill: color,
        "fill-opacity": intensity,
        stroke: CHART_TRACK,
        "stroke-width": 1.4,
      })
    );
  });

  svg.appendChild(g);
  const wrap = $("#hex-cluster");
  wrap.innerHTML = "";
  wrap.appendChild(svg);

  $("#hex-list").innerHTML = present.length
    ? present
        .map(
          (a) =>
            `<div class="hex-item"><span><span class="ldot" style="background:${AREA_COLORS[a]}"></span>${AREA_LABELS[a]}</span><b>${byArea[a]}</b></div>`
        )
        .join("")
    : `<div class="hex-item"><span style="color:var(--color-text-dim)">No goals yet</span></div>`;
}

function renderWeekdayChart() {
  const learn = countByDate(state.learnings);
  const jour = countByDate(state.journal);
  const today = new Date();
  const values = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - ((today.getDay() - i + 7) % 7));
    const iso =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    values.push((learn[iso] || 0) + (jour[iso] || 0));
  }
  const max = Math.max(1, ...values);
  const wrap = $("#weekday-chart");
  wrap.innerHTML = values
    .map((v, i) => {
      const hot = i === today.getDay();
      const pct = Math.max(6, Math.round((v / max) * 100));
      return `<div class="wd-col${hot ? " hot" : ""}">
        <div class="wd-bar-wrap"><div class="wd-bar" style="height:${pct}%"></div></div>
        <span class="wd-value">${v}</span>
        <span class="wd-label">${DAYS7[i]}</span>
      </div>`;
    })
    .join("");
}

function renderProjectsCharts() {
  const statusCounts = { active: 0, backlog: 0, done: 0, paused: 0 };
  const prioCounts = { high: 0, medium: 0, low: 0 };
  state.projects.forEach((p) => {
    if (statusCounts[p.status] !== undefined) statusCounts[p.status]++;
    if (prioCounts[p.priority] !== undefined) prioCounts[p.priority]++;
  });

  renderDonut(
    $("#projects-status"),
    ["active", "backlog", "done", "paused"].map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: statusCounts[s],
      color: STATUS_COLORS[s],
    })),
    state.projects.length,
    "projects"
  );
  renderHBar(
    $("#projects-priority"),
    ["high", "medium", "low"].map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: prioCounts[s],
      color: PRIO_COLORS[s],
    }))
  );
}

/* ---------- Card renderers ---------- */

function projectTaskList(p) {
  const tasks = tasksFor(p.id);
  if (!tasks.length) {
    return `<div class="proj-tasks empty-tasks">No tasks yet.</div>`;
  }
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pct = Math.round((doneCount / tasks.length) * 100);
  const rows = tasks
    .map(
      (t) => `<div class="pt-row${t.status === "done" ? " done" : ""}">
        ${taskCheckbox(t)}
        <span class="pt-title">${esc(t.title)}</span>
        <span class="pt-state pt-${esc(t.status)}">${esc(t.status)}</span>
      </div>`
    )
    .join("");
  return `<div class="proj-progress">
      <span class="proj-progress-label">${doneCount}/${tasks.length} done</span>
      <div class="proj-progress-track"><div class="proj-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="proj-tasks">${rows}</div>`;
}

function projectCard(p) {
  const prio = p.priority || "medium";
  const done = p.status === "done";
  return `<article class="card project-card">
    <div class="card-head">
      <h3 class="card-title">${esc(p.title)}</h3>
      <span class="badge badge-prio prio-${esc(prio)}">${esc(prio)}</span>
    </div>
    ${p.description ? `<p class="card-text">${esc(p.description)}</p>` : ""}
    <div class="card-meta">
      ${p.target_date ? `<span class="meta">Target: ${esc(formatDate(p.target_date))}</span>` : ""}
      ${!done && p.status !== "active" ? `<span class="badge badge-status">${esc(p.status)}</span>` : ""}
    </div>
    <div class="chips">${tagChips(p.tags)}</div>
    <div class="proj-task-block">
      ${done ? "" : projectTaskList(p)}
      <div class="add-task">
        <input class="input add-task-input" type="text" placeholder="Add a task..." aria-label="Add a task to ${esc(p.title)}" maxlength="200" autocomplete="off">
        <button class="btn btn-sm add-task-btn" data-action="task-add" data-id="${p.id}">Add</button>
      </div>
    </div>
    <div class="card-actions">
      ${done ? `<span class="meta">Done</span>` : `<button class="btn btn-sm" data-action="done" data-type="project" data-id="${p.id}">Mark done</button>`}
      <button class="btn btn-sm btn-danger" data-action="delete" data-type="project" data-id="${p.id}">Delete</button>
    </div>
  </article>`;
}

function journalCard(j) {
  return `<article class="card journal-card">
    <div class="card-head">
      <span class="badge badge-jtype jt-${esc(j.type)}">${esc(j.type)}</span>
      <span class="meta">${esc(formatDate(j.date))}</span>
    </div>
    <p class="card-text">${esc(j.content)}</p>
    ${j.related_entity ? `<div class="card-meta"><span class="meta">${esc(j.related_entity)}</span></div>` : ""}
    <div class="card-actions">
      <button class="btn btn-sm btn-danger" data-action="delete" data-type="journal" data-id="${j.id}">Delete</button>
    </div>
  </article>`;
}

function goalCard(g) {
  const p = Math.max(0, Math.min(100, Math.round(Number(g.progress) || 0)));
  return `<article class="card goal-card">
    <div class="card-head">
      <h3 class="card-title">${esc(g.title)}</h3>
      <span class="badge badge-goal-status gs-${esc(g.status)}">${esc(g.status)}</span>
    </div>
    ${g.description ? `<p class="card-text">${esc(g.description)}</p>` : ""}
    <div class="progress-wrap">
      <div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill" style="width:${p}%"></div>
      </div>
      <span class="progress-pct">${p}%</span>
    </div>
    ${g.target_date ? `<div class="card-meta"><span class="meta">Target: ${esc(formatDate(g.target_date))}</span></div>` : ""}
  </article>`;
}

function timelineItem(t) {
  return `<article class="card timeline-item ${"kind-" + esc(t.kind)}">
    <div class="timeline-head">
      <span class="badge badge-kind ${"kind-" + esc(t.kind)}">${esc(t.kind)}</span>
      <span class="meta">${esc(formatDate(t.date))}</span>
    </div>
    <h3 class="card-title">${esc(t.title)}</h3>
    ${t.body ? `<p class="card-text timeline-body">${esc(t.body)}</p>` : ""}
    ${parseTags(t.tags).length ? `<div class="chips">${tagChips(t.tags)}</div>` : ""}
  </article>`;
}

/* ---------- Renderers ---------- */

function updateClock() {
  const now = new Date();
  const options = {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  $("#today").textContent = now.toLocaleDateString("en-US", options).replace(",", " -");
}

const AFFIRMATIONS = [
  "Three things are on your list today.",
  "Clear evening ahead.",
  "One step at a time.",
  "Today has a little room for the unexpected.",
  "Small progress is still progress.",
  "You are exactly where you need to be.",
];

function greetingForHour(h) {
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

function renderGreeting() {
  const now = new Date();
  $("#greet-line").textContent = greetingForHour(now.getHours());
  $("#greet-date").textContent =
    now.toLocaleDateString(undefined, { weekday: "long" }) +
    " · " +
    now.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  $("#affirmation").textContent = AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
}

function renderTodayRing() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = now - start;
  const total = 86400000;
  const frac = Math.min(1, Math.max(0, elapsed / total));
  const r = 96;
  const circ = 2 * Math.PI * r;
  const ring = $("#ring-progress");
  const target = circ * (1 - frac);
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ring.style.transition = "none";
  }
  ring.style.strokeDasharray = circ.toFixed(2);
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = target.toFixed(2);
  });
}

function renderDayTimeline() {
  const today = todayISO();
  const items = [];
  state.journal
    .filter((j) => j.date === today)
    .forEach((j) => items.push({ kind: "journal", title: j.content, meta: j.type }));
  state.learnings
    .filter((l) => l.date === today)
    .forEach((l) => items.push({ kind: "learning", title: l.title, meta: "learning" }));
  $("#day-timeline-sub").textContent = items.length ? `${items.length} item${items.length > 1 ? "s" : ""}` : "";
  $("#day-timeline").innerHTML = items.length
    ? items
        .map(
          (it) => `<div class="spine-item ${"kind-" + esc(it.kind)}">
            <div class="spine-body">
              <p class="spine-title">${esc(it.title)}</p>
              <span class="spine-meta">${esc(it.meta)}</span>
            </div>
          </div>`
        )
        .join("")
    : `<p class="spine-empty">Nothing on the timeline yet — a clear day.</p>`;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const TASK_STATE_ORDER = { in_progress: 0, planned: 1, wanted: 2, done: 3 };

function tasksFor(projectId) {
  const map = (state.dashboard && state.dashboard.tasks_by_project) || {};
  return map[String(projectId)] || [];
}

function taskCheckbox(task, opts = {}) {
  const done = task.status === "done";
  return `<button class="checkbox${done ? " checked" : ""}" data-action="task-toggle" data-id="${task.id}" data-project="${task.project_id}" aria-label="${done ? "Completed" : "Mark done"}" title="Toggle done">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
  </button>`;
}

function renderFocus() {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const active = state.projects.filter((p) => p.status === "active");
  const sorted = active.slice().sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    return pa - pb || String(a.target_date || "9999").localeCompare(String(b.target_date || "9999"));
  });
  const focus = sorted[0];

  if (focus) {
    const tasks = tasksFor(focus.id);
    const nextUp = tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => (TASK_STATE_ORDER[a.status] ?? 9) - (TASK_STATE_ORDER[b.status] ?? 9))
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))[0];
    if (nextUp) {
      $("#focus-body").innerHTML = `<div class="focus-row">
        ${taskCheckbox(nextUp)}
        <div class="focus-body">
          <p class="focus-title">${esc(nextUp.title)}</p>
          <p class="focus-meta">${esc(focus.title)} · ${esc(nextUp.status)}</p>
        </div>
      </div>`;
      return;
    }
    $("#focus-body").innerHTML = `<div class="focus-row">
      <button class="checkbox" data-action="done" data-type="project" data-id="${focus.id}" aria-label="Mark done" title="Mark done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </button>
      <div class="focus-body">
        <p class="focus-title">${esc(focus.title)}</p>
        <p class="focus-meta">${esc(focus.priority)} priority · ${focus.target_date ? "due " + esc(formatDate(focus.target_date)) : "no deadline"}</p>
      </div>
    </div>`;
    return;
  }

  const goal = goals.find((g) => g.status === "active");
  if (goal) {
    $("#focus-body").innerHTML = `<div class="focus-row">
      <div class="focus-body"><p class="focus-title">${esc(goal.title)}</p>
      <p class="focus-meta">${esc(AREA_LABELS[goal.area] || goal.area)} goal</p></div>
    </div>`;
  } else {
    $("#focus-body").innerHTML = `<p class="focus-empty">Nothing demanding attention today.</p>`;
  }
}

function renderUpcoming() {
  const today = todayISO();
  const upcoming = state.projects
    .filter((p) => p.status !== "done" && p.target_date && p.target_date >= today)
    .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))
    .slice(0, 3);
  $("#upcoming-body").innerHTML = upcoming.length
    ? upcoming
        .map(
          (p) => `<div class="upcoming-item">
            <span class="upcoming-title">${esc(p.title)}</span>
            <span class="upcoming-date">${esc(formatDate(p.target_date))}</span>
          </div>`
        )
        .join("")
    : `<p class="focus-empty">Nothing scheduled.</p>`;
}

function renderTasks() {
  const active = state.projects.filter((p) => p.status === "active");
  const rows = [];
  active.forEach((p) => {
    tasksFor(p.id).forEach((t) => {
      rows.push({ task: t, projectTitle: p.title });
    });
  });
  rows.sort((a, b) => (TASK_STATE_ORDER[a.task.status] ?? 9) - (TASK_STATE_ORDER[b.task.status] ?? 9));
  const open = rows.filter((r) => r.task.status !== "done");
  const done = rows.filter((r) => r.task.status === "done").slice(0, 4);

  if (!open.length && !done.length) {
    $("#tasks-body").innerHTML = `<p class="task-empty">No tasks yet. Add tasks under a project to begin.</p>`;
    return;
  }
  const taskMeta = (t) => {
    const pc = PRIO_COLORS[t.priority] || "#9B9B9B";
    const dl = daysLabel(t.due_date, todayISO());
    const parts = [];
    parts.push(`<span class="task-chip task-prio" style="--chip:${pc}">${esc(t.priority)}</span>`);
    parts.push(`<span class="task-chip task-state">${esc(t.status)}</span>`);
    if (t.due_date) parts.push(`<span class="task-due ${dl.cls}">${esc(dl.text)}</span>`);
    return parts.join("");
  };
  const rowHTML = (r, isDone) => `<label class="task-row${isDone ? " done" : ""}">
    <button class="checkbox${isDone ? " checked" : ""}" ${isDone ? "disabled aria-hidden='true'" : ""} data-action="task-toggle" data-id="${r.task.id}" data-project="${r.task.project_id}" aria-label="${isDone ? "Completed" : "Mark done"}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
    </button>
    <span class="task-label">${esc(r.task.title)} <span class="task-project">${esc(r.projectTitle)}</span></span>
    <span class="task-meta">${taskMeta(r.task)}</span>
  </label>`;
  $("#tasks-body").innerHTML = [...open.map((r) => rowHTML(r, false)), ...done.map((r) => rowHTML(r, true))].join("");
}

function renderHabits() {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const activeGoals = goals.filter((g) => g.status === "active");
  if (!activeGoals.length) {
    $("#habits-body").innerHTML = `<p class="habit-empty">No habits tracked yet — add goals to begin.</p>`;
    return;
  }
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(isoFromDate(d));
  }
  const activity = countByDate(state.learnings.concat(state.journal));
  const dayLabels = days.map((iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }));
  $("#habits-body").innerHTML = activeGoals
    .map((g) => {
      const area = AREAS.includes(g.area) ? g.area : "other";
      const color = AREA_COLORS[area];
      const initial = (AREA_LABELS[area] || area).charAt(0).toUpperCase();
      const dots = days
        .map((iso, i) => `<span class="habit-dot${activity[iso] ? " on" : ""}" title="${dayLabels[i]}"></span>`)
        .join("");
      return `<div class="habit-row">
        <span class="habit-badge" style="background:${color}">${esc(initial)}</span>
        <div>
          <p class="habit-name">${esc(g.title)}</p>
          <div class="habit-dots">${dots}</div>
        </div>
      </div>`;
    })
    .join("");
}

/* ---------- Metric cards ---------- */

function sparkline(values, { color = "#6DC533", width = 320, height = 48 } = {}) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const iw = width - 4;
  const ih = height - 8;
  const getX = (i) => 2 + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const getY = (v) => 4 + ih - (v / max) * ih;
  const pts = values.map((v, i) => ({ x: getX(i), y: getY(v) }));

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", role: "img", "aria-label": "Sparkline" });
  const grad = svgEl("linearGradient", { id: "sparkGrad", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
  grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.35" }));
  grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
  svg.appendChild(grad);

  const area = `${makeLinePath(pts)} L ${getX(n - 1)} ${height} L ${getX(0)} ${height} Z`;
  svg.appendChild(svgEl("path", { d: area, fill: "url(#sparkGrad)" }));
  svg.appendChild(svgEl("path", { d: makeLinePath(pts), fill: "none", stroke: color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  return svg;
}

function metricDelta(current, previous) {
  const diff = current - previous;
  const pct = previous === 0 ? (diff === 0 ? 0 : 100) : Math.round((Math.abs(diff) / previous) * 100);
  return { diff, pct, up: diff >= 0 };
}

function renderMetricProjects() {
  const active = state.projects.filter((p) => p.status === "active").length;
  const now = new Date();
  const thisM = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevM = prevD.getFullYear() + "-" + String(prevD.getMonth() + 1).padStart(2, "0");
  const doneThis = state.projects.filter((p) => p.status === "done" && String(p.updated_at || "").slice(0, 7) === thisM).length;
  const donePrev = state.projects.filter((p) => p.status === "done" && String(p.updated_at || "").slice(0, 7) === prevM).length;
  const d = metricDelta(doneThis, donePrev);

  const dates = lastNDates(14);
  const created = dates.map((iso) => state.projects.filter((p) => String(p.created_at || "").slice(0, 10) === iso).length);
  const color = d.up ? "#6DC533" : "#F5A623";

  $("#metric-projects").innerHTML = `
    <div class="metric-top">
      <div><div class="metric-value">${active}</div><div class="metric-sublabel">active projects</div></div>
      <span class="metric-badge ${d.up ? "up" : "down"}"><span>${d.up ? "▲" : "▼"}</span>${d.pct}%</span>
    </div>
    <div class="metric-note">${d.diff >= 0 ? "+" : ""}${d.diff} finished this month</div>
    <div class="metric-spark">${sparkline(created, { color }).outerHTML}</div>`;
}

function renderMetricKnowledge() {
  const counts = countByDate(state.learnings);
  const thisWeek = lastNDates(7).reduce((s, d) => s + (counts[d] || 0), 0);
  const prevDates = lastNDates(14).slice(0, 7);
  const prevWeek = prevDates.reduce((s, d) => s + (counts[d] || 0), 0);
  const d = metricDelta(thisWeek, prevWeek);

  const daily = lastNDates(14).map((iso) => counts[iso] || 0);
  const color = d.up ? "#6DC533" : "#F5A623";

  $("#metric-knowledge").innerHTML = `
    <div class="metric-top">
      <div><div class="metric-value">${thisWeek}</div><div class="metric-sublabel">learnings this week</div></div>
      <span class="metric-badge ${d.up ? "up" : "down"}"><span>${d.up ? "▲" : "▼"}</span>${d.pct}%</span>
    </div>
    <div class="metric-note">${d.diff >= 0 ? "+" : ""}${d.diff} vs last week · ${state.learnings.length} total</div>
    <div class="metric-spark">${sparkline(daily, { color }).outerHTML}</div>`;
}

function renderMetrics() {
  renderMetricProjects();
  renderMetricKnowledge();
}

/* ---------- Projects Timeline Gantt ---------- */

function dayIndex(iso, start) {
  const t = new Date(String(iso || "").slice(0, 10) + "T00:00:00");
  if (isNaN(t)) return 0;
  return Math.max(0, Math.min(30, Math.round((t - start) / 86400000)));
}

function ganttShort(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return String(iso);
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

function projectInitial(title) {
  return esc(String(title || "?").trim().charAt(0).toUpperCase() || "?");
}

function renderGantt() {
  const projects = state.projects.filter((p) => p.status !== "done");
  if (!projects.length) {
    $("#gantt-chart").innerHTML = `<p class="empty">No active projects to chart.</p>`;
    return;
  }

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const rows = projects
    .map((p) => {
      const tasks = tasksFor(p.id);
      let first = null;
      let last = null;
      tasks.forEach((t) => {
        const created = String(t.created_at || "").slice(0, 10);
        const due = t.due_date;
        if (created && (!first || created < first)) first = created;
        if (due && (!last || due > last)) last = due;
        if (created && (!last || created > last)) last = created;
      });
      if (!first) first = String(p.created_at || "").slice(0, 10);
      if (!last) last = first;
      const open = tasks.filter((t) => t.status !== "done");
      const overdue = open.some((t) => t.due_date && t.due_date < todayISO());
      const left = dayIndex(first, start);
      const right = Math.max(left + 1, dayIndex(last, start));
      return { p, tasks, first, last, open, overdue, left, right };
    })
    .sort((a, b) => String(a.first).localeCompare(String(b.first)));

  const bars = rows
    .map((r) => {
      const pct = (n) => `${Math.round((n / 30) * 100)}%`;
      return `<div class="gantt-row">
        <div class="gantt-label">
          <span class="gantt-name" title="${esc(r.p.title)}">${esc(r.p.title)}</span>
          <span class="gantt-date">${ganttShort(r.first)}</span>
        </div>
        <div class="gantt-track">
          <div class="gantt-bar ${r.overdue ? "warn" : "ok"}" style="left:${pct(r.left)};width:${pct(r.right - r.left)}">
            <span class="gantt-dot">${projectInitial(r.p.title)}</span>
            <span class="gantt-count">${r.tasks.length}</span>
          </div>
        </div>
      </div>`;
    })
    .join("");

  const ticks = Array.from({ length: 31 }, (_, i) => (i % 5 === 0 ? i : "")).map((i) => `<span class="gantt-tick">${i === 0 ? "" : i}</span>`).join("");

  $("#gantt-chart").innerHTML = `<div class="gantt">
    ${bars}
    <div class="gantt-axis">
      <span></span>
      <div class="gantt-ticks">${ticks}</div>
    </div>
  </div>`;
}

function daysLabel(iso, today) {
  if (!iso) return { text: "no deadline", cls: "" };
  const ms = new Date(iso + "T00:00:00") - new Date(today + "T00:00:00");
  const d = Math.round(ms / 86400000);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, cls: "overdue" };
  if (d === 0) return { text: "due today", cls: "today" };
  if (d === 1) return { text: "due tomorrow", cls: "" };
  if (d <= 7) return { text: `due in ${d}d`, cls: "" };
  return { text: `due in ${d}d`, cls: "" };
}

function allOpenTasks() {
  const rows = [];
  state.projects.forEach((p) => {
    tasksFor(p.id).forEach((t) => {
      if (t.status !== "done") rows.push({ task: t, projectTitle: p.title });
    });
  });
  return rows;
}

function renderDailyBrief() {
  const today = todayISO();
  const open = allOpenTasks();
  const overdue = open.filter((r) => r.task.due_date && r.task.due_date < today);
  const dueWeek = open.filter((r) => {
    if (!r.task.due_date) return false;
    const ms = new Date(r.task.due_date + "T00:00:00") - new Date(today + "T00:00:00");
    const d = Math.round(ms / 86400000);
    return d >= 0 && d <= 7;
  });
  const top5 = open
    .slice()
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.task.priority] ?? 1) - (PRIORITY_ORDER[b.task.priority] ?? 1) ||
        String(a.task.due_date || "9999").localeCompare(String(b.task.due_date || "9999"))
    )
    .slice(0, 5);

  const focus = overdue.length ? overdue[0] : top5.length ? top5[0] : null;

  const recent = state.learnings
    .filter((l) => {
      const ms = new Date(today + "T00:00:00") - new Date(String(l.date || "").slice(0, 10) + "T00:00:00");
      return ms >= 0 && ms <= 6 * 86400000;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  const briefRow = (r) => {
    const t = r.task;
    const dl = daysLabel(t.due_date, today);
    const pc = PRIO_COLORS[t.priority] || "#9B9B9B";
    return `<div class="brief-row">
      <span class="brief-prio" style="background:${pc}"></span>
      <div class="brief-row-body">
        <p class="brief-title">${esc(t.title)} <span class="brief-project">${esc(r.projectTitle)}</span></p>
        ${t.due_date ? `<span class="brief-meta ${dl.cls}">${esc(dl.text)}</span>` : `<span class="brief-meta">no deadline</span>`}
      </div>
    </div>`;
  };

  const atomRows = recent
    .map(
      (l) => `<div class="brief-row brief-atom">
        <span class="brief-atom-dot"></span>
        <div class="brief-row-body">
          <p class="brief-title">${esc(l.title)}</p>
          <span class="brief-meta">${esc(formatDate(l.date))}${l.related_project ? " · " + esc(l.related_project) : ""}</span>
        </div>
      </div>`
    )
    .join("");

  $("#brief-body").innerHTML = `
    <div class="brief-section">
      <h4 class="brief-h">Overdue</h4>
      ${overdue.length ? overdue.map(briefRow).join("") : `<p class="brief-none">Nothing overdue — great.</p>`}
    </div>
    <div class="brief-section">
      <h4 class="brief-h">Due this week</h4>
      ${dueWeek.length ? dueWeek.map(briefRow).join("") : `<p class="brief-none">Nothing due in the next 7 days.</p>`}
    </div>
    <div class="brief-section">
      <h4 class="brief-h">Top priorities</h4>
      ${top5.length ? top5.map((r, i) => `<div class="brief-row">
        <span class="brief-rank">${i + 1}</span>
        <div class="brief-row-body">
          <p class="brief-title">${esc(r.task.title)} <span class="brief-project">${esc(r.projectTitle)}</span></p>
          <span class="brief-meta">${esc(r.task.status)} · ${esc(daysLabel(r.task.due_date, today).text)}</span>
        </div>
      </div>`).join("") : `<p class="brief-none">No open tasks to prioritise.</p>`}
    </div>
    <div class="brief-section">
      <h4 class="brief-h">Focus today</h4>
      ${focus ? `<p class="brief-focus">${esc(focus.task.title)} <span class="brief-project">(${esc(focus.projectTitle)})</span></p>` : `<p class="brief-none">Nothing demanding attention.</p>`}
    </div>
    <div class="brief-section">
      <h4 class="brief-h">Recent learnings</h4>
      ${recent.length ? atomRows : `<p class="brief-none">No learnings in the last 7 days.</p>`}
    </div>`;
}

function renderProjectTree() {
  const rows = state.projects
    .map((p) => {
      const tasks = tasksFor(p.id);
      const total = tasks.length;
      const done = tasks.filter((t) => t.status === "done").length;
      const open = total - done;
      const overdue = tasks.some((t) => t.status !== "done" && t.due_date && t.due_date < todayISO());
      const pct = total ? Math.round((done / total) * 100) : 0;
      const sc = STATUS_COLORS[p.status] || "#9B9B9B";
      const pc = PRIO_COLORS[p.priority] || "#9B9B9B";
      return `<div class="tree-row">
        <div class="tree-label">
          <span class="tree-status" style="background:${sc}"></span>
          <span class="tree-name" title="${esc(p.title)}">${esc(p.title)}</span>
          <span class="tree-meta">${esc(p.status)} · ${esc(p.priority)}</span>
        </div>
        <div class="tree-bar-track">
          <div class="tree-bar-fill ${overdue ? "warn" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="tree-count ${overdue ? "overdue" : ""}">${done}/${total} done${overdue ? " · overdue" : ""}</div>
      </div>`;
    })
    .join("");
  $("#project-tree").innerHTML = rows || `<p class="empty">No projects yet. Add one to begin.</p>`;
}

function renderDaily() {
  renderDailyBrief();
  renderGreeting();
  renderTodayRing();
  renderDayTimeline();
  renderFocus();
  renderUpcoming();
  renderTasks();
  renderHabits();
}

function renderOverview(d) {
  renderMetrics();
  renderGantt();
  renderDaily();
  renderOverviewCharts();
  renderGoalsAreaChart();
}

function renderOverviewCharts() {
  renderGrowthChart();
  renderActivityHeatmap();
  renderDonut(
    $("#status-donut"),
    ["active", "backlog", "done", "paused"].map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: state.projects.filter((p) => p.status === s).length,
      color: STATUS_COLORS[s],
    })),
    state.projects.length,
    "projects"
  );
  renderDonut(
    $("#journal-donut"),
    ["milestone", "note", "reflection"].map((t) => ({
      label: t.charAt(0).toUpperCase() + t.slice(1),
      value: state.journal.filter((j) => j.type === t).length,
      color: JTYPE_COLORS[t],
    })),
    state.journal.length,
    "entries"
  );
  renderGoalsByArea($("#goal-progress"));
  renderTagFreq($("#tag-freq"));
  renderWeeklyChart();
  renderWeekdayChart();
  renderHexAreas();
}

function colBlock(title, items) {
  return `<section class="project-col" aria-label="${esc(title)}">
    <h3 class="col-title">${esc(title)} <span class="count">${items.length}</span></h3>
    <div class="card-grid">${items.length ? items.map(projectCard).join("") : emptyState("Nothing here yet.")}</div>
  </section>`;
}

function renderProjects() {
  renderProjectTree();
  const f = state.projectFilter;
  const all = state.projects;
  const labels = { active: "Active", backlog: "Backlog / Roadmap", done: "Done", paused: "Paused" };
  const cols = $("#projects-cols");
  if (f === "all") {
    cols.classList.remove("single");
    cols.innerHTML =
      colBlock("Active", all.filter((p) => p.status === "active")) +
      colBlock("Backlog / Roadmap", all.filter((p) => p.status === "backlog"));
  } else {
    cols.classList.add("single");
    cols.innerHTML = colBlock(labels[f] || f, all.filter((p) => p.status === f));
  }
}

function renderGoalsAreaChart() {
  renderGoalsByArea($("#goals-area-chart"));
}

function renderKnowledgeCharts() {
  renderTagFreq($("#knowledge-tags"));
  const dates = lastNDates(60);
  const counts = countByDate(state.learnings);
  const vals = dates.map((d) => counts[d] || 0);
  const labels = dates.map((d) => formatDate(d).split(",")[0]);
  const container = $("#knowledge-trend");
  container.innerHTML = "";
  container.appendChild(
    lineChart({
      series: [{ values: vals, color: "#AAEB47" }],
      xLabels: labels,
      labelEvery: 9,
    })
  );
}

function renderTimelineMonthly() {
  renderMonthlyBars($("#timeline-monthly"));
}

function renderGoals() {
  const goals = (state.dashboard && state.dashboard.goals) || [];
  const groups = {};
  AREAS.forEach((a) => (groups[a] = []));
  goals.forEach((g) => (groups[g.area] || groups.other).push(g));
  let html = "";
  AREAS.forEach((a) => {
    const list = groups[a];
    if (!list.length) return;
    html += `<section class="goal-area goal-area-${esc(a)}">
      <h3 class="goal-area-title">${AREA_LABELS[a] || a} <span class="count">${list.length}</span></h3>
      <div class="goal-grid">${list.map(goalCard).join("")}</div>
    </section>`;
  });
  $("#goals-list").innerHTML = html || emptyState("No goals yet. Add one with the + New button.");
}

function renderLearnings() {
  const tag = $("#learn-tag-filter").value.trim().toLowerCase();
  const date = $("#learn-date-filter").value;
  const list = state.learnings
    .filter((l) => {
      if (tag && !(l.tags || "").toLowerCase().includes(tag)) return false;
      if (date && l.date !== date) return false;
      return true;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!list.length) {
    $("#learn-list").innerHTML = emptyState("No learnings match your filters.");
    return;
  }
  const groups = {};
  list.forEach((l) => {
    const key = l.related_project || "Unattributed";
    (groups[key] = groups[key] || []).push(l);
  });
  const ledger = Object.keys(groups)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((proj) => {
      const atoms = groups[proj]
        .map(
          (l) => `<div class="atom-row">
            <span class="atom-date">${esc(formatDate(l.date))}</span>
            <div class="atom-body">
              <p class="atom-title">${esc(l.title)}</p>
              ${l.content ? `<p class="atom-text">${esc(l.content)}</p>` : ""}
              <div class="chips">${tagChips(l.tags)}</div>
            </div>
            <button class="btn btn-sm btn-danger" data-action="delete" data-type="learning" data-id="${l.id}">Delete</button>
          </div>`
        )
        .join("");
      return `<section class="atom-group">
        <h3 class="atom-group-title">${esc(proj)} <span class="count">${groups[proj].length}</span></h3>
        <div class="atom-list">${atoms}</div>
      </section>`;
    })
    .join("");
  $("#learn-list").innerHTML = ledger;
}

function renderTimeline() {
  const list = state.timeline;
  $("#timeline-count").textContent = list.length ? `${list.length} items` : "";
  $("#timeline-list").innerHTML = list.length
    ? list.map(timelineItem).join("")
    : emptyState("Timeline is empty.");
}

/* ---------- Data loading ---------- */

async function loadDashboard() {
  try {
    state.dashboard = await fetchJSON("/api/dashboard");
    renderOverview(state.dashboard);
    renderGoals();
    renderGoalsAreaChart();
  } catch (err) {
    toast("Failed to load dashboard: " + err.message, "error");
  }
}

async function loadProjects() {
  try {
    state.projects = await fetchJSON("/api/projects");
    renderProjects();
    renderProjectsCharts();
  } catch (err) {
    toast("Failed to load projects: " + err.message, "error");
  }
}

async function loadLearnings() {
  try {
    state.learnings = await fetchJSON("/api/learnings");
    renderLearnings();
    renderKnowledgeCharts();
  } catch (err) {
    toast("Failed to load learnings: " + err.message, "error");
  }
}

async function loadJournal() {
  try {
    state.journal = await fetchJSON("/api/journal");
  } catch (err) {
    toast("Failed to load journal: " + err.message, "error");
  }
}

async function loadTimeline() {
  try {
    state.timeline = await fetchJSON("/api/timeline");
    renderTimeline();
    renderTimelineMonthly();
  } catch (err) {
    toast("Failed to load timeline: " + err.message, "error");
  }
}

async function refreshAll() {
  await Promise.all([loadDashboard(), loadProjects(), loadLearnings(), loadJournal()]);
  renderMetrics();
  renderGantt();
  renderDaily();
  renderOverviewCharts();
  renderGoalsAreaChart();
  renderProjects();
  renderProjectsCharts();
  if (state.timelineLoaded) await loadTimeline();
}

async function toggleTask(taskId, projectId) {
  try {
    const task = tasksFor(projectId).find((t) => t.id === taskId);
    const next = task && task.status === "done" ? "wanted" : "done";
    await fetchJSON(`/api/tasks/${taskId}/status?status=${encodeURIComponent(next)}`, { method: "PATCH" });
    toast(next === "done" ? "Task done" : "Task reopened");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function addTask(projectId, inputEl) {
  const title = (inputEl.value || "").trim();
  if (!title) return;
  try {
    await fetchJSON(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "wanted", priority: "medium" }),
    });
    toast("Task added");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function markDone(type, id) {
  try {
    await fetchJSON(`${ENDPOINTS[type]}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    toast("Marked as done");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

async function deleteItem(type, id) {
  const names = { project: "project", learning: "learning", goal: "goal", journal: "journal entry" };
  if (!confirm(`Delete this ${names[type] || type}?`)) return;
  try {
    await fetchJSON(`${ENDPOINTS[type]}/${id}`, { method: "DELETE" });
    toast("Deleted");
    await refreshAll();
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

const PAGE_TITLES = { overview: "Overview", projects: "Projects", goals: "Goals", knowledge: "Knowledge", timeline: "Timeline" };

function switchTab(tab) {
  state.tab = tab;
  $$(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  $$(".side-icon").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
  $("#page-title").textContent = PAGE_TITLES[tab] || tab;
  $("#sub-overview-filters").hidden = tab !== "overview";
  $("#sub-project-filters").hidden = tab !== "projects";
  if (tab === "timeline") {
    if (!state.timelineLoaded) {
      state.timelineLoaded = true;
      loadTimeline();
    } else {
      renderTimeline();
      renderTimelineMonthly();
    }
  }
  if (tab === "knowledge" && !$("#knowledge-tags").hasChildNodes()) {
    renderKnowledgeCharts();
  }
  if (tab === "goals" && state.dashboard && !$("#goals-area-chart").hasChildNodes()) {
    renderGoalsAreaChart();
  }
}

function setProjectFilter(f) {
  state.projectFilter = f;
  $$(".filter-pill").forEach((p) => p.classList.toggle("active", p.dataset.filter === f));
  renderProjects();
}

function renderFields() {
  const type = $("#qa-type").value;
  $("#qa-fields").innerHTML = FIELD_SETS[type];
  $("#modal-title").textContent = "Add " + type.charAt(0).toUpperCase() + type.slice(1);
}

function openModal(type) {
  $("#qa-type").value = type;
  renderFields();
  $("#modal-backdrop").hidden = false;
  document.body.classList.add("modal-open");
  const first = $("#qa-fields input, #qa-fields select, #qa-fields textarea");
  (first || $("#modal-close")).focus();
}

function closeModal() {
  $("#modal-backdrop").hidden = true;
  document.body.classList.remove("modal-open");
  $("#quick-form").reset();
}

function hideMenu() {
  $("#new-menu").hidden = true;
  $("#new-btn").setAttribute("aria-expanded", "false");
}

function buildPayload() {
  const type = $("#qa-type").value;
  const val = (id) => ($("#qa-" + id) ? $("#qa-" + id).value.trim() : "");
  const raw = (id) => ($("#qa-" + id) ? $("#qa-" + id).value : "");
  const tags = raw("tags")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const date = raw("date") || todayISO();
  if (type === "project") {
    if (!val("title")) return { error: "Title is required" };
    return {
      endpoint: ENDPOINTS.project,
      body: {
        title: val("title"),
        description: val("description"),
        status: raw("status") || "active",
        priority: raw("priority") || "medium",
        target_date: raw("target_date") || null,
        tags,
      },
    };
  }
  if (type === "learning") {
    if (!val("title")) return { error: "Title is required" };
    return {
      endpoint: ENDPOINTS.learning,
      body: {
        title: val("title"),
        content: val("content"),
        date,
        tags,
        related_project: val("related_project"),
      },
    };
  }
  if (type === "goal") {
    if (!val("title")) return { error: "Title is required" };
    return {
      endpoint: ENDPOINTS.goal,
      body: {
        area: raw("area") || "other",
        title: val("title"),
        description: val("description"),
        progress: Math.max(0, Math.min(100, parseFloat(raw("progress")) || 0)),
        target_date: raw("target_date") || null,
        status: raw("goal_status") || "active",
      },
    };
  }
  if (!val("content")) return { error: "Content is required" };
  return {
    endpoint: ENDPOINTS.journal,
    body: {
      date,
      type: raw("jtype") || "note",
      content: val("content"),
      related_entity: val("related_entity"),
    },
  };
}

function bindEvents() {
  $("#new-btn").addEventListener("click", () => {
    const menu = $("#new-menu");
    menu.hidden = !menu.hidden;
    $("#new-btn").setAttribute("aria-expanded", String(!menu.hidden));
  });

  $$(".new-item").forEach((item) =>
    item.addEventListener("click", () => {
      hideMenu();
      openModal(item.dataset.qatype);
    })
  );

  $$(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  $$(".side-icon").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  $$(".filter-pill").forEach((pill) =>
    pill.addEventListener("click", () => setProjectFilter(pill.dataset.filter))
  );

  $("#learn-tag-filter").addEventListener("input", renderLearnings);
  $("#learn-date-filter").addEventListener("input", renderLearnings);
  $("#learn-filter-clear").addEventListener("click", () => {
    $("#learn-tag-filter").value = "";
    $("#learn-date-filter").value = "";
    renderLearnings();
  });

  $("#growth-range").addEventListener("click", () => {
    state.growthDays = state.growthDays === 30 ? 90 : 30;
    renderGrowthChart();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("add-task-input")) {
      e.preventDefault();
      const card = e.target.closest(".project-card");
      const id = card ? Number(card.querySelector(".add-task-btn").dataset.id) : null;
      if (id) addTask(id, e.target);
    }
  });

  $("#qa-type").addEventListener("change", () => {
    $("#quick-form").reset();
    renderFields();
  });

  $("#quick-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    if (payload.error) {
      toast(payload.error, "error");
      return;
    }
    try {
      await fetchJSON(payload.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      closeModal();
      toast("Created " + $("#qa-type").value);
      await refreshAll();
    } catch (err) {
      toast("Failed: " + err.message, "error");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      hideMenu();
    }
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".new-wrap").contains(e.target)) hideMenu();
    if (e.target === $("#modal-backdrop")) closeModal();
    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      closeModal();
      return;
    }
    const action = e.target.closest("[data-action]");
    if (action) {
      const { action: kind, type, id } = action.dataset;
      if (kind === "done") markDone(type, id);
      else if (kind === "delete") deleteItem(type, id);
      else if (kind === "task-toggle") toggleTask(Number(id), Number(action.dataset.project));
      else if (kind === "task-add") {
        const card = action.closest(".project-card");
        addTask(Number(id), card ? card.querySelector(".add-task-input") : null);
      }
    }
  });
}

function init() {
  updateClock();
  setInterval(updateClock, 60000);
  bindEvents();
  refreshAll();
}

init();
