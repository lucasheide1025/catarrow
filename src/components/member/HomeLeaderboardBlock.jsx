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

// ── 首頁排行榜的本地快取（2026-07-26 讀寫量稽核）────────────────────
// 這個區塊為了算 15 個榜要 `getMembers()`（整個 members 集合），而它掛在**首頁**——
// 等於每個學生每次開 App 都付一次全集合讀取。
// 但首頁排行榜是「炫耀用的小卡」，差一小時完全沒差 → 快取**算好的結果**（不是原始會員資料），
// 30 分鐘內開 App 就是 0 次讀取。要看即時的就點「查看全部」進排行榜頁（那頁維持每次重算）。
const LB_CACHE_KEY = "catarrow.home_leaderboard.v1";
const LB_TTL_MS = 30 * 60 * 1000;

function readCache(myId) {
  try {
    const raw = JSON.parse(localStorage.getItem(`${LB_CACHE_KEY}.${myId}`) || "null");
    if (raw && Date.now() - raw.at < LB_TTL_MS && Array.isArray(raw.chosen)) return raw.chosen;
  } catch { /* 壞掉就當沒有 */ }
  return null;
}
function writeCache(myId, chosen) {
  try { localStorage.setItem(`${LB_CACHE_KEY}.${myId}`, JSON.stringify({ at: Date.now(), chosen })); } catch { /* 空間滿了就算了 */ }
}

// 只留畫面真的會用到的欄位（整個 member 物件塞進 localStorage 太肥）
function computeChosen(members, myId) {
  const data = { certMaps: buildCertMaps([], new Date().getFullYear()), certRecords: [], duelMap: {}, dexMap: {}, cardMap: {}, year: new Date().getFullYear() };
  const hits = [];
  CANDIDATES.forEach((boardId) => {
    const rows = rankBoard(boardId, members, data, { useSeason: false });
    const idx = rows.findIndex((r) => r.id === myId);
    if (idx >= 0 && idx < 5) {
      hits.push({
        boardId, idx, total: rows.length,
        rows: rows.slice(0, 5).map((r) => ({ id: r.id, name: nm(r.member), value: r.value })),
      });
    }
  });
  // 排序：名次越前越優先；同名次比參與人數（越競爭越有面子）
  hits.sort((a, b) => a.idx - b.idx || b.total - a.total);
  return hits.slice(0, 3);
}

export default function HomeLeaderboardBlock({ myId, onPageChange }) {
  const [chosen, setChosen] = useState(null);

  useEffect(() => {
    if (!myId) return;
    const cached = readCache(myId);
    if (cached) { setChosen(cached); return; }   // 命中快取 → 完全不讀資料庫
    let alive = true;
    getMembers()
      .then((ms) => {
        const next = computeChosen(ms, myId);
        writeCache(myId, next);
        if (alive) setChosen(next);
      })
      .catch(() => { if (alive) setChosen([]); });
    return () => { alive = false; };
  }, [myId]);

  if (chosen === null || !myId) return null;

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
                        {r.name}{me && "（我）"}
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
