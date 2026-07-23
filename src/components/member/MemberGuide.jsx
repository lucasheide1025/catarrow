// src/components/member/MemberGuide.jsx
import { useMemo, useState } from "react";

const GUIDE_SECTIONS = [
  {
    id: "start",
    icon: "📘",
    title: "快速開始",
    summary: "新玩家先看這裡，了解每天最值得做的事。",
    blocks: [
      {
        heading: "每日建議流程",
        items: [
          "先打卡或完成今日練習，累積箭數、經驗與基礎資源。",
          "進入打怪或地下城取得金幣、材料、寶箱、怪物卡片與成就進度。",
          "回到背包整理材料，能開寶箱就開，能做藥水就先準備。",
          "到裝備、貓村、貓貓陪練頁確認升級項目，把資源轉成戰力。",
        ],
      },
      {
        heading: "常用入口",
        items: [
          "冒險：打怪、地下城、組隊、公會任務、世界王。",
          "訓練：練習、紀錄、學習紀錄、射箭相關功能。",
          "背包：材料、寶箱、金幣商店、裝備、怪物卡片、貓咪收藏。",
          "貓村：村莊建築、採集委託、鍛造、藥水、轉蛋、卡片交易。",
        ],
      },
    ],
  },
  {
    id: "battle",
    icon: "⚔️",
    title: "打怪方式",
    summary: "打怪用射箭成績換算傷害，分數、命中部位、裝備與貓都會影響結果。",
    blocks: [
      {
        heading: "基本規則",
        items: [
          "每回合輸入箭值，X、10、9 等高分通常能造成較高傷害，M 或低分傷害較低。",
          "系統會依分數抽取命中部位，頭、頸、胸、弱點部位有較高倍率，失誤部位可能只造成少量傷害。",
          "玩家 ATK 提高傷害，DEF 減少反擊傷害，HP 決定能承受幾回合。",
          "怪物沒倒下會反擊；若怪物 ATK 高或玩家 DEF 低，建議先升裝備或帶防禦型貓。",
        ],
      },
      {
        heading: "戰前準備",
        items: [
          "檢查裝備總加成：攻擊裝備適合衝傷害，防禦與生命裝備適合打高階怪。",
          "選擇貓貓陪練：補血貓提高續戰，攻擊貓提高爆發，防禦貓降低危險回合。",
          "帶藥水：攜帶型藥水加 HP/ATK/DEF，投擲型藥水可扣怪血、降怪能力或控場。",
        ],
      },
    ],
  },
  {
    id: "families",
    icon: "👹",
    title: "七大種族",
    summary: "目前有六大戰鬥族系與寶箱族；每族分 T1 到 T6，階級越高越強。",
    blocks: [
      {
        heading: "種族定位",
        table: {
          headers: ["種族", "特色", "參數傾向"],
          rows: [
            ["幽靈族", "標準型怪物，能力平均，適合做戰力檢查。", "T1 250/20/14，T6 2500/175/155"],
            ["山岳族", "高 HP、高 DEF，戰鬥時間較長。", "T1 270/18/15，T6 2700/161/167"],
            ["昆蟲族", "HP 與 DEF 較低，但 ATK 偏高。", "T1 213/23/12，T6 2125/201/132"],
            ["職場族", "攻擊偏高，適合測試防禦與藥水準備。", "T1 250/22/14，T6 2500/189/155"],
            ["考試族", "能力略偏均衡，部分階級 ATK 壓力明顯。", "T1 238/19/13，T6 2375/166/147"],
            ["神殿族", "整體數值偏硬，Boss 階段壓力較高。", "T1 263/21/15，T6 2625/184/163"],
            ["寶箱族", "隱藏與特殊獎勵族系，攻擊通常低，獎勵倍率高。", "T1 100/5/15，T6 1000/35/190；真寶箱 ATK 約 1"],
          ],
        },
      },
      {
        heading: "階級說明",
        items: [
          "T1 common：入門怪，適合新手與每日任務。",
          "T2 rare、T3 elite：開始需要裝備與貓貓支援。",
          "T4 fierce、T5 boss：建議準備藥水與較完整裝備。",
          "T6 mythic：高階挑戰，適合戰力、裝備、貓貓、卡片都成形後再打。",
        ],
      },
    ],
  },
  {
    id: "loot",
    icon: "🎁",
    title: "掉寶狀況",
    summary: "掉落主要包含金幣、材料、寶箱、藥水箱、怪物卡片與地下城收藏品。",
    blocks: [
      {
        heading: "一般打怪掉落",
        table: {
          headers: ["項目", "機率或規則", "用途"],
          rows: [
            ["金幣", "依怪物階級與模式倍率取得。", "商店、藥水、部分升級消耗。"],
            ["材料", "T1 55%、T2 65%、T3 75%、T4 85%、T5 92%、T6 97%。", "裝備、村莊、貓裝備、藥水製作。"],
            ["材料數量", "T1 1 個、T2 2 個、T3 3 個、T4 4 個、T5 5 個、T6 7 個。", "高階怪更適合刷素材。"],
            ["怪物卡片", "新手 10%、學員 15%、熟手 20%、賽事 25%。", "收集、升星、裝備卡片加成。"],
            ["金幣寶箱", "新手 20%、學員 50%、熟手與賽事 100%。", "開啟後取得一段範圍金幣。"],
          ],
        },
      },
      {
        heading: "地下城遠征掉落",
        items: [
          "每隻被擊敗的遠征怪會產生材料箱與金幣箱，數量隨機 1 到 3 倍。",
          "寶藏地下城以寶箱族為主，金幣與箭露收益會特別高。",
          "最終結算會保留整場擊敗怪物、寶箱、額外金幣、箭露與收藏品紀錄。",
        ],
      },
    ],
  },
  {
    id: "equipment",
    icon: "🛡️",
    title: "裝備升級系統",
    summary: "裝備分 ATK、DEF、HP 三類，品質與強化等級會直接加到戰鬥能力。",
    blocks: [
      {
        heading: "裝備欄位",
        items: [
          "攻擊裝備 4 格：弓、箭、吸震/輔助、模組等，提供 ATK。",
          "防禦裝備 3 格：胸、臂、手等，提供 DEF。",
          "生命裝備 3 格：營養、箭袋、工具等，提供 HP。",
        ],
      },
      {
        heading: "加成公式",
        table: {
          headers: ["品質", "原始加成", "HP 加成"],
          rows: [
            ["common", "1 + 強化值", "原始加成 x 5"],
            ["rare", "6 + 強化值", "原始加成 x 5"],
            ["elite", "11 + 強化值", "原始加成 x 5"],
            ["epic", "16 + 強化值", "原始加成 x 5"],
            ["legend", "21 + 強化值", "原始加成 x 5"],
            ["mythic", "26 + 強化值", "原始加成 x 5"],
          ],
        },
      },
      {
        heading: "升級重點",
        items: [
          "+4 往 +5 會升到下一個品質的 +0；神話裝備最高到 +4。",
          "升級前看目前與下一階加成，確認材料足夠再升。",
          "品牌是外觀與收藏，不會改變戰鬥數值。",
        ],
      },
    ],
  },
  {
    id: "materials",
    icon: "🧱",
    title: "材料用途",
    summary: "材料是遊戲內最核心的養成資源，不同來源用途不同。",
    blocks: [
      {
        heading: "材料種類",
        table: {
          headers: ["類型", "來源", "主要用途"],
          rows: [
            ["怪物材料", "打怪、寶箱、地下城。", "裝備強化、成就、部分高階兌換。"],
            ["村莊材料", "貓村建築生產、採集委託。", "建築升級、貓裝備鍛造、藥水製作。"],
            ["箭露", "貓村煉金、地下城、任務。", "貓村建築升級的重要通用資源。"],
            ["轉蛋幣", "貓村、任務、獎勵。", "貓村轉蛋與部分交易功能。"],
            ["碎片", "寶箱、特殊箱。", "合成徽章或特殊收藏進度。"],
          ],
        },
      },
      {
        heading: "整理建議",
        items: [
          "前期優先升能穩定提高戰力的裝備與貓裝備。",
          "中期開始保留 T2、T3 材料做藥水與村莊升級。",
          "高階 T4、T5 材料消耗量大，建議用地下城與採集委託補足。",
        ],
      },
    ],
  },
  {
    id: "potions",
    icon: "🧪",
    title: "藥水能幹嘛",
    summary: "藥水分攜帶型與投擲型；前者強化自己，後者干擾怪物。",
    blocks: [
      {
        heading: "攜帶型藥水",
        table: {
          headers: ["藥水", "效果", "用途"],
          rows: [
            ["HP 藥水 Lv1/Lv2/Lv3", "HP +5% / +10% / +15%。", "打高 ATK 怪、地下城續戰。"],
            ["ATK 藥水 Lv1/Lv2/Lv3", "ATK +5% / +10% / +15%。", "壓回合、衝 Boss 或世界王傷害。"],
            ["DEF 藥水 Lv1/Lv2/Lv3", "DEF +5% / +10% / +15%。", "降低反擊壓力，適合硬怪。"],
          ],
        },
      },
      {
        heading: "投擲型藥水",
        table: {
          headers: ["藥水", "效果", "用途"],
          rows: [
            ["固定傷藥水", "直接扣 30 HP。", "補刀或穩定削血。"],
            ["比例傷藥水", "扣怪物 maxHP 10%。", "高血量 Boss 特別有效。"],
            ["隨機傷藥水", "扣 15 到 50 HP。", "低成本賭爆發。"],
            ["降 ATK / 降 DEF", "怪物 ATK 或 DEF -20%。", "提高生存或提高輸出。"],
            ["麻痺藥水", "讓怪物跳過一個大回合。", "地下城或高階怪的保命工具。"],
          ],
        },
      },
    ],
  },
  {
    id: "dungeon",
    icon: "🏰",
    title: "地下城模式",
    summary: "地下城是多層探索，包含戰鬥、寶箱、商店、休息、事件與最終 Boss。",
    blocks: [
      {
        heading: "地下城來源",
        items: [
          "挖掘探索：累積進度後揭露地下城，可存入最多 6 個地下城槽。",
          "村莊市集：可用村莊材料兌換地下城相關獎勵。",
          "世界王卷軸：擊殺世界王後可取得卷軸，使用後產生隨機地下城。",
        ],
      },
      {
        heading: "遠征流程",
        items: [
          "選擇已保存地下城後，可以單人挑戰或建立組隊房。",
          "每場遠征通常為三層地圖：第一層弱怪、第二層一般與菁英、第三層強怪與 Boss。",
          "路上可能遇到寶箱、休息、商店、事件、陷阱與隱藏房。",
          "最終勝利後進入結算，領取材料箱、金幣箱、收藏品與紀錄。",
        ],
      },
      {
        heading: "地下城特殊規則",
        items: [
          "每場可鎖定箭數與靶紙格式，開始後不能再改。",
          "符文與地下城商店道具只影響本場地下城。",
          "死亡、前後衛、復活、房主同步與獎勵領取都以房間資料為準。",
        ],
      },
    ],
  },
  {
    id: "party",
    icon: "🤝",
    title: "組隊說明",
    summary: "組隊可以一起打地下城或隊伍戰鬥，房主負責推進流程。",
    blocks: [
      {
        heading: "加入與開始",
        items: [
          "房主建立房間後，其他玩家可用邀請碼或開放房間列表加入。",
          "開始前每位成員可選前衛或後衛；前後衛各有上限，避免隊伍失衡。",
          "房主開始後房間會關閉加入，避免中途插隊造成同步問題。",
        ],
      },
      {
        heading: "前衛與後衛",
        items: [
          "前衛承擔主要戰鬥壓力，怪物反擊通常先打前衛。",
          "後衛可提供支援或保留戰力；前衛倒下後可能轉為後衛等待復活。",
          "地下城商店或休息事件可復活倒下的前衛，讓隊伍重回正面戰線。",
        ],
      },
      {
        heading: "獎勵領取",
        items: [
          "組隊地下城獎勵會保存在房間結果中，每位成員各自領取。",
          "已領取者會被標記，避免重複發獎。",
          "若斷線，回到地下城頁通常會顯示可恢復的等待室、戰鬥或未領取結算。",
        ],
      },
    ],
  },
  {
    id: "cats",
    icon: "🐱",
    title: "貓貓陪練資料",
    summary: "九隻貓分三列技能，並各自有不同成長分配與技能倍率。",
    blocks: [
      {
        heading: "三大定位",
        table: {
          headers: ["定位", "貓咪", "戰鬥效果"],
          rows: [
            ["補血列", "大明、哥哥、妹妹", "技能觸發時補血，適合長戰與地下城。"],
            ["攻擊列", "妞妞、哈吉、寶寶", "技能觸發時增加輸出，適合打 Boss 或衝傷害。"],
            ["防禦列", "悠悠、小安、點點", "技能觸發時減傷或擋傷，適合高階怪與組隊前衛。"],
          ],
        },
      },
      {
        heading: "成長重點",
        items: [
          "貓等級最高 200，等級會影響基礎 HP、ATK、DEF 與技能效果。",
          "羈絆 0 到 10 級，會提高技能機率與部分戰鬥加成。",
          "每隻貓有個別 allocation、skillPower、skillChance，不是同定位就完全一樣。",
          "貓裝備有 5 格：弓、箭、護甲、草藥包、藥水；ATK/DEF 裝備直接加數值，HP 裝備加成乘 5。",
        ],
      },
    ],
  },
  {
    id: "village",
    icon: "🏡",
    title: "貓貓村",
    summary: "貓村是長期資源系統，建築會生產材料，也能做鍛造、藥水、轉蛋與交易。",
    blocks: [
      {
        heading: "九棟建築",
        table: {
          headers: ["建築", "產出", "用途"],
          rows: [
            ["礦坑", "礦物", "裝備、鍛造、藥水。"],
            ["農田", "瓜瓜", "村莊升級與藥水材料。"],
            ["港口", "鮮魚", "中階村莊與藥水材料。"],
            ["狩獵場", "動物肉", "鍛造、藥水、部分建築升級。"],
            ["市集", "小魚乾", "交易、鍛造與材料轉換。"],
            ["倉庫", "貓罐頭", "高階建築與消耗。"],
            ["煉金屋", "箭露", "建築升級通用資源。"],
            ["轉蛋屋", "轉蛋幣", "轉蛋與抽卡相關入口。"],
            ["射箭場", "弓手資源", "村莊後期成長。"],
          ],
        },
      },
      {
        heading: "建築升級",
        items: [
          "每棟最高 20 級，建築階段每 4 級提升一次外觀與生產能力。",
          "升級消耗箭露與指定村莊材料；高階建築會需要更高 T 級素材。",
          "建築每小時累積產出，最多累積 24 小時，記得定期收取。",
        ],
      },
    ],
  },
  {
    id: "village_gathering",
    icon: "🏹",
    title: "貓村採集委託",
    summary: "新版採集改為射箭推進進度，玩家選擇採集點與 T 階後，透過 3 輪、每輪 6 箭完成委託。",
    blocks: [
      {
        heading: "採集點對應",
        table: {
          headers: ["建築", "採集地點", "主要取得"],
          rows: [
            ["礦坑", "星屑礦坑", "山岳族素材、礦石"],
            ["農田", "月芽農田", "昆蟲族素材、瓜果"],
            ["港口", "霧潮港口", "幽靈族素材、鮮魚"],
            ["狩獵場", "巡林狩獵場", "職場族素材、獸肉"],
            ["市集", "喧鬧市集", "考試族素材、小魚乾"],
            ["倉庫", "古罐倉庫", "神殿族素材、罐頭"],
          ],
        },
      },
      {
        heading: "採集流程",
        items: [
          "玩家先選擇要採集的地點，再選擇目前建築等級允許的 T 階。",
          "每次採集固定 3 輪，每輪輸入 6 箭；分數會轉換為採集進度。",
          "三輪結束後結算，不會無限延長。100% 完成、130% 豐收、180% 大豐收。",
          "未滿 100% 仍有部分獎勵，但主要素材與稀有物會明顯少於完成採集。",
        ],
      },
      {
        heading: "建築等級與 T 階",
        table: {
          headers: ["建築等級", "可採集階級", "說明"],
          rows: [
            ["Lv.1-4", "T1", "基礎採集。"],
            ["Lv.5-8", "T1-T2", "開始取得進階素材。"],
            ["Lv.9-12", "T1-T3", "穩定補中階怪物素材。"],
            ["Lv.13-16", "T1-T4", "高階採集，貓經驗與羈絆更高。"],
            ["Lv.17-20", "T1-T5", "目前常駐最高採集階級。"],
            ["特殊委託", "T6", "預留為稀有委託，不作為常駐採集。"],
          ],
        },
      },
      {
        heading: "獎勵定位",
        items: [
          "採集不發放寶箱、金幣寶箱、射手經驗，避免取代單人打怪與地下城。",
          "採集主要用來補指定怪物素材、少量貓村資源，並提供較多貓貓經驗與羈絆。",
          "貓經驗與羈絆會依 T1-T6 成長，完成度越高會再套用倍率。",
          "稀有物以陪練貓毛、貓草藥水材料、高階怪物素材等貓村/貓成長道具為主。",
          "扭蛋幣只會在高表現時少量出現，是驚喜獎勵，不是採集主要產出。",
        ],
      },
      {
        heading: "完成度倍率",
        table: {
          headers: ["進度", "結果", "倍率"],
          rows: [
            ["0-49%", "安慰獎", "x0.35"],
            ["50-99%", "半成品", "x0.65"],
            ["100-129%", "完成", "x1.0"],
            ["130-179%", "豐收", "x1.25"],
            ["180%+", "大豐收", "x1.5"],
          ],
        },
      },
      {
        heading: "協力採集",
        items: [
          "採集組隊不使用打怪組隊的戰鬥規則，只是讓多位玩家一起推進採集進度。",
          "每位玩家仍完成自己的 3 輪 6 箭，全隊進度加總後結算。",
          "組隊加成比打怪組隊小：2 人素材約 +5%、貓經驗 +10%；3 人素材約 +8%、貓經驗 +15%；4 人素材約 +10%、貓經驗 +20% 並有少量羈絆加成。",
          "組隊採集仍不發寶箱、金幣寶箱、射手經驗，主要鼓勵一起推村目標與貓成長。",
        ],
      },
      {
        heading: "村目標連動",
        items: [
          "村目標可以設定為採集總進度、採集參與人次、指定怪物素材或指定村資源。",
          "採集總進度會用本次結算進度推進；採集參與人次會依參與人數推進。",
          "指定怪物素材目標只會在本次採集取得對應素材時推進。",
          "指定村資源目標只會在本次採集取得對應村資源時推進。",
          "最低要實際完成採集並結算才會推進村目標，避免只進房不射箭也算貢獻。",
        ],
      },
    ],
  },
  {
    id: "gacha",
    icon: "🎰",
    title: "轉蛋系統",
    summary: "轉蛋消耗轉蛋幣，主要取得貓、貓卡、收藏與相關資源。",
    blocks: [
      {
        heading: "轉蛋幣來源",
        items: [
          "貓村轉蛋屋會緩慢生產轉蛋幣。",
          "任務、地下城、世界王、活動與部分寶箱也可能提供轉蛋幣。",
          "首頁資源列會顯示目前轉蛋幣數量。",
        ],
      },
      {
        heading: "抽到什麼",
        items: [
          "未擁有的貓可能透過貓箱或特殊獎勵取得。",
          "貓卡與怪物卡可做收藏、升星或裝備加成。",
          "重複與碎片類獎勵可累積成合成或成就進度。",
        ],
      },
      {
        heading: "建議",
        items: [
          "前期先確保至少有一隻可陪練貓，再考慮大量抽卡。",
          "需要戰力時，裝備與貓裝備通常比純收藏更直接。",
          "後期可把轉蛋當成補收藏、補卡片與追成就的長期目標。",
        ],
      },
    ],
  },
  {
    id: "achievements",
    icon: "🏆",
    title: "成就系統",
    summary: "成就會記錄玩家進度，並回饋徽章、稱號、圖鑑與能力成長。",
    blocks: [
      {
        heading: "成就分類",
        items: [
          "起步與打卡：首次打卡、連續/累積練習。",
          "檢定與弓種：不同弓種、不同等級的檢定成績。",
          "打怪與圖鑑：擊敗怪物、全族系、神話怪、開寶箱。",
          "鍛造與藥水：製作、使用、收集不同藥水與碎片。",
          "卡片、公會、地下城：卡片收藏、公會等級、地下城收藏品與首殺。",
        ],
      },
      {
        heading: "徽章與能力",
        items: [
          "肥貓章、分數章、成就章會換算成點數，影響個人展示與部分能力計算。",
          "成就圖鑑解鎖數會提高角色 HP 成長的一部分。",
          "隱藏成就通常不會直接告訴完整條件，只會給謎語或收藏方向。",
        ],
      },
    ],
  },
];

