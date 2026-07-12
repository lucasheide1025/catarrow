// src/components/dungeon/DungeonShop.jsx — 地下城商店（動畫強化版）
import { useState, useMemo, useEffect, useRef } from "react";
import { purchaseDungeonItem, confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { sfxDoorOpen, sfxError, sfxShopBuy, sfxSuccess, sfxTap } from "../../lib/sound";

// 擴充商店商品
const SHOP_ITEM_META = {
  hp_potion:       { name:"回復藥",      icon:"🧪", desc:"立即回復 30% 最大血量",          cost:50,  effect:"hp_restore",     value:0.3  },
  hp_max_boost:    { name:"生命上限符",   icon:"💚", desc:"永久提升 30% 最大血量（僅此局）", cost:100, effect:"hp_max_boost",   value:0.3  },
  atk_boost:       { name:"ATK 提升符",   icon:"⚔️", desc:"本次地下城 ATK ×1.2",            cost:80,  effect:"atk_mult",       value:1.2  },
  def_boost:       { name:"DEF 提升符",   icon:"🛡️", desc:"本次地下城 DEF ×1.2",            cost:80,  effect:"def_mult",       value:1.2  },
  atk_large:       { name:"ATK 狂戰符",   icon:"🔥", desc:"本次地下城 ATK ×1.5",            cost:150, effect:"atk_mult",       value:1.5  },
  def_large:       { name:"DEF 鐵壁符",   icon:"🏰", desc:"本次地下城 DEF ×1.5",            cost:150, effect:"def_mult",       value:1.5  },
  revival:         { name:"復活符",       icon:"💫", desc:"下次陣亡自動復活（30% HP）",     cost:100, effect:"revival"                   },
  revival_front:   { name:"前衛復活藥",   icon:"💊", desc:"復活一名倒地前衛（轉回前衛+50%HP）", cost:120, effect:"revival_front"             },
};

// 粒子：隨機飄動的光點
function Particles({ count = 20 }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 6,
    opacity: 0.15 + Math.random() * 0.35,
  })), [count]);
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
          width:p.size, height:p.size, borderRadius:"50%",
          background:"rgba(96,165,250,0.6)",
          boxShadow:"0 0 6px rgba(96,165,250,0.4)",
          animation: `s-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          opacity: p.opacity,
        }}/>
      ))}
      <style>{`@keyframes s-particle{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-60px) scale(1.4)}}`}</style>
    </div>
  );
}

// 購買成功飄字
function BuyFloat({ item, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position:"fixed", top:"40%", left:"50%", transform:"translateX(-50%)",
      zIndex:100, pointerEvents:"none",
      animation:"s-float-up 1.2s ease-out forwards",
      display:"flex", flexDirection:"column", alignItems:"center", gap:8,
    }}>
      <div style={{ fontSize:48 }}>{item.icon}</div>
      <div style={{ fontSize:18, fontWeight:900, color:"#fbbf24", textShadow:"0 2px 12px rgba(251,191,36,0.6)" }}>購買成功！</div>
      <div style={{ fontSize:12, color:"#94a3b8" }}>{item.name}</div>
    </div>
  );
}

// localMode（遠征單人）：不寫 Firestore 房間文件；
// 購買透過 onLocalBuy 交給父層套用效果與扣款，離開時呼叫 onLocalDone
export default function DungeonShop({
  roomId, room, memberId, memberData, isHost,
  localMode = false, onLocalBuy, onLocalDone, onSharedDone,
  boughtEffects = {}, // 整趟遠征已買過的一次性效果 { atk_mult:true, ... }（solo localMode 由父層傳入）
}) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [animPhase, setAnimPhase] = useState("entering"); // entering | open | bought | leaving
  const [buyFloatItem, setBuyFloatItem] = useState(null);
  const [buyPulseItem, setBuyPulseItem] = useState(null);
  const [showParticles, setShowParticles] = useState(false);
  const [localConfirms, setLocalConfirms] = useState({});
  const [localPurchases, setLocalPurchases] = useState([]);
  const prevPurchaseCountRef = useRef(0);

  const shopItems     = room?.shopItems     || [];
  const shopPurchases = room?.shopPurchases || {};
  const myPurchases   = localMode ? localPurchases : (shopPurchases[memberId] || []);
  // 一次性商品（回血藥水以外）整趟只能買一次。已買過的 effect 集合來源：
  //  ・多人：room.shopBoughtEffects[memberId]（跨層保留）  ・solo：父層 boughtEffects（整趟 state）
  //  ・本商店房內剛買的 item.id → effect（即時反映）
  const isOneTime = (e) => !!e && e !== "hp_restore";
  const boughtEffectSet = new Set([
    ...(room?.shopBoughtEffects?.[memberId] || []),
    ...Object.keys(boughtEffects).filter(k => boughtEffects[k]),
    ...myPurchases.map(id => SHOP_ITEM_META[id]?.effect).filter(Boolean),
  ]);
  const coins         = memberData?.coins ?? 0;
  const members       = room?.members || {};
  const aliveIds      = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms  = localMode ? localConfirms : (room?.roomConfirms || {});

  const hasFallenFront = Object.values(members).some(m => m.alive && m.role === "rear");

  const fullItems = useMemo(() => shopItems.map(id => ({ id, ...(SHOP_ITEM_META[id] || { name:id, icon:"❓", desc:"未知商品", cost:999, effect:null }) })), [shopItems]);

  // 進場動畫
  useEffect(() => {
    sfxDoorOpen();
    const t = setTimeout(() => setAnimPhase("open"), 300);
    return () => clearTimeout(t);
  }, []);

  // 偵測他人購買 → 短暫 pulse 效果
  useEffect(() => {
    const total = Object.values(shopPurchases).reduce((s, list) => s + list.length, 0);
    if (total > prevPurchaseCountRef.current) {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 600);
    }
    prevPurchaseCountRef.current = total;
  }, [shopPurchases]);

  async function handleBuy(item) {
    if (loading) return;
    const isPotion = item.id === "hp_potion";
    if (isOneTime(item.effect) && boughtEffectSet.has(item.effect)) { sfxError(); return; } // 整趟已買過此效果
    if (item.id === "revival_front" && !hasFallenFront) { sfxError(); return; }
    if (coins < item.cost) { sfxError(); return; }
    sfxShopBuy();
    setLoading(true);
    setBuyFloatItem(null); // 重設
    setTimeout(() => setBuyFloatItem(item), 50);
    setTimeout(() => setBuyPulseItem(item.id), 50);
    if (localMode) {
      // 本地單人：由父層扣金幣 + 套用效果，不寫 Firestore
      if (!isPotion) setLocalPurchases(p => [...p, item.id]);
      onLocalBuy?.(item);
      setTimeout(() => setLoading(false), 400);
      return;
    }
    await purchaseDungeonItem(roomId, memberId, item, memberData);
    const { addCoins } = await import("../../lib/db");
    await addCoins(memberId, -item.cost).catch(() => {});
    setLoading(false);
  }

  async function handleConfirm() {
    if (confirmed) return;
    sfxTap();
    setConfirmed(true);
    setAnimPhase("leaving");
    if (localMode) {
      setLocalConfirms({ [memberId]: true });
      return;
    }
    await confirmNonCombatRoom(roomId, memberId, "done");
  }

  async function handleResolve() {
    if (!isHost) return;
    sfxSuccess();
    if (localMode) {
      onLocalDone?.();
      return;
    }
    const anyRevival = Object.values(shopPurchases).some(list => list.includes("revival_front"));
    if (anyRevival) {
      const fallenFronters = Object.entries(members)
        .filter(([, m]) => m.alive && m.role === "rear");
      if (fallenFronters.length > 0) {
        const [targetId, targetM] = fallenFronters[0];
        const { updateDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../../lib/firebase");
        await updateDoc(doc(db, "dungeonRooms", roomId), {
          [`members.${targetId}.role`]: "front",
          [`members.${targetId}.hp`]: Math.round((targetM.maxHP || 100) * 0.5),
        });
      }
    }
    if (onSharedDone) {
      await onSharedDone();
      return;
    }
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const allConfirmed = aliveIds.every(id => roomConfirms[id]);
  const effectLabel = (item) => {
    switch (item.effect) {
      case "hp_restore":     return `❤️ HP +${Math.round(item.value*100)}%`;
      case "hp_max_boost":   return `💚 HP上限 +${Math.round(item.value*100)}%`;
      case "atk_mult":       return `⚔️ ATK ×${item.value}`;
      case "def_mult":       return `🛡️ DEF ×${item.value}`;
      case "revival":        return "💫 復活一次";
      case "revival_front":  return "💊 復活前衛";
      default:               return "";
    }
  };

  return (
    <div className="min-h-full flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#0c1929,#0f2942)", position:"relative" }}>
      <Particles count={24} />

      <style>{`
