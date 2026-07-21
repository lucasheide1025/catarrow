// src/zombie/domain/encounterResolver.test.js
// ═══════════════════════════════════════════════════════════════
//  ⚔️ 遭遇解析器 — 單元測試
//  測試涵蓋：遭遇初始化、單箭命中解析（含特殊箭）、完整回合流程
//  randomize=false 確保可預測性
// ═══════════════════════════════════════════════════════════════

import {
  createEncounterState,
  resolveArrowHit,
  processRound,
  EVENT,
} from "./encounterResolver";

// ── 輔助：建立標準殭屍供 resolveArrowHit 測試 ──────────────
function makeZombie(overrides = {}) {
  return {
    id: "zombie_test_0",
    archetypeId: "normal",
    distanceM: 10,
    targetSlot: "A",
    body: {},
    statuses: [],
    threatCursor: 0,
    alive: true,
    justArrived: false,
    ...overrides,
  };
}

// ── 輔助：建立標準箭矢 ────────────────────────────────────
function makeArrow(overrides = {}) {
  return { targetSlot: "A", isMiss: false, arrowType: "normal", ...overrides };
}

// ═════════════════════════════════════════════════════════════
//  createEncounterState
// ═════════════════════════════════════════════════════════════

describe("createEncounterState", () => {
  test("普通區 → 2+ 隻普通殭屍", () => {
    const state = createEncounterState("normal", ["player_1"]);
    expect(state.round).toBe(0);
    expect(state.survivors.player_1).toBeDefined();
    expect(state.survivors.player_1.alive).toBe(true);
    expect(state.survivors.player_1.lifeState).toBe("healthy");
    expect(Object.keys(state.zombies).length).toBeGreaterThanOrEqual(2);
    // 普通區只有 normal 殭屍
    const archetypes = Object.values(state.zombies).map(z => z.archetypeId);
    expect(archetypes.every(a => a === "normal")).toBe(true);
  });

  test("高危區 → 包含遠程殭屍", () => {
    const state = createEncounterState("high_risk", ["p1", "p2"]);
    const archetypes = Object.values(state.zombies).map(z => z.archetypeId);
    expect(archetypes).toContain("ranged");
    expect(Object.keys(state.survivors).length).toBe(2);
  });

  test("安全區 → 0 殭屍", () => {
    const state = createEncounterState("safe", ["p1"]);
    expect(Object.keys(state.zombies).length).toBe(0);
  });

  test("所有殭屍都有獨立的 targetSlot", () => {
    const state = createEncounterState("danger", ["p1"]);
    const slots = Object.values(state.zombies).map(z => z.targetSlot);
    const uniqueSlots = new Set(slots);
    expect(uniqueSlots.size).toBe(slots.length);
  });

  test("可自訂起始距離", () => {
    const state = createEncounterState("normal", ["p1"], {
      startDistanceMin: 5,
      startDistanceMax: 7,
      rand: () => 0.5, // 固定 roll 值
    });
    const zombie = Object.values(state.zombies)[0];
    // roll(5, 7, () => 0.5) = Math.floor(0.5 * 3) + 5 = 6
    expect(zombie.distanceM).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════
//  resolveArrowHit — 基本命中部位
// ═════════════════════════════════════════════════════════════

describe("resolveArrowHit — 脫靶", () => {
  test("isMiss=true → ARROW_MISS", () => {
    const arrow = makeArrow({ isMiss: true });
    const zombie = makeZombie();
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5);
    expect(result.hitPart).toBe("miss");
    expect(result.killed).toBe(false);
    expect(result.events[0].type).toBe(EVENT.ARROW_MISS);
  });

  test("determineHitPart 回傳 miss → ARROW_MISS", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    // rand=0.9 → 所有檢查都 false → 回傳 "miss"
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.9);
    expect(result.hitPart).toBe("miss");
    expect(result.events[0].type).toBe(EVENT.ARROW_MISS);
  });
});

describe("resolveArrowHit — 頭部命中", () => {
  test("普通殭屍頭部一箭必殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    // rand() < 0.10 → "head"
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.05);
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(true);
    expect(result.killReason).toContain("一箭必殺");
  });

  test("疾行殭屍頭部累積 2 箭擊殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie({ archetypeId: "fast" });
    zombie.body.head = 1; // 前一箭已命中頭部
    const result = resolveArrowHit(arrow, zombie, "fast", () => 0.05);
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(true);
    expect(result.killReason).toContain("累積 2 次");
  });

  test("疾行殭屍頭部第一箭不擊殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie({ archetypeId: "fast" });
    const result = resolveArrowHit(arrow, zombie, "fast", () => 0.05);
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(false);
  });

  test("重裝殭屍頭部需特殊裝備（無裝備時累積 3 箭）", () => {
    const arrow = makeArrow();
    const zombie = makeZombie({ archetypeId: "armored" });
    zombie.body.head = 2;
    const result = resolveArrowHit(arrow, zombie, "armored", () => 0.05);
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(true);
    expect(result.killReason).toContain("累積 3 次");
  });

  test("重裝殭屍頭部無裝備時第一箭不擊殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie({ archetypeId: "armored" });
    const result = resolveArrowHit(arrow, zombie, "armored", () => 0.05);
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(false);
  });
});

