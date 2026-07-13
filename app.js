"use strict";

/* ============== DOM 引用 ============== */
const passageEl = document.getElementById("passage");
const inputEl = document.getElementById("input");
const selectEl = document.getElementById("docSelect");
const statProg = document.getElementById("statProg");
const statAcc = document.getElementById("statAcc");
const statWpm = document.getElementById("statWpm");
const statErr = document.getElementById("statErr");
const statusEl = document.getElementById("status");

/* ============== 状态 ============== */
let target = "";
let docs = [];
let currentDoc = null;
let startTime = null;
let lastSavedKey = null; // 防止同一篇练习重复写入

/* ============== localStorage 键 ============== */
const K_HISTORY = "typing_history";
const K_THEME = "typing_theme";

/* ============== 历史 / 统计 ============== */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(K_HISTORY) || "[]"); }
  catch { return []; }
}
function saveHistory(list) { localStorage.setItem(K_HISTORY, JSON.stringify(list)); }

function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function recordResult({ wpm, acc, errors, typedLen, correctLen }) {
  const list = loadHistory();
  const key = `${currentDoc}-${Date.now()}`;
  if (key === lastSavedKey) return;
  lastSavedKey = key;
  list.push({
    ts: Date.now(),
    day: todayStr(),
    doc: currentDoc || "unknown",
    wpm, acc, errors,
    typed: typedLen, correct: correctLen
  });
  saveHistory(list);
}

function computeStats(list) {
  if (!list.length) {
    return {
      total: { cnt: 0, acc: null, maxWpm: 0, avgWpm: 0, totalTyped: 0, totalCorrect: 0 },
      day: { cnt: 0, acc: null, maxWpm: 0, avgWpm: 0, totalTyped: 0, totalCorrect: 0 },
    };
  }
  const today = todayStr();
  const agg = (arr) => {
    let totalTyped = 0, totalCorrect = 0, sumWpm = 0, maxWpm = 0;
    for (const r of arr) {
      totalTyped += r.typed || 0;
      totalCorrect += r.correct || 0;
      sumWpm += r.wpm || 0;
      if (r.wpm > maxWpm) maxWpm = r.wpm;
    }
    return {
      cnt: arr.length,
      acc: totalTyped ? Math.round((totalCorrect / totalTyped) * 100) : null,
      maxWpm,
      avgWpm: arr.length ? Math.round(sumWpm / arr.length) : 0,
      totalTyped, totalCorrect,
    };
  };
  return {
    total: agg(list),
    day: agg(list.filter(r => r.day === today)),
  };
}

