// src/worldboss/domain/weakPoints.js
// ─────────────────────────────────────────────────────────────
// 弱點＝**靶面上的彩色落點圈**（作者 2026-07-31 定案，取代原本的眼/心/腿/尾）。
//
// 為什麼改：用身體部位當弱點時，「宣告哪個部位」得靠一條分數門檻判定，
// 而門檻跟落點位置是兩套語言——高門檻部位（要射得靠中心）跟方位區（要射得偏一邊）
// 甚至互相矛盾（實測「宣告眼」永遠比「宣告尾」還虧）。
// 改用「圈」之後，**大小就是難度、顏色就是報酬**，一眼看懂，
// 而且命中率可以直接從半徑算出來，平衡不再是猜的。
//
// 每回合只出現 1~2 個圈、位置隨機。玩家看著靶面上的圈射——這才是真的在練指定目標。
//
// ⚠️ 弱點傷害仍然**不乘玩家攻擊力**，是王最大血量的固定比例。
//    只要傷害是 ATK 的函數，不管怎麼包裝，114 級的一箭就是抵新手五十箭。
// ─────────────────────────────────────────────────────────────

// radius 是靶面半徑的比例（1.0 ＝ 靶紙邊緣）。
//
// ⚠️ **這是中性的戰鬥模型**：越小的圈越難打、傷害與破防都越高，就這樣。
//    這裡**不做**任何「壓縮新老玩家差距」的手腳——作者 2026-07-31 明確指示：
//    戰鬥模型保持標準，新手的補償放到外面做（見 raidRookie.js，50 級以下）。
//    把補償塞進戰鬥數值裡會讓數字失去意義，也沒人看得懂為什麼紅點破防比綠點少。
export const WEAK_SPOTS = Object.freeze([
  {
    id: "green", name: "綠點", icon: "🟢", color: "#4ade80",
    radius: 0.38, dmgPct: 0.0008, breakPoints: 1,
    desc: "最大最好打",
  },
  {
    id: "yellow", name: "黃點", icon: "🟡", color: "#fbbf24",
    radius: 0.28, dmgPct: 0.0015, breakPoints: 1,
    desc: "穩定的主力",
  },
  {
    id: "orange", name: "橙點", icon: "🟠", color: "#fb923c",
    radius: 0.19, dmgPct: 0.0028, breakPoints: 2,
    desc: "要準才咬得住",
  },
  {
    id: "red", name: "紅點", icon: "🔴", color: "#f87171",
    radius: 0.12, dmgPct: 0.0050, breakPoints: 3,
    desc: "最小最痛，還會削弱牠的強攻",
    weakensUlt: true,
  },
]);

export const WEAK_SPOT_MAP = Object.freeze(
  Object.fromEntries(WEAK_SPOTS.map(s => [s.id, s])),
);

// 情境倍率（乘在固定傷害上，不碰一般傷害）
export const CHARGE_EXPOSED_BONUS = 1.5;  // 蓄力回合：牠專心充能，弱點外露
export const STAGGER_BONUS        = 2.0;  // 打斷後的硬直回合
export const BULLSEYE_BONUS       = 1.25;

// ⚠️ 2026-07-31 作者指示：**不要**做「同一個圈重複打會遞減」。
//    打到就是打到，一支箭一份報酬——遞減會讓玩家算不出自己這箭值多少。  // 射進圈心一半的範圍：再賞一層

export function ratioOf(nx, ny) {
  if (nx == null || ny == null) return null;
  const x = Number(nx), y = Number(ny);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.sqrt(x * x + y * y);
}

/**
 * 抽這一回合的弱點圈。
 *
 * 規則（作者定案）：每回合 1~2 個、出現在靶面裡。
 * 位置隨機但**整個圈都要在靶紙內**，否則會出現「有一半在靶外、根本射不滿」的圈。
 * 兩個圈時強制一大一小——不然新手可能整回合碰不到，老手也少了取捨。
 */
/**
 * 🏆 比賽模式的弱點：**固定在正中心，不會跳來跳去**（作者 2026-08-01）。
 *
 * ⚠️ 這剛好就是射箭的真實規則——靶心（X／10 環）本來就是最該打的地方。
 *    比賽當天讓圈四處亂跑，選手會去追圈而不是照自己的動作射，
 *    那會直接傷害成績。
 *
 * 兩個同心圈：黃（大）＋紅（小）。`hitSpot` 取最小的那個，
 * 所以中 X ＝紅、中 9~10 ＝黃，跟環數一一對應。
 */
export function centerWeakSpots({ faceCount = 1 } = {}) {
  const out = [];
  for (let f = 0; f < faceCount; f += 1) {
    out.push(
      { ...WEAK_SPOT_MAP.yellow, cx: 0, cy: 0, faceIndex: f, key: `c-y-${f}` },
      { ...WEAK_SPOT_MAP.red, cx: 0, cy: 0, faceIndex: f, key: `c-r-${f}` },
    );
  }
  return out;
}

