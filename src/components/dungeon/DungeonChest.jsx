// src/components/dungeon/DungeonChest.jsx — 地下城寶箱房間（動畫強化版）
import { useState, useEffect, useMemo, useRef } from "react";
import { confirmNonCombatRoom, ensureChestRoomLoot, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { createOrdinaryChestLoot } from "../../lib/dungeonChestLoot";
import { sfxOpenChest, sfxCoinDrop } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

// 粒子背景
function Particles({ count = 16, color = "rgba(74,222,128" }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 2 + Math.random() * 4, delay: Math.random() * 5,
    duration: 4 + Math.random() * 6, opacity: 0.1 + Math.random() * 0.3,
  })), [count]);
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
          width:p.size, height:p.size, borderRadius:"50%",
          background:`${color},0.5)`,
          boxShadow:`0 0 6px ${color},0.3)`,
          animation:`ch-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          opacity: p.opacity,
        }}/>
      ))}
      <style>{`@keyframes ch-particle{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-40px) scale(1.5)}}`}</style>
    </div>
  );
}

// 金幣噴泉
function CoinFountain({ count = 12 }) {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:50 }}>
      <style>{`@keyframes ch-coin-fly{0%{opacity:0;transform:translateY(0) scale(0.5)}15%{opacity:1;transform:translateY(-30px) scale(1.2) rotate(-30deg)}100%{opacity:0;transform:translateY(-100px) scale(0.6) rotate(60deg) translateX(var(--dx))}}`}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:"50%", top:"35%",
          fontSize:14 + Math.random() * 12,
          "--dx": `${-40 + Math.random() * 80}px`,
          animation:`ch-coin-fly ${1 + Math.random() * 0.8}s ease-out ${Math.random() * 0.4}s forwards`,
        }}>
          {["🪙","✨","💰","⭐"][Math.floor(Math.random() * 4)]}
        </div>
      ))}
    </div>
  );
}

// 光線放射效果
function LightRays() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:40, overflow:"hidden" }}>
      <style>{`@keyframes ch-ray{0%{transform:rotate(0deg) scale(0.3);opacity:0}30%{opacity:0.4}100%{transform:rotate(360deg) scale(1);opacity:0}}`}</style>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:"50%", top:"30%",
          width:2, height: "60vh",
          background:"linear-gradient(to top, rgba(251,191,36,0.4), transparent)",
          transformOrigin:"bottom center",
          transform:`rotate(${i * 45}deg)`,
          animation:`ch-ray 2s ease-out ${i * 0.15}s forwards`,
        }}/>
      ))}
    </div>
  );
}

// 收藏品翻牌
function ItemReveal({ item, delay = 0, isHidden = false }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      perspective: 600, width: "100%", maxWidth: 260, height: 90,
      animation: flipped ? undefined : "ch-card-enter 0.5s ease both",
    }}>
      <style>{`
