// src/components/dungeon/DungeonExpeditionResult.jsx
// 遠征獎勵結算畫面 — 動畫式顯示獎勵明細

import { useState, useEffect } from "react";
import { getExcavationDifficulty } from "../../lib/dungeonData";
import { summarizeExpeditionChests } from "../../lib/expeditionRewards";
import { BattleResultPanel, RESULT_CONFIG_DUNGEON } from "../shared/BattleResultPanel";

const FAMILY_LABEL = {
  ghost:     { emoji:"👻", label:"幽冥系" },
  mountain:  { emoji:"⛰️", label:"山嶺系" },
  insect:    { emoji:"🦋", label:"昆蟲系" },
  workplace: { emoji:"💼", label:"職場系" },
  exam:      { emoji:"📝", label:"考試系" },
  temple:    { emoji:"🏛️", label:"神廟系" },
  treasure:  { emoji:"📦", label:"寶箱族" },
};

export default function DungeonExpeditionResult({
  won,
  family,
  difficultyTier,
  isHidden,
  rewards,        // { coins, arrowDew, archerXP } — 通關獎勵，按下領取才發放
  killTotals,     // { coins, archerXP, kills } — 沿路擊殺，戰鬥當下就已入帳
  loot,
  party,
  boss,
  error,
  floorsCleared,
  onFinish,        // 領取獎勵後回調
}) {
  const [phase, setPhase] = useState("enter"); // enter → show → rewards → done
  const [claimed, setClaimed] = useState(false);

  const diff = getExcavationDifficulty(difficultyTier);
  const familyMeta = FAMILY_LABEL[family] || { emoji:"🏰", label:"地下城" };
  const chestSummary = summarizeExpeditionChests(loot?.chests);
  // 獎勵有兩份來源，之前結算頁只算了通關獎勵，玩家實際拿到的比顯示的多：
  // ① 沿路擊殺 —— 每殺一隻當下就 addCoins/addArcherXP 入帳了（killTotals）
  // ② 通關獎勵 —— 按下「領取獎勵」才由 grantExpeditionRewards 發放（rewards）
  // 這裡把兩份都列出來並加總，數字才跟玩家實際到手的一致。
  const clearCoins = (rewards?.coins || 0) + (loot?.bonusCoins || 0);
  const clearArcherXP = rewards?.archerXP || 0;
  const killCoins = killTotals?.coins || 0;
  const killArcherXP = killTotals?.archerXP || 0;
  const totalCoins = clearCoins + killCoins;
  const totalArcherXP = clearArcherXP + killArcherXP;
  const hasKillRewards = killCoins > 0 || killArcherXP > 0;
  const totalArrowDew = (rewards?.arrowDew || 0) + (loot?.bonusArrowDew || 0);
  const partyMembers = party?.members || [];
  const totalDamage = partyMembers.reduce((sum, member) => sum + (member.dmgDealt || 0), 0);
  const totalDamageTaken = partyMembers.reduce((sum, member) => sum + (member.dmgTaken || 0), 0);
  const displayBoss = boss || {
    id:"expedition_boss",
    name:"地下城守關首領",
    icon:"👑",
    tier:["common","rare","elite","fierce","boss","mythic"][difficultyTier - 1] || "common",
    family,
    variant:"boss",
  };
  const reportData = {
    monster: { ...displayBoss, isDungeonBoss:true },
    drops: {
      coins: totalCoins,
      chest: chestSummary.some(item => item.key.startsWith("material:")),
      goldChest: chestSummary.some(item => item.key.startsWith("coin:")),
      arrowDew: totalArrowDew,
    },
    stats: { dmgDealt:totalDamage, dmgTaken:totalDamageTaken },
    party,
  };

  // 進場動畫
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 600);
    const t2 = setTimeout(() => setPhase("rewards"), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  async function handleClaim() {
    if (claimed) return;
    setClaimed(true);
    setPhase("done");
    await new Promise(resolve => setTimeout(resolve, 500));
    const completed = await onFinish?.();
    if (completed === false) {
      setClaimed(false);
      setPhase("rewards");
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start px-5 py-8 text-white overflow-y-auto"
      style={{
        background: won
          ? "linear-gradient(160deg,#0a1a0a 0%,#0f2e1a 50%,#0a1a0a 100%)"
          : "linear-gradient(160deg,#1a0a0a 0%,#2d0a0a 50%,#1a0a0a 100%)",
      }}>
      {/* 主圖示 */}
      <div style={{
        fontSize: 72,
        animation: phase === "enter" ? "er-bounce 0.8s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
        opacity: phase === "enter" ? 0 : 1,
        transform: phase === "show" ? "scale(1)" : undefined,
        transition: "opacity 0.5s",
      }}>
        {won ? "🏆" : "💀"}
      </div>

      {/* 標題 */}
      <div style={{
        fontSize: 26, fontWeight: 900, marginTop: 8,
        color: won ? "#4ade80" : "#f87171",
        animation: phase !== "enter" ? "er-fade 0.5s 0.3s ease both" : "none",
        opacity: phase === "enter" ? 0 : 1,
      }}>
        {won ? "遠征成功！" : "遠征失敗"}
      </div>

      {/* 地下城資訊 */}
      <div style={{
        display:"flex", alignItems:"center", gap:6, marginTop:4,
        opacity: phase === "enter" ? 0 : 1,
        transition: "opacity 0.5s 0.5s",
      }}>
        <span style={{ fontSize:16 }}>{familyMeta.emoji}</span>
        <span style={{ fontSize:12, color:"#94a3b8" }}>{familyMeta.label}</span>
        <span style={{
          fontSize:10, padding:"1px 6px", borderRadius:6,
          background:`${diff?.color || "#94a3b8"}22`,
          color: diff?.color || "#94a3b8",
        }}>
          {diff?.icon} {diff?.label} Lv.{difficultyTier}
        </span>
        {isHidden && (
          <span style={{ fontSize:10, padding:"1px 6px", borderRadius:6, background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>🎁 隱藏</span>
        )}
      </div>

      {/* 進度統計 */}
      <div style={{
        display:"flex", gap:20, marginTop:24,
        opacity: phase === "enter" || phase === "show" ? 0 : 1,
        animation: phase === "rewards" ? "er-fade 0.5s both" : "none",
      }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, fontWeight:900, color: won ? "#4ade80" : "#f87171" }}>{floorsCleared}/3</div>
          <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>層數</div>
        </div>
        <div style={{ width:1, background:"rgba(255,255,255,0.1)" }} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, fontWeight:900, color:"#fbbf24" }}>+{totalCoins}</div>
          <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>🪙 金幣</div>
        </div>
        <div style={{ width:1, background:"rgba(255,255,255,0.1)" }} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, fontWeight:900, color:"#60a5fa" }}>+{totalArrowDew}</div>
          <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>💧 箭露</div>
        </div>
      </div>

      {/* 經驗值 */}
      <div style={{
        marginTop:16, padding:"8px 20px", borderRadius:12,
        background:"rgba(251,191,36,0.08)",
        border:"1px solid rgba(251,191,36,0.15)",
        opacity: phase === "rewards" ? 1 : 0,
        animation: phase === "rewards" ? "er-fade 0.5s 0.2s both" : "none",
      }}>
        <span style={{ fontSize:13, fontWeight:700, color:"#fbbf24" }}>
          ⚔️ 冒險經驗 +{totalArcherXP}
        </span>
      </div>

      {/* 隱藏獎勵提示 */}
      {won && isHidden && (
        <div style={{
          marginTop:8, padding:"6px 16px", borderRadius:8,
          background:"rgba(251,191,36,0.1)",
          fontSize:11, color:"#fbbf24", fontWeight:600,
          opacity: phase === "rewards" ? 1 : 0,
          animation: phase === "rewards" ? "er-fade 0.5s 0.4s both" : "none",
        }}>
          🎁 隱藏地下城額外獎勵已加算！
        </div>
      )}

      {error && (
        <div className="w-full max-w-lg mt-4 rounded-xl px-4 py-3 text-sm text-rose-200"
          style={{ background:"rgba(127,29,29,0.45)", border:"1px solid rgba(248,113,113,0.35)" }}>
          ⚠️ {error}
        </div>
      )}

      <div className="w-full max-w-lg mt-6 space-y-4">
        <div className="rounded-2xl p-4"
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)" }}>
          <div className="text-base font-black text-white mb-3">📦 本次遠征總收穫</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl p-3 bg-black/20">
              <div className="text-slate-400">金幣總計</div>
              <div className="text-lg font-black text-amber-300">+{totalCoins}</div>
            </div>
            <div className="rounded-xl p-3 bg-black/20">
              <div className="text-slate-400">箭露</div>
              <div className="text-lg font-black text-sky-300">+{totalArrowDew}</div>
            </div>
            <div className="rounded-xl p-3 bg-black/20">
              <div className="text-slate-400">射手經驗</div>
              <div className="text-lg font-black text-violet-300">+{totalArcherXP}</div>
            </div>
            <div className="rounded-xl p-3 bg-black/20">
              <div className="text-slate-400">擊敗怪物</div>
              <div className="text-lg font-black text-rose-300">
                {loot?.defeated?.length || killTotals?.kills || 0} 隻
              </div>
            </div>
          </div>

          {/* 金幣／經驗的來源拆解：讓「總計」對得上玩家實際到手的數字 */}
          {hasKillRewards && (
            <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop:"1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">🗡️ 沿路擊殺 <span className="text-slate-500">（戰鬥當下已入帳）</span></span>
                <span className="font-bold text-slate-200">
                  🪙 {killCoins}　⚔️ {killArcherXP}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">🏁 通關獎勵 <span className="text-slate-500">（按下領取後發放）</span></span>
                <span className="font-bold text-slate-200">
                  🪙 {clearCoins}　⚔️ {clearArcherXP}
                </span>
              </div>
            </div>
          )}
          {chestSummary.length > 0 && (
            <div className="mt-3 space-y-2">
              {chestSummary.map(item => (
                <div key={item.key} className="flex items-center justify-between rounded-xl px-3 py-2 bg-black/20">
                  <span className="text-sm text-slate-200">
                    {item.icon} {item.family ? `${FAMILY_LABEL[item.family]?.label || item.family} ` : ""}{item.name}
                  </span>
                  <span className="font-black text-amber-300">×{item.count}</span>
                </div>
              ))}
            </div>
          )}
          {(loot?.treasure || []).length > 0 && (
            <div className="mt-3 pt-3 space-y-2" style={{ borderTop:"1px solid rgba(255,255,255,0.1)" }}>
              <div className="text-xs font-bold text-slate-400">寶藏房額外獎勵</div>
              {loot.treasure.map((item, index) => (
                <div key={`${item.id || item.name}-${index}`}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 bg-black/20">
                  <span className="text-xl">{item.icon || "🎁"}</span>
                  <span className="text-sm font-bold text-slate-200">{item.name || "神秘寶物"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <BattleResultPanel
          data={reportData}
          config={{
            ...RESULT_CONFIG_DUNGEON,
            showAvgScore:false,
            showArrowCount:false,
            showRoundCount:false,
            showCritCount:false,
            showScoreBreakdown:false,
            showPartyMembers:partyMembers.length > 0,
            showPartyLeader:partyMembers.length > 0,
          }}
        />
      </div>

      {/* 按鈕 */}
      <div style={{
        marginTop: 32,
        opacity: phase === "rewards" || phase === "done" ? 1 : 0,
        animation: phase === "rewards" ? "er-fade 0.5s 0.6s both" : "none",
        transition: "opacity 0.3s",
      }}>
        <button onClick={handleClaim} disabled={claimed}
          style={{
            padding: "14px 52px", borderRadius: 14, fontWeight: 900, fontSize: 16,
            border: "none", cursor: claimed ? "default" : "pointer",
            background: claimed
              ? "rgba(255,255,255,0.1)"
              : "linear-gradient(90deg, #f59e0b, #d97706)",
            color: "white",
            transition: "all 0.2s",
          }}>
          {claimed ? "✅ 已領取" : (won ? "🎊 領取獎勵" : "返回大廳")}
        </button>
      </div>

      <style>{`
@keyframes er-bounce{0%{transform:scale(0.3) rotate(-20deg);opacity:0}55%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes er-fade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}
