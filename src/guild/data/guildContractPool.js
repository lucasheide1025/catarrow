// src/guild/data/guildContractPool.js
// ─────────────────────────────────────────────────────────────
// 委託板的「故事素材庫」：委託人 × 族群 × 危險度 → 一張有味道的委託單。
// 這裡只有文案與挑選規則，沒有任何數值（數值全在 guildLootTable / rollExpedition）。
// 加委託只要往這張表加資料，不用改邏輯。
// ─────────────────────────────────────────────────────────────

// 委託人（發委託的 NPC）。名字刻意台味，跟怪物族群的在地感一致。
export const CONTRACT_CLIENTS = Object.freeze([
  { id: "temple_keeper", name: "廟公阿伯", icon: "🧓", tone: "焦急" },
  { id: "market_auntie", name: "菜市場阿姨", icon: "👩‍🌾", tone: "碎念" },
  { id: "night_guard",   name: "夜班警衛",   icon: "💂", tone: "疲憊" },
  { id: "shop_owner",    name: "雜貨店老闆", icon: "🧑‍🦱", tone: "精打細算" },
  { id: "school_nurse",  name: "學校護理師", icon: "👩‍⚕️", tone: "擔憂" },
  { id: "hiker",         name: "登山客",     icon: "🧗", tone: "驚魂未定" },
  { id: "office_worker", name: "加班上班族", icon: "🧑‍💼", tone: "崩潰" },
  { id: "cat_lady",      name: "餵貓的婆婆", icon: "👵", tone: "心疼" },
]);

// 每個族群的委託文案（title 用 {danger} 語氣區分，story 給氛圍）
export const CONTRACT_STORIES = Object.freeze({
  ghost: [
    { title: "廟埕的夜半腳步聲", story: "連續三天了，收攤後總聽見有人在廟埕走來走去，回頭卻空無一人。" },
    { title: "供品失竊事件",     story: "供桌上的供品每晚都少一份，監視器只拍到一團霧。" },
    { title: "巷口的紅衣身影",   story: "有人看到巷口站著紅衣女子，走近就不見了，孩子們嚇得不敢回家。" },
  ],
  mountain: [
    { title: "山徑的獠牙訪客",   story: "登山口的垃圾桶被翻爛，泥地上留著比手掌還大的蹄印。" },
    { title: "獵徑上的低吼",     story: "採筍的人聽見樹林深處傳來低吼，整片山突然安靜下來。" },
    { title: "溪邊的巨大足跡",   story: "溪邊的石頭被翻動，留下一串往上游去的足跡。" },
  ],
  insect: [
    { title: "倉庫的窸窣聲",     story: "倉庫米袋被咬破，牆角堆著蛻下來的殼，數量多到不敢細看。" },
    { title: "虎頭蜂築巢通報",   story: "校園樹上出現臉盆大的蜂巢，已經有人被螫傷送醫。" },
    { title: "下水道的甲殼群",   story: "半夜掀開水溝蓋，底下密密麻麻反著光。" },
  ],
  workplace: [
    { title: "永無止盡的加班單", story: "整層樓的燈到凌晨還亮著，聽說有人已經三天沒回家了。" },
    { title: "奧客巡迴投訴",     story: "同一位客人每天來鬧一次，店員一個接一個離職。" },
    { title: "漲租通知風暴",     story: "整條街的租約同時到期，房東的信封像雪片一樣飛來。" },
  ],
  exam: [
    { title: "考卷海嘯",         story: "教室堆滿了改不完的考卷，紙山已經高過窗台。" },
    { title: "深夜的翻書聲",     story: "圖書館閉館後仍傳出翻書聲，警衛巡了三趟都找不到人。" },
    { title: "模擬考連環撞",     story: "這週第五場模擬考，孩子們的眼神已經失去光彩。" },
  ],
  temple: [
    { title: "廢墟裡的骨頭聲",   story: "老屋改建工地入夜後傳出骨頭碰撞的聲音，工人罷工了。" },
    { title: "月圓夜的爪痕",     story: "牧場的圍欄被撕開，留下三道深深的爪痕。" },
    { title: "地窖的低語",       story: "整修老宅時打開了封死的地窖，從此屋裡沒人睡得著。" },
  ],
});

// 危險度語氣（貼在委託單上，讓玩家一眼知道輕重）
export const DANGER_TONE = Object.freeze({
  1: { tag: "例行委託", hint: "公會新手也接得起來。" },
  2: { tag: "警戒委託", hint: "已經有人受傷，別大意。" },
  3: { tag: "緊急委託", hint: "上一隊沒能回來。" },
});

export const CONTRACTS_PER_DAY = 5;
