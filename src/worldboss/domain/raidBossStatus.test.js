// 世界王：玩家對王施加的異常（2026-08-03）
//
// ⚠️ 接在 resolveRaidRound 裡，所以**單人（本機算）與組隊（房主算）一次到位**。
//    如果只接在畫面端，組隊時 previewDamage=false 永遠不會觸發——
//    那正是「卡片效果只有單人有用」的成因。
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOT_MAP } from "./weakPoints";

const boss = { key: "t", name: "測試王", hp: 500000, maxHp: 500000, atk: 1, def: 200 };
const member = (id, inflict = {}) => ({
  memberId: id, name: id, stats: { atk: 200, def: 60, hp: 9999 }, cats: [], inflict,
});
const state = (members, over = {}) => ({
  ...createRaidState({ boss, members }),
  spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k" }],
  ...over,
});
const shots = (id, n = 3) => Array.from({ length: n }, () => ({ memberId: id, nx: 0, ny: 0, score: 10 }));
// ⚠️ 觸發率有上限（PROC_CAP 35%／控場 12%），chancePct 寫 100 也會被夾。
//    要測「一定觸發」就得注入亂數源，不能靠機率碰運氣。
const always = () => 0;

describe("玩家對世界王施加異常", () => {
  test("射中弱點就施加，並寫進 log", () => {
    const st = state([member("a", { poison: { chancePct: 100, strength: 4, duration: 3 } })]);
    const { state: after, log } = resolveRaidRound({ state: st, arrows: shots("a"), rand: always });
    expect(after.bossStatuses.some(s => s.id === "poison")).toBe(true);
    expect(log.some(e => e.type === "statusInflict")).toBe(true);
  });

  test("⚠️ 全隊的施加合併到同一隻王身上——組隊的合作價值", () => {
    const st = state([
      member("a", { poison: { chancePct: 100, strength: 4, duration: 3 } }),
      member("b", { burn: { chancePct: 100, strength: 20, duration: 2 } }),
    ]);
    const { state: after } = resolveRaidRound({ state: st, arrows: [...shots("a"), ...shots("b")], rand: always });
    const ids = after.bossStatuses.map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(["poison", "burn"]));
  });

  test("🔨 破防會削低王的防禦——同樣的箭打得比較痛", () => {
    // ⚠️ 傷害有隨機浮動（attackDamageVariance 用真的 Math.random），
    //    單箭比較會偶發翻盤。取多次平均才是穩定的斷言。
    const avg = statuses => {
      let total = 0;
      for (let i = 0; i < 20; i += 1) {
        total += resolveRaidRound({
          state: state([member("a")], { bossStatuses: statuses }),
          arrows: shots("a", 6), rand: always,
        }).state.totals.damage;
      }
      return total / 20;
    };
    expect(avg([{ id: "defBreak", strength: 40, duration: 2 }])).toBeGreaterThan(avg([]));
  });

  test("回合末持續傷害會扣王的血並記進總傷害", () => {
    const st = state([member("a")], { bossStatuses: [{ id: "burn", strength: 50, duration: 2 }] });
    const { state: after, log } = resolveRaidRound({ state: st, arrows: [] });
    expect(after.bossHp).toBeLessThan(st.bossHp);
    expect(log.some(e => e.type === "statusTick")).toBe(true);
  });

  test("異常會帶到下一回合並倒數", () => {
    const st = state([member("a", { poison: { chancePct: 100, strength: 3, duration: 3 } })]);
    const r1 = resolveRaidRound({ state: st, arrows: shots("a"), rand: always });
    const p1 = r1.state.bossStatuses.find(s => s.id === "poison");
    const r2 = resolveRaidRound({ state: r1.state, arrows: [], rand: always });
    const p2 = r2.state.bossStatuses.find(s => s.id === "poison");
    expect(p2.duration).toBeLessThan(p1.duration);
  });

  test("沒帶卡片的人不會憑空施加", () => {
    const { state: after } = resolveRaidRound({ state: state([member("a")]), arrows: shots("a"), rand: always });
    expect(after.bossStatuses).toEqual([]);
  });

  test("組隊房間的成員資料帶得進 inflict（rosterFromRoom 形狀）", () => {
    const st = createRaidState({
      boss,
      members: [{ memberId: "a", name: "甲", stats: { atk: 100, def: 50, hp: 100 }, inflict: { burn: { chancePct: 50 } } }],
    });
    expect(st.members[0].inflict.burn).toBeTruthy();
  });
});
