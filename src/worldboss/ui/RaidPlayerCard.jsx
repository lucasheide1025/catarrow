// src/worldboss/ui/RaidPlayerCard.jsx
// 玩家狀態列。原本的討伐版式漏了這一塊——玩家看不到自己的 HP、也看不到貓貓在不在。
// 計分覆蓋層打開時會整條收起來（手機畫面塞不下靶面＋狀態列）。
import { rookieBadge } from "../domain/raidRookie";
import { WB_FRAME } from "../domain/raidCards";

// ⚠️ 左邊原本有一張小立繪，2026-07-31 拿掉：
//    王的正下方已經有小隊站位（含「我」的立繪），這裡再放一張是重複的，
//    而且吃掉的寬度讓三維與加成被擠到換行。
export default function RaidPlayerCard({
  name = "射手",
  hp = 0, maxHp = 1,
  atk = 0, def = 0,
  archerLevel = 1,
  cats = [],
  compact = false,
  wbCard = false,
  wbCardCount = 0,
  baseStats = null,      // 有組隊加成時傳原始值，顯示「100 → 130」
  teamLabel = "",
}) {
  const pct = Math.max(0, Math.min(100, (hp / (maxHp || 1)) * 100));
  const rookie = rookieBadge(archerLevel);
  const danger = pct <= 30;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      background: "rgba(2,6,23,.82)", border: "1px solid rgba(255,255,255,.09)",
      borderRadius: 12, padding: compact ? "6px 9px" : "8px 11px",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </span>
          <span style={{ fontSize: 9.5, color: "#94a3b8", whiteSpace: "nowrap" }}>Lv.{archerLevel}</span>
          {wbCard && (
            <span title={WB_FRAME.label}
              style={{
                fontSize: 9, fontWeight: 900, color: "#78350f", whiteSpace: "nowrap",
                borderRadius: 5, padding: "1px 5px",
                background: "linear-gradient(120deg,#f59e0b,#fde68a,#f59e0b)",
                boxShadow: `0 0 6px ${WB_FRAME.glow}`,
              }}>
              {WB_FRAME.icon} 王卡{wbCardCount > 1 ? `×${wbCardCount}` : ""}
            </span>
          )}
          {rookie && (
            <span style={{
              fontSize: 9, fontWeight: 900, color: rookie.color,
              border: `1px solid ${rookie.color}`, borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap",
            }} title={rookie.text}>
              {rookie.icon} ×{rookie.mult.toFixed(2)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <div style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(255,255,255,.09)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`, transition: "width .35s",
              background: danger ? "linear-gradient(90deg,#dc2626,#f87171)" : "linear-gradient(90deg,#16a34a,#4ade80)",
            }} />
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 900, color: danger ? "#fca5a5" : "#94a3b8", whiteSpace: "nowrap" }}>
            {Math.max(0, Math.round(hp))}/{Math.round(maxHp)}
          </span>
        </div>

        <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2 }}>
            ⚔️{baseStats && baseStats.atk !== atk
              ? <><s style={{ opacity: .5 }}>{baseStats.atk}</s> <b style={{ color: "#4ade80" }}>{atk}</b></>
              : atk}
            　🛡️{baseStats && baseStats.def !== def
              ? <><s style={{ opacity: .5 }}>{baseStats.def}</s> <b style={{ color: "#4ade80" }}>{def}</b></>
              : def}
        </div>
        {teamLabel && (
          <div style={{
            fontSize: 8.5, color: "#4ade80", fontWeight: 900, marginTop: 1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>🤝 {teamLabel}</div>
        )}
      </div>

      {/* 貓貓陪練：牠們每回合會自己咬一口 */}
      <div style={{ display: "flex", gap: 4, flex: "0 0 auto" }}>
        {cats.length === 0 && (
          <span style={{ fontSize: 9.5, color: "#475569" }}>沒帶貓</span>
        )}
        {cats.map(cat => (
          <div key={cat.catId} title={`${cat.name}　⚔️${cat.atk}`} style={{ textAlign: "center" }}>
            <img
              src={`/cats/portraits/${cat.catId}.webp`} alt={cat.name}
              onError={e => { e.currentTarget.src = "/cats/archers/baobao.webp"; }}
              style={{
                width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: "50%",
                objectFit: "cover", border: "1.5px solid #fbbf24",
              }}
            />
            <div style={{ fontSize: 8, color: "#fbbf24", fontWeight: 900 }}>⚔️{cat.atk}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
