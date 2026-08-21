// src/arcade/arcadeTeam.test.js — 組隊純邏輯單元測試
import {
  accumulateTeamPlayerStats,
  makeRoomCode, isValidRoomCode, normalizeRoomCode, decideTeamRoomEntry, resumeArrowsForRoom, hitsOfArrows, teamCombo,
  scaleMonsterForParty, buildTeamAdventure, resolveTeamRound, teamGrade,
  isStaleAt, pruneStaleRoster, HOST_STALE_MS, PLAYER_STALE_MS, comboLabel,
  routeById, eliteVariant, assignPersonalGoals, checkPersonalGoal, rollBossRings,
  resolveTeamBossRound, goalSpotStyle, TEAM_BOSS_TEAM_MIN, TEAM_BOSS_SPIRIT_START,
  TEAM_MODES, teamModeById, updateTeamStats, formatTeamDuration, emptyTeamStats, applyPartyMonsterAttack,
} from "./arcadeTeamLogic";

describe("組隊戰鬥 HP 契約", () => {
  it("怪物 HP 固定為 base × (1 + 開戰人數)", () => {
    expect(scaleMonsterForParty({ hp: 100, atk: 8 }, 2).hp).toBe(300);
    expect(scaleMonsterForParty({ hp: 100, atk: 8 }, 4).hp).toBe(500);
    expect(scaleMonsterForParty({ hp: 100, atk: 8 }, 8).hp).toBe(900);
  });

  it("怪物存活時同拍傷害全體存活玩家，HP 歸零才倒下", () => {
    const result = applyPartyMonsterAttack([
      { visitorId: "a", hp: 12, maxHp: 100, alive: true },
      { visitorId: "b", hp: 5, maxHp: 100, alive: true },
      { visitorId: "c", hp: 0, maxHp: 100, alive: false },
    ], 8, true);
    expect(result.partyDamage).toEqual([
      { visitorId: "a", amount: 8, hpBefore: 12, hpAfter: 4, alive: true },
      { visitorId: "b", amount: 5, hpBefore: 5, hpAfter: 0, alive: false },
    ]);
    expect(result.defeat).toBe(false);
  });

  it("所有玩家倒下才 defeat，怪物被擊倒則不反擊", () => {
    expect(applyPartyMonsterAttack([{ visitorId: "a", hp: 4, alive: true }], 9, true).defeat).toBe(true);
    expect(applyPartyMonsterAttack([{ visitorId: "a", hp: 4, alive: true }], 9, false).partyDamage).toEqual([]);
  });

  it("已倒下且本輪未提交的隊員仍能安全清理統計，不產生 NaN", () => {
    expect(accumulateTeamPlayerStats({
      visitorId: "downed", alive: false, hp: 0, score: 42, damage: 15,
    })).toEqual({
      score: 42, shots: 0, hitCount: 0, scoreSqSum: 0,
      damage: 15, xCount: 0, bestRoundDamage: 0,
    });
  });
});

