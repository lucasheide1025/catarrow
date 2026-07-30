// src/guild/data/guildAffixPool.js
// ─────────────────────────────────────────────────────────────
// 挑戰委託的「詞綴」素材庫。
//
// 為什麼是詞綴而不是新模式：每個危險度都要有更難的版本，若為每一階手寫內容，
// 6 個危險度 × 3 個模式就要寫 18 份，之後想加難度還得再寫一輪。詞綴疊在既有模式上，
// 組合會自己長出來——想加難度只要往這張表加一條。
//
// 這裡只有「數值修正的宣告」，實際套用在 domain/guildAffixes.js（合併）與
// rollExpedition（生怪）／expeditionFlow（戰鬥）兩處消費。
// ─────────────────────────────────────────────────────────────

export const GUILD_AFFIXES = Object.freeze([
  {
    id: "berserk", name: "狂暴", icon: "🩸", color: "#f87171",
    desc: "怪物攻擊 +30%",
    flavor: "牠們像是聞到血。",
    mods: { monsterAtkMult: 1.3 },
  },
  {
    id: "swift", name: "疾行", icon: "🏃", color: "#93c5fd",
    desc: "怪物移動速度 +1（更快貼身）",
    flavor: "還沒看清楚，牠已經到面前了。",
    mods: { monsterSpeedBonus: 1 },
  },
  {
    id: "armored", name: "厚甲", icon: "🛡️", color: "#cbd5e1",
    desc: "怪物防禦 +40%",
    flavor: "箭插上去，只是彈開。",
    mods: { monsterDefMult: 1.4 },
  },
  {
    id: "swarm", name: "成群", icon: "👥", color: "#fbbf24",
    desc: "每波 +2 隻",
    flavor: "後面還有，一直都還有。",
    mods: { waveSizeBonus: 2 },
  },
  {
    id: "famine", name: "斷糧", icon: "🍖", color: "#fb923c",
    desc: "補給消耗 ×2",
    flavor: "水袋破了，沒人發現。",
    mods: { supplyCostMult: 2 },
  },
  {
    id: "blitz", name: "急襲", icon: "⏱️", color: "#a78bfa",
    desc: "限 12 回合內完成，逾時撤退",
    flavor: "天亮之前一定要結束。",
    mods: { roundLimit: 12 },
  },
  {
    id: "night", name: "夜戰", icon: "🌙", color: "#818cf8",
    desc: "看不見距離 5 格以外的敵人",
    flavor: "只聽得到，看不到。",
    mods: { visionDepth: 4 },
  },
  {
    id: "veteran", name: "宿敵", icon: "💀", color: "#fca5a5",
    desc: "怪物生命 +25%",
    flavor: "這批東西見過血，也活下來過。",
    mods: { monsterHpMult: 1.25 },
  },
]);

export const GUILD_AFFIX_MAP = Object.freeze(
  Object.fromEntries(GUILD_AFFIXES.map(affix => [affix.id, affix])),
);

// 挑戰層級。affixCount 決定抽幾條詞綴，倍率決定值不值得挑。
// 一般委託沒有 challenge 欄位（或為 null），走原本的獎勵。
export const CHALLENGE_TIERS = Object.freeze({
  elite: {
    id: "elite", name: "精銳", icon: "⚔️", color: "#fbbf24",
    tagline: "同樣的委託，對手不一樣。",
    affixCount: 1, lootMult: 1.5, repMult: 1.5,
  },
  perilous: {
    id: "perilous", name: "危殆", icon: "☠️", color: "#f87171",
    tagline: "公會不保證你回得來。",
    affixCount: 2, lootMult: 2.2, repMult: 2.5,
  },
  // 首領單挑：沒有雜兵，只有一隻首領。做成挑戰層級而不是日常模式，是因為 spec 規定
  // 每個危險度恰好一張探索/進攻/防守；放進挑戰板既不破壞它，又保證每天每階都有一張。
  duel: {
    id: "duel", name: "單挑", icon: "👑", color: "#c084fc",
    tagline: "沒有雜兵擋在前面，也沒有人幫你分擔。",
    affixCount: 1, lootMult: 2.0, repMult: 2.0,
    forceMode: "duel",
  },
});

export const CHALLENGE_TIER_IDS = Object.freeze(Object.keys(CHALLENGE_TIERS));
