// src/components/cat/catSpeeches.js
// 貓貓對話資料庫 — 依據貓咪個性、類型、場合產生對話

import { CATS, CAT_TYPE_MAP, CAT_BUILD_PROFILES } from "../../lib/catData";

// ── 各貓專屬台詞 ────────────────────────────────────────
const CAT_LINES = {
  daming: {
    greet:   ["嗯？你來了啊。", "又來練習？不錯。", "今天沒有偷懶吧？"],
    encourage: ["這箭還可以，繼續。", "專心點，我在看。", "姿勢再穩一點。"],
    tease:   ["你剛才那箭……算了。", "我睡一下，射中叫我。", "你看起來需要再練一百箭。"],
    random:  ["這箭場我待三年了。", "新來的弓袋味道怪怪的。", "你不在的時候，我幫你顧裝備。"],
    block:   ["讓我過去——騙你的。", "此路是我開。", "要過？先射一支 X。"],
    battle:  ["哼，這種等級。", "我年輕時這種的一掌就打趴。"],
    victory: ["早就說會贏。", "還行，沒讓我失望。"],
  },
  gege: {
    greet:   ["來了啊，今天心情如何？", "等你很久了。", "先熱身，別急。"],
    encourage: ["很好，保持這樣。", "有進步喔！", "慢慢來，順了就會好。"],
    tease:   ["你把箭袋放反了……", "你剛剛瞄準的時候閉眼睛對吧？", "我知道你盡力了。"],
    random:  ["有看到新來的那隻橘貓嗎？", "今天風向不錯。", "弓弦該上蠟了。"],
    block:   ["欸，等一下——你鞋帶鬆了。", "休息一下吧。", "你看起來需要喝水。"],
    battle:  ["一起上吧，別怕。", "我在這裡。"],
    victory: ["漂亮！我就知道。", "合作愉快！"],
  },
  meimei: {
    greet:   ["嗨嗨嗨！你來了！", "今天要射幾箭？", "我準備好了！"],
    encourage: ["哇！這箭超讚！", "再來一次！", "你剛剛好帥！"],
    tease:   ["你射箭的樣子好好笑。", "我剛剛追了一根落葉跑。", "你專心的表情好嚴肅～"],
    random:  ["那邊有一隻蝴蝶！", "你口袋有零食嗎？", "我今天跑了三十圈。"],
    block:   ["陪我玩！", "不要一直看靶，看我！", "來追我啊！"],
    battle:  ["揍他揍他！", "我幫你加油！"],
    victory: ["贏了贏了！我們最棒！"],
  },
  niuniu: {
    greet:   ["你來了。規則都記住了？", "開始吧，別浪費時間。", "今天練什麼項目？"],
    encourage: ["合乎標準。", "不錯，有在進步。", "這箭可以。"],
    tease:   ["動作還差 2 度。", "你上次也是這樣說的。", "我記住你每一箭的落點了。"],
    random:  ["這箭場的規則是誰訂的？……我。", "秩序很重要。", "箭要排整齊。"],
    block:   ["先對齊再開始。", "你裝備沒整理好。", "等一下，我先檢查靶紙。"],
    battle:  ["目標鎖定。", "戰術分析完畢。"],
    victory: ["預期中的結果。", "勝利的味道。"],
  },
  haji: {
    greet:   ["嗯……你來了……（打呵欠）", "我剛剛夢到你射中靶心。", "……早安。"],
    encourage: ["做得不錯……（瞇眼）", "你有在進步喔。", "那一箭很美。"],
    tease:   ["我剛剛睡著了……你有射嗎？", "你的弓借我枕一下。", "我夢裡也射得比你準。"],
    random:  ["這個位子陽光最好。", "風吹起來好舒服。", "你練習的聲音像搖籃曲。"],
    block:   ["讓我睡……十……分鐘……", "你踩到我的尾巴了。", "（完全不想動）"],
    battle:  "（懶懶地站起來）……要打嗎？",
    victory: "（打呵欠）……贏了是嗎，我夢到的。",
  },
  baobao: {
    greet:   ("你來了！我好想你！").repeat(0) + "你來了！我好想你！",
    encourage: ["你好厲害！", "最喜歡看你射箭了！", "再一次再一次！"],
    tease:   ["抱一下～", "你身上有弓弦的味道。", "我可以窩在你的弓袋裡嗎？"],
    random:  ["你有看到我媽媽嗎？", "我今天吃了一整碗乾乾。", "你的手暖暖的。"],
    block:   ["抱抱！（跳到你身上）", "不要走～", "再摸一下就好！"],
    battle:  ["我保護你！", "壞蛋走開！"],
    victory: ["我們贏了！好棒！", "耶耶耶！"],
  },
  youyou: {
    greet:   "（慢慢走過來）……嗯。",
    encourage: ["嗯……不錯。", "這箭……可以。", "你找到感覺了。"],
    tease:   ["急什麼……時間很多。", "你剛剛很緊張喔。", "你看起來需要……慢慢來。"],
    random:  ["今天的雲很好看。", "那根羽毛我注意三天了。", "每件事都有它的節奏。"],
    block:   "（擋在你前面，慢慢地舔毛）",
    battle:  "（慢吞吞地站起來）……該工作了。",
    victory: "（慢慢點頭）……結束了。",
  },
  xiaoan: {
    greet:   "（從角落探頭）……你、你好。",
    encourage: ["我、我覺得你做得很好！", "加油……！", "你比上次更穩了！"],
    tease:   ["（躲到柱子後面）……我沒有在看你。", "你不要突然轉頭……我會嚇到。", "你不可以笑我……"],
    random:  ["那、那邊好像有什麼聲音……", "你確定這支箭沒問題嗎……？", "我、我有點緊張……"],
    block:   "（躲在路中間發抖）……我、我過不去……",
    battle:  "（爪子發抖）……我、我會努力！",
    victory: "（鬆一口氣）……結、結束了嗎……",
  },
  diandian: {
    greet:   "（無聲地出現在你身後）……",
    encourage: ["我看見了。", "你的箭氣很純淨。", "那支箭帶著好運。"],
    tease:   ["你背後……沒有什麼。", "我知道你昨天射歪那箭的原因。", "你的影子剛才動了一下。"],
    random:  ["這箭場的靈氣今天很活躍。", "有些箭……不是射不中，是被什麼擋住了。", "我看到了你看不到的東西。"],
    block:   "（一動不動地盯著你）……",
    battle:  "（眼睛發光）……讓我來。",
    victory: "（靜靜點頭）……命運的齒輪轉動了。",
  },
};

