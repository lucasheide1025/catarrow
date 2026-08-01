// src/worldboss/TournamentGate.jsx
// 🏛️ 對外賽事歷史排行榜。
//
// ⚠️ 這是**對外賽事**的存檔，跟館內比賽模式是兩回事：
//    資格賽、對抗賽是在別的場地打的，系統沒有資料，只能靠教練照紙本補登。
//    今天在館內用比賽模式打的，可以一鍵匯進來再讓教練確認名次。
//
// ⚠️ 讀取是**開頁面讀一次**，不做即時監聽——這是存檔不是即時榜。
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { deleteTournament, listTournaments, saveTournament } from "../lib/tournamentDb";
import {
  TOURNAMENT_TYPE_MAP, memberRecord, sortForDisplay, sortTournaments, tournamentSummary,
} from "./domain/tournament";
import { RAID_LOBBY_BG } from "./raidAssets";
import TournamentEditor from "./ui/TournamentEditor";

const card = {
  background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 13, marginBottom: 10,
  border: "1px solid rgba(148,163,184,.16)",
};
const MEDAL = ["🥇", "🥈", "🥉"];

export default function TournamentGate({ onBack, isAdmin = false, importDraft = null }) {
  const { profile } = useAuth();
  const myId = profile?.id;
  const myName = profile?.name || "";

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(importDraft || null);
  const [openId, setOpenId] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setList(await listTournaments());
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const sorted = useMemo(() => sortTournaments(list), [list]);
  const mine = useMemo(() => memberRecord(list, myId, myName), [list, myId, myName]);
  const open = sorted.find(t => t.id === openId) || null;

  if (editing) {
    return (
      <div style={{
        position: "fixed", inset: 0, overflowY: "auto", background: "#05040a",
        padding: "14px 12px 28px", color: "#e2e8f0",
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fde68a", marginBottom: 10, maxWidth: 560, margin: "0 auto 10px" }}>
          {editing.id ? "✏️ 編輯賽事" : "🏛️ 新增賽事"}
        </div>
        <TournamentEditor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={async t => {
            const res = await saveTournament(t, { adminId: myId });
            if (res.ok) { await reload(); setEditing(null); }
            return res;
          }}
          onDelete={editing.id ? async () => {
            await deleteTournament(editing.id);
            await reload();
            setEditing(null);
          } : null}
        />
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, overflowY: "auto",
      backgroundImage: `linear-gradient(rgba(2,6,23,.92), rgba(2,6,23,.97)), url(${RAID_LOBBY_BG})`,
      backgroundSize: "cover", backgroundPosition: "center",
      padding: "14px 12px 28px", color: "#e2e8f0",
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {onBack && (
            <button type="button" onClick={onBack} style={{
              border: "none", background: "transparent", color: "#94a3b8",
              fontSize: 13, fontWeight: 900, cursor: "pointer", padding: 0,
            }}>← 返回</button>
          )}
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fde68a", flex: 1 }}>🏛️ 對外賽事紀錄</div>
        </div>

        {/* 我的對外戰績 */}
        {mine.events > 0 && (
          <div style={{ ...card, border: "1px solid rgba(251,191,36,.4)" }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 }}>
              🏹 我的對外戰績
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              {[["參賽場次", mine.events], ["最佳名次", mine.best ? `第 ${mine.best} 名` : "—"],
                ["前三名", `${mine.podiums} 次`]].map(([k, v]) => (
                <div key={k} style={{ background: "#1e293b", borderRadius: 9, padding: "8px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fbbf24" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <button type="button" onClick={() => setEditing({ entries: [] })} style={{
            width: "100%", padding: "13px 0", borderRadius: 11, border: "none", marginBottom: 10,
            background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff",
            fontWeight: 900, fontSize: 14, cursor: "pointer",
          }}>🏛️ 新增賽事（資格賽／對抗賽補登）</button>
        )}

        {loading ? (
          <div style={{ ...card, textAlign: "center", color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            載入中…
          </div>
        ) : !sorted.length ? (
          <div style={{
            padding: "26px 12px", textAlign: "center", borderRadius: 12,
            border: "1px dashed rgba(148,163,184,.3)", color: "#64748b",
            fontSize: 12, fontWeight: 800,
          }}>還沒有對外賽事紀錄</div>
        ) : sorted.map(t => {
          const s = tournamentSummary(t);
          const isOpen = openId === t.id;
          return (
            <div key={t.id} style={{ ...card, border: `1px solid ${s.typeInfo.color}55` }}>
              <button type="button" onClick={() => setOpenId(isOpen ? null : t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%",
                  border: "none", background: "transparent", cursor: "pointer",
                  textAlign: "left", padding: 0, color: "#e2e8f0",
                }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{s.typeInfo.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 900 }}>{s.name}</span>
                  <span style={{ display: "block", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                    {s.date}・{s.typeInfo.label}・{s.players} 人
                    {s.champion && <>・🥇 {s.champion}</>}
                  </span>
                </span>
                <span style={{ color: "#64748b", fontSize: 12, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <>
                  {s.note && (
                    <div style={{ fontSize: 10.5, color: "#94a3b8", margin: "8px 0 4px", lineHeight: 1.6 }}>
                      📋 {s.note}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    {sortForDisplay(t.entries).map(r => (
                      <div key={r.key} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 9px", borderRadius: 9,
                        background: (r.memberId && r.memberId === myId) || r.name === myName
                          ? "rgba(251,191,36,.14)" : "#1e293b",
                        border: `1px solid ${r.rank === 1 ? "rgba(251,191,36,.5)" : "rgba(148,163,184,.12)"}`,
                      }}>
                        <span style={{
                          width: 28, textAlign: "center", fontSize: r.rank <= 3 && r.rank > 0 ? 15 : 12,
                          fontWeight: 900, color: r.rank && r.rank <= 3 ? "#fde68a" : "#64748b",
                        }}>{r.rank ? (MEDAL[r.rank - 1] || r.rank) : "—"}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 900 }}>
                          {r.name}
                        </span>
                        {r.arrows > 0 && (
                          <span style={{ fontSize: 9.5, color: "#64748b" }}>
                            {r.arrows} 箭{r.xCount ? `・X${r.xCount}` : ""}
                          </span>
                        )}
                        <span style={{ fontSize: 15, fontWeight: 900, color: "#fbbf24" }}>{r.score}</span>
                      </div>
                    ))}
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => setEditing(t)} style={{
                      width: "100%", marginTop: 9, padding: "9px 0", borderRadius: 9,
                      border: "1px solid #60a5fa", background: "rgba(96,165,250,.12)",
                      color: "#bfdbfe", fontWeight: 900, fontSize: 12, cursor: "pointer",
                    }}>✏️ 編輯這場賽事</button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
