import {
  ARROWS_PER_ROUND,
  PLAYER_MAX_HP,
  ARCADE_MONSTERS,
  ARCADE_BOSS,
  ABYSS_DEEP_BOSS,
  BOSS_INTERRUPT,
  BOSS_RING_MISS_MULT,
  MOON_BOSS,
  buildAdventure,
  resolveRound,
  gradeAdventure,
  redZoneCount,
  clampArrow,
  formatArrow,
  SOLO_RING,
  rollSoloRing,
  scoreOfArrow,
  abyssDeepBoss,
} from "./arcadeBattle";
import { arcadeCatById, rollChestChoices, CHEST_ITEMS } from "./arcadeData";
import { WORLD_BOSSES } from "../lib/worldBossData";

// 固定 rng：0.9 → 技能不觸發（chance < 0.35）、反擊取 +2 變異
const rng = () => 0.9;
const cat = arcadeCatById("haji");

function baseState(monster, hp = PLAYER_MAX_HP) {
  return { playerHp: hp, cat, monster };
}

describe("arcadeBattle — 6 箭回合引擎", () => {
  test("普通怪：總分 = 傷害，怪物反擊扣玩家血", () => {
    const goblin = ARCADE_MONSTERS[0];
    const r = resolveRound(baseState(goblin), [8, 8, 8, 8, 8, 8], rng);
    expect(r.total).toBe(48);
    expect(r.dmg).toBe(48); // 無防禦
    expect(r.monsterHp).toBe(12);
    expect(r.victory).toBe(false);
    expect(r.counter).toBe(8); // atk6 + 2
    expect(r.playerHp).toBe(92);
    expect(r.defeat).toBe(false);
  });

  test("總分超過怪物 HP → 直接勝利，無反擊", () => {
    const goblin = ARCADE_MONSTERS[0];
    const r = resolveRound(baseState(goblin), [10, 10, 10, 10, 10, 10], rng);
    expect(r.total).toBe(60);
    expect(r.victory).toBe(true);
    expect(r.counter).toBe(0);
    expect(r.monsterHp).toBe(0);
  });

  test("防禦怪：傷害扣 def", () => {
    const beetle = ARCADE_MONSTERS[1]; // def 2
    const r = resolveRound(baseState(beetle), [8, 8, 8, 8, 8, 8], rng);
    expect(r.dmg).toBe(46);
  });

  test("跨回合血量累進：怪物現存血要帶進下一回合", () => {
    const beetle = ARCADE_MONSTERS[1]; // hp 80, def 2
    const r1 = resolveRound(baseState(beetle), [10, 10, 10, 10, 10, 10], rng); // 58 傷害
    expect(r1.victory).toBe(false);
    expect(r1.monsterHp).toBe(22);
    const r2 = resolveRound(
      { ...baseState(beetle), monsterHp: r1.monsterHp },
      [10, 10, 10, 10, 10, 10],
      rng
    );
    expect(r2.victory).toBe(true);
    expect(r2.monsterHp).toBe(0);
  });

  test("幽靈隱身：總分 < 40 → 只剩 30% 傷害；≥40 → 全傷害", () => {
    const ghost = ARCADE_MONSTERS.find((m) => m.id === "ghost");
    const low = resolveRound(baseState(ghost), [6, 6, 6, 6, 6, 6], rng); // 36
    expect(low.stealthReduced).toBe(true);
    expect(low.dmg).toBe(Math.round(36 * 0.3));
    const high = resolveRound(baseState(ghost), [7, 7, 7, 7, 7, 7], rng); // 42
    expect(high.stealthReduced).toBe(false);
    expect(high.dmg).toBe(42);
  });

  test("破防型怪物：1 箭黃心(10) → 傷害 ×1.5", () => {
    const turtle = ARCADE_MONSTERS.find((m) => m.id === "turtle"); // def 5, hp 120
    const r = resolveRound(baseState(turtle), [10, 6, 6, 6, 6, 6], rng); // 40 → ×1.5=60 → -5def=55
    expect(r.breakApplied).toBe(true);
    expect(r.dmg).toBe(55);
  });

  test("狼人突進：≥2 箭紅區(≥8) → 閃避，怪物不反擊", () => {
    const wolf = ARCADE_MONSTERS.find((m) => m.id === "wolf");
    const r = resolveRound(baseState(wolf), [8, 8, 5, 5, 5, 5], rng);
    expect(r.dodge).toBe(true);
    expect(r.counter).toBe(0);
    const fail = resolveRound(baseState(wolf), [8, 5, 5, 5, 5, 5], rng);
    expect(fail.dodge).toBe(false);
    expect(fail.counter).toBeGreaterThan(0);
  });

  test("Boss 蓄力：總分達新手門檻可打斷（反擊 ×0.4）；未達則大招 ×2", () => {
    const boss = ARCADE_BOSS;
    const hit = resolveRound(baseState(boss), [6, 6, 6, 6, 6, 6], rng); // 36
    expect(BOSS_INTERRUPT).toBe(36);
    expect(hit.bossInterrupted).toBe(true);
    expect(hit.counter).toBe(Math.round((boss.atk + 2) * 0.4));
    const weak = resolveRound(baseState(boss), [5, 5, 5, 5, 5, 5], rng); // 30
    expect(weak.bossInterrupted).toBe(false);
    expect(weak.counter).toBe(Math.round((boss.atk + 2) * 2));
  });

  test("普通怪名稱與圖片由同一 sourceMonsterId 綁定，不再錯位", () => {
    expect(ARCADE_MONSTERS.map(({ id, sourceMonsterId, name, image }) => ({ id, sourceMonsterId, name, image }))).toEqual([
      { id: "goblin", sourceMonsterId: "temple_1", name: "哥布林", image: "/monsters/temple_1.webp" },
      { id: "beetle", sourceMonsterId: "insect_1", name: "大蟑螂", image: "/monsters/insect_1.webp" },
      { id: "wolf", sourceMonsterId: "temple_3", name: "狼人", image: "/monsters/temple_3.webp" },
      { id: "turtle", sourceMonsterId: "temple_2", name: "骷髏劍士", image: "/monsters/temple_2.webp" },
      { id: "ghost", sourceMonsterId: "ghost_1", name: "鏡幕幽姬", image: "/monsters/ghost_1.webp" },
    ]);
  });

  test("三種訪客 BOSS 沿用學籍 WORLD_BOSSES identity，但不沿用正式高血量", () => {
    const bosses = [ARCADE_BOSS, MOON_BOSS, ABYSS_DEEP_BOSS];
    for (const boss of bosses) {
      const source = WORLD_BOSSES[boss.worldBossKey];
      expect(source).toBeTruthy();
      expect(boss.name).toBe(source.name);
      expect(boss.title).toBe(source.title);
      expect(boss.image).toBe(`/worldboss/${source.pixelKey || boss.worldBossKey}.webp`);
      expect(boss.hp).toBe(115);
      expect(source.hp).toBeGreaterThan(boss.hp * 100);
    }
  });

  test("新手基準：6 箭平均 5 分且完全沒中弱點，三種世界王都在第 5 回合擊敗且玩家存活", () => {
    const shots = Array.from({ length: 6 }, () => ({ nx: 0.9, ny: 0.9, score: 5 }));
    const ring = { ...SOLO_RING, cx: -0.5, cy: -0.5 };
    for (const boss of [ARCADE_BOSS, MOON_BOSS, ABYSS_DEEP_BOSS]) {
      let playerHp = PLAYER_MAX_HP;
      let monsterHp = boss.hp;
      let last = null;
      for (let round = 1; round <= 5; round += 1) {
        last = resolveRound({ playerHp, monsterHp, cat, monster: boss, ring }, shots, rng);
        playerHp = last.playerHp;
        monsterHp = last.monsterHp;
        if (round < 5) expect(last.victory).toBe(false);
      }
      expect(last.victory).toBe(true);
      expect(last.ringMet).toBe(false);
      expect(last.dmg).toBe(Math.round((30 - boss.def) * BOSS_RING_MISS_MULT));
      expect(playerHp).toBeGreaterThan(0);
    }
  });

  test("全脫靶 → 貓咪救援 +5，仍算傷害", () => {
    const goblin = ARCADE_MONSTERS[0];
    const r = resolveRound(baseState(goblin), [0, 0, 0, 0, 0, 0], rng);
    expect(r.total).toBe(0);
    expect(r.dmg).toBe(5);
    expect(r.catEvent.type).toBe("rescue");
  });

  test("攻擊型技能觸發：追擊傷害加進 dmg", () => {
    const goblin = ARCADE_MONSTERS[0];
    const r = resolveRound(baseState(goblin), [8, 8, 8, 8, 8, 8], () => 0); // 0 < chance
    expect(r.catEvent.type).toBe("atk");
    expect(r.catEvent.extra).toBeGreaterThan(0);
    expect(r.dmg).toBe(48 + r.catEvent.extra);
  });

  test("治療型技能：反擊後補血（不超過上限）", () => {
    const wolf = ARCADE_MONSTERS.find((m) => m.id === "wolf");
    const meimei = arcadeCatById("meimei");
    const r = resolveRound(
      { playerHp: 30, cat: meimei, monster: wolf },
      [8, 5, 5, 5, 5, 5],
      () => 0
    );
    expect(r.catEvent.type).toBe("heal");
    expect(r.playerHp).toBe(Math.min(PLAYER_MAX_HP, 30 - r.counter + r.catEvent.healed));
  });

  test("格擋型技能：反擊大幅降低", () => {
    const wolf = ARCADE_MONSTERS.find((m) => m.id === "wolf");
    const diandian = arcadeCatById("diandian");
    const r = resolveRound({ playerHp: 100, cat: diandian, monster: wolf }, [8, 5, 5, 5, 5, 5], () => 0);
    expect(r.catEvent.type).toBe("def");
    expect(r.counter).toBeLessThanOrEqual(Math.round((wolf.atk + 2) * (1 - 0.65)));
  });

  test("火焰箭 buff：傷害 ×1.2", () => {
    const goblin = ARCADE_MONSTERS[0];
    const r = resolveRound({ ...baseState(goblin), atkBuff: 1.2 }, [8, 8, 8, 8, 8, 8], rng);
    expect(r.dmg).toBe(Math.round(48 * 1.2));
  });

  test("玩家 HP 歸零 → 判定失敗", () => {
    const boss = { ...ARCADE_BOSS, atk: 1000 };
    const r = resolveRound(baseState(boss), [1, 1, 1, 1, 1, 1], rng);
    expect(r.defeat).toBe(true);
    expect(r.playerHp).toBe(0);
  });

  test("buildAdventure：貓森遺跡 3 小怪 + 1 Boss", () => {
    const a = buildAdventure();
    expect(a.dungeon).toContain("貓森遺跡");
    expect(a.fights).toHaveLength(3);
    expect(a.boss.ability).toBe("boss");
    expect([...a.fights, a.boss].every((m) => m.hp > 0)).toBe(true);
  });

  test("gradeAdventure 依剩餘生命給 S/A/B/C", () => {
    expect(gradeAdventure(90).grade).toBe("S");
    expect(gradeAdventure(60).grade).toBe("A");
    expect(gradeAdventure(40).grade).toBe("B");
    expect(gradeAdventure(10).grade).toBe("C");
  });

  test("rollChestChoices 回傳 3 個合法道具", () => {
    const picks = rollChestChoices(() => 0.5);
    expect(picks).toHaveLength(3);
    for (const id of picks) expect(CHEST_ITEMS[id]).toBeTruthy();
  });

  test("scoreOfArrow：數字與靶面落點物件都給分", () => {
    expect(scoreOfArrow(8)).toBe(8);
    expect(scoreOfArrow(-1)).toBe(0);
    expect(scoreOfArrow(11)).toBe(10);
    expect(scoreOfArrow({ nx: 0.1, ny: 0.1, score: 9 })).toBe(9);
    expect(scoreOfArrow(null)).toBe(0);
  });
});

