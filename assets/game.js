/*!
 * LOVE · 函数拼字 —— 游戏主逻辑
 * 选函数 / 调参数 / 拼出 L · O · V · E
 *
 * 依赖 assets/scoring.js（提供 window.LoveScoring）
 */
(function () {
  'use strict';

  var Scoring = window.LoveScoring;
  if (!Scoring) {
    if (window.console) console.error('[LOVE] 缺少 assets/scoring.js');
    return;
  }

  // ============================================================
  // 常量
  // ============================================================

  var WORLD = 6;             // 坐标范围：[-6, 6] × [-6, 6]
  var SAMPLES = 900;         // 每条曲线采样点数
  var MAX_CURVES = 5;        // 每关最多几个函数
  var PASS = 0.66;           // 过关线
  var STAR2 = 0.82;
  var STAR3 = 0.92;
  var STORE_KEY = 'love-functions-v1';
  var TOLERANCE = 0.17;
  var THICKNESS = 0.13;

  // ============================================================
  // 函数库定义
  // ============================================================

  var TYPES = {
    linear: {
      name: '一次函数',
      formula: 'y = kx + b',
      params: [
        { key: 'k', label: '斜率 k', min: -3, max: 3, step: 0.05, value: 1 },
        { key: 'b', label: '截距 b', min: -5, max: 5, step: 0.05, value: 0 }
      ]
    },
    vline: {
      name: '竖直线',
      formula: 'x = c',
      params: [
        { key: 'c', label: '位置 c', min: -5, max: 5, step: 0.05, value: 0 }
      ]
    },
    quad: {
      name: '二次函数',
      formula: 'y = a(x−h)² + v',
      params: [
        { key: 'a', label: '开口 a', min: 0.2, max: 4, step: 0.05, value: 1 },
        { key: 'h', label: '左右 h', min: -5, max: 5, step: 0.05, value: 0 },
        { key: 'v', label: '上下 v', min: -5, max: 5, step: 0.05, value: 0 }
      ]
    },
    recip: {
      name: '反函数',
      formula: 'y = a/(x−h) + v',
      params: [
        { key: 'a', label: '弯曲 a', min: 0.1, max: 4, step: 0.05, value: 1 },
        { key: 'h', label: '左右 h', min: -5, max: 5, step: 0.05, value: 0 },
        { key: 'v', label: '上下 v', min: -5, max: 5, step: 0.05, value: 0 }
      ]
    },
    circle: {
      name: '圆',
      formula: '(x−h)² + (y−v)² = r²',
      params: [
        { key: 'h', label: '圆心 h', min: -5, max: 5, step: 0.05, value: 0 },
        { key: 'v', label: '圆心 v', min: -5, max: 5, step: 0.05, value: 0 },
        { key: 'r', label: '半径 r', min: 0.4, max: 5, step: 0.05, value: 3 }
      ]
    },
    sineH: {
      name: '正弦·横',
      formula: 'y = A·sin(ω(x−h)) + v',
      params: [
        { key: 'A', label: '振幅 A', min: 0, max: 4, step: 0.05, value: 1 },
        { key: 'w', label: '频率 ω', min: 0.2, max: 4, step: 0.01, value: 1 },
        { key: 'h', label: '左右 h', min: -5, max: 5, step: 0.05, value: 0 },
        { key: 'v', label: '上下 v', min: -5, max: 5, step: 0.05, value: 0 }
      ]
    },
    sineV: {
      name: '正弦·竖',
      formula: 'x = A·sin(ω(y−v)) + h',
      params: [
        { key: 'A', label: '振幅 A', min: 0, max: 4, step: 0.05, value: 1 },
        { key: 'w', label: '频率 ω', min: 0.2, max: 4, step: 0.01, value: 1 },
        { key: 'h', label: '左右 h', min: -5, max: 5, step: 0.05, value: 0 },
        { key: 'v', label: '上下 v', min: -5, max: 5, step: 0.05, value: 0 }
      ]
    }
  };

  // ============================================================
  // 四个关卡
  // ============================================================

  var LEVELS = [
    {
      letter: 'L',
      theme: '反函数',
      desc: '双曲线的一支：两条渐近线正好围出 L 的拐角。',
      hint: '添加「反函数」y = a/(x−h) + v。a 调到 0.8 左右拐角最尖；h 管左右，v 管上下，让曲线贴住虚线。',
      bbox: { x0: -2.85, x1: 2.85, y0: -3.35, y1: 4.45 },
      target: [{ type: 'recip', p: { a: 0.8, h: -2.8, v: -3.2 } }]
    },
    {
      letter: 'O',
      theme: '圆',
      desc: '一个圆，就是字母 O 最标准的样子。',
      hint: '添加「圆」：半径 r 调到 2.8 左右，圆心对准 (0, 0)。',
      bbox: { x0: -2.95, x1: 2.95, y0: -2.95, y1: 2.95 },
      target: [{ type: 'circle', p: { h: 0, v: 0, r: 2.8 } }]
    },
    {
      letter: 'V',
      theme: '二次函数',
      desc: '抛物线的开口，就是 V 的尖。',
      hint: '添加「二次函数」y = a(x−h)² + v：先把最低点放到底部 (0, −3.2)，再把 a 调到 2.2 左右，开口就会收窄成 V。',
      bbox: { x0: -1.78, x1: 1.78, y0: -3.35, y1: 3.25 },
      target: [{ type: 'quad', p: { a: 2.2, h: 0, v: -3.2 } }]
    },
    {
      letter: 'E',
      theme: '正弦函数竖起来',
      desc: '把竖起来的正弦反过来：三个朝右的波峰，就是 E 的三条横臂。',
      hint: '添加「正弦·竖」x = A·sin(ω(y−v)) + h：A ≈ 2.2、ω ≈ 1.93、h ≈ 0、v ≈ 2.45，曲线自己就张开成 E 的样子，不用再加竖线。',
      bbox: { x0: -2.3, x1: 2.3, y0: -3.3, y1: 3.3 },
      target: [{ type: 'sineV', p: { A: 2.2, w: 1.93, h: 0, v: 2.45 } }]
    }
  ];

  // ============================================================
  // 小工具
  // ============================================================

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function cloneCurves(list) {
    return (list || []).map(function (c) {
      var p = {};
      for (var k in c.p) if (Object.prototype.hasOwnProperty.call(c.p, k)) p[k] = c.p[k];
      return { type: c.type, p: p };
    });
  }

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    var v = Math.round(n * 100) / 100;
    if (Object.is(v, -0)) v = 0;
    return String(v);
  }

  function shiftTerm(v) {
    if (Math.abs(v) < 1e-9) return '';
    return (v > 0 ? ' + ' : ' − ') + fmt(Math.abs(v));
  }

  function paren(varName, shift) {
    if (Math.abs(shift) < 1e-9) return varName;
    return '(' + varName + (shift > 0 ? ' − ' : ' + ') + fmt(Math.abs(shift)) + ')';
  }

  var EQUATIONS = {
    linear: function (p) { return 'y = ' + fmt(p.k) + 'x' + shiftTerm(p.b); },
    vline: function (p) { return 'x = ' + fmt(p.c); },
    quad: function (p) { return 'y = ' + fmt(p.a) + paren('x', p.h) + '²' + shiftTerm(p.v); },
    recip: function (p) { return 'y = ' + fmt(p.a) + ' / ' + paren('x', p.h) + shiftTerm(p.v); },
    circle: function (p) { return paren('x', p.h) + '² + ' + paren('y', p.v) + '² = ' + fmt(p.r) + '²'; },
    sineH: function (p) { return 'y = ' + fmt(p.A) + '·sin(' + fmt(p.w) + paren('x', p.h) + ')' + shiftTerm(p.v); },
    sineV: function (p) { return 'x = ' + fmt(p.A) + '·sin(' + fmt(p.w) + paren('y', p.v) + ')' + shiftTerm(p.h); }
  };

  function equation(curve) {
    var fn = EQUATIONS[curve.type] || function () { return ''; };
    return fn(curve.p);
  }

  // ============================================================
  // 采样：把一条函数曲线变成折线（世界坐标）
  // ============================================================

  function sampleCurve(curve) {
    var p = curve.p;
    var pts = [];
    var i, x, y, t;

    function add(px, py) {
      if (!isFinite(px) || !isFinite(py)) return;
      if (Math.abs(px) > 1e4 || Math.abs(py) > 1e4) return;
      pts.push([px, py]);
    }

    switch (curve.type) {
      case 'linear':
        for (i = 0; i <= SAMPLES; i++) {
          x = -WORLD + 2 * WORLD * i / SAMPLES;
          add(x, p.k * x + p.b);
        }
        break;

      case 'vline':
        for (i = 0; i <= SAMPLES; i++) {
          y = -WORLD + 2 * WORLD * i / SAMPLES;
          add(p.c, y);
        }
        break;

      case 'quad':
        for (i = 0; i <= SAMPLES; i++) {
          x = -WORLD + 2 * WORLD * i / SAMPLES;
          add(x, p.v + p.a * (x - p.h) * (x - p.h));
        }
        break;

      case 'recip': {
        var x0 = p.h + 0.02;
        var x1 = WORLD + 1.2;
        if (x1 > x0) {
          for (i = 0; i <= SAMPLES; i++) {
            x = x0 + (x1 - x0) * i / SAMPLES;
            add(x, p.v + p.a / (x - p.h));
          }
        }
        break;
      }

      case 'circle':
        for (i = 0; i <= 720; i++) {
          t = i * Math.PI * 2 / 720;
          add(p.h + p.r * Math.cos(t), p.v + p.r * Math.sin(t));
        }
        break;

      case 'sineH':
        for (i = 0; i <= SAMPLES; i++) {
          x = -WORLD + 2 * WORLD * i / SAMPLES;
          add(x, p.v + p.A * Math.sin(p.w * (x - p.h)));
        }
        break;

      case 'sineV':
        for (i = 0; i <= SAMPLES; i++) {
          y = -WORLD + 2 * WORLD * i / SAMPLES;
          add(p.h + p.A * Math.sin(p.w * (y - p.v)), y);
        }
        break;
    }
    return pts;
  }

  // ============================================================
  // 状态
  // ============================================================

  var state = null;
  var board = null;
  var ctx = null;
  var wrap = null;
  var view = { size: 0, dpr: 1 };
  var scoreVal = null;
  var scoreEls = [];
  var scoreBox = null;
  var saveTimer = null;
  var toastTimer = null;
  var scorePending = false;
  var lastScore = 0;

  function freshState() {
    return {
      level: 0,
      selected: -1,
      curves: [],
      helpSeen: false,
      levels: LEVELS.map(function () {
        return { best: 0, bestCurves: [], curves: [] };
      })
    };
  }

  function sanitizeCurves(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length && out.length < MAX_CURVES; i++) {
      var c = raw[i];
      if (!c || !TYPES[c.type] || !c.p) continue;
      var p = {};
      TYPES[c.type].params.forEach(function (pd) {
        var v = Number(c.p[pd.key]);
        if (!isFinite(v)) v = pd.value;
        p[pd.key] = clamp(v, pd.min, pd.max);
      });
      out.push({ type: c.type, p: p });
    }
    return out;
  }

  function loadState() {
    var st = freshState();
    var raw = null;
    try { raw = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return st;

    if (typeof raw.level === 'number' && isFinite(raw.level)) {
      st.level = clamp(Math.floor(raw.level), 0, LEVELS.length - 1);
    }
    st.helpSeen = !!raw.helpSeen;

    if (Array.isArray(raw.levels)) {
      for (var i = 0; i < LEVELS.length; i++) {
        var src = raw.levels[i];
        if (!src) continue;
        var best = Number(src.best);
        st.levels[i].best = isNum(best) ? clamp(best, 0, 1) : 0;
        st.levels[i].bestCurves = sanitizeCurves(src.bestCurves);
        st.levels[i].curves = sanitizeCurves(src.curves);
      }
    }
    return st;
  }

  function save() {
    if (!state) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 1,
        level: state.level,
        helpSeen: state.helpSeen,
        levels: state.levels.map(function (rec) {
          return { best: rec.best, bestCurves: rec.bestCurves, curves: rec.curves };
        })
      }));
    } catch (e) { /* 隐私模式下 localStorage 可能不可用，忽略 */ }
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }

  function persistCurves() {
    if (!state) return;
    state.levels[state.level].curves = cloneCurves(state.curves);
    saveSoon();
  }

  // ============================================================
  // 关卡辅助
  // ============================================================

  function unlockedIndex() {
    var u = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      if (state.levels[i].best >= PASS) u = Math.min(LEVELS.length - 1, i + 1);
    }
    return u;
  }

  function isPassed(i) {
    return !!(state.levels[i] && state.levels[i].best >= PASS);
  }

  function targetPts(level) {
    if (!level._pts) level._pts = level.target.map(sampleCurve);
    return level._pts;
  }

  function levelScorer(level) {
    if (!level._scorer) {
      level._scorer = Scoring.createScorer(targetPts(level), level.bbox, {
        size: 240,
        thickness: THICKNESS,
        tolerance: TOLERANCE
      });
    }
    return level._scorer;
  }

  function starsFor(score) {
    if (score >= STAR3) return 3;
    if (score >= STAR2) return 2;
    if (score >= PASS) return 1;
    return 0;
  }

  // ============================================================
  // 画板
  // ============================================================

  function resizeBoard() {
    if (!board || !wrap) return;
    var rect = wrap.getBoundingClientRect();
    var size = Math.floor(rect.width);
    if (!size || size < 80) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (view.size === size && view.dpr === dpr) return;
    view.size = size;
    view.dpr = dpr;
    board.width = Math.round(size * dpr);
    board.height = Math.round(size * dpr);
    board.style.width = size + 'px';
    board.style.height = size + 'px';
    draw();
  }

  function levelView(level) {
    if (!level._view) {
      var b = level.bbox;
      var cx = (b.x0 + b.x1) / 2;
      var cy = (b.y0 + b.y1) / 2;
      var half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 * 1.14;
      level._view = { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half };
    }
    return level._view;
  }

  function draw() {
    if (!ctx || !state) return;
    var size = view.size;
    var dpr = view.dpr;
    if (!size) return;

    var level = LEVELS[state.level];
    var vb = levelView(level);
    var s = size / (vb.x1 - vb.x0);
    function X(x) { return (x - vb.x0) * s; }
    function Y(y) { return (vb.y1 - y) * s; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // 网格
    var i;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#f2f4f8';
    ctx.beginPath();
    for (i = Math.ceil(vb.x0); i <= Math.floor(vb.x1); i++) {
      ctx.moveTo(X(i), 0);
      ctx.lineTo(X(i), size);
    }
    for (i = Math.ceil(vb.y0); i <= Math.floor(vb.y1); i++) {
      ctx.moveTo(0, Y(i));
      ctx.lineTo(size, Y(i));
    }
    ctx.stroke();

    // 坐标轴
    ctx.strokeStyle = '#e6ebf2';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (vb.y0 < 0 && vb.y1 > 0) {
      ctx.moveTo(0, Y(0));
      ctx.lineTo(size, Y(0));
    }
    if (vb.x0 < 0 && vb.x1 > 0) {
      ctx.moveTo(X(0), 0);
      ctx.lineTo(X(0), size);
    }
    ctx.stroke();

    // 轴字母
    ctx.fillStyle = '#c9d1dd';
    ctx.font = 'italic 12px Georgia, serif';
    ctx.textBaseline = 'middle';
    if (vb.y0 < 0 && vb.y1 > 0) {
      ctx.textAlign = 'right';
      ctx.fillText('x', size - 8, Y(0) - 12);
    }
    if (vb.x0 < 0 && vb.x1 > 0) {
      ctx.textAlign = 'left';
      ctx.fillText('y', X(0) + 10, 14);
    }

    // 玩家曲线：先淡淡地画出完整函数，说明这条曲线往哪儿跑
    var playerPts = state.curves.map(sampleCurve);
    if (playerPts.length) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(225, 29, 72, 0.12)';
      ctx.lineWidth = 2;
      strokeWorld(playerPts, X, Y);
    }

    // 字母区域：目标曲线 + 高亮的玩家曲线
    var bb = level.bbox;
    var bx = X(bb.x0);
    var by = Y(bb.y1);
    var bw = (bb.x1 - bb.x0) * s;
    var bh = (bb.y1 - bb.y0) * s;

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    var targetList = targetPts(level);

    // 贴合误差带
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.13)';
    ctx.lineWidth = Math.max(8, s * 0.30);
    strokeWorld(targetList, X, Y);

    // 虚线目标
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.78)';
    ctx.lineWidth = 1.5;
    if (ctx.setLineDash) ctx.setLineDash([5, 6]);
    strokeWorld(targetList, X, Y);
    if (ctx.setLineDash) ctx.setLineDash([]);

    if (playerPts.length) {
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3.4;
      ctx.shadowColor = 'rgba(225, 29, 72, 0.16)';
      ctx.shadowBlur = 10;
      strokeWorld(playerPts, X, Y);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }

    ctx.restore();
  }

  function strokeWorld(polylines, X, Y) {
    ctx.beginPath();
    for (var k = 0; k < polylines.length; k++) {
      var pts = polylines[k];
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(X(pts[i][0]), Y(pts[i][1]));
        else ctx.lineTo(X(pts[i][0]), Y(pts[i][1]));
      }
    }
    ctx.stroke();
  }

  // ============================================================
  // 计分
  // ============================================================

  function scheduleScore() {
    if (scorePending) return;
    scorePending = true;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf(function () {
      scorePending = false;
      scoreNow();
    });
  }

  function scoreNow() {
    if (!state) return null;
    var level = LEVELS[state.level];
    var scorer = levelScorer(level);
    var res = scorer.evaluate(state.curves.map(sampleCurve));

    renderScoreUI(res.score);

    var record = state.levels[state.level];
    var prevPassed = record.best >= PASS;
    var prevStars = starsFor(record.best);
    if (res.score > record.best) {
      record.best = res.score;
      record.bestCurves = cloneCurves(state.curves);
      saveSoon();
      var nowPassed = res.score >= PASS;
      if (!prevPassed && nowPassed) {
        onPass();
      } else if (nowPassed !== prevPassed || starsFor(res.score) !== prevStars) {
        renderSteps();
        renderCta();
      }
    }
    return res;
  }

  // ============================================================
  // 界面渲染
  // ============================================================

  function renderScoreUI(score) {
    lastScore = score;
    var pct = Math.round(score * 100);
    if (scoreVal) scoreVal.textContent = String(pct);
    var n = starsFor(score);
    scoreEls.forEach(function (el, i) {
      el.classList.toggle('on', i < n);
    });
    if (scoreBox) scoreBox.classList.toggle('passed', score >= PASS);
    if (scoreVal && scoreVal.parentNode) {
      scoreVal.parentNode.parentNode.classList.toggle('passed', score >= PASS);
    }
    // 底部参数面板上的实时匹配度（手机上调参时不用抬头看）
    var dockScore = document.getElementById('paramScore');
    if (dockScore) {
      dockScore.textContent = '匹配度 ' + pct + '%';
      dockScore.classList.toggle('hot', score >= PASS);
    }
  }

  function renderSteps() {
    var host = $('#steps');
    if (!host) return;
    host.innerHTML = '';
    var unlocked = unlockedIndex();
    LEVELS.forEach(function (lv, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'step';
      btn.textContent = lv.letter;
      var record = state.levels[i];
      if (record.best >= PASS) btn.classList.add('done');
      if (i === state.level) btn.classList.add('current');
      if (i > unlocked) { btn.classList.add('locked'); btn.disabled = true; }
      btn.title = lv.letter + ' · ' + lv.theme + (record.best > 0 ? ' · ' + Math.round(record.best * 100) + '%' : '');
      btn.addEventListener('click', function () {
        if (i <= unlockedIndex()) goLevel(i);
      });
      host.appendChild(btn);
    });
  }

  function renderLevel() {
    var lv = LEVELS[state.level];
    $('#levelNo').textContent = '0' + (state.level + 1);
    $('#levelLetter').textContent = lv.letter;
    $('#levelTheme').textContent = lv.theme;
    $('#levelDesc').textContent = lv.desc;
    $('#hintText').textContent = lv.hint;
  }

  function renderPalette() {
    var host = $('#palette');
    if (!host) return;
    host.innerHTML = '';
    Object.keys(TYPES).forEach(function (id) {
      var t = TYPES[id];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pal-btn';
      btn.dataset.type = id;
      btn.title = t.name + ' ' + t.formula;
      var b = document.createElement('b');
      b.textContent = t.name;
      var f = document.createElement('span');
      f.className = 'f';
      f.textContent = t.formula;
      btn.appendChild(b);
      btn.appendChild(f);
      btn.addEventListener('click', function () { addCurve(id); });
      host.appendChild(btn);
    });
  }

  function renderFnList() {
    var host = $('#fnList');
    if (!host) return;
    host.innerHTML = '';

    var count = $('#fnCount');
    if (count) count.textContent = state.curves.length + ' / ' + MAX_CURVES;

    if (!state.curves.length) {
      var empty = document.createElement('p');
      empty.className = 'fn-empty';
      empty.textContent = '还没有函数，从下面的函数库挑一个';
      host.appendChild(empty);
      return;
    }

    state.curves.forEach(function (curve, i) {
      var row = document.createElement('div');
      row.className = 'fn-chip' + (i === state.selected ? ' selected' : '');
      row.dataset.i = String(i);
      row.tabIndex = 0;
      row.setAttribute('role', 'button');

      var dot = document.createElement('span');
      dot.className = 'dot';

      var eq = document.createElement('span');
      eq.className = 'eq';
      eq.textContent = equation(curve);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.textContent = '×';
      del.title = '删除这个函数';
      del.setAttribute('aria-label', '删除这个函数');
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        removeCurve(i);
      });

      row.appendChild(dot);
      row.appendChild(eq);
      row.appendChild(del);
      row.addEventListener('click', function () { selectCurve(i); });
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectCurve(i); }
      });
      host.appendChild(row);
    });
  }

  function updateChipEquations() {
    $$('.fn-chip', $('#fnList')).forEach(function (row) {
      var i = Number(row.dataset.i);
      var curve = state.curves[i];
      if (!curve) return;
      var eq = $('.eq', row);
      if (eq) eq.textContent = equation(curve);
    });
  }

  function renderParams() {
    var block = $('#paramsBlock');
    var host = $('#params');
    var title = $('#paramTitle');
    if (!block || !host) return;

    var curve = state.curves[state.selected];
    if (!curve) {
      block.hidden = true;
      host.innerHTML = '';
      setDock(false);
      return;
    }
    block.hidden = false;
    setDock(true);
    var type = TYPES[curve.type];
    if (title) title.textContent = type.name;

    var dockScore = document.getElementById('paramScore');
    if (dockScore) {
      var pct = Math.round(lastScore * 100);
      dockScore.textContent = '匹配度 ' + pct + '%';
      dockScore.classList.toggle('hot', lastScore >= PASS);
    }

    host.innerHTML = '';
    type.params.forEach(function (pd) {
      var row = document.createElement('div');
      row.className = 'param';

      var inputId = 'param-' + curve.type + '-' + pd.key + '-' + state.selected;

      var label = document.createElement('label');
      label.textContent = pd.label;
      label.htmlFor = inputId;

      var input = document.createElement('input');
      input.type = 'range';
      input.id = inputId;
      input.dataset.key = pd.key;
      input.min = String(pd.min);
      input.max = String(pd.max);
      input.step = String(pd.step);
      input.value = String(curve.p[pd.key]);
      input.setAttribute('aria-label', pd.label);
      updateSliderFill(input, curve.p[pd.key], pd);

      var out = document.createElement('output');
      out.textContent = fmt(curve.p[pd.key]);

      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        if (!isFinite(v)) return;
        curve.p[pd.key] = v;
        out.textContent = fmt(v);
        updateSliderFill(input, v, pd);
        updateChipEquations();
        draw();
        scheduleScore();
        persistCurves();
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(out);
      host.appendChild(row);
    });
  }

  function setDock(open) {
    if (document.body) document.body.classList.toggle('dock-open', !!open);
  }

  function updateSliderFill(input, value, pd) {
    var span = pd.max - pd.min;
    var pct = span > 0 ? ((value - pd.min) / span) * 100 : 0;
    input.style.setProperty('--fill', clamp(pct, 0, 100) + '%');
  }

  function isMobileLayout() {
    try { return window.matchMedia('(max-width: 980px)').matches; }
    catch (e) { return window.innerWidth <= 980; }
  }

  // 手机上点了函数/切了函数后，把画布滚回视野里，免得只有滑块看不到图
  function bringStageIntoView() {
    if (!isMobileLayout()) return;
    var stage = document.getElementById('stage');
    if (!stage || !stage.scrollIntoView) return;
    try { stage.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (e) { window.scrollTo(0, 0); }
  }

  function renderCta() {
    var host = $('#cta');
    if (!host) return;
    host.innerHTML = '';

    var li = state.level;
    var record = state.levels[li];
    if (record.best >= PASS) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn primary';
      btn.textContent = li === LEVELS.length - 1 ? '查看 LOVE ❤' : '下一关 →';
      btn.addEventListener('click', function () {
        if (li === LEVELS.length - 1) openFinale();
        else goLevel(li + 1);
      });
      host.appendChild(btn);

      var best = document.createElement('p');
      best.className = 'cta-best';
      best.textContent = '本关最佳 ' + Math.round(record.best * 100) + '%';
      host.appendChild(best);
    } else {
      var hint = document.createElement('p');
      hint.className = 'cta-hint';
      hint.textContent = state.curves.length
        ? '继续微调，让曲线贴住虚线'
        : '先添一个函数试试';
      host.appendChild(hint);
    }
  }

  function updateTip() {
    var tip = $('#tip');
    if (!tip) return;
    var record = state.levels[state.level];
    if (record.best >= PASS) {
      tip.textContent = '✓ 已过关 —— 可以进下一关，也可以继续刷更高分';
    } else if (!state.curves.length) {
      tip.textContent = '从「函数库」挑一个函数开始';
    } else {
      tip.textContent = '拖动滑块，让红色曲线贴住灰色虚线';
    }
  }

  function renderAll() {
    renderSteps();
    renderLevel();
    renderFnList();
    renderParams();
    renderCta();
    updateTip();
    draw();
    scheduleScore();
  }

  // ============================================================
  // 操作
  // ============================================================

  function addCurve(typeId) {
    if (!TYPES[typeId]) return;
    if (state.curves.length >= MAX_CURVES) {
      showToast('最多 5 个函数，先删掉一个吧');
      return;
    }
    var type = TYPES[typeId];
    var p = {};
    type.params.forEach(function (pd) { p[pd.key] = pd.value; });
    state.curves.push({ type: typeId, p: p });
    state.selected = state.curves.length - 1;
    renderFnList();
    renderParams();
    updateTip();
    draw();
    scheduleScore();
    persistCurves();
    bringStageIntoView();
    showToast('已添加「' + type.name + '」');
  }

  function removeCurve(index) {
    if (index < 0 || index >= state.curves.length) return;
    state.curves.splice(index, 1);
    if (state.selected >= state.curves.length) state.selected = state.curves.length - 1;
    renderFnList();
    renderParams();
    updateTip();
    draw();
    scheduleScore();
    persistCurves();
  }

  function selectCurve(index) {
    if (index < 0 || index >= state.curves.length) return;
    state.selected = index;
    renderFnList();
    renderParams();
    bringStageIntoView();
  }

  function goLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;
    if (index > unlockedIndex()) return;
    state.level = index;
    state.curves = cloneCurves(state.levels[index].curves);
    state.selected = state.curves.length ? state.curves.length - 1 : -1;
    var hint = $('#hintBox');
    if (hint) hint.open = false;
    renderAll();
    saveSoon();
    if (window.innerWidth < 980 && window.scrollY > 40) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
  }

  function onPass() {
    var lv = LEVELS[state.level];
    showToast('✓ ' + lv.letter + ' 拼好了');
    renderSteps();
    renderCta();
    updateTip();
    if (state.level === LEVELS.length - 1) {
      setTimeout(openFinale, 800);
    }
  }

  // ============================================================
  // 提示气泡 / 弹层
  // ============================================================

  function showToast(message) {
    var toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1900);
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (id === 'helpModal') {
      state.helpSeen = true;
      saveSoon();
    }
    if (id === 'finaleModal') stopFinale();
    var help = document.getElementById('helpModal');
    var finale = document.getElementById('finaleModal');
    if (help && help.hidden && finale && finale.hidden) {
      document.body.classList.remove('modal-open');
    }
  }

  // ============================================================
  // 通关 LOVE：逐笔画出来 + 小动画
  // ============================================================

  var FINALE = {
    raf: 0,
    running: false,
    start: 0,
    time: 0,
    letters: null,
    hearts: null,
    tagline: 'made of functions, deployed with love',
    timing: {
      stagger: 430,
      draw: 900,
      taglineStart: 2360,
      taglineFade: 760,
      heartsStart: 2200
    }
  };

  function openFinale() {
    openModal('finaleModal');
    buildFinaleLetters();
    updateFinaleNote();
    renderFinaleFrame(0);
    startFinale();
  }

  function buildFinaleLetters() {
    FINALE.letters = LEVELS.map(function (lv, i) {
      var record = state.levels[i];
      var curves = (record && record.bestCurves && record.bestCurves.length)
        ? record.bestCurves
        : lv.target;
      var polylines = curves.map(sampleCurve);
      var total = 0;
      for (var k = 0; k < polylines.length; k++) total += polylines[k].length;
      return { theme: lv.theme, bbox: lv.bbox, polylines: polylines, total: total };
    });

    FINALE.hearts = [];
    for (var j = 0; j < 14; j++) {
      FINALE.hearts.push({
        x: Math.random(),
        offset: Math.random() * 900,
        speed: 10 + Math.random() * 22,
        size: 7 + Math.random() * 7,
        alpha: 0.05 + Math.random() * 0.10,
        wobble: 0.6 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function updateFinaleNote() {
    var note = document.getElementById('finaleNote');
    if (!note) return;
    var totalStars = 0;
    state.levels.forEach(function (rec) { totalStars += starsFor(rec.best); });
    note.textContent = 'L 反函数 · O 圆 · V 二次函数 · E 正弦 —— ' +
      totalStars + ' / ' + (LEVELS.length * 3) + ' 星';
  }

  function startFinale() {
    stopFinale();
    var reduced = false;
    try {
      reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      reduced = false;
    }
    if (reduced) {
      renderFinaleFrame(1e9);
      return;
    }
    FINALE.running = true;
    FINALE.start = (window.performance && window.performance.now)
      ? window.performance.now()
      : Date.now();
    var tick = function (now) {
      if (!FINALE.running) return;
      FINALE.time = now - FINALE.start;
      renderFinaleFrame(FINALE.time);
      FINALE.raf = window.requestAnimationFrame(tick);
    };
    FINALE.raf = window.requestAnimationFrame(tick);
  }

  function stopFinale() {
    FINALE.running = false;
    if (FINALE.raf) {
      window.cancelAnimationFrame(FINALE.raf);
      FINALE.raf = 0;
    }
  }

  function renderFinaleFrame(t) {
    var canvas = document.getElementById('finaleBoard');
    if (!canvas) return;
    if (!FINALE.letters) buildFinaleLetters();

    var host = canvas.parentNode;
    var cssW = Math.max(280, Math.floor((host && host.clientWidth) || 720));
    var cssH = Math.max(150, Math.round(cssW * 0.36));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var pxW = Math.round(cssW * dpr);
    var pxH = Math.round(cssH * dpr);

    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
    }

    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFinale(c, cssW, cssH, t);
  }

  function drawFinale(c, w, h, t) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#fbfafc';
    c.fillRect(0, 0, w, h);

    var letters = FINALE.letters || [];
    var timing = FINALE.timing;
    var slotW = w / LEVELS.length;
    var pad = Math.max(8, w * 0.018);
    var artTop = Math.round(h * 0.03);
    var artH = Math.round(h * 0.66);
    var artCy = artTop + artH / 2;
    var labelY = artTop + artH + Math.round(h * 0.05);
    var taglineY = Math.round(h * 0.905);
    // 四个字母统一高度，像排版一样对齐
    var commonH = Math.max(40, Math.min(artH - pad * 2, slotW - pad * 2));

    // 背景里慢慢飘起来的小爱心
    drawFinaleHearts(c, w, h, t);

    var easeOut = function (v) { return 1 - Math.pow(1 - v, 3); };

    for (var i = 0; i < letters.length; i++) {
      var lt = letters[i];
      var raw = (t - i * timing.stagger) / timing.draw;
      var progress = raw <= 0 ? 0 : (raw >= 1 ? 1 : easeOut(raw));

      var bw = lt.bbox.x1 - lt.bbox.x0;
      var bh = lt.bbox.y1 - lt.bbox.y0;
      var scale = Math.min((slotW - pad * 2) / bw, commonH / bh);
      if (!isFinite(scale) || scale <= 0) continue;

      var cx = i * slotW + slotW / 2;
      var cy = artCy;
      var worldCx = lt.bbox.x0 + bw / 2;
      var worldCy = lt.bbox.y0 + bh / 2;

      // 已经画出来的部分（按采样点顺序逐笔出现）
      var budget = Math.round(progress * lt.total);
      var penX = 0;
      var penY = 0;
      var penOn = false;

      c.save();
      c.translate(cx, cy);
      c.scale(scale, -scale);
      c.translate(-worldCx, -worldCy);
      c.beginPath();
      c.rect(lt.bbox.x0, lt.bbox.y0, bw, bh);
      c.clip();
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#e11d48';
      c.lineWidth = 5.2 / scale;
      c.shadowColor = 'rgba(225, 29, 72, 0.18)';
      c.shadowBlur = 10 / scale;

      for (var k = 0; k < lt.polylines.length && budget > 0; k++) {
        var pts = lt.polylines[k];
        var n = Math.min(pts.length, budget);
        if (n > 1) {
          c.beginPath();
          c.moveTo(pts[0][0], pts[0][1]);
          for (var m = 1; m < n; m++) c.lineTo(pts[m][0], pts[m][1]);
          c.stroke();
          penX = pts[n - 1][0];
          penY = pts[n - 1][1];
          penOn = true;
        }
        budget -= n;
      }
      c.restore();

      // 正在画的位置点一颗小圆点，像笔尖
      if (penOn && progress > 0 && progress < 1) {
        var dotX = cx + (penX - worldCx) * scale;
        var dotY = cy - (penY - worldCy) * scale;
        c.save();
        c.shadowColor = 'rgba(225, 29, 72, 0.5)';
        c.shadowBlur = 8;
        c.fillStyle = '#e11d48';
        c.beginPath();
        c.arc(dotX, dotY, 3.6, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      // 字母下面的小字
      var labelAlpha = Math.max(0, Math.min(1, (t - (i * timing.stagger + timing.draw)) / 420));
      if (labelAlpha > 0) {
        c.globalAlpha = labelAlpha * 0.9;
        c.fillStyle = '#c4ccd9';
        c.font = Math.round(Math.max(9, Math.min(12, slotW * 0.052))) +
          'px "Segoe UI", "PingFang SC", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(lt.theme, cx, labelY);
        c.globalAlpha = 1;
      }
    }

    // 收尾那句话
    var tagAlpha = Math.max(0, Math.min(1, (t - timing.taglineStart) / timing.taglineFade));
    if (tagAlpha > 0) drawFinaleTagline(c, w, taglineY, tagAlpha, t);
  }

  function drawFinaleHearts(c, w, h, t) {
    if (!FINALE.hearts) return;
    var elapsed = Math.max(0, (t - FINALE.timing.heartsStart) / 1000);
    if (elapsed <= 0) return;
    var fade = Math.min(1, elapsed / 1.2);

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#e11d48';
    for (var i = 0; i < FINALE.hearts.length; i++) {
      var p = FINALE.hearts[i];
      var y = h + 30 - ((p.offset + p.speed * elapsed) % (h + 60));
      var x = p.x * w + Math.sin(elapsed * p.wobble + p.phase) * 14;
      c.globalAlpha = p.alpha * fade;
      c.font = Math.round(p.size) + 'px Georgia, "Times New Roman", serif';
      c.fillText('♥', x, y);
    }
    c.restore();
  }

  function drawFinaleTagline(c, w, y, alpha, t) {
    var text = FINALE.tagline;
    var fontSize = Math.round(Math.max(11, Math.min(16, w * 0.019)));
    c.save();
    c.globalAlpha = alpha;
    c.font = 'italic ' + fontSize + 'px Georgia, "Times New Roman", "Songti SC", serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';

    var tw = 0;
    try { tw = c.measureText(text).width; } catch (e) { tw = text.length * fontSize * 0.52; }
    var heartSize = fontSize + 2;
    var gap = Math.round(fontSize * 0.6);
    var totalW = tw + gap + heartSize;
    var x0 = Math.max(10, (w - totalW) / 2);

    c.fillStyle = '#a9b1bd';
    c.fillText(text, x0, y);

    var pulse = 0.62 + 0.38 * Math.sin(t / 380);
    c.globalAlpha = alpha * pulse;
    c.fillStyle = '#e11d48';
    c.font = heartSize + 'px Georgia, "Times New Roman", serif';
    c.fillText('♥', x0 + tw + gap, y + 0.5);
    c.restore();
  }

  function saveLoveImage() {
    try {
      if (!FINALE.letters) buildFinaleLetters();
      var W = 1600;
      var H = Math.round(W * 0.36);
      var off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      var c = off.getContext('2d');
      // 传一个很大的 t：字母和那句话都画完，只留下飘着的爱心
      drawFinale(c, W, H, 1e9);

      var url = off.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'LOVE-functions.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('已保存这张 LOVE');
    } catch (e) {
      showToast('保存失败，可以试试截图或右键另存');
    }
  }


  // ============================================================
  // 重置
  // ============================================================

  function resetAll() {
    state = freshState();
    state.curves = [];
    state.selected = -1;
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    var hint = $('#hintBox');
    if (hint) hint.open = false;
    renderAll();
    resizeBoard();
    showToast('已重置，从 L 重新开始');
  }

  // ============================================================
  // 事件绑定 & 初始化
  // ============================================================

  function bindEvents() {
    var helpBtn = $('#btnHelp');
    if (helpBtn) helpBtn.addEventListener('click', function () { openModal('helpModal'); });

    var resetBtn = $('#btnReset');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (window.confirm('确定要重置所有进度和已画的曲线吗？')) resetAll();
    });

    var saveBtn = $('#btnSaveLove');
    if (saveBtn) saveBtn.addEventListener('click', saveLoveImage);

    var replayBtn = $('#btnReplay');
    if (replayBtn) replayBtn.addEventListener('click', function () {
      closeModal('finaleModal');
      resetAll();
    });

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      var closer = target && target.closest ? target.closest('[data-close]') : null;
      if (closer) {
        closeModal(closer.getAttribute('data-close'));
        return;
      }
      if (target && target.classList && target.classList.contains('modal')) {
        closeModal(target.id);
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        closeModal('helpModal');
        closeModal('finaleModal');
      }
    });

    window.addEventListener('resize', function () {
      var finale = document.getElementById('finaleModal');
      if (finale && finale.hidden === false) renderFinaleFrame(FINALE.time);
    });
  }

  function init() {
    board = document.getElementById('board');
    wrap = document.getElementById('boardWrap');
    if (!board || !wrap) return;
    ctx = board.getContext('2d');
    scoreVal = document.getElementById('scoreVal');
    scoreBox = document.getElementById('scoreBox');
    scoreEls = $$('#stars span');

    state = loadState();

    if (state.level > unlockedIndex()) state.level = 0;
    state.curves = cloneCurves(state.levels[state.level].curves);
    state.selected = state.curves.length ? state.curves.length - 1 : -1;

    renderPalette();
    renderAll();
    bindEvents();
    resizeBoard();

    if (window.ResizeObserver) {
      var ro = new window.ResizeObserver(function () { resizeBoard(); });
      ro.observe(wrap);
    }
    window.addEventListener('resize', resizeBoard);

    // 首次进入先讲规则
    if (!state.helpSeen) {
      setTimeout(function () { openModal('helpModal'); }, 350);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
