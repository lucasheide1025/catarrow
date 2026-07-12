// src/components/shared/SharedBattleComponents.jsx
// 戰鬥模式共用元件庫 — 統一 MonsterBattle / PartyBattleRoom / DungeonBattleRoom / WorldBossAttack 的 UI 元件
import { memo } from "react";

/**
 * BattleHPBar — 怪物 HP 血條
 * @param {Object}  props
 * @param {number}  props.current       - 當前 HP
 * @param {number}  props.max           - 最大 HP
 * @param {number}  [props.height=21]   - 血條高度（px）
 * @param {boolean} [props.showBorder=true] - 是否顯示邊框
 * @param {string}  [props.label]       - 可選的文字標籤，有標籤時 HP 數字顯示在血條上方而非內部
 * @param {boolean} [props.compact=false] - 精簡模式（移除 marginBottom）
 */
export const BattleHPBar = memo(function BattleHPBar({ current, max, height = 21, showBorder = true, label, compact = false }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  const barStyle = {
    background: "#1e293b",
    height,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    ...(!compact ? { marginBottom: 5 } : {}),
    ...(showBorder ? { border: "1.5px solid #7f1d1d" } : { borderBottom: "1.5px solid #7f1d1d" }),
  };
  const fillStyle = {
    width: `${pct}%`,
    height: "100%",
    transition: "width .7s ease",
    background: pct > 50 ? "#dc2626" : pct > 25 ? "#f59e0b" : "#7f1d1d",
  };
  const textStyle = {
    position: "absolute", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white", fontSize: 10, fontWeight: 900,
  };
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
          <span style={{ color: "#94a3b8", fontWeight: 700 }}>{label}</span>
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>
            {(current ?? 0).toLocaleString()} / {(max ?? 0).toLocaleString()}
          </span>
        </div>
      )}
      <div style={barStyle}>
        <div style={fillStyle} />
        {!label && (
          <div style={textStyle}>
            {(current ?? 0).toLocaleString()} / {(max ?? 0).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * BattleArrowSlots — 箭槽顯示（已射箭分數佔位格）
 * @param {Object}   props
 * @param {Array<{label:string,score:number}|string>} [props.arrows=[]] - 已射的箭陣列，可為物件或純字串
 * @param {number}   [props.totalArrows=6]  - 總箭格數
 * @param {Function} [props.onUndo]         - 撤回最後一箭的回呼
 * @param {boolean}  [props.showUndo=false] - 是否顯示撤回按鈕
 * @param {number}   [props.slotSize=28]    - 每格寬高（px）
 * @param {boolean}  [props.highlightNext=true] - 是否高亮下一個空格
 * @param {boolean}  [props.showScore=true] - 是否顯示合計分數
 * @param {number}   [props.totalScore]     - 自訂總分（預設自動加總）
 * @param {React.ReactNode} [props.extraContent] - 箭槽旁的額外內容
 * @param {boolean}  [props.processing=false]     - 處理中模式（顯示動畫格）
 * @param {number}   [props.processingIdx=-1]    - 當前處理中的箭索引
 */
export const BattleArrowSlots = memo(function BattleArrowSlots({
  arrows = [], totalArrows = 6, onUndo, showUndo = false,
  slotSize = 28, highlightNext = true, showScore = true,
  totalScore, extraContent, processing = false, processingIdx = -1,
}) {
  const labels = arrows.map(a => (typeof a === "string" ? a : a?.label ?? ""));
  const isStringArray = arrows.length > 0 && typeof arrows[0] === "string";
  const computedTotal = totalScore !== undefined ? totalScore : (
    isStringArray
      ? labels.reduce((s, lbl) => {
          if (lbl === "M") return s;
          if (lbl === "X") return s + 10;
          const n = parseInt(lbl);
          return s + (isNaN(n) ? 0 : n);
        }, 0)
      : arrows.reduce((s, a) => s + (a?.score ?? 0), 0)
  );
  return (
    <div style={{ display: "flex", gap: 3, marginBottom: 4, justifyContent: "center", alignItems: "center" }}>
      {Array.from({ length: totalArrows }).map((_, i) => {
        const hasArrow = i < labels.length;
        const isNext = !hasArrow && i === labels.length;
        const isActive = processing && i === processingIdx;
        return (
          <div key={i} style={{
            width: slotSize, height: slotSize, borderRadius: 6, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900,
            background: isActive ? "#1e3a8a" : hasArrow ? "#2563eb" : isNext && highlightNext ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.05)",
            border: `2px solid ${isActive ? "#fbbf24" : hasArrow ? "#60a5fa" : isNext && highlightNext ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
            color: isActive ? "#fbbf24" : hasArrow ? "white" : "#475569",
            transform: isActive ? "scale(1.15)" : "scale(1)",
            boxShadow: isActive ? "0 0 12px #fbbf24aa" : undefined,
            transition: "transform 0.15s",
          }}>
            {hasArrow ? labels[i] : ""}
          </div>
        );
      })}
      {showUndo && onUndo && (
        <button onClick={onUndo} style={{
          background: "none", border: "none", color: "#64748b",
          fontSize: slotSize > 30 ? 18 : 16, cursor: "pointer", paddingLeft: 4,
        }}>↩</button>
      )}
      {showScore && (
        <span style={{ color: "#f1f5f9", fontWeight: 900, fontSize: 12, marginLeft: 4 }}>
          {processing ? "計算中…" : `${computedTotal}分`}
        </span>
      )}
      {extraContent}
    </div>
  );
});

/**
 * BattleScoreButtons — 分數按鈕格（支援 3 種視覺變體）
 * @param {Object}   props
 * @param {string[]} [props.labels=['X','10','9','8','7','6','5','4','3','2','1','M']] - 按鈕標籤陣列
 * @param {Function} props.onScore   - 點擊按鈕回呼，接收標籤字串
 * @param {boolean}  [props.disabled=false] - 是否禁用
 * @param {'image'|'minimal'|'tailwind'} [props.variant='image']
 *   - 'image':    木紋背景按鈕（預設，MonsterBattle 風格）
 *   - 'minimal':  半透明簡約按鈕
 *   - 'tailwind': Tailwind CSS 色票按鈕
 * @param {'sm'|'md'|'lg'} [props.btnSize='md'] - 按鈕尺寸
 */
export const BattleScoreButtons = memo(function BattleScoreButtons({
  labels = ["X","10","9","8","7","6","5","4","3","2","1","M"],
  onScore, disabled = false, variant = "image", btnSize = "md",
}) {
  const sizeMap = { sm: 36, md: 44, lg: 48 };
  const btnH = sizeMap[btnSize] || 44;
  const btnFs = btnSize === "sm" ? 12 : btnSize === "lg" ? 17 : 15;
  const getColor = label => {
    if (label === "X") return "#fbbf24";
    if (label === "M") return "#94a3b8";
    const n = Number(label);
    if (n >= 9) return "#fef3c7"; if (n >= 7) return "#bfdbfe"; if (n >= 5) return "#d1d5db"; return "#9ca3af";
  };
  const tw = label => {
    const m = { X:"bg-yellow-400 text-yellow-900","10":"bg-yellow-300 text-yellow-900","9":"bg-red-400 text-white","8":"bg-red-300 text-white","7":"bg-blue-400 text-white","6":"bg-blue-300 text-white","5":"bg-gray-500 text-white","4":"bg-gray-400 text-white","3":"bg-gray-300 text-gray-800","2":"bg-gray-200 text-gray-700","1":"bg-gray-100 text-gray-600",M:"bg-black/30 text-gray-300"};
    return m[label] || "bg-slate-600 text-white";
  };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4,
      background: variant === "image" ? "rgb(20,12,5)" : "transparent",
      borderRadius: 8, padding: variant === "image" ? "5px" : 0, marginBottom: 4,
    }}>
      {labels.map(label => {
        const common = { fontWeight: 900, fontSize: btnFs, cursor: disabled ? "default" : "pointer", padding: "4px 0", lineHeight: 1, opacity: disabled ? 0.3 : 1 };
        if (variant === "minimal") {
          const s = label === "X" ? 10 : label === "M" ? 0 : Number(label);
          return (
            <button key={label} onClick={() => onScore(label)} disabled={disabled}
              style={{ ...common, height: btnH, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
                background: s === 10 ? "rgba(245,158,11,0.2)" : s === 0 ? "rgba(100,116,139,0.2)" : "rgba(255,255,255,0.06)",
                color: s === 10 ? "#fbbf24" : s === 0 ? "#64748b" : "#e2e8f0",
              }}>{label}</button>
          );
        }
        if (variant === "tailwind") {
          return (
            <button key={label} onClick={() => onScore(label)} disabled={disabled}
              className={`rounded-lg font-black active:scale-95 ${tw(label)}`}
              style={{ ...common, height: btnH, fontSize: btnFs - 3, padding: "8px 2px", }}>{label}</button>
          );
        }
        return (
          <button key={label} onClick={() => onScore(label)} disabled={disabled}
            style={{
              ...common, height: btnH, width: "100%", border: "none", borderRadius: 6,
              backgroundImage: "url(/ui/score-btn.webp)", backgroundSize: "cover", backgroundPosition: "center",
              backgroundColor: "rgb(30,16,6)",
              WebkitAppearance: "none", appearance: "none",
              color: getColor(label), textShadow: "0 1px 6px #000",
            }}
            onTouchStart={e => { if(!disabled) e.currentTarget.style.transform="scale(0.88)"; }}
            onTouchEnd={e => { if(!disabled) e.currentTarget.style.transform="scale(1)"; }}>{label}</button>
        );
      })}
    </div>
  );
});

/**
 * BattleStatusTags — 狀態標籤列（回數、ATK、DEF、人數等）
 * @param {Object} props
 * @param {Array<{icon?:string, label:string, color?:string, bg?:string, border?:string, style?:object}>} [props.tags=[]]
 */
export const BattleStatusTags = memo(function BattleStatusTags({ tags = [] }) {
  return (
    <div style={{ display: "flex", gap: 3, marginBottom: 4, flexWrap: "wrap" }}>
      {tags.map((tag, i) => (
        <div key={i} style={{
          background: tag.bg || "rgba(255,255,255,0.07)",
          border: tag.border || `1px solid ${(tag.color||"rgba(255,255,255,0.15)")}44`,
          borderRadius: 5, padding: "1px 6px", fontSize: 10, color: tag.color || "#94a3b8",
          ...(tag.style||{}),
        }}>
          {tag.icon && <span>{tag.icon} </span>}{tag.label}
        </div>
      ))}
    </div>
  );
});

// ── 結算畫面共用元件 ──────────────────────────────────────
// 使用方式範例：
// <BattleResultHeader emoji="🏆" title="討伐成功！" subtitle="火焰巨龍 · 3回合" color="amber" />

const RESULT_CSS = `@keyframes result-pop{0%{opacity:0;transform:scale(0.7) rotate(-4deg)}60%{transform:scale(1.06) rotate(1deg)}100%{opacity:1;transform:scale(1)}}`;

/**
 * BattleResultHeader — 結算畫面頂部標題（動畫彈出）
 * @param {Object}   props
 * @param {string}   props.emoji          - 大圖示 emoji
 * @param {string}   props.title          - 主標題文字
 * @param {string}   [props.subtitle]     - 副標題
 * @param {'amber'|'red'|'slate'|'emerald'|'indigo'} [props.color='amber'] - 配色主題
 * @param {string}   [props.animDelay='0s'] - 動畫延遲（CSS 時間值）
 */
export const BattleResultHeader = memo(function BattleResultHeader({ emoji, title, subtitle, color = "amber", animDelay = "0s" }) {
  const colorMap = {
    amber: { text: "text-amber-400", border: "border-amber-400/50", bg: "from-yellow-900/80" },
    red:   { text: "text-red-400",   border: "border-red-400/50",   bg: "from-red-900/80" },
    slate: { text: "text-slate-300",  border: "border-slate-400/30", bg: "from-slate-800/80" },
    emerald: { text: "text-emerald-400", border: "border-emerald-400/50", bg: "from-emerald-900/80" },
    indigo: { text: "text-indigo-300", border: "border-indigo-400/30", bg: "from-indigo-900/80" },
  };
  const c = colorMap[color] || colorMap.amber;
  return (
    <>
      <style>{RESULT_CSS}</style>
      <div
        className="flex flex-col items-center gap-1 pt-2"
        style={{ animation: `result-pop .6s ${animDelay} cubic-bezier(.34,1.56,.64,1) both` }}
      >
      <div className="text-6xl">{emoji}</div>
      <div className={`text-2xl font-black ${c.text}`}>{title}</div>
      {subtitle && (
        <div className="text-slate-400 text-sm text-center">{subtitle}</div>
      )}
    </div>
    </>
  );
});

/**
 * BattleStatCard — 統計卡片（結算畫面中的單一數值方塊）
 * @param {Object}  props
 * @param {string}  props.label  - 數值名稱
 * @param {number|string} props.value - 數值
 * @param {string}  [props.icon] - 圖示
 * @param {boolean} [props.accent=false] - 是否強調（金色高亮）
 */
export const BattleStatCard = memo(function BattleStatCard({ label, value, icon, accent = false }) {
  return (
    <div style={{
      background: accent ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)",
      border: accent ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: "12px 16px",
      textAlign: "center",
    }}>
      {icon && <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>}
      <div style={{ fontSize: 22, fontWeight: 900, color: accent ? "#fbbf24" : "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{label}</div>
    </div>
  );
});

/**
 * BattleStatRow — 統計列（結算畫面中的標籤-數值橫列）
 * @param {Object}   props
 * @param {string}   props.label       - 左側標籤
 * @param {number|string} props.value  - 右側數值
 * @param {string}   [props.icon]      - 圖示
 * @param {string}   [props.valueColor] - 數值顏色
 * @param {boolean}  [props.borderTop]  - 是否顯示頂部分隔線
 */
export const BattleStatRow = memo(function BattleStatRow({ label, value, icon, valueColor, borderTop }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0",
      ...(borderTop ? { borderTop: "1px solid rgba(255,255,255,0.08)" } : {}),
    }}>
      <span style={{ color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
        {icon && <span>{icon}</span>}{label}
      </span>
      <span style={{
        fontWeight: 900, fontSize: 14,
        color: valueColor || "#f1f5f9",
      }}>{value}</span>
    </div>
  );
});

// ── 戰鬥紀錄折疊面板（四個打怪模式共用）──
// variant="overlay" → 暗色覆蓋層（組隊/地下城/世界王）
// variant="sidebar" → 側邊可折疊條（單人打怪）

/**
 * BattleLogPanel — 戰鬥紀錄折疊面板
 *
 * @param {Object}   props
 * @param {boolean}  props.open       - 是否展開面板
 * @param {Function} props.onClose    - 關閉回呼（overlay 模式為 ✕ 按鈕；sidebar 模式為標題列點擊）
 * @param {'overlay'|'sidebar'} [props.variant='overlay']
 *   - 'overlay':  絕對定位暗色覆蓋層，覆蓋整個怪物區（組隊/地下城/世界王）
 *   - 'sidebar':  左側可折疊條，寬度在 36px（折疊）與 180px（展開）之間切換（單人打怪）
 * @param {string}   [props.title='📜 戰鬥紀錄'] - 面板標題文字
 * @param {React.ReactNode} props.children       - 面板內容
 */
export const BattleLogPanel = memo(function BattleLogPanel({
  open,
  onClose,
  variant = "overlay",
  title = "📜 戰鬥紀錄",
  children,
}) {
  if (variant === "sidebar") {
    return (
      <div style={{
        flexShrink:0, background:"rgba(0,0,0,0.82)", borderRadius:8,
        border:"1px solid rgba(255,255,255,0.07)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        width: open ? 180 : 36, transition:"width .2s ease",
        alignSelf:"flex-start", maxHeight:200
      }}>
        <button onClick={onClose} style={{
          display:"flex", alignItems:"center", gap:4, padding:"5px 6px",
          background:"none", border:"none", cursor:"pointer", width:"100%",
          borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none"
        }}>
          <span style={{fontSize:12}}>📜</span>
          {open && <span style={{color:"#475569", fontSize:9, fontWeight:900, letterSpacing:1, whiteSpace:"nowrap"}}>{title.replace("📜 ","")}</span>}
          <span style={{marginLeft:"auto", color:"#475569", fontSize:10}}>{open?"◀":"▶"}</span>
        </button>
        {open && <div style={{flex:1, overflowY:"auto", padding:"2px 6px"}}>{children}</div>}
      </div>
    );
  }
  // overlay variant (default)
  if (!open) return null;
  return (
    <div style={{ position:"absolute", inset:0, zIndex:40, background:"rgba(0,0,0,0.92)", overflowY:"auto", padding:"8px 10px", fontSize:11 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, borderBottom:"1px solid rgba(255,255,255,0.08)", paddingBottom:4 }}>
        <span style={{ color:"#fbbf24", fontWeight:900, fontSize:12 }}>{title}</span>
        <button onClick={onClose} style={{ color:"#64748b", fontSize:16, background:"none", border:"none", cursor:"pointer", lineHeight:1 }}>✕</button>
      </div>
      {children}
    </div>
  );
});

/**
 * BattleRewardItem — 獎勵物品條（結算畫面中的單一獎勵）
 * @param {Object}  props
 * @param {string}  props.icon              - 物品圖示
 * @param {string}  props.name              - 物品名稱
 * @param {string}  [props.desc]            - 物品描述
 * @param {'gold'|'rare'|'mythic'|string} [props.tier] - 稀有度（控制顏色）
 * @param {boolean} [props.highlight=false] - 是否高亮（金色背景）
 */
export const BattleRewardItem = memo(function BattleRewardItem({ icon, name, desc, tier, highlight = false }) {
  const tierColor = tier === "gold" ? "#fbbf24" : tier === "rare" ? "#a78bfa" : tier === "mythic" ? "#f43f5e" : "#94a3b8";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: highlight ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${highlight ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10,
      padding: "10px 12px",
    }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 900, fontSize: 13, color: highlight ? "#fbbf24" : "#f1f5f9",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{name}</div>
        {desc && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{desc}</div>
        )}
      </div>
      {tier && (
        <span style={{
          fontSize: 9, fontWeight: 900, color: tierColor,
          background: `${tierColor}18`,
          padding: "2px 6px", borderRadius: 4, flexShrink: 0,
        }}>{tier.toUpperCase()}</span>
      )}
    </div>
  );
});
