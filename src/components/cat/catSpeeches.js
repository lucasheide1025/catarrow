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
