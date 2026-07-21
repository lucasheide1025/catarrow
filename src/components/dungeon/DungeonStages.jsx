// src/components/dungeon/DungeonStages.jsx
// 從 DungeonExpedition.jsx 抽出的共用關卡元件（PlayerStatusBar / GridMapStage / BranchStage）＋房型圖示常數。
// 原因：TeamExpeditionBattle 直接從 DungeonExpedition（一個同時含 default export 與模組級 const 的大型元件檔）
//       匯入 GridMapStage/BranchStage。這種「跨檔匯入大型元件模組的具名匯出」在 production 的 webpack
//       scope hoisting 下會觸發 "Cannot access X before initialization"（TDZ）——dev 正常、prod 才炸。
//       抽成獨立小模組後，DungeonExpedition 與 TeamExpeditionBattle 都從這裡匯入，消除該風險。
//       見第二大腦 memory：共用常數勿放 UI 元件再 re-export（循環／跨檔匯入坑）。
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { GRID_SIZE, isAdjacent } from "../../lib/expeditionGrid";

const TYPE_ICONS = {
  entrance:"🚪", battle:"⚔️", elite_battle:"💀", boss_battle:"👑",
  shop:"🛒", event:"✨", trap:"🪤", chest:"📦", rest:"💤",
  stairs:"🪜", treasure:"🏆",
};

const TYPE_HINTS = {
  entrance:"你的起點，隨時可以回來。",
  battle:"有怪物出沒！",
  elite_battle:"精英怪鎮守此地。",
  boss_battle:"王者的氣息…",
  shop:"行腳商人在此擺攤。",
  event:"神秘的力量在流動。",
  general_event:"遇到幸運奇遇事件！",
  trap:"腳下傳來喀嚓聲…",
  chest:"閃閃發亮的寶箱！",
  rest:"安全的休息點。",
  stairs:"通往更深處的階梯。",
  treasure:"傳說中的寶藏房！",
};

const TYPE_LABELS = {
  entrance: "起點",
  battle: "戰鬥",
  elite_battle: "精英",
  boss_battle: "首領",
  shop: "商店",
  event: "特殊事件",
  general_event: "一般事件",
  trap: "陷阱",
  chest: "寶箱",
  rest: "休息",
  stairs: "階梯",
  treasure: "寶藏"
};

