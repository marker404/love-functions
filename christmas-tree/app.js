// ============================================================
// app.js — MediaPipe 手势识别 + 全部 UI 交互
// ============================================================
import { bootScene, addPhoto, removePhoto, getScreenPhotos, highlightPhoto, pulsePhoto } from "./main.js";
import { HandLandmarker, FilesetResolver } from "./vendor/mediapipe/vision_bundle.js";
import { gesture, photos, bus } from "./store.js";
import { recognize, applyTakeover, updateTrainer, initTrainer, showTrainer, resetRecognition, setPreviewMode, togglePreviewMode, config as learnConfig } from "./gesture-learn.js";

console.log("✅ app.js loaded");

/* --------------------- DOM --------------------- */
const $ = (id) => document.getElementById(id);
const root = $("experience");
const els = {
  intro: $("intro"),
  startCamera: $("start-camera"),
  startLabel: $("start-camera-label"),
  startDemo: $("start-demo"),
  loadStatus: $("load-status"),
  loadStatusText: $("load-status-text"),
  cameraPanel: $("camera-panel"),
  cameraClose: $("camera-close"),
  cameraToggle: $("camera-toggle"),
  webcam: $("webcam"),
  overlay: $("hand-overlay"),
  handCount: $("hand-count"),
  tracking: $("camera-tracking"),
  videoPlaceholder: $("video-placeholder"),
  gesturePill: $("gesture-pill"),
  gestureTitle: $("gesture-title"),
  gestureSub: $("gesture-sub"),
  gestureMeter: $("gesture-meter"),
  gestureDock: $("gesture-dock"),
  trail: $("trail-canvas"),
  fullscreen: $("fullscreen-btn"),
  memoryBtn: $("memory-btn"),
  memoryPanel: $("memory-panel"),
  memoryScrim: $("panel-scrim"),
  memoryClose: $("memory-close"),
  memoryList: $("memory-list"),
  memoryCount: $("memory-count"),
  dropzone: $("dropzone"),
  fileInput: $("memory-file"),
  textInput: $("memory-text"),
  textAdd: $("memory-add-text"),
  viewer: $("photo-viewer"),
  viewerCard: $("viewer-card"),
  viewerImage: $("focus-image"),
  viewerTitle: $("viewer-title"),
  viewerDesc: $("viewer-desc"),
  viewerClose: $("viewer-close"),
  toast: $("toast"),
  toastText: $("toast-text"),
  toastStar: $("toast-star"),
  dedicationName: $("dedication-name"),
  dedicationFoot: $("dedication-foot"),
  dedicationEdit: $("dedication-edit"),
  dedicationEditor: $("dedication-editor"),
  dedicationEditorScrim: $("dedication-editor-scrim"),
  dedicationEditorClose: $("dedication-editor-close"),
  dedicationEditorSave: $("dedication-editor-save"),
  dedicationInput: $("dedication-input"),
  dedicationCount: $("dedication-count"),
  dedicationPreviewName: $("dedication-preview-name"),
  wishQuote: $("wish-quote"),
  wishQuoteText: $("wish-quote-text"),
  wishQuoteEn: $("wish-quote-en"),
  cinemaBtn: $("cinema-btn"),
  cinemaExit: $("cinema-exit"),
  welcomeCard: $("welcome-card"),
  welcomeClose: $("welcome-close"),
};

/* --------------------- 状态 --------------------- */
let handLandmarker = null;
let modelResolve;
const modelReady = new Promise((res) => { modelResolve = res; });
let modelOk = false;
let stream = null;
let loopRunning = false;
let lastVideoTime = -1;
let overlayCtx = els.overlay.getContext("2d");
let trailCtx = els.trail.getContext("2d");
const pinchStates = [false, false];
const pointStates = [false, false];   // 指向迟滞状态，防止边界抖动
const okStates = [false, false];      // OK 迟滞状态
// 迟滞「宽松保持」的最长时长：超过就强制过期清零。
// 根因：宽松保持条件让旧手势赖着不走，以前只有「手移出画面」的无手分支才清零，
// 所以切换手势必须把手移出去。现在超时自动过期，切换无需再移手。
const HYST_HOLD_MS = 140;
const pinchSince = [0, 0];
const pointSince = [0, 0];
const okSince = [0, 0];
let viewerState = { open: false, id: null, anim: null, capAnim: null, closeAnim: null };
let viewerAutoCloseTimer = null;

// OK 文案展示状态
let wishAnimating = false;
let lastWishIndex = -1;

// 手势平滑 / 手掌旋转追踪
let smoothOpenness = 0;
let smoothScale = 1;
let lastPalmAngle = null;
let lastPalmAngleTime = 0;
let smoothSpin = 0;
let okPrev = false;          // 上一帧 OK 状态，用于边沿触发
let okCooldownUntil = 0;     // OK 触发冷却
let currentLandmarks = [];  // 当前帧手部关键点，供全屏追踪可视化使用
let leadHandIdx = 0;        // 主导手索引（做「9」手势检测用）
let trackingVisible = true; // 全屏追踪可视化开关（V 键切换）

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const now = () => performance.now();

/**
 * 一键重置所有手势识别状态。
 * 快速切换手势时，迟滞状态 / 冷却 / 边沿检测可能卡在旧手势上，
 * 以前只能把手移出摄像头框再放进来触发「无手分支」来清零。
 * 现在按 R 直接瞬时清干净，下一帧立刻按新手势重新判定。
 */
function resetGestureState() {
  pinchStates[0] = pinchStates[1] = false;
  pointStates[0] = pointStates[1] = false;
  okStates[0] = okStates[1] = false;
  pinchSince[0] = pinchSince[1] = 0;
  pointSince[0] = pointSince[1] = 0;
  okSince[0] = okSince[1] = 0;
  okPrev = false;
  okCooldownUntil = 0;
  lastPalmAngle = null;
  lastPalmAngleTime = 0;
  smoothSpin = 0;
  smoothOpenness = 0;
  resetRecognition();           // 清 ML 侧预测/保持/边沿
  showToast("识别状态已重置 · 请重新摆手势", 1500);
}

