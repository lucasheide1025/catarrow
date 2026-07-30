import { slotState } from "./bookingSlotState";

// 用「明天」避免撞到 slotState 的 30 分鐘截止判斷
function tomorrow() {
  const d = new Date(Date.now() + 86400000);
  return d.toISOString().slice(0, 10);
}

const DATE = tomorrow();
const KEY = `${DATE}_11:00`;

test("容量查詢失敗（null）時一律擋住，不可顯示成可預約", () => {
  const st = slotState(DATE, "11:00", null, 1, 1);
  expect(st.disabled).toBe(true);
  expect(st.state).toBe("counts_unavailable");
});

test("已佔 4 人時，8 人塞不進 8 人上限", () => {
  const counts = { [KEY]: { count: 4, newCount: 3, returningCount: 1 } };
  expect(slotState(DATE, "11:00", counts, 1, 8).state).toBe("full");
  expect(slotState(DATE, "11:00", counts, 1, 5).state).toBe("full");
  // 剛好塞滿 8 人可以
  expect(slotState(DATE, "11:00", counts, 1, 4).state).toBe("available");
});

test("沒有計數器文件的時段視為 0 人，不是不可預約", () => {
  expect(slotState(DATE, "11:00", {}, 1, 8).state).toBe("available");
});

test("教練暫停的時段擋住，且優先於人數判斷", () => {
  const counts = { [KEY]: { count: 0, blocked: true } };
  expect(slotState(DATE, "11:00", counts, 1, 1).state).toBe("blocked");
});

test("多時數方案：延伸出去的任一格塞不下就不能選這個起點", () => {
  const counts = {
    [`${DATE}_11:00`]: { count: 0 },
    [`${DATE}_12:00`]: { count: 7 }, // 第二格只剩 1 個位子
  };
  expect(slotState(DATE, "11:00", counts, 1, 2).state).toBe("available");
  expect(slotState(DATE, "11:00", counts, 2, 2).state).toBe("span_unavailable");
  expect(slotState(DATE, "11:00", counts, 2, 1).state).toBe("available");
});
