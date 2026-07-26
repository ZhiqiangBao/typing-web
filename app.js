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
let zenErrorCount = 0; // zen mode: number of positions with errors
let zenErrorPositions = new Set(); // zen mode: positions that had errors
let zenErrorPairs = []; // zen mode: wrong→correct pairs (one per position)
let isComposing = false; // IME composition in progress

/* ============== localStorage 键 ============== */
const K_HISTORY = "typing_history";
const K_THEME = "typing_theme";
const K_LAST_DOC = "typing_last_doc";
const K_TIMER = "typing_timer";
const K_ZEN = "typing_zen";
const K_PROFILE_FILTER = "typing_profile_filter";
const K_LANG = "typing_lang";
const MAX_HISTORY = 500;

/* ============== i18n 国际化 ============== */
const I18N = {
  zh: {
    app_title: "打字练习",
    tab_practice: "练习 Practice",
    tab_profile: "档案 Profile",
    timer: "计时",
    timer_label: "计时模式",
    no_limit: "不限时",
    theme: "主题",
    theme_label: "选择主题",
    theme_auto: "跟随系统",
    theme_blue: "浅蓝",
    theme_dark: "深色",
    theme_beige: "米黄",
    theme_green: "青绿",
    zen_mode: "禅定模式",
    zen_exit: "退出禅定",
    zen_hint: "禅定模式：输入错误会记录并阻止前进，必须输入正确才能继续。按 Esc 退出。",
    zen_confirm: "切换到禅定模式将重置当前进度，确认？",
    zen_exit_confirm: "退出禅定模式并结束练习？",
    zen_end: "禅定结束",
    select_doc: "选择文章",
    progress: "进度",
    accuracy: "准确率",
    speed: "速度",
    errors: "错误",
    loading: "加载中...",
    placeholder: "在这里输入上面的文本…（一致显示黑色，不一致显示红色）",
    result_done: "🎉 完成！",
    result_timeup: "⏰ 时间到！",
    result_again: "再来一篇",
    result_close: "关闭",
    new_doc: "换一篇（随机）",
    reset: "重置",
    reset_confirm: "确认重置当前进度？",
    hint: "Tab 下一篇 · Esc 重置/退出禅定 · Ctrl+Enter 换篇 · Ctrl+1/2 切换视图",
    profile_title: "训练档案",
    export: "导出",
    import: "导入",
    clear_history: "清空历史",
    clear_confirm: "确认清空全部历史记录？此操作不可撤销。",
    import_fail: "导入失败：请确认文件为有效的 JSON 历史记录。",
    filter_all: "全部",
    filter_zen: "禅定模式",
    filter_count: "{n} 条记录",
    filter_total: "共 {n} 条",
    total_count: "总训练次数",
    total_acc: "总正确率",
    max_wpm: "最高 WPM",
    avg_wpm: "平均 WPM",
    today_count: "今日训练",
    today_acc: "今日正确率",
    today_max: "今日最高 WPM",
    today_avg: "今日平均 WPM",
    streak: "连续天数",
    top_errors: "Top 5 易错键",
    no_error_data: "暂无错误键位数据",
    error_char_count: "错误字符数",
    speed_trend: "速度趋势（最近 30 次）",
    error_trend: "错误字符数（最近 30 次）",
    acc_trend: "准确率趋势（最近 30 次）",
    cannot_connect: "无法连接服务器，请确认 server.py 正在运行。",
    no_docs: "请在 docs 文件夹中放入 .txt 或 .md 文档后刷新页面。",
    load_failed: "加载",
    load_failed_tip: "失败，请重试或换一篇。",
    zen_badge: "禅",
    doc_label_lolita: "洛丽塔 Lolita",
    doc_label_lolita_en: "洛丽塔 Lolita（英文）",
    doc_label_lolita_zh: "洛丽塔 Lolita（中文）",
    doc_label_proust: "追忆似水年华",
    doc_label_proust_en: "追忆似水年华（英文）",
    doc_label_proust_zh: "追忆似水年华（中文）",
    doc_label_swann: "追忆·斯万之恋",
    doc_label_swann_en: "追忆·斯万之恋（英文）",
    doc_label_swann_zh: "追忆·斯万之恋（中文）",
    doc_label_ombre: "追忆·在少女们身旁",
    doc_label_ombre_en: "追忆·在少女们身旁（英文）",
    doc_label_ombre_zh: "追忆·在少女们身旁（中文）",
    doc_label_solitude: "百年孤独",
    doc_label_solitude_en: "百年孤独（英文）",
    doc_label_solitude_zh: "百年孤独（中文）",
    doc_label_code: "代码 / 符号",
    doc_label_zh: "中文诗文",
    doc_label_en: "英文练习",
    doc_label_other: "其他",
    lang_label: "语言",
    lang_zh: "中文",
    lang_en: "English",
    wpm_unit: "WPM",
    cpm_unit: "CPM",
    speed_text: "{speed} {unit}",
    acc_text: "{acc}%",
    err_text: "{n} 处",
    result_status: "{title}准确率 {acc}% · {speed} {unit} · 错误 {errors} 处",
    result_status_en: "{title} 准确率 {acc}% · {speed} {unit} · 错误 {errors} 处",
    result_speed: "{speed} {unit}",
    result_err: "{n} 处",
    import_success: "已导入，当前共 {n} 条记录。",
    load_doc_failed: "加载{name}失败，请重试或换一篇。",
  },
  en: {
    app_title: "Typing Practice",
    tab_practice: "Practice",
    tab_profile: "Profile",
    timer: "Timer",
    timer_label: "Timer",
    no_limit: "No limit",
    theme: "Theme",
    theme_label: "Theme",
    theme_auto: "System",
    theme_blue: "Light Blue",
    theme_dark: "Dark",
    theme_beige: "Beige",
    theme_green: "Green",
    zen_mode: "Zen Mode",
    zen_exit: "Exit Zen",
    zen_hint: "Zen mode: Wrong input is recorded and blocks advance. Type correctly to continue. Press Esc to exit.",
    zen_confirm: "Switching to Zen mode will reset current progress. Confirm?",
    zen_exit_confirm: "Exit Zen mode and end this exercise?",
    zen_end: "Zen ended",
    select_doc: "Select Document",
    progress: "Progress",
    accuracy: "Accuracy",
    speed: "Speed",
    errors: "Errors",
    loading: "Loading...",
    placeholder: "Type the text above here... (black = correct, red = wrong)",
    result_done: "🎉 Done!",
    result_timeup: "⏰ Time's up!",
    result_again: "Try Again",
    result_close: "Close",
    new_doc: "New Document (Random)",
    reset: "Reset",
    reset_confirm: "Confirm reset current progress?",
    hint: "Tab next · Esc reset/exit zen · Ctrl+Enter new · Ctrl+1/2 switch view",
    profile_title: "Training Profile",
    export: "Export",
    import: "Import",
    clear_history: "Clear History",
    clear_confirm: "Clear all history records? This cannot be undone.",
    import_fail: "Import failed: please confirm the file is a valid JSON history.",
    filter_all: "All",
    filter_zen: "Zen Mode",
    filter_count: "{n} records",
    filter_total: "Total {n}",
    total_count: "Total Sessions",
    total_acc: "Overall Accuracy",
    max_wpm: "Best WPM",
    avg_wpm: "Avg WPM",
    today_count: "Today",
    today_acc: "Today Accuracy",
    today_max: "Today Best",
    today_avg: "Today Avg",
    streak: "Day Streak",
    top_errors: "Top 5 Error Keys",
    no_error_data: "No error key data yet",
    error_char_count: "Error Characters",
    speed_trend: "Speed Trend (Last 30)",
    error_trend: "Error Characters (Last 30)",
    acc_trend: "Accuracy Trend (Last 30)",
    cannot_connect: "Cannot connect to server. Please confirm server.py is running.",
    no_docs: "Put .txt or .md files in the docs folder and refresh the page.",
    load_failed: "Failed to load",
    load_failed_tip: ". Please retry or choose another.",
    zen_badge: "Zen",
    doc_label_lolita: "Lolita",
    doc_label_lolita_en: "Lolita (EN)",
    doc_label_lolita_zh: "Lolita (ZH)",
    doc_label_proust: "In Search of Lost Time",
    doc_label_proust_en: "In Search of Lost Time (EN)",
    doc_label_proust_zh: "In Search of Lost Time (ZH)",
    doc_label_swann: "Swann's Way",
    doc_label_swann_en: "Swann's Way (EN)",
    doc_label_swann_zh: "Swann's Way (ZH)",
    doc_label_ombre: "Within a Budding Grove",
    doc_label_ombre_en: "Within a Budding Grove (EN)",
    doc_label_ombre_zh: "Within a Budding Grove (ZH)",
    doc_label_solitude: "One Hundred Years of Solitude",
    doc_label_solitude_en: "One Hundred Years of Solitude (EN)",
    doc_label_solitude_zh: "One Hundred Years of Solitude (ZH)",
    doc_label_code: "Code / Symbols",
    doc_label_zh: "Chinese Poetry",
    doc_label_en: "English Practice",
    doc_label_other: "Other",
    lang_label: "Lang",
    lang_zh: "中文",
    lang_en: "English",
    wpm_unit: "WPM",
    cpm_unit: "CPM",
    speed_text: "{speed} {unit}",
    acc_text: "{acc}%",
    err_text: "{n}",
    result_status: "{title} Accuracy {acc}% · {speed} {unit} · {errors} errors",
    result_status_en: "{title} Accuracy {acc}% · {speed} {unit} · {errors} errors",
    result_speed: "{speed} {unit}",
    result_err: "{n}",
    import_success: "Imported successfully. {n} records total.",
    load_doc_failed: "Failed to load {name}. Please retry or choose another.",
  },
};

