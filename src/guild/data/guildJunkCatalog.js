// src/guild/data/guildJunkCatalog.js
// ─────────────────────────────────────────────────────────────
// 公會雜貨圖鑑（收藏品）。作者要求「非常非常豐富」→ 六族各 8 種 + 通用 24 種 = 72 種。
//
// 設計：
//  ① **不再自動賣掉**（2026-07-25 改）：撈到的雜貨進「雜貨倉庫」，玩家自己決定何時賣。
//     LUK 影響評估價值 → 養高 LUK 再賣是刻意留的策略空間。
//  ② **族群雜貨**：打哪一族就撈到那族的東西（辨識度＝「我今天去了哪裡」）。
//  ③ **rarity 決定出現權重與價值**；tierBias 讓高階委託更容易出好東西。
//  ④ 舊的 6 個 id（rusty_gear/old_map_scrap/monster_fang/ancient_coin/gemstone_shard/
//     mysterious_relic）**刻意保留**，舊存檔的圖鑑紀錄才不會變成孤兒。
// ─────────────────────────────────────────────────────────────

// 稀有度：權重（抽中機率）＋價值倍率
export const JUNK_RARITY = Object.freeze({
  common: { label: "常見", color: "#9ca3af", weight: 48, mult: 1.0 },
  fine:   { label: "精良", color: "#4ade80", weight: 27, mult: 1.8 },
  rare:   { label: "稀有", color: "#60a5fa", weight: 15, mult: 3.2 },
  prize:  { label: "珍品", color: "#c084fc", weight: 8,  mult: 6.0 },
  legend: { label: "傳世", color: "#fbbf24", weight: 2,  mult: 12.0 },
});

// value 是「基準價」，實際金幣/CAT幣 = value × rarity.mult × LUK 加成（見 evaluateJunk）
const J = (id, name, icon, rarity, value, family, desc) => ({ id, name, icon, rarity, value, family, desc });

