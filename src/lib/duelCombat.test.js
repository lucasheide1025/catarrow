// src/lib/duelCombat.test.js — 決鬥 2.0 純邏輯測試
import {
  computeDuelRound, attackDuelArcher, ensureDuelMember,
  summarizeDuelLoadout, PVP_STATUS_RULES,
} from "./duelCombat";
import { buildCombatModifiers } from "./combatModifiers";

// 固定亂數：永遠回 0.5（variance 1.0、crit 50%、inflict 50%…）
const R = () => 0.5;
const noEvent = () => null;

function mkMember(over = {}) {
  return {
    name: over.id || "喵",
    hp: 200, maxHP: 200, atk: 10, def: 5,
    arrows: [], ready: false, alive: true,
    mods: buildCombatModifiers(),
    shield: 0, status: {}, pending: {},
    ...over,
  };
}

const sixTens = Array.from({ length: 6 }, () => ({ score: 10, label: "10" }));
const sixMiss = Array.from({ length: 6 }, () => ({ score: 0, label: "M" }));

describe("attackDuelArcher 基礎", () => {
  test("全 10 環造成正傷害、0 暴擊（固定亂數）", () => {
    const atk = mkMember({ id: "a", atk: 20, def: 5, arrows: sixTens });
    const tgt = mkMember({ id: "b", hp: 300, maxHP: 300, atk: 20, def: 5 });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: R });
    expect(res.dmg).toBeGreaterThan(0);
    expect(res.crits).toBe(0);
    expect(res.arrowBreakdown.length).toBe(6);
  });

  test("全部脫靶 → 0 傷害", () => {
    const atk = mkMember({ id: "a", arrows: sixMiss });
    const tgt = mkMember({ id: "b" });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: () => 0.9 });
    expect(res.dmg).toBe(0);
  });

  test("冰凍狀態 → stunned、0 傷害", () => {
    const atk = mkMember({ id: "a", arrows: sixTens, status: { freeze: { strength: 0, duration: 1 } } });
    const tgt = mkMember({ id: "b" });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: R });
    expect(res.stunned).toBe("freeze");
    expect(res.dmg).toBe(0);
  });

  test("麻痺 rand < 0.5 → stunned", () => {
    const atk = mkMember({ id: "a", arrows: sixTens, status: { paralyze: { strength: 50, duration: 1 } } });
    const res = attackDuelArcher({ attacker: atk, target: mkMember({ id: "b" }), round: 1, rand: () => 0.3 });
    expect(res.stunned).toBe("paralyze");
  });

  test("穿甲(卡片無視防禦) 讓傷害高於無穿甲", () => {
    const base = mkMember({ id: "a", arrows: sixTens, atk: 20 });
    const tgt  = mkMember({ id: "b", def: 30, hp: 500, maxHP: 500 });
    const noPierce = attackDuelArcher({ attacker: base, target: { ...tgt }, round: 1, rand: R });
    const pierce = attackDuelArcher({
      attacker: { ...base, mods: { ...base.mods, defIgnoreCardPct: 100 } },
      target: { ...tgt }, round: 1, rand: R,
    });
    expect(pierce.dmg).toBeGreaterThan(noPierce.dmg);
  });

  test("堅盾(受傷減免) 讓傷害低於無減免", () => {
    const base = mkMember({ id: "a", arrows: sixTens, atk: 20 });
    const tgt  = mkMember({ id: "b", def: 5, hp: 500, maxHP: 500 });
    const noRed = attackDuelArcher({ attacker: { ...base }, target: { ...tgt }, round: 1, rand: R });
    const red = attackDuelArcher({
      attacker: { ...base },
      target: { ...tgt, mods: { ...tgt.mods, cardReductionPct: 40 } },
      round: 1, rand: R,
    });
    expect(red.dmg).toBeLessThan(noRed.dmg);
  });

  test("目標護盾先吸收傷害", () => {
    const atk = mkMember({ id: "a", arrows: sixTens, atk: 20 });
    const tgt = mkMember({ id: "b", shield: 50, hp: 300, maxHP: 300 });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: R });
    expect(res.shieldDmg).toBeGreaterThan(0);
    expect(res.shieldDmg).toBeLessThan(res.dmg + res.shieldDmg);
  });

  test("反彈(荊棘) 對攻擊者造成回彈傷害", () => {
    const atk = mkMember({ id: "a", arrows: sixTens, atk: 20 });
    const tgt = mkMember({ id: "b", hp: 500, maxHP: 500, mods: { ...buildCombatModifiers(), reflectPct: 50 } });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: R });
    expect(res.reflect).toBeGreaterThan(0);
  });

  test("9 環以上且帶 inflict → 施加異常（rand 0.5 觸發）", () => {
    const inf = { poison: { chancePct: 100, strength: 3, duration: 3 } };
    const atk = mkMember({ id: "a", arrows: sixTens, mods: { ...buildCombatModifiers(), inflict: inf } });
    const tgt = mkMember({ id: "b", hp: 500, maxHP: 500 });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: R });
    expect(res.statusHit?.id).toBe("poison");
  });

  test("7 環以下不施加異常", () => {
    const inf = { poison: { chancePct: 100, strength: 3, duration: 3 } };
    const arrows = Array.from({ length: 6 }, () => ({ score: 6, label: "6" }));
    const atk = mkMember({ id: "a", arrows, mods: { ...buildCombatModifiers(), inflict: inf } });
    const tgt = mkMember({ id: "b", hp: 500, maxHP: 500 });
    const res = attackDuelArcher({ attacker: atk, target: tgt, round: 1, rand: R });
    expect(res.statusHit).toBeNull();
  });
});

