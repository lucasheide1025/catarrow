// src/arcade/ArcadeAdventure.jsx — 訪客冒險戰鬥（6 箭一回合，規格 §10 極簡 Arcade UI）
// 三種模式（M2）：
//   🌲 forest 貓森遺跡：小怪→小怪→狼人→世界王，每勝開寶箱
//   🌙 moon   月夜迷城：岔路選擇（寶箱／神秘事件／菁英怪）→ 世界王
//   🔥 abyss  深淵巢穴：樓層越深越強、獎勵翻倍；撤退保留戰利品，團滅全部消失
// 演出序列：射箭 → 命中(震動+漂浮傷害) → 貓咪技能泡泡 → 怪物反擊 → 結算；每階段配音效+震動。
import { useEffect, useRef, useState } from "react";
import ArcadeArrowInput from "./ArcadeArrowInput";
import BossTarget from "./ArcadeTarget";
import BattleResultSheet from "./ArcadeResultSheet";
import { arcadeCatById, CHEST_ITEMS, rollChestChoices } from "./arcadeData";
import {
  ABYSS_MAX_FLOOR,
  ABYSS_DEEP_BOSS,
  ARROWS_PER_ROUND,
  BOSS_INTERRUPT,
  MOON_BOSS,
  MOON_ROUTES,
  MOON_ROUTE_COUNT,
  abyssDeepBoss,
  abyssGrade,
  abyssMonsterForFloor,
  buildAdventure,
  buildMoonLabyrinth,
  clampArrow,
  eliteVariant,
  gradeAdventure,
  resolveRound,
  rollMoonEvent,
  rollSoloRing,
  scoreOfArrow,
} from "./arcadeBattle";
import { playBattleSound } from "../lib/battleSound";
import { sfxCoinDrop, sfxOpenChest, sfxTap, sfxWorldBossAppear, sfxBossUlt } from "../lib/sound";
import { playCatVoice } from "./arcadeCatVoice";
import { analyzeArcadeShots } from "./arcadePerformance";
import {
  drawArcadeShareCard, shareOrDownloadCanvas, downloadCanvas,
  shareToSocial, copyResultText, prepareShareBlob,
} from "./arcadeShare";
import { calcBattleXP } from "./arcadeShop";
import { applyArcadeSettlement, getArcadePlayerStats } from "./arcadeProgression";

const RESCUE_LABEL = { rescue: "救援！", heal: "💚 治療！", atk: "⚔️ 追擊！", def: "🛡️ 擋下！" };

