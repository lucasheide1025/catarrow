// src/guild/ui/GuildTeamLobby.jsx
// 組隊遠征的等待室：開隊／**直接點進別人的隊伍**／各自備包 → 房主出發。
//
// ⚠️ 2026-07-26 作者拍板：**不用房號**。等待中的隊伍直接列出來點一下就進去——
//    大家都在同一間箭館，報房號這個步驟純粹是多的。
//
// 設計取捨：不再做一套完整的備包畫面（單人版 GuildLoadout 已經有了）。這裡只讓成員調
// 食物/水，其餘（六維、貓、箭數）**直接沿用他自己的存檔**——組隊時最重要的是「快速上線」，
// 沒有人想在等別人的時候還被逼著重新配裝。
import { useEffect, useState } from "react";
import { MAX_TEAM_SIZE } from "../domain/teamExpeditionFlow";
import { STAT_META } from "../domain/guildStats";
import { sfxTap, sfxClose, sfxError, sfxSwitch } from "../../lib/sound";
import { hallBg, bgLayer, CatArt, HeroArt } from "./GuildArt";

const card = { background: "rgba(0,0,0,.34)", borderRadius: 12, padding: 12 };
const btn = (bg, extra = {}) => ({
  padding: "9px 14px", borderRadius: 10, border: "none", background: bg,
  color: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer", ...extra,
});

export default function GuildTeamLobby({
  room, openRooms = [], myId, isHost, contract, stats, partyCats, arrowsPerRound,
  onCreate, onJoinRoom, onReady, onUnready, onDepart, onLeave, onClose, busy,
}) {
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
            想自己當房主？先從委託板點一張委託 →「🤝 揪人一起打」。或者直接加入下面正在招人的隊伍。
          </div>
        )}

        <div style={{ ...card }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
            🧭 正在招人的隊伍 {openRooms.length > 0 && <span style={{ color: "#6ee7b7" }}>({openRooms.length})</span>}
          </div>
          {openRooms.length === 0 && (
            <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.7 }}>
              現在沒有人在招人。<br />你可以自己從委託板點一張委託 →「揪人一起打」開一隊，等別人加入。
            </div>
          )}
          {openRooms.map(r => {
            const full = r.size >= MAX_TEAM_SIZE;
            return (
              <button key={r.id} type="button" disabled={busy || full}
                onClick={() => act(() => onJoinRoom(r.id))}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 10, padding: "9px 11px", marginBottom: 6, color: "#e2e8f0",
                  opacity: full ? 0.45 : 1, cursor: full ? "not-allowed" : "pointer" }}>
                <span style={{ fontSize: 18 }}>{r.contract?.familyIcon || "📜"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.contract?.title || "遠征委託"}
                  </span>
                  <span style={{ display: "block", fontSize: 10.5, color: "#94a3b8" }}>
                    👑 {r.hostName}　{r.contract?.skulls}　{r.contract?.waves} 波
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, color: full ? "#f87171" : "#6ee7b7", flexShrink: 0 }}>
                  {r.size}/{MAX_TEAM_SIZE}{full ? "　滿" : "　加入"}
                </span>
              </button>
            );
          })}
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

      <div style={{ ...card, fontSize: 11.5, color: "#94a3b8", textAlign: "center" }}>
        這支隊伍已經出現在「正在招人的隊伍」列表裡——隊友從公會大廳點「🤝 組隊」就看得到你。
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