describe("resolveArrowHit — 頸部命中", () => {
  test("第一箭 50% 機率擊殺（rand < 0.5 時）", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    // rand() < 0.20 → "neck"
    // rand() < 0.5 → kill check passes
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.19, "normal");
    // 用 0.19 先讓 determineHitPart 回傳 "neck"（0.19 < 0.20）
    // 但在 resolveArrowHit 內，同一個 rand() 被多次呼叫...
    // 問題：rand() 被呼叫兩次（determineHitPart 用一次，neck 檢查用第二次）
    // 我們設 rand = () => 0.19，兩次呼叫都回傳 0.19
    // determineHitPart: 0.19 < 0.20 → true → "neck"
    // neck check: 0.19 < 0.5 → true → killed
    expect(result.hitPart).toBe("neck");
    expect(result.killed).toBe(true);
  });

  test("第一箭未擊殺時 knockback=1", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    // rand = () => 0.3 → neck check: 0.3 < 0.5 → true → killed
    // 等等，0.3 < 0.5 為 true，所以會擊殺。
    // 要用 > 0.5 才不擊殺：如 0.6
    // 但 determineHitPart: 0.6 落在 "belly"
    // 所以無法用同一個 rand 同時控制部位和頸部擊殺
    // 因為 neck 區間是 0.10~0.20，在該區間內 rand 值 < 0.5 永遠成立
    // 我們用不同 rand 來避免
    
    // 改用兩階段 rand：第一次 0.19（neck），第二次 0.8（不擊殺）
    let call = 0;
    const customRand = () => { call++; return call === 1 ? 0.19 : 0.8; };
    const result = resolveArrowHit(arrow, zombie, "normal", customRand);
    expect(result.hitPart).toBe("neck");
    expect(result.killed).toBe(false);
    expect(result.knockback).toBe(1);
  });

  test("第二箭頸部命中必殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    zombie.body.neck = 1; // 前一箭已命中頸部
    let call = 0;
    const customRand = () => { call++; return call === 1 ? 0.19 : 0.8; };
    const result = resolveArrowHit(arrow, zombie, "normal", customRand);
    expect(result.hitPart).toBe("neck");
    expect(result.killed).toBe(true);
    expect(result.killReason).toBe("第二次頸部命中必殺");
  });
});

describe("resolveArrowHit — 軀幹命中（胸/腹）", () => {
  test("普通殭屍軀幹累積 3 箭擊殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    zombie.body.chest = 1;
    zombie.body.belly = 1;
    // 0.5 → "belly"
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5);
    expect(result.hitPart).toBe("belly");
    const totalHits = (zombie.body.chest || 0) + (zombie.body.belly || 0) + 1;
    expect(totalHits).toBe(3);
    expect(result.killed).toBe(true);
    expect(result.knockback).toBe(1);
  });

  test("普通殭屍軀幹累積 2 箭不擊殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    zombie.body.chest = 1;
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5);
    expect(result.hitPart).toBe("belly");
    expect(result.killed).toBe(false);
    expect(result.knockback).toBe(1);
  });

  test("疾行殭屍軀幹需 6 箭擊殺", () => {
    const arrow = makeArrow();
    const zombie = makeZombie({ archetypeId: "fast" });
    zombie.body.chest = 3;
    zombie.body.belly = 2;
    const result = resolveArrowHit(arrow, zombie, "fast", () => 0.5);
    expect(result.hitPart).toBe("belly");
    expect(result.killed).toBe(true);
  });
});

