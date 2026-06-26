// src/lib/catData.js — 貓貓陪練系統資料定義

// ── 九隻貓咪 ─────────────────────────────────────────────────
export const CATS = {
  daming: {
    id: "daming", name: "大娘", color: "玳瑁貓",
    personality: "霸氣老大姐，默默守護著每一隻後輩。",
    isDeceased: false,
    palette: { base: "#d97706", patch: "#78350f", light: "#fef3c7" },
  },
  gege: {
    id: "gege", name: "哥哥", color: "橘白貓",
    personality: "溫柔大哥，總是第一個迎接新成員。",
    isDeceased: false,
    palette: { base: "#f97316", patch: "#ffffff", light: "#ffedd5" },
  },
  meimei: {
    id: "meimei", name: "妹妹", color: "橘貓",
    personality: "活潑好動，喜歡在箭場追飛箭。",
    isDeceased: false,
    palette: { base: "#f97316", patch: "#fed7aa", light: "#fff7ed" },
  },
  niuniu: {
    id: "niuniu", name: "妞妞", color: "乳牛貓",
    personality: "黑白分明，做事一板一眼，是最嚴格的裁判。",
    isDeceased: false,
    palette: { base: "#1c1917", patch: "#ffffff", light: "#f5f5f4" },
  },
  haji: {
    id: "haji", name: "哈吉", color: "布偶貓",
    personality: "安靜夢幻，總是靠在靶架旁打盹。",
    isDeceased: false,
    palette: { base: "#fef9c3", patch: "#c4a882", light: "#fffbeb" },
  },
  baobao: {
    id: "baobao", name: "寶寶", color: "橘貓",
    personality: "黏人小傢伙，喜歡窩在弓袋裡睡覺。",
    isDeceased: false,
    palette: { base: "#fb923c", patch: "#fbbf24", light: "#fff7ed" },
  },
  youyou: {
    id: "youyou", name: "悠悠", color: "橘貓",
    personality: "走路慢慢悠悠，但眼神銳利，看穿一切。",
    isDeceased: false,
    palette: { base: "#ea580c", patch: "#fed7aa", light: "#fff7ed" },
  },
  xiaoan: {
    id: "xiaoan", name: "小安", color: "玳瑁貓",
    personality: "膽小卻勇敢，每次冒險都嚇到爪子發抖，但從未退縮。",
    isDeceased: false,
    palette: { base: "#92400e", patch: "#d97706", light: "#fef3c7" },
  },
  diandian: {
    id: "diandian", name: "顛顛", color: "黑貓",
    personality: "神秘莫測，據說能看見箭場的靈氣流動。",
    isDeceased: false,
    palette: { base: "#18181b", patch: "#374151", light: "#52525b" },
  },
};

export const CAT_IDS = Object.keys(CATS);