export default function ArcadeAdventure({
  mode = "forest",
  profile,
  runId,
  onSave,
  onMutate,
  onSettled,
  onReplay,
  onExit,
  onToast,
}) {
  const isMoon = mode === "moon";
  const isAbyss = mode === "abyss";
  const cat = arcadeCatById(profile.selectedCat);
  const playerStats = getArcadePlayerStats(profile);
  const playerMaxHp = playerStats.maxHp;
  const fallbackRunId = useRef(`${profile.visitorId || "visitor"}-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
  const settlementId = runId || fallbackRunId;
  const forest = useRef(buildAdventure()).current;
  const moon = useRef(buildMoonLabyrinth()).current;

  const [phase, setPhase] = useState("intro"); // intro | battle | chest | route | event | decision | result | defeat
  const [monster, setMonster] = useState(() =>
    isAbyss ? abyssMonsterForFloor(1, 1) : isMoon ? moon.entry : forest.fights[0]
  );
  const [fightIdx, setFightIdx] = useState(0);      // forest
  const [routeIdx, setRouteIdx] = useState(0);      // moon
  const [isBossFight, setIsBossFight] = useState(false);
  const [eliteFight, setEliteFight] = useState(false);
  const [event, setEvent] = useState(null);         // moon event
  const [floor, setFloor] = useState(1);            // abyss
  const [lootMult, setLootMult] = useState(1);      // abyss
  const [abyssLoot, setAbyssLoot] = useState(0);    // abyss 累積戰利品
  const [extraSkillBuff, setExtraSkillBuff] = useState(0);

  const [playerHp, setPlayerHp] = useState(playerMaxHp);
  const [monsterHp, setMonsterHp] = useState(() => monster.hp);
  const [arrows, setArrows] = useState(Array(ARROWS_PER_ROUND).fill(-1)); // -1=未填；王戰靶面用 null
  const [soloRing, setSoloRing] = useState(null); // 單人王戰弱點圈（靶面位置）
  const [result, setResult] = useState(null);
  const [floats, setFloats] = useState([]); // 世界王風漂浮傷害數字
  const [raidBanner, setRaidBanner] = useState(null); // 打斷大招／大招橫幅
  const [killBurst, setKillBurst] = useState(null); // 擊倒演出快照：名稱/圖片/傷害/回合
  const floatId = useRef(0);
  const [chest, setChest] = useState(null);
  const [roundKey, setRoundKey] = useState(0);
  const [fx, setFx] = useState(null);
  const fxTimer = useRef(null);
  const [bossIntro, setBossIntro] = useState(null); // 王房過場：{ boss, tagline, rage }
  const introTimer = useRef(null);
  const introSfxTimer = useRef(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [shotFx, setShotFx] = useState(null); // { index, label, stage }：六箭逐箭演出
  const [settlementStatus, setSettlementStatus] = useState("idle"); // idle | saving | done | error
  const settlementRef = useRef(false);
  const [summary, setSummary] = useState({
    kills: 0, damage: 0, treasures: 0, bossKills: 0, bestDamage: 0, coins: 0, xCount: 0, shotScores: [],
  });
  const invDelta = useRef({});
  const [buffs] = useState(() => {
    const inv = profile.inventory || {};
    return {
      atkBuff: (inv.fire_arrow || 0) > 0 ? 1.2 : 1,
      skillChanceBuff: (inv.catnip || 0) > 0 ? 0.15 : 0,
      consumed: {
        fire_arrow: (inv.fire_arrow || 0) > 0 ? 1 : 0,
        catnip: (inv.catnip || 0) > 0 ? 1 : 0,
      },
    };
  });

  useEffect(() => {
    if (phase !== "battle" || isBossFight || monster.ability === "boss") return undefined;
    playBattleSound("battle_intro", { monsterName: monster.name, playerName: profile.nickname });
    return undefined;
    // eslint 不載入 exhaustive-deps 規則；deps 已含全部使用值
  }, [phase, fightIdx, routeIdx, monster.name, profile.nickname, isBossFight]);

  useEffect(() => {
    if (phase === "chest") sfxOpenChest();
  }, [phase]);

  useEffect(() => () => {
    clearTimeout(fxTimer.current);
    clearTimeout(introTimer.current);
    clearTimeout(introSfxTimer.current);
  }, []);

  useEffect(() => {
    setTargetOpen(false);
    setShotFx(null);
  }, [monster.id, phase]);

  function runSeq(steps) {
    clearTimeout(fxTimer.current);
    let i = 0;
    const next = () => {
      if (i >= steps.length) return;
      const [delay, fn] = steps[i++];
      fxTimer.current = setTimeout(() => { fn(); next(); }, delay);
    };
    next();
  }

  function fillAll(v) {
    // 清空（v<=0）→ 全部回 -1（未填）；其餘 clamp 0~10
    setArrows(Array(ARROWS_PER_ROUND).fill(v <= 0 ? -1 : clampArrow(v)));
    sfxTap();
  }

  // 每回合箭格初始值：王戰用靶面（null），一般關用記分板（-1）
  function freshArrowsFor(isBoss) {
    return Array(ARROWS_PER_ROUND).fill(isBoss ? null : -1);
  }

  function attack() {
    if (result) return;
    const allReady = arrows.every((arrow) => (
      isBoss
        ? !!(arrow && typeof arrow === "object")
        : typeof arrow === "number" && arrow >= 0
    ));
    if (!allReady) return;
    setTargetOpen(false);
    const r = resolveRound(
      {
        playerHp, monsterHp, cat, monster,
        playerAtk: playerStats.atk,
        playerDef: playerStats.def,
        playerMaxHp,
        atkBuff: buffs.atkBuff,
        skillChanceBuff: buffs.skillChanceBuff + extraSkillBuff,
        ring: soloRing, // 王戰靶面弱點圈（一般關無效）
      },
      arrows
    );
    setResult(r);
    setRoundKey((k) => k + 1);
    const dmg = r.dmg;
    const xThis = arrows.filter((a) =>
      typeof a === "number" ? a === 11 : !!(a && a.label === "X")
    ).length; // X 內十（完美射擊）
    const roundScores = arrows.map((a) => scoreOfArrow(a));
    setSummary((s) => ({
      ...s,
      damage: s.damage + dmg,
      bestDamage: Math.max(s.bestDamage, dmg),
      xCount: s.xCount + xThis,
      // 只存在本場 React state；finishAndSave 不會把 raw shot history 寫進 profile / Firestore。
      shotScores: [...(s.shotScores || []), ...roundScores],
    }));

    const isCrit = r.dmg >= 50;
    const catStep = r.catEvent
      ? [[620, () => {
          playBattleSound("cat_attack", { catName: cat.name, skillGroup: cat.skill.type });
          playCatVoice(cat.id, r.catEvent.type);
          setFx({ stage: "cat" });
        }]]
      : [];
    const counterStep = r.counter > 0
      ? [[620, () => {
          playBattleSound("monster_counter", { monsterName: monster.name, counterDmg: r.counter });
          setPlayerHp(r.playerHp);
          setFx({ stage: "counter" });
        }]]
      : [[620, () => { setFx({ stage: "counter" }); }]];

    setFloats([]);
    setRaidBanner(null);
    const arrowPresentation = [];
    arrows.forEach((arrow, index) => {
      const score = scoreOfArrow(arrow);
      const label = typeof arrow === "number"
        ? (arrow === 11 ? "X" : arrow === 0 ? "M" : String(arrow))
        : (arrow?.label || (score === 0 ? "M" : String(score)));
      const last = index === ARROWS_PER_ROUND - 1;
      arrowPresentation.push(
        [index === 0 ? 0 : 120, () => {
          setShotFx({ index, label, stage: "flight" });
          setFx({ stage: "attack" });
          playBattleSound("arrow_flight", { monsterName: monster.name });
        }],
        [280, () => {
          setShotFx({ index, label, stage: "impact" });
          setFx({ stage: "impact" });
          playBattleSound("arrow_hit", {
            score,
            dmg: last ? r.dmg : 0,
            isCrit: last && isCrit,
          });
          // 六箭都演完後才一次套用權威回合結算，避免 presentation 改變戰鬥公式。
          if (!last) return;
          setMonsterHp(r.monsterHp);
          if (isBoss && r.ringMet != null) {
            setFloats([{
              key: floatId.current++,
              text: `-${r.dmg}`,
              kind: r.ringMet ? "weak" : "normal",
              left: 50,
            }]);
            if (r.ringMet) playCatVoice(cat.id, "weak");
          }
        }],
      );
    });
    runSeq([
      ...arrowPresentation,
      ...catStep,
      ...counterStep,
      [620, () => {
        if (r.victory) {
          setSummary((s) => ({
            ...s,
            kills: s.kills + 1,
            coins: s.coins + monster.rewardCoins,
            bossKills: s.bossKills + (isBossFight ? 1 : 0),
          }));
          // 不在 lethal hit 當下跳頁：先完整播完怪物反應與擊破，再顯示結算。
          setKillBurst({
            name: monster.name,
            image: monster.image,
            damage: r.dmg,
            rounds: roundKey + 1,
            boss: isBoss,
          });
          setShotFx(null);
          setFx({ stage: "kill" });
          playBattleSound("monster_death", { monsterName: monster.name, boss: isBoss });
        } else if (r.defeat) {
          setFx({ stage: "settle" });
          fxTimer.current = setTimeout(() => {
            setPhase("defeat");
            playBattleSound("defeat_sigh", { monsterName: monster.name, playerName: profile.nickname });
          }, 1300);
        } else {
          setFx({ stage: "settle" });
          // 世界王風橫幅（掃過式）：打斷大招／大招
          if (isBoss) {
            setRaidBanner(r.bossInterrupted
              ? { text: "打斷！", color: "#4ade80" }
              : { text: "大招", color: "#f43f5e" });
            setTimeout(() => setRaidBanner(null), 1600);
          }
        }
      }],
      ...(r.victory ? [
        [3000, () => {
          setKillBurst(null);
          setFx({ stage: "settle" });
          playBattleSound("victory_fanfare", { monsterName: monster.name, roundDmg: r.total });
        }],
        [800, () => afterVictory()],
      ] : []),
    ]);
  }

  // ── 勝利後依照模式進入下一個階段 ─────────────────────────
  function afterVictory() {
    if (isAbyss) {
      setAbyssLoot((l) => l + monster.rewardCoins);
      // 深淵世界王擊敗 → 直接冒險完成（不再有撤退/繼續的抉擇）
      setPhase(isBossFight ? "result" : "decision");
    } else if (isMoon) {
      if (isBossFight || eliteFight) {
        setChest(rollChestChoices());
        setPhase("chest");
      } else {
        setPhase("route");
      }
    } else {
      setChest(rollChestChoices());
      setPhase("chest");
    }
  }

  // 月夜迷城：選路
  function pickRoute(routeId) {
    if (routeId === "treasure") {
      setChest(rollChestChoices());
      setPhase("chest");
    } else if (routeId === "event") {
      const ev = rollMoonEvent();
      setEvent(ev);
      applyEvent(ev);
      setPhase("event");
    } else {
      // 菁英怪
      const em = eliteVariant(moon.randomFight());
      setEliteFight(true);
      setMonster(em);
      setMonsterHp(em.hp);
      setResult(null);
      setFx(null);
      setArrows(freshArrowsFor(false));
      setPhase("battle");
    }
  }

  function applyEvent(ev) {
    if (ev.id === "heal") setPlayerHp((h) => Math.min(playerMaxHp, h + 20));
    else if (ev.id === "ambush") setPlayerHp((h) => Math.max(0, h - 12));
    else if (ev.id === "coins") setSummary((s) => ({ ...s, coins: s.coins + 20 }));
    else if (ev.id === "catnip") setExtraSkillBuff((b) => b + 0.15);
  }

  function continueFromEvent() {
    if (playerHp <= 0) { setPhase("defeat"); return; }
    advanceMoon();
  }

  // 月夜迷城：岔路結束 → 下一戰或魔王（魔王打完由 pickChest 進結果頁）
  function advanceMoon() {
    const next = routeIdx + 1;
    setEliteFight(false);
    if (next >= MOON_ROUTE_COUNT) {
      setIsBossFight(true);
      setMonster(moon.boss);
      setMonsterHp(moon.boss.hp);
      playBossIntro(moon.boss, "月夜世界王的領域！");
      setSoloRing(rollSoloRing());
    } else {
      setRouteIdx(next);
      const m = moon.randomFight();
      setMonster(m);
      setMonsterHp(m.hp);
    }
    setResult(null);
    setFx(null);
    setArrows(freshArrowsFor(next >= MOON_ROUTE_COUNT));
    setPhase("battle");
  }

  // 深淵巢穴：撤退保留戰利品／繼續深入 ×2
  function handleRetreat() {
    setPhase("result");
  }
  function handleContinue() {
    const f = floor + 1;
    if (f > ABYSS_MAX_FLOOR) { setPhase("result"); return; }
    setFloor(f);
    setLootMult((l) => l * 2);
    setResult(null);
    setFx(null);
    // 最深處（第 12 層）＝深淵王座：世界王風格的魔王戰
    if (f >= ABYSS_MAX_FLOOR) {
      const db = abyssDeepBoss(lootMult * 2);
      setIsBossFight(true);
      setMonster(db);
      setMonsterHp(db.hp);
      setSoloRing(rollSoloRing());
      playBossIntro(db, "深淵的王者甦醒了！", true);
      setArrows(freshArrowsFor(true));
      setPhase("battle");
      return;
    }
    const m = abyssMonsterForFloor(f, lootMult * 2);
    setMonster(m);
    setMonsterHp(m.hp);
    setArrows(freshArrowsFor(false));
    setPhase("battle");
  }

  // 寶箱選完 → 依模式前進
  function pickChest(itemId) {
    const item = CHEST_ITEMS[itemId];
    if (!item) return;
    invDelta.current[itemId] = (invDelta.current[itemId] || 0) + 1;
    setSummary((s) => ({ ...s, treasures: s.treasures + 1 }));
    if (itemId === "cat_riceball") {
      setPlayerHp((hp) => Math.min(playerMaxHp, hp + 20));
    }
    sfxCoinDrop();
    if (isMoon) {
      // 魔王打完 → 冒險完成；否則進入下一岔路
      if (isBossFight) {
        setChest(null);
        setPhase("result");
      } else {
        setChest(null);
        advanceMoon();
      }
    } else {
      setChest(null);
      goNextForestFight();
    }
  }

  function goNextForestFight() {
    const nextIdx = fightIdx + 1;
    if (nextIdx > forest.fights.length) {
      setPhase("result");
      return;
    }
    const isBoss = nextIdx === forest.fights.length;
    const next = isBoss ? forest.boss : forest.fights[nextIdx];
    setFightIdx(nextIdx);
    setIsBossFight(isBoss);
    setMonster(next);
    setMonsterHp(next.hp);
    setResult(null);
    setFx(null);
    setArrows(freshArrowsFor(isBoss));
    // 王房：先播全螢幕過場再進戰鬥（並 roll 弱點圈位置）
    if (isBoss) {
      playBossIntro(next, "打斷大招才有勝算！");
      setSoloRing(rollSoloRing());
    }
    setPhase("battle");
  }

  function startFight() {
    setPhase("battle");
  }

  // ── 王房前全螢幕過場：王現身動畫＋招式名＋音效，播完進戰鬥 ──
  function playBossIntro(boss, tagline, rage = false) {
    sfxWorldBossAppear();
    setBossIntro({ boss, tagline, rage });
    clearTimeout(introTimer.current);
    clearTimeout(introSfxTimer.current);
    // 招式名約 0.75 秒後出現，怒吼跟著畫面節點，不和登場音搶第一拍。
    introSfxTimer.current = setTimeout(() => sfxBossUlt(), 750);
    introTimer.current = setTimeout(() => setBossIntro(null), 3600);
  }

  async function settleAdventure() {
    if ((phase !== "result" && phase !== "defeat") || settlementRef.current) return;
    settlementRef.current = true;
    setSettlementStatus("saving");

    const defeated = phase === "defeat";
    const clearedFloors = isAbyss ? (defeated ? Math.max(0, floor - 1) : floor) : 0;
    const normalGrade = gradeAdventure(playerHp, playerMaxHp);
    const gradeNow = isAbyss ? abyssGrade(clearedFloors).grade : normalGrade.grade;
    const finalCoins = defeated
      ? (isAbyss ? 0 : summary.coins)
      : (isAbyss ? abyssLoot : Math.round(summary.coins * normalGrade.bonusMult));
    const xpGained = calcBattleXP({
      mode: isAbyss ? "abyss" : isMoon ? "moon" : "forest",
      grade: gradeNow,
      isTeam: false,
      bossKills: summary.bossKills || 0,
    });
    const settlement = {
      id: settlementId,
      coins: finalCoins,
      xp: xpGained,
      consumed: buffs.consumed,
      inventoryDelta: invDelta.current || {},
      stats: {
        battles: 1,
        kills: summary.kills,
        treasures: summary.treasures,
        xCount: summary.xCount,
        bestDamage: summary.bestDamage,
        bestFloor: clearedFloors,
      },
    };

    let settlementResult = null;
    try {
      if (onMutate) {
        await onMutate((current) => {
          settlementResult = applyArcadeSettlement(current, settlement);
          return settlementResult.updated;
        });
      } else if (onSave) {
        settlementResult = applyArcadeSettlement(profile, settlement);
        await onSave(settlementResult.updated);
      } else {
        throw new Error("arcade_settlement_writer_missing");
      }
      if (!settlementResult?.alreadySettled && settlementResult?.levelsGained > 0 && onToast) {
        onToast(`🎉 升級到 Lv.${settlementResult.updated.playerLevel}！${settlementResult.rewards.map((r) => r.msg).join(" ")}`);
      }
      if (onSettled) await onSettled();
      setSettlementStatus("done");
    } catch {
      settlementRef.current = false;
      setSettlementStatus("error");
    }
  }

  useEffect(() => {
    if ((phase === "result" || phase === "defeat") && settlementStatus === "idle") settleAdventure();
  }, [phase, settlementStatus]);

  function SettlementNotice() {
    if (settlementStatus === "done") return null;
    return (
      <div className="arcade-note" style={{ marginTop: 12 }}>
        {settlementStatus === "error" ? (
          <>
            ⚠️ 本機進度保存失敗。
            <button type="button" className="arcade-quick-btn" style={{ marginLeft: 8 }} onClick={settleAdventure}>重新保存</button>
          </>
        ) : "💾 正在保存本機進度…"}
      </div>
    );
  }

  const bossBadge = monster.ability === "boss" ? " 👑" : "";
  const shootingPerf = analyzeArcadeShots(summary.shotScores || [], profile.visitorId || profile.nickname);

  if (phase === "intro") return <Intro mode={mode} cat={cat} profile={profile} forest={forest} onStart={startFight} />;

  if (phase === "chest") {
    return (
      <ArcadeStage>
        <Confetti />
        <div className="arcade-card" style={{ textAlign: "center", padding: 24 }}>
          <div className="arcade-chest-pop">🎁</div>
          <div className="arcade-title" style={{ fontSize: 24, maxWidth: "none" }}>發現寶箱！</div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>三選一，選一個帶走。</p>
          <div className="arcade-chest-grid">
            {(chest || []).map((itemId, i) => {
              const item = CHEST_ITEMS[itemId];
              return (
                <button key={i} type="button" className="arcade-chest-card" style={{ animationDelay: `${i * 0.12}s` }} onClick={() => pickChest(itemId)}>
                  <div style={{ fontSize: 40 }}>{item.icon}</div>
                  <div className="arcade-chest-name">{item.name}</div>
                  <div className="arcade-chest-desc">{item.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </ArcadeStage>
    );
  }

  if (phase === "route") {
    return (
      <ArcadeStage>
        <div className="arcade-card" style={{ textAlign: "center", padding: 24 }}>
          <div className="arcade-kicker">MOON LABYRINTH · 岔路 {routeIdx + 1}/{MOON_ROUTE_COUNT}</div>
          <div className="arcade-title" style={{ fontSize: 24, maxWidth: "none", marginTop: 6 }}>下一步走哪裡？</div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>月光下的岔路，選一條繼續冒險。</p>
          <div className="arcade-route-grid">
            {MOON_ROUTES.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className="arcade-route-card"
                style={{ animationDelay: `${i * 0.12}s`, borderColor: r.tone }}
                onClick={() => pickRoute(r.id)}
              >
                <div className="arcade-route-icon" style={{ background: `${r.tone}22` }}>{r.icon}</div>
                <div className="arcade-route-label">{r.label}</div>
                <div className="arcade-route-desc">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </ArcadeStage>
    );
  }

  if (phase === "event") {
    return (
      <ArcadeStage>
        <div className="arcade-card" style={{ textAlign: "center", padding: 24 }}>
          <div className="arcade-kicker">MYSTERY EVENT</div>
          <div style={{ fontSize: 54, marginTop: 8 }}>{event?.icon}</div>
          <div className="arcade-title" style={{ fontSize: 22, maxWidth: "none", marginTop: 10, lineHeight: 1.5 }}>{event?.text}</div>
          <div className="arcade-row" style={{ marginTop: 20 }}>
            {playerHp <= 0 ? (
              <button type="button" className="arcade-primary" style={{ flex: 1 }} onClick={() => setPhase("defeat")}>
                😵 倒下了…
              </button>
            ) : (
              <button type="button" className="arcade-primary green" style={{ flex: 1 }} onClick={continueFromEvent}>
                繼續 →（{event?.good === true ? "好運！" : event?.good === false ? "倒楣…" : ""}）
              </button>
            )}
          </div>
        </div>
      </ArcadeStage>
    );
  }

  if (phase === "decision") {
    const nextIsBoss = floor + 1 >= ABYSS_MAX_FLOOR;
    return (
      <ArcadeStage>
        <div className="arcade-card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 50 }}>{nextIsBoss ? "👹" : "🔥"}</div>
          <div className="arcade-kicker" style={{ marginTop: 8 }}>ABYSS NEST · 第 {floor} 層完成</div>
          <div className="arcade-title" style={{ fontSize: 23, maxWidth: "none", marginTop: 6 }}>
            目前戰利品：🪙 {abyssLoot}
          </div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>
            {nextIsBoss ? (
              <>
                下一層：<strong>👹 深淵王座！</strong>擊敗 {ABYSS_DEEP_BOSS.name}，獎勵 <strong>×{lootMult * 2}</strong><br />
                <span style={{ fontSize: 12 }}>魔王戰敗＝團滅，尚未帶出的深淵戰利品會全部消失！</span>
              </>
            ) : (
              <>
                下一層：☠️ 高危險，獎勵 <strong>×{lootMult * 2}</strong><br />
                <span style={{ fontSize: 12 }}>團滅的話，尚未帶出的深淵戰利品會全部消失！</span>
              </>
            )}
          </p>
          <div className="arcade-row" style={{ marginTop: 18 }}>
            <button type="button" className="arcade-primary blue" style={{ flex: 1 }} onClick={handleRetreat}>
              🎒 帶著戰利品離開
            </button>
            <button
              type="button"
              className="arcade-primary"
              style={{ flex: 1 }}
              onClick={handleContinue}
              disabled={floor >= ABYSS_MAX_FLOOR}
            >
              {nextIsBoss ? `⚔️ 挑戰${ABYSS_DEEP_BOSS.name}！` : "繼續深入 ×2"}
            </button>
          </div>
        </div>
      </ArcadeStage>
    );
  }

  if (phase === "result") {
    if (isAbyss) {
      const grade = abyssGrade(floor);
      const shareData = {
        nickname: profile.nickname,
        cat,
        dungeonName: "🔥 深淵巢穴",
        grade: grade.grade,
        label: grade.label,
        composite: shootingPerf.composite,
        metrics: { accuracy: shootingPerf.hitRate, stability: shootingPerf.stability, average: shootingPerf.avgScore * 10, power: summary.bestDamage, exploration: floor * 12.5 },
        statsRows: [
          { icon: "🪙", label: "帶出戰利品", value: abyssLoot },
          { icon: "⛰️", label: "抵達深度", value: `${floor} 層` },
          { icon: "👹", label: "擊敗怪物", value: summary.kills },
          { icon: "💥", label: "最高傷害", value: summary.bestDamage },
          { icon: "🎯", label: "X 內十", value: summary.xCount },
          { icon: "👑", label: "Boss 擊殺", value: summary.bossKills },
          { icon: "🏹", label: "命中率", value: `${shootingPerf.hitRate}%` },
          { icon: "〰️", label: "穩定性", value: `${shootingPerf.stability}%` },
          { icon: "⭐", label: "射擊評價", value: shootingPerf.grade },
        ],
      };
      return (
        <ArcadeStage>
          <Confetti />
          <div className="arcade-card" style={{ textAlign: "center", padding: 26 }}>
            <div style={{ fontSize: 54 }}>🏆</div>
            <div className="arcade-kicker" style={{ marginTop: 8 }}>ABYSS ESCAPED</div>
            <div className="arcade-title" style={{ fontSize: 26, maxWidth: "none", marginTop: 4 }}>深淵撤退成功！</div>
            <div className={`arcade-grade grade-${grade.grade}`}>
              <span>評價 {grade.grade}</span>
              <span className="arcade-grade-label">{grade.label}</span>
            </div>
            <div className="arcade-stats">
              <div className="arcade-stat"><div className="arcade-stat-v">🪙 {abyssLoot}</div><div className="arcade-stat-l">帶出的戰利品</div></div>
              <div className="arcade-stat"><div className="arcade-stat-v">⛰️ {floor} 層</div><div className="arcade-stat-l">抵達深度</div></div>
              <div className="arcade-stat"><div className="arcade-stat-v">🎯 {summary.xCount}</div><div className="arcade-stat-l">X 內十</div></div>
            </div>
            <ShootingPerformance performance={shootingPerf} />
            <SettlementNotice />
            <div className="arcade-row" style={{ marginTop: 20 }}>
              <button type="button" className="arcade-primary green" style={{ flex: 1 }} onClick={onReplay} disabled={settlementStatus !== "done"}>再探深淵</button>
              <button type="button" className="arcade-primary blue" style={{ flex: 1 }} onClick={onExit} disabled={settlementStatus !== "done"}>回大廳</button>
            </div>
            <ResultShareCard data={shareData} />
          </div>
        </ArcadeStage>
      );
    }
    const grade = gradeAdventure(playerHp, playerMaxHp);
    const finalCoins = Math.round(summary.coins * grade.bonusMult);
    const shareData = {
      nickname: profile.nickname,
      cat,
      dungeonName: isMoon ? "🌙 月夜迷城" : "🌲 貓森遺跡",
      grade: grade.grade,
      label: grade.label,
      composite: shootingPerf.composite,
      metrics: { accuracy: shootingPerf.hitRate, stability: shootingPerf.stability, average: shootingPerf.avgScore * 10, power: summary.bestDamage, exploration: summary.kills * 25 },
      statsRows: [
        { icon: "👹", label: "擊敗怪物", value: summary.kills },
        { icon: "💥", label: "最高傷害", value: summary.bestDamage },
        { icon: "🎯", label: "X 內十", value: summary.xCount },
        { icon: "🎁", label: "寶箱", value: summary.treasures },
        { icon: "👑", label: "Boss 擊殺", value: summary.bossKills },
        { icon: "🏹", label: "命中率", value: `${shootingPerf.hitRate}%` },
        { icon: "〰️", label: "穩定性", value: `${shootingPerf.stability}%` },
        { icon: "⭐", label: "射擊評價", value: shootingPerf.grade },
      ],
    };
    return (
      <ArcadeStage>
        <Confetti />
        <div className="arcade-card" style={{ textAlign: "center", padding: 26 }}>
          <div style={{ fontSize: 54 }}>🏆</div>
          <div className="arcade-kicker" style={{ marginTop: 8 }}>ADVENTURE COMPLETE</div>
          <div className="arcade-title" style={{ fontSize: 27, maxWidth: "none", marginTop: 4 }}>冒險完成！</div>
          <div className={`arcade-grade grade-${grade.grade}`}>
            <span>評價 {grade.grade}</span>
            <span className="arcade-grade-label">{grade.label}</span>
          </div>
          <div className="arcade-stats">
            <div className="arcade-stat"><div className="arcade-stat-v">👹 {summary.kills}</div><div className="arcade-stat-l">擊敗怪物</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">💥 {summary.bestDamage}</div><div className="arcade-stat-l">最高傷害</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🎯 {summary.xCount}</div><div className="arcade-stat-l">X 內十</div></div>
          </div>
          <div className="arcade-stats" style={{ marginTop: 10 }}>
            <div className="arcade-stat"><div className="arcade-stat-v">🎁 {summary.treasures}</div><div className="arcade-stat-l">寶箱</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">👑 {summary.bossKills}</div><div className="arcade-stat-l">Boss 擊殺</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">❤️ {playerHp}/{playerMaxHp}</div><div className="arcade-stat-l">剩餘生命</div></div>
          </div>
          <ShootingPerformance performance={shootingPerf} />
          <SettlementNotice />
          <div className="arcade-row" style={{ marginTop: 20 }}>
            <button type="button" className="arcade-primary green" style={{ flex: 1 }} onClick={onReplay} disabled={settlementStatus !== "done"}>再打一場</button>
            <button type="button" className="arcade-primary blue" style={{ flex: 1 }} onClick={onExit} disabled={settlementStatus !== "done"}>回大廳</button>
          </div>
          <ResultShareCard data={shareData} />
        </div>
      </ArcadeStage>
    );
  }

  if (phase === "defeat") {
    return (
      <ArcadeStage>
        <div className="arcade-card" style={{ textAlign: "center", padding: 26 }}>
          <div className="arcade-defeat-pop">💀</div>
          <div className="arcade-title" style={{ fontSize: 27, maxWidth: "none" }}>{isAbyss ? "團滅了…" : "冒險失敗…"}</div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>
            🐱 {cat.name}：「{cat.lines.miss}」
          </p>
          {isAbyss ? (
            <div className="arcade-note" style={{ marginTop: 12, textAlign: "left" }}>
              ☠️ 深淵第 {floor} 層戰敗——<strong>尚未帶出的戰利品（🪙 {abyssLoot}）全部消失！</strong>下次記得見好就收。
            </div>
          ) : (
            <div className="arcade-stats">
              <div className="arcade-stat"><div className="arcade-stat-v">👹 {summary.kills}</div><div className="arcade-stat-l">擊敗怪物</div></div>
              <div className="arcade-stat"><div className="arcade-stat-v">💥 {summary.bestDamage}</div><div className="arcade-stat-l">最高傷害</div></div>
              <div className="arcade-stat"><div className="arcade-stat-v">🪙 {summary.coins}</div><div className="arcade-stat-l">已獲得金幣</div></div>
            </div>
          )}
          <ShootingPerformance performance={shootingPerf} />
          <SettlementNotice />
          <div className="arcade-row" style={{ marginTop: 20 }}>
            <button type="button" className="arcade-primary" style={{ flex: 1 }} onClick={onReplay} disabled={settlementStatus !== "done"}>{isAbyss ? "再探深淵" : "再挑戰"}</button>
            <button type="button" className="arcade-primary blue" style={{ flex: 1 }} onClick={onExit} disabled={settlementStatus !== "done"}>回大廳</button>
          </div>
        </div>
      </ArcadeStage>
    );
  }

  // battle
  const fxStage = fx?.stage || "idle";
  const hpPct = Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100));
  const monsterPct = Math.max(0, Math.min(100, (monsterHp / monster.hp) * 100));
  const isActing = result && fxStage !== "settle";
  const isBoss = monster.ability === "boss";
  const curTotal = arrows.reduce((a, b) => a + scoreOfArrow(b), 0);
  const placedShots = arrows.filter((x) => x && typeof x === "object").length;
  const bossAnim = isBoss
    ? (result?.victory && (fxStage === "kill" || fxStage === "settle")) ? "fall"
      : (raidBanner && raidBanner.color === "#f43f5e") ? "roar"
        : (fxStage === "impact" || fxStage === "counter") ? "flinch"
          : "idle"
    : "idle";
  const showCatBubble = result?.catEvent && (fxStage === "cat" || (fxStage === "impact" && result.catEvent.type === "rescue"));
  const catBubbleText = result?.catEvent ? RESCUE_LABEL[result.catEvent.type] || "💥 出招！" : "";
  return (
    <ArcadeStage>
      {/* 王房前全螢幕過場（覆蓋在戰鬥上方，播完自動淡出） */}
      {bossIntro && (
        <BossEntrance boss={bossIntro.boss} tagline={bossIntro.tagline} rage={bossIntro.rage} />
      )}
      {targetOpen && isBoss && !result && (
        <div className="arcade-target-overlay" role="dialog" aria-modal="true" aria-label="BOSS 輸入分數">
          <div className="arcade-target-overlay-head">
            <div>
              <strong>🎯 輸入分數</strong>
              <small>{placedShots}/{ARROWS_PER_ROUND} 箭 · {curTotal} 分</small>
            </div>
            <button type="button" onClick={() => setTargetOpen(false)} aria-label="關閉靶面">✕</button>
          </div>
          <div className="arcade-target-overlay-face">
            <BossTarget
              ring={soloRing}
              ringColor={soloRing?.color}
              arrows={arrows}
              onArrow={(shot) => setArrows((a) => {
                const idx = a.findIndex((x) => !x || typeof x !== "object");
                if (idx < 0) return a;
                const next = a.slice();
                next[idx] = shot;
                return next;
              })}
            />
          </div>
          <div className="arcade-target-overlay-actions">
            <button type="button" className="arcade-quick-btn" onClick={() => setArrows((a) => {
              const idx = [...a].reverse().findIndex((x) => x && typeof x === "object");
              if (idx < 0) return a;
              const i = a.length - 1 - idx;
              const next = a.slice();
              next[i] = null;
              sfxTap();
              return next;
            })} disabled={placedShots === 0}>↩️ 撤回上一箭</button>
            <button type="button" className="arcade-quick-btn" onClick={() => { setArrows(Array(ARROWS_PER_ROUND).fill(null)); sfxTap(); }} disabled={placedShots === 0}>🗑️ 清空</button>
            <button type="button" className="arcade-primary" onClick={() => setTargetOpen(false)}>完成輸入</button>
          </div>
        </div>
      )}
      {killBurst && (
        <div className={`arcade-knockdown-overlay${killBurst.boss ? " boss" : ""}`} aria-live="polite">
          <div className="arcade-knockdown-flash" />
          <img src={killBurst.image} alt="" width="320" height="320" className="arcade-knockdown-monster" />
          <div className="arcade-knockdown-stamp">擊倒</div>
          <div className="arcade-knockdown-title">💀 擊倒！</div>
          <div className="arcade-knockdown-sub">{killBurst.name} 已被消滅</div>
          <div className="arcade-knockdown-stats">
            <span>⚔️ {killBurst.damage} 傷害</span>
            <span>🏹 {killBurst.rounds} 回合</span>
          </div>
        </div>
      )}
      {/* BOSS 戰：世界王深色舞台（保留記分板輸入）；一般關維持淺色卡片 */}
      {/* 輸入階段（無 result）→ 王立繪縮小騰出空間給靶面，手機不用捲動 */}
      <div className={isBoss ? `arcade-raid-stage${!result ? " input-mode" : ""}` : "arcade-card"} style={{ padding: 16 }}>
        {isBoss && <div className="arcade-raid-glow" />}
        {isBoss ? (
          <>
            {/* 玩家小條（HP 會被反擊扣） */}
            <div className="arcade-raid-playerbar">
              <img src={cat.image} alt={cat.name} width="160" height="160" className="arcade-cat-img" />
              <span className="arcade-raid-playerbar-name">🏹 {profile.nickname}</span>
              <div className="arcade-hpbar" style={{ flex: 1, margin: "0 8px" }}>
                <div className="arcade-hpbar-fill hp-player" style={{ width: `${hpPct}%` }} />
              </div>
              <span className="arcade-raid-playerbar-hp">❤️ {playerHp} / {playerMaxHp}</span>
            </div>
            {/* 頂部血條：王名＋HP＋漸層 */}
            <div className="arcade-raid-bossbar">
              <div className="arcade-raid-bossbar-row">
                <span className="arcade-raid-bossname">{monster.emoji} {monster.name}</span>
                <span className="arcade-raid-bossbar-hp">{monsterHp} / {monster.hp}</span>
              </div>
              <div className="arcade-raid-bossbar-track">
                <div
                  className="arcade-raid-bossbar-fill"
                  style={{
                    width: `${monsterPct}%`,
                    background: monsterPct > 66
                      ? "linear-gradient(90deg,#dc2626,#f87171)"
                      : monsterPct > 33
                        ? "linear-gradient(90deg,#c026d3,#e879f9)"
                        : "linear-gradient(90deg,#991b1b,#ef4444)",
                  }}
                />
              </div>
            </div>
            {/* 王立繪置中放大＋漂浮傷害＋大招/打斷橫幅 */}
            <div className="arcade-raid-bossbox">
              <div className={`arcade-raid-boss-wrap arcade-raid-boss-${bossAnim}`}>
                <img key={monster.id} src={monster.image} alt={monster.name} width="320" height="320" />
              </div>
              {/* 世界王風漂浮傷害：命中弱點金色大字、沒中白色 */}
              {floats.map((f) => (
                <span key={f.key} className={`arcade-raid-float ${f.kind}`} style={{ left: `${f.left}%` }}>
                  {f.text}
                </span>
              ))}
              {/* 掃過式橫幅：打斷大招／大招（王對應動作） */}
              {raidBanner && (
                <div className="arcade-raid-banner" style={{ color: raidBanner.color, textShadow: `0 0 30px ${raidBanner.color}` }}>
                  {raidBanner.text}
                </div>
              )}
            </div>
            {/* 打斷大招槽（總分 ≥ 45 打斷） */}
            <div className="arcade-raid-spirit">
              <div className="arcade-raid-spirit-row">
                <span>⚡ 打斷大招</span>
                <span>{curTotal} / {BOSS_INTERRUPT}</span>
              </div>
              <div className="arcade-raid-cells">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className={`arcade-raid-cell ${curTotal >= Math.round((i + 1) * 5) ? "on" : ""}`} />
                ))}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", marginTop: 4 }}>
                總分 ≥ {BOSS_INTERRUPT} → 打斷魔王大招，擋下反擊
              </div>
              {soloRing && (
                <div style={{ fontSize: 9, fontWeight: 800, marginTop: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "#e2e8f0" }}>
                  <span className="arcade-goal-dot" style={{ background: soloRing.color, boxShadow: `0 0 8px ${soloRing.color}` }} />
                  射進弱點圈：傷害加成 ×{soloRing.bonus}；脫靶減半
                </div>
              )}
            </div>
          </>
        ) : (
        <div className="arcade-battle-head">
          <div className={`arcade-battle-side player ${fxStage === "attack" || fxStage === "cat" ? "fx-lunge" : ""} ${fxStage === "counter" ? "fx-shake" : ""}`}>
            <div className="arcade-fighter">
              <img src={cat.image} alt={cat.name} width="160" height="160" className="arcade-cat-img" />
              <div>
                <div className="arcade-fighter-name">🏹 {profile.nickname}</div>
                <div className="arcade-fighter-sub">同行：{cat.name} · {cat.role} · {catSkillIcon(cat.skill.type)} 自動技能 {Math.round(cat.skill.chance * 100)}%{extraSkillBuff > 0 ? " +" : ""}</div>
              </div>
            </div>
            <div className="arcade-hpbar"><div className="arcade-hpbar-fill hp-player" style={{ width: `${hpPct}%` }} /></div>
            <div className="arcade-hp-text">❤️ {playerHp} / {playerMaxHp}</div>
            <div className="arcade-playerflash" />
            {fxStage === "counter" && result?.counter > 0 && <div className="arcade-float-dmg hurt">💢 {result.counter}</div>}
            {fxStage === "cat" && result?.catEvent?.type === "heal" && <div className="arcade-float-dmg heal">💚 +{result.catEvent.healed}</div>}
            {showCatBubble && (
              <div className="arcade-cat-bubble">🐱 {cat.name}：{catBubbleText}</div>
            )}
          </div>
          <div className="arcade-vs">VS</div>
          <div className={`arcade-battle-side monster ${fxStage === "impact" ? "fx-shake" : ""} ${fxStage === "counter" ? "fx-monster-lunge" : ""} ${result?.victory && (fxStage === "kill" || fxStage === "settle") ? "fx-dead" : ""}`}>
            <div className="arcade-fighter">
              <img key={monster.id} src={monster.image} alt={monster.name} width="320" height="320" className={`arcade-monster-img ${monster.elite ? "elite" : ""} ${isAbyss ? "abyss" : ""}`} />
              <div>
                <div className="arcade-fighter-name">{monster.emoji} {monster.name}{bossBadge}</div>
                <div className="arcade-fighter-sub">
                  {monster.elite ? "⚔️ 菁英" : isAbyss ? `🔥 深淵第 ${monster.floor} 層` : `Lv.${monster.ability === "boss" ? 3 : 1}`} · 戰利品 🪙{monster.rewardCoins}
                </div>
              </div>
            </div>
            <div className="arcade-hpbar"><div className="arcade-hpbar-fill hp-monster" style={{ width: `${monsterPct}%` }} /></div>
            <div className="arcade-hp-text">❤️ {monsterHp} / {monster.hp}</div>
            <div className="arcade-hitflash" />
            {fxStage === "attack" && <div key={`solo-arrow-${shotFx?.index ?? 0}`} className="arcade-arrow-fly">🏹</div>}
            {fxStage === "impact" && shotFx?.index === ARROWS_PER_ROUND - 1 && <div className="arcade-float-dmg dmg">💥 {result.dmg}</div>}
          </div>
        </div>
        )}

        {shotFx && !killBurst && (
          <div className={`arcade-solo-arrow-step ${shotFx.stage}`}>
            <b>第 {shotFx.index + 1} 箭</b>
            <span>{shotFx.label}</span>
          </div>
        )}

        <div className="arcade-task">{monster.task}</div>

        {!result ? (
          <>
            {isBoss ? (
              <>
                <div className="arcade-boss-score-launcher">
                  <div>
                    <strong>🎯 本回合分數</strong>
                    <span>{placedShots}/{ARROWS_PER_ROUND} 箭 · {curTotal} 分</span>
                  </div>
                  <button type="button" className="arcade-primary" onClick={() => setTargetOpen(true)}>🎯 輸入分數</button>
                </div>
              </>
            ) : (
              <>
                <ArcadeArrowInput count={ARROWS_PER_ROUND} values={arrows} onChange={(i, v) => setArrows((a) => a.map((x, idx) => (idx === i ? v : x)))} />
                <div className="arcade-quick">
                  <button type="button" className="arcade-quick-btn" onClick={() => fillAll(10)}>全 10</button>
                  <button type="button" className="arcade-quick-btn" onClick={() => fillAll(8)}>全 8</button>
                  <button type="button" className="arcade-quick-btn" onClick={() => fillAll(5)}>全 5</button>
                  <button type="button" className="arcade-quick-btn" onClick={() => fillAll(0)}>清空</button>
                </div>
              </>
            )}
            <button
              type="button"
              className="arcade-primary"
              style={{ marginTop: 14 }}
              onClick={attack}
              disabled={isBoss ? placedShots < ARROWS_PER_ROUND : arrows.some((a) => typeof a !== "number" || a < 0)}
            >
              🏹 攻擊！（{curTotal} 分）
            </button>
          </>
        ) : isActing ? (
          <div className="arcade-acting" key={roundKey}>
            <span className="arcade-acting-dots"><i /><i /><i /></span>
            戰鬥中…
          </div>
        ) : (
          /* 結算訊息：底部彈出面板覆蓋顯示，不推擠版面、手機不用捲動 */
          <BattleResultSheet
            result={result}
            roundKey={roundKey}
            monsterName={monster.name}
            onNext={() => { setResult(null); setFx(null); setArrows(freshArrowsFor(isBoss)); }}
          />
        )}
      </div>
    </ArcadeStage>
  );
}

function Intro({ mode, cat, profile, forest, onStart }) {
  const copy = {
    forest: {
      icon: "🌲",
      title: "🌲 貓森遺跡",
      body: (
        <>
          {profile.nickname} 與 🐱 {cat.name} 一起出發！<br />
          共 {forest.fights.length + 1} 場戰鬥，小心最後的魔王。
        </>
      ),
    },
    moon: {
      icon: "🌙",
      title: "🌙 月夜迷城",
      body: (
        <>
          {profile.nickname} 與 🐱 {cat.name} 踏上月光小徑！<br />
          {MOON_ROUTE_COUNT} 次岔路選擇：寶箱、神秘事件或菁英怪，最後挑戰 {MOON_BOSS.name}。
        </>
      ),
    },
    abyss: {
      icon: "🔥",
      title: "🔥 深淵巢穴",
      body: (
        <>
          越深越危險，獎勵翻倍。<br />
          團滅的話，<strong>尚未帶出的戰利品會全部消失</strong>——見好就收也是一種勇氣。
        </>
      ),
    },
  };
  const c = copy[mode] || copy.forest;
  return (
    <ArcadeStage>
      <div className="arcade-card" style={{ textAlign: "center", padding: 28 }}>
        <div style={{ fontSize: 52 }}>{c.icon}</div>
        <div className="arcade-kicker" style={{ marginTop: 10 }}>ADVENTURE</div>
        <div className="arcade-title" style={{ fontSize: 26, maxWidth: "none" }}>{c.title}</div>
        <p className="arcade-copy" style={{ maxWidth: "none" }}>{c.body}</p>
        <button type="button" className="arcade-primary green" style={{ marginTop: 18 }} onClick={onStart}>
          🚀 出發！
        </button>
      </div>
    </ArcadeStage>
  );
}

function ArcadeStage({ children }) {
  return (
    <div className="arcade-stage">
      <div className="arcade-wrap">{children}</div>
    </div>
  );
}

export function ShootingPerformance({ performance }) {
  const p = performance || { hitRate: 0, stability: 0, avgScore: 0, grade: "C", praise: "完成每一箭，就是下一次進步的起點！" };
  return (
    <div className="arcade-performance">
      <div className="arcade-performance-title">🏹 射擊表現</div>
      <div className="arcade-performance-grid">
        <div><b>{p.hitRate}%</b><span>命中率</span></div>
        <div><b>{p.stability}%</b><span>穩定性</span></div>
        <div><b>{p.avgScore}</b><span>平均每箭</span></div>
        <div><b>{p.grade}</b><span>射擊評價</span></div>
      </div>
      <div className="arcade-praise">「{p.praise}」</div>
    </div>
  );
}

/**
 * 王房前全螢幕過場（單人與組隊共用）：
 * 深色舞台＋放射光 → 王圖從巨大縮放現身（光暈＋呼吸）→ 王名 → 招式名 → 標語，
 * 由父層計時自動淡出（約 3.6 秒）再進入戰鬥。音效由父層觸發（sfxWorldBossAppear＋怒吼）。
 */
export function BossEntrance({ boss, tagline = "打斷大招才有勝算！", rage = false }) {
  return (
    <div className="arcade-boss-entrance" aria-hidden="true">
      <div className="arcade-boss-entrance-rays" />
      <div className="arcade-boss-entrance-inner">
        <div className="arcade-boss-entrance-kicker">
          {rage ? "🔥 狂暴化——" : "⚠️ 世界王級 BOSS 現身"}
        </div>
        <div className="arcade-boss-entrance-figure">
          <div className="arcade-boss-entrance-halo" />
          <img key={boss?.id} src={boss?.image} alt={boss?.name} width="320" height="320" />
        </div>
        <div className="arcade-boss-entrance-name">👑 {boss?.name}</div>
        <div className="arcade-boss-entrance-skill">「{boss?.skillName || "滅世魔焰"}」</div>
        <div className="arcade-boss-entrance-tag">{tagline}</div>
      </div>
    </div>
  );
}

export function ResultShareCard({ data }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("ready"); // ready | working | done | error
  const [msg, setMsg] = useState("");

  // 自動截圖：結果頁一進來就繪製戰績卡並暫存成 PNG，點分享零延遲
  useEffect(() => {
    let alive = true;
    if (canvasRef.current) {
      drawArcadeShareCard(canvasRef.current, data)
        .then(() => prepareShareBlob(canvasRef.current))
        .then(() => alive && setStatus("ready"))
        .catch(() => alive && setStatus("error"));
    }
    return () => { alive = false; };
  }, [data]);

  async function doShare() {
    if (status === "working") return;
    setStatus("working");
    setMsg("");
    const res = await shareOrDownloadCanvas(canvasRef.current, data);
    setStatus(res && res.ok ? "ready" : "error");
    setMsg(res && res.ok
      ? (res.via === "share" ? "✅ 已送出！選 LINE / FB / IG 直接貼圖🎉" : "✅ 戰績卡片已下載！")
      : "⚠️ 分享失敗，可改用下方按鈕。");
  }

  async function doLine() {
    if (status === "working") return;
    setStatus("working");
    setMsg("");
    const res = await shareToSocial(canvasRef.current, data, "line");
    setStatus(res && res.ok ? "ready" : "error");
    setMsg(res && res.ok
      ? (res.via === "share" ? "✅ 已透過 LINE 貼圖送出！🐱"
        : res.via === "line-deeplink" ? "✅ 已跳轉 LINE——選群組或好友送出！"
        : "✅ 已開啟 LINE 分享頁，選對象送出即可！")
      : "⚠️ 分享失敗，可改用下方按鈕。");
  }

  async function doFacebook() {
    if (status === "working") return;
    setStatus("working");
    setMsg("");
    const res = await shareToSocial(canvasRef.current, data, "fb");
    setStatus(res && res.ok ? "ready" : "error");
    setMsg(res && res.ok
      ? (res.via === "share" ? "✅ 已透過 Facebook 送出戰績！" : "✅ 已開啟 Facebook 分享頁，發佈即可！")
      : "⚠️ 分享失敗，可改用下方按鈕。");
  }

  async function doCopy() {
    const res = await copyResultText(data);
    setMsg(res.ok ? "📋 戰績文字已複製，貼到任何社群！" : "⚠️ 複製失敗，請手動選取。");
  }

  function doDownload() {
    setMsg("⬇️ 戰績卡片已下載！");
    downloadCanvas(canvasRef.current);
  }

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <button
        type="button"
        className="arcade-primary share"
        style={{ width: "100%", marginTop: 10 }}
        onClick={doShare}
        disabled={status === "working"}
      >
        {status === "working" ? "產生戰績圖片中…" : "📤 分享戰績卡片"}
      </button>
      <div className="arcade-share-row">
        <button type="button" className="arcade-share-btn line" onClick={doLine}>💬 LINE</button>
        <button type="button" className="arcade-share-btn fb" onClick={doFacebook}>📘 Facebook</button>
        <button type="button" className="arcade-share-btn" onClick={doCopy}>📋 複製戰績</button>
        <button type="button" className="arcade-share-btn" onClick={doDownload}>⬇️ 存圖片</button>
      </div>
      {msg && <div className="arcade-note" style={{ marginTop: 8 }}>{msg}</div>}
      {status === "error" && (
        <div className="arcade-note" style={{ marginTop: 8 }}>⚠️ 圖片產生失敗，請再試一次。</div>
      )}
    </>
  );
}

function catSkillIcon(type) {
  if (type === "heal") return "💚";
  if (type === "def") return "🛡️";
  return "⚔️";
}

function Confetti() {
  const pieces = [
    { left: "8%", delay: "0s", dur: "2.6s", emoji: "🎉" },
    { left: "22%", delay: ".3s", dur: "2.9s", emoji: "⭐" },
    { left: "38%", delay: ".1s", dur: "2.4s", emoji: "🎊" },
    { left: "55%", delay: ".5s", dur: "2.8s", emoji: "✨" },
    { left: "70%", delay: ".2s", dur: "2.5s", emoji: "🎉" },
    { left: "86%", delay: ".4s", dur: "2.7s", emoji: "⭐" },
  ];
  return (
    <div className="arcade-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur }}>{p.emoji}</span>
      ))}
    </div>
  );
}
