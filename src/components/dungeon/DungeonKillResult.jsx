// src/components/dungeon/DungeonKillResult.jsx — 一般怪／王擊倒後的單場結算畫面
//
// 2026-07-19 使用者規格：擊倒後不要只彈一個 4.5 秒的小提示，要完整看到
//   ① 戰鬥數據（造成傷害／承受傷害／爆擊數）
//   ② 命中分析（X~M 分佈、命中率）
//   ③ 獲得的射手 XP／貓貓 XP、材料寶箱與金幣寶箱的等級與數量
//   ④ 自己與隊友的射箭評價（E~SSS）＋ 本場 MVP
//   ⑤ 底部「下一步」／「等待房主繼續」
//
// ⚠️ 評價一律來自 archeryGrade（只看射箭表現，不看傷害/坦度/治療）——
// 使用者拍板：那些吃裝備與等級，這是射箭道館的系統。
// 單人與組隊共用這一個元件，避免像先前抽王那樣長出兩套各自演化的實作。

import { useMemo } from "react";
import { summarizeExpeditionChests } from "../../lib/expeditionRewards";
import {
  gradeArcheryPerformance, pickArcheryMvp, buildArcheryAdvice, GRADE_STYLE,
} from "../../lib/archeryGrade";

const FAMILY_LABEL = {
  ghost:"鬼怪", mountain:"山林", insect:"毒蟲",
  workplace:"職場", exam:"考試", temple:"西方", treasure:"寶箱族",
};

function GradeBadge({ grade, size = 34 }) {
  const style = GRADE_STYLE[grade] || GRADE_STYLE.E;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      minWidth:size, height:size, padding:"0 8px", borderRadius:10,
      fontSize:size >= 30 ? 16 : 12, fontWeight:900, lineHeight:1,
      color:style.color, background:`${style.color}1f`, border:`1.5px solid ${style.color}66`,
    }}>{style.label}</span>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div style={{ flex:1, minWidth:0, borderRadius:12, padding:"8px 6px", background:"rgba(0,0,0,.25)", textAlign:"center" }}>
      <div style={{ fontSize:18, fontWeight:900, color }}>{value}</div>
      <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>{label}</div>
    </div>
  );
}

// 命中分佈：依該靶制的標籤順序排，沒中的環也留位置比較好比較
function ArrowDistribution({ distribution, arrowCount }) {
  const entries = Object.entries(distribution || {});
  if (!entries.length) return null;
  const order = label => (label === "X" ? 999 : label === "M" ? -1 : Number(label) || 0);
  const sorted = entries.sort((a, b) => order(b[0]) - order(a[0]));
  const max = Math.max(...sorted.map(([, count]) => count), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4, marginTop:8, height:56 }}>
      {sorted.map(([label, count]) => (
        <div key={label} style={{ flex:1, minWidth:0, textAlign:"center" }}>
          <div style={{ fontSize:10, color:"#cbd5e1", marginBottom:2 }}>{count}</div>
          <div style={{
            height:Math.max(4, Math.round((count / max) * 30)),
            borderRadius:4,
            background: label === "M" ? "#f87171" : label === "X" ? "#fbbf24" : "#60a5fa",
            opacity: label === "M" ? 0.8 : 1,
          }} />
          <div style={{ fontSize:10, fontWeight:700, color: label === "M" ? "#f87171" : "#94a3b8", marginTop:3 }}>
            {label}
          </div>
        </div>
      ))}
      <div style={{ width:1 }} />
      <div style={{ fontSize:10, color:"#64748b", whiteSpace:"nowrap", paddingBottom:14 }}>共 {arrowCount} 箭</div>
    </div>
  );
}

