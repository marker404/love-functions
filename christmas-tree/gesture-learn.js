// ============================================================
// gesture-learn.js — 交互式手势学习引擎（零依赖，纯 JS）
// ------------------------------------------------------------
// 能力：
//   1. 从 MediaPipe 的 21 个关键点提取「旋转 / 尺度 / 平移不变」特征
//   2. k-NN 即时学习：每次「更正」立刻生效，无需训练
//   3. 轻量神经网络：点「训练」在浏览器内 SGD 训练，提升泛化
//   4. 实时 HUD：当前识别类别 + 置信度 + 各类别概率条
//   5. 记忆库：localStorage 持久化，支持导入 / 导出 / 清空
//   6. ML 接管：开启后用识别结果覆盖规则判定，驱动圣诞树
// ------------------------------------------------------------
// 依赖：仅 store.js（读取 gesture 状态写回预测结果）
// ============================================================

import { gesture, bus } from "./store.js";

/* --------------------- 类别定义 --------------------- */
export const CLASSES = [
  { key: "none",  name: "无 / 其他", short: "无",   color: "#8b8b8b" },
  { key: "fist",  name: "握拳",       short: "拳",   color: "#a83345" },
  { key: "open",  name: "张开",       short: "张",   color: "#d9b370" },
  { key: "pinch", name: "捏合",       short: "捏",   color: "#7ec8a0" },
  { key: "point", name: "食指",       short: "指",   color: "#8fb8e8" },
  { key: "ok",    name: "OK",         short: "OK",   color: "#f0cf7a" },
];
const CLASS_KEYS = CLASSES.map(c => c.key);
const KEY_INDEX = Object.fromEntries(CLASS_KEYS.map((k, i) => [k, i]));

/* --------------------- 存储键 --------------------- */
const LS_DATA = "xmas_gesture_dataset_v1";
const LS_NN = "xmas_gesture_nn_v1";
const LS_CFG = "xmas_gesture_cfg_v1";
const FEAT_DIM = 52;

/* --------------------- 数学工具 --------------------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1e-6;
  return Math.acos(clamp((v1x * v2x + v1y * v2y) / m, -1, 1)) * 180 / Math.PI;
}

/* ============================================================
   一、特征提取：旋转 / 尺度 / 平移不变
   ============================================================ */
export function extractFeatures(lm) {
  if (!lm || lm.length < 21) return null;
  const wrist = lm[0];
  // 掌长基准：腕 → 中指根(9)，兜底用食指根(5)
  let palm = d2(wrist, lm[9]);
  if (palm < 1e-4) palm = d2(wrist, lm[5]);
  palm = Math.max(palm, 1e-4);

  // 归一化旋转：把「腕→中指根」旋到正上方 (0,-1)
  const dx = lm[9].x - wrist.x, dy = lm[9].y - wrist.y;
  const a = Math.atan2(dy, dx);
  const r = -Math.PI / 2 - a;
  const cos = Math.cos(r), sin = Math.sin(r);

  const f = new Array(FEAT_DIM);
  let p = 0;
  for (let i = 0; i < 21; i++) {
    const px = lm[i].x - wrist.x, py = lm[i].y - wrist.y;
    const X = px * cos - py * sin;
    const Y = px * sin + py * cos;
    f[p++] = X / palm;
    f[p++] = Y / palm;
  } // 42 维归一化坐标

  // 5 个关节弯曲角（旋转无关），归一化到 0..1
  const bends = [
    angleAt(lm[2], lm[3], lm[4]),   // 拇指 IP
    angleAt(lm[5], lm[6], lm[8]),   // 食指 PIP
    angleAt(lm[9], lm[10], lm[12]), // 中指 PIP
    angleAt(lm[13], lm[14], lm[16]),// 无名指 PIP
    angleAt(lm[17], lm[18], lm[20]),// 小指 PIP
  ];
  for (const deg of bends) f[p++] = deg / 180; // 5 维 → 47

  // 4 指指尖伸出比（指尖到腕 / 掌长）
  for (const tip of [8, 12, 16, 20]) f[p++] = d2(wrist, lm[tip]) / palm; // → 51

  // 捏合比（拇指尖 ↔ 食指尖 / 掌长）
  f[p++] = d2(lm[4], lm[8]) / palm; // → 52

  return f;
}

