// ============================================================
// main.js — Three.js 螺旋发光粒子圣诞树
// 纯发光点粒子 + 自定义 shader（位置插值在 GPU 完成，极致丝滑）
// ============================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { gesture, photos, bus, nextPhotoId } from "./store.js";

console.log("✅ main.js loaded (螺旋发光粒子版)");

export let scene, camera, renderer, controls;

let booted = false;
let clock;
let treeRoot;
let treePoints, treeUniforms;
let ringGroup;
let heartGroup, heartLight, heartGlow;
let photoObjects = [];

const _v = new THREE.Vector3();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);

/* ============================================================
   一、程序化贴图
   ============================================================ */
function radialTexture(inner = "rgba(255,255,255,0.95)", mid = "rgba(180,220,255,0.35)", outer = "rgba(120,180,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.3, mid);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 带相框 + 标题的照片贴图；图片异步加载完成后刷新 */
function frameTexture(image, caption) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 640;
  const ctx = c.getContext("2d");
  const drawFrame = (drawn) => {
    ctx.clearRect(0, 0, 512, 640);
    const g = ctx.createLinearGradient(0, 0, 512, 640);
    g.addColorStop(0, "#f6ead0"); g.addColorStop(0.5, "#d9bd8c"); g.addColorStop(1, "#9a7742");
    ctx.fillStyle = g; roundRect(ctx, 6, 6, 500, 628, 16); ctx.fill();
    ctx.strokeStyle = "rgba(70,44,16,0.5)"; ctx.lineWidth = 3; roundRect(ctx, 14, 14, 484, 612, 12); ctx.stroke();
    ctx.fillStyle = "#0b1610"; roundRect(ctx, 30, 30, 452, 500, 6); ctx.fill();
    if (drawn) {
      ctx.save(); roundRect(ctx, 30, 30, 452, 500, 6); ctx.clip();
      drawCover(ctx, drawn, 30, 30, 452, 500); ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,225,170,0.12)";
      ctx.font = '64px "Apple Color Emoji","Segoe UI Emoji",serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🎄", 256, 280);
    }
    ctx.fillStyle = "rgba(20,12,4,0.35)"; roundRect(ctx, 30, 546, 452, 62, 5); ctx.fill();
    ctx.fillStyle = "#fff3d4"; ctx.font = '500 27px "Songti SC","SimSun",serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let text = String(caption || "圣诞回忆");
    if (text.length > 12) text = text.slice(0, 11) + "…";
    ctx.fillText(text, 256, 578);
  };
  drawFrame(null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (image) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { drawFrame(img); tex.needsUpdate = true; };
    img.onerror = () => {};
    img.src = image;
  }
  return tex;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, br = w / h;
  let sw, sh, sx, sy;
  if (ir > br) { sh = img.height; sw = sh * br; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / br; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function demoDataURL(title, sub, c1, c2) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 640;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 512, 640);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 640);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.globalAlpha = Math.random() * 0.7 + 0.2;
    ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 640, Math.random() * 1.8 + 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,244,218,0.96)"; ctx.font = '300 62px "Songti SC","SimSun",serif'; ctx.fillText(title, 256, 330);
  ctx.fillStyle = "rgba(255,244,218,0.72)"; ctx.font = '300 24px "Songti SC","SimSun",serif'; ctx.fillText(sub, 256, 380);
  return c.toDataURL("image/jpeg", 0.9);
}

/* ============================================================
   二、树的形态：螺旋丝带 + 层叠环
   ============================================================ */
const TREE_H = 9.6;
const TREE_BOTTOM = -4.8;
const TREE_R = 4.5;

function coneRadius(t) { return TREE_R * Math.pow(1 - t, 0.86); }
function treePoint(t, angle, jitter = 0) {
  const r = coneRadius(t) + jitter;
  return { x: Math.cos(angle) * r, y: TREE_BOTTOM + t * TREE_H, z: Math.sin(angle) * r };
}
function scatterPoint() {
  const u = Math.random(), v = Math.random();
  const theta = u * Math.PI * 2, phi = Math.acos(2 * v - 1);
  const r = rand(5.5, 12);
  return {
    x: Math.sin(phi) * Math.cos(theta) * r,
    y: Math.cos(phi) * r * 0.7 + rand(-1, 1),
    z: Math.sin(phi) * Math.sin(theta) * r,
  };
}

