// markers.js
// 用 js-aruco2 偵測靶角四張 ArUco 標記，自動算出 homography，取代手動點四角。
// 需先在頁面以 <script> 載入 js-aruco2 的 cv.js 與 aruco.js（會掛上 window.AR）。

import { computeHomography } from "./homography.js";

// 標記 ID 對應四角（與列印的標記紙一致）
const ID_TL = 0, ID_TR = 1, ID_BR = 2, ID_BL = 3;

function center(corners) {
  let x = 0, y = 0;
  for (const c of corners) { x += c.x; y += c.y; }
  return { x: x / corners.length, y: y / corners.length };
}

export class MarkerCalibrator {
  constructor(opts = {}) {
    if (!window.AR) throw new Error("js-aruco2 尚未載入（缺 window.AR）");
    this.detector = new window.AR.Detector({
      dictionaryName: opts.dictionaryName || "ARUCO_MIP_36h12",
    });
  }

  // 傳入一張 ImageData。
  // 四角都找到 → { ok:true, H, src:[4個角點] }
  // 還沒湊齊   → { ok:false, found:[目前看到的 id...] }
  calibrate(imageData) {
    const markers = this.detector.detect(imageData); // [{id, corners:[{x,y}*4]}...]
    const byId = {};
    for (const m of markers) byId[m.id] = m;

    const need = [ID_TL, ID_TR, ID_BR, ID_BL];
    if (!need.every((id) => byId[id])) {
      return { ok: false, found: markers.map((m) => m.id) };
    }

    const src = need.map((id) => center(byId[id].corners));
    const dst = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const H = computeHomography(src, dst);
    return H ? { ok: true, H, src } : { ok: false, found: need };
  }
}