/* --------------------- 手势调试面板（按 D 键显示/隐藏） --------------------- */
let debugOn = false;
let debugPanel = null;
function ensureDebugPanel() {
  if (debugPanel) return debugPanel;
  debugPanel = document.createElement("div");
  Object.assign(debugPanel.style, {
    position: "fixed", right: "14px", bottom: "14px", zIndex: "99999",
    background: "rgba(8,14,26,.9)", color: "#dfe9ff", padding: "11px 13px",
    borderRadius: "12px", font: "11.5px/1.65 ui-monospace, Menlo, Consolas, monospace",
    border: "1px solid rgba(160,200,255,.28)", backdropFilter: "blur(10px)",
    pointerEvents: "none", minWidth: "250px", whiteSpace: "pre-wrap",
    boxShadow: "0 10px 40px rgba(0,0,0,.45)",
  });
  document.body.appendChild(debugPanel);
  return debugPanel;
}
window.addEventListener("keydown", (e) => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === "d" || e.key === "D") {
    debugOn = !debugOn;
    const p = ensureDebugPanel();
    p.style.display = debugOn ? "block" : "none";
    if (debugOn) showToast("手势调试面板已开启（再按 D 关闭）", 2200);
  }
  if (e.key === "v" || e.key === "V") {
    trackingVisible = !trackingVisible;
    showToast(trackingVisible ? "手势追踪可视化已开启" : "手势追踪可视化已关闭", 1800);
  }
  if (e.key === "r" || e.key === "R") {
    resetGestureState();
  }
  if (e.key === "p" || e.key === "P") {
    const on = togglePreviewMode();
    showToast(on ? "净屏观赏 · 树仍随手而动（点右上「退出观赏」或按 P 返回）" : "已退出净屏观赏", 2000);
  }
});

// 训练面板的「重置识别」按钮 → 清规则层迟滞状态（ML 侧已由面板清）
bus.on("ui:reset-gesture", () => {
  pinchStates[0] = pinchStates[1] = false;
  pointStates[0] = pointStates[1] = false;
  okStates[0] = okStates[1] = false;
  pinchSince[0] = pinchSince[1] = 0;
  pointSince[0] = pointSince[1] = 0;
  okSince[0] = okSince[1] = 0;
  okPrev = false;
  okCooldownUntil = 0;
  lastPalmAngle = null;
  lastPalmAngleTime = 0;
  smoothSpin = 0;
});
function renderDebug(text) {
  if (!debugOn) return;
  ensureDebugPanel().textContent = text;
}

/* ============================================================
   一、Toast
   ============================================================ */
let toastTimer = null;
function showToast(msg, dur = 2600) {
  els.toastText.textContent = msg;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), dur);
}
bus.on("ui:toast", ({ msg, dur }) => showToast(msg, dur));

/* ============================================================
   一·五、题字（To: xxx）—— 编辑 / 自适应字号 / 本地保存
   ============================================================ */
const DEDICATION_KEY = "xmas-dedication-v1";
let dedicationText = "Doki";

// 依据字数与中文占比计算合适的字号，保证长文本不会撑破容器或遮挡圣诞树
function fitName(el, text) {
  const chars = [...(text || "")];
  const n = chars.length;
  // 中文/全角按 1 个宽字符计，英文数字按 0.58 计，得到「视觉宽度」
  const width = chars.reduce((s, c) => s + (/[\u2E80-\u9FFF\uFF00-\uFFEF]/.test(c) ? 1 : 0.58), 0) || 1;
  const isNarrow = window.innerWidth <= 720;
  const maxFont = isNarrow ? 28 : 44;
  const minFont = isNarrow ? 15 : 16;
  // 单行能容纳的视觉字符数（随屏宽变化）；超出后按行数与宽度综合缩小
  const maxLineWidth = isNarrow ? 7 : 9;
  let size = maxFont;
  if (width > maxLineWidth) {
    // 目标：控制在约 3 行内，同时字号不低于 minFont
    size = (maxFont * maxLineWidth * 3) / (width * 2.0);
  }
  size = Math.max(minFont, Math.min(maxFont, Math.round(size)));
  el.style.setProperty("--name-size", size + "px");
  // 长文本改为左对齐更整齐，短文本保持自然
  el.style.letterSpacing = n > 24 ? "0.01em" : "0.03em";
}

function applyDedication(text) {
  dedicationText = (text ?? "").trim();
  els.dedicationName.textContent = dedicationText;
  els.dedicationPreviewName.textContent = dedicationText;
  fitName(els.dedicationName, dedicationText);
  fitName(els.dedicationPreviewName, dedicationText);
}

function saveDedication() {
  const value = els.dedicationInput.value.trim();
  applyDedication(value);
  try { localStorage.setItem(DEDICATION_KEY, dedicationText); } catch (e) { /* 隐私模式下忽略 */ }
  closeDedicationEditor();
  showToast(value ? "这份心意，已刻上这棵树 ✦" : "已清空题字", 2600);
}

function openDedicationEditor() {
  els.dedicationInput.value = dedicationText;
  updateDedicationCount();
  fitName(els.dedicationPreviewName, dedicationText);
  els.dedicationEditor.classList.add("is-open");
  root.classList.add("panel-open");
  setTimeout(() => { els.dedicationInput.focus(); els.dedicationInput.setSelectionRange(999, 999); }, 260);
}
function closeDedicationEditor() {
  els.dedicationEditor.classList.remove("is-open");
  root.classList.remove("panel-open");
}
function updateDedicationCount() {
  const n = els.dedicationInput.value.length;
  els.dedicationCount.textContent = n + " 字";
}

els.dedicationEdit.addEventListener("click", (e) => { e.stopPropagation(); openDedicationEditor(); });
els.dedicationEditorClose.addEventListener("click", closeDedicationEditor);
els.dedicationEditorScrim.addEventListener("click", closeDedicationEditor);
els.dedicationEditorSave.addEventListener("click", saveDedication);
els.dedicationInput.addEventListener("input", () => {
  updateDedicationCount();
  fitName(els.dedicationPreviewName, els.dedicationInput.value);
  els.dedicationPreviewName.textContent = els.dedicationInput.value;
});
els.dedicationInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveDedication(); }
});
window.addEventListener("resize", () => {
  fitName(els.dedicationName, dedicationText);
  if (els.dedicationEditor.classList.contains("is-open")) fitName(els.dedicationPreviewName, els.dedicationInput.value);
});

// 初始化：读取本地保存的题字
(() => {
  let saved = "Doki";
  try { saved = localStorage.getItem(DEDICATION_KEY) ?? "Doki"; } catch (e) { /* 忽略 */ }
  applyDedication(saved);
})();

/* ============================================================
   二、加载手部模型
   ============================================================ */
function setStatus(text, kind = "") {
  els.loadStatusText.textContent = text;
  els.loadStatus.classList.toggle("is-ready", kind === "ready");
  els.loadStatus.classList.toggle("is-error", kind === "error");
}

async function loadHandModel() {
  setStatus("正在准备手势识别…");
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: "./hand_landmarker.task", delegate },
    numHands: 2,
    runningMode: "VIDEO",
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
  });
  try {
    // 本地 WASM 目录；自动探测 SIMD 支持并加载对应文件
    const vision = await FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm");
    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, opts("GPU"));
    } catch (e) {
      console.warn("GPU 推理不可用，回退 CPU", e);
      // GPU 失败后需要重新获取 wasm 文件集，否则 GPU 上下文可能已污染
      const visionCpu = await FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm");
      handLandmarker = await HandLandmarker.createFromOptions(visionCpu, opts("CPU"));
    }
    modelOk = true;
    setStatus("手势识别已就绪 · 点击开启摄像头", "ready");
  } catch (err) {
    console.error("手势模型加载失败", err);
    modelOk = false;
    setStatus("手势模型加载失败 · 请刷新重试或使用漫游模式", "error");
    showToast("手势模型加载失败，请刷新页面重试", 4500);
  } finally {
    modelResolve?.(modelOk);
  }
}
loadHandModel();