describe("computeDuelRound 回合流程", () => {
  test("無事件、雙方全滅判定勝負", () => {
    const a = mkMember({ id: "a", hp: 10, maxHP: 200, arrows: sixTens, atk: 200 });
    const b = mkMember({ id: "b", hp: 10, maxHP: 200, arrows: sixMiss, atk: 1 });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: R, shouldTrigger: noEvent });
    expect(res.result).toBe("teamA");
    expect(res.logEntry.round).toBe(1);
    expect(res.attacks.length).toBeGreaterThan(0);
  });

  test("hpDelta 正確反映淨變化（結束 - 開始）", () => {
    const a = mkMember({ id: "a", hp: 200, maxHP: 200, arrows: sixTens, atk: 20 });
    const b = mkMember({ id: "b", hp: 200, maxHP: 200, arrows: sixTens, atk: 20 });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: R, shouldTrigger: noEvent });
    for (const [id, m] of Object.entries({ ...res.members })) {
      const key = id.split(":")[1];
      expect(res.hpDelta[key]).toBe(m.hp - 200);
    }
  });

  test("中毒跨回合：round1 施加 → round2 啟動跳傷", () => {
    const inf = { poison: { chancePct: 100, strength: 3, duration: 3 } };
    const atk = mkMember({ id: "a", arrows: sixTens, atk: 20, mods: { ...buildCombatModifiers(), inflict: inf } });
    const tgt = mkMember({ id: "b", hp: 500, maxHP: 500, arrows: sixMiss });
    const r1 = computeDuelRound({ teamA: { a: atk }, teamB: { b: tgt }, round: 1, rand: R, shouldTrigger: noEvent });
    const bAfterR1 = r1.members["B:b"];
    expect(bAfterR1.pending.poison).toBeDefined();
    expect(bAfterR1.status.poison).toBeUndefined();

    const r2 = computeDuelRound({
      teamA: { a: { ...atk, hp: r1.members["A:a"].hp, arrows: sixTens } },
      teamB: { b: { ...tgt, ...bAfterR1, hp: bAfterR1.hp, arrows: sixMiss } },
      round: 2, rand: R, shouldTrigger: noEvent,
    });
    const bAfterR2 = r2.members["B:b"];
    expect(bAfterR2.status.poison).toBeDefined();
    expect(bAfterR2.hp).toBeLessThan(bAfterR1.hp);
  });

  test("開場護盾在第一回合建立", () => {
    const a = mkMember({ id: "a", arrows: sixMiss, mods: { ...buildCombatModifiers(), openingShieldPct: 20 } });
    const b = mkMember({ id: "b", arrows: sixMiss });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: R, shouldTrigger: noEvent });
    expect(res.members["A:a"].shield).toBe(Math.round(200 * 0.2));
  });

  test("叛變事件在 1v1 不觸發", () => {
    const a = mkMember({ id: "a", arrows: sixTens });
    const b = mkMember({ id: "b", arrows: sixTens });
    const betrayal = { id: "betrayal", icon: "🔄", title: "叛變", desc: "", type: "duel_special" };
    const res = computeDuelRound({
      teamA: { a }, teamB: { b }, round: 1, type: "1v1", rand: R,
      shouldTrigger: () => true, drawEvent: () => betrayal,
    });
    expect(res.eventData).toBeNull();
  });

  test("回合末回血（睡飽/汲取）", () => {
    const a = mkMember({ id: "a", arrows: sixMiss, hp: 150, maxHP: 200, mods: { ...buildCombatModifiers(), endRoundHeal: 10 } });
    const b = mkMember({ id: "b", arrows: sixMiss });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: R, shouldTrigger: noEvent });
    expect(res.members["A:a"].hp).toBe(160);
  });
});

