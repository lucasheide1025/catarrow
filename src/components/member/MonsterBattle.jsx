// src/components/member/MonsterBattle.jsx
// 打怪模式：新手模式第一階段
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertRecords, getCertification, subscribeDexGrants, getDexConfig, addBadge, createNotification } from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { MONSTERS, BODY_PARTS, TIER_LABEL, calcArcherStats, calcDamage, calcCounterDamage, rollDice } from "../../lib/monsterData";
import { LOOT_TABLE_NOVICE, drawLoot, isRareLoot } from "../../lib/lootTable";
import { sfxEpic, sfxSuccess, sfxTap, sfxSoftFail } from "../../lib/sound";

const ARROWS_PER_ROUND = 3; // 每回合3箭

export default function MonsterBattle({ onBack }) {
  const { profile } = useAuth();
  const [phase, setPhase]       = useState("select");   // select / prebattle / battle / result
  const [monster, setMonster]   = useState(null);
  const [archerStats, setArcherStats] = useState(null);
  const [certRecords, setCertRecords] = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexGrants, setDexGrants] = useState([]);
  const [dexConfig,  setDexConfig]  = useState({ physicalMax: 20, pointMax: 20 });

  // 戰鬥狀態
  const [archerHP,   setArcherHP]   = useState(100);
  const [monsterHP,  setMonsterHP]  = useState(0);
  const [round,      setRound]      = useState(1);
  const [log,        setLog]        = useState([]);       // 戰鬥紀錄
  const [phase2,     setPhase2]     = useState("archer"); // archer / counter / roundEnd
  const [arrows,     setArrows]     = useState([]);       // 本回合已選部位 [{part, dmg, dice}]
  const [unlockedParts, setUnlockedParts] = useState(new Set()); // 已解鎖器官
  const [revived,    setRevived]    = useState(false);    // 是否已用過復活
  const [loot,       setLoot]       = useState(null);     // 掉寶結果
  const [counterDmg, setCounterDmg] = useState(0);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    getCertification(profile.id).then(setCertification).catch(() => {});
    getDexConfig().then(setDexConfig).catch(() => {});
    const unsub = subscribeDexGrants(profile.id, setDexGrants);
    return () => unsub && unsub();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !certRecords) return;
    const ds = computeDexStats({ member: profile, certification, certRecords, checkinCount: profile?.dailyQuestCount || 0, granted: dexGrants, physicalMax: dexConfig.physicalMax, pointMax: dexConfig.pointMax });
    const stats = calcArcherStats({ member: profile, certification, certRecords, dexStats: ds });
    setArcherStats(stats);
  }, [profile, certification, certRecords, dexGrants]); // eslint-disable-line

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function selectMonster(m) {
    setMonster(m);
    setPhase("prebattle");
  }

  function startBattle() {
    const hp = archerStats?.hp || 100;
    setArcherHP(hp);
    setMonsterHP(monster.hp);
    setRound(1);
    setLog([{ type: "system", text: `⚔️ 戰鬥開始！${monster.name} 出現了！` }]);
    setPhase2("archer");
    setArrows([]);
    setUnlockedParts(new Set());
    setRevived(false);
    setLoot(null);
    setPhase("battle");
    sfxTap();
  }

  // 選擇部位射箭
  function shootPart(part) {
    if (arrows.length >= ARROWS_PER_ROUND) return;
    if (part.locked && !unlockedParts.has(part.locked)) return; // 器官未解鎖
    sfxTap();
    const dice = rollDice();
    const dmg = calcDamage({
      archerATK: archerStats?.atk || 10,
      monsterDEF: monster.def,
      partMult: part.mult,
      diceResult: dice,
    });
    const newArrows = [...arrows, { part, dmg, dice }];
    setArrows(newArrows);

    // 解鎖器官
    const newUnlocked = new Set(unlockedParts);
    if (part.id === "chest") { newUnlocked.add("chest"); }
    if (part.id === "belly") { newUnlocked.add("belly"); }
    if (part.id === "groin") { newUnlocked.add("groin"); }
    setUnlockedParts(newUnlocked);

    const logEntry = part.mult === 0
      ? { type: "miss",   text: `💨 第 ${newArrows.length} 箭脫靶！` }
      : { type: "hit",    text: `${part.icon} 命中${part.name}！骰子🎲${dice}，造成 ${dmg} 點傷害` };
    setLog(l => [...l, logEntry]);

    // 射完3箭 → 結算回合
    if (newArrows.length >= ARROWS_PER_ROUND) {
      setTimeout(() => resolveRound(newArrows, newUnlocked), 300);
    }
  }

  function resolveRound(finalArrows, finalUnlocked) {
    // 計算本回合總傷害
    const totalDmg = finalArrows.reduce((s, a) => s + a.dmg, 0);
    const headHit  = finalArrows.some(a => a.part.id === "head");
    const newMonsterHP = Math.max(0, monsterHP - totalDmg);
    setMonsterHP(newMonsterHP);
    setLog(l => [...l, { type: "total", text: `本回合總傷害 ${totalDmg}，${monster.name} 剩餘 HP：${newMonsterHP}` }]);

    if (newMonsterHP <= 0) {
      // 怪物死了
      setTimeout(() => endBattle("win"), 600);
      return;
    }

    // 怪物反擊
    setPhase2("counter");
    const cdmg = calcCounterDamage({
      monsterATK: monster.atk,
      archerDEF: archerStats?.def || 10,
      headStunned: headHit,
    });
    setCounterDmg(cdmg);
    const counterText = headHit
      ? `💫 ${monster.name} 被打暈！反擊傷害減半，造成 ${cdmg} 點傷害`
      : `${monster.icon} ${monster.name} 反擊！造成 ${cdmg} 點傷害`;
    setLog(l => [...l, { type: "counter", text: counterText }]);

    const newArcherHP = Math.max(0, archerHP - cdmg);
    setArcherHP(newArcherHP);

    if (newArcherHP <= 0) {
      // 射手陣亡
      if (!revived) {
        // 完全治癒術復活
        setTimeout(() => {
          setLog(l => [...l, { type: "revive", text: "💖 教練施展【完全治癒術】！你從瀕死狀態恢復，只剩最後一條命！" }]);
          setArcherHP(Math.ceil((archerStats?.hp || 100) * 0.3)); // 恢復30% HP
          setRevived(true);
          setPhase2("archer");
          setArrows([]);
          setRound(r => r + 1);
          sfxEpic();
        }, 800);
      } else {
        setTimeout(() => endBattle("lose"), 600);
      }
      return;
    }

    // 繼續下一回合
    setTimeout(() => {
      setPhase2("archer");
      setArrows([]);
      setRound(r => r + 1);
      setLog(l => [...l, { type: "system", text: `── 第 ${round + 1} 回合 ──` }]);
    }, 1000);
  }

  function endBattle(result) {
    if (result === "win") {
      sfxEpic();
      const lootItem = drawLoot(LOOT_TABLE_NOVICE);
      setLoot(lootItem);
      setLog(l => [...l, { type: "win", text: `🏆 擊倒 ${monster.name}！恭喜獲勝！` }]);
      setLog(l => [...l, { type: "loot", text: `🎁 掉落：${lootItem.icon} ${lootItem.name}` }]);
      // 稀有掉落發全場公告
      if (isRareLoot(lootItem) && profile?.id) {
        createNotification({
          type: "high_score",
          title: `🎁 ${profile.nickname || profile.name} 獲得稀有掉落！`,
          content: `${profile.nickname || profile.name} 擊倒了 ${monster.name}，獲得【${lootItem.name}】！全場為他喝采！`,
          targetMemberId: null,
          subjectMemberId: profile.id,
          subjectInfo: { nickname: profile.nickname || profile.name, item: lootItem.name },
        }, profile.id).catch(() => {});
      }
    } else {
      sfxSoftFail();
      setLog(l => [...l, { type: "lose", text: `💀 你被 ${monster.name} 擊倒了…下次再戰！` }]);
    }
    setPhase("result");
  }

  // ── 畫面 ──

  if (phase === "select") {
    return (
      <div className="p-4 flex flex-col gap-4">
        {onBack && <button onClick={onBack} className="text-gray-500 text-sm self-start">← 返回</button>}
        <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-xs tracking-widest text-purple-200 font-black mb-1">⚔️ 打怪模式</div>
          <div className="text-2xl font-black mb-1">選擇你的對手</div>
          {archerStats && (
            <div className="flex gap-3 text-sm mt-2">
              <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ HP {archerStats.hp}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ ATK {archerStats.atk}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ DEF {archerStats.def}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MONSTERS.map(m => {
            const tier = TIER_LABEL[m.tier];
            return (
              <button key={m.id} onClick={() => selectMonster(m)}
                className="bg-white border border-gray-200 rounded-2xl p-4 text-left hover:border-purple-300 hover:bg-purple-50 transition-all active:scale-95">
                <div className="text-3xl mb-2">{m.icon}</div>
                <div className="font-black text-gray-800 text-sm">{m.name}</div>
                <div className="text-xs mt-1" style={{ color: tier.color }}>【{tier.label}】</div>
                <div className="text-gray-400 text-xs mt-1 leading-tight">{m.desc}</div>
                <div className="flex gap-2 mt-2 text-xs text-gray-500">
                  <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "prebattle") {
    return (
      <div className="p-4 flex flex-col gap-4">
        {onBack && <button onClick={() => setPhase("select")} className="text-gray-500 text-sm self-start">← 返回選擇</button>}
        <div className="rounded-2xl p-6 text-white text-center" style={{ background: "linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-6xl mb-3">{monster.icon}</div>
          <div className="text-2xl font-black mb-1">{monster.name}</div>
          <div className="text-purple-200 text-sm mb-4">{monster.desc}</div>
          <div className="flex justify-center gap-4 text-sm mb-6">
            <div className="bg-white/15 rounded-xl px-4 py-2"><div className="text-purple-200 text-xs">HP</div><div className="font-black text-xl">{monster.hp}</div></div>
            <div className="bg-white/15 rounded-xl px-4 py-2"><div className="text-purple-200 text-xs">ATK</div><div className="font-black text-xl">{monster.atk}</div></div>
            <div className="bg-white/15 rounded-xl px-4 py-2"><div className="text-purple-200 text-xs">DEF</div><div className="font-black text-xl">{monster.def}</div></div>
          </div>
          {archerStats && (
            <div className="bg-white/10 rounded-xl p-3 mb-4 text-left">
              <div className="text-purple-200 text-xs mb-2">你的數值</div>
              <div className="flex justify-around text-sm">
                <div className="text-center"><div className="text-purple-200 text-xs">HP</div><div className="font-black">{archerStats.hp}</div></div>
                <div className="text-center"><div className="text-purple-200 text-xs">ATK</div><div className="font-black">{archerStats.atk}</div></div>
                <div className="text-center"><div className="text-purple-200 text-xs">DEF</div><div className="font-black">{archerStats.def}</div></div>
              </div>
            </div>
          )}
          <button onClick={startBattle}
            className="w-full py-4 rounded-2xl font-black text-lg"
            style={{ background: "linear-gradient(90deg,#fbbf24,#f59e0b)", color: "#7c2d12" }}>
            ⚔️ 開始挑戰！
          </button>
        </div>
      </div>
    );
  }

  if (phase === "battle") {
    const maxArcherHP  = archerStats?.hp || 100;
    const archerHPPct  = Math.max(0, Math.round(archerHP  / maxArcherHP * 100));
    const monsterHPPct = Math.max(0, Math.round(monsterHP / monster.hp * 100));
    const availableParts = BODY_PARTS.filter(p => !p.locked || unlockedParts.has(p.locked));

    return (
      <div className="p-4 flex flex-col gap-3">
        {/* HP 條 */}
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#1e293b,#0e7490)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-white text-xs font-bold">第 {round} 回合</div>
            <div className="text-white text-xs">{ARROWS_PER_ROUND}箭/回合</div>
          </div>
          {/* 怪物 HP */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span>{monster.icon} {monster.name}</span>
              <span>{monsterHP} / {monster.hp}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${monsterHPPct}%`, background: monsterHPPct > 50 ? "#ef4444" : monsterHPPct > 25 ? "#f59e0b" : "#dc2626" }} />
            </div>
          </div>
          {/* 射手 HP */}
          <div>
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span>🏹 {profile?.nickname || profile?.name}</span>
              <span>{archerHP} / {maxArcherHP}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${archerHPPct}%` }} />
            </div>
          </div>
        </div>

        {/* 本回合箭數指示 */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: ARROWS_PER_ROUND }).map((_, i) => (
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
              ${i < arrows.length ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
              {i < arrows.length ? "🏹" : "○"}
            </div>
          ))}
        </div>

        {/* 部位選擇 */}
        {phase2 === "archer" && arrows.length < ARROWS_PER_ROUND && (
          <div className="bg-white rounded-2xl p-4">
            <div className="text-gray-700 text-sm font-black mb-3">
              第 {arrows.length + 1} 箭 — 選擇瞄準部位
            </div>
            <div className="grid grid-cols-3 gap-2">
              {availableParts.map(p => (
                <button key={p.id} onClick={() => shootPart(p)}
                  className="rounded-xl py-2 px-1 text-center border transition-all active:scale-95 hover:border-blue-400 hover:bg-blue-50"
                  style={{ borderColor: p.locked ? "#a78bfa" : "#e2e8f0" }}>
                  <div className="text-xl">{p.icon}</div>
                  <div className="text-xs font-bold text-gray-700">{p.name}</div>
                  <div className="text-xs text-gray-400">×{p.mult === 0 ? "0" : p.mult.toFixed(1)}</div>
                  {p.locked && <div className="text-xs text-purple-500">解鎖</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 等待反擊 */}
        {phase2 === "counter" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <div className="text-3xl mb-2">{monster.icon}</div>
            <div className="text-red-700 font-black">{monster.name} 正在反擊…</div>
            <div className="text-red-500 text-sm">受到 {counterDmg} 點傷害</div>
          </div>
        )}

        {/* 戰鬥紀錄 */}
        <div className="bg-gray-900 rounded-2xl p-3 max-h-48 overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i} className={`text-xs py-0.5 ${
              entry.type === "win"     ? "text-amber-400 font-black" :
              entry.type === "lose"    ? "text-red-400 font-black" :
              entry.type === "revive"  ? "text-pink-400 font-black" :
              entry.type === "counter" ? "text-orange-300" :
              entry.type === "total"   ? "text-cyan-300 font-bold" :
              entry.type === "loot"    ? "text-yellow-300 font-black" :
              entry.type === "system"  ? "text-gray-500" :
              entry.type === "hit"     ? "text-emerald-300" :
              "text-gray-400"
            }`}>
              {entry.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const win = loot !== null;
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="rounded-2xl p-6 text-white text-center"
          style={{ background: win
            ? "linear-gradient(135deg,#065f46,#0e7490)"
            : "linear-gradient(135deg,#7f1d1d,#4c1d95)" }}>
          <div className="text-5xl mb-3">{win ? "🏆" : "💀"}</div>
          <div className="text-2xl font-black mb-2">{win ? "勝利！" : "敗北…"}</div>
          <div className="text-sm opacity-80 mb-4">
            {win ? `擊倒了 ${monster.name}！` : `被 ${monster.name} 擊倒了`}
          </div>

          {win && loot && (
            <div className="bg-white/15 rounded-2xl p-4 mb-4">
              <div className="text-xs font-black tracking-widest text-amber-200 mb-2">🎁 掉落獎勵</div>
              <div className="text-4xl mb-2">{loot.icon}</div>
              <div className="font-black text-xl mb-1">{loot.name}</div>
              <div className="text-sm opacity-80">{loot.desc}</div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setPhase("select")}
              className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold">
              換個對手
            </button>
            <button onClick={() => { setPhase("prebattle"); }}
              className="flex-1 py-3 rounded-xl font-black"
              style={{ background: "linear-gradient(90deg,#fbbf24,#f59e0b)", color: "#7c2d12" }}>
              再挑戰！
            </button>
          </div>
        </div>

        {/* 最終戰鬥紀錄 */}
        <div className="bg-gray-900 rounded-2xl p-3 max-h-48 overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i} className={`text-xs py-0.5 ${
              entry.type === "win"    ? "text-amber-400 font-black" :
              entry.type === "loot"   ? "text-yellow-300 font-black" :
              entry.type === "revive" ? "text-pink-400 font-black" :
              entry.type === "lose"   ? "text-red-400 font-black" :
              entry.type === "total"  ? "text-cyan-300 font-bold" :
              entry.type === "system" ? "text-gray-500" :
              "text-gray-400"
            }`}>
              {entry.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