/* ============================================================
   三、手势分类
   ============================================================ */
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17],
];

function angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1e-6;
  return Math.acos(clamp((v1x * v2x + v1y * v2y) / m, -1, 1)) * 180 / Math.PI;
}

function classifyHand(lm, handIdx) {
  const wrist = lm[0];
  const scale = Math.max(dist2(wrist, lm[9]), 0.02);
  const fingers = [[5,6,8], [9,10,12], [13,14,16], [17,18,20]];
  let total = 0;
  const exts = [];
  for (const [mcp, pip, tip] of fingers) {
    // ① 角度法：mcp-pip-tip 夹角，越接近 180° 越直
    const deg = angleAt(lm[mcp], lm[pip], lm[tip]);
    const angleExt = clamp((deg - 60) / 82);            // 60°→0, 142°→1
    // ② 距离法：指尖到手腕 / 指根到手腕。伸直时比值明显 >1，弯曲时接近 1
    const mcpD = dist2(lm[mcp], wrist);
    const tipD = dist2(lm[tip], wrist);
    const distExt = clamp((tipD / (mcpD + 1e-6) - 1.08) / 0.55); // 1.08→0, 1.63→1
    // 融合：角度为主、距离为辅，互补两种失效姿态（侧对镜头 / 指向镜头）
    const e = clamp(angleExt * 0.7 + distExt * 0.3);
    exts.push(e);
    total += e;
  }
  const openness = total / 4;

  const idx = exts[0];
  const othersMax = Math.max(exts[1], exts[2], exts[3]);
  const othersAvg = (exts[1] + exts[2] + exts[3]) / 3;

  // 食指在 PIP 关节处的弯曲角：伸直约 165°
  const indexBend = angleAt(lm[5], lm[6], lm[8]);
  // 食指指尖相对其余三指尖的「伸出距离」——比 2D 角度更抗手掌侧转
  const tipD = [8, 12, 16, 20].map((i) => dist2(lm[i], wrist));
  const indexReach = tipD[0] / ((tipD[1] + tipD[2] + tipD[3]) / 3 + 1e-6);

  // —— 拇指状态：拇指尖(4)到小指根(17)的距离相对掌长，判断拇指是否张开 ——
  const thumbSpread = dist2(lm[4], lm[17]) / scale;
  const thumbOpen = thumbSpread > 0.95;

  // 捏合：拇指尖与食指尖贴近，**且其余手指不是全弯**（全弯=握拳，必须排除）
  // 这是修复「握拳被误判为捏合」的关键：握拳时拇指搭在食指上距离也很近，
  // 但握拳的三指 exts 都很低；真正的捏合/OK 其余三指是伸开的。
  const pinchRatio = dist2(lm[4], lm[8]) / scale;
  const fingersCurled = othersAvg < 0.34;   // 其余三指基本都弯着 → 视为握拳倾向
  const tHand = performance.now();
  const wasPinch = pinchStates[handIdx];
  // 严格进入 / 宽松保持；宽松保持超过 HYST_HOLD_MS 未再满足严格条件 → 强制过期
  const pinchStrict = pinchRatio < 0.38;
  let pinch = wasPinch ? pinchRatio < 0.55 : pinchStrict;
  if (pinchStrict) pinchSince[handIdx] = tHand;
  else if (wasPinch && tHand - pinchSince[handIdx] > HYST_HOLD_MS) pinch = false;
  if (fingersCurled) pinch = false;          // 握拳优先，绝不判为捏合
  pinchStates[handIdx] = pinch;

  // 标准 OK 手势：拇指(4)+食指(8)捏成圈，中指(12)/无名指(16)/小指(20)三指伸直向上。
  //   判据：圈(拇指食指近) + 中无小三指伸直 + 食指相对弯曲（凑向拇指成圈）。
  //   带迟滞防止抖动。
  const ringClosed = pinchRatio < 0.55;                 // 拇指食指成圈
  const threeFingersUp = exts[1] > 0.52 && exts[2] > 0.52 && exts[3] > 0.52;
  const okCircle = ringClosed && threeFingersUp;
  const wasOk = okStates[handIdx];
  const okStrict = okCircle;
  const okLoose = pinchRatio < 0.68 && exts[1] > 0.44 && exts[2] > 0.44 && exts[3] > 0.44;
  let ok = wasOk ? okLoose : okStrict;
  if (okStrict) okSince[handIdx] = tHand;
  else if (wasOk && tHand - okSince[handIdx] > HYST_HOLD_MS) ok = false;

  // 指向（伸食指）：食指指尖明显比其余三指伸得更远，且食指关节够直。
  //   这样即使手掌侧转/其余三指自然半弯，也能稳定识别，不再被误判为「旋掌」。
  //   带迟滞防抖：进入严格、保持宽松。
  const wasPoint = pointStates[handIdx];
  const pointOk = indexBend > 145 && indexReach > 1.22 && idx > othersMax + 0.06;
  const pointKeep = indexBend > 132 && indexReach > 1.14 && idx > othersMax + 0.02;
  let point = wasPoint ? pointKeep : pointOk;
  if (pointOk) pointSince[handIdx] = tHand;
  else if (wasPoint && tHand - pointSince[handIdx] > HYST_HOLD_MS) point = false;
  pointStates[handIdx] = point;

  // 互斥：OK(心愿文案) 优先，抑制指向/捏合，避免一个手势同时触发多种效果。
  if (ok) { point = false; pinch = false; }
  okStates[handIdx] = ok;

  const cx = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
  const cy = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;

  // 手掌朝向角：融合「掌宽横轴(5→17)」与「掌长主轴(0→9)」，
  // 单用横轴在手腕翻转时角度变化不连续，融合后两个方向都稳定对称。
  const ax = lm[17].x - lm[5].x, ay = lm[17].y - lm[5].y;      // 横轴
  const bx = lm[9].x - lm[0].x, by = lm[9].y - lm[0].y;        // 主轴
  // 主轴绕横轴的关系：取主轴相对横轴旋转 90° 的朝向，取二者均值
  const angleH = Math.atan2(ay, ax);
  const angleL = Math.atan2(by, bx) - Math.PI / 2;
  // 处理角度环绕后求均值
  let diff = angleL - angleH;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const palmAngle = angleH + diff * 0.5;

  return {
    openness, pinch, point, ok, indexBend, indexReach, palmAngle, exts, thumbOpen, pinchRatio,
    palm: { x: cx, y: cy },
    pinchPoint: { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 },
    index: { x: lm[8].x, y: lm[8].y },
    pip8: lm[6], mcp8: lm[5], dip8: lm[7], thumbTip: lm[4],
  };
}

