// src/components/member/CatVillage.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  collectVillageResources, upgradeVillageBuilding, initVillageIfNeeded,
  exchangeVillageMaterial, exchangeMaterialsForChest,
  subscribeCardMarket, listCardForSale, buyCardListing, cancelCardListing, claimCardSaleProceeds,
  getVillageMarketConfig, setBuildingAllocation, assignVillageWorker,
  setDisplayVillageLv,
} from "../../lib/db";
import { CAT_CARD_MAP } from "../../lib/catCardData";
import { subscribeMyCats, upgradeCatEquip, equipCat } from "../../lib/catDb";
import {
  CATS, getBondLevel,
  CAT_EQUIP_SLOTS, CAT_EQUIP_GRADE_NAMES, CAT_EQUIP_GRADE_COLORS, CAT_EQUIP_GRADE_BG,
  CAT_EQUIP_MAX_PLUS, calcForgeCost, catEquipEnhancement,
} from "../../lib/catData";
import { catLevelFromXP, catXPProgress } from "../../lib/catLevel";
import { getLevelStyle } from "../../lib/archerLevel";
import { sfxSuccess, sfxEpic, sfxTap, sfxVillageCollect, sfxVillageBuild, sfxVillageExchange } from "../../lib/sound";
import {
  BUILDINGS, BUILDING_LIST, getVillageLevel, getBuildingStage,
  getProductionRate, getUpgradeRequirements, canUpgrade,
  calcPendingResources, RESOURCE_NAMES, DEFAULT_VILLAGE,
  UNLOCK_REQS, isBuildingUnlocked, TIERED_RESOURCES, getResourceKey,
  getWorkerCatMultiplier, getStageMultiplier, getMaxSlots, normalizeBuildingAllocation, getVillageLastCollectedMs, MAX_COLLECT_HOURS,
} from "../../lib/villageData";
import GachaMachine from "./GachaMachine";
import CouncilHall  from "./CouncilHall";
import VillageGoalBanner from "./VillageGoalBanner";
import { autoSpawnVillageGoal } from "../../lib/villageGoalDb";
import { craftPotion, subscribePotions } from "../../lib/db";
import { CARRY_POTIONS, THROW_POTIONS, RAID_POTIONS } from "../../lib/itemData";
import { calculateMaxCrafts } from "../../lib/consumableSystem";

// 手繪風配色常數
const C = {
  bg:       "linear-gradient(180deg,#FDF6EC,#F0E8D8)",
  card:     "rgba(255,255,255,0.88)",
  border:   "#E0CDB5",
  brown:    "#5C3D2E",
  mid:      "#9B7B6A",
  muted:    "#C4A899",
  sage:     "#6B8E5E",
  lock:     "rgba(218,205,190,0.45)",
  lockBd:   "#D8C4B0",
  shadow:   "0 2px 8px rgba(100,70,50,0.10)",
};

const CAT_DAILY_QUOTES = {
  daming: [
    "今天的村莊由老大我親自巡視，誰敢偷懶？",
    "你放心去冒險，後方的後勤與村莊，老大我看著呢。",
    "別偷懶，採集與升級都要按部就班！",
    "村莊就交給我了，遇到硬骨頭怪物隨時叫我！",
    "這座村莊每棵樹、每塊石頭，都是大家一起建起來的霸氣領域！",
    "（滿意地看著村莊）哼，今天大家幹得還不錯！",
    "聽說隔壁的怪物最近很囂張？看我哪天帶隊去踏平牠們的巢穴！",
    "我的字典裡可沒有『退縮』這兩個字，你要跟緊我的腳步！",
    "今天誰沒把箭保養好的，通通罰去掃糧倉！",
    "（傲嬌地轉頭）看什麼看？我只是剛好巡邏經過你身邊而已！",
    "看你今天氣勢不錯，有老大我當年三成的風範了！",
    "別擔心材料不夠，老大的糧倉隨時準備好了最雄厚的底牌。",
    "村莊的防禦堅若磐石，你有空就多去練習場刷幾輪高分！",
    "（幫你拍拍身上的灰塵）出門冒險衣服整齊點，別丟我們貓貓村的臉！",
    "只要老大我還站著，這座村莊就絕對不會倒下！",
  ],
  gege: [
    "早安！今天也一起溫柔且充滿力量地加油喔！",
    "有我在，任何困難我們都能一步步解決。",
    "你最近的進步大家都看在眼裡呢，真為你驕傲。",
    "來，先深呼吸，調整好步調再出發吧。",
    "不急不急，累了隨時可以回村莊喝口溫水歇歇腳。",
    "貓村的大家都很喜歡你，加油！",
    "今天我做了一些小魚乾煎餅，等等訓練完一起吃吧？",
    "如果遇到瓶頸不要灰心，弓弦拉得越深，箭飛得越遠喔。",
    "你總是這麼照顧大家，偶爾也要學會依賴我們一下呀。",
    "（溫柔地微笑）看到你每天都這麼努力，我覺得好溫暖。",
    "今天陽光真好，微風吹過箭場的感覺最舒服了。",
    "不管結果如何，過程中的每一次揮汗都是最寶貴的收穫。",
    "箭袋的肩帶是不是有點鬆了？來，我幫你調緊一點。",
    "別給自己太大壓力，飯要一口一口吃，建築也要一步步升級呀。",
    "今晚村莊有營火聚會，記得早點回來休息喔！",
  ],
  meimei: [
    "今天也有超多箭要射！快快快，衝呀！",
    "快趕快去採集！我感覺今天大豐收機率超高！",
    "哇！你剛剛看到那個飛過去的大寶箱了嗎？",
    "今天的天氣太棒了，完全是升級建築的大吉日！",
    "箭矢飛過去的聲音好聽死了！我們再射一輪吧！",
    "快看快看！我又發現了一個好地方！",
    "快點快點！再不出發好康的都要被隔壁的小鳥搶光了啦！",
    "（在你身邊蹦蹦跳跳）哇！今天感覺精力充沛到可以跑十圈！",
    "剛才我一箭射中了會飛的蝴蝶！呃……雖然蝴蝶沒事啦！",
    "村長村長！我們今天去挑戰最難的地下城好不好？好不好嘛！",
    "哈哈哈哈！剛剛看到大娘踩到小魚乾差點滑倒，太搞笑啦！",
    "看我這招——超絕無敵貓貓疾風射擊！咻咻咻！",
    "不要停下來！冒險就是要熱血沸騰才叫冒險啊！",
    "（滿眼放光）採集庫的寶物又變多了！好想全部一口氣打開！",
    "今天我也會用最快的速度幫你收集材料，等我的好消息吧！",
  ],
  niuniu: [
    "規則就是規則，建築升級與資源調配不能有半點誤差。",
    "升級需求都仔細核對過了麼？沒有漏看材料吧？",
    "按照既定計畫走，效率才是最優解。",
    "一板一眼不是刻板，是確保全村萬無一失的標準。",
    "數據顯示，我們現在的採集與生產效率正穩定上升。",
    "請務必保持這個節奏，不可掉以輕心。",
    "我剛才把倉庫的資源重新整理分類了，精準度提升了 12.5%。",
    "練習時動作如果偏了 1 公分，落在靶心就會偏差 10 公分。",
    "情緒波動會影響放箭的穩定度，請保持冷靜與理性。",
    "（拿出小本本記錄）今天村莊的物資消耗與產出全部符合預期。",
    "不要試圖在安全規範上走捷徑，那只會帶來不可預期的風險。",
    "好的制度能讓村莊繁榮千百年，我會嚴格執行每一條村規。",
    "你的射姿剛才稍微抬高了 2 度，下一箭請注意校正。",
    "時間就是最寶貴的資源，請妥善規劃今天的每一分每一秒。",
    "感謝你為村莊做出的貢獻，這符合我們當前的發展戰略。",
  ],
  haji: [
    "……（眼睛半睜）zZ 夢裡剛好夢到香噴噴的烤魚乾……",
    "喵……箭場的微風暖洋洋的，最適合趴在靶架下打盹了……",
    "等等……讓我再瞇五分鐘，就五分鐘……zZ",
    "（小聲呼嚕）喵嗚……你在這裡啊……真安心……",
    "天上的雲朵……看起來好像一團巨大的棉花糖貓草……",
    "ふ啊……今天也是安靜又舒服的一天呢……",
    "……嗯？要出發了嗎？那……我在夢裡為你加油喔……zZ",
    "（整隻貓趴在弓袋上）這個袋子……軟軟的……剛剛好符合我的形狀……",
    "外面好吵喔……還是村莊的木地板躺起來最舒服了……",
    "喵……剛才好像夢到你射中了 100 個靶心呢……好厲害……",
    "（慢慢揉眼睛）ふ哇～陽光曬得毛毛好癢好舒服喔……",
    "走太快會錯過路邊的花朵喔……偶爾停下來放空一下吧……",
    "只要你在身邊……在哪裡睡覺感覺都是甜甜的夢……",
    "……別把我抱起來嘛……我還在跟魚乾大明神聊天說……",
    "喵嗚……今天也是和平幸福的一天呢……zZ",
  ],
  baobao: [
    "你回來啦！我好想你好想你！快摸摸我！",
    "弓袋裡又暖又軟，能讓我進去抱著睡一下嗎？",
    "今天要去哪裡採集？帶我一起去好不好？",
    "無論去哪裡冒險，貓村都有寶寶一直在等著你回來喔！",
    "（蹭蹭你的手）今天辛苦了！有我是不是很治癒呀？",
    "喵嗚～不管發生什麼事，我最喜歡你了！",
    "你剛剛是不是去摸了別的貓？身上有陌生貓咪的味道喔哼！",
    "（抱住你的小腿）不准走不准走！再陪我玩五分鐘嘛！",
    "你看你看！我今天學會了直立站起來摸摸喔！我是不是很棒！",
    "今天的罐頭……能不能偷偷幫我多加一匙小魚乾？拜託拜託～",
    "只要跟著你，就算去最可怕的森林我也不會害怕！",
    "（發出超大聲呼嚕）只要被你摸下巴，我就覺得好滿足好幸福！",
    "不要理那些繁重的任務啦，先吸一下貓咪補滿能量吧！",
    "你是我全世界最崇拜的大英雄！沒有之一！",
    "明天也要記得帶我一起玩喔，約好了扣手指勾勾！",
  ],
  youyou: [
    "慢慢走，才能看清楚前方的路與風景。",
    "我看過了，這棟建築的氣場正旺，還能再升一層。",
    "一步一個腳印，終會到達最頂峰。",
    "不用急躁，今天的任務量剛剛好，時間很充裕。",
    "眼神放平，呼吸放緩，勝利自然會來到。",
    "貓村的歷史，就是這樣一磚一瓦積累起來的。",
    "急於求成往往會適得其反，穩住心神才是上策。",
    "（眯起雙眼凝視遠方）風的方向變了，看來好運即將來到。",
    "這片土地孕育著深厚的能量，用心去感受自然的脈動吧。",
    "經驗的累積就像沉澱的古酒，越久越顯香醇精湛。",
    "遇到強敵時不要硬碰硬，順著對手的力道尋找破綻即可。",
    "看你的腳步沉穩了不少，這就是歲月與歷練的印記呀。",
    "村莊的根基打得越深，將來就能承載越宏偉的建築。",
    "（輕輕甩尾巴）今天茶室的茶香特別誘人，忙完不妨來喝一杯。",
    "心如止水，手如鐵石，這一箭自然神準無比。",
  ],
  xiaoan: [
    "（有一點點緊張小聲說）我……我會努力的！我不怕！",
    "剛、剛才有點被嚇到發抖，但我絕對不會退縮的！",
    "只要大家在一起，再危險的地方我也可以鼓起勇氣！",
    "爪子雖然在抖，但我會抓緊弓箭的！",
    "謝、謝謝你一直照顧我！我會成為你的驕傲！",
    "（加油打氣中）呼……吸……小安可以的！",
    "（拉住你的衣角）前、前面好像有怪物的聲音……但我會保護你的！",
    "雖然我常常躲在大家後面……但我也想成為能派上用場的貓！",
    "剛才那隻大蜘蛛真的好可怕……還好有你及時出現！",
    "我把幸運符抱得緊緊的！今天冒險一定會順順利利！",
    "（鼓起腮幫子）哼！我、我才沒有在哭呢！只是眼睛進沙子了！",
    "看著大家的背影，我就會慢慢湧出無窮無盡的勇氣！",
    "就算失敗了一百次，第一百零一次我還是會勇敢站起來的！",
    "謝謝你相信這麼膽小的我……我一定會更加加油的！",
    "（握緊小爪子）今天的小安，比昨天的自己又勇敢了一點點！",
  ],
  diandian: [
    "村莊周圍的靈氣今天特別旺盛……感覺到了嗎？",
    "我看見了隱藏在風中的軌跡，但時機未到，尚不可言說。",
    "箭露的流動與自然的韻律在共鳴……",
    "黑夜越深沉，前方微光的軌跡就越清晰透徹。",
    "萬物皆有靈，連每一支飛箭都有牠自己的靈魂。",
    "（默默凝視天空）神秘的力量在守護著這片土地……",
    "當黑夜降臨之時，真正的獵人才能洞悉一切偽裝與虛妄。",
    "不要用眼睛去看，要用你的心靈去感應風與靶心的呼喚。",
    "（爪子劃過空氣）命運的輪盤正在轉動，新的傳奇即將誕生。",
    "這片深邃的黑色皮毛，能吸收世間所有的不安與混沌。",
    "你在困惑嗎？靜下心來，答案其實早已深植在你的直覺中。",
    "飛箭在空中劃出的曲線，正是天地萬物溝通的符文。",
    "（金黃色的雙眼閃爍微光）古老的守護陣法依然在庇佑著貓村。",
    "黑夜並不可怕，它是孕育光明最深沉的溫床。",
    "時機已經成熟……去吧，展現你蘊藏的無上限潛能！",
  ],
};

