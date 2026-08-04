# 技術設計：年度檢定重新啟用

## 決策紀錄（本次已定案，不要再改）

1. **改門檻不重算**：修改 `certScores` 只影響之後審核的成績，已寫進 `certRecords` 的級別
   一律不動。UI 上用警語講清楚，程式端不做任何回填。
2. **露出位置**：首頁一張卡片為主（講得清楚「差幾分」），比賽分頁紅點為輔。
3. **不發獎勵**：升級別不發箭露／成就／稱號，本次不碰經濟。

## 現況接點（實作前先認識，不要重造）

| 事情 | 已經存在的東西 |
|------|----------------|
| 建立檢定賽 | `AdminCompetitions.jsx::AddCertModal`（:437），寫入 `type:"年度檢定"`、`year`、`half`、`certScores`、`status:"open"` |
| 改比賽 | `db.js::updateCompetition(id, patch, operatorId)` — 目前只被拿來改 `status` 與 `announcement` |
| 會員報名 | `MemberComps.jsx`，`status` 為 `open`/`upcoming` 時顯示「報名參加」 |
| 記分/審核 | `MemberScoring.jsx` → `AdminReviewCenter.jsx`，用 `getCertLevelByScores(bowType, score, comp.certScores)` 換算後寫 `certRecords` |
| 歷年成績 | `MemberProfile.jsx:889` 已有「▼ 查看歷年檢定成績」，但是一次攤開全部、無法選年份 |
| 級別換算 | `constants.js::getCertLevelByScores(bowType, score, scoreTable)`、`CERT_LEVELS`、`CERT_DEFAULT_SCORES`、`CERT_HALF` |
| 讀取快取 | `cachedFetch("cert_records.<memberId>", 10 分鐘, () => getCertRecords(id))`，首頁與「我的」共用 |

## A. 後台：建立後可改規則

**做法**：把 `AddCertModal` 裡的規則欄位（距離／每回合箭數／回合數／單箭最高分／有無脫靶／
四弓種門檻分數表）抽成共用元件 `CertRuleFields`，建立與編輯共用同一份表單，避免兩邊各寫一次
又長歪（跟 `BOOKING_PRICES` 手抄多份是同一類錯誤）。

- 新檔 `src/components/admin/CertRuleFields.jsx`：受控元件，`value` / `onChange`，
  含「回復預設值」按鈕（`CERT_DEFAULT_SCORES`）。
- `AddCertModal` 改用它，行為不變。
- `CompDetailModal`（:255 起）在 `isCert` 時多一個 tab `⚙️ 規則`，載入 `comp` 現值，
  儲存呼叫 `updateCompetition(comp.id, { distance, arrowCount, roundCount, maxScore, hasMiss, certScores }, operatorId)`。
- **標題同步**：`title` 是建立時組出來的字串（含距離），改距離要用同一條規則重組，
  否則畫面會出現「18米」標題配 30 米規則。抽 `certCompTitle({ year, half, distance })`
  到 `src/lib/certStatus.js`，建立與編輯共用。
- 儲存前顯示警語：「已審核的成績不會重新計算級別，只影響之後審核的成績。」

## B. 會員端露出

新檔 `src/lib/certStatus.js` — **純函式、零 firebase 相依**（才測得到，比照 `bookingPricing.js`）：

```
certCompTitle({ year, half, distance })      → "2026年下半年（7月～12月） 年度檢定（18米）"
activeCertComp(comps)                        → 進行中的年度檢定（type 相符且 status open/upcoming，取最新 year+half）
certPeriodKey(comp)                          → `${year}_${half}`
certProgress({ certScores, bowType, score }) → { level, nextLevel, gap }   // gap = 距離下一級還差幾分
myCertState({ registered, result })          → "none" | "registered" | "submitted" | "approved"
certYearOptions(groups)                      → [{ key:"2026_second", label:"2026 下半年" }, …] 新到舊
```

- `certProgress` 一律呼叫 `getCertLevelByScores`，不要自己比大小。
- 最高級已達成時 `nextLevel` 回 `null`、`gap` 回 `0`，UI 顯示「已達最高級」。
- 傳統弓最高級是「菁英」，其餘是「精英」——級別文字一律從 `CERT_LEVELS[bowType]` 取，
  不要寫死字串。

**首頁卡片**（`MemberHome.jsx`）：
- 有進行中檢定且我這期還沒審核通過 → 顯示卡片：期別、狀態（未報名／已報名未考／已送出待審）、
  每個弓種「目前 108 分・距離『進階』還差 18 分」，點擊 `onPageChange("comps")`。
- 沒有進行中的檢定 → **整張不顯示**，不要留空卡片。
- 資料來源：先確認 `MemberHome` 是否已有 competitions；沒有的話用
  `cachedFetch("cert_active_comp", 10 * 60 * 1000, …)` 取一次，不要每次進首頁都查
  （Firestore 成本紀律：這是每個人每天都會進的頁）。

**比賽分頁紅點**：沿用 `MemberApp.jsx` 既有的紅點計數機制（如 `dexUnseenCount` 那套），
條件同上——有進行中檢定且我還沒完成。

**三圍說明**：年度檢定卡片加一行「檢定級別會提升三圍」，並確認 `describeStatSources`
是否已把檢定拆出來；沒有的話在該處補一項，**不動 `calcArcherStats` 的公式**。

## C. 歷年成績查詢

`MemberProfile.jsx:876` 那張卡片：
- `showHistory` 布林 → 期別選單（`certYearOptions(groups)`），預設本期，可切到過去任一期。
- 每筆顯示年份、上/下半年、弓種、分數、級別（沿用既有的 `CertBlock` / `CertChip`）。
- 選到沒有紀錄的期別 → 明確空狀態文字，不留空白。
- **不新增任何 Firestore 讀取**：`certRecords` 已經整份撈進來了（`getCertRecords(memberId)`），
  分期只是在前端 group，走既有 10 分鐘快取。

## 風險與回滾

- 全部是新增元件與純函式，唯一動到既有寫入路徑的是 `updateCompetition` 多帶幾個欄位，
  出事只要把 `⚙️ 規則` tab 拿掉即可，資料結構不變。
- 已審核成績不重算 → 沒有資料遷移，不需要 rollback script。
- 教練切射手模式（`AdminApp.jsx` 載同一批 member 元件）務必實測首頁與「我的」不空白。
