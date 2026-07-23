// src/lib/boardEvents.js
// 貓貓村大富翁：命運（fate）/ 機會（opp）事件牌堆，各 50 張。
// 規格見 docs/second_brain/village-board-spec.md §5。
//
// schema: { id, deck:"fate"|"opp", text, flavor:boolean, effect: Effect | null }
// Effect.type:
//   gain     { resource, min, max }   得資源（material=當前模式家族素材 / arrowdew / coins / gachaToken / catXP / fur / potion）
//   lose     { resource, min, max }   失資源（實作端需保護不歸零、有下限）
//   move     { steps }                ±格（負=後退）
//   teleport { tile }                 傳送到最近的 "monster"/"mining"/"chest"/"start"
//   dice     { delta }                加骰(+)/失回合(-1=跳過)
//   multiplier { next, factor }       下次某類格獎勵 ×factor（next: "mining"/"material"/"any"）
//   chest    { kind }                 給寶箱 "family" | "universal"
//   catBond  { xp, bond }             貓咪養成
//   trigger  { event }                觸發 "mining" | "monster"
//   team     { sub, resource?, min?, max? }  組隊限定 sub: "gift"|"steal"|"allBuff"|"allMove"（單人退化成自身微獎勵）
//   micro    { coins }                純 flavor 微獎勵
//
// flavor:true 的卡以「會心一笑」為主，一律帶 micro 或極小效果，避免玩家覺得翻到空牌。