/* ============================================================
   二、记忆库（localStorage 持久化）
   ============================================================ */
export const dataset = {
  samples: [],

  load() {
    try {
      const raw = localStorage.getItem(LS_DATA);
      const parsed = raw ? JSON.parse(raw) : [];
      this.samples = Array.isArray(parsed) ? parsed.filter(s => s && Array.isArray(s.f) && s.f.length === FEAT_DIM && KEY_INDEX[s.label] !== undefined) : [];
    } catch (e) { this.samples = []; }
    return this.samples;
  },
  save() {
    try { localStorage.setItem(LS_DATA, JSON.stringify(this.samples)); }
    catch (e) { console.warn("[learn] 记忆库保存失败", e); }
  },
  add(features, label) {
    if (!features || KEY_INDEX[label] === undefined) return false;
    this.samples.push({ f: Array.from(features), label, t: Date.now() });
    this.save();
    return true;
  },
  clear() { this.samples = []; this.save(); },
  counts() {
    const c = Object.fromEntries(CLASS_KEYS.map(k => [k, 0]));
    for (const s of this.samples) c[s.label]++;
    return c;
  },
  get size() { return this.samples.length; },
  toJSON() {
    return JSON.stringify({ version: 1, featureDim: FEAT_DIM, classes: CLASS_KEYS, samples: this.samples }, null, 2);
  },
  importJSON(text) {
    try {
      const obj = JSON.parse(text);
      const arr = Array.isArray(obj) ? obj : obj.samples;
      if (!Array.isArray(arr)) throw new Error("格式不对");
      let n = 0;
      for (const s of arr) {
        if (s && Array.isArray(s.f) && s.f.length === FEAT_DIM && KEY_INDEX[s.label] !== undefined) {
          this.samples.push({ f: s.f, label: s.label, t: s.t || Date.now() }); n++;
        }
      }
      this.save();
      return n;
    } catch (e) { throw new Error("导入失败：" + e.message); }
  },
};

/* ============================================================
   三、k-NN 即时学习分类器（距离加权投票）
   ============================================================ */
function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

function predictKNN(features, k = 7) {
  const S = dataset.samples;
  if (!S.length || !features) return null;
  const kk = Math.min(k, S.length);
  // 取最近的 kk 个
  const near = new Array(S.length);
  for (let i = 0; i < S.length; i++) near[i] = { s: S[i], d: euclid(features, S[i].f) };
  near.sort((a, b) => a.d - b.d);
  const top = near.slice(0, kk);

  const scores = Object.fromEntries(CLASS_KEYS.map(k2 => [k2, 0]));
  let total = 0;
  for (const n of top) {
    const w = 1 / Math.pow(n.d + 0.12, 2); // 距离越近权重越大
    scores[n.s.label] += w;
    total += w;
  }
  for (const k2 of CLASS_KEYS) scores[k2] /= (total || 1);

  let best = CLASS_KEYS[0], bestScore = 0;
  for (const k2 of CLASS_KEYS) if (scores[k2] > bestScore) { bestScore = scores[k2]; best = k2; }
  const sorted = Object.values(scores).sort((a, b) => b - a);
  return { label: best, confidence: bestScore, margin: (sorted[0] || 0) - (sorted[1] || 0), scores };
}

/* ============================================================
   四、轻量神经网络（浏览器内 SGD 训练，可选增强）
   结构：FEAT_DIM → 24 → 12 → 类别数，ReLU + Softmax
   ============================================================ */
function randW(rows, cols) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols);
    for (let j = 0; j < cols; j++) m[i][j] = (Math.random() * 2 - 1) * Math.sqrt(2 / rows);
  }
  return m;
}
function zeros(rows, cols) { return Array.from({ length: rows }, () => new Array(cols).fill(0)); }

let nn = null;
export function hasNN() { return !!nn; }

