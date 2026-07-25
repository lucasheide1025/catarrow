// src/guild/domain/guildContracts.test.js
import {
  rollDailyContracts, contractRewardPreview, contractMonsterPreview, todayKey,
  contractsStateFor, isContractDone, markContractDone,
} from "./guildContracts";
import { expeditionMonsterPool } from "./rollExpedition";
import { emptyGuildProfile, normalizeGuildProfile } from "./guildRewards";
import { CONTRACTS_PER_DAY } from "../data/guildContractPool";
import { canAcceptDanger } from "./guildRank";

const DAY = "2026-07-25";

describe("每日委託板", () => {
  test("固定張數，欄位齊全（委託人/故事/族群/波數）", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    expect(list).toHaveLength(CONTRACTS_PER_DAY);
    for (const c of list) {
      expect(c.id).toContain(DAY);
      expect(c.client.name).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.story).toBeTruthy();
      expect(c.familyLabel).toBeTruthy();
      expect(c.waves).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(c.danger);
    }
  });

  test("同一天同一人 → 完全一樣（重整不能刷新委託）", () => {
    const a = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    const b = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    expect(b).toEqual(a);
  });

  test("換人或換日 → 不一樣（各自的委託板、每天換一批）", () => {
    const mine = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    const others = rollDailyContracts({ dateKey: DAY, memberId: "m2" });
    const tomorrow = rollDailyContracts({ dateKey: "2026-07-26", memberId: "m1" });
    expect(others).not.toEqual(mine);
    expect(tomorrow).not.toEqual(mine);
  });

  test("危險度分佈固定：低階玩家永遠有事做，也永遠看得到接不了的那張", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    const dangers = list.map(c => c.danger);
    expect(dangers.filter(d => d === 1).length).toBeGreaterThanOrEqual(1);
    expect(dangers.some(d => d === 3)).toBe(true);
    // 見習（rep 0）至少接得到一張、也至少有一張接不到
    expect(list.some(c => canAcceptDanger(0, c.danger))).toBe(true);
    expect(list.some(c => !canAcceptDanger(0, c.danger))).toBe(true);
  });

  test("多元種族：例行單族、緊急必混族，且族群不重複", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    for (const c of list) {
      expect(c.families.length).toBeGreaterThanOrEqual(1);
      expect(new Set(c.families).size).toBe(c.families.length);   // 不重複
      expect(c.families[0]).toBe(c.family);                        // 主族排第一（決定故事/底圖）
      expect(c.familyTags).toHaveLength(c.families.length);
      if (c.danger === 1) expect(c.families).toHaveLength(1);
      if (c.danger === 3) expect(c.families.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("標註怪物階級 T 幾（危險度越高階級越高）", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    const low = list.find(c => c.danger === 1);
    const high = list.find(c => c.danger === 3);
    expect(low.tiers.map(t => t.tierNo)).toEqual([1, 2]);          // 普通/稀有
    expect(Math.max(...high.tiers.map(t => t.tierNo))).toBeGreaterThan(Math.max(...low.tiers.map(t => t.tierNo)));
    for (const t of high.tiers) expect(t.label).toBeTruthy();
  });

  test("怪物預覽＝實際抽怪同一份池（預覽不騙人），且只出現該委託的族群與階級", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    for (const c of list) {
      const preview = contractMonsterPreview(c);
      expect(preview.length).toBe(expeditionMonsterPool(c).length);
      const tierKeys = c.tiers.map(t => t.key);
      for (const m of preview) {
        expect(c.families).toContain(m.family);
        expect(tierKeys).toContain(m.tier);
        expect(m.tierNo).toBeGreaterThan(0);
      }
      // 依階級排序（低到高）
      const nos = preview.map(m => m.tierNo);
      expect([...nos].sort((a, b) => a - b)).toEqual(nos);
    }
  });

  test("混族委託的材料標籤要講清楚會混幾族", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    const mixed = list.find(c => c.families.length > 1);
    expect(contractRewardPreview(mixed).materialLabel).toContain("族材料");
  });

  test("獎勵預覽跟著危險度走", () => {
    const list = rollDailyContracts({ dateKey: DAY, memberId: "m1" });
    const low = contractRewardPreview(list.find(c => c.danger === 1));
    const high = contractRewardPreview(list.find(c => c.danger === 3));
    expect(high.coins).toBeGreaterThan(low.coins);
    expect(high.catCoins).toBeGreaterThan(low.catCoins);
    expect(high.equipChancePct).toBeGreaterThan(low.equipChancePct);
    expect(low.materialLabel).toContain("材料");
  });

  test("todayKey 是本地日期（不用 UTC，免得半夜換板）", () => {
    expect(todayKey(new Date(2026, 6, 25))).toBe("2026-07-25");
  });
});

describe("委託結案紀錄", () => {
  test("新玩家沒有紀錄", () => {
    expect(contractsStateFor(emptyGuildProfile(), DAY).done).toEqual([]);
    expect(isContractDone(emptyGuildProfile(), `${DAY}-0`, DAY)).toBe(false);
  });

  test("結案後當天不能再接", () => {
    const p = markContractDone(emptyGuildProfile(), `${DAY}-0`, DAY);
    expect(isContractDone(p, `${DAY}-0`, DAY)).toBe(true);
    expect(isContractDone(p, `${DAY}-1`, DAY)).toBe(false);
  });

  test("同一張重複結案不會塞兩筆", () => {
    let p = markContractDone(emptyGuildProfile(), `${DAY}-0`, DAY);
    p = markContractDone(p, `${DAY}-0`, DAY);
    expect(p.contracts.done).toEqual([`${DAY}-0`]);
  });

  test("跨日自動換板：昨天的紀錄不影響今天", () => {
    const p = markContractDone(emptyGuildProfile(), `${DAY}-0`, DAY);
    expect(contractsStateFor(p, "2026-07-26").done).toEqual([]);
    expect(isContractDone(p, `${DAY}-0`, "2026-07-26")).toBe(false);
  });

  test("存檔正規化：壞資料不會炸", () => {
    expect(normalizeGuildProfile({ contracts: "x" }).contracts).toBeNull();
    expect(normalizeGuildProfile({ contracts: { dateKey: DAY, done: [1, "a"] } }).contracts.done).toEqual(["a"]);
  });

  test("純函數：不修改傳入的存檔", () => {
    const before = emptyGuildProfile();
    markContractDone(before, `${DAY}-0`, DAY);
    expect(before.contracts).toBeNull();
  });
});
