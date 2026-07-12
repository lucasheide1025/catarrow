// src/components/member/GatheringBattle.jsx — 議會廳採集戰鬥
import { useState, useRef, useEffect } from "react";
import {
  COUNCIL_MONSTERS, GATHER_TIER, TIER_ORDER,
  BASE_GATHER_POWER, GATHER_POWER_VARIANCE, PLAYER_STAMINA,
  CLEAR_GACHA_COINS, CLEAR_VILLAGE_MAT_COUNT, getRaceMaterialId,
} from "../../lib/councilMonsters";
import { sfxGatherClick, sfxGatherDefeat, sfxGatherFail, sfxGatherVictory } from "../../lib/sound";

const STYLE = `
@keyframes gbShake {
  0%,100%{transform:translateX(0)}
  25%{transform:translateX(-6px)}
  75%{transform:translateX(6px)}
}
@keyframes gbPop {
  0%{transform:scale(0.6);opacity:0}
  60%{transform:scale(1.15)}
  100%{transform:scale(1);opacity:1}
}
@keyframes gbFadeUp {
  from{opacity:0;transform:translateY(8px)}
  to{opacity:1;transform:translateY(0)}
}
`;

function gatheringTargetUrl(siteId, tier) {
  return `/council/obs/${siteId}_${tier}.webp`;
}

// 計算村莊 tier（依建築平均等級）
function getVillageTier(village) {
  if (!village?.buildings) return 1;
  const lvs = Object.values(village.buildings);
  const avg = lvs.reduce((a, b) => a + b, 0) / (lvs.length || 1);
  if (avg >= 17) return 5;
  if (avg >= 13) return 4;
  if (avg >= 9)  return 3;
  if (avg >= 5)  return 2;
  return 1;
}

