// src/lib/buffPool.js
// 報到 Buff 文案池
//
// power 欄位改為「百分比降幅範圍 [min, max]」
// 例如 [1, 5] 表示隨機降低目標分數 1%~5%
// tier: common / uncommon / rare / epic / legendary / mythic / ultimate
//
// 降幅對應稀有度：
//   common:    1~5%
//   uncommon:  1~10%
//   rare:      5~15%
//   epic:      5~25%
//   legendary: 10~40%
//   mythic:    25~50%
//   ultimate:  直接過關(999)

export const BUFF_POOL = [

  // ───────── common（1~5%）─────────
  { name: "加速術",     icon: "⚡", tier: "common",   power: [1, 5],   lines: ["教練對你施放了【加速術】", "你感覺精力充沛，動作變快了！"] },
  { name: "火屬性附魔", icon: "🔥", tier: "common",   power: [1, 5],   lines: ["你的箭尖浮現火屬性符紋", "命中時彷彿帶著灼熱的氣勢"] },
  { name: "貓之敏銳",   icon: "🐱", tier: "common",   power: [1, 5],   lines: ["貓神附體！", "你的眼神變得像貓一樣銳利"] },
  { name: "鋼鐵意志",   icon: "🛡️", tier: "common",   power: [1, 5],   lines: ["你進入了專注狀態", "雜念退散，只剩下靶心"] },
  { name: "深呼吸",     icon: "🌬️", tier: "common",   power: [1, 5],   lines: ["教練說：先深呼吸三次", "你的心跳慢了下來，穩了"] },
  { name: "幸運餅乾",   icon: "🥠", tier: "common",   power: [1, 5],   lines: ["你吃了一塊幸運餅乾", "籤詩寫著：今日宜中靶"] },
  { name: "早八的怨念", icon: "😩", tier: "common",   power: [1, 5],   lines: ["你想起昨天沒睡飽", "靠著一口氣硬撐住了準度"] },
  { name: "咖啡因加持", icon: "☕", tier: "common",   power: [1, 5],   lines: ["你灌了一口美式", "手不抖了（暫時）"] },
  { name: "貓咪監督",   icon: "🐈", tier: "common",   power: [1, 5],   lines: ["胖胖在旁邊盯著你", "你不敢射歪，怕被貓鄙視"] },
  { name: "微風助攻",   icon: "🍃", tier: "common",   power: [1, 5],   lines: ["一陣微風輕輕吹過", "風說：往左一點點"] },
  { name: "手感發燙",   icon: "🤚", tier: "common",   power: [1, 5],   lines: ["你今天手感不錯", "連自己都覺得有點帥"] },
  { name: "新手保護",   icon: "🔰", tier: "common",   power: [1, 5],   lines: ["系統啟動新手保護", "別怕，放輕鬆射就好"] },

  // ───────── uncommon（1~10%）─────────
  { name: "微幸運",     icon: "🍀", tier: "uncommon", power: [1, 10],  lines: ["幸運之神路過了一下", "你感覺今天稍微順一點"] },
  { name: "集中力覺醒", icon: "🎯", tier: "uncommon", power: [1, 10],  lines: ["你的集中力突然覺醒", "靶心在你眼中變大了一點"] },

  // ───────── rare（5~15%）─────────
  { name: "教練補刀",       icon: "🎯", tier: "rare",      power: [5, 15],  lines: ["教練從旁邊默默射了一箭", "「這支算你的。」教練說"] },
  { name: "二段加速",       icon: "💨", tier: "rare",      power: [5, 15],  lines: ["加速術疊到了第二層", "時間彷彿變慢，靶變大了"] },
  { name: "全集中·呼吸法",  icon: "🌊", tier: "rare",      power: [5, 15],  lines: ["你使出了全集中呼吸", "水面般平靜，箭隨心走"] },
  { name: "歐皇附身",       icon: "👑", tier: "rare",      power: [5, 15],  lines: ["歐皇之力降臨", "今天的你，運氣擋都擋不住"] },
  { name: "貓神祝福",       icon: "😺", tier: "rare",      power: [5, 15],  lines: ["寶寶、大娘、悠悠一起喵了一聲", "你獲得了貓神的集體祝福"] },
  { name: "鷹眼模式",       icon: "🦅", tier: "rare",      power: [5, 15],  lines: ["你開啟了鷹眼模式", "靶心在你眼中清晰無比"] },
  { name: "退役老兵的指點", icon: "🎖️", tier: "rare",      power: [5, 15],  lines: ["一位老射手拍了拍你的肩", "「放鬆，別跟箭過不去。」"] },
  { name: "限時加倍",       icon: "✨", tier: "rare",      power: [5, 15],  lines: ["命中判定範圍暫時放大", "這一輪，靶心對你特別寬容"] },

  // ───────── epic（5~25%）─────────
  { name: "教練的震怒",   icon: "💥", tier: "epic",      power: [5, 25],  lines: ["教練看不下去了！", "「我親自下場幫你！」全場加成"] },
  { name: "BUG級手感",    icon: "🐛", tier: "epic",      power: [5, 25],  lines: ["你進入了 BUG 狀態", "系統判定：這箭怎麼射都會中"] },
  { name: "時之術·緩",    icon: "⏳", tier: "epic",      power: [5, 25],  lines: ["時間流速降到 0.5 倍", "你有充足的時間瞄準"] },
  { name: "滿月之力",     icon: "🌕", tier: "epic",      power: [5, 25],  lines: ["今晚月色真美", "月光灑在你的箭上，指引方向"] },

  // ───────── legendary（10~40%）─────────
  { name: "命運之矢",     icon: "🌟", tier: "legendary", power: [10, 40], lines: ["傳說中的命運之矢降臨", "這支箭，注定要中靶心"] },
  { name: "神射手祝福",   icon: "🏹", tier: "legendary", power: [10, 40], lines: ["古代神射手的靈魂附體", "你感受到無數箭手的傳承"] },

  // ───────── mythic（25~50%）─────────
  { name: "神話·絕對命中", icon: "⚜️", tier: "mythic",   power: [25, 50], lines: ["神話之力覺醒！", "這一刻，你就是傳說本身"] },
  { name: "時空裂縫",      icon: "🌀", tier: "mythic",   power: [25, 50], lines: ["時空在你面前裂開", "你看到了所有可能的命中軌跡"] },

  // ───────── ultimate（保底大招，直接過關）─────────
  { name: "教練·完全治癒術", icon: "💖", tier: "ultimate", power: 999, lines: ["教練施展了【完全治癒術】", "「這關我罩你，過！」直接達標 🎉"] },
  { name: "貓小隊·全員出動", icon: "🐾", tier: "ultimate", power: 999, lines: ["哈吉、安仔、全員到齊！", "貓咪大隊幫你把箭叼上靶心，過關！"] },
];