let currentLang = localStorage.getItem(K_LANG) || (navigator.language?.startsWith("zh") ? "zh" : "en");

function t(key, params) {
  const dict = I18N[currentLang] || I18N.zh;
  let str = dict[key] || I18N.zh[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

function applyLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.title = t("app_title");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (t(key)) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.dataset.i18nPh;
    if (t(key)) el.placeholder = t(key);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    const key = el.dataset.i18nAria;
    if (t(key)) el.setAttribute("aria-label", t(key));
  });
  const zenBtn = document.getElementById("zenBtn");
  if (zenBtn) zenBtn.textContent = zenMode ? t("zen_exit") : t("zen_mode");
  const statusEl = document.getElementById("status");
  if (zenMode && statusEl && !statusEl.classList.contains("done")) {
    statusEl.textContent = t("zen_hint");
  }
  renderDocCategories();
  if (currentDoc) {
    statSpeedLabel.textContent = isChineseDoc(currentDoc) ? t("cpm_unit") : t("wpm_unit");
  }
  if (currentView === "profile") {
    renderProfile();
  }
}

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
  if (zen) {
    // Zen mode: typed only contains correct chars, use zenErrorPairs
    wrongChars.push(...zenErrorPairs);
  } else {
    const typedVal = inputEl.value;
    for (let i = 0; i < typedLen && i < target.length; i++) {
      if (typedVal[i] !== target[i]) {
        const pair = `${typedVal[i]}→${target[i]}`;
        wrongChars.push(pair);
      }
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

  // Try config file first
  if (categoriesConfig && categoriesConfig.prefixes) {
    for (const entry of categoriesConfig.prefixes) {
      if (base.startsWith(entry.prefix)) {
        return entry.category_key || entry.prefix;
      }
    }
  }

  if (base.startsWith("lolita")) return "lolita";
  if (base.startsWith("proust_swann")) return "proust_swann";
  if (base.startsWith("proust_ombre")) return "proust_ombre";
  if (base.startsWith("proust")) return "proust";
  if (base.startsWith("solitude")) return "solitude";

  const code = ["code_cpp", "python_code", "javascript_code", "sql_query", "numbers_symbols"];
  if (code.includes(base)) return "code";
  const zh = ["tang_poems", "chinese", "chinese_prose", "science_light"];
  if (zh.includes(base)) return "zh_poetry";
  const en = ["english_story", "proverbs", "pangrams", "quotes", "tech_gpu"];
  if (en.includes(base)) return "en_practice";
  return "other";
}

function categoryLabel(name) {
  const base = name.replace(/\.(txt|md)$/i, "");
  const cat = categorize(name);
  const hasEn = base.includes("_en");
  const hasZh = base.includes("_zh");
  const langKey = hasEn ? "_en" : hasZh ? "_zh" : "";
  return t("doc_label_" + cat + langKey);
}

const GROUP_ORDER = [
  "lolita_en", "lolita_zh", "lolita",
  "proust_en", "proust_zh",
  "proust_swann_en", "proust_swann_zh",
  "proust_ombre_en", "proust_ombre_zh",
  "solitude_en", "solitude_zh", "solitude",
  "en_practice", "zh_poetry", "code", "other",
];

function populateSelect() {
  const prevValue = selectEl.value;
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
    return ia - ib;
  });
  for (const cat of cats) {
    const og = document.createElement("optgroup");
    og.label = t("doc_label_" + cat);
    for (const name of groups.get(cat)) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name.replace(/\.(txt|md)$/i, "");
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }
  if (prevValue && docs.includes(prevValue)) {
    selectEl.value = prevValue;
  }
}

