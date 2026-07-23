"use strict";

/* ============== DOM 引用 ============== */
const passageEl = document.getElementById("passage");
const inputEl = document.getElementById("input");
const selectEl = document.getElementById("docSelect");
const statProg = document.getElementById("statProg");
const statAcc = document.getElementById("statAcc");
const statWpm = document.getElementById("statWpm");
const statSpeedLabel = document.getElementById("statSpeedLabel");
const statErr = document.getElementById("statErr");
const statusEl = document.getElementById("status");

/* ============== 状态 ============== */
let target = "";
let docs = [];
let currentDoc = null;
let startTime = null;
let lastSavedKey = null;
let prevTypedLen = 0;
let isChinese = false;

/* ============== localStorage 键 ============== */
const K_HISTORY = "typing_history";
const K_THEME = "typing_theme";
const K_LAST_DOC = "typing_last_doc";
const MAX_HISTORY = 500;

/* ============== 工具 ============== */
function isChineseDoc(name) {
  return name && name.includes("_zh");
}

function speedUnitForDoc(name) {
  return isChineseDoc(name) ? "cpm" : "wpm";
}

function calcSpeed(correct, mins, unit) {
  if (mins <= 0) return 0;
  if (unit === "cpm") return Math.max(0, Math.round(correct / mins));
  return Math.max(0, Math.round((correct / 5) / mins));
}

function formatSpeed(record) {
  const unit = record.speedUnit || "wpm";
  const val = record.speed ?? record.wpm ?? 0;
  return `${val} ${unit.toUpperCase()}`;
}

/* ============== 历史 / 统计 ============== */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(K_HISTORY) || "[]"); }
  catch { return []; }
}

function saveHistory(list) {
  const trimmed = list.length > MAX_HISTORY ? list.slice(-MAX_HISTORY) : list;
  localStorage.setItem(K_HISTORY, JSON.stringify(trimmed));
}

function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function recordResult({ speed, speedUnit, acc, errors, typedLen, correctLen }) {
  const list = loadHistory();
  const key = `${currentDoc}-${Date.now()}`;
  if (key === lastSavedKey) return;
  lastSavedKey = key;
  list.push({
    ts: Date.now(),
    day: todayStr(),
    doc: currentDoc || "unknown",
    speed,
    speedUnit,
    wpm: speedUnit === "wpm" ? speed : Math.round(speed / 5),
    acc,
    errors,
    typed: typedLen,
    correct: correctLen,
  });
  saveHistory(list);
}

function recordSpeedValue(record) {
  return record.speed ?? record.wpm ?? 0;
}

function computeStats(list) {
  if (!list.length) {
    const empty = { cnt: 0, acc: null, maxSpeed: 0, avgSpeed: 0, totalTyped: 0, totalCorrect: 0 };
    return { total: { ...empty }, day: { ...empty }, wpm: { ...empty }, cpm: { ...empty } };
  }
  const today = todayStr();
  const agg = (arr) => {
    let totalTyped = 0, totalCorrect = 0, sumSpeed = 0, maxSpeed = 0;
    for (const r of arr) {
      totalTyped += r.typed || 0;
      totalCorrect += r.correct || 0;
      const s = recordSpeedValue(r);
      sumSpeed += s;
      if (s > maxSpeed) maxSpeed = s;
    }
    return {
      cnt: arr.length,
      acc: totalTyped ? Math.round((totalCorrect / totalTyped) * 100) : null,
      maxSpeed,
      avgSpeed: arr.length ? Math.round(sumSpeed / arr.length) : 0,
      totalTyped,
      totalCorrect,
    };
  };
  const aggByUnit = (arr, unit) => agg(arr.filter(r => (r.speedUnit || "wpm") === unit));
  return {
    total: agg(list),
    day: agg(list.filter(r => r.day === today)),
    wpm: aggByUnit(list, "wpm"),
    cpm: aggByUnit(list, "cpm"),
  };
}

