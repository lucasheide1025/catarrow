// 組隊寫入前的 undefined 過濾器（2026-07-19）。
// 這類 bug 已重複三次：房間快照＋多個引擎組出的巢狀物件，只要漏一個預設值就整筆寫入失敗
// （Unsupported field value: undefined），玩家看到「送出分數跳紅字」。
import { arrayUnion, serverTimestamp, increment } from "firebase/firestore";
import { stripUndefinedDeep } from "./firestoreSafeWrite";

describe("stripUndefinedDeep", () => {
  test("移除巢狀 undefined，保留 null 與 0/空字串", () => {
    const input = {
      a: 1, b: undefined, c: null, d: 0, e: "",
      nested: { x: undefined, y: "keep", deeper: { z: undefined, w: false } },
    };
    expect(stripUndefinedDeep(input)).toEqual({
      a: 1, c: null, d: 0, e: "",
      nested: { y: "keep", deeper: { w: false } },
    });
  });

  test("重現實際 bug：技能預告缺 counterSummary 也能安全寫入", () => {
    const payload = {
      monsterAbilityPreview: {
        type: "signature", skillId: "sig_x", name: "引燈閃身",
        summary: undefined, counterSummary: undefined, round: 4, targetId: null,
      },
    };
    const out = stripUndefinedDeep(payload);
    expect(out.monsterAbilityPreview).toEqual({
      type: "signature", skillId: "sig_x", name: "引燈閃身", round: 4, targetId: null,
    });
    expect(JSON.stringify(out).includes("undefined")).toBe(false);
  });

  test("陣列內的物件也會被處理", () => {
    expect(stripUndefinedDeep({ list: [{ a: undefined, b: 1 }, { c: 2 }] }))
      .toEqual({ list: [{ b: 1 }, { c: 2 }] });
  });

  test("⚠️ 不可破壞 Firestore sentinel（展開它們會讓寫入失效）", () => {
    const union = arrayUnion({ round: 1 });
    const stamp = serverTimestamp();
    const inc = increment(3);
    const out = stripUndefinedDeep({ log: union, updatedAt: stamp, coins: inc });
    expect(out.log).toBe(union);
    expect(out.updatedAt).toBe(stamp);
    expect(out.coins).toBe(inc);
  });
});