// ── 三種類型 ─────────────────────────────────────────────────
// isSkill: true = 里程碑羈絆事件（bond 0/5/10）顯示特殊樣式
// desc = 純故事敘述，無任何機制加成
export const CAT_TYPES = {
  attack: {
    id: "attack", label: "攻擊型", icon: "⚔️",
    desc: "衝動、好鬥，把練習場當獵場在用。",
    skills: [
      { bond: 0,  name: "第一眼就盯上你",   isSkill: true,
        desc: "你才剛踏進箭場，牠已經蹲在角落盯了你半小時，你移動牠的眼睛跟著動，你停下來牠還是盯著。你問隊友那隻貓在幹嘛，隊友說：「來了三年了，只有新人第一天才會被這樣盯，恭喜你入選了。」" },
      { bond: 1,  name: "弓弦咬痕事件",     isSkill: false,
        desc: "你的弓弦上出現了細小的齒印，像是被什麼東西輕輕咬過。你問牠，牠從你臉上移開視線，若無其事地舔了一下前爪。你換了新弦，隔天新弦上又有了同樣的痕跡。牠顯然覺得這是份固定工作。" },
      { bond: 2,  name: "箭靶是我的領土",   isSkill: false,
        desc: "牠趁你轉身的時候悄悄移到箭靶前面坐下，把整個靶心遮住一半。你說走開，牠看了你一眼，打了個哈欠，把後半截身體也塞進靶前。你換了一個靶位，牠跟過去了。" },
      { bond: 3,  name: "箭矢收藏家",       isSkill: false,
        desc: "你找了二十分鐘的訓練箭，最後在倉庫角落發現一個藏匿點：三支箭整整齊齊排成一列，旁邊蹲著一隻神情自豪的貓。更深處還有一枝你以為弄丟的鉛筆。牠顯然收集這些東西很久了。" },
      { bond: 4,  name: "獵蟲獻寶",         isSkill: false,
        desc: "牠從草叢裡帶來一隻翅膀還能動的小蟲，莊重地放在你腳邊，退後兩步，坐下等待。你明白這是份禮物，你道謝，牠滿意地點了個頭。你低頭看那隻蟲，牠已經趁你分神的時候溜走了。" },
      { bond: 5,  name: "臂上偷渡者",       isSkill: true,
        desc: "你側身瞄準，屏住呼吸——牠跳上了你的右臂，體重比你預期的重，你的手偏了，箭射進場邊的牆。牠跳下去，四腳落地，舔了一下右爪的毛，像是什麼都沒有發生過。你看著牆上的箭孔，決定不說話了。" },
      { bond: 6,  name: "現場評分員",       isSkill: false,
        desc: "你的射手同學發現牠好像會針對你評分。你練得好的回合牠就坐著不出聲，你犯了明顯的失誤，牠會在你注意到的那一刻剛好發出一聲短促的「喵」。有人說那聲音聽起來像嘆氣。你覺得確實像嘆氣。" },
      { bond: 7,  name: "圓滾滾的抗議",     isSkill: false,
        desc: "你打開箭袋準備訓練，發現裡面多了個重量。拉開一看：一隻貓圓滾滾地塞進去，頭靠著箭矢睡得很沉。你試圖把牠挖出來，牠咬住了袋口邊。你只好把整個箭袋輕輕放在地上，去借了別人的箭袋繼續練。" },
      { bond: 8,  name: "靶心同慶",         isSkill: false,
        desc: "你射中靶心，就聽到身後傳來一陣動靜。轉頭，看到牠從不知哪裡衝出來，在你後方的空地上原地轉圈，快速轉了三圈，停下，又轉了兩圈，再停下，甩了甩尾巴，走回原位，假裝剛才什麼都沒發生。你站在那裡看完了全程。" },
      { bond: 9,  name: "假裝在瞄準",       isSkill: false,
        desc: "牠模仿你蹲下來，把身體調整成側面，頭微微揚起，眼睛瞇成一條縫，方向感覺差不多對了。你以為牠在練習。仔細一看，牠對準的是天花板上那盞射燈，全神貫注地盯著眨都不眨。你不知道那盞燈做了什麼對不起牠的事。" },
      { bond: 10, name: "門口偶遇大師",     isSkill: true,
        desc: "你試著提早出門想弄清楚牠是怎麼辦到的。你提早了二十分鐘，牠已經在門口蹲著。你提早了一小時，牠還是在那裡，表情說「你今天慢了」。後來你問教練，教練說：「我每天最早到，每天牠都已經在等了。」這件事再沒有人研究下去了。" },
    ],
    color: "#ef4444",
  },
  defense: {
    id: "defense", label: "防禦型", icon: "🛡️",
    desc: "霸道、黏人，把你的行程當成牠的行程在管理。",
    skills: [
      { bond: 0,  name: "腳上宣告主權",     isSkill: true,
        desc: "你才剛找到一個舒服的位置坐下，牠立刻走過來，踩著你的大腿繞了半圈，然後整個坐在你腳上。你說等一下要去練習，牠把重量往下壓了一點，表示聽到了，不接受。你遲到了二十分鐘，但你肩膀放鬆了，因為牠一直在呼嚕。" },
      { bond: 1,  name: "弓袋按摩枕",       isSkill: false,
        desc: "你的弓袋被壓出一個完整的貓型凹陷，像是量身訂製的，裡面鋪著一層均勻的貓毛。你試著清理，但那個凹陷已經成型。你後來把這個位置留給牠，把自己的弓換到另一個袋裡，這樣省事一點。" },
      { bond: 2,  name: "門口罷工",         isSkill: false,
        desc: "你要出門練習，牠走到門口躺下來。你把牠抱起來移到旁邊，你踏出去，回頭，牠已經回去了。你再移，再踏出，再回頭，又回去了。你數了六次。第七次你假裝往另一個方向走，繞一大圈從側門出去的。牠到現在還不知道你是怎麼走脫的。" },
      { bond: 3,  name: "靶紙揉揉球",       isSkill: false,
        desc: "你花了十分鐘換好新靶紙，架好，後退站好，準備計時。你轉頭去拿弓，一回頭，靶紙已經倒在地上被壓成一顆緊實的球。牠蹲在那顆球旁邊，爪子收好，表情寧靜。你去拿了備用靶紙，牠的眼睛跟著你的手移動。你開始覺得這是一場持久戰。" },
      { bond: 4,  name: "肚子隱藏技",       isSkill: false,
        desc: "你看向牠，牠立刻翻過來露出肚子，後腳微微張開，表情是「你要不要摸，你決定，但你最好決定快一點」。你伸手摸了，牠的後腳慢慢縮回來，發出呼嚕聲。你要離開，牠的爪子搭在你手腕上，表示還沒結束。你每次都多摸了一段時間才走。" },
      { bond: 5,  name: "背部休眠",         isSkill: true,
        desc: "你午休趴著，閉上眼睛沒多久就感覺背上多了個重量，然後傳來低沉的呼嚕聲，越來越穩。你不敢動，因為動了牠會「喵」一聲表示抗議。你就這樣多睡了四十分鐘，醒來脖子有點僵，但整個人意外地很放鬆。牠從你背上走下來，看了你一眼，走掉了。" },
      { bond: 6,  name: "枯葉戰利品",       isSkill: false,
        desc: "牠帶著一片枯葉走進練習場，步伐莊重，像是在完成一項儀式。牠把那片葉子放在你的弓旁邊，退後，坐下，抬頭看你等你的反應。你說謝謝，牠的鬍鬚動了一下。第二天，牠帶來了兩片葉子，放在同一個位置，確認你看到了才離開。" },
      { bond: 7,  name: "離場通行費",       isSkill: false,
        desc: "你練習完收拾東西準備走，牠從旁邊走過來，攔住你的去路，用頭蹭你的小腿，然後側臉蹭，換方向再蹭一次，確認整條腿都蹭到了才退開讓你通過。你問教練這是什麼，教練說：「離場費，每次都要收，你少付了不行走的。」" },
      { bond: 8,  name: "超音波呼嚕",       isSkill: false,
        desc: "有一天你心情不太好，你以為你沒有表現出來。牠靠過來把下巴放在你的大腿上，開始打呼嚕，音量大得有點不像正常貓咪能發出的聲音，像一台小型家電正在運作。你沒有辦法繼續煩惱，因為太吵了。你的心情在十分鐘內好了。" },
      { bond: 9,  name: "弓袋霸枕",         isSkill: false,
        desc: "你不在的時候，牠找到你的弓袋，把它拉到角落，枕在頭下，以一個非常舒適的姿勢睡著。睡姿相當豪放，兩隻後腳踢倒了旁邊的箭筒。你回來看了半分鐘，覺得牠睡得比你昨晚睡得好多了，這讓你有點複雜的心情。" },
      { bond: 10, name: "勢力範圍宣示",     isSkill: true,
        desc: "你開始注意到一件事：只要有人朝你方向靠近，牠就先抬頭，眼神固定在那個人身上，默默盯著看，一動不動，直到對方改變路線繞道。牠從來不出聲，也不動，只是看。效果非常好。你沒有請牠，但牠顯然自己決定要做這份工作，而且做得相當稱職。" },
    ],
    color: "#3b82f6",
  },
  allround: {
    id: "allround", label: "全能型", icon: "✨",
    desc: "好奇心旺盛，把整個箭場當成個人實驗室。",
    skills: [
      { bond: 0,  name: "嫌棄巡邏",         isSkill: true,
        desc: "牠走進練習場，系統性地嗅了你每一支箭，表情隨著進度越來越難看，眉頭越皺越深。最後一支嗅完，牠在地上打了個大噴嚏，甩了甩頭，轉身走掉了，留下你拿著那排箭不知道該怎麼辦。你換了一批新箭，牠下次來又重新嗅了一遍。" },
      { bond: 1,  name: "磁鐵案",           isSkill: false,
        desc: "記分板上的磁鐵在某個週三集體失蹤。你問了全場所有人，只有一個目擊者說他看到一隻貓叼著什麼東西小跑步離開了場地。你找了整個箭場，沒有找到任何一顆磁鐵，也沒有找到任何藏匿點。那些磁鐵至今下落不明。新的磁鐵用了鐵絲固定。" },
      { bond: 2,  name: "尾巴偵探",         isSkill: false,
        desc: "牠消失了一小段時間，你以為牠睡著了。後來有人叫你：「那隻貓在靶後面。」你繞過去，看到牠鑽進了靶架後方的狹窄夾縫，只有一條尾巴露在外面，緩緩地左右搖擺，節奏很穩定。你蹲下來叫了兩聲，搖擺的速度加快了一點，牠沒有出來。" },
      { bond: 3,  name: "靶紙謀殺案",       isSkill: false,
        desc: "你花了一刻鐘認真架好全新的靶紙，對齊了，固定好了，後退看，完美。你轉身去拿弓，前後不到三分鐘。你回頭，靶紙坍塌了，中央有個向內凹陷的貓型壓痕。牠坐在靶旁邊，表情無辜，爪子收得整整齊齊。地上有爪印。你沒有說話。" },
      { bond: 4,  name: "筆的下落不明",     isSkill: false,
        desc: "你放下計分筆去拿水喝，回來筆不見了。你在桌上找，地上找，椅子下面找，都沒有。後來你看到牠在場邊的牆角附近，爪子踢了什麼東西一下。你走過去，是那枝筆，已經被踢到你無論如何都搆不到的角落。牠的爪子收好，眼神清澈，宣稱完全不認識那枝筆。" },
      { bond: 5,  name: "大噴嚏事件",       isSkill: true,
        desc: "那是你整個練習過程中最專注的一箭，你屏著氣，慢慢拉，慢慢瞄，手臂完全穩定——這時候牠在你三步之外打了一個震耳欲聾的噴嚏，噴嚏結束後還有個尾音。你的手抖了，箭飛歪了，射進了場邊的布幔。牠用前爪擦了一下鼻子，繼續坐著，像是什麼都沒發生。" },
      { bond: 6,  name: "水壺品鑑師",       isSkill: false,
        desc: "牠把所有人的水壺都嗅過一遍，對每個做出不同的表情：有的直接退開，有的皺鼻子，有的側頭想了一下才退開。最後牠回到你的水壺前，喝了幾口，搖搖尾巴走了。你問牠為什麼只喝你的，牠沒有回答。你那天把剩下那瓶沒有繼續喝完。" },
      { bond: 7,  name: "架頂顯靈",         isSkill: false,
        desc: "你去拿弓回來，有人說：「欸，你看箭架頂。」你抬頭，牠坐在箭架的最頂端，大約兩米半高，神情從容，像是一直都在那裡一樣。沒有任何人看到牠怎麼上去的，箭架兩側都沒有明顯的落腳點。有人說一定有辦法，但沒有人真的想花時間研究一隻貓是怎麼上去的。" },
      { bond: 8,  name: "定期打卡",         isSkill: false,
        desc: "每隔大約十到十五分鐘，牠會走到你旁邊，用爪子輕輕拍一下你的腳踝，確認你還在原地，然後轉身走掉，繼續做牠不知道在做的事。如果你離開了原來的位置，牠會用鼻子嗅一下你剛才站的地方，然後找到你，再拍一次。你是一個需要定期簽到的物件。" },
      { bond: 9,  name: "無聲施壓",         isSkill: false,
        desc: "牠在你旁邊坐下，不動，不出聲，就盯著你練習，眼都不眨。你射了一箭，牠看著箭，看著靶，再看回你。你調整動作，牠的頭跟著你的動作轉。你開始懷疑你每個細節是不是都錯了，因為牠的表情完全沒有任何回饋，也沒有不回饋，就是一直看。你有點不敢隨便亂動了。" },
      { bond: 10, name: "認可喵裁判",       isSkill: true,
        desc: "你發現牠好像能分辨你射得好不好。只要你射出一箭進靶心，牠就在那個時間點「喵」一聲，太快不算，早一秒不算，晚一秒也不算，就是在箭中靶心的那一刻。這件事重複了足夠多次，大家開始在你射箭的時候聽牠的聲音做裁判。有一次箭沒射準，牠安靜了。" },
    ],
    color: "#f59e0b",
  },
};