function updateGesture(results) {
  const list = results.landmarks || [];
  currentLandmarks = list;
  gesture.handCount = list.length;
  gesture.handPresent = list.length > 0;

  if (list.length === 0) {
    smoothOpenness += (0 - smoothOpenness) * 0.2;
    smoothScale += (1 - smoothScale) * 0.15;
    smoothSpin += (0 - smoothSpin) * 0.2;
    gesture.openness = smoothOpenness;
    gesture.pinch = false;
    gesture.point = false;
    gesture.scale = smoothScale;
    gesture.spin = smoothSpin;
    gesture.spinActive = false;
    gesture.ok = false;
    okPrev = false;
    lastPalmAngle = null;
    pointStates[0] = pointStates[1] = false;
    pinchStates[0] = pinchStates[1] = false;
    okStates[0] = okStates[1] = false;
    pointSince[0] = pointSince[1] = 0;
    pinchSince[0] = pinchSince[1] = 0;
    okSince[0] = okSince[1] = 0;
    gesture.pathActive = false;
    gesture.mode = "idle";
    renderDebug("未检测到手\n把手伸到摄像头前试试");
    return list;
  }

  const hs = list.map((lm, i) => classifyHand(lm, i));
  for (let i = hs.length; i < 2; i++) { pinchStates[i] = false; pointStates[i] = false; okStates[i] = false; }

  // 平滑张合度与缩放，消除识别抖动
  const rawOpenness = hs.reduce((s, h) => s + h.openness, 0) / hs.length;
  smoothOpenness += (rawOpenness - smoothOpenness) * 0.32;
  gesture.openness = smoothOpenness;
  const okNow = hs.some(h => h.ok);
  gesture.pinch = hs.some(h => h.pinch) && !okNow;
  gesture.point = hs.some(h => h.point) && !okNow;
  gesture.ok = okNow;

  // OK 手势：从无到有时发一次脉冲（带冷却，避免持续触发）
  // 接管模式下交给 ML 层的边沿触发，这里跳过，避免同一手势触发两次文案
  const tOk = now();
  const mlDriving = learnConfig.takeover && !learnConfig.previewMode;
  if (okNow && !okPrev && tOk > okCooldownUntil && !mlDriving) {
    gesture.okPulse++;
    okCooldownUntil = tOk + 2600;
  }
  okPrev = okNow;

  // 主导手：优先正在指向的，其次捏合的
  let pointerIdx = hs.findIndex(h => h.point);
  if (pointerIdx < 0) pointerIdx = hs.findIndex(h => h.pinch);
  if (pointerIdx < 0) pointerIdx = 0;
  leadHandIdx = pointerIdx;
  const pointer = hs[pointerIdx] || hs[0];
  const pincer = hs.find(h => h.pinch) || pointer;
  const okHand = hs.find(h => h.ok) || pointer;

  // —— 手掌顺/逆时针旋转 → 角速度 ——
  // 用「手腕(0)→中指根(9)」主轴与「食指根(5)→小指根(17)」横轴的组合角，
  // 比单用横轴更稳定；逐帧差分（处理 ±π 跨界）后做对称增益与快速平滑。
  const tNow = now();
  const pa = pointer.palmAngle;
  let spinActive = false;
  if (lastPalmAngle !== null && tNow - lastPalmAngleTime < 100) {
    let d = pa - lastPalmAngle;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    // 角度死区：滤掉手掌静止时的微小抖动（原来 0.005 太小，静止也会让树缓慢自转）
    if (Math.abs(d) > 0.014) {
      const dtSec = Math.max((tNow - lastPalmAngleTime) / 1000, 0.016);
      // 对称增益：两个方向用同样的放大系数，避免左小右大
      const SPIN_GAIN = 1.7;
      let rawSpin = clamp((d / dtSec) * SPIN_GAIN, -3.2, 3.2);
      // 速度级死区：极慢的角度漂移也不算"在转"，进一步稳住静止画面
      if (Math.abs(rawSpin) < 0.28) rawSpin = 0;
      // 镜像：屏幕左右翻转，旋转方向反向符合直觉
      smoothSpin += (-rawSpin - smoothSpin) * 0.5;
      spinActive = Math.abs(rawSpin) > 0;
    } else {
      smoothSpin *= 0.82; // 停转时更快衰减到静止
    }
  }
  // 旋转与「食指主导」手势互斥：
  //   伸食指 / 捏合 / OK 时，掌心角度的变化不该被当成「旋掌」，
  //   避免「明明是伸食指却被识别成向右旋转」。
  const indexLeading = gesture.point || gesture.pinch || gesture.ok;
  if (indexLeading) { smoothSpin = 0; spinActive = false; }
  if (!spinActive) smoothSpin *= 0.94;
  lastPalmAngle = pa;
  lastPalmAngleTime = tNow;
  gesture.spin = smoothSpin;
  gesture.spinActive = Math.abs(smoothSpin) > 0.1 && !indexLeading;
  if (!gesture.spinActive) gesture.spin = 0;

  // 镜像到用户看到的画面
  const mx = (p) => 1 - p.x;
  gesture.indexX = mx(pointer.index);
  gesture.indexY = pointer.index.y;
  gesture.pointX = mx(pointer.index);
  gesture.pointY = pointer.index.y;
  gesture.pinchX = mx(pincer.pinchPoint);
  gesture.pinchY = pincer.pinchPoint.y;
  gesture.palmX = mx(pointer.palm.x);
  gesture.palmY = pointer.palm.y;

  // 双手：手掌间距 → 整体缩放；单手：张合度 → 轻微缩放（均平滑）
  let rawScale;
  if (hs.length >= 2) {
    const span = dist2(hs[0].palm, hs[1].palm);
    rawScale = lerp(0.72, 1.62, smoothstep(0.12, 0.68, span));
  } else {
    rawScale = 0.82 + 0.36 * gesture.openness;
  }
  smoothScale += (rawScale - smoothScale) * 0.18;
  gesture.scale = smoothScale;

  // 手掌运动路径
  gesture.palmPath.push({ x: gesture.palmX, y: gesture.palmY, t: now() });
  const cutoff = now() - 1400;
  while (gesture.palmPath.length && gesture.palmPath[0].t < cutoff) gesture.palmPath.shift();
  if (gesture.palmPath.length > 48) gesture.palmPath.shift();
  gesture.pathActive = gesture.palmPath.length > 3;

  // 模式优先级：OK > 指向 > 捏合 > 旋转 > 握拳/张开
  gesture.mode = gesture.ok ? "ok"
    : gesture.point ? "point"
    : gesture.pinch ? "pinch"
    : gesture.spinActive ? "spin"
    : gesture.openness < 0.32 ? "fist"
    : "open";

  if (debugOn) {
    const fmt = (h, i) => `手${i} 指[${h.exts.map(e => e.toFixed(2)).join(" ")}] ` +
      `弯${h.indexBend.toFixed(0)}° 伸距${(h.indexReach || 0).toFixed(2)} ` +
      `圈${h.pinchRatio.toFixed(2)} ` +
      `${h.point ? "●指" : "○"}${h.pinch ? "捏" : ""}${h.ok ? "OK" : ""} 张${h.openness.toFixed(2)}`;
    const lines = hs.map(fmt);
    lines.push(`→ 模式 ${gesture.mode}  指${gesture.point ? "✓" : "✗"} OK${gesture.ok ? "✓" : "✗"} 旋${gesture.spin.toFixed(2)}`);
    lines.push(`OK: 中无小三指>0.52 + 拇指食指成圈`);
    lines.push(`指: 弯>145° 伸距>1.22`);
    renderDebug(lines.join("\n"));
  }

  return list;
}

