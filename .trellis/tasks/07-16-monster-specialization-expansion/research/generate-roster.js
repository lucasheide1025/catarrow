// C2 產生器（task-local research，不進 src、不 import 專案程式）
// 依 PRD 規則確定性生成 252 隻怪物名冊 + 材料目錄草案。
// 執行：node generate-roster.js  → 產出 monster-roster-draft.json / material-catalog-draft.json
//
// scheme 若要調整（例如 42-vs-60 落差、寶箱族映射），改本檔重跑即可，不必手改 JSON。

const fs = require("fs");
const path = require("path");

const TIERS = ["common", "rare", "elite", "fierce", "boss", "mythic"]; // idx 0..5 = T1..T6
const STAGE = ["見習", "初階", "精銳", "強權", "王階", "傳說"];        // 進化階段前綴（威勢遞增）

// 各族 T1..T6 的「1.0 錨點」數值（= 現有 {family}_{n} 一般怪，取自 monsterData.js）
const ANCHOR = {
  ghost:     [[250,20,14],[400,35,24],[650,55,40],[1000,82,68],[1600,125,105],[2500,175,155]],
  mountain:  [[270,18,15],[432,32,26],[702,51,43],[1080,75,73],[1728,115,113],[2700,161,167]],
  insect:    [[213,23,12],[340,40,20],[553,63,34],[850,94,58],[1360,144,89],[2125,201,132]],
  workplace: [[250,22,14],[400,38,24],[650,59,40],[1000,89,68],[1600,135,105],[2500,189,155]],
  exam:      [[238,19,13],[380,33,23],[618,52,38],[950,78,65],[1520,119,100],[2375,166,147]],
  temple:    [[263,21,15],[420,37,25],[683,58,42],[1050,86,71],[1680,131,110],[2625,184,163]],
  treasure:  [[100,5,15],[180,8,30],[280,12,50],[420,18,85],[650,25,130],[1000,35,190]],
};

// 現有一般怪中文名（1.0 錨點），用來衍生新怪名並保留識別
const ANCHOR_NAME = {
  ghost:     ["好兄弟","魔神仔","林投姐","城隍爺","十八王公","地獄閻羅"],
  mountain:  ["山豬精","百步蛇","山魈","霧社巨石精","食人巨熊","惡蛟"],
  insect:    ["蟑螂兵","虎頭蜂","蜈蚣精","蠍王","蛛后","蟲神"],
  workplace: ["實習生","主管","經理","總監","執行長","董事長"],
  exam:      ["小考","段考","模擬考","學測","指考","國考"],
  temple:    ["哥布林","獸人","食人魔","巨龍","惡魔","魔王"],
  treasure:  ["寶箱怪","黃金寶箱怪","鑽石寶箱怪","祕銀寶箱怪","遠古寶箱怪","神話寶箱巨像"],
};

// PRD 147 進化系譜基名：[小王線A, 小王線B, 大王線]
const LINEAGE = {
  ghost:     ["巡夜燈使","星霧影衛","鎮界靈將"],
  mountain:  ["石角守衛","森風獵手","雲嶺龍王"],
  insect:    ["甲衛騎士","毒翼斥候","萬翼蟲皇"],
  workplace: ["工坊監督","契約執行官","黃金契約王"],
  exam:      ["卷軸考官","算式守門員","試煉大賢者"],
  temple:    ["城堡先鋒","符文法衛","天穹龍皇"],
  treasure:  ["秘庫守衛","寶石魔偶","王冠寶庫王"],
};

const FAMILY_LABEL = { ghost:"鬼怪族", mountain:"山林族", insect:"毒蟲族", workplace:"職場族", exam:"考試族", temple:"西方怪物族", treasure:"寶箱族" };
const FAMILIES = Object.keys(ANCHOR);

const r = n => Math.round(n);
const mul = (a, m) => [r(a[0]*m[0]), r(a[1]*m[1]), r(a[2]*m[2])];

// PRD 59-61 數值公式
const M = {
  normalA: [0.8, 0.8, 0.8],
  normalB: [1.2, 1.2, 1.2],
  miniA:   [1.3, 1.5, 1.3],
  miniB:   [1.5, 1.3, 1.5],
  bigK:    [1.7, 1.5, 1.6],
};