export const FATE_EVENTS = [
  // ── 有效果：移動 / 傳送 / 得失 ──
  { id: "f01", deck: "fate", flavor: false, text: "貓咪撿到一張泛黃藏寶圖，帶你抄近路！", effect: { type: "move", steps: 3 } },
  { id: "f02", deck: "fate", flavor: false, text: "不小心踩到哥哥的尾巴，被抓花了臉，落荒而逃。", effect: { type: "move", steps: -2 } },
  { id: "f03", deck: "fate", flavor: false, text: "神廟鐘聲大作，一股力量把你吸向最近的怪物。", effect: { type: "teleport", tile: "monster" } },
  { id: "f04", deck: "fate", flavor: false, text: "發現一條山嶺捷徑，腳程大增！", effect: { type: "dice", delta: 1 } },
  { id: "f05", deck: "fate", flavor: false, text: "箭袋破了個洞，箭露灑了一地。", effect: { type: "lose", resource: "arrowdew", min: 10, max: 30 } },
  { id: "f06", deck: "fate", flavor: false, text: "魔神仔帶你鬼打牆，繞了老半天又退回原地。", effect: { type: "move", steps: -4 } },
  { id: "f07", deck: "fate", flavor: false, text: "城隍爺點名嘉獎，賞你一袋金幣。", effect: { type: "gain", resource: "coins", min: 200, max: 500 } },
  { id: "f08", deck: "fate", flavor: false, text: "林投姐親手摘芭樂請你吃，順手塞給你一些素材。", effect: { type: "gain", resource: "material", min: 3, max: 5 } },
  { id: "f09", deck: "fate", flavor: false, text: "十八王公的義犬領路，帶你飛奔向前。", effect: { type: "move", steps: 2 } },
  { id: "f10", deck: "fate", flavor: false, text: "看見遠方礦坑冒煙，衝過去挖！", effect: { type: "teleport", tile: "mining" } },
  { id: "f11", deck: "fate", flavor: false, text: "蜈蚣精從腳邊竄過，嚇得你倒退三步。", effect: { type: "move", steps: -3 } },
  { id: "f12", deck: "fate", flavor: false, text: "蛛后的絲網黏住了你的靴子，動彈不得。", effect: { type: "dice", delta: -1 } },
  { id: "f13", deck: "fate", flavor: false, text: "職場過勞…你請了個假，但拿到加班費。", effect: { type: "gain", resource: "coins", min: 150, max: 350 } },
  { id: "f14", deck: "fate", flavor: false, text: "迷霧散開，露出一只落單的寶箱。", effect: { type: "teleport", tile: "chest" } },
  { id: "f15", deck: "fate", flavor: false, text: "撿到一枚扭蛋幣，運氣來了！", effect: { type: "gain", resource: "gachaToken", min: 1, max: 3 } },
  { id: "f16", deck: "fate", flavor: false, text: "考試魂上身，你突然很想蹲下來讀書。", effect: { type: "dice", delta: -1 } },
  { id: "f17", deck: "fate", flavor: false, text: "妞妞帶你去她私藏的礦脈，滿載而歸。", effect: { type: "gain", resource: "material", min: 4, max: 7 } },
  { id: "f18", deck: "fate", flavor: false, text: "一陣妖風把你吹回起點附近。", effect: { type: "move", steps: -5 } },
  { id: "f19", deck: "fate", flavor: false, text: "小安嗅到寶氣，拖著你狂奔。", effect: { type: "move", steps: 4 } },
  { id: "f20", deck: "fate", flavor: false, text: "撿到半罐貓罐頭，貓咪超開心。", effect: { type: "catBond", xp: 80, bond: 1 } },
  { id: "f21", deck: "fate", flavor: false, text: "義犬對你搖尾巴，賜你一顆額外的骰子。", effect: { type: "dice", delta: 1 } },
  { id: "f22", deck: "fate", flavor: false, text: "誤入陷阱格，箭露被拌了出去。", effect: { type: "lose", resource: "arrowdew", min: 15, max: 40 } },
  { id: "f23", deck: "fate", flavor: false, text: "教練喊你回去加訓，只好暫停腳步。", effect: { type: "dice", delta: -1 } },
  { id: "f24", deck: "fate", flavor: false, text: "山神心情好，下次挖礦格產量加倍！", effect: { type: "multiplier", next: "mining", factor: 2 } },
  { id: "f25", deck: "fate", flavor: false, text: "哈吉幫你踩點，下一格素材翻倍。", effect: { type: "multiplier", next: "material", factor: 2 } },
  { id: "f26", deck: "fate", flavor: false, text: "遇上遊蕩的好兄弟，比劃一場！", effect: { type: "trigger", event: "monster" } },
  { id: "f27", deck: "fate", flavor: false, text: "腳下鬆動，掉進一個小礦洞。", effect: { type: "trigger", event: "mining" } },
  { id: "f28", deck: "fate", flavor: false, text: "撿到一瓶不知名藥水，先收著。", effect: { type: "gain", resource: "potion", min: 1, max: 1 } },
  { id: "f29", deck: "fate", flavor: false, text: "師母塞給你一把零錢：「拿去買乾魚。」", effect: { type: "gain", resource: "coins", min: 100, max: 250 } },
  { id: "f30", deck: "fate", flavor: false, text: "貓罐頭工廠爆單，你被抓去搬貨（有工錢）。", effect: { type: "gain", resource: "coins", min: 120, max: 300 } },
  // ── 組隊限定 ──
  { id: "f31", deck: "fate", flavor: false, text: "【組隊】哈吉把你的乾魚叼去分給隊友。", effect: { type: "team", sub: "gift", resource: "catXP", min: 60, max: 120 } },
  { id: "f32", deck: "fate", flavor: false, text: "【組隊】全隊被好兄弟請了頓好料，一起前進！", effect: { type: "team", sub: "allMove", steps: 2 } },
  { id: "f33", deck: "fate", flavor: false, text: "【組隊】妞妞帶頭衝鋒，全員士氣大振。", effect: { type: "team", sub: "allBuff", resource: "coins", min: 100, max: 250 } },
  { id: "f34", deck: "fate", flavor: false, text: "【組隊】調皮的點點偷了隊友一點金幣塞給你。", effect: { type: "team", sub: "steal", resource: "coins", min: 50, max: 150 } },
  // ── 純 flavor（會心一笑，帶微獎勵）──
  { id: "f35", deck: "fate", flavor: true, text: "點點在你腳邊瘋狂打滾，可愛度爆表。", effect: { type: "micro", coins: 5 } },
  { id: "f36", deck: "fate", flavor: true, text: "悠悠打了個震天大噴嚏，把迷霧都吹散了。", effect: { type: "micro", coins: 3 } },
  { id: "f37", deck: "fate", flavor: true, text: "寶寶把你的箭叼走，繞了一圈又還你（沾滿口水）。", effect: { type: "micro", coins: 3 } },
  { id: "f38", deck: "fate", flavor: true, text: "大娘碎念你姿勢不標準，唸了整整三分鐘。", effect: { type: "micro", coins: 2 } },
  { id: "f39", deck: "fate", flavor: true, text: "妹妹默默遞來一杯溫茶，貼心。", effect: { type: "micro", coins: 4 } },
  { id: "f40", deck: "fate", flavor: true, text: "教練在遠處對你比讚，你莫名有了自信。", effect: { type: "micro", coins: 3 } },
  { id: "f41", deck: "fate", flavor: true, text: "yumi 拍下你踩格的瞬間，發到限動。", effect: { type: "micro", coins: 5 } },
  { id: "f42", deck: "fate", flavor: true, text: "一隻野貓路過，跟你對看三秒後高傲離開。", effect: { type: "micro", coins: 2 } },
  { id: "f43", deck: "fate", flavor: true, text: "你踩到一塊會發出「啾」聲的石板。", effect: { type: "micro", coins: 3 } },
  { id: "f44", deck: "fate", flavor: true, text: "哥哥打了個哈欠，全世界跟著一起想睡。", effect: { type: "micro", coins: 2 } },
  { id: "f45", deck: "fate", flavor: true, text: "路邊的芭樂樹掉了一顆芭樂，正中你頭頂。", effect: { type: "micro", coins: 4 } },
  { id: "f46", deck: "fate", flavor: true, text: "貓罐頭的拉環卡住了，你研究了好久。", effect: { type: "micro", coins: 3 } },
  { id: "f47", deck: "fate", flavor: true, text: "扭蛋機吐出一個空殼，但殼很漂亮。", effect: { type: "micro", coins: 3 } },
  { id: "f48", deck: "fate", flavor: true, text: "哈吉在你背包裡睡著了，你捨不得吵醒牠。", effect: { type: "micro", coins: 4 } },
  { id: "f49", deck: "fate", flavor: true, text: "神廟的籤詩寫著：「今日宜射箭，忌熬夜。」", effect: { type: "micro", coins: 3 } },
  { id: "f50", deck: "fate", flavor: true, text: "小安對著空氣撲了三次，一無所獲但很盡力。", effect: { type: "micro", coins: 3 } },
];