function freshNN() {
  const H1 = 24, H2 = 12, C = CLASS_KEYS.length;
  return {
    W1: randW(FEAT_DIM, H1), b1: new Array(H1).fill(0),
    W2: randW(H1, H2),     b2: new Array(H2).fill(0),
    W3: randW(H2, C),      b3: new Array(C).fill(0),
  };
}
function nnForward(net, x) {
  const relu = v => v > 0 ? v : 0;
  const h1 = new Array(net.b1.length), h2 = new Array(net.b2.length);
  for (let j = 0; j < net.b1.length; j++) {
    let s = net.b1[j];
    for (let i = 0; i < x.length; i++) s += x[i] * net.W1[i][j];
    h1[j] = relu(s);
  }
  for (let j = 0; j < net.b2.length; j++) {
    let s = net.b2[j];
    for (let i = 0; i < h1.length; i++) s += h1[i] * net.W2[i][j];
    h2[j] = relu(s);
  }
  const logits = new Array(net.b3.length);
  for (let j = 0; j < net.b3.length; j++) {
    let s = net.b3[j];
    for (let i = 0; i < h2.length; i++) s += h2[i] * net.W3[i][j];
    logits[j] = s;
  }
  const mx = Math.max(...logits);
  const ex = logits.map(v => Math.exp(v - mx));
  const sum = ex.reduce((a, b) => a + b, 0) || 1;
  return { h1, h2, probs: ex.map(v => v / sum) };
}

/** 训练神经网络，返回 promise（分批让出主线程，不卡 UI） */
export async function trainNN(onProgress) {
  if (dataset.size < 8) throw new Error("样本太少，先采一点再训练（至少 8 条）");
  const counts = dataset.counts();
  const present = CLASS_KEYS.filter(k => counts[k] > 0);
  if (present.length < 2) throw new Error("至少需要两个类别的样本才能训练");

  nn = nn || freshNN();
  const net = nn;
  const lr = 0.08, epochs = 90;
  const data = dataset.samples.map(s => ({ x: s.f, y: KEY_INDEX[s.label] }));

  for (let ep = 0; ep < epochs; ep++) {
    // 打乱
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
    let loss = 0;
    for (const { x, y } of data) {
      const { h1, h2, probs } = nnForward(net, x);
      loss += -Math.log(Math.max(probs[y], 1e-9));
      // 输出层梯度（softmax + cross entropy）
      const d3 = probs.map((v, i) => v - (i === y ? 1 : 0));
      // W3 / b3
      for (let j = 0; j < net.b3.length; j++) {
        net.b3[j] -= lr * d3[j];
        for (let i = 0; i < h2.length; i++) net.W3[i][j] -= lr * h2[i] * d3[j];
      }
      // 隐藏层 2 梯度
      const d2 = new Array(net.b2.length).fill(0);
      for (let i = 0; i < h2.length; i++) {
        let s = 0;
        for (let j = 0; j < net.b3.length; j++) s += net.W3[i][j] * d3[j];
        d2[i] = s * (h2[i] > 0 ? 1 : 0);
      }
      for (let j = 0; j < net.b2.length; j++) {
        net.b2[j] -= lr * d2[j];
        for (let i = 0; i < h1.length; i++) net.W2[i][j] -= lr * h1[i] * d2[j];
      }
      // 隐藏层 1 梯度
      const d1 = new Array(net.b1.length).fill(0);
      for (let i = 0; i < h1.length; i++) {
        let s = 0;
        for (let j = 0; j < net.b2.length; j++) s += net.W2[i][j] * d2[j];
        d1[i] = s * (h1[i] > 0 ? 1 : 0);
      }
      for (let j = 0; j < net.b1.length; j++) {
        net.b1[j] -= lr * d1[j];
        for (let i = 0; i < x.length; i++) net.W1[i][j] -= lr * x[i] * d1[j];
      }
    }
    if (onProgress && (ep % 6 === 0 || ep === epochs - 1)) {
      onProgress((ep + 1) / epochs, loss / data.length);
      await new Promise(res => setTimeout(res, 0)); // 让出主线程
    }
  }
  saveNN();
  return { epochs, samples: data.length };
}