// ── 羈絆等級閾值 ──────────────────────────────────────────────
// bond 數值 → 等級 1-10+
export const BOND_THRESHOLDS = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400];
// BOND_THRESHOLDS[i] = 到達第 i 等需要的羈絆值（0-indexed，level = index）

export function getBondLevel(bond) {
  let lv = 0;
  for (let i = 0; i < BOND_THRESHOLDS.length; i++) {
    if (bond >= BOND_THRESHOLDS[i]) lv = i;
    else break;
  }
  return lv; // 0–10
}

export function getBondProgress(bond) {
  const lv = getBondLevel(bond);
  const cur = BOND_THRESHOLDS[lv] || 0;
  const next = BOND_THRESHOLDS[lv + 1];
  if (!next) return { lv, pct: 100, toNext: 0 };
  return { lv, pct: Math.round(((bond - cur) / (next - cur)) * 100), toNext: next - bond };
}

// ── 章節羈絆需求 ──────────────────────────────────────────────
// ch 1 = bond lv 0（一獲得就解鎖），ch11 = 只有 isDeceased 的貓才有
export const CHAPTER_BOND_LV = [null, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10];
//                                    ch1 ch2 ch3 ch4 ch5 ch6 ch7 ch8 ch9 ch10 ch11

// ── 章節定義（故事文字留白，等現實故事提供後填入）────────────
export function getCatChapters(catId, isDeceased = false) {
  const chapters = [
    { ch: 1,  title: "第一次相遇",          bondLv: 0,  story: "", thought: "", cliffhanger: "" },
    { ch: 2,  title: "箭場的秘密",           bondLv: 2,  story: "", thought: "", cliffhanger: "" },
    { ch: 3,  title: "神秘羽毛",             bondLv: 3,  story: "", thought: "", cliffhanger: "" },
    { ch: 4,  title: "森林裡的新朋友",       bondLv: 4,  story: "", thought: "", cliffhanger: "" },
    { ch: 5,  title: "迷路的冒險",           bondLv: 5,  story: "", thought: "", cliffhanger: "" },
    { ch: 6,  title: "守護箭場的誓言",       bondLv: 6,  story: "", thought: "", cliffhanger: "" },
    { ch: 7,  title: "地下城探索",           bondLv: 7,  story: "", thought: "", cliffhanger: "" },
    { ch: 8,  title: "世界王來襲",           bondLv: 8,  story: "", thought: "", cliffhanger: "" },
    { ch: 9,  title: "夥伴的約定",           bondLv: 9,  story: "", thought: "", cliffhanger: "" },
    { ch: 10, title: "成為貓小隊英雄",       bondLv: 10, story: "", thought: "", cliffhanger: "" },
  ];
  if (isDeceased) {
    chapters.push({
      ch: 11, title: "彩虹橋的另一端",       bondLv: 10, story: "", thought: "", cliffhanger: "",
      isMemorial: true,
      blessings: [], // { memberId, memberName, text, createdAt }
    });
  }
  return chapters;
}