function renderDocCategories() {
  populateSelect();
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
    statusEl.textContent = t("load_doc_failed", { name });
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
  zenErrorCount = 0;
  zenErrorPositions = new Set();
  zenErrorPairs = [];
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
    zenErrorCount = 0;
    zenErrorPositions = new Set();
    zenErrorPairs = [];
    statusEl.textContent = t("zen_hint");
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
    if (inputEl.value.length > 0 && !confirm(t("zen_confirm"))) return;
    zenMode = true;
    resetInput();
  }
  localStorage.setItem(K_ZEN, zenMode ? "1" : "0");
  applyZenMode();
  const btn = document.getElementById("zenBtn");
  if (btn) btn.textContent = zenMode ? t("zen_exit") : t("zen_mode");
}

/* ============== 完成练习 ============== */
function finishExercise(timeUp = false) {
  const typed = inputEl.value;
  const { correct, errors: baseErrors } = countStats(typed);
  const errors = baseErrors + (zenMode ? zenErrorCount : 0);
  const totalKeystrokes = typed.length + (zenMode ? zenErrorCount : 0);
  const acc = totalKeystrokes ? Math.round((correct / totalKeystrokes) * 100) : 100;
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
  const title = timeUp ? t("result_timeup") : t("result_done");
  statusEl.textContent = t("result_status", { title, acc, speed, unit: unitLabel, errors });

  showResultCard({ acc, speed, unitLabel, errors, timeUp });

  if (!lastSavedKey) {
    recordResult({ speed, speedUnit: unit, acc, errors, typedLen: totalKeystrokes, correctLen: correct, zen: zenMode });
    if (currentView === "profile") renderProfile();
  }
}

