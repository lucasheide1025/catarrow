import { playCatVoice, CAT_VOICE_IDS, CAT_VOICE_KINDS } from "./arcadeCatVoice";
import { ARCADE_CATS } from "./arcadeData";

describe("arcadeCatVoice — 九貓專屬喵叫", () => {
  test("九隻貓都有語音設定（id 完整對應）", () => {
    expect(CAT_VOICE_IDS.length).toBe(9);
    expect(new Set(CAT_VOICE_IDS).size).toBe(9);
    for (const c of ARCADE_CATS) {
      expect(CAT_VOICE_IDS).toContain(c.id);
    }
  });

  test("五種情境語調齊全：atk / heal / def / rescue / weak", () => {
    expect(CAT_VOICE_KINDS.sort()).toEqual(["atk", "def", "heal", "rescue", "weak"]);
  });

  test("沒有音訊環境（jsdom）時呼叫不會拋錯", () => {
    expect(() => playCatVoice("haji", "atk")).not.toThrow();
    expect(() => playCatVoice("meimei", "heal")).not.toThrow();
    expect(() => playCatVoice("diandian", "def")).not.toThrow();
    expect(() => playCatVoice("baobao", "rescue")).not.toThrow();
    // 弱點圈命中：興奮喵叫
    expect(() => playCatVoice("haji", "weak")).not.toThrow();
    expect(() => playCatVoice("meimei", "weak")).not.toThrow();
    // 未知貓咪／未知情境也會安全降級
    expect(() => playCatVoice("nope", "nope")).not.toThrow();
  });
});