// ── 共用台詞（任何貓都可用） ────────────────────────────
const COMMON_LINES = {
  idle: [
    "⋯⋯",
    "（打呵欠）",
    "（舔爪子）",
    "（伸懶腰）",
    "（尾巴晃了晃）",
  ],
  happy: [
    "開心！",
    "今天手感不錯！",
  ],
  sleep: [
    "z Z Z……",
    "（發出一串呼嚕聲）",
  ],
  alert: [
    "！？",
    "（耳朵豎起來）",
  ],
};

// ── 角色卡（給特定動作使用） ────────────────────────────
const TYPE_BASED_LINES = {
  attack: {
    encouragement: ["攻擊！攻擊！", "一箭穿心！", "力道不錯！"],
    random: ["我喜歡全力出擊的感覺。", "瞄準要害就對了。"],
  },
  defense: {
    encouragement: ["穩住，你可以的。", "防禦就是最好的攻擊。", "慢慢來，不會倒的。"],
    random: ["持久戰才是我的風格。", "保護你是我在這裡的原因。"],
  },
  allround: {
    encouragement: ["放輕鬆，自然就會中。", "身心合一……", "你已經做得很好了。"],
    random: ["平衡是最重要的。", "射箭和人生一樣，要找到節奏。"],
  },
};

