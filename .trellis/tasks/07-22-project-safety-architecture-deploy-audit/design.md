# 技術設計：全專案唯讀審查

## Architecture and Boundaries

本任務以目前 Git `HEAD` 為主要基線，並將未追蹤或未提交內容分成「本任務產物」與「使用者既有內容」，不把後者納入可移除候選。審查涵蓋根 React SPA、`functions/`、Firestore Rules/indexes、Vercel/Firebase 部署設定、文件、scripts 與靜態資源。

輸出採證據鏈：`發現 -> 證據 -> 風險/成本 -> 建議 -> 驗證方式 -> 後續任務`。Gemini／Antigravity 既有報告只作候選來源，每項重要結論都以目前版本重新驗證。

## Review Tracks

1. **接手矩陣**：逐項分類既有報告為已驗證、部分成立、已過時、誤報或待量測。
2. **安全**：Secrets、Auth/role 邊界、Firestore Rules、Functions callable/HTTP 入口、輸入驗證、交易一致性、依賴與部署暴露。
3. **核心檔案瘦身**：依行數、責任數、耦合、匯出/匯入扇出與測試保護度排序拆分候選。
4. **目錄與移除候選**：Git 追蹤狀態、引用、package/config hooks、部署包含範圍與生成來源交叉驗證；不直接刪除。
5. **部署效能**：分離 Vercel install/build/upload 與 Firebase Functions/Rules/index deploy，收集可取得的本機及平台訊號。

## Data and Evidence Contracts

- 靜態證據包含 `rg`、Git、檔案統計、package/config、lockfiles、bundle/build 輸出與測試清單。
- 動態命令限唯讀或產生可再生 build/test 輸出；不得部署或改正式環境。
- Vercel Optimize 對 CRA 為有限支援。沒有平台 metrics 時，不輸出虛構的 route-level 效益或精確節省金額。
- 敏感值只回報類型與位置，不在報告複製完整 secret。

## Report Structure

- 執行摘要與優先順序
- Gemini／Antigravity 接手完成度矩陣
- P0/P1/P2 安全發現
- 核心檔案拆分路線圖
- 目錄重整與移除候選（含刪除前驗證）
- 部署耗時分析與量測缺口
- Codex 後續任務批次、依賴、驗證與回滾
- 方法、限制與證據索引

## Compatibility and Risk Controls

- 不改 public API、imports、Rules、Functions exports 或部署設定。
- 不執行刪除、移動、安裝、部署、推送或遠端寫入。
- 大型檔案不能只因行數大就建議拆分；必須指出穩定邊界與測試策略。
- 無引用檔案不能只依靜態 import 判死；必須檢查路由、字串引用、生成器、CLI/config 與營運用途。