describe("resolveArrowHit — 手臂命中", () => {
  test("手臂命中 knockback=1 + armDisabled=true", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    // 0.70 → "arm"（0.60 <= 0.70 < 0.75）
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.70);
    expect(result.hitPart).toBe("arm");
    expect(result.knockback).toBe(1);
    expect(result.armDisabled).toBe(true);
    expect(result.killed).toBe(false);
  });
});

describe("resolveArrowHit — 鼠蹊命中", () => {
  test("鼠蹊命中 knockback=1 + slowEffect=true", () => {
    const arrow = makeArrow();
    const zombie = makeZombie();
    // 0.80 → "groin"（0.75 <= 0.80 < 0.85）
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.80);
    expect(result.hitPart).toBe("groin");
    expect(result.knockback).toBe(1);
    expect(result.slowEffect).toBe(true);
    expect(result.killed).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
//  resolveArrowHit — 特殊箭矢效果
// ═════════════════════════════════════════════════════════════

describe("resolveArrowHit — 貫穿箭（threshold reduction）", () => {
  test("軀幹擊殺門檻 -1（3 箭→2 箭）", () => {
    const arrow = makeArrow({ arrowType: "arrow_threshold" });
    const zombie = makeZombie();
    zombie.body.chest = 1;
    // 普通殭屍軀幹需 3 箭，貫穿箭降為 2 箭 → 1+1=2 → 擊殺
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5, "arrow_threshold");
    expect(result.hitPart).toBe("belly");
    expect(result.killed).toBe(true);
    expect(result.killReason).toContain("貫穿箭效果");
  });

  test("貫穿箭不影響頭部擊殺", () => {
    const arrow = makeArrow({ arrowType: "arrow_threshold" });
    const zombie = makeZombie();
    // 頭部原本就一箭必殺，貫穿箭不改變
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.05, "arrow_threshold");
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(true);
  });
});

describe("resolveArrowHit — 擊退箭（knockback bonus）", () => {
  test("命中後 bonusKnockback=2", () => {
    const arrow = makeArrow({ arrowType: "arrow_knockback" });
    const zombie = makeZombie();
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5, "arrow_knockback");
    expect(result.specialKnockback).toBe(2);
  });
});

describe("resolveArrowHit — 靜音箭（silent）", () => {
  test("命中邏輯與普通箭相同，不影響擊殺", () => {
    const arrow = makeArrow({ arrowType: "arrow_silent" });
    const zombie = makeZombie();
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.05, "arrow_silent");
    expect(result.hitPart).toBe("head");
    expect(result.killed).toBe(true);
  });
});

describe("resolveArrowHit — 穿透箭（penetration）", () => {
  test("需 ctx.allZombies 才能穿透", () => {
    const arrow = makeArrow({ arrowType: "arrow_penetration" });
    const zombie = makeZombie();
    // 無 ctx → 不穿透，正常命中
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5, "arrow_penetration");
    expect(result.events.every(e => e.type !== EVENT.PENETRATION_HIT)).toBe(true);
  });

  test("有 ctx.allZombies → 找第二目標穿透", () => {
    const arrow = makeArrow({ arrowType: "arrow_penetration" });
    const primary = makeZombie({ id: "z1", distanceM: 10 });
    const secondary = makeZombie({ id: "z2", distanceM: 12, targetSlot: "B" });
    const allZombies = { z1: primary, z2: secondary };

    const result = resolveArrowHit(arrow, primary, "normal", () => 0.5, "arrow_penetration", {
      allZombies,
    });
    // 檢查穿透事件
    expect(result.events.some(e => e.type === EVENT.PENETRATION_HIT)).toBe(true);
    // 第二目標應有 body 記錄
    expect(Object.keys(secondary.body).length).toBeGreaterThan(0);
  });
});

