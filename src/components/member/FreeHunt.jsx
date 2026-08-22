import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { FAMILIES, TIER_LABEL } from "../../lib/monsterData";
import { getBattleMonsterSources } from "../../lib/battleAssets";
import { archerLevelFromXP } from "../../lib/archerLevel";
import { createPartyRoom, joinPartyRoom, subscribeOpenPartyRooms, cleanupStalePartyRooms } from "../../lib/partyDb";
import { filterPartyLobbyRooms } from "../../lib/partyLobbyRooms";
import {
  FREE_HUNT_FAMILIES,
  FREE_HUNT_TIERS,
  getFreeHuntMonsterById,
  getFreeHuntMonsters,
} from "../../lib/freeHuntCatalog";
import { applySoloVariant, selectVariant, toLegacyBattleMonster } from "../../lib/monsterExpansionAdapter";
import { FREE_HUNT_DAILY_LIMIT, FREE_HUNT_QUOTA_MODE, getFreeHuntRemaining } from "../../lib/freeHuntQuota";

const PARTY_SIZE_GUIDE = Object.freeze([
  { players:1, label:"獨自建立", pressure:"怪物基準強度", reward:"素材箱 1＋金幣箱 1" },
  { players:2, label:"雙人小隊", pressure:"怪物能力 +10%", reward:"素材箱 2＋金幣箱 2" },
  { players:3, label:"三人小隊", pressure:"怪物能力 +20%", reward:"素材箱 3＋金幣箱 3" },
  { players:4, label:"四人小隊", pressure:"怪物能力 +30%", reward:"素材箱 4＋金幣箱 4" },
  { players:"5～8", label:"大型隊伍", pressure:"每多 1 人再 +10%", reward:"每多 1 人，各多 1 箱" },
]);

function HuntMonsterArt({ monster }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = getBattleMonsterSources(monster.id);
  const family = FAMILIES[monster.family];
  if (sourceIndex >= sources.length) {
    return <div className="text-5xl" aria-label={monster.name}>{family?.icon || "👾"}</div>;
  }
  return (
    <img
      src={sources[sourceIndex]}
      alt={monster.name}
      onError={() => setSourceIndex(index => index + 1)}
      className="h-24 w-24 object-contain drop-shadow-2xl"
    />
  );
}