export default function MemberGuide({ onBack }) {
  const [activeId, setActiveId] = useState(GUIDE_SECTIONS[0].id);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();

  const active = useMemo(
    () => GUIDE_SECTIONS.find(section => section.id === activeId) || GUIDE_SECTIONS[0],
    [activeId],
  );

  const searchResults = useMemo(() => {
    if (!q) return null;
    const matches = [];
    GUIDE_SECTIONS.forEach(sec => {
      sec.blocks.forEach(blk => {
        const matchingItems = blk.items?.filter(item => item.toLowerCase().includes(q)) || [];
        const matchingTableRows = blk.table?.rows.filter(row => row.some(cell => String(cell).toLowerCase().includes(q))) || [];
        if (
          blk.heading.toLowerCase().includes(q) ||
          sec.title.toLowerCase().includes(q) ||
          matchingItems.length > 0 ||
          matchingTableRows.length > 0
        ) {
          matches.push({
            sectionTitle: sec.title,
            sectionIcon: sec.icon,
            heading: blk.heading,
            items: matchingItems.length > 0 ? matchingItems : blk.items,
            table: matchingTableRows.length > 0 ? { headers: blk.table.headers, rows: matchingTableRows } : (blk.heading.toLowerCase().includes(q) ? blk.table : null),
          });
        }
      });
    });
    return matches;
  }, [q]);

  return (
    <div className="p-4 flex flex-col gap-4 pb-8" style={{ minHeight: "100%" }}>
      <div className="flex items-center justify-between gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="text-gray-400 text-sm py-1">
            ← 返回
          </button>
        )}
        <div className="text-gray-500 text-xs font-bold">玩家手冊</div>
      </div>

      <div className="rounded-2xl p-5 text-white overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0f766e,#1e3a8a)" }}>
        <div className="text-xs tracking-widest text-cyan-200 font-black mb-1">CATARROW GUIDE</div>
        <div className="text-2xl font-black mb-1">貓小隊冒險使用說明書</div>
        <div className="text-cyan-100 text-sm leading-relaxed">
          裝備、打怪、地下城、組隊、材料、藥水、貓貓與貓村系統都整理在這裡。
        </div>
      </div>

      {/* 搜尋輸入框 */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 搜尋說明書（例如：打怪、地下城、精煉、藥水、月卡）..."
          className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
          >
            ✕ 清除
          </button>
        )}
      </div>

      {!q && (
        <div className="grid grid-cols-3 gap-2">
          {GUIDE_SECTIONS.map(section => {
            const activeTab = section.id === activeId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className="active:scale-95 transition-transform"
                style={{
                  minHeight: 72,
                  borderRadius: "var(--r-md)",
                  border: activeTab ? "1px solid rgba(34,211,238,0.65)" : "1px solid var(--glass-border)",
                  background: activeTab ? "rgba(8,145,178,0.22)" : "var(--glass-bg)",
                  boxShadow: "var(--shadow-card)",
                  padding: "8px 6px",
                }}
              >
                <div style={{ fontSize: 21 }}>{section.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: activeTab ? "#a5f3fc" : "var(--text-secondary)", lineHeight: 1.25 }}>
                  {section.title}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {q && searchResults ? (
        <div className="ui-card p-4 flex flex-col gap-4">
          <div className="text-xs text-cyan-400 font-bold">
            搜尋「{searchQuery}」結果（共 {searchResults.length} 區塊符合）
          </div>
          {searchResults.length === 0 && (
            <div className="text-slate-500 text-xs py-8 text-center bg-white/5 rounded-2xl border border-white/10">
              找不到符合「{searchQuery}」的說明，換個關鍵字試試看！
            </div>
          )}
          {searchResults.map((match, idx) => (
            <div key={idx} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
              <div className="text-xs text-cyan-300 font-black mb-1">
                {match.sectionIcon} {match.sectionTitle} › {match.heading}
              </div>
              <GuideBlock block={match} />
            </div>
          ))}
        </div>
      ) : (
        <article className="ui-card p-4 flex flex-col gap-4">
          <header>
            <div className="text-2xl mb-1">{active.icon}</div>
            <h2 className="text-gray-100 font-black text-xl mb-1">{active.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{active.summary}</p>
          </header>

          {active.blocks.map(block => (
            <GuideBlock key={block.heading} block={block} />
          ))}
        </article>
      )}

      <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
        <div className="text-amber-200 text-xs leading-relaxed">
          提醒：實際數值會隨系統更新調整。若戰鬥或獎勵畫面與本頁不同，請以遊戲內當下顯示為準。
        </div>
      </div>
    </div>
  );
}

function GuideBlock({ block }) {
  return (
    <section className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-gray-200 font-black text-sm mb-2">{block.heading}</h3>
      {block.items && (
        <ul className="flex flex-col gap-2">
          {block.items.map(item => (
            <li key={item} className="flex items-start gap-2 text-gray-300 text-sm leading-relaxed">
              <span className="text-cyan-300 mt-0.5 flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {block.table && <GuideTable table={block.table} />}
    </section>
  );
}

function GuideTable({ table }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr>
            {table.headers.map(header => (
              <th key={header} className="text-gray-500 text-xs font-black px-2 pb-1">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(row => (
            <tr key={row.join("|")} style={{ background: "rgba(255,255,255,0.04)" }}>
              {row.map((cell, index) => (
                <td
                  key={`${row[0]}-${index}`}
                  className="text-gray-300 text-xs leading-relaxed px-2 py-2 align-top first:rounded-l-lg last:rounded-r-lg"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