// ── 羈絆加成（取決於類型和羈絆等級）────────────────────────
export function getCatBattleBonus(catType, bondLevel) {
  const lv = bondLevel || 0;
  if (catType === "attack")  return { atkMult: 1 + lv * 0.02, critsBonus: lv * 0.01 };
  if (catType === "defense") return { defBonus: lv * 3, hpBonus: lv * 20 };
  // allround
  return { statMult: 1 + lv * 0.01, coinBonus: lv * 0.01 };
}

// 貓貓對射手基礎值的加乘（用於 useCatCompanion catStatMult）
export function getCatStatMult(catType, bondLevel) {
  const lv = bondLevel || 0;
  if (!lv) return 1.0;
  if (catType === "attack")  return 1 + lv * 0.02;   // 攻擊型每級 +2% ATK
  if (catType === "defense") return 1 + lv * 0.015;  // 防禦型每級 +1.5% 全體
  return 1 + lv * 0.01;                              // 全能型每級 +1%
}

// ── 抽貓機率（開貓貓箱）────────────────────────────────────
export function drawRandomCat(ownedCatIds = []) {
  const unowned = CAT_IDS.filter(id => !ownedCatIds.includes(id));
  if (unowned.length === 0) return null; // 全都有了
  return unowned[Math.floor(Math.random() * unowned.length)];
}

