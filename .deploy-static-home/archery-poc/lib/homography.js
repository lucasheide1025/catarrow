// homography.js
// 四點透視校正：把「斜拍的靶面」數學上拉正回正面。
// 只負責「靶面平面」的還原；箭的立體凸出問題由 detector 抓 entry point 解決。

// 解 n 元線性方程組 A x = b（高斯消去 + 部分樞軸）
function solveLinear(A, b) {
  const n = b.length;
  // 建立增廣矩陣
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    // 部分樞軸：找該列絕對值最大者
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    if (Math.abs(d) < 1e-12) return null; // 退化：四點共線或重疊
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// src, dst: 各 4 個 {x,y}，順序需一致（建議 左上 → 右上 → 右下 → 左下）
// 回傳 3x3 homography（長度 9 的陣列），把 src 座標映射到 dst 座標。
export function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

// 套用 homography：把一個點映射過去
export function applyHomography(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / d,
    y: (H[3] * x + H[4] * y + H[5]) / d,
  };
}
