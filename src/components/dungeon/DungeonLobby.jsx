// src/components/dungeon/DungeonLobby.jsx — 地下城等待室
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createDungeonRoom, joinDungeonRoom, subscribeDungeonRoom, subscribeOpenDungeonRooms, cleanupStaleDungeonRooms, updateDungeonMemberStats, initDungeonMapRun, setDungeonMemberRole } from "../../lib/dungeonDb";
import { subscribePracticeLogs, subscribeCardCollection } from "../../lib/db";
import BattleRecords from "../member/BattleRecords";
import { DUNGEON_MAPS, DIFFICULTY_CONFIGS, FAMILY_CONFIGS } from "../../lib/dungeonData";
import { calcArcherStats } from "../../lib/monsterData";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { getCatStatMult, getBondLevel } from "../../lib/catData";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { RUNES, RUNE_TYPES, MAX_RUNE_SLOTS, runeEffectLabel, TIER_COLOR, TIER_NAME, calcRuneBonus } from "../../lib/runeData";
import { subscribeRuneInventory, equipRunesToDungeon, validateRuneEquip } from "../../lib/runeDb";
import DungeonDex from "./DungeonDex";


export default function DungeonLobby({ onEnterRoom, onBack }) {
  const { profile } = useAuth();
  const { catATK: myCatATK } = useCatCompanion();
  const [tab, setTab]           = useState("create");
  const [selDifficulty, setSelDifficulty] = useState("normal");
  const [selDungeon,  setSelDungeon]  = useState(
    DUNGEON_MAPS.find(d => d.enabled && d.difficulty === "normal")?.id || null
  );
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [openRooms, setOpenRooms] = useState([]);
  // waiting room state
  const [roomId, setRoomId]     = useState(null);
  const [room,   setRoom]       = useState(null);
  const [isHost, setIsHost]     = useState(false);
  const [unsub,  setUnsub]      = useState(null);
  const [dungeonLogs, setDungeonLogs] = useState([]);
  const [runeInv,     setRuneInv]     = useState({});
  const [equippedRunes, setEquippedRunes] = useState([]); // [{runeId, durability}]
  const [showRunePicker, setShowRunePicker] = useState(false);

  const myId   = profile?.id;
  const myName = profile?.nickname || profile?.name || "射手";
  const [cardColl, setCardColl] = useState({ cards: {}, equipped: [] });
  useEffect(() => {
    if (!myId) return;
    const unsubLogs  = subscribePracticeLogs(myId, logs =>
      setDungeonLogs(logs.filter(l => l.source === "dungeon"))
    );
    const unsubCards = subscribeCardCollection(myId, setCardColl);
    const unsubRunes = subscribeRuneInventory(myId, setRuneInv);
    return () => { unsubLogs?.(); unsubCards?.(); unsubRunes?.(); };
  }, [myId]);

  useEffect(() => {
    if (tab !== "join") return;
    cleanupStaleDungeonRooms();
    const unsub = subscribeOpenDungeonRooms(setOpenRooms);
    return () => { unsub?.(); setOpenRooms([]); };
  }, [tab]); // eslint-disable-line

  // 重整後恢復等待室狀態
  useEffect(() => {
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem("dungeon_waiting_room") || "null"); } catch { return null; } })();
    if (!saved?.roomId || !myId) return;
    let cancelled = false;
    let unsubFn = null;
    let initialized = false;
    unsubFn = subscribeDungeonRoom(saved.roomId, r => {
      if (cancelled) return;
      if (!r) {
        sessionStorage.removeItem("dungeon_waiting_room");
        unsubFn?.(); cancelled = true; return;
      }
      if (r.status === "active" || r.status === "map_explore") {
        sessionStorage.removeItem("dungeon_waiting_room");
        unsubFn?.(); cancelled = true; onEnterRoom(saved.roomId); return;
      }
      // 只在第一次回調時設定 roomId/isHost（避免反覆覆蓋使用者切換後的房間）
      if (!initialized) {
        initialized = true;
        setRoomId(saved.roomId);
        setIsHost(saved.isHost || false);
        setUnsub(() => unsubFn);
      }
      setRoom(r);
    });
    return () => { cancelled = true; unsubFn?.(); };
  }, [myId]); // eslint-disable-line

  // 難度切換時，保持同族地下城但更新到新難度
  useEffect(() => {
    setSelDungeon(prev => {
      const currentFamily = prev?.split("_")[0] || "forest";
      const next = DUNGEON_MAPS.find(d => d.family === currentFamily && d.difficulty === selDifficulty);
      return next?.id || DUNGEON_MAPS.find(d => d.difficulty === selDifficulty)?.id || prev;
    });
  }, [selDifficulty]);

  const _d = new Date();
  const todayStr = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,"0")}-${String(_d.getDate()).padStart(2,"0")}`;
  const dungeonUsedToday = profile?.lastDungeonDate === todayStr;
  const _base    = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  const _equipped = (cardColl.equipped || []).map(id => cardColl.cards?.[id]).filter(Boolean);
  const _equip   = calcEquippedBonus(_equipped);
  const _lvBon   = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
  const myCatId   = profile?.equippedCat?.catId  || null;
  const myCatName = profile?.equippedCat?.name   || "";
  const myCatType = profile?.equippedCat?.type   || "allround";
  const myCatBond = profile?.equippedCat?.bond   || 0;
  const catMult   = myCatId
    ? Math.max(1.1, getCatStatMult(myCatType, getBondLevel(myCatBond)))
    : 1.0;
  const myHP  = Math.round(((_base.hp  || 0) + (_equip.hp  || 0) + _lvBon.hp)  * catMult);
  const myMaxHP = myHP;
  const myATK = Math.round(((_base.atk || 0) + (_equip.atk || 0) + _lvBon.atk) * catMult);
  const myDEF = Math.round(((_base.def || 0) + (_equip.def || 0) + _lvBon.def) * catMult);

  async function handleCreate() {
    setLoading(true); setErr("");
    const res = await createDungeonRoom(myId, myName, myATK);
    if (!res.ok) { setErr(res.reason); setLoading(false); return; }
    await updateDungeonMemberStats(res.roomId, myId, myHP, myMaxHP, myATK, myDEF, myCatName, localStorage.getItem("mb_archer_style") || "baobao", myCatATK || 0);
    const sub = subscribeDungeonRoom(res.roomId, r => setRoom(r));
    setUnsub(() => sub);
    setRoomId(res.roomId);
    setIsHost(true);
    sessionStorage.setItem("dungeon_waiting_room", JSON.stringify({ roomId: res.roomId, isHost: true }));
    setLoading(false);
  }

  async function handleJoinRoom(openRoom) {
    if (loading) return;
    setLoading(true); setErr("");
    const res = await joinDungeonRoom(openRoom.code, myId, myName);
    if (!res.ok) { setErr(res.reason); setLoading(false); return; }
    await updateDungeonMemberStats(res.roomId, myId, myHP, myMaxHP, myATK, myDEF, myCatName, localStorage.getItem("mb_archer_style") || "baobao", myCatATK || 0);
    const sub = subscribeDungeonRoom(res.roomId, r => {
      setRoom(r);
      if (r?.status === "active" || r?.status === "map_explore") {
        sessionStorage.removeItem("dungeon_waiting_room");
        sub(); onEnterRoom(res.roomId);
      }
    });
    setUnsub(() => sub);
    setRoomId(res.roomId);
    setIsHost(false);
    sessionStorage.setItem("dungeon_waiting_room", JSON.stringify({ roomId: res.roomId, isHost: false }));
    setLoading(false);
  }

  // ── 符文操作 ──────────────────────────────────────────────
  function toggleRune(runeId) {
    const rune = RUNES[runeId];
    if (!rune) return;
    const alreadyIdx = equippedRunes.findIndex(s => s.runeId === runeId);
    if (alreadyIdx >= 0) {
      setEquippedRunes(prev => prev.filter((_, i) => i !== alreadyIdx));
      return;
    }
    if (equippedRunes.length >= MAX_RUNE_SLOTS) return;
    const sameType = equippedRunes.find(s => RUNES[s.runeId]?.typeId === rune.typeId);
    if (sameType) return;
    const dur = rune.durability;
    setEquippedRunes(prev => [...prev, { runeId, durability: dur }]);
  }

  async function saveAndStartRunes() {
    if (roomId && equippedRunes.length > 0) {
      await equipRunesToDungeon(roomId, myId, equippedRunes).catch(() => {});
    }
  }

  async function handleStart() {
    if (!room) return;
    setLoading(true);
    const dungeon = DUNGEON_MAPS.find(d => d.id === selDungeon);
    if (!dungeon) { setErr("請先選擇地下城"); setLoading(false); return; }
    await saveAndStartRunes();
    // 有裝備符文時，用符文加成重新寫入屬性
    if (equippedRunes.length > 0) {
      const rb = calcRuneBonus(equippedRunes);
      await updateDungeonMemberStats(
        roomId, myId,
        Math.round(myHP * rb.hpMult), Math.round(myHP * rb.hpMult),
        Math.round(myATK * rb.atkMult),
        Math.round(myDEF * rb.defMult),
        myCatName, localStorage.getItem("mb_archer_style") || "baobao", myCatATK || 0
      );
    }
    const result = await initDungeonMapRun(roomId, dungeon.id, myId);
    setLoading(false);
    if (!result.ok) { setErr(`初始化失敗：${result.reason || "請再試一次"}`); return; }
    if (unsub) unsub();
    sessionStorage.removeItem("dungeon_waiting_room");
    onEnterRoom(roomId);
  }

  // ── 等待室畫面 ────────────────────────────────────────────
  if (roomId && room) {
    const memberEntries = Object.entries(room.members || {});
    return (
      <div className="h-full overflow-hidden flex flex-col text-white" style={{ backgroundImage:"linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0.65)),url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"center" }}>
        {/* Header */}
        <div className="shrink-0 text-center py-5 border-b border-white/10">
          <div className="text-3xl mb-1">🏰</div>
          <div className="text-xl font-black">地下城等待室</div>
          <div className="text-sm text-slate-400 mt-0.5">等待夥伴從大廳加入…</div>
        </div>

        {/* 隊伍狀態一覽 */}
        <div className="shrink-0 px-4 py-2 border-b border-white/8">
          <div className="text-xs text-slate-400 mb-1.5">👥 隊伍狀態（{memberEntries.length} 人）</div>
          <div className="flex flex-wrap gap-2">
            {memberEntries.map(([id, m], i) => (
              <div key={id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
                style={{ background:"rgba(255,255,255,0.07)" }}>
                <span className="text-sm">{m.role === "rear" ? "🛡️" : "⚔️"}</span>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {m.name}{i === 0 ? " ⭐" : ""}
                  </div>
                  <div className="text-[10px] text-slate-400">HP {m.maxHP} · ATK {m.atk}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members list + 房主地下城設定（一起捲動，確保開始按鈕永遠可見）*/}
        <div className="flex-1 overflow-y-auto">
          {isHost && (
            <div className="px-5 py-4 border-b border-white/8">
              <div className="bg-slate-900/70 rounded-2xl p-5 shadow-xl">
                <div className="text-base text-slate-300 mb-3 font-black flex items-center gap-2">
                  <span>🏷️</span>
                  <span>選擇難度</span>
                  <span className="text-[11px] font-normal text-slate-500 ml-auto">影響怪物強度與獎勵</span>
                </div>
                {/* 難度：大按鈕 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                  {DIFFICULTY_CONFIGS.map(dc => (
                    <button key={dc.id} onClick={() => setSelDifficulty(dc.id)}
                      className={`relative flex flex-col items-center py-3.5 rounded-xl font-bold border transition-all ${selDifficulty===dc.id ? "shadow-lg scale-[1.02]" : "opacity-70 hover:opacity-100 hover:scale-[1.02]"}`}
                      style={{
                        background: selDifficulty===dc.id ? `${dc.color}33` : 'rgba(255,255,255,0.05)',
                        borderColor: selDifficulty===dc.id ? dc.color : 'rgba(255,255,255,0.1)',
                        color: selDifficulty===dc.id ? dc.color : '#cbd5e1',
                      }}>
                      <span className="text-2xl mb-1">{dc.icon}</span>
                      <span className="text-sm">{dc.label}</span>
                      {selDifficulty===dc.id && (
                        <span className="absolute -top-1.5 -right-1.5 text-xs bg-amber-400 text-black rounded-full w-5 h-5 flex items-center justify-center font-black shadow">✓</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="text-base text-slate-300 mb-3 font-black flex items-center gap-2">
                  <span>🏛️</span>
                  <span>選擇地下城</span>
                  <span className="text-[11px] font-normal text-slate-500 ml-auto">共 {DUNGEON_MAPS.filter(d => d.enabled && d.difficulty === selDifficulty).length} 張地圖</span>
                </div>
                {/* 地下城：大卡片網格 */}
                <div className="grid grid-cols-2 gap-4">
                  {FAMILY_CONFIGS.map(fc => {
                    const d = DUNGEON_MAPS.find(m => m.family === fc.id && m.difficulty === selDifficulty);
                    if (!d || !d.enabled) return null;
                    const dc = DIFFICULTY_CONFIGS.find(dc => dc.id === selDifficulty);
                    const isSelected = selDungeon === d.id;
                    // 該難度下各家族的 floor 數
                    const sameDiffMaps = DUNGEON_MAPS.filter(m => m.difficulty === selDifficulty && m.enabled);
                    return (
                      <button key={fc.id} onClick={() => setSelDungeon(d.id)}
                        className={`relative flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 transition-all ${isSelected ? 'shadow-xl scale-[1.03]' : 'hover:scale-[1.02]'}`}
                        style={{
                          background: isSelected
                            ? `${dc?.color || '#fbbf24'}22`
                            : 'rgba(15,23,42,0.8)',
                          borderColor: isSelected
                            ? (dc?.color || '#fbbf24')
                            : 'rgba(255,255,255,0.08)',
                        }}>
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 text-lg">✨</div>
                        )}
                        <span className="text-4xl mb-1">{fc.emoji}</span>
                        <div className={`text-base font-black ${isSelected ? 'text-amber-200' : 'text-white'}`}>
                          {fc.label}
                        </div>
                        <div className="text-xs text-slate-400">{d.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{ background:`${dc?.color || '#94a3b8'}22`, color: dc?.color || '#94a3b8' }}>
                            🏗️ {d.floorCount}層
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {sameDiffMaps.length > 0 && `${sameDiffMaps.indexOf(d)+1}/${sameDiffMaps.length}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="px-4 py-4 space-y-3">
          {memberEntries.map(([id, m], i) => {
            const isMe = id === myId;
            const isRear = m.role === "rear";
            return (
              <div key={id} className="bg-slate-900/70 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{isRear ? "🛡️" : "⚔️"}</span>
                  <div className="flex-1">
                    <div className="font-bold">{m.name}{isMe ? " (你)" : ""}</div>
                    <div className="text-xs text-slate-400">HP {m.maxHP} / ATK {m.atk} / DEF {m.def}</div>
                    {m.catName && <div className="text-xs text-indigo-300 mt-0.5">🐱 {m.catName} 神教光環 +10%</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-black ${isRear ? "bg-purple-500/30 text-purple-300" : "bg-emerald-500/30 text-emerald-300"}`}>
                    {isRear ? "🛡後衛" : "⚔️前衛"}
                  </span>
                  {i === 0 && <span className="text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">房主</span>}
                </div>
                {/* 只有自己可以切換角色 */}
                {isMe && (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => setDungeonMemberRole(roomId, myId, "front")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-all ${!isRear ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
                        ⚔️ 前衛（承受反擊）
                      </button>
                      <button onClick={() => setDungeonMemberRole(roomId, myId, "rear")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-all ${isRear ? "border-purple-400 bg-purple-400/20 text-purple-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
                        🛡 後衛（免疫反擊）
                      </button>
                    </div>
                    {/* 符文槽 */}
                    <div className="mt-2 pt-2 border-t border-white/8">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-500 font-bold">🔮 符文槽（最多{MAX_RUNE_SLOTS}個，不同類型）</span>
                        <button onClick={() => setShowRunePicker(p => !p)}
                          className="text-[10px] text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-lg">
                          {showRunePicker ? "收起" : "裝備"}
                        </button>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {equippedRunes.length === 0
                          ? <span className="text-[10px] text-slate-600">未裝備符文</span>
                          : equippedRunes.map(slot => {
                              const r = RUNES[slot.runeId];
                              if (!r) return null;
                              return (
                                <div key={slot.runeId}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer active:scale-95"
                                  style={{ background:`${r.color}22`, border:`1px solid ${r.color}55`, color: r.color }}
                                  onClick={() => toggleRune(slot.runeId)}>
                                  {r.icon} {r.label} <span className="text-slate-400">({slot.durability}次)</span> ×
                                </div>
                              );
                            })
                        }
                      </div>
                      {showRunePicker && (
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                          {Object.entries(runeInv).filter(([,qty]) => qty > 0).length === 0
                            ? <div className="text-[10px] text-slate-500 text-center py-2">背包中沒有符文</div>
                            : Object.entries(runeInv)
                                .filter(([,qty]) => qty > 0)
                                .map(([runeId, qty]) => {
                                  const r = RUNES[runeId];
                                  if (!r) return null;
                                  const isEquipped = equippedRunes.some(s => s.runeId === runeId);
                                  const sameTypeConflict = !isEquipped && equippedRunes.some(s => RUNES[s.runeId]?.typeId === r.typeId);
                                  const slotFull = !isEquipped && equippedRunes.length >= MAX_RUNE_SLOTS;
                                  const disabled = sameTypeConflict || slotFull;
                                  return (
                                    <button key={runeId}
                                      disabled={disabled}
                                      onClick={() => toggleRune(runeId)}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all disabled:opacity-30"
                                      style={{ background: isEquipped ? `${r.color}22` : "rgba(255,255,255,0.05)", border:`1px solid ${isEquipped ? r.color : "rgba(255,255,255,0.1)"}` }}>
                                      <span className="text-sm">{r.icon}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-black" style={{ color: r.color }}>{r.label}</div>
                                        <div className="text-[9px] text-slate-400">{runeEffectLabel(runeId)} · 耐久{r.durability}次</div>
                                      </div>
                                      <span className="text-[10px] text-slate-500">×{qty}</span>
                                      {isEquipped && <span className="text-emerald-400 text-[10px] font-black">✓</span>}
                                    </button>
                                  );
                                })
                          }
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10">
          {err && <div className="text-center text-rose-400 text-sm font-bold pb-2">{err}</div>}
          <div className="flex gap-2">
            <button onClick={() => { if (unsub) unsub(); sessionStorage.removeItem("dungeon_waiting_room"); setRoomId(null); setRoom(null); setErr(""); }}
              className="px-4 py-3 rounded-2xl text-slate-400 text-sm border border-white/10 bg-white/5 shrink-0">
              離開
            </button>
            {isHost ? (
              <button onClick={handleStart} disabled={loading || memberEntries.length < 1}
                className="flex-1 py-3 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40">
                {loading ? "準備中…" : `🏰 開始地下城（${memberEntries.length}人）`}
              </button>
            ) : (
              <div className="flex-1 text-center text-slate-400 text-sm py-3">等待房主開始…</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 建立 / 加入畫面 ───────────────────────────────────────
  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white" style={{ backgroundImage:"linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6)),url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"center" }}>
      {/* Header */}
      <div className="shrink-0 text-center py-8 relative">
        {onBack && (
          <button onClick={onBack} className="absolute left-4 top-6 text-slate-300 text-sm font-bold hover:text-white">← 返回</button>
        )}
        <div className="text-5xl mb-2">🏰</div>
        <div className="text-2xl font-black">地下城模式</div>
        <div className="text-sm text-slate-300 mt-1">攜帶不同任務，與夥伴深入地下城</div>
      </div>

      {/* Tab */}
      <div className="shrink-0 flex bg-slate-600/70 rounded-2xl p-1 mx-4 mb-4">
        {["create","join","dex"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab===t ? "bg-white/25 text-white" : "text-slate-300"}`}>
            {t==="create" ? "🏰 建立" : t==="join" ? "🏹 加入" : "🔮 圖鑑"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {tab === "dex" ? <DungeonDex /> : tab === "create" ? (
          <div className="space-y-4">
            <div className="bg-amber-500/20 border border-amber-400/50 rounded-2xl p-4 shadow-lg">
              <div className="font-bold text-amber-300 mb-1">🗺️ 地下城地圖模式</div>
              <ul className="text-sm text-slate-200 space-y-1 font-medium">
                <li>• 6 大種族（幽冥/山嶺/昆蟲/職場/考試/神廟）</li>
                <li>• 4 種難度（普通/進階/困難/地獄）</li>
                <li>• 共 24 張獨特地圖，每張地圖自由探索</li>
                <li>• 房間自帶合約（標準/命中/得分/全中/X爆/指定分數）</li>
                <li>• 前後衛陣型 + 符文強化</li>
                <li>• 隊伍投票移動路線</li>
              </ul>
            </div>
            {dungeonUsedToday && (
              <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-3 text-sm text-rose-300 text-center">
                🔒 今日地下城次數已使用，明天再來挑戰吧！
              </div>
            )}
            <button onClick={handleCreate} disabled={loading || !!dungeonUsedToday}
              className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40">
              {loading ? "建立中…" : "🏰 建立地下城"}
            </button>
          </div>
        ) : tab === "join" ? (
          <div className="space-y-3">
            {openRooms.length === 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                <div className="text-3xl mb-2 animate-pulse">🔍</div>
                <div className="text-slate-400 text-sm">目前沒有開放中的地下城</div>
                <div className="text-slate-600 text-xs mt-1">等待夥伴建立後自動更新</div>
              </div>
            ) : openRooms.map(r => {
              const memberCount = Object.keys(r.members || {}).length;
              const hostName = Object.values(r.members || {})[0]?.name || "未知";
              return (
                <div key={r.id} className="rounded-2xl border border-amber-500/30 bg-amber-900/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏰</span>
                      <div>
                        <div className="text-white font-black text-sm">地下城探索</div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          🧙 {hostName} 的隊伍・{memberCount} 人等待中
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(r)}
                      disabled={loading}
                      className="px-5 py-2 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {loading ? "…" : "加入"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        {tab !== "dex" && err && <div className="mt-3 text-center text-rose-400 text-sm">{err}</div>}

        {/* 地下城歷史紀錄 */}
        {tab !== "dex" && (
          <div className="mt-6">
            <BattleRecords logs={dungeonLogs} title="📊 地下城戰鬥紀錄" maxGroups={6}/>
          </div>
        )}
      </div>
    </div>
  );
}
