// src/lib/achievementDex.js
// 數位圖鑑：里程碑成就定義 + 自動判定 + 統計

import { calcBadgePoints, getCertLevel } from "./constants";
import { getCohort, cohortRarity, cohortLabel, cohortTitle } from "./cohort";
import { MONSTERS } from "./monsterData";
import { POTIONS } from "./itemData";
import { levelFromXP } from "./adventurerSystem";
import { FAMILY_COLLECTIBLES, COLLECTIBLE_MAP } from "./dungeonCollectibles";
import { WB_TROPHY_MAP } from "./worldBossData";
import { getVillageLevel } from "./villageData";

// 裝備品階順序（equipData.js：common→mythic），供裝備成就取「最高品階」用
const EQUIP_GRADE_ORDER = ["common", "rare", "elite", "epic", "legend", "mythic"];

export const RARITY_STYLE = {
  common:    { ring: "#cbd5e1", glow: "none",                              label: "普通" },
  uncommon:  { ring: "#22c55e", glow: "0 0 8px rgba(34,197,94,.45)",       label: "非凡" },
  rare:      { ring: "#3b82f6", glow: "0 0 10px rgba(59,130,246,.5)",      label: "稀有" },
  epic:      { ring: "#a855f7", glow: "0 0 12px rgba(168,85,247,.6)",      label: "史詩" },
  legendary: { ring: "#f59e0b", glow: "0 0 16px rgba(245,158,11,.7)",      label: "傳說" },
  mythic:    { ring: "#ef4444", glow: "0 0 20px rgba(239,68,68,.8)",       label: "神話" },
};

export const RANK_STYLE = {
  1: { ring: "#f59e0b", glow: "0 0 16px rgba(245,158,11,.7)",  icon: "🥇", label: "冠軍" },
  2: { ring: "#94a3b8", glow: "0 0 12px rgba(148,163,184,.6)", icon: "🥈", label: "亞軍" },
  3: { ring: "#b45309", glow: "0 0 12px rgba(180,83,9,.5)",    icon: "🥉", label: "季軍" },
  0: { ring: "#0ea5e9", glow: "0 0 8px rgba(14,165,233,.4)",   icon: "🎯", label: "參賽" },
};

export const DEX_CATEGORIES = [
  { id: "start",    label: "🌱 啟程" },
  { id: "practice", label: "🎯 練習" },
  { id: "cohort",   label: "🎓 期數" },
  { id: "cert",     label: "🎖️ 射手證" },
  { id: "level",    label: "🏹 檢定" },
  { id: "collect",  label: "🐱 收藏" },
  { id: "physical", label: "🏆 實體賽" },
  { id: "point",    label: "⭐ 積分賽" },
  { id: "special",  label: "✨ 特殊" },
  { id: "monster",  label: "👹 打怪" },
  { id: "worldboss",label: "🐲 世界王" },
  { id: "duel",     label: "⚔️ 決鬥" },
  { id: "forge",    label: "🔮 煉製 & 藥水" },
  { id: "card",     label: "🃏 怪物卡" },
  { id: "guild",    label: "🏰 冒險者公會" },
  { id: "dungeon",  label: "🏚️ 地下城" },
  { id: "cat",      label: "🐈 貓咪" },
  { id: "village",  label: "🏘️ 貓貓村" },
  { id: "equip",    label: "🛡️ 裝備" },
];

// ── helpers ──────────────────────────────────────────────────
const LEVEL_ORDER = ["入門", "初級", "中級", "進階", "精英", "菁英"];
function levelIdx(lv) { return LEVEL_ORDER.indexOf(lv); }

function bowAtLeast(certRecords, bowType, minLevel) {
  const recs = (certRecords || []).filter(r => r.bowType === bowType);
  if (!recs.length) return false;
  const best = Math.max(...recs.map(r => r.score || 0));
  const lv = getCertLevel(bowType, best);
  return lv && levelIdx(lv) >= levelIdx(minLevel);
}
function anyBowLevelAtLeast(certRecords, minLevel) {
  const bows = [...new Set((certRecords || []).map(r => r.bowType))];
  return bows.some(b => bowAtLeast(certRecords, b, minLevel));
}
// 幾種弓達到某級別以上
function bowCountAtLeast(certRecords, minLevel, count) {
  const bows = [...new Set((certRecords || []).map(r => r.bowType))];
  const qualified = bows.filter(b => bowAtLeast(certRecords, b, minLevel));
  return qualified.length >= count;
}
// task 命中/分數 helper
function certTaskVal(certification, tier, task, field) {
  return certification?.[tier]?.[task]?.[field] ?? 0;
}
function certTaskPassed(certification, tier, task) {
  return certification?.[tier]?.[task]?.passed === true;
}
// 射手證編號數字化（archerNo 是 string）
function archerNoNum(member) {
  const n = parseInt(member?.archerNo, 10);
  return isNaN(n) ? null : n;
}