/* ============================================================
   四、2D 绘制：手部骨架 + 手掌轨迹
   ============================================================ */
function drawOverlay(landmarksList) {
  const w = els.overlay.width, h = els.overlay.height;
  overlayCtx.clearRect(0, 0, w, h);
  const accent = gesture.pinch ? "#ffe6a8" : gesture.point ? "#bfe9d3" : "#f0d9a6";

  landmarksList.forEach((lm, hi) => {
    overlayCtx.strokeStyle = accent;
    overlayCtx.globalAlpha = 0.85;
    overlayCtx.lineWidth = Math.max(2, w / 420);
    overlayCtx.lineCap = "round";
    for (const [a, b] of CONNECTIONS) {
      overlayCtx.beginPath();
      overlayCtx.moveTo(lm[a].x * w, lm[a].y * h);
      overlayCtx.lineTo(lm[b].x * w, lm[b].y * h);
      overlayCtx.stroke();
    }
    for (const p of lm) {
      overlayCtx.beginPath();
      overlayCtx.arc(p.x * w, p.y * h, Math.max(2.4, w / 340), 0, Math.PI * 2);
      overlayCtx.fillStyle = "rgba(255,232,184,0.9)";
      overlayCtx.fill();
    }
    // 捏合高亮圈
    if (pinchStates[hi]) {
      const x = (lm[4].x + lm[8].x) / 2 * w;
      const y = (lm[4].y + lm[8].y) / 2 * h;
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, 18, 0, Math.PI * 2);
      overlayCtx.strokeStyle = "rgba(255,226,160,0.9)";
      overlayCtx.lineWidth = 2;
      overlayCtx.stroke();
    }
    overlayCtx.globalAlpha = 1;
  });
}

function resizeTrail() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  els.trail.width = Math.floor(window.innerWidth * dpr);
  els.trail.height = Math.floor(window.innerHeight * dpr);
  els.trail.style.width = window.innerWidth + "px";
  els.trail.style.height = window.innerHeight + "px";
  trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeTrail);
resizeTrail();

// 全屏视觉：手掌轨迹 + 手部骨架 + 食指指尖准星（镜像坐标，与用户视角一致）
function drawTrail() {
  const W = window.innerWidth, H = window.innerHeight;
  trailCtx.clearRect(0, 0, W, H);

  // —— 手掌运动轨迹 ——
  const path = gesture.palmPath;
  if (path.length >= 3) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const age = clamp((now() - b.t) / 1400);
      const alpha = (1 - age) * 0.5;
      if (alpha <= 0) continue;
      trailCtx.beginPath();
      trailCtx.moveTo(a.x * W, a.y * H);
      trailCtx.lineTo(b.x * W, b.y * H);
      trailCtx.strokeStyle = `rgba(255,220,150,${alpha})`;
      trailCtx.lineWidth = (1 - age) * 5 + 1;
      trailCtx.lineCap = "round";
      trailCtx.stroke();
    }
    const last = path[path.length - 1];
    const g = trailCtx.createRadialGradient(last.x * W, last.y * H, 0, last.x * W, last.y * H, 26);
    g.addColorStop(0, "rgba(255,232,180,0.42)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    trailCtx.fillStyle = g;
    trailCtx.beginPath();
    trailCtx.arc(last.x * W, last.y * H, 26, 0, Math.PI * 2);
    trailCtx.fill();
  }

  if (!trackingVisible || !currentLandmarks.length) return;

  // media landmark 是摄像头原始坐标（未镜像）；屏幕坐标需 x → 1-x
  const sx = (p) => (1 - p.x) * W;
  const sy = (p) => p.y * H;
  const isPoint = gesture.point;
  const line = isPoint ? "rgba(150,240,205," : "rgba(196,224,255,";
  const dot = isPoint ? "rgba(170,255,220," : "rgba(232,240,255,";

  currentLandmarks.forEach((lm) => {
    // 骨架连线（低透明度，不喧宾夺主）
    trailCtx.strokeStyle = line + "0.32)";
    trailCtx.lineWidth = 2;
    trailCtx.lineCap = "round";
    for (const [a, b] of CONNECTIONS) {
      trailCtx.beginPath();
      trailCtx.moveTo(sx(lm[a]), sy(lm[a]));
      trailCtx.lineTo(sx(lm[b]), sy(lm[b]));
      trailCtx.stroke();
    }
    // 关节小点
    trailCtx.fillStyle = dot + "0.55)";
    for (let i = 0; i < lm.length; i++) {
      trailCtx.beginPath();
      trailCtx.arc(sx(lm[i]), sy(lm[i]), i === 8 ? 3.4 : 2, 0, Math.PI * 2);
      trailCtx.fill();
    }
  });

  // —— 主导手的食指指尖准星 + 指向射线 ——
  const lead = currentLandmarks[0];
  if (lead) {
    const ix = sx(lead[8]), iy = sy(lead[8]);
    const pip = lead[6];
    // 指向射线：从手腕→指尖方向继续延伸（镜像后的方向）
    const wx = sx(lead[0]), wy = sy(lead[0]);
    let dx = ix - wx, dy = iy - wy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const rayLen = 120;
    const ex = ix + dx * rayLen, ey = iy + dy * rayLen;
    const grad = trailCtx.createLinearGradient(ix, iy, ex, ey);
    grad.addColorStop(0, isPoint ? "rgba(150,240,205,0.55)" : "rgba(196,224,255,0.28)");
    grad.addColorStop(1, "rgba(196,224,255,0)");
    trailCtx.strokeStyle = grad;
    trailCtx.lineWidth = isPoint ? 2.4 : 1.4;
    trailCtx.setLineDash([7, 7]);
    trailCtx.beginPath();
    trailCtx.moveTo(ix, iy);
    trailCtx.lineTo(ex, ey);
    trailCtx.stroke();
    trailCtx.setLineDash([]);

    // 准星呼吸圆环
    const pulse = 0.5 + 0.5 * Math.sin(now() / 240);
    const baseR = isPoint ? 20 : 15;
    const ringColor = isPoint ? "rgba(150,255,215," : "rgba(255,226,170,";
    trailCtx.strokeStyle = ringColor + (0.45 + pulse * 0.4) + ")";
    trailCtx.lineWidth = 2;
    trailCtx.beginPath();
    trailCtx.arc(ix, iy, baseR + pulse * 4, 0, Math.PI * 2);
    trailCtx.stroke();
    // 十字刻度
    trailCtx.strokeStyle = ringColor + "0.8)";
    trailCtx.lineWidth = 1.6;
    for (const [x1, y1, x2, y2] of [
      [ix - baseR - 9, iy, ix - baseR + 1, iy],
      [ix + baseR - 1, iy, ix + baseR + 9, iy],
      [ix, iy - baseR - 9, ix, iy - baseR + 1],
      [ix, iy + baseR - 1, ix, iy + baseR + 9],
    ]) {
      trailCtx.beginPath();
      trailCtx.moveTo(x1, y1);
      trailCtx.lineTo(x2, y2);
      trailCtx.stroke();
    }
    // 中心光点
    const cg = trailCtx.createRadialGradient(ix, iy, 0, ix, iy, 10);
    cg.addColorStop(0, isPoint ? "rgba(210,255,235,0.95)" : "rgba(255,240,205,0.9)");
    cg.addColorStop(1, "rgba(255,255,255,0)");
    trailCtx.fillStyle = cg;
    trailCtx.beginPath();
    trailCtx.arc(ix, iy, 10, 0, Math.PI * 2);
    trailCtx.fill();
  }
}

