import {
  activeMemberIds,
  blockerSummary,
  lobbyRoster,
  lobbyView,
  myOpenRoom,
  openRoomList,
  roomSummary,
  soloDepart,
} from "./raidLobby";
import { RAID_DAILY_ATTEMPTS } from "./raidQuota";
import { RAID_MAX_TEAM } from "./raidTeam";

const DAY = "2026-07-31";
const spent = { attemptDate: DAY, attempts: RAID_DAILY_ATTEMPTS };

const room = (over = {}) => ({
  id: "r1", code: "ABC123", status: "waiting", hostId: "h", hostName: "房主",
  bossKey: "cat_baobao", targetFmt: "half_17", distanceM: 10,
  members: {
    h: { name: "房主", ready: true, atk: 120, def: 60, hp: 260, archerLevel: 40, joinedAt: 1 },
    b: { name: "阿乙", ready: true, atk: 100, def: 50, hp: 220, archerLevel: 20, joinedAt: 2 },
  },
  ...over,
});

describe("房間成員", () => {
  test("離開的人是設成 null，不算在名單裡", () => {
    const r = room({ members: { h: { name: "房主" }, b: null } });
    expect(activeMemberIds(r)).toEqual(["h"]);
  });

  test("⚠️ 房主永遠排第一，其餘照加入順序——名單不能每次更新都跳來跳去", () => {
    const r = room({
      members: {
        c: { name: "阿丙", joinedAt: 3 },
        b: { name: "阿乙", joinedAt: 2 },
        h: { name: "房主", joinedAt: 9 },      // 房主最晚才寫入也要排第一
      },
    });
    expect(lobbyRoster(r).map(m => m.name)).toEqual(["房主", "阿乙", "阿丙"]);
  });

  test("標得出誰是我、誰是房主", () => {
    const list = lobbyRoster(room(), { myId: "b" });
    expect(list.find(m => m.isMe).memberId).toBe("b");
    expect(list.find(m => m.isHost).memberId).toBe("h");
  });

  test("⚠️ 靶紙與射程是各自的——房間層那一份只是預設值", () => {
    const r = room({
      targetFmt: "half_17", distanceM: 10,
      members: {
        h: { name: "房主", joinedAt: 1, targetFmt: "field_16", distanceM: 18 },
        b: { name: "阿乙", joinedAt: 2 },       // 沒設過 → 吃房間預設
      },
    });
    const list = lobbyRoster(r);
    expect(list[0].targetFmt).toBe("field_16");
    expect(list[0].distanceM).toBe(18);
    expect(list[1].targetFmt).toBe("half_17");
    expect(list[1].distanceM).toBe(10);
  });

  test("帶得出每個人今天還剩幾次", () => {
    const list = lobbyRoster(room(), { participants: { b: spent }, dateKey: DAY });
    expect(list.find(m => m.memberId === "h").left).toBe(RAID_DAILY_ATTEMPTS);
    expect(list.find(m => m.memberId === "b").left).toBe(0);
    expect(list.find(m => m.memberId === "b").canGo).toBe(false);
  });
});

describe("等待室", () => {
  test("兩人都準備好就能出發", () => {
    const v = lobbyView(room(), "h", { dateKey: DAY });
    expect(v.isHost).toBe(true);
    expect(v.depart.ok).toBe(true);
    expect(v.readyCount).toBe(2);
  });

  test("⚠️ 擋住的原因要全部列出來——房主看不到是誰卡住只會亂點", () => {
    const r = room({
      members: {
        h: { name: "房主", ready: true, joinedAt: 1 },
        b: { name: "阿乙", ready: false, joinedAt: 2 },
        c: { name: "阿丙", ready: false, joinedAt: 3 },
      },
    });
    const v = lobbyView(r, "h", { participants: { c: spent }, dateKey: DAY });
    expect(v.depart.ok).toBe(false);
    const codes = v.depart.blockers.map(b => b.code).sort();
    expect(codes).toEqual(["no_attempts", "not_ready", "not_ready"]);
    expect(v.depart.blockers.some(b => b.text.includes("阿乙"))).toBe(true);
    expect(v.depart.blockers.some(b => b.text.includes("阿丙"))).toBe(true);
  });

  test("一個人的房間不能出發（那是單人房要走的路）", () => {
    const v = lobbyView(room({ members: { h: { name: "房主", ready: true } } }), "h", { dateKey: DAY });
    expect(v.tooFew).toBe(true);
    expect(v.depart.ok).toBe(false);
  });

  test("滿人就標成 full", () => {
    const members = {};
    for (let i = 0; i < RAID_MAX_TEAM; i += 1) members[`m${i}`] = { name: `m${i}`, ready: true, joinedAt: i };
    const v = lobbyView(room({ hostId: "m0", members }), "m0", { dateKey: DAY });
    expect(v.size).toBe(RAID_MAX_TEAM);
    expect(v.full).toBe(true);
  });

  test("出發前就看得到組隊加成——這是玩家願意等人的理由", () => {
    const v = lobbyView(room(), "h", { dateKey: DAY });
    // ⚠️ bonus 是**倍率**（2 人 = 1.10）不是加成（0.10）。
    //    UI 曾經直接乘 100 印成「ATK +110%」——這條就是拿來釘住它的。
    expect(v.bonus.atk).toBeCloseTo(1.10, 5);
    expect(v.bonus.label).toContain("ATK+10%");
    expect(v.gaugeMax).toBeGreaterThan(0);
  });

  test("不是房主就不會拿到房主權限", () => {
    expect(lobbyView(room(), "b", { dateKey: DAY }).isHost).toBe(false);
  });

  test("沒有房間也不會炸（剛退房那一瞬間）", () => {
    const v = lobbyView(null, "h", { dateKey: DAY });
    expect(v.size).toBe(0);
    expect(v.depart.ok).toBe(false);
  });
});

