// src/guild/ui/GuildTeamLobby.jsx
// 組隊遠征的等待室：開房／輸入房號加入／各自備包 → 房主出發。
//
// 設計取捨：不再做一套完整的備包畫面（單人版 GuildLoadout 已經有了）。這裡只讓成員調
// 食物/水，其餘（六維、貓、箭數）**直接沿用他自己的存檔**——組隊時最重要的是「快速上線」，
// 沒有人想在等別人的時候還被逼著重新配裝。
import { useEffect, useState } from "react";
import { MAX_TEAM_SIZE } from "../domain/teamExpeditionFlow";
import { STAT_META } from "../domain/guildStats";
import { sfxTap, sfxOpen, sfxClose, sfxError, sfxSwitch } from "../../lib/sound";
import { hallBg, bgLayer, CatArt, HeroArt } from "./GuildArt";

const card = { background: "rgba(0,0,0,.34)", borderRadius: 12, padding: 12 };
const btn = (bg, extra = {}) => ({
  padding: "9px 14px", borderRadius: 10, border: "none", background: bg,
  color: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer", ...extra,
});

export default function GuildTeamLobby({
  room, myId, isHost, contract, stats, partyCats, arrowsPerRound,
  onCreate, onJoin, onReady, onUnready, onDepart, onLeave, onClose, busy,
}) {
  const [code, setCode] = useState("");
  const [food, setFood] = useState(6);
  const [water, setWater] = useState(6);
  const [msg, setMsg] = useState("");

  const members = room?.members || {};
  const ids = Object.keys(members);
  const meReady = !!members[myId]?.ready;
  const allReady = ids.length > 0 && ids.every(id => members[id]?.ready);

  useEffect(() => { setMsg(""); }, [room?.id]);

  const act = async (fn, okMsg) => {
    const res = await fn();
    if (res?.ok === false) { sfxError(); setMsg(`⚠️ ${res.reason || "操作失敗"}`); return; }
    sfxTap();
    if (okMsg) setMsg(okMsg);
  };

  // ── 還沒進房：開房 or 加入 ────────────────────────────────
  if (!room) {
    return (
      <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.78)" }), color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🤝 組隊遠征</div>
          <button type="button" onClick={() => { sfxClose(); onClose(); }} style={btn("#334155")}>返回</button>
        </div>

        <div style={{ ...card, display: "flex", gap: 10, alignItems: "center" }}>
          <HeroArt size={72} style={{ flexShrink: 0, filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))" }} />
          <div style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.7 }}>
            最多 <b style={{ color: "#fbbf24" }}>{MAX_TEAM_SIZE}</b> 人一起打同一張委託。<br />
            怪物血量會隨人數提高，但**加得比人數少**——組隊是為了打得更快，不是更難。<br />
            <span style={{ color: "#94a3b8" }}>獎勵每人各自結算（用自己的命中率與幸運），委託額度只算房主那張。</span>
          </div>
        </div>

        {contract ? (
          <div style={{ ...card }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>你要帶去的委託</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fde68a" }}>📜 {contract.title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {contract.skulls} {contract.familyIcon}{contract.familyLabel}・{contract.waves} 波
            </div>
            <button type="button" disabled={busy} onClick={() => act(onCreate)} style={{ ...btn("linear-gradient(135deg,#f59e0b,#b45309)"), marginTop: 10, width: "100%" }}>
              {busy ? "開房中…" : "🏕️ 用這張委託開房"}
            </button>
          </div>
        ) : (
          <div style={{ ...card, fontSize: 11.5, color: "#94a3b8" }}>
            要開房的話，先從委託板點一張委託 →「組隊出發」。你也可以直接用下面的房號加入別人。
          </div>
        )}

        <div style={{ ...card }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>加入隊友的房間</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="房號 6 碼" maxLength={6}
              style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.4)", color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 3, textAlign: "center" }} />
            <button type="button" disabled={busy || code.length < 4} onClick={() => act(() => onJoin(code))}
              style={btn(code.length < 4 ? "#475569" : "linear-gradient(135deg,#22c55e,#15803d)", { cursor: code.length < 4 ? "not-allowed" : "pointer" })}>
              加入
            </button>
          </div>
        </div>

        {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}
      </div>
    );
  }

  // ── 已在房內：等待室 ──────────────────────────────────────
  const roomContract = room.contract || contract;
  return (
    <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.78)" }), color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#fbbf24" }}>🤝 小隊等待室</div>
        <button type="button" onClick={() => { sfxClose(); onLeave(); }} style={btn("#7f1d1d")}>離開房間</button>
      </div>

      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 10.5, color: "#94a3b8" }}>房號（報給隊友）</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#fcd34d", letterSpacing: 8 }}>{room.code}</div>
      </div>

      {roomContract && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fde68a" }}>📜 {roomContract.title}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {roomContract.skulls} {roomContract.familyIcon}{roomContract.familyLabel}・{roomContract.waves} 波
            　<span style={{ color: "#fca5a5" }}>怪物血量 ×{(1 + 0.6 * (ids.length - 1)).toFixed(2)}（{ids.length} 人）</span>
          </div>
        </div>
      )}

      {/* 我的備包：只調食物/水，其餘沿用自己的存檔 */}
      <div style={{ ...card }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>🎒 我的準備</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
          {Object.keys(STAT_META).map(k => `${STAT_META[k].icon}${stats[k]}`).join(" ")}　🏹{arrowsPerRound}箭/回合
        </div>
        {[["🍖 食物", food, setFood], ["💧 水", water, setWater]].map(([label, val, set]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, width: 62 }}>{label}</span>
            <button type="button" disabled={meReady} onClick={() => { sfxSwitch(); set(v => Math.max(1, v - 1)); }} style={btn("#334155", { padding: "3px 10px" })}>−</button>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#fcd34d", minWidth: 24, textAlign: "center" }}>{val}</span>
            <button type="button" disabled={meReady} onClick={() => { sfxSwitch(); set(v => Math.min(12, v + 1)); }} style={btn("#334155", { padding: "3px 10px" })}>＋</button>
          </div>
        ))}
        {partyCats.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>出戰貓</span>
            {partyCats.map(c => <CatArt key={c.id} catId={c.id} icon={c.icon} size={26} />)}
          </div>
        )}
        <button type="button" disabled={busy}
          onClick={() => act(() => (meReady ? onUnready() : onReady({ food, water })))}
          style={{ ...btn(meReady ? "#334155" : "linear-gradient(135deg,#22c55e,#15803d)"), marginTop: 10, width: "100%" }}>
          {meReady ? "↩ 取消準備" : "✅ 準備完成"}
        </button>
      </div>

      {/* 隊員列表 */}
      <div style={{ ...card }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
          小隊 {ids.length}/{MAX_TEAM_SIZE}
        </div>
        {ids.map(id => {
          const m = members[id];
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <span style={{ fontSize: 12, flex: 1, minWidth: 0, fontWeight: id === myId ? 900 : 700, color: id === myId ? "#93c5fd" : "#e2e8f0" }}>
                {id === room.hostId ? "👑 " : ""}{m.name}{id === myId ? "（我）" : ""}
              </span>
              <span style={{ fontSize: 11, fontWeight: 900, color: m.ready ? "#6ee7b7" : "#94a3b8" }}>
                {m.ready ? "已準備" : "準備中…"}
              </span>
            </div>
          );
        })}
      </div>

      {isHost && (
        <button type="button" disabled={busy || !allReady} onClick={() => act(onDepart)}
          style={{ ...btn(allReady ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#475569", { cursor: allReady ? "pointer" : "not-allowed", padding: "13px 16px", fontSize: 14 }) }}>
          {allReady ? "⚔️ 全隊出發！" : "等所有隊員按下準備完成"}
        </button>
      )}
      {!isHost && (
        <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
          {meReady ? "等房主發起遠征…" : "按下「準備完成」讓房主可以出發"}
        </div>
      )}

      {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}
    </div>
  );
}