/* ============================================================
   五、UI 状态更新
   ============================================================ */
function updateHUD() {
  const label = {
    idle: ["等待手势", "张开手掌，让树在光里舒展", 0.15],
    fist: ["握拳 · 聚合", "星光收拢，化作一棵圣诞树", 1 - gesture.openness],
    open: ["张开 · 绽放", "双手开合，缩放并扩散这棵树", gesture.openness],
    pinch: ["捏合 · 悬浮", "星光悬停散开，看着这棵树", 0.9],
    spin: ["旋掌 · 转动", "顺 / 逆时针转动手掌，让树旋转", 0.7],
    point: ["指尖 · 牵引", "食指牵引星光，让光随笔尖流动", 1],
    ok: ["OK · 心愿", "星光四散，一句只给你的话", 1],
  }[gesture.mode] || ["等待手势", "", 0.2];

  els.gestureTitle.textContent = label[0];
  els.gestureSub.textContent = label[1];
  els.gestureMeter.style.transform = `scaleX(${clamp(label[2], 0.08, 1)})`;

  const dockMode = gesture.mode === "pinch" ? "point" : gesture.mode;
  els.gestureDock.querySelectorAll(".gesture-item").forEach(item => {
    item.classList.toggle("is-active", item.dataset.gesture === dockMode);
  });

  els.handCount.textContent = gesture.handCount + " / 2";
  els.cameraPanel.classList.toggle("is-tracking", gesture.handPresent);
  els.videoPlaceholder.style.opacity = gesture.handPresent ? "0" : "1";
}

/* ============================================================
   六、照片查看器常量
   ============================================================ */
const VIEWER_SHOW_MS = 3000;   // 大图展示多久后自动关闭

/* ============================================================
   六·五、OK 手势 —— 粒子四散 + 中央随机文案
   ============================================================ */
// 三句切题的名人名言（中文译文 + 署名落款）
const WISHES = [
  ["身在井隅，心向璀璨", "—— 王尔德《温德米尔夫人的扇子》"],
  ["世间最美好的东西，看不见也摸不着，只能用心去感受", "—— 海伦·凯勒"],
  ["祝福这个季节，让整个世界结成一场爱的同盟", "—— 汉密尔顿·赖特·梅比"],
];

function showWishQuote() {
  if (wishAnimating) return;
  let i = Math.floor(Math.random() * WISHES.length);
  if (i === lastWishIndex) i = (i + 1) % WISHES.length;  // 避免连续重复
  lastWishIndex = i;
  const [zh, en] = WISHES[i];
  els.wishQuoteText.textContent = zh;
  els.wishQuoteEn.textContent = en;
  wishAnimating = true;
  gesture.wishActive = true;         // 粒子隐去，让文案成为主角

  const q = els.wishQuote;
  const text = els.wishQuoteText;
  const enEl = els.wishQuoteEn;
  const orn = q.querySelector(".wish-quote__ornament");
  [q, text, enEl, orn].forEach(el => { el.getAnimations().forEach(a => a.cancel()); });

  q.classList.add("is-visible");
  const ease = "cubic-bezier(0.16,1,0.3,1)";
  q.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: ease, fill: "forwards" });
  orn.animate([
    { opacity: 0, transform: "scaleX(0.4)" },
    { opacity: 1, transform: "scaleX(1)" },
  ], { duration: 900, delay: 120, easing: ease, fill: "forwards" });
  text.animate([
    { opacity: 0, transform: "translateY(22px)", filter: "blur(12px)", letterSpacing: "0.32em" },
    { opacity: 1, transform: "translateY(0)", filter: "blur(0)", letterSpacing: "0.16em" },
  ], { duration: 1100, delay: 180, easing: ease, fill: "forwards" });
  enEl.animate([
    { opacity: 0, transform: "translateY(10px)" },
    { opacity: 1, transform: "translateY(0)" },
  ], { duration: 800, delay: 560, easing: ease, fill: "forwards" });

  setTimeout(() => {
    q.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: "ease-in", fill: "forwards" });
    text.animate([
      { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
      { opacity: 0, transform: "translateY(-18px)", filter: "blur(10px)" },
    ], { duration: 900, easing: "ease-in", fill: "forwards" });
    setTimeout(() => {
      q.classList.remove("is-visible");
      wishAnimating = false;
      gesture.wishActive = false;    // 文案收起，粒子平滑恢复
    }, 900);
  }, 3600);
}

let lastOkPulse = 0;
function watchOkPulse() {
  if (gesture.okPulse !== lastOkPulse) {
    lastOkPulse = gesture.okPulse;
    showWishQuote();
  }
}

/* ============================================================
   七、大图查看器（每张照片不同的过渡动效）
   ============================================================ */
