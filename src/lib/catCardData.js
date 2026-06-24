// src/lib/catCardData.js
// 100張貓貓卡片資料。image欄位待GEMINI生成後填入URL。
export const CAT_CARDS = [
  // ── 1. 射箭貓 Archery ──────────────────────────────────────
  { id:"001", name:"初心射手",   cat:"archery", emoji:"🏹", bg:"#e8f5e9" },
  { id:"002", name:"金環神射",   cat:"archery", emoji:"🎯", bg:"#fff8e1" },
  { id:"003", name:"風之弓者",   cat:"archery", emoji:"🌬️", bg:"#e3f2fd" },
  { id:"004", name:"夜幕箭靈",   cat:"archery", emoji:"🌙", bg:"#ede7f6" },
  { id:"005", name:"花弓貓娘",   cat:"archery", emoji:"🌸", bg:"#fce4ec" },
  { id:"006", name:"暴風雨射手", cat:"archery", emoji:"⚡", bg:"#e8eaf6" },
  { id:"007", name:"彩虹箭靈",   cat:"archery", emoji:"🌈", bg:"#f3e5f5" },
  { id:"008", name:"武士弓士",   cat:"archery", emoji:"⛩️", bg:"#ffebee" },
  { id:"009", name:"迷你小射手", cat:"archery", emoji:"🐾", bg:"#fff3e0" },
  { id:"010", name:"傳說大師",   cat:"archery", emoji:"✨", bg:"#fffde7" },
  // ── 2. 世界文化貓 World ────────────────────────────────────
  { id:"011", name:"武士貓",     cat:"world", emoji:"⚔️", bg:"#ffebee" },
  { id:"012", name:"忍者貓",     cat:"world", emoji:"🥷", bg:"#263238", color:"#fff" },
  { id:"013", name:"法老貓",     cat:"world", emoji:"🏺", bg:"#fff8e1" },
  { id:"014", name:"維京貓",     cat:"world", emoji:"🛡️", bg:"#e8eaf6" },
  { id:"015", name:"墨西哥貓",   cat:"world", emoji:"💀", bg:"#fce4ec" },
  { id:"016", name:"蘇格蘭貓",   cat:"world", emoji:"🎺", bg:"#e8f5e9" },
  { id:"017", name:"印地安貓",   cat:"world", emoji:"🦅", bg:"#fff3e0" },
  { id:"018", name:"義廚貓",     cat:"world", emoji:"🍕", bg:"#ffccbc" },
  { id:"019", name:"功夫貓",     cat:"world", emoji:"🥋", bg:"#e3f2fd" },
  { id:"020", name:"芭蕾貓",     cat:"world", emoji:"🩰", bg:"#fce4ec" },
  // ── 3. 台灣小吃貓 Taiwan ──────────────────────────────────
  { id:"021", name:"珍奶貓",     cat:"taiwan", emoji:"🧋", bg:"#ede7f6" },
  { id:"022", name:"鹽酥雞貓",   cat:"taiwan", emoji:"🍗", bg:"#fff8e1" },
  { id:"023", name:"滷肉飯貓",   cat:"taiwan", emoji:"🍲", bg:"#fff3e0" },
  { id:"024", name:"臭豆腐貓",   cat:"taiwan", emoji:"😷", bg:"#e8f5e9" },
  { id:"025", name:"夜市大王貓", cat:"taiwan", emoji:"🏮", bg:"#ffebee" },
  { id:"026", name:"刈包貓",     cat:"taiwan", emoji:"🥙", bg:"#e8f5e9" },
  { id:"027", name:"芒果冰貓",   cat:"taiwan", emoji:"🥭", bg:"#fff8e1" },
  { id:"028", name:"蚵仔煎貓",   cat:"taiwan", emoji:"🦪", bg:"#e3f2fd" },
  { id:"029", name:"雞排貓",     cat:"taiwan", emoji:"🍖", bg:"#fff3e0" },
  { id:"030", name:"廟口貓",     cat:"taiwan", emoji:"🏯", bg:"#f3e5f5" },
  // ── 4. 神話傳說貓 Myth ────────────────────────────────────
  { id:"031", name:"九尾狐貓",   cat:"myth", emoji:"🦊", bg:"#fce4ec" },
  { id:"032", name:"天神貓",     cat:"myth", emoji:"⚡", bg:"#e3f2fd" },
  { id:"033", name:"海王貓",     cat:"myth", emoji:"🔱", bg:"#e3f2fd" },
  { id:"034", name:"雷神貓",     cat:"myth", emoji:"🔨", bg:"#e8eaf6" },
  { id:"035", name:"龍騎貓",     cat:"myth", emoji:"🐉", bg:"#fff8e1" },
  { id:"036", name:"鳳凰貓",     cat:"myth", emoji:"🔥", bg:"#ffebee" },
  { id:"037", name:"阿努比斯貓", cat:"myth", emoji:"⚖️", bg:"#fff8e1" },
  { id:"038", name:"天狗貓",     cat:"myth", emoji:"👺", bg:"#ffebee" },
  { id:"039", name:"人魚貓",     cat:"myth", emoji:"🧜", bg:"#e3f2fd" },
  { id:"040", name:"獨角獸貓",   cat:"myth", emoji:"🦄", bg:"#f3e5f5" },
  // ── 5. 未來科技貓 Sci-fi ──────────────────────────────────
  { id:"041", name:"太空人貓",   cat:"scifi", emoji:"🚀", bg:"#1a237e", color:"#fff" },
  { id:"042", name:"賽博龐克貓", cat:"scifi", emoji:"🤖", bg:"#212121", color:"#0ff" },
  { id:"043", name:"機器人貓",   cat:"scifi", emoji:"⚙️", bg:"#e8eaf6" },
  { id:"044", name:"AI貓",       cat:"scifi", emoji:"💻", bg:"#e3f2fd" },
  { id:"045", name:"駭客貓",     cat:"scifi", emoji:"🟩", bg:"#1b5e20", color:"#0f0" },
  { id:"046", name:"銀河艦長貓", cat:"scifi", emoji:"🌌", bg:"#0d1b2a", color:"#fff" },
  { id:"047", name:"奈米貓",     cat:"scifi", emoji:"🔬", bg:"#e3f2fd" },
  { id:"048", name:"時間機器貓", cat:"scifi", emoji:"⏰", bg:"#fff3e0" },
  { id:"049", name:"量子貓",     cat:"scifi", emoji:"🌀", bg:"#e8eaf6" },
  { id:"050", name:"電腦貓",     cat:"scifi", emoji:"🖥️", bg:"#e3f2fd" },
  // ── 6. 四季節慶貓 Season ──────────────────────────────────
  { id:"051", name:"春日賞花貓", cat:"season", emoji:"🌸", bg:"#fce4ec" },
  { id:"052", name:"夏祭貓",     cat:"season", emoji:"🎆", bg:"#e3f2fd" },
  { id:"053", name:"秋楓貓",     cat:"season", emoji:"🍁", bg:"#fff3e0" },
  { id:"054", name:"冬雪貓",     cat:"season", emoji:"❄️", bg:"#e3f2fd" },
  { id:"055", name:"聖誕貓",     cat:"season", emoji:"🎄", bg:"#e8f5e9" },
  { id:"056", name:"萬聖貓",     cat:"season", emoji:"🎃", bg:"#fff3e0" },
  { id:"057", name:"過年貓",     cat:"season", emoji:"🧧", bg:"#ffebee" },
  { id:"058", name:"情人節貓",   cat:"season", emoji:"💝", bg:"#fce4ec" },
  { id:"059", name:"中秋貓",     cat:"season", emoji:"🥮", bg:"#fff8e1" },
  { id:"060", name:"元宵貓",     cat:"season", emoji:"🏮", bg:"#ffebee" },
  // ── 7. 梗圖貓 Meme ────────────────────────────────────────
  { id:"061", name:"不爽貓",     cat:"meme", emoji:"😾", bg:"#f3e5f5" },
  { id:"062", name:"哭叫貓",     cat:"meme", emoji:"😱", bg:"#fce4ec" },
  { id:"063", name:"彩虹貓",     cat:"meme", emoji:"🌈", bg:"#f3e5f5" },
  { id:"064", name:"鍵盤貓",     cat:"meme", emoji:"🎹", bg:"#e8eaf6" },
  { id:"065", name:"蹦蹦貓",     cat:"meme", emoji:"🐱", bg:"#fff8e1" },
  { id:"066", name:"佔桌貓",     cat:"meme", emoji:"💻", bg:"#e3f2fd" },
  { id:"067", name:"凌晨三點貓", cat:"meme", emoji:"🌙", bg:"#1a1a2e", color:"#fff" },
  { id:"068", name:"社恐貓",     cat:"meme", emoji:"🙈", bg:"#e8f5e9" },
  { id:"069", name:"捏臉貓",     cat:"meme", emoji:"😶", bg:"#fce4ec" },
  { id:"070", name:"裝死貓",     cat:"meme", emoji:"💀", bg:"#f5f5f5" },
  // ── 8. 職業英雄貓 Hero ────────────────────────────────────
  { id:"071", name:"消防英雄貓", cat:"hero", emoji:"🚒", bg:"#ffebee" },
  { id:"072", name:"急救貓",     cat:"hero", emoji:"⚕️", bg:"#e3f2fd" },
  { id:"073", name:"大廚貓",     cat:"hero", emoji:"👨‍🍳", bg:"#fff3e0" },
  { id:"074", name:"魔法師貓",   cat:"hero", emoji:"🧙", bg:"#ede7f6" },
  { id:"075", name:"海盜貓",     cat:"hero", emoji:"🏴‍☠️", bg:"#263238", color:"#fff" },
  { id:"076", name:"偵探貓",     cat:"hero", emoji:"🔍", bg:"#fff8e1" },
  { id:"077", name:"太空探險貓", cat:"hero", emoji:"🛸", bg:"#0d1b2a", color:"#fff" },
  { id:"078", name:"律師貓",     cat:"hero", emoji:"⚖️", bg:"#e8eaf6" },
  { id:"079", name:"農夫貓",     cat:"hero", emoji:"🌾", bg:"#e8f5e9" },
  { id:"080", name:"教練貓",     cat:"hero", emoji:"📋", bg:"#fff3e0" },
  // ── 9. 自然元素貓 Nature ──────────────────────────────────
  { id:"081", name:"火焰貓",     cat:"nature", emoji:"🔥", bg:"#ffebee" },
  { id:"082", name:"冰晶貓",     cat:"nature", emoji:"🧊", bg:"#e3f2fd" },
  { id:"083", name:"電光貓",     cat:"nature", emoji:"⚡", bg:"#fff8e1" },
  { id:"084", name:"森林貓",     cat:"nature", emoji:"🌿", bg:"#e8f5e9" },
  { id:"085", name:"風之貓",     cat:"nature", emoji:"🌬️", bg:"#f0f4f8" },
  { id:"086", name:"海洋貓",     cat:"nature", emoji:"🌊", bg:"#e3f2fd" },
  { id:"087", name:"星塵貓",     cat:"nature", emoji:"⭐", bg:"#0d1b2a", color:"#fff" },
  { id:"088", name:"黑洞貓",     cat:"nature", emoji:"🌑", bg:"#0a0a0a", color:"#fff" },
  { id:"089", name:"彩虹花貓",   cat:"nature", emoji:"🌺", bg:"#f3e5f5" },
  { id:"090", name:"月光貓",     cat:"nature", emoji:"🌕", bg:"#ede7f6" },
  // ── 10. 夢幻童話貓 Fairy ──────────────────────────────────
  { id:"091", name:"灰姑娘貓",   cat:"fairy", emoji:"👠", bg:"#fce4ec" },
  { id:"092", name:"小紅帽貓",   cat:"fairy", emoji:"🧺", bg:"#ffebee" },
  { id:"093", name:"愛麗絲貓",   cat:"fairy", emoji:"🃏", bg:"#e3f2fd" },
  { id:"094", name:"匹諾曹貓",   cat:"fairy", emoji:"🤥", bg:"#fff3e0" },
  { id:"095", name:"美人魚貓",   cat:"fairy", emoji:"🧜", bg:"#e3f2fd" },
  { id:"096", name:"彼得潘貓",   cat:"fairy", emoji:"🧚", bg:"#e8f5e9" },
  { id:"097", name:"白雪公主貓", cat:"fairy", emoji:"🍎", bg:"#ffebee" },
  { id:"098", name:"睡美人貓",   cat:"fairy", emoji:"🌹", bg:"#fce4ec" },
  { id:"099", name:"千尋貓",     cat:"fairy", emoji:"🏮", bg:"#fff8e1" },
  { id:"100", name:"傳說第100貓",cat:"fairy", emoji:"🌟", bg:"#212121", color:"#ffd700", special:true },
];

export const CAT_CARD_MAP = Object.fromEntries(CAT_CARDS.map(c => [c.id, c]));

export const CAT_CARD_CATEGORIES = {
  archery: { label:"射箭貓", emoji:"🏹" },
  world:   { label:"世界文化貓", emoji:"🌏" },
  taiwan:  { label:"台灣小吃貓", emoji:"🍜" },
  myth:    { label:"神話傳說貓", emoji:"✨" },
  scifi:   { label:"未來科技貓", emoji:"🚀" },
  season:  { label:"四季節慶貓", emoji:"🌸" },
  meme:    { label:"梗圖貓", emoji:"😹" },
  hero:    { label:"職業英雄貓", emoji:"🏆" },
  nature:  { label:"自然元素貓", emoji:"🌊" },
  fairy:   { label:"夢幻童話貓", emoji:"🎭" },
};

// 隨機抽卡（回傳 cardId 字串）
export function rollGacha() {
  // #100 傳說貓機率 0.3%；其餘平均分配
  const r = Math.random();
  if (r < 0.003) return "100";
  const idx = Math.floor(Math.random() * 99) + 1;
  return String(idx).padStart(3, "0");
}