// 依失敗次數決定抽取池（漸強保底）
export function drawBuff(failCount = 0) {
  let pool;
  if (failCount >= 5) {
    pool = BUFF_POOL.filter(b => b.tier === "ultimate");
  } else if (failCount >= 4) {
    pool = BUFF_POOL.filter(b => b.tier === "mythic" || b.tier === "legendary");
  } else if (failCount >= 3) {
    pool = BUFF_POOL.filter(b => b.tier === "epic" || b.tier === "legendary");
  } else if (failCount >= 2) {
    pool = BUFF_POOL.filter(b => b.tier === "epic" || b.tier === "rare");
  } else if (failCount >= 1) {
    pool = BUFF_POOL.filter(b => b.tier === "rare" || b.tier === "uncommon");
  } else {
    pool = BUFF_POOL.filter(b => b.tier === "common" || b.tier === "uncommon");
  }
  if (!pool.length) pool = BUFF_POOL;
  const buff = pool[Math.floor(Math.random() * pool.length)];
  // 計算實際降幅（power 是陣列就隨機，999 就是直接過關）
  const actualPower = Array.isArray(buff.power)
    ? Math.floor(Math.random() * (buff.power[1] - buff.power[0] + 1)) + buff.power[0]
    : buff.power;
  return { ...buff, actualPower };
}