describe("arcadeBattle — 單人 Boss 靶面弱點圈", () => {
  test("rollSoloRing：圈有座標且整個在靶內", () => {
    const ring = rollSoloRing(() => 0.5);
    expect(ring.id).toBe("solo");
    expect(typeof ring.cx).toBe("number");
    expect(Math.hypot(ring.cx, ring.cy)).toBeLessThanOrEqual(0.86);
    expect(ring.radius).toBe(SOLO_RING.radius);
    expect(ring.bonus).toBeGreaterThan(1);
  });

  test("Boss 靶面：6 箭全進圈 → 傷害加成 ×bonus×(1+0.08×5)", () => {
    const boss = ARCADE_BOSS; // def 3
    const ring = { ...SOLO_RING, cx: 0.1, cy: 0.1 };
    const arrows = Array(6).fill({ nx: 0.1, ny: 0.1, score: 10 });
    const r = resolveRound({ ...baseState(boss), ring }, arrows, rng);
    expect(r.weakHits).toBe(6);
    expect(r.ringMet).toBe(true);
    const afterDef = 60 - boss.def; // 57
    expect(r.dmg).toBe(Math.round(afterDef * ring.bonus * (1 + 0.08 * 5)));
  });

  test("Boss 靶面：全沒進圈 → 保留 80% 傷害", () => {
    const boss = ARCADE_BOSS;
    const ring = { ...SOLO_RING, cx: -0.5, cy: -0.5 };
    const arrows = Array(6).fill({ nx: 0.8, ny: 0.8, score: 8 });
    const r = resolveRound({ ...baseState(boss), ring }, arrows, rng);
    expect(r.weakHits).toBe(0);
    expect(r.ringMet).toBe(false);
    expect(r.dmg).toBe(Math.round((48 - boss.def) * BOSS_RING_MISS_MULT));
  });

  test("Boss 記分板（數字箭）：不受弱點圈影響", () => {
    const boss = ARCADE_BOSS;
    const ring = rollSoloRing(() => 0.3);
    const r = resolveRound({ ...baseState(boss), ring }, [8, 8, 8, 8, 8, 8], rng);
    expect(r.weakHits).toBe(0);
    expect(r.ringMet).toBeNull();
    expect(r.dmg).toBe(48 - boss.def); // 無加成、無減半
    expect(r.bossInterrupted).toBe(true); // 打斷大招機制不受影響
  });

  test("Boss 靶面：打斷大招仍依總分判定", () => {
    const boss = ARCADE_BOSS;
    const ring = { ...SOLO_RING, cx: 0, cy: 0 };
    const weak = resolveRound(
      { ...baseState(boss), ring },
      [{ nx: 0.9, ny: 0.9, score: 5 }, { nx: 0.9, ny: 0.9, score: 5 }, { nx: 0.9, ny: 0.9, score: 5 },
       { nx: 0.9, ny: 0.9, score: 5 }, { nx: 0.9, ny: 0.9, score: 5 }, { nx: 0.9, ny: 0.9, score: 5 }],
      rng
    );
    expect(weak.ringMet).toBe(false);
    expect(weak.bossInterrupted).toBe(false); // 30 < 36 → 大招
    const hit = resolveRound(
      { ...baseState(boss), ring },
      [{ nx: 0.05, ny: 0.05, score: 9 }, { nx: 0.05, ny: 0.05, score: 9 }, { nx: 0.05, ny: 0.05, score: 9 },
       { nx: 0.05, ny: 0.05, score: 9 }, { nx: 0.05, ny: 0.05, score: 9 }, { nx: 0.05, ny: 0.05, score: 9 }],
      rng
    );
    expect(hit.ringMet).toBe(true); // hypot(0.05,0.05)=0.071 ≤ 0.13 → 進圈
    expect(hit.bossInterrupted).toBe(true); // 54 ≥ 45 → 打斷
  });
});

