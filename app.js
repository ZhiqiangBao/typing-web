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
let timerMode = 0; // 0 = no timer, 15/30/60 = seconds
let timerInterval = null;
let timerRemaining = 0;
let zenMode = false;
let errorKeyPairs = {}; // track wrong->correct key pairs
let isComposing = false; // IME composition in progress

/* ============== localStorage 键 ============== */
const K_HISTORY = "typing_history";
const K_THEME = "typing_theme";
const K_LAST_DOC = "typing_last_doc";
const K_TIMER = "typing_timer";
const K_ZEN = "typing_zen";
const K_PROFILE_FILTER = "typing_profile_filter";
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

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function recordResult({ speed, speedUnit, acc, errors, typedLen, correctLen, zen }) {
  const list = loadHistory();
  const key = `${currentDoc}-${Date.now()}`;
  if (key === lastSavedKey) return;
  lastSavedKey = key;

  // Collect error key pairs
  const wrongChars = [];
  for (let i = 0; i < typedLen && i < target.length; i++) {
    if (typedLen > i && typed[i] !== target[i]) {
      const pair = `${typed[i]}→${target[i]}`;
      wrongChars.push(pair);
    }
  }
  for (const pair of wrongChars) {
    errorKeyPairs[pair] = (errorKeyPairs[pair] || 0) + 1;
  }

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
    errorPairs: wrongChars,
    zen: !!zen,
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

function computeStreak(list) {
  if (!list.length) return 0;
  const days = new Set(list.map(r => r.day));
  let streak = 0;
  let check = todayStr();
  if (!days.has(check)) {
    check = yesterdayStr();
    if (!days.has(check)) return 0;
  }
  while (days.has(check)) {
    streak++;
    const d = new Date(check);
    d.setDate(d.getDate() - 1);
    const p = n => String(n).padStart(2, "0");
    check = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return streak;
}

function getTopErrorKeys(list, topN = 5) {
  const pairs = {};
  for (const r of list) {
    if (r.errorPairs) {
      for (const pair of r.errorPairs) {
        pairs[pair] = (pairs[pair] || 0) + 1;
      }
    }
  }
  return Object.entries(pairs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([pair, count]) => ({ pair, count }));
}

/* ============== 文档列表 ============== */
async function loadDocList() {
  try {
    const res = await fetch("/api/docs", { cache: "no-store" });
    if (res.ok) {
      docs = await res.json();
      return;
    }
  } catch {}
  // Fallback: static manifest for GitHub Pages / static hosting
  const res = await fetch("docs/manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load doc list: HTTP ${res.status}`);
  docs = await res.json();
}

// Load categories config from JSON file
let categoriesConfig = null;
async function loadCategoriesConfig() {
  try {
    const res = await fetch("docs/categories.json", { cache: "no-store" });
    if (res.ok) categoriesConfig = await res.json();
  } catch {
    categoriesConfig = null;
  }
}

function categorize(name) {
  const base = name.replace(/\.(txt|md)$/i, "");
  let lang = "";
  if (base.includes("_en")) lang = "（英文）";
  else if (base.includes("_zh")) lang = "（中文）";

  // Try config file first
  if (categoriesConfig && categoriesConfig.prefixes) {
    for (const entry of categoriesConfig.prefixes) {
      if (base.startsWith(entry.prefix)) {
        return entry.category + lang;
      }
    }
  }

  // Fallback to hardcoded
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

function pickNextDoc() {
  if (docs.length === 0) return null;
  const idx = docs.indexOf(currentDoc);
  if (idx === -1) return pickRandom();
  return docs[(idx + 1) % docs.length];
}

function pickInitialDoc() {
  const saved = localStorage.getItem(K_LAST_DOC);
  if (saved && docs.includes(saved)) return saved;
  return pickRandom();
}

async function loadDoc(name) {
  showLoading(true);
  try {
    const res = await fetch("docs/" + encodeURIComponent(name), { cache: "no-store" });
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
    hideLoading();
  } catch (e) {
    hideLoading();
    statusEl.classList.remove("done");
    statusEl.textContent = `加载「${name}」失败，请重试或换一篇。`;
    console.error("loadDoc failed:", e);
  }
}

function showLoading(show) {
  const el = document.getElementById("loadingIndicator");
  if (!el) return;
  el.style.display = show ? "block" : "none";
}

function hideLoading() { showLoading(false); }

function renderPassage() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < target.length; i++) {
    const span = document.createElement("span");
    span.className = "ch pending";
    span.textContent = target[i];
    frag.appendChild(span);
  }
  passageEl.replaceChildren(frag);
  passageEl.classList.toggle("zen", zenMode);
  inputEl.classList.toggle("zen-hidden", zenMode);
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
  stopTimer();
  update(true);
  inputEl.focus();
}

/* ============== 计时器模式 ============== */
function startTimer(seconds) {
  stopTimer();
  timerRemaining = seconds;
  const timerEl = document.getElementById("timerDisplay");
  if (timerEl) {
    timerEl.textContent = `${seconds}s`;
    timerEl.style.display = "inline";
  }
  timerInterval = setInterval(() => {
    timerRemaining--;
    if (timerEl) timerEl.textContent = `${timerRemaining}s`;
    if (timerRemaining <= 0) {
      stopTimer();
      if (!inputEl.disabled) finishExercise(true);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRemaining = 0;
  const timerEl = document.getElementById("timerDisplay");
  if (timerEl) timerEl.style.display = "none";
}

function setTimerMode(seconds) {
  timerMode = seconds;
  localStorage.setItem(K_TIMER, String(seconds));
  const sel = document.getElementById("timerSelect");
  if (sel) sel.value = String(seconds);
}

/* ============== Zen 模式 ============== */
function applyZenMode() {
  if (zenMode) {
    passageEl.classList.add("zen");
    inputEl.classList.add("zen-hidden");
    inputEl.value = "";
    prevTypedLen = 0;
    statusEl.textContent = "禅定模式：专注输入，无法退格，错误将保留。按 Esc 退出。";
    statusEl.classList.remove("done");
  } else {
    passageEl.classList.remove("zen");
    inputEl.classList.remove("zen-hidden");
    inputEl.value = "";
    prevTypedLen = 0;
    statusEl.textContent = "";
    inputEl.focus();
  }
}

function toggleZenMode() {
  if (zenMode) {
    zenMode = false;
  } else {
    if (inputEl.value.length > 0 && !confirm("切换到禅定模式将重置当前进度，确认？")) return;
    zenMode = true;
    resetInput();
  }
  localStorage.setItem(K_ZEN, zenMode ? "1" : "0");
  applyZenMode();
  const btn = document.getElementById("zenBtn");
  if (btn) btn.textContent = zenMode ? "退出禅定" : "禅定模式";
}

/* ============== 完成练习 ============== */
function finishExercise(timeUp = false) {
  const typed = inputEl.value;
  const { correct, errors } = countStats(typed);
  const acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;
  const unit = speedUnitForDoc(currentDoc);
  let speed = 0;
  if (startTime) {
    const mins = (Date.now() - startTime) / 60000;
    speed = calcSpeed(correct, mins, unit);
  }

  inputEl.disabled = true;
  stopTimer();
  statusEl.classList.add("done");

  const unitLabel = unit.toUpperCase();
  const title = timeUp ? "时间到！" : "完成！";
  statusEl.textContent = `${title}准确率 ${acc}% · ${speed} ${unitLabel} · 错误 ${errors} 处`;

  showResultCard({ acc, speed, unitLabel, errors, timeUp });

  if (!lastSavedKey) {
    recordResult({ speed, speedUnit: unit, acc, errors, typedLen: typed.length, correctLen: correct, zen: zenMode });
    if (currentView === "profile") renderProfile();
  }
}

function showResultCard({ acc, speed, unitLabel, errors, timeUp }) {
  const card = document.getElementById("resultCard");
  if (!card) return;
  card.style.display = "flex";
  card.classList.add("result-show");
  document.getElementById("resultTitle").textContent = timeUp ? "⏱️ 时间到！" : "🎉 完成！";
  document.getElementById("resultAcc").textContent = `${acc}%`;
  document.getElementById("resultSpeed").textContent = `${speed} ${unitLabel}`;
  document.getElementById("resultErr").textContent = `${errors} 处`;
}

function hideResultCard() {
  const card = document.getElementById("resultCard");
  if (!card) return;
  card.style.display = "none";
  card.classList.remove("result-show");
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

  // Update progress bar
  const progBar = document.getElementById("progressBar");
  if (progBar) progBar.style.width = prog + "%";

  const cur = passageEl.querySelector(".current");
  if (cur) {
    cur.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!zenMode && typedLen > 0 && window.innerWidth <= 720) {
      inputEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  if (typedLen >= target.length && target.length > 0) {
    finishExercise(false);
  }
}

inputEl.addEventListener("compositionstart", () => {
  isComposing = true;
});

inputEl.addEventListener("compositionend", () => {
  isComposing = false;
  if (!startTime && inputEl.value.length > 0) {
    startTime = Date.now();
    if (timerMode > 0) startTimer(timerMode);
  }
  update(true);
});

inputEl.addEventListener("input", () => {
  if (isComposing) return;
  if (!startTime && inputEl.value.length > 0) {
    startTime = Date.now();
    if (timerMode > 0) startTimer(timerMode);
  }
  update();
});

inputEl.addEventListener("paste", (e) => e.preventDefault());

inputEl.addEventListener("keydown", (e) => {
  if (zenMode) return;
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    const next = pickNextDoc();
    if (next) loadDoc(next);
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (inputEl.value.length > 0 && !confirm("确认重置当前进度？")) return;
    resetInput();
    hideResultCard();
  } else if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    const next = pickRandom();
    if (next) loadDoc(next);
  }
});

/* Zen 模式按键拦截：捕获阶段阻断 Backspace，Esc 退出 */
document.addEventListener("keydown", (e) => {
  if (!zenMode) return;
  if (e.key === "Backspace") {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (inputEl.value.length > 0 && !confirm("退出禅定模式并结束练习？")) return;
    const typed = inputEl.value;
    const { correct, errors } = countStats(typed);
    const acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;
    const unit = speedUnitForDoc(currentDoc);
    let speed = 0;
    if (startTime) {
      const mins = (Date.now() - startTime) / 60000;
      speed = calcSpeed(correct, mins, unit);
    }
    const unitLabel = unit.toUpperCase();
    inputEl.disabled = true;
    stopTimer();
    statusEl.classList.add("done");
    statusEl.textContent = `禅定结束 · 准确率 ${acc}% · ${speed} ${unitLabel} · 错误 ${errors} 处`;
    showResultCard({ acc, speed, unitLabel, errors, timeUp: false });
    if (!lastSavedKey) {
      recordResult({ speed, speedUnit: unit, acc, errors, typedLen: typed.length, correctLen: correct, zen: true });
      if (currentView === "profile") renderProfile();
    }
    zenMode = false;
    localStorage.setItem(K_ZEN, "0");
    passageEl.classList.remove("zen");
    inputEl.classList.remove("zen-hidden");
    const btn = document.getElementById("zenBtn");
    if (btn) btn.textContent = "禅定模式";
    return;
  }
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    const next = pickNextDoc();
    if (next) loadDoc(next);
  }
}, true);

// Ctrl+1 / Ctrl+2 to switch views
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "1") {
    e.preventDefault();
    switchView("practice");
  } else if (e.ctrlKey && e.key === "2") {
    e.preventDefault();
    switchView("profile");
  }
});