/* ============== 文档列表 ============== */
async function loadDocList() {
  const res = await fetch("/api/docs", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  docs = await res.json();
}

function categorize(name) {
  const base = name.replace(/\.(txt|md)$/i, "");
  let lang = "";
  if (base.includes("_en")) lang = "（英文）";
  else if (base.includes("_zh")) lang = "（中文）";

  if (base.startsWith("lolita")) return "洛丽塔 Lolita" + lang;
  if (base.startsWith("proust_swann")) return "追忆·斯万之恋" + lang;
  if (base.startsWith("proust_ombre")) return "追忆·在少女们身旁" + lang;
  if (base.startsWith("proust")) return "追忆似水年华" + lang;
  if (base.startsWith("solitude")) return "百年孤独" + lang;

  const code = ["code_cpp", "python_code", "javascript_code", "sql_query", "numbers_symbols"];
  if (code.includes(base)) return "代码 / 符号";
  const zh = ["tang_poems", "chinese", "chinese_prose", "science_light"];
  if (zh.includes(base)) return "中文诗文";
  const en = ["english_story", "proverbs", "pangrams", "quotes", "tech_gpu"];
  if (en.includes(base)) return "英文练习";
  return "其他";
}

const GROUP_ORDER = [
  "洛丽塔 Lolita（英文）", "洛丽塔 Lolita（中文）",
  "追忆似水年华（英文）", "追忆似水年华（中文）",
  "追忆·斯万之恋（英文）", "追忆·斯万之恋（中文）",
  "追忆·在少女们身旁（英文）", "追忆·在少女们身旁（中文）",
  "百年孤独（英文）", "百年孤独（中文）", "百年孤独",
  "英文练习", "中文诗文", "代码 / 符号", "其他",
];

function populateSelect() {
  selectEl.replaceChildren();
  const groups = new Map();
  for (const name of docs) {
    const cat = categorize(name);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(name);
  }
  const cats = [...groups.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a) === -1 ? 999 : GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b) === -1 ? 999 : GROUP_ORDER.indexOf(b);
    return ia - ib || a.localeCompare(b, "zh");
  });
  for (const cat of cats) {
    const og = document.createElement("optgroup");
    og.label = cat;
    for (const name of groups.get(cat)) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name.replace(/\.(txt|md)$/i, "");
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }
}

function pickRandom() {
  if (docs.length === 0) return null;
  if (docs.length === 1) return docs[0];
  let next;
  do {
    next = docs[Math.floor(Math.random() * docs.length)];
  } while (next === currentDoc);
  return next;
}

function pickInitialDoc() {
  const saved = localStorage.getItem(K_LAST_DOC);
  if (saved && docs.includes(saved)) return saved;
  return pickRandom();
}

async function loadDoc(name) {
  try {
    const res = await fetch("/docs/" + encodeURIComponent(name), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let text = await res.text();
    text = text.replace(/\r\n/g, "\n").replace(/\s+$/g, "");
    target = text;
    currentDoc = name;
    isChinese = isChineseDoc(name);
    statSpeedLabel.textContent = isChinese ? "CPM" : "WPM";
    selectEl.value = name;
    localStorage.setItem(K_LAST_DOC, name);
    renderPassage();
    resetInput();
  } catch (e) {
    statusEl.classList.remove("done");
    statusEl.textContent = `加载「${name}」失败，请重试或换一篇。`;
    console.error("loadDoc failed:", e);
  }
}

function renderPassage() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < target.length; i++) {
    const span = document.createElement("span");
    span.className = "ch pending";
    span.textContent = target[i];
    frag.appendChild(span);
  }
  passageEl.replaceChildren(frag);
}

function setSpanState(span, state) {
  span.className = "ch " + state;
}

function updateSpanAt(i, typed) {
  const span = passageEl.children[i];
  if (!span) return;
  if (i < typed.length) {
    setSpanState(span, typed[i] === target[i] ? "correct" : "wrong");
  } else if (i === typed.length) {
    setSpanState(span, "current");
  } else {
    setSpanState(span, "pending");
  }
}

function countStats(typed) {
  let correct = 0;
  let errors = 0;
  const len = Math.min(typed.length, target.length);
  for (let i = 0; i < len; i++) {
    if (typed[i] === target[i]) correct++;
    else errors++;
  }
  return { correct, errors };
}

function resetInput() {
  inputEl.value = "";
  inputEl.disabled = false;
  startTime = null;
  prevTypedLen = 0;
  statusEl.textContent = "";
  statusEl.classList.remove("done");
  lastSavedKey = null;
  update(true);
  inputEl.focus();
}

