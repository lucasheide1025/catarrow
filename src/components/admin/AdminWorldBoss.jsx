// src/components/admin/AdminWorldBoss.jsx — 世界大 Boss 後台管理
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeLatestWorldBoss,
  createWorldBossEvent,
  forceEndWorldBossEvent,
  distributeWorldBossRewards,
  expireWorldBossEvent,
  getWorldBossHistory,
} from "../../lib/worldBossDb";
import { WORLD_BOSSES, WORLD_BOSS_KEYS, getBossPhase, PHASE_LABELS } from "../../lib/worldBossData";
import { WB_CARDS } from "../../lib/worldBossCards";
import { addCardPack, addCoins, addChests, getMembers, adminGrantWorldBossCard } from "../../lib/db";
import WorldBossSVG from "../worldboss/WorldBossSVG";
import WorldBossLobby from "../worldboss/WorldBossLobby";
import { Sel, Btn, useToast } from "../shared/UI";

function HPBar({ current, max }) {
  const pct   = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  const phase = getBossPhase(current, max);
  const color = phase === 4 ? "#22c55e" : phase === 3 ? "#eab308" : phase === 2 ? "#f97316" : "#ef4444";
  return (
    <div className="w-full">
      <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}/>
      </div>
      <div className="flex justify-between mt-1 text-xs">
        <span style={{ color }}>{PHASE_LABELS[phase]?.label}</span>
        <span className="text-slate-400 font-mono">{current?.toLocaleString()} / {max?.toLocaleString()}</span>
      </div>
    </div>
  );
}

const DEFAULT_REWARD = {
  base:    { coins: 100, woodChests: 1 },
  rank1:   { coins: 800, goldChests: 3, catBoxes: 1, mimiBoxes: 1, cardChance: 30 },
  rank3:   { coins: 500, goldChests: 2, catBoxes: 0, mimiBoxes: 1, cardChance: 15 },
  rankAll: { coins: 300, goldChests: 1, catBoxes: 0, mimiBoxes: 0, cardChance:  5 },
};
// cardChance 在 UI 用整數 %，寫入 Firestore 時除以 100

function rewardToStore(r) {
  return {
    base:    { ...r.base },
    rank1:   { ...r.rank1,   cardChance: (r.rank1.cardChance   || 0) / 100 },
    rank3:   { ...r.rank3,   cardChance: (r.rank3.cardChance   || 0) / 100 },
    rankAll: { ...r.rankAll, cardChance: (r.rankAll.cardChance || 0) / 100 },
  };
}

function StepCtrl({ label, value, onChange, step = 1, min = 0, max = 9999, unit = "" }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(min, value - step))}
          className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold text-sm flex items-center justify-center">−</button>
        <span className="w-10 text-center font-bold text-sm text-white">{value}{unit}</span>
        <button onClick={() => onChange(Math.min(max, value + step))}
          className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold text-sm flex items-center justify-center">+</button>
      </div>
    </div>
  );
}

