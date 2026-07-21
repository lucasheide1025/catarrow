// src/zombie/ZombieTestApp.jsx
// ═══════════════════════════════════════════════════════════════
//  🧟 殭屍生存模式 — 獨立測試元件
//  完全隔離於地下城/組隊/會員系統之外
//  入口: 在網址列加 ?zombie 即可進入
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import { ZombieBattleArena, ZombieMapView, ZombieBackpackPanel, ZombieEventPanel, ZombieBasePanel, ZombieBossArena } from "./ui";
import { COLORS, SHADOWS, ANIM, RADIUS, FONT, SPACING } from "./ui/theme";

// ── 設計系統已移至 src/zombie/ui/theme.js ──────────────

// ── 導覽分頁 ─────────────────────────────────────────────
const TABS = [
  { id: "overview",   label: "📋 概覽",     icon: "📋" },
  { id: "zombies",    label: "🧟 殭屍",     icon: "🧟" },
  { id: "combat",     label: "⚔️ 戰鬥",     icon: "⚔️" },
  { id: "survival",   label: "🛡️ 生存",     icon: "🛡️" },
  { id: "map",        label: "🗺️ 地圖",     icon: "🗺️" },
  { id: "boss",       label: "👑 BOSS",     icon: "👑" },
  { id: "base",       label: "🏠 基地",     icon: "🏠" },
  { id: "phases",     label: "📐 分期計畫",  icon: "📐" },
];

// ── 殭屍類型資料（供展示用）─────────────────────────────
const ZOMBIE_TYPES = [
  {
    id: "normal",   name: "普通殭屍", icon: "🧟",
    speed: "1-3m/回合", killHead: "1 箭", killTorso: "3 箭",
    special: "無", color: "#6b7280",
  },
  {
    id: "fast",     name: "疾行殭屍", icon: "💨",
    speed: "2-4m/回合", killHead: "2 箭", killTorso: "6 箭",
    special: "高機動性", color: "#f59e0b",
  },
  {
    id: "armored",  name: "重裝殭屍", icon: "🛡️",
    speed: "1-2m/回合", killHead: "需特殊裝備", killTorso: "6 箭",
    special: "0m 破甲衝撞", color: "#8b5cf6",
  },
  {
    id: "ranged",   name: "遠程殭屍", icon: "🎯",
    speed: "1-2m/回合", killHead: "1 箭", killTorso: "1 箭（胸）",
    special: "8m 自動干擾", color: "#ef4444",
  },
];

// ── 分期計畫資料 ─────────────────────────────────────────
const PHASES = [
  { id:"P0", name:"Phase 0：基礎建設", color:COLORS.textDim,
    items:["架構設計與資料模型","Firebase 安全規則","SVG 靶紙驗收","純函式單元測試"] },
  { id:"P1", name:"Phase 1：MVP 戰鬥", color:COLORS.blue,
    items:["4 靶位 A-D、普通殭屍","房主安全/計時/計分流程","SVG 命中判定與距離系統","M 脫靶與緊急暫停"] },
  { id:"P2", name:"Phase 2：生存系統 ✅", color:COLORS.green,
    items:["✅ 5 級防具 + 裝備 UI","✅ 5 種特殊箭矢 + 選擇器","✅ 疾行/重裝/遠程 3 種殭屍","✅ 感染狀態機 + 藥劑系統","✅ 配件系統（無人機/無線電/預備隊）","✅ 破甲衝撞/遠程干擾/爆炸AOE"] },
  { id:"P3", name:"Phase 3：探索與撤離 ✅", color:COLORS.amber,
    items:["✅ 15 節點地圖 + 探索移動","✅ 6 類隨機事件引擎","✅ 5 種撤離方式 + 條件檢查","✅ 背包重量管理（20kg 初始）","✅ 補給消耗（食物/水/箭數）"] },
  { id:"P4", name:"Phase 4：基地與橋接", color:COLORS.purple,
    items:["9 座建築 × 10 級制","共用貓村 9 種材料","跨世界 adapter（存根）"] },
  { id:"P5", name:"Phase 5：內容擴充", color:COLORS.accent,
    items:["BOSS 巨型殭屍王（3 階段）","完全感染弱點標記玩法","中央顯示器系統","精英與稀有事件"] },
];