function predictNN(features) {
  if (!nn || !features) return null;
  const { probs } = nnForward(nn, features);
  const scores = Object.fromEntries(CLASS_KEYS.map((k, i) => [k, probs[i]]));
  let best = CLASS_KEYS[0], bestScore = 0;
  for (const k of CLASS_KEYS) if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
  const sorted = Object.values(scores).sort((a, b) => b - a);
  return { label: best, confidence: bestScore, margin: sorted[0] - sorted[1], scores };
}
function saveNN() { try { localStorage.setItem(LS_NN, JSON.stringify(nn)); } catch (e) {} }
function loadNN() {
  try {
    const r = localStorage.getItem(LS_NN);
    const net = r ? JSON.parse(r) : null;
    // 类别数变更后（如移除类别）旧模型输出维度不匹配，丢弃避免推理越界
    nn = (net && Array.isArray(net.b3) && net.b3.length === CLASS_KEYS.length) ? net : null;
  } catch (e) { nn = null; }
}

/* ============================================================
   五、配置 + 统一预测入口
   ============================================================ */
export const config = { engine: "knn", takeover: false, captureLabel: "point", continuous: false, showPanel: true, previewMode: false };
function loadCfg() {
  try { Object.assign(config, JSON.parse(localStorage.getItem(LS_CFG) || "{}")); } catch (e) {}
}
function saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(config)); } catch (e) {} }

let lastPrediction = null;
let lastFeatures = null;
let mlOkPrev = false;      // ML 侧 OK 边沿检测（接管模式下触发文案）

// —— 切换手势时的「接管保持」：低置信度过渡帧不立刻退回规则层 ——
let takeoverHold = "";     // 最近一次稳定接管的类别
let takeoverHoldAt = 0;    // 该类别最近一次被确认的时间
const TAKEOVER_CONF = 0.42;    // 接管置信度门槛（原来 0.55 太高，切换瞬间必然掉下去）
const TAKEOVER_HOLD_MS = 260; // 过渡帧保持时长：这段时间内即使置信度低也沿用上次类别

/** 主入口：喂当前主导手关键点，得到预测并写入 gesture，返回预测 */
export function recognize(landmarks) {
  lastFeatures = extractFeatures(landmarks);
  if (!lastFeatures) {
    lastPrediction = null; gesture.mlLabel = ""; gesture.mlConfidence = 0;
    mlOkPrev = false;
    return null;
  }
  const pred = config.engine === "nn" && nn ? predictNN(lastFeatures) : predictKNN(lastFeatures);
  lastPrediction = pred;
  gesture.mlLabel = pred ? pred.label : "";
  gesture.mlConfidence = pred ? pred.confidence : 0;
  gesture.mlPrediction = pred;
  return pred;
}

/** 一键重置所有识别状态：切手势卡住时不必把手移出框外，按 R 立即清干净 */
export function resetRecognition() {
  lastPrediction = null;
  lastFeatures = null;
  mlOkPrev = false;
  takeoverHold = "";
  takeoverHoldAt = 0;
  gesture.mlLabel = "";
  gesture.mlConfidence = 0;
  gesture.mlPrediction = null;
}

/** 把当前帧存入指定类别（更正 / 采集） */
export function capture(label, features) {
  const f = features || lastFeatures;
  if (!f) return { ok: false, msg: "画面里还没有手" };
  const ok = dataset.add(f, label);
  return ok ? { ok: true, msg: `已记住「${CLASSES.find(c => c.key === label)?.name || label}」· 共 ${dataset.size} 条` } : { ok: false, msg: "保存失败" };
}
export function getLastPrediction() { return lastPrediction; }
export function getLastFeatures() { return lastFeatures; }

/* ============================================================
   六、ML 接管：用预测覆盖规则判定（只覆盖离散姿态，旋转/缩放仍用规则）
   ============================================================ */