describe("makeRoomCode / isValidRoomCode", () => {
  it("產生 5 位數代碼", () => {
    for (let i = 0; i < 20; i += 1) {
      const c = makeRoomCode();
      expect(c).toMatch(/^\d{5}$/);
    }
  });
  it("驗證代碼格式", () => {
    expect(isValidRoomCode("5827")).toBe(false); // 4 位
    expect(isValidRoomCode("58270")).toBe(true);
    expect(isValidRoomCode("abcde")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });
  it("normalizeRoomCode：只保留前 5 位數字", () => {
    expect(normalizeRoomCode(" 58-270 ")).toBe("58270");
    expect(normalizeRoomCode("12a34b56")).toBe("12345");
    expect(normalizeRoomCode(null)).toBe("");
  });
});

describe("組隊房斷線加入／恢復判定", () => {
  const room = (status, players = {}) => ({ kind: "team", status, players, expiresAt: 9_999_999 });
  it("waiting 新玩家可加入", () => {
    expect(decideTeamRoomEntry(room("waiting"), "new", 100).action).toBe("join");
  });
  it("active 原隊員可重連", () => {
    const d = decideTeamRoomEntry(room("fighting", { me: { visitorId: "me" } }), "me", 100);
    expect(d.action).toBe("reconnect");
  });
  it("active 非原隊員拒絕", () => {
    const d = decideTeamRoomEntry(room("fighting", { other: { visitorId: "other" } }), "me", 100);
    expect(d.action).toBe("reject");
    expect(d.reason).toBe("started");
  });
  it("原隊員可回結算；非隊員的已完成房或過期房會清 resume", () => {
    expect(decideTeamRoomEntry(room("result", { me: {} }), "me", 100).action).toBe("reconnect");
    expect(decideTeamRoomEntry(room("result", { other: {} }), "me", 100).clearResume).toBe(true);
    expect(decideTeamRoomEntry({ ...room("waiting"), expiresAt: 50 }, "me", 100).reason).toBe("expired");
  });
  it("相同 round 保留未送箭；權威 round 前進就清掉舊箭", () => {
    const saved = { round: 3, arrows: [10, 9, -1, -1, -1, -1] };
    expect(resumeArrowsForRoom(saved, 3)).toEqual(saved.arrows);
    expect(resumeArrowsForRoom(saved, 4)).toBeNull();
  });
});

describe("hitsOfArrows", () => {
  it("≥5 分算一次 Hit", () => {
    expect(hitsOfArrows([10, 8, 5, 4, 0, 2])).toBe(3);
    expect(hitsOfArrows([0, 0, 0, 0, 0, 0])).toBe(0);
  });
});

describe("teamCombo（規格 §16）", () => {
  it("3 Hits → ×1.1", () => {
    const c = teamCombo([{ score: 30, hits: 2 }, { score: 20, hits: 1 }]);
    expect(c.hits).toBe(3);
    expect(c.comboMult).toBe(1.1);
    expect(c.comboName).toBe("COMBO ×1.1");
  });
  it("6 Hits → ×1.25", () => {
    const c = teamCombo([{ score: 50, hits: 6 }]);
    expect(c.comboMult).toBe(1.25);
    expect(c.comboName).toBe("COMBO ×1.25");
  });
  it("9 Hits → TEAM BREAK ×1.5", () => {
    const c = teamCombo([{ score: 60, hits: 9 }]);
    expect(c.comboMult).toBe(1.5);
    expect(c.comboName).toBe("TEAM BREAK");
  });
  it("無 Hit → 純 TEAM ATTACK", () => {
    const c = teamCombo([{ score: 0, hits: 0 }, { score: 0, hits: 0 }]);
    expect(c.comboMult).toBe(1);
    expect(c.comboName).toBe("TEAM ATTACK");
  });
  it("comboLabel：倍率 → 名稱", () => {
    expect(comboLabel(2.0)).toBe("TEAM BREAK");
    expect(comboLabel(1.5)).toBe("TEAM BREAK");
    expect(comboLabel(1.25)).toBe("COMBO ×1.25");
    expect(comboLabel(1.1)).toBe("COMBO ×1.1");
    expect(comboLabel(1)).toBe("TEAM ATTACK");
    expect(comboLabel(0.9)).toBe("TEAM ATTACK");
  });
  it("完美配合：全員 ≥30 → ×1.5 疊乘、上限 ×2.0", () => {
    const c = teamCombo([{ score: 40, hits: 2 }, { score: 35, hits: 1 }]); // 3 hits → ×1.1
    expect(c.perfect).toBe(true);
    expect(c.totalMult).toBe(Math.min(2.0, 1.1 * 1.5));
  });
  it("有人 <30 → 不算完美配合", () => {
    const c = teamCombo([{ score: 40, hits: 2 }, { score: 10, hits: 1 }]); // 3 hits
    expect(c.perfect).toBe(false);
    expect(c.totalMult).toBe(1.1);
  });
  it("TEAM BREAK × 完美配合 → 封頂 ×2.0", () => {
    const c = teamCombo([{ score: 60, hits: 9 }]);
    expect(c.comboMult).toBe(1.5);
    expect(c.perfect).toBe(true);
    expect(c.totalMult).toBe(2.0);
  });
});

describe("scaleMonsterForParty（2~8 人）", () => {
  it("依人數縮放血量（1 + 人數）", () => {
    const m = { hp: 100, def: 2, atk: 5, name: "x" };
    const s3 = scaleMonsterForParty(m, 3);
    expect(s3.hp).toBe(400);
    expect(s3.maxHp).toBe(s3.hp);
    // 2 人以上每多 1 人：防禦 +1、攻擊 +2
    expect(s3.def).toBe(2 + (3 - 2));
    expect(s3.atk).toBe(5 + (3 - 2) * 2);
  });
  it("8 人：血量、防禦、攻擊都明顯更高", () => {
    const m = { hp: 100, def: 2, atk: 5, name: "x" };
    const s8 = scaleMonsterForParty(m, 8);
    expect(s8.hp).toBe(900);
    expect(s8.def).toBe(2 + 6);
    expect(s8.atk).toBe(5 + 12);
    expect(s8.maxHp).toBe(s8.hp);
  });
  it("1~2 人：不加防禦/攻擊（最低檔）", () => {
    const m = { hp: 100, def: 2, atk: 5, name: "x" };
    expect(scaleMonsterForParty(m, 1).def).toBe(2);
    expect(scaleMonsterForParty(m, 2).atk).toBe(5);
  });
});

describe("buildTeamAdventure（三模式＋三關＋叉路＋BOSS）", () => {
  it("forest 貓森遺跡：怪物與世界王 identity 跟單人一致", () => {
    const adv = buildTeamAdventure("forest", 3);
    expect(adv.dungeon).toContain("貓森遺跡");
    expect(adv.stages.map((s) => s.monster.name)).toEqual(["哥布林", "大蟑螂", "狼人"]);
    expect(adv.stages[0].routes).toEqual(["treasure", "elite"]);
    expect(adv.stages[1].routes).toEqual(["treasure", "event", "elite"]);
    expect(adv.stages[2].routes).toEqual(["deep", "rest"]);
    expect(adv.boss.id).toBe("forest_worldboss");
    expect(adv.boss.name).toBe("山魈頭領");
    expect(adv.stageIdx).toBe(0);
    expect(adv.boss.skillName).toBeTruthy();
  });
  it("moon 月夜迷城：既有怪物 identity／狼人首領", () => {
    const adv = buildTeamAdventure("moon", 3);
    expect(adv.dungeon).toContain("月夜迷城");
    expect(adv.stages.map((s) => s.monster.name)).toEqual(["哥布林", "鏡幕幽姬", "骷髏劍士"]);
    expect(adv.boss.id).toBe("moon_worldboss");
    expect(adv.boss.name).toBe("狼人首領");
    expect(adv.boss.skillName).toBe("月夜狼嚎");
  });
  it("abyss 深淵巢穴：深淵縮放怪三連 → 怨靈大君", () => {
    const adv = buildTeamAdventure("abyss", 3);
    expect(adv.dungeon).toContain("深淵巢穴");
    expect(adv.stages.map((s) => s.monster.name)).toEqual(["深淵哥布林", "深淵狼人", "深淵骷髏劍士"]);
    expect(adv.boss.id).toBe("abyss_worldboss");
    expect(adv.boss.name).toBe("怨靈大君");
    expect(adv.boss.skillName).toBeTruthy();
  });
  it("人數縮放：3 人怪血 > 2 人；未指定模式時預設 forest", () => {
    const adv = buildTeamAdventure("forest", 3);
    const adv2 = buildTeamAdventure("forest", 2);
    expect(adv.stages[0].monster.hp).toBeGreaterThan(adv2.stages[0].monster.hp);
    const def = buildTeamAdventure();
    expect(def.dungeon).toContain("貓森遺跡");
    expect(def.stages.length).toBe(3);
  });
});

describe("TEAM_MODES / teamModeById（冒險模式）", () => {
  it("三種模式齊全，未知模式退回 forest", () => {
    expect(TEAM_MODES.map((m) => m.id)).toEqual(["forest", "moon", "abyss"]);
    expect(teamModeById("moon").name).toBe("月夜迷城");
    expect(teamModeById("nope").id).toBe("forest");
  });
});

describe("updateTeamStats / formatTeamDuration（模式成就統計）", () => {
  it("第一次通關：wins=1、bestCombo=本次、bestTimeMs=本次", () => {
    const stats = updateTeamStats({}, "abyss", { bestCombo: 1.5, timeMs: 240000 });
    expect(stats.abyss.wins).toBe(1);
    expect(stats.abyss.bestCombo).toBe(1.5);
    expect(stats.abyss.bestTimeMs).toBe(240000);
  });
  it("再次通關：wins 累加、bestCombo 取較高、bestTimeMs 取較短", () => {
    let stats = updateTeamStats({}, "moon", { bestCombo: 1.25, timeMs: 300000 });
    stats = updateTeamStats(stats, "moon", { bestCombo: 1.5, timeMs: 360000 }); // combo 更高但更慢
    stats = updateTeamStats(stats, "moon", { bestCombo: 1.1, timeMs: 200000 }); // combo 低但更快
    expect(stats.moon.wins).toBe(3);
    expect(stats.moon.bestCombo).toBe(1.5);
    expect(stats.moon.bestTimeMs).toBe(200000);
  });
  it("不同模式各自獨立，不互相覆蓋", () => {
    let stats = updateTeamStats({}, "forest", { bestCombo: 1.25, timeMs: 180000 });
    stats = updateTeamStats(stats, "abyss", { bestCombo: 1.5, timeMs: 400000 });
    expect(stats.forest.wins).toBe(1);
    expect(stats.abyss.wins).toBe(1);
    expect(stats.forest.bestCombo).toBe(1.25);
    expect(stats.abyss.bestTimeMs).toBe(400000);
  });
  it("timeMs 為 0 時保留舊紀錄（避免無開始時間的舊房間洗掉最速）", () => {
    let stats = updateTeamStats({}, "forest", { bestCombo: 1.5, timeMs: 0 });
    expect(stats.forest.wins).toBe(1);
    expect(stats.forest.bestTimeMs).toBe(0);
    stats = updateTeamStats(stats, "forest", { bestCombo: 1.5, timeMs: 120000 });
    expect(stats.forest.bestTimeMs).toBe(120000);
    // 第三次沒帶時間 → 保留 120000
    stats = updateTeamStats(stats, "forest", { bestCombo: 1.5, timeMs: 0 });
    expect(stats.forest.bestTimeMs).toBe(120000);
  });
  it("formatTeamDuration：m:ss 格式、0 顯示 —", () => {
    expect(formatTeamDuration(0)).toBe("—");
    expect(formatTeamDuration(95000)).toBe("1:35");
    expect(formatTeamDuration(600000)).toBe("10:00");
  });
  it("emptyTeamStats 預設值齊全", () => {
    expect(emptyTeamStats()).toEqual({ wins: 0, bestCombo: 1, bestTimeMs: 0 });
  });
});

describe("routeById（叉路選項）", () => {
  it("五種路線都有定義", () => {
    ["treasure", "elite", "event", "deep", "rest"].forEach((id) => {
      expect(routeById(id)).not.toBeNull();
    });
    expect(routeById("nope")).toBeNull();
  });
  it("深入險境：BOSS 更狂暴、獎勵 ×1.5", () => {
    expect(routeById("deep").desc).toContain("×1.5");
  });
});

describe("eliteVariant（菁英路）", () => {
  it("血量 ×1.5、攻防上升、獎勵 ×2、名字加精英", () => {
    const m = { id: "wolf", name: "狼王", hp: 100, atk: 10, def: 3, rewardCoins: 20 };
    const e = eliteVariant(m);
    expect(e.id).toBe("elite_wolf");
    expect(e.name).toBe("精英狼王");
    expect(e.hp).toBe(150);
    expect(e.maxHp).toBe(150);
    expect(e.atk).toBe(13);
    expect(e.def).toBe(5);
    expect(e.rewardCoins).toBe(40);
  });
});

describe("assignPersonalGoals / checkPersonalGoal（BOSS 個人目標）", () => {
  it("依人數分配（2~8 人取前 N 個）", () => {
    expect(assignPersonalGoals(2).map((g) => g.id)).toEqual(["red2", "bull1"]);
    expect(assignPersonalGoals(4).map((g) => g.id)).toEqual(["red2", "bull1", "total35", "hi3"]);
    expect(assignPersonalGoals(8).map((g) => g.id)).toEqual(["red2", "bull1", "total35", "hi3", "total30", "hi4", "red1x", "noMiss"]);
  });
  it("red2：至少 2 支 ≥8", () => {
    expect(checkPersonalGoal("red2", [8, 7, 8])).toBe(true);
    expect(checkPersonalGoal("red2", [8, 7, 7])).toBe(false);
  });
  it("bull1：至少 1 支 10 或 X(11)", () => {
    expect(checkPersonalGoal("bull1", [5, 10, 5])).toBe(true);
    expect(checkPersonalGoal("bull1", [5, 11, 5])).toBe(true);
    expect(checkPersonalGoal("bull1", [5, 9, 5])).toBe(false);
  });
  it("total35：本回合總分 ≥ 35", () => {
    expect(checkPersonalGoal("total35", [6, 6, 6, 6, 6, 6])).toBe(true); // 36
    expect(checkPersonalGoal("total35", [6, 6, 6, 6, 5, 5])).toBe(false); // 34
  });
  it("hi3：至少 3 支 ≥6", () => {
    expect(checkPersonalGoal("hi3", [6, 7, 6, 1, 1, 1])).toBe(true);
    expect(checkPersonalGoal("hi3", [6, 7, 5, 1, 1, 1])).toBe(false);
  });
  it("total30：本回合總分 ≥ 30", () => {
    expect(checkPersonalGoal("total30", [5, 5, 5, 5, 5, 5])).toBe(true);
    expect(checkPersonalGoal("total30", [5, 5, 5, 5, 4, 4])).toBe(false); // 28
  });
  it("hi4：至少 4 支 ≥5", () => {
    expect(checkPersonalGoal("hi4", [5, 6, 7, 5, 1, 1])).toBe(true);
    expect(checkPersonalGoal("hi4", [5, 6, 7, 4, 1, 1])).toBe(false);
  });
  it("red1x：至少 1 支 ≥9", () => {
    expect(checkPersonalGoal("red1x", [9, 1, 1, 1, 1, 1])).toBe(true);
    expect(checkPersonalGoal("red1x", [8, 8, 8, 1, 1, 1])).toBe(false);
  });
  it("noMiss：不脫靶（全部 ≥1）", () => {
    expect(checkPersonalGoal("noMiss", [5, 5, 5, 5, 5, 5])).toBe(true);
    expect(checkPersonalGoal("noMiss", [5, 5, 5, 5, 5, 0])).toBe(false);
  });
  it("未知目標一律達成（防呆）", () => {
    expect(checkPersonalGoal("nope", [0, 0, 0])).toBe(true);
  });
  it("goalSpotStyle：每個目標都有圈色/大小/加成，未知給中性灰", () => {
    const red = goalSpotStyle("red2");
    expect(red.color).toBe("#f87171");
    expect(red.size).toBeGreaterThan(0);
    expect(red.bonus).toBeGreaterThan(1);
    const g = goalSpotStyle("nope");
    expect(g.color).toBe("#94a3b8");
  });
  it("8 人各有不同圈色（人越多圈越多）", () => {
    const goals = assignPersonalGoals(8);
    const colors = new Set(goals.map((g) => goalSpotStyle(g.id).color));
    expect(colors.size).toBeGreaterThanOrEqual(4); // 至少 4 種顏色
  });
  it("assignPersonalGoals：每個圈有靶面位置（座標/半徑）", () => {
    const goals = assignPersonalGoals(3);
    expect(goals).toHaveLength(3);
    goals.forEach((g) => {
      expect(g.pos).toBeDefined();
      expect(typeof g.pos.cx).toBe("number");
      expect(typeof g.pos.cy).toBe("number");
      expect(g.pos.radius).toBeGreaterThan(0);
    });
  });
  it("rollBossRings：圈不重疊且整個在靶內（8 人）", () => {
    const rings = rollBossRings(8, (() => { let s = 42; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })());
    expect(rings).toHaveLength(8);
    for (let i = 0; i < rings.length; i += 1) {
      // 圈心 + 半徑 ≤ 靶緣（整個圈在靶內）
      expect(Math.hypot(rings[i].cx, rings[i].cy) + rings[i].radius).toBeLessThanOrEqual(1.01);
      for (let j = i + 1; j < rings.length; j += 1) {
        const d = Math.hypot(rings[i].cx - rings[j].cx, rings[i].cy - rings[j].cy);
        expect(d).toBeGreaterThanOrEqual(rings[i].radius + rings[j].radius - 0.001);
      }
    }
  });
});

describe("checkPersonalGoal（靶面落點）", () => {
  it("落點在圈內 → 達成；圈外 → 未達成", () => {
    const ring = { cx: 0, cy: 0, radius: 0.2 };
    expect(checkPersonalGoal("red2", [{ nx: 0.1, ny: 0.05 }], ring)).toBe(true);
    expect(checkPersonalGoal("red2", [{ nx: 0.5, ny: 0.5 }], ring)).toBe(false);
    // 多支箭：至少一支在圈內即達成
    expect(checkPersonalGoal("red2", [{ nx: 0.9, ny: 0 }, { nx: -0.05, ny: 0 }], ring)).toBe(true);
  });
  it("無落點（記分板數字）→ 退回分數門檻（向後相容）", () => {
    expect(checkPersonalGoal("red2", [8, 8, 0, 0, 0, 0], { cx: 0, cy: 0, radius: 0.2 })).toBe(true);
    expect(checkPersonalGoal("bull1", [8, 8, 8, 8, 8, 8], { cx: 0, cy: 0, radius: 0.2 })).toBe(false);
  });
  it("混 null（未填箭格）不會崩潰：圈內有箭即達成", () => {
    const ring = { cx: 0, cy: 0, radius: 0.2 };
    expect(checkPersonalGoal("red2", [null, null, { nx: 0.1, ny: 0 }, null, null, null], ring)).toBe(true);
    expect(checkPersonalGoal("red2", [null, null, { nx: 0.9, ny: 0.9 }, null, null, null], ring)).toBe(false);
  });
});

describe("resolveTeamBossRound（BOSS 戰：團隊目標＋個人目標＋士氣）", () => {
  const boss = { id: "king", name: "森林魔王", hp: 300, maxHp: 300, def: 5 };
  const baseRoom = (over = {}) => ({
    monster: boss,
    monsterHp: 300,
    spirit: TEAM_BOSS_SPIRIT_START,
    teamGoals: { teamMin: Math.round(TEAM_BOSS_TEAM_MIN * 1), personal: assignPersonalGoals(2), atkBuff: 1 },
    ...over,
  });
  it("團隊目標達成 → 打斷大招（傷害 ×1.5）＋士氣不扣", () => {
    const room = baseRoom({ teamGoals: { teamMin: 50, personal: assignPersonalGoals(2), atkBuff: 1 } });
    const players = [
      { visitorId: "a", nickname: "A", roundScore: 30, roundHits: 4, roundArrows: [8, 8, 8, 8, 8, 8], personalGoalId: "red2" },
      { visitorId: "b", nickname: "B", roundScore: 30, roundHits: 4, roundArrows: [8, 8, 8, 8, 8, 8], personalGoalId: "bull1" },
    ];
    const r = resolveTeamBossRound(room, players);
    expect(r.totalScore).toBe(60);
    expect(r.teamInterrupted).toBe(true);
    expect(r.spirit).toBe(TEAM_BOSS_SPIRIT_START); // 不扣
    expect(r.dmg).toBeGreaterThan(0);
    expect(r.log.some((l) => /打斷大招/.test(l.text))).toBe(true);
  });
  it("沒打斷大招 → 士氣 -25；個人沒達成 → 傷害減半", () => {
    const room = baseRoom({ teamGoals: { teamMin: 90, personal: assignPersonalGoals(2), atkBuff: 1 } });
    const players = [
      { visitorId: "a", nickname: "A", roundScore: 30, roundHits: 4, roundArrows: [8, 8, 8, 8, 8, 8], personalGoalId: "red2" },
      { visitorId: "b", nickname: "B", roundScore: 30, roundHits: 4, roundArrows: [5, 5, 5, 5, 5, 5], personalGoalId: "bull1" },
    ];
    const r = resolveTeamBossRound(room, players);
    expect(r.teamInterrupted).toBe(false);
    expect(r.spirit).toBe(TEAM_BOSS_SPIRIT_START - 25);
    // A 命中（red2 ×1.6）、B 沒中（bull1 → 減半）
    const a = r.perPlayer.find((x) => x.visitorId === "a");
    const b = r.perPlayer.find((x) => x.visitorId === "b");
    expect(a.met).toBe(true);
    expect(b.met).toBe(false);
    expect(b.dmg).toBeLessThan(a.dmg);
  });
  it("士氣歸零不再單獨團滅；Boss 大招扣光全員 HP 才 defeat", () => {
    const room = baseRoom({ monster: { ...boss, atk: 10 }, spirit: 20, teamGoals: { teamMin: 999, personal: assignPersonalGoals(2), atkBuff: 1 } });
    const players = [
      { visitorId: "a", nickname: "A", hp: 5, alive: true, roundScore: 5, roundHits: 1, roundArrows: [5, 0, 0, 0, 0, 0], personalGoalId: "red2" },
      { visitorId: "b", nickname: "B", hp: 5, alive: true, roundScore: 5, roundHits: 1, roundArrows: [5, 0, 0, 0, 0, 0], personalGoalId: "bull1" },
    ];
    const r = resolveTeamBossRound(room, players);
    expect(r.defeat).toBe(true);
    expect(r.victory).toBe(false);
    expect(r.spirit).toBe(0);
  });
  it("寶箱路 atkBuff 會放大傷害", () => {
    const room = baseRoom({ teamGoals: { teamMin: 50, personal: assignPersonalGoals(2), atkBuff: 1.2 } });
    const players = [
      { visitorId: "a", nickname: "A", roundScore: 30, roundHits: 4, roundArrows: [8, 8, 8, 8, 8, 8], personalGoalId: "red2" },
      { visitorId: "b", nickname: "B", roundScore: 30, roundHits: 4, roundArrows: [8, 8, 8, 8, 8, 8], personalGoalId: "bull1" },
    ];
    const buffed = resolveTeamBossRound(room, players);
    const normal = resolveTeamBossRound(baseRoom({ teamGoals: { teamMin: 50, personal: assignPersonalGoals(2), atkBuff: 1 } }), players);
    expect(buffed.dmg).toBeGreaterThan(normal.dmg);
  });
  it("命中弱點圈：傷害 × 圈加成；沒命中：減半", () => {
    const room = baseRoom({ teamGoals: { teamMin: 90, personal: assignPersonalGoals(2), atkBuff: 1 } });
    const players = [
      { visitorId: "a", nickname: "A", roundScore: 40, roundHits: 6, roundArrows: [8, 8, 8, 8, 8, 8], personalGoalId: "red2" }, // 命中 → ×1.6
      { visitorId: "b", nickname: "B", roundScore: 40, roundHits: 6, roundArrows: [5, 5, 5, 5, 5, 5], personalGoalId: "bull1" }, // 沒中 → 減半
    ];
    const r = resolveTeamBossRound(room, players);
    const a = r.perPlayer.find((x) => x.visitorId === "a");
    const b = r.perPlayer.find((x) => x.visitorId === "b");
    expect(a.met).toBe(true);
    expect(b.met).toBe(false);
    expect(a.spotColor).toBe("#f87171");
    // A 命中：raw × 1.6；B 沒中：raw/2（同分所以 B ≈ A/3.2）
    expect(b.dmg).toBeLessThan(a.dmg);
    expect(r.log.some((l) => /命中弱點圈/.test(l.text))).toBe(true);
    expect(r.log.some((l) => /沒射中弱點圈/.test(l.text))).toBe(true);
  });
  it("靶面落點：射進自己的圈 → 弱點命中（傷害加成＋每支進圈再疊）；沒進 → 減半", () => {
    // 固定位置的圈：A 的圈在中心（radius .1）、B 的圈偏右（radius .13）
    const personal = [
      { id: "red2", desc: "射進你的圈！", color: "#f87171", bonus: 1.6, dmgPct: 0.004, pos: { cx: 0, cy: 0, radius: 0.10 } },
      { id: "bull1", desc: "射進你的圈！", color: "#fb923c", bonus: 1.5, dmgPct: 0.003, pos: { cx: 0.5, cy: 0, radius: 0.13 } },
    ];
    const room = baseRoom({ teamGoals: { teamMin: 999, personal, atkBuff: 1 } });
    const players = [
      { visitorId: "a", nickname: "A", roundScore: 40, roundHits: 6, roundArrows: [{ nx: 0.05, ny: 0.02 }, { nx: 0.04, ny: -0.03 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }], personalGoalId: "red2" }, // 2 支進圈
      { visitorId: "b", nickname: "B", roundScore: 40, roundHits: 6, roundArrows: [{ nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }], personalGoalId: "bull1" }, // 全在圈外
    ];
    const r = resolveTeamBossRound(room, players);
    const a = r.perPlayer.find((x) => x.visitorId === "a");
    const b = r.perPlayer.find((x) => x.visitorId === "b");
    expect(a.met).toBe(true);
    expect(a.weakHits).toBe(2);
    expect(b.met).toBe(false);
    expect(b.weakHits).toBe(0);
    expect(b.dmg).toBeLessThan(a.dmg);
    expect(r.log.some((l) => /命中弱點圈 ×2/.test(l.text))).toBe(true);
    // 對照：同樣 2 支進圈但只有 1 支（多進圈有 8%/支疊加）→ 傷害應更少
    const p2 = [
      { id: "red2", desc: "射進你的圈！", color: "#f87171", bonus: 1.6, dmgPct: 0.004, pos: { cx: 0, cy: 0, radius: 0.10 } },
      { id: "bull1", desc: "射進你的圈！", color: "#fb923c", bonus: 1.5, dmgPct: 0.003, pos: { cx: 0.5, cy: 0, radius: 0.13 } },
    ];
    const room1 = baseRoom({ teamGoals: { teamMin: 999, personal: p2, atkBuff: 1 } });
    const players1 = [
      { visitorId: "a", nickname: "A", roundScore: 40, roundHits: 6, roundArrows: [{ nx: 0.05, ny: 0.02 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }], personalGoalId: "red2" }, // 1 支進圈
      { visitorId: "b", nickname: "B", roundScore: 40, roundHits: 6, roundArrows: [{ nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }, { nx: 0.9, ny: 0 }], personalGoalId: "bull1" },
    ];
    const r1 = resolveTeamBossRound(room1, players1);
    const a1 = r1.perPlayer.find((x) => x.visitorId === "a");
    expect(a1.weakHits).toBe(1);
    expect(a1.dmg).toBeLessThan(a.dmg);
  });
  it("重連遺失 personalGoalId → 依名單位置還原自己的圈", () => {
    const personal = [
      { id: "red2", desc: "射進你的圈！", color: "#f87171", bonus: 1.6, dmgPct: 0.004, pos: { cx: 0, cy: 0, radius: 0.10 } },
      { id: "bull1", desc: "射進你的圈！", color: "#fb923c", bonus: 1.5, dmgPct: 0.003, pos: { cx: 0.5, cy: 0, radius: 0.13 } },
    ];
    const room = baseRoom({ teamGoals: { teamMin: 999, personal, atkBuff: 1 } });
    // b 沒有 personalGoalId（重連遺失）→ 依位置 index 1 → bull1
    const players = [
      { visitorId: "a", nickname: "A", roundScore: 30, roundHits: 6, roundArrows: [{ nx: 0, ny: 0 }, { nx: 0, ny: 0 }, { nx: 0, ny: 0 }, { nx: 0, ny: 0 }, { nx: 0, ny: 0 }, { nx: 0, ny: 0 }], personalGoalId: "red2" },
      { visitorId: "b", nickname: "B", roundScore: 30, roundHits: 6, roundArrows: [{ nx: 0.51, ny: 0 }, { nx: 0.51, ny: 0 }, { nx: 0.51, ny: 0 }, { nx: 0.51, ny: 0 }, { nx: 0.51, ny: 0 }, { nx: 0.51, ny: 0 }] }, // 無 personalGoalId
    ];
    const r = resolveTeamBossRound(room, players);
    const a = r.perPlayer.find((x) => x.visitorId === "a");
    const b = r.perPlayer.find((x) => x.visitorId === "b");
    expect(a.met).toBe(true);
    expect(b.met).toBe(true); // 依位置拿到 bull1，箭射進 bull1 → 命中
    expect(b.weakHits).toBe(6);
  });
});

describe("resolveTeamRound atkBuff（寶箱路）", () => {
  it("atkBuff 1.2 → 傷害放大", () => {
    const monster = { name: "哥布林", hp: 200, maxHp: 200, def: 0 };
    const players = [{ roundScore: 60, roundHits: 6 }];
    const plain = resolveTeamRound({ monster, monsterHp: 200, atkBuff: 1 }, players);
    const buffed = resolveTeamRound({ monster, monsterHp: 200, atkBuff: 1.2 }, players);
    // atkBuff 1.2 約放大 20%（四捨五入誤差 ±1）
    expect(buffed.dmg).toBeGreaterThan(plain.dmg);
    expect(Math.abs(buffed.dmg - plain.dmg * 1.2)).toBeLessThanOrEqual(1);
  });
});

describe("resolveTeamRound", () => {
  it("總分 × combo − 防禦 = 傷害（12 Hits → TEAM BREAK ×1.5 × 完美 1.5 = ×2.0）", () => {
    const monster = { name: "哥布林", hp: 60, maxHp: 60, def: 0 };
    const room = { monster, monsterHp: 60 };
    const players = [{ roundScore: 60, roundHits: 6 }, { roundScore: 60, roundHits: 6 }];
    const r = resolveTeamRound(room, players);
    expect(r.totalScore).toBe(120);
    expect(r.dmg).toBe(240); // 120 × 2.0
    expect(r.monsterHp).toBe(0);
    expect(r.victory).toBe(true);
    expect(r.log.length).toBeGreaterThan(0);
  });
  it("防禦會扣傷害（6 Hits ×1.25 × 完美 1.5 = ×1.875 → 113 − 5 = 108）", () => {
    const monster = { name: "龜", hp: 100, maxHp: 100, def: 5 };
    const room = { monster, monsterHp: 100 };
    const players = [{ roundScore: 30, roundHits: 3 }, { roundScore: 30, roundHits: 3 }];
    const r = resolveTeamRound(room, players);
    expect(r.dmg).toBe(108);
  });
});

describe("teamGrade", () => {
  it("4 殺全通 → S", () => {
    expect(teamGrade(4).grade).toBe("S");
    expect(teamGrade(3).grade).toBe("A");
    expect(teamGrade(2).grade).toBe("B");
    expect(teamGrade(1).grade).toBe("C");
    expect(teamGrade(0).grade).toBe("C");
  });
});

describe("心跳／逾時清理（M3.1）", () => {
  it("isStaleAt：沒心跳或超過時限 → 離線", () => {
    const now = 1_000_000;
    expect(isStaleAt(null, now, PLAYER_STALE_MS)).toBe(true);
    expect(isStaleAt(now - 10_000, now, PLAYER_STALE_MS)).toBe(false);
    expect(isStaleAt(now - PLAYER_STALE_MS - 1, now, PLAYER_STALE_MS)).toBe(true);
    expect(isStaleAt(now - HOST_STALE_MS + 1, now, HOST_STALE_MS)).toBe(false);
  });
  it("pruneStaleRoster：把離線玩家分離出來", () => {
    const now = 2_000_000;
    const roster = {
      a: { visitorId: "a", lastAt: now - 5_000 },
      b: { visitorId: "b", lastAt: now - PLAYER_STALE_MS - 60_000 },
      c: { visitorId: "c", lastAt: null },
    };
    const { active, removed } = pruneStaleRoster(roster, now, PLAYER_STALE_MS);
    expect(active.map((p) => p.visitorId)).toEqual(["a"]);
    expect(removed.map((p) => p.visitorId)).toEqual(["b", "c"]);
  });
  it("pruneStaleRoster：全部離線 → active 為空", () => {
    const now = 3_000_000;
    const { active, removed } = pruneStaleRoster({ x: { lastAt: 0 } }, now, PLAYER_STALE_MS);
    expect(active).toHaveLength(0);
    expect(removed).toHaveLength(1);
  });
});
