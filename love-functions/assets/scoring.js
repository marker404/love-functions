/*!
 * LOVE · 函数拼字 —— 曲线匹配打分
 * 纯 JavaScript，无依赖；浏览器里挂到 window.LoveScoring，Node 里可 require。
 *
 * 思路：
 *   1. 把「目标曲线」和「玩家曲线」分别栅格化成像素掩码；
 *   2. 用倒角距离变换（3-4 chamfer）算出每个像素到另一张掩码的距离；
 *   3. 覆盖率 coverage = 目标像素里有多少被玩家曲线覆盖（误差内）；
 *      精确率 precision = 玩家像素里有多少落在目标附近（误差内）；
 *   4. 两者取 F1 = 2·c·p / (c + p) 作为最终匹配度。
 * 这样既能防止曲线「画得偏」，也能防止「乱画一大片」蒙混过关。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoveScoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_OPTS = {
    size: 240,        // 栅格分辨率（正方形）
    thickness: 0.13,  // 描线粗细（世界坐标单位）
    tolerance: 0.17   // 允许的误差（世界坐标单位）
  };

  function merge() {
    var out = {};
    for (var i = 0; i < arguments.length; i++) {
      var src = arguments[i] || {};
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
    }
    return out;
  }

  function makeRaster(bbox, size) {
    var w = bbox.x1 - bbox.x0;
    var h = bbox.y1 - bbox.y0;
    var s = size / Math.max(w, h);          // 等比缩放，保证误差是圆的
    var ox = (size - w * s) / 2;
    var oy = (size - h * s) / 2;
    return {
      size: size,
      s: s,
      bbox: bbox,
      toX: function (x) { return ox + (x - bbox.x0) * s; },
      toY: function (y) { return oy + (bbox.y1 - y) * s; }
    };
  }

  function stamp(mask, size, cx, cy, r) {
    if (!isFinite(cx) || !isFinite(cy)) return;
    var x0 = Math.max(0, Math.floor(cx - r));
    var x1 = Math.min(size - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r));
    var y1 = Math.min(size - 1, Math.ceil(cy + r));
    var r2 = r * r;
    for (var y = y0; y <= y1; y++) {
      var dy = y - cy;
      var row = y * size;
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx;
        if (dx * dx + dy * dy <= r2) mask[row + x] = 1;
      }
    }
  }

  /** 把若干条折线（世界坐标）栅格化成 0/1 掩码 */
  function rasterize(polylines, raster, thickness) {
    var size = raster.size;
    var mask = new Uint8Array(size * size);
    var rad = Math.max(1, thickness * raster.s / 2);
    if (!polylines || !polylines.length) return mask;
    for (var i = 0; i < polylines.length; i++) {
      var pts = polylines[i];
      if (!pts) continue;
      for (var j = 0; j < pts.length; j++) {
        stamp(mask, size, raster.toX(pts[j][0]), raster.toY(pts[j][1]), rad);
      }
    }
    return mask;
  }

  /** 倒角距离变换，返回每个像素到最近掩码像素的距离（像素） */
  function distanceTransform(mask, size) {
    var INF = 1e9;
    var SQ2 = Math.SQRT2;
    var d = new Float32Array(size * size);
    var i;
    for (i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;

    var x, y, idx, v;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        idx = y * size + x;
        if (d[idx] === 0) continue;
        v = d[idx];
        if (x > 0 && d[idx - 1] + 1 < v) v = d[idx - 1] + 1;
        if (y > 0) {
          if (d[idx - size] + 1 < v) v = d[idx - size] + 1;
          if (x > 0 && d[idx - size - 1] + SQ2 < v) v = d[idx - size - 1] + SQ2;
          if (x < size - 1 && d[idx - size + 1] + SQ2 < v) v = d[idx - size + 1] + SQ2;
        }
        d[idx] = v;
      }
    }
    for (y = size - 1; y >= 0; y--) {
      for (x = size - 1; x >= 0; x--) {
        idx = y * size + x;
        v = d[idx];
        if (x < size - 1 && d[idx + 1] + 1 < v) v = d[idx + 1] + 1;
        if (y < size - 1) {
          if (d[idx + size] + 1 < v) v = d[idx + size] + 1;
          if (x < size - 1 && d[idx + size + 1] + SQ2 < v) v = d[idx + size + 1] + SQ2;
          if (x > 0 && d[idx + size - 1] + SQ2 < v) v = d[idx + size - 1] + SQ2;
        }
        d[idx] = v;
      }
    }
    return d;
  }

  function count(mask) {
    var n = 0;
    for (var i = 0; i < mask.length; i++) if (mask[i]) n++;
    return n;
  }

  /**
   * 创建一个针对某关目标曲线的打分器。
   * @param {Array<Array<[number, number]>>} targetPolylines 目标折线（世界坐标）
   * @param {{x0:number,x1:number,y0:number,y1:number}} bbox 打分区域（= 字母外框）
   * @param {{size?:number, thickness?:number, tolerance?:number}} options
   */
  function createScorer(targetPolylines, bbox, options) {
    var o = merge(DEFAULT_OPTS, options);
    var raster = makeRaster(bbox, o.size);
    var targetMask = rasterize(targetPolylines, raster, o.thickness);
    var targetDist = distanceTransform(targetMask, o.size);
    var targetCount = count(targetMask);
    var tolPx = o.tolerance * raster.s;

    return {
      options: o,
      bbox: bbox,
      /** 评估一组玩家折线，返回 0~1 的匹配度 */
      evaluate: function (playerPolylines) {
        var playerMask = rasterize(playerPolylines, raster, o.thickness);
        var playerDist = distanceTransform(playerMask, o.size);

        var covered = 0;
        var i;
        if (targetCount) {
          for (i = 0; i < targetMask.length; i++) {
            if (targetMask[i] && playerDist[i] <= tolPx) covered++;
          }
        }
        var playerCount = 0;
        var hit = 0;
        for (i = 0; i < playerMask.length; i++) {
          if (!playerMask[i]) continue;
          playerCount++;
          if (targetDist[i] <= tolPx) hit++;
        }

        var coverage = targetCount ? covered / targetCount : 0;
        var precision = playerCount ? hit / playerCount : 0;
        var score = (coverage + precision) > 0
          ? (2 * coverage * precision) / (coverage + precision)
          : 0;

        return {
          score: score,
          coverage: coverage,
          precision: precision
        };
      }
    };
  }

  return {
    createScorer: createScorer,
    defaults: DEFAULT_OPTS,
    // 导出内部函数，方便测试与调试
    _rasterize: rasterize,
    _distanceTransform: distanceTransform,
    _makeRaster: makeRaster
  };
});
