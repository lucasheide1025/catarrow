# Implementation

1. 加入 staging ignore 與 manifest schema。
2. 抽出 Comfy API client 與 profile runner。
3. 建立世界王與透明測試 asset specs。
4. preflight 後提交批次並輪詢，不阻塞其他 child 工作。
5. 回收輸出、驗證並建立 contact sheet。
6. 執行工具測試與 `git diff --check`。

