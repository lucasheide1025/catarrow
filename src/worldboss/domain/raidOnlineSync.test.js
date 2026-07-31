// 線上組隊的同步不變式（2026-07-31）
//
// ⚠️ 線上時**只有房主算**：他跑 resolveRaidRound，結果 serialize 進房間文件，
//    其他人 hydrate 回來照 lastLog 重播。兩台各算各的隨機數一定會漂。
//
// 這一支測的就是那條來回：房主算完 → 存 → 隊員讀回來，兩邊必須一模一樣。
// 只要 raidFlow 新增了欄位卻忘了加進 serializeRaidState 的白名單，這裡就會紅。
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { collectRoomArrows, hydrateRaidState, roomPhase, rosterFromRoom, serializeRaidState } from "./raidRoomState";
import { WEAK_SPOT_MAP } from "./weakPoints";

const boss = { key: "cat_baobao", name: "寶寶", hp: 500000, maxHp: 500000, atk: 100, def: 40 };

const room = (over = {}) => ({
  id: "r1", code: "ABC123", status: "active", hostId: "h",
  bossKey: "cat_baobao", targetFmt: "half_17", distanceM: 10,
  round: 1, seq: 1,
  members: {
    h: { name: "房主", atk: 120, def: 60, hp: 260, archerLevel: 40, cats: [], targetFmt: "half_17", distanceM: 5 },
    b: { name: "阿乙", atk: 100, def: 50, hp: 220, archerLevel: 20, cats: [], targetFmt: "triple", distanceM: 18 },
  },
  submissions: {},
  ...over,
});

const shots = n => Array.from({ length: n }, () => ({ nx: 0, ny: 0, faceIndex: 0, score: 10 }));

function hostState(r) {
  return {
    ...createRaidState({ boss, members: rosterFromRoom(r), targetFmt: r.targetFmt, distanceM: r.distanceM }),
    spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "k" }],
  };
}

describe("推進閘門", () => {
  test("有人還沒交就不能結算", () => {
    const p = roomPhase(room({ submissions: { h: { round: 1, arrows: shots(6) } } }));
    expect(p.canResolve).toBe(false);
    expect(p.waitingNames).toEqual(["阿乙"]);
  });

  test("全員交齊才推得動", () => {
    const p = roomPhase(room({
      submissions: { h: { round: 1, arrows: shots(6) }, b: { round: 1, arrows: shots(6) } },
    }));
    expect(p.canResolve).toBe(true);
  });

  test("⚠️ 上一回合的舊送出不算數——不然回合會連跳", () => {
    const p = roomPhase(room({
      round: 2,
      submissions: { h: { round: 2, arrows: shots(6) }, b: { round: 1, arrows: shots(6) } },
    }));
    expect(p.canResolve).toBe(false);
    expect(p.waitingFor).toEqual(["b"]);
  });
});

describe("房主算 → 存 → 隊員讀回來", () => {
  const played = () => {
    const r = room({
      submissions: {
        h: { round: 1, arrows: shots(6) },
        b: { round: 1, arrows: shots(6) },
      },
    });
    const before = hostState(r);
    const { state: after, log } = resolveRaidRound({ state: before, arrows: collectRoomArrows(r) });
    const stored = serializeRaidState(after);
    return { after, log, stored, mirrored: hydrateRaidState(JSON.parse(JSON.stringify(stored))) };
  };

  test("兩邊的王血、回合、總傷害完全一致", () => {
    const { after, mirrored } = played();
    expect(mirrored.bossHp).toBe(after.bossHp);
    expect(mirrored.round).toBe(after.round);
    expect(mirrored.totals.damage).toBe(after.totals.damage);
    expect(mirrored.totals.breakPoints).toBe(after.totals.breakPoints);
  });

  test("每個人的血與傷害都對得上", () => {
    const { after, mirrored } = played();
    expect(mirrored.members).toHaveLength(after.members.length);
    for (const m of after.members) {
      const mine = mirrored.members.find(x => x.memberId === m.memberId);
      expect(mine.hp).toBe(m.hp);
      expect(mine.damage).toBe(m.damage);
    }
  });

  test("⚠️ 各自的靶紙與射程要存得住——不然隊員回來會變成房主的條件", () => {
    const { mirrored } = played();
    const h = mirrored.members.find(m => m.memberId === "h");
    const b = mirrored.members.find(m => m.memberId === "b");
    expect(h.targetFmt).toBe("half_17");
    expect(h.distanceM).toBe(5);
    expect(b.targetFmt).toBe("triple");
    expect(b.distanceM).toBe(18);
    expect(b.rangeMult).toBeGreaterThan(h.rangeMult);
  });

  test("⚠️ 三連靶的每張上限也要存得住", () => {
    const { mirrored } = played();
    expect(mirrored.members.find(m => m.memberId === "b").faceCap).toBe(2);
    expect(mirrored.members.find(m => m.memberId === "h").faceCap).toBeNull();
  });

  test("⚠️ 混合靶紙時的 spotsByFace 要跟著存——不然隊員下一回合看到別組圈", () => {
    const { after, mirrored } = played();
    expect(after.spotsByFace).toBeTruthy();          // 單張 + 三連靶 → 兩組
    expect(Object.keys(mirrored.spotsByFace).sort()).toEqual(["1", "3"]);
    expect(mirrored.spots).toEqual(after.spots);
  });

  test("log 是純資料，JSON 來回不掉東西（隊員照它重播）", () => {
    const { log } = played();
    const round = JSON.parse(JSON.stringify(log));
    expect(round).toEqual(log);
    expect(round.some(e => e.type === "arrow")).toBe(true);
    expect(round.some(e => e.type === "roundEnd")).toBe(true);
  });

  test("skillConfig 不進 Firestore，讀回來要重新掛上", () => {
    const { stored, mirrored } = played();
    expect(stored.boss.skillConfig).toBeUndefined();
    expect(mirrored.boss.skillConfig).toBeTruthy();
  });

  test("⚠️ 存進 Firestore 的東西不能有 undefined", () => {
    const { stored } = played();
    const walk = v => {
      expect(v).not.toBeUndefined();
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(stored);
  });
});

describe("每個人只回報自己的傷害", () => {
  test("⚠️ 各扣各的次數、各寫各的——加總全隊會把隊友的記到自己頭上", () => {
    const r = room({
      submissions: { h: { round: 1, arrows: shots(6) }, b: { round: 1, arrows: shots(6) } },
    });
    const { state: after } = resolveRaidRound({ state: hostState(r), arrows: collectRoomArrows(r) });
    const sum = after.members.reduce((s, m) => s + m.damage, 0);
    for (const m of after.members) expect(m.damage).toBeLessThan(sum);
    expect(sum).toBeGreaterThan(0);
  });
});