describe("arcadeBattle — 輸入工具", () => {
  test("clampArrow 限制 0~10", () => {
    expect(clampArrow(-3)).toBe(0);
    expect(clampArrow(99)).toBe(10);
    expect(clampArrow(7.4)).toBe(7);
    expect(clampArrow(7.6)).toBe(8);
  });

  test("formatArrow：0 顯示 X", () => {
    expect(formatArrow(0)).toBe("X");
    expect(formatArrow(10)).toBe("10");
  });

  test("redZoneCount 計算 ≥8 的箭數", () => {
    expect(redZoneCount([10, 8, 7, 8, 0, 9])).toBe(4);
  });

  test("ARROWS_PER_ROUND = 6（本次需求改 6 箭）", () => {
    expect(ARROWS_PER_ROUND).toBe(6);
  });
});

describe("arcadeBattle — M2 月夜迷城／深淵巢穴", () => {
  const { MOON_ROUTES, MOON_ROUTE_COUNT, MOON_BOSS, rollMoonEvent, buildMoonLabyrinth, eliteVariant, abyssMonsterForFloor, abyssGrade, ADVENTURE_TYPES } = require("./arcadeBattle");

  test("三種冒險模式定義齊全（forest/moon/abyss）", () => {
    expect(Object.keys(ADVENTURE_TYPES)).toEqual(["forest", "moon", "abyss"]);
    for (const t of Object.values(ADVENTURE_TYPES)) {
      expect(t.name).toBeTruthy();
      expect(t.difficulty).toMatch(/[★☆]{3}/);
    }
  });

  test("月夜迷城：3 條岔路（寶箱/事件/菁英）＋既有世界王狼人首領", () => {
    expect(MOON_ROUTES).toHaveLength(3);
    expect(MOON_ROUTES.map((r) => r.id)).toEqual(["treasure", "event", "elite"]);
    expect(MOON_ROUTE_COUNT).toBe(3);
    expect(MOON_BOSS.ability).toBe("boss");
    expect(MOON_BOSS.name).toBe(WORLD_BOSSES.western_boss_small.name);
    const m = buildMoonLabyrinth();
    expect(m.entry.hp).toBeGreaterThan(0);
    expect(typeof m.randomFight).toBe("function");
  });

  test("神秘事件：rollMoonEvent 一定回傳合法事件", () => {
    for (let i = 0; i < 20; i++) {
      const ev = rollMoonEvent(() => 0.5);
      expect(ev.icon).toBeTruthy();
      expect(ev.text).toBeTruthy();
      expect([true, false, null]).toContain(ev.good);
    }
  });

  test("菁英怪：更強（血量/攻擊/獎勵提升）且保留能力", () => {
    const { ARCADE_MONSTERS } = require("./arcadeBattle");
    const goblin = ARCADE_MONSTERS[0];
    const e = eliteVariant(goblin);
    expect(e.elite).toBe(true);
    expect(e.name).toBe("精英哥布林");
    expect(e.hp).toBe(Math.round(goblin.hp * 1.6));
    expect(e.atk).toBe(Math.round(goblin.atk * 1.4));
    expect(e.rewardCoins).toBe(goblin.rewardCoins * 2);
  });

  test("深淵樓層：越高越強、獎勵越肥，lootMult 直接乘獎勵", () => {
    const f1 = abyssMonsterForFloor(1, 1);
    const f3 = abyssMonsterForFloor(3, 2);
    expect(f3.hp).toBeGreaterThan(f1.hp);
    expect(f3.atk).toBeGreaterThan(f1.atk);
    expect(f3.rewardCoins).toBeGreaterThan(f1.rewardCoins * 2);
    expect(f3.task).toContain("第 3 層");
    expect(f3.task).toContain("×2");
  });

  test("深淵評價：按層數 S/A/B/C", () => {
    expect(abyssGrade(6).grade).toBe("S");
    expect(abyssGrade(4).grade).toBe("A");
    expect(abyssGrade(2).grade).toBe("B");
    expect(abyssGrade(1).grade).toBe("C");
  });

  test("深淵王座（abyssDeepBoss）：世界王風格＋獎勵隨 lootMult 縮放", () => {
    const b = abyssDeepBoss(1);
    expect(b.ability).toBe("boss");
    expect(b.name).toBe(WORLD_BOSSES.ghost_boss.name);
    expect(b.skillName).toBeTruthy();
    expect(b.hp).toBe(115);
    expect(b.def).toBe(1);
    const b8 = abyssDeepBoss(8);
    expect(b8.rewardCoins).toBe(b.rewardCoins * 8);
    expect(b8.task).toContain("×8");
    expect(b8.task).toContain("深淵王座");
  });
});
