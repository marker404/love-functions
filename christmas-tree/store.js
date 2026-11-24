// ============================================================
// store.js — 单一数据源 + 极简事件总线
// 负责解耦「手势/UI 层(app.js)」与「3D 场景层(main.js)」
// ============================================================

/** 手势状态：由 app.js 每帧写入，main.js 每帧读取 */
export const gesture = {
  handPresent: false,   // 是否检测到手
  handCount: 0,         // 0 / 1 / 2
  openness: 0,          // 0=握拳 … 1=完全张开（取所有手的平均）
  spread: 0,            // 0=聚合成树 … 1=完全散开（平滑插值后的目标）
  scale: 1,             // 由双手间距 / 张合度推导的整体缩放
  spin: 0,              // 手掌顺逆时针旋转角速度（rad/s），驱动树体旋转
  palmAngle: null,      // 主手掌朝向角（弧度），用于计算旋转
  pinch: false,         // 拇指+食指捏合（保持散开）
  point: false,         // 仅食指伸出（指尖牵引星光）
  pointX: 0,            // 食指指尖归一化屏幕坐标（已镜像，0..1）
  pointY: 0,
  pinchX: 0,            // 捏合中点归一化屏幕坐标
  pinchY: 0,
  indexX: 0,            // 食指尖原始位置（镜像后）
  indexY: 0,
  palmX: 0,             // 主手掌中心归一化屏幕坐标
  palmY: 0,
  palmPath: [],         // 手掌运动路径 [{x,y,t}]，用于拖尾
  pathActive: false,
  // OK 手势：粒子隐去 + 中央随机文案
  ok: false,            // 是否识别到 OK 手势
  okPulse: 0,           // 每次新触发 OK 递增，供文案层做一次性出场动画
  wishActive: false,    // 文案正在展示（含手势收回后的展示期），粒子据此保持隐去
  mode: "idle",         // idle | fist | open | pinch | point | spin | ok
  // 机器学习手势识别（gesture-learn.js 每帧写入）
  mlLabel: "",          // 当前识别出的类别 key
  mlConfidence: 0,      // 置信度 0..1
  mlPrediction: null,   // 完整预测 {label, confidence, margin, scores}
};

/** 照片数据：每张 {id, src, caption, ...运行态由 main.js 填充} */
export const photos = [];
let _photoId = 0;
export function nextPhotoId() { return ++_photoId; }

/** 极简事件总线 */
const _listeners = new Map();
export const bus = {
  on(name, fn) {
    if (!_listeners.has(name)) _listeners.set(name, new Set());
    _listeners.get(name).add(fn);
    return () => bus.off(name, fn);
  },
  off(name, fn) { _listeners.get(name)?.delete(fn); },
  emit(name, payload) {
    const set = _listeners.get(name);
    if (set) for (const fn of set) {
      try { fn(payload); } catch (e) { console.error(`[bus] ${name}`, e); }
    }
  },
};

/** UI 提示辅助（app.js 实现，main.js 可调用） */
export const ui = {
  toast: (msg, dur) => bus.emit("ui:toast", { msg, dur }),
};