export const GUILD_JUNK = Object.freeze([
  // ── 通用（任何委託都可能撈到）24 種 ──
  J("rusty_gear",       "生鏽齒輪",   "⚙️", "common", 20, null, "不知從哪台機器掉下來的，還能轉。"),
  J("old_map_scrap",    "殘破地圖",   "🗺️", "common", 24, null, "只剩一角，標記的地方早就淹水了。"),
  J("bent_nail",        "彎曲鐵釘",   "🔩", "common", 12, null, "拔出來的時候彎了，還是能賣。"),
  J("cracked_bottle",   "破口玻璃瓶", "🍶", "common", 14, null, "瓶口缺了角，裝不了水但能收藏。"),
  J("torn_ledger",      "撕爛帳本",   "📒", "common", 18, null, "誰的爛帳，看不出來了。"),
  J("monster_fang",     "怪物獠牙",   "🦷", "fine",   50, null, "尖端還沾著什麼，最好別問。"),
  J("brass_key",        "黃銅鑰匙",   "🗝️", "fine",   44, null, "沒人知道它開哪一扇門。"),
  J("cracked_lens",     "裂痕鏡片",   "🔍", "fine",   40, null, "透過它看東西，邊緣總是歪的。"),
  J("silver_thimble",   "銀頂針",     "🪡", "fine",   46, null, "縫過很多傷口的樣子。"),
  J("old_pocketwatch",  "停擺懷錶",   "⌚", "rare",   90, null, "指針停在三點十七分。"),
  J("ancient_coin",     "古代錢幣",   "🪙", "rare",   80, null, "上頭的字沒人認得。"),
  J("ivory_dice",       "象牙骰子",   "🎲", "rare",   84, null, "擲十次有七次是六，很可疑。"),
  J("sealed_letter",    "封蠟信件",   "✉️", "rare",   88, null, "封蠟完好，沒人敢拆。"),
  J("gemstone_shard",   "寶石碎片",   "💎", "prize", 120, null, "斷面折出的光比本體漂亮。"),
  J("gilded_compass",   "鎏金羅盤",   "🧭", "prize", 130, null, "指針指的方向不是北。"),
  J("music_box_core",   "音樂盒機芯", "🎼", "prize", 126, null, "上緊發條會響半首搖籃曲。"),
  J("obsidian_mirror",  "黑曜石鏡",   "🪞", "prize", 138, null, "照不出人臉，只照出輪廓。"),
  J("mysterious_relic", "神秘遺物",   "🏺", "legend", 200, null, "公會鑑定了三次，結論都是「不明」。"),
  J("dragonbone_flute", "龍骨笛",     "🎺", "legend", 230, null, "吹起來像有人在遠處哭。"),
  J("astral_fragment",  "星辰殘片",   "🌟", "legend", 260, null, "摸起來是冷的，卻在發光。"),
  J("first_guild_seal", "初代公會印", "🔱", "legend", 300, null, "公會長看到這個會沉默很久。"),
  J("copper_wire",      "銅線捆",     "🧵", "common", 16, null, "捆得很整齊，捆的人已經不在了。"),
  J("chipped_whetstone","缺角磨刀石", "🪨", "common", 22, null, "磨過太多刀，中間凹下去了。"),
  J("faded_ribbon",     "褪色緞帶",   "🎀", "fine",   38, null, "原本應該是紅色的。"),

  // ── 鬼怪族 8 種 ──
  J("ghost_incense",    "殘香灰",     "🕯️", "common", 22, "ghost", "供桌上撈的，還溫的。"),
  J("ghost_joss_paper", "燒剩金紙",   "📜", "common", 26, "ghost", "邊緣焦黑，中間的字還在。"),
  J("ghost_bell",       "招魂鈴",     "🔔", "fine",   52, "ghost", "沒風的時候也會響一下。"),
  J("ghost_red_thread", "紅線團",     "🧶", "fine",   48, "ghost", "解不開，也剪不斷。"),
  J("ghost_spirit_tag", "靈牌碎木",   "🪧", "rare",   94, "ghost", "上面的名字被刮掉了。"),
  J("ghost_lantern",    "無主燈籠",   "🏮", "rare",   98, "ghost", "自己會亮，不用點。"),
  J("ghost_jade_seal",  "陰陽玉印",   "🔮", "prize", 140, "ghost", "蓋下去的印痕會慢慢消失。"),
  J("ghost_soul_coin",  "渡河冥錢",   "💀", "legend", 240, "ghost", "據說是給船夫的錢。"),

  // ── 山林族 8 種 ──
  J("mtn_pine_resin",   "松脂塊",     "🌲", "common", 20, "mountain", "黏手，但味道很好。"),
  J("mtn_boar_bristle", "山豬鬃毛",   "🐗", "common", 24, "mountain", "硬得可以當刷子。"),
  J("mtn_river_stone",  "溪石",       "🪨", "fine",   42, "mountain", "被水磨了幾百年才這麼圓。"),
  J("mtn_eagle_feather","鷹羽",       "🪶", "fine",   50, "mountain", "拿在手上會想抬頭看天。"),
  J("mtn_snake_skin",   "蛇蜕",       "🐍", "rare",   92, "mountain", "完整一條，連眼睛的部分都在。"),
  J("mtn_bear_claw",    "熊爪",       "🐾", "rare",  100, "mountain", "比手掌還長。"),
  J("mtn_mountain_jade","山心玉",     "💚", "prize", 134, "mountain", "山裡最深處才有的顏色。"),
  J("mtn_ancient_seed", "太古種子",   "🌱", "legend", 250, "mountain", "種下去會長出什麼，沒人敢試。"),

  // ── 毒蟲族 8 種 ──
  J("ins_chitin_shard", "甲殼碎片",   "🪳", "common", 18, "insect", "踩到會有聲音。"),
  J("ins_honeycomb",    "空蜂巢",     "🍯", "common", 26, "insect", "蜜已經被誰吃光了。"),
  J("ins_wing_dust",    "翅粉",       "🦋", "fine",   44, "insect", "沾到手上會發亮三天。"),
  J("ins_venom_vial",   "毒液瓶",     "🧪", "fine",   54, "insect", "公會規定要雙層包裝。"),
  J("ins_amber_bug",    "琥珀蟲",     "🟠", "rare",   96, "insect", "被封在裡面的東西還在動？"),
  J("ins_queen_stinger","蟲后尾刺",   "🦂", "rare",  102, "insect", "拔下來的時候整個巢都在叫。"),
  J("ins_hive_crown",   "蟲巢王冠",   "👑", "prize", 142, "insect", "不是金屬，是分泌物硬化的。"),
  J("ins_god_carapace", "蟲神殼片",   "🪲", "legend", 245, "insect", "薄得透光，卻砍不破。"),

  // ── 職場族 8 種 ──
  J("wp_stapler",       "壞掉釘書機", "📎", "common", 16, "workplace", "卡紙卡到報廢。"),
  J("wp_coffee_stain",  "咖啡漬文件", "☕", "common", 20, "workplace", "重點都被咖啡蓋住了。"),
  J("wp_name_plate",    "離職名牌",   "🏷️", "fine",   46, "workplace", "名字還在，人已經走了。"),
  J("wp_broken_mug",    "裂痕馬克杯", "🍵", "fine",   40, "workplace", "「世界最佳員工」，杯耳掉了。"),
  J("wp_golden_stapler","鎏金釘書機", "🥇", "rare",   98, "workplace", "傳說中年終最高的那位用的。"),
  J("wp_blank_cheque",  "空白支票",   "💸", "rare",  104, "workplace", "簽名欄是空的，金額欄也是。"),
  J("wp_ceo_seal",      "總裁私印",   "🤵", "prize", 145, "workplace", "蓋下去就是命令。"),
  J("wp_capital_core",  "資本核心",   "💰", "legend", 265, "workplace", "看久了會覺得自己很渺小。"),

  // ── 考試族 8 種 ──
  J("ex_red_pen",       "沒水紅筆",   "🖊️", "common", 14, "exam", "改到沒水，還是改不完。"),
  J("ex_crumpled_test", "皺掉考卷",   "📄", "common", 18, "exam", "分數的地方被揉爛了。"),
  J("ex_lucky_eraser",  "許願橡皮擦", "🧽", "fine",   42, "exam", "背面寫著「這次一定要過」。"),
  J("ex_night_coffee",  "熬夜咖啡罐", "🥫", "fine",   44, "exam", "第七罐，手在抖。"),
  J("ex_perfect_paper", "滿分考卷",   "💯", "rare",   96, "exam", "有人把它藏了二十年。"),
  J("ex_admission_tag", "准考證",     "🎯", "rare",  100, "exam", "那一年的夢想都在這張紙上。"),
  J("ex_scholar_seal",  "狀元印",     "🏛️", "prize", 136, "exam", "據說摸了會變聰明（沒有）。"),
  J("ex_system_core",   "制度本質",   "🏫", "legend", 255, "exam", "拿在手上的人都沉默了。"),

  // ── 西方怪物族 8 種 ──
  J("tp_bone_dust",     "骨粉",       "🦴", "common", 20, "temple", "掃地掃出來的，很多。"),
  J("tp_candle_stub",   "燭台殘蠟",   "🕯️", "common", 22, "temple", "融了又凝固了七次。"),
  J("tp_silver_cross",  "銀十字",     "✝️", "fine",   52, "temple", "背面刻著看不懂的名字。"),
  J("tp_wolf_pelt",     "狼人毛皮",   "🐺", "fine",   56, "temple", "月圓的時候會豎起來。"),
  J("tp_vampire_fang",  "吸血鬼牙",   "🧛", "rare",  100, "temple", "碰到陽光會冒煙。"),
  J("tp_grimoire_page", "魔典殘頁",   "📕", "rare",  106, "temple", "讀第三行會頭痛。"),
  J("tp_lich_crown",    "巫妖冠飾",   "☠️", "prize", 148, "temple", "戴過它的人都還「活著」。"),
  J("tp_dragon_scale",  "末日龍鱗",   "🐲", "legend", 280, "temple", "一片就能擋下一支軍隊。"),
]);