function showResultCard({ acc, speed, unitLabel, errors, timeUp }) {
  const card = document.getElementById("resultCard");
  if (!card) return;
  card.style.display = "flex";
  card.classList.add("result-show");
  document.getElementById("resultTitle").textContent = timeUp ? t("result_timeup") : t("result_done");
  document.getElementById("resultAcc").textContent = t("acc_text", { acc });
  document.getElementById("resultSpeed").textContent = t("result_speed", { speed, unit: unitLabel });
  document.getElementById("resultErr").textContent = t("result_err", { n: errors });
}

function hideResultCard() {
  const card = document.getElementById("resultCard");
  if (!card) return;
  card.style.display = "none";
  card.classList.remove("result-show");
}

/* ============== 实时更新 + 完成时记录 ============== */
function update(fullRecount = false) {
  let typed = inputEl.value;
  let typedLen = typed.length;
  const spans = passageEl.children;

  // Zen 模式：先截断错误输入，再渲染 spans（防止光标跳到下一字符）
  if (zenMode && typedLen > prevTypedLen) {
    for (let i = prevTypedLen; i < typedLen; i++) {
      if (typed[i] !== target[i]) {
        inputEl.value = typed.substring(0, i);
        typed = inputEl.value;
        typedLen = typed.length;
        break;
      }
    }
  }

  if (fullRecount || typedLen < prevTypedLen) {
    for (let i = 0; i < spans.length; i++) updateSpanAt(i, typed);
  } else {
    const start = Math.max(0, prevTypedLen - 1);
    const end = Math.min(spans.length - 1, typedLen);
    for (let i = start; i <= end; i++) updateSpanAt(i, typed);
    if (typedLen + 1 < spans.length) updateSpanAt(typedLen + 1, typed);
  }
  prevTypedLen = typedLen;

  // Zen 模式：强制所有曾出错的位置保持红色（即使已打对前进后也不恢复）
  if (zenMode) {
    for (const pos of zenErrorPositions) {
      const span = passageEl.children[pos];
      if (span) span.className = "ch wrong";
    }
  }

  const finalTyped = inputEl.value;
  const finalLen = finalTyped.length;
  const { correct, errors: baseErrors } = countStats(finalTyped);
  const errors = baseErrors + (zenMode ? zenErrorCount : 0);
  const totalKeystrokes = finalLen + (zenMode ? zenErrorCount : 0);
  const acc = totalKeystrokes ? Math.round((correct / totalKeystrokes) * 100) : 100;
  const prog = target.length ? Math.round((Math.min(finalLen, target.length) / target.length) * 100) : 0;
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
    if (!zenMode && finalLen > 0 && window.innerWidth <= 720) {
      inputEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  if (finalLen >= target.length && target.length > 0) {
    finishExercise(false);
  }
}

inputEl.addEventListener("compositionstart", () => {
  isComposing = true;
});

inputEl.addEventListener("compositionend", () => {
  isComposing = false;
  let zenWrongPos = -1;
  // Zen mode: validate IME-composed characters
  if (zenMode) {
    const typed = inputEl.value;
    for (let i = prevTypedLen; i < typed.length; i++) {
      if (typed[i] !== target[i]) {
        inputEl.value = typed.substring(0, i);
        if (!zenErrorPositions.has(i)) {
          zenErrorPositions.add(i);
          zenErrorCount++;
          zenErrorPairs.push(`${typed[i]}→${target[i]}`);
        }
        zenWrongPos = i;
        break;
      }
    }
  }
  if (!startTime && inputEl.value.length > 0) {
    startTime = Date.now();
    if (timerMode > 0) startTimer(timerMode);
  }
  update(true);
  // update(true) 后标记错误 span（避免被 fullRecount 覆盖）
  if (zenWrongPos >= 0) {
    const span = passageEl.children[zenWrongPos];
    if (span) span.className = "ch wrong";
    prevTypedLen = zenWrongPos;
  }
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
    if (inputEl.value.length > 0 && !confirm(t("reset_confirm"))) return;
    resetInput();
    hideResultCard();
  } else if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    const next = pickRandom();
    if (next) loadDoc(next);
  }
});

