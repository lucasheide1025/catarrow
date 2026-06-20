// detector.js — 背景相減法偵測新出現的箭
// 支援 ROI（校準四角後只掃靶面內部），大幅減少背景雜訊干擾。

export class ArrowDetector {
  constructor(opts = {}) {
    this.diffThreshold = opts.diffThreshold ?? 28; // 灰階差值門檻（降低更敏感）
    this.minSize  = opts.minSize  ?? 40;           // 最少變動像素
    this.maxFrac  = opts.maxFrac  ?? 0.55;         // 變動超過此比例 → 整體光線變化，捨棄
    this.minRatio = opts.minRatio ?? 2.0;          // 長寬比門檻
    this.minSpan  = opts.minSpan  ?? 40;           // 端到端最少像素長度（濾掉光線/雜訊假陽性）
    this.ref = null;
    this.w = 0;
    this.h = 0;
    this.roi = null; // { x1, y1, x2, y2 }
    this._lastDebug = null; // 最後一次偵測的 debug 資訊
  }

  // 設定感興趣區域（校準四角後呼叫，只掃靶面內的像素）
  setROI(points) {
    // points: [{x,y}, ...] 可以是四角、或任意多邊形的頂點
    if (!points || points.length === 0) { this.roi = null; return; }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of points) {
      if (p.x < x1) x1 = p.x; if (p.x > x2) x2 = p.x;
      if (p.y < y1) y1 = p.y; if (p.y > y2) y2 = p.y;
    }
    this.roi = {
      x1: Math.max(0, Math.floor(x1) - 4),
      y1: Math.max(0, Math.floor(y1) - 4),
      x2: Math.min(this.w || 9999, Math.ceil(x2) + 4),
      y2: Math.min(this.h || 9999, Math.ceil(y2) + 4),
    };
  }

  clearROI() { this.roi = null; }

  getDebug() { return this._lastDebug; }

  _toGray(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    return gray;
  }

  setReference(imageData) {
    this.w = imageData.width;
    this.h = imageData.height;
    this.ref = this._toGray(imageData);
  }

  hasReference() { return !!this.ref; }

  // 回傳 null 或 { ends: [{x,y},{x,y}], size, ratio }
  detect(imageData) {
    if (!this.ref) return null;
    const cur = this._toGray(imageData);
    const w = this.w, h = this.h;
    const roi = this.roi;

    const xs = [], ys = [];
    let count = 0;
    let roiTotal = 0;

    if (roi) {
      // 只掃 ROI 內部
      for (let y = roi.y1; y <= roi.y2; y++) {
        for (let x = roi.x1; x <= roi.x2; x++) {
          roiTotal++;
          const p = y * w + x;
          if (Math.abs(cur[p] - this.ref[p]) > this.diffThreshold) {
            xs.push(x); ys.push(y); count++;
          }
        }
      }
    } else {
      roiTotal = w * h;
      for (let p = 0; p < roiTotal; p++) {
        if (Math.abs(cur[p] - this.ref[p]) > this.diffThreshold) {
          xs.push(p % w); ys.push((p / w) | 0); count++;
        }
      }
    }

    const frac = count / roiTotal;

    if (count < this.minSize) {
      this._lastDebug = { reason: "太少", count, frac: frac.toFixed(3) };
      return null;
    }
    if (frac > this.maxFrac) {
      this._lastDebug = { reason: "太多(光線)", count, frac: frac.toFixed(3) };
      return null;
    }

    // PCA：找主軸（箭的方向）
    let mx = 0, my = 0;
    for (let i = 0; i < count; i++) { mx += xs[i]; my += ys[i]; }
    mx /= count; my /= count;

    let a = 0, bb = 0, c = 0;
    for (let i = 0; i < count; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      a += dx * dx; bb += dx * dy; c += dy * dy;
    }
    a /= count; bb /= count; c /= count;

    const tr = a + c;
    const det = a * c - bb * bb;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    const ratio = l1 / (l2 + 1e-6);

    if (ratio < this.minRatio) {
      this._lastDebug = { reason: "不細長", count, frac: frac.toFixed(3), ratio: ratio.toFixed(1) };
      return null;
    }

    let dx, dy;
    if (Math.abs(bb) > 1e-6) {
      dx = bb; dy = l1 - a;
    } else {
      dx = a >= c ? 1 : 0; dy = a >= c ? 0 : 1;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    let tMin = Infinity, tMax = -Infinity;
    let pMin = null, pMax = null;
    for (let i = 0; i < count; i++) {
      const t = (xs[i] - mx) * dx + (ys[i] - my) * dy;
      if (t < tMin) { tMin = t; pMin = { x: xs[i], y: ys[i] }; }
      if (t > tMax) { tMax = t; pMax = { x: xs[i], y: ys[i] }; }
    }

    const span = tMax - tMin;
    this._lastDebug = { reason: span < this.minSpan ? "太短" : "OK", count, frac: frac.toFixed(3), ratio: ratio.toFixed(1), span: span.toFixed(0) };

    if (span < this.minSpan) return null;

    return { ends: [pMin, pMax], size: count, ratio, span };
  }
}