// ── 貓貓類型固定對應（位置決定，不可自選）────────────────
export const CAT_TYPE_MAP = {
  daming:   "allround", gege:   "allround", meimei:   "allround",
  niuniu:   "attack",   haji:   "attack",   baobao:   "attack",
  youyou:   "defense",  xiaoan: "defense",  diandian: "defense",
};

// ── 貓貓技能分組（前三補血、中三攻擊、後三防禦）──────────
export const CAT_SKILL_GROUPS = {
  daming:   "heal",
  gege:     "heal",
  meimei:   "heal",
  niuniu:   "atk",
  haji:     "atk",
  baobao:   "atk",
  youyou:   "def",
  xiaoan:   "def",
  diandian: "def",
};

// ── 貓貓裝備欄位定義（5 格）───────────────────────────────
export const CAT_EQUIP_SLOTS = [
  { id: "bow",     label: "弓",       icon: "🏹", stat: "atk", matKey: "ore"       },
  { id: "arrow",   label: "箭",       icon: "🪃", stat: "atk", matKey: "meat"      },
  { id: "armor",   label: "防具",     icon: "🛡️", stat: "def", matKey: "ore"       },
  { id: "herbBag", label: "貓草包",   icon: "🌿", stat: "def", matKey: "driedfish" },
  { id: "potion",  label: "貓草藥水", icon: "🍵", stat: "hp",  matKey: "potion"    },
];