export const JUNK_BY_ID = Object.freeze(Object.fromEntries(GUILD_JUNK.map(j => [j.id, j])));

// 該委託會撈到的雜貨池：通用 + 該委託族群的（多元種族全算）
export function junkPoolFor(families = []) {
  const set = new Set(families);
  return GUILD_JUNK.filter(j => !j.family || set.has(j.family));
}

// 依稀有度權重抽一件；tierBias（危險度 1~6）讓高階更容易出好東西
export function drawJunk(pool, rand = Math.random, tierBias = 1) {
  if (!pool.length) return null;
  const bias = Math.max(1, tierBias);
  const weighted = pool.map(j => {
    const r = JUNK_RARITY[j.rarity] || JUNK_RARITY.common;
    // 高危險度：稀有度越高的權重被放大（bias^倍率指數）
    const boost = Math.pow(bias, Math.log2(r.mult + 1) / 2);
    return { j, w: r.weight * boost };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let roll = rand() * total;
  for (const x of weighted) { roll -= x.w; if (roll <= 0) return x.j; }
  return weighted[weighted.length - 1].j;
}

// 單件雜貨的賣出價：基準價 × 稀有度倍率 × LUK 評估加成
// 金幣 70%、CAT幣 30%/10（沿用原本的分配，只是改成「賣的時候才算」）
export function evaluateJunk(junkItem, valuationMult = 1) {
  const j = typeof junkItem === "string" ? JUNK_BY_ID[junkItem] : junkItem;
  if (!j) return { coins: 0, catCoins: 0 };
  const r = JUNK_RARITY[j.rarity] || JUNK_RARITY.common;
  const val = Math.round((j.value || 0) * r.mult * (valuationMult || 1));
  return { coins: Math.round(val * 0.7), catCoins: Math.max(1, Math.round((val * 0.3) / 10)) };
}
