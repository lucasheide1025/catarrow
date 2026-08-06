import {
  EFFECT_DISPLAY,
  describeAllStatuses,
  describeInflict,
  describeStatusFormula,
  describeStatusProcRule,
} from "./cardTalentDisplay";
import { TALENT_CAPS } from "./cardTalents";
import { MONSTER_STATUS_LIST } from "./monsterStatus";

describe("卡片效果顯示層", () => {
  test("⚠️ 每個有上限的天賦/套裝鍵都有中文顯示名（防止英文 key 漏進 UI）", () => {
    for (const key of Object.keys(TALENT_CAPS)) {
      // 舊版 Jest 不支援 expect 第二參數,缺鍵時靠下面這行失敗（undefined.name 噴錯）
      expect(EFFECT_DISPLAY[key]).toBeTruthy();
      expect(EFFECT_DISPLAY[key].name).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  test("異常公式從 STATUS_STRENGTH 讀出真實數字", () => {
    expect(describeStatusFormula("poison")).toContain("3%");
    expect(describeStatusFormula("poison")).toContain("不致死");
    expect(describeStatusFormula("burn")).toContain("12%");
    expect(describeStatusFormula("bleed")).toContain("8%");
    expect(describeStatusFormula("weaken")).toContain("ATK");
    expect(describeStatusFormula("defBreak")).toContain("DEF");
    expect(describeStatusFormula("paralyze")).toContain("50%");
    expect(describeStatusFormula("freeze")).toContain("無法放技能");
  });

  test("describeInflict 把 inflict 物件轉成顯示清單（含機率與公式）", () => {
    const list = describeInflict({ poison: { chancePct: 15, strength: 3, duration: 3 } });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("中毒");
    expect(list[0].chancePct).toBe(15);
    expect(list[0].formula).toContain("最大HP");
    expect(describeInflict({})).toHaveLength(0);
    expect(describeInflict(null)).toHaveLength(0);
  });

  test("describeAllStatuses 七種狀態都有公式", () => {
    const all = describeAllStatuses();
    expect(all.length).toBe(MONSTER_STATUS_LIST.length);
    for (const s of all) expect(s.formula.length).toBeGreaterThan(0);
  });

  test("觸發規則說明帶出環數與上限", () => {
    const rule = describeStatusProcRule();
    expect(rule).toContain("9");
    expect(rule).toContain("35%");
    expect(rule).toContain("12%");
  });
});