describe("單人房", () => {
  test("還有次數就能出擊", () => {
    const d = soloDepart({ participant: {}, dateKey: DAY });
    expect(d.ok).toBe(true);
    expect(d.left).toBe(RAID_DAILY_ATTEMPTS);
  });

  test("次數用完就擋下來，而且說得出原因", () => {
    const d = soloDepart({ participant: spent, dateKey: DAY });
    expect(d.ok).toBe(false);
    expect(d.blockers[0].code).toBe("no_attempts");
    expect(d.left).toBe(0);
  });

  test("⚠️ 王已經被別人打倒了也要擋——世界王的血是全服共享的", () => {
    const d = soloDepart({ participant: {}, dateKey: DAY, bossAlive: false });
    expect(d.ok).toBe(false);
    expect(d.blockers[0].code).toBe("boss_down");
  });

  test("跨日就恢復", () => {
    expect(soloDepart({ participant: spent, dateKey: "2026-08-01" }).ok).toBe(true);
  });
});

describe("公開房列表", () => {
  test("waiting 且沒滿才可加入", () => {
    expect(roomSummary(room()).joinable).toBe(true);
    expect(roomSummary(room({ status: "active" })).joinable).toBe(false);
  });

  test("滿人的房不可加入", () => {
    const members = {};
    for (let i = 0; i < RAID_MAX_TEAM; i += 1) members[`m${i}`] = { name: `m${i}` };
    const s = roomSummary(room({ members }));
    expect(s.full).toBe(true);
    expect(s.joinable).toBe(false);
  });
});

describe("房主看的一句話", () => {
  test("講得出還缺什麼", () => {
    const text = blockerSummary([
      { code: "not_ready", text: "阿乙 還沒準備好" },
      { code: "not_ready", text: "阿丙 還沒準備好" },
      { code: "no_attempts", text: "阿丁 今天的次數已經用完了" },
    ]);
    expect(text).toContain("2 人還沒準備");
    expect(text).toContain("1 人次數已用完");
  });

  test("沒有阻礙就沒有文案", () => {
    expect(blockerSummary([])).toBe("");
  });
});

describe("直接列房（不用組隊碼）", () => {
  const rooms = [
    room({ id: "r1", code: "AAA111", members: { h: { name: "房主" } } }),
    room({ id: "r2", code: "BBB222", members: { x: { name: "阿丙" }, y: { name: "阿丁" }, z: { name: "阿戊" } } }),
    room({ id: "r3", code: "CCC333", bossKey: "other_boss" }),
    room({ id: "r4", code: "DDD444", status: "active" }),
  ];

  test("⚠️ 只列同一隻王的房——換王那一瞬間的殘留房會讓人打到已結束的王", () => {
    const list = openRoomList(rooms, { bossKey: "cat_baobao" });
    expect(list.map(r => r.code)).not.toContain("CCC333");
  });

  test("已經開打的房不列", () => {
    expect(openRoomList(rooms, { bossKey: "cat_baobao" }).map(r => r.code)).not.toContain("DDD444");
  });

  test("人多的排前面——快要能出發的優先", () => {
    expect(openRoomList(rooms, { bossKey: "cat_baobao" }).map(r => r.code)).toEqual(["BBB222", "AAA111"]);
  });

  test("⚠️ 我已經在裡面的房不列——那要走「回到隊伍」不是「加入」", () => {
    const list = openRoomList(rooms, { bossKey: "cat_baobao", myId: "h" });
    expect(list.map(r => r.code)).toEqual(["BBB222"]);
  });

  test("滿人的房不列", () => {
    const members = {};
    for (let i = 0; i < RAID_MAX_TEAM; i += 1) members[`m${i}`] = { name: `m${i}` };
    expect(openRoomList([room({ members })], { bossKey: "cat_baobao" })).toHaveLength(0);
  });

  test("列得出裡面有誰——看到認識的人才會想加入", () => {
    const list = openRoomList(rooms, { bossKey: "cat_baobao" });
    expect(list[0].memberNames).toEqual(["阿丙", "阿丁", "阿戊"]);
  });

  test("找得到我自己的房（重整回來要接得回去）", () => {
    expect(myOpenRoom(rooms, "h")?.code).toBe("AAA111");
    expect(myOpenRoom(rooms, "nobody")).toBeNull();
    expect(myOpenRoom(rooms, null)).toBeNull();
  });

  test("沒有房也不會炸", () => {
    expect(openRoomList(null, { bossKey: "x" })).toEqual([]);
    expect(openRoomList([undefined], {})).toEqual([]);
  });
});
