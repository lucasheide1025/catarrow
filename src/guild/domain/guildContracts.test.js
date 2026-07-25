// src/guild/domain/guildContracts.test.js
import {
  rollDailyContracts, contractRewardPreview, todayKey,
  contractsStateFor, isContractDone, markContractDone,
} from "./guildContracts";
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