// 六品質：普通→稀有→精英→頭目→傳說→神話（史詩改為頭目/Boss）
export const CAT_EQUIP_GRADE_NAMES  = ["普通", "稀有", "精英", "頭目", "傳說", "神話"];
export const CAT_EQUIP_GRADE_COLORS = ["#9ca3af","#22c55e","#3b82f6","#f97316","#f59e0b","#ef4444"];
// 每品質顯示底色（帶透明度，用於UI背景）
export const CAT_EQUIP_GRADE_BG = [
  "rgba(156,163,175,0.15)", // 普通 gray
  "rgba(34,197,94,0.15)",   // 稀有 green
  "rgba(59,130,246,0.15)",  // 精英 blue
  "rgba(249,115,22,0.15)",  // 頭目 orange
  "rgba(245,158,11,0.15)",  // 傳說 gold
  "rgba(239,68,68,0.15)",   // 神話 red
];
export const CAT_EQUIP_MAX_PLUS = 9; // +0～+9，每品質10格，6品質共60級

// 裝備等級 = gradeIdx × 10 + plusLevel + 1（顯示 Lv.1～Lv.60）
export function catEquipLevel(grade, plusLevel) {
  const gIdx = CAT_EQUIP_GRADE_NAMES.indexOf(grade);
  return (gIdx < 0 ? 0 : gIdx) * 10 + (plusLevel || 0) + 1;
}

// 裝備加成 = (gradeIdx × 10 + 1) + plusLevel → ATK/DEF 直接加；HP × 5
// 全滿（神話+9）每欄 = 60，ATK欄×2=120，DEF欄×2=120，HP欄×5=300
export function calcCatEquipBonus(equip = {}) {
  let atkBonus = 0, defBonus = 0, hpBonus = 0;
  for (const s of CAT_EQUIP_SLOTS) {
    const e = equip[s.id];
    if (!e) continue;
    const gIdx = CAT_EQUIP_GRADE_NAMES.indexOf(e.grade);
    if (gIdx < 0) continue;
    const bonus = (gIdx * 10 + 1) + (e.plusLevel || 0);
    if      (s.stat === "atk") atkBonus += bonus;
    else if (s.stat === "def") defBonus += bonus;
    else if (s.stat === "hp")  hpBonus  += bonus * 5;
  }
  return { atkBonus, defBonus, hpBonus };
}