export default function DungeonKillResult({
  monster,
  self,                    // { id, name, arrows, dmgDealt, dmgTaken, crits }
  allies = [],             // 其他隊友，結構同 self（單人遠征傳空陣列）
  chests = [],
  coins = 0,
  archerXP = 0,
  catXP = 0,
  catName,
  lootMult = 1,
  targetFmt = "full_110",
  isBoss = false,
  bossDrops = [],          // 王房專屬掉落（素材／卡片），一般怪不傳
  canContinue = true,      // 組隊非房主時為 false
  waitingLabel = "等待房主繼續…",
  continueLabel = "下一步",
  onContinue,
}) {
  const selfPerf = useMemo(
    () => gradeArcheryPerformance(self?.arrows, { targetFmt }),
    [self?.arrows, targetFmt],
  );
  const allyPerfs = useMemo(
    () => allies.map(ally => ({ ...ally, performance: gradeArcheryPerformance(ally.arrows, { targetFmt }) })),
    [allies, targetFmt],
  );
  const mvp = useMemo(
    () => pickArcheryMvp([self, ...allies].filter(Boolean), { targetFmt }),
    [self, allies, targetFmt],
  );
  const advice = useMemo(() => buildArcheryAdvice(selfPerf, { targetFmt }), [selfPerf, targetFmt]);
  const chestSummary = summarizeExpeditionChests(chests);
  const isSolo = allyPerfs.length === 0;

  return (
    <div style={{
      minHeight:"100dvh", overflowY:"auto", padding:"28px 18px 40px", color:"#fff",
      background: isBoss
        ? "linear-gradient(160deg,#1a1206 0%,#2e1f06 50%,#1a1206 100%)"
        : "linear-gradient(160deg,#06140d 0%,#0f2e1a 50%,#06140d 100%)",
    }}>
      <div style={{ maxWidth:460, margin:"0 auto" }}>
        {/* 標題 */}
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:52 }}>{isBoss ? "👑" : "⚔️"}</div>
          <div style={{ fontSize:22, fontWeight:900, color: isBoss ? "#fbbf24" : "#4ade80", marginTop:4 }}>
            {isBoss ? "王房攻略成功！" : "擊倒成功！"}
          </div>
          <div style={{ fontSize:13, color:"#94a3b8", marginTop:2 }}>{monster?.name || "怪物"}</div>
          {lootMult > 1 && (
            <div style={{ fontSize:11, color:"#fcd34d", marginTop:4 }}>🎲 本圖 {lootMult} 倍掉落</div>
          )}
        </div>

        {/* 戰鬥數據 */}
        <div style={{ display:"flex", gap:8, marginTop:20 }}>
          <StatTile label="造成傷害" value={self?.dmgDealt ?? 0} color="#f87171" />
          <StatTile label="承受傷害" value={self?.dmgTaken ?? 0} color="#fb923c" />
          <StatTile label="爆擊次數" value={self?.crits ?? 0} color="#fbbf24" />
        </div>

        {/* 命中分析 */}
        <div style={{ marginTop:14, borderRadius:16, padding:14, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:14, fontWeight:900 }}>🎯 命中分析</span>
            <GradeBadge grade={selfPerf.grade} />
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <StatTile label="命中率" value={`${Math.round(selfPerf.hitRate * 100)}%`} color="#4ade80" />
            <StatTile label="穩定性" value={`${Math.round(selfPerf.stability * 100)}%`} color="#60a5fa" />
            <StatTile label="均分" value={selfPerf.avgScore} color="#c4b5fd" />
          </div>
          <ArrowDistribution distribution={selfPerf.distribution} arrowCount={selfPerf.arrowCount} />
          {advice.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,.08)" }}>
              {advice.map((line, index) => (
                <div key={index} style={{ fontSize:11, color:"#cbd5e1", marginTop:index ? 4 : 0 }}>💡 {line}</div>
              ))}
            </div>
          )}
        </div>

        {/* 獲得 */}
        <div style={{ marginTop:14, borderRadius:16, padding:14, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)" }}>
          <div style={{ fontSize:14, fontWeight:900 }}>🎁 本場獲得</div>
          <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
            {coins > 0 && <StatTile label="金幣" value={`+${coins}`} color="#fcd34d" />}
            {archerXP > 0 && <StatTile label="射手 XP" value={`+${archerXP}`} color="#c4b5fd" />}
            {catXP > 0 && <StatTile label={`${catName || "貓貓"} XP`} value={`+${catXP}`} color="#fda4af" />}
          </div>
          {chestSummary.length > 0 && (
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:5 }}>
              {chestSummary.map(item => (
                <div key={item.key} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"7px 10px", borderRadius:10, background:"rgba(0,0,0,.25)", fontSize:12,
                }}>
                  <span style={{ color:"#e2e8f0" }}>
                    {item.icon} {item.family ? `${FAMILY_LABEL[item.family] || item.family} ` : ""}{item.name}
                  </span>
                  <span style={{ fontWeight:900, color:"#fcd34d" }}>×{item.count}</span>
                </div>
              ))}
            </div>
          )}
          {bossDrops.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#fbbf24", marginBottom:5 }}>👑 王房掉落</div>
              {bossDrops.map((drop, index) => (
                <div key={`${drop.id || drop.name}-${index}`} style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"7px 10px", borderRadius:10, background:"rgba(251,191,36,.1)", marginTop:index ? 5 : 0,
                }}>
                  <span style={{ fontSize:18 }}>{drop.icon || (drop.kind === "card" ? "🃏" : "💎")}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"#fde68a" }}>{drop.name}</span>
                  {drop.count > 1 && <span style={{ marginLeft:"auto", fontWeight:900, color:"#fcd34d" }}>×{drop.count}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 評價與 MVP */}
        <div style={{ marginTop:14, borderRadius:16, padding:14, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:14, fontWeight:900 }}>🏅 射箭評價</span>
            <span style={{ fontSize:10, color:"#64748b" }}>只計射箭表現</span>
          </div>
          <div style={{
            display:"flex", alignItems:"center", gap:10, marginTop:10,
            padding:"9px 12px", borderRadius:12, background:"rgba(0,0,0,.25)",
          }}>
            <GradeBadge grade={selfPerf.grade} size={30} />
            <span style={{ fontSize:13, fontWeight:800 }}>{self?.name || "我"}</span>
            {mvp?.id && self?.id && mvp.id === self.id && (
              <span style={{ fontSize:10, fontWeight:900, color:"#fbbf24", background:"rgba(251,191,36,.15)", padding:"2px 7px", borderRadius:6 }}>MVP</span>
            )}
            <span style={{ marginLeft:"auto", fontSize:11, color:"#94a3b8" }}>{selfPerf.score} 分</span>
          </div>
          {allyPerfs.map(ally => (
            <div key={ally.id} style={{
              display:"flex", alignItems:"center", gap:10, marginTop:6,
              padding:"9px 12px", borderRadius:12, background:"rgba(0,0,0,.18)",
            }}>
              <GradeBadge grade={ally.performance.grade} size={26} />
              <span style={{ fontSize:12, color:"#cbd5e1" }}>{ally.name || "隊友"}</span>
              {mvp?.id === ally.id && (
                <span style={{ fontSize:10, fontWeight:900, color:"#fbbf24", background:"rgba(251,191,36,.15)", padding:"2px 7px", borderRadius:6 }}>MVP</span>
              )}
              <span style={{ marginLeft:"auto", fontSize:11, color:"#64748b" }}>{ally.performance.score} 分</span>
            </div>
          ))}
          {isSolo && (
            <div style={{ fontSize:10, color:"#64748b", marginTop:8 }}>
              單人遠征沒有隊友評比，MVP 只在組隊時顯示。
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{ marginTop:24, textAlign:"center" }}>
          {canContinue ? (
            <button type="button" onClick={onContinue}
              style={{
                width:"100%", minHeight:52, borderRadius:14, border:"none", cursor:"pointer",
                fontSize:16, fontWeight:900, color:"#fff",
                background: isBoss
                  ? "linear-gradient(90deg,#f59e0b,#d97706)"
                  : "linear-gradient(90deg,#10b981,#059669)",
              }}>
              {continueLabel}
            </button>
          ) : (
            <div style={{
              width:"100%", minHeight:52, borderRadius:14, display:"flex",
              alignItems:"center", justifyContent:"center",
              fontSize:14, fontWeight:800, color:"#94a3b8",
              background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)",
            }}>
              ⏳ {waitingLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