@keyframes s-fade-in{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}
@keyframes s-card-in{0%{opacity:0;transform:translateX(-30px) scale(0.92)}100%{opacity:1;transform:translateX(0) scale(1)}}
@keyframes s-pulse-glow{0%,100%{box-shadow:0 0 12px rgba(96,165,250,0.2)}50%{box-shadow:0 0 28px rgba(96,165,250,0.5)}}
@keyframes s-bought{0%{transform:scale(1)}30%{transform:scale(1.15)}60%{transform:scale(0.95)}100%{transform:scale(1)}}
@keyframes s-float-up{0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.7)}20%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.1)}60%{opacity:1;transform:translateX(-50%) translateY(-30px) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-80px) scale(0.8)}}
@keyframes s-coins-pulse{0%,100%{color:#fbbf24}50%{color:#fde68a}}
@keyframes s-buy-ring{0%{box-shadow:0 0 0 0 rgba(251,191,36,0.5)}100%{box-shadow:0 0 0 12px rgba(251,191,36,0)}}
      `}</style>

      {buyFloatItem && <BuyFloat item={buyFloatItem} onDone={() => setBuyFloatItem(null)} />}

      {/* Header */}
      <div className="shrink-0 text-center py-5 border-b border-blue-500/20"
        style={{ animation: animPhase === "entering" ? "s-fade-in 0.5s ease both" : undefined }}>
        <div className="text-5xl mb-1"
          style={{ animation:"s-pulse-glow 2s ease infinite", display:"inline-block", borderRadius:"50%", padding:6 }}>
          🛒
        </div>
        <div className="text-xl font-black" style={{ color:"#60a5fa" }}>補給商店</div>
        <div className="text-sm text-slate-400 mt-0.5">
          金幣：<span className="text-amber-400 font-bold" style={{ animation:"s-coins-pulse 1.5s ease infinite" }}>{coins.toLocaleString()}</span>
        </div>
      </div>

      {/* 全員狀態 */}
      <div style={{ display:"flex", gap:10, padding:"10px 12px", overflowX:"auto", background:"rgba(0,0,0,0.34)", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        {Object.entries(members).map(([id, m], i) => {
          const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, m.hp/m.maxHP)) : 0;
          const isMe = id === memberId;
          return (
            <div key={id} style={{
              flexShrink:0, minWidth:150, padding:"10px 12px",
              borderRadius:14,
              border:`1px solid ${isMe ? "rgba(96,165,250,0.45)" : "rgba(255,255,255,0.1)"}`,
              background:isMe ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.055)",
              animation: animPhase === "open" ? `s-fade-in 0.4s ease ${0.1+i*0.06}s both` : undefined,
              transition:"all 0.3s ease",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:22 }}>{m.alive ? (m.role==="rear"?"🛡️":"⚔️") : "💀"}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, lineHeight:1.2, color:"white", fontWeight:900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {m.name || "隊員"}{isMe ? "（你）" : ""}
                  </div>
                  <div style={{ fontSize:11, color: m.alive ? (m.role==="rear"?"#c4b5fd":"#86efac") : "#fca5a5", fontWeight:800, marginTop:2 }}>
                    {m.alive ? (m.role==="rear"?"後衛支援":"前衛作戰") : "倒地"}
                  </div>
                </div>
              </div>
              <div style={{ height:7, borderRadius:999, background:"rgba(255,255,255,0.12)", overflow:"hidden", marginBottom:6 }}>
                <div style={{ height:"100%", width:`${hpPct*100}%`, background:hpPct>0.5?"#16a34a":hpPct>0.25?"#d97706":"#dc2626", transition:"width 0.5s ease" }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:12, color:"#cbd5e1", fontWeight:800 }}>
                <span>HP {m.hp}/{m.maxHP}</span>
                <span>ATK {Math.round((m.atk || 0) * (m.buffs?.atkMult || 1))}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Items */}
      <div className="px-4 py-4 space-y-3">
        {fullItems.map((item, i) => {
          const alreadyBought   = isOneTime(item.effect) && boughtEffectSet.has(item.effect);
          const isRevivalFront  = item.id === "revival_front";
          const revivalBlocked  = isRevivalFront && !hasFallenFront && !alreadyBought;
          const canAfford       = coins >= item.cost;
          const isBuying        = buyPulseItem === item.id && loading;
          return (
            <div key={item.id}
              onClick={() => canAfford && !alreadyBought && !revivalBlocked && handleBuy(item)}
              style={{
                display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                borderRadius:14, border:"1px solid",
                background: isBuying ? "rgba(251,191,36,0.12)" : alreadyBought || revivalBlocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                borderColor: isBuying ? "rgba(251,191,36,0.5)" : alreadyBought || revivalBlocked ? "rgba(255,255,255,0.06)" : "rgba(96,165,250,0.15)",
                opacity: alreadyBought || revivalBlocked ? 0.5 : 1,
                cursor: (canAfford && !alreadyBought && !revivalBlocked) ? "pointer" : "default",
                animation: animPhase === "open" ? `s-card-in 0.4s ease ${0.15+i*0.08}s both` : undefined,
                transform: buyPulseItem === item.id && !loading ? "scale(1)" : undefined,
                transition:"all 0.25s ease",
                boxShadow: isBuying ? "0 0 20px rgba(251,191,36,0.3)" : alreadyBought ? "inset 0 0 12px rgba(74,222,128,0.1)" : undefined,
              }}
              onMouseEnter={e => {
                if (canAfford && !alreadyBought && !revivalBlocked) {
                  e.currentTarget.style.transform = "translateX(4px) scale(1.02)";
                  e.currentTarget.style.borderColor = "rgba(251,191,36,0.5)";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.borderColor = "";
              }}>
              <span className="text-3xl" style={{ filter: isBuying ? "brightness(1.3)" : undefined }}>{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: isBuying ? "#fbbf24" : alreadyBought ? "#4ade80" : "white" }}>
                  {item.name}
                  {isBuying && <span className="ml-2 text-xs animate-pulse">購買中…</span>}
                </div>
                <div className="text-xs text-slate-400 truncate">{item.desc}</div>
                <div className="text-xs text-emerald-400 mt-0.5 font-semibold">{effectLabel(item)}</div>
                {revivalBlocked && (
                  <div className="text-xs text-amber-400 mt-0.5 font-semibold">⚠️ 無前衛倒地</div>
                )}
              </div>
              <div className="shrink-0" style={{ position:"relative" }}>
                {isBuying && <div style={{ position:"absolute", inset:-4, borderRadius:"50%", animation:"s-buy-ring 0.8s ease-out" }}/>}
                <div className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  alreadyBought || revivalBlocked
                    ? "bg-slate-700 text-slate-500"
                    : canAfford
                      ? "bg-amber-500 hover:bg-amber-400 text-black"
                      : "bg-slate-700 text-slate-500"
                }`}
                style={{ animation: alreadyBought ? "s-bought 0.4s ease" : undefined }}>
                  {alreadyBought ? "✅ 已購" : `💰${item.cost}`}
                </div>
              </div>
            </div>
          );
        })}
        {fullItems.length === 0 && (
          <div className="text-center text-slate-500 py-10">商店無商品</div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 border-t border-blue-500/20 space-y-3">
        {/* 已購/確認成員 */}
        <div className="flex justify-center gap-2 flex-wrap">
          {Object.keys(roomConfirms).map(id => (
            <span key={id} className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30"
              style={{ animation:"s-fade-in 0.3s ease both" }}>
              ✅ {members[id]?.name || id}
            </span>
          ))}
        </div>

        {!confirmed ? (
          <button onClick={handleConfirm}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg transition-all active:scale-[0.98]"
            style={{
              background:"linear-gradient(90deg,#60a5fa,#3b82f6)",
              color:"white",
              animation: animPhase === "open" ? "s-fade-in 0.6s 0.6s both" : undefined,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 24px rgba(96,165,250,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; }}>
            👍 確認購物，準備出發
          </button>
        ) : isHost && !allConfirmed ? (
          <div className="text-center text-slate-400 text-sm py-2">等待其他隊員確認購物…</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white",
              animation:"s-pulse-glow 1.5s ease infinite" }}>
            🗺️ 繼續探索
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已確認，等待房主繼續</div>
        )}

        {isHost && confirmed && !allConfirmed && (
          <button onClick={handleResolve}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold bg-amber-900/30 border border-amber-500/30"
            style={{ transition:"all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(217,119,6,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(217,119,6,0.3)"; }}>
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已確認）
          </button>
        )}
      </div>
    </div>
  );
}