export default function AdminWorldBoss() {
  const { profile } = useAuth();
  const [tab, setTab]           = useState("active");   // active | create | history
  const [event, setEvent]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showBattle, setShowBattle] = useState(false);

  if (showBattle) {
    return <WorldBossLobby onBack={() => setShowBattle(false)} />;
  }
  const [history, setHistory] = useState([]);

  // 建立表單
  const [bossKey,   setBossKey]   = useState("head_coach");
  const [useRandom, setUseRandom] = useState(false);
  const [duration,  setDuration]  = useState(3);
  const [reward,    setReward]    = useState(() => JSON.parse(JSON.stringify(DEFAULT_REWARD)));
  const [rankTab,   setRankTab]   = useState("rank1"); // rank1 | rank3 | rankAll
  const [creating,  setCreating]  = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // 手動發放世界王卡
  const { toast, ToastContainer } = useToast();
  const [members, setMembers] = useState([]);
  const [grantMemberId, setGrantMemberId] = useState("");
  const [grantBossKey,  setGrantBossKey]  = useState(WORLD_BOSS_KEYS[0]);
  const [grantStat,     setGrantStat]     = useState("hp");
  const [granting,      setGranting]      = useState(false);

  useEffect(() => { getMembers().then(setMembers).catch(() => {}); }, []);

  async function handleGrantWbCard() {
    if (!grantMemberId || !grantBossKey) return;
    const cardDef = WB_CARDS[grantBossKey];
    setGranting(true);
    const res = await adminGrantWorldBossCard(
      grantMemberId, grantBossKey,
      cardDef?.statMode === "choose" ? grantStat : null,
      profile?.id
    );
    setGranting(false);
    if (res.ok) toast(`✅ 已發放《${cardDef?.name}》世界王卡`);
    else toast(`❌ ${res.reason || "發放失敗"}`);
  }
  const [extraReward, setExtraReward] = useState({ coins: 0, woodChests: 0, goldChests: 0, catBoxes: 0, mimiBoxes: 0, cardPacks: 0 });
  const [showExtraForm, setShowExtraForm] = useState(false);

  useEffect(() => {
    const unsub = subscribeLatestWorldBoss(ev => {
      setEvent(ev);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (tab === "history") {
      getWorldBossHistory(20).then(setHistory);
    }
  }, [tab]);

  // ── 建立活動 ───────────────────────────────────────────────
  async function handleCreate() {
    if (event?.status === "active") {
      setCreateMsg("目前已有活躍 Boss，請先結束再建立新的");
      return;
    }
    setCreating(true);
    setCreateMsg("");
    const key = useRandom
      ? WORLD_BOSS_KEYS[Math.floor(Math.random() * WORLD_BOSS_KEYS.length)]
      : bossKey;
    const res = await createWorldBossEvent({
      adminId:     profile?.id,
      bossKey:     key,
      durationDays: duration,
      reward: rewardToStore(reward),
    });
    if (res.ok) {
      setCreateMsg(`✅ 已建立《${WORLD_BOSSES[key]?.name}》活動！`);
      setTab("active");
    } else {
      setCreateMsg(`❌ ${res.reason}`);
    }
    setCreating(false);
  }

  // ── 強制結束 ───────────────────────────────────────────────
  async function handleForceEnd() {
    if (!event) return;
    if (!window.confirm(`確定要強制結束《${event.bossData?.name}》？\n將發放安慰獎給所有參戰者。`)) return;
    setActionMsg("處理中…");
    await expireWorldBossEvent(event.id);
    setActionMsg("✅ 已結束活動並發放安慰獎");
  }

  // ── 手動結算定案（Boss 已 defeated 但未定案；定案後各參戰者自己開世界王頁面領取）──
  async function handleDistribute() {
    if (!event) return;
    setActionMsg("結算中…");
    const res = await distributeWorldBossRewards(event.id);
    setActionMsg(res.ok ? "✅ 已定案，參戰者可自行領取獎勵" : `❌ ${res.reason}`);
  }

  // ── 額外發放卡包給所有參戰者 ──────────────────────────────
  async function handleGiveCardPacks() {
    if (!event) return;
    const participants = Object.keys(event.participants || {});
    if (!participants.length) { setActionMsg("❌ 沒有參戰者"); return; }
    if (!window.confirm(`確定要發放【圖片收集卡包】給 ${participants.length} 位參戰者？`)) return;
    setActionMsg("發放卡包中…");
    let ok = 0;
    for (const mid of participants) {
      try { await addCardPack(mid, 1); ok++; } catch (e) { console.warn("cardPack:", mid, e?.message); }
    }
    setActionMsg(`✅ 已發放卡包給 ${ok}/${participants.length} 人`);
  }

  // ── 額外發放自訂獎勵給所有參戰者 ────────────────────────────
  async function handleGiveExtraRewards() {
    if (!event) return;
    const participants = Object.keys(event.participants || {});
    if (!participants.length) { setActionMsg("❌ 沒有參戰者"); return; }
    const { coins, woodChests, goldChests, catBoxes, mimiBoxes, cardPacks } = extraReward;
    if (!coins && !woodChests && !goldChests && !catBoxes && !mimiBoxes && !cardPacks) { setActionMsg("❌ 請至少設定一項獎勵"); return; }
    const lines = [
      coins      ? `金幣 ×${coins}`       : null,
      woodChests ? `木箱 ×${woodChests}`  : null,
      goldChests ? `金箱 ×${goldChests}`  : null,
      catBoxes   ? `貓貓箱 ×${catBoxes}` : null,
      mimiBoxes  ? `咪咪箱 ×${mimiBoxes}`: null,
      cardPacks  ? `卡包 ×${cardPacks}`   : null,
    ].filter(Boolean).join("、");
    if (!window.confirm(`確定要發放【${lines}】給 ${participants.length} 位參戰者？`)) return;
    setActionMsg("發放中…");
    let ok = 0;
    for (const mid of participants) {
      try {
        if (coins)     await addCoins(mid, coins);
        if (woodChests) {
          const chests = Array.from({ length: woodChests }, (_, i) => ({
            id: `extra_wood_${mid}_${Date.now()}_${i}`,
            type: "wood", family: "special", tier: "common", from: "教練額外獎勵", ts: Date.now(),
          }));
          await addChests(mid, chests);
        }
        if (goldChests) {
          const chests = Array.from({ length: goldChests }, (_, i) => ({
            id: `extra_gold_${mid}_${Date.now()}_${i}`,
            type: "gold", family: "special", tier: "rare", from: "教練額外獎勵", ts: Date.now(),
          }));
          await addChests(mid, chests);
        }
        if (catBoxes) {
          const chests = Array.from({ length: catBoxes }, (_, i) => ({
            id: `extra_cat_${mid}_${Date.now()}_${i}`,
            type: "cat_box", family: "special", tier: "rare", from: "教練額外獎勵", ts: Date.now(),
          }));
          await addChests(mid, chests);
        }
        if (mimiBoxes) {
          const chests = Array.from({ length: mimiBoxes }, (_, i) => ({
            id: `extra_mimi_${mid}_${Date.now()}_${i}`,
            type: "mimi_box", family: "special", tier: "mythic", from: "教練額外獎勵", ts: Date.now(),
          }));
          await addChests(mid, chests);
        }
        if (cardPacks) await addCardPack(mid, cardPacks);
        ok++;
      } catch (e) { console.warn("extraReward:", mid, e?.message); }
    }
    setActionMsg(`✅ 已發放給 ${ok}/${participants.length} 人`);
    setShowExtraForm(false);
    setExtraReward({ coins: 0, woodChests: 0, goldChests: 0, catBoxes: 0, mimiBoxes: 0, cardPacks: 0 });
  }

  if (loading) {
    return <div className="p-6 text-slate-400 text-sm">載入中…</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-4">
    <div className="rounded-2xl p-4 space-y-4 text-white" style={{ background: "#0f172a" }}>
      <div className="text-xl font-black">🌍 世界大 Boss 管理</div>

      {/* Tab */}
      <div className="flex bg-slate-700/50 rounded-2xl p-1 gap-1">
        {[
          { id: "active",  label: "目前活動" },
          { id: "create",  label: "建立活動" },
          { id: "history", label: "歷史紀錄" },
          { id: "cards",   label: "發放王卡" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? "bg-white/15 text-white" : "text-slate-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 目前活動 ── */}
      {tab === "active" && (
        <div className="space-y-4">
          {!event ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-2">
              <div className="text-4xl opacity-40">👾</div>
              <div className="text-slate-400 text-sm">目前沒有活躍的世界大 Boss</div>
              <button onClick={() => setTab("create")}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-sm font-bold">
                前往建立活動
              </button>
            </div>
          ) : (
            <>
              {/* Boss 資訊 */}
              <div className="rounded-2xl border border-white/10 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${event.bossData?.bg}dd, #1e293b)` }}>
                <div className="flex items-center gap-4 p-4">
                  <WorldBossSVG bossKey={event.bossKey} currentHP={event.bossCurrentHP} maxHP={event.bossMaxHP} size={72}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-lg" style={{ color: event.bossData?.accent }}>
                      {event.bossData?.name}
                    </div>
                    <div className="text-xs text-slate-400 mb-2">「{event.bossData?.title}」</div>
                    <HPBar current={event.bossCurrentHP} max={event.bossMaxHP}/>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-black/20 rounded-xl py-2">
                      <div className="text-slate-500">狀態</div>
                      <div className={`font-bold mt-0.5 ${event.status === "active" ? "text-emerald-400" : "text-rose-400"}`}>
                        {event.status === "active" ? "⚡ 活躍" : event.status === "defeated" ? "💀 已擊殺" : "⏰ 已到期"}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-xl py-2">
                      <div className="text-slate-500">參戰人數</div>
                      <div className="font-bold text-amber-300 mt-0.5">{event.totalParticipants || 0} 人</div>
                    </div>
                    <div className="bg-black/20 rounded-xl py-2">
                      <div className="text-slate-500">持續天數</div>
                      <div className="font-bold text-sky-300 mt-0.5">{event.durationDays} 天</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 教練參戰入口 */}
              {event.status === "active" && (
                <button onClick={() => setShowBattle(true)}
                  className="w-full py-3 rounded-2xl font-black text-white text-base active:scale-95 transition-all"
                  style={{ background: `linear-gradient(135deg, ${event.bossData?.accent || "#f59e0b"}, #ef4444)` }}>
                  ⚔️ 教練進入戰鬥
                </button>
              )}

              {/* 傷害排行 */}
              {event.participants && Object.keys(event.participants).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-xs text-slate-400 font-bold mb-3">💥 傷害排行（全員）</div>
                  <div className="space-y-2">
                    {Object.entries(event.participants)
                      .map(([id, p]) => ({ id, ...p }))
                      .sort((a, b) => (b.totalDmg || 0) - (a.totalDmg || 0))
                      .map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 text-sm">
                          <span className="w-5 text-center font-black text-xs"
                            style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>
                            {i + 1}
                          </span>
                          <span className="flex-1 text-slate-300 truncate">
                            {p.name}
                            {p.isGuest && <span className="ml-1 text-slate-500 text-xs">（訪客）</span>}
                          </span>
                          <span className="font-black text-amber-300">{(p.totalDmg || 0).toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 最後一擊 */}
              {event.lastHitBy && (
                <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3 text-xs text-amber-200">
                  ⚡ 最後一擊：<span className="font-bold">{event.lastHitBy.memberName}</span>（{event.lastHitBy.weapon}）
                </div>
              )}

              {/* 操作按鈕 */}
              {actionMsg && (
                <div className="text-center text-sm py-1"
                  style={{ color: actionMsg.startsWith("✅") ? "#4ade80" : actionMsg.startsWith("❌") ? "#f87171" : "#94a3b8" }}>
                  {actionMsg}
                </div>
              )}

              <div className="space-y-2">
                {event.status === "defeated" && !event.rewardDistributed && (
                  <button onClick={handleDistribute}
                    className="w-full py-3 rounded-2xl font-bold text-sm bg-amber-500/20 border border-amber-400/40 text-amber-300 active:scale-95 transition-all">
                    🎁 手動結算定案（供參戰者自行領取）
                  </button>
                )}
                {(event.status === "defeated" || event.status === "expired") && Object.keys(event.participants || {}).length > 0 && (
                  <button onClick={handleGiveCardPacks}
                    className="w-full py-3 rounded-2xl font-bold text-sm bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 active:scale-95 transition-all">
                    🃏 額外發放圖片收集卡包（{Object.keys(event.participants || {}).length} 人）
                  </button>
                )}

                {/* 額外自訂獎勵發放 */}
                {Object.keys(event.participants || {}).length > 0 && (
                  <div className="border border-white/10 rounded-2xl overflow-hidden">
                    <button onClick={() => setShowExtraForm(v => !v)}
                      className="w-full py-2.5 px-4 flex items-center justify-between text-sm font-bold text-slate-300 bg-white/5 active:bg-white/10">
                      <span>🎁 額外發放獎勵給全員</span>
                      <span className="text-slate-500">{showExtraForm ? "▲" : "▼"}</span>
                    </button>
                    {showExtraForm && (
                      <div className="p-3 space-y-3 bg-white/3">
                        {[
                          { key: "coins",      label: "🪙 金幣",   step: 50 },
                          { key: "woodChests", label: "📦 木箱",   step: 1  },
                          { key: "goldChests", label: "🏆 金箱",   step: 1  },
                          { key: "catBoxes",   label: "🐱 貓貓箱", step: 1  },
                          { key: "mimiBoxes",  label: "😺 咪咪箱", step: 1  },
                          { key: "cardPacks",  label: "🃏 卡包",   step: 1  },
                        ].map(({ key, label, step }) => (
                          <div key={key} className="flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-300 w-20">{label}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setExtraReward(r => ({ ...r, [key]: Math.max(0, (r[key]||0) - step) }))}
                                className="w-7 h-7 rounded-lg bg-slate-700 text-white font-black text-base active:scale-90">－</button>
                              <span className="w-10 text-center font-bold text-white text-sm">{extraReward[key] || 0}</span>
                              <button onClick={() => setExtraReward(r => ({ ...r, [key]: (r[key]||0) + step }))}
                                className="w-7 h-7 rounded-lg bg-slate-700 text-white font-black text-base active:scale-90">＋</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={handleGiveExtraRewards}
                          className="w-full py-2.5 rounded-xl font-bold text-sm bg-green-500/20 border border-green-400/40 text-green-300 active:scale-95 transition-all">
                          ✅ 確認發放給 {Object.keys(event.participants || {}).length} 人
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {event.status === "active" && (
                  <button onClick={handleForceEnd}
                    className="w-full py-3 rounded-2xl font-bold text-sm bg-rose-500/20 border border-rose-400/40 text-rose-300 active:scale-95 transition-all">
                    ⏹ 強制結束活動（發安慰獎）
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 建立活動 ── */}
      {tab === "create" && (
        <div className="space-y-4">
          {event?.status === "active" && (
            <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-3 text-xs text-rose-300">
              ⚠️ 目前已有活躍的《{event.bossData?.name}》，請先結束再建立新的
            </div>
          )}

          {/* Boss 選擇 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="text-xs text-slate-400 font-bold">選擇 Boss</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useRandom} onChange={e => setUseRandom(e.target.checked)}
                className="w-4 h-4 accent-amber-400"/>
              <span className="text-sm text-slate-300">🎲 隨機抽取 Boss</span>
            </label>

            {!useRandom && (
              <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {WORLD_BOSS_KEYS.map(k => {
                  const b = WORLD_BOSSES[k];
                  return (
                    <button key={k} onClick={() => setBossKey(k)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${bossKey === k ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5"}`}>
                      <WorldBossSVG bossKey={k} currentHP={b.hp} maxHP={b.hp} size={32}/>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: bossKey === k ? b.accent : undefined }}>{b.name}</div>
                        <div className="text-xs text-slate-500">HP {b.hp.toLocaleString()} ｜ ATK {b.atk} ｜ DEF {b.def}</div>
                      </div>
                      {bossKey === k && <span className="text-amber-400 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 持續天數 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold mb-3">持續天數</div>
            <div className="flex items-center gap-3">
              <input
                type="number" min="1" max="365" value={duration}
                onChange={e => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-xl border border-amber-400/50 bg-amber-400/10 text-amber-300 font-bold text-center text-lg px-3 py-2 focus:outline-none focus:border-amber-400"
              />
              <span className="text-slate-400 text-sm">天</span>
              <div className="flex gap-1.5 ml-auto">
                {[1, 3, 7, 14].map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${duration === d ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
                    {d}天
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 獎勵設定 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="text-xs text-slate-400 font-bold">🎁 獎勵設定</div>

            {/* 保底獎勵 */}
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-emerald-400 font-bold mb-2">🛡️ 保底（所有參戰者）</div>
              <div className="flex gap-4">
                <StepCtrl label="💰 金幣" value={reward.base.coins} step={50}
                  onChange={v => setReward(r => ({ ...r, base: { ...r.base, coins: v } }))}/>
                <StepCtrl label="🪵 木箱" value={reward.base.woodChests}
                  onChange={v => setReward(r => ({ ...r, base: { ...r.base, woodChests: v } }))}/>
              </div>
            </div>

            {/* 分層獎勵 */}
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-amber-400 font-bold mb-2">🏆 擊殺分層獎勵</div>
              <div className="flex gap-1 mb-3">
                {[
                  { key: "rank1",   label: "🥇 第1名" },
                  { key: "rank3",   label: "🥈 前3名" },
                  { key: "rankAll", label: "👥 其餘" },
                ].map(t => (
                  <button key={t.key} onClick={() => setRankTab(t.key)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${rankTab === t.key ? "bg-amber-400/25 text-amber-300 border border-amber-400/40" : "bg-white/5 text-slate-400"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StepCtrl label="💰 金幣" value={reward[rankTab].coins} step={100}
                  onChange={v => setReward(r => ({ ...r, [rankTab]: { ...r[rankTab], coins: v } }))}/>
                <StepCtrl label="📦 金箱" value={reward[rankTab].goldChests}
                  onChange={v => setReward(r => ({ ...r, [rankTab]: { ...r[rankTab], goldChests: v } }))}/>
                <StepCtrl label="🐱 貓貓箱" value={reward[rankTab].catBoxes}
                  onChange={v => setReward(r => ({ ...r, [rankTab]: { ...r[rankTab], catBoxes: v } }))}/>
                <StepCtrl label="😺 咪咪箱" value={reward[rankTab].mimiBoxes}
                  onChange={v => setReward(r => ({ ...r, [rankTab]: { ...r[rankTab], mimiBoxes: v } }))}/>
                <StepCtrl label="🃏 卡片%" value={reward[rankTab].cardChance} max={100}
                  unit="%" onChange={v => setReward(r => ({ ...r, [rankTab]: { ...r[rankTab], cardChance: v } }))}/>
              </div>
            </div>

            {/* 預覽 */}
            <div className="text-xs text-slate-500 leading-relaxed">
              ✨ 咪咪箱：直接解鎖貓貓陪練（重複→+50羈絆）・保底讓每位參戰者都有獎勵
            </div>
          </div>

          {createMsg && (
            <div className="text-center text-sm py-1"
              style={{ color: createMsg.startsWith("✅") ? "#4ade80" : createMsg.startsWith("❌") ? "#f87171" : "#94a3b8" }}>
              {createMsg}
            </div>
          )}

          <button onClick={handleCreate} disabled={creating || event?.status === "active"}
            className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40 active:scale-95 transition-all">
            {creating ? "建立中…" : "🌍 開啟世界大 Boss 活動"}
          </button>
        </div>
      )}

      {/* ── 歷史紀錄 ── */}
      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-8">尚無歷史紀錄</div>
          ) : (
            history.map(h => (
              <div key={h.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{h.result === "defeated" ? "💀" : "⏰"}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{h.bossName}</div>
                    <div className={`text-xs font-bold ${h.result === "defeated" ? "text-amber-300" : "text-slate-500"}`}>
                      {h.result === "defeated" ? "已擊殺" : "時間到期"}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {h.totalParticipants || 0} 人參戰
                  </div>
                </div>
                {h.lastHitBy && (
                  <div className="text-xs text-amber-200 bg-amber-500/10 rounded-lg px-2 py-1">
                    ⚡ 最後一擊：{h.lastHitBy.memberName}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 手動發放世界王卡（後台限定，不進任何玩家掉落池）── */}
      {tab === "cards" && (
        <div className="space-y-4">
          <ToastContainer />
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3 text-xs text-amber-200">
            🔒 這裡發出去的世界王卡不會出現在任何玩家可觸發的掉落池，只能教練手動發放（活動獎勵/特殊補償用）。
          </div>

          <Sel label="選擇會員" value={grantMemberId} onChange={e => setGrantMemberId(e.target.value)}
            options={[{ value: "", label: "— 請選擇 —" }, ...members.map(m => ({ value: m.id, label: `${m.nickname || m.name}（${m.name}）` }))]} />

          <div className="text-xs text-slate-400 font-bold">選擇世界王卡</div>
          <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto pr-1">
            {WORLD_BOSS_KEYS.map(k => {
              const b = WORLD_BOSSES[k];
              const card = WB_CARDS[k];
              return (
                <button key={k} onClick={() => setGrantBossKey(k)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${grantBossKey === k ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5"}`}>
                  <WorldBossSVG bossKey={k} currentHP={b.hp} maxHP={b.hp} size={32}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: grantBossKey === k ? b.accent : undefined }}>{card?.icon} {b.name}</div>
                    <div className="text-xs text-slate-500">{b.title}｜{card?.statMode === "choose" ? "屬性可選" : `固定 ${card?.stat?.toUpperCase()}`}</div>
                  </div>
                  {grantBossKey === k && <span className="text-amber-400 text-xs">✓</span>}
                </button>
              );
            })}
          </div>

          {WB_CARDS[grantBossKey]?.statMode === "choose" && (
            <Sel label="指定加成屬性" value={grantStat} onChange={e => setGrantStat(e.target.value)}
              options={[{ value: "hp", label: "HP ❤️" }, { value: "atk", label: "ATK ⚔️" }, { value: "def", label: "DEF 🛡️" }]} />
          )}

          <Btn v="primary" onClick={handleGrantWbCard} disabled={!grantMemberId || granting}>
            {granting ? "發放中…" : `🎴 發放《${WB_CARDS[grantBossKey]?.name || ""}》王卡`}
          </Btn>
        </div>
      )}
    </div>
    </div>
  );
}