/* Zen 模式按键拦截：捕获阶段阻断 Backspace / 错误字符，Esc 退出 */
document.addEventListener("keydown", (e) => {
  if (!zenMode) return;
  if (e.key === "Backspace") {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (inputEl.value.length > 0 && !confirm(t("zen_exit_confirm"))) return;
    const typed = inputEl.value;
    const { correct } = countStats(typed);
    const errors = zenErrorCount;
    const totalKeystrokes = typed.length + zenErrorCount;
    const acc = totalKeystrokes ? Math.round((correct / totalKeystrokes) * 100) : 100;
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
      recordResult({ speed, speedUnit: unit, acc, errors, typedLen: totalKeystrokes, correctLen: correct, zen: true });
      if (currentView === "profile") renderProfile();
    }
    zenMode = false;
    localStorage.setItem(K_ZEN, "0");
    passageEl.classList.remove("zen");
    inputEl.classList.remove("zen-hidden");
    const btn = document.getElementById("zenBtn");
    if (btn) btn.textContent = t("zen_mode");
    return;
  }
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    const next = pickNextDoc();
    if (next) loadDoc(next);
    return;
  }
  // Zen mode: 可打印字符错误时，标记 span 为 wrong（不阻止输入，由 update() 截断）
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !isComposing) {
    const typed = inputEl.value;
    const pos = typed.length;
    if (pos < target.length && e.key !== target[pos]) {
      // 每个位置只记录一次错误
      if (!zenErrorPositions.has(pos)) {
        zenErrorPositions.add(pos);
        zenErrorCount++;
        zenErrorPairs.push(`${e.key}→${target[pos]}`);
      }
      // 标记当前位置为错误（永久红色）
      const span = passageEl.children[pos];
      if (span) span.className = "ch wrong";
    }
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
  if (inputEl.value.length > 0 && !confirm(t("reset_confirm"))) return;
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
    el.textContent = t("no_error_data");
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
    if (profileFilter === "zen") {
      countEl.textContent = t("filter_count", { n: zenCount });
    } else {
      countEl.textContent = t("filter_total", { n: allList.length });
    }
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
    acc.textContent = t("acc_text", { acc: r.acc });

    const err = document.createElement("span");
    err.className = "hi-err";
    err.textContent = t("err_text", { n: r.errors });

    // Zen badge
    if (r.zen) {
      const badge = document.createElement("span");
      badge.className = "hi-badge";
      badge.textContent = t("zen_badge");
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
  const labels = recent.map(r => {
    const d = new Date(r.ts);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${m}/${day} ${h}:${min}`;
  });
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
        label: t("speed"),
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
        title: { display: true, text: t("speed_trend"), color: ink },
        legend: { position: "top", align: "end", labels: { color: muted, boxWidth: 12, boxHeight: 8 } },
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
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { color: muted, maxTicksLimit: 3 },
          grid: { color: grid },
        },
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
        label: t("error_char_count"),
        data: errs,
        backgroundColor: wrong,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: t("error_trend"), color: ink },
        legend: { position: "top", align: "end", labels: { color: muted, boxWidth: 12, boxHeight: 8 } },
      },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { color: muted, maxTicksLimit: 3, callback: v => v + " 个" },
          grid: { color: grid },
        },
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
        label: t("accuracy"),
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
      plugins: {
        title: { display: true, text: t("acc_trend"), color: ink },
        legend: { position: "top", align: "end", labels: { color: muted, boxWidth: 12, boxHeight: 8 } },
      },
      scales: {
        x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
        y: {
          min: 0,
          max: 100,
          ticks: { color: muted, maxTicksLimit: 3, callback: v => v + "%" },
          grid: { color: grid },
        },
      },
    },
  });
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm(t("clear_confirm"))) return;
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
    alert(t("import_success", { n: loadHistory().length }));
  } catch {
    alert(t("import_fail"));
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
    passageEl.textContent = t("cannot_connect");
    inputEl.disabled = true;
    return;
  }
  if (docs.length === 0) {
    passageEl.textContent = t("no_docs");
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
    if (zenBtn) zenBtn.textContent = t("zen_exit");
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

  // Init language
  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener("change", () => {
      currentLang = langSelect.value;
      localStorage.setItem(K_LANG, currentLang);
      applyLanguage();
    });
  }
  applyLanguage();
})();