/* ============== 实时更新 + 完成时记录 ============== */
function update(fullRecount = false) {
  const typed = inputEl.value;
  const typedLen = typed.length;
  const spans = passageEl.children;

  if (fullRecount || typedLen < prevTypedLen) {
    for (let i = 0; i < spans.length; i++) updateSpanAt(i, typed);
  } else {
    const start = Math.max(0, prevTypedLen - 1);
    const end = Math.min(spans.length - 1, typedLen);
    for (let i = start; i <= end; i++) updateSpanAt(i, typed);
    if (typedLen + 1 < spans.length) updateSpanAt(typedLen + 1, typed);
  }
  prevTypedLen = typedLen;

  const { correct, errors } = countStats(typed);
  const acc = typedLen ? Math.round((correct / typedLen) * 100) : 100;
  const prog = target.length ? Math.round((Math.min(typedLen, target.length) / target.length) * 100) : 0;
  const unit = speedUnitForDoc(currentDoc);
  let speed = 0;
  if (startTime) {
    const mins = (Date.now() - startTime) / 60000;
    speed = calcSpeed(correct, mins, unit);
  }

  statProg.textContent = prog + "%";
  statAcc.textContent = acc + "%";
  statWpm.textContent = speed;
  statErr.textContent = errors;

  const cur = passageEl.querySelector(".current");
  if (cur) cur.scrollIntoView({ block: "nearest", behavior: "smooth" });

  if (typedLen >= target.length && target.length > 0) {
    inputEl.disabled = true;
    statusEl.classList.add("done");
    const unitLabel = unit.toUpperCase();
    statusEl.textContent = `完成！准确率 ${acc}% · ${speed} ${unitLabel} · 错误 ${errors} 处`;

    if (!lastSavedKey) {
      recordResult({ speed, speedUnit: unit, acc, errors, typedLen, correctLen: correct });
      if (currentView === "profile") renderProfile();
    }
  } else {
    statusEl.classList.remove("done");
    if (!inputEl.disabled) statusEl.textContent = "";
  }
}

inputEl.addEventListener("input", () => {
  if (!startTime && inputEl.value.length > 0) startTime = Date.now();
  update();
});

inputEl.addEventListener("paste", (e) => e.preventDefault());

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    if (inputEl.value.length > 0 && !confirm("确认重置当前进度？")) return;
    resetInput();
  } else if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    document.getElementById("newBtn").click();
  }
});

passageEl.addEventListener("click", () => inputEl.focus());

document.getElementById("newBtn").addEventListener("click", async () => {
  const name = pickRandom();
  if (name) await loadDoc(name);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (inputEl.value.length > 0 && !confirm("确认重置当前进度？")) return;
  resetInput();
});

selectEl.addEventListener("change", async () => {
  if (selectEl.value) await loadDoc(selectEl.value);
});

/* ============== 视图切换 ============== */
let currentView = "practice";

function switchView(name) {
  currentView = name;
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.view === name);
    b.setAttribute("aria-selected", b.dataset.view === name ? "true" : "false");
  });
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "profile") renderProfile();
  else inputEl.focus();
}

document.querySelectorAll(".tab").forEach(b => {
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", b.classList.contains("active") ? "true" : "false");
  b.addEventListener("click", () => switchView(b.dataset.view));
});

/* ============== Profile 渲染 ============== */
let wpmChart = null;
let errChart = null;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderProfileStats(s) {
  document.getElementById("totalCnt").textContent = s.total.cnt;
  document.getElementById("totalAcc").textContent = s.total.acc === null ? "—" : s.total.acc + "%";

  const maxParts = [];
  if (s.wpm.cnt) maxParts.push(`${s.wpm.maxSpeed} WPM`);
  if (s.cpm.cnt) maxParts.push(`${s.cpm.maxSpeed} CPM`);
  document.getElementById("maxWpm").textContent = maxParts.length ? maxParts.join(" / ") : "0";

  const avgParts = [];
  if (s.wpm.cnt) avgParts.push(`${s.wpm.avgSpeed} WPM`);
  if (s.cpm.cnt) avgParts.push(`${s.cpm.avgSpeed} CPM`);
  document.getElementById("avgWpm").textContent = avgParts.length ? avgParts.join(" / ") : "0";

  document.getElementById("dayCnt").textContent = s.day.cnt;
  document.getElementById("dayAcc").textContent = s.day.acc === null ? "—" : s.day.acc + "%";

  const dayMaxParts = [];
  const dayList = loadHistory().filter(r => r.day === todayStr());
  const dayWpm = computeStats(dayList).wpm;
  const dayCpm = computeStats(dayList).cpm;
  if (dayWpm.cnt) dayMaxParts.push(`${dayWpm.maxSpeed} WPM`);
  if (dayCpm.cnt) dayMaxParts.push(`${dayCpm.maxSpeed} CPM`);
  document.getElementById("dayMaxWpm").textContent = dayMaxParts.length ? dayMaxParts.join(" / ") : "0";

  const dayAvgParts = [];
  if (dayWpm.cnt) dayAvgParts.push(`${dayWpm.avgSpeed} WPM`);
  if (dayCpm.cnt) dayAvgParts.push(`${dayCpm.avgSpeed} CPM`);
  document.getElementById("dayAvgWpm").textContent = dayAvgParts.length ? dayAvgParts.join(" / ") : "0";
}