passageEl.addEventListener("click", () => inputEl.focus());

document.getElementById("newBtn").addEventListener("click", async () => {
  const name = pickRandom();
  if (name) await loadDoc(name);
  hideResultCard();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (inputEl.value.length > 0 && !confirm("确认重置当前进度？")) return;
  resetInput();
  hideResultCard();
});

document.getElementById("zenBtn")?.addEventListener("click", toggleZenMode);

const timerSelect = document.getElementById("timerSelect");
if (timerSelect) {
  timerSelect.addEventListener("change", () => {
    const v = parseInt(timerSelect.value, 10);
    setTimerMode(v);
    if (v > 0 && inputEl.value.length > 0 && !startTime) {
      // If already typing, start timer
    }
  });
  // Restore saved timer
  const savedTimer = localStorage.getItem(K_TIMER);
  if (savedTimer) {
    const v = parseInt(savedTimer, 10);
    timerSelect.value = String(v);
    timerMode = v;
  }
}

selectEl.addEventListener("change", async () => {
  if (selectEl.value) await loadDoc(selectEl.value);
  hideResultCard();
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
let accChart = null;
let profileFilter = "all"; // "all" | "zen"

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

  // Streak
  const streak = computeStreak(loadHistory());
  document.getElementById("streakDays").textContent = streak > 0 ? `${streak} 天` : "0";
}

function renderErrorKeys(list) {
  const topErrors = getTopErrorKeys(list, 5);
  const el = document.getElementById("errorKeyList");
  if (!el) return;
  el.replaceChildren();
  if (topErrors.length === 0) {
    el.textContent = "暂无错误键位数据";
    return;
  }
  for (const { pair, count } of topErrors) {
    const item = document.createElement("div");
    item.className = "error-key-item";
    const keySpan = document.createElement("span");
    keySpan.className = "ek-key";
    const [wrong, correct] = pair.split("→");
    keySpan.textContent = `${wrong} → ${correct}`;
    const countSpan = document.createElement("span");
    countSpan.className = "ek-count";
    countSpan.textContent = `×${count}`;
    item.append(keySpan, countSpan);
    el.appendChild(item);
  }
}

function filterList(list) {
  if (profileFilter === "zen") return list.filter(r => r.zen);
  return list;
}

function renderProfile() {
  const allList = loadHistory();
  const list = filterList(allList);
  const s = computeStats(list);
  renderProfileStats(s);
  renderErrorKeys(list);

  // Update filter count
  const zenCount = allList.filter(r => r.zen).length;
  const countEl = document.getElementById("filterCount");
  if (countEl) {
    countEl.textContent = profileFilter === "zen"
      ? `${zenCount} 条记录`
      : `共 ${allList.length} 条`;
  }

  const listEl = document.getElementById("historyList");
  const recent = list.slice(-30).reverse();
  listEl.replaceChildren();
  for (const r of recent) {
    const item = document.createElement("div");
    item.className = "history-item" + (r.zen ? " hi-zen" : "");

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

    // Zen badge
    if (r.zen) {
      const badge = document.createElement("span");
      badge.className = "hi-badge";
      badge.textContent = "禅";
      item.append(date, doc, badge, speed, acc, err);
    } else {
      item.append(date, doc, speed, acc, err);
    }

    // Click to revisit
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      if (r.doc && docs.includes(r.doc)) {
        switchView("practice");
        loadDoc(r.doc);
      }
    });

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
  const accs = recent.map(r => r.acc);
  const speedLabels = recent.map(r => formatSpeed(r));

  Chart.defaults.color = muted;
  Chart.defaults.font.family = "Segoe UI, system-ui, sans-serif";

  // WPM Chart
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

  // Error Chart
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

  // Accuracy Chart
  const ctxAcc = document.getElementById("accChart")?.getContext("2d");
  if (!ctxAcc) return;
  if (accChart) accChart.destroy();
  accChart = new Chart(ctxAcc, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "准确率",
        data: accs,
        borderColor: "#1a9c54",
        backgroundColor: "#1a9c5422",
        tension: 0.3,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "准确率趋势（最近 30 次）", color: ink } },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: grid } },
        y: { min: 0, max: 100, ticks: { color: muted }, grid: { color: grid } },
      },
    },
  });
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("确认清空全部历史记录？此操作不可撤销。")) return;
  saveHistory([]);
  errorKeyPairs = {};
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

