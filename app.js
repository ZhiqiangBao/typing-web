"use strict";

const passageEl = document.getElementById("passage");
const inputEl = document.getElementById("input");
const selectEl = document.getElementById("docSelect");
const statProg = document.getElementById("statProg");
const statAcc = document.getElementById("statAcc");
const statWpm = document.getElementById("statWpm");
const statErr = document.getElementById("statErr");
const statusEl = document.getElementById("status");

let target = "";
let docs = [];
let currentDoc = null;
let startTime = null;

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
  "百年孤独（中文）", "百年孤独",
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
  update();
  inputEl.focus();
}

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
  await loadDoc(pickRandom());
})();