export function applyTakeover() {
  // 未接管：不写任何手势状态，且清掉保持与边沿，退出后干净重来
  // 注意：纯预览模式只收起面板，不暂停接管——否则树会退回规则判定，「效果」就不对了
  if (!config.takeover) {
    takeoverHold = "";
    mlOkPrev = false;
    return;
  }
  if (!lastPrediction) { mlOkPrev = false; return; }

  const t = performance.now();
  const conf = lastPrediction.confidence;
  let L;

  if (conf >= TAKEOVER_CONF) {
    // 置信度够：确认为当前类别，刷新保持时间戳
    L = lastPrediction.label;
    if (L === takeoverHold) takeoverHoldAt = t;
    else { takeoverHold = L; takeoverHoldAt = t; }
  } else if (takeoverHold && t - takeoverHoldAt < TAKEOVER_HOLD_MS) {
    // 过渡帧（换手势途中置信度短暂掉下去）：沿用上次类别，避免闪回规则层造成卡顿
    L = takeoverHold;
  } else {
    // 长时间低置信度：交还规则层
    takeoverHold = "";
    mlOkPrev = false;
    return;
  }

  gesture.pinch = L === "pinch";
  gesture.point = L === "point";
  gesture.ok = L === "ok";
  // 握拳 / 张开 → 覆盖 openness，驱动聚合 / 散开
  if (L === "fist") gesture.openness = 0.12;
  else if (L === "open") gesture.openness = 0.92;
  gesture.mode = gesture.ok ? "ok" : gesture.point ? "point"
    : gesture.pinch ? "pinch" : L === "fist" ? "fist" : L === "open" ? "open" : gesture.mode;
  // ML 识别到 OK 的上升沿 → 递增 okPulse，复用现有文案触发链
  const mlOkNow = L === "ok";
  if (mlOkNow && !mlOkPrev) gesture.okPulse++;
  mlOkPrev = mlOkNow;
}

/* ============================================================
   七、UI：训练面板 + 实时 HUD（动态注入，零侵入现有 DOM）
   ============================================================ */
let ui = null;
let onCountsChanged = null;

/** 同步「纯预览」按钮的显示（模块级，供 P 键 / 顶栏 / 内部切换共用） */
function syncPreviewBtn() {
  if (!ui || !ui.preview) return;
  const on = !!config.previewMode;
  ui.preview.textContent = on ? "◉ 退出观赏" : "◉ 净屏观赏";
  ui.preview.classList.toggle("is-on", on);
}

