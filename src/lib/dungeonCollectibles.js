// src/lib/dungeonCollectibles.js — 地下城收藏品資料與掉落邏輯
// 6族系 × (20普通 + 10稀有 + 5首領 + 1超稀有) = 216件 + 24首殺限定

export const FAMILY_COLLECTIBLES = {
  ghost: {
    common: [
      { id:"shadow_stone",     name:"暗影石",       icon:"🪨", desc:"幽靈廢墟碎壁上剝落的石頭，帶著淡淡冷光。" },
      { id:"bone_fragment",    name:"骸骨碎片",     icon:"🦴", desc:"不知名亡靈的骨骸碎片，仍有不死氣息縈繞。" },
      { id:"ghost_dust",       name:"幽靈塵埃",     icon:"🌫️", desc:"幽靈消散後留下的神秘塵粒，輕觸即逝。" },
      { id:"dark_candle",      name:"黑色蠟燭",     icon:"🕯️", desc:"在廢墟中發現的古老黑蠟燭，火焰是藍色的。" },
      { id:"soul_thread",      name:"靈魂絲線",     icon:"🧵", desc:"凝固的靈魂能量形成的絲線，觸感如冰。" },
      { id:"withered_flower",  name:"枯萎花朵",     icon:"🥀", desc:"墓地旁的獻花，枯萎後仍散發淡淡香氣。" },
      { id:"cemetery_soil",    name:"墓地泥土",     icon:"⚫", desc:"吸收了無數魂魄的特殊泥土，質地異常沉重。" },
      { id:"ghost_tear",       name:"幽靈淚珠",     icon:"💧", desc:"孤獨幽靈留下的淚珠，凝固後變成藍色寶石。" },
      { id:"rusty_chain",      name:"鏽蝕鎖鏈",     icon:"⛓️", desc:"曾束縛亡靈的鐵鏈，至今仍有詛咒殘留。" },
      { id:"old_tombstone",    name:"古老墓碑",     icon:"🪦", desc:"年代不明的墓碑碎片，上面的字跡已模糊。" },
      { id:"night_feather",    name:"夜羽",         icon:"🪶", desc:"在幽靈廢墟中飛翔的黑鴉羽毛，漆黑如夜。" },
      { id:"pale_cloth",       name:"蒼白布料",     icon:"🩶", desc:"亡靈遺留的布料，顏色已完全褪去。" },
      { id:"cold_breath",      name:"冷息結晶",     icon:"❄️", desc:"幽靈呼吸凝結而成的冰晶，永遠不會融化。" },
      { id:"lost_ring",        name:"亡者戒指",     icon:"💍", desc:"墓穴中發現的戒指，不知是哪位亡者的遺物。" },
      { id:"hollow_mask",      name:"空洞面具",     icon:"🎭", desc:"幽靈戴過的面具，眼洞中似乎仍有光芒閃爍。" },
      { id:"haunted_mirror",   name:"鬼影碎鏡",     icon:"🪞", desc:"打碎的鏡面碎片，仍能看見不屬於這個世界的影像。" },
      { id:"bone_dust",        name:"骨灰",         icon:"💨", desc:"古老骨骸風化後的塵埃，裝在小玻璃瓶中。" },
      { id:"grave_moss",       name:"墓地苔蘚",     icon:"🌿", desc:"只生長在墓地的特殊苔蘚，吸收了亡者的記憶。" },
      { id:"shadow_thorn",     name:"暗影荊棘",     icon:"🌑", desc:"從暗影中生長出的荊棘，碰觸會感受到過去的悲傷。" },
      { id:"phantom_coin",     name:"冥界硬幣",     icon:"🪙", desc:"亡靈世界流通的貨幣，在陽間沒有任何價值。" },
    ],
    rare: [
      { id:"void_crystal",     name:"虛空水晶",     icon:"💎", desc:"在幽靈廢墟深處凝結的神秘結晶，散發紫色光芒。蘊含著跨越生死界限的神秘能量。" },
      { id:"lich_essence",     name:"巫妖精華",     icon:"⚗️",  desc:"從巫妖身上提取的本質，是強大魔力的結晶。持有者能感受到古老咒術的迴響。" },
      { id:"spirit_gem",       name:"靈魂寶石",     icon:"💠", desc:"亡靈精華凝聚而成的寶石，顏色隨觀看角度變換。" },
      { id:"death_mask",       name:"死神面具",     icon:"💀", desc:"仿照死神面容雕刻的黑色面具，佩戴者能感受到死亡的氣息。" },
      { id:"phantom_core",     name:"幽靈核心",     icon:"🔮", desc:"強大幽靈消散後留下的能量核心，脈動如同心跳。" },
      { id:"banshee_tear",     name:"哭嚎妖淚",     icon:"😢", desc:"傳說中預言死亡的哭嚎妖精所流的淚，凝固成黑色寶珠。" },
      { id:"wraith_cloak",     name:"怨靈斗篷",     icon:"🌑", desc:"怨靈穿過之處留下的斗篷殘影，觸摸時感覺不到溫度。" },
      { id:"soul_crystal",     name:"靈魂結晶",     icon:"✨", desc:"多個靈魂融合凝結的特殊結晶，內部可見微小的光點浮動。" },
      { id:"nether_flame",     name:"冥府之火",     icon:"🔥", desc:"從冥府帶來的不滅藍焰，燃燒時不散熱量只傳遞寒意。" },
      { id:"undead_seal",      name:"不死封印",     icon:"📜", desc:"古老的不死咒術封印書，上面的符文至今仍散發能量。" },
    ],
    boss: [
      { id:"shadow_crown",     name:"暗影王冠",     icon:"👑", desc:"死靈王的象徵，凝聚了幽冥之地的最高權威。僅有征服幽靈族系地下城的英雄才能得到此物。" },
      { id:"lich_scepter",     name:"巫妖法杖",     icon:"🪄", desc:"巫妖使用過的法杖，其中封印著古老的死靈咒術。握持時能感受到無盡的冥界力量。" },
      { id:"void_eye",         name:"虛空之眼",     icon:"👁️",  desc:"能看穿生死界限的神秘眼球，至今仍在顫動。據說凝視它太久會看見另一個世界。" },
      { id:"death_bell",       name:"死神喪鐘",     icon:"🔔", desc:"死神使用的喪鐘，敲響時會讓聽者回想起最深的記憶與遺憾。" },
      { id:"necro_tome",       name:"死靈法典",     icon:"📚", desc:"記載完整死靈術的古老法典，每一頁都由亡者的靈魂書寫而成。" },
    ],
    superRare: [
      { id:"void_heart",       name:"虛空之心",     icon:"💜", desc:"傳說中幽冥世界核心凝聚而成的神器，象徵對死亡本身的超越。據說持有它的人能在生死之間自由穿梭，連死神都對其敬畏。整個幽靈地下城只有極少數探索者曾一睹其真容。" },
    ],
  },
  mountain: {
    common: [
      { id:"rough_stone",      name:"粗糙岩石",     icon:"🗿", desc:"山嶺地帶隨處可見的岩石，質地堅硬。" },
      { id:"mountain_herb",    name:"山嶺藥草",     icon:"🌿", desc:"生長在峭壁縫隙的稀有藥草，帶有清涼香氣。" },
      { id:"cave_moss",        name:"洞窟苔蘚",     icon:"🌱", desc:"只在深邃洞窟中生長的苔蘚，無需光照也能存活。" },
      { id:"quartz_chip",      name:"石英碎片",     icon:"🔷", desc:"從岩層中剝落的石英，在光線下閃閃發亮。" },
      { id:"dried_root",       name:"乾燥根莖",     icon:"🌾", desc:"山地植物的根莖，乾燥後保留了山嶺的能量。" },
      { id:"eagle_feather",    name:"鷹羽",         icon:"🪶", desc:"翱翔山嶺的老鷹所落下的羽毛，觸感輕盈。" },
      { id:"mountain_water",   name:"山泉水珠",     icon:"💧", desc:"從千年山泉凝結而成的水珠，清澈透明。" },
      { id:"lichen_piece",     name:"地衣",         icon:"🌿", desc:"附著在岩石上生長的地衣，對環境極度敏感。" },
      { id:"stalactite_shard", name:"鐘乳石碎片",   icon:"💦", desc:"洞窟中慢慢生長了幾百年的鐘乳石碎片。" },
      { id:"mountain_berry",   name:"山地莓果",     icon:"🍇", desc:"生長在高海拔的野生莓果，滋味酸甜濃郁。" },
      { id:"cave_crystal",     name:"洞窟水晶",     icon:"💎", desc:"在洞窟深處自然生長的透明水晶，形狀完美。" },
      { id:"wind_stone",       name:"風化石",       icon:"💨", desc:"被千年山風打磨成奇特形狀的石頭。" },
      { id:"goat_horn",        name:"山羊角",       icon:"🐐", desc:"山嶺野生山羊脫落的角，質地堅硬無比。" },
      { id:"pine_cone",        name:"松果",         icon:"🌲", desc:"山嶺針葉林中的松果，儲存了豐富的養分。" },
      { id:"granite_dust",     name:"花崗岩粉",     icon:"🌫️", desc:"花崗岩風化後的細粉，充滿礦物質。" },
      { id:"snow_crystal",     name:"雪花結晶",     icon:"❄️", desc:"山頂萬年積雪凝結的結晶，永遠不會融化。" },
      { id:"mountain_clay",    name:"山地黏土",     icon:"🟤", desc:"富含礦物質的山地黏土，可塑性極強。" },
      { id:"fossil_fragment",  name:"化石碎片",     icon:"🦴", desc:"嵌在岩層中的古代生物化石碎片。" },
      { id:"creek_pebble",     name:"溪流卵石",     icon:"🪨", desc:"被山澗流水打磨得光滑圓潤的小石頭。" },
      { id:"root_crystal",     name:"根晶",         icon:"✨", desc:"古樹根部與礦石交融而成的奇異結晶。" },
    ],
    rare: [
      { id:"ore_crystal",      name:"礦晶石",       icon:"💠", desc:"山脈深處的珍貴結晶礦石，蘊含巨大能量。開採它需要特殊工具，普通人無緣得見。" },
      { id:"peak_core",        name:"山巔核心",     icon:"⛰️",  desc:"從山嶺最高處採集的能量核心，充滿地脈之力。" },
      { id:"ruby_shard",       name:"紅寶石碎片",   icon:"🔴", desc:"深藏在岩層中的天然紅寶石，顏色鮮豔如血。" },
      { id:"mithril_dust",     name:"秘銀塵",       icon:"✨", desc:"傳說中最輕最硬的金屬秘銀的粉末，散發銀白光芒。" },
      { id:"ancient_stone",    name:"古老石刻",     icon:"🗿", desc:"刻有上古文字的石板碎片，記錄著山嶺的歷史。" },
      { id:"thunder_stone",    name:"雷光石",       icon:"⚡", desc:"被閃電擊中後自然形成的特殊礦石，永遠帶有輕微靜電。" },
      { id:"glacier_tear",     name:"冰川淚珠",     icon:"🧊", desc:"萬年冰川融化的最後一滴水，凝固成完美的藍色球體。" },
      { id:"earth_essence",    name:"大地精華",     icon:"🌍", desc:"從地脈核心提取的純粹能量結晶，象徵大地的意志。" },
      { id:"dragon_tooth",     name:"龍牙化石",     icon:"🦷", desc:"遠古龍族的牙齒化石，蘊含著已消逝的強大力量。" },
      { id:"geode_heart",      name:"晶洞之心",     icon:"💎", desc:"完整的水晶晶洞，內部密布絢麗的紫色水晶，如同山的心臟。" },
    ],
    boss: [
      { id:"summit_gem",       name:"巔峰寶珠",     icon:"🔮", desc:"山嶺之王的核心寶物，象徵著對高山的征服。只有真正到達頂峰的人才能感受其中蘊藏的宏大力量。" },
      { id:"mountain_throne",  name:"山嶺王座",     icon:"🪑", desc:"雕刻在巨岩上的古老王座碎片，承載歷代霸主記憶。坐上去能感受到千年山嶺霸主的威嚴。" },
      { id:"peak_essence",     name:"峰頂精氣",     icon:"✨", desc:"凝聚在最高峰頂的純淨天地靈氣結晶，採集難度極高。" },
      { id:"titan_heart",      name:"巨人之心",     icon:"❤️", desc:"傳說中守護山嶺的石巨人的心臟，雖已不再跳動，仍散發強大的力量。" },
      { id:"storm_crown",      name:"暴風王冠",     icon:"👑", desc:"山嶺之王在最後的暴風中留下的王冠，至今仍有電流環繞。" },
    ],
    superRare: [
      { id:"world_pillar",     name:"世界之柱",     icon:"🏔️", desc:"傳說中支撐天地的神山核心，是山嶺族系中最高等的收藏品。擁有它象徵著對山嶺世界的絕對征服——每一座峰、每一條龍脈都曾見證過這根柱子的存在。據說世界上只有個位數的探索者曾見過它的真實面貌。" },
    ],
  },
  insect: {
    common: [
      { id:"insect_shell",     name:"蟲殼",         icon:"🐚", desc:"昆蟲脫落的外殼，硬度驚人，可作為防護材料。" },
      { id:"silk_thread",      name:"蟲絲線",       icon:"🧵", desc:"蟲后族群紡出的特殊絲線，韌性極強。" },
      { id:"wing_scale",       name:"翅翼鱗片",     icon:"🦋", desc:"蝴蝶翅膀上的鱗片，在陽光下閃耀彩虹色彩。" },
      { id:"chitin_shard",     name:"幾丁質碎片",   icon:"🐛", desc:"昆蟲外骨骼的主要成分，輕薄而堅硬。" },
      { id:"antenna_tip",      name:"觸角尖端",     icon:"🐌", desc:"昆蟲脫落的觸角末端，對氣味極度敏感。" },
      { id:"cocoon_fiber",     name:"蛹絲纖維",     icon:"🌀", desc:"蠶蛹外層的絲質纖維，細軟如棉花。" },
      { id:"honey_drop",       name:"蜂蜜滴",       icon:"🍯", desc:"蜜蜂採集並精製的蜂蜜，甜度是普通蜂蜜的三倍。" },
      { id:"compound_lens",    name:"複眼碎片",     icon:"👁️",  desc:"昆蟲複眼的碎片，每個小眼都能形成獨立影像。" },
      { id:"molt_skin",        name:"蛻皮",         icon:"🌿", desc:"昆蟲蛻變時脫下的完整舊皮，保留了原本的形狀。" },
      { id:"beetle_shell",     name:"甲蟲殼",       icon:"🐞", desc:"甲蟲堅硬的外殼，光滑的表面反射著光芒。" },
      { id:"cricket_leg",      name:"蟋蟀腿",       icon:"🦗", desc:"蟋蟀用來演奏音樂的後腿，結構精密。" },
      { id:"firefly_dust",     name:"螢火粉",       icon:"✨", desc:"螢火蟲發光器官的粉末，黑暗中仍然微微發光。" },
      { id:"spider_web",       name:"蜘蛛網絲",     icon:"🕸️",  desc:"特殊蜘蛛結的網絲，強度比同重量的鋼鐵更高。" },
      { id:"leaf_bite",        name:"蟲咬葉片",     icon:"🍃", desc:"被昆蟲精心啃咬出特定圖案的葉片，形成獨特的藝術品。" },
      { id:"pupa_casing",      name:"蛹殼",         icon:"🌰", desc:"蛹蛻變後留下的空殼，形狀如同小小的棺材。" },
      { id:"mushroom_spore",   name:"蟲巢蘑菇孢子", icon:"🍄", desc:"在昆蟲地下巢穴中生長的特殊蘑菇孢子。" },
      { id:"clay_cell",        name:"泥巢碎片",     icon:"🟤", desc:"黃蜂建造的泥巢碎片，結構精密令人嘆為觀止。" },
      { id:"beetle_horn",      name:"甲蟲角",       icon:"🐄", desc:"雄甲蟲頭頂的角，是其爭奪地位的武器。" },
      { id:"aphid_wax",        name:"蚜蟲蠟質",     icon:"🕯️", desc:"蚜蟲分泌的天然蠟質，有防水效果。" },
      { id:"worm_silk",        name:"蠶絲",         icon:"🧶", desc:"蠶寶寶吐出的天然絲，是製作珍貴布料的原料。" },
    ],
    rare: [
      { id:"wing_dust",        name:"翅翼粉末",     icon:"🦋", desc:"稀有蝴蝶翅翼上的魔法鱗粉，可增強魔力。傳說能使持有者短暫感受到飛翔的自由。" },
      { id:"queen_pheromone",  name:"女王費洛蒙",   icon:"💜", desc:"蟲后分泌的神秘物質，能操縱昆蟲的意志。凝固後形成紫色結晶，仍有微弱的指令殘留。" },
      { id:"royal_jelly",      name:"蜂王漿結晶",   icon:"💛", desc:"蜂巢中最珍貴的物質，凝固成金色結晶。" },
      { id:"mantis_claw",      name:"螳螂鐮刀",     icon:"🦀", desc:"螳螂前臂鐮刀狀構造，鋒利程度遠超人類製作的刀具。" },
      { id:"beetle_gem",       name:"甲蟲寶石",     icon:"💎", desc:"某些稀有甲蟲背上天然形成的寶石，價值連城。" },
      { id:"hive_resin",       name:"巢穴樹脂",     icon:"🍯", desc:"昆蟲巢穴內壁分泌的特殊樹脂，用於密封和防腐。" },
      { id:"scorpion_venom",   name:"蠍毒結晶",     icon:"⚗️",  desc:"蠍子毒腺提取的毒素凝固成結晶，稀釋後可作為藥材。" },
      { id:"silk_core",        name:"絲核",         icon:"🌀", desc:"蠶繭最核心的部分，是整個繭最精緻的絲質結構。" },
      { id:"swarm_crystal",    name:"蟲群結晶",     icon:"💠", desc:"數千隻昆蟲同時發光時，集體能量凝聚而成的結晶。" },
      { id:"ancient_amber",    name:"古琥珀",       icon:"🟡", desc:"封存了遠古昆蟲的天然琥珀，是研究進化史的珍貴標本。" },
    ],
    boss: [
      { id:"queen_crystal",    name:"蟲后結晶",     icon:"💎", desc:"蟲后身體結晶化的精華，蘊含巨大的生命力。擁有整個昆蟲族系最純粹的生命能量。" },
      { id:"hive_core",        name:"蜂巢核心",     icon:"🏠", desc:"從古老蜂巢中取出的核心，記錄著種族的記憶。內部的迷宮結構與整個地下城的設計相同。" },
      { id:"ancient_silk",     name:"萬年古絲",     icon:"🕸️",  desc:"萬年蟲后所結的古老絲線，堅固如鋼鐵，輕薄如蟬翼。" },
      { id:"insect_throne",    name:"蟲后王座",     icon:"🪑", desc:"以蟲殼、絲線和蜂蠟建造的昆蟲王座，精密的程度令人嘆為觀止。" },
      { id:"primordial_egg",   name:"始祖蟲卵",     icon:"🥚", desc:"傳說中蟲族最初始的母卵，蘊含著整個蟲族的遺傳密碼。" },
    ],
    superRare: [
      { id:"eden_butterfly",   name:"伊甸蝴蝶標本", icon:"🦋", desc:"傳說中只在昆蟲族系地下城最深處出現一次的伊甸蝴蝶，翅膀上有七種世間不存在的色彩。這份標本是所有昆蟲收藏家畢生追求的終極目標，據說其翅膀粉末能使任何枯萎的生命重生。" },
    ],
  },
  workplace: {
    common: [
      { id:"memo_paper",       name:"便條紙",       icon:"📋", desc:"遺落在廢棄辦公室的便條，上面寫滿了工作指令。" },
      { id:"coffee_bean",      name:"咖啡豆",       icon:"☕", desc:"已過期的咖啡豆，但仍散發著濃郁香氣。" },
      { id:"staple",           name:"訂書針",       icon:"📎", desc:"辦公桌上最常見的文具，卻在廢棄辦公室中顯得特別孤寂。" },
      { id:"id_card",          name:"識別證",       icon:"💳", desc:"某位員工遺落的識別證，照片上的人面帶微笑。" },
      { id:"sticky_note",      name:"黃色便利貼",   icon:"📌", desc:"貼在螢幕上的黃色便利貼，上面寫著永遠不會完成的待辦事項。" },
      { id:"broken_pen",       name:"壞掉的原子筆", icon:"🖊️", desc:"簽了無數份合約後終於耗盡的原子筆。" },
      { id:"lunch_box",        name:"便當盒",       icon:"🍱", desc:"某人遺忘的便當盒，裡面的食物已化作歷史。" },
      { id:"desk_plant",       name:"辦公桌小植栽", icon:"🌱", desc:"在沒有陽光的辦公室中頑強存活的小植物。" },
      { id:"business_card",    name:"名片",         icon:"📇", desc:"印著誇張頭銜的名片，頭銜長度幾乎超過名字本身。" },
      { id:"keyboard_key",     name:"脫落按鍵",     icon:"⌨️", desc:"從鍵盤上脫落的按鍵，上面的字母已被完全磨光。" },
      { id:"paper_clip",       name:"迴紋針",       icon:"🖇️", desc:"辦公室最基礎的文具，已被人連成一長串。" },
      { id:"old_nameplate",    name:"舊名牌",       icon:"🪪", desc:"某位已離職員工遺留的桌面名牌，名字旁邊畫了小圈圈。" },
      { id:"broken_clock",     name:"壞掉的時鐘",   icon:"🕰️", desc:"停在週五下班時刻的辦公室時鐘，指針永遠指向那個解脫的瞬間。" },
      { id:"printer_ink",      name:"墨水殘盒",     icon:"🖨️", desc:"被用盡的印表機墨水盒，記錄著無數份報告的誕生。" },
      { id:"mouse_pad",        name:"滑鼠墊碎片",   icon:"🖱️", desc:"磨破的滑鼠墊碎片，中心已完全磨穿。" },
      { id:"meeting_agenda",   name:"會議議程",     icon:"📅", desc:"一份三十頁的會議議程，但這場會議從未真正開始過。" },
      { id:"empty_mug",        name:"空馬克杯",     icon:"☕", desc:"寫著「Boss」的馬克杯，裡面留有昨天的咖啡漬。" },
      { id:"report_draft",     name:"草稿報告",     icon:"📄", desc:"修改了十七次的報告草稿，每次修改都讓它更接近完美但離完成更遠。" },
      { id:"badge_ribbon",     name:"識別證掛繩",   icon:"🎀", desc:"被壓爛又展開的識別證掛繩，記錄著無數次低頭打卡的記憶。" },
      { id:"locker_key",       name:"置物櫃鑰匙",   icon:"🔑", desc:"通往個人置物空間的鑰匙，裡面存放著秘密。" },
    ],
    rare: [
      { id:"boss_seal",        name:"主管印章",     icon:"📮", desc:"神秘主管遺留的公司印章，上面刻有詭異符文。據說蓋過這枚印章的文件，都已成為歷史。" },
      { id:"overtime_crystal", name:"加班水晶",     icon:"⌛", desc:"無數工作人員的血汗凝聚而成的晶體，帶有哀傷氣息。" },
      { id:"vip_card",         name:"VIP 貴賓卡",   icon:"💳", desc:"高層主管才能持有的黑卡，能通往普通員工永遠無法進入的區域。" },
      { id:"gold_pen",         name:"黃金鋼筆",     icon:"✒️", desc:"只有頂層主管才用的黃金鋼筆，每一次簽名都決定著無數人的命運。" },
      { id:"secret_folder",    name:"機密資料夾",   icon:"📁", desc:"標注著最高機密的資料夾，裡面藏著公司不能公開的秘密。" },
      { id:"performance_medal",name:"績效獎牌",     icon:"🏅", desc:"傳說中的年度最佳員工獎牌，得到者往往在頒獎後隔週離職。" },
      { id:"midnight_memo",    name:"午夜指令",     icon:"📔", desc:"凌晨三點收到的工作指令，上面的字跡顯示發送者已精神崩潰。" },
      { id:"signed_contract",  name:"神秘合約書",   icon:"📜", desc:"一份沒有日期也沒有公司名稱的合約，但所有讀過它的人都感到不安。" },
      { id:"insider_report",   name:"內部機密報告", icon:"🔍", desc:"揭露公司真實運作方式的報告，持有者需要格外小心。" },
      { id:"coffee_thermos",   name:"社長保溫杯",   icon:"🫖", desc:"傳說中神秘社長獨用的保溫杯，裡面裝的從來都不只是咖啡。" },
    ],
    boss: [
      { id:"gold_badge",       name:"黃金徽章",     icon:"🏅", desc:"傳說中最高職級的身份徽章，象徵至高的企業地位。持有它的人無需打卡，也沒有上下班時間。" },
      { id:"ceo_key",          name:"執行長之鑰",   icon:"🗝️", desc:"開啟最高機密保險箱的鑰匙，不知道裡面藏著什麼，但公司為它養了三位保鏢。" },
      { id:"annual_report",    name:"年度報告",     icon:"📊", desc:"記載公司黑歷史的年度報告，每頁都暗藏玄機。" },
      { id:"black_card",       name:"至黑信用卡",   icon:"🖤", desc:"無限額度的企業黑卡，背面刻有不知名的奇怪圖騰。" },
      { id:"corp_seal",        name:"企業大印",     icon:"🏛️",  desc:"公司最高行政大印，蓋下時能感受到無數次決策的重量。" },
    ],
    superRare: [
      { id:"founders_chair",   name:"創辦人椅",     icon:"🪑", desc:"傳說中公司第一位創辦人坐過的椅子，坐上去的人據說能短暫感受到當年創業時的初心與熱情。這把椅子見證了整個職場煉獄地下城的誕生，是所有職場探索者心目中最終極的收藏品。" },
    ],
  },
  exam: {
    common: [
      { id:"exam_paper",       name:"考卷",         icon:"📝", desc:"被塗滿紅叉的考試卷，仍殘留著考生的絕望氣息。" },
      { id:"pencil_stub",      name:"鉛筆頭",       icon:"✏️",  desc:"磨到幾乎不剩的鉛筆，見證了無數個苦讀之夜。" },
      { id:"eraser",           name:"橡皮擦",       icon:"⬜", desc:"磨到幾乎透明的橡皮擦，代表改過的無數次錯誤。" },
      { id:"cheat_note",       name:"小抄紙條",     icon:"📄", desc:"精心折疊的小抄紙條，字寫得比螞蟻還小。" },
      { id:"correction_tape",  name:"修正帶",       icon:"🎀", desc:"快用盡的修正帶，白色塗料下埋藏著無數次的失誤。" },
      { id:"ruler",            name:"直尺",         icon:"📏", desc:"被刻滿了名字和圖案的直尺，課本上的塗鴉是最誠實的紀錄。" },
      { id:"compass",          name:"圓規",         icon:"📐", desc:"畫了無數個完美圓形的圓規，針尖已磨鈍。" },
      { id:"textbook_corner",  name:"折角書頁",     icon:"📚", desc:"教科書上被折了角的重點頁面，卻不一定真的讀進去了。" },
      { id:"lunch_crumbs",     name:"午休餅乾屑",   icon:"🍪", desc:"夾在考卷間的餅乾屑，是唯一讓人感到快樂的東西。" },
      { id:"school_badge",     name:"學校徽章",     icon:"🏫", desc:"制服上的學校徽章，代表著無數人共同的青春記憶。" },
      { id:"torn_paper",       name:"撕碎的考卷",   icon:"📃", desc:"在成績公布後怒而撕碎的考卷，怒火已冷卻。" },
      { id:"ink_blot",         name:"墨水污漬",     icon:"🖋️", desc:"在考試中緊張揮灑的墨水污漬，可能覆蓋了一個正確答案。" },
      { id:"pencil_shavings",  name:"削鉛筆屑",     icon:"✏️",  desc:"削鉛筆後的木屑和石墨粉，淡淡的木頭香氣令人懷念。" },
      { id:"countdown_cal",    name:"倒數日曆",     icon:"📅", desc:"距離考試的倒數日曆，每天撕去一張帶走的都是焦慮。" },
      { id:"memo_book",        name:"筆記本碎頁",   icon:"📓", desc:"撕下來的筆記本頁面，密密麻麻寫滿了重點。" },
      { id:"calc_battery",     name:"計算機電池",   icon:"🔋", desc:"在考試前一晚才沒電的計算機電池，經典的考試噩夢。" },
      { id:"highlighter_cap",  name:"螢光筆蓋",     icon:"🖍️", desc:"找不回來的螢光筆蓋，螢光筆因此提早乾涸。" },
      { id:"absent_note",      name:"請假條",       icon:"📋", desc:"為了逃避考試而寫的請假條，理由已記不清了。" },
      { id:"locker_key2",      name:"置物櫃鑰匙",   icon:"🔑", desc:"學校置物櫃的鑰匙，裡面可能還有昨天的體育服。" },
      { id:"exam_schedule",    name:"考試時間表",   icon:"📅", desc:"貼在桌子上的考試時間表，不斷提醒著即將到來的審判。" },
    ],
    rare: [
      { id:"answer_key",       name:"解答本",       icon:"📖", desc:"傳說中的考試解答本，持有者能看穿任何試題。" },
      { id:"study_crystal",    name:"讀書結晶",     icon:"🔷", desc:"學霸的努力凝聚而成的結晶，散發智慧的光芒。" },
      { id:"perfect_score",    name:"滿分試卷",     icon:"⭐", desc:"難得一見的滿分答卷，每一個字都寫在最正確的位置上。" },
      { id:"teacher_seal",     name:"老師特別印章", icon:"📮", desc:"老師頒發給優秀學生的特別獎章印，一生難得幾次。" },
      { id:"honor_roll",       name:"榮譽榜名單",   icon:"📜", desc:"學校公告欄上的榮譽榜，上面的名字都是那個年代最閃耀的星。" },
      { id:"scholarship_letter",name:"獎學金通知書",icon:"💌", desc:"通知獲得獎學金的信件，是所有苦讀換來的最甜蜜回報。" },
      { id:"midnight_coffee",  name:"苦讀咖啡杯",   icon:"☕", desc:"伴隨無數個深夜苦讀的咖啡杯，杯底印著「你可以的」。" },
      { id:"library_key",      name:"圖書館密室鑰匙",icon:"🗝️", desc:"通往圖書館隱藏密室的鑰匙，裡面藏著所有考試的答案。" },
      { id:"mock_exam_set",    name:"歷屆試題全集", icon:"📚", desc:"收集了數十年歷屆考試試題的珍貴全集，是考生的終極武器。" },
      { id:"proctor_pass",     name:"監考員通行證", icon:"🪪", desc:"讓持有者在考試中可以自由走動的特殊通行證。" },
    ],
    boss: [
      { id:"diploma",          name:"畢業證書",     icon:"🎓", desc:"通過最終試煉的象徵，上面的名字竟然是你的。見過它的人都說，拿到它的瞬間，所有的苦讀都值得了。" },
      { id:"exam_god_seal",    name:"考神印記",     icon:"⭐", desc:"傳說中考神親自蓋下的印記，保佑持有者考試順利。整個考試地下城只有最頂尖的挑戰者才能獲得。" },
      { id:"knowledge_core",   name:"知識核心",     icon:"🧠", desc:"收納了無數知識的結晶體，智慧的終極結晶。" },
      { id:"final_transcript", name:"最終成績單",   icon:"📊", desc:"記錄著完美成績的最終成績單，每一科都是滿分，是學業巔峰的象徵。" },
      { id:"wisdom_crown",     name:"智慧王冠",     icon:"👑", desc:"授予通過最終考驗者的王冠，代表著學識與智慧的最高境界。" },
    ],
    superRare: [
      { id:"perfect_legend",   name:"傳說滿分卷",   icon:"📜", desc:"史上唯一一份所有科目都完美作答的傳說考卷，傳說中的考神留下的真跡。每一個字都散發著智慧的光芒，持有它的人據說能瞬間理解任何知識。這份試卷本身已成為考試地下城最大的謎。" },
    ],
  },
  temple: {
    common: [
      { id:"stone_tablet",     name:"石板",         icon:"🗽", desc:"刻有古代文字的神廟石板，記載著遠古的神諭。" },
      { id:"incense_ash",      name:"香灰",         icon:"🔥", desc:"祭祀儀式後留下的香灰，散發神聖的氣息。" },
      { id:"offering_coin",    name:"供奉銅錢",     icon:"🪙", desc:"信徒投入功德箱的古銅錢，帶著虔誠的祈禱。" },
      { id:"prayer_bead",      name:"念珠碎珠",     icon:"📿", desc:"斷線散落的念珠，每一顆都曾被誦念千次。" },
      { id:"temple_flower",    name:"神廟供花",     icon:"🌸", desc:"供奉在神案前的花朵，雖已乾燥但香氣仍存。" },
      { id:"candle_wax",       name:"祭祀蠟油",     icon:"🕯️", desc:"長時間燃燒後凝固的蠟油，記錄了漫長的祈禱時光。" },
      { id:"bell_fragment",    name:"佛鐘碎片",     icon:"🔔", desc:"古老神廟大鐘的碎片，輕敲仍能聽見悠長的餘音。" },
      { id:"bamboo_slip",      name:"竹簡碎片",     icon:"📜", desc:"刻有古代文字的竹簡碎片，記錄著神廟歷史。" },
      { id:"jade_chip",        name:"玉片碎屑",     icon:"💚", desc:"祭祀用玉器碎裂後的細小碎片，仍有靈氣流動。" },
      { id:"incense_stick",    name:"香柱碎片",     icon:"🌿", desc:"用珍貴藥材製成的香柱碎片，氣味療癒心靈。" },
      { id:"lantern_paper",    name:"燈籠紙",       icon:"🏮", desc:"神廟燈籠使用的特殊紙張，透光性極好。" },
      { id:"sand_mandala",     name:"沙曼陀羅細沙", icon:"🌀", desc:"耗時數週完成的沙曼陀羅被儀式性地掃散後的細沙。" },
      { id:"temple_nail",      name:"廟門鐵釘",     icon:"🔩", desc:"神廟大門上的鐵釘，見證了無數人的進出與祈禱。" },
      { id:"spirit_tablet",    name:"神位木牌",     icon:"🪵", desc:"供奉祖先神位的木牌，上面的名字已漸漸模糊。" },
      { id:"offering_fruit",   name:"供品果乾",     icon:"🍎", desc:"曾供奉在神案上的水果，已風乾但仍保有甜味。" },
      { id:"gold_leaf",        name:"金箔碎片",     icon:"✨", desc:"貼在神像上的金箔碎片，閃閃發光如同星星。" },
      { id:"rope_charm",       name:"古繩護符",     icon:"🪢", desc:"用特殊工藝編織的護身符繩結，據說能辟邪。" },
      { id:"altar_cloth",      name:"祭壇布料",     icon:"🧣", desc:"鋪在神明案桌上的布料碎片，紅色已褪成淡粉色。" },
      { id:"sacred_water",     name:"聖水殘滴",     icon:"💧", desc:"神廟聖水池的殘留水滴，凝固後形成透明結晶。" },
      { id:"wooden_plaque",    name:"籤詩木牌",     icon:"🪵", desc:"抽到的吉運籤詩木牌，上面的預言依然清晰。" },
    ],
    rare: [
      { id:"relic_fragment",   name:"遺物碎片",     icon:"🏺", desc:"古代神廟遺物的碎片，蘊含著神明的力量。" },
      { id:"divine_jade",      name:"神玉",         icon:"💚", desc:"神廟守護者珍藏的翠玉，據說能感應神明旨意。" },
      { id:"sacred_flame",     name:"聖火結晶",     icon:"🔥", desc:"神廟永恆聖火的結晶體，燃燒的是信仰的力量。" },
      { id:"oracle_bone",      name:"神諭骨板",     icon:"🦴", desc:"古代占卜師使用的甲骨，上面的裂紋記錄著命運的預示。" },
      { id:"celestial_map",    name:"天象圖碎片",   icon:"🌌", desc:"古代天文學家繪製的星象圖碎片，標記著神聖的天文現象。" },
      { id:"holy_seal",        name:"神聖封印",     icon:"📜", desc:"用神明的力量封印的捲軸，開封需要相應的儀式。" },
      { id:"prayer_crystal",   name:"祈禱結晶",     icon:"💠", desc:"虔誠信徒無數次祈禱的心願凝聚而成的結晶。" },
      { id:"divine_water",     name:"神聖甘露",     icon:"💧", desc:"從天界降落的甘露，凝固後形成如水晶般透明的珠子。" },
      { id:"ancient_idol",     name:"古代神像碎片", icon:"🗿", desc:"遠古神廟的守護神像碎片，外形已看不清但氣息仍在。" },
      { id:"heavenly_thread",  name:"天絲線",       icon:"🧵", desc:"據說由天使紡成的絲線，強度超過任何已知材料。" },
    ],
    boss: [
      { id:"oracle_staff",     name:"神諭法杖",     icon:"⚡", desc:"神廟最高祭司使用的法杖，能傳達神明的旨意。握持它時能感受到神明的存在，聆聽遠古的神諭。" },
      { id:"divine_crown",     name:"神冠",         icon:"👸", desc:"供奉在神廟最深處的神聖王冠，代表神明的祝福。戴上它的人據說能短暫擁有神明的視野。" },
      { id:"eternal_flame",    name:"永恆之火",     icon:"🕯️",  desc:"在神廟中燃燒了萬年的神聖火焰結晶，承載著無數信仰的力量。" },
      { id:"god_contract",     name:"神明契約書",   icon:"📜", desc:"與神明締結的契約書，上面蓋有神明的印記，效力超越時間。" },
      { id:"celestial_orb",    name:"天球儀",       icon:"🌐", desc:"微縮版的宇宙天球儀，其中的星球仍在緩慢運行，映射著真實的天象。" },
    ],
    superRare: [
      { id:"divine_avatar",    name:"神明降世器",   icon:"⚡", desc:"傳說中神明為了降臨凡世而準備的神器，是神廟族系地下城最終極的收藏品。持有它的人據說能暫時借用神明的力量，感受到宇宙運行的奧秘。這件神器見證了神廟族系從建立到衰落的整個歷史，只有真正接受過神明考驗的英雄才能與它相遇。" },
    ],
  },
};