// ── 主要函數：取得貓咪對話 ─────────────────────────────
export function getCatSpeech(catId, context = "random") {
  const cat = CATS[catId];
  const catType = CAT_TYPE_MAP[catId] || "allround";
  const lines = CAT_LINES[catId];
  const common = COMMON_LINES[context];
  const typeLines = TYPE_BASED_LINES[catType];

  // 優先使用貓咪專屬台詞
  if (lines?.[context]) {
    const pool = Array.isArray(lines[context]) ? lines[context] : [lines[context]];
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }

  // 其次使用類型台詞
  if (context === "encourage" || context === "random") {
    if (typeLines?.[context]) {
      const pool = typeLines[context];
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // 最後使用共用台詞
  if (common?.length > 0) {
    const pool = common;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 終極 fallback
  return "⋯⋯";
}

// ── 隨機上下文（根據時間與狀態） ────────────────────────
export function getRandomContext() {
  const rand = Math.random();
  if (rand < 0.25) return "greet";
  if (rand < 0.50) return "encourage";
  if (rand < 0.70) return "random";
  if (rand < 0.85) return "tease";
  if (rand < 0.95) return "block";
  return "greet";
}

// ── 戰鬥台詞（給 CatBuddy 戰鬥事件用） ──────────────────
export function getBattleSpeech(catId, result) {
  const cat = CATS[catId];
  const lines = CAT_LINES[catId];

  // 勝利台詞
  if (result === "victory" || result === "win") {
    const pool = lines?.victory
      ? (Array.isArray(lines.victory) ? lines.victory : [lines.victory])
      : ["贏了！", "太棒了！", "勝利！"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 戰敗台詞
  if (result === "lose") {
    const pool = lines?.lose
      ? (Array.isArray(lines.lose) ? lines.lose : [lines.lose])
      : ["沒關係，下次會更好⋯⋯", "再試一次吧！", "不要放棄！"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 打氣台詞（命中/爆擊）
  if (result === "hit" || result === "encourage") {
    const pool = lines?.encourage
      ? (Array.isArray(lines.encourage) ? lines.encourage : [lines.encourage])
      : ["加油！", "你可以的！", "讚啦！"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 戰鬥開場
  if (result === "battle") {
    const pool = lines?.battle
      ? (Array.isArray(lines.battle) ? lines.battle : [lines.battle])
      : ["上吧！", "準備好了！"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // fallback
  return getCatSpeech(catId, "random");
}

// ── 地下城挖掘專屬台詞 ──────────────────────────────────────
const DIG_LINES = {
  daming: [
    "哼，這土壤有陰魂的味道，幽冥系地下城就在這附近。",
    "你只管射箭，下面的古老怨氣我大娘幫你壓著！",
    "急什麼？大娘我挖過的古墓比你射過的箭還多。",
    "腳步穩一點，下面似乎有古老的幽魂在騷動。",
    "再射幾箭，我們就能把這片幽暗之地挖開了！",
    "不錯嘛，這箭有把上面的結界震鬆一點。",
    "我趴在地上聽到了……地底深處有鬼魅的聲音。",
    "繼續練習！大娘在看著呢，別偷懶！",
  ],
  gege: [
    "這地層非常堅硬，感覺是山嶺系的硬骨頭，慢慢來。",
    "注意腳下，石頭多，我幫你把碎石用爪子扒開。",
    "累了就歇會，有我哥哥在幫你盯著挖掘進度。",
    "地底下的硬石層已經開始出現裂痕了！",
    "順著地脈的走向挖掘，會比硬撞省力許多喔。",
    "很好！剛才那一箭帶動的震波讓土質鬆動了。",
    "別急，山嶺的寶藏需要耐心與沉穩。",
    "我和你一起努力，再硬的岩層也能鑿開！",
  ],
  meimei: [
    "哇！這下面有好吵的小蟲子聲音！是昆蟲系！",
    "你看這顆小石頭會動！快點射箭，我要挖開它！",
    "一邊挖一邊追泥土裡的小甲蟲超好玩的！",
    "嗨嗨！土裡面黏答答的，是不是有巨大的甲蟲？",
    "好快好快！土塊被我扒開一大半了！",
    "哇！剛才射中的聲音把泥土裡的小蟲都嚇跳起來了！",
    "快點快點！妹妹想看看地底到底藏了什麼！",
    "嘻嘻～泥土沾到鼻子上也沒關係，繼續挖！",
  ],
  niuniu: [
    "根據數據分析，再射幾箭就能挖穿這個職場系地下城。",
    "效率太慢了，你的射箭頻率需要再提高 15%。",
    "別看我，我的貓爪挖掘 KPI 已經超標完成。",
    "此處土壤的緊密程度符合職場地穴的構造特徵。",
    "請保持專注，任何分心都會降低我們的挖掘進度。",
    "很好，這輪的射箭表現符合標準規範。",
    "秩序與規劃是成功挖掘的唯一途徑。",
    "進度報告：挖掘進展順利，目標地下城即將揭曉。",
  ],
  haji: [
    "這土壤……寫滿了古老試題的沉悶感……（打呵欠）",
    "好累喔，我邊睡覺邊用爪子擼泥土……",
    "你射中靶心的聲音像搖籃曲，我夢到開出大獎了……",
    "嗯……這下面好像沉睡著無數的試卷碎片……",
    "讓我趴在土堆上瞇十分鐘……你繼續射箭喔……",
    "（瞇眼）剛才那一箭震得土堆好舒服……",
    "考試系地下城啊……希望裡面沒有考卷……",
    "加油……哈吉在夢裡為你加油……（呼嚕呼嚕）",
  ],
  baobao: [
    "這附近有甜甜的神聖香氣！肯定是神廟系！",
    "你射箭的樣子好帥！我挖得好有勁，要抱抱～",
    "手爪爪滿是泥土了，等一下你要幫我擦擦喔！",
    "地底傳來溫暖的光芒！寶寶挖到神廟遺跡了！",
    "最喜歡陪你一起挖掘了！再射一箭嘛～",
    "你看你看！我用爪子印了一個愛心形狀的腳印！",
    "哇啊！土裡有閃亮亮的花紋！好美喔！",
    "寶寶不累！只要能陪著你，挖多久都可以！",
  ],
  youyou: [
    "（慢慢舔爪）嗯……空氣裡有神秘寶箱的氣味……",
    "不急，好的寶藏都需要耐心等待……",
    "你看，這塊泥土會閃光呢，我們挖到好東西了。",
    "時機到了，地底的秘密自然會呈現出來……",
    "慢慢來……風會把地穴的位置告訴我們……",
    "這片土地的節律很舒服，隱藏的入口就在附近。",
    "嗯……這一箭很有靈性，距離寶藏更近了。",
    "（慢慢點頭）繼續吧，時間在我們這邊。",
  ],
  xiaoan: [
    "我、我在底下看到閃亮亮的金幣了……！",
    "泥土有點黑，我有點怕……但、但是為了金幣我會努力！",
    "這、這個材料包給你……我剛剛偷藏的……",
    "（發抖）好像聽到了金幣碰撞的清脆聲音……！",
    "你、你剛才那一箭好厲害！把我嚇了一跳，但也挖開土了！",
    "小、小安會繼續幫忙扒土的……不要丟下我喔……",
    "看、看到好閃的寶物了！快點把它挖出來！",
    "能幫上你的忙……小安好開心……！",
  ],
  diandian: [
    "地底深處，凝聚著靈魂的神聖箭露結晶……",
    "我聽見了大地命運的迴響，這一洞必出奇蹟。",
    "你的箭帶有光，引導我在幽暗中鑿開通道……",
    "凝視著地下的黑暗……它正在回應我們的號召。",
    "星辰的軌跡預示著，甘露即將湧現而出……",
    "這不是普通的地穴，這是古老力量的沉澱之所。",
    "命運的齒輪在旋轉，箭露與結晶將為你獻上。",
    "我感受到了……大地正在解開它的封印……",
  ],
};

export function getDigSpeech(catId) {
  const lines = DIG_LINES[catId] || [
    "（認真挖土中……）",
    "（爪子沾滿了泥土）",
    "喵！今天也要一起加油！",
    "地底好像有什麼動靜！",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ── 角色摘要（給 UI 顯示用） ────────────────────────────
export function getCatDescription(catId) {
  const cat = CATS[catId];
  if (!cat) return "";
  const profile = CAT_BUILD_PROFILES[catId];
  const type = CAT_TYPE_MAP[catId] || "allround";
  const typeLabel = type === "attack" ? "攻擊型" : type === "defense" ? "防禦型" : "治癒型";
  const trait = profile?.trait || "";
  return `${cat.name} · ${cat.color} · ${typeLabel}\n${cat.personality}\n${trait ? `特性：${trait}` : ""}`;
}

export default CAT_LINES;