const FAMILY_STYLES = {
  ghost: {
    label: "幽冥系",
    primary: "#a78bfa",
    secondary: "#6366f1",
    fog: "#431407",
    tileTop: "#4c3a6b",
    tileFront: "#372658",
    tileSide: "#2c1f44",
    glow: "rgba(167, 139, 250, 0.6)",
    textColor: "#c084fc",
    details: "skeletal",
    bgGradient: "linear-gradient(160deg,#0f0d1a,#1e173b,#0f0d1a)",
    btnGradient: "linear-gradient(90deg,#a78bfa,#6366f1)",
    panelBg: "rgba(45, 30, 75, 0.4)",
    borderColor: "rgba(167, 139, 250, 0.28)"
  },
  mountain: {
    label: "山嶺系",
    primary: "#10b981",
    secondary: "#047857",
    fog: "#064e3b",
    tileTop: "#1c2e24",
    tileFront: "#101e16",
    tileSide: "#0b150f",
    glow: "rgba(16, 185, 129, 0.45)",
    textColor: "#34d399",
    details: "mossy",
    bgGradient: "linear-gradient(160deg,#030504,#0f1f16,#030504)",
    btnGradient: "linear-gradient(90deg,#10b981,#047857)",
    panelBg: "rgba(20, 35, 25, 0.4)",
    borderColor: "rgba(16, 185, 129, 0.18)"
  },
  insect: {
    label: "昆蟲系",
    primary: "#84cc16",
    secondary: "#65a30d",
    fog: "#3f6212",
    tileTop: "#252d19",
    tileFront: "#161b0f",
    tileSide: "#10140b",
    glow: "rgba(132, 204, 22, 0.45)",
    textColor: "#a3e635",
    details: "organic",
    bgGradient: "linear-gradient(160deg,#040503,#18240f,#040503)",
    btnGradient: "linear-gradient(90deg,#84cc16,#65a30d)",
    panelBg: "rgba(25, 32, 20, 0.4)",
    borderColor: "rgba(132, 204, 22, 0.18)"
  },
  workplace: {
    label: "職場系",
    primary: "#64748b",
    secondary: "#475569",
    fog: "#0f172a",
    tileTop: "#1e293b",
    tileFront: "#0f172a",
    tileSide: "#0b0f19",
    glow: "rgba(100, 116, 139, 0.45)",
    textColor: "#94a3b8",
    details: "office",
    bgGradient: "linear-gradient(160deg,#060910,#142030,#060910)",
    btnGradient: "linear-gradient(90deg,#64748b,#475569)",
    panelBg: "rgba(25, 30, 40, 0.4)",
    borderColor: "rgba(100, 116, 139, 0.18)"
  },
  exam: {
    label: "考試系",
    primary: "#ef4444",
    secondary: "#b91c1c",
    fog: "#450a0a",
    tileTop: "#2c1717",
    tileFront: "#1b0c0c",
    tileSide: "#140808",
    glow: "rgba(239, 68, 68, 0.45)",
    textColor: "#f87171",
    details: "paper",
    bgGradient: "linear-gradient(160deg,#090505,#2c0c0c,#090505)",
    btnGradient: "linear-gradient(90deg,#ef4444,#b91c1c)",
    panelBg: "rgba(35, 20, 20, 0.4)",
    borderColor: "rgba(239, 68, 68, 0.18)"
  },
  temple: {
    label: "神廟系",
    primary: "#eab308",
    secondary: "#ca8a04",
    fog: "#422006",
    tileTop: "#332617",
    tileFront: "#1f160e",
    tileSide: "#16100a",
    glow: "rgba(234, 179, 8, 0.45)",
    textColor: "#facc15",
    details: "ancient",
    bgGradient: "linear-gradient(160deg,#090604,#33220e,#090604)",
    btnGradient: "linear-gradient(90deg,#eab308,#ca8a04)",
    panelBg: "rgba(35, 28, 20, 0.4)",
    borderColor: "rgba(234, 179, 8, 0.18)"
  },
  treasure: {
    label: "寶箱系",
    primary: "#06b6d4",
    secondary: "#0891b2",
    fog: "#083344",
    tileTop: "#182c35",
    tileFront: "#0e1b21",
    tileSide: "#0a1318",
    glow: "rgba(6, 182, 212, 0.45)",
    textColor: "#22d3ee",
    details: "glittering",
    bgGradient: "linear-gradient(160deg,#040810,#0d2535,#040810)",
    btnGradient: "linear-gradient(90deg,#06b6d4,#0891b2)",
    panelBg: "rgba(20, 32, 40, 0.4)",
    borderColor: "rgba(6, 182, 212, 0.18)"
  }
};

// ── 2.5D 立繪地圖共用常數與元件 ─────────────────────────────
// 立體感全靠預渲染立繪的透視；程式只負責「貼到 2D 網格 + 列間重疊 + 依列 z-index」。
const TILE_W = 84;
const TILE_H = 84;
// 等角(iso)排列的半寬/半高：相鄰格沿菱形對角錯位 → 前後交疊產生 2.5D 景深。
// HALF 需大於平台半footprint 才有空隙（否則平台會重疊成一坨）。
const HALF_W = 78;
const HALF_H = 45;
const ASSET_BASE = "/assets/dungeon";
const EMPTY_SRC = `${ASSET_BASE}/room_empty.webp`;