// 寶箱族既有特殊 ID（必須保留），映射到 3+2+1 架構
const TREASURE_EXISTING = {
  normalExisting: n => `treasure_${n}`,            // 標準怪 = 1.0 錨點
  normalA:        n => `treasure_${n}_real`,       // 被動怪 = 一般怪A（atk:1，保留原數值）
  miniA:          n => `treasure_king_small_${n}`, // 現有小王 = 小王線A
  bigK:           n => `treasure_king_big_${n}`,   // 現有大王 = 大王線
};
// 被動寶箱怪保留原數值（atk:1），不套 0.8 公式
const TREASURE_REAL_STATS = [[80,1,20],[140,1,35],[220,1,60],[340,1,95],[500,1,150],[800,1,220]];

const monsters = [];
const materials = [];
const seenIds = new Set();
const seenMat = new Set();

function pushMonster(m) {
  if (seenIds.has(m.id)) throw new Error(`duplicate monster id: ${m.id}`);
  seenIds.add(m.id);
  monsters.push(m);
}
function pushMaterial(mat) {
  if (seenMat.has(mat.id)) return; // 同族同 tier 共用時去重
  seenMat.add(mat.id);
  materials.push(mat);
}

for (const fam of FAMILIES) {
  for (let t = 0; t < 6; t++) {
    const tier = TIERS[t];
    const n = t + 1;
    const anchor = ANCHOR[fam][t];
    const isTreasure = fam === "treasure";

    // ── 3 一般怪 ──
    const normals = [
      { role:"normalA", idNew:`${fam}_${n}_na`, stats: mul(anchor, M.normalA), name:`${ANCHOR_NAME[fam][t]}·幼`, mult:0.8 },
      { role:"normalExisting", idNew:`${fam}_${n}`, stats: anchor, name: ANCHOR_NAME[fam][t], mult:1.0, existing:true },
      { role:"normalB", idNew:`${fam}_${n}_nb`, stats: mul(anchor, M.normalB), name:`${ANCHOR_NAME[fam][t]}·猛`, mult:1.2 },
    ];
    // 寶箱族特殊映射
    if (isTreasure) {
      normals[0].idNew = TREASURE_EXISTING.normalA(n);
      normals[0].stats = TREASURE_REAL_STATS[t];
      normals[0].name = `安分${ANCHOR_NAME[fam][t]}`;
      normals[0].existing = true;
      normals[0].passive = true;
      normals[1].idNew = TREASURE_EXISTING.normalExisting(n);
    }
    for (let i = 0; i < normals.length; i++) {
      const nm = normals[i];
      const matId = i === 1 ? `${fam}_m${n}` : `${fam}_m${n}_${i === 0 ? "a" : "b"}`; // 中間=既有材料
      pushMonster({
        id: nm.idNew, family: fam, familyLabel: FAMILY_LABEL[fam], tier, tierIndex: n,
        encounter: "normal", roleTag: nm.role, name: nm.name,
        hp: nm.stats[0], atk: nm.stats[1], def: nm.stats[2],
        statMult: nm.mult, passive: !!nm.passive, existing: !!nm.existing,
        sharedSkills: ["<C3:shared×1>"], signatureSkill: `sig_${nm.idNew}`,
        materialId: matId, cardId: nm.idNew, artKey: nm.idNew,
        desc: `${FAMILY_LABEL[fam]}${TIERS[t]}階一般怪（${nm.role}）。`,
      });
      pushMaterial({ id: matId, family: fam, tier, tierIndex: n, kind: "normal", convertible: true,
        name: `${nm.name}素材`, forMonster: nm.idNew });
    }

    // ── 2 小王 ──
    const minis = [
      { role:"miniA", idNew:`${fam}_${n}_ma`, stats: mul(anchor, M.miniA), base: LINEAGE[fam][0] },
      { role:"miniB", idNew:`${fam}_${n}_mb`, stats: mul(anchor, M.miniB), base: LINEAGE[fam][1] },
    ];
    if (isTreasure) minis[0].idNew = TREASURE_EXISTING.miniA(n), minis[0].existing = true;
    for (const mn of minis) {
      const matId = `${fam}_km${n}_${mn.role === "miniA" ? "a" : "b"}`;
      pushMonster({
        id: mn.idNew, family: fam, familyLabel: FAMILY_LABEL[fam], tier, tierIndex: n,
        encounter: "miniBoss", roleTag: mn.role, name: `${STAGE[t]}·${mn.base}`, lineage: mn.base,
        hp: mn.stats[0], atk: mn.stats[1], def: mn.stats[2], isKing: true, existing: !!mn.existing,
        sharedSkills: ["<C3:shared×2>"], signatureSkill: `sig_${mn.idNew}`,
        materialId: matId, cardId: mn.idNew, artKey: mn.idNew,
        desc: `${FAMILY_LABEL[fam]}${mn.base}進化線第${n}階（小王）。`,
      });
      pushMaterial({ id: matId, family: fam, tier, tierIndex: n, kind: "miniBoss", convertible: false,
        name: `${mn.base}之印·${STAGE[t]}`, forMonster: mn.idNew });
    }

    // ── 1 大王 ──
    const bigId = isTreasure ? TREASURE_EXISTING.bigK(n) : `${fam}_${n}_bk`;
    const bstats = mul(anchor, M.bigK);
    const bmat = `${fam}_bm${n}`;
    pushMonster({
      id: bigId, family: fam, familyLabel: FAMILY_LABEL[fam], tier, tierIndex: n,
      encounter: "bigBoss", roleTag: "bigK", name: `${STAGE[t]}·${LINEAGE[fam][2]}`, lineage: LINEAGE[fam][2],
      hp: bstats[0], atk: bstats[1], def: bstats[2], isKing: true, existing: isTreasure,
      sharedSkills: ["<C3:shared×2>"], signatureSkill: `sig_${bigId}`, phasePassive: "<C3:phase>",
      materialId: bmat, cardId: bigId, artKey: bigId,
      desc: `${FAMILY_LABEL[fam]}${LINEAGE[fam][2]}進化線第${n}階（大王）。`,
    });
    pushMaterial({ id: bmat, family: fam, tier, tierIndex: n, kind: "bigBoss", convertible: false,
      name: `${LINEAGE[fam][2]}之核·${STAGE[t]}`, forMonster: bigId });
  }
}

