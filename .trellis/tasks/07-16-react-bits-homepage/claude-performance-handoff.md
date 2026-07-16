# Claude handoff — 射手表現並行工作

## Ownership boundary

- Claude 獨立負責射手表現需求與 `MemberPerformance` 相關修改。
- 本任務不編輯、不格式化、不搬移 `MemberPerformance.jsx`，也不在該頁直接套 React Bits wrapper。
- 若共用檔案發生交集，以 Claude 的射手表現需求為優先；請避免從 `src/components/react-bits/` 反向依賴業務元件。

## 本任務正在做的事情

- 學員／訪客入口的低風險 SpotlightCard、FadeContent 類效果。
- 地下城非戰鬥事件介面的「兒童友善史詩冒險」視覺骨架。
- 地下城進入前的音效與震動獨立開關，兩者預設開啟並以 localStorage 持久化。
- 修正單人／組隊斷線重連後 `arrowsPerRound`、`targetFmt` 等 run settings 被預設值覆蓋。

## 對射手表現頁的建議（僅供 Claude 參考）

- 真實數字可沿用現有 `src/components/shared/Widgets.jsx::CountUp`，不要再新增另一個 CountUp。
- CountUp 適合總箭數、平均分、完成回合等「已載入且可信」數據；篩選切換頻繁時避免每次從 0 重播。
- 若需要進場效果，以整個 summary/card group 為單位做一次小幅 FadeContent，不逐張圖表、逐列紀錄動畫。
- 圖表與靶面以資料可讀性優先，不套 Spotlight、blur 或持續光暈。
- 必須支援 `prefers-reduced-motion` 與全域 `.no-anim`，並保留載入 skeleton 的穩定尺寸。
- 不要為動畫新增 Motion、Framer Motion 或 GSAP；目前專案沒有這些依賴。

## 可能的共用介面

- 本任務預計新增 `src/components/react-bits/` 下的展示元件；Claude 不必等待或依賴它們。
- 若 Claude 完成後仍需要 FadeContent，可在雙方變更整合完成後再包裝，不要在並行期間建立相同檔名或重複元件。
- `Widgets.jsx::CountUp` 是現有共用來源；若必須修改，請保留 RAF cleanup，並建議補上 reduced-motion 直接顯示最終值。

## 合併檢查

- 完成後請告知是否修改 `Widgets.jsx`、`index.css`、`MemberApp.jsx` 或任何共用 chart component。
- 最終整合時需重跑 production build、相關測試與 360/390/430px 手機檢查。

## 2026-07-16 並行測試狀態

- 本任務執行完整 `npm test -- --watchAll=false`：84 passed、2 failed。
- 失敗 1：`src/lib/targetFace.test.js`，`field_16` 在半徑 `0.1` 的 `rawScore`，測試期待 6、目前收到 5。
- 失敗 2：`src/lib/battlePractice.test.js`，field analysis 的 `highThreshold`，測試期待 5、目前收到 4。
- 本任務沒有修改 `targetFace.js`、`battlePractice.js` 或上述兩支測試；請 Claude 在射手表現工作完成後確認是規格更新、實作回歸，或測試期待值需要同步。