document.getElementById("resultCloseBtn")?.addEventListener("click", hideResultCard);
document.getElementById("resultAgainBtn")?.addEventListener("click", () => {
  hideResultCard();
  resetInput();
});

/* ============== 主题切换 ============== */
function applyTheme(name) {
  if (name === "auto") {
    document.documentElement.removeAttribute("data-theme");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyColorScheme(mq.matches ? "dark" : "blue");
  } else if (name) {
    document.documentElement.setAttribute("data-theme", name);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function applyColorScheme(scheme) {
  document.documentElement.setAttribute("data-theme", scheme);
}

// Listen for system color scheme changes when in auto mode
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  const savedTheme = localStorage.getItem(K_THEME);
  if (savedTheme === "auto") {
    applyColorScheme(e.matches ? "dark" : "blue");
  }
});

const themeSelect = document.getElementById("themeSelect");
const savedTheme = localStorage.getItem(K_THEME);
if (savedTheme) {
  applyTheme(savedTheme);
  themeSelect.value = savedTheme;
} else {
  applyTheme("auto");
  themeSelect.value = "auto";
}
themeSelect.addEventListener("change", () => {
  const v = themeSelect.value;
  applyTheme(v);
  localStorage.setItem(K_THEME, v);
  if (currentView === "profile") renderProfile();
});

// Profile filter tabs
document.querySelectorAll(".filter-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach(t => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    profileFilter = tab.dataset.filter;
    localStorage.setItem(K_PROFILE_FILTER, profileFilter);
    renderProfile();
  });
});

/* ============== 初始化 ============== */
(async function init() {
  try {
    await loadCategoriesConfig();
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

  // Restore Zen mode
  const savedZen = localStorage.getItem(K_ZEN);
  if (savedZen === "1") {
    zenMode = true;
    applyZenMode();
    const zenBtn = document.getElementById("zenBtn");
    if (zenBtn) zenBtn.textContent = "退出禅定";
  }

  // Restore profile filter
  const savedFilter = localStorage.getItem(K_PROFILE_FILTER);
  if (savedFilter === "zen") {
    profileFilter = "zen";
    document.querySelectorAll(".filter-tab").forEach(t => {
      if (t.dataset.filter === "zen") {
        t.classList.add("active");
        t.setAttribute("aria-selected", "true");
      } else {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      }
    });
  }
})();