// ── 完整性驗證 ──
const errors = [];
if (monsters.length !== 252) errors.push(`怪物總數 ${monsters.length} ≠ 252`);
const byEnc = monsters.reduce((a, m) => (a[m.encounter] = (a[m.encounter]||0)+1, a), {});
if (byEnc.normal !== 126) errors.push(`一般怪 ${byEnc.normal} ≠ 126`);
if (byEnc.miniBoss !== 84) errors.push(`小王 ${byEnc.miniBoss} ≠ 84`);
if (byEnc.bigBoss !== 42) errors.push(`大王 ${byEnc.bigBoss} ≠ 42`);
const existingCount = monsters.filter(m => m.existing).length;
// 交叉引用：每怪的 materialId 必須存在於 materials
const matIds = new Set(materials.map(m => m.id));
for (const m of monsters) if (!matIds.has(m.materialId)) errors.push(`${m.id} 的 materialId ${m.materialId} 不存在`);

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, "monster-roster-draft.json"), JSON.stringify(monsters, null, 2));
fs.writeFileSync(path.join(outDir, "material-catalog-draft.json"), JSON.stringify(materials, null, 2));

console.log("=== C2 產生結果 ===");
console.log(`怪物：${monsters.length}（一般 ${byEnc.normal} / 小王 ${byEnc.miniBoss} / 大王 ${byEnc.bigBoss}）`);
console.log(`材料：${materials.length}（一般 ${materials.filter(m=>m.kind==="normal").length} / 小王 ${materials.filter(m=>m.kind==="miniBoss").length} / 大王 ${materials.filter(m=>m.kind==="bigBoss").length}）`);
console.log(`標記 existing（保留舊 ID）：${existingCount}`);
console.log(`唯一怪物 ID：${seenIds.size}，唯一材料 ID：${seenMat.size}`);
console.log(errors.length ? `❌ 驗證失敗:\n- ${errors.join("\n- ")}` : "✅ 完整性驗證通過（數量/唯一/交叉引用）");
