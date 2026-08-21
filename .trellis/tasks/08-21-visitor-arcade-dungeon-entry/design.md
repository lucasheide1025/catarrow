# Technical Design

## Existing boundaries

- `src/App.jsx` 已以 `?arcade` 將請求導向獨立的 `ArcadeApp`。
- `src/arcade/ArcadeApp.jsx` 已提供 Local First 訪客建檔、大廳、三種地下城、單人與組隊入口。
- `src/pages/PublicBookingApp.jsx` 的會員中心目前仍透過 `enterGuestGame()` 寫入 `guest_prefill` 並導向 `/?guest=1`。

## Change

將預約會員中心的遊戲入口視為一般 Arcade 深連結：按鈕只負責導向 `/?arcade`。移除該操作中的舊學籍預填副作用，並更新按鈕註解與文案。

不新增預約資料與 Arcade profile 的資料橋接。Arcade 繼續透過自身的 Local First profile 建立與恢復流程管理訪客狀態。

## Compatibility

- 不調整 `App.jsx` 的舊 `?guest=1` 分流。
- 不清除使用者瀏覽器中既有的 `guest_prefill`，避免入口切換順便破壞可能尚未完成的舊流程；新版入口只是不再寫入它。
- 不修改現有 Arcade 地下城資料模型或戰鬥流程，降低與目前大量未提交工作互相覆蓋的風險。

## Validation

- 用契約測試固定預約入口的 URL、文案及不得寫入 `guest_prefill`。
- 執行 Arcade 相關測試與 production build，確認既有探索入口仍可編譯。
