// src/lib/worldBossSkillData.test.js — 24 王技能資料完整性（spec 測試矩陣 #7 / PRD 17/22-26）
import { WORLD_BOSSES, WORLD_BOSS_KEYS } from "./worldBossData";
import { WORLD_BOSS_SKILLS, getWorldBossSkillConfig } from "./worldBossSkillData";
import {
  validateWorldBossSkillConfig,
  WB_SMALL_STRIKE_MULTIPLIER,WB_SMALL_FINISHER_MULTIPLIER,WB_BIG_STRIKE_MULTIPLIER,WB_BIG_FINISHER_MULTIPLIER,WB_CAT_STRIKE_MULTIPLIER,WB_CAT_FINISHER_MULTIPLIER,WB_COACH_STRIKE_MULTIPLIER,WB_COACH_FINISHER_MULTIPLIER,
} from "./worldBossStrikeEngine";

test("24 隻世界王每隻都有技能設定,無多餘 key", () => {
  expect(Object.keys(WORLD_BOSS_SKILLS).sort()).toEqual([...WORLD_BOSS_KEYS].sort());
  expect(WORLD_BOSS_KEYS).toHaveLength(26);
});

test("每王 config 通過引擎驗證（倍率/R4 無異常/可擊倒 flag/counterText）", () => {
  for (const key of WORLD_BOSS_KEYS) {
    const result = validateWorldBossSkillConfig(WORLD_BOSS_SKILLS[key]);
    expect({ key, ...result }).toEqual({ key, ok: true, errors: [] });
  }
});

test("48 個 skillId 全域唯一", () => {
  const ids = Object.values(WORLD_BOSS_SKILLS).flatMap(c => [c.r2Strike.skillId, c.r4Finisher.skillId]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(52);
});

test("倍率分級依小王／大王／貓貓／教練四級遞增", () => {
  for (const key of WORLD_BOSS_KEYS) {
    const boss = WORLD_BOSSES[key];
    const cfg = WORLD_BOSS_SKILLS[key];
    const isFamily = boss.family !== "coach" && !key.startsWith("cat_");
    expect({ key, cls: cfg.bossClass }).toEqual({ key, cls: isFamily ? "family" : "prime" });
    const pair=boss.family==="coach"?[WB_COACH_STRIKE_MULTIPLIER,WB_COACH_FINISHER_MULTIPLIER]:boss.family==="cat"?[WB_CAT_STRIKE_MULTIPLIER,WB_CAT_FINISHER_MULTIPLIER]:boss.familyTier==="small"?[WB_SMALL_STRIKE_MULTIPLIER,WB_SMALL_FINISHER_MULTIPLIER]:[WB_BIG_STRIKE_MULTIPLIER,WB_BIG_FINISHER_MULTIPLIER];
    expect([cfg.r2Strike.baseMultiplier,cfg.r4Finisher.baseMultiplier]).toEqual(pair);
  }
});

test("PRD 逐條抽查：師母穿甲25/妞妞破盾30/大娘回復-25/顛顛屏障-20/蜈蚣毒1%", () => {
  expect(WORLD_BOSS_SKILLS.wife.r2Strike.armorPiercePct).toBe(25);
  expect(WORLD_BOSS_SKILLS.cat_niuniu.r2Strike.shieldPiercePct).toBe(30);
  expect(WORLD_BOSS_SKILLS.cat_daming.r2Strike.status).toMatchObject({ effect: "healDownPct", strength: 25, duration: 1 });
  expect(WORLD_BOSS_SKILLS.cat_diandian.r2Strike.status).toMatchObject({ effect: "dealtDownPct", strength: 20 });
  expect(WORLD_BOSS_SKILLS.poison_boss_small.r2Strike.status).toMatchObject({ effect: "dotMaxHpPct", strength: 1, duration: 1 });
  // 多段演出：哈吉2段/YUMI3段（合計傷害不變）
  expect(WORLD_BOSS_SKILLS.cat_haji.r2Strike.hits).toBe(2);
  expect(WORLD_BOSS_SKILLS.yumi.r2Strike.hits).toBe(3);
});

test("getWorldBossSkillConfig：未知 key 回 null", () => {
  expect(getWorldBossSkillConfig("nope")).toBeNull();
  expect(getWorldBossSkillConfig("head_coach")).toBe(WORLD_BOSS_SKILLS.head_coach);
});
