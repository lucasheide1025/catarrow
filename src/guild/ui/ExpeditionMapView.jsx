// src/guild/ui/ExpeditionMapView.jsx
// 單人遠征的安全整備階段：展示本趟路線、隊伍與已預留補給，
// 玩家確認後才進入既有且已驗證的多波戰鬥狀態機。
import { generateExpeditionMapNodes, resolveTier } from "../domain/expeditionGridEvents";
import { sfxClose, sfxTap } from "../../lib/sound";
import { fieldBg, bgLayer, HeroArt, CatArt } from "./GuildArt";

export default function ExpeditionMapView({
  contract,
  expedition,
  supplies = { food: 0, water: 0 },
  partyCats = [],
  journey,
  event,
  onAdvance,
  onAvoid,
  onBack,
  isHost = true,
  waitingLabel = "",
}) {
  const tier = resolveTier(contract);
  const nodes = journey?.nodes || generateExpeditionMapNodes(expedition);
  const nodeIndex = journey?.nodeIndex || 0;
  const currentNode = nodes[nodeIndex];

  return (
    <div
      className="guild-panel-page"
      style={{
        minHeight: "100dvh",
        ...bgLayer(fieldBg(contract?.family), { overlay: "rgba(2,6,23,.82)" }),
        backgroundAttachment: "fixed",
        color: "#e2e8f0",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header style={{ background: "rgba(0,0,0,.46)", border: "1px solid rgba(255,255,255,.1)", padding: 12, borderRadius: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#fbbf24", letterSpacing: 1.2 }}>遠征路線整備</div>
        <div style={{ marginTop: 3, fontSize: 17, fontWeight: 900 }}>{contract?.title || "冒險者委託"}</div>
        <div style={{ marginTop: 3, fontSize: 11, color: "#94a3b8" }}>
          危險度 T{tier}・確認隊伍與補給後進入討伐
        </div>
      </header>

      <section style={{ background: "rgba(0,0,0,.46)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#cbd5e1", marginBottom: 12 }}>🗺️ 本次遠征路線</div>
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: "max-content", padding: "0 4px" }}>
            {nodes.map((node, index) => (
              <div key={node.id} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  width: 74,
                  minHeight: 78,
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  border: index === nodeIndex ? "2px solid #fbbf24" : "1px solid rgba(255,255,255,.14)",
                  background: index === nodeIndex
                    ? "rgba(251,191,36,.2)"
                    : index < nodeIndex ? "rgba(20,83,45,.5)" : "rgba(15,23,42,.78)",
                  opacity: index > nodeIndex ? 0.62 : 1,
                }}>
                  <span style={{ fontSize: 25 }} aria-hidden="true">{index > nodeIndex + 1 ? "🌫️" : node.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 900, color: index === nodeIndex ? "#fde68a" : "#cbd5e1" }}>
                    {index > nodeIndex + 1 ? "尚未探明" : node.label}
                  </span>
                </div>
                {index < nodes.length - 1 ? (
                  <div style={{ width: 20, height: 2, background: "rgba(251,191,36,.35)" }} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {journey?.phase === "event" && event ? (
        <section style={{ padding: 14, borderRadius: 14, background: "rgba(120,53,15,.72)", border: "1px solid rgba(251,191,36,.35)", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#fde68a", fontWeight: 900 }}>🧭 路途中觸發事件</div>
          <div style={{ marginTop: 5, fontSize: 18, fontWeight: 900 }}>{event.label}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#fed7aa" }}>
            {[
              event.food ? `🍖 ${event.food > 0 ? "+" : ""}${event.food}` : "",
              event.water ? `💧 ${event.water > 0 ? "+" : ""}${event.water}` : "",
              event.hp ? `❤️ ${event.hp > 0 ? "+" : ""}${event.hp}` : "",
            ].filter(Boolean).join("　") || "平安通過"}
          </div>
        </section>
      ) : null}

      <section style={{ background: "rgba(0,0,0,.46)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#cbd5e1", marginBottom: 10 }}>🏹 出發隊伍</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, minHeight: 82 }}>
          <HeroArt size={76} />
          {partyCats.map(cat => (
            <CatArt key={cat.id} catId={cat.id} icon={cat.icon} size={46} />
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(20,83,45,.64)", border: "1px solid rgba(134,239,172,.2)", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#bbf7d0", fontWeight: 800 }}>旅行食物</div>
          <div style={{ marginTop: 3, fontSize: 22, color: "#86efac", fontWeight: 900 }}>🍖 {supplies.food}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "rgba(30,64,175,.52)", border: "1px solid rgba(147,197,253,.2)", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#bfdbfe", fontWeight: 800 }}>飲用水</div>
          <div style={{ marginTop: 3, fontSize: 22, color: "#93c5fd", fontWeight: 900 }}>💧 {supplies.water}</div>
        </div>
      </section>

      <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => { sfxClose(); onBack?.(); }}
          style={{ minHeight: 46, flex: 1, borderRadius: 11, border: "1px solid rgba(255,255,255,.12)", background: "#334155", color: "#e2e8f0", fontWeight: 900, cursor: "pointer" }}
        >
          取消遠征
        </button>
        {journey?.phase === "event" && nodes[nodeIndex + 1]?.type === "battle" && nodes[nodeIndex + 1]?.avoidable && (
          <button type="button" disabled={supplies.food < 1 || supplies.water < 1} onClick={() => { sfxTap(); onAvoid?.(); }}
            style={{ minHeight: 46, flex: 1.4, borderRadius: 11, border: "1px solid #60a5fa",
              background: supplies.food < 1 || supplies.water < 1 ? "#475569" : "#1e3a8a", color: "#dbeafe", fontWeight: 900 }}>
            🥾 支付食物、水各 1・避開遭遇
          </button>
        )}
        <button
          type="button"
          disabled={!isHost}
          onClick={() => { sfxTap(); onAdvance?.(); }}
          style={{ minHeight: 46, flex: 2, borderRadius: 11, border: "none", background: isHost ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#475569", color: "#fff", fontWeight: 900, cursor: isHost ? "pointer" : "not-allowed", boxShadow: "0 8px 20px rgba(120,53,15,.35)" }}
        >
          {waitingLabel || (journey?.phase === "event"
            ? "繼續探索下一個地點"
            : currentNode?.type === "battle" || currentNode?.type === "boss"
              ? "往下一個地點"
              : "🚶 開始討伐・前進一格")}
        </button>
      </div>
    </div>
  );
}