export default function GatheringBattle({ building, village, onFinish }) {
  const { id: bId, name: bName, emoji: bEmoji, race, villageMat, raceLabel } = building;
  const monsters = COUNCIL_MONSTERS[bId];

  const [tierIdx, setTierIdx]     = useState(0);
  const [monsterHp, setMonsterHp] = useState(GATHER_TIER[TIER_ORDER[0]].maxHp);
  const [stamina, setStamina]     = useState(PLAYER_STAMINA);
  const [logs, setLogs]           = useState([]);
  const [defeated, setDefeated]   = useState([]); // tier strings
  const [phase, setPhase]         = useState("battle"); // "battle" | "victory" | "fail"
  const [shaking, setShaking]     = useState(false);
  const logRef = useRef(null);

  const tier = TIER_ORDER[tierIdx];
  const tierCfg = GATHER_TIER[tier];
  const monster = monsters[tier];

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function pushLog(text) {
    setLogs(prev => [...prev.slice(-30), text]);
  }

  function handleGather() {
    if (phase !== "battle") return;
    const dmg = BASE_GATHER_POWER + Math.floor(Math.random() * GATHER_POWER_VARIANCE);
    sfxGatherClick();
    setShaking(true);
    setTimeout(() => setShaking(false), 350);

    const newHp = Math.max(0, monsterHp - dmg);
    pushLog(`你使勁${monster.action}，${monster.name}受到 ${dmg} 點損傷！`);

    if (newHp <= 0) {
      // monster defeated
      sfxGatherDefeat();
      const newDefeated = [...defeated, tier];
      pushLog(`✅ ${monster.name} 已被制服！獲得「${raceLabel}·${tierCfg.label}素材」`);
      const newStamina = stamina - tierCfg.staminaCost;
      setDefeated(newDefeated);

      if (newStamina <= 0) {
        // exhausted after defeating this monster
        setStamina(0);
        if (newDefeated.length === TIER_ORDER.length) {
          setPhase("victory");
          sfxGatherVictory();
        } else {
          pushLog("⚡ 體力耗盡，已無法繼續採集！");
          setPhase("fail");
          sfxGatherFail();
        }
        return;
      }

      const nextIdx = tierIdx + 1;
      if (nextIdx >= TIER_ORDER.length) {
        setStamina(newStamina);
        setPhase("victory");
        sfxGatherVictory();
        pushLog("🎉 全部採集完成！");
      } else {
        setStamina(newStamina);
        setTierIdx(nextIdx);
        const nextTier = TIER_ORDER[nextIdx];
        setMonsterHp(GATHER_TIER[nextTier].maxHp);
        pushLog(`下一個：${GATHER_TIER[nextTier].label} ${COUNCIL_MONSTERS[bId][nextTier].name}`);
      }
    } else {
      setMonsterHp(newHp);
    }
  }

  function handleFlee() {
    sfxGatherFail();
    pushLog("你選擇放棄採集，帶著已獲得的素材離去…");
    setPhase("fail");
  }

  // 計算獎勵
  const villageTier = getVillageTier(village);
  const isFullClear = defeated.length === TIER_ORDER.length;
  const raceMaterials = defeated.map(t => ({ id: getRaceMaterialId(race, t), count: 1 }));
  const villageMatKey = `${villageMat}_t${villageTier}`;

  return (
    <>
      <style>{STYLE}</style>
      <div style={{
        minHeight: "100%", background: "linear-gradient(160deg,#fdf6ec 0%,#fef9f0 100%)",
        display: "flex", flexDirection: "column", padding: "12px 12px 80px",
      }}>

        {/* 標頭 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={() => onFinish([])}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>
            ←
          </button>
          <span style={{ fontSize: 20 }}>{bEmoji}</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{bName}採集</div>
            <div style={{ fontSize: 11, color: "#78716c" }}>{raceLabel}素材</div>
          </div>
        </div>

        {/* 體力條 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 3 }}>
            <span>⚡ 體力</span>
            <span>{stamina} / {PLAYER_STAMINA}</span>
          </div>
          <div style={{ height: 10, background: "#fde8c5", borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${Math.max(0, stamina / PLAYER_STAMINA * 100)}%`,
              background: stamina > 40 ? "#f59e0b" : "#ef4444",
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>

        {/* 進度 dots */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, justifyContent: "center" }}>
          {TIER_ORDER.map((t, i) => {
            const done = defeated.includes(t);
            const current = i === tierIdx && phase === "battle";
            return (
              <div key={t} style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
                background: done ? GATHER_TIER[t].color : current ? "#fff" : "#f1f5f9",
                border: `2px solid ${done || current ? GATHER_TIER[t].color : "#e2e8f0"}`,
                transition: "all 0.3s",
                boxShadow: current ? `0 0 0 3px ${GATHER_TIER[t].color}44` : "none",
              }}>
                {done ? "✓" : <img src={gatheringTargetUrl(bId, t)} alt="" style={{ width:24, height:24, objectFit:"contain" }} />}
              </div>
            );
          })}
        </div>

        {/* 怪物卡 */}
        {phase === "battle" && (
          <div style={{
            background: monster.bgColor, borderRadius: 16, padding: 16, marginBottom: 12,
            border: `2px solid ${tierCfg.color}44`,
            animation: shaking ? "gbShake 0.35s ease" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <img src={gatheringTargetUrl(bId, tier)} alt={monster.name} style={{ width:72, height:72, objectFit:"contain", flexShrink:0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{
                    background: tierCfg.color, color: "white",
                    fontSize: 10, fontWeight: 900, borderRadius: 99, padding: "1px 7px",
                  }}>{tierCfg.label}</span>
                  <span style={{ fontWeight: 900, fontSize: 15 }}>{monster.name}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>正在：{monster.action}</div>
              </div>
            </div>
            {/* HP 條 */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 3 }}>
                <span>干擾值</span>
                <span>{monsterHp} / {tierCfg.maxHp}</span>
              </div>
              <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  width: `${monsterHp / tierCfg.maxHp * 100}%`,
                  background: tierCfg.color,
                  transition: "width 0.25s ease",
                }} />
              </div>
            </div>
          </div>
        )}

        {/* 結算畫面 */}
        {phase !== "battle" && (
          <div style={{
            background: "white", borderRadius: 16, padding: 20, marginBottom: 12,
            textAlign: "center", animation: "gbPop 0.4s ease",
            border: `2px solid ${isFullClear ? "#16a34a" : "#f59e0b"}44`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{isFullClear ? "🎉" : "😮‍💨"}</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>
              {isFullClear ? "採集完成！" : "採集中斷"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              {isFullClear ? "成功制服全部阻礙，村莊有豐盛收穫" : `共制服 ${defeated.length} 隻障礙`}
            </div>

            {/* 獎勵清單 */}
            <div style={{ textAlign: "left", background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: "#475569" }}>獲得的素材：</div>
              {raceMaterials.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>無</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {raceMaterials.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{
                        background: GATHER_TIER[defeated[i]].color, color: "white",
                        borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 800,
                      }}>{GATHER_TIER[defeated[i]].label}</span>
                      <span>{raceLabel}素材 ×1</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>({m.id})</span>
                    </div>
                  ))}
                </div>
              )}
              {isFullClear && (
                <>
                  <div style={{ height: 1, background: "#e2e8f0", margin: "10px 0" }} />
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: "#16a34a" }}>全通關獎勵：</div>
                  <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span>🏡 村莊材料（{villageMat} T{villageTier}）×{CLEAR_VILLAGE_MAT_COUNT}</span>
                    <span>🪙 扭蛋幣 ×{CLEAR_GACHA_COINS}</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => onFinish({ raceMaterials, villageMatKey, isFullClear })}
              style={{
                width: "100%", padding: "12px", borderRadius: 12,
                background: "#16a34a", color: "white", fontWeight: 900, fontSize: 15,
                border: "none", cursor: "pointer",
              }}>
              領取並離開
            </button>
          </div>
        )}

        {/* 戰鬥日誌 */}
        <div ref={logRef} style={{
          flex: 1, background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 10,
          fontSize: 12, color: "#44403c", lineHeight: 1.7,
          maxHeight: 160, overflowY: "auto", marginBottom: 12,
        }}>
          {logs.length === 0
            ? <div style={{ color: "#a8a29e", fontStyle: "italic" }}>點「採集」開始任務…</div>
            : logs.map((l, i) => (
              <div key={i} style={{ animation: i === logs.length - 1 ? "gbFadeUp 0.25s ease" : "none" }}>
                {l}
              </div>
            ))
          }
        </div>

        {/* 操作按鈕 */}
        {phase === "battle" && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleGather}
              style={{
                flex: 3, padding: "16px", borderRadius: 14,
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                color: "white", fontWeight: 900, fontSize: 17,
                border: "none", cursor: "pointer",
                boxShadow: "0 4px 12px #f59e0b44",
                letterSpacing: 1,
              }}>
              ⛏ 採集
            </button>
            <button
              onClick={handleFlee}
              style={{
                flex: 1, padding: "16px", borderRadius: 14,
                background: "#f1f5f9", color: "#64748b", fontWeight: 700, fontSize: 14,
                border: "1px solid #e2e8f0", cursor: "pointer",
              }}>
              撤退
            </button>
          </div>
        )}
      </div>
    </>
  );
}
