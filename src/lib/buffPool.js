// src/lib/buffPool.js
// 報到 Buff 文案池 —— 遊戲梗 / 生活梗 / 時事梗
// 之後要加：直接往陣列裡加物件即可（或日後做後台新增介面）
//
// 欄位說明：
//   name   Buff 名稱
//   icon   圖標 emoji
//   lines  演出台詞（會逐行跳出，第一行通常是「教練施法」感）
//   tier   稀有度：common(常見) / rare(稀有) / epic(史詩) —— 漸強保底時用
//   power  降門檻強度（today task 目標分數 -power，或容錯 +power）；保底大招用 999=直接過關

export const BUFF_POOL = [

  // ───────── 常見 common（降一點點，趣味為主）─────────
  { name: "加速術",     icon: "⚡", tier: "common", power: 1, lines: ["教練對你施放了【加速術】", "你感覺精力充沛，動作變快了！"] },
  { name: "火屬性附魔", icon: "🔥", tier: "common", power: 1, lines: ["你的箭尖浮現火屬性符紋", "命中時彷彿帶著灼熱的氣勢"] },
  { name: "貓之敏銳",   icon: "🐱", tier: "common", power: 1, lines: ["貓神附體！", "你的眼神變得像貓一樣銳利"] },
  { name: "鋼鐵意志",   icon: "🛡️", tier: "common", power: 1, lines: ["你進入了專注狀態", "雜念退散，只剩下靶心"] },
  { name: "深呼吸",     icon: "🌬️", tier: "common", power: 1, lines: ["教練說：先深呼吸三次", "你的心跳慢了下來，穩了"] },
  { name: "幸運餅乾",   icon: "🥠", tier: "common", power: 1, lines: ["你吃了一塊幸運餅乾", "籤詩寫著：今日宜中靶"] },
  { name: "早八的怨念", icon: "😩", tier: "common", power: 1, lines: ["你想起昨天沒睡飽", "靠著一口氣硬撐住了準度"] },
  { name: "咖啡因加持", icon: "☕", tier: "common", power: 1, lines: ["你灌了一口美式", "手不抖了（暫時）"] },
  { name: "貓咪監督",   icon: "🐈", tier: "common", power: 1, lines: ["胖胖在旁邊盯著你", "你不敢射歪，怕被貓鄙視"] },
  { name: "微風助攻",   icon: "🍃", tier: "common", power: 1, lines: ["一陣微風輕輕吹過", "風說：往左一點點"] },
  { name: "手感發燙",   icon: "🤚", tier: "common", power: 1, lines: ["你今天手感不錯", "連自己都覺得有點帥"] },
  { name: "新手保護",   icon: "🔰", tier: "common", power: 1, lines: ["系統啟動新手保護", "別怕，放輕鬆射就好"] },

  // ───────── 稀有 rare（降中等）─────────
  { name: "教練補刀",       icon: "🎯", tier: "rare", power: 2, lines: ["教練從旁邊默默射了一箭", "「這支算你的。」教練說"] },
  { name: "二段加速",       icon: "💨", tier: "rare", power: 2, lines: ["加速術疊到了第二層", "時間彷彿變慢，靶變大了"] },
  { name: "全集中·呼吸法",  icon: "🌊", tier: "rare", power: 2, lines: ["你使出了全集中呼吸", "水面般平靜，箭隨心走"] },
  { name: "歐皇附身",       icon: "👑", tier: "rare", power: 2, lines: ["歐皇之力降臨", "今天的你，運氣擋都擋不住"] },
  { name: "貓神祝福",       icon: "😺", tier: "rare", power: 2, lines: ["寶寶、大娘、悠悠一起喵了一聲", "你獲得了貓神的集體祝福"] },
  { name: "鷹眼模式",       icon: "🦅", tier: "rare", power: 2, lines: ["你開啟了鷹眼模式", "靶心在你眼中清晰無比"] },
  { name: "退役老兵的指點", icon: "🎖️", tier: "rare", power: 2, lines: ["一位老射手拍了拍你的肩", "「放鬆，別跟箭過不去。」"] },
  { name: "限時加倍",       icon: "✨", tier: "rare", power: 2, lines: ["命中判定範圍暫時放大", "這一輪，靶心對你特別寬容"] },

  // ───────── 史詩 epic（降很多，接近過關）─────────
  { name: "教練的震怒",   icon: "💥", tier: "epic", power: 3, lines: ["教練看不下去了！", "「我親自下場幫你！」全場加成"] },
  { name: "BUG級手感",    icon: "🐛", tier: "epic", power: 3, lines: ["你進入了 BUG 狀態", "系統判定：這箭怎麼射都會中"] },
  { name: "時之術·緩",    icon: "⏳", tier: "epic", power: 3, lines: ["時間流速降到 0.5 倍", "你有充足的時間瞄準"] },
  { name: "滿月之力",     icon: "🌕", tier: "epic", power: 3, lines: ["今晚月色真美", "月光灑在你的箭上，指引方向"] },

  // ───────── 保底大招（失敗多次後出現，直接過關）─────────
  { name: "教練·完全治癒術", icon: "💖", tier: "ultimate", power: 999, lines: ["教練施展了【完全治癒術】", "「這關我罩你，過！」直接達標 🎉"] },
  { name: "貓小隊·全員出動", icon: "🐾", tier: "ultimate", power: 999, lines: ["哈吉、安仔、全員到齊！", "貓咪大隊幫你把箭叼上靶心，過關！"] },
];

// 依「失敗次數」決定抽取池（漸強保底）
// 0 次：common 為主；1-2 次：加入 rare；3-4 次：加入 epic；5 次以上：直接給 ultimate
export function drawBuff(failCount = 0) {
  let pool;
  if (failCount >= 5) {
    pool = BUFF_POOL.filter(b => b.tier === "ultimate");
  } else if (failCount >= 3) {
    pool = BUFF_POOL.filter(b => b.tier === "epic" || b.tier === "rare");
  } else if (failCount >= 1) {
    pool = BUFF_POOL.filter(b => b.tier === "rare" || b.tier === "common");
  } else {
    pool = BUFF_POOL.filter(b => b.tier === "common");
  }
  if (!pool.length) pool = BUFF_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
