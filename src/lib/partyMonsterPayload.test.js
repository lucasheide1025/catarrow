// 迴歸測試（2026-07-19）：組隊打怪「點開始戰鬥沒反應」的根因。
// startPartyBattle 寫入的 monster 物件若有任何欄位是 undefined，Firestore 會拒絕整筆寫入
// （invalid-argument / HTTP 400），畫面上只表現為「沒反應」。
// 舊的 60 隻怪沒有 tierIndex / encounter / signature* 等擴充欄位，最容易踩到。
//
// 這裡直接複製 partyDb 寫入時的欄位組法來驗證「不得產生 undefined」；
// 若日後有人在 partyDb 新增欄位卻忘了預設值，請同步更新此測試。
import { MONSTERS } from "./monsterData";
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { toLegacyBattleMonster } from "./monsterExpansionAdapter";
import { getMonsterScheduledAbility } from "./monsterSkillSchedule";

function buildMonsterPayload(monster, scaledHP = 100) {
  return {
    id: monster.id, name: monster.name, icon: monster.icon || "👾",
    hp: scaledHP,
    atk: Math.round(monster.atk || 0),
    def: Math.round(monster.def || 0),
    tier: monster.tier || "common",
    tierIndex: monster.tierIndex ?? null,
    family: monster.family || null,
    encounter: monster.encounter || null,
    signatureSkillId: monster.signatureSkillId || null,
    signatureName: monster.signatureName || null,
    signatureSummary: monster.signatureSummary || null,
    commonSkillIds: monster.commonSkillIds || [],
    expansionVersion: monster.expansionVersion || 0,
  };
}

function undefinedFields(payload) {
  return Object.entries(payload).filter(([, value]) => value === undefined).map(([key]) => key);
}

describe("組隊打怪寫入的怪物欄位不得有 undefined", () => {
  test("舊 60 隻怪（無擴充欄位）", () => {
    expect(MONSTERS.length).toBeGreaterThan(0);
    for (const monster of MONSTERS) {
      expect(undefinedFields(buildMonsterPayload(monster))).toEqual([]);
    }
  });

  test("252 隻擴充怪", () => {
    for (const monster of EXPANSION_MONSTERS) {
      expect(undefinedFields(buildMonsterPayload(toLegacyBattleMonster(monster)))).toEqual([]);
    }
  });

  test("極端情況：只有 id/name 的殘缺怪物也不能產生 undefined", () => {
    expect(undefinedFields(buildMonsterPayload({ id: "x", name: "殘缺" }))).toEqual([]);
  });
});

// monsterAbilityPreview 也會寫進 partyRooms，同樣不能有 undefined。
// 房間裡的怪物是精簡快照，不保證帶齊 signatureSummary / counterSummary。
describe("技能預告寫入的欄位不得有 undefined", () => {
  const deepUndefined = (obj, path = "") => {
    if (obj === undefined) return [path];
    if (obj === null || typeof obj !== "object") return [];
    return Object.entries(obj).flatMap(([k, v]) => deepUndefined(v, path ? `${path}.${k}` : k));
  };

  test("房間快照缺 summary/counterSummary 時仍安全", () => {
    const snapshot = {
      id: "ghost_t1_normal_a", name: "提燈小靈",
      signatureSkillId: "sig_ghost_t1_normal_a", signatureName: "引燈閃身",
      commonSkillIds: ["common_weaken"], tierIndex: 1, encounter: "normal",
      // 刻意不給 signatureSummary / counterSummary
    };
    for (const round of [2, 4, 6, 8]) {
      const preview = getMonsterScheduledAbility(snapshot, round);
      if (!preview) continue;
      expect(deepUndefined(preview)).toEqual([]);
    }
  });

  test("完整的擴充怪也不會有 undefined", () => {
    for (const monster of EXPANSION_MONSTERS.slice(0, 60)) {
      const view = toLegacyBattleMonster(monster);
      for (const round of [2, 4, 6]) {
        const preview = getMonsterScheduledAbility(view, round);
        if (preview) expect(deepUndefined(preview)).toEqual([]);
      }
    }
  });
});