// ── AUTO_ACHIEVEMENTS ────────────────────────────────────────
export const AUTO_ACHIEVEMENTS = [

  // ══ 啟程 ══
  { id: "checkin_1",  cat: "start", icon: "📍", name: "初次報到",   rarity: "common",   desc: "完成第一次今日任務報到",   check: c => (c.checkinCount || 0) >= 1  },
  { id: "checkin_5",  cat: "start", icon: "🌤️", name: "漸入佳境",   rarity: "common",   desc: "累積報到 5 次",            check: c => (c.checkinCount || 0) >= 5  },
  { id: "checkin_10", cat: "start", icon: "🔥", name: "持之以恆",   rarity: "uncommon", desc: "累積報到 10 次",           check: c => (c.checkinCount || 0) >= 10 },
  { id: "checkin_15", cat: "start", icon: "⚡", name: "勢如破竹",   rarity: "uncommon", desc: "累積報到 15 次",           check: c => (c.checkinCount || 0) >= 15 },
  { id: "checkin_20", cat: "start", icon: "💎", name: "鍛鍊有成",   rarity: "rare",     desc: "累積報到 20 次",           check: c => (c.checkinCount || 0) >= 20 },
  { id: "checkin_25", cat: "start", icon: "🌟", name: "百練成鋼",   rarity: "rare",     desc: "累積報到 25 次",           check: c => (c.checkinCount || 0) >= 25 },
  { id: "checkin_30", cat: "start", icon: "💪", name: "風雨無阻",   rarity: "epic",     desc: "累積報到 30 次",           check: c => (c.checkinCount || 0) >= 30 },
  { id: "first_cert", cat: "start", icon: "🎯", name: "初試啼聲",   rarity: "common",   desc: "第一次參加年度檢定",       check: c => (c.certRecords || []).length >= 1 },
  // 月卡（已實裝：member.monthlyCard）。card_first 可判定；card_renew 待續約計數器（Phase 4）
  { id: "card_first",  cat: "start", icon: "🪪", name: "月卡初啟",  rarity: "uncommon", desc: "第一次啟動月卡",
    check: c => !!(c.member?.monthlyCard?.startedAt || c.member?.monthlyCard?.active) },
  { id: "card_renew",  cat: "start", icon: "🔄", name: "月卡續射",  rarity: "rare",     desc: "月卡至少續約一次",
    check: c => (c.member?.monthlyCard?.renewCount || 0) >= 1 },

  // ══ 射手證 ══
  { id: "cert_blue",       cat: "cert", icon: "🎖️", name: "藍證射手",     rarity: "rare",
    desc: "通過射手證畢業考，取得藍證",
    check: c => c.certification?.level === "blue" || c.certification?.level === "gold" },

  { id: "cert_blue_top",   cat: "cert", icon: "💯", name: "藍證完美",     rarity: "epic",
    desc: "藍證任務一全中（6支）且任務二滿分（100分）",
    check: c => {
      if (!certTaskPassed(c.certification, "blue", "task1")) return false;
      if (!certTaskPassed(c.certification, "blue", "task2")) return false;
      return certTaskVal(c.certification, "blue", "task1", "hits") >= 6
          && certTaskVal(c.certification, "blue", "task2", "score") >= 100;
    }
  },
  { id: "cert_blue_great", cat: "cert", icon: "✨", name: "藍證優秀",     rarity: "rare",
    desc: "藍證任務一命中 5 支以上且任務二 90 分以上",
    check: c => {
      if (!certTaskPassed(c.certification, "blue", "task1")) return false;
      if (!certTaskPassed(c.certification, "blue", "task2")) return false;
      return certTaskVal(c.certification, "blue", "task1", "hits") >= 5
          && certTaskVal(c.certification, "blue", "task2", "score") >= 90;
    }
  },

  { id: "cert_gold",       cat: "cert", icon: "🏅", name: "金證射手",     rarity: "legendary",
    desc: "取得射手證最高榮譽——金證",
    check: c => c.certification?.level === "gold" },

  { id: "cert_gold_top",   cat: "cert", icon: "👑", name: "金證完美",     rarity: "legendary",
    desc: "金證任務一全中（6支）且任務二滿分（100分）",
    check: c => {
      if (c.certification?.level !== "gold") return false;
      return certTaskVal(c.certification, "gold", "task1", "hits") >= 6
          && certTaskVal(c.certification, "gold", "task2", "score") >= 100;
    }
  },
  { id: "cert_gold_great", cat: "cert", icon: "🌠", name: "金證優秀",     rarity: "epic",
    desc: "金證任務一命中 5 支以上且任務二 90 分以上",
    check: c => {
      if (c.certification?.level !== "gold") return false;
      return certTaskVal(c.certification, "gold", "task1", "hits") >= 5
          && certTaskVal(c.certification, "gold", "task2", "score") >= 90;
    }
  },

  // 射手證編號
  { id: "archer_no_20",  cat: "cert", icon: "🔢", name: "元老號碼",   rarity: "legendary",
    desc: "射手證編號在 20 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 20; } },
  { id: "archer_no_50",  cat: "cert", icon: "🔢", name: "早鳥號碼",   rarity: "epic",
    desc: "射手證編號在 50 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 50; } },
  { id: "archer_no_100", cat: "cert", icon: "🔢", name: "百內射手",   rarity: "rare",
    desc: "射手證編號在 100 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 100; } },
  { id: "archer_no_200", cat: "cert", icon: "🔢", name: "雙百射手",   rarity: "uncommon",
    desc: "射手證編號在 200 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 200; } },
  { id: "archer_no_500", cat: "cert", icon: "🔢", name: "五百射手",   rarity: "common",
    desc: "射手證編號在 500 號以內",
    check: c => { const n = archerNoNum(c.member); return n !== null && n <= 500; } },

  // ══ 檢定 — 裸弓 ══
  { id: "bare_entry",  cat: "level", icon: "🏹", name: "裸弓入門",   rarity: "common",   desc: "裸弓年度檢定達到入門",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "入門") },
  { id: "bare_basic",  cat: "level", icon: "🏹", name: "裸弓初級",   rarity: "common",   desc: "裸弓年度檢定達到初級",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "初級") },
  { id: "bare_mid",    cat: "level", icon: "🏹", name: "裸弓中級",   rarity: "uncommon", desc: "裸弓年度檢定達到中級",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "中級") },
  { id: "bare_adv",    cat: "level", icon: "🏹", name: "裸弓進階",   rarity: "rare",     desc: "裸弓年度檢定達到進階",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "進階") },
  { id: "bare_elite",  cat: "level", icon: "🏹", name: "裸弓精英",   rarity: "epic",     desc: "裸弓年度檢定達到精英",  check: c => bowAtLeast(c.certRecords, "recurve_bare", "精英") },

  // ══ 檢定 — 獵弓 ══
  { id: "comp_entry",  cat: "level", icon: "🦅", name: "獵弓入門",   rarity: "common",   desc: "獵弓年度檢定達到入門",  check: c => bowAtLeast(c.certRecords, "compound", "入門") },
  { id: "comp_basic",  cat: "level", icon: "🦅", name: "獵弓初級",   rarity: "common",   desc: "獵弓年度檢定達到初級",  check: c => bowAtLeast(c.certRecords, "compound", "初級") },
  { id: "comp_mid",    cat: "level", icon: "🦅", name: "獵弓中級",   rarity: "uncommon", desc: "獵弓年度檢定達到中級",  check: c => bowAtLeast(c.certRecords, "compound", "中級") },
  { id: "comp_adv",    cat: "level", icon: "🦅", name: "獵弓進階",   rarity: "rare",     desc: "獵弓年度檢定達到進階",  check: c => bowAtLeast(c.certRecords, "compound", "進階") },
  { id: "comp_elite",  cat: "level", icon: "🦅", name: "獵弓精英",   rarity: "epic",     desc: "獵弓年度檢定達到精英",  check: c => bowAtLeast(c.certRecords, "compound", "精英") },

  // ══ 檢定 — 傳統弓 ══
  { id: "trad_entry",  cat: "level", icon: "🌿", name: "傳統弓入門", rarity: "common",   desc: "傳統弓年度檢定達到入門", check: c => bowAtLeast(c.certRecords, "traditional", "入門") },
  { id: "trad_basic",  cat: "level", icon: "🌿", name: "傳統弓初級", rarity: "common",   desc: "傳統弓年度檢定達到初級", check: c => bowAtLeast(c.certRecords, "traditional", "初級") },
  { id: "trad_mid",    cat: "level", icon: "🌿", name: "傳統弓中級", rarity: "uncommon", desc: "傳統弓年度檢定達到中級", check: c => bowAtLeast(c.certRecords, "traditional", "中級") },
  { id: "trad_adv",    cat: "level", icon: "🌿", name: "傳統弓進階", rarity: "rare",     desc: "傳統弓年度檢定達到進階", check: c => bowAtLeast(c.certRecords, "traditional", "進階") },
  { id: "trad_elite",  cat: "level", icon: "🌿", name: "傳統弓精英", rarity: "epic",     desc: "傳統弓年度檢定達到精英", check: c => bowAtLeast(c.certRecords, "traditional", "精英") },

  // ══ 檢定 — 跨弓成就 ══
  { id: "multi_mid2",   cat: "level", icon: "🔀", name: "左右開弓",   rarity: "rare",
    desc: "兩種弓以上達到中級",    check: c => bowCountAtLeast(c.certRecords, "中級", 2) },
  { id: "multi_adv2",   cat: "level", icon: "🔀", name: "左右逢源",   rarity: "epic",
    desc: "兩種弓以上達到進階",    check: c => bowCountAtLeast(c.certRecords, "進階", 2) },
  { id: "multi_elite2", cat: "level", icon: "🔀", name: "左右互搏",   rarity: "legendary",
    desc: "兩種弓以上達到精英",    check: c => bowCountAtLeast(c.certRecords, "精英", 2) },

  { id: "all_mid3",     cat: "level", icon: "🎖️", name: "全職弓手",   rarity: "epic",
    desc: "三種弓以上達到中級",    check: c => bowCountAtLeast(c.certRecords, "中級", 3) },
  { id: "all_adv3",     cat: "level", icon: "🎖️", name: "全職射手",   rarity: "legendary",
    desc: "三種弓以上達到進階",    check: c => bowCountAtLeast(c.certRecords, "進階", 3) },
  { id: "all_elite3",   cat: "level", icon: "🎖️", name: "全職獵人",   rarity: "legendary", hidden: true,
    riddle: "三道試煉，缺一不可　🏹 🦅 🌿", desc: "三種弓以上達到精英",
    check: c => bowCountAtLeast(c.certRecords, "精英", 3) },

  // ══ 收藏 — 個別章 ══
  { id: "fatcat_bronze",  cat: "collect", icon: "🐱", name: "貓奴入門",   rarity: "common",
    desc: "獲得第一個肥貓銅章",    check: c => (c.member?.fatCat?.bronze || 0) >= 1 },
  { id: "fatcat_silver",  cat: "collect", icon: "🐱", name: "肥貓騎士",   rarity: "uncommon",
    desc: "取得肥貓銀章一顆",      check: c => (c.member?.fatCat?.silver || 0) >= 1 },
  { id: "fatcat_gold",    cat: "collect", icon: "👑", name: "肥貓之王",   rarity: "epic",
    desc: "肥貓章累積達到金章",    check: c => (c.member?.fatCat?.gold || 0) >= 1 },

  { id: "score_bronze",   cat: "collect", icon: "⭐", name: "積分新星",   rarity: "common",
    desc: "獲得第一個積分銅章",    check: c => (c.member?.score?.bronze || 0) >= 1 },
  { id: "score_silver",   cat: "collect", icon: "⭐", name: "積分銀星",   rarity: "uncommon",
    desc: "取得積分銀章一顆",      check: c => (c.member?.score?.silver || 0) >= 1 },
  { id: "score_gold",     cat: "collect", icon: "🌠", name: "積分大師",   rarity: "epic",
    desc: "積分章累積達到金章",    check: c => (c.member?.score?.gold || 0) >= 1 },

  { id: "ach_silver",     cat: "collect", icon: "🏆", name: "成就獵人",   rarity: "common",
    desc: "獲得第一個成就銀章",    check: c => (c.member?.achievement?.silver || 0) >= 1 },
  { id: "ach_gold",       cat: "collect", icon: "🏆", name: "金光閃閃",   rarity: "uncommon",
    desc: "取得成就金章一顆",      check: c => (c.member?.achievement?.gold || 0) >= 1 },
  { id: "ach_black",      cat: "collect", icon: "⬛", name: "黑牌傳說",   rarity: "legendary",
    desc: "成就章累積達到黑牌",    check: c => (c.member?.achievement?.black || 0) >= 1 },

  // ══ 收藏 — 組合章 ══
  { id: "set_lowest",  cat: "collect", icon: "✨", name: "初現光芒",   rarity: "uncommon",
    desc: "三種章各有最低級：肥貓銅章、積分銅章、成就銀章",
    check: c =>
      (c.member?.fatCat?.bronze    || 0) >= 1 &&
      (c.member?.score?.bronze     || 0) >= 1 &&
      (c.member?.achievement?.silver || 0) >= 1
  },
  { id: "set_mid",     cat: "collect", icon: "💫", name: "披掛上陣",   rarity: "epic",
    desc: "三種章各有中級：肥貓銀章、積分銀章、成就金章",
    check: c =>
      (c.member?.fatCat?.silver    || 0) >= 1 &&
      (c.member?.score?.silver     || 0) >= 1 &&
      (c.member?.achievement?.gold || 0) >= 1
  },
  { id: "set_top",     cat: "collect", icon: "👑", name: "穿金戴銀",   rarity: "legendary",
    desc: "三種章各有最高級：肥貓金章、積分金章、成就黑牌",
    check: c =>
      (c.member?.fatCat?.gold      || 0) >= 1 &&
      (c.member?.score?.gold       || 0) >= 1 &&
      (c.member?.achievement?.black || 0) >= 1
  },

  // ══ 打怪模式 — 累積場數 ══
  { id: "monster_first",   cat: "monster", icon: "👹", name: "初入戰場",   rarity: "common",
    desc: "第一次擊敗怪物",
    check: c => Object.values(c.monsterDex || {}).some(m => (m.wins || 0) > 0) },
  { id: "monster_5",       cat: "monster", icon: "⚔️", name: "身經百戰",   rarity: "uncommon",
    desc: "累積擊敗怪物 5 次",
    check: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0) >= 5 },
  { id: "monster_10",      cat: "monster", icon: "🗡️", name: "殺伐決斷",   rarity: "rare",
    desc: "累積擊敗怪物 10 次",
    check: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0) >= 10 },
  { id: "monster_30",      cat: "monster", icon: "🔱", name: "百戰老將",   rarity: "epic",
    desc: "累積擊敗怪物 30 次",
    check: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0) >= 30 },
  { id: "monster_mvp1",    cat: "monster", icon: "🌟", name: "首殺頭目",   rarity: "rare",
    desc: "擊敗任意一隻頭目（boss）",
    check: c => Object.entries(c.monsterDex || {}).some(([id, m]) => id.endsWith("_5") && (m.wins || 0) > 0) },
  { id: "monster_mvp10",   cat: "monster", icon: "💥", name: "頭目獵人",   rarity: "legendary",
    desc: "累積擊敗頭目（boss）10 次以上",
    check: c => Object.entries(c.monsterDex || {}).filter(([id]) => id.endsWith("_5")).reduce((s, [, m]) => s + (m.wins || 0), 0) >= 10 },
  // 神話成就
  { id: "mythic_first",    cat: "monster", icon: "🌋", name: "神話挑戰者", rarity: "epic",
    desc: "第一次擊敗神話怪物",
    check: c => Object.entries(c.monsterDex || {}).some(([id, m]) => id.endsWith("_6") && (m.wins || 0) > 0) },
  { id: "mythic_all",      cat: "monster", icon: "👑", name: "封神之路",   rarity: "mythic",
    desc: "擊敗全部 6 隻神話怪物", hidden: true,
    riddle: "六大神話，一個都不能少…",
    check: c => ["ghost_6","mountain_6","insect_6","workplace_6","exam_6","temple_6"].every(id => (c.monsterDex?.[id]?.wins || 0) > 0) },
  // 六族全圖鑑
  { id: "dex_all6",        cat: "monster", icon: "🏆", name: "六族征服者", rarity: "epic",
    desc: "六大族各擊敗至少一隻",
    check: c => ["ghost","mountain","insect","workplace","exam","temple"].every(fam =>
      Object.entries(c.monsterDex || {}).some(([id, m]) => id.startsWith(fam + "_") && (m.wins || 0) > 0)) },
  { id: "dex_all36",       cat: "monster", icon: "📖", name: "圖鑑完成",   rarity: "legendary",
    desc: "擊敗全部 36 隻怪物", hidden: true,
    riddle: "三十六道關卡，一個都不能逃…",
    check: c => Object.values(c.monsterDex || {}).filter(m => (m.wins || 0) > 0).length >= 36 },
  // 掉寶成就（check 暫為 false）
  { id: "drop_rare",      cat: "monster", icon: "📦", name: "初嚐甜頭",   rarity: "rare",
    desc: "打怪模式獲得稀有掉寶",  check: _c => false },
  { id: "drop_epic",      cat: "monster", icon: "🎁", name: "奇蹟降臨",   rarity: "epic",
    desc: "打怪模式獲得史詩掉寶",  check: _c => false },
  { id: "drop_legendary", cat: "monster", icon: "🏺", name: "傳說之物",   rarity: "legendary",
    desc: "打怪模式獲得傳說掉寶",  check: _c => false },
  { id: "drop_mythic",    cat: "monster", icon: "🌋", name: "神話現世",   rarity: "mythic",
    desc: "打怪模式獲得神話掉寶",  check: _c => false },

  // ══ 決鬥模式 ══
  { id: "duel_first",     cat: "duel", icon: "🤺", name: "踏上決鬥場",   rarity: "common",
    desc: "第一次參加決鬥模式（勝負不拘）",
    check: c => (c.duelStats?.wins || 0) + (c.duelStats?.losses || 0) + (c.duelStats?.draws || 0) >= 1 },

  { id: "duel_loss3",     cat: "duel", icon: "🩹", name: "越挫越勇",    rarity: "common",
    desc: "決鬥中累積落敗 3 次，但你還是回來了",
    check: c => (c.duelStats?.losses || 0) >= 3 },

  { id: "duel_win1",      cat: "duel", icon: "🏴", name: "初勝",        rarity: "uncommon",
    desc: "決鬥模式首次獲勝",
    check: c => (c.duelStats?.wins || 0) >= 1 },

  { id: "duel_draw",      cat: "duel", icon: "🤝", name: "棋逢對手",    rarity: "uncommon",
    desc: "在決鬥中達成平局",
    check: c => (c.duelStats?.draws || 0) >= 1 },

  { id: "duel_solo_win1", cat: "duel", icon: "🗡", name: "單挑王",      rarity: "uncommon",
    desc: "1v1 決鬥模式首次獲勝",
    check: c => (c.duelStats?.soloWins || 0) >= 1 },

  { id: "duel_team_win1", cat: "duel", icon: "🛡", name: "隊長魂",      rarity: "uncommon",
    desc: "組隊決鬥模式首次獲勝",
    check: c => (c.duelStats?.teamWins || 0) >= 1 },

  { id: "duel_win5",      cat: "duel", icon: "⚔️", name: "百戰老將",    rarity: "rare",
    desc: "決鬥模式累積勝利 5 次",
    check: c => (c.duelStats?.wins || 0) >= 5 },

  { id: "duel_dmg1000",   cat: "duel", icon: "💥", name: "千點傷害",    rarity: "rare",
    desc: "決鬥中累積造成 1000 點傷害",
    check: c => (c.duelStats?.totalDmg || 0) >= 1000 },

  { id: "duel_win10",     cat: "duel", icon: "🏆", name: "決鬥大師",    rarity: "epic",
    desc: "決鬥模式累積勝利 10 次",
    check: c => (c.duelStats?.wins || 0) >= 10 },

  { id: "duel_winrate70", cat: "duel", icon: "📊", name: "決鬥強者",    rarity: "epic",
    desc: "累積 10 場決鬥，且勝率達 70% 以上",
    check: c => {
      const total = (c.duelStats?.wins || 0) + (c.duelStats?.losses || 0) + (c.duelStats?.draws || 0);
      if (total < 10) return false;
      return (c.duelStats?.wins || 0) / total >= 0.7;
    } },

  { id: "duel_win25",     cat: "duel", icon: "👑", name: "決鬥王者",    rarity: "epic",
    desc: "決鬥模式累積勝利 25 次",
    check: c => (c.duelStats?.wins || 0) >= 25 },

  { id: "duel_flawless",  cat: "duel", icon: "💎", name: "完美決鬥",    rarity: "legendary", hidden: true,
    riddle: "一滴血未流，卻讓對方倒下…",
    desc: "決鬥模式以完美HP獲勝，自身HP未減少",
    check: c => (c.duelStats?.flawless || 0) >= 1 },

  { id: "duel_flawless5", cat: "duel", icon: "✨", name: "無懈可擊",    rarity: "legendary", hidden: true,
    riddle: "五次無傷完勝，傳說級箭術…",
    desc: "累積 5 次完美決鬥獲勝",
    check: c => (c.duelStats?.flawless || 0) >= 5 },

  // ══ 煉製 ══
  { id: "brew_first",    cat: "forge", icon: "🧪", name: "初學煉金",   rarity: "common",
    desc: "第一次合成藥水",
    check: c => (c.craftStats?.potionsCrafted || 0) >= 1 },
  { id: "brew_5",        cat: "forge", icon: "⚗️", name: "藥水調製師", rarity: "uncommon",
    desc: "累積合成藥水 5 瓶",
    check: c => (c.craftStats?.potionsCrafted || 0) >= 5 },
  { id: "brew_10",       cat: "forge", icon: "💊", name: "藥劑大師",   rarity: "rare",
    desc: "累積合成藥水 10 瓶",
    check: c => (c.craftStats?.potionsCrafted || 0) >= 10 },
  { id: "brew_all",      cat: "forge", icon: "🌈", name: "全能藥師",   rarity: "epic",
    desc: "新版消耗品各製作過至少一次", hidden: true,
    riddle: "工坊百味，缺一不可…",
    check: c => POTIONS.every(p => (c.craftStats?.potionTypesCrafted?.[p.id] || 0) >= 1) },
  { id: "frag_forge_1",  cat: "forge", icon: "✨", name: "碎片煉士",   rarity: "uncommon",
    desc: "第一次合成章碎片",
    check: c => (c.craftStats?.fragsCrafted || 0) >= 1 },
  { id: "frag_forge_all",cat: "forge", icon: "🌟", name: "三章合一",   rarity: "rare",
    desc: "三種章碎片各合成過至少一次",
    check: c => Object.keys(c.craftStats?.fragTypesCrafted || {}).length >= 3 },
  { id: "frag_forge_5",  cat: "forge", icon: "💎", name: "鑄章大師",   rarity: "epic",
    desc: "累積合成章碎片 5 次",
    check: c => (c.craftStats?.fragsCrafted || 0) >= 5 },

  // ══ 藥水使用 — 累積場數 ══
  { id: "potion_any_1",  cat: "forge", icon: "🧪", name: "初識藥水",   rarity: "common",
    desc: "第一次在戰鬥中使用藥水",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 1 },
  { id: "potion_any_10", cat: "forge", icon: "💊", name: "藥水依賴",   rarity: "uncommon",
    desc: "累積使用藥水 10 次",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 10 },
  { id: "potion_any_30", cat: "forge", icon: "⚗️", name: "藥水大戶",   rarity: "rare",
    desc: "累積使用藥水 30 次",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 30 },
  { id: "potion_any_50", cat: "forge", icon: "🔮", name: "藥水狂熱者", rarity: "epic",
    desc: "累積使用藥水 50 次",
    check: c => Object.values(c.potionDex?.used || {}).reduce((s,n)=>s+n,0) >= 50 },
  { id: "potion_all_9",  cat: "forge", icon: "🌈", name: "全種藥師",   rarity: "epic",
    desc: "所有已開放消耗品各使用至少一次", hidden: true,
    riddle: "百味戰術，各試過一遍…",
    check: c => POTIONS.filter(p => !p.futureFeature).every(p => (c.potionDex?.used?.[p.id] || 0) >= 1) },

  // ══ 怪物卡收藏 ══
  { id: "card_1",         cat: "card", icon: "🃏", name: "初探怪窟",   rarity: "common",
    desc: "收集第一張怪物卡",
    check: c => (c.cardCount || 0) >= 1 },
  { id: "card_5",         cat: "card", icon: "🃏", name: "收藏家入門", rarity: "uncommon",
    desc: "收集 5 種怪物卡",
    check: c => (c.cardCount || 0) >= 5 },
  { id: "card_10",        cat: "card", icon: "🃏", name: "卡片達人",   rarity: "rare",
    desc: "收集 10 種怪物卡",
    check: c => (c.cardCount || 0) >= 10 },
  { id: "card_15",        cat: "card", icon: "🃏", name: "卡片狂人",   rarity: "epic",
    desc: "收集 15 種怪物卡",
    check: c => (c.cardCount || 0) >= 15 },
  { id: "card_20",        cat: "card", icon: "🃏", name: "怪物圖鑑家", rarity: "legendary",
    desc: "收集 20 種怪物卡",
    check: c => (c.cardCount || 0) >= 20 },
  { id: "card_mythic",    cat: "card", icon: "✨", name: "傳說獵手",   rarity: "epic",
    desc: "獲得至少一張神話怪物卡", hidden: true,
    riddle: "凡俗之手，握住了傳說…",
    check: c => (c.mythicCards || 0) >= 1 },
  { id: "card_all6fam",   cat: "card", icon: "🌐", name: "六族全收",   rarity: "epic",
    desc: "六大族群各收集至少一張卡", hidden: true,
    riddle: "六種血脈，盡收囊中…",
    check: c => ["ghost","mountain","insect","workplace","exam","temple"].every(
      fam => c.cardFamilies?.includes(fam)) },

  // ══ 冒險者公會 ══
  { id: "guild_first_xp",     cat: "guild", icon: "⚔️", name: "初入公會",   rarity: "common",
    desc: "在冒險者公會首次累積 XP",
    check: c => (c.member?.adventurerXP || 0) > 0 },

  { id: "guild_lv10",         cat: "guild", icon: "🥉", name: "青銅巔峰",   rarity: "common",
    desc: "冒險者等級達到 Lv.10",
    check: c => levelFromXP(c.member?.adventurerXP || 0) >= 10 },

  { id: "guild_promo_bronze", cat: "guild", icon: "🥈", name: "白銀晉階",   rarity: "uncommon",
    desc: "完成 Lv.10 晉階儀式，踏入白銀階級",
    check: c => (c.member?.promotionDone || []).includes(10) },

  { id: "guild_promo_silver", cat: "guild", icon: "🥇", name: "黃金晉階",   rarity: "rare",
    desc: "完成 Lv.20 晉階儀式，展現精英實力",
    check: c => (c.member?.promotionDone || []).includes(20) },

  { id: "guild_promo_gold",   cat: "guild", icon: "💎", name: "白金晉階",   rarity: "epic",
    desc: "完成 Lv.30 晉階儀式，躋身頂尖射手",
    check: c => (c.member?.promotionDone || []).includes(30) },

  { id: "guild_promo_plat",   cat: "guild", icon: "🔥", name: "傳說晉階",   rarity: "legendary",
    desc: "完成 Lv.40 晉階儀式，成為傳說冒險者",
    check: c => (c.member?.promotionDone || []).includes(40) },

  { id: "guild_promo_legend", cat: "guild", icon: "⚡", name: "神話晉階",   rarity: "mythic",
    desc: "完成 Lv.50 晉階儀式，踏入神話領域",
    check: c => (c.member?.promotionDone || []).includes(50) },

  { id: "guild_max",          cat: "guild", icon: "👑", name: "神話滿等",   rarity: "mythic",
    desc: "冒險者等級達到最高境界 Lv.60",
    check: c => levelFromXP(c.member?.adventurerXP || 0) >= 60 },

  // ══ 地下城道具圖鑑 ══（2026-07-09 重寫：舊版依賴 dungeonClears/dungeonFamClear，
  // 全專案沒有任何地方會寫入這兩個欄位，是永遠不可能達成的死成就。改用真實會寫入的
  // member.dungeonCollectibles（地下城掉落收藏品，見 dungeonCollectibles.js，
  // 6族×(20普通+10稀有+5頭目+1超稀有)=216件+24首通紀念章=240件）。
  { id: "collectible_first",    cat: "dungeon", icon: "🎒", name: "初次拾獲",     rarity: "common",
    desc: "第一次在地下城拾獲收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 1 },
  { id: "collectible_10",       cat: "dungeon", icon: "🧳", name: "小有收穫",     rarity: "uncommon",
    desc: "累積拾獲 10 種不同收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 10 },
  { id: "collectible_60",       cat: "dungeon", icon: "📦", name: "探險家的行囊", rarity: "rare",
    desc: "累積拾獲 60 種不同收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 60 },
  { id: "collectible_150",      cat: "dungeon", icon: "🏺", name: "秘寶收藏家",   rarity: "epic",
    desc: "累積拾獲 150 種不同收藏品",
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= 150 },
  { id: "collectible_all_fam",  cat: "dungeon", icon: "🗺️", name: "六族踏查",     rarity: "epic", hidden: true,
    riddle: "六片土地，都留下了你的足跡…",
    desc: "六大族地下城各拾獲至少一件收藏品",
    check: c => ["ghost","mountain","insect","workplace","exam","temple"].every(fam =>
      Object.keys(c.member?.dungeonCollectibles || {}).some(id => COLLECTIBLE_MAP[id]?.family === fam)) },
  { id: "collectible_master",   cat: "dungeon", icon: "👑", name: "圖鑑大師",     rarity: "mythic", hidden: true,
    riddle: `${Object.keys(COLLECTIBLE_MAP).length} 件秘寶，一件不缺…`,
    desc: `收集全部地下城收藏品（${Object.keys(COLLECTIBLE_MAP).length} 件）`,
    check: c => Object.keys(c.member?.dungeonCollectibles || {}).length >= Object.keys(COLLECTIBLE_MAP).length },
];

// ── 動態加入：族群 1~6 級各一個成就 ───────────────────────────
const FAM_ICONS = { ghost:"👻", mountain:"🏔️", insect:"🦂", workplace:"💼", exam:"📝", temple:"🏰" };
const FAM_LABELS = { ghost:"鬼怪族", mountain:"山林族", insect:"毒蟲族", workplace:"職場族", exam:"考試族", temple:"西方怪物族" };
const TIER_RARITIES_LIST = ["common","uncommon","rare","epic","legendary","mythic"];
const TIER_NAMES_LIST    = ["一星","二星","三星","四星","五星","六星"];

for (const fam of ["ghost","mountain","insect","workplace","exam","temple"]) {
  for (let t = 1; t <= 6; t++) {
    const monsterId = `${fam}_${t}`;
    const monster = MONSTERS.find(m => m.id === monsterId);
    AUTO_ACHIEVEMENTS.push({
      id:     `dex_${fam}_t${t}`,
      cat:    "monster",
      icon:   FAM_ICONS[fam],
      name:   `${FAM_LABELS[fam]}${TIER_NAMES_LIST[t-1]}`,
      rarity: TIER_RARITIES_LIST[t-1],
      desc:   monster ? `擊敗「${monster.name}」（${FAM_LABELS[fam]}${t}級）` : `擊敗${FAM_LABELS[fam]}${t}級怪物`,
      check:  c => (c.monsterDex?.[monsterId]?.wins || 0) > 0,
    });
  }
}

// ── 動態加入：地下城道具圖鑑（每族普通/稀有/頭目/超稀有 + 首通紀念章）──
for (const fam of ["ghost","mountain","insect","workplace","exam","temple"]) {
  const pool = FAMILY_COLLECTIBLES[fam];
  const commonIds    = (pool?.common    || []).map(i => i.id);
  const rareIds      = (pool?.rare      || []).map(i => i.id);
  const bossIds      = (pool?.boss      || []).map(i => i.id);
  const superRareId  = pool?.superRare?.[0]?.id;

  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_common10`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}拾荒者`, rarity: "uncommon",
    desc: `${FAM_LABELS[fam]}地下城累積拾獲 10 種普通收藏品`,
    check: c => commonIds.filter(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0).length >= 10,
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_common_all`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}收藏家`, rarity: "rare", hidden: true,
    riddle: `${FAM_LABELS[fam]}的每一寸角落，都被翻找過…`,
    desc: `${FAM_LABELS[fam]}地下城收集全部 20 種普通收藏品`,
    check: c => commonIds.length > 0 && commonIds.every(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_rare1`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}稀有獵人`, rarity: "rare",
    desc: `拾獲${FAM_LABELS[fam]}任一稀有收藏品`,
    check: c => rareIds.some(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_rare_all`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}稀有大師`, rarity: "epic", hidden: true,
    riddle: "十件稀世珍寶，缺一不可…",
    desc: `${FAM_LABELS[fam]}地下城收集全部 10 種稀有收藏品`,
    check: c => rareIds.length > 0 && rareIds.every(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_${fam}_boss1`, cat: "dungeon", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}王者遺物`, rarity: "legendary",
    desc: `拾獲${FAM_LABELS[fam]}任一頭目專屬收藏品`,
    check: c => bossIds.some(id => (c.member?.dungeonCollectibles?.[id] || 0) > 0),
  });
  if (superRareId) {
    AUTO_ACHIEVEMENTS.push({
      id: `dungeon_${fam}_superrare`, cat: "dungeon", icon: FAM_ICONS[fam],
      name: `${FAM_LABELS[fam]}至寶`, rarity: "mythic", hidden: true,
      riddle: "傳說中的至寶，只有極少數人見過…",
      desc: `拾獲${FAM_LABELS[fam]}的超稀有收藏品`,
      check: c => (c.member?.dungeonCollectibles?.[superRareId] || 0) > 0,
    });
  }
}

// 首通紀念章（COLLECTIBLE_MAP 裡 rarity==="exclusive" 的項目，6族×4難度=24張）
for (const item of Object.values(COLLECTIBLE_MAP)) {
  if (item.rarity !== "exclusive") continue;
  AUTO_ACHIEVEMENTS.push({
    id: `dungeon_trophy_${item.dungeonId}`, cat: "dungeon", icon: item.icon,
    name: item.name, rarity: "epic",
    desc: `取得「${item.name}」——${FAM_LABELS[item.family] || item.family}地下城首通紀念`,
    check: c => (c.member?.dungeonCollectibles?.[item.id] || 0) > 0,
  });
}

// ── 動態加入：世界王專屬收藏獎盃成就（尾刀+前三名，24隻×2=48個）────
for (const t of Object.values(WB_TROPHY_MAP)) {
  AUTO_ACHIEVEMENTS.push({
    id: `wb_trophy_${t.id}`, cat: "worldboss", icon: t.icon,
    name: t.name, rarity: t.kind === "lastHit" ? "mythic" : "legendary",
    desc: t.desc, hidden: true,
    riddle: t.kind === "lastHit" ? "終結牠的人，只有一個…" : "傷害的證明，刻在勳章上…",
    check: c => (c.member?.dungeonCollectibles?.[t.id] || 0) > 0,
  });
}

// ── 動態加入：單一怪物擊殺次數成就 ──────────────────────────────
const KILL_MILESTONES = [5, 10, 25, 50, 100];
const KILL_RARITIES = { 5:"common", 10:"uncommon", 25:"rare", 50:"epic", 100:"legendary" };
const KILL_ICONS    = { 5:"⚔️", 10:"🗡️", 25:"💀", 50:"🔱", 100:"👑" };

for (const monster of MONSTERS) {
  for (const n of KILL_MILESTONES) {
    AUTO_ACHIEVEMENTS.push({
      id:     `kill_${monster.id}_${n}`,
      cat:    "monster",
      icon:   monster.icon,
      name:   `${monster.name}剋星 ×${n}`,
      rarity: KILL_RARITIES[n],
      desc:   `擊敗「${monster.name}」${n} 次`,
      check:  c => (c.monsterDex?.[monster.id]?.wins || 0) >= n,
    });
  }
}

// ── 動態加入：開箱次數成就 ────────────────────────────────────────
const CHEST_ACH_TYPES = [
  { id:"wood",   icon:"📦", name:"木寶箱" },
  { id:"iron",   icon:"🧰", name:"鐵寶箱" },
  { id:"gold",   icon:"🎁", name:"黃金寶箱" },
  { id:"epic",   icon:"💜", name:"史詩寶箱" },
  { id:"mythic", icon:"🔮", name:"神話寶箱" },
  { id:"cat",    icon:"🐱", name:"貓貓箱" },
  { id:"potion", icon:"🧪", name:"藥水箱" },
];
const CHEST_OPEN_MILESTONES = [1, 5, 10, 20];
const CHEST_OPEN_RARITIES   = { 1:"common", 5:"uncommon", 10:"rare", 20:"epic" };

for (const ct of CHEST_ACH_TYPES) {
  for (const n of CHEST_OPEN_MILESTONES) {
    AUTO_ACHIEVEMENTS.push({
      id:     `chest_${ct.id}_open_${n}`,
      cat:    "monster",
      icon:   ct.icon,
      name:   `${ct.name}開了 ${n} 次`,
      rarity: CHEST_OPEN_RARITIES[n],
      desc:   n === 1 ? `第一次開啟${ct.name}` : `累積開啟${ct.name} ${n} 次`,
      check:  c => (c.chestStats?.[ct.id] || 0) >= n,
    });
  }
}

// ── 動態加入：每種藥水使用次數成就 ──────────────────────────────
const POTION_RARITY_MILESTONES = {
  common:    [[1,"common","初嘗"], [3,"uncommon","慣用"], [5,"rare","老手"], [10,"epic","沉迷"]],
  rare:      [[1,"uncommon","初嘗"], [3,"rare","慣用"], [5,"epic","老手"]],
  epic:      [[1,"rare","初嘗"], [3,"epic","慣用"]],
  legendary: [[1,"epic","初嘗"]],
};

for (const potion of POTIONS.filter(item => !item.futureFeature)) {
  const milestones = POTION_RARITY_MILESTONES[potion.rarity] || POTION_RARITY_MILESTONES.common;
  for (const [count, rarity, suffix] of milestones) {
    AUTO_ACHIEVEMENTS.push({
      id:     `potion_${potion.id}_${count}`,
      cat:    "forge",
      icon:   potion.icon,
      name:   `${potion.name} · ${suffix}`,
      rarity,
      desc:   `使用「${potion.name}」${count} 次`,
      check:  c => (c.potionDex?.used?.[potion.id] || 0) >= count,
    });
  }
}

// ── 後台授予的特殊成就 ──────────────────────────────────────
export const SPECIAL_GRANTS = [
  { id: "beat_coach",  cat: "special", icon: "⚔️", name: "擊敗主教練",     rarity: "legendary", hidden: true,
    riddle: "在他面前，沒有人能輕易取勝…",             desc: "在對戰中擊敗主教練" },
  { id: "beat_yumi",   cat: "special", icon: "🗡️", name: "擊敗 Yumi 教練", rarity: "legendary", hidden: true,
    riddle: "優雅的箭術背後，是難以跨越的高牆…",       desc: "在對戰中擊敗 Yumi 教練" },
  { id: "beat_shimu",  cat: "special", icon: "🏹", name: "擊敗師母",       rarity: "legendary", hidden: true,
    riddle: "傳說中的隱藏魔王，深藏不露…",             desc: "在對戰中擊敗師母" },
  { id: "helper_mat",  cat: "special", icon: "🔨", name: "箭場小工匠",     rarity: "uncommon",
    desc: "幫忙整理箭場塌塌米" },
  { id: "helper_build",cat: "special", icon: "🏗️", name: "箭場魯班",       rarity: "rare",
    desc: "協助箭場建設工程" },
  { id: "helper_task", cat: "special", icon: "📋", name: "箭場小幫手",     rarity: "common",
    desc: "幫忙箭場日常事務" },
  { id: "helper_heart",cat: "special", icon: "💝", name: "箭場小天使",     rarity: "uncommon",
    desc: "提供情緒價值，溫暖整個箭場" },
];

// ── 屆數成就（動態產生）────────────────────────────────────
export function buildRoundAchievements(type, max, granted) {
  const list = [];
  for (let r = 1; r <= max; r++) {
    const g = (granted || []).find(x => x.type === type && x.round === r);
    list.push({
      id: `${type}_${r}`,
      cat: type,
      round: r,
      name: `第 ${r} 屆`,
      unlocked: !!g,
      rank: g ? (g.rank ?? 0) : null,
    });
  }
  return list;
}

// ── 期數成就 ───────────────────────────────────────────────
export function buildCohortAchievement(joinDate) {
  const n = getCohort(joinDate);
  return {
    id: `cohort_${n}`,
    cat: "cohort",
    icon: n === 1 ? "👑" : n === 0 ? "❓" : "🎓",
    name: cohortLabel(n),
    rarity: cohortRarity(n),
    title: cohortTitle(n),
    desc: n === 0
      ? "尚未設定加入日期，期數無法判定。請聯絡教練更新資料。"
      : `${cohortLabel(n)}（${cohortTitle(n)}）— 你在這個時期加入了貓小隊射箭場`,
    unlocked: true,
  };
}

// ── 階段式成就（TIERED） — 里程碑系統 ─────────────────────────
// 每個階段式成就只佔 1 格，隨數值成長自動替換圖示、稀有度、名稱
// 點擊後顯示進度條 + 里程碑列表

export const TIERED_ACHIEVEMENTS = [
  // ══ 啟程 — 累積報到 ══
  {
    id: "checkin", cat: "start", icon: "📍", name: "累積報到",
    desc: "完成今日任務報到，累積次數",
    replacesIds: ["checkin_1","checkin_5","checkin_10","checkin_15","checkin_20","checkin_25","checkin_30"],
    getValue: c => c.checkinCount || 0,
    tiers: [
      { count: 1,  rarity: "common",   icon: "📍", name: "初次報到",   desc: "完成第一次今日任務報到" },
      { count: 5,  rarity: "common",   icon: "🌤️", name: "漸入佳境",   desc: "累積報到 5 次" },
      { count: 10, rarity: "uncommon", icon: "🔥", name: "持之以恆",   desc: "累積報到 10 次" },
      { count: 15, rarity: "uncommon", icon: "⚡", name: "勢如破竹",   desc: "累積報到 15 次" },
      { count: 20, rarity: "rare",     icon: "💎", name: "鍛鍊有成",   desc: "累積報到 20 次" },
      { count: 25, rarity: "rare",     icon: "🌟", name: "百練成鋼",   desc: "累積報到 25 次" },
      { count: 30, rarity: "epic",     icon: "💪", name: "風雨無阻",   desc: "累積報到 30 次" },
    ],
  },

  // ══ 打怪 — 累積擊殺場數 ══
  {
    id: "monster_kills", cat: "monster", icon: "👹", name: "累積擊殺",
    desc: "累積擊敗怪物的總次數",
    replacesIds: ["monster_first","monster_5","monster_10","monster_30"],
    getValue: c => Object.values(c.monsterDex || {}).reduce((s, m) => s + (m.wins || 0), 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "👹", name: "初入戰場",   desc: "第一次擊敗怪物" },
      { count: 5,  rarity: "uncommon", icon: "⚔️", name: "身經百戰",   desc: "累積擊敗怪物 5 次" },
      { count: 10, rarity: "rare",     icon: "🗡️", name: "殺伐決斷",   desc: "累積擊敗怪物 10 次" },
      { count: 30, rarity: "epic",     icon: "🔱", name: "百戰老將",   desc: "累積擊敗怪物 30 次" },
    ],
  },

  // ══ 打怪 — 頭目擊殺 ══
  {
    id: "monster_boss", cat: "monster", icon: "🌟", name: "頭目擊殺",
    desc: "擊敗頭目（boss）級怪物的次數",
    replacesIds: ["monster_mvp1","monster_mvp10"],
    getValue: c => Object.entries(c.monsterDex || {}).filter(([id]) => id.endsWith("_5")).reduce((s, [, m]) => s + (m.wins || 0), 0),
    tiers: [
      { count: 1,  rarity: "rare",     icon: "🌟", name: "首殺頭目",   desc: "擊敗任意一隻頭目（boss）" },
      { count: 10, rarity: "legendary",icon: "💥", name: "頭目獵人",   desc: "累積擊敗頭目（boss）10 次以上" },
    ],
  },

  // ══ 煉製 — 藥水合成 ══
  {
    id: "brew", cat: "forge", icon: "🧪", name: "藥水合成",
    desc: "累積合成藥水的次數",
    replacesIds: ["brew_first","brew_5","brew_10"],
    getValue: c => (c.craftStats?.potionsCrafted || 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🧪", name: "初學煉金",   desc: "第一次合成藥水" },
      { count: 5,  rarity: "uncommon", icon: "⚗️", name: "藥水調製師", desc: "累積合成藥水 5 瓶" },
      { count: 10, rarity: "rare",     icon: "💊", name: "藥劑大師",   desc: "累積合成藥水 10 瓶" },
    ],
  },

  // ══ 煉製 — 藥水使用 ══
  {
    id: "potion_usage", cat: "forge", icon: "🧪", name: "藥水使用",
    desc: "累積在戰鬥中使用藥水的次數",
    replacesIds: ["potion_any_1","potion_any_10","potion_any_30","potion_any_50"],
    getValue: c => Object.values(c.potionDex?.used || {}).reduce((s, n) => s + n, 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🧪", name: "初識藥水",   desc: "第一次在戰鬥中使用藥水" },
      { count: 10, rarity: "uncommon", icon: "💊", name: "藥水依賴",   desc: "累積使用藥水 10 次" },
      { count: 30, rarity: "rare",     icon: "⚗️", name: "藥水大戶",   desc: "累積使用藥水 30 次" },
      { count: 50, rarity: "epic",     icon: "🔮", name: "藥水狂熱者", desc: "累積使用藥水 50 次" },
    ],
  },

  // ══ 怪物卡 — 卡片收集 ══
  {
    id: "card_collect", cat: "card", icon: "🃏", name: "怪物卡收集",
    desc: "收集不同種類的怪物卡",
    replacesIds: ["card_1","card_5","card_10","card_15","card_20"],
    getValue: c => (c.cardCount || 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🃏", name: "初探怪窟",     desc: "收集第一張怪物卡" },
      { count: 5,  rarity: "uncommon", icon: "🃏", name: "收藏家入門",   desc: "收集 5 種怪物卡" },
      { count: 10, rarity: "rare",     icon: "🃏", name: "卡片達人",     desc: "收集 10 種怪物卡" },
      { count: 15, rarity: "epic",     icon: "🃏", name: "卡片狂人",     desc: "收集 15 種怪物卡" },
      { count: 20, rarity: "legendary",icon: "🃏", name: "怪物圖鑑家",   desc: "收集 20 種怪物卡" },
    ],
  },

  // ══ 決鬥 — 累積勝場 ══
  {
    id: "duel_wins", cat: "duel", icon: "⚔️", name: "決鬥勝場",
    desc: "決鬥模式中累積獲勝的次數",
    replacesIds: ["duel_win1","duel_win5","duel_win10","duel_win25"],
    getValue: c => (c.duelStats?.wins || 0),
    tiers: [
      { count: 1,  rarity: "uncommon", icon: "🏴", name: "初勝",       desc: "決鬥模式首次獲勝" },
      { count: 5,  rarity: "rare",     icon: "⚔️", name: "百戰老將",   desc: "決鬥模式累積勝利 5 次" },
      { count: 10, rarity: "epic",     icon: "🏆", name: "決鬥大師",   desc: "決鬥模式累積勝利 10 次" },
      { count: 25, rarity: "epic",     icon: "👑", name: "決鬥王者",   desc: "決鬥模式累積勝利 25 次" },
    ],
  },

  // ══ 地下城 — 收藏品拾獲 ══
  {
    id: "collectible_progress", cat: "dungeon", icon: "🎒", name: "收藏品拾獲",
    desc: "在地下城中拾獲不同收藏品的數量",
    replacesIds: ["collectible_first","collectible_10","collectible_60","collectible_150"],
    getValue: c => Object.keys(c.member?.dungeonCollectibles || {}).length,
    tiers: [
      { count: 1,   rarity: "common",   icon: "🎒", name: "初次拾獲",       desc: "第一次在地下城拾獲收藏品" },
      { count: 10,  rarity: "uncommon", icon: "🧳", name: "小有收穫",       desc: "累積拾獲 10 種不同收藏品" },
      { count: 60,  rarity: "rare",     icon: "📦", name: "探險家的行囊",   desc: "累積拾獲 60 種不同收藏品" },
      { count: 150, rarity: "epic",     icon: "🏺", name: "秘寶收藏家",     desc: "累積拾獲 150 種不同收藏品" },
    ],
  },
];

// ── 動態加入階段式成就（Phase 2：把巨量動態系列也合併成 1 格）──────────
// 全部沿用上方 AUTO 生成用的常數（KILL_MILESTONES / CHEST_ACH_TYPES /
// POTION_RARITY_MILESTONES / FAM_ICONS…），tiers 值刻意跟舊 AUTO 對齊，
// 這樣 computeDexStats 換成用 tiered 里程碑計數後總數幾乎不變。
// replacesIds 一定要列全對應的舊 AUTO id，cellsFor 才會把舊格濾掉。

// 單一怪物擊殺次數（36 隻各 1 格，取代 kill_{id}_{5,10,25,50,100}）
for (const monster of MONSTERS) {
  TIERED_ACHIEVEMENTS.push({
    id: `kill_${monster.id}`, cat: "monster", icon: monster.icon,
    name: `${monster.name}剋星`,
    desc: `累積擊敗「${monster.name}」的次數`,
    replacesIds: KILL_MILESTONES.map(n => `kill_${monster.id}_${n}`),
    getValue: c => (c.monsterDex?.[monster.id]?.wins || 0),
    tiers: KILL_MILESTONES.map(n => ({
      count: n, rarity: KILL_RARITIES[n], icon: KILL_ICONS[n],
      name: `${monster.name}剋星 ×${n}`,
      desc: `擊敗「${monster.name}」${n} 次`,
    })),
  });
}

// 開箱次數（7 種箱各 1 格，取代 chest_{type}_open_{1,5,10,20}）
for (const ct of CHEST_ACH_TYPES) {
  TIERED_ACHIEVEMENTS.push({
    id: `chest_${ct.id}`, cat: "monster", icon: ct.icon,
    name: `${ct.name}開啟`,
    desc: `累積開啟${ct.name}的次數`,
    replacesIds: CHEST_OPEN_MILESTONES.map(n => `chest_${ct.id}_open_${n}`),
    getValue: c => (c.chestStats?.[ct.id] || 0),
    tiers: CHEST_OPEN_MILESTONES.map(n => ({
      count: n, rarity: CHEST_OPEN_RARITIES[n], icon: ct.icon,
      name: n === 1 ? `初開${ct.name}` : `${ct.name} ×${n}`,
      desc: n === 1 ? `第一次開啟${ct.name}` : `累積開啟${ct.name} ${n} 次`,
    })),
  });
}

// 每種藥水使用次數（每藥水 1 格，取代 potion_{id}_{count}）
for (const potion of POTIONS.filter(item => !item.futureFeature)) {
  const milestones = POTION_RARITY_MILESTONES[potion.rarity] || POTION_RARITY_MILESTONES.common;
  TIERED_ACHIEVEMENTS.push({
    id: `potion_${potion.id}`, cat: "forge", icon: potion.icon,
    name: `${potion.name}使用`,
    desc: `累積使用「${potion.name}」的次數`,
    replacesIds: milestones.map(([count]) => `potion_${potion.id}_${count}`),
    getValue: c => (c.potionDex?.used?.[potion.id] || 0),
    tiers: milestones.map(([count, rarity, suffix]) => ({
      count, rarity, icon: potion.icon,
      name: `${potion.name} · ${suffix}`,
      desc: `使用「${potion.name}」${count} 次`,
    })),
  });
}

// 各族討伐進度（6 族各 1 格，取代 dex_{fam}_t{1..6}）
// ⚠️ 語意調整：舊版每格＝「擊敗該族第 N 級怪物」，非單調值套不進進度條；
// 改為「擊破該族不同怪物的數量」(0~6)，單調遞增，符合里程碑模型。
// 一族只有 fam_1..fam_6 共 6 隻、且 fam_6 為神話怪，要到 6 星必然打過神話怪。
for (const fam of ["ghost","mountain","insect","workplace","exam","temple"]) {
  TIERED_ACHIEVEMENTS.push({
    id: `dex_${fam}`, cat: "monster", icon: FAM_ICONS[fam],
    name: `${FAM_LABELS[fam]}討伐`,
    desc: `擊破${FAM_LABELS[fam]}不同怪物的數量`,
    replacesIds: [1,2,3,4,5,6].map(t => `dex_${fam}_t${t}`),
    getValue: c => [1,2,3,4,5,6].filter(t => (c.monsterDex?.[`${fam}_${t}`]?.wins || 0) > 0).length,
    tiers: [1,2,3,4,5,6].map((n, i) => ({
      count: n, rarity: TIER_RARITIES_LIST[i], icon: FAM_ICONS[fam],
      name: `${FAM_LABELS[fam]}${TIER_NAMES_LIST[i]}`,
      desc: `擊破 ${n} 種${FAM_LABELS[fam]}怪物`,
    })),
  });
}

// ── Phase 3：跨系統新分類的階段式成就（練習/貓咪/貓村/裝備/決鬥歷練）──────
// 全部讀 member 文件既有欄位或 ctx.cats（子集合，由前端注入），皆為單調累積值。

TIERED_ACHIEVEMENTS.push(
  // 🎯 練習 — 終身箭數（member.totalArrowsAllTime）
  {
    id: "arrows_total", cat: "practice", icon: "🎯", name: "累積練習箭數",
    desc: "終身在系統內累積射出的箭數",
    getValue: c => c.member?.totalArrowsAllTime || 0,
    tiers: [
      { count: 100,   rarity: "common",    icon: "🎯", name: "起手式",   desc: "累積射出 100 箭" },
      { count: 500,   rarity: "common",    icon: "🏹", name: "漸上手",   desc: "累積射出 500 箭" },
      { count: 1000,  rarity: "uncommon",  icon: "🔥", name: "千箭穿楊", desc: "累積射出 1,000 箭" },
      { count: 3000,  rarity: "rare",      icon: "💪", name: "勤練不輟", desc: "累積射出 3,000 箭" },
      { count: 6000,  rarity: "epic",      icon: "⚡", name: "箭術精湛", desc: "累積射出 6,000 箭" },
      { count: 10000, rarity: "legendary", icon: "🌟", name: "萬箭大師", desc: "累積射出 10,000 箭" },
      { count: 20000, rarity: "mythic",    icon: "👑", name: "箭道傳說", desc: "累積射出 20,000 箭" },
    ],
  },

  // 🐈 貓咪（ctx.cats：cats 子集合陣列）
  {
    id: "cat_collect", cat: "cat", icon: "🐈", name: "集貓數",
    desc: "收服的貓咪夥伴數量（共 9 隻）",
    getValue: c => (c.cats || []).length,
    tiers: [
      { count: 1, rarity: "common",   icon: "🐱", name: "初識貓緣", desc: "收服第一隻貓咪" },
      { count: 3, rarity: "uncommon", icon: "🐈", name: "貓群漸聚", desc: "收服 3 隻貓咪" },
      { count: 6, rarity: "rare",     icon: "😺", name: "貓丁興旺", desc: "收服 6 隻貓咪" },
      { count: 9, rarity: "epic",     icon: "👑", name: "九貓齊聚", desc: "收服全部 9 隻貓咪" },
    ],
  },
  {
    id: "cat_level", cat: "cat", icon: "⭐", name: "貓咪等級",
    desc: "任一貓咪達到的最高等級",
    getValue: c => (c.cats || []).reduce((m, x) => Math.max(m, levelFromXP(x.catXP || 0)), 0),
    tiers: [
      { count: 10,  rarity: "common",   icon: "⭐", name: "貓咪成長",   desc: "任一貓咪達到 Lv.10" },
      { count: 30,  rarity: "uncommon", icon: "🌟", name: "獨當一面",   desc: "任一貓咪達到 Lv.30" },
      { count: 60,  rarity: "rare",     icon: "💫", name: "身經百戰",   desc: "任一貓咪達到 Lv.60" },
      { count: 100, rarity: "epic",     icon: "🔥", name: "貓中豪傑",   desc: "任一貓咪達到 Lv.100" },
      { count: 150, rarity: "legendary",icon: "⚡", name: "傳說貓將",   desc: "任一貓咪達到 Lv.150" },
      { count: 200, rarity: "mythic",   icon: "👑", name: "神話貓王",   desc: "任一貓咪達到滿等 Lv.200" },
    ],
  },
  {
    id: "cat_bond", cat: "cat", icon: "💛", name: "貓咪羈絆",
    desc: "任一貓咪累積的最高羈絆值",
    getValue: c => (c.cats || []).reduce((m, x) => Math.max(m, x.bond || 0), 0),
    tiers: [
      { count: 50,   rarity: "common",   icon: "💛", name: "漸生情誼", desc: "任一貓咪羈絆達 50" },
      { count: 200,  rarity: "uncommon", icon: "💗", name: "形影不離", desc: "任一貓咪羈絆達 200" },
      { count: 500,  rarity: "rare",     icon: "💖", name: "心有靈犀", desc: "任一貓咪羈絆達 500" },
      { count: 1000, rarity: "epic",     icon: "💞", name: "生死之交", desc: "任一貓咪羈絆達 1,000" },
    ],
  },
  {
    id: "cat_story", cat: "cat", icon: "📖", name: "貓咪故事",
    desc: "累積解鎖的貓咪故事章節數",
    getValue: c => (c.cats || []).reduce((s, x) => s + (Array.isArray(x.unlockedChapters) ? x.unlockedChapters.length : 0), 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "📖", name: "翻開扉頁", desc: "解鎖第一段貓咪故事" },
      { count: 5,  rarity: "uncommon", icon: "📚", name: "娓娓道來", desc: "累積解鎖 5 段故事" },
      { count: 10, rarity: "rare",     icon: "📜", name: "貓生百態", desc: "累積解鎖 10 段故事" },
      { count: 20, rarity: "epic",     icon: "🏆", name: "故事收藏家", desc: "累積解鎖 20 段故事" },
    ],
  },

  // 🏘️ 貓貓村（member.village.buildings）
  {
    id: "village_level", cat: "village", icon: "🏘️", name: "村莊發展",
    desc: "貓貓村的整體發展程度（各棟等級總和）",
    getValue: c => getVillageLevel(c.member?.village?.buildings || {}),
    tiers: [
      { count: 12,  rarity: "common",   icon: "🏕️", name: "拓荒立村", desc: "村莊發展度達 12" },
      { count: 30,  rarity: "uncommon", icon: "🏘️", name: "漸有規模", desc: "村莊發展度達 30" },
      { count: 60,  rarity: "rare",     icon: "🏙️", name: "繁榮興盛", desc: "村莊發展度達 60" },
      { count: 100, rarity: "epic",     icon: "🌆", name: "貓城崛起", desc: "村莊發展度達 100" },
      { count: 150, rarity: "legendary",icon: "👑", name: "貓國之光", desc: "村莊發展度達 150" },
    ],
  },
  {
    id: "building_max", cat: "village", icon: "🏗️", name: "建築等級",
    desc: "任一棟建築達到的最高等級（上限 20）",
    getValue: c => {
      const b = c.member?.village?.buildings || {};
      return Object.values(b).reduce((m, lv) => Math.max(m, Number(lv) || 0), 0);
    },
    tiers: [
      { count: 5,  rarity: "common",   icon: "🔨", name: "小有基礎", desc: "任一棟建築達 Lv.5" },
      { count: 10, rarity: "uncommon", icon: "🏗️", name: "穩紮穩打", desc: "任一棟建築達 Lv.10" },
      { count: 15, rarity: "rare",     icon: "🏛️", name: "精益求精", desc: "任一棟建築達 Lv.15" },
      { count: 20, rarity: "epic",     icon: "👑", name: "登峰造極", desc: "任一棟建築達滿級 Lv.20" },
    ],
  },

  // 🛡️ 裝備（member.rpgEquip）
  {
    id: "equip_slots", cat: "equip", icon: "🛡️", name: "裝備蒐羅",
    desc: "已裝備的槽位數（共 6 槽）",
    getValue: c => Object.values(c.member?.rpgEquip || {}).filter(e => e && e.itemId).length,
    tiers: [
      { count: 1, rarity: "common",   icon: "🗡️", name: "初出茅廬", desc: "裝上第一件裝備" },
      { count: 3, rarity: "uncommon", icon: "🛡️", name: "武裝待發", desc: "裝滿 3 個槽位" },
      { count: 6, rarity: "rare",     icon: "⚔️", name: "全副武裝", desc: "6 個槽位全數裝滿" },
    ],
  },
  {
    id: "equip_plus", cat: "equip", icon: "✨", name: "衝裝強化",
    desc: "任一件裝備達到的最高強化等級",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((m, e) => Math.max(m, Number(e?.plusLevel) || 0), 0),
    tiers: [
      { count: 1, rarity: "common",   icon: "✨", name: "初嘗強化", desc: "任一件裝備強化至 +1" },
      { count: 2, rarity: "uncommon", icon: "💫", name: "越磨越利", desc: "任一件裝備強化至 +2" },
      { count: 3, rarity: "rare",     icon: "🌟", name: "精工細琢", desc: "任一件裝備強化至 +3" },
      { count: 4, rarity: "epic",     icon: "🔥", name: "極限突破", desc: "任一件裝備強化至 +4" },
    ],
  },
  {
    id: "equip_grade", cat: "equip", icon: "💠", name: "品階突破",
    desc: "任一件裝備達到的最高品階",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((m, e) => {
      const idx = EQUIP_GRADE_ORDER.indexOf(e?.grade);
      return idx > m ? idx : m;
    }, -1) + 1, // +1 讓「無裝備」為 0、common 為 1…mythic 為 6
    tiers: [
      { count: 2, rarity: "uncommon", icon: "🔷", name: "稀有之證", desc: "任一件裝備達稀有品階" },
      { count: 3, rarity: "rare",     icon: "💠", name: "精英之器", desc: "任一件裝備達精英品階" },
      { count: 4, rarity: "epic",     icon: "🟣", name: "史詩之作", desc: "任一件裝備達史詩品階" },
      { count: 5, rarity: "legendary",icon: "🟠", name: "傳說鍛造", desc: "任一件裝備達傳說品階" },
      { count: 6, rarity: "mythic",   icon: "🔴", name: "神話神兵", desc: "任一件裝備達神話品階" },
    ],
  },
  {
    id: "equip_mythic", cat: "equip", icon: "🔴", name: "神話裝備",
    desc: "擁有神話品階裝備的件數",
    getValue: c => Object.values(c.member?.rpgEquip || {}).filter(e => e?.grade === "mythic").length,
    tiers: [
      { count: 1, rarity: "epic",      icon: "🔴", name: "神兵初現", desc: "擁有 1 件神話裝備" },
      { count: 3, rarity: "legendary", icon: "🔥", name: "神兵在握", desc: "擁有 3 件神話裝備" },
      { count: 6, rarity: "mythic",    icon: "👑", name: "神裝加身", desc: "6 槽全為神話裝備" },
    ],
  },
  {
    id: "equip_socket", cat: "equip", icon: "🕳️", name: "裝備打洞",
    desc: "全身裝備打出的符文孔總數（每件至多 3 孔）",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((s, e) => s + (Array.isArray(e?.sockets) ? e.sockets.length : 0), 0),
    tiers: [
      { count: 1,  rarity: "uncommon", icon: "🕳️", name: "初鑿一孔", desc: "打出第一個符文孔" },
      { count: 3,  rarity: "rare",     icon: "🔩", name: "孔道漸開", desc: "累積打出 3 個孔" },
      { count: 6,  rarity: "epic",     icon: "⚙️", name: "千瘡百孔", desc: "累積打出 6 個孔" },
      { count: 12, rarity: "legendary",icon: "🛠️", name: "孔孔到位", desc: "累積打出 12 個孔" },
      { count: 18, rarity: "mythic",   icon: "👑", name: "洞徹全裝", desc: "6 槽全打滿 18 個孔" },
    ],
  },
  {
    id: "equip_rune", cat: "equip", icon: "🔮", name: "符文鑲嵌",
    desc: "全身裝備已鑲嵌的符文總數",
    getValue: c => Object.values(c.member?.rpgEquip || {}).reduce((s, e) => s + (Array.isArray(e?.sockets) ? e.sockets.filter(Boolean).length : 0), 0),
    tiers: [
      { count: 1,  rarity: "uncommon", icon: "🔮", name: "初嵌符文", desc: "鑲嵌第一顆符文" },
      { count: 3,  rarity: "rare",     icon: "💎", name: "符力初成", desc: "鑲嵌 3 顆符文" },
      { count: 6,  rarity: "epic",     icon: "✨", name: "符文加持", desc: "鑲嵌 6 顆符文" },
      { count: 12, rarity: "legendary",icon: "👑", name: "符文大師", desc: "鑲嵌 12 顆符文" },
    ],
  },

  // ⚔️ 決鬥歷練 — 總參與場次（與勝場成就互補）
  {
    id: "mode_duel", cat: "duel", icon: "🎮", name: "決鬥歷練",
    desc: "累積參與決鬥的總場次（勝負不拘）",
    getValue: c => (c.duelStats?.wins || 0) + (c.duelStats?.losses || 0) + (c.duelStats?.draws || 0),
    tiers: [
      { count: 1,  rarity: "common",   icon: "🎮", name: "初登決鬥場", desc: "第一次參與決鬥" },
      { count: 5,  rarity: "uncommon", icon: "🤺", name: "決鬥常客",   desc: "累積參與決鬥 5 場" },
      { count: 10, rarity: "rare",     icon: "⚔️", name: "沙場老手",   desc: "累積參與決鬥 10 場" },
      { count: 25, rarity: "epic",     icon: "🏆", name: "百戰決鬥士", desc: "累積參與決鬥 25 場" },
    ],
  },
);

// ── Phase 3：跨系統的一次性（單次）成就（終局/收集完成）──────────
AUTO_ACHIEVEMENTS.push(
  { id: "cat_all9", cat: "cat", icon: "👑", name: "貓咪全收", rarity: "legendary", hidden: true,
    riddle: "九條貓命，一個都不能少…", desc: "收服全部 9 隻貓咪",
    check: c => (c.cats || []).length >= 9 },
  { id: "village_allbuilt", cat: "village", icon: "🏰", name: "極盛之城", rarity: "mythic", hidden: true,
    riddle: "九棟建築，全數登頂…", desc: "9 棟建築全部升到滿級 Lv.20",
    check: c => {
      const b = c.member?.village?.buildings || {};
      const vals = Object.values(b);
      return vals.length >= 9 && vals.every(lv => (Number(lv) || 0) >= 20);
    } },
  { id: "equip_full_mythic", cat: "equip", icon: "👑", name: "神裝完全體", rarity: "mythic", hidden: true,
    riddle: "六神裝，皆臻極境…", desc: "6 槽全部為神話裝備且皆強化至 +4",
    check: c => {
      const es = Object.values(c.member?.rpgEquip || {}).filter(e => e && e.itemId);
      return es.length >= 6 && es.every(e => e.grade === "mythic" && (Number(e.plusLevel) || 0) >= 4);
    } },
  { id: "equip_full_socket", cat: "equip", icon: "🔮", name: "符文全通", rarity: "legendary", hidden: true,
    riddle: "十八孔，孔孔有靈…", desc: "6 槽全部打滿 3 孔並鑲滿符文",
    check: c => {
      const es = Object.values(c.member?.rpgEquip || {}).filter(e => e && e.itemId);
      return es.length >= 6 && es.every(e => Array.isArray(e.sockets) && e.sockets.length >= 3 && e.sockets.every(Boolean));
    } },
);

// ── computeTierProgress：計算階段式成就的當前進度 ────────────
// @param {Object} tieredAch - TIERED_ACHIEVEMENTS 中的定義
// @param {Object} ctx - 上下文（含 member, monsterDex 等）
// @returns {Object|null} tierProgress
//   回傳值包含 currentValue, currentTier, nextTier, progress, tiers[] 等
export function computeTierProgress(tieredAch, ctx) {
  const value = tieredAch.getValue(ctx);
  const tiers = tieredAch.tiers;
  if (!tiers || tiers.length === 0) return null;

  // 從最高往低找，找到已達到的 tier
  let currentTierIdx = -1;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (value >= tiers[i].count) { currentTierIdx = i; break; }
  }

  const nextTierIdx = currentTierIdx + 1;
  const isComplete = nextTierIdx >= tiers.length;

  // 進度百分比：以「當前 tier 門檻 → 下一個門檻」為區間
  const prevThreshold = currentTierIdx >= 0 ? tiers[currentTierIdx].count : 0;
  const nextThreshold = isComplete
    ? tiers[tiers.length - 1].count
    : tiers[nextTierIdx].count;
  const range = nextThreshold - prevThreshold;
  const progress = range > 0
    ? Math.min(1, Math.max(0, (value - prevThreshold) / range))
    : 1;

  // 組裝里程碑列表（含 unlocked / isCurrent 狀態）
  const tierList = tiers.map((t, i) => ({
    ...t,
    unlocked: i <= currentTierIdx,
    isCurrent: i === nextTierIdx && !isComplete,
  }));

  return {
    currentValue: value,
    currentTierIndex: currentTierIdx,
    currentTier: currentTierIdx >= 0 ? tiers[currentTierIdx] : null,
    nextTier: isComplete ? null : tiers[nextTierIdx],
    isComplete,
    progress: {
      current: value,
      currentLabel: String(value),
      next: nextThreshold,
      nextLabel: String(nextThreshold),
      percent: Math.round(progress * 100),
      gap: isComplete ? 0 : nextThreshold - value,
      isComplete,
    },
    tiers: tierList,
    totalTiers: tiers.length,
    unlockedCount: currentTierIdx + 1,
  };
}

