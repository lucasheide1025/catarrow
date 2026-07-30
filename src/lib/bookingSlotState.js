// 時段可選狀態判斷（純邏輯，刻意不 import firebase）。
// 原本住在 bookingSchedule.js，但那個檔會連帶載入 firebase.js，jest 環境跑不起來
// （@firebase/auth → undici），導致這段最需要測試的容量判斷一直沒有測試守著。
import { LANE_CAPACITY } from "./bookingPricing";

const VENUE_TZ_OFFSET = "+08:00"; // 場地在台北，不能假設瀏覽器時區一致
const MIN_LEAD_MS = 30 * 60 * 1000;

// 判斷某時段目前該顯示的狀態（唯讀顯示用，不是唯一防線——bookingDb.js 的 runTransaction
// 一定會再檢查一次）。
//
// slotCounts：fetchSlotCountsForRange 的結果。
//   - 物件：key 是 "YYYY-MM-DD_HH:mm"，沒有該 key 代表那一格 0 人。
//   - null：查詢失敗（權限或網路）。一律回 counts_unavailable 並 disabled，不可當成 0 人——
//     以前失敗時回傳 {}，未登入訪客會看到所有時段都「可預約」，選到已額滿的時段後
//     要到最後送出才被 transaction 擋下來。
//
// durationHours：多時數方案要連續佔用數格，延伸出去的每一格都要塞得下。
// participantCount：選 N 人＝每一格扣掉已佔用後，剩餘名額要能塞下 N 人。
// 回傳的 label 含新／舊生統計，只給教練後台與學籍會員看；公開頁請改用自己的簡化文案。
export function slotState(date, startTime, slotCounts, durationHours = 1, participantCount = 1) {
  const slotStartMs = new Date(`${date}T${startTime}:00${VENUE_TZ_OFFSET}`).getTime();
  if (slotStartMs - Date.now() < MIN_LEAD_MS) {
    return { state: "too_soon", label: "已截止", disabled: true };
  }

  if (!slotCounts) {
    return { state: "counts_unavailable", label: "無法查詢名額", disabled: true };
  }

  const localInfo = slotCounts[`${date}_${startTime}`] || {};
  const count = localInfo.count || 0;
  const newCount = localInfo.newCount || 0;
  const returningCount = localInfo.returningCount || 0;
  const countLabel = `新${newCount}／舊${returningCount}（共${count}/${LANE_CAPACITY}）`;

  if (localInfo.blocked) return { state: "blocked", label: "教練暫停", disabled: true };
  if (count + participantCount > LANE_CAPACITY) {
    return { state: "full", label: `${countLabel}・人數超過剩餘名額`, disabled: true };
  }

  if (durationHours > 1) {
    const [h, m] = startTime.split(":").map(Number);
    const mm = m === 0 ? "00" : String(m).padStart(2, "0");
    for (let i = 1; i < durationHours; i++) {
      const key = `${date}_${String(h + i).padStart(2, "0")}:${mm}`;
      const c = slotCounts[key] || {};
      if (c.blocked || (c.count || 0) + participantCount > LANE_CAPACITY) {
        return { state: "span_unavailable", label: `${countLabel}・延伸時段名額不足`, disabled: true };
      }
    }
  }

  return { state: "available", label: countLabel, disabled: false };
}
