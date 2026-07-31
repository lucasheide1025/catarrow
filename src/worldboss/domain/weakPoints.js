// src/worldboss/domain/weakPoints.js
// ─────────────────────────────────────────────────────────────
// 宣告制弱點：射之前先選部位，每個部位有一條分數門檻，射完看有沒有兌現。
//
// 為什麼不沿用一般怪的部位系統（monsterData.BODY_PARTS）：那是「射完才隨機決定打到哪」，
// 玩家不做任何決定，換皮而已。這裡的判定是**決定性**的——分數 ≥ 門檻就是命中，不再擲骰，
// 玩家賭的是自己的穩定度，那正是射箭真正的技術。
//
// ⚠️ 最重要的一條：**弱點傷害不乘玩家攻擊力，而是王最大血量的固定比例。**
//    只要傷害是 ATK 的函數，不管怎麼包裝，114 級的一箭就是抵新手五十箭。
//    固定比例才能真的壓縮新老玩家的貢獻差距（見 worldBossBalance.test.js 的驗算）。
//
// 純函數，零 Firebase、零 React。
// ─────────────────────────────────────────────────────────────

export const WEAK_POINTS = Object.freeze([
  {
    id: "eye", name: "眼", icon: "👁️", color: "#f472b6",
    threshold: 9, dmgPct: 0.0015, breakPoints: 3,
    // 擦過的懲罰：高門檻部位賭失敗要有代價，否則所有人永遠宣告眼睛
    grazeMult: 0.5, effect: null,
    desc: "最痛，但要 9 分以上才咬得住",
  },
  {
    id: "heart", name: "心", icon: "🫀", color: "#f87171",
    threshold: 7, dmgPct: 0.0009, breakPoints: 2,
    grazeMult: 0.5, effect: null,
    desc: "穩定的主力輸出",
  },
  {
    id: "leg", name: "腿", icon: "🦵", color: "#fbbf24",
    threshold: 5, dmgPct: 0.00075, breakPoints: 2,
    grazeMult: 1, effect: "interrupt",
    desc: "打斷牠的蓄力——新手打得到、而且真的有用",
  },
  {
    id: "tail", name: "尾", icon: "🐉", color: "#4ade80",
    threshold: 3, dmgPct: 0.00045, breakPoints: 1,
    grazeMult: 1, effect: "weaken",
    desc: "削弱牠下一次強攻",
  },
]);

export const WEAK_POINT_MAP = Object.freeze(
  Object.fromEntries(WEAK_POINTS.map(p => [p.id, p])),
);

// 情境倍率。都是乘在「固定傷害」上，不碰一般傷害。
export const CHARGE_EXPOSED_BONUS = 1.5;  // 蓄力回合：牠專心充能，弱點外露
export const STAGGER_BONUS        = 2.0;  // 打斷後的硬直回合：全部位開放且加倍
export const QUADRANT_BONUS       = 1.5;  // 靶面模式命中正確方位（選配加碼）

// X 環當 10 分算。門檻只看數字，不看是不是 X——X 的獎勵走方位加碼那條路。
export function scoreOf(score, label) {
  if (label === "X") return 10;
  if (label === "M") return 0;
  const n = Math.floor(Number(score) || 0);
  return Math.max(0, n);
}

// 落點 → 幾點鐘方向（1~12）。nx/ny 是 targetFace.makeLandingRecord 存的正規化座標，
// ny 向下為正，所以要取負才是「上方＝12 點」。
export function clockOf(nx, ny) {
  // ⚠️ 一定要先擋 null/undefined：Number(null) === 0，按分數鍵的玩家（沒有座標）
  //    會被當成「正中心」而白拿方位加碼——方位必須是靶面模式獨有的。
  if (nx == null || ny == null || nx === "" || ny === "") return null;
  const x = Number(nx), y = Number(ny);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x === 0 && y === 0) return 12;
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;      // 0=正上，順時針為正
  const norm = (deg + 360) % 360;
  const hour = Math.round(norm / 30) || 12;
  return hour;
}

// 方位命中：允許 ±1 小時的容差（12 點跟 1 點是相鄰的，要繞回去算）
export function matchesQuadrant(nx, ny, weakClock) {
  const target = Math.floor(Number(weakClock) || 0);
  if (!target) return false;
  const hour = clockOf(nx, ny);
  if (!hour) return false;
  const diff = Math.abs(hour - target);
  return Math.min(diff, 12 - diff) <= 1;
}

/**
 * 單箭的弱點結算。
 *
 * 回傳的 normalMult 給呼叫端乘在「一般傷害」上（一般傷害仍走既有 ATK 公式）：
 *   命中 → 1（照常）＋ flatDamage
 *   擦過 → 部位的 grazeMult（眼/心 0.5，腿/尾 1）
 *   脫靶 → 0
 */
export function resolveWeakPointHit({
  declaredId,
  score,
  label = null,
  bossMaxHp = 0,
  blocked = [],          // 本階段被護住的部位
  charging = false,      // 王正在蓄力（弱點外露）
  staggered = false,     // 王被打斷後的硬直回合
  nx = null,
  ny = null,
  weakClock = null,      // 本場的方位弱點（靶面模式才有意義）
} = {}) {
  const effScore = scoreOf(score, label);
  const part = WEAK_POINT_MAP[declaredId] || null;
  const isBlocked = !!part && blocked.includes(part.id);
  const bonuses = [];

  // 脫靶：什麼都沒有
  if (effScore <= 0) {
    return {
      declared: part, part: null, hit: false, missed: true, grazed: false,
      blocked: isBlocked, flatDamage: 0, breakPoints: 0, effect: null,
      normalMult: 0, bonuses,
    };
  }

  // 沒宣告，或宣告了被護住的部位 → 只有一般傷害，沒有弱點收益
  if (!part || isBlocked) {
    return {
      declared: part, part: null, hit: false, missed: false, grazed: false,
      blocked: isBlocked, flatDamage: 0, breakPoints: 0, effect: null,
      normalMult: 1, bonuses,
    };
  }

  // 沒達標＝擦過。這是宣告制的代價，也是它成立的原因。
  if (effScore < part.threshold) {
    return {
      declared: part, part: null, hit: false, missed: false, grazed: true,
      blocked: false, flatDamage: 0, breakPoints: 0, effect: null,
      normalMult: part.grazeMult, bonuses,
    };
  }

  // 命中
  let mult = 1;
  if (charging)  { mult *= CHARGE_EXPOSED_BONUS; bonuses.push("charge"); }
  if (staggered) { mult *= STAGGER_BONUS;        bonuses.push("stagger"); }
  const quadrant = weakClock != null && matchesQuadrant(nx, ny, weakClock);
  if (quadrant)  { mult *= QUADRANT_BONUS;       bonuses.push("quadrant"); }

  const flatDamage = Math.max(1, Math.round((Number(bossMaxHp) || 0) * part.dmgPct * mult));

  return {
    declared: part, part, hit: true, missed: false, grazed: false, blocked: false,
    flatDamage,
    breakPoints: part.breakPoints + (quadrant ? 1 : 0),
    effect: part.effect,
    normalMult: 1,
    bonuses,
  };
}

// UI 用：本階段可宣告的部位（含被封鎖的，要畫成鎖鏈灰掉，玩家才看得到「規則變了」）
export function callableParts(blocked = []) {
  return WEAK_POINTS.map(p => ({ ...p, blocked: blocked.includes(p.id) }));
}