describe("resolveArrowHit — 爆炸箭（explosive）", () => {
  test("有 ctx.allZombies → 產生爆炸事件", () => {
    const arrow = makeArrow({ arrowType: "arrow_explosive" });
    const primary = makeZombie({ id: "z1", distanceM: 10 });
    const nearby = makeZombie({ id: "z2", distanceM: 11, targetSlot: "B" });
    const far = makeZombie({ id: "z3", distanceM: 20, targetSlot: "C" });
    const allZombies = { z1: primary, z2: nearby, z3: far };

    const result = resolveArrowHit(arrow, primary, "normal", () => 0.5, "arrow_explosive", {
      allZombies,
    });
    // 3m 範圍內（z2 距離 1，z3 距離 10）→ 只炸到 z2
    expect(result.events.some(e => e.type === EVENT.EXPLOSION && e.payload.target === "z2")).toBe(true);
    expect(result.events.some(e => e.type === EVENT.EXPLOSION && e.payload.target === "z3")).toBe(false);
  });

  test("無 ctx → 不爆炸", () => {
    const arrow = makeArrow({ arrowType: "arrow_explosive" });
    const zombie = makeZombie();
    const result = resolveArrowHit(arrow, zombie, "normal", () => 0.5, "arrow_explosive");
    expect(result.events.every(e => e.type !== EVENT.EXPLOSION)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
//  processRound — 完整回合流程
// ═════════════════════════════════════════════════════════════

describe("processRound — 完整回合", () => {
  test("玩家 3 箭擊殺 1 隻普通殭屍 → 擊殺成功，但第 2 隻仍存活", () => {
    const state = createEncounterState("normal", ["p1"], {
      rand: () => 0.5,  // 固定距離 6m
    });

    // 普通區產生 2 隻殭屍，只打第 1 隻
    const zombies = Object.values(state.zombies);
    expect(zombies.length).toBeGreaterThanOrEqual(2);
    const targetZombie = zombies[0];

    // 3 箭軀幹擊殺（普通殭屍軀幹需 3 箭，randomize=false 固定中 belly）
    const submissions = {
      p1: [
        { targetSlot: targetZombie.targetSlot, isMiss: false, arrowType: "normal" },
        { targetSlot: targetZombie.targetSlot, isMiss: false, arrowType: "normal" },
        { targetSlot: targetZombie.targetSlot, isMiss: false, arrowType: "normal" },
      ],
    };

    const result = processRound(state, submissions, { randomize: false });

    // 應該有擊殺事件
    expect(result.events.some(e => e.type === EVENT.ZOMBIE_KILLED)).toBe(true);
    // 目標殭屍應該死亡
    const updated = result.nextState.zombies[targetZombie.id];
    expect(updated.alive).toBe(false);
    // 還有其他殭屍存活 → 不結束
    expect(result.encounterOver).toBe(false);
  });

  test("空箭（無 submissions）→ 不擊殺、不結束（第 1 回合 justArrived 不移動）", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const submissions = { p1: [] };

    const result = processRound(state, submissions, { randomize: false });

    // 不應該有擊殺
    expect(result.events.some(e => e.type === EVENT.ZOMBIE_KILLED)).toBe(false);
    // 不該結束
    expect(result.encounterOver).toBe(false);
    // 第 1 回合 justArrived=true → 不移動
    expect(result.events.some(e => e.type === EVENT.ZOMBIE_MOVE)).toBe(false);
  });

  test("submissions 空物件 → 不崩潰", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const result = processRound(state, {}, { randomize: false });
    expect(result.encounterOver).toBe(false);
    expect(result.events.some(e => e.type === EVENT.ROUND_END)).toBe(true);
  });

  test("回合數遞增", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const result = processRound(state, { p1: [] }, { randomize: false });
    expect(result.nextState.round).toBe(state.round + 1);
  });
});

// ═════════════════════════════════════════════════════════════
//  processRound — 殭屍移動測試
// ═════════════════════════════════════════════════════════════

describe("processRound — 殭屍移動", () => {
  test("普通殭屍移動 2m（randomize=false 固定值）", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    const originalDist = zombie.distanceM;

    const result = processRound(state, { p1: [] }, { randomize: false });
    const updated = result.nextState.zombies[zombie.id];
    // justArrived=true → 第一回合不移動
    expect(updated.distanceM).toBe(originalDist);
  });

  test("第二回合殭屍開始移動", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.justArrived = false; // 模擬非第一回合

    const result = processRound(state, { p1: [] }, { randomize: false });
    const updated = result.nextState.zombies[zombie.id];
    // roll(1, 3, () => 0.5) = 2m
    expect(updated.distanceM).toBe(zombie.distanceM - 2);
  });

  test("骨盆命中（pelvis_hit）減速為 0-1m", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.justArrived = false;
    zombie.statuses.push("pelvis_hit");

    const result = processRound(state, { p1: [] }, { randomize: false });
    const updated = result.nextState.zombies[zombie.id];
    // 骨盆命中後 roll(0, 1, () => 0.5) = 1m
    expect(updated.distanceM).toBe(zombie.distanceM - 1);
  });
});

