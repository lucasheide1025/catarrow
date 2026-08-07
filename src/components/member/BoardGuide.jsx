// src/components/member/BoardGuide.jsx
// 貓貓村探索地圖完整說明書（08-08）：玩家向的玩法總覽。
// 資料源盡量吃 boardData / boardJourney 既有常數（TILE_TYPES / BOARD_MODES /
// JOURNEY_BUFF_INFO / TRAP_EVENTS），格子說明文字集中在 TILE_DESC（純文案），
// 避免說明書跟程式邏輯漂移——改數值時只要改 boardData 就好。
import { useState } from "react";
import {
  TILE_TYPES, BOARD_MODES, JOURNEY_BUFF_INFO, TRAP_EVENTS,
  MAX_CAMP_MULT, MAX_SHOOT_MULT, MAX_CATMATE_STACKS, MAX_DICE_COUNT,
} from "../../lib/boardData";
import { JOURNEY_DAILY_DICE } from "../../lib/boardJourney";

// ── 格子玩家向說明（icon / label 吃 TILE_TYPES，這裡只補說明文字）──
const TILE_DESC = {
  start:     "旅程起點，從這裡出發。",
  material:  "獲得 3~6 份「家族素材」（隨機多種、依階級）。",
  mining:    "播放挖礦動畫後直接結算，獲得村莊資源（礦石・甜瓜・魚…）。",
  monster:   "射 6 箭！依命中率分成 S/A/B/C 帶，獎勵差距很大。",
  arrowdew:  "獲得箭露（依階級加成）。",
  coins:     "獲得金幣（依階級加成）。",
  gacha:     "獲得扭蛋幣（可在貓貓村抽貓咪）。",
  potion:    "獲得一瓶藥水（品質依階級）。",
  chest:     "不射箭，直接獲得 1~5 個寶箱（階級固定為本趟 T）。",
  catbond:   "陪練貓出現，獲得貓咪經驗與羈絆。",
  fate:      "命運卡：隨機事件。",
  opp:       "機會卡：隨機事件。",
  camp:      "營地：之後拿到的村莊資源再 ×1.2（可疊加到 ×3）。",
  empower:   "強化：50% 下一個射箭格獎勵 ×2；50% 下次擲 2~3 顆骰子。",
  catmate:   "貓夥伴：之後射箭分數 +5%（最多 +25%）。",
  trap:      "陷阱：隨機事件（蛇咬／流沙／竊賊／骰子／箭露）。",
  shortcut:  "捷徑：直接前進 3~5 格。",
  market:    "市集：小機率獲得金幣（完整市集整修中）。",
  scenery:   "風景：純放鬆，微薄金幣。",
  fork:      "分岔路：二選一（左路素材／右路怪物），不耗骰。",
  boss:      "終點 Boss：射 6 箭決戰，獎勵最豐厚！",
  cardgacha: "抽卡房：免費抽 1 張，或花 3000 金幣抽 3 張該 T 階級怪物卡！",
};

// 格子分類（總覽用）
const TILE_GROUPS = [
  { title: "🌾 資源格",   tiles: ["material", "mining", "coins", "arrowdew", "gacha", "potion", "chest", "catbond"] },
  { title: "⚔️ 射箭格",   tiles: ["monster", "boss"], note: "全旅程只有這兩種格子要射 6 箭" },
  { title: "✨ 加成格",   tiles: ["camp", "empower", "catmate"] },
  { title: "🎲 事件格",   tiles: ["trap", "shortcut", "fork"] },
  { title: "🎁 其他格",   tiles: ["market", "scenery", "fate", "opp", "cardgacha", "start"] },
];

// 地圖特色（對照 boardJourney.js 的 MODE_WEIGHT_TWEAKS）
const MODE_FLAVOR = {
  mine:      "⛏️ 礦產特別豐富：挖礦格出現率高",
  farm:      "🍈 物產豐饒：素材格特別多",
  harbor:    "💧 水氣充沛：箭露與藥水格偏多",
  hunting:   "👾 獵物眾多：怪物格與陷阱都偏多",
  market:    "🪙 商機無限：金幣、扭蛋與市集格偏多",
  warehouse: "🎁 藏寶豐富：寶箱格特別多",
  archery:   "🏹 箭露豐沛：箭露格偏多",
};