export function initTrainer() {
  if (ui) return ui;
  dataset.load(); loadNN(); loadCfg();

  const wrap = document.createElement("div");
  wrap.className = "trainer";
  wrap.id = "trainer-panel";
  wrap.innerHTML = `
    <div class="trainer__head">
      <div class="trainer__title"><span class="trainer__dot"></span>手势训练师 <small>GESTURE LAB</small></div>
      <div class="trainer__head-actions">
        <button class="trainer__mini" id="trainer-toggle" title="收起/展开">−</button>
        <button class="trainer__mini" id="trainer-close" title="关闭">×</button>
      </div>
    </div>
    <div class="trainer__body">
      <div class="trainer__live">
        <div class="trainer__live-top">
          <span class="trainer__live-label">实时识别</span>
          <span class="trainer__engine" id="trainer-engine-label">k-NN</span>
        </div>
        <div class="trainer__pred">
          <span class="trainer__pred-name" id="trainer-pred-name">等待手势</span>
          <span class="trainer__pred-conf" id="trainer-pred-conf">—</span>
        </div>
        <div class="trainer__bars" id="trainer-bars"></div>
      </div>

      <div class="trainer__section-title">
        <span>记忆库 <b id="trainer-total">0</b> 条</span>
        <span class="trainer__hint">识别错了？点正确类别即更正入库</span>
      </div>
      <div class="trainer__classes" id="trainer-classes"></div>

      <div class="trainer__tools">
        <button class="trainer__btn trainer__btn--primary" id="trainer-continuous">连续采集 <b>关</b></button>
        <button class="trainer__btn" id="trainer-train">训练模型</button>
      </div>
      <div class="trainer__tools">
        <label class="trainer__switch"><input type="checkbox" id="trainer-takeover"><span></span>ML 接管圣诞树</label>
        <select class="trainer__select" id="trainer-engine">
          <option value="knn">k-NN 即时</option>
          <option value="nn">神经网络</option>
        </select>
      </div>
      <div class="trainer__tools">
        <button class="trainer__btn trainer__btn--ghost" id="trainer-export">导出</button>
        <button class="trainer__btn trainer__btn--ghost" id="trainer-import">导入</button>
        <button class="trainer__btn trainer__btn--ghost trainer__btn--danger" id="trainer-clear">清空</button>
      </div>
      <div class="trainer__tools">
        <button class="trainer__btn" id="trainer-reset" title="快捷键 R">↺ 重置识别</button>
        <button class="trainer__btn" id="trainer-preview" title="快捷键 P">◉ 纯预览</button>
      </div>
      <div class="trainer__status" id="trainer-status">按数字键 1–6 快速采集当前姿势</div>
      <input type="file" id="trainer-file" accept="application/json,.json" hidden>
    </div>`;
  (document.getElementById("experience") || document.body).appendChild(wrap);

  ui = {
    wrap,
    body: wrap.querySelector(".trainer__body"),
    toggle: wrap.querySelector("#trainer-toggle"),
    close: wrap.querySelector("#trainer-close"),
    predName: wrap.querySelector("#trainer-pred-name"),
    predConf: wrap.querySelector("#trainer-pred-conf"),
    bars: wrap.querySelector("#trainer-bars"),
    classes: wrap.querySelector("#trainer-classes"),
    total: wrap.querySelector("#trainer-total"),
    engineLabel: wrap.querySelector("#trainer-engine-label"),
    engine: wrap.querySelector("#trainer-engine"),
    continuous: wrap.querySelector("#trainer-continuous"),
    train: wrap.querySelector("#trainer-train"),
    takeover: wrap.querySelector("#trainer-takeover"),
    export: wrap.querySelector("#trainer-export"),
    import: wrap.querySelector("#trainer-import"),
    clear: wrap.querySelector("#trainer-clear"),
    reset: wrap.querySelector("#trainer-reset"),
    preview: wrap.querySelector("#trainer-preview"),
    file: wrap.querySelector("#trainer-file"),
    status: wrap.querySelector("#trainer-status"),
    barEls: {},
    classEls: {},
  };

  // 概率条
  for (const c of CLASSES) {
    const row = document.createElement("div");
    row.className = "trainer__bar-row";
    row.innerHTML = `<span class="trainer__bar-name">${c.short}</span>
      <span class="trainer__bar-track"><i style="background:${c.color}"></i></span>
      <span class="trainer__bar-val">0</span>`;
    ui.bars.appendChild(row);
    ui.barEls[c.key] = { fill: row.querySelector("i"), val: row.querySelector(".trainer__bar-val") };
  }
  // 类别按钮
  CLASSES.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "trainer__class";
    b.style.setProperty("--c", c.color);
    b.innerHTML = `<span class="trainer__class-key">${i + 1}</span>
      <span class="trainer__class-name">${c.name}</span>
      <span class="trainer__class-count" id="tc-${c.key}">0</span>`;
    b.addEventListener("click", () => doCapture(c.key));
    ui.classes.appendChild(b);
    ui.classEls[c.key] = b;
  });

  // 事件
  ui.toggle.addEventListener("click", () => wrap.classList.toggle("is-min"));
  ui.close.addEventListener("click", () => { config.showPanel = false; saveCfg(); wrap.classList.add("is-hidden"); });
  ui.engine.value = config.engine;
  ui.engineLabel.textContent = config.engine === "nn" ? "神经网络" : "k-NN";
  ui.engine.addEventListener("change", () => {
    if (ui.engine.value === "nn" && !nn) { ui.engine.value = "knn"; setStatus("神经网络还没训练，点「训练模型」"); return; }
    config.engine = ui.engine.value; saveCfg();
    ui.engineLabel.textContent = config.engine === "nn" ? "神经网络" : "k-NN";
    setStatus("引擎切换为 " + ui.engineLabel.textContent);
  });
  ui.takeover.checked = !!config.takeover;
  ui.takeover.addEventListener("change", () => {
    config.takeover = ui.takeover.checked; saveCfg();
    setStatus(config.takeover ? "ML 已接管：手势由识别结果驱动" : "ML 接管已关闭：回到规则判定");
  });
  // 初始化时同步「连续采集」按钮显示（刷新后 config 可能残留为 true）
  ui.continuous.querySelector("b").textContent = config.continuous ? "开" : "关";
  ui.continuous.classList.toggle("is-on", config.continuous);
  ui.continuous.addEventListener("click", () => {
    config.continuous = !config.continuous;
    ui.continuous.querySelector("b").textContent = config.continuous ? "开" : "关";
    ui.continuous.classList.toggle("is-on", config.continuous);
    setStatus(config.continuous ? `连续采集中 → 当前类别「${CLASSES.find(c => c.key === config.captureLabel)?.name}」` : "连续采集已停止");
  });
  ui.train.addEventListener("click", async () => {
    ui.train.disabled = true; ui.train.textContent = "训练中…";
    try {
      const r = await trainNN((p, loss) => setStatus(`训练中 ${Math.round(p * 100)}% · loss ${loss.toFixed(3)}`));
      config.engine = "nn"; ui.engine.value = "nn"; ui.engineLabel.textContent = "神经网络"; saveCfg();
      setStatus(`训练完成：${r.samples} 条 / ${r.epochs} 轮，已切到神经网络`);
    } catch (e) { setStatus(e.message); }
    ui.train.disabled = false; ui.train.textContent = "训练模型";
  });
  ui.export.addEventListener("click", () => {
    const blob = new Blob([dataset.toJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gesture-memory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    setStatus(`已导出 ${dataset.size} 条样本`);
  });
  ui.import.addEventListener("click", () => ui.file.click());
  ui.file.addEventListener("change", async () => {
    const f = ui.file.files[0]; if (!f) return;
    try {
      const n = dataset.importJSON(await f.text());
      refreshCounts(); setStatus(`已导入 ${n} 条样本`);
    } catch (e) { setStatus(e.message); }
    ui.file.value = "";
  });
  ui.clear.addEventListener("click", () => {
    if (!confirm("确定清空全部手势记忆？此操作不可撤销。")) return;
    dataset.clear(); nn = null; try { localStorage.removeItem(LS_NN); } catch (e) {}
    refreshCounts(); setStatus("记忆库已清空");
  });
  ui.reset.addEventListener("click", () => {
    resetRecognition();
    bus.emit("ui:reset-gesture");   // 通知 app.js 清规则层迟滞状态
    setStatus("已重置识别状态，请重新摆手势");
  });
  syncPreviewBtn();
  ui.preview.addEventListener("click", () => {
    const on = togglePreviewMode();
    syncPreviewBtn();
    setStatus(on ? "净屏观赏：所有提示已隐藏，树仍随手而动" : "已退出净屏观赏");
  });

  // 数字键 1-6 采集；按住 Shift+数字切换连续采集类别
  window.addEventListener("keydown", (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (config.previewMode) return;  // 纯预览模式：不抢数字键，避免误采集
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= CLASSES.length) {
      config.captureLabel = CLASSES[n - 1].key;
      doCapture(config.captureLabel);
      e.preventDefault();
    }
  });

  refreshCounts();
  syncPreviewBtn();
  syncCinemaBtn();
  const exp = document.getElementById("experience");
  if (exp) exp.classList.toggle("is-cinema", !!config.previewMode);
  if (config.showPanel === false || config.previewMode) wrap.classList.add("is-hidden");
  return ui;
}