/** 生成螺旋 + 层叠混合的树形坐标 */
function spiralTreePoint(i, total) {
  const rnd = Math.random();
  const t = Math.pow(Math.random(), 0.72);          // 底部更密
  const baseR = coneRadius(t);
  let angle, r;
  if (rnd < 0.68) {
    // 螺旋丝带：6 条主螺旋
    const strands = 6, turns = 7.5;
    const strand = i % strands;
    angle = t * turns * Math.PI * 2 + strand * (Math.PI * 2 / strands) + rand(-0.14, 0.14);
    r = baseR * (0.9 + 0.22 * Math.random());
  } else if (rnd < 0.9) {
    // 层叠圆环：13 个离散高度，每层一圈
    const layers = 13;
    const layer = Math.floor(t * layers) / (layers - 1);
    const lt = clamp(layer);
    angle = Math.random() * Math.PI * 2;
    r = coneRadius(lt) * (0.94 + 0.1 * Math.random());
    return { x: Math.cos(angle) * r, y: TREE_BOTTOM + lt * TREE_H + rand(-0.08, 0.08), z: Math.sin(angle) * r, t: lt };
  } else {
    // 飘散粒子：填充锥形内部
    angle = Math.random() * Math.PI * 2;
    r = baseR * Math.sqrt(Math.random());
  }
  return { x: Math.cos(angle) * r, y: TREE_BOTTOM + t * TREE_H + rand(-0.06, 0.06), z: Math.sin(angle) * r, t };
}

/* ============================================================
   三、发光粒子系统（GPU 插值，丝滑）
   ============================================================ */
const PARTICLE_COUNT = 28000;

const VERT = `
  attribute vec3 aTree;
  attribute vec3 aScatter;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uSpread;
  uniform float uTime;
  uniform float uDpr;
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 pos = mix(aTree, aScatter, uSpread);
    // 散开时的漂浮扰动
    float w = uSpread * 0.5;
    pos.x += sin(uTime * 0.7 + aPhase) * w;
    pos.y += cos(uTime * 0.55 + aPhase) * w;
    pos.z += sin(uTime * 0.65 + aPhase * 1.4) * w;
    vColor = aColor;
    // 闪烁 × 整体淡出（OK 文案时粒子隐去）
    vAlpha = (0.55 + 0.45 * sin(uTime * 2.2 + aPhase * 2.0)) * uFade;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uDpr * (72.0 / max(-mv.z, 0.1)) * (1.0 - 0.25 * uSpread);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    // 双层辉光：紧致亮核 + 柔和外晕，让粒子像真正的发光星点而非硬白点
    float core = smoothstep(0.17, 0.0, d);              // 中心亮点
    float halo = pow(smoothstep(0.5, 0.0, d), 1.35);    // 外围柔光
    float glow = core * 0.85 + halo * 0.6;
    // 亮核处微微提亮并偏白，边缘保留本色，层次更通透
    vec3 lit = mix(vColor, vec3(1.0), core * 0.35);
    gl_FragColor = vec4(lit, glow * clamp(vAlpha, 0.0, 1.0));
  }
`;

function treeColor(t) {
  // 深冰蓝 → 冰蓝 → 银白 → 暖粉 → 粉金，五段通透渐变（顶部更饱满梦幻）
  const deep = new THREE.Color(0x3d8fd6);
  const cold = new THREE.Color(0x8fd8ff);
  const white = new THREE.Color(0xf6faff);
  const warm = new THREE.Color(0xffc4e0);
  const gold = new THREE.Color(0xffe0c0);
  const c = new THREE.Color();
  if (t < 0.28) c.copy(deep).lerp(cold, smoothstep(0, 0.28, t));
  else if (t < 0.55) c.copy(cold).lerp(white, smoothstep(0.28, 0.55, t));
  else if (t < 0.82) c.copy(white).lerp(warm, smoothstep(0.55, 0.82, t));
  else c.copy(warm).lerp(gold, smoothstep(0.82, 1, t));
  c.offsetHSL(rand(-0.012, 0.012), rand(-0.035, 0.035), rand(-0.05, 0.07));
  return c;
}