// 單一房間立繪：iso 座標定位(x,y,z)。只顯示立繪；迷霧=黑掉+問號；當前房=玩家釘。
// 已拿掉：綠色可移動框、金色邊框、家族 tint 底色、✓ 標記。
function RoomTile({ room, x, y, z, isCurrent, clickable, fog, onClick, muted = false, family }) {
  const chain = useMemo(() => (
    fog
      ? [EMPTY_SRC]
      : [
          family && `${ASSET_BASE}/room_${family}_${room.type}.webp`,
          `${ASSET_BASE}/room_${room.type}.webp`,
          EMPTY_SRC,
        ].filter(Boolean)
  ), [fog, family, room.type]);
  const [idx, setIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setIdx(0); setImgFailed(false); }, [chain]);
  const imgSrc = chain[Math.min(idx, chain.length - 1)];

  const handleError = () => {
    if (idx < chain.length - 1) setIdx(idx + 1);
    else setImgFailed(true);
  };

  return (
    <div
      onClick={() => clickable && onClick(room)}
      style={{
        position:"absolute", left: x, top: y, width: TILE_W, height: TILE_H,
        zIndex: z * 10 + (isCurrent ? 5 : 0),
        cursor: clickable ? "pointer" : "default",
        opacity: muted ? 0.35 : 1,
        transition:"opacity 0.3s",
      }}
    >
      {!imgFailed ? (
        <img src={imgSrc} alt={room.label || room.type} draggable={false} onError={handleError}
          style={{
            width:"100%", height:"100%", objectFit:"contain",
            filter: fog ? "brightness(0.2)" : "none",   // 迷霧：黑掉
            userSelect:"none", pointerEvents:"none",
          }} />
      ) : (
        <div style={{
          position:"absolute", inset:"20% 14%",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:34,
          filter: fog ? "brightness(0.35)" : "none",
        }}>
          {fog ? "" : (TYPE_ICONS[room.type] || "❔")}
        </div>
      )}

      {/* 迷霧「?」 */}
      {fog && (
        <div style={{
          position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:30, fontWeight:900, color:"rgba(220,210,255,0.9)",
          textShadow:"0 0 6px #000", pointerEvents:"none",
        }}>?</div>
      )}

      {/* 當前房：玩家 LOGO 標記（小） */}
      {isCurrent && (
        <img src={`${ASSET_BASE}/player_logo.webp`} alt="你在這"
          style={{
            position:"absolute", left:"50%", top:"-8%", transform:"translateX(-50%)",
            width:34, height:"auto",
            animation:"pin-float 2s ease-in-out infinite", pointerEvents:"none",
            filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.7))",
          }} />
      )}
    </div>
  );
}