@keyframes ch-card-enter{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
@keyframes ch-card-flip{0%{transform:rotateY(0deg)}100%{transform:rotateY(180deg)}}
      `}</style>
      <div style={{
        width:"100%", height:"100%", position:"relative",
        transformStyle:"preserve-3d",
        animation: flipped ? "ch-card-flip 0.6s cubic-bezier(0.4,0,0.2,1) forwards" : undefined,
      }}>
        {/* 背面（卡片背面） */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          borderRadius:14,
          background: isHidden ? "linear-gradient(135deg,#3b0764,#581c87)" : "linear-gradient(135deg,#78350f,#92400e)",
          border:`2px solid ${isHidden ? "#a855f7" : "#f59e0b"}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:28,
        }}>
          ❓
        </div>
        {/* 正面（物品內容） */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          transform:"rotateY(180deg)",
          borderRadius:14,
          background: isHidden ? "rgba(88,28,135,0.3)" : "rgba(255,255,255,0.06)",
          border:`1px solid ${isHidden ? "rgba(168,85,247,0.4)" : "rgba(251,191,36,0.3)"}`,
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          padding:"0 14px",
        }}>
          <span style={{ fontSize:32, filter:"drop-shadow(0 0 8px rgba(251,191,36,0.4))" }}>{item.icon}</span>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize:14, fontWeight:900, color: isHidden ? "#c084fc" : "#fbbf24" }}>{item.name}</div>
            <div style={{ fontSize:10, color:"#94a3b8" }}>{item.desc || "收藏品"}</div>
            <div style={{ fontSize:9, color: isHidden ? "#a855f7" : "#a78bfa", marginTop:2, fontWeight:700 }}>
              {isHidden ? "✦ 隱藏獎勵" : "🔮 收藏品"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// localMode（遠征單人）：金幣透過 onLocalEffect({type:"coins"}) 交給父層，
// 收藏品照常寫入 member 文件；結束呼叫 onLocalDone，不寫房間文件
export default function DungeonChest({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
}) {
  const [animPhase, setAnimPhase] = useState("entering"); // entering | opening | reveal | done
  const [confirmed, setConfirmed] = useState(false);
  const [showFountain, setShowFountain] = useState(false);
  const [showRays, setShowRays] = useState(false);
  const [localConfirms, setLocalConfirms] = useState({});
  const [rewardIndex, setRewardIndex] = useState(0);
  const [claimingReward, setClaimingReward] = useState(false);
  const chestSeedRef = useRef(null);

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms = localMode ? localConfirms : (room?.roomConfirms || {});
  const dungeonMapId = room?.mapDungeonId || "";
  const family = dungeonMapId.split("_")[0] || "ghost";
  const isHidden = !!room?.hiddenRoomLoot?.found;
  if (!chestSeedRef.current) {
    chestSeedRef.current = createOrdinaryChestLoot({
      family,
      difficultyTier: room?.expeditionDifficulty || room?.dungeonDifficulty || 1,
      hidden: isHidden,
    });
  }
  const chestLoot = localMode ? chestSeedRef.current : (room?.chestLoot || null);
  // 每次只顯示一份獎勵，玩家確認後才寫入背包並翻到下一張。
  const rewardQueue = useMemo(() => {
    if (!chestLoot) return [];
    const rewards = [];
    if (chestLoot.coins > 0) rewards.push({ key:"coins", kind:"coins", icon:"🪙", name:"金幣", amount:chestLoot.coins, desc:"收入金幣背包" });
    if (chestLoot.item) rewards.push({ key:`item-${chestLoot.item.id}`, kind:"item", icon:chestLoot.item.icon || "✨", name:chestLoot.item.name, desc:chestLoot.item.desc || "地下城收藏品", item:chestLoot.item });
    if (chestLoot.material) rewards.push({ key:`material-${chestLoot.material.id || chestLoot.material.name}`, kind:"material", icon:chestLoot.material.icon || "🧱", name:chestLoot.material.name, desc:chestLoot.material.desc || "製作素材", material:chestLoot.material });
    return rewards;
  }, [chestLoot]);
  const currentReward = rewardQueue[rewardIndex] || null;

  useEffect(() => {
    if (localMode || !isHost || room?.chestLoot || !roomId || !chestSeedRef.current) return;
    ensureChestRoomLoot(roomId, memberId, chestSeedRef.current).catch(() => {});
  }, [localMode, isHost, room?.chestLoot, roomId, memberId]);

  // 自動播放開箱動畫
  useEffect(() => {
    const t1 = setTimeout(() => {
      setAnimPhase("opening"); setShowRays(true);
      sfxOpenChest();
    }, 500);
    const t2 = setTimeout(() => {
      setAnimPhase("reveal"); setShowFountain(true);
      sfxCoinDrop();
    }, 1600);
    const t3 = setTimeout(() => setShowFountain(false), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line

  async function handleConfirm() {
    if (confirmed) return;
    sfxCoinDrop();
    setConfirmed(true);
    if (localMode) {
      // 本地單人：金幣交由父層發放（含音效），收藏品照常入背包
      if (chestLoot.coins > 0) onLocalEffect?.({ type:"coins", value: chestLoot.coins });
      if (chestLoot.material) {
        const { addMaterials } = await import("../../lib/db");
        addMaterials(memberId, [chestLoot.material]).catch(() => {});
      }
      if (chestLoot.item) {
        const { addCollectibles } = await import("../../lib/dungeonDb");
        addCollectibles(memberId, [{ itemId: chestLoot.item.id, qty: 1 }]).catch(() => {});
      }
      setLocalConfirms({ [memberId]: true });
      return;
    }
    const { addCoins, addMaterials } = await import("../../lib/db");
    const { addCollectibles } = await import("../../lib/dungeonDb");
    if (chestLoot.coins > 0) {
      addCoins(memberId, chestLoot.coins).catch(() => {});
    }
    if (chestLoot.item) {
      addCollectibles(memberId, [{ itemId: chestLoot.item.id, qty: 1 }]).catch(() => {});
    }
    if (chestLoot.material) addMaterials(memberId, [chestLoot.material]).catch(() => {});
    await confirmNonCombatRoom(roomId, memberId, "opened");
  }

  async function handleClaimReward() {
    if (!currentReward || confirmed || claimingReward) return;
    setClaimingReward(true);
    sfxCoinDrop();
    try {
      if (currentReward.kind === "coins") {
        if (localMode) onLocalEffect?.({ type:"coins", value:currentReward.amount });
        else {
          const { addCoins } = await import("../../lib/db");
          await addCoins(memberId, currentReward.amount);
        }
      } else if (currentReward.kind === "material") {
        const { addMaterials } = await import("../../lib/db");
        await addMaterials(memberId, [currentReward.material]);
      } else {
        const { addCollectibles } = await import("../../lib/dungeonDb");
        await addCollectibles(memberId, [{ itemId:currentReward.item.id, qty:1 }]);
      }
      const nextIndex = rewardIndex + 1;
      if (nextIndex < rewardQueue.length) {
        setRewardIndex(nextIndex);
      } else {
        setConfirmed(true);
        setAnimPhase("done");
        setShowRays(false);
        if (localMode) setLocalConfirms({ [memberId]: true });
        else await confirmNonCombatRoom(roomId, memberId, "opened");
      }
    } finally {
      setClaimingReward(false);
    }
  }

  async function handleResolve() {
    if (!isHost) return;
    if (localMode) {
      onLocalDone?.();
      return;
    }
    if (onSharedDone) {
      await onSharedDone();
      return;
    }
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const allConfirmed = aliveIds.every(id => roomConfirms[id]);

  return (
    <DungeonEventStage tone="chest" className={isHidden ? "dungeon-event-stage--hidden" : ""}>
      <Particles count={isHidden ? 22 : 16} color={isHidden ? "rgba(168,85,247" : "rgba(74,222,128"} />
      {showRays && <LightRays />}
      {showFountain && <CoinFountain count={isHidden ? 16 : 10} />}

      <style>{`
@keyframes ch-glow{0%,100%{filter:drop-shadow(0 0 10px rgba(251,191,36,0.4))}50%{filter:drop-shadow(0 0 30px rgba(251,191,36,0.8))}}
@keyframes ch-glow-purple{0%,100%{filter:drop-shadow(0 0 10px rgba(168,85,247,0.4))}50%{filter:drop-shadow(0 0 30px rgba(168,85,247,0.8))}}
@keyframes ch-shine{0%{opacity:0;transform:scale(0.3) rotate(-20deg)}55%{opacity:1;transform:scale(1.15) rotate(5deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes ch-coin-pop{0%{opacity:0;transform:translateY(30px) scale(0.3)}50%{opacity:1;transform:translateY(-8px) scale(1.15)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ch-item-slide{0%{opacity:0;transform:translateY(40px)}100%{opacity:1;transform:translateY(0)}}
@keyframes ch-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes ch-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-12px)}60%{transform:translateY(-4px)}}
@keyframes ch-sparkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1.3)}}
@keyframes ch-chest-lid{0%{transform:rotateX(0)}60%{transform:rotateX(-70deg)}100%{transform:rotateX(-80deg)}}
      `}</style>

      {/* Header */}
      <div className="dungeon-stage-header shrink-0 text-center py-6 border-b" style={{
        borderColor: isHidden ? "rgba(168,85,247,0.2)" : "rgba(74,222,128,0.2)",
        animation: animPhase === "entering" ? "ch-pulse 0.8s ease infinite" : undefined,
      }}>
        <div className="text-5xl mb-2" style={{
          display:"inline-block", borderRadius:"50%", padding:6,
          animation: animPhase === "opening"
            ? (isHidden ? "ch-glow-purple 0.4s ease infinite" : "ch-glow 0.4s ease infinite")
            : animPhase === "reveal" ? "ch-bounce 0.6s ease 2" : undefined,
        }}>
          {animPhase === "entering" ? "📦" : animPhase === "opening" ? (isHidden ? "🔮" : "✨") : animPhase === "reveal" ? "🎁" : "📖"}
        </div>
        <div className="text-2xl font-black" style={{ color: isHidden ? "#a78bfa" : "#4ade80" }}>
          {isHidden ? "發現隱藏房間！" : "發現寶箱！"}
        </div>
        <div className="text-sm mt-1" style={{ color: isHidden ? "rgba(167,139,250,0.6)" : "rgba(52,211,153,0.6)" }}>
          {animPhase === "entering"
            ? (isHidden ? "牆壁後面有秘密通道！" : "一個閃閃發亮的寶箱出現在眼前…")
            : animPhase === "opening" ? "寶箱正在打開…" : animPhase === "reveal" ? "寶箱已開啟！" : ""}
        </div>
      </div>

      {/* 寶箱內容 */}
      <div className="dungeon-stage-main flex flex-col items-center justify-center px-6 py-8 gap-6">
        {/* 開箱中動畫 */}
        {animPhase === "opening" && (
          <div className="text-center" style={{ perspective: 400 }}>
            <div style={{
              fontSize:72, display:"inline-block",
              transformOrigin:"bottom center",
              animation:"ch-chest-lid 1.2s ease-out forwards",
            }}>📦</div>
            <div className="mt-4 text-lg font-bold" style={{ color: isHidden ? "#a78bfa" : "#4ade80" }}>
              🔓 喀嚓… 寶箱開啟中
            </div>
            <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:12 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:8, height:8, borderRadius:"50%",
                  background: isHidden ? "#a855f7" : "#4ade80",
                  animation:`ch-sparkle 0.8s ease ${i*0.25}s infinite`,
                }}/>
              ))}
            </div>
          </div>
        )}

        {/* 寶物展示 */}
        {false && animPhase === "reveal" && chestLoot && (
          <>
            {chestLoot.coins > 0 && (
              <div className="text-center" style={{ animation:"ch-coin-pop 0.5s ease both" }}>
                <div className="text-5xl mb-1">{isHidden ? "🤫" : "🪙"}</div>
                <div className="text-3xl font-black" style={{ color:"#fbbf24" }}>
                  +{chestLoot.coins}
                </div>
                <div className="text-sm" style={{ color: isHidden ? "rgba(167,139,250,0.7)" : "rgba(251,191,36,0.7)" }}>
                  {isHidden ? "隱藏獎勵金幣" : "金幣"}
                </div>
              </div>
            )}

            {chestLoot.item && (
              <div style={{ animation:"ch-item-slide 0.6s 0.3s ease both" }}>
                <ItemReveal item={chestLoot.item} delay={100} isHidden={isHidden} />
              </div>
            )}

            {chestLoot.material && (
              <div style={{ animation:"ch-item-slide 0.6s 0.2s ease both" }}>
                <ItemReveal item={chestLoot.material} delay={80} isHidden={isHidden} />
              </div>
            )}

            {!chestLoot.coins && !chestLoot.item && !chestLoot.material && (
              <div className="text-center text-slate-500 text-lg">寶箱是空的…</div>
            )}
          </>
        )}

        {/* 全部完成 */}
        {animPhase === "reveal" && (
          currentReward ? (
            <div key={currentReward.key} className="flex flex-col items-center gap-3" style={{ animation:"ch-item-slide 0.45s ease both" }}>
              <ItemReveal item={{ icon:currentReward.icon, name:currentReward.name, desc:currentReward.desc }} delay={60} isHidden={isHidden} />
              {currentReward.kind === "coins" && <div className="text-3xl font-black" style={{ color:"#fbbf24" }}>+{currentReward.amount}</div>}
              <div className="text-xs font-bold" style={{ color:isHidden ? "#c084fc" : "#86efac" }}>獎勵 {rewardIndex + 1} / {rewardQueue.length}</div>
            </div>
          ) : <div className="text-center text-slate-500 text-lg">寶箱裡沒有可領取的物品</div>
        )}

        {animPhase === "done" && (
          <div className="text-center space-y-2" style={{ animation:"ch-item-slide 0.5s ease both" }}>
            <div className="text-lg font-bold" style={{ color: isHidden ? "#c084fc" : "#4ade80" }}>
              {chestLoot?.coins > 0 || chestLoot?.item ? "✨ 寶物已收入背包！" : "繼續前進吧！"}
            </div>
            <div className="text-xs text-slate-500">點擊下方按鈕領取並繼續</div>
          </div>
        )}
      </div>

      {/* 已確認成員 */}
      {Object.keys(roomConfirms).length > 0 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex justify-center gap-2 flex-wrap">
            {Object.keys(roomConfirms).map(id => (
              <span key={id} className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30"
                style={{ animation:"ch-coin-pop 0.3s ease both" }}>
                ✅ {members[id]?.name || id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="shrink-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 border-t space-y-3" style={{
        borderColor: isHidden ? "rgba(168,85,247,0.2)" : "rgba(74,222,128,0.25)",
      }}>
        {!confirmed ? (
          <button onClick={handleClaimReward} disabled={animPhase !== "reveal" || !currentReward || claimingReward}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg disabled:opacity-40 transition-all"
            style={{
              background: animPhase === "reveal" && currentReward
                ? (isHidden
                  ? "linear-gradient(90deg,#7c3aed,#a855f7)"
                  : "linear-gradient(90deg,#f59e0b,#eab308)")
                : "rgba(255,255,255,0.1)",
              color: animPhase === "reveal" && currentReward ? "white" : "rgba(255,255,255,0.4)",
            }}
            onMouseEnter={e => { if (animPhase === "reveal" && currentReward) e.currentTarget.style.transform = "scale(1.02)"; }}
            onMouseLeave={e => { if (animPhase === "done") e.currentTarget.style.transform = ""; }}>
            {animPhase !== "done" ? "⏳ 寶箱開啟中…" : isHidden ? "💰 領取隱藏獎勵！" : "💰 領取寶物，繼續前進"}
          </button>
        ) : isHost && !allConfirmed ? (
          <div className="text-center text-slate-400 text-sm py-2">等待其他隊員領取寶物…</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{
              background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white",
              boxShadow: "0 0 20px rgba(34,197,94,0.3)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
            🗺️ 繼續探索
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已領取，等待房主繼續</div>
        )}

        {isHost && confirmed && !allConfirmed && (
          <button onClick={handleResolve}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold"
            style={{
              background:"rgba(217,119,6,0.3)", border:"1px solid rgba(217,119,6,0.4)",
              transition:"all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(217,119,6,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(217,119,6,0.3)"; }}>
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已領取）
          </button>
        )}
      </div>
    </DungeonEventStage>
  );
}