function doCapture(label) {
  config.captureLabel = label;
  const r = capture(label);
  setStatus(r.msg);
  if (r.ok) refreshCounts();
}

function setStatus(text) { if (ui) ui.status.textContent = text; }
function refreshCounts() {
  if (!ui) return;
  const c = dataset.counts();
  ui.total.textContent = dataset.size;
  for (const k of CLASS_KEYS) {
    const el = ui.classEls[k];
    if (!el) continue;
    el.querySelector(".trainer__class-count").textContent = c[k];
    el.classList.toggle("is-active", config.captureLabel === k);
  }
  if (onCountsChanged) onCountsChanged(c);
  // 连续采集时，把当前类别高亮
}

let lastHudAt = 0;
let lastCaptureAt = 0;
/** 每帧调用：更新实时 HUD + 连续采集（HUD 跟随摄像头帧率实时刷新） */
export function updateTrainer(nowT) {
  if (!ui || ui.wrap.classList.contains("is-hidden")) return;
  // 连续采集：独立节流，与 HUD 刷新解耦
  if (config.continuous && lastFeatures && nowT - lastCaptureAt > 90) {
    lastCaptureAt = nowT;
    dataset.add(lastFeatures, config.captureLabel);
    refreshCounts();
  }
  // HUD 只做极轻节流（跟随视频帧，几乎无感）
  if (nowT - lastHudAt < 16) return;
  lastHudAt = nowT;

  const pred = lastPrediction;
  if (!pred) {
    ui.predName.textContent = gesture.handPresent ? "识别中…" : "等待手势";
    ui.predConf.textContent = "—";
    for (const k of CLASS_KEYS) { ui.barEls[k].fill.style.width = "0%"; ui.barEls[k].val.textContent = "0"; }
    return;
  }
  const c = CLASSES.find(x => x.key === pred.label);
  ui.predName.textContent = c ? c.name : pred.label;
  ui.predName.style.color = c ? c.color : "";
  ui.predConf.textContent = Math.round(pred.confidence * 100) + "%";
  for (const k of CLASS_KEYS) {
    const v = pred.scores[k] || 0;
    ui.barEls[k].fill.style.width = (v * 100).toFixed(0) + "%";
    ui.barEls[k].val.textContent = Math.round(v * 100);
  }
  // 低置信度时给出引导（不覆盖用户刚点的采集提示，1.2s 后再说）
  if (!config.continuous && pred.confidence < 0.62 && nowT - lastStatusAt > 1200) {
    setStatus("拿不准？摆好姿势按对应数字键 1–6 教它一次");
    lastStatusAt = nowT;
  }
}
let lastStatusAt = 0;

