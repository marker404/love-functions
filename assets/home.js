/*!
 * 070712 小站 —— 首页交互
 * 1) 年份
 * 2) 滚动淡入
 * 3) 首屏画布：用四条函数曲线依次写出 LOVE（循环播放）
 */
(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---------- 滚动淡入 ----------
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }, { threshold: 0.15 });
    for (var i = 0; i < reveals.length; i++) io.observe(reveals[i]);
  } else {
    for (var j = 0; j < reveals.length; j++) reveals[j].classList.add('in');
  }

  // ---------- 首屏画布 ----------
  var canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var host = canvas.parentNode;

  var reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {
    reduced = false;
  }

  function samplePoints(fn, from, to, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = from + (to - from) * i / n;
      var p = fn(t);
      if (isFinite(p[0]) && isFinite(p[1])) out.push(p);
    }
    return out;
  }

  var LETTERS = [
    {
      // L：反函数 y = a/(x−h) + v 的一支
      bbox: { x0: -2.85, x1: 2.85, y0: -3.35, y1: 4.45 },
      polylines: [samplePoints(function (x) {
        return [x, -3.2 + 0.8 / (x + 2.8)];
      }, -2.78, 2.85, 320)]
    },
    {
      // O：圆
      bbox: { x0: -2.95, x1: 2.95, y0: -2.95, y1: 2.95 },
      polylines: [samplePoints(function (t) {
        return [2.8 * Math.cos(t), 2.8 * Math.sin(t)];
      }, 0, Math.PI * 2, 360)]
    },
    {
      // V：二次函数
      bbox: { x0: -1.78, x1: 1.78, y0: -3.35, y1: 3.25 },
      polylines: [samplePoints(function (x) {
        return [x, -3.2 + 2.2 * x * x];
      }, -1.7, 1.7, 240)]
    },
    {
      // E：反过来的竖直正弦
      bbox: { x0: -2.3, x1: 2.3, y0: -3.3, y1: 3.3 },
      polylines: [samplePoints(function (y) {
        return [2.2 * Math.sin(1.93 * (y - 2.45)), y];
      }, -3.3, 3.3, 320)]
    }
  ];

  for (var k = 0; k < LETTERS.length; k++) {
    var total = 0;
    for (var m = 0; m < LETTERS[k].polylines.length; m++) total += LETTERS[k].polylines[m].length;
    LETTERS[k].total = total;
  }

  var size = { w: 0, h: 0, dpr: 0 };
  var CYCLE = 6800;
  var STAGGER = 350;
  var DRAW = 900;
  var FADE_START = 5600;
  var FADE_LEN = 700;

  var rafId = 0;
  var running = false;
  var startTime = 0;

  function layout() {
    var rect = host.getBoundingClientRect();
    var w = Math.max(220, Math.floor(rect.width));
    var h = Math.max(160, Math.floor(rect.height));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (size.w === w && size.h === h && size.dpr === dpr) return false;
    size.w = w;
    size.h = h;
    size.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function easeOut(v) { return 1 - Math.pow(1 - v, 3); }

  function draw(t) {
    if (!size.w) return;
    var w = size.w;
    var h = size.h;
    ctx.clearRect(0, 0, w, h);

    var pad = Math.max(10, w * 0.035);
    var slotW = (w - pad * 2) / 4;
    var available = h - pad * 2;
    var commonH = available;
    var i;

    // 四个字母统一高度，再按每格宽度收一下
    for (i = 0; i < LETTERS.length; i++) {
      var letter = LETTERS[i];
      var bw = letter.bbox.x1 - letter.bbox.x0;
      var bh = letter.bbox.y1 - letter.bbox.y0;
      var maxH = (slotW - 6) * bh / bw;
      if (maxH < commonH) commonH = maxH;
    }

    var fade = 1;
    if (t > FADE_START) {
      fade = Math.max(0, 1 - (t - FADE_START) / FADE_LEN);
    }

    for (i = 0; i < LETTERS.length; i++) {
      var L = LETTERS[i];
      var bw2 = L.bbox.x1 - L.bbox.x0;
      var bh2 = L.bbox.y1 - L.bbox.y0;
      var scale = commonH / bh2;
      var cx = pad + slotW * i + slotW / 2;
      var cy = h / 2;
      var worldCx = L.bbox.x0 + bw2 / 2;
      var worldCy = L.bbox.y0 + bh2 / 2;

      var raw = (t - i * STAGGER) / DRAW;
      var progress = raw <= 0 ? 0 : (raw >= 1 ? 1 : easeOut(raw));

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(cx, cy);
      ctx.scale(scale, -scale);
      ctx.translate(-worldCx, -worldCy);
      ctx.beginPath();
      ctx.rect(L.bbox.x0, L.bbox.y0, bw2, bh2);
      ctx.clip();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3.1 / scale;

      var budget = Math.round(progress * L.total);
      var penX = 0;
      var penY = 0;
      var penOn = false;

      for (var p = 0; p < L.polylines.length && budget > 0; p++) {
        var pts = L.polylines[p];
        var n = Math.min(pts.length, budget);
        if (n > 1) {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (var q = 1; q < n; q++) ctx.lineTo(pts[q][0], pts[q][1]);
          ctx.stroke();
          penX = pts[n - 1][0];
          penY = pts[n - 1][1];
          penOn = true;
        }
        budget -= n;
      }
      ctx.restore();

      // 笔尖小圆点
      if (penOn && progress > 0 && progress < 1) {
        var dotX = cx + (penX - worldCx) * scale;
        var dotY = cy - (penY - worldCy) * scale;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#e11d48';
        ctx.shadowColor = 'rgba(225, 29, 72, .45)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function frame(now) {
    if (!running) return;
    if (!startTime) startTime = now;
    draw((now - startTime) % CYCLE);
    rafId = window.requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || reduced) return;
    running = true;
    startTime = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function redrawOnce() {
    draw(3200);
  }

  layout();
  if (reduced) redrawOnce();
  else startLoop();

  if (window.ResizeObserver) {
    new window.ResizeObserver(function () {
      if (layout() && reduced) redrawOnce();
    }).observe(host);
  } else {
    window.addEventListener('resize', function () {
      if (layout() && reduced) redrawOnce();
    });
  }

  // 划出屏幕就暂停，省电
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting && !document.hidden) startLoop();
      else stopLoop();
    }, { threshold: 0.1 }).observe(host);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else startLoop();
  });
})();