/* ============== 文档列表 ============== */
async function loadDocList() {
  const res = await fetch("/api/docs", { cache: "no-store" });
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

async function loadDoc(name) {
  const res = await fetch("/docs/" + encodeURIComponent(name), { cache: "no-store" });
  let text = await res.text();
  text = text.replace(/\r\n/g, "\n").replace(/\s+$/g, "");
  target = text;
  currentDoc = name;
  selectEl.value = name;
  renderPassage();
  resetInput();
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

function resetInput() {
  inputEl.value = "";
  inputEl.disabled = false;
  startTime = null;
  statusEl.textContent = "";
  statusEl.classList.remove("done");
  lastSavedKey = null;
  update();
  inputEl.focus();
}

/* ============== 实时更新 + 完成时记录 ============== */
function update() {
  const typed = inputEl.value;
  const spans = passageEl.children;
  let correct = 0;
  let errors = 0;

  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    s.className = "ch";
    if (i < typed.length) {
      if (typed[i] === target[i]) {
        s.classList.add("correct");
        correct++;
      } else {
        s.classList.add("wrong");
        errors++;
      }
    } else if (i === typed.length) {
      s.classList.add("current");
    } else {
      s.classList.add("pending");
    }
  }

  const typedLen = typed.length;
  const acc = typedLen ? Math.round((correct / typedLen) * 100) : 100;
  const prog = target.length ? Math.round((Math.min(typedLen, target.length) / target.length) * 100) : 0;
  let wpm = 0;
  if (startTime) {
    const mins = (Date.now() - startTime) / 60000;
    if (mins > 0) wpm = Math.max(0, Math.round((correct / 5) / mins));
  }

  statProg.textContent = prog + "%";
  statAcc.textContent = acc + "%";
  statWpm.textContent = wpm;
  statErr.textContent = errors;

  const cur = passageEl.querySelector(".current");
  if (cur) cur.scrollIntoView({ block: "nearest" });

  if (typedLen >= target.length && target.length > 0) {
    statusEl.classList.add("done");
    statusEl.textContent = `完成！准确率 ${acc}% · ${wpm} WPM · 错误 ${errors} 处`;

    // 完成时写入历史
    if (!lastSavedKey) {
      recordResult({ wpm, acc, errors, typedLen, correctLen: correct });
      // 若用户停在 Profile 页,刷新一下统计
      if (currentView === "profile") renderProfile();
    }
  } else {
    statusEl.classList.remove("done");
    statusEl.textContent = "";
  }
}

inputEl.addEventListener("input", () => {
  if (!startTime && inputEl.value.length > 0) startTime = Date.now();
  update();
});

passageEl.addEventListener("click", () => inputEl.focus());

document.getElementById("newBtn").addEventListener("click", async () => {
  const name = pickRandom();
  if (name) await loadDoc(name);
});

document.getElementById("resetBtn").addEventListener("click", resetInput);

selectEl.addEventListener("change", async () => {
  if (selectEl.value) await loadDoc(selectEl.value);
});

/* ============== 视图切换 ============== */
let currentView = "practice";

function switchView(name) {
  currentView = name;
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (name === "profile") renderProfile();
}

document.querySelectorAll(".tab").forEach(b => {
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

function renderProfile() {
  const list = loadHistory();
  const s = computeStats(list);

  // 顶部数据卡
  document.getElementById("totalCnt").textContent = s.total.cnt;
  document.getElementById("totalAcc").textContent = s.total.acc === null ? "—" : s.total.acc + "%";
  document.getElementById("maxWpm").textContent = s.total.maxWpm;
  document.getElementById("avgWpm").textContent = s.total.avgWpm;

  document.getElementById("dayCnt").textContent = s.day.cnt;
  document.getElementById("dayAcc").textContent = s.day.acc === null ? "—" : s.day.acc + "%";
  document.getElementById("dayMaxWpm").textContent = s.day.maxWpm;
  document.getElementById("dayAvgWpm").textContent = s.day.avgWpm;

  // 历史列表(最近 30 条,倒序)
  const listEl = document.getElementById("historyList");
  const recent = list.slice(-30).reverse();
  listEl.replaceChildren();
  for (const r of recent) {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <span class="hi-date">${fmtTime(r.ts)}</span>
      <span class="hi-doc">${(r.doc || "").replace(/\.(txt|md)$/i, "")}</span>
      <span class="hi-wpm">${r.wpm} WPM</span>
      <span class="hi-acc">准确率 ${r.acc}%</span>
      <span class="hi-err">错误 ${r.errors}</span>
    `;
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
  const labels = recent.map(r => fmtTime(r.ts));
  const wpms = recent.map(r => r.wpm);
  const errs = recent.map(r => r.errors);

  const canvasFontColor = muted;
  Chart.defaults.color = canvasFontColor;
  Chart.defaults.font.family = "Segoe UI, system-ui, sans-serif";

  // WPM 趋势图
  const ctxWpm = document.getElementById("wpmTrendChart").getContext("2d");
  if (wpmChart) wpmChart.destroy();
  wpmChart = new Chart(ctxWpm, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "WPM",
        data: wpms,
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
      plugins: { title: { display: true, text: "WPM 趋势（最近 30 次）", color: ink } },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: grid } },
        y: { beginAtZero: true, ticks: { color: muted }, grid: { color: grid } },
      },
    },
  });

  // 错误数柱状图
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
  if (!confirm("确认清空全部历史记录?此操作不可撤销。")) return;
  saveHistory([]);
  renderProfile();
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
  // 主题切换后,若在 profile 页,重绘图表以同步颜色
  if (currentView === "profile") renderCharts(loadHistory());
});

/* ============== 初始化 ============== */
(async function init() {
  try {
    await loadDocList();
  } catch (e) {
    passageEl.textContent = "无法连接服务器,请确认 server.py 正在运行。";
    inputEl.disabled = true;
    return;
  }
  if (docs.length === 0) {
    passageEl.textContent = "请在 docs 文件夹中放入 .txt 或 .md 文档后刷新页面。";
    inputEl.disabled = true;
    return;
  }
  populateSelect();
  await loadDoc(pickRandom());
})();