// ── 鍛造費用表（×10 倍，適配長期掛機）────────────────────────
// plusUpgrades[i] = 升至 +(i+1) 所需；共9條（+0→+9）
// gradeUpgrades[g] = 從 grade g 升至 g+1 所需
export const CAT_FORGE_COSTS = {
  plusUpgrades: [
    { tier: 1, amount:  30 },  // +0 → +1
    { tier: 1, amount:  60 },  // +1 → +2
    { tier: 1, amount: 100 },  // +2 → +3
    { tier: 2, amount:  30 },  // +3 → +4
    { tier: 2, amount:  60 },  // +4 → +5
    { tier: 2, amount: 100 },  // +5 → +6
    { tier: 3, amount:  30 },  // +6 → +7
    { tier: 3, amount:  60 },  // +7 → +8
    { tier: 3, amount: 100 },  // +8 → +9
  ],
  gradeUpgrades: [
    { main: [{ tier: 1, amount: 200 }],                                        special: null            }, // 普通→稀有
    { main: [{ tier: 1, amount: 300 }, { tier: 2, amount: 100 }],              special: null            }, // 稀有→精英
    { main: [{ tier: 2, amount: 200 }, { tier: 3, amount:  80 }],              special: null            }, // 精英→頭目
    { main: [{ tier: 3, amount: 150 }, { tier: 4, amount:  50 }],              special: { fur_t1: 20 } }, // 頭目→傳說
    { main: [{ tier: 4, amount: 100 }, { tier: 5, amount:  30 }],              special: { fur_t1: 50 } }, // 傳說→神話
  ],
};

// 計算升級所需材料（回傳 { [resourceKey]: amount }）
export function calcForgeCost(slotId, currentGrade, currentPlus) {
  const slot = CAT_EQUIP_SLOTS.find(s => s.id === slotId);
  const gIdx = CAT_EQUIP_GRADE_NAMES.indexOf(currentGrade);
  if (!slot || gIdx < 0) return null;

  if (currentPlus < CAT_EQUIP_MAX_PLUS) {
    const { tier, amount } = CAT_FORGE_COSTS.plusUpgrades[currentPlus];
    return { [`${slot.matKey}_t${tier}`]: amount };
  }
  if (gIdx >= CAT_EQUIP_GRADE_NAMES.length - 1) return null; // 已是神話
  const { main, special } = CAT_FORGE_COSTS.gradeUpgrades[gIdx];
  const cost = {};
  for (const { tier, amount } of main) cost[`${slot.matKey}_t${tier}`] = amount;
  if (special) Object.assign(cost, special);
  return cost;
}

// ── 貓貓技能觸發機率（0–0.25）──────────────────────────────
export function calcCatSkillChance(catLevel, bondLv) {
  return Math.min(0.25, 0.05 + (catLevel || 1) * 0.0005 + (bondLv || 0) * 0.01);
}

// ── 貓貓技能效果（回傳 { skillGroup, healed?, extraMult?, reduction? }）
// heal → { healed: number }
// atk  → { extraMult: number }（0 = +20%, 1.0 = 翻倍傷害）
// def  → { reduction: number }（0.2–0.8），blockFull 可能為 true
export function calcCatSkillEffect(skillGroup, catLevel, bondLv) {
  const lv = catLevel || 1;
  const bl = bondLv  || 0;
  if (skillGroup === "heal") {
    const maxHeal = 10 + lv * 0.5 + bl * 5;
    const healed  = Math.round(maxHeal * (0.7 + Math.random() * 0.3));
    return { healed };
  }
  if (skillGroup === "atk") {
    // min = 0.2 + level×0.001 + bond×0.02，max = 1.0（翻倍）
    const minMult = Math.min(1.0, 0.2 + lv * 0.001 + bl * 0.02);
    const extraMult = minMult + Math.random() * (1.0 - minMult);
    return { extraMult };
  }
  // def
  const minRed  = Math.min(0.8, 0.2 + lv * 0.001 + bl * 0.02);
  const reduction = minRed + Math.random() * (0.8 - minRed);
  // 高等級+高羈絆 3% 機率完全格擋
  const blockFull = (lv > 150 && bl >= 8) && Math.random() < 0.03;
  return { reduction, blockFull };
}
