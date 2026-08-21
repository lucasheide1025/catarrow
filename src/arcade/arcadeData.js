// src/arcade/arcadeData.js — 訪客冒險系統（貓小隊 Arcade RPG）純資料層
// 定位：射箭場裡，掃 QR 就能玩的手機 Arcade RPG。射箭是主體，遊戲是第二層體驗。
// 最高原則：Local First / Cloud When Necessary / Account Last

// ── 九隻同行貓 ──────────────────────────────────────────────
// 第一版重用既有貓貓立繪（public/cats/），之後再以「貓小隊童話冒險 RPG 視覺系統」
// base prompt 生成替換。角色名與個性沿用射箭場真實貓咪。
// skill.type: atk=追擊 / heal=治療 / def=格擋；chance = 自動技能觸發機率
export const ARCADE_CATS = [
  { id: "haji",     name: "哈吉", color: "布偶貓", image: "/cats/haji.webp",     role: "持續輸出", skill: { type: "atk", chance: 0.20 },
    motto: "安靜夢幻，總靠在靶架旁打盹，但上場就會認真。",
    lines: { high: "漂亮！就是要這樣！", miss: "沒關係，下一輪再來！", boss: "大傢伙交給我們！", rescue: "……還是我來吧。" } },
  { id: "baobao",   name: "寶寶", color: "橘貓",   image: "/cats/baobao.webp",   role: "極限爆發", skill: { type: "atk", chance: 0.22 },
    motto: "黏人小傢伙，窩在弓袋裡睡覺，打起怪來毫不留情。",
    lines: { high: "嘻嘻，正中紅心！", miss: "嗚……換我打給你看！", boss: "看我的爆發箭！", rescue: "交給我，別怕！" } },
  { id: "meimei",   name: "妹妹", color: "橘貓",   image: "/cats/meimei.webp",   role: "迅捷治療", skill: { type: "heal", chance: 0.30 },
    motto: "活潑好動，喜歡在箭場追飛箭。",
    lines: { high: "哇！好厲害！", miss: "再試一次嘛！", boss: "我會好好治療你的！", rescue: "我來救你！" } },
  { id: "gege",     name: "哥哥", color: "橘白貓", image: "/cats/gege.webp",     role: "穩定治療", skill: { type: "heal", chance: 0.26 },
    motto: "溫柔大哥，總是第一個迎接新成員。",
    lines: { high: "嗯，射得很好。", miss: "別著急，慢慢來。", boss: "有我在，不用怕。", rescue: "換我上場。", } },
  { id: "daming",   name: "大娘", color: "玳瑁貓", image: "/cats/daNiang.webp",  role: "守護治療", skill: { type: "heal", chance: 0.22 },
    motto: "霸氣老大姐，默默守護每一隻後輩。",
    lines: { high: "哼，還行。", miss: "手穩一點。", boss: "躲我後面！", rescue: "後輩，退後。", } },
  { id: "niuniu",   name: "妞妞", color: "乳牛貓", image: "/cats/niuNiu.webp",   role: "精準強攻", skill: { type: "atk", chance: 0.24 },
    motto: "黑白分明，做事一板一眼，是最嚴格的小裁判。",
    lines: { high: "分數，記下了。", miss: "脫靶，重來。", boss: "讓我來評判你！", rescue: "退步了……換我。", } },
  { id: "youyou",   name: "悠悠", color: "橘貓",   image: "/cats/youyou.webp",   role: "均衡護衛", skill: { type: "def", chance: 0.26 },
    motto: "走路慢慢悠悠，但眼神銳利，看穿一切。",
    lines: { high: "看穿了呢。", miss: "慢慢來。", boss: "我來擋。", rescue: "……我來吧。", } },
  { id: "xiaoan",   name: "小安", color: "玳瑁貓", image: "/cats/xiaoAn.webp",   role: "生命堡壘", skill: { type: "def", chance: 0.22 },
    motto: "膽小卻勇敢，每次冒險都嚇到爪子發抖，但從未退縮。",
    lines: { high: "真、真的嗎！太好了！", miss: "沒、沒關係的！", boss: "我會撐住的……！", rescue: "我、我來幫忙！", } },
  { id: "diandian", name: "顛顛", color: "黑貓",   image: "/cats/dianDian.webp", role: "鐵壁格擋", skill: { type: "def", chance: 0.24 },
    motto: "神秘莫測，據說能看見箭場的靈氣流動。",
    lines: { high: "早已預見。", miss: "命運會轉彎的。", boss: "此路不通。", rescue: "我來。", } },
];

export const DEFAULT_CAT_ID = "haji";
export const NICKNAME_MAX = 10;

export function arcadeCatById(catId) {
  return ARCADE_CATS.find((c) => c.id === catId) || null;
}

// 暱稱：去除首尾空白、限長、可為空（空時用預設稱呼）
export function validateNickname(raw) {
  return String(raw ?? "").trim().slice(0, NICKNAME_MAX);
}

// 匿名 Visitor ID：crypto.randomUUID 優先，降級到時間戳＋亂數
export function makeVisitorId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch { /* 降級 */ }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 建立本機匿名玩家 profile（第一次掃 QR 時）
export function buildNewProfile({ nickname, catId }) {
  const name = validateNickname(nickname) || "小勇者";
  const cat = arcadeCatById(catId) || arcadeCatById(DEFAULT_CAT_ID);
  const now = Date.now();
  return {
    visitorId: makeVisitorId(),
    nickname: name,
    selectedCat: cat.id,
    cats: { [cat.id]: { id: cat.id, level: 1, xp: 0, bond: 0 } },
    catLevel: 1,
    xp: 0, // 冒險者等級經驗（M3）
    inventory: {},
    coins: 0,
    dungeonProgress: {},
    achievements: [],
    statistics: { battles: 0, kills: 0, bestDamage: 0, bestFloor: 0, treasures: 0, xCount: 0 },
    // 組隊三模式成就統計（Local First，存本機）：{ [mode]: { wins, bestCombo, bestTimeMs } }
    teamStats: {},
    createdAt: now,
    lastPlayedAt: now,
  };
}

// 完整性檢查：判斷讀回的資料是不是有效訪客 profile
export function isCompleteProfile(p) {
  return !!p && typeof p === "object" && !!p.visitorId && !!p.nickname && !!p.selectedCat;
}

// ── 寶箱三選一（規格 §13）──────────────────────────────────
export const CHEST_ITEMS = {
  fire_arrow:   { id: "fire_arrow",   name: "火焰箭",   icon: "🏹", desc: "下一場攻擊變強！" },
  cat_riceball: { id: "cat_riceball", name: "貓咪飯糰", icon: "🍙", desc: "恢復 20 生命！" },
  catnip:       { id: "catnip",       name: "貓薄荷",   icon: "🌿", desc: "下一場貓咪特別有精神！" },
};

export function rollChestChoices(rng = Math.random) {
  const ids = Object.keys(CHEST_ITEMS);
  const pick = () => ids[Math.floor(rng() * ids.length)];
  return [pick(), pick(), pick()];
}