function buildTreeParticles() {
  const geo = new THREE.BufferGeometry();
  const tree = new Float32Array(PARTICLE_COUNT * 3);
  const scatter = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const phases = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const tp = spiralTreePoint(i, PARTICLE_COUNT);
    const sc = scatterPoint();
    tree[i * 3] = tp.x; tree[i * 3 + 1] = tp.y; tree[i * 3 + 2] = tp.z;
    scatter[i * 3] = sc.x; scatter[i * 3 + 1] = sc.y; scatter[i * 3 + 2] = sc.z;
    const c = treeColor(tp.t ?? clamp((tp.y - TREE_BOTTOM) / TREE_H));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    // 大小分层：多数细密星点 + 少量较大亮点，制造闪烁层次
    sizes[i] = Math.random() < 0.08 ? rand(2.2, 3.4) : rand(0.7, 1.7);
    phases[i] = rand(0, Math.PI * 2);
  }

  geo.setAttribute("position", new THREE.BufferAttribute(tree, 3)); // 占位，实际用 aTree
  geo.setAttribute("aTree", new THREE.BufferAttribute(tree, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  treeUniforms = {
    uSpread: { value: 0 },
    uTime: { value: 0 },
    uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uFade: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: treeUniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  treePoints = new THREE.Points(geo, mat);
  treePoints.frustumCulled = false;
  treeRoot.add(treePoints);
}

/** 底部同心光环 */
function buildGroundRings() {
  ringGroup = new THREE.Group();
  const radii = [2.6, 3.4, 4.3, 5.4];
  const glowTex = radialTexture("rgba(255,255,255,0.95)", "rgba(150,210,255,0.35)", "rgba(120,170,255,0)");
  radii.forEach((radius, ri) => {
    const count = 900 + ri * 250;
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.01, 0.01);
      const r = radius + rand(-0.12, 0.12);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = TREE_BOTTOM - 0.15 + rand(-0.05, 0.05);
      pos[i * 3 + 2] = Math.sin(a) * r;
      sizes[i] = rand(0.7, 1.5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    const ringColors = [0xbfe6ff, 0xffd9e8, 0x9ed4ff, 0xffc9de];
    const mat = new THREE.PointsMaterial({
      color: ringColors[ri % ringColors.length],
      size: 0.16, map: glowTex, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const ring = new THREE.Points(geo, mat);
    ring.userData.speed = (ri % 2 === 0 ? 1 : -1) * (0.03 + ri * 0.012);
    ringGroup.add(ring);
  });
  treeRoot.add(ringGroup);
}

/** 树顶发光心形（替代实心灯泡） */
function buildTopHeart() {
  heartGroup = new THREE.Group();
  const pts = [];
  for (let i = 0; i < 1400; i++) {
    const t = Math.random() * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(x * 0.028 + rand(-0.02, 0.02), y * 0.028 + rand(-0.02, 0.02), rand(-0.06, 0.06));
  }
  const pos = new Float32Array(pts);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xff9fc4, size: 0.13, map: radialTexture("rgba(255,255,255,1)", "rgba(255,160,200,0.4)", "rgba(255,120,180,0)"),
    transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  heartGroup.add(new THREE.Points(geo, mat));
  heartGroup.position.set(0, TREE_BOTTOM + TREE_H + 0.55, 0);

  heartLight = new THREE.PointLight(0xffb0cf, 3.5, 22, 1.8);
  heartGroup.add(heartLight);

  heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("rgba(255,225,240,0.95)", "rgba(255,150,195,0.4)", "rgba(255,120,180,0)"),
    color: 0xffc8de, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
  }));
  heartGlow.scale.set(3.6, 3.6, 1);
  heartGroup.add(heartGlow);

  // 第二层更大更淡的外晕，营造柔和光雾
  const heartAura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture("rgba(255,200,225,0.5)", "rgba(255,140,190,0.18)", "rgba(255,120,180,0)"),
    color: 0xffd0e2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
  }));
  heartAura.scale.set(6.2, 6.2, 1);
  heartGroup.add(heartAura);

  treeRoot.add(heartGroup);
}

function buildStars() {
  const N = 1600;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const warm = new THREE.Color(0xffd9b8), cool = new THREE.Color(0xbfe0ff), white = new THREE.Color(0xffffff);
  for (let i = 0; i < N; i++) {
    const r = rand(35, 100), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    // 冷暖色层次：多数冷白，少量暖金与淡蓝
    const roll = Math.random();
    const base = roll < 0.12 ? warm : roll < 0.3 ? cool : white;
    const w = rand(0.35, 1);
    col[i * 3] = base.r * w; col[i * 3 + 1] = base.g * w; col[i * 3 + 2] = base.b * w;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.62, vertexColors: true, transparent: true, opacity: 0.78,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
    map: radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0.25)", "rgba(255,255,255,0)"),
  })));
}

/* ============================================================
   四、照片（相框 + 光晕 + 各自出场动效）
   ============================================================ */
