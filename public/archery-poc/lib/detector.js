// detector.js
// 用「影像前後幀相減（frame differencing）」抓出新出現的箭，
// 再用 PCA 找出箭的兩端，回傳兩個端點交給上層判斷哪一端是 entry point。
//
// 為什麼不用 TensorFlow 物件偵測：現成模型沒有「箭」這個類別，要自己訓練太重。
// 靶面是靜止的，新出現的那支箭就是兩幀之間「變動的區域」，又輕又不用訓練。

export class ArrowDetector {
  constructor(opts = {}) {
    this.diffThreshold = opts.diffThreshold ?? 35; // 灰階差值門檻
    this.minSize = opts.minSize ?? 60;             // 最少變動像素（濾掉雜訊）
    this.maxFrac = opts.maxFrac ?? 0.45;           // 變動超過此比例 → 視為整體光線變化/有人經過，捨棄
    this.minRatio = opts.minRatio ?? 3.0;          // 長寬比門檻：箭是細長的，圓塊（人影）會被排除
    this.ref = null;                               // 背景參考幀（灰階）
    this.w = 0;
    this.h = 0;
  }

  _toGray(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // 感知亮度
      gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    return gray;
  }

  // 在「射手就位、尚未放箭」時呼叫，記錄乾淨背景
  setReference(imageData) {
    this.w = imageData.width;
    this.h = imageData.height;
    this.ref = this._toGray(imageData);
  }

  hasReference() {
    return !!this.ref;
  }

  // 回傳 null 或 { ends: [{x,y},{x,y}], size, ratio }
  detect(imageData) {
    if (!this.ref) return null;
    const cur = this._toGray(imageData);
    const w = this.w, h = this.h;
    const total = w * h;

    const xs = [];
    const ys = [];
    let count = 0;
    for (let p = 0; p < total; p++) {
      if (Math.abs(cur[p] - this.ref[p]) > this.diffThreshold) {
        xs.push(p % w);
        ys.push((p / w) | 0);
        count++;
      }
    }

    if (count < this.minSize) return null;
    if (count > total * this.maxFrac) return null; // 變動太大，不可信

    // 平均與共變異數矩陣
    let mx = 0, my = 0;
    for (let i = 0; i < count; i++) { mx += xs[i]; my += ys[i]; }
    mx /= count; my /= count;

    let a = 0, bb = 0, c = 0; // cov = [[a,bb],[bb,c]]
    for (let i = 0; i < count; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      a += dx * dx; bb += dx * dy; c += dy * dy;
    }
    a /= count; bb /= count; c /= count;

    // 2x2 對稱矩陣特徵值
    const tr = a + c;
    const det = a * c - bb * bb;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    const ratio = l1 / (l2 + 1e-6);
    if (ratio < this.minRatio) return null; // 不夠細長 → 不是箭

    // 主軸方向（對應 l1 的特徵向量）
    let dx, dy;
    if (Math.abs(bb) > 1e-6) {
      dx = bb; dy = l1 - a;
    } else {
      // 軸對齊
      dx = a >= c ? 1 : 0; dy = a >= c ? 0 : 1;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;

    // 投影到主軸，取最小/最大端點（即箭的兩端）
    let tMin = Infinity, tMax = -Infinity;
    let pMin = null, pMax = null;
    for (let i = 0; i < count; i++) {
      const t = (xs[i] - mx) * dx + (ys[i] - my) * dy;
      if (t < tMin) { tMin = t; pMin = { x: xs[i], y: ys[i] }; }
      if (t > tMax) { tMax = t; pMax = { x: xs[i], y: ys[i] }; }
    }

    return { ends: [pMin, pMax], size: count, ratio };
  }
}
