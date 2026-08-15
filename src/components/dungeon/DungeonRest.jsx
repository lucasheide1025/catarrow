import { useEffect, useMemo, useState } from "react";
import { claimPersonalDungeonRest, resolveNonCombatRoom } from "../../lib/dungeonDb";
import {
  DUNGEON_REST_OPTIONS,
  getDungeonRestOptionState,
  resolveDungeonRestChoice,
} from "../../lib/dungeonRestRules";
import { sfxBuff, sfxError, sfxPotionDrink, sfxSuccess, sfxTap } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

const OPTION_META = {
  rest:{ icon:"💤", color:"#4ade80", x:0, y:0, eyebrow:"RECOVER" },
  prepare:{ icon:"🛡️", color:"#60a5fa", x:1, y:0, eyebrow:"DEFENCE" },
  polish:{ icon:"⚔️", color:"#fb923c", x:0, y:1, eyebrow:"OFFENCE" },
  blessing:{ icon:"✨", color:"#c084fc", x:1, y:1, eyebrow:"REVIVE" },
};

export default function DungeonRest({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
  coins = 0,
}) {
  const members = room?.members || {};
  const me = members[memberId] || {};
  const resultFromRoom = room?.restResults?.[memberId] || null;
  const alreadyDone = !!room?.roomConfirms?.[memberId] || !!resultFromRoom;
  const [localResult, setLocalResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const result = resultFromRoom || localResult;
  const validIds = Object.entries(members)
    .filter(([, member]) => member && member.alive !== false)
    .map(([id]) => id);
  const allDone = localMode
    ? !!localResult
    : validIds.every(id => room?.roomConfirms?.[id] === true);
  const bonuses = result?.restBonuses || me.restBonuses || { atkPct:0, defPct:0 };

  useEffect(() => { sfxBuff(); }, []);

  const options = useMemo(() => DUNGEON_REST_OPTIONS
    .map(option => ({
      ...option,
      state:getDungeonRestOptionState(me, option.id, { localMode, coins }),
      meta:OPTION_META[option.id],
    }))
    .filter(option => option.state.visible), [me, localMode, coins]);

  async function choose(option) {
    if (loading || alreadyDone || localResult || !option.state.enabled) return;
    setLoading(true);
    setError("");
    sfxTap();
    if (localMode) {
      const next = resolveDungeonRestChoice(me, option.id);
      setLocalResult(next);
      onLocalEffect?.({ type:"rest_result", result:next });
      option.id === "rest" ? sfxPotionDrink() : sfxBuff();
      setLoading(false);
      return;
    }
    const claim = await claimPersonalDungeonRest(roomId, memberId, option.id);
    if (!claim.ok) {
      setError(claim.reason);
      sfxError();
    } else {
      option.id === "rest" ? sfxPotionDrink() : sfxBuff();
    }
    setLoading(false);
  }

  async function continueRoom() {
    if (localMode) {
      onLocalDone?.();
      return;
    }
    if (!isHost || !allDone) return;
    sfxSuccess();
    if (onSharedDone) await onSharedDone();
    else await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const hpPct = Math.max(0, Math.min(100, ((result?.hp ?? me.hp ?? 0) / (me.maxHP || 100)) * 100));
  return (
    <DungeonEventStage tone="rest">
      <style>{`
        @keyframes rest-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes rest-result{0%{transform:scale(.92);opacity:0}70%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}
        .rest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .rest-option-art{aspect-ratio:1/1;height:auto}
        .rest-stage-main{width:min(calc(100% - 24px),768px)!important;margin-inline:auto!important}
        @media(max-width:640px){
          .rest-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
          .rest-option-copy{padding:9px!important}
          .rest-option-title{font-size:13px!important}
          .rest-option-desc{font-size:9px!important;line-height:1.35!important}
          .rest-option-icon{left:8px!important;bottom:7px!important;font-size:24px!important}
        }
      `}</style>
      <header className="dungeon-stage-header px-5 py-5 text-center border-b border-purple-400/20">
        <div className="text-[11px] font-black tracking-[.22em] text-purple-300">PERSONAL REST</div>
        <h2 className="mt-1 text-2xl font-black text-white">選擇這次的休息方式</h2>
        <p className="mt-1 text-xs text-slate-400">每位玩家各自選擇，效果只套用在自己身上</p>
      </header>

      <main className="dungeon-stage-main rest-stage-main p-4 md:p-6">
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-white">{me.name || "射手"}</div>
              <div className="mt-1 text-[10px] text-slate-400">
                {me.role === "rear" ? "後衛" : "前衛"} · 金幣 {Number(coins).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2 text-[10px] font-black">
              <span className="rounded-full bg-orange-400/15 px-3 py-1 text-orange-300">攻擊 +{bonuses.atkPct || 0}%</span>
              <span className="rounded-full bg-blue-400/15 px-3 py-1 text-blue-300">防禦 +{bonuses.defPct || 0}%</span>
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-700" style={{ width:`${hpPct}%` }} />
          </div>
          <div className="mt-1 text-right text-[10px] font-bold text-slate-300">
            生命 {result?.hp ?? me.hp ?? 0} / {me.maxHP || 100}
          </div>
        </section>

        {result ? (
          <section className="mt-5 rounded-3xl border border-emerald-400/30 bg-emerald-950/30 p-6 text-center" style={{ animation:"rest-result .5s ease both" }}>
            <div className="text-5xl">{OPTION_META[result.option]?.icon || "✨"}</div>
            <div className="mt-3 text-xl font-black text-emerald-200">選擇完成</div>
            <p className="mt-2 text-sm font-bold text-white">{result.resultText}</p>
            {result.keptPrevious && <p className="mt-2 text-xs text-amber-300">這次擲值較低，已保留原本最高加成。</p>}
            <button type="button" onClick={continueRoom}
              disabled={!localMode && (!isHost || !allDone)}
              className="mt-5 min-h-12 w-full rounded-2xl bg-emerald-300 px-5 font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">
              {localMode ? "繼續探索" : isHost ? (allDone ? "帶領隊伍繼續" : "等待所有隊員完成…") : "已完成，等待房主…"}
            </button>
          </section>
        ) : (
          <div className="rest-grid mt-5">
            {options.map((option, index) => (
              <button key={option.id} type="button" onClick={() => choose(option)}
                disabled={loading || !option.state.enabled || alreadyDone}
                className="overflow-hidden rounded-3xl border text-left shadow-xl transition duration-200 enabled:hover:-translate-y-1 enabled:hover:brightness-110 disabled:opacity-45"
                style={{ borderColor:`${option.meta.color}55`, background:"rgba(15,23,42,.92)", animation:`rest-in .45s ${index * .08}s both` }}>
                <div className="rest-option-art relative overflow-hidden"
                  style={{ background:`linear-gradient(135deg,${option.meta.color}40,#020617)` }}>
                  <img src="/ui/dungeon/rest-options-sheet.webp" alt="" loading="lazy"
                    className="absolute max-w-none opacity-90"
                    style={{ width:"200%", height:"200%", left:option.meta.x ? "-100%" : 0, top:option.meta.y ? "-100%" : 0 }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  <span className="rest-option-icon absolute bottom-3 left-4 text-4xl">{option.meta.icon}</span>
                </div>
                <div className="rest-option-copy p-4">
                  <div className="text-[9px] font-black tracking-[.2em]" style={{ color:option.meta.color }}>{option.meta.eyebrow}</div>
                  <div className="rest-option-title mt-1 text-lg font-black text-white">{option.title}</div>
                  <p className="rest-option-desc mt-1 text-xs leading-5 text-slate-300">{option.desc}</p>
                  {!option.state.enabled && <p className="mt-2 text-[11px] font-bold text-rose-300">{option.state.reason}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-950/50 p-3 text-center text-xs font-bold text-rose-200">{error}</div>}
      </main>
    </DungeonEventStage>
  );
}