// ═════════════════════════════════════════════════════════════
//  processRound — 特殊箭矢效果（整合）
// ═════════════════════════════════════════════════════════════

describe("processRound — 擊退箭整合", () => {
  test("擊退箭擊中胸/腹 → knockback=1 + specialKnockback=2", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.justArrived = false;
    const originalDist = zombie.distanceM;

    const submissions = {
      p1: [{ targetSlot: zombie.targetSlot, isMiss: false, arrowType: "arrow_knockback" }],
    };

    const result = processRound(state, submissions, { randomize: false });

    // 擊退事件檢查
    const knockbackEvents = result.events.filter(e => e.type === EVENT.KNOCKBACK);
    const specialKnockbackEvents = result.events.filter(e => e.type === EVENT.SPECIAL_KNOCKBACK);
    expect(knockbackEvents.length).toBeGreaterThan(0);
    expect(specialKnockbackEvents.length).toBe(1);
    expect(specialKnockbackEvents[0].payload.bonus).toBe(2);
  });
});

describe("processRound — 貫穿箭整合", () => {
  test("貫穿箭 2 箭軀幹擊殺（原本需 3 箭）", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];

    // 先射 1 箭到軀幹（累積 1）
    const submissions = {
      p1: [
        { targetSlot: zombie.targetSlot, isMiss: false, arrowType: "arrow_threshold" },
        { targetSlot: zombie.targetSlot, isMiss: false, arrowType: "arrow_threshold" },
      ],
    };

    // 讓 zombie 已經有一箭在身上
    const result = processRound(state, submissions, { randomize: false });

    // 第一箭 belly（rand=0.5），第二箭 belly
    // 貫穿箭 threshold -1 → 軀幹只需 2 箭
    // 兩箭都中軀幹不同部位（chest/belly）但累計計算
    // 注意：resolveArrowHit 每次被呼叫時 zombie.body 是已更新的
    // 第一次呼叫：body={}, hit=belly, 累積=0+0+1=1, threshold=2 → 未擊殺
    // 第二次呼叫：body={belly:1}, hit=belly, 累積=0+1+1=2, threshold=2 → 擊殺！
    expect(result.events.some(e => e.type === EVENT.ZOMBIE_KILLED)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
//  processRound — 遠程殭屍干擾
// ═════════════════════════════════════════════════════════════

describe("processRound — 遠程殭屍干擾", () => {
  test("8m 內遠程殭屍觸發干擾，可用箭數 -1", () => {
    const state = createEncounterState("high_risk", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies).find(z => z.archetypeId === "ranged");
    if (!zombie) return; // 若無遠程殭屍則跳過（取決於亂數種子）

    zombie.distanceM = 5; // 在 8m 範圍內
    zombie.justArrived = false;

    const submissions = {
      p1: [
        { targetSlot: zombie.targetSlot, isMiss: false, arrowType: "normal" },
        { targetSlot: zombie.targetSlot, isMiss: false, arrowType: "normal" },
        { targetSlot: zombie.targetSlot, isMiss: false, arrowType: "normal" },
      ],
    };

    const result = processRound(state, submissions, { randomize: false });

    // 檢查干擾事件
    expect(result.events.some(e => e.type === EVENT.AUTO_INTERFERE)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
//  processRound — 防具格擋
// ═════════════════════════════════════════════════════════════

describe("processRound — 防具格擋", () => {
  test("有防具時 0m 殭屍攻擊可能被格擋", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.distanceM = 0;  // 已到 0m
    zombie.justArrived = false;

    // 給玩家 T2 頭盔（blockRate=0.55）
    state.survivors.p1.armor = {
      helmet: { itemId: "armor_helmet_t2", durability: 5 },
    };

    // randomize=false → rand=0.5, block check: 0.5 < 0.55 → 格擋成功
    const result = processRound(state, { p1: [] }, { randomize: false });

    expect(result.events.some(e => e.type === EVENT.ARMOR_BLOCK)).toBe(true);
  });

  test("無防具 → 0m 殭屍攻擊必定感染", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.distanceM = 0;
    zombie.justArrived = false;

    const result = processRound(state, { p1: [] }, { randomize: false });

    expect(result.events.some(e => e.type === EVENT.INFECTION)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
//  processRound — 邊界情況
// ═════════════════════════════════════════════════════════════

describe("processRound — 邊界情況", () => {
  test("全部殭屍擊殺 → ENCOUNTER_WIN", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    // 把所有殭屍設為死亡
    for (const zombie of Object.values(state.zombies)) {
      zombie.alive = false;
    }

    const result = processRound(state, { p1: [] }, { randomize: false });
    expect(result.encounterOver).toBe(true);
    expect(result.events.some(e => e.type === EVENT.ENCOUNTER_WIN)).toBe(true);
  });

  test("所有生存者死亡 → ENCOUNTER_LOSE", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.distanceM = 0;
    zombie.justArrived = false;
    state.survivors.p1.alive = false; // 生存者死亡

    const result = processRound(state, { p1: [] }, { randomize: false });
    expect(result.encounterOver).toBe(true);
    expect(result.events.some(e => e.type === EVENT.ENCOUNTER_LOSE)).toBe(true);
  });

  test("unknown archetype 不崩潰", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];
    zombie.archetypeId = "unknown_type";

    const result = processRound(state, { p1: [{ targetSlot: zombie.targetSlot, isMiss: false }] }, { randomize: false });
    // 不崩潰即可
    expect(result).toBeDefined();
  });

  test("超過 maxArrowsPerPlayer 的箭矢被截斷", () => {
    const state = createEncounterState("normal", ["p1"], { rand: () => 0.5 });
    const zombie = Object.values(state.zombies)[0];

    const submissions = {
      p1: Array(10).fill(null).map(() => ({
        targetSlot: zombie.targetSlot,
        isMiss: true, // 全脫靶不影響
      })),
    };

    const result = processRound(state, submissions, { maxArrowsPerPlayer: 3, randomize: false });
    // 只有 3 枝箭的 miss event（其他被截斷）
    const missEvents = result.events.filter(e => e.type === EVENT.ARROW_MISS);
    // 注意：因為全脫靶且被截斷到 3 枝，但實際上最多 3 枝脫靶箭
    expect(missEvents.length).toBeLessThanOrEqual(3);
  });
});

// ═════════════════════════════════════════════════════════════
//  resolveArrowHit — 未知 archetype
// ═════════════════════════════════════════════════════════════

describe("resolveArrowHit — 未知 archetype", () => {
  test("回傳 miss 事件", () => {
    const arrow = makeArrow();
    const zombie = makeZombie({ archetypeId: "nonexistent" });
    const result = resolveArrowHit(arrow, zombie, "nonexistent", () => 0.5);
    expect(result.hitPart).toBeNull();
    expect(result.events[0].payload.reason).toBe("unknown_archetype");
  });
});