// ── 共用小元件 ──────────────────────────────────────────────
function Card({ title, children, icon }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-3.5 mb-3">
      {title && (
        <div className="flex items-center gap-1.5 text-sm font-black text-amber-100 mb-2">
          {icon && <span>{icon}</span>}<span>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}
function Row({ icon, label, children, color }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-lg leading-none shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black" style={{ color: color || "#fcd34d" }}>{label}</div>
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
function Note({ children }) {
  return <div className="mt-2 rounded-xl bg-amber-500/10 border border-amber-400/25 px-3 py-2 text-[11px] font-bold text-amber-100/85 leading-relaxed">{children}</div>;
}

// ── 章節 ───────────────────────────────────────────────────
function BasicsSection() {
  return (
    <>
      <Card title="玩起來是什麼感覺？" icon="🧭">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          探索地圖是一條 <b className="text-amber-200">100~200 格的蜿蜒旅程</b>。每天有
          <b className="text-amber-200"> {JOURNEY_DAILY_DICE} 顆骰子</b>（全地圖共用），
          擲骰前進、踩到格子就觸發事件，一路走向終點打 Boss。
          旅程進度<b className="text-amber-200">會自動保存</b>，沒走完明天繼續。
        </div>
      </Card>
      <Card title="骰子" icon="🎲">
        <Row icon="🎲" label={`每日 ${JOURNEY_DAILY_DICE} 顆（全地圖共用）`}>擲一次消耗 1 顆骰子，每天 0 點補滿。</Row>
        <Row icon="🎲" label="骰子點數 1~15">一趟 100~200 格，大骰讓推進有感；強化格的「多骰」效果可一次擲 2~4 顆。</Row>
        <Row icon="🎟️" label="骰子券">骰子用完可用「探索骰子券」+3 顆（可從商店取得）。</Row>
      </Card>
      <Card title="階級 T" icon="🏷️">
        <Row icon="🏷️" label="選 T 進場">地圖選單先挑階級 T1~T5（上限由對應建築等級決定）。階級越高，金幣／箭露／素材給得越多。</Row>
        <Row icon="🔒" label="選定後鎖定">一旦開始走，T 就固定到這趟走完——不能中途換階級。</Row>
        <Row icon="✅" label="走完重選">打敗終點 Boss 完成旅程後，回到選單可以重新選 T。</Row>
      </Card>
      <Card title="進度保存" icon="💾">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          每張地圖各自保存進度與「進行中的加成」——明天繼續走，不會歸零。
          骰子才是每日重置的東西。
        </div>
      </Card>
    </>
  );
}

function MapsSection() {
  return (
    <>
      <Card title="7 張地圖＝七大族" icon="🗺️">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed mb-2">
          每張地圖對應一個家族，產出該族的「村莊資源」與「家族素材」，各有風格：
        </div>
        <div className="space-y-1.5">
          {BOARD_MODES.map(m => (
            <div key={m.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-100">
                <span>{m.icon}</span>
                <span>{m.familyName}</span>
                <span className="text-slate-400 font-bold">・{m.name}</span>
                <span className="ml-auto text-[10px] font-black text-amber-200/70">{m.resourceName}</span>
              </div>
              <div className="mt-1 text-[11px] font-bold text-slate-400 leading-snug">{MODE_FLAVOR[m.id] || ""}</div>
            </div>
          ))}
        </div>
        <Note>想刷特定素材就選對應家族的地圖；想多賺金幣就選「喧鬧市集」。</Note>
      </Card>
      <Card title="單人 vs 組隊" icon="👥">
        <Row icon="🐱" label="單人探索">自己出發，隨時開始，進度個人保存。</Row>
        <Row icon="🚪" label="組隊探索">從選單下方進入組隊大廳，建立或搜尋房間（最多 8 人）。</Row>
      </Card>
    </>
  );
}

function TilesSection() {
  return (
    <>
      {TILE_GROUPS.map(g => (
        <Card key={g.title} title={g.title}>
          {g.note && <Note>{g.note}</Note>}
          <div className="space-y-1">
            {g.tiles.map(t => {
              const meta = TILE_TYPES[t] || {};
              return (
                <div key={t} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xl leading-none shrink-0 mt-0.5">{meta.icon || "❔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-amber-100">{meta.label || t}</div>
                    <div className="text-[11px] font-bold text-slate-400 leading-relaxed">{TILE_DESC[t] || ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
}

function BuffsSection() {
  return (
    <>
      <Card title="加成怎麼來？" icon="✨">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          踩到「營地／強化／多骰／貓夥伴」格子獲得加成，<b className="text-amber-200">疊加不消失</b>——
          骰子用完也不會被清掉，一直留到完成旅程（或效果被消耗）才重置。
        </div>
      </Card>
      {JOURNEY_BUFF_INFO.map(b => (
        <Card key={b.field} title={`${b.icon} ${b.name}`}>
          <div className="text-xs font-bold text-slate-300/90 leading-relaxed">{b.desc}</div>
        </Card>
      ))}
      <Note>
        疊加上限：營地 ×{MAX_CAMP_MULT}、強化 ×{MAX_SHOOT_MULT}、貓夥伴 +{MAX_CATMATE_STACKS * 5}%、骰子 ×{MAX_DICE_COUNT} 顆。
      </Note>
    </>
  );
}

function ShootingSection() {
  const bands = [
    { band: "S", min: "85%↑", desc: "怪物獎勵 ×2.0、素材 ×4、40% 掉寶箱", color: "#fcd34d" },
    { band: "A", min: "65%↑", desc: "怪物獎勵 ×1.4、素材 ×3、25% 掉寶箱", color: "#fca5a5" },
    { band: "B", min: "40%↑", desc: "怪物獎勵 ×1.0、素材 ×2、10% 掉寶箱", color: "#93c5fd" },
    { band: "C", min: "<40%", desc: "怪物獎勵 ×0.6、素材 ×1", color: "#cbd5e1" },
  ];
  return (
    <>
      <Card title="哪些格子要射箭？" icon="🎯">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          只有 <b className="text-rose-300">怪物格</b> 與 <b className="text-rose-300">終點 Boss</b> 要射 6 箭。
          其餘格子（挖礦／採集／寶箱／箭露…）都有<b className="text-amber-200">動作動畫</b>，播完直接結算。
        </div>
      </Card>
      <Card title="射 6 箭計分" icon="🏹">
        <Row icon="🎯" label="輸入每箭分數">依實際命中輸入 6 箭（X／10／9／8／7／6／5／3／M），全輸入後送出。</Row>
        <Row icon="📊" label="完成度 = 命中分數 / 滿分">分數越高完成度越高，獎勵分帶越大。</Row>
      </Card>
      <Card title="獎勵分帶（怪物格）" icon="🏅">
        <div className="space-y-1.5">
          {bands.map(b => (
            <div key={b.band} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <span className="w-7 h-7 rounded-lg grid place-items-center text-xs font-black" style={{ background: b.color, color: "#1e293b" }}>{b.band}</span>
              <span className="text-[10px] font-black text-slate-400 w-14">{b.min}</span>
              <span className="text-[11px] font-bold text-slate-300 leading-snug">{b.desc}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="終點 Boss" icon="⚔️">
        <Row icon="⚔️" label="不會輸，但打越高獎越大">Boss 有血條，完成度越高扣越多血；85% 以上（S 帶）直接擊倒、獎勵最豐。</Row>
        <Row icon="💰" label="Boss 掉落">金幣 300~600×T、箭露 60~120×T、家族素材、寶箱與貓咪經驗。</Row>
      </Card>
    </>
  );
}

function TrapsSection() {
  return (
    <>
      <Card title="踩到陷阱？" icon="🕳️">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          陷阱有 5 種隨機事件，每種後退格數與損失都不同；懲罰有<b className="text-amber-200">下限保護</b>（扣到 0 為止，不會變負）。
        </div>
      </Card>
      {TRAP_EVENTS.map(ev => (
        <Card key={ev.type} title={`${ev.icon} ${ev.label}`}>
          <Row icon="📍" label="效果">
            {ev.desc}・後退 {ev.back} 格
            {ev.loseCoins && `・損失 ${ev.loseCoins[0]}~${ev.loseCoins[1]} 金幣（×T）`}
            {ev.loseArrowdew && `・損失 ${ev.loseArrowdew[0]}~${ev.loseArrowdew[1]} 箭露（×T）`}
            {ev.loseDice && `・少 ${ev.loseDice} 顆骰子`}
          </Row>
        </Card>
      ))}
      <Note>組隊模式：房主擲骰時抽一次事件，全隊看到同一個陷阱。</Note>
    </>
  );
}

function GachaSection() {
  return (
    <>
      <Card title="抽卡房（🃏 稀有格）" icon="🃏">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          踩到「抽卡房」格就會打開抽卡介面——抽的是<b className="text-amber-200">怪物卡片</b>，
          存進卡片收集系統（重複的卡自動累計，可當升星素材）。
        </div>
      </Card>
      <Card title="抽卡規則" icon="🎴">
        <Row icon="🆓" label="免費抽 1 張">每次踩到抽卡房都送 1 次免費抽，不花錢。</Row>
        <Row icon="💰" label="付費抽 3 張">花 3000 金幣一次抽 3 張。</Row>
        <Row icon="🏷️" label="階級綁定">在 T1 地圖踩到就抽 T1 卡，T4 就抽 T4 卡——池＝該 T 階級的所有普通怪。</Row>
        <Row icon="🚫" label="不抽小王／大王／世界王">卡池只有普通怪物卡，Boss 級卡片不進池。</Row>
        <Row icon="🎴" label="卡背翻開">抽到的卡會一張一張翻開（3D 翻卡演出），單張時高亮翻轉。</Row>
      </Card>
    </>
  );
}

function TeamSection() {
  return (
    <>
      <Card title="組隊探索怎麼玩？" icon="🚪">
        <div className="text-xs font-bold text-slate-300/90 leading-relaxed">
          從地圖選單下方進入<b className="text-amber-200">組隊探索大廳</b>，建立房間或搜尋加入（最多 8 人）。
          全隊走「房主的旅程」，隊友用自己的帳號領各自的獎勵。
        </div>
      </Card>
      <Card title="組隊規則" icon="👥">
        <Row icon="🗺️" label="旅程吃房主進度">路線、位置、階級都跟房主的地圖綁定；房主沒走完的旅程，全隊一起走。</Row>
        <Row icon="🎲" label="骰子只有房主有">房主消耗自己的骰子擲骰，全隊棋子一起動。</Row>
        <Row icon="🎁" label="獎勵各自領">踩到格子每個人都能領一份獎勵（人數加成），但每步都要按「收下」全隊才繼續。</Row>
        <Row icon="🏹" label="怪物格派射手">踩到怪物／Boss 格時隨機指派射手射 6 箭，取平均分數結算。</Row>
        <Row icon="🔀" label="分岔路全員投票">碰到分岔路全員投票選路，票多的路線勝出（20 秒未投自動投左路）。</Row>
        <Row icon="🃏" label="抽卡房每人抽 1 張">踩到抽卡房每人自動免費抽 1 張（付費 3 連抽是單人模式限定）。</Row>
      </Card>
      <Note>房間沒滿也能開始（1 人即可）；中途離開無法再回到同一局（房主離開＝解散全房）。</Note>
    </>
  );
}

const SECTIONS = [
  { id: "basics",   icon: "🎲", label: "基本玩法", Comp: BasicsSection },
  { id: "maps",     icon: "🗺️", label: "地圖模式", Comp: MapsSection },
  { id: "tiles",    icon: "🧱", label: "格子總覽", Comp: TilesSection },
  { id: "buffs",    icon: "✨", label: "加成效果", Comp: BuffsSection },
  { id: "shooting", icon: "🎯", label: "射箭獎勵", Comp: ShootingSection },
  { id: "traps",    icon: "🕳️", label: "陷阱事件", Comp: TrapsSection },
  { id: "gacha",    icon: "🃏", label: "抽卡房",   Comp: GachaSection },
  { id: "team",     icon: "👥", label: "組隊模式", Comp: TeamSection },
];

// ── 主元件 ──────────────────────────────────────────────────
export default function BoardGuide({ onClose }) {
  const [tab, setTab] = useState(SECTIONS[0].id);
  const active = SECTIONS.find(s => s.id === tab) || SECTIONS[0];
  const Comp = active.Comp;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col"
      style={{ backgroundColor: "#140a04", backgroundImage: "linear-gradient(rgba(18,10,4,0.94),rgba(12,7,3,0.97))" }}>
      {/* 頂列 */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black active:scale-95">←</button>
        <div className="flex items-center gap-1.5 text-amber-100 font-black">
          <span className="text-lg">📖</span>探索地圖說明書
        </div>
        <div className="w-9" />
      </div>
      {/* 章節 chips */}
      <div className="w-full max-w-lg mx-auto px-4 pb-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-1.5 min-w-max">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setTab(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap border transition-all active:scale-95 ${s.id === tab ? "bg-amber-400 text-slate-900 border-amber-300" : "bg-black/30 text-amber-100/80 border-amber-500/25"}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>
      {/* 內容區 */}
      <div className="flex-1 overflow-y-auto w-full" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(251,191,36,.4) transparent" }}>
        <div className="w-full max-w-lg mx-auto px-4 pb-6">
          <Comp />
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black active:scale-95">
            知道了・開始探索
          </button>
        </div>
      </div>
    </div>
  );
}
