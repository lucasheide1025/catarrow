// src/components/member/HomeLeaderboardBlock.jsx
// 首頁區塊：顯示「我排名最好的前三個榜」——**只顯示自己的名次**（幾名都行），不列其他人。
//
// ⚠️ 讀寫量（2026-07-26 作者拍板）：這個區塊要算榜就得讀**整個 members 集合**，
//    而它掛在首頁 ⇒ 每個學生每次開 App 都付一次全集合讀取。所以：
//      ① 結果存 localStorage，**沒有 TTL**——不按按鈕就永遠不重讀（開 App 是 0 次讀取）
//      ② 只有第一次（本機還沒有快取）會自動抓一次，否則畫面會是空的
//      ③ 想看即時的：按「更新」按鈕，或點「查看全部」進排行榜頁（那頁維持每次重算）
//    只留自己的名次還有一個附帶好處：快取體積極小，不用擔心 localStorage 塞爆。
import { useState, useEffect, useCallback } from "react";
import { getMembers } from "../../lib/db";
import { rankBoard, buildCertMaps, LB_TAB_MAP } from "../../lib/leaderboardData";
import { readLocal, writeLocal } from "../../lib/localCache";
import { Card } from "../shared/UI";
import { SectionHeader } from "../shared/Widgets";
import MemberFeatureArt from "./MemberFeatureArt";

// 候選榜（皆為 member 文件欄位，無需額外 collection 讀取）
const CANDIDATES = [
  "event", "arrows", "checkin", "adventurer",
  "fatcat", "score", "achieve",
  "wbdmg", "partydmg", "laps", "max_cat",
  "dungeon_dex", "achieve_dex", "cat_cards",
  "dclear:all",
];
const fmt = (n) => (Number(n) || 0).toLocaleString();
const cacheKey = (myId) => `home_leaderboard.${myId}`;

function goBoard(onPageChange, boardId) {
  try { sessionStorage.setItem("leaderboard_initial_tab", boardId.split(":")[0]); } catch { /* ignore */ }
  onPageChange("leaderboard");
}

// 只留畫面用得到的：榜 id、我的名次、我的數值、參賽人數
function computeMine(members, myId) {
  const data = { certMaps: buildCertMaps([], new Date().getFullYear()), certRecords: [], duelMap: {}, dexMap: {}, cardMap: {}, year: new Date().getFullYear() };
  const hits = [];
  CANDIDATES.forEach((boardId) => {
    const rows = rankBoard(boardId, members, data, { useSeason: false });
    const idx = rows.findIndex((r) => r.id === myId);
    if (idx >= 0) {
      // 任何名次都算數（不只前五）——玩家要知道自己排第幾，就算很後面也一樣
      hits.push({ boardId, rank: idx + 1, value: rows[idx]?.value ?? 0, total: rows.length });
    }
  });
  // 名次越前越優先；同名次比參與人數（越競爭越有面子）
  hits.sort((a, b) => a.rank - b.rank || b.total - a.total);
  return hits.slice(0, 3);
}

function agoText(ms) {
  if (!ms) return "";
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "剛剛更新";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${Math.floor(hr / 24)} 天前`;
}

export default function HomeLeaderboardBlock({ myId, onPageChange }) {
  const [mine, setMine] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    if (!myId || busy) return;
    setBusy(true);
    setLoadError(false);
    try {
      const members = await getMembers({ fresh: true });
      const next = computeMine(members, myId);
      writeLocal(cacheKey(myId), next);
      setMine(next);
      setUpdatedAt(Date.now());
    } catch {
      // 讀不到就維持舊資料，不要把畫面清空
      setLoadError(true);
    } finally {
      setBusy(false);
    }
  }, [myId, busy]);

  useEffect(() => {
    if (!myId) return;
    const hit = readLocal(cacheKey(myId), 0);   // ttl=0 ⇒ 永不過期，只有按按鈕才更新
    if (hit) { setMine(hit.value); setUpdatedAt(hit.at); return; }
    refresh();                                  // 本機還沒有 → 第一次自動抓一次
  }, [myId]); // eslint-disable-line

  if (!myId) return null;

  const action = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button onClick={refresh} disabled={busy}
        style={{ fontSize: 11, color: busy ? "#64748b" : "#fbbf24", fontWeight: 800, background: "none", border: "none", cursor: busy ? "default" : "pointer", padding: 0 }}>
        {busy ? "更新中…" : "🔄 更新排名"}
      </button>
      <button onClick={() => onPageChange("leaderboard")}
        style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        查看全部 →
      </button>
    </span>
  );

  if (mine === null) {
    return (
      <Card className="relative isolate overflow-hidden p-4" style={{ background:"linear-gradient(145deg,#171d31,#101827 70%)", border:"1px solid rgba(96,165,250,.22)" }}>
        <MemberFeatureArt name="history" size={125} style={{ position:"absolute", right:-24, bottom:-35, opacity:.13, zIndex:-1 }} />
        <SectionHeader icon="🏆" title="排行榜" action={action} />
        <div role="status" style={{ fontSize:12, color:"rgba(255,255,255,.58)", textAlign:"center", padding:"12px 0" }}>
          {loadError ? "暫時無法取得排名，稍後可按「更新排名」重試。" : "正在讀取你的排行榜資料…"}
        </div>
      </Card>
    );
  }

  if (mine.length === 0) {
    return (
      <Card className="relative isolate overflow-hidden p-4" style={{ background: "linear-gradient(145deg,#171d31,#101827 70%)", border: "1px solid rgba(96,165,250,.22)" }}>
        <MemberFeatureArt name="history" size={125} style={{ position:"absolute", right:-24, bottom:-35, opacity:.13, zIndex:-1 }} />
        <SectionHeader icon="🏆" title="排行榜" action={action} />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "10px 0" }}>
          🏅 暫無名次——完成第一個挑戰，排行榜就會顯示你的名次！
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative isolate overflow-hidden p-4" style={{ background: "linear-gradient(145deg,#2b1d09,#101827 72%)", border: "1px solid rgba(251,191,36,.28)", boxShadow: "0 14px 30px rgba(0,0,0,.28)" }}>
      <MemberFeatureArt name="history" size={145} style={{ position:"absolute", right:-30, top:-36, opacity:.14, zIndex:-1 }} />
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-600" />
      <SectionHeader icon="🏆" title="我的排行榜" action={action} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mine.map(({ boardId, rank, value, total }) => {
          const tab = LB_TAB_MAP[boardId.split(":")[0]];
          return (
            <button key={boardId} type="button" onClick={() => goBoard(onPageChange, boardId)}
              style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", width: "100%",
                background: "linear-gradient(90deg,rgba(251,191,36,.09),rgba(255,255,255,.035))", border: "1px solid rgba(251,191,36,.14)",
                borderRadius: 12, padding: "9px 12px", cursor: "pointer" }}>
              <span style={{ fontSize: 15 }}>{tab?.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#f1f5f9", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tab?.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#e2e8f0" }}>
                {fmt(value)}<span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginLeft: 2 }}>{tab?.unit}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: rank <= 3 ? "#fbbf24" : "#93c5fd", minWidth: 52, textAlign: "right" }}>
                第 {rank} 名
              </span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", minWidth: 34, textAlign: "right" }}>／{total}人</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.3)", textAlign: "right", marginTop: 6 }}>
        排名快取於 {agoText(updatedAt)}・不按更新就不會重新讀取
      </div>
    </Card>
  );
}