export const OPP_EVENTS = [
  // ── 有效果：資源 / 寶箱 / 養成 ──
  { id: "o01", deck: "opp", flavor: false, text: "扭蛋幸運日！扭蛋幣大放送。", effect: { type: "gain", resource: "gachaToken", min: 2, max: 4 } },
  { id: "o02", deck: "opp", flavor: false, text: "妹妹幫你把整車素材搬回來。", effect: { type: "gain", resource: "material", min: 4, max: 8 } },
  { id: "o03", deck: "opp", flavor: false, text: "路邊撿到一袋金幣，今天財運不錯。", effect: { type: "gain", resource: "coins", min: 200, max: 450 } },
  { id: "o04", deck: "opp", flavor: false, text: "小安帶你去她的秘密礦點。", effect: { type: "trigger", event: "mining" } },
  { id: "o05", deck: "opp", flavor: false, text: "撿到一整箱補給，開箱吧！", effect: { type: "chest", kind: "family" } },
  { id: "o06", deck: "opp", flavor: false, text: "煉金室溢出來的箭露，你順手接了一瓶。", effect: { type: "gain", resource: "arrowdew", min: 20, max: 60 } },
  { id: "o07", deck: "opp", flavor: false, text: "貓咪陪你玩得很開心，羈絆加深。", effect: { type: "catBond", xp: 100, bond: 2 } },
  { id: "o08", deck: "opp", flavor: false, text: "農地大豐收，瓜瓜多到吃不完。", effect: { type: "gain", resource: "material", min: 5, max: 9 } },
  { id: "o09", deck: "opp", flavor: false, text: "海港漁獲滿載，鮮魚打包帶走。", effect: { type: "gain", resource: "material", min: 4, max: 8 } },
  { id: "o10", deck: "opp", flavor: false, text: "扭蛋亭老闆多送你幾枚代幣。", effect: { type: "gain", resource: "gachaToken", min: 1, max: 3 } },
  { id: "o11", deck: "opp", flavor: false, text: "撿到一瓶高級藥水，收進背包。", effect: { type: "gain", resource: "potion", min: 1, max: 1 } },
  { id: "o12", deck: "opp", flavor: false, text: "露天倉庫盤點，多出來的貓罐頭給你。", effect: { type: "gain", resource: "material", min: 4, max: 7 } },
  { id: "o13", deck: "opp", flavor: false, text: "獵場獵物豐富，獸肉滿載。", effect: { type: "gain", resource: "material", min: 4, max: 8 } },
  { id: "o14", deck: "opp", flavor: false, text: "師母發紅包：「乖，拿去買箭。」", effect: { type: "gain", resource: "coins", min: 150, max: 400 } },
  { id: "o15", deck: "opp", flavor: false, text: "撿到一張皮草，質感真好。", effect: { type: "gain", resource: "fur", min: 1, max: 2 } },
  { id: "o16", deck: "opp", flavor: false, text: "貓貓市集大特價，小魚乾論斤送。", effect: { type: "gain", resource: "material", min: 5, max: 9 } },
  { id: "o17", deck: "opp", flavor: false, text: "運氣爆棚，開到一只通用材料箱！", effect: { type: "chest", kind: "universal" } },
  { id: "o18", deck: "opp", flavor: false, text: "下一格素材大爆發，×2！", effect: { type: "multiplier", next: "material", factor: 2 } },
  { id: "o19", deck: "opp", flavor: false, text: "礦山今日超產，下次挖礦 ×2。", effect: { type: "multiplier", next: "mining", factor: 2 } },
  { id: "o20", deck: "opp", flavor: false, text: "哈吉找到一條捷徑，順道加一步。", effect: { type: "move", steps: 1 } },
  { id: "o21", deck: "opp", flavor: false, text: "貓咪叼來一堆閃亮亮的礦石。", effect: { type: "gain", resource: "material", min: 3, max: 6 } },
  { id: "o22", deck: "opp", flavor: false, text: "扭蛋機卡住又吐了一堆，賺到！", effect: { type: "gain", resource: "gachaToken", min: 2, max: 5 } },
  { id: "o23", deck: "opp", flavor: false, text: "箭露泉水冒泡，多裝了幾瓶。", effect: { type: "gain", resource: "arrowdew", min: 25, max: 70 } },
  { id: "o24", deck: "opp", flavor: false, text: "貓咪表演特技，你賞牠的同時羈絆也漲了。", effect: { type: "catBond", xp: 120, bond: 1 } },
  { id: "o25", deck: "opp", flavor: false, text: "撿到掉在地上的金幣，數了數還不少。", effect: { type: "gain", resource: "coins", min: 180, max: 380 } },
  { id: "o26", deck: "opp", flavor: false, text: "遇到一群溫馴生活怪，順手採了點素材。", effect: { type: "gain", resource: "material", min: 3, max: 6 } },
  { id: "o27", deck: "opp", flavor: false, text: "神廟功德箱回饋香油錢。", effect: { type: "gain", resource: "coins", min: 150, max: 320 } },
  { id: "o28", deck: "opp", flavor: false, text: "教練今天心情好，加碼扭蛋幣。", effect: { type: "gain", resource: "gachaToken", min: 1, max: 4 } },
  { id: "o29", deck: "opp", flavor: false, text: "撿到一只族系寶箱，開！", effect: { type: "chest", kind: "family" } },
  { id: "o30", deck: "opp", flavor: false, text: "貓咪替你多背了一袋素材。", effect: { type: "gain", resource: "material", min: 4, max: 7 } },
  // ── 組隊限定 ──
  { id: "o31", deck: "opp", flavor: false, text: "【組隊】房主請全隊喝扭蛋，人人有份！", effect: { type: "team", sub: "allBuff", resource: "gachaToken", min: 1, max: 3 } },
  { id: "o32", deck: "opp", flavor: false, text: "【組隊】市集大促銷，全隊素材通通加碼。", effect: { type: "team", sub: "allBuff", resource: "material", min: 2, max: 5 } },
  { id: "o33", deck: "opp", flavor: false, text: "【組隊】妹妹把撿到的金幣平分給大家。", effect: { type: "team", sub: "allBuff", resource: "coins", min: 80, max: 200 } },
  { id: "o34", deck: "opp", flavor: false, text: "【組隊】哈吉把好料叼來分你一份。", effect: { type: "team", sub: "gift", resource: "material", min: 2, max: 4 } },
  // ── 純 flavor（會心一笑，帶微獎勵）──
  { id: "o35", deck: "opp", flavor: true, text: "點點打盹打到打呼，超級療癒。", effect: { type: "micro", coins: 4 } },
  { id: "o36", deck: "opp", flavor: true, text: "悠悠盯著蝴蝶看了整整五分鐘。", effect: { type: "micro", coins: 3 } },
  { id: "o37", deck: "opp", flavor: true, text: "寶寶把小魚乾藏起來，結果自己忘了藏哪。", effect: { type: "micro", coins: 3 } },
  { id: "o38", deck: "opp", flavor: true, text: "大娘難得誇你一句，你偷偷開心了一整天。", effect: { type: "micro", coins: 5 } },
  { id: "o39", deck: "opp", flavor: true, text: "妞妞在市集殺價，老闆招架不住。", effect: { type: "micro", coins: 4 } },
  { id: "o40", deck: "opp", flavor: true, text: "哥哥趴在暖爐前，一動也不想動。", effect: { type: "micro", coins: 3 } },
  { id: "o41", deck: "opp", flavor: true, text: "小安追著自己的尾巴轉圈圈。", effect: { type: "micro", coins: 3 } },
  { id: "o42", deck: "opp", flavor: true, text: "師母端出一盤剛蒸好的貓饅頭。", effect: { type: "micro", coins: 4 } },
  { id: "o43", deck: "opp", flavor: true, text: "扭蛋轉出一張『再接再厲』貼紙。", effect: { type: "micro", coins: 3 } },
  { id: "o44", deck: "opp", flavor: true, text: "海港的貓咪們排排坐等漁船回來。", effect: { type: "micro", coins: 3 } },
  { id: "o45", deck: "opp", flavor: true, text: "農地的稻草人被貓咪佔領當了貓塔。", effect: { type: "micro", coins: 4 } },
  { id: "o46", deck: "opp", flavor: true, text: "yumi 幫每隻貓咪拍了證件照。", effect: { type: "micro", coins: 4 } },
  { id: "o47", deck: "opp", flavor: true, text: "礦山的迴音讓你忍不住喊了聲「喵」。", effect: { type: "micro", coins: 2 } },
  { id: "o48", deck: "opp", flavor: true, text: "妹妹泡的茶意外地好喝。", effect: { type: "micro", coins: 3 } },
  { id: "o49", deck: "opp", flavor: true, text: "教練示範射箭，結果貓咪把箭叼走了。", effect: { type: "micro", coins: 4 } },
  { id: "o50", deck: "opp", flavor: true, text: "今天的夕陽把整座貓貓村染成橘色。", effect: { type: "micro", coins: 5 } },
];

export const BOARD_EVENTS = [...FATE_EVENTS, ...OPP_EVENTS];

// 抽一張指定牌堆的事件（實作端用；種子/去重由呼叫端決定）
export function drawBoardEvent(deck) {
  const pool = deck === "fate" ? FATE_EVENTS : OPP_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
