// src/lib/dungeonEventPool.js
// 地下城事件池（重製版）。分兩類：
//   GENERAL_EVENTS 一般事件：只正面/中性/搞笑，絕無負面。踩到即結算。
//   SPECIAL_EVENTS 特殊事件：玩家選擇 × 風險報酬，可含負面。
// 設計規則：所有加成/減益一律 ≤ ±10%（乘算以「本層」計）。金幣為定額；道具給 id；純劇情 effect:{}。
// effect 欄位（皆為本層、可組合）：
//   hp   +0.10 = 回復 10% 最大血；  atk/def/dmg ±0.10 = 本層倍率 ±10%
//   monsterHp/monsterAtk ±0.10 = 本層怪物倍率；  gold = 定額金幣；  item = 道具 id
//   cost:{ hp:0.2 } / cost:{ gold:50 } = 選擇的代價（特殊事件用）
// 尚未接線；接線見 TODO（新增房型「general_event」、特殊事件選擇 UI、effect handler、舊 DUNGEON_EVENTS 併入）。

// ───────────────────────── 一般事件（正面/中性/搞笑）─────────────────────────
export const GENERAL_EVENTS = [
  { id:"g_fishjerky",  icon:"🐟", title:"魚乾一條",     desc:"撿到一條魚乾，分給大家啃 → 全隊 ATK +5%（本層）", effect:{ atk:0.05 } },
  { id:"g_cardboard",  icon:"📦", title:"紙箱！",       desc:"一個完美的紙箱，全隊搶著鑽，士氣爆棚 → ATK +10%", effect:{ atk:0.10 } },
  { id:"g_yarn",       icon:"🧶", title:"毛線球",       desc:"玩毛線球玩到忘我，忘了累 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_catnip",     icon:"🌿", title:"貓薄荷",       desc:"踩到一叢貓薄荷，全隊嗨到不行 → ATK +10%", effect:{ atk:0.10 } },
  { id:"g_pawcoin",    icon:"🐾", title:"貓掌印硬幣",   desc:"撿到一枚印著肉球的可疑硬幣 → +30 金幣", effect:{ gold:30 } },
  { id:"g_tailscare",  icon:"😹", title:"尾巴驚魂",     desc:"隊友被自己的尾巴嚇到，全隊笑翻 → 回復 5% 血", effect:{ hp:0.05 } },
  { id:"g_canfloor",   icon:"🥫", title:"罐罐意外",     desc:"打翻罐罐，吃了地上的（有點髒但沒事）→ 回復 8% 血", effect:{ hp:0.08 } },
  { id:"g_feather",    icon:"🪶", title:"追羽毛",       desc:"追一根羽毛追到岔路盡頭，發現一小袋金幣 → +40 金幣", effect:{ gold:40 } },
  { id:"g_rock",       icon:"😐", title:"一顆石頭",     desc:"一顆石頭。就一顆石頭。你盯著它看了很久。（無事發生）", effect:{} },
  { id:"g_sunbath",    icon:"💤", title:"日光浴",       desc:"陽光正好，全隊躺平睡了五分鐘 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_fatcat",     icon:"🐈", title:"擋路肥貓",     desc:"一隻更肥的貓擋在路中央，摸了三下牠才心滿意足讓開 → +20 金幣", effect:{ gold:20 } },
  { id:"g_toiletroll", icon:"🧻", title:"衛生紙災難",   desc:"玩衛生紙玩到整條走廊都是，清理花了點時間（純蠢，無事）", effect:{} },
  { id:"g_laserdot",   icon:"🔴", title:"紅點！",       desc:"牆上出現一個紅點，全隊瘋狂追逐，運動完神清氣爽 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_box2",       icon:"🎁", title:"破木箱",       desc:"路邊一個破木箱，撬開發現一瓶藥水 → 獲得回復藥", effect:{ item:"hp_potion" } },
  { id:"g_nap",        icon:"😴", title:"貓式午睡",     desc:"忍不住打了個盹，醒來精神奕奕 → 回復 7% 血", effect:{ hp:0.07 } },
  { id:"g_mousegift",  icon:"🐭", title:"老鼠的貢品",   desc:"一隻老鼠嚇得把偷來的金幣全吐出來 → +35 金幣", effect:{ gold:35 } },
  { id:"g_grooming",   icon:"👅", title:"互相理毛",     desc:"全隊互相理毛，感情升溫、防禦更穩 → DEF +10%", effect:{ def:0.10 } },
  { id:"g_stretch",    icon:"🙆", title:"伸懶腰",       desc:"一個超長的伸懶腰，筋骨都鬆開了 → ATK +5%、DEF +5%", effect:{ atk:0.05, def:0.05 } },
  { id:"g_shinything", icon:"✨", title:"閃亮亮",       desc:"地上有個閃亮的東西，撿起來是…一張糖果紙。但下面壓著 25 金幣 → +25 金幣", effect:{ gold:25 } },
  { id:"g_birdwatch",  icon:"🐦", title:"賞鳥",         desc:"隔窗看鳥，喉嚨發出咔咔聲，莫名充滿鬥志 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_warmspot",   icon:"☀️", title:"溫暖的角落",   desc:"找到一個曬得暖暖的角落，全隊回血 → 回復 9% 血", effect:{ hp:0.09 } },
  { id:"g_zoomies",    icon:"💨", title:"午夜暴衝",     desc:"突如其來的暴衝，繞地圖跑了三圈，體能大增 → ATK +10%", effect:{ atk:0.10 } },
  { id:"g_treatbag",   icon:"🍬", title:"零食袋",       desc:"發現一整袋貓零食，大快朵頤 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_stare",      icon:"🫥", title:"凝視虛空",     desc:"全隊突然一起盯著牆角的某個點看。那裡什麼都沒有。（無事發生）", effect:{} },
  { id:"g_bellrub",    icon:"🤍", title:"露肚肚",       desc:"一隊友翻肚要人摸，摸完全隊都放鬆了 → DEF +5%", effect:{ def:0.05 } },
  { id:"g_slipperfish", icon:"🐠", title:"拖鞋裡的魚",  desc:"不知道誰把一條小魚藏在拖鞋裡，撿到分著吃 → 回復 6% 血", effect:{ hp:0.06 } },
  { id:"g_coincat",    icon:"💰", title:"招財貓",       desc:"一尊招財貓對你揮手，掉出幾枚金幣 → +50 金幣", effect:{ gold:50 } },
  { id:"g_hairball",   icon:"🤢", title:"吐毛球",       desc:"一隊友吐了個毛球，眾人嫌棄但也鬆了口氣（純劇情，無事）", effect:{} },
  { id:"g_windowsill", icon:"🪟", title:"窗台巡邏",     desc:"沿著窗台巡邏一圈，確認領地安全，安心加成 → DEF +8%", effect:{ def:0.08 } },
  { id:"g_papercut",   icon:"📄", title:"公文紙飛機",   desc:"把陷阱房沒收的公文折成紙飛機射出去，莫名爽快 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_snackcoin",  icon:"🪙", title:"沙發縫金幣",   desc:"在破沙發的縫裡挖出幾枚被遺忘的金幣 → +30 金幣", effect:{ gold:30 } },
  { id:"g_purrmotor",  icon:"🎵", title:"呼嚕引擎",     desc:"全隊一起呼嚕，療癒到骨子裡 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_potplant",   icon:"🪴", title:"啃盆栽",       desc:"啃了一口盆栽，苦，但莫名提神 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_deadbug",    icon:"🪳", title:"贈禮",         desc:"一隊友叼來一隻…蟑螂當禮物。心意收下（純劇情，無事）", effect:{} },
  { id:"g_freshbox",   icon:"📦", title:"限定紙箱",     desc:"又一個紙箱，但這個更好，全隊排隊輪流鑽 → ATK +10%", effect:{ atk:0.10 } },
  { id:"g_moonwatch",  icon:"🌙", title:"對月長嚎",     desc:"對著月亮嚎了幾聲，中二能量爆發 → ATK +8%", effect:{ atk:0.08 } },
  { id:"g_kneadbread", icon:"🍞", title:"踏踏麵包",     desc:"忍不住開始踏踏，全隊放鬆，防禦更穩 → DEF +10%", effect:{ def:0.10 } },
  { id:"g_lostkitten", icon:"🐱", title:"迷路小貓",     desc:"帶一隻迷路小貓回家，牠塞給你一枚謝禮 → +40 金幣", effect:{ gold:40 } },
  { id:"g_sockthief",  icon:"🧦", title:"襪子大盜",     desc:"從某處偷來一堆襪子，一無所用但很開心（純劇情，無事）", effect:{} },
  { id:"g_freshwater", icon:"💧", title:"流動的水",     desc:"發現一處會流動的水，比碗裡的好喝一萬倍 → 回復 8% 血", effect:{ hp:0.08 } },
  { id:"g_tunacan",    icon:"🐟", title:"鮪魚罐頭",     desc:"開了一整罐鮪魚，士氣與體力雙滿 → ATK +5%、回復 5% 血", effect:{ atk:0.05, hp:0.05 } },
  { id:"g_stringlaw",  icon:"🪢", title:"繩子物理學",   desc:"研究一條繩子研究了很久，變聰明了（並沒有）（無事）", effect:{} },
  { id:"g_warmlaundry",icon:"🧺", title:"剛烘好的衣服",  desc:"跳進一籃剛烘好的衣服，暖到融化 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_beetlefren", icon:"🪲", title:"甲蟲朋友",     desc:"跟一隻甲蟲對看了三分鐘，成為朋友（純劇情，無事）", effect:{} },
  { id:"g_highplace",  icon:"🗼", title:"登高稱王",     desc:"爬到最高處俯視全場，王者氣勢外洩 → ATK +8%", effect:{ atk:0.08 } },
  { id:"g_snackbribe", icon:"🍤", title:"炸蝦賄賂",     desc:"路過的小販用炸蝦換情報，你收下了蝦（沒給情報）→ 回復 6% 血", effect:{ hp:0.06 } },
  { id:"g_dustbunny",  icon:"🌀", title:"灰塵兔",       desc:"追一團滾動的灰塵追到底，撞出牆縫裡的金幣 → +25 金幣", effect:{ gold:25 } },
  { id:"g_catloaf",    icon:"🍞", title:"擺成土司",     desc:"全隊擺成土司形狀發呆，充飽了電 → 回復 9% 血", effect:{ hp:0.09 } },
  { id:"g_ribbon",     icon:"🎀", title:"緞帶",         desc:"被一條緞帶纏住掙扎許久，運動量達標 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_oldfishbone",icon:"🦴", title:"上古魚骨",     desc:"發現一根古老的大魚骨，收藏價值不明 → +35 金幣", effect:{ gold:35 } },
  { id:"g_mirrorcat",  icon:"🪞", title:"鏡中之敵",     desc:"對著鏡子哈氣炸毛半天，發現是自己，尷尬但暖身完成 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_lickpaw",    icon:"🐾", title:"洗手手",       desc:"認真洗了手手，整潔使人安心 → DEF +6%", effect:{ def:0.06 } },
  { id:"g_wetfood",    icon:"🍲", title:"開飯時間",     desc:"聽到罐頭聲全隊集合，吃飽喝足 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_squirrel",   icon:"🐿️", title:"松鼠挑釁",     desc:"隔玻璃跟松鼠對峙，鬥志被點燃 → ATK +8%", effect:{ atk:0.08 } },
  { id:"g_snoozecoin", icon:"💤", title:"睡到有錢",     desc:"睡著時金幣自己滾進口袋（別問）→ +20 金幣", effect:{ gold:20 } },
  { id:"g_paperbag",   icon:"🛍️", title:"紙袋刺客",     desc:"躲進紙袋伏擊空氣，成功（？）→ ATK +5%", effect:{ atk:0.05 } },
  { id:"g_warmpc",     icon:"💻", title:"溫暖的鍵盤",   desc:"趴在一塊發熱的板子上取暖，充電完畢 → 回復 7% 血", effect:{ hp:0.07 } },
  { id:"g_leaf",       icon:"🍃", title:"一片葉子",     desc:"一片葉子飄過。你出拳。沒打中。但很帥（無事發生）", effect:{} },
  { id:"g_treasuremap",icon:"🗺️", title:"藏寶圖碎片",   desc:"撿到一張皺皺的藏寶圖碎片，看不懂但很值錢 → +45 金幣", effect:{ gold:45 } },
  { id:"g_potiondrop", icon:"🧪", title:"滾來的藥水",   desc:"一瓶藥水從斜坡滾到腳邊 → 獲得回復藥", effect:{ item:"hp_potion" } },
  { id:"g_grouphug",   icon:"🫂", title:"貓貓疊疊樂",   desc:"全隊疊成一坨取暖，防禦與默契提升 → DEF +8%", effect:{ def:0.08 } },
  { id:"g_bugsnack",   icon:"🦗", title:"加菜",         desc:"抓到一隻蟋蟀加菜，蛋白質補滿 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_finecoin",   icon:"🪙", title:"罰款回收",     desc:"從陷阱房的罰單堆裡挑出還能用的金幣 → +30 金幣", effect:{ gold:30 } },
  { id:"g_bigstretch", icon:"🧘", title:"貓瑜珈",       desc:"做了一套完整的貓瑜珈，身心平衡 → ATK +5%、DEF +5%", effect:{ atk:0.05, def:0.05 } },
  { id:"g_staringwall",icon:"🧱", title:"牆壁研討會",   desc:"全隊圍著一面牆開了場研討會，結論是：牆。（無事發生）", effect:{} },
  { id:"g_babycat",    icon:"🐈‍⬛", title:"黑貓幼崽",    desc:"一隻黑貓幼崽跟著你走了一段，臨走前送你金幣 → +40 金幣", effect:{ gold:40 } },
  { id:"g_softblanket",icon:"🛌", title:"軟綿綿毯子",   desc:"陷進一條軟毯裡，回血又回魂 → 回復 10% 血", effect:{ hp:0.10 } },
  { id:"g_windchime",  icon:"🎐", title:"風鈴",         desc:"風鈴叮噹，心情大好，出手更準 → ATK +5%", effect:{ atk:0.05 } },
  { id:"g_emptyroom",  icon:"🚪", title:"空房間",       desc:"打開一扇門，裡面空空如也。你關上門，假裝沒發生。（無事發生）", effect:{} },
];