describe("summarizeDuelLoadout", () => {
  test("空負載回空陣列", () => {
    expect(summarizeDuelLoadout(null)).toEqual([]);
  });
  test("摘要包含卡片與專精", () => {
    const loadout = {
      cards: 5,
      specLabels: [{ label: "破甲", level: 3 }],
      rows: [{ icon: "💪", text: "傷害：+5%" }],
    };
    const rows = summarizeDuelLoadout(loadout);
    expect(rows.some(r => r.label.includes("卡片 ×5"))).toBe(true);
    expect(rows.some(r => r.label.includes("破甲 Lv.3"))).toBe(true);
    expect(rows.some(r => r.label.includes("+5%"))).toBe(true);
  });
});

describe("決鬥 2.1：A1/B1 有來有回＋先手隨機＋提前擊殺", () => {
  test("先手隨機：rand<0.5 → A 先手；rand≥0.5 → B 先手", () => {
    const a = mkMember({ id: "a", arrows: sixMiss });
    const b = mkMember({ id: "b", arrows: sixMiss });
    const rA = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.2, shouldTrigger: noEvent });
    const rB = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.8, shouldTrigger: noEvent });
    expect(rA.logEntry.firstTeam).toBe("A");
    expect(rB.logEntry.firstTeam).toBe("B");
  });

  test("A1箭 B1箭 交錯：attacks 依序交替隊伍、格式標記", () => {
    const a = mkMember({ id: "a", arrows: sixTens });
    const b = mkMember({ id: "b", arrows: sixTens });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.2, shouldTrigger: noEvent });
    expect(res.logEntry.format).toBe("interleave");
    // 先手 A：順序 A,B,A,B...（誰都沒死 → 12 箭）
    const seq = res.attacks.map(atk => atk.attackerTeam);
    expect(seq[0]).toBe("A");
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(res.attacks.length).toBe(12);
  });

  test("中途擊殺提前結束：A 秒殺 B → 只剩 A 那支箭，B 完全不射", () => {
    const a = mkMember({ id: "a", arrows: sixTens, atk: 500 });
    const b = mkMember({ id: "b", arrows: sixTens, hp: 50, maxHP: 50 });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.2, shouldTrigger: noEvent });
    expect(res.result).toBe("teamA");
    expect(res.attacks.length).toBe(1);
    expect(res.attacks[0].attackerTeam).toBe("A");
    expect(res.members["B:b"].alive).toBe(false);
    expect(res.members["B:b"].hp).toBe(0);
  });

  test("自動回血無法復活：被打到 0 立即判定死亡，回合末回血不生效", () => {
    const a = mkMember({ id: "a", arrows: sixTens, atk: 500 });
    const b = mkMember({ id: "b", arrows: sixMiss, hp: 50, maxHP: 50,
      mods: { ...buildCombatModifiers(), endRoundHeal: 30 } });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.2, shouldTrigger: noEvent });
    expect(res.result).toBe("teamA");
    expect(res.members["B:b"].alive).toBe(false);
    expect(res.members["B:b"].hp).toBe(0); // 沒有被回合末回血拉回來
  });

  test("反彈同歸於盡 → 平局", () => {
    const a = mkMember({ id: "a", arrows: sixTens, atk: 200, hp: 50, maxHP: 50 });
    const b = mkMember({ id: "b", arrows: sixMiss, hp: 50, maxHP: 50,
      mods: { ...buildCombatModifiers(), reflectPct: 100 } });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.2, shouldTrigger: noEvent });
    expect(res.result).toBe("draw");
    expect(res.members["A:a"].alive).toBe(false);
    expect(res.members["B:b"].alive).toBe(false);
  });

  test("冰凍整回合鎖箭：被凍結的成員 6 支箭一支都射不出", () => {
    const a = mkMember({ id: "a", arrows: sixTens, atk: 20 });
    const b = mkMember({ id: "b", arrows: sixTens, status: { freeze: { strength: 0, duration: 1 } } });
    const res = computeDuelRound({ teamA: { a }, teamB: { b }, round: 2, rand: () => 0.2, shouldTrigger: noEvent });
    // B 只有一個 stunned 記錄，沒有任何實際箭步
    const bAttacks = res.attacks.filter(atk => atk.attackerId === "b");
    expect(bAttacks.length).toBe(1);
    expect(bAttacks[0].stunned).toBe("freeze");
    expect(bAttacks[0].dmg).toBe(0);
    expect(bAttacks[0].arrowBreakdown.length).toBe(0);
    // 有「無法行動」事件
    expect(res.statusEvents.some(e => e.kind === "stun" && e.memberId === "b")).toBe(true);
    // A 正常射出 6 箭
    const aAttacks = res.attacks.filter(atk => atk.attackerId === "a" && (atk.arrowBreakdown?.[0]?.dmg || 0) > 0);
    expect(aAttacks.length).toBe(6);
  });

  test("麻痺隨機鎖箭：rand<0.5 整回合鎖、rand≥0.5 正常射 6 箭", () => {
    const mkB = () => mkMember({ id: "b", arrows: sixTens, status: { paralyze: { strength: 50, duration: 1 } } });
    const base = { teamA: { a: mkMember({ id: "a", arrows: sixMiss }) }, round: 2, shouldTrigger: noEvent };
    const locked = computeDuelRound({ ...base, teamB: { b: mkB() }, rand: () => 0.2 });
    const lockedB = locked.attacks.filter(atk => atk.attackerId === "b");
    expect(lockedB.length).toBe(1);
    expect(lockedB[0].stunned).toBe("paralyze");

    const free = computeDuelRound({ ...base, teamB: { b: mkB() }, rand: () => 0.8 });
    const freeB = free.attacks.filter(atk => atk.attackerId === "b" && (atk.arrowBreakdown?.[0]?.dmg || 0) > 0);
    expect(freeB.length).toBe(6);
  });

  test("statusEvents 帶 phase：異常施加是 arrow、DoT 是 start、回血是 end", () => {
    const inf = { poison: { chancePct: 100, strength: 3, duration: 3 } };
    const a = mkMember({ id: "a", arrows: sixTens, atk: 20, mods: { ...buildCombatModifiers(), inflict: inf } });
    const b = mkMember({ id: "b", arrows: sixMiss, hp: 200, maxHP: 200,
      mods: { ...buildCombatModifiers(), endRoundHeal: 10 } });
    const r1 = computeDuelRound({ teamA: { a }, teamB: { b }, round: 1, rand: () => 0.2, shouldTrigger: noEvent });
    const inflictEv = r1.statusEvents.find(e => e.phase === "arrow" && e.text.includes("陷入"));
    expect(inflictEv).toBeDefined();
    // atk.statusHit 只在真正施加時寫入 → 揭露動畫能精準播報
    expect(r1.attacks.some(atk => atk.statusHit?.id === "poison")).toBe(true);

    const b1 = r1.members["B:b"];
    const r2 = computeDuelRound({
      teamA: { a: { ...a, hp: r1.members["A:a"].hp, arrows: sixMiss } },
      teamB: { b: { ...b, ...b1, hp: b1.hp, arrows: sixMiss } },
      round: 2, rand: () => 0.2, shouldTrigger: noEvent,
    });
    const dotEv = r2.statusEvents.find(e => e.kind === "dot");
    expect(dotEv).toBeDefined();
    expect(dotEv.phase).toBe("start");
    expect(dotEv.value).toBeGreaterThan(0);
    const healEv = r2.statusEvents.find(e => e.kind === "heal");
    expect(healEv).toBeDefined();
    expect(healEv.phase).toBe("end");
    expect(healEv.value).toBeGreaterThan(0);
  });

  test("2v2：每箭每隊存活成員各射一支，順序 A1,B1,A2,B2...", () => {
    const a1 = mkMember({ id: "a1", arrows: sixMiss });
    const a2 = mkMember({ id: "a2", arrows: sixMiss });
    const b1 = mkMember({ id: "b1", arrows: sixMiss });
    const b2 = mkMember({ id: "b2", arrows: sixMiss });
    const res = computeDuelRound({
      teamA: { a1, a2 }, teamB: { b1, b2 }, round: 1,
      rand: () => 0.2, shouldTrigger: noEvent,
    });
    // 先手 A：A1,A2,B1,B2, A1,A2,B1,B2...（全 miss 無死亡 → 24 箭）
    expect(res.attacks.length).toBe(24);
    const seq = res.attacks.slice(0, 8).map(atk => atk.attackerId);
    expect(seq).toEqual(["a1", "a2", "b1", "b2", "a1", "a2", "b1", "b2"]);
  });
});

describe("PVP_STATUS_RULES", () => {
  test("五種類型規則齊全", () => {
    const kinds = Object.values(PVP_STATUS_RULES).map(r => r.kind);
    expect(kinds).toContain("dot");
    expect(kinds).toContain("stat");
    expect(kinds).toContain("stun");
  });
});