// 鏡頭視窗：overflow:hidden 視窗 + 可平移 world 層；focus(世界 px) 對齊視窗中心（自動跟隨）
function MapViewport({ worldW, worldH, focusX, focusY, height = 380, fit = false, family = "ghost", children }) {
  const ref = useRef(null);
  const [vw, setVw] = useState(0);
  useEffect(() => {
    const measure = () => setVw(ref.current?.offsetWidth || 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // 中央可動面板：2.5D 內容夾在裡面、超出即裁切（不會突破背景）
  const panelW = vw > 0 ? vw * 0.92 : 0;
  const panelH = height * 0.9;

  // fit=true：縮放使整張世界塞進面板（分支選路用）；否則 1:1 跟隨 focus
  const scale = fit && panelW > 0 ? Math.min((panelW - 16) / worldW, (panelH - 16) / worldH, 1) : 1;
  const fx = fit ? worldW / 2 : focusX;
  const fy = fit ? worldH / 2 : focusY;
  const camX = panelW / 2 - fx * scale;
  const camY = panelH / 2 - fy * scale;

  return (
    <div ref={ref} style={{ position:"relative", width:"100%", height, overflow:"hidden" }}>
      {/* 背景層（固定，不隨鏡頭移動；缺圖則透出父層漸層） */}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:`url(${ASSET_BASE}/map_bg_${family || "ghost"}.webp), url(${ASSET_BASE}/map_bg.webp)`,
        backgroundSize:"cover", backgroundPosition:"center", opacity:0.9,
      }} />
      {/* 中央可動面板：夾住 2.5D 內容（overflow 裁切）+ 深色底把地圖區跟背景區隔 */}
      <div style={{
        position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)",
        width: panelW || "92%", height: panelH, borderRadius:28, overflow:"hidden",
        background:"rgba(6,8,16,0.5)", boxShadow:"inset 0 0 60px 20px rgba(6,8,16,0.5)",
      }}>
        {/* 世界層（鏡頭平移 + 縮放） */}
        <div style={{
          position:"absolute", left:0, top:0, width: worldW, height: worldH,
          transform:`translate(${camX}px, ${camY}px) scale(${scale})`, transformOrigin:"0 0",
          transition:"transform 380ms cubic-bezier(0.25,0.46,0.45,0.94)", willChange:"transform",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── 頂部玩家狀態列（HP / 金幣 / buff）───────────────────
function PlayerStatusBar({ playerState, coins, lootMult = 1 }) {
  const hp = playerState?.hp ?? 0;
  const maxHP = playerState?.maxHP || 1;
  const pct = Math.max(0, Math.min(1, hp / maxHP));
  const buffs = playerState?.buffs || {};
  const badges = [];
  if ((buffs.atkMult || 1) !== 1) badges.push({ t:`⚔️×${buffs.atkMult}`, up:(buffs.atkMult||1) > 1 });
  if ((buffs.defMult || 1) !== 1) badges.push({ t:`🛡️×${buffs.defMult}`, up:(buffs.defMult||1) > 1 });
  if ((buffs.dmgMult || 1) !== 1) badges.push({ t:`💥×${buffs.dmgMult}`, up:(buffs.dmgMult||1) > 1 });
  if (buffs.hasRevival) badges.push({ t:"💫復活", up:true });

  return (
    <div style={{ padding:"8px 14px 6px", background:"rgba(0,0,0,0.3)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${pct * 100}%`, transition:"width 0.4s ease",
              background: pct > 0.5 ? "#16a34a" : pct > 0.25 ? "#d97706" : "#dc2626",
            }}/>
          </div>
          <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>
            ❤️ {hp}/{maxHP}
            {badges.map((b, i) => (
              <span key={i} style={{ marginLeft:6, color: b.up ? "#4ade80" : "#f87171", fontWeight:700 }}>{b.t}</span>
            ))}
          </div>
        </div>
        {/* 本圖寶箱倍率（出圖時擲定,整場固定）——收進狀態列，不再用浮動角標 */}
        {lootMult > 1 && (
          <div style={{ flexShrink:0, padding:"3px 8px", borderRadius:999, fontSize:10, fontWeight:900,
            background:"rgba(120,53,15,.92)", border:"1px solid #fbbf24", color:"#fcd34d" }}>
            🎲 寶箱 ×{lootMult}
          </div>
        )}
        <div style={{ flexShrink:0, fontSize:12, fontWeight:900, color:"#fbbf24" }}>
          💰 {coins.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ── 立繪版格子地圖（等角 2.5D + 鏡頭跟隨）─────────────────
function DungeonMapView({ rooms, playerPos, visitedIds, onCellClick, canControl, locked, family, isVisitedPos }) {
  const theme = FAMILY_STYLES[family] || FAMILY_STYLES.ghost;
  const ISO_OX = (GRID_SIZE - 1) * HALF_W;                 // 位移使負 x 進正
  const worldW = (GRID_SIZE - 1) * 2 * HALF_W + TILE_W;
  const worldH = (GRID_SIZE - 1) * 2 * HALF_H + TILE_H;

  const isoXY = (col, row) => ({ x: (col - row) * HALF_W + ISO_OX, y: (col + row) * HALF_H });
  const cellCenter = (col, row) => {
    const p = isoXY(col, row);
    return { cx: p.x + TILE_W / 2, cy: p.y + TILE_H * 0.5 };
  };
  const focus = playerPos ? cellCenter(playerPos.x, playerPos.y) : cellCenter(2, 2);

  // 路：從已探索房間連到四方相鄰房間（含還沒走的迷霧房 → 讓玩家看到可走路線）
  const roomByPos = {};
  rooms.forEach(r => { roomByPos[`${r.pos.x},${r.pos.y}`] = r; });
  const seen = new Set();
  const bridges = [];
  rooms.forEach(room => {
    if (!visitedIds.has(room.id)) return;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nb = roomByPos[`${room.pos.x + dx},${room.pos.y + dy}`];
      if (!nb) return;
      const key = [room.id, nb.id].sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      bridges.push({ id: key, a: room.pos, b: nb.pos, full: visitedIds.has(nb.id) });
    });
  });

  return (
    <MapViewport worldW={worldW} worldH={worldH} focusX={focus.cx} focusY={focus.cy} height={380} family={family}>
      {/* 橋（立繪之下） */}
      <svg width={worldW} height={worldH} style={{ position:"absolute", left:0, top:0, pointerEvents:"none" }}>
        {bridges.map(b => {
          const p = cellCenter(b.a.x, b.a.y);
          const q = cellCenter(b.b.x, b.b.y);
          return (
            <g key={b.id}>
              <line x1={p.cx} y1={p.cy + 3} x2={q.cx} y2={q.cy + 3} stroke="rgba(0,0,0,0.4)" strokeWidth={8} strokeLinecap="round" />
              <line x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} stroke={theme.tileSide} strokeWidth={7} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {/* 房間立繪 */}
      {rooms.map(room => {
        const visited = visitedIds.has(room.id);
        const fog = !visited && [
          [room.pos.x + 1, room.pos.y], [room.pos.x - 1, room.pos.y],
          [room.pos.x, room.pos.y + 1], [room.pos.x, room.pos.y - 1],
        ].some(([nx, ny]) => isVisitedPos(nx, ny));
        if (!visited && !fog) return null;
        const isCurrent = playerPos && room.pos.x === playerPos.x && room.pos.y === playerPos.y;
        // 站在未清除事件房(locked) → 鎖移動，必須先點「進入事件」
        const clickable = canControl && !locked && isAdjacent(room.pos, playerPos);
        const p = isoXY(room.pos.x, room.pos.y);
        return (
          <RoomTile key={room.id} room={room} x={p.x} y={p.y} z={room.pos.x + room.pos.y}
            family={family} isCurrent={isCurrent} clickable={clickable} fog={fog} onClick={onCellClick} />
        );
      })}
    </MapViewport>
  );
}

// ── 第 1、2 層：5×5 迷霧格子地圖 ────────────────────────
export function GridMapStage({
  gridFloor, playerPos, visitedIds, floorIndex,
  playerState, coins, lootMult, onCellClick, onEnterRoom, onDescend, onRetreat,
  canControl = true,
  difficulty = 1,
  family = "ghost",
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  const theme = FAMILY_STYLES[family] || FAMILY_STYLES.ghost;


  const rooms = gridFloor?.rooms || [];
  const roomByPos = useMemo(() => {
    const m = {};
    rooms.forEach(r => { m[`${r.pos.x},${r.pos.y}`] = r; });
    return m;
  }, [rooms]);

  const isVisitedPos = useCallback((x, y) => {
    const r = roomByPos[`${x},${y}`];
    return !!r && visitedIds.has(r.id);
  }, [roomByPos, visitedIds]);

  const standingRoom = playerPos ? roomByPos[`${playerPos.x},${playerPos.y}`] : null;
  const showStairs = standingRoom?.type === "stairs" && !standingRoom.cleared;
  // 兩段式：站上未清除房間（非入口/樓梯）→ 顯示「進入」按鈕，再按才觸發事件
  const canEnter = !!standingRoom && !standingRoom.cleared
    && standingRoom.type !== "stairs" && standingRoom.type !== "entrance";
  const enterLabel =
    ["battle", "elite_battle", "boss_battle"].includes(standingRoom?.type) ? "⚔️ 進入戰鬥"
    : standingRoom?.type === "treasure" ? "🏆 進入寶藏房"
    : standingRoom?.type === "chest" ? "📦 開啟寶箱"
    : standingRoom?.type === "shop" ? "🛒 進入商店"
    : standingRoom?.type === "rest" ? "💤 進入休息區"
    : (standingRoom?.type === "event" || standingRoom?.type === "general_event") ? "✨ 進入事件"
    : standingRoom?.type === "trap" ? "⚠️ 進入"
    : "🚪 進入房間";

  return (
    <div style={{
      minHeight:"100%",
      background: FAMILY_STYLES[family]?.bgGradient || "linear-gradient(160deg,#0f0d1a,#1e173b,#0f0d1a)",
      color:"white", display:"flex", flexDirection:"column",
    }}>
      <style>{`
@keyframes gm-pulse{0%,100%{opacity:0.2}50%{opacity:0.85}}
@keyframes gm-fade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
@keyframes pin-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
@keyframes fog-breath{0%,100%{opacity:0.65;}50%{opacity:0.45;}}
      `}</style>

      {/* Header */}
      <div style={{
        padding:"12px 14px 8px", display:"flex", alignItems:"center", gap:8,
        borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(0,0,0,0.25)",
      }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#fbbf24", display:"flex", alignItems:"center", gap:6 }}>
            <span>🗺️ {FAMILY_STYLES[family]?.label || "幽冥系"} T{difficulty}</span>
            <span style={{ fontSize:11, padding:"2px 6px", borderRadius:4, background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.6)", fontWeight:700 }}>
              第 {floorIndex + 1} 層
            </span>
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
            點擊相鄰格子移動 · 走過的房間可自由通行
          </div>
        </div>
        <button onClick={() => setConfirmExit(true)}
          style={{
            flexShrink:0, padding:"6px 12px", borderRadius:10, fontSize:11, fontWeight:700,
            background:"rgba(239,68,68,0.12)", color:"#f87171",
            border:"1px solid rgba(239,68,68,0.3)", cursor:"pointer",
          }}>
          🏳️ 撤退
        </button>
      </div>

      <PlayerStatusBar playerState={playerState} coins={coins} lootMult={lootMult} />

      {/* Map */}
        <div style={{ padding:"10px 0" }}>
          <DungeonMapView
            rooms={rooms}
            playerPos={playerPos}
            visitedIds={visitedIds}
            onCellClick={onCellClick}
            canControl={canControl}
            locked={canEnter && !!onEnterRoom}
            family={family}
            isVisitedPos={isVisitedPos}
          />
        </div>

      {/* 底部：目前房間資訊 / 樓梯面板 */}
      <div style={{
        padding:"10px 14px calc(7rem + env(safe-area-inset-bottom))", borderTop:"1px solid rgba(255,255,255,0.07)",
        background:"rgba(0,0,0,0.32)", animation:"gm-fade 0.3s ease",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: showStairs ? 10 : 0 }}>
          <div style={{
            width:44, height:44, borderRadius:12, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", fontSize:22,
          }}>
            {TYPE_ICONS[standingRoom?.type] || "🗺️"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:14 }}>{standingRoom?.label || "探索中"}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:2 }}>
              {showStairs ? "階梯就在腳下，要下去嗎？"
                : canEnter ? (TYPE_HINTS[standingRoom?.type] || "站在此房間，按下方進入。")
                : TYPE_HINTS[standingRoom?.type] || "點擊相鄰房間移動。"}
            </div>
          </div>
        </div>
        {showStairs && canControl && (
          <button onClick={onDescend}
            style={{
              width:"100%", padding:"13px 0", borderRadius:14, border:"none",
              fontWeight:900, fontSize:15, cursor:"pointer",
              background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white",
            }}>
            🪜 前往第 {floorIndex + 2} 層
          </button>
        )}
        {canEnter && canControl && onEnterRoom && (
          <button onClick={() => onEnterRoom?.(standingRoom)}
            style={{
              width:"100%", padding:"13px 0", borderRadius:14, border:"none",
              fontWeight:900, fontSize:15, cursor:"pointer",
              background: theme.btnGradient, color:"white", boxShadow:`0 4px 12px ${theme.primary}40`,
            }}>
            {enterLabel}
          </button>
        )}
        {!canControl && (
          <div style={{ textAlign:"center", fontSize:12, color:"#94a3b8", padding:"10px 0 2px" }}>
            等待隊長選擇前進路線…
          </div>
        )}
      </div>

      {/* 撤退確認 */}
      {confirmExit && (
        <div style={{
          position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}>
          <div style={{
            width:"100%", maxWidth:300, borderRadius:20, padding:"22px 18px",
            background:"#12111f", border:"1px solid rgba(255,255,255,0.1)", textAlign:"center",
          }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🏳️</div>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:6 }}>要撤退嗎？</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16, lineHeight:1.6 }}>
              撤退不會獲得遠征結算獎勵，<br />已領取的金幣與寶物會保留。
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmExit(false)}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"rgba(255,255,255,0.08)", color:"#e2e8f0", cursor:"pointer" }}>
                繼續探索
              </button>
              <button onClick={onRetreat}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"#dc2626", color:"white", cursor:"pointer" }}>
                確定撤退
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 第 3 層立繪版分支地圖（三條並排可見 + 單向 + 鏡頭跟隨）────
const BRANCH_COL = { A: 0, B: 1, C: 2 };

function DungeonBranchView({ branchFloor, branchChoice, branchSeq, branchStep, canControl, family, onChoose }) {
  const theme = FAMILY_STYLES[family] || FAMILY_STYLES.ghost;
  const ISO_OX = 5 * HALF_W;
  const worldW = 6 * HALF_W + TILE_W;
  const worldH = 7 * HALF_H + TILE_H;
  const isoXY = (col, row) => ({ x: (col - row) * HALF_W + ISO_OX, y: (col + row) * HALF_H });
  const cc = (col, row) => { const p = isoXY(col, row); return { cx: p.x + TILE_W / 2, cy: p.y + TILE_H * 0.5 }; };
  const chosen = branchChoice;
  const seq = branchSeq || [];

  const ENTR = { col: 1, row: 0 }, BOSS = { col: 1, row: 5 }, TRE = { col: 1, row: 6 };
  const curType = chosen ? seq[branchStep]?.type : "entrance";

  let curPos = ENTR;
  if (chosen) {
    if (curType === "boss_battle") curPos = BOSS;
    else if (curType === "treasure") curPos = TRE;
    else curPos = { col: BRANCH_COL[chosen], row: branchStep + 1 };
  }
  const isAt = (p) => curPos.col === p.col && curPos.row === p.row;

  // 連接線（entrance→各支線→boss→treasure）
  const links = [];
  ["A", "B", "C"].forEach(k => {
    const col = BRANCH_COL[k];
    links.push([ENTR, { col, row: 1 }, k]);
    for (let i = 1; i <= 3; i++) links.push([{ col, row: i }, { col, row: i + 1 }, k]);
    links.push([{ col, row: 4 }, BOSS, k]);
  });
  links.push([BOSS, TRE, null]);

  const focus = cc(curPos.col, curPos.row);

  return (
    <MapViewport worldW={worldW} worldH={worldH} focusX={focus.cx} focusY={focus.cy} fit={!chosen} height={380} family={family}>
      {/* 連接線 */}
      <svg width={worldW} height={worldH} style={{ position:"absolute", left:0, top:0, pointerEvents:"none" }}>
        {links.map(([a, b, k], i) => {
          const p = cc(a.col, a.row), q = cc(b.col, b.row);
          const muted = chosen && k && k !== chosen;
          const active = chosen && k === chosen;
          return (
            <g key={i} opacity={muted ? 0.18 : 0.7}>
              <line x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} stroke={theme.tileSide} strokeWidth={8} strokeLinecap="round" />
              <line x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} stroke={theme.primary} strokeWidth={2.5} strokeLinecap="round"
                opacity={0.6} strokeDasharray={active ? "none" : "4 5"} />
            </g>
          );
        })}
      </svg>

      {/* 入口 */}
      <RoomTile room={branchFloor.entrance} x={isoXY(ENTR.col, ENTR.row).x} y={isoXY(ENTR.col, ENTR.row).y} z={ENTR.col + ENTR.row} family={family}
        isCurrent={isAt(ENTR)} clickable={false} fog={false} onClick={() => {}} />

      {/* 三條支線 */}
      {["A", "B", "C"].map(k => {
        const col = BRANCH_COL[k];
        const b = branchFloor.branches[k];
        const muted = chosen && k !== chosen;
        return b.rooms.map((room0, idx) => {
          const row = idx + 1;
          let visited = false, fog = true, isCur = false, cleared = false, clickable = false;
          let room = room0;
          if (!chosen) {
            clickable = canControl;          // 選路：三條皆可點
          } else if (k === chosen) {
            room = seq[idx] || room0;
            if (idx < branchStep) { visited = true; fog = false; cleared = true; }
            else if (idx === branchStep) { visited = true; fog = false; isCur = true; }
          }
          const p = isoXY(col, row);
          return (
            <RoomTile key={`${k}${idx}`} room={{ ...room, cleared }} x={p.x} y={p.y} z={col + row} family={family}
              isCurrent={isCur} clickable={clickable} fog={fog} muted={muted}
              onClick={() => !chosen && canControl && onChoose(k)} />
          );
        });
      })}

      {/* Boss / 寶藏（抵達才亮） */}
      <RoomTile room={branchFloor.boss} x={isoXY(BOSS.col, BOSS.row).x} y={isoXY(BOSS.col, BOSS.row).y} z={BOSS.col + BOSS.row} family={family}
        isCurrent={isAt(BOSS)} clickable={false} fog={!isAt(BOSS)} onClick={() => {}} />
      <RoomTile room={branchFloor.treasure} x={isoXY(TRE.col, TRE.row).x} y={isoXY(TRE.col, TRE.row).y} z={TRE.col + TRE.row} family={family}
        isCurrent={isAt(TRE)} clickable={false} fog={!isAt(TRE)} onClick={() => {}} />
    </MapViewport>
  );
}

// ── 第 3 層：A/B/C 分支王關 ─────────────────────────────
export function BranchStage({
  branchFloor, branchChoice, branchSeq, branchStep,
  playerState, coins, lootMult, onChoose, onEnterNext, onRetreat,
  canControl = true,
  difficulty = 1,
  family = "ghost",
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  const theme = FAMILY_STYLES[family] || FAMILY_STYLES.ghost;

  return (
    <div style={{
      minHeight:"100%",
      background: theme.bgGradient,
      color:"white", display:"flex", flexDirection:"column",
    }}>
      <style>{`
@keyframes bs-fade{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
@keyframes bs-glow{0%,100%{box-shadow:0 0 10px rgba(251,191,36,0.15)}50%{box-shadow:0 0 24px rgba(251,191,36,0.4)}}
      `}</style>

      <div style={{
        padding:"12px 14px 8px", display:"flex", alignItems:"center", gap:8,
        borderBottom: `1px solid ${theme.borderColor}`, background:"rgba(0,0,0,0.25)",
      }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:16, color: theme.textColor, display:"flex", alignItems:"center", gap:6 }}>
            <span>👑 {theme.label} T{difficulty}</span>
            <span style={{ fontSize:11, padding:"2px 6px", borderRadius:4, background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.6)", fontWeight:700 }}>
              第 3 層 · 王關
            </span>
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
            {branchChoice ? `已選 ${branchFloor.branches[branchChoice].icon} ${branchFloor.branches[branchChoice].label}` : "三條岔路，選定後無法回頭"}
          </div>
        </div>
        <button onClick={() => setConfirmExit(true)}
          style={{
            flexShrink:0, padding:"6px 12px", borderRadius:10, fontSize:11, fontWeight:700,
            background:"rgba(239,68,68,0.12)", color:"#f87171",
            border:"1px solid rgba(239,68,68,0.3)", cursor:"pointer",
          }}>
          🏳️ 撤退
        </button>
      </div>

      <PlayerStatusBar playerState={playerState} coins={coins} lootMult={lootMult} />

      {/* 2.5D 分支地圖（三條並排可見） */}
      <div style={{ padding:"8px 0 0" }}>
        <DungeonBranchView
          branchFloor={branchFloor}
          branchChoice={branchChoice}
          branchSeq={branchSeq}
          branchStep={branchStep}
          canControl={canControl}
          family={family}
          onChoose={onChoose}
        />
      </div>

      {/* 行動列 */}
      <div style={{ padding:"12px 16px calc(7rem + env(safe-area-inset-bottom))" }}>
        {!branchChoice ? (
          <div style={{ textAlign:"center", fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
            {canControl ? "👆 點選一條岔路前進（選定後無法回頭）" : "等待隊長選擇路線…"}
          </div>
        ) : (
          <button onClick={onEnterNext} disabled={!canControl}
            style={{
              width:"100%", padding:"14px 0", borderRadius:16, border:"none",
              fontWeight:900, fontSize:15, cursor: canControl ? "pointer" : "default", opacity: canControl ? 1 : 0.6,
              background: theme.btnGradient, color:"white", boxShadow:`0 4px 12px ${theme.primary}40`,
            }}>
            {!canControl ? "等待隊長前進…"
              : branchSeq[branchStep]?.type === "boss_battle" ? "⚔️ 挑戰 Boss！"
              : branchSeq[branchStep]?.type === "treasure" ? "🏆 進入寶藏房！"
              : "🚪 進入下一間房"}
          </button>
        )}
      </div>

      {confirmExit && (
        <div style={{
          position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}>
          <div style={{
            width:"100%", maxWidth:300, borderRadius:20, padding:"22px 18px",
            background:"#12111f", border:"1px solid rgba(255,255,255,0.1)", textAlign:"center",
          }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🏳️</div>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:6 }}>要撤退嗎？</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16, lineHeight:1.6 }}>
              撤退不會獲得遠征結算獎勵。
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmExit(false)}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"rgba(255,255,255,0.08)", color:"#e2e8f0", cursor:"pointer" }}>
                繼續
              </button>
              <button onClick={onRetreat}
                style={{ flex:1, padding:"11px 0", borderRadius:12, border:"none", fontWeight:800,
                  background:"#dc2626", color:"white", cursor:"pointer" }}>
                確定撤退
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
