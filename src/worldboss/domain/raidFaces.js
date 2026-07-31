// src/worldboss/domain/raidFaces.js
// 討伐用的靶紙選單。作者 2026-07-31：**只留四種，名稱不寫公分數**。
//
// 為什麼不直接用 lib/targetFace 的六種：那份是計分系統的完整清單（含 80cm 六環、
// 40cm 十環等比賽用規格），對討伐來說太雜。這裡只挑實際會用到的四種並改成好懂的名字，
// 底層仍然指到同一份 targetFace 格式（環數、內十環比例、尺寸都沿用，不重寫幾何）。

export const RAID_FACES = Object.freeze([
  { id: "half_17",  label: "半靶",   faces: 1, hint: "最常用" },
  { id: "full_110", label: "全靶",   faces: 1, hint: "十環大靶" },
  { id: "triple",   label: "三連靶", faces: 3, hint: "左 / 中 / 右 三張" },
  { id: "field_16", label: "原野靶", faces: 1, hint: "無尺寸，不給射程加成" },
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