// 被階段式成就取代的舊 AUTO id（模組層級算一次）：這些改由 tiered 里程碑計數/顯示，
// 統計與「已解鎖 key」都要跳過，避免同一系列被算兩次。
export const REPLACED_BY_TIERED = new Set();
TIERED_ACHIEVEMENTS.forEach(t => (t.replacesIds || []).forEach(id => REPLACED_BY_TIERED.add(id)));

// ── getUnlockedKeys：回傳「目前已解鎖的成就 key」陣列 ────────────
// 供 App 層即時偵測 + 紅點/NEW 高亮共用。
//   單次成就 → key = id
//   階段式成就 → 每達到一個里程碑 → key = `${id}#${里程碑index}`（逐階可個別提醒）
// ctx 需含：member, cats, monsterDex, craftStats, chestStats, potionDex,
//          cardCount/mythicCards/cardFamilies, duelStats, certification, certRecords, checkinCount
export function getUnlockedKeys(ctx) {
  const keys = [];
  AUTO_ACHIEVEMENTS.forEach(a => {
    if (REPLACED_BY_TIERED.has(a.id)) return;
    try { if (a.check(ctx)) keys.push(a.id); } catch { /* 資料未就緒時忽略 */ }
  });
  TIERED_ACHIEVEMENTS.forEach(t => {
    const prog = computeTierProgress(t, ctx);
    if (!prog) return;
    for (let i = 0; i <= prog.currentTierIndex; i++) keys.push(`${t.id}#${i}`);
  });
  return keys;
}

