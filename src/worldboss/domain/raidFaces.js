// src/worldboss/domain/raidFaces.js
// 討伐用的靶紙選單。作者 2026-07-31：**只留四種，名稱不寫公分數**。
//
// 為什麼不直接用 lib/targetFace 的六種：那份是計分系統的完整清單（含 80cm 六環、
// 40cm 十環等比賽用規格），對討伐來說太雜。這裡只挑實際會用到的四種並改成好懂的名字，
// 底層仍然指到同一份 targetFace 格式（環數、內十環比例、尺寸都沿用，不重寫幾何）。

// mult＝靶紙倍率（作者 2026-07-31 直接指定，不再由尺寸推算）。
// maxArrowsPerFace＝每張靶最多吃幾箭的傷害；三連靶是 2（六箭必須 2/2/2 分完）。
export const RAID_FACES = Object.freeze([
  { id: "half_17",  label: "半靶",   faces: 1, mult: 1.0, maxArrowsPerFace: null, hint: "標準" },
  { id: "full_110", label: "全靶",   faces: 1, mult: 1.2, maxArrowsPerFace: null, hint: "×1.2" },
  { id: "field_16", label: "原野靶", faces: 1, mult: 1.4, maxArrowsPerFace: null, hint: "×1.4" },
  { id: "triple",   label: "三連靶", faces: 3, mult: 1.5, maxArrowsPerFace: 2,    hint: "×1.5・每張限 2 箭" },
]);

export const RAID_FACE_MAP = Object.freeze(
  Object.fromEntries(RAID_FACES.map(f => [f.id, f])),
);

export const DEFAULT_RAID_FACE = "half_17";

// 這個靶紙要畫幾張（三連靶 = 3）
export function faceCountOf(fmtId) {
  return RAID_FACE_MAP[fmtId]?.faces || 1;
}

export function raidFaceLabel(fmtId) {
  return RAID_FACE_MAP[fmtId]?.label || "靶紙";
}

// 靶紙倍率（乘在整箭傷害上）
export function faceMultiplier(fmtId) {
  return RAID_FACE_MAP[fmtId]?.mult ?? 1;
}

// 每張靶吃幾箭就滿了（null = 沒有上限）
export function maxArrowsPerFace(fmtId) {
  return RAID_FACE_MAP[fmtId]?.maxArrowsPerFace ?? null;
}