// ───────────────────────── 特殊事件（選擇 × 風險報酬）─────────────────────────
// choices：每個選項 { label, cost?, effect, hint? }；玩家二選一（或含「離開」）。
export const SPECIAL_EVENTS = [
  { id:"s_catshrine", icon:"🗿", title:"古老貓神像", desc:"一尊斑駁的貓神像凝視著你。",
    choices:[
      { label:"獻上 20% 血", cost:{ hp:0.20 }, effect:{ atk:0.10 }, hint:"本層 ATK +10%" },
      { label:"合掌拜拜離開", effect:{} },
    ] },
  { id:"s_scale", icon:"⚖️", title:"命運天秤", desc:"一座天秤，兩端各刻著攻與守。",
    choices:[
      { label:"選左（攻）", effect:{ atk:0.10, def:-0.10 }, hint:"ATK +10% / DEF −10%" },
      { label:"選右（守）", effect:{ def:0.10, atk:-0.10 }, hint:"DEF +10% / ATK −10%" },
    ] },
  { id:"s_fishing", icon:"🎣", title:"深潭釣魚", desc:"黑水潭裡似乎有東西在動。",
    choices:[
      { label:"花 50 金下竿", cost:{ gold:50 }, effect:{ randomItem:true }, hint:"隨機：藥水/材料/空鉤" },
      { label:"不釣，走人", effect:{} },
    ] },
  { id:"s_ratcasino", icon:"🐭", title:"老鼠賭場", desc:"幾隻老鼠開了個小賭局，邀你下注下一場戰鬥。",
    choices:[
      { label:"押注（賭金幣）", effect:{ betNextBattle:0.10 }, hint:"贏 金幣×1.1 / 輸 ×0.9" },
      { label:"不賭", effect:{} },
    ] },
  { id:"s_darkbowl", icon:"🥣", title:"漆黑的碗", desc:"一個裝著不明液體的碗。看起來…可以喝？",
    choices:[
      { label:"喝下去", effect:{ random:[{ hp:0.10 }, { atk:0.10 }, { def:-0.10 }] }, hint:"隨機好或壞" },
      { label:"打翻它", effect:{} },
    ] },
  { id:"s_twopaths", icon:"🌫️", title:"詭霧岔路", desc:"兩條路：一條霧濃但近，一條乾淨但遠。",
    choices:[
      { label:"衝濃霧（近）", effect:{ monsterHp:-0.10, def:-0.10 }, hint:"本層怪 HP −10% / 我方 DEF −10%" },
      { label:"繞乾淨路（遠）", effect:{ hp:0.05 }, hint:"安全，回 5% 血" },
    ] },
  { id:"s_beggar", icon:"🙏", title:"落魄的浪貓", desc:"一隻餓扁的浪貓伸出爪子。",
    choices:[
      { label:"給 40 金幣", cost:{ gold:40 }, effect:{ atk:0.10 }, hint:"牠回報祝福：本層 ATK +10%" },
      { label:"視而不見", effect:{} },
    ] },
  { id:"s_button", icon:"🔴", title:"一顆按鈕", desc:"牆上一顆紅色按鈕，寫著「別按」。",
    choices:[
      { label:"按下去", effect:{ random:[{ gold:60 }, { monsterAtk:0.10 }] }, hint:"賭一把：獎勵或麻煩" },
      { label:"忍住不按", effect:{ def:0.05 }, hint:"自制力使人強大：DEF +5%" },
    ] },
  { id:"s_mirror", icon:"🪞", title:"魔鏡", desc:"鏡中的你露出詭異微笑。",
    choices:[
      { label:"擊碎鏡子", effect:{ atk:0.10, hp:-0.05 }, hint:"ATK +10% / 割傷 −5% 血" },
      { label:"轉身離開", effect:{} },
    ] },
  { id:"s_altarfast", icon:"🕯️", title:"禁食祭壇", desc:"祭壇要求你放棄一頓飯。",
    choices:[
      { label:"禁食（不回血）", effect:{ atk:0.10, noRest:true }, hint:"本層 ATK +10%，但本層休息無效" },
      { label:"拒絕", effect:{} },
    ] },
  { id:"s_dice", icon:"🎲", title:"命運骰子", desc:"一顆會自己滾的骰子。",
    choices:[
      { label:"擲骰", effect:{ random:[{ atk:0.10 }, { def:0.10 }, { hp:0.10 }, { atk:-0.10 }] }, hint:"四選一隨機（多為好事）" },
      { label:"收進口袋不玩", effect:{ gold:10 } },
    ] },
  { id:"s_kittentax", icon:"🧾", title:"貓咪過路費", desc:"一隻收費員貓伸手要過路費。",
    choices:[
      { label:"付 30 金", cost:{ gold:30 }, effect:{ hp:0.10 }, hint:"牠帶你走捷徑：回 10% 血" },
      { label:"硬闖", effect:{ monsterAtk:0.05 }, hint:"惹毛牠：本層怪 ATK +5%" },
    ] },
  { id:"s_freshfish", icon:"🐟", title:"新鮮 vs 加倍", desc:"漁夫貓給你選：現在一條，或賭之後兩條。",
    choices:[
      { label:"現在吃一條", effect:{ hp:0.06 }, hint:"穩穩回 6% 血" },
      { label:"賭之後兩條", effect:{ random:[{ hp:0.10 }, {}] }, hint:"一半機率回 10%，一半空手" },
    ] },
  { id:"s_napnow", icon:"😴", title:"睡一下下", desc:"一張超舒服的床。但時間寶貴。",
    choices:[
      { label:"睡（回血）", effect:{ hp:0.10, monsterHp:0.05 }, hint:"回 10% 血，但怪也養精蓄銳 +5% HP" },
      { label:"不睡趕路", effect:{ atk:0.05 }, hint:"保持警覺：ATK +5%" },
    ] },
  { id:"s_luckycoin", icon:"🪙", title:"許願池", desc:"一口許願池，水底閃著金光。",
    choices:[
      { label:"投 20 金許願", cost:{ gold:20 }, effect:{ random:[{ gold:60 }, { atk:0.10 }, {}] }, hint:"隨機回饋" },
      { label:"撈池底金幣", effect:{ gold:20, monsterAtk:0.05 }, hint:"+20 金但驚動守衛：怪 ATK +5%" },
    ] },
  { id:"s_spicy", icon:"🌶️", title:"神秘辣椒", desc:"一根紅通通的辣椒，貓竟然想吃？",
    choices:[
      { label:"吃辣", effect:{ atk:0.10, def:-0.05 }, hint:"火力全開 ATK +10% / 亂了陣腳 DEF −5%" },
      { label:"不吃", effect:{} },
    ] },
  { id:"s_twoboxes", icon:"🎁", title:"兩個箱子", desc:"一大一小兩個箱子，只能開一個。",
    choices:[
      { label:"開大箱", effect:{ random:[{ gold:60 }, { monsterAtk:0.10 }] }, hint:"大獎或大雷" },
      { label:"開小箱", effect:{ gold:20 }, hint:"穩穩 +20 金" },
    ] },
  { id:"s_ghosttoll", icon:"👻", title:"幽靈收費站", desc:"一縷幽靈飄來，要求「一點點」東西。",
    choices:[
      { label:"給牠 5% 血", cost:{ hp:0.05 }, effect:{ gold:50 }, hint:"換得 +50 金幣" },
      { label:"念念有詞趕走", effect:{} },
    ] },
  { id:"s_workout", icon:"🏋️", title:"貓咪健身房", desc:"一組迷你啞鈴，要不要練一下？",
    choices:[
      { label:"練（耗體力）", effect:{ atk:0.10, hp:-0.05 }, hint:"ATK +10% / 累了 −5% 血" },
      { label:"看別人練", effect:{ def:0.05 }, hint:"觀摩心得：DEF +5%" },
    ] },
  { id:"s_potionmix", icon:"⚗️", title:"亂調藥水", desc:"一堆瓶瓶罐罐，手癢想調調看。",
    choices:[
      { label:"亂調亂喝", effect:{ random:[{ hp:0.10 }, { atk:0.10 }, { hp:-0.05 }] }, hint:"化學實驗（多為好）" },
      { label:"整齊收好", effect:{ gold:15 } },
    ] },
  { id:"s_riddle", icon:"❓", title:"史芬克斯貓", desc:"一隻無毛貓出了個謎題（很爛的那種）。",
    choices:[
      { label:"認真回答", effect:{ random:[{ atk:0.10 }, {}] }, hint:"答對 ATK +10%，答錯無事" },
      { label:"直接走開", effect:{} },
    ] },
  { id:"s_donatebox", icon:"📮", title:"公益捐款箱", desc:"路邊一個貓福利捐款箱。",
    choices:[
      { label:"捐 30 金", cost:{ gold:30 }, effect:{ def:0.10, atk:0.05 }, hint:"善有善報：DEF +10%、ATK +5%" },
      { label:"路過", effect:{} },
    ] },
  { id:"s_forkroad", icon:"🍴", title:"叉路（字面上）", desc:"路中央插著一支巨大的叉子。為什麼？沒人知道。",
    choices:[
      { label:"拔起來當武器", effect:{ atk:0.10 }, hint:"本層 ATK +10%" },
      { label:"繞過這個問題", effect:{ hp:0.05 } },
    ] },
  { id:"s_lastsnack", icon:"🍘", title:"最後一塊點心", desc:"盤子上只剩一塊點心，要留給隊友還是自己吃？",
    choices:[
      { label:"分給全隊", effect:{ def:0.10 }, hint:"團結：DEF +10%" },
      { label:"自己嗑掉", effect:{ atk:0.10, def:-0.05 }, hint:"自私但有力：ATK +10% / DEF −5%" },
    ] },
];