// ── 秘書貓 Header ─────────────────────────────────────────────
function SecretaryCat({ cat }) {
  const catInfo = cat ? CATS[cat.catId] : null;
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isClicking, setIsClicking] = useState(false);

  if (!catInfo) return null;
  const bondLv = getBondLevel(cat.bond || 0);
  const quotes = CAT_DAILY_QUOTES[cat.catId] || ["今天也要加油喔！"];
  const currentQuote = quotes[quoteIdx % quotes.length];

  const handleCatClick = () => {
    sfxTap();
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 200);
    setQuoteIdx(prev => (prev + 1) % quotes.length);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 shadow-sm transition-all"
      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(253,246,236,0.85))", borderBottom: `1px solid ${C.border}` }}>
      {/* 貓咪頭像 (點擊可互動) */}
      <div onClick={handleCatClick}
        title="點擊與秘書貓互動"
        className="cursor-pointer active:scale-90 transition-transform"
        style={{ position:"relative", width:50, height:50, flexShrink:0 }}>
        <img
          src={`/cats/portraits/${cat.catId}.webp`}
          alt={catInfo.name}
          style={{ width:50, height:50, borderRadius:"50%", objectFit:"cover",
            border:`2.5px solid ${C.sage}`, background: catInfo.palette?.light || "#f5e6d0",
            boxShadow: isClicking ? "0 0 12px rgba(107,142,94,0.6)" : "0 2px 6px rgba(0,0,0,0.1)" }}
          onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
        />
        <div style={{ display:"none", width:50, height:50, borderRadius:"50%",
          background: catInfo.palette?.light || "#f5e6d0",
          alignItems:"center", justifyContent:"center", fontSize:24,
          border:`2.5px solid ${C.sage}` }}>🐱</div>
        <div style={{
          position:"absolute", bottom:-2, right:-2,
          background: C.sage, borderRadius:10, padding:"1px 6px",
          fontSize:9, fontWeight:900, color:"white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
        }}>Lv.{bondLv}</div>
      </div>
      {/* 文字 */}
      <div className="shrink-0">
        <div className="font-black text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>秘書貓夥伴</div>
        <div className="font-black text-sm leading-tight flex items-center gap-1" style={{ color: C.brown }}>
          <span>{catInfo.name}</span>
          <span className="text-[10px] text-emerald-600 font-normal">🐾</span>
        </div>
      </div>
      {/* 台詞氣泡 (點擊可切換對話) */}
      <div onClick={handleCatClick}
        className="flex-1 rounded-2xl px-3 py-2 text-[11px] leading-snug cursor-pointer hover:bg-white transition-all shadow-sm active:scale-[0.99]"
        style={{ background:"rgba(255,255,255,0.9)", border:`1.5px solid ${C.border}`, color: C.brown, minHeight: 40, display:"flex", alignItems:"center" }}>
        <span>「{currentQuote}」</span>
      </div>
    </div>
  );
}

// ── 全景圖（多幀瞬間切換，像 GIF）──────────────────────────────
// 幀標籤：a, b, c, d, e → 產生 panorama-lv01-a.webp ~ panorama-lv01-e.webp
// 若無多幀圖檔，自動降級為單張靜態圖
const PANORAMA_FRAMES = ['a', 'b', 'c', 'd', 'e'];
const FRAME_INTERVAL_MS = 2000;

