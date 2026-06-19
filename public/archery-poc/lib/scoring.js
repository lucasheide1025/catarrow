// scoring.js
// A/B 共用的計分規則。座標是「四角標記圍出的矩形」正規化後的 0..1 空間。
//
// 重點：標記若貼在「紙張四角」（安全、不會被射到），靶環就不在矩形正中央，
// 而且把矩形拉成單位正方形時，正圓會被壓成「軸對齊橢圓」（矩形→正方形是仿射，正圓必成橢圓）。
// 所以用橢圓參數 (cx,cy,rx,ry) 描述靶面，數學上才精準。
//
// targetGeometry 的值「量一次就固定」（印刷版面不變）；或用 camera 端「校準靶環」自動量。

export const targetGeometry = {
  cx: 0.46,  // 靶心在矩形中的水平位置（0..1）
  cy: 0.42,  // 垂直位置（靶心偏上，下方是空白區與小靶）
  rx: 0.46,  // 靶心到最外環(6分)的水平半徑
  ry: 0.30,  // 垂直半徑（比 rx 小，因為紙比靶高，圓被壓扁）
};

export function setTargetGeometry(g) { Object.assign(targetGeometry, g); }

// 正規化座標 → 分數。r = 橢圓正規化距離（環內 0..1）。
export function scoreFromNormalized(nx, ny, g = targetGeometry) {
  const r = Math.hypot((nx - g.cx) / g.rx, (ny - g.cy) / g.ry);
  if (r >= 1) return { score: 0, ring: "M", rNorm: r }; // 脫靶
  const ring = 10 - Math.floor(r * 5); // [0,0.2)→10 ... [0.8,1)→6
  return { score: ring, ring: String(ring), rNorm: r };
}

// entry point：兩端中「橢圓距離較小（較靠靶心）」者，即箭桿穿進紙的入點。
export function pickEntryPoint(a, b, g = targetGeometry) {
  const da = Math.hypot((a.x - g.cx) / g.rx, (a.y - g.cy) / g.ry);
  const db = Math.hypot((b.x - g.cx) / g.rx, (b.y - g.cy) / g.ry);
  return da <= db ? a : b;
}