function renderProfile() {
  const list = loadHistory();
  const s = computeStats(list);
  renderProfileStats(s);

  const listEl = document.getElementById("historyList");
  const recent = list.slice(-30).reverse();
  listEl.replaceChildren();
  for (const r of recent) {
    const item = document.createElement("div");
    item.className = "history-item";

    const date = document.createElement("span");
    date.className = "hi-date";
    date.textContent = fmtTime(r.ts);

    const doc = document.createElement("span");
    doc.className = "hi-doc";
    doc.textContent = (r.doc || "").replace(/\.(txt|md)$/i, "");

    const speed = document.createElement("span");
    speed.className = "hi-wpm";
    speed.textContent = formatSpeed(r);

    const acc = document.createElement("span");
    acc.className = "hi-acc";
    acc.textContent = `准确率 ${r.acc}%`;

    const err = document.createElement("span");
    err.className = "hi-err";
    err.textContent = `错误 ${r.errors}`;

    item.append(date, doc, speed, acc, err);
    listEl.appendChild(item);
  }

  renderCharts(list);
}

function renderCharts(list) {
  const ink = cssVar("--ink") || "#1a1d24";
  const muted = cssVar("--muted") || "#7a8296";
  const accent = cssVar("--accent") || "#3b6ef6";
  const wrong = cssVar("--wrong") || "#e5484d";
  const grid = cssVar("--grid") || "rgba(0,0,0,0.06)";

  const recent = list.slice(-30);
  const labels = recent.map((_, i) => `#${list.length - recent.length + i + 1}`);
  const speeds = recent.map(r => recordSpeedValue(r));
  const errs = recent.map(r => r.errors);
  const speedLabels = recent.map(r => formatSpeed(r));

  Chart.defaults.color = muted;
  Chart.defaults.font.family = "Segoe UI, system-ui, sans-serif";

  const ctxWpm = document.getElementById("wpmTrendChart").getContext("2d");
  if (wpmChart) wpmChart.destroy();
  wpmChart = new Chart(ctxWpm, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "速度",
        data: speeds,
        borderColor: accent,
        backgroundColor: accent + "22",
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: "速度趋势（最近 30 次）", color: ink },
        tooltip: {
          callbacks: {
            label(ctx) {
              const idx = ctx.dataIndex;
              return `${speedLabels[idx]} · 错误 ${errs[idx]}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: grid } },
        y: { beginAtZero: true, ticks: { color: muted }, grid: { color: grid } },
      },
    },
  });

  const ctxErr = document.getElementById("errChart").getContext("2d");
  if (errChart) errChart.destroy();
  errChart = new Chart(ctxErr, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "错误字符数",
        data: errs,
        backgroundColor: wrong,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "错误字符数（最近 30 次）", color: ink } },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: grid } },
        y: { beginAtZero: true, ticks: { color: muted }, grid: { color: grid } },
      },
    },
  });
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("确认清空全部历史记录？此操作不可撤销。")) return;
  saveHistory([]);
  renderProfile();
});

document.getElementById("exportHistoryBtn").addEventListener("click", () => {
  const data = JSON.stringify(loadHistory(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `typing-history-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importHistoryBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("invalid format");
    const merged = [...loadHistory(), ...imported.filter(r => r && typeof r.ts === "number")];
    merged.sort((a, b) => a.ts - b.ts);
    saveHistory(merged);
    renderProfile();
    alert(`已导入，当前共 ${loadHistory().length} 条记录。`);
  } catch {
    alert("导入失败：请确认文件为有效的 JSON 历史记录。");
  }
});

/* ============== 主题切换 ============== */
function applyTheme(name) {
  if (name) document.documentElement.setAttribute("data-theme", name);
  else document.documentElement.removeAttribute("data-theme");
}

const themeSelect = document.getElementById("themeSelect");
const savedTheme = localStorage.getItem(K_THEME);
if (savedTheme) {
  applyTheme(savedTheme);
  themeSelect.value = savedTheme;
}
themeSelect.addEventListener("change", () => {
  const v = themeSelect.value;
  applyTheme(v);
  localStorage.setItem(K_THEME, v);
  if (currentView === "profile") renderCharts(loadHistory());
});

/* ============== 初始化 ============== */
(async function init() {
  try {
    await loadDocList();
  } catch (e) {
    passageEl.textContent = "无法连接服务器，请确认 server.py 正在运行。";
    inputEl.disabled = true;
    return;
  }
  if (docs.length === 0) {
    passageEl.textContent = "请在 docs 文件夹中放入 .txt 或 .md 文档后刷新页面。";
    inputEl.disabled = true;
    return;
  }
  populateSelect();
  const initial = pickInitialDoc();
  if (initial) await loadDoc(initial);
})();
