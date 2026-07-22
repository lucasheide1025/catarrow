# Implementation

1. [x] 解析 Rules collection surface 與 client call sites。
2. [x] 建立權限矩陣：`research/firestore-permission-matrix.md`。
3. [x] 檢查現有 emulator/testing infrastructure。
4. [x] 在不改正式 Rules 下建立 current-behavior security test 設計：`research/emulator-test-baseline.md`。因官方 rules unit testing 套件未安裝且全域 CLI 遭 sandbox `EPERM`，本輪未聲稱已執行 emulator tests。
5. [x] 驗證並記錄 hardening batches。
6. [x] 依使用者追加授權安裝官方 Rules 測試依賴並建立 Emulator 設定與 owner-bound 回歸測試。
7. [x] 最小批次收緊 `memberPerformanceSync`、`chestInventory`、`potionInventory`、`fragmentInventory`、`chestStats`、`potionDex`、`cardCollections`。
8. [x] 使用 Git ignored portable OpenJDK 與官方 Emulator 執行 Rules tests：29 passed、0 failed。
9. [x] production build、Trellis validation 與 `git diff --check` 通過。