// ── describeKey：把 getUnlockedKeys 的 key 還原成可顯示的成就資訊 ──────
export function describeKey(key) {
  if (typeof key === "string" && key.includes("#")) {
    const [id, idxStr] = key.split("#");
    const t = TIERED_ACHIEVEMENTS.find(x => x.id === id);
    const tier = t?.tiers?.[Number(idxStr)];
    if (t && tier) return { id: key, name: `${t.name}・${tier.name}`, desc: tier.desc, icon: tier.icon, rarity: tier.rarity };
    return null;
  }
  const a = AUTO_ACHIEVEMENTS.find(x => x.id === key) || SPECIAL_GRANTS.find(x => x.id === key);
  return a ? { id: a.id, name: a.name, desc: a.desc, icon: a.icon, rarity: a.rarity } : null;
}

// ── 統計 ───────────────────────────────────────────────────
export function computeDexStats({ member, certification, certRecords, checkinCount, granted, physicalMax, pointMax, monsterDex, craftStats, chestStats, potionDex, cardData, duelStats, cats }) {
  const cards       = cardData?.cards || {};
  const cardCount   = Object.keys(cards).length;
  const mythicCards = Object.values(cards).filter(c => c.tier === "mythic").length;
  const cardFamilies = [...new Set(Object.values(cards).map(c => c.family).filter(Boolean))];
  const ctx = { member, certification, certRecords, checkinCount, monsterDex: monsterDex || {}, craftStats: craftStats || {}, chestStats: chestStats || {}, potionDex: potionDex || {}, cardCount, mythicCards, cardFamilies, duelStats: duelStats || {}, cats: cats || [] };

  let autoUnlocked = 0, autoTotal = 0;
  AUTO_ACHIEVEMENTS.forEach(a => {
    if (REPLACED_BY_TIERED.has(a.id)) return; // 已被 tiered 取代，跳過（下面用里程碑計）
    autoTotal++;
    if (a.check(ctx)) autoUnlocked++;
  });

  // 階段式成就：每個里程碑各算一格（totalTiers=總格、unlockedCount=已解鎖）
  let tieredUnlocked = 0, tieredTotal = 0;
  TIERED_ACHIEVEMENTS.forEach(t => {
    const prog = computeTierProgress(t, ctx);
    if (!prog) return;
    tieredTotal    += prog.totalTiers;
    tieredUnlocked += prog.unlockedCount;
  });

  const grantedIds = new Set((granted || []).filter(g => g.type === "special").map(g => g.id || g.specialId));
  let specialUnlocked = 0;
  SPECIAL_GRANTS.forEach(a => { if (grantedIds.has(a.id)) specialUnlocked++; });

  const physicalUnlocked = (granted || []).filter(g => g.type === "physical").length;
  const pointUnlocked    = (granted || []).filter(g => g.type === "point").length;
  const cohortUnlocked   = 1; // 期數格永遠亮著

  const totalUnlocked = autoUnlocked + tieredUnlocked + specialUnlocked + physicalUnlocked + pointUnlocked + cohortUnlocked;
  const totalAll = autoTotal + tieredTotal + SPECIAL_GRANTS.length + (physicalMax || 0) + (pointMax || 0) + 1;

  let gold = 0, silver = 0, bronze = 0;
  (granted || []).forEach(g => {
    if (g.type === "physical" || g.type === "point") {
      if (g.rank === 1) gold++;
      else if (g.rank === 2) silver++;
      else if (g.rank === 3) bronze++;
    }
  });

  return { totalUnlocked, totalAll, gold, silver, bronze };
}
