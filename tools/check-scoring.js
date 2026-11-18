/*!
 * 匹配算法的 Node 冒烟测试
 * 用法：node tools/check-scoring.js
 *
 * 校验两件事：
 *   1. 参数完全正确的曲线能拿到接近 100% 的匹配度；
 *   2. 参数略微跑偏时匹配度会平滑下降，乱画的曲线分数很低。
 */
'use strict';

const Scoring = require('../assets/scoring.js');

const WORLD = 6;
const SAMPLES = 900;

// —— 和 assets/game.js 里一致的采样实现（测试里重新写一份，避免依赖 DOM）——
function sample(curve) {
  const p = curve.p;
  const pts = [];
  const add = (x, y) => {
    if (!isFinite(x) || !isFinite(y)) return;
    if (Math.abs(x) > 1e4 || Math.abs(y) > 1e4) return;
    pts.push([x, y]);
  };
  let i, x, y, t;
  switch (curve.type) {
    case 'linear':
      for (i = 0; i <= SAMPLES; i++) { x = -WORLD + 2 * WORLD * i / SAMPLES; add(x, p.k * x + p.b); }
      break;
    case 'vline':
      for (i = 0; i <= SAMPLES; i++) { y = -WORLD + 2 * WORLD * i / SAMPLES; add(p.c, y); }
      break;
    case 'quad':
      for (i = 0; i <= SAMPLES; i++) { x = -WORLD + 2 * WORLD * i / SAMPLES; add(x, p.v + p.a * (x - p.h) * (x - p.h)); }
      break;
    case 'recip': {
      const x0 = p.h + 0.02;
      const x1 = WORLD + 1.2;
      if (x1 > x0) {
        for (i = 0; i <= SAMPLES; i++) { x = x0 + (x1 - x0) * i / SAMPLES; add(x, p.v + p.a / (x - p.h)); }
      }
      break;
    }
    case 'circle':
      for (i = 0; i <= 720; i++) { t = i * Math.PI * 2 / 720; add(p.h + p.r * Math.cos(t), p.v + p.r * Math.sin(t)); }
      break;
    case 'sineH':
      for (i = 0; i <= SAMPLES; i++) { x = -WORLD + 2 * WORLD * i / SAMPLES; add(x, p.v + p.A * Math.sin(p.w * (x - p.h))); }
      break;
    case 'sineV':
      for (i = 0; i <= SAMPLES; i++) { y = -WORLD + 2 * WORLD * i / SAMPLES; add(p.h + p.A * Math.sin(p.w * (y - p.v)), y); }
      break;
  }
  return pts;
}

const LEVELS = [
  {
    name: 'L 反函数',
    bbox: { x0: -2.85, x1: 2.85, y0: -3.35, y1: 4.45 },
    target: [{ type: 'recip', p: { a: 0.8, h: -2.8, v: -3.2 } }],
    near: [{ type: 'recip', p: { a: 0.85, h: -2.75, v: -3.15 } }]
  },
  {
    name: 'O 圆',
    bbox: { x0: -2.95, x1: 2.95, y0: -2.95, y1: 2.95 },
    target: [{ type: 'circle', p: { h: 0, v: 0, r: 2.8 } }],
    near: [{ type: 'circle', p: { h: 0.1, v: -0.1, r: 2.75 } }]
  },
  {
    name: 'V 二次函数',
    bbox: { x0: -1.78, x1: 1.78, y0: -3.35, y1: 3.25 },
    target: [{ type: 'quad', p: { a: 2.2, h: 0, v: -3.2 } }],
    near: [{ type: 'quad', p: { a: 2.1, h: 0.05, v: -3.1 } }]
  },
  {
    name: 'E 正弦竖起来',
    bbox: { x0: -2.1, x1: 2.1, y0: -3.25, y1: 3.25 },
    target: [
      { type: 'vline', p: { c: -2 } },
      { type: 'sineV', p: { A: 2, w: 2.95, h: 0, v: 3.73 } }
    ],
    near: [
      { type: 'vline', p: { c: -1.95 } },
      { type: 'sineV', p: { A: 1.95, w: 2.9, h: 0.05, v: 3.7 } }
    ]
  }
];

const OPTS = { size: 240, thickness: 0.13, tolerance: 0.17 };

let failed = 0;

function check(label, ok, extra) {
  const line = (ok ? '  ok  ' : ' FAIL ') + label + (extra ? '  ' + extra : '');
  console.log(line);
  if (!ok) failed++;
}

console.log('=== LOVE 匹配算法冒烟测试 ===');
LEVELS.forEach((lv) => {
  const scorer = Scoring.createScorer(lv.target.map(sample), lv.bbox, OPTS);

  const exact = scorer.evaluate(lv.target.map(sample));
  check(
    lv.name + '：参数完全正确 ≈ 100%',
    exact.score > 0.985,
    'score=' + (exact.score * 100).toFixed(1) + '%'
  );

  const near = scorer.evaluate(lv.near.map(sample));
  check(
    lv.name + '：参数略偏仍然很高',
    near.score > 0.8,
    'score=' + (near.score * 100).toFixed(1) + '%'
  );

  const empty = scorer.evaluate([]);
  check(lv.name + '：没有曲线 = 0%', empty.score === 0);

  const off = scorer.evaluate([sample({ type: 'linear', p: { k: 0.4, b: 1.2 } })]);
  check(
    lv.name + '：一条无关直线分数很低',
    off.score < 0.2,
    'score=' + (off.score * 100).toFixed(1) + '%'
  );
});

// 乱画一大片：覆盖率可能高，但精确率应该把它压下来
const lv0 = LEVELS[0];
const s0 = Scoring.createScorer(lv0.target.map(sample), lv0.bbox, OPTS);
const scribble = [];
for (let k = -5; k <= 5; k += 0.5) scribble.push(sample({ type: 'linear', p: { k: 0, b: k } }));
const scribbleScore = s0.evaluate(scribble);
check(
  '乱画一堆横线不会高分',
  scribbleScore.score < 0.5,
  'score=' + (scribbleScore.score * 100).toFixed(1) +
  '% cov=' + (scribbleScore.coverage * 100).toFixed(1) +
  '% prec=' + (scribbleScore.precision * 100).toFixed(1) + '%'
);

console.log(failed ? '\n有 ' + failed + ' 项未通过 ✗' : '\n全部通过 ✓');
process.exit(failed ? 1 : 0);