// ── 設計原則（core-design.md）────────────────────────────
const PRINCIPLES = [
  { icon:"🏹", text:"射箭永遠是主角。裝備只能提高容錯，不能自動命中。" },
  { icon:"🎯", text:"高手優勢來自真實準度，不是等級或 ATK。頭部一箭必殺。" },
  { icon:"🤝", text:"新手能在近距離以三箭處理普通殭屍，感到自己保護了隊伍。" },
  { icon:"🧠", text:"壓力來自殭屍逼近與時間縮短，不是複雜 UI。" },
  { icon:"🛡️", text:"安全高於遊戲：緊急暫停、房主控時、計分階段不倒數。" },
  { icon:"💀", text:"不使用 HP 條。以部位破壞、擊退、減速、感染呈現結果。" },
];

// ── CSS 樣式輔助 ─────────────────────────────────────────
const s = (styles) => styles;

// ── 主元件 ───────────────────────────────────────────────
export default function ZombieTestApp() {
  const [tab, setTab] = useState("overview");

  return (
    <div style={s({
      minHeight: "100dvh",
      background: COLORS.bgGradient,
      color: COLORS.text,
      fontFamily: "'Inter','Noto Sans TC',sans-serif",
      display: "flex",
      flexDirection: "column",
    })}>

      {/* ── 頂部 header ──────────────────────────────────── */}
      <header style={s({
        borderBottom: `1px solid ${COLORS.glassBorder}`,
        padding: "16px 20px",
        background: "linear-gradient(135deg,#0a0e1a 0%,#1a0a0a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      })}>
        <div style={s({ display:"flex", alignItems:"center", gap:12 })}>
          <div style={s({
            fontSize:32, lineHeight:1,
            filter: "drop-shadow(0 0 8px rgba(239,68,68,0.4))",
          })}>🧟</div>
          <div>
            <div style={s({ fontWeight:900, fontSize:16, letterSpacing:"0.02em" })}>
              殭屍生存模式
            </div>
            <div style={s({ fontSize:11, color:COLORS.textDim })}>
              獨立測試環境 · v0.3.0 · Phase 3
            </div>
          </div>
        </div>
        <div style={s({ display:"flex", alignItems:"center", gap:10 })}>
          <div style={s({
            padding:"4px 12px", borderRadius:20,
            background: "rgba(239,68,68,0.12)",
            border: `1px solid ${COLORS.glassBorderActive}`,
            fontSize:11, fontWeight:700, color:COLORS.accent,
          })}>
            ⚠️ 獨立隔離
          </div>
          <a href="/"
            style={s({
              fontSize:12, color:COLORS.textDim,
              textDecoration:"none",
              padding:"6px 12px", borderRadius:8,
              border: `1px solid ${COLORS.glassBorder}`,
              transition:"all 0.15s",
            })}
            onMouseOver={e => e.target.style.borderColor = COLORS.textDim}
            onMouseOut={e => e.target.style.borderColor = COLORS.glassBorder}
          >
            ✕ 離開
          </a>
        </div>
      </header>

      {/* ── 設計原則橫幅 ────────────────────────────────── */}
      <div style={s({
        background: "linear-gradient(90deg, rgba(239,68,68,0.06), rgba(139,92,246,0.06))",
        borderBottom: `1px solid ${COLORS.glassBorder}`,
        padding: "12px 20px",
        display:"flex", gap:16, flexWrap:"wrap",
        flexShrink:0,
      })}>
        {PRINCIPLES.map((p, i) => (
          <div key={i} style={s({
            display:"flex", alignItems:"center", gap:6,
            fontSize:11, color:COLORS.textDim,
            whiteSpace: "nowrap",
          })}>
            <span>{p.icon}</span>
            <span>{p.text}</span>
          </div>
        ))}
      </div>

      {/* ── 導覽分頁 ────────────────────────────────────── */}
      <nav style={s({
        display:"flex", gap:2,
        padding:"0 16px",
        background: COLORS.bg,
        borderBottom: `1px solid ${COLORS.glassBorder}`,
        overflowX: "auto",
        flexShrink:0,
      })}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={s({
              padding:"10px 14px", fontSize:12, fontWeight: tab===t.id ? 700 : 500,
              color: tab===t.id ? COLORS.accent : COLORS.textDim,
              background: "transparent",
              border: "none",
              borderBottom: tab===t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── 內容區 ──────────────────────────────────────── */}
      <main style={s({
        flex:1, overflowY:"auto",
        padding: "24px 20px",
      })}>
        {tab === "overview" && <OverviewPanel />}
        {tab === "zombies"  && <ZombiePanel />}
        {tab === "combat"   && <CombatPanel />}
        {tab === "survival" && <SurvivalPanel />}
        {tab === "map"      && <ZombieMapView onTriggerBattle={(zone) => {}} onLogEvent={(e) => {}} />}
        {tab === "boss"     && <ZombieBossArena />}
        {tab === "base"     && <ZombieBasePanel />}
        {tab === "phases"   && <PhasesPanel />}
      </main>

      {/* ── 底部狀態列 ──────────────────────────────────── */}
      <footer style={s({
        borderTop: `1px solid ${COLORS.glassBorder}`,
        padding: "10px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        fontSize:11, color:COLORS.textMuted,
        flexShrink:0,
      })}>
        <span>🧟 殭屍生存模式 · 獨立隔離測試環境</span>
        <span>
          <span style={s({ color: COLORS.green })}>🟢 系統待命</span>
          <span style={s({ marginLeft:12 })}>v0.0.1 — Planning Complete</span>
        </span>
      </footer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  分頁內容元件
// ══════════════════════════════════════════════════════════

// ── 概覽面板 ────────────────────────────────────────────
function OverviewPanel() {
  return (
    <div style={s({ maxWidth: 800, margin: "0 auto" })}>
      <h1 style={s({ fontSize:28, fontWeight:900, marginBottom:8 })}>
        殭屍生存模式
      </h1>
      <p style={s({ color:COLORS.textDim, fontSize:14, lineHeight:1.7, marginBottom:32 })}>
        以真實射箭為主體的電子化合作桌遊。玩家在末世中面對殭屍軍團，
        用真實的弓箭技術保護彼此、探索廢墟、蒐集資源，最終活著撤離。
      </p>

      {/* 3 張核心摘要卡 */}
      <div style={s({ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12, marginBottom:32 })}>
        <SummaryCard icon="🎯" title="核心玩法" desc="選殭屍 → 射箭 → 點箭孔 → 探索/撤離決策。戰鬥結果由系統自動結算。" color={COLORS.blue} />
        <SummaryCard icon="🧟" title="部位破壞" desc="沒有 HP 條。頭部一箭必殺、頸部 50%、軀幹三箭、手臂降抓取、骨盆減速。" color={COLORS.accent} />
        <SummaryCard icon="🤝" title="合作生存" desc="最多 5 主射手 + 3 遠端狙擊。新手守近、高手處理遠程、中階補刀。" color={COLORS.green} />
      </div>

      {/* 討論完成標示 */}
      <div style={s({
        background: "rgba(34,197,94,0.08)",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: 16, padding: "16px 20px",
        display:"flex", alignItems:"center", gap:12,
      })}>
        <div style={s({ fontSize:28 })}>✅</div>
        <div>
          <div style={s({ fontWeight:700, fontSize:13, color:COLORS.green })}>
            全部 18 項規劃討論已完成
          </div>
          <div style={s({ fontSize:12, color:COLORS.textDim, marginTop:4 })}>
            A 區殭屍類型（6 題）· B 區防具裝備（4 題）· C 區地圖經濟（5 題）· D 區長期內容（3 題）
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, desc, color }) {
  return (
    <div style={s({
      background: COLORS.glass,
      border: `1px solid ${COLORS.glassBorder}`,
      borderRadius: 16, padding: "18px 16px",
      transition: "all 0.2s",
      cursor: "default",
    })}
      onMouseOver={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = COLORS.glassHover; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.glassBorder; e.currentTarget.style.background = COLORS.glass; }}
    >
      <div style={s({ fontSize:28, marginBottom:8 })}>{icon}</div>
      <div style={s({ fontWeight:700, fontSize:14, marginBottom:6 })}>{title}</div>
      <div style={s({ fontSize:12, color:COLORS.textDim, lineHeight:1.6 })}>{desc}</div>
    </div>
  );
}

// ── 殭屍面板 ────────────────────────────────────────────
function ZombiePanel() {
  return (
    <div style={s({ maxWidth:800, margin:"0 auto" })}>
      <h2 style={s({ fontSize:20, fontWeight:700, marginBottom:4 })}>🧟 殭屍類型</h2>
      <p style={s({ color:COLORS.textDim, fontSize:13, marginBottom:20 })}>
        已確認的 4 種殭屍原型，每種都有獨立的部位規則與行為模式
      </p>

      <div style={s({ display:"flex", flexDirection:"column", gap:12 })}>
        {ZOMBIE_TYPES.map(z => (
          <div key={z.id} style={s({
            background: COLORS.glass,
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: 16, padding: "16px 20px",
            borderLeft: `3px solid ${z.color}`,
            transition: "all 0.2s",
          })}
            onMouseOver={e => { e.currentTarget.style.background = COLORS.glassHover; }}
            onMouseOut={e => { e.currentTarget.style.background = COLORS.glass; }}
          >
            <div style={s({ display:"flex", alignItems:"center", gap:10, marginBottom:10 })}>
              <span style={s({ fontSize:24 })}>{z.icon}</span>
              <span style={s({ fontWeight:700, fontSize:15, color:z.color })}>{z.name}</span>
            </div>
            <div style={s({ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, fontSize:12 })}>
              <InfoChip label="移動" value={z.speed} />
              <InfoChip label="頭部擊殺" value={z.killHead} />
              <InfoChip label="軀幹擊殺" value={z.killTorso} />
              <InfoChip label="特殊" value={z.special} />
            </div>
          </div>
        ))}
      </div>

      <ZombieSVGPreview />
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={s({
      background: "rgba(255,255,255,0.03)",
      borderRadius: 8, padding: "8px 10px",
    })}>
      <div style={s({ fontSize:10, color:COLORS.textMuted, marginBottom:2 })}>{label}</div>
      <div style={s({ fontWeight:600, fontSize:12, color:COLORS.text })}>{value}</div>
    </div>
  );
}

// ── 殭屍 SVG 預覽佔位 ──────────────────────────────────
function ZombieSVGPreview() {
  return (
    <div style={s({
      marginTop:24,
      background: COLORS.glass,
      border: `1px solid ${COLORS.glassBorder}`,
      borderRadius: 16, padding: 20,
      textAlign: "center",
    })}>
      <div style={s({ fontSize:13, fontWeight:700, marginBottom:12, color:COLORS.textDim })}>
        🎨 殭屍靶紙 SVG 預覽區（待實作）
      </div>
      <div style={s({
        maxWidth:300, margin:"0 auto",
        aspectRatio:"3/4",
        background: "rgba(239,68,68,0.05)",
        borderRadius:12,
        border: `2px dashed ${COLORS.glassBorder}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:48,
        color: COLORS.textMuted,
      })}>
        🧟
      </div>
      <div style={s({ fontSize:11, color:COLORS.textMuted, marginTop:10 })}>
        預計使用 SVG 解剖判定區 + M 脫靶區
      </div>
    </div>
  );
}

// ── 戰鬥面板 ────────────────────────────────────────────
function CombatPanel() {
  return <ZombieBattleArena />;
}

function PhaseFlow() {
  const phases = ["LOBBY", "TARGET\nSETUP", "EXPLORING", "ENCOUNTER\nPREPARE", "WAITING\nSHOOTERS", "SAFETY\nCOUNTDOWN", "SHOOTING", "SCORE\nINPUT", "RESOLVING"];
  return (
    <div style={s({
      background: COLORS.glass,
      borderRadius: 16, padding: "16px 20px",
      border: `1px solid ${COLORS.glassBorder}`,
    })}>
      <div style={s({ fontSize:11, color:COLORS.textMuted, marginBottom:10, fontWeight:600 })}>
        狀態機流程
      </div>
      <div style={s({ display:"flex", gap:4, flexWrap:"wrap" })}>
        {phases.map((ph, i) => (
          <div key={i} style={s({
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 9,
            fontWeight: 600,
            background: "rgba(239,68,68,0.08)",
            color: COLORS.accent,
            border: "1px solid rgba(239,68,68,0.15)",
            whiteSpace: "pre-line",
            textAlign: "center",
            lineHeight: 1.3,
          })}>
            {ph}
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleCard({ icon, title, desc }) {
  return (
    <div style={s({
      background: COLORS.glass,
      border: `1px solid ${COLORS.glassBorder}`,
      borderRadius: 14, padding: "14px 16px",
    })}>
      <div style={s({ display:"flex", alignItems:"center", gap:8, marginBottom:6 })}>
        <span style={s({ fontSize:18 })}>{icon}</span>
        <span style={s({ fontWeight:700, fontSize:13 })}>{title}</span>
      </div>
      <div style={s({ fontSize:12, color:COLORS.textDim, lineHeight:1.6 })}>{desc}</div>
    </div>
  );
}

// ── 生存面板 ────────────────────────────────────────────
function SurvivalPanel() {
  return (
    <div style={s({ maxWidth:800, margin:"0 auto" })}>
      <h2 style={s({ fontSize:20, fontWeight:700, marginBottom:4 })}>🛡️ 生存系統</h2>
      <p style={s({ color:COLORS.textDim, fontSize:13, marginBottom:20 })}>
        防具、感染、藥劑與補給系統設計
      </p>

      {/* 防具表格 */}
      <div style={s({
        background: COLORS.glass,
        borderRadius: 16,
        border: `1px solid ${COLORS.glassBorder}`,
        overflow: "hidden",
        marginBottom: 16,
      })}>
        <div style={s({ padding:"14px 16px", fontWeight:700, fontSize:13, borderBottom:`1px solid ${COLORS.glassBorder}` })}>
          🛡️ 五級防具系統
        </div>
        <table style={s({ width:"100%", borderCollapse:"collapse", fontSize:12 })}>
          <thead>
            <tr style={s({ color:COLORS.textMuted, fontSize:10, textTransform:"uppercase" })}>
              <th style={s({ padding:"10px 12px", textAlign:"left", borderBottom:`1px solid ${COLORS.glassBorder}` })}>等級</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>格擋率</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>基礎耐久</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>強化插槽</th>
            </tr>
          </thead>
          <tbody>
            {[
              { tier:"T1 普通",  block:"40%",  dur:3,  slots:0, color:COLORS.textDim },
              { tier:"T2 精良",  block:"55%",  dur:5,  slots:1, color:COLORS.green },
              { tier:"T3 稀有",  block:"70%",  dur:8,  slots:1, color:COLORS.blue },
              { tier:"T4 史詩",  block:"82%",  dur:12, slots:2, color:COLORS.purple },
              { tier:"T5 傳說",  block:"92%",  dur:16, slots:2, color:COLORS.amber },
            ].map((r, i) => (
              <tr key={i} style={s({ borderBottom: i<4 ? `1px solid ${COLORS.glassBorder}` : "none" })}>
                <td style={s({ padding:"10px 12px", fontWeight:600, color:r.color })}>{r.tier}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.text })}>{r.block}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.text })}>{r.dur}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.text })}>{r.slots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 感染 + 藥劑 + 背包摘要 */}
      <div style={s({ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 })}>
        <RuleCard icon="🦠" title="感染系統"
          desc="10 節點倒數 · 連續 3 次攻擊完全感染 · 抑制劑暫停 2 節點 · 實驗血清可治癒" />
        <RuleCard icon="🎒" title="背包系統"
          desc="20kg 初始 · 食物 1kg / 水 1kg / 醫療 0.5kg / 箭 1kg(10枝) / 特殊箭 0.5kg" />
        <RuleCard icon="⚙️" title="配件系統"
          desc="隨基地等級成長插槽（初始1格）· 每場各 3 次 · 無人機/無線電/預備隊" />
        <RuleCard icon="💊" title="醫療品一覽"
          desc="免疫針 → 擋感染 · 抑制劑 → 暫停 2 節點 · 強效抑制劑 → +5 節點 · 實驗血清 → 完全治癒" />
      </div>
    </div>
  );
}

// ── 地圖面板 ────────────────────────────────────────────
function MapPanel() {
  return (
    <div style={s({ maxWidth:800, margin:"0 auto" })}>
      <h2 style={s({ fontSize:20, fontWeight:700, marginBottom:4 })}>🗺️ 地圖系統</h2>
      <p style={s({ color:COLORS.textDim, fontSize:13, marginBottom:20 })}>
        大型節點地圖與風險區設計
      </p>

      {/* 風險區表格 */}
      <div style={s({
        background: COLORS.glass,
        borderRadius: 16,
        border: `1px solid ${COLORS.glassBorder}`,
        overflow: "hidden",
        marginBottom: 16,
      })}>
        <div style={s({ padding:"14px 16px", fontWeight:700, fontSize:13, borderBottom:`1px solid ${COLORS.glassBorder}` })}>
          🗺️ 風險區遭遇設定
        </div>
        <table style={s({ width:"100%", borderCollapse:"collapse", fontSize:12 })}>
          <thead>
            <tr style={s({ color:COLORS.textMuted, fontSize:10, textTransform:"uppercase" })}>
              <th style={s({ padding:"10px 12px", textAlign:"left", borderBottom:`1px solid ${COLORS.glassBorder}` })}>區域</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>遭遇率</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>特殊殭屍</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>精英</th>
              <th style={s({ padding:"10px 12px", textAlign:"center", borderBottom:`1px solid ${COLORS.glassBorder}` })}>BOSS</th>
            </tr>
          </thead>
          <tbody>
            {[
              { zone:"🟢 安全區", rate:"0%",   special:"❌", elite:"❌", boss:"❌" },
              { zone:"🟡 普通區", rate:"20%",  special:"低", elite:"❌", boss:"❌" },
              { zone:"🟠 危險區", rate:"40%",  special:"✅", elite:"低", boss:"❌" },
              { zone:"🔴 高危區", rate:"60%",  special:"較高", elite:"少量", boss:"警告事件" },
              { zone:"⚫ 禁區",   rate:"80%",  special:"✅", elite:"✅", boss:"極高機率" },
            ].map((r, i) => (
              <tr key={i} style={s({ borderBottom: i<4 ? `1px solid ${COLORS.glassBorder}` : "none" })}>
                <td style={s({ padding:"10px 12px", fontWeight:600 })}>{r.zone}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.accent, fontWeight:700 })}>{r.rate}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.textDim })}>{r.special}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.textDim })}>{r.elite}</td>
                <td style={s({ padding:"10px 12px", textAlign:"center", color:COLORS.textDim })}>{r.boss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s({ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 })}>
        <RuleCard icon="🚁" title="5 種撤離方式"
          desc="隨機點 · 保證終點 · 急速撤離(-30%) · 特殊撤離(條件) · NPC救援(任務)" />
        <RuleCard icon="🎲" title="6 類隨機事件"
          desc="補給發現 · 情報/誤導 · 環境干擾 · NPC求援 · 遊蕩群 · 撤離變動" />
      </div>
    </div>
  );
}

// ── 基地面板 ────────────────────────────────────────────
function BasePanel() {
  const buildings = [
    { icon:"🌱", name:"種植室",     desc:"食物供應" },
    { icon:"💧", name:"淨水站",     desc:"飲水供應" },
    { icon:"🚚", name:"遠征補給隊", desc:"非同步物資回報" },
    { icon:"🏥", name:"醫療室",     desc:"醫療包/抑制劑/血清" },
    { icon:"🔧", name:"裝備工作台", desc:"製作/升級配件" },
    { icon:"🛡️", name:"防具修復站", desc:"修復防具耐久" },
    { icon:"📡", name:"無線電塔",   desc:"遠端情報預測" },
    { icon:"🔭", name:"偵察站",     desc:"地圖揭露/情報正確率" },
    { icon:"🚁", name:"搜救隊",     desc:"全滅後物資搜尋" },
  ];

  return (
    <div style={s({ maxWidth:800, margin:"0 auto" })}>
      <h2 style={s({ fontSize:20, fontWeight:700, marginBottom:4 })}>🏠 基地系統</h2>
      <p style={s({ color:COLORS.textDim, fontSize:13, marginBottom:20 })}>
        10 級制 × 9 種材料（與貓貓村共用）· 全部 9 座建築 Phase 4 實作
      </p>

      <div style={s({ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:10 })}>
        {buildings.map((b, i) => (
          <div key={i} style={s({
            background: COLORS.glass,
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: 12,
            padding: "14px 12px",
            textAlign: "center",
            transition: "all 0.2s",
          })}
            onMouseOver={e => { e.currentTarget.style.background = COLORS.glassHover; e.currentTarget.style.borderColor = COLORS.accent; }}
            onMouseOut={e => { e.currentTarget.style.background = COLORS.glass; e.currentTarget.style.borderColor = COLORS.glassBorder; }}
          >
            <div style={s({ fontSize:28, marginBottom:6 })}>{b.icon}</div>
            <div style={s({ fontWeight:700, fontSize:12, marginBottom:2 })}>{b.name}</div>
            <div style={s({ fontSize:10, color:COLORS.textDim })}>{b.desc}</div>
          </div>
        ))}
      </div>

      <div style={s({ marginTop:16, background: COLORS.glass, borderRadius:16, border:`1px solid ${COLORS.glassBorder}`, padding:"14px 16px" })}>
        <div style={s({ fontSize:12, color:COLORS.textDim, lineHeight:1.7 })}>
          <span style={s({ fontWeight:700, color:COLORS.green })}>🔗 與貓貓村對齊：</span>
          共用 9 種材料混搭升級 · 每建築 10 級 · BOSS 專屬材料用於解鎖高階建築/裝備
        </div>
      </div>
    </div>
  );
}

// ── 分期計畫面板 ────────────────────────────────────────
function PhasesPanel() {
  return (
    <div style={s({ maxWidth:800, margin:"0 auto" })}>
      <h2 style={s({ fontSize:20, fontWeight:700, marginBottom:4 })}>📐 分期實作計畫</h2>
      <p style={s({ color:COLORS.textDim, fontSize:13, marginBottom:20 })}>
        6 個階段，從基礎建設到完整內容
      </p>

      <div style={s({ display:"flex", flexDirection:"column", gap:12 })}>
        {PHASES.map((ph, i) => (
          <div key={ph.id} style={s({
            background: COLORS.glass,
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: 14, padding: "14px 18px",
            borderLeft: `3px solid ${ph.color}`,
            opacity: i === 0 ? 1 : 0.6,
            transition: "all 0.2s",
          })}
            onMouseOver={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = COLORS.glassHover; }}
            onMouseOut={e => { e.currentTarget.style.opacity = i === 0 ? "1" : "0.6"; e.currentTarget.style.background = COLORS.glass; }}
          >
            <div style={s({ fontWeight:700, fontSize:13, color:ph.color, marginBottom:6 })}>
              {ph.name}
            </div>
            <div style={s({ display:"flex", flexWrap:"wrap", gap:4 })}>
              {ph.items.map((item, j) => (
                <span key={j} style={s({
                  padding:"2px 8px", borderRadius:6,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${COLORS.glassBorder}`,
                  fontSize:11, color: COLORS.textDim,
                })}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Phase 0 啟動按鈕 */}
      <div style={s({
        marginTop:24, textAlign:"center",
        padding: 20,
        background: "rgba(239,68,68,0.04)",
        borderRadius: 16,
        border: "1px dashed rgba(239,68,68,0.25)",
      })}>
        <div style={s({ fontSize:14, color: COLORS.textDim, marginBottom:12 })}>
          討論完成，等待產品 owner 審閱後啟動 Phase 0
        </div>
        <div style={s({
          display:"inline-block",
          padding:"10px 24px",
          borderRadius:12,
          background: "rgba(239,68,68,0.1)",
          border: `1px solid ${COLORS.glassBorderActive}`,
          color: COLORS.accent,
          fontWeight:700, fontSize:13,
        })}>
          ⏳ 待審閱
        </div>
      </div>
    </div>
  );
}