const VIEWER_ENTRANCES = [
  (el) => el.animate([
    { opacity: 0, transform: "translateY(60px) scale(0.6) rotate(-8deg)", filter: "blur(14px)" },
    { opacity: 1, transform: "translateY(0) scale(1) rotate(0)", filter: "blur(0)" },
  ], { duration: 900, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" }),
  (el) => el.animate([
    { opacity: 0, transform: "perspective(1200px) rotateY(90deg) scale(0.8)" },
    { opacity: 1, transform: "perspective(1200px) rotateY(0) scale(1)" },
  ], { duration: 950, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" }),
  (el) => el.animate([
    { opacity: 0, transform: "scale(0.2) rotate(180deg)", filter: "blur(8px)" },
    { opacity: 1, transform: "scale(1) rotate(0)", filter: "blur(0)" },
  ], { duration: 1000, easing: "cubic-bezier(0.34,1.56,0.64,1)", fill: "forwards" }),
  (el) => el.animate([
    { opacity: 0, transform: "translateX(-120px) rotate(-12deg)" },
    { opacity: 1, transform: "translateX(0) rotate(0)" },
  ], { duration: 850, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" }),
  (el) => el.animate([
    { opacity: 0, transform: "translateY(-70px) scale(1.25)", filter: "blur(10px)" },
    { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" },
  ], { duration: 880, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" }),
  (el) => el.animate([
    { opacity: 0, transform: "perspective(1200px) rotateX(-85deg) scale(0.7)" },
    { opacity: 1, transform: "perspective(1200px) rotateX(0) scale(1)" },
  ], { duration: 980, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" }),
];

function openViewer(rec) {
  if (!rec) return;
  if (viewerState.open && viewerState.id === rec.id) return;
  closeViewer(true);

  els.viewerImage.src = rec.src;
  els.viewerTitle.textContent = rec.caption || "圣诞回忆";
  els.viewerDesc.textContent = "有些光，只想与你一起收藏。";
  els.viewer.classList.add("is-open");
  root.classList.add("viewer-open");

  const style = rec.id % VIEWER_ENTRANCES.length;
  viewerState.closeAnim?.cancel?.();
  viewerState = { open: true, id: rec.id, anim: null, capAnim: null, closeAnim: null };
  viewerState.anim = VIEWER_ENTRANCES[style](els.viewerCard);
  viewerState.capAnim = els.viewerCard.parentElement.querySelector(".photo-viewer__caption").animate([
    { opacity: 0, transform: "translateY(16px)" },
    { opacity: 1, transform: "translateY(0)" },
  ], { duration: 800, delay: 260, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" });

  highlightPhoto(rec.id, true);

  // 展示后自动关闭，无需手动点
  clearTimeout(viewerAutoCloseTimer);
  viewerAutoCloseTimer = setTimeout(() => {
    if (viewerState.open && viewerState.id === rec.id) closeViewer();
  }, VIEWER_SHOW_MS);
}

function closeViewer(silent = false) {
  clearTimeout(viewerAutoCloseTimer);
  if (viewerState.open && !silent) {
    viewerState.closeAnim = els.viewerCard.animate([
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.86)", filter: "blur(6px)" },
    ], { duration: 420, easing: "cubic-bezier(0.4,0,1,1)", fill: "forwards" });
  }
  viewerState.anim?.cancel?.();
  viewerState.capAnim?.cancel?.();
  els.viewerCard.style.opacity = "";
  els.viewerCard.style.transform = "";
  if (viewerState.id !== null) highlightPhoto(viewerState.id, false);
  const keepCloseAnim = viewerState.closeAnim;
  viewerState = { open: false, id: null, anim: null, capAnim: null, closeAnim: keepCloseAnim };
  els.viewer.classList.remove("is-open");
  root.classList.remove("viewer-open");
}

// 手动关闭入口（键盘/无障碍），展示后也会自动关闭
els.viewerClose.addEventListener("click", () => closeViewer());
els.viewer.querySelector(".photo-viewer__backdrop").addEventListener("click", () => closeViewer());

/* ============================================================
   八、回忆面板（照片墙）
   ============================================================ */
function renderMemory() {
  els.memoryList.innerHTML = "";
  photos.forEach((rec, i) => {
    const card = document.createElement("div");
    card.className = "memory-card";
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.src = rec.src;
    img.alt = rec.caption;
    card.appendChild(img);

    const idx = document.createElement("span");
    idx.className = "memory-card__index";
    idx.textContent = String(i + 1).padStart(2, "0");
    card.appendChild(idx);

    const title = document.createElement("span");
    title.className = "memory-card__title";
    title.textContent = rec.caption;
    card.appendChild(title);

    const del = document.createElement("button");
    del.className = "memory-card__remove";
    del.setAttribute("aria-label", "删除照片");
    del.textContent = "×";
    del.addEventListener("click", (e) => { e.stopPropagation(); removePhoto(rec.id); });
    card.appendChild(del);

    const open = () => { closeMemory(); openViewer(rec); };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    els.memoryList.appendChild(card);
  });
  if (!photos.length) {
    const empty = document.createElement("p");
    empty.className = "memory-empty";
    empty.textContent = "还没有照片。点上面的框上传，或把图片放进 photos/ 文件夹。";
    els.memoryList.appendChild(empty);
  }
  els.memoryCount.textContent = String(photos.length).padStart(2, "0");
}
bus.on("photo:added", renderMemory);
bus.on("photo:removed", renderMemory);
renderMemory();

function openMemory() {
  els.memoryPanel.classList.add("is-open");
  els.memoryScrim.classList.add("is-open");
  root.classList.add("panel-open");
}
function closeMemory() {
  els.memoryPanel.classList.remove("is-open");
  els.memoryScrim.classList.remove("is-open");
  root.classList.remove("panel-open");
}
els.memoryBtn.addEventListener("click", openMemory);
els.memoryClose.addEventListener("click", closeMemory);
els.memoryScrim.addEventListener("click", closeMemory);

/** 批量添加图片文件（仅本次浏览有效） */
function addFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      addPhoto(e.target.result, f.name.replace(/\.[^.]+$/, ""));
      n++;
      if (n === 1) showToast("回忆已落在树上 ✦");
    };
    reader.readAsDataURL(f);
  }
  if (![...files].some(f => f.type.startsWith("image/"))) showToast("请选择图片文件");
}

els.dropzone.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
["dragenter", "dragover"].forEach(ev => els.dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); els.dropzone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach(ev => els.dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); els.dropzone.classList.remove("is-dragging");
}));
els.dropzone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

/** 通过“文档”批量插入：每行一个图片链接 / data:image / 本地图片路径 */
els.textAdd.addEventListener("click", () => {
  const text = els.textInput.value.trim();
  if (!text) { showToast("先粘贴图片链接或路径"); return; }
  const tokens = text.split(/[\s,，、;；]+/).filter(Boolean);
  const valid = tokens.filter(t =>
    /^https?:\/\//i.test(t) || /^data:image\//i.test(t) || /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(t)
  );
  if (!valid.length) { showToast("没识别到图片链接，请检查格式"); return; }
  valid.forEach((url, i) => {
    const name = decodeURIComponent(url.split("/").pop() || "").replace(/\?.*/, "").replace(/\.[^.]+$/, "") || `回忆 ${i + 1}`;
    addPhoto(url, name.slice(0, 12));
  });
  els.textInput.value = "";
  showToast(`已从文档插入 ${valid.length} 张照片 ✦`);
});

/* ============================================================
   九、开场 / 摄像头 / 全屏
   ============================================================ */
function hideIntro() { els.intro.classList.add("is-leaving"); }

// 自动把 photos/ 文件夹里的图片挂到树上：
// - 本地 npm start / server.js：走 /api/photos，实时扫描文件夹，不用手动生成清单；
// - 线上（GitHub Pages）：读 `npm run photos` 生成的 photos.json。
// 只加载一次；用 url 去重。
let localPhotosLoaded = false;
async function loadLocalPhotos() {
  if (localPhotosLoaded) return;
  localPhotosLoaded = true;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  try {
    let list = null;
    if (isLocal) {
      try {
        const r = await fetch("./api/photos", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data.photos)) list = data.photos;
        }
      } catch (e) { /* 本地服务器没开就走清单 */ }
    }
    if (!list) {
      const res = await fetch("./photos.json", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      list = Array.isArray(data.photos) ? data.photos : [];
    }
    if (!list.length) return;
    const existing = new Set(photos.map(p => p.src));
    let added = 0;
    for (const item of list) {
      if (!item.url || existing.has(item.url)) continue;
      const caption = item.name || `回忆 ${String(added + 1).padStart(2, "0")}`;
      addPhoto(item.url, caption);
      existing.add(item.url);
      added++;
    }
    if (added) setTimeout(() => showToast(`已把 ${added} 张照片挂上树 ✦`, 2600), 500);
  } catch (e) {
    console.warn("照片加载失败", e);
  }
}

/* ---- 首次进入引导卡：让新用户一眼学会核心手势 + 找到净屏观赏入口 ---- */
const WELCOME_SEEN_KEY = "xmas-welcome-seen-v1";
let welcomeTimer = null;
function showWelcomeOnce() {
  let seen = false;
  try { seen = localStorage.getItem(WELCOME_SEEN_KEY) === "1"; } catch (e) { /* 忽略 */ }
  if (seen || !els.welcomeCard) return;
  const reveal = () => {
    els.welcomeCard.classList.add("is-visible");
    // 14 秒后自动收起（用户仍可随时手动关）；看过一次就不再打扰
    welcomeTimer = setTimeout(dismissWelcome, 14000);
  };
  setTimeout(reveal, 1400);
}
function dismissWelcome() {
  if (welcomeTimer) { clearTimeout(welcomeTimer); welcomeTimer = null; }
  if (!els.welcomeCard) return;
  els.welcomeCard.classList.remove("is-visible");
  try { localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch (e) { /* 忽略 */ }
}
if (els.welcomeClose) els.welcomeClose.addEventListener("click", dismissWelcome);

function enterExperience(withCamera) {
  hideIntro();
  bootScene();
  loadLocalPhotos();          // photos/ 文件夹里的照片自动上树
  root.classList.toggle("is-live", withCamera);
  els.cameraPanel.classList.toggle("is-visible", withCamera);
  els.cameraPanel.classList.toggle("is-collapsed", !withCamera);
  setTimeout(() => { els.intro.style.display = "none"; }, 1000);
  showWelcomeOnce();
}

async function startCamera() {
  if (stream) { enterExperience(true); startLoop(); return; }

  // 模型未就绪时先等待，而不是静默无响应
  if (!handLandmarker) {
    els.startLabel.textContent = "模型加载中…";
    setStatus("手势模型加载中，请稍候…");
    const ok = await modelReady;
    if (!ok || !handLandmarker) {
      els.startLabel.textContent = "开启摄像头";
      showToast("手势模型加载失败，请刷新页面重试", 4500);
      return;
    }
  }

  els.startLabel.textContent = "正在开启…";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    els.webcam.srcObject = stream;
    await els.webcam.play();
    els.overlay.width = els.webcam.videoWidth || 1280;
    els.overlay.height = els.webcam.videoHeight || 720;
    els.webcam.classList.add("is-playing");
    lastVideoTime = -1;
    enterExperience(true);
    startLoop();
    showToast("摄像头已开启 · 试试握拳与张开 ✦", 3600);
  } catch (e) {
    console.error(e);
    showToast("摄像头开启失败：" + (e.message || e.name), 4200);
  }
  els.startLabel.textContent = "开启摄像头";
}

els.startCamera.addEventListener("click", startCamera);
els.startDemo.addEventListener("click", () => {
  enterExperience(false);
  showToast("漫游模式 · 拖拽旋转，滚轮缩放，照片从 photos/ 自动挂上", 4200);
});

els.cameraToggle.addEventListener("click", () => {
  if (stream) {
    els.cameraPanel.classList.toggle("is-visible");
  } else {
    setStatus(handLandmarker ? "点击开启摄像头" : "手势模型加载中…", handLandmarker ? "ready" : "");
    startCamera();
  }
});
els.cameraClose.addEventListener("click", () => els.cameraPanel.classList.remove("is-visible"));

// 手势训练师：初始化面板 + 顶栏入口
initTrainer();
$("trainer-btn").addEventListener("click", showTrainer);

// 净屏观赏：顶栏按钮 + 右上角退出按钮（看得见的入口，不必记快捷键）
function enterCinema() {
  dismissWelcome();           // 主动进净屏即视为已了解引导，收起并记住
  setPreviewMode(true);
  showToast("净屏观赏 · 树仍随手而动，点右上「退出观赏」返回", 2400);
}
function exitCinema() {
  setPreviewMode(false);
  showToast("已退出净屏观赏", 1400);
}
els.cinemaBtn.addEventListener("click", () => {
  if (learnConfig.previewMode) exitCinema(); else enterCinema();
});
els.cinemaExit.addEventListener("click", exitCinema);

els.fullscreen.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (e) { showToast("全屏切换失败"); }
});
document.addEventListener("fullscreenchange", () => {
  root.classList.toggle("is-fullscreen", !!document.fullscreenElement);
});

/* ============================================================
   十、检测循环
   ============================================================ */
function startLoop() {
  if (loopRunning) return;
  loopRunning = true;

  function frame(t) {
    requestAnimationFrame(frame);
    if (!stream || !handLandmarker || els.webcam.readyState < 2) return;
    if (els.webcam.currentTime === lastVideoTime) return;
    lastVideoTime = els.webcam.currentTime;

    let results;
    try {
      results = handLandmarker.detectForVideo(els.webcam, t);
    } catch (e) {
      console.error("detectForVideo", e);
      return;
    }

    const landmarks = updateGesture(results);

    // —— 机器学习识别：对主导手提取特征 → 预测 → 可选接管 ——
    const learnLm = currentLandmarks[leadHandIdx] || currentLandmarks[0];
    recognize(learnLm || null);
    applyTakeover();

    drawOverlay(landmarks);
    drawTrail();
    updateHUD();
    watchOkPulse();
    updateTrainer(t);
  }
  requestAnimationFrame(frame);
}

// 无摄像头时也保持轨迹画布干净
requestAnimationFrame(function idleDraw() {
  if (!loopRunning) drawTrail();
  requestAnimationFrame(idleDraw);
});

// 键盘快捷：Esc 关闭大图 / 面板
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (els.dedicationEditor.classList.contains("is-open")) closeDedicationEditor();
  else if (viewerState.open) closeViewer();
  else if (els.memoryPanel.classList.contains("is-open")) closeMemory();
  else if (learnConfig.previewMode) exitCinema();
});

console.log("✅ 全部交互已绑定");