// ── 初次通關限定品（24種，每個地下城一件）──────────────────
const FIRST_CLEAR_DEFS = {
  ghost_normal:      { name:"廢墟探索章",   icon:"🏆", desc:"首次征服幽靈廢墟的紀念勳章，刻有你的到訪日期。"       },
  ghost_advanced:    { name:"幽冥地窖章",   icon:"🥇", desc:"征服幽冥地窖的榮耀勳章，見證了對死亡的超越。"         },
  ghost_hard:        { name:"亡靈禁地章",   icon:"💀", desc:"踏入亡靈禁地並生還的極少數人才能得到的殊榮。"         },
  ghost_hell:        { name:"死神殿堂章",   icon:"☠️",  desc:"只有征服死神殿堂的英雄才能持有，散發強大的死靈之氣。" },
  mountain_normal:   { name:"山麓探道章",   icon:"🏆", desc:"首次踏遍山麓探道的紀念章，帶有清新的山風氣息。"       },
  mountain_advanced: { name:"岩壁迷宮章",   icon:"🥇", desc:"在岩壁迷宮中找到出路的成就章，堅硬如岩石。"           },
  mountain_hard:     { name:"險峰試煉章",   icon:"⛰️",  desc:"通過險峰試煉的登頂紀念章，只有真正的勇者才能獲得。"  },
  mountain_hell:     { name:"天柱巔峰章",   icon:"👑", desc:"登上天柱巔峰的傳說成就章，鑄造者已無人知曉。"         },
  insect_normal:     { name:"草叢探索章",   icon:"🏆", desc:"首次深入草叢探索的紀念章，上面停著一隻蝴蝶標本。"     },
  insect_advanced:   { name:"蟲穴迷宮章",   icon:"🥇", desc:"走出蟲穴迷宮的紀念章，蟲絲包覆著金屬外殼。"           },
  insect_hard:       { name:"蟲后禁地章",   icon:"🦋", desc:"挑戰蟲后禁地的成就章，散發著蟲后費洛蒙的氣味。"      },
  insect_hell:       { name:"螞蟻帝國章",   icon:"🐜", desc:"推翻螞蟻帝國的傳說章，銘刻著最終戰役的場景。"         },
  workplace_normal:  { name:"職場初探章",   icon:"🏆", desc:"第一天上班就混到下班的紀念章，附贈加班費收據。"        },
  workplace_advanced:{ name:"會議室逃脫章", icon:"🥇", desc:"從無止盡的會議室逃脫的成就章，印有會議記錄殘骸。"      },
  workplace_hard:    { name:"加班煉獄章",   icon:"💼", desc:"在加班煉獄中存活的鐵人章，凌晨三點的時鐘永遠定格。"  },
  workplace_hell:    { name:"企業黑洞章",   icon:"🌑", desc:"逃出企業黑洞的傳說章，上面的文字只有前員工才看得懂。" },
  exam_normal:       { name:"小考及格章",   icon:"🏆", desc:"首次通過小考練習場的紀念章，上面有個歪歪斜斜的60分。"  },
  exam_advanced:     { name:"期中優等章",   icon:"🥇", desc:"期中考迷宮的優等生章，每個字都是用血淚寫成的。"      },
  exam_hard:         { name:"聯考英雄章",   icon:"📝", desc:"通過聯考禁地的英雄章，是無數個深夜苦讀的結晶。"      },
  exam_hell:         { name:"最終試煉章",   icon:"🎓", desc:"完成最終試驗的傳說章，上面印有全滿分的成績單。"       },
  temple_normal:     { name:"神廟訪客章",   icon:"🏆", desc:"首次參訪神廟前廳的紀念章，沾有神聖的香灰。"           },
  temple_advanced:   { name:"神廟探索章",   icon:"🥇", desc:"深入神廟迷宮的成就章，神明的眼睛在上面望著你。"      },
  temple_hard:       { name:"神聖禁地章",   icon:"🏛️",  desc:"踏入神聖禁地並生還的稀有章，散發神聖光輝。"           },
  temple_hell:       { name:"神明試煉章",   icon:"⚡", desc:"通過神明試煉的傳說章，與神明締結的永恆契約。"         },
};

