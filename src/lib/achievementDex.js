// src/lib/achievementDex.js
// 數位圖鑑：里程碑成就定義 + 自動判定 + 統計

import { calcBadgePoints, getCertLevel } from "./constants";
import { getCohort, cohortRarity, cohortLabel, cohortTitle } from "./cohort";
import { MONSTERS } from "./monsterData";
import { POTIONS } from "./itemData";

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
  { id: "cohort",   label: "🎓 期數" },
  { id: "cert",     label: "🎖️ 射手證" },
  { id: "level",    label: "🏹 檢定" },
  { id: "collect",  label: "🐱 收藏" },
  { id: "physical", label: "🏆 實體賽" },
  { id: "point",    label: "⭐ 積分賽" },
  { id: "special",  label: "✨ 特殊" },
  { id: "monster",  label: "👹 打怪" },
  { id: "duel",     label: "⚔️ 決鬥" },
  { id: "forge",    label: "🔮 煉製 & 藥水" },
  { id: "card",     label: "🃏 怪物卡" },
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
  // 月卡（功能尚未實裝，check 先回傳 false）
  { id: "card_first",  cat: "start", icon: "🪪", name: "月卡初啟",  rarity: "uncommon", desc: "第一次啟動月卡",           check: _c => false },
  { id: "card_renew",  cat: "start", icon: "🔄", name: "月卡續射",  rarity: "rare",     desc: "月卡至少續約一次",         check: _c => false },

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

  // ══ 決鬥模式（功能尚未實裝，check 先回傳 false）══
  { id: "duel_first",     cat: "duel", icon: "🤺", name: "初次決鬥",   rarity: "common",
    desc: "第一次參加決鬥模式",    check: _c => false },
  { id: "duel_win1",      cat: "duel", icon: "🏴", name: "初勝",       rarity: "uncommon",
    desc: "決鬥模式首次獲勝",      check: _c => false },
  { id: "duel_win5",      cat: "duel", icon: "⚔️", name: "連戰連勝",   rarity: "rare",
    desc: "決鬥模式累積勝利 5 次", check: _c => false },
  { id: "duel_win10",     cat: "duel", icon: "🏆", name: "決鬥大師",   rarity: "epic",
    desc: "決鬥模式累積勝利 10 次",check: _c => false },
  { id: "duel_flawless",  cat: "duel", icon: "💎", name: "完美勝利",   rarity: "legendary", hidden: true,
    riddle: "一箭不差，乾淨利落…", desc: "決鬥模式以完美比分獲勝",
    check: _c => false },

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
    desc: "9 種藥水各合成過至少一次", hidden: true,
    riddle: "九味靈藥，缺一不可…",
    check: c => Object.keys(c.craftStats?.potionTypesCrafted || {}).length >= 9 },
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
    desc: "9 種藥水各使用至少一次", hidden: true,
    riddle: "九味靈藥，各嚐過一遍…",
    check: c => POTIONS.every(p => (c.potionDex?.used?.[p.id] || 0) >= 1) },

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

for (const potion of POTIONS) {
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

// ── 統計 ───────────────────────────────────────────────────
export function computeDexStats({ member, certification, certRecords, checkinCount, granted, physicalMax, pointMax, monsterDex, craftStats, chestStats, potionDex, cardData }) {
  const cards       = cardData?.cards || {};
  const cardCount   = Object.keys(cards).length;
  const mythicCards = Object.values(cards).filter(c => c.tier === "mythic").length;
  const cardFamilies = [...new Set(Object.values(cards).map(c => c.family).filter(Boolean))];
  const ctx = { member, certification, certRecords, checkinCount, monsterDex: monsterDex || {}, craftStats: craftStats || {}, chestStats: chestStats || {}, potionDex: potionDex || {}, cardCount, mythicCards, cardFamilies };

  let autoUnlocked = 0;
  AUTO_ACHIEVEMENTS.forEach(a => { if (a.check(ctx)) autoUnlocked++; });

  const grantedIds = new Set((granted || []).filter(g => g.type === "special").map(g => g.id || g.specialId));
  let specialUnlocked = 0;
  SPECIAL_GRANTS.forEach(a => { if (grantedIds.has(a.id)) specialUnlocked++; });

  const physicalUnlocked = (granted || []).filter(g => g.type === "physical").length;
  const pointUnlocked    = (granted || []).filter(g => g.type === "point").length;
  const cohortUnlocked   = 1; // 期數格永遠亮著

  const totalUnlocked = autoUnlocked + specialUnlocked + physicalUnlocked + pointUnlocked + cohortUnlocked;
  const totalAll = AUTO_ACHIEVEMENTS.length + SPECIAL_GRANTS.length + (physicalMax || 0) + (pointMax || 0) + 1;

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