function PanoramaView({ villageLevel, displayLv, memberId }) {
  const actualLv = Math.max(1, Math.min(20, villageLevel || 1));
  const showLv   = displayLv ? Math.max(1, Math.min(20, displayLv)) : actualLv;
  const pad      = String(showLv).padStart(2, "0");
  const baseSrc  = `/ui/village/panorama-lv${pad}`;

  const [frameIdx, setFrameIdx] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);

  // 點擊外部關閉 picker
  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  // 定時切換幀
  useEffect(() => {
    if (hasError) return;
    const t = setInterval(() => {
      setFrameIdx(i => (i + 1) % PANORAMA_FRAMES.length);
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasError, showLv]);

  // 顯示等級改變時重置
  useEffect(() => {
    setFrameIdx(0);
    setHasError(false);
  }, [showLv]);

  const curSrc = `${baseSrc}-${PANORAMA_FRAMES[frameIdx]}.webp`;
  const imgSrc = hasError ? `${baseSrc}.webp` : curSrc;

  async function handleSelectLevel(lv) {
    if (!memberId) return;
    setSaving(true);
    await setDisplayVillageLv(memberId, lv);
    setSaving(false);
    setShowPicker(false);
  }

  return (
    <div className="px-4 pt-3">
      <div className="group relative w-full overflow-hidden rounded-3xl transition-all duration-300"
        style={{
          aspectRatio:"16 / 9",
          border:`2px solid ${C.border}`,
          boxShadow: "0 8px 24px rgba(92, 61, 46, 0.18)",
          background:"#EDE0CE",
        }}>
        <img
          src={imgSrc}
          alt={`村莊 Lv${showLv}`}
          width="750" height="370" fetchPriority="high"
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
          onError={() => { setHasError(true); }}
        />

        {/* 沉浸光效 Overlay：暖陽晨光與頂部暗度漸層 */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(60,35,15,0.4) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.15) 100%), linear-gradient(45deg, rgba(251,191,36,0.1) 0%, transparent 60%)"
        }} />

        <LevelBadge lv={showLv} actualLv={actualLv} onClick={() => setShowPicker(p => !p)} />

        {/* 等級切換器 */}
        {showPicker && (
          <div ref={pickerRef} style={{
            position: "absolute", top: 50, left: 12,
            background: "rgba(60,35,15,0.93)", backdropFilter: "blur(10px)",
            borderRadius: 14, padding: "8px 10px",
            color: "#FFF8F0", zIndex: 100, minWidth: 180,
            boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
          }}>
            <div className="text-[10px] font-bold mb-2" style={{ color: "#D4C4A8", textAlign: "center" }}>
              🎨 選擇村莊外觀
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {Array.from({ length: actualLv }, (_, i) => i + 1).map(lv => {
                const isActive = lv === showLv;
                return (
                  <button key={lv} onClick={() => handleSelectLevel(lv)}
                    disabled={saving}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: isActive ? C.sage : "rgba(255,255,255,0.10)",
                      color: isActive ? "#FFF" : "#D4C4A8",
                      border: isActive ? "2px solid #A0D090" : "1px solid rgba(255,255,255,0.15)",
                      fontSize: 12, fontWeight: 900,
                      cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      transition: "all .15s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}>
                    {saving ? "…" : lv}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <button onClick={() => handleSelectLevel(null)}
                disabled={saving}
                style={{
                  width: "100%", padding: "4px 0", borderRadius: 8,
                  background: displayLv ? "rgba(255,255,255,0.08)" : C.sage,
                  color: displayLv ? "#D4C4A8" : "#FFF",
                  border: "none", fontSize: 11, fontWeight: 900,
                  cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseEnter={e => { if (displayLv) e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                onMouseLeave={e => { if (displayLv) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}>
                {saving ? "…" : displayLv ? "🔄 自動（跟隨實際等級）" : "✓ 自動跟隨中"}
              </button>
            </div>
            <div className="text-[9px] mt-1.5" style={{ color: "#A09080", textAlign: "center" }}>
              解鎖至 Lv.{actualLv}，可選 1~{actualLv}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 等級角標（可點擊） ──────────────────────────────────────
function LevelBadge({ lv, actualLv, onClick }) {
  const isDifferent = lv !== actualLv;
  return (
    <div onClick={onClick}
      style={{
        position: "absolute", top: 10, left: 12,
        background: "rgba(60,35,15,0.62)", backdropFilter: "blur(6px)",
        borderRadius: "20px", padding: "4px 14px",
        color: "#FFF8F0", fontWeight: 900, fontSize: "13px",
        cursor: "pointer", userSelect: "none",
        display: "flex", alignItems: "center", gap: 5,
        transition: "background .15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(60,35,15,0.80)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(60,35,15,0.62)"}>
      🏡 村莊 Lv.{lv}
      {isDifferent && <span style={{ fontSize: 9, color: "#A0D090" }}>▼</span>}
    </div>
  );
}

// ── 資源採集列 ───────────────────────────────────────────────
function ResourceBar({ resources, pending, onCollect, collecting, nextCollectSec, elapsedSec, collectedResult }) {
  const arrowdew = (resources?.arrowdew || 0);
  const hasPending = Object.values(pending || {}).some(v => v > 0);
  const pendingArrow = pending?.arrowdew || 0;

  const timeStr = useMemo(() => {
    if (nextCollectSec <= 0) return null;
    const h = Math.floor(nextCollectSec / 3600);
    const m = Math.floor((nextCollectSec % 3600) / 60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  }, [nextCollectSec]);

  const elapsedStr = useMemo(() => {
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`;
  }, [elapsedSec]);

  const COLLECT_EMOJI = { ore:'⛏️', melon:'🌿', fish:'🐟', meat:'🥩', driedfish:'🐠', can:'🥫', potion:'🍵', fur:'🐾', archer:'🏹', arrowdew:'💧', gachaCoins:'🎰', gachaToken:'🎰' };

  const collectedItems = useMemo(() => {
    if (!collectedResult) return [];
    return Object.entries(collectedResult).map(([key, amt]) => {
      if (key === 'gachaCoins') return { key, icon:'🎰', name: '扭蛋幣', tier: null, amt };
      if (key.includes('_t')) {
        const [res, t] = key.split('_t');
        return { key, icon: COLLECT_EMOJI[res] || '📦', name: RESOURCE_NAMES[res] || res, tier: `T${t}`, amt };
      }
      return { key, icon: COLLECT_EMOJI[key] || '📦', name: RESOURCE_NAMES[key] || key, tier: null, amt };
    });
  }, [collectedResult]);

  const pendingItems = useMemo(() => Object.entries(pending || {})
    .filter(([, amount]) => Number(amount) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => {
      const [res, tier] = key.split("_t");
      return {
        key,
        label: `${RESOURCE_NAMES[res] || res}${tier ? ` T${tier}` : ""}`,
        amount: Number(amount) >= 10 ? Math.floor(Number(amount)).toLocaleString() : Number(amount).toFixed(1),
      };
    }), [pending]);

  return (
    <>
      <div className="px-4 py-3 flex items-center justify-between gap-3 shadow-inner"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(253,246,236,0.95))", borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background:"rgba(107,142,94,0.15)", border:"1px solid rgba(107,142,94,0.3)" }}>
            <span className="text-xl">💧</span>
          </div>
          <div>
            <div className="font-black text-base leading-none" style={{ color: C.brown }}>{arrowdew.toLocaleString()}</div>
            <div className="text-[10px] font-bold mt-0.5" style={{ color: C.muted }}>箭露總額</div>
          </div>
          {hasPending && pendingArrow > 0 && (
            <div className="text-xs font-black px-2 py-0.5 rounded-full animate-bounce" style={{ background: "rgba(34,197,94,0.15)", color: "#166534" }}>
              +{pendingArrow.toLocaleString()}
            </div>
          )}
        </div>

        <button
          onClick={onCollect}
          disabled={collecting || !hasPending}
          className={`px-5 py-2.5 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${hasPending ? "animate-pulse shadow-md" : ""}`}
          style={{
            background: hasPending
              ? "linear-gradient(135deg,#5A9E50,#3D7834)"
              : C.lockBd,
            color: hasPending ? "white" : C.muted,
            cursor: hasPending ? "pointer" : "default",
            boxShadow: hasPending ? "0 4px 14px rgba(90,158,80,0.4)" : "none",
            border: hasPending ? "1px solid rgba(255,255,255,0.4)" : "none",
          }}>
          <span>✦</span>
          <span>{collecting ? "採集中…" : hasPending ? "一鍵採集" : (timeStr ? `${timeStr}後` : "已採集")}</span>
        </button>
      </div>
      <div className="px-4 py-3" style={{ background:"rgba(255,255,255,0.45)", borderBottom:`1px solid ${C.border}` }}>
        {/* 時間文字標示 */}
        <div className="flex justify-between gap-3 text-xs font-bold mb-1.5" style={{ color: C.brown }}>
          <span className="flex items-center gap-1">
            <span>⏱️ 已累積：</span>
            <span className="font-black text-emerald-700">{elapsedStr}</span>
          </span>
          <span className="text-[11px]" style={{ color: C.mid }}>
            {timeStr ? `距離滿容量 (${MAX_COLLECT_HOURS}h)：還剩 ${timeStr}` : "⚡ 產能已滿 (24h)"}
          </span>
        </div>

        {/* 24 小時累積進度條 */}
        {(() => {
          const maxSec = MAX_COLLECT_HOURS * 3600;
          const pct = Math.min(100, Math.max(0, Math.round((elapsedSec / maxSec) * 100)));
          const isFull = pct >= 100;
          return (
            <div className="space-y-1 my-1.5">
              <div className="h-2.5 w-full rounded-full overflow-hidden p-0.5" style={{ background: "rgba(0,0,0,0.08)", border: "1px solid rgba(107,142,94,0.2)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isFull ? "linear-gradient(90deg, #F59E0B, #EF4444)" : "linear-gradient(90deg, #6B8E5E, #10B981)",
                    boxShadow: isFull ? "0 0 8px rgba(245,158,11,0.6)" : "0 0 6px rgba(16,185,129,0.4)",
                  }}
                />
              </div>
              <div className="flex justify-end text-[10px] font-black" style={{ color: isFull ? "#D97706" : C.sage }}>
                {isFull ? "容量 100% (請盡快採集)" : `累積容量 ${pct}%`}
              </div>
            </div>
          );
        })()}

        {/* 正在累積材料標籤 */}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {pendingItems.length ? pendingItems.map(item => (
            <span key={item.key} className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background:"rgba(107,142,94,.13)", color:C.sage, border:"1px solid rgba(107,142,94,.22)" }}>
              {item.label} +{item.amount}
            </span>
          )) : <span className="text-[10px]" style={{ color:C.muted }}>材料正在累積中…</span>}
        </div>
      </div>
      {collectedItems.length > 0 && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "rgba(50,28,10,0.93)", borderRadius: 18, padding: "12px 18px",
          color: "white", zIndex: 9999, maxWidth: "92vw", minWidth: 200,
          boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
        }}>
          <div className="text-[11px] font-black mb-2 text-center" style={{ color: "#FFD580", letterSpacing: 1 }}>
            ✦ 採集成功！
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {collectedItems.map(({ key, icon, name, tier, amt }) => (
              <div key={key} style={{
                background: "rgba(255,255,255,0.12)", borderRadius: 12,
                padding: "6px 12px", display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
                    {name}{tier && <span style={{ fontSize: 10, color: "#FFD580", marginLeft: 3 }}>{tier}</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#7CBF70" }}>+{amt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── 貓咪工作抱怨留言庫 ───────────────────────────────────────
const CAT_WORK_COMPLAINTS = {
  daming: [
    "這裡的老大是我，怎麼還要我親自搬材料？",
    "後輩們都在打盹，只有大娘在辛勤做工…",
    "等本大娘工做完了，肉乾可不能少我的！",
  ],
  gege: [
    "呼…雖然很累，但為了大家的糧食，哥哥得頂住！",
    "這裡灰塵有點大，我的白毛都要變黃了啦…",
    "射手大人，做完這輪可以撫摸一下我嗎？",
  ],
  meimei: [
    "好想去箭場追飛箭喔！為什麼要我在這裡站崗啦！",
    "工作好無聊喔～我可以在這裡翻滾打滾嗎？",
    "嘿休！嘿休！我搬得比哥哥還快喔！",
  ],
  niuniu: [
    "今天的產能進度落後了 0.5%，請大家提高效率！",
    "本貓正在嚴格監視生產品質，不准偷懶！",
    "一板一眼才是工作之道，偷工減料絕對不行！",
  ],
  haji: [
    "喵嗚…好睏喔，可以在這個箱子上睡一下嗎？",
    "這裡陽光真好，工作什麼的好像不重要了…",
    "夢裡我已經把所有工作都做完了…睡吧…",
  ],
  baobao: [
    "這裡沒有我的專屬弓袋，抱起來不舒服啦！",
    "黏在射手身邊才是我的主業，工作只是兼職！",
    "罐頭！罐頭！做完這工我要吃雙倍罐頭！",
  ],
  youyou: [
    "慢慢來，比較快…急什麼急呢喵～",
    "我的銳利眼神早已看穿這個建築的產能極限…",
    "悠悠看著你呢，別想偷偷少算我的工資！",
  ],
  xiaoan: [
    "這裡好黑好嚇人喔…爪子又在發抖了啦！",
    "雖然我很害怕，但為了村莊我會堅守到最後的！",
    "剛才那邊是不是有老鼠跑過去了？好恐怖…",
  ],
  diandian: [
    "這座建築四周流動著奇妙的靈氣呢…",
    "黑夜才是我的主場，白天工作真不習慣…",
    "我看見產能神明在向我們招手了喵…",
  ],
};

function getWorkerCatComplaint(catId, buildingId) {
  const list = CAT_WORK_COMPLAINTS[catId] || [
    "喵～今天也在努力幫村莊工作呢！",
    "工資記得多給一罐罐頭喔！",
  ];
  // 使用 buildingId 與 catId 的字串雜湊，確保同一建築的留言固定或輪替
  const charCodeSum = (buildingId + catId).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return list[charCodeSum % list.length];
}

// ── 建築卡片 ─────────────────────────────────────────────────
// 產能分層顯示（資源 tier breakdown）
function ProductionBreakdown({ buildingId, level, allocations, workerMult = 1 }) {
  const b     = BUILDINGS[buildingId];
  const hasTier = b && TIERED_RESOURCES.has(b.resource);
  const round1 = n => Math.round(n * 10) / 10;
  if (!hasTier) {
    // 非分層資源（煉金室/扭蛋亭）：只顯示總產率（含工作貓加成）
    const rate = round1(getProductionRate(buildingId, level) * workerMult);
    return <span className="text-xs" style={{ color: C.mid }}>{rate}/hr</span>;
  }
  const stageMult = getStageMultiplier(level);
  const maxTier   = getBuildingStage(level);
  const baseRate  = getProductionRate(buildingId, level) * workerMult;  // 含工作貓加成
  const pool      = baseRate * stageMult;
  const alloc     = normalizeBuildingAllocation(level, allocations?.[buildingId]);
  const tiers     = [];
  for (let t = 1; t <= maxTier; t++) {
    const pct = alloc[String(t)] || 0;
    if (pct <= 0) continue;
    const tierRate = Math.round(pool * (pct / 100) * 10) / 10;
    tiers.push({ tier: t, rate: tierRate });
  }
  if (tiers.length === 0) {
    return <span className="text-xs" style={{ color: C.mid }}>{round1(baseRate)}/hr</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tiers.map(({ tier, rate }) => (
        <span key={tier} style={{
          fontSize: 11, fontWeight: 700,
          background: "rgba(107,142,94,0.10)", borderRadius: 4,
          padding: "1px 5px", color: C.sage,
        }}>
          T{tier} {rate < 0.01 ? "<0.01" : rate}/hr
        </span>
      ))}
    </div>
  );
}

function BuildingCard({ buildingId, level, resources, onClick, village, pendingCount, myCats }) {
  const b     = BUILDINGS[buildingId];
  const stage = getBuildingStage(level);
  const check = canUpgrade(buildingId, { [buildingId]: level }, resources);
  const maxed = level >= 20;

  const workerCatId = village?.workers?.[buildingId];
  const workerCatData = workerCatId ? myCats?.[workerCatId] : null;
  const workerCatInfo = workerCatId ? CATS[workerCatId] : null;
  const workerMult = getWorkerCatMultiplier(workerCatData);

  const statusColor = maxed ? C.muted : check.ok ? C.sage : "#D4933A";
  const statusText  = maxed ? "MAX" : check.ok ? "可升級" : "缺材料";
  const imgSrc = `/ui/village/building-${buildingId}-stage${stage}.webp`;

  return (
    <button
      onClick={onClick}
      className={`group flex min-h-0 flex-col overflow-hidden rounded-2xl text-left transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-700 relative ${check.ok ? "animate-pulse" : ""}`}
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #FDF6EC 100%)",
        border: check.ok ? `2px solid #F59E0B` : `1.5px solid ${C.border}`,
        boxShadow: check.ok ? "0 6px 20px rgba(245,158,11,0.3)" : "0 4px 12px rgba(92,61,46,0.08)"
      }}>
      {/* 建築圖片（乾淨原彩呈現，保留 hover 放大動畫） */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#F5EBD8", overflow: "hidden" }}>
        <img
          src={imgSrc} alt={b.name}
          width="320" height="240" loading="lazy"
          className="group-hover:scale-105 transition-transform duration-500"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />

        <div style={{
          display: "none", position: "absolute", inset: 0,
          alignItems: "center", justifyContent: "center", fontSize: "36px",
        }}>{b.emoji}</div>

        {/* 等級標籤 */}
        <div style={{
          position: "absolute", top: 6, right: 6,
          background: "rgba(35, 20, 10, 0.75)", backdropFilter: "blur(4px)", borderRadius: "8px",
          padding: "2px 8px", color: "#FFF8F0", fontWeight: 900, fontSize: "11px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)"
        }}>Lv.{level} (S{stage})</div>

        {/* 可升級標籤 */}
        {check.ok && (
          <div style={{
            position: "absolute", top: 6, left: 6,
            background: "linear-gradient(135deg, #F59E0B, #EF4444)",
            borderRadius: "8px", padding: "2px 8px", color: "#FFF",
            fontWeight: 900, fontSize: "10px", boxShadow: "0 2px 6px rgba(245,158,11,0.5)",
            border: "1px solid rgba(255,255,255,0.3)"
          }}>
            ⚡ 可升級
          </div>
        )}
      </div>

      {/* 文字說明區域 */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-sm font-black leading-tight flex items-center justify-between gap-1" style={{ color: C.brown }}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span>{b.emoji}</span>
              <span className="truncate">{b.name}</span>
            </div>
            {/* 駐紮貓咪顯示在建築物名稱右側 */}
            {workerCatId && workerCatInfo && (
              <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <img src={`/cats/portraits/${workerCatId}.webp`} alt="" className="w-4 h-4 rounded-full object-cover" />
                <span className="text-[10px] font-black text-amber-700">+{Math.round((workerMult - 1) * 100)}%</span>
              </div>
            )}
          </div>
          <div className="mt-0.5 text-xs font-bold flex items-center justify-between" style={{ color: C.mid }}>
            <span>{b.resourceName}</span>
            {workerCatInfo && (
              <span className="text-[9px] font-bold text-amber-800/80">({workerCatInfo.name} 工作中)</span>
            )}
          </div>

          {/* 貓咪工作抱怨留言氣泡 */}
          {workerCatId && workerCatInfo && (
            <div className="mt-2 p-1.5 rounded-xl text-[10px] font-bold leading-tight flex items-start gap-1"
              style={{ background: "rgba(253,246,236,0.9)", border: "1px dashed rgba(217,119,6,0.3)", color: "#78350F" }}>
              <span className="shrink-0 text-xs">💬</span>
              <span className="italic line-clamp-2">"{getWorkerCatComplaint(workerCatId, buildingId)}"</span>
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-amber-900/10 flex items-center justify-between">
          <ProductionBreakdown buildingId={buildingId} level={level} allocations={village?.allocations || {}} workerMult={workerMult} />
          <div className="text-[11px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: maxed ? "rgba(0,0,0,0.05)" : check.ok ? "rgba(34,197,94,0.12)" : "rgba(212,147,58,0.12)",
              color: statusColor
            }}>
            ● {statusText}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── 鎖定建築卡片 ─────────────────────────────────────────────
function LockedBuildingCard({ buildingId }) {
  const b = BUILDINGS[buildingId];
  const imgSrc = `/ui/village/building-${buildingId}-stage1.webp`;

  let hint = "";
  if (buildingId === 'market') {
    hint = "海港或獵場 Lv2";
  } else {
    const req = UNLOCK_REQS[buildingId];
    if (req) {
      hint = Object.entries(req)
        .map(([id, lv]) => `${BUILDINGS[id].name} Lv${lv}`)
        .join(" 且 ");
    }
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden text-left"
      style={{ border: `1px solid ${C.lockBd}`, background: "#EDE0CE" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
        {/* stage1 圖片：灰階 + 半透明暗罩 */}
        <img src={imgSrc} alt={b.name} width="320" height="240" loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
            filter: "grayscale(1) brightness(0.55)" }}
          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
        {/* emoji fallback */}
        <div style={{ display: "none", position: "absolute", inset: 0,
          alignItems: "center", justifyContent: "center",
          fontSize: 28, filter: "grayscale(1)", opacity: 0.3 }}>{b.emoji}</div>
        {/* 🔒 中央 */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
        }}>
          <div style={{ fontSize: 22 }}>🔒</div>
          <div style={{
            fontSize: 9, fontWeight: 900, color: "#FFF8F0",
            background: "rgba(60,35,15,0.65)", borderRadius: 8,
            padding: "2px 7px", textAlign: "center", maxWidth: "90%",
          }}>{hint}</div>
        </div>
      </div>
      <div className="p-2.5" style={{ background: C.lock }}>
        <div className="text-sm font-black leading-tight" style={{ color: C.muted }}>{b.name}</div>
        <div className="mt-1 text-xs" style={{ color: C.lockBd }}>🔒 尚未解鎖</div>
      </div>
    </div>
  );
}

// ── 卡片掛賣面板 ─────────────────────────────────────────────
const PRICE_TYPES = [
  { type:"arrowdew",  icon:"💧", label:"箭露",   min:10,  max:9999 },
  { type:"gachaToken",icon:"🎰", label:"扭蛋幣", min:1,   max:100  },
  { type:"card",      icon:"🃏", label:"重複卡", min:1,   max:5    },
];

function CardMarketPanel({ catCards, memberId, memberName }) {
  const [tab, setTab]         = useState("browse");
  const [listings, setListings]     = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selCardId, setSelCardId]   = useState(null);
  const [priceType, setPriceType]   = useState("arrowdew");
  const [priceAmount, setPriceAmount] = useState(50);
  // 卡片交換流程：選擇要提供的卡片
  const [buyTarget, setBuyTarget]     = useState(null);
  const [offeredCardId, setOfferedCardId] = useState(null);

  const [claimToast, setClaimToast] = useState("");
  const claimingRef = useRef(new Set());

  useEffect(() => {
    const unsub = subscribeCardMarket(all => {
      setListings(all.filter(l => l.sellerId !== memberId));
      const mine = all.filter(l => l.sellerId === memberId);
      setMyListings(mine);
      // 賣出但尚未請領的掛賣：自動幫賣家請領款項/交換卡片（見市集權限修正任務）
      mine.filter(l => l.status === "sold" && !l.sellerClaimed && !claimingRef.current.has(l.id))
        .forEach(l => {
          claimingRef.current.add(l.id);
          claimCardSaleProceeds(memberId, l.id).then(res => {
            if (res.ok) {
              const text = res.proceeds.type === "arrowdew" ? `箭露 ×${res.proceeds.amount}`
                : res.proceeds.type === "gachaToken" ? `扭蛋幣 ×${res.proceeds.amount}`
                : "交換卡片";
              setClaimToast(`🎉「${l.cardName}」已售出，收到 ${text}`);
              setTimeout(() => setClaimToast(""), 4000);
            }
          }).finally(() => claimingRef.current.delete(l.id));
        });
    });
    return unsub;
  }, [memberId]); // eslint-disable-line

  const dupCards = Object.entries(catCards || {})
    .filter(([,cnt]) => (cnt || 0) >= 2)
    .map(([id, cnt]) => ({ id, cnt, ...CAT_CARD_MAP[id] }))
    .filter(c => c.name);

  async function handleList() {
    if (!selCardId || busy) return;
    setBusy(true);
    sfxTap();
    try {
      await listCardForSale(memberId, memberName, selCardId, CAT_CARD_MAP[selCardId], priceType, priceAmount);
      setShowForm(false); setSelCardId(null);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleBuy(listing, offered = null) {
    if (busy) return;
    setBusy(true);
    try {
      await buyCardListing(memberId, memberName, listing, offered);
      sfxSuccess();
      setBuyTarget(null);
      setOfferedCardId(null);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleCancel(listing) {
    if (busy) return;
    setBusy(true);
    try { await cancelCardListing(memberId, listing.id, listing.cardId); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  const curPT = PRICE_TYPES.find(p => p.type === priceType);

  return (
    <div className="px-5 pb-4">
      {claimToast && (
        <div className="mb-2 rounded-xl px-3 py-2 text-xs font-bold text-center"
          style={{ background: "rgba(74,222,128,0.15)", color: "#16a34a", border: "1px solid rgba(74,222,128,0.35)" }}>
          {claimToast}
        </div>
      )}
      <div className="text-xs font-bold mb-2" style={{ color: C.mid }}>🃏 卡片掛賣市集</div>
      <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
        {[["browse","🛍️ 瀏覽"],["mine","📋 我的"]].map(([id,lb]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 text-[11px] font-bold transition-colors"
            style={{ background: tab===id ? C.brown : "rgba(255,255,255,0.5)", color: tab===id ? "#FFF8F0" : C.mid }}>
            {lb}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <div>
          {listings.length === 0 ? (
            <div className="text-center py-6 text-[11px]" style={{ color: C.muted }}>目前沒有掛賣的卡片</div>
          ) : (
            <>
              {/* 卡片圖片網格 */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, maxHeight:320, overflowY:"auto" }}>
                {listings.map(l => {
                  const pt = PRICE_TYPES.find(p => p.type === l.priceType);
                  const isCardExchange = l.priceType === "card";
                  const isSelected = buyTarget?.id === l.id;
                  return (
                    <div key={l.id}
                      style={{
                        borderRadius:10,
                        overflow:"hidden",
                        border: `2px solid ${isSelected ? C.brown : C.border}`,
                        background: l.cardBg || "rgba(255,255,255,0.8)",
                        cursor:"pointer",
                      }}
                      onClick={() => {
                        if (isCardExchange) { setBuyTarget(isSelected ? null : l); setOfferedCardId(null); }
                        else { handleBuy(l); }
                      }}>
                      {/* 卡片圖片 */}
                      <div style={{ position:"relative", paddingTop:"140%" }}>
                        <img
                          src={`/cats/cat-cards/${l.cardId}.webp`}
                          alt={l.cardName}
                          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
                          onError={e => { e.currentTarget.style.display="none"; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display="flex"; }}
                        />
                        <div style={{ position:"absolute", inset:0, display:"none", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                          {l.cardEmoji}
                        </div>
                      </div>
                      {/* 資訊列 */}
                      <div style={{ padding:"4px 5px 5px" }}>
                        <div style={{ fontSize:8, fontWeight:800, color:C.brown, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.cardName}</div>
                        <div style={{ fontSize:7, color:C.mid }}>{l.sellerName}</div>
                        <div style={{ fontSize:7, fontWeight:700, color:C.brown, marginBottom:2 }}>
                          {isCardExchange ? "🃏 換卡" : `${pt?.icon} ${l.priceAmount}`}
                        </div>
                        {l.expiredAt && (() => {
                          const daysLeft = Math.ceil((l.expiredAt.seconds * 1000 - Date.now()) / 86400000);
                          return (
                            <div style={{ fontSize:6, color: daysLeft <= 1 ? "#ef4444" : C.muted, marginBottom:2 }}>
                              ⏳ {daysLeft <= 0 ? "即將下架" : `${daysLeft}天後下架`}
                            </div>
                          );
                        })()}
                        <div style={{
                          textAlign:"center", fontSize:8, fontWeight:800,
                          padding:"2px 0", borderRadius:5,
                          background: isSelected ? C.brown : C.sage,
                          color:"white",
                        }}>
                          {busy && isSelected ? "…" : isSelected ? "收起" : isCardExchange ? "交換" : "購買"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 卡片交換展開區 */}
              {buyTarget && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.75)", border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>
                    交換「{buyTarget.cardName}」— 選擇你要提供的重複卡片
                  </div>
                  {dupCards.length === 0 ? (
                    <div className="text-[10px] text-center py-1" style={{ color: C.muted }}>你目前沒有重複卡片</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {dupCards.map(c => (
                        <button key={c.id} onClick={() => setOfferedCardId(c.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold active:scale-95"
                          style={{
                            background: offeredCardId === c.id ? C.brown : (c.bg || "#eee"),
                            color: offeredCardId === c.id ? "#FFF8F0" : C.brown,
                            border: `1px solid ${offeredCardId === c.id ? C.brown : C.border}`,
                          }}>
                          {c.emoji} {c.name} ×{c.cnt}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleBuy(buyTarget, offeredCardId)}
                    disabled={!offeredCardId || busy}
                    className="w-full py-1.5 rounded-lg text-[10px] font-bold active:scale-95"
                    style={{
                      background: offeredCardId ? C.sage : C.lockBd,
                      color: offeredCardId ? "white" : C.muted,
                    }}>
                    {busy ? "交換中…" : offeredCardId ? `確認交換（提供 ${CAT_CARD_MAP[offeredCardId]?.emoji || ""} ${CAT_CARD_MAP[offeredCardId]?.name || offeredCardId}）` : "請先選擇要提供的卡片"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {myListings.length === 0 ? (
            <div className="text-[10px] text-center py-2" style={{ color: C.muted }}>尚無掛賣中的卡片</div>
          ) : myListings.map(l => {
            const pt = PRICE_TYPES.find(p => p.type === l.priceType);
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: l.cardBg || "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                <span className="text-2xl shrink-0">{l.cardEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black truncate" style={{ color: C.brown }}>{l.cardName}</div>
                  <div className="text-[10px]" style={{ color: C.mid }}>{pt?.icon} {l.priceAmount} {pt?.label}</div>
                </div>
                <button onClick={() => handleCancel(l)} disabled={busy}
                  className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95 shrink-0"
                  style={{ background: "#C0533A", color: "white" }}>下架</button>
              </div>
            );
          })}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} disabled={dupCards.length === 0}
              className="mt-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
              style={{ background: dupCards.length > 0 ? "#D4933A" : C.lockBd, color: dupCards.length > 0 ? "white" : C.muted }}>
              {dupCards.length > 0 ? `＋ 掛賣卡片（${dupCards.length} 種重複可選）` : "暫無重複卡片可掛賣"}
            </button>
          ) : (
            <div className="rounded-xl p-3 mt-1" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
              <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>選擇卡片（需有重複）</div>
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-20 overflow-y-auto">
                {dupCards.map(c => (
                  <button key={c.id} onClick={() => setSelCardId(c.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold active:scale-95"
                    style={{ background: selCardId===c.id ? C.brown : (c.bg||"#eee"),
                      color: selCardId===c.id ? "#FFF8F0" : C.brown,
                      border: `1px solid ${selCardId===c.id ? C.brown : C.border}` }}>
                    {c.emoji} {c.name} ×{c.cnt}
                  </button>
                ))}
              </div>
              {selCardId && (
                <>
                  <div className="text-[10px] font-bold mb-1.5" style={{ color: C.mid }}>定價方式</div>
                  <div className="flex gap-1.5 mb-2">
                    {PRICE_TYPES.map(pt => (
                      <button key={pt.type}
                        onClick={() => { setPriceType(pt.type); setPriceAmount(pt.min); }}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold active:scale-95"
                        style={{ background: priceType===pt.type ? C.brown : "rgba(255,255,255,0.5)",
                          color: priceType===pt.type ? "#FFF8F0" : C.mid,
                          border: `1px solid ${C.border}` }}>
                        {pt.icon} {pt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input type="number" value={priceAmount}
                      onChange={e => setPriceAmount(Math.max(curPT?.min||1, Math.min(curPT?.max||9999, Number(e.target.value))))}
                      className="flex-1 rounded-lg px-3 py-1.5 text-sm font-bold border text-center outline-none"
                      style={{ borderColor: C.border, color: C.brown, background: "rgba(255,255,255,0.85)" }} />
                    <span className="text-[10px] shrink-0" style={{ color: C.muted }}>{curPT?.label}</span>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setSelCardId(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{ background: C.lockBd, color: C.muted }}>取消</button>
                <button onClick={handleList} disabled={!selCardId || busy}
                  className="flex-1 py-2 rounded-lg text-xs font-bold active:scale-95"
                  style={{ background: selCardId ? C.sage : C.lockBd, color: selCardId ? "white" : C.muted }}>
                  {busy ? "掛賣中…" : "確認掛賣"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 產能分配設定 ─────────────────────────────────────────────
function AllocationSettings({ buildingId, level, allocations, memberId, onSaved }) {
  const building    = BUILDINGS[buildingId];
  const hasTier     = building && TIERED_RESOURCES.has(building.resource);
  const maxTier     = getBuildingStage(level);
  const maxSlots    = getMaxSlots(level);
  const stageMult   = getStageMultiplier(level);

  // 如果不是分層資源建築（如煉金室、扭蛋亭），不顯示分配 UI
  if (!hasTier) return null;

  const [editing, setEditing] = useState(false);
  const [alloc, setAlloc]     = useState(null);
  const [saving, setSaving]   = useState(false);

  // 讀取當前分配（或預設）
  const currentAlloc = normalizeBuildingAllocation(level, allocations[buildingId]);

  function startEdit() {
    setAlloc({ ...normalizeBuildingAllocation(level, allocations[buildingId]) });
    setEditing(true);
  }

  function adjust(tierStr, delta) {
    if (!alloc) return;
    const newVal = Math.max(0, Math.min(100, (alloc[tierStr] || 0) + delta));
    const oldVal = alloc[tierStr] || 0;
    const diff   = newVal - oldVal;
    if (diff === 0) return;

    const next = { ...alloc, [tierStr]: newVal };
    // remaining > 0 = 其他 tier 需要加總; remaining < 0 = 其他 tier 需要減總
    const others = Object.keys(next).filter(k => k !== tierStr && (next[k] || 0) > 0);
    if (others.length > 0) {
      let remaining = -diff;
      for (const k of others) {
        if (remaining === 0) break;
        const cur = next[k] || 0;
        if (remaining > 0) {
          // 本 tier 減少 → 其他 tier 增加
          const add = Math.min(100 - cur, remaining);
          next[k] = cur + add;
          remaining -= add;
        } else {
          // 本 tier 增加 → 其他 tier 減少
          const sub = Math.min(cur, -remaining);
          next[k] = cur - sub;
          remaining += sub;
        }
      }
    }
    // 確保總和 = 100（浮點補正）
    const sum = Object.values(next).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const diff2 = 100 - sum;
      const pos2 = Object.keys(next).filter(k => (next[k] || 0) > 0);
      if (pos2.length > 0) next[pos2[0]] = (next[pos2[0]] || 0) + diff2;
    }
    setAlloc(next);
  }

  async function saveAlloc() {
    if (!alloc || saving || !memberId) return;
    setSaving(true);
    await setBuildingAllocation(memberId, buildingId, alloc);
    setSaving(false);
    setEditing(false);
    onSaved?.(buildingId, alloc);
  }

  // 當前生效的分配（編輯中或已儲存）
  const displayAlloc = editing ? alloc : currentAlloc;
  const activeTiers  = [1,2,3,4,5].filter(t => (displayAlloc[String(t)] || 0) > 0);

  return (
    <div className="mt-4" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold" style={{ color: C.mid }}>
          🎛️ 產能分配 ×{stageMult.toFixed(1)}（{maxSlots}槽可用）
        </div>
        {!editing && (
          <button onClick={startEdit}
            className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95"
            style={{ background: C.sage, color: "white" }}>
            ✏️ 調整
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-1.5">
          {activeTiers.map(t => (
            <div key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
              <span style={{ color: C.brown }}>T{t}</span>
              <span style={{ color: C.sage }}>{displayAlloc[String(t)]}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {[1,2,3,4,5].slice(0, maxTier).map(t => {
            const pct = alloc?.[String(t)] || 0;
            if (pct <= 0 && activeTiers.length >= maxSlots && ![1].includes(t)) return null;
            return (
              <div key={t} className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold shrink-0" style={{ width: 24, color: C.brown }}>T{t}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: C.border, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: pct > 0 ? C.sage : C.lockBd,
                    borderRadius: 99, transition: "width .2s",
                  }} />
                </div>
                <span className="text-[10px] font-bold shrink-0" style={{ width: 30, textAlign: "right", color: C.brown }}>{pct}%</span>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => adjust(String(t), -10)}
                    className="w-6 h-6 rounded-md text-xs font-bold active:scale-90"
                    style={{ background: pct > 0 ? "rgba(192,83,58,0.15)" : C.lockBd, color: pct > 0 ? "#C0533A" : C.muted }}>-</button>
                  <button onClick={() => adjust(String(t), 10)}
                    className="w-6 h-6 rounded-md text-xs font-bold active:scale-90"
                    style={{ background: pct < 100 && activeTiers.length >= 1 ? "rgba(90,158,80,0.15)" : C.lockBd, color: pct < 100 ? C.sage : C.muted }}>+</button>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background: C.lockBd, color: C.muted }}>取消</button>
            <button onClick={saveAlloc} disabled={saving}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold active:scale-95"
              style={{ background: C.sage, color: "white" }}>
              {saving ? "儲存中…" : "💾 儲存分配"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 貓咪駐紮工作設定 ─────────────────────────────────────────
function WorkerCatSettings({ buildingId, village, myCats, memberId, profile, onSaved }) {
  const currentWorkerId = village?.workers?.[buildingId] || null;
  const currentWorkerData = currentWorkerId ? myCats?.[currentWorkerId] : null;
  const currentWorkerInfo = currentWorkerId ? CATS[currentWorkerId] : null;
  const currentMult = getWorkerCatMultiplier(currentWorkerData);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 取得已被其他建築駐紮的貓咪
  const otherAssignedCatIds = new Set(
    Object.entries(village?.workers || {})
      .filter(([bId]) => bId !== buildingId)
      .map(([, cId]) => cId)
  );

  // 其他系統佔用的貓咪 IDs (陪練裝備中, 探險中, 地下城挖掘中)
  const equippedCatId     = profile?.equippedCat?.catId;
  const dungeonAssignedId = profile?.dungeonExcavation?.assignedCatId;
  const rawExpeditions    = profile?.expeditions || {};
  const expeditions       = Object.keys(rawExpeditions).length > 0 ? rawExpeditions : (profile?.expedition ? { 0: profile.expedition } : {});
  const onExpeditionCatIds = new Set(Object.values(expeditions).filter(Boolean).map(e => e.catId));

  // 取得目前空閒可指派的貓咪 (排除了：其他建築駐紮、陪練裝備中、遠征中、地下城挖掘中)
  const freeCats = Object.values(myCats || {}).filter(
    c => !otherAssignedCatIds.has(c.catId) &&
         c.catId !== equippedCatId &&
         !onExpeditionCatIds.has(c.catId) &&
         c.catId !== dungeonAssignedId
  );

  async function handleAssign(catId) {
    if (saving || !memberId) return;
    setSaving(true);
    sfxTap();
    const res = await assignVillageWorker(memberId, buildingId, catId);
    setSaving(false);
    if (res && res.ok === false) { alert(res.reason || "這隻貓正在別處工作"); return; }
    setEditing(false);
    onSaved?.(buildingId, catId);
  }

  return (
    <div className="mt-4" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold" style={{ color: C.mid }}>
          🐾 貓咪駐紮工作 {currentWorkerInfo ? `(+${Math.round((currentMult - 1) * 100)}% 產能)` : "(暫無駐紮)"}
        </div>
        <button onClick={() => setEditing(e => !e)}
          className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95"
          style={{ background: editing ? C.lockBd : C.sage, color: editing ? C.muted : "white" }}>
          {editing ? "關閉" : currentWorkerInfo ? "⇄ 更換駐紮" : "＋ 派貓駐紮"}
        </button>
      </div>

      {/* 當前駐紮狀態 */}
      {!editing ? (
        currentWorkerInfo ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl border transition-all"
            style={{ background: "rgba(253,230,138,0.18)", borderColor: "rgba(245,158,11,0.3)" }}>
            <div className="flex items-center gap-2">
              <img src={`/cats/portraits/${currentWorkerId}.webp`} alt="" className="w-8 h-8 rounded-full object-cover border border-amber-400/50" />
              <div>
                <div className="text-xs font-black" style={{ color: C.brown }}>{currentWorkerInfo.name}</div>
                <div className="text-[10px]" style={{ color: C.mid }}>Lv.{catLevelFromXP(currentWorkerData?.catXP || 0)} · 產能加成 +{Math.round((currentMult - 1) * 100)}%</div>
              </div>
            </div>
            <button onClick={() => handleAssign(null)} disabled={saving}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 active:scale-95 border border-red-500/20">
              {saving ? "處理中…" : "解除駐紮"}
            </button>
          </div>
        ) : (
          <div className="text-center py-2.5 text-xs rounded-xl" style={{ background: "rgba(0,0,0,0.03)", color: C.muted }}>
            尚未指派貓咪駐紮，派遣貓咪駐紮可提高該建築的產量產速！
          </div>
        )
      ) : (
        /* 選貓面板 */
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-bold text-slate-500">選擇要派往本建築工作的貓咪：</div>
          {freeCats.length === 0 ? (
            <div className="text-[11px] text-center p-3 text-slate-400 bg-black/5 rounded-xl">
              😿 沒有空閒可指派的貓咪（全都在其他建築駐紮中）
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {freeCats.map(cat => {
                const info = CATS[cat.catId];
                const lv = catLevelFromXP(cat.catXP || 0);
                const mult = getWorkerCatMultiplier(cat);
                const isCurrent = cat.catId === currentWorkerId;
                return (
                  <button key={cat.catId}
                    type="button"
                    onClick={() => handleAssign(isCurrent ? null : cat.catId)}
                    disabled={saving}
                    className={`p-2 rounded-xl border flex items-center gap-2 text-left transition-all active:scale-95 ${
                      isCurrent
                        ? "bg-amber-500/20 border-amber-400 ring-1 ring-amber-400"
                        : "bg-white/80 border-slate-200 hover:border-amber-400/50"
                    }`}>
                    <img src={`/cats/portraits/${cat.catId}.webp`} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black truncate" style={{ color: C.brown }}>{info?.name || cat.catId}</div>
                      <div className="text-[9px] font-bold text-amber-700">+{(Math.round((mult - 1) * 100))}% 產能 (Lv.{lv})</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 升級 Modal ───────────────────────────────────────────────
function UpgradeModal({ buildingId, level, resources, onUpgrade, onClose, upgrading, memberId, memberName, catCards, battleExchange, onExchangeDone, onVillageUpdate = null, village, myCats, profile }) {
  const b         = BUILDINGS[buildingId];
  const stage     = getBuildingStage(level);
  const nextStage = getBuildingStage(level + 1);
  const nextLv    = level + 1;
  const req       = nextLv <= 20 ? getUpgradeRequirements(buildingId, nextLv) : null;
  const check     = canUpgrade(buildingId, { [buildingId]: level }, resources);
  const curRate   = getProductionRate(buildingId, level);
  const nextRate  = getProductionRate(buildingId, nextLv);
  const imgSrc    = `/ui/village/building-${buildingId}-stage${stage}.webp`;
  const stageUp   = nextStage !== stage;
  const nextImgSrc = stageUp ? `/ui/village/building-${buildingId}-stage${nextStage}.webp` : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: "rgba(80,50,30,0.55)" }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl overflow-hidden"
        style={{ background: "linear-gradient(180deg,#FDF6EC,#F5EBD8)", maxHeight: "88vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* 大圖預覽 */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#EDE0CE", flexShrink: 0 }}>
          <img src={imgSrc} alt={b.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }} />
          <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", fontSize: 64 }}>
            {b.emoji}
          </div>
          {/* 等級角標 */}
          <div style={{
            position: "absolute", top: 12, left: 14,
            background: "rgba(60,35,15,0.65)", backdropFilter: "blur(6px)",
            borderRadius: 20, padding: "4px 14px",
            color: "#FFF8F0", fontWeight: 900, fontSize: 14,
          }}>Lv.{level}</div>
          {/* 關閉按鈕 */}
          <button onClick={onClose} style={{
            position: "absolute", top: 10, right: 12,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(60,35,15,0.55)", color: "#FFF8F0",
            fontSize: 16, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
          }}>✕</button>
          {/* 段位提升預告 */}
          {stageUp && nextImgSrc && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(to top, rgba(107,142,94,0.85), transparent)",
              padding: "28px 14px 10px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "#F0FFE8", fontSize: 11, fontWeight: 900 }}>✨ 升至 Lv.{nextLv} 將解鎖新外觀！</span>
              <div style={{ width: 44, height: 33, borderRadius: 6, overflow: "hidden", border: "2px solid #A0C898", flexShrink: 0 }}>
                <img src={nextImgSrc} alt="下一段位"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { e.target.style.display = "none"; }} />
              </div>
            </div>
          )}
        </div>

        {/* 內容區 */}
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-baseline justify-between mb-1">
            <div className="font-black text-xl" style={{ color: C.brown }}>{b.emoji} {b.name}</div>
            <div className="text-xs" style={{ color: C.muted }}>Lv.{level} → {nextLv <= 20 ? nextLv : "MAX"}</div>
          </div>
          <div className="text-xs font-bold mb-4" style={{ color: C.sage }}>
            產出：{curRate}/hr {nextLv <= 20 ? `→ ${nextRate}/hr` : "（已滿）"}
          </div>

          {level >= 20 ? (
            <div className="text-center py-4 text-sm" style={{ color: C.muted }}>🏆 已達最高等級 Lv.20</div>
          ) : req ? (
            <>
              <div className="text-xs font-bold mb-2 tracking-wider" style={{ color: C.mid }}>升級需求</div>

              {/* 箭露 */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-2"
                style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span>💧</span>
                  <span className="text-sm" style={{ color: C.brown }}>箭露</span>
                </div>
                <div>
                  <span className="font-black text-sm"
                    style={{ color: (resources?.arrowdew || 0) >= req.arrowdew ? C.sage : "#C0533A" }}>
                    {req.arrowdew.toLocaleString()}
                  </span>
                  <span className="text-xs ml-1.5" style={{ color: C.muted }}>/ {(resources?.arrowdew || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* 材料 */}
              {req.materials.map((mat, i) => {
                const resKey = getResourceKey(mat.resource, mat.tier);
                const have = Math.floor(resources?.[resKey] || 0);
                const ok   = have >= mat.count;
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 mb-2"
                    style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <img src={`/ui/village/resource-${mat.resource}${mat.tier}.webp`} alt=""
                        style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4 }}
                        onError={e => { e.target.style.display = "none"; }} />
                      <span className="text-sm" style={{ color: C.brown }}>{RESOURCE_NAMES[mat.resource]} T{mat.tier}</span>
                    </div>
                    <div className="font-black text-sm" style={{ color: ok ? C.sage : "#C0533A" }}>
                      {mat.count} <span className="font-normal text-xs" style={{ color: C.muted }}>/ {have}</span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={onUpgrade}
                disabled={!check.ok || upgrading}
                className="w-full py-4 rounded-2xl font-black text-base mt-3 transition-all active:scale-95"
                style={{
                  background: check.ok
                    ? "linear-gradient(135deg,#7CBF70,#5A9E50)"
                    : C.lockBd,
                  color: check.ok ? "white" : C.muted,
                  boxShadow: check.ok ? "0 3px 10px rgba(90,158,80,0.35)" : "none",
                }}>
                {upgrading ? "升級中…" : check.ok ? `⬆ 升級至 Lv.${nextLv}` : check.reason}
              </button>
            </>
          ) : null}

          {/* ── 產能分配 ── */}
          <AllocationSettings
            buildingId={buildingId}
            level={level}
            allocations={village?.allocations || {}}
            memberId={memberId}
            onSaved={(bid, newAlloc) => {
              if (typeof onVillageUpdate !== "function") return;
              onVillageUpdate(prev => {
                const base = prev || village;
                return { ...base, allocations: { ...(base?.allocations || {}), [bid]: newAlloc } };
              });
            }}
          />

          {/* ── 貓咪駐紮工作 ── */}
          <WorkerCatSettings
            buildingId={buildingId}
            village={village}
            myCats={myCats}
            memberId={memberId}
            profile={profile}
            onSaved={(bid, catId) => {
              if (typeof onVillageUpdate !== "function") return;
              onVillageUpdate(prev => {
                const base = prev || village;
                const nextWorkers = { ...(base?.workers || {}) };
                if (catId) nextWorkers[bid] = catId;
                else delete nextWorkers[bid];
                return { ...base, workers: nextWorkers };
              });
            }}
          />

          {/* 市集專屬：卡片市集 */}
          {buildingId === 'market' && (
            <>
              <div style={{ height: 1, background: C.border, margin: "0 0 16px" }} />
              <CardMarketPanel catCards={catCards} memberId={memberId} memberName={memberName} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 資源總覽列 ───────────────────────────────────────────────
const TIERED_LIST = ['ore','melon','fish','meat','driedfish','can','potion','fur','archer'];
// 永遠顯示的特殊材料（升級必需，即使 0 也要讓玩家知道）
const ALWAYS_SHOW = new Set(['potion','fur']);
const RES_EMOJI   = { ore:'⛏️', melon:'🌿', fish:'🐟', meat:'🥩', driedfish:'🐠', can:'🥫', potion:'🍵', fur:'🐾', archer:'🏹' };

function ResourceRow({ resources, gachaCoins }) {
  const [showAll, setShowAll] = useState(false);
  const [activeTierTab, setActiveTierTab] = useState(1);

  const TIER_BG = {
    1: { bg: "rgba(120, 80, 50, 0.08)", color: "#784f32", border: "rgba(120, 80, 50, 0.2)" },
    2: { bg: "rgba(34, 197, 94, 0.08)", color: "#166534", border: "rgba(34, 197, 94, 0.2)" },
    3: { bg: "rgba(59, 130, 246, 0.08)", color: "#1e40af", border: "rgba(59, 130, 246, 0.2)" },
    4: { bg: "rgba(147, 51, 234, 0.08)", color: "#6b21a8", border: "rgba(147, 51, 234, 0.2)" },
    5: { bg: "rgba(245, 158, 11, 0.12)", color: "#b45309", border: "rgba(245, 158, 11, 0.3)" },
  };

  return (
    <section className="mx-4 mb-3 rounded-2xl px-4 py-3 shadow-sm"
      style={{ background:C.card, border:`1px solid ${C.border}`, boxShadow:C.shadow }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black flex items-center gap-1.5" style={{ color:C.brown }}>
          <span>📦</span> 村莊資源庫
        </h2>
        <button type="button" onClick={() => setShowAll(value => !value)}
          aria-expanded={showAll}
          className="min-h-9 rounded-xl px-3 text-xs font-black transition-all focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-95"
          style={{ background: showAll ? C.sage : "rgba(107,142,94,0.12)", color: showAll ? "#FFF" : C.sage }}>
          {showAll ? "收合資源庫" : "查看 T1~T5 分級資源"}
        </button>
      </div>

      {/* 常駐核心資源（扭蛋幣 + 貓草藥水 + 貓毛） */}
      <div className="flex gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl" style={{ background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.3)" }}>
          <span style={{ fontSize:16 }}>🎰</span>
          <span className="font-black text-xs" style={{ color: C.brown }}>{Math.floor(gachaCoins || 0)}</span>
          <span className="text-[10px]" style={{ color: C.muted }}>扭蛋幣</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl" style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)" }}>
          <span style={{ fontSize:16 }}>🍵</span>
          <span className="font-black text-xs" style={{ color: C.brown }}>
            {[1,2,3,4,5].reduce((sum, t) => sum + Math.floor(resources?.[`potion_t${t}`] || 0), 0)}
          </span>
          <span className="text-[10px]" style={{ color: C.muted }}>貓草藥水 (總計)</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl" style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.25)" }}>
          <span style={{ fontSize:16 }}>🐾</span>
          <span className="font-black text-xs" style={{ color: C.brown }}>
            {[1,2,3,4,5].reduce((sum, t) => sum + Math.floor(resources?.[`fur_t${t}`] || 0), 0)}
          </span>
          <span className="text-[10px]" style={{ color: C.muted }}>貓毛 (總計)</span>
        </div>
      </div>

      {/* 展開：T1~T5 分級頁籤視圖 */}
      {showAll && (
        <div className="mt-3 pt-3 border-t border-amber-900/10 space-y-2">
          {/* T1 ~ T5 頁籤列 */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[1, 2, 3, 4, 5].map(t => {
              const isActive = activeTierTab === t;
              const cfg = TIER_BG[t];
              return (
                <button key={t} type="button" onClick={() => setActiveTierTab(t)}
                  className="px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 active:scale-95"
                  style={{
                    background: isActive ? cfg.color : cfg.bg,
                    color: isActive ? "#FFF" : cfg.color,
                    border: `1px solid ${cfg.border}`
                  }}>
                  T{t} 階資源
                </button>
              );
            })}
          </div>

          {/* 當前選擇階級的資源列表 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {TIERED_LIST.map(res => {
              const count = Math.floor(resources?.[`${res}_t${activeTierTab}`] || 0);
              const cfg = TIER_BG[activeTierTab];
              return (
                <div key={res} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, opacity: count > 0 ? 1 : 0.4 }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span style={{ fontSize: 16 }}>{RES_EMOJI[res]}</span>
                    <span className="text-xs font-bold truncate" style={{ color: C.brown }}>{RESOURCE_NAMES[res]}</span>
                  </div>
                  <span className="text-xs font-mono font-black" style={{ color: cfg.color }}>
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

const BATTLE_EXCHANGE = [
  // 六種族材料包（各自消耗對應建築的 T1 村莊資源）
  { type:'iron', family:'ghost',     icon:'👻', label:'鬼怪族材料包',   costs:[{ resource:'ore',       tier:1, count:30 }] },
  { type:'iron', family:'mountain',  icon:'🏔️', label:'山林族材料包',  costs:[{ resource:'melon',     tier:1, count:30 }] },
  { type:'iron', family:'exam',      icon:'📝', label:'考試族材料包',   costs:[{ resource:'fish',      tier:1, count:30 }] },
  { type:'iron', family:'insect',    icon:'🦂', label:'毒蟲族材料包',   costs:[{ resource:'meat',      tier:1, count:30 }] },
  { type:'iron', family:'workplace', icon:'💼', label:'職場族材料包',   costs:[{ resource:'driedfish', tier:1, count:30 }] },
  { type:'iron', family:'temple',    icon:'⛩️', label:'西方怪物材料包', costs:[{ resource:'can',       tier:1, count:30 }] },
  // 藥水箱、怪物卡包、黃金寶箱
  { type:'potion',   icon:'🧪', label:'藥水箱',   costs:[{ resource:'melon', tier:1, count:20 }, { resource:'fish',  tier:1, count:15 }] },
  { type:'card_pack',icon:'🃏', label:'怪物卡包',  costs:[{ resource:'ore',   tier:2, count: 8 }, { resource:'driedfish', tier:1, count:20 }] },
  { type:'gold',     icon:'🎁', label:'黃金寶箱',  costs:[{ resource:'ore',   tier:2, count:15 }, { resource:'fish',  tier:2, count:10 }] },
];
const RES_CN = { ore:'礦物', melon:'瓜瓜', fish:'鮮魚', meat:'動物肉', driedfish:'小魚乾', can:'貓罐頭', potion:'藥水', fur:'貓毛' };

// ── 市集兌換面板 ─────────────────────────────────────────────
function MarketExchangePanel({ resources, memberId, onDone, battleExchange: bx }) {
  const effectiveBX = bx || BATTLE_EXCHANGE;
  const [busy, setBusy] = useState(false);
  const [justGot, setJustGot] = useState(null);

  async function doBattleExchange(chestType, costs, family) {
    if (busy) return;
    setBusy(true);
    sfxVillageExchange();
    try {
      await exchangeMaterialsForChest(memberId, chestType, costs, family || null);
      setJustGot(chestType + (family || ""));
      setTimeout(() => setJustGot(null), 2000);
      onDone?.();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function doExchange(resource, fromTier, direction) {
    if (busy) return;
    const fromKey = `${resource}_t${fromTier}`;
    const have = Math.floor(resources?.[fromKey] || 0);
    if (direction === 'up' && have < 5) { alert('需要 5 個才能升階'); return; }
    if (direction === 'down' && have < 1) { alert('數量不足'); return; }
    setBusy(true);
    sfxVillageExchange();
    try {
      await exchangeVillageMaterial(memberId, resource, fromTier, direction);
      onDone?.();
    } catch(e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="px-5 pb-4">
      {/* ── 市集兌換 ── */}
      <div className="text-xs font-bold mb-2" style={{ color: C.mid }}>🛒 村莊市集兌換</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>消耗村莊材料，換取各族材料包、藥水箱、怪物卡包、黃金寶箱（到背包開箱）</div>
      <div className="flex flex-col gap-2 mb-4">
        {effectiveBX.map(ex => {
          const canAfford = ex.costs.every(({ resource, tier, count }) =>
            Math.floor(resources?.[`${resource}_t${tier}`] || 0) >= count
          );
          const gotThis = justGot === ex.type + (ex.family || "");
          return (
            <div key={ex.type} className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{ex.icon}</span>
                  <span className="text-xs font-bold" style={{ color: C.brown }}>{ex.label}</span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {ex.costs.map(({ resource, tier, count }) => {
                    const have = Math.floor(resources?.[`${resource}_t${tier}`] || 0);
                    return (
                      <span key={`${resource}${tier}`} className="text-[10px] font-bold"
                        style={{ color: have >= count ? C.sage : "#C0533A" }}>
                        {RES_CN[resource]}T{tier}×{count}（{have}）
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                disabled={!canAfford || busy}
                onClick={() => doBattleExchange(ex.type, ex.costs, ex.family)}
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all ml-2"
                style={{
                  background: gotThis ? "#5A9E50" : canAfford ? "#D4933A" : C.lockBd,
                  color: canAfford ? "white" : C.muted,
                  minWidth: 64, textAlign: "center", flexShrink: 0,
                }}>
                {gotThis ? "✓ 取得！" : "兌換"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 12 }} />

      {/* ── 村莊材料換算 ── */}
      <div className="text-xs font-bold mb-2" style={{ color: C.mid }}>材料換算（村莊材料）</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>升階：T(n)×5 → T(n+1)×1　降階：T(n)×1 → T(n-1)×3</div>
      {TIERED_LIST.map(res => {
        const tiers = [1,2,3,4,5].map(t => ({ t, count: Math.floor(resources?.[`${res}_t${t}`] || 0) }));
        const hasSome = tiers.some(x => x.count > 0);
        if (!hasSome) return null;
        return (
          <div key={res} className="mb-3">
            <div className="text-[10px] font-bold mb-1" style={{ color: C.brown }}>
              {RES_EMOJI[res]} {RESOURCE_NAMES[res]}
            </div>
            <div className="flex flex-col gap-1">
              {tiers.map(({ t, count }) => (
                <div key={t} className="flex items-center justify-between rounded-xl px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-1.5">
                    <img src={`/ui/village/resource-${res}${t}.webp`} style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4 }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <span className="text-xs font-bold" style={{ color: C.brown }}>T{t}</span>
                    <span className="text-xs" style={{ color: C.mid }}>×{count}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {t < 5 && (
                      <button disabled={count < 5 || busy} onClick={() => doExchange(res, t, 'up')}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
                        style={{ background: count >= 5 ? C.sage : C.lockBd, color: count >= 5 ? 'white' : C.muted }}>
                        ×5→T{t+1}
                      </button>
                    )}
                    {t > 1 && (
                      <button disabled={count < 1 || busy} onClick={() => doExchange(res, t, 'down')}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
                        style={{ background: count >= 1 ? "#D4933A" : C.lockBd, color: count >= 1 ? 'white' : C.muted }}>
                        ×1→T{t-1}×3
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 資源鍵顯示名稱 ───────────────────────────────────────────
function formatResKey(key) {
  const BASE = { ore:"礦物",meat:"動物肉",driedfish:"小魚乾",melon:"瓜瓜",fish:"鮮魚",can:"貓罐頭",potion:"貓薄荷藥水",fur:"貓毛",arrowdew:"箭露" };
  const parts = key.split("_t");
  return parts[1] ? `${BASE[parts[0]] || parts[0]} T${parts[1]}` : (BASE[key] || key);
}

// ── 鍛造面板 ─────────────────────────────────────────────────
function ForgePanel({ profile, resources, myCats }) {
  const [forging,           setForging]           = useState(false);
  const [activeForgingSlot, setActiveForgingSlot] = useState(null);
  const [forgeMsg,          setForgeMsg]          = useState(null);
  const [switching,         setSwitching]         = useState(false);

  const equippedCat = profile?.equippedCat;
  if (!equippedCat?.catId) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.mid, textAlign:"center", padding:32 }}>
        <div>
          <div style={{ fontSize:40, marginBottom:12 }}>🐱</div>
          <div style={{ fontSize:14, fontWeight:"bold" }}>請先在「我的貓」裝備一隻貓咪</div>
          <div style={{ fontSize:12, marginTop:4 }}>才能使用鍛造功能</div>
        </div>
      </div>
    );
  }

  const { catId, name, equip = {} } = equippedCat;
  const catXP    = equippedCat.catXP || 0;
  const catLevel = catLevelFromXP(catXP);
  const xpProg   = catXPProgress(catXP);
  const bondLevel = getBondLevel(equippedCat.bond || 0);
  const typeLabel = { attack:"攻擊型", defense:"防禦型", allround:"治癒型" }[equippedCat.type] || "治癒型";
  const typeColor = { attack:"#ef4444", defense:"#3b82f6", allround:"#22c55e" }[equippedCat.type] || "#22c55e";

  async function handleForge(slotId) {
    if (forging || activeForgingSlot || !profile?.id) return;
    const slotData = equip[slotId] || { grade: "普通", plusLevel: 0 };
    const cost = calcForgeCost(slotId, slotData.grade, slotData.plusLevel);
    if (!cost) return;

    for (const [key, amount] of Object.entries(cost)) {
      if ((resources[key] || 0) < amount) {
        setForgeMsg(`材料不足：${formatResKey(key)} (需 ${amount})`);
        setTimeout(() => setForgeMsg(null), 2500);
        return;
      }
    }

    const gIdx = CAT_EQUIP_GRADE_NAMES.indexOf(slotData.grade);
    const currentEnhancement = catEquipEnhancement(slotData.grade, slotData.plusLevel);
    let newGrade    = slotData.grade;
    let newPlusLevel = slotData.plusLevel;
    if (slotData.plusLevel < CAT_EQUIP_MAX_PLUS) {
      newPlusLevel = slotData.plusLevel + 1;
    } else {
      newGrade    = CAT_EQUIP_GRADE_NAMES[gIdx + 1];
      newPlusLevel = 0;
    }

    setForging(true);
    setActiveForgingSlot(slotId);
    if (typeof sfxVillageExchange === "function") sfxVillageExchange();

    // 播放 700ms 的鐵鎚敲擊火花鍛造動畫
    await new Promise(resolve => setTimeout(resolve, 700));

    const res = await upgradeCatEquip(profile.id, catId, slotId, newGrade, newPlusLevel, cost);
    setForging(false);
    setActiveForgingSlot(null);

    if (res.ok) {
      sfxSuccess();
      const nextEnhancement = currentEnhancement + 1;
      setForgeMsg(newPlusLevel === 0
        ? `✨ 裝備升階！→ ${newGrade} +${nextEnhancement}`
        : `🔨 強化成功！${newGrade} +${nextEnhancement}`
      );
    } else {
      setForgeMsg("鍛造失敗，請再試");
    }
    setTimeout(() => setForgeMsg(null), 2500);
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
      {/* 貓咪資訊卡 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px", marginBottom:10, display:"flex", gap:12, alignItems:"center", boxShadow:C.shadow }}>
        {/* 大頭照 */}
        <div style={{ flexShrink:0, width:68, height:68, borderRadius:12, overflow:"hidden", border:`2px solid ${C.border}`, background:"#f5ede0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
          <img src={`/cats/portraits/${catId}.webp`} alt={name}
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => { e.target.style.display="none"; }}
          />
        </div>
        {/* 資訊欄 */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
            <span style={{ fontWeight:900, fontSize:16, color:C.brown }}>{name}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:99, background:`${typeColor}18`, color:typeColor, border:`1px solid ${typeColor}66` }}>{typeLabel}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{
              fontSize: "10px",
              fontWeight: 900,
              padding: "2px 8px",
              borderRadius: "99px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              display: "inline-flex",
              alignItems: "center",
              ...getLevelStyle(xpProg.level)
            }}>
              Lv.{xpProg.level}
            </span>
            <span style={{ fontSize:11, color:C.mid }}>· 羈絆 {bondLevel}</span>
          </div>
          {/* XP 進度條 */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ flex:1, height:5, background:C.border, borderRadius:99, overflow:"hidden" }}>
              <div style={{ width:`${xpProg.pct}%`, height:"100%", background:"#d97706", borderRadius:99, transition:"width .4s" }} />
            </div>
            <span style={{ fontSize:9, color:C.muted, whiteSpace:"nowrap" }}>{xpProg.current}/{xpProg.needed} XP</span>
          </div>
          {/* 切換按鈕 */}
          <button onClick={() => setSwitching(s => !s)} style={{ fontSize:10, padding:"3px 10px", borderRadius:99, background: switching ? "rgba(217,119,6,0.12)" : "rgba(92,61,46,0.07)", border: switching ? "1px solid #d9770688" : `1px solid ${C.border}`, color: switching ? "#b45309" : C.mid, cursor:"pointer", fontWeight:700 }}>
            ⇄ 切換貓咪
          </button>
        </div>
      </div>

      {/* 切換面板 */}
      {switching && (
        <div style={{ display:"flex", gap:8, marginBottom:10, overflowX:"auto", padding:"4px 2px" }}>
          {Object.values(myCats).map(cat => {
            const isActive = cat.catId === catId;
            return (
              <button key={cat.catId} onClick={async () => {
                if (isActive || forging) return;
                await equipCat(profile.id, cat.catId, cat.type || "allround");
                setSwitching(false);
              }} style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"6px 8px", borderRadius:10, cursor:"pointer", background: isActive ? "rgba(217,119,6,0.12)" : C.card, border: isActive ? `2px solid #d97706` : `1px solid ${C.border}`, boxShadow: isActive ? "0 0 0 2px rgba(217,119,6,0.2)" : "none" }}>
                <div style={{ width:48, height:48, borderRadius:9, overflow:"hidden", background:"#f5ede0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
                  <img src={`/cats/portraits/${cat.catId}.webp`} alt={cat.name}
                    style={{ width:"100%", height:"100%", objectFit:"cover" }}
                    onError={e => { e.target.style.display="none"; }}
                  />
                </div>
                <span style={{ fontSize:9, color: isActive ? "#b45309" : C.mid, fontWeight:700 }}>
                  {cat.name || CATS[cat.catId]?.name}
                </span>
                {isActive && <span style={{ fontSize:8, color:"#d97706", fontWeight:900 }}>裝備中</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* 提示訊息 */}
      {forgeMsg && (
        <div style={{ background:"rgba(255,255,255,0.92)", border:`1px solid ${C.border}`, borderRadius:10,
          padding:"8px 14px", marginBottom:12, textAlign:"center", color:C.brown, fontWeight:"bold", fontSize:13 }}>
          {forgeMsg}
        </div>
      )}

      {/* 鍛造動畫 Keyframes */}
      <style>{`
        @keyframes forgeHammer {
          0% { transform: rotate(0deg) translate(0, 0); }
          30% { transform: rotate(-30deg) translate(-2px, -5px); }
          70% { transform: rotate(15deg) translate(1px, 2px); }
          100% { transform: rotate(0deg) translate(0, 0); }
        }
        @keyframes forgeSpark {
          0% { transform: scale(0.6); opacity: 0; }
          40% { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
      `}</style>

      {/* 裝備格 */}
      {CAT_EQUIP_SLOTS.map(slot => {
        const slotData = equip[slot.id] || { grade: "普通", plusLevel: 0 };
        const gIdx     = Math.max(0, CAT_EQUIP_GRADE_NAMES.indexOf(slotData.grade));
        const cost     = calcForgeCost(slot.id, slotData.grade, slotData.plusLevel);
        const canAfford = cost ? Object.entries(cost).every(([k,v]) => (resources[k]||0) >= v) : false;
        const isMaxed  = !cost;
        const enhancement = catEquipEnhancement(slotData.grade, slotData.plusLevel);
        const bonus    = (gIdx * 10 + 1) + (slotData.plusLevel || 0);
        const statLabel = slot.stat === "hp"
          ? `HP +${bonus * 5}`
          : slot.stat === "atk" ? `ATK +${bonus}` : `DEF +${bonus}`;
        const nextLabel = isMaxed ? "MAX"
          : slotData.plusLevel < CAT_EQUIP_MAX_PLUS
            ? `強化 +${enhancement + 1}`
            : `升階 ${CAT_EQUIP_GRADE_NAMES[gIdx + 1]} +${enhancement + 1}`;
        const gradeColor = CAT_EQUIP_GRADE_COLORS[gIdx] || C.mid;
        const gradeBg    = CAT_EQUIP_GRADE_BG[gIdx]    || "rgba(156,163,175,0.1)";

        return (
          <div key={slot.id} style={{
            position: "relative",
            background: gradeBg, borderRadius:12, padding:"12px 14px", marginBottom:9,
            border:`1.5px solid ${gradeColor}44`, display:"flex", alignItems:"center", gap:10,
            overflow: "hidden",
          }}>
            {/* Forging Animation Overlay */}
            {activeForgingSlot === slot.id && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(92,61,46,0.88)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                zIndex: 20,
              }}>
                <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 28, animation: "forgeHammer 0.35s infinite ease-in-out", transformOrigin: "bottom right" }}>🔨</div>
                  <div style={{ fontSize: 20, position: "absolute", right: 0, top: 0, animation: "forgeSpark 0.35s infinite ease-in-out" }}>💥</div>
                </div>
                <span style={{ color: "#FFF8F0", fontSize: 13, fontWeight: 900, letterSpacing: 1.5, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                  鍛造中...
                </span>
              </div>
            )}

            <div style={{ width:44, height:44, borderRadius:10, overflow:"hidden", border:`1.5px solid ${gradeColor}66`, flexShrink:0, background:"#fff", boxShadow:"0 2px 6px rgba(0,0,0,0.12)" }}>
              <img
                src={slot.image}
                alt={slot.label}
                style={{ width:"100%", height:"100%", objectFit:"cover" }}
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
              />
              <div style={{ display:"none", width:"100%", height:"100%", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                {slot.icon}
              </div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <span style={{ fontWeight:"bold", color:C.brown, fontSize:13 }}>{slot.label}</span>
                <span style={{ fontSize:10, fontWeight:800, color:"white", background:gradeColor, borderRadius:6, padding:"1px 6px" }}>
                  +{enhancement}
                </span>
              </div>
              <div style={{ fontSize:11, color:gradeColor, fontWeight:"bold" }}>
                {slotData.grade} +{enhancement}
              </div>
              <div style={{ fontSize:11, color:C.mid }}>{statLabel}</div>
              {cost && (
                <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>
                  {Object.entries(cost).map(([k,v]) => {
                    const have = Math.floor(resources[k] || 0);
                    const ok   = have >= v;
                    return (
                      <span key={k} style={{ color: ok ? C.sage : "#ef4444", marginRight:6 }}>
                        {formatResKey(k)} ×{v}({have})
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              disabled={isMaxed || forging || !canAfford}
              onClick={() => handleForge(slot.id)}
              style={{
                padding:"7px 11px", borderRadius:8, fontSize:11, fontWeight:"bold", flexShrink:0,
                background: isMaxed ? "#e5e7eb" : canAfford ? C.sage : "#e5e7eb",
                color: isMaxed || !canAfford ? C.muted : "#fff",
                border:"none", cursor: isMaxed || !canAfford ? "not-allowed" : "pointer",
                opacity: forging ? 0.7 : 1,
              }}
            >
              {forging ? "…" : nextLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 藥水製作面板 ────────────────────────────────────────────
function ConsumableArt({ item, size = 40 }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setLoaded(true);
    image.onerror = () => setLoaded(false);
    image.src = item.asset;
    return () => { image.onload = null; image.onerror = null; };
  }, [item.asset]);
  if (!loaded) return <span aria-hidden="true" style={{ width:size, height:size, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:size * .55 }}>{item.icon}</span>;
  const col = item.spriteIndex % 6;
  const row = Math.floor(item.spriteIndex / 6);
  return (
    <span aria-hidden="true" style={{
      width:size, height:size, flexShrink:0, display:"inline-block",
      backgroundImage:`url(${item.asset})`, backgroundRepeat:"no-repeat",
      backgroundSize:"600% 500%", backgroundPosition:`${col * 20}% ${row * 25}%`,
    }} />
  );
}

const POTION_CRAFT_GROUPS = {
  carry: [
    { id:"recovery", label:"回復續航", icon:"❤️", match:item => ["heal","regen"].includes(item.family) && !item.futureFeature },
    { id:"offense", label:"輸出強化", icon:"⚔️", match:item => ["power","berserk"].includes(item.family) && !item.futureFeature },
    { id:"defense", label:"防護生存", icon:"🛡️", match:item => ["guard","shield"].includes(item.family) && !item.futureFeature },
    { id:"future", label:"預備配方", icon:"✨", match:item => !!item.futureFeature },
  ],
  throw: [
    { id:"damage", label:"直接傷害", icon:"💥", match:item => item.family === "damage" && !item.futureFeature },
    { id:"debuff", label:"弱化破甲", icon:"🧴", match:item => item.family === "debuff" && !item.futureFeature },
    { id:"control", label:"支援控制", icon:"🎯", match:item => ["support","control"].includes(item.family) && !item.futureFeature },
    { id:"future", label:"預備配方", icon:"🕸️", match:item => !!item.futureFeature },
  ],
  raid: [
    { id:"damage", label:"討伐傷害", icon:"💣", match:item => item.actionCost === "arrow" },
    { id:"tactics", label:"討伐戰術", icon:"👑", match:item => item.actionCost !== "arrow" },
  ],
};

function PotionCraftingPanel({ resources, potionInventory, coins, memberId, onCrafted }) {
  const [tab, setTab] = useState("carry");
  const [craftMode, setCraftMode] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // 稀有度顏色
  const RARITY_COLORS = {
    common:    { bg:"rgba(156,163,175,0.12)", text:"#6b7280", label:"普通" },
    uncommon:  { bg:"rgba(34,197,94,0.12)",  text:"#16a34a", label:"非凡" },
    rare:      { bg:"rgba(59,130,246,0.12)", text:"#2563eb", label:"稀有" },
    epic:      { bg:"rgba(168,85,247,0.12)", text:"#9333ea", label:"史詩" },
    legendary: { bg:"rgba(234,179,8,0.12)",  text:"#ca8a04", label:"傳說" },
  };

  const potions = tab === "carry" ? CARRY_POTIONS : tab === "throw" ? THROW_POTIONS : RAID_POTIONS;
  const potionGroups = (POTION_CRAFT_GROUPS[tab] || []).map(group => ({
    ...group,
    items: potions.filter(group.match),
  })).filter(group => group.items.length > 0);

  async function handleCraft(potion) {
    if (busy || !memberId) return;
    const maxCrafts = calculateMaxCrafts(potion, resources, coins);
    const executions = craftMode === "max" ? maxCrafts : craftMode;
    if (craftMode !== "max" && maxCrafts < executions) return;
    if (executions <= 0) return;
    setBusy(true);
    try {
      const res = await craftPotion(memberId, potion.id, executions);
      if (res.ok) {
        setMsg(`✅ 成功製作 ${potion.name} ×${res.outputCount}！`);
        sfxSuccess();
        onCrafted?.();
      } else {
        setMsg(`❌ ${res.reason}`);
      }
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div>
      <div className="text-xs font-bold mb-3" style={{ color: C.mid }}>🧪 藥水製作</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>
        消耗村莊資源 + 金幣來合成藥水，合成後到背包使用。
      </div>

      {/* 即時訊息 */}
      {msg && (
        <div className="rounded-xl px-4 py-2 mb-3 text-xs font-bold text-center"
          style={{ background: msg.startsWith("✅") ? "rgba(90,158,80,0.15)" : "rgba(192,83,58,0.12)",
            border: `1px solid ${msg.startsWith("✅") ? "#5A9E50" : "#C0533A"}`,
            color: msg.startsWith("✅") ? "#3D7A3A" : "#9B3A20" }}>
          {msg}
        </div>
      )}

      {/* 頁籤：攜帶型 vs 投擲型 */}
      <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
        {[["carry","💊 攜帶型"],["throw","💣 投擲型"],["raid","👑 討伐型"]].map(([id, lb]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 text-[11px] font-bold transition-colors"
            style={{
              background: tab === id ? C.brown : "rgba(255,255,255,0.5)",
              color: tab === id ? "#FFF8F0" : C.mid,
            }}>
            {lb}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 mb-3" role="group" aria-label="製作次數">
        {[[1,"製作 1 次"],[5,"製作 5 次"],["max","最大數量"]].map(([value, label]) => (
          <button key={value} onClick={() => setCraftMode(value)}
            className="flex-1 min-h-11 px-2 py-2 rounded-lg text-[11px] font-bold transition-colors"
            style={{ background: craftMode === value ? C.sage : "rgba(255,255,255,0.55)", color: craftMode === value ? "white" : C.mid, border:`1px solid ${C.border}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* 金幣顯示 */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
        style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 18 }}>🪙</span>
        <span className="font-black text-sm" style={{ color: C.brown }}>{Math.floor(coins || 0).toLocaleString()}</span>
        <span className="text-[10px]" style={{ color: C.muted }}>金幣</span>
      </div>

      {/* 依用途分區 */}
      <div className="flex flex-col gap-4">
        {potionGroups.map(group => (
          <section key={group.id}>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <div className="flex items-center gap-1.5 text-xs font-black" style={{ color:C.brown }}>
                <span aria-hidden="true">{group.icon}</span>
                <span>{group.label}</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color:C.muted }}>{group.items.length} 種</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-stretch">
              {group.items.map(p => {
                const havePotion = potionInventory?.[p.id] || 0;
                const maxCrafts = calculateMaxCrafts(p, resources, coins);
                const executions = craftMode === "max" ? maxCrafts : craftMode;
                const canCraft = executions > 0 && maxCrafts >= executions;
                const costMultiplier = Math.max(1, executions);
                const totalGold = (p.gold || 0) * costMultiplier;
                return (
                  <div key={p.id} className="rounded-lg p-2 min-w-0 h-full flex flex-col"
                    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
                    <div className="flex items-start gap-1.5 mb-1.5 min-w-0">
                      <ConsumableArt item={p} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] leading-tight font-black break-words" style={{ color:C.brown }}>{p.name}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {RARITY_COLORS[p.rarity] && (
                            <span className="text-[9px] leading-none font-bold px-1 py-0.5 rounded"
                              style={{ background: RARITY_COLORS[p.rarity].bg, color: RARITY_COLORS[p.rarity].text }}>
                              {RARITY_COLORS[p.rarity].label}
                            </span>
                          )}
                          <span className="text-[9px] font-black" style={{ color:havePotion > 0 ? C.sage : C.muted }}>持有 {havePotion}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] leading-snug font-bold min-h-7 mb-1" style={{ color:C.sage }}>{p.effectText}</div>
                    <div className="text-[9px] leading-snug mb-2 min-h-6" style={{
                      color:C.muted, display:"-webkit-box", WebkitLineClamp:2,
                      WebkitBoxOrient:"vertical", overflow:"hidden",
                    }}>{p.desc}</div>
                    {p.futureFeature && (
                      <div className="text-[9px] leading-tight font-bold mb-2 px-1.5 py-1 rounded" style={{ color:"#9a5b08", background:"rgba(212,147,58,0.10)" }}>
                        預備道具・尚未開放使用
                      </div>
                    )}
                    <div className="flex flex-col gap-1 mb-2">
                      {p.recipe.map(r => {
                        const have = Math.floor(resources?.[r.id] || 0);
                        const need = r.count * costMultiplier;
                        const ok = have >= need;
                        const resEmoji = RES_EMOJI[r.id.split("_t")[0]] || "📦";
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-1 px-1.5 py-1 rounded text-[9px] font-bold min-w-0"
                            style={{ background: ok ? "rgba(90,158,80,0.10)" : "rgba(192,83,58,0.08)",
                              color: ok ? C.sage : "#C0533A" }}>
                            <span className="truncate min-w-0">{resEmoji} {formatResKey(r.id)}</span>
                            <span className="shrink-0">{need}/{have}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between gap-1 px-1.5 py-1 rounded text-[9px] font-bold"
                        style={{ background: (coins || 0) >= totalGold ? "rgba(212,147,58,0.12)" : "rgba(192,83,58,0.08)",
                          color: (coins || 0) >= totalGold ? "#D4933A" : "#C0533A" }}>
                        <span>🪙 金幣</span><span>{totalGold}</span>
                      </div>
                    </div>
                    <button
                      disabled={!canCraft || busy}
                      onClick={() => handleCraft(p)}
                      className="w-full min-h-11 mt-auto px-1 py-2 rounded-lg text-[10px] leading-tight font-bold active:scale-95 transition-all"
                      style={{
                        background: canCraft ? "linear-gradient(135deg,#7CBF70,#5A9E50)" : C.lockBd,
                        color: canCraft ? "white" : C.muted,
                        boxShadow: canCraft ? "0 2px 6px rgba(90,158,80,0.35)" : "none",
                        cursor: canCraft ? "pointer" : "default",
                      }}>
                      {busy ? "製作中…" : canCraft ? `製作 ×${executions * (p.craftYield || 1)}` : "材料不足"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const VILLAGE_PRIMARY_NAV = [
  { id:"village", label:"村莊", icon:"🏡", defaultTab:"village" },
  { id:"tasks", label:"任務", icon:"📋", defaultTab:"council" },
  { id:"workshop", label:"工坊", icon:"🔨", defaultTab:"forge" },
  { id:"trade", label:"交易", icon:"🛍️", defaultTab:"gacha" },
];

const VILLAGE_SECONDARY_NAV = {
  workshop: [
    { id:"forge", label:"裝備鍛造" },
    { id:"potioncraft", label:"藥水製作" },
    { id:"exchange", label:"材料兌換" },
  ],
  trade: [
    { id:"gacha", label:"貓咪扭蛋" },
    { id:"cardmarket", label:"卡片市集" },
  ],
};

function getVillagePrimaryTab(tab) {
  if (tab === "council") return "tasks";
  if (tab === "forge" || tab === "potioncraft" || tab === "exchange") return "workshop";
  if (tab === "gacha" || tab === "cardmarket") return "trade";
  return "village";
}

// ── 主元件 ───────────────────────────────────────────────────
export default function CatVillage({ catCards, gachaCoins, initialTab = "village" }) {
  const { profile } = useAuth();
  const [tab, setTab]               = useState(initialTab);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const [upgrading, setUpgrading]   = useState(false);
  const [localVillage, setLocalVillage] = useState(null);
  const [collectedResult, setCollectedResult] = useState(null);
  const [potionInventory, setPotionInventory] = useState({});

  const village    = localVillage || profile?.village || DEFAULT_VILLAGE;
  const buildings  = village.buildings || DEFAULT_VILLAGE.buildings;
  const resources  = village.resources || DEFAULT_VILLAGE.resources;
  const villageLevel = getVillageLevel(buildings);
  const primaryTab = getVillagePrimaryTab(tab);
  const secondaryNav = VILLAGE_SECONDARY_NAV[primaryTab] || [];

  const [marketConfig, setMarketConfig] = useState(null);
  const [myCats, setMyCats] = useState({});

  useEffect(() => {
    if (profile?.id && !profile?.village) {
    initVillageIfNeeded(profile.id, profile?.village).catch(() => {});
  }
}, [profile?.id]); // eslint-disable-line

  // 進入村莊頁時檢查村目標狀態（自動刷新）
  useEffect(() => {
    if (tab === "village" && profile?.id) {
      autoSpawnVillageGoal(getVillageLevel(buildings));
    }
  }, [tab, profile?.id]); // eslint-disable-line

  useEffect(() => {
    let active = true;
    getVillageMarketConfig()
      .then(config => {
        if (active) setMarketConfig(config);
      })
      .catch(() => {
        if (active) setMarketConfig(null);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCats(profile.id, setMyCats);
    return unsub;
  }, [profile?.id]); // eslint-disable-line

  useEffect(() => {
    if (!profile?.id) return;
    return subscribePotions(profile.id, setPotionInventory);
  }, [profile?.id]); // eslint-disable-line

  const secretaryCat = useMemo(() => {
    const cats = Object.values(myCats);
    if (!cats.length) return null;
    return cats.reduce((best, c) => (c.bond || 0) > (best.bond || 0) ? c : best, cats[0]);
  }, [myCats]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const { pending } = useMemo(
    () => calcPendingResources(village, { myCats }),
    [village, myCats, tick] // eslint-disable-line
  );

  const lastCollectedMs = useMemo(() => getVillageLastCollectedMs(village?.lastCollectedAt), [village?.lastCollectedAt]);
  const elapsedSec = useMemo(() => Math.min(MAX_COLLECT_HOURS * 3600, Math.max(0, Math.floor((Date.now() - lastCollectedMs) / 1000))), [lastCollectedMs, tick]);
  const nextCollectSec = useMemo(() => {
    const lastMs = lastCollectedMs;
    return Math.max(0, Math.floor((lastMs + MAX_COLLECT_HOURS * 3600000 - Date.now()) / 1000));
  }, [lastCollectedMs, tick]);

  async function handleCollect() {
    if (collecting || !profile?.id) return;
    sfxVillageCollect();
    setCollecting(true);
    try {
      const res = await collectVillageResources(profile.id, village, { myCats });
      if (res.resources) {
        setLocalVillage(prev => ({
          ...(prev || village),
          resources: res.resources,
          lastCollectedAt: { toMillis: () => Date.now() },
        }));
      }
      if (res.collected && Object.keys(res.collected).length > 0) {
        setCollectedResult(res.collected);
        setTimeout(() => setCollectedResult(null), 3500);
      }
    } catch (e) {
      alert("採集失敗：" + e.message);
    } finally {
      setCollecting(false);
    }
  }

  async function handleUpgrade(buildingId) {
    if (upgrading || !profile?.id) return;
    sfxVillageBuild();
    setUpgrading(true);
    try {
      const currentLevel = buildings[buildingId] || 1;
      const stageChanges = getBuildingStage(currentLevel) !== getBuildingStage(currentLevel + 1);
      const res = await upgradeVillageBuilding(profile.id, buildingId, village);
      if (stageChanges) sfxEpic(); else sfxSuccess();
      setLocalVillage(prev => ({
        ...(prev || village),
        buildings: { ...(prev?.buildings || buildings), [buildingId]: res.newLevel },
        resources: res.resources,
      }));
      setSelectedBuilding(null);
    } catch (e) {
      alert("升級失敗：" + e.message);
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden" style={{ background: C.bg }}>

      {/* 頂部主功能導覽列（質感印章切換） */}
      <nav aria-label="貓貓村主要功能"
        className="sticky top-0 z-30 flex shrink-0 items-center justify-around px-2 py-2 shadow-sm transition-all"
        style={{ background:"rgba(253,246,236,0.96)", borderBottom:`1.5px solid ${C.border}`, backdropFilter:"blur(12px)" }}>
        {VILLAGE_PRIMARY_NAV.map(item => {
          const isActive = primaryTab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.defaultTab)}
              aria-pressed={isActive}
              className={`flex-1 mx-1 min-h-[46px] py-1.5 px-2 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1 active:scale-95 ${isActive ? "shadow-md scale-[1.02]" : "hover:bg-amber-900/5"}`}
              style={{
                background: isActive ? "linear-gradient(135deg, #5C3D2E, #45291C)" : "rgba(255,255,255,0.6)",
                color: isActive ? "#FFF8F0" : C.brown,
                border: isActive ? "1.5px solid #784F32" : `1px solid ${C.border}`,
              }}>
              <span aria-hidden="true" className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 子功能導覽列 */}
      {secondaryNav.length > 0 && (
        <nav aria-label={`${VILLAGE_PRIMARY_NAV.find(item => item.id === primaryTab)?.label || ""}子功能`}
          className="mx-4 mt-3 grid grid-cols-2 gap-2 rounded-2xl p-1.5 shadow-sm"
          style={{ background:"rgba(255,255,255,0.75)", border:`1.5px solid ${C.border}` }}>
          {secondaryNav.map(item => {
            const isActive = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)}
                aria-pressed={isActive}
                className={`min-h-11 rounded-xl px-3 text-xs sm:text-sm font-black transition-all active:scale-95 ${isActive ? "shadow-sm" : ""}`}
                style={{
                  background: isActive ? C.sage : "transparent",
                  color: isActive ? "#FFF8F0" : C.brown,
                  border: isActive ? "1px solid rgba(255,255,255,0.3)" : "none"
                }}>
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {tab === "gacha" && (
        <GachaMachine catCards={catCards} gachaCoins={gachaCoins} onCoinsUpdated={() => {}} />
      )}

      {tab === "council" && (
        <CouncilHall
          profile={profile}
          village={localVillage || profile?.village}
          onBack={() => setTab("village")}
        />
      )}

      {tab === "forge" && (
        <ForgePanel
          profile={profile}
          resources={resources}
          myCats={myCats}
        />
      )}

      {tab === "potioncraft" && (
        <div className="px-4 py-3">
          <PotionCraftingPanel
            resources={resources}
            potionInventory={potionInventory}
            coins={profile?.coins || 0}
            memberId={profile?.id}
            onCrafted={() => {
              setLocalVillage(null);
              sfxVillageExchange();
            }}
          />
        </div>
      )}

      {tab === "exchange" && (
        <div className="px-4 py-3">
          <MarketExchangePanel
            resources={resources}
            memberId={profile?.id}
            onDone={() => {
              setLocalVillage(null);
              sfxVillageExchange();
            }}
            battleExchange={marketConfig?.battleExchange || BATTLE_EXCHANGE}
          />
        </div>
      )}

      {tab === "cardmarket" && (
        <div>
          <CardMarketPanel
            catCards={catCards}
            memberId={profile?.id}
            memberName={profile?.nickname || profile?.name || "射手"}
          />
        </div>
      )}

      {tab === "village" && (
        <>
          <PanoramaView villageLevel={villageLevel} displayLv={profile?.displayVillageLv} memberId={profile?.id} />

          <div className="mx-4 my-3 overflow-hidden rounded-2xl"
            style={{ background:C.card, border:`1px solid ${C.border}`, boxShadow:C.shadow }}>
            <div className="px-4 pt-3 text-sm font-black" style={{ color:C.brown }}>今日村務</div>
            <SecretaryCat cat={secretaryCat} />
            <ResourceBar
              resources={resources}
              pending={pending}
              onCollect={handleCollect}
              collecting={collecting}
              nextCollectSec={nextCollectSec}
              elapsedSec={elapsedSec}
              collectedResult={collectedResult}
            />
            <div className="px-4 py-2 text-center text-xs"
              style={{ color:C.mid, fontVariantNumeric:"tabular-nums" }}>
              每 {MAX_COLLECT_HOURS} 小時可領取一次
            </div>
          </div>

          <VillageGoalBanner />

          <ResourceRow resources={resources} gachaCoins={gachaCoins} />

          {/* 建築網格 */}
          <div className="px-4 py-3 flex-1">
            {(() => {
              const unlockedIds = BUILDING_LIST.filter(id => isBuildingUnlocked(id, buildings));
              return (
                <>
                  <div className="mb-3 text-sm font-black" style={{ color: C.brown }}>
                    已解鎖 {unlockedIds.length} / 9 棟建築
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {BUILDING_LIST.map(id =>
                      isBuildingUnlocked(id, buildings) ? (
                        <BuildingCard
                          key={id}
                          buildingId={id}
                          level={buildings[id] || 1}
                          resources={resources}
                          village={village}
                          myCats={myCats}
                          onClick={() => { sfxTap(); setSelectedBuilding(id); }}
                        />
                      ) : (
                        <LockedBuildingCard key={id} buildingId={id} buildings={buildings} />
                      )
                    )}
                  </div>

                  {/* 村莊等級說明 */}
                  <div className="mt-4 rounded-2xl px-4 py-3 text-center"
                    style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${C.border}` }}>
                    <div className="text-xs" style={{ color: C.mid }}>村莊等級 = 已解鎖建築平均等級</div>
                    <div className="text-xs mt-1" style={{ color: C.brown }}>
                      目前：{unlockedIds.reduce((s,id) => s + (buildings[id]||1), 0)} / {unlockedIds.length * 20} 總級 → Lv.{villageLevel}
                    </div>
                  </div>

                </>
              );
            })()}
          </div>
        </>
      )}

      {/* 升級 Modal */}
      {selectedBuilding && (
        <UpgradeModal
          buildingId={selectedBuilding}
          level={buildings[selectedBuilding] || 1}
          resources={resources}
          onUpgrade={() => handleUpgrade(selectedBuilding)}
          onClose={() => setSelectedBuilding(null)}
          upgrading={upgrading}
          memberId={profile?.id}
          memberName={profile?.nickname || profile?.name || "射手"}
          catCards={catCards}
          battleExchange={marketConfig?.battleExchange || BATTLE_EXCHANGE}
          onExchangeDone={() => setLocalVillage(null)}
          onVillageUpdate={setLocalVillage}
          village={village}
          myCats={myCats}
          profile={profile}
        />
      )}
    </div>
  );
}