const ENTRANCES = [
  (p) => ({ s: 0.25 + 0.75 * smoothstep(0, 1, p) + Math.sin(p * Math.PI) * 0.28, ry: 0, rz: 0, y: 0, o: smoothstep(0, 0.25, p) }),
  (p) => ({ s: smoothstep(0, 1, p), ry: (1 - p) * Math.PI, rz: 0, y: 0, o: smoothstep(0, 0.4, p) }),
  (p) => ({ s: smoothstep(0, 1, p), ry: 0, rz: (1 - p) * Math.PI * 2, y: (1 - p) * 5, o: smoothstep(0, 0.5, p) }),
  (p) => ({ s: 1, ry: p < 0.5 ? (0.5 - p) * Math.PI * 2 : 0, rz: 0, y: 0, o: smoothstep(0, 0.2, p) }),
  (p) => {
    const c = 1.70158, c3 = c + 1;
    const e = 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
    return { s: clamp(e, 0, 1.45), ry: 0, rz: 0, y: (1 - p) * -2, o: smoothstep(0, 0.3, p) };
  },
  (p) => ({ s: smoothstep(0, 1, p) * (1 + Math.sin(p * Math.PI * 3) * 0.06), ry: 0, rz: (1 - p) * 0.5, y: (1 - p) * -3.5, o: smoothstep(0, 0.45, p) }),
];

function createPhotoObject(rec) {
  const glowTex = radialTexture("rgba(255,240,220,0.9)", "rgba(255,200,150,0.35)", "rgba(255,170,110,0)");
  const tex = frameTexture(rec.src, rec.caption);
  const group = new THREE.Group();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 1.02),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false })
  );
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 2.1),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  halo.position.z = -0.05;
  group.add(halo, plane);
  treeRoot.add(group);

  // 随机挂在树上（不同高度、不同角度）
  const t = rand(0.14, 0.88);
  const tree = treePoint(t, rand(0, Math.PI * 2), rand(0.15, 0.55));
  const sc = scatterPoint();
  const obj = {
    id: rec.id, group, plane, halo, tex,
    tx: tree.x, ty: tree.y, tz: tree.z,
    sx: sc.x, sy: sc.y, sz: sc.z,
    baseRotY: rand(-0.3, 0.3), phase: rand(0, 6.28),
    style: rec.id % ENTRANCES.length,
    enterStart: clock ? clock.getElapsedTime() : 0,
    enterDur: rand(0.85, 1.35),
    highlight: 0, highlightTarget: 0,
  };
  rec._obj = obj;
  photoObjects.push(obj);
  return obj;
}

export function addPhoto(src, caption) {
  const rec = { id: nextPhotoId(), src, caption: caption || "圣诞回忆" };
  photos.push(rec);
  if (booted) createPhotoObject(rec);
  bus.emit("photo:added", rec);
  return rec;
}
export function removePhoto(id) {
  const i = photos.findIndex(p => p.id === id);
  if (i >= 0) photos.splice(i, 1);
  const oi = photoObjects.findIndex(o => o.id === id);
  if (oi >= 0) {
    const o = photoObjects[oi];
    treeRoot.remove(o.group);
    o.plane.geometry.dispose(); o.plane.material.dispose();
    o.halo.geometry.dispose(); o.halo.material.map?.dispose(); o.halo.material.dispose();
    o.tex.dispose();
    photoObjects.splice(oi, 1);
  }
  bus.emit("photo:removed", id);
}
export function getScreenPhotos() {
  if (!booted) return [];
  treeRoot.updateMatrixWorld(true);
  const W = window.innerWidth, H = window.innerHeight;
  return photoObjects.map(o => {
    _v.copy(o.group.position); treeRoot.localToWorld(_v);
    const ndc = _v.clone().project(camera);
    return {
      id: o.id,
      x: (ndc.x * 0.5 + 0.5) * W, y: (-ndc.y * 0.5 + 0.5) * H,
      nx: ndc.x * 0.5 + 0.5, ny: -ndc.y * 0.5 + 0.5,
      visible: ndc.z < 1,
    };
  }).filter(p => p.visible);
}
export function highlightPhoto(id, on) {
  const o = photoObjects.find(x => x.id === id);
  if (o) o.highlightTarget = on ? 1 : 0;
}
export function pulsePhoto(id) {
  const o = photoObjects.find(x => x.id === id);
  if (o) o.highlightTarget = 1;
}

/* ============================================================
   五、主循环
   ============================================================ */
let spreadCur = 0;
let scaleCur = 1;
let spinCur = 0;   // 手掌旋转驱动的角速度
let fadeCur = 1;   // 整体淡出：1=完整显示，≈0=隐去（OK文案时）

