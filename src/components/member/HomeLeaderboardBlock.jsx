// src/components/member/HomeLeaderboardBlock.jsx
// 首頁區塊：顯示「我入圍前五名」的最多 3 個排行榜（各附 Top5 迷你榜）。
// 只掃 member 文件即可算分的榜（不另讀 monsterDex/duel/cert/卡片），一次 getMembers 搞定。
import { useState, useEffect } from "react";
import { getMembers } from "../../lib/db";
import { rankBoard, buildCertMaps, LB_TAB_MAP } from "../../lib/leaderboardData";
import { Card } from "../shared/UI";
import { SectionHeader } from "../shared/Widgets";

// 候選榜（皆為 member 文件欄位，無需額外 collection 讀取）
const CANDIDATES = [
  "event", "arrows", "checkin", "adventurer",
  "fatcat", "score", "achieve",
  "wbdmg", "partydmg", "laps", "max_cat",
  "dungeon_dex", "achieve_dex", "cat_cards",
  "dclear:all",
];
const MEDALS = ["🥇", "🥈", "🥉", "4", "5"];
const nm = (m) => m?.nickname || m?.name || "射手";
const fmt = (n) => (Number(n) || 0).toLocaleString();

function goBoard(onPageChange, boardId) {
  try { sessionStorage.setItem("leaderboard_initial_tab", boardId.split(":")[0]); } catch { /* ignore */ }
  onPageChange("leaderboard");
}

export default function HomeLeaderboardBlock({ myId, onPageChange }) {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    let alive = true;
    getMembers().then((ms) => { if (alive) setMembers(ms); }).catch(() => { if (alive) setMembers([]); });
    return () => { alive = false; };
  }, []);

  if (members === null || !myId) return null;

  const data = { certMaps: buildCertMaps([], new Date().getFullYear()), certRecords: [], duelMap: {}, dexMap: {}, cardMap: {}, year: new Date().getFullYear() };

  // 掃每個候選榜，找出「我在前五名」的
  const hits = [];
  CANDIDATES.forEach((boardId) => {
    const rows = rankBoard(boardId, members, data, { useSeason: false });
    const idx = rows.findIndex((r) => r.id === myId);
    if (idx >= 0 && idx < 5) {
      hits.push({ boardId, idx, rows: rows.slice(0, 5), total: rows.length });
    }
  });

  // 排序：名次越前越優先；同名次比參與人數（越競爭越有面子）
  hits.sort((a, b) => a.idx - b.idx || b.total - a.total);
  const chosen = hits.slice(0, 3);

  // 一個都沒入圍 → 仍給一個入口卡
  if (chosen.length === 0) {
    return (
      <Card className="p-4" style={{ background: "#101827", border: "1px solid rgba(96,165,250,.18)" }}>
        <SectionHeader icon="🏆" title="排行榜" action={
          <button onClick={() => onPageChange("leaderboard")} style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>查看全部 →</button>
        } />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "10px 0" }}>
          還沒擠進任何榜的前五名，衝一波吧！
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4" style={{ background: "#101827", border: "1px solid rgba(251,191,36,.2)", boxShadow: "0 10px 24px rgba(0,0,0,.24), inset 4px 0 #fbbf24" }}>
      <SectionHeader icon="🏆" title="我的排行榜" action={
        <button onClick={() => onPageChange("leaderboard")} style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>查看全部 →</button>
      } />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {chosen.map(({ boardId, idx, rows }) => {
          const tab = LB_TAB_MAP[boardId.split(":")[0]];
          return (
            <button key={boardId} type="button" onClick={() => goBoard(onPageChange, boardId)}
              style={{ textAlign: "left", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{tab?.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#f1f5f9" }}>{tab?.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 900, color: idx < 3 ? "#fbbf24" : "#93c5fd" }}>
                  我第 {idx + 1} 名
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {rows.map((r, i) => {
                  const me = r.id === myId;
                  return (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                      padding: me ? "2px 6px" : "2px 0", borderRadius: 6,
                      background: me ? "rgba(59,130,246,0.14)" : "transparent",
                    }}>
                      <span style={{ width: 18, textAlign: "center", fontSize: i < 3 ? 13 : 11, color: "rgba(255,255,255,0.5)", fontWeight: 800 }}>{MEDALS[i]}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: me ? 900 : 600, color: me ? "#93c5fd" : "rgba(255,255,255,0.8)" }}>
                        {nm(r.member)}{me && "（我）"}
                      </span>
                      <span style={{ fontWeight: 900, color: me ? "#93c5fd" : "#e2e8f0" }}>{fmt(r.value)}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{tab?.unit}</span>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
