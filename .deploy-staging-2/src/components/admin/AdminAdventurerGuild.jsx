// src/components/admin/AdminAdventurerGuild.jsx — 教練查看冒險者等級總覽
import { useState, useEffect } from "react";
import { getMembers } from "../../lib/db";
import { levelFromXP, rankFromLevel, rankIdxFromLevel, xpProgress, RANKS } from "../../lib/adventurerSystem";

const PROMO_LEVELS = [10, 20, 30, 40, 50];

export default function AdminAdventurerGuild() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRank, setFilterRank] = useState("all");

  useEffect(() => {
    getMembers()
      .then(list => {
        const sorted = [...list].sort((a, b) => (b.adventurerXP || 0) - (a.adventurerXP || 0));
        setMembers(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterRank === "all"
    ? members
    : members.filter(m => rankIdxFromLevel(levelFromXP(m.adventurerXP || 0)) === Number(filterRank));

  const totalWithXP = members.filter(m => (m.adventurerXP || 0) > 0).length;

  return (
    <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
      {/* 統計列 */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        {RANKS.map((r, i) => {
          const count = members.filter(m => rankIdxFromLevel(levelFromXP(m.adventurerXP || 0)) === i).length;
          return (
            <button key={r.name} onClick={() => setFilterRank(filterRank === String(i) ? "all" : String(i))}
              style={{
                background: filterRank === String(i) ? r.color + "33" : "#f8fafc",
                border: `1px solid ${filterRank === String(i) ? r.color : "#e2e8f0"}`,
                borderRadius: "10px", padding: "6px 12px", cursor: "pointer",
                fontSize: "12px", fontWeight: "700", color: "#1e293b",
              }}>
              {r.icon} {r.name} <span style={{ color: "#64748b" }}>{count}</span>
            </button>
          );
        })}
        <button onClick={() => setFilterRank("all")}
          style={{
            background: filterRank === "all" ? "#eff6ff" : "#f8fafc",
            border: `1px solid ${filterRank === "all" ? "#93c5fd" : "#e2e8f0"}`,
            borderRadius: "10px", padding: "6px 12px", cursor: "pointer",
            fontSize: "12px", fontWeight: "700", color: "#2563eb",
          }}>
          全部 {members.length}
        </button>
      </div>

      {/* 摘要 */}
      <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "12px" }}>
        已累積 XP 的學員：{totalWithXP} / {members.length} 人
      </div>

      {loading && <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px" }}>載入中…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px" }}>此階級尚無學員</div>
      )}

      {/* 會員列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map((m, idx) => {
          const xp      = m.adventurerXP || 0;
          const level   = levelFromXP(xp);
          const rank    = rankFromLevel(level);
          const { current, needed, pct } = xpProgress(xp, level);
          const promoDone = new Set(m.promotionDone || []);
          const hasPromo = PROMO_LEVELS.some(lv => lv <= level);

          return (
            <div key={m.id} style={{
              background: "white", border: "1px solid #e2e8f0", borderRadius: "12px",
              padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px",
            }}>
              {/* 排名 */}
              <div style={{ width: "24px", textAlign: "center", fontSize: "12px", color: "#94a3b8", fontWeight: "700", flexShrink: 0 }}>
                {idx + 1}
              </div>

              {/* 階級 icon */}
              <div style={{ fontSize: "22px", flexShrink: 0 }}>{rank.icon}</div>

              {/* 名字 + XP 進度 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "800", fontSize: "14px", color: "#1e293b" }}>
                    {m.name || m.id}
                  </span>
                  <span style={{
                    background: rank.color + "22", color: rank.color,
                    fontSize: "11px", fontWeight: "700", padding: "1px 7px", borderRadius: "20px",
                  }}>
                    Lv.{level} {rank.name}
                  </span>
                </div>

                {/* XP 進度條 */}
                {level < 60 ? (
                  <div>
                    <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden", marginBottom: "3px" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: rank.color, borderRadius: "3px", transition: "width .3s" }} />
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                      {xp.toLocaleString()} XP・此級 {current}/{needed}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700" }}>⚡ 神話滿等</div>
                )}
              </div>

              {/* 晉階標記 */}
              {hasPromo && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
                  {PROMO_LEVELS.filter(lv => lv <= level + 1).map(lv => (
                    <span key={lv} style={{
                      fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px",
                      background: promoDone.has(lv) ? "#dcfce7" : "#fef9c3",
                      color: promoDone.has(lv) ? "#16a34a" : "#854d0e",
                    }}>
                      {promoDone.has(lv) ? "✓" : "！"} Lv{lv}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