function updatePhotos(time, fade = 1) {
  for (const o of photoObjects) {
    let s = 1, ry = 0, rz = 0, oy = 0, opa = 1;
    if (o.enterStart >= 0) {
      const p = clamp((time - o.enterStart) / o.enterDur);
      const st = ENTRANCES[o.style](p);
      s = st.s; ry = st.ry; rz = st.rz; oy = st.y; opa = st.o;
      if (p >= 1) o.enterStart = -1;
    }
    o.highlight += (o.highlightTarget - o.highlight) * 0.12;
    const k = clamp(spreadCur, 0, 1);
    const bob = Math.sin(time * 0.9 + o.phase) * 0.12;
    o.group.position.set(
      lerp(o.tx, o.sx, k),
      lerp(o.ty, o.sy, k) + oy + bob,
      lerp(o.tz, o.sz, k)
    );
    o.group.scale.setScalar(s * (1 + 0.35 * o.highlight));
    o.group.lookAt(camera.position);
    o.group.rotateY(o.baseRotY + ry);
    o.group.rotateZ(rz);
    o.plane.material.opacity = opa * fade;
    o.halo.material.opacity = ((0.28 + 0.14 * Math.sin(time * 1.8 + o.phase)) * opa + o.highlight * 0.45) * fade;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  // 手势 → 形态
  let target = smoothstep(0.16, 0.82, gesture.openness);
  if (!gesture.handPresent) target = 0;
  if (gesture.pinch) target = Math.max(target, 0.9);   // 捏合：保持散开
  if (gesture.ok) target = 1;                          // OK：粒子彻底四散
  spreadCur += (target - spreadCur) * (1 - Math.exp(-dt * 4.2));

  // 整体淡出：OK 文案展示期间粒子几乎隐去，让文案成为绝对主角
  let fadeTarget = 1;
  if (gesture.wishActive) fadeTarget = 0.06;          // 文案：粒子隐去
  fadeCur += (fadeTarget - fadeCur) * (1 - Math.exp(-dt * (gesture.wishActive ? 4.5 : 3.2)));

  const sTarget = gesture.handPresent ? clamp(gesture.scale, 0.55, 1.75) : 1;
  scaleCur += (sTarget - scaleCur) * (1 - Math.exp(-dt * 4));
  treeRoot.scale.setScalar(scaleCur);

  // 旋转：基础缓慢旋转 + 手掌顺逆时针控制；OK 四散时轻微加速，营造绽放感
  spinCur += (gesture.spin - spinCur) * (1 - Math.exp(-dt * 6));
  const spinBoost = gesture.ok ? 0.5 : 0;
  treeRoot.rotation.y += dt * (0.06 + spreadCur * 0.12 + spinCur + spinBoost);
  treeRoot.position.y = Math.sin(time * 0.7) * 0.1;

  // 更新 shader uniform（位置插值全在 GPU）
  treeUniforms.uSpread.value = spreadCur;
  treeUniforms.uTime.value = time;
  treeUniforms.uFade.value = fadeCur;

  // 光环随散开淡入并反向缓慢旋转（跟随整体淡出）
  ringGroup.children.forEach(r => {
    r.rotation.y += dt * r.userData.speed * (1 + spreadCur);
    r.material.opacity = (0.35 + spreadCur * 0.4) * fadeCur;
  });

  // 心形呼吸（跟随整体淡出）
  const pulse = 0.85 + 0.15 * Math.sin(time * 2.1);
  heartLight.intensity = (2.8 + pulse * 1.2) * fadeCur;
  heartGlow.material.opacity = (0.6 + pulse * 0.3) * fadeCur;
  heartGlow.scale.setScalar(3.0 + pulse * 0.5);
  heartGroup.rotation.z = Math.sin(time * 0.5) * 0.06;

  updatePhotos(time, fadeCur);
  controls.update();
  renderer.render(scene, camera);
}

/* ============================================================
   六、启动
   ============================================================ */
export function bootScene() {
  if (booted) return;
  booted = true;

  const canvas = document.getElementById("scene-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030a10);
  scene.fog = new THREE.FogExp2(0x030a10, 0.006);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 1.2, 19);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.target.set(0, 0.4, 0);

  clock = new THREE.Clock();

  treeRoot = new THREE.Group();
  scene.add(treeRoot);

  buildStars();
  buildTreeParticles();
  buildGroundRings();
  buildTopHeart();

  // 照片由 app.js 在启动时从 /api/photos 自动加载，这里不再塞默认示例图。
  // 若调用方已提前 addPhoto（如 localStorage 恢复），则正常创建其 3D 对象。
  photos.forEach(createPhotoObject);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (treeUniforms) treeUniforms.uDpr.value = Math.min(window.devicePixelRatio || 1, 2);
  });

  animate();
  bus.emit("scene:ready");
  console.log("✅ 螺旋发光粒子场景就绪");
}