export function rollWeakSpots({ rand = Math.random, round = 1, phaseId = 1, faceCount = 1, fixedCenter = false } = {}) {
  if (fixedCenter) return centerWeakSpots({ faceCount });
  const count = rand() < 0.45 ? 1 : 2;
  const big = WEAK_SPOTS.slice(0, 2);     // 綠 / 黃
  const small = WEAK_SPOTS.slice(2);      // 橙 / 紅
  // 階段越後面，小圈越容易出現（後段更吃準度）
  const smallBias = phaseId >= 3 ? 0.65 : phaseId === 2 ? 0.5 : 0.4;

  const picked = count === 1
    ? [rand() < smallBias ? small[Math.floor(rand() * small.length)] : big[Math.floor(rand() * big.length)]]
    : [big[Math.floor(rand() * big.length)], small[Math.floor(rand() * small.length)]];

  const placed = [];
  for (const spot of picked) {
    // 多張靶時不必檢查跨靶重疊——不同張本來就不會撞在一起
    // 圈心可以放的最大半徑：扣掉圈自己的半徑，整個圈才會在紙上
    const maxR = Math.max(0, 1 - spot.radius - 0.02);
    let pos = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * maxR;       // sqrt 讓分佈在圓面上均勻
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      // 不要跟已放的圈重疊，否則一箭吃兩個
      const clash = placed.some(p => Math.hypot(p.cx - cx, p.cy - cy) < p.radius + spot.radius + 0.04);
      if (!clash) { pos = { cx, cy }; break; }
    }
    if (pos) {
      // 三連靶時每個圈還要記自己在左/中/右哪一張上（單靶恆為 0）
      const faceIndex = faceCount > 1 ? Math.floor(rand() * faceCount) : 0;
      placed.push({ ...spot, cx: pos.cx, cy: pos.cy, faceIndex, key: `${round}-${spot.id}` });
    }
  }
  return placed;
}

/**
 * 一支箭打到哪個圈。
 * 圈重疊時取「最難的那個」（半徑最小）——玩家該拿到他真正達成的那一層。
 */
export function hitSpot(spots = [], nx, ny, faceIndex = 0) {
  if (nx == null || ny == null) return null;
  const face = Math.max(0, Math.floor(Number(faceIndex) || 0));
  const inside = spots.filter(s =>
    (s.faceIndex || 0) === face && Math.hypot(nx - s.cx, ny - s.cy) <= s.radius);
  if (!inside.length) return null;
  return inside.reduce((best, s) => (s.radius < best.radius ? s : best));
}

/**
 * 單箭結算。
 *
 * normalMult 給呼叫端乘在「一般傷害」（ATK 公式）上：
 *   打中圈／只是上靶 → 1；脫靶 → 0。
 * 沒有「擦過懲罰」了——圈就是圈，射不中就是沒有加成，不必再多罰一層。
 */
export function resolveWeakPointHit({
  spots = [],
  nx = null,
  ny = null,
  faceIndex = 0,          // 三連靶：射在左/中/右哪一張
  bossMaxHp = 0,
  charging = false,
  staggered = false,
} = {}) {
  const ratio = ratioOf(nx, ny);
  const bonuses = [];

  // 脫靶：什麼都沒有
  if (ratio == null || ratio > 1) {
    return { spot: null, hit: false, missed: true, bullseye: false,
      flatDamage: 0, breakPoints: 0, weakensUlt: false, normalMult: 0, bonuses };
  }

  const spot = hitSpot(spots, nx, ny, faceIndex);
  if (!spot) {
    return { spot: null, hit: false, missed: false, bullseye: false,
      flatDamage: 0, breakPoints: 0, weakensUlt: false, normalMult: 1, bonuses };
  }

  let mult = 1;
  if (charging)  { mult *= CHARGE_EXPOSED_BONUS; bonuses.push("charge"); }
  if (staggered) { mult *= STAGGER_BONUS;        bonuses.push("stagger"); }
  // 射進圈心一半的範圍＝更漂亮的一箭，再賞一層
  const bullseye = Math.hypot(nx - spot.cx, ny - spot.cy) <= spot.radius * 0.5;
  if (bullseye) { mult *= BULLSEYE_BONUS;        bonuses.push("bullseye"); }

  return {
    spot, hit: true, missed: false, bullseye,
    flatDamage: Math.max(1, Math.round((Number(bossMaxHp) || 0) * spot.dmgPct * mult)),
    // ⚠️ 正中只加傷害，**不加破防點數**——一場只有 30 箭，破防槽很容易灌爆
    breakPoints: spot.breakPoints,
    weakensUlt: !!spot.weakensUlt,
    normalMult: 1,
    bonuses,
  };
}

// 靶紙上的落點 → 標準環值（中心 10、邊緣 1、靶外 0）。
// 只用於顯示與紀錄；弱點判定看的是圈，不是環數。
// 為什麼需要它：貓小隊常用的 17cm 半靶只有 6~10 環，印在紙上的環數跨靶紙不能比。
export function standardScoreFromRatio(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r < 0) return 0;
  if (r > 1) return 0;
  return Math.max(1, Math.min(10, Math.ceil((1 - r) * 10) || 1));
}
