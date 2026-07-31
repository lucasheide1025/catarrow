// 靶紙與射程「各自決定」（作者 2026-07-31）
// ⚠️ 現場有人射 5 米有人射 18 米，靶紙也不一定一樣。
//    綁成全隊統一，等於逼所有人配合最短的那個人。
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { intentForRound } from "./bossIntent";
import { centerWeakSpots, hitSpot } from "./weakPoints";
import { rangeMultiplier } from "./raidRange";
import { WEAK_SPOT_MAP } from "./weakPoints";

const boss = { key: "t", name: "測試王", hp: 9_000_000, maxHp: 9_000_000, atk: 1, def: 0 };
const member = (id, over = {}) => ({
  memberId: id, name: id, stats: { atk: 100, def: 50, hp: 9999 }, cats: [], ...over,
});

describe("每個人帶自己的靶紙與射程", () => {
  const st = () => createRaidState({
    boss,
    members: [
      member("near", { targetFmt: "half_17", distanceM: 5 }),
      member("far", { targetFmt: "field_16", distanceM: 18 }),
    ],
  });

  test("roster 上各自記著自己的設定", () => {
    const s = st();
    expect(s.members[0].distanceM).toBe(5);
    expect(s.members[0].targetFmt).toBe("half_17");
    expect(s.members[1].distanceM).toBe(18);
    expect(s.members[1].targetFmt).toBe("field_16");
  });

  test("環境倍率各算各的", () => {
    const s = st();
    expect(s.members[0].rangeMult).toBeCloseTo(rangeMultiplier({ distanceM: 5, targetFmt: "half_17" }), 5);
    expect(s.members[1].rangeMult).toBeCloseTo(rangeMultiplier({ distanceM: 18, targetFmt: "field_16" }), 5);
    expect(s.members[1].rangeMult).toBeGreaterThan(s.members[0].rangeMult);
  });

  test("⚠️ 退得遠、靶紙倍率高的人，同樣一箭就是打比較痛", () => {
    const s = { ...st(), spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k" }] };
    const shot = id => ({ memberId: id, nx: 0, ny: 0, score: 10 });
    const { state } = resolveRaidRound({ state: s, arrows: [shot("near"), shot("far")] });
    const near = state.members.find(m => m.memberId === "near").damage;
    const far = state.members.find(m => m.memberId === "far").damage;
    expect(far).toBeGreaterThan(near);
  });

  test("state 上的 targetFmt／距離是「我」的鏡像——畫面畫的是我自己那張靶", () => {
    const s = st();
    expect(s.targetFmt).toBe("half_17");
    expect(s.distanceM).toBe(5);
    expect(s.rangeMult).toBeCloseTo(s.members[0].rangeMult, 5);
  });

  test("沒填就沿用整場的預設（單人與舊資料都還是對的）", () => {
    const s = createRaidState({ boss, members: [member("solo")], targetFmt: "full_110", distanceM: 12 });
    expect(s.members[0].targetFmt).toBe("full_110");
    expect(s.members[0].distanceM).toBe(12);
  });
});

describe("三連靶的每張上限是各自的", () => {
  test("⚠️ 兩個人射同一個 faceIndex 不會互相吃掉額度", () => {
    const s = {
      ...createRaidState({
        boss,
        members: [
          member("a", { targetFmt: "triple" }),
          member("b", { targetFmt: "triple" }),
        ],
      }),
      spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k", faceIndex: 0 }],
    };
    const shots = id => Array.from({ length: 2 }, () => ({ memberId: id, nx: 0, ny: 0, faceIndex: 0, score: 10 }));
    const { log } = resolveRaidRound({ state: s, arrows: [...shots("a"), ...shots("b")] });
    const arrows = log.filter(e => e.type === "arrow");
    expect(arrows).toHaveLength(4);
    expect(arrows.every(e => !e.overCap)).toBe(true);   // 每人各 2 箭都在上限內
  });

  test("超過自己的 2 箭還是會被擋", () => {
    const s = {
      ...createRaidState({ boss, members: [member("a", { targetFmt: "triple" })] }),
      spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k", faceIndex: 0 }],
    };
    const arrows = Array.from({ length: 3 }, () => ({ memberId: "a", nx: 0, ny: 0, faceIndex: 0, score: 10 }));
    const { log } = resolveRaidRound({ state: s, arrows });
    expect(log.filter(e => e.type === "arrow" && e.overCap)).toHaveLength(1);
  });

  test("單張靶沒有上限，六箭都算", () => {
    const s = {
      ...createRaidState({ boss, members: [member("a", { targetFmt: "half_17" })] }),
      spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k" }],
    };
    const arrows = Array.from({ length: 6 }, () => ({ memberId: "a", nx: 0, ny: 0, score: 10 }));
    const { log } = resolveRaidRound({ state: s, arrows });
    expect(log.filter(e => e.type === "arrow" && e.overCap)).toHaveLength(0);
  });
});

describe("弱點圈：同一種靶紙看到同一組", () => {
  test("全隊同一種靶紙 → 只有一組圈（spotsByFace 是 null）", () => {
    const s = createRaidState({
      boss, members: [member("a", { targetFmt: "half_17" }), member("b", { targetFmt: "full_110" })],
    });
    expect(s.spotsByFace).toBeNull();       // 兩種靶紙但都是「一張」
    expect(s.spots.length).toBeGreaterThan(0);
  });

  test("⚠️ 三連靶與單張靶混在一起才分組——圈的 faceIndex 對不上單張靶的人", () => {
    const s = createRaidState({
      boss, members: [member("a", { targetFmt: "half_17" }), member("b", { targetFmt: "triple" })],
    });
    expect(s.spotsByFace).toBeTruthy();
    expect(Object.keys(s.spotsByFace).sort()).toEqual(["1", "3"]);
    expect(s.spots).toBe(s.spotsByFace[1]);   // state.spots 還是「我」的那組
  });

  test("下一回合重抽時分組也要跟著重抽", () => {
    const s = createRaidState({
      boss, members: [member("a", { targetFmt: "half_17" }), member("b", { targetFmt: "triple" })],
    });
    const { state } = resolveRaidRound({ state: s, arrows: [] });
    expect(Object.keys(state.spotsByFace).sort()).toEqual(["1", "3"]);
    expect(state.spots).toBe(state.spotsByFace[1]);
  });
});

describe("🏆 比賽模式：不反擊、不結束", () => {
  const matchState = () => createRaidState({
    boss: { key: "m", name: "靶紙王", hp: 500000, maxHp: 500000, atk: 9999, def: 40 },
    members: [member("me", { stats: { atk: 120, def: 0, hp: 100 } })],
    noRetaliation: true, endless: true,
  });

  test("⚠️ 王不會打人——atk 再高也一樣", () => {
    let st = matchState();
    for (let i = 0; i < 8; i += 1) st = resolveRaidRound({ state: st, arrows: [] }).state;
    expect(st.members[0].hp).toBe(st.members[0].maxHp);
  });

  test("⚠️ 連蓄力預告都不出現——掛一個永遠不會落下的招式，玩家會一直等", () => {
    for (let round = 1; round <= 6; round += 1) {
      expect(intentForRound({ round, phaseId: 1, noRetaliation: true }).charging).toBe(false);
    }
    // 一般討伐仍然會蓄力，這條規則沒有被弄壞
    expect([1, 2, 3, 4, 5].some(r => intentForRound({ round: r, phaseId: 1 }).charging)).toBe(true);
  });

  test("⚠️ 沒有回合上限——射到玩家自己離場為止", () => {
    let st = matchState();
    for (let i = 0; i < 12; i += 1) {
      const out = resolveRaidRound({ state: st, arrows: [] });
      st = out.state;
      expect(st.finished).toBe(false);
    }
    expect(st.round).toBe(13);
  });

  test("一般討伐不受影響：5 回合就結束", () => {
    let st = createRaidState({
      boss: { key: "t", name: "測試王", hp: 9000000, maxHp: 9000000, atk: 1, def: 0 },
      members: [member("me")],
    });
    for (let i = 0; i < 5; i += 1) st = resolveRaidRound({ state: st, arrows: [] }).state;
    expect(st.finished).toBe(true);
  });
});

describe("🏆 弱點固定在正中心（作者 2026-08-01）", () => {
  const matchState = () => createRaidState({
    boss: { key: "m", name: "靶紙王", hp: 500000, maxHp: 500000, atk: 0, def: 40 },
    members: [member("me", { targetFmt: "full_110" })],
    noRetaliation: true, endless: true, fixedSpots: true,
  });

  test("⚠️ 每回合都在正中心——讓圈亂跑，選手會去追圈而不是照動作射", () => {
    let st = matchState();
    for (let i = 0; i < 6; i += 1) {
      for (const spot of st.spots) {
        expect(spot.cx).toBe(0);
        expect(spot.cy).toBe(0);
      }
      st = resolveRaidRound({ state: st, arrows: [] }).state;
    }
  });

  test("兩個同心圈：黃（大）＋紅（小），跟環數一一對應", () => {
    const spots = centerWeakSpots({ faceCount: 1 });
    expect(spots.map(s => s.id)).toEqual(["yellow", "red"]);
    // 正中心命中最小的那個（＝X），稍微偏一點是黃（＝9~10 環）
    expect(hitSpot(spots, 0, 0).id).toBe("red");
    expect(hitSpot(spots, 0.2, 0).id).toBe("yellow");
    expect(hitSpot(spots, 0.6, 0)).toBeNull();
  });

  test("三連靶時每張靶都有一組", () => {
    expect(centerWeakSpots({ faceCount: 3 })).toHaveLength(6);
  });

  test("一般討伐不受影響：圈還是會換位置", () => {
    let st = createRaidState({
      boss: { key: "t", name: "測試王", hp: 9000000, maxHp: 9000000, atk: 1, def: 0 },
      members: [member("me")],
    });
    const seen = new Set();
    for (let i = 0; i < 8; i += 1) {
      st.spots.forEach(sp => seen.add(`${sp.cx.toFixed(3)},${sp.cy.toFixed(3)}`));
      st = resolveRaidRound({ state: st, arrows: [] }).state;
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