export default function FreeHunt({ onBack, onSolo, onMultiMonster, onEnterPartyRoom, onEnterMultiPartyRoom, resumableBattle = null, onResumeBattle, onAbandonBattle }) {
  const { profile } = useAuth();
  const [family, setFamily] = useState(FREE_HUNT_FAMILIES[0]);
  const [tierIndex, setTierIndex] = useState(1);
  const [monsterId, setMonsterId] = useState(null);
  const [showJoinRooms, setShowJoinRooms] = useState(false);
  const [showMultiJoinRooms, setShowMultiJoinRooms] = useState(false);
  const [openRooms, setOpenRooms] = useState([]);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyError, setPartyError] = useState("");
  const [multiPartyMessage, setMultiPartyMessage] = useState("");

  const myId = profile?.id;
  const myName = profile?.nickname || profile?.name || "射手";
  const accountType = profile?.accountType || "official";
  const level = archerLevelFromXP(profile?.archerXP || 0);
  const singleRemaining = getFreeHuntRemaining(profile, FREE_HUNT_QUOTA_MODE.SINGLE);
  const multiRemaining = getFreeHuntRemaining(profile, FREE_HUNT_QUOTA_MODE.MULTI);

  const monsters = useMemo(() => getFreeHuntMonsters(family, tierIndex), [family, tierIndex]);
  const selected = monsters.find(monster => monster.id === monsterId) || null;
  const tierMeta = selected ? TIER_LABEL[selected.tier] : null;
  const familyMeta = FAMILIES[family];
  const joinRooms = filterPartyLobbyRooms(openRooms, { huntMonsterId:"__free_hunt__", tab:"join" });
  const multiJoinRooms = filterPartyLobbyRooms(openRooms, { huntType:"multi", tab:"join" });

  useEffect(() => {
    if (!showJoinRooms && !showMultiJoinRooms) return undefined;
    cleanupStalePartyRooms();
    const unsub = subscribeOpenPartyRooms(setOpenRooms);
    return () => { unsub?.(); setOpenRooms([]); };
  }, [showJoinRooms, showMultiJoinRooms]);

  function chooseFamily(nextFamily) {
    setFamily(nextFamily);
    setMonsterId(null);
  }

  function chooseTier(nextTier) {
    setTierIndex(nextTier);
    setMonsterId(null);
  }

  async function createSelectedParty() {
    if (!selected || !myId || partyLoading) return;
    if (singleRemaining <= 0) { setPartyError("今日指定單怪次數已用完（5/5）"); return; }
    setPartyLoading(true); setPartyError("");
    const rolledMonster = applySoloVariant(toLegacyBattleMonster(selected), selectVariant(), Math.random());
    const res = await createPartyRoom(myId, myName, "battle", {
      accountType, level,
      huntMonsterId: selected.id,
      monsterId: selected.id,
      huntDistanceM: 5,
      huntTargetFmt: "half_17",
      bowType: "recurve_bare",
      monsterSnapshot: rolledMonster,
    });
    setPartyLoading(false);
    if (res.ok) onEnterPartyRoom?.(res.roomId, "battle", true, selected);
    else setPartyError(res.reason || "建立房間失敗");
  }

  async function joinOpenRoom(room) {
    if (!myId || partyLoading) return;
    setPartyLoading(true); setPartyError("");
    const roomMonster = room.monsterSnapshot || getFreeHuntMonsterById(room.monsterId || room.huntMonsterId);
    const res = await joinPartyRoom(room.code, myId, myName, {
      accountType, level,
      huntDistanceM:5, huntTargetFmt:"half_17", bowType:"recurve_bare",
    });
    setPartyLoading(false);
    if (res.ok) onEnterPartyRoom?.(res.roomId, "battle", false, roomMonster || null);
    else setPartyError(res.reason || "加入房間失敗");
  }

  async function createMultiParty() {
    if (!myId || partyLoading) return;
    if (multiRemaining <= 0) { setPartyError("今日複數討伐次數已用完（5/5）"); return; }
    setPartyLoading(true);
    setPartyError("");
    setMultiPartyMessage("");
    const res = await createPartyRoom(myId, myName, "battle", {
      accountType,
      level,
      huntType:"multi",
      multiMonster:true,
      multiFamily:family,
      multiTier:tierIndex,
      huntDistanceM:Number(profile?.huntDistanceM) || 5,
      huntTargetFmt:profile?.huntTargetFmt || "half_17",
      bowType:profile?.bowType || "recurve_bare",
    });
    setPartyLoading(false);
    if (res.ok) {
      onEnterMultiPartyRoom?.(res.roomId, true, { family, tier:tierIndex, code:res.code });
    } else {
      setPartyError(res.reason || "建立複數討伐等待房失敗");
    }
  }

  async function joinMultiRoom(room) {
    if (!myId || partyLoading) return;
    setPartyLoading(true);
    setPartyError("");
    setMultiPartyMessage("");
    const res = await joinPartyRoom(room.code, myId, myName, {
      accountType,
      level,
      huntDistanceM:Number(profile?.huntDistanceM) || 5,
      huntTargetFmt:profile?.huntTargetFmt || "half_17",
      bowType:profile?.bowType || "recurve_bare",
    });
    setPartyLoading(false);
    if (res.ok) {
      onEnterMultiPartyRoom?.(res.roomId, false, { family:room.multiFamily, tier:Number(room.multiTier) || tierIndex, code:room.code });
    } else {
      setPartyError(res.reason || "加入複數討伐等待房失敗");
    }
  }

  return (
    <div className="min-h-screen px-4 pb-8 pt-4 text-white"
      style={{ background:"radial-gradient(circle at 50% -10%, rgba(99,102,241,.28), transparent 38%), linear-gradient(180deg,#07101f 0%,#0f172a 48%,#050914 100%)" }}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div
          className="relative min-h-[230px] overflow-hidden rounded-3xl border border-indigo-300/25 bg-slate-950 p-5 shadow-2xl"
          style={{
            backgroundImage:"linear-gradient(180deg,rgba(4,9,22,.48) 0%,rgba(4,9,22,.16) 38%,rgba(4,9,22,.93) 100%), url('/ui/hunt/hunt-hero-v1.webp')",
            backgroundPosition:"center",
            backgroundSize:"cover",
          }}
          data-hunt-art="hero"
        >
          <button onClick={onBack} className="absolute left-4 top-4 rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur-sm">← 冒險</button>
          <div className="absolute inset-x-5 bottom-5">
            <div className="inline-flex rounded-full border border-cyan-200/20 bg-slate-950/55 px-3 py-1 text-[10px] font-black tracking-[.18em] text-cyan-100 backdrop-blur-sm">七族狩獵路線</div>
            <h1 className="mt-2 text-3xl font-black text-white drop-shadow-lg">自由狩獵</h1>
            <p className="mt-1 max-w-xs text-xs font-bold leading-relaxed text-slate-200 drop-shadow">指定族群、危險等級與討伐目標，踏上自己的狩獵路線。</p>
          </div>
        </div>

        {resumableBattle && <section className="rounded-3xl border border-amber-300/40 bg-amber-950/35 p-4 shadow-xl" data-hunt-resume-card="true">
          <div className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">BATTLE IN PROGRESS</div>
          <div className="mt-1 text-base font-black text-white">⚔️ 尚有一場狩獵戰鬥未完成</div>
          <div className="mt-1 text-xs text-amber-100/70">戰鬥進度、護盾與同行貓咪狀態皆已保留。</div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={onResumeBattle} className="min-h-12 rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 text-sm font-black text-amber-950">返回戰鬥</button>
            <button onClick={onAbandonBattle} className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-black text-slate-300">放棄</button>
          </div>
        </section>}

        <details className="group rounded-3xl border border-cyan-400/20 bg-slate-950/70 shadow-xl">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 active:bg-white/[.03]">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">HOW TO PLAY</div>
              <div className="mt-0.5 text-sm font-black text-white">📖 設定與組隊人數說明</div>
            </div>
            <span className="text-lg text-cyan-200 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-4 border-t border-cyan-400/15 px-4 pb-4 pt-3 text-xs leading-relaxed text-slate-300">
            <div>
              <div className="font-black text-indigo-200">狩獵目標設定</div>
              <p className="mt-1 text-slate-400">先選七大族、第一至第六階，再指定該族的一般怪物。目標一旦建立隊伍便會鎖定；自由狩獵不會抽到小王、大王或世界王。</p>
            </div>

            <div>
              <div className="font-black text-indigo-200">每位射手各自設定</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-white/[.04] p-2"><b className="text-white">距離</b><br/><span className="text-slate-400">5 米為 ×1.00；距離越遠倍率越高，18 米約 ×1.90。</span></div>
                <div className="rounded-xl bg-white/[.04] p-2"><b className="text-white">靶紙</b><br/><span className="text-slate-400">半靶 ×1.0、全靶 ×1.2、原野靶 ×1.4、三連靶 ×1.5。</span></div>
                <div className="rounded-xl bg-white/[.04] p-2"><b className="text-white">弓種</b><br/><span className="text-slate-400">裸弓、反曲弓、獵弓／複合弓為 ×1；傳統弓為 ×2。</span></div>
              </div>
              <p className="mt-2 text-slate-500">距離 × 靶紙 × 弓種會形成你自己的傷害倍率，不會改變隊友。三連靶每張最多計入 2 箭，六箭需分配至三張靶。</p>
            </div>

            <div>
              <div className="font-black text-amber-200">組隊人數有什麼差異？</div>
              <p className="mt-1 text-slate-400">房間最多 8 人。每多一位隊員，怪物生命、攻擊與防禦再提高 10%；戰勝後，每位有參戰的玩家都會按本場隊伍人數取得同等數量的族系材料箱與金幣箱。</p>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                {PARTY_SIZE_GUIDE.map((row, index) => (
                  <div key={row.players} className={`grid grid-cols-[52px_1fr] gap-2 px-3 py-2 ${index ? "border-t border-white/5" : ""} ${index % 2 ? "bg-white/[.025]" : "bg-black/10"}`}>
                    <div className="font-black text-cyan-200">{row.players} 人</div>
                    <div><b className="text-white">{row.label}</b><span className="text-slate-500">・{row.pressure}</span><br/><span className="text-emerald-300">每人：{row.reward}</span></div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">前衛／後衛位置不影響寶箱數量；必須實際參戰並完成戰鬥，才具有領獎資格。</p>
            </div>
          </div>
        </details>

        <section
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-xl"
          style={{
            backgroundImage:"linear-gradient(180deg,rgba(5,10,22,.78),rgba(5,10,22,.9)), url('/ui/hunt/hunt-family-map-v1.webp')",
            backgroundPosition:"center",
            backgroundSize:"cover",
          }}
          data-hunt-art="family-map"
        >
          <div className="relative z-10 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-indigo-300">STEP 1</div>
              <div className="text-base font-black">選擇七大族</div>
            </div>
            <div className="text-xs font-bold" style={{ color:familyMeta?.color }}>{familyMeta?.icon} {familyMeta?.label}</div>
          </div>
          <div className="relative z-10 grid grid-cols-4 gap-2">
            {FREE_HUNT_FAMILIES.map(id => {
              const meta = FAMILIES[id];
              const active = id === family;
              return (
                <button key={id} onClick={() => chooseFamily(id)}
                  className="min-h-16 rounded-2xl border px-2 py-2 text-center transition-all active:scale-95"
                  style={{ borderColor: active ? meta?.color : "rgba(255,255,255,.12)", background: active ? `${meta?.color}38` : "rgba(2,6,23,.58)", backdropFilter:"blur(5px)" }}>
                  <div className="text-2xl">{meta?.icon || "👾"}</div>
                  <div className="mt-1 truncate text-[10px] font-black" style={{ color: active ? meta?.color : "#94a3b8" }}>{meta?.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="mb-3">
            <div className="text-[10px] font-black uppercase tracking-[.22em] text-amber-300">STEP 2</div>
            <div className="text-base font-black">選擇危險等級</div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {FREE_HUNT_TIERS.map(tier => {
              const sample = getFreeHuntMonsters(family, tier)[0];
              const meta = sample ? TIER_LABEL[sample.tier] : null;
              const active = tier === tierIndex;
              return (
                <button key={tier} onClick={() => chooseTier(tier)}
                  className="rounded-xl border py-3 text-center active:scale-95"
                  style={{ borderColor: active ? meta?.color : "rgba(255,255,255,.08)", background: active ? `${meta?.color}20` : "rgba(255,255,255,.025)" }}>
                  <div className="text-sm font-black" style={{ color: active ? meta?.color : "#94a3b8" }}>T{tier}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-slate-500">T5 的資料階級名稱雖為「頭目」，自由狩獵只依 encounter=normal 收錄，因此不包含任何真正的王。</div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="mb-3">
            <div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">STEP 3</div>
            <div className="text-base font-black">指定討伐怪物</div>
          </div>
          <div
            data-multi-hunt-entry="true"
            className="mb-4 w-full rounded-2xl border border-red-400/35 bg-gradient-to-r from-red-950/80 via-orange-950/65 to-slate-950/80 p-4 text-left shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.22em] text-orange-300">MULTI HUNT</div>
                <div className="mt-1 text-base font-black text-white">⚔️ 複數討伐戰</div>
                <div className="mt-1 text-[11px] font-bold text-orange-100/75">{familyMeta?.icon} {familyMeta?.label} · T{tierIndex} · 固定 3 隻前排怪物同時登場</div>
              </div>
              <div className="shrink-0 rounded-xl border border-orange-300/25 bg-orange-400/10 px-3 py-2 text-xs font-black text-orange-200">3 怪同場</div>
            </div>
            <div className="mt-2 text-[10px] leading-relaxed text-slate-400">不需要指定單一怪物；三隻怪各自抽取弱化／普通／強悍，後排另有機率出現 0～2 根治療符文柱。</div>
            <div className={`mt-2 text-[11px] font-black ${multiRemaining > 0 ? "text-emerald-300" : "text-red-300"}`}>今日複數討伐剩餘 {multiRemaining}/{FREE_HUNT_DAILY_LIMIT} 次 · 組隊只扣房主</div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                data-multi-hunt-solo="true"
                onClick={() => { if (multiRemaining > 0) onMultiMonster?.({ family, tierIndex }); }}
                disabled={multiRemaining <= 0}
                className="min-h-12 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-3 text-sm font-black text-white shadow-lg active:scale-95 disabled:opacity-45"
              >⚔️ 單人討伐</button>
              <button
                type="button"
                data-multi-hunt-create-party="true"
                onClick={createMultiParty}
                disabled={partyLoading || !myId || multiRemaining <= 0}
                className="min-h-12 rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 text-sm font-black text-amber-100 active:scale-95 disabled:opacity-50"
              >{partyLoading ? "建立中…" : "🤝 建立隊伍"}</button>
              <button
                type="button"
                data-multi-hunt-join-party="true"
                onClick={() => { setShowMultiJoinRooms(v => !v); setPartyError(""); setMultiPartyMessage(""); }}
                className="min-h-12 rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 text-sm font-black text-cyan-100 active:scale-95"
              >🔎 {showMultiJoinRooms ? "收起隊伍" : "加入隊伍"}</button>
            </div>
            <div className="mt-2 text-[10px] text-orange-100/55">最多 8 人同步討伐；房主設定 3／6 箭後開戰，全隊共享怪物 HP、隊員狀態與每回合權威結算。</div>
            {multiPartyMessage && <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-[11px] font-bold leading-relaxed text-emerald-100">{multiPartyMessage}</div>}
            {showMultiJoinRooms && (
              <div className="mt-3 flex flex-col gap-2 border-t border-orange-300/15 pt-3">
                <div className="text-[10px] font-black uppercase tracking-[.18em] text-orange-200">等待中的複數討伐隊伍（{multiJoinRooms.length}）</div>
                {multiJoinRooms.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-center text-xs font-bold text-slate-500">目前沒有複數討伐等待房</div>
                ) : multiJoinRooms.map(room => {
                  const memberCount = Object.keys(room.members || {}).length;
                  const hostName = room.members?.[room.hostId]?.name || "未知射手";
                  const roomFamily = FAMILIES[room.multiFamily];
                  const full = memberCount >= 8;
                  return (
                    <div key={room.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black text-white">{hostName} 的複數討伐隊伍</div>
                        <div className="mt-0.5 text-[10px] font-bold text-orange-200">{roomFamily?.icon || "👾"} {roomFamily?.label || room.multiFamily || "未知族群"} · T{room.multiTier || "?"}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">👤 {memberCount}/8 人 · 等待同步功能</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => joinMultiRoom(room)}
                        disabled={partyLoading || full}
                        className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
                      >{full ? "已滿" : partyLoading ? "…" : "加入"}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {monsters.map(monster => {
              const active = monster.id === monsterId;
              const tier = TIER_LABEL[monster.tier];
              return (
                <button key={monster.id} onClick={() => setMonsterId(monster.id)}
                  className="rounded-2xl border p-3 text-left transition-all active:scale-[.98]"
                  style={{ borderColor: active ? "#818cf8" : "rgba(255,255,255,.09)", background: active ? "rgba(79,70,229,.22)" : "rgba(15,23,42,.72)", boxShadow: active ? "0 0 28px rgba(99,102,241,.18)" : "none" }}>
                  <div className="flex items-center gap-3 sm:flex-col">
                    <HuntMonsterArt monster={monster} />
                    <div className="min-w-0 flex-1 sm:text-center">
                      <div className="truncate text-sm font-black text-white">{monster.name}</div>
                      <div className="mt-1 text-[10px] font-black" style={{ color:tier?.color }}>T{monster.tierIndex} · {tier?.label}</div>
                      <div className="mt-1 flex gap-2 text-[10px] text-slate-400 sm:justify-center"><span>HP {monster.hp}</span><span>ATK {monster.atk}</span><span>DEF {monster.def}</span></div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-indigo-400/20 bg-gradient-to-b from-indigo-950/55 to-slate-950/80 p-4 shadow-2xl">
          <div className="mb-3">
            <div className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">STEP 4</div>
            <div className="text-base font-black">選擇入場方式</div>
          </div>
          {selected ? (
            <>
              <div className="flex items-center gap-3">
                <HuntMonsterArt monster={selected} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-300">TARGET LOCKED</div>
                  <div className="text-lg font-black">{selected.name}</div>
                  <div className="mt-1 text-xs font-bold" style={{ color:tierMeta?.color }}>{familyMeta?.label} · T{selected.tierIndex} {tierMeta?.label}</div>
                  <div className="mt-2 text-[11px] leading-relaxed text-slate-400">{selected.signatureSummary || "一般討伐目標"}</div>
                  <div className="mt-1 text-[11px] text-amber-300">掉落：{selected.material?.name || "族群素材"}</div>
                </div>
              </div>
              <div className={`mt-3 text-center text-[11px] font-black ${singleRemaining > 0 ? "text-emerald-300" : "text-red-300"}`}>今日指定單怪剩餘 {singleRemaining}/{FREE_HUNT_DAILY_LIMIT} 次 · 組隊只扣房主</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => { if (singleRemaining > 0) onSolo?.(selected); }} disabled={singleRemaining <= 0} className="min-h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 font-black text-white shadow-lg active:scale-95 disabled:opacity-45">⚔️ 單人狩獵</button>
                <button onClick={createSelectedParty} disabled={partyLoading || !myId || singleRemaining <= 0} className="min-h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 font-black text-slate-950 shadow-lg active:scale-95 disabled:opacity-50">{partyLoading ? "建立中…" : "🤝 建立隊伍"}</button>
                <button onClick={() => { setShowJoinRooms(v => !v); setPartyError(""); }}
                  className="min-h-12 rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-3 font-black text-cyan-100 active:scale-95">
                  🔎 {showJoinRooms ? "收起隊伍" : "加入隊伍"}
                </button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <div className="py-3 text-center text-sm font-bold text-slate-500">單人狩獵與建立隊伍需先指定討伐目標。</div>
              <button onClick={() => { setShowJoinRooms(v => !v); setPartyError(""); }}
                className="min-h-12 rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-3 font-black text-cyan-100 active:scale-95">
                🔎 {showJoinRooms ? "收起隊伍" : "加入現有隊伍"}
              </button>
            </div>
          )}
          {showJoinRooms && (
            <div className="mt-4 flex flex-col gap-2 border-t border-cyan-400/15 pt-4">
              <div className="px-1 text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">等待中的自由狩獵隊伍（{joinRooms.length}）</div>
              {joinRooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.03] p-5 text-center text-xs font-bold text-slate-500">目前沒有等待中的隊伍</div>
              ) : joinRooms.map(room => {
                const memberCount = Object.keys(room.members || {}).length;
                const hostName = room.members?.[room.hostId]?.name || "未知射手";
                const roomMonster = room.monsterSnapshot || getFreeHuntMonsterById(room.monsterId || room.huntMonsterId);
                const full = memberCount >= 8;
                return (
                  <div key={room.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/65 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-white">{hostName} 的隊伍</div>
                      <div className="mt-0.5 truncate text-[11px] font-bold text-violet-300">🎯 {roomMonster ? `T${roomMonster.tierIndex}・${roomMonster.name}` : "自由狩獵"}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">👤 {memberCount}/8 人</div>
                    </div>
                    <button onClick={() => joinOpenRoom(room)} disabled={partyLoading || full}
                      className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">
                      {full ? "已滿" : partyLoading ? "…" : "加入"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {partyError && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/35 p-2 text-center text-xs font-bold text-red-300">{partyError}</div>}
        </section>
      </div>
    </div>
  );
}