/** 显示面板（供 app.js 暴露一个入口按钮调用） */
export function showTrainer() {
  initTrainer();
  if (!ui) return;
  config.showPanel = true; saveCfg();
  // 从预览模式回来时自动恢复接管（若之前开启过）
  if (config.previewMode) setPreviewMode(false);
  ui.wrap.classList.remove("is-hidden");
  setStatus("已打开训练面板");
}

/**
 * 净屏观赏模式：一键隐藏所有手势提示、教学图标与控件，只留下树、照片、文案。
 *  - 训练面板自动收起（识别 HUD 不再刷屏、数字键采集也停用）
 *  - 规则/ML 接管照常生效——树仍由手势驱动，这才是要观赏的「效果」
 *  - 顶栏、手势胶囊、底部手势说明、摄像头小窗、Toast 等全部隐藏
 *  - 右上角留一个很淡的「退出观赏」按钮，任何人都能点它返回
 * 顶栏「净屏观赏」按钮 / 面板按钮 / P 键 / Esc 均可切换。
 */
export function setPreviewMode(on) {
  initTrainer();
  config.previewMode = !!on;
  saveCfg();
  resetRecognition();
  const exp = document.getElementById("experience");
  if (exp) exp.classList.toggle("is-cinema", config.previewMode);
  if (config.previewMode && ui) ui.wrap.classList.add("is-hidden");
  if (!config.previewMode && ui && config.showPanel) ui.wrap.classList.remove("is-hidden");
  syncPreviewBtn();
  syncCinemaBtn();
  return config.previewMode;
}

/** 同步顶栏「净屏观赏」按钮的文字与选中态 */
function syncCinemaBtn() {
  const btn = document.getElementById("cinema-btn");
  if (!btn) return;
  const label = btn.querySelector("span");
  const on = !!config.previewMode;
  if (label) label.textContent = on ? "退出观赏" : "净屏观赏";
  btn.classList.toggle("is-on", on);
  btn.setAttribute("aria-pressed", String(on));
}
export function togglePreviewMode() { return setPreviewMode(!config.previewMode); }
export function isPreviewMode() { return !!config.previewMode; }