// ── 扁平化查詢 MAP ─────────────────────────────────────────────
export const COLLECTIBLE_MAP = {};

Object.entries(FAMILY_COLLECTIBLES).forEach(([family, tiers]) => {
  Object.entries(tiers).forEach(([rarity, items]) => {
    items.forEach(item => {
      COLLECTIBLE_MAP[item.id] = { ...item, family, rarity };
    });
  });
});

Object.entries(FIRST_CLEAR_DEFS).forEach(([dungeonId, item]) => {
  const id = `${dungeonId}_trophy`;
  COLLECTIBLE_MAP[id] = { id, ...item, family: dungeonId.split("_")[0], rarity:"exclusive", dungeonId };
});

// ── 掉落邏輯 ──────────────────────────────────────────────────

// 普通戰鬥/寶箱/精英房掉落（回傳 {itemId} 或 null）
// chanceMult: 人數獎勵倍率（1人=1.0，每+1人 +0.2；上限2.0）
export function rollFamilyDrop(family, roomType, chanceMult = 1.0) {
  const pool = FAMILY_COLLECTIBLES[family];
  if (!pool) return null;
  const rand = Math.random();
  const cm   = Math.min(2.0, chanceMult);

  if (roomType === "chest") {
    if (rand < 0.15 * cm) return pick(pool.rare);
    if (rand < 0.55 * cm) return pick(pool.common);
    return null;
  }
  if (roomType === "elite") {
    if (rand < 0.20 * cm) return pick(pool.rare);
    if (rand < 0.45 * cm) return pick(pool.common);
    return null;
  }
  // 普通怪物房
  if (rand < 0.15 * cm) return pick(pool.common);
  return null;
}

// Boss 房掉落（回傳 [{itemId}] 陣列，可能含超稀有）
export function rollBossDrops(family, difficulty, chanceMult = 1.0) {
  const pool = FAMILY_COLLECTIBLES[family];
  if (!pool) return [];
  const cm   = Math.min(1.8, chanceMult);
  const drops = [];

  if (Math.random() < 0.65 * cm) drops.push(pick(pool.boss));

  const superRate = { normal:0.01, hard:0.02, elite:0.03, nightmare:0.05 }[difficulty] || 0.01;
  if (Math.random() < superRate * cm) drops.push(pick(pool.superRare));

  return drops.filter(Boolean);
}

// 初次通關限定品
export function getFirstClearTrophy(dungeonId) {
  const id = `${dungeonId}_trophy`;
  return COLLECTIBLE_MAP[id] ? { itemId: id } : null;
}

function pick(items) {
  if (!items?.length) return null;
  return { itemId: items[Math.floor(Math.random() * items.length)].id };
}
