# 專案優化執行批次 v1

## 使用者授權

2026-07-22 使用者確認：除素材移除外，其餘已盤點的專案優化均可開始處理。

## 絕對邊界

- 不刪除、移動、壓縮、重新編碼或覆寫 `public/`、`build/cards/`、`.deploy-*` 或其他圖片素材。
- 不把 staging 圖片放入正式素材。
- 不執行 production deploy；部署前後量測先限於本機 build、dry-run、部署上下文與可重現指標。真正部署需另行確認。
- 不提交、不 push，直到完整檢查及提交計畫獲確認。
- `.claude/settings.local.json` 為既有未追蹤檔，不得修改或納入提交。

## Batch A：Firestore 後續權限

- 以既有 29 個 emulator tests 為基線。
- 逐批處理 shared rooms/battles、guest/kid、booking counters、world boss/global outcomes/economy。
- 每批先建立 characterization tests，再做最小規則收緊。
- 不得破壞已確認的多人房間、訪客、兒童帳號或管理員流程。
- 每個無法由 repo 證明的外部 collection 必須保留並記錄，不得臆測關閉。

## Batch B：核心拆分與 Bundle

- 先從 `src/lib/db.js` 的低耦合領域邊界拆分，保留原有 public exports 相容層，避免全專案一次改 import。
- 只拆具可驗證邊界且能降低初始載入或維護風險的模組。
- 對大型戰鬥元件先量測 import/bundle，再採 lazy-loading 或抽取純函式；不得為了檔案行數硬拆 JSX。
- 必須跑 production build、相關 tests 與 bundle 前後比較。

## Batch C：Gemini、GPT 流程、依賴與部署

- 確認 `@google/genai` 只供舊生圖工具使用後，移除 `scripts/generateVillageImages.js`、模型列舉工具及直接依賴；不可刪除其生成素材。
- 專案角色圖改採人工審核的 GPT staging 流程；目前不得假設 Codex built-in image tool 可在產品 runtime 被直接呼叫。
- 保留已核准的圖片決策、manifest/來源/角色 lineage 規範。
- 對 npm audit 漏洞做 production reachability 分類；只採非破壞性安全升級，禁止盲目 `npm audit fix --force`。
- 驗證 `.vercelignore`、Firebase Functions ignore、build 與部署上下文指標；不實際部署。

## 完成條件

- 所有修改有 targeted tests。
- Firestore emulator、Functions tests、production build、git diff check 通過。
- `public/` 與 tracked 素材狀態無變更。
- 列出仍未完成、需產品決策或需 production deploy 才能驗證的項目。
- 最後由獨立檢查批次覆核，再提出提交計畫。
## Integrated optimization status (2026-07-22)

- Deployment contexts now exclude local tooling, staging, tests, and unrelated Firebase/Vercel inputs. No production deployment was run.
- Firestore owner boundaries were tightened. `cardMarket` listing escrow, cancellation return, three purchase payment types, and seller proceeds now require atomic member/listing batches validated with Rules `getAfter()`.
- `campSessions` APIs were extracted behind compatibility re-exports. This improves module ownership but produced negligible bundle reduction by itself.
- The final guest static imports of `MonsterBattle` and `PartyBattleRoom` were converted to measured lazy boundaries. Together they reduced the initial main gzip by about 44.3 kB; the main bundle remains oversized.
- Gemini-only executable scripts and the direct `@google/genai` dependency were removed. GPT staging validation and image-workflow documentation were added. Existing generated assets were retained.
- Full frontend tests pass (64 suites / 604 tests), Functions tests pass (56), Python image-pipeline tests pass (12), and the production build succeeds.
- A temporary portable Adoptium JDK was used to run the newest Firestore Emulator matrix. All 38 tests pass, including the final market escrow, cancellation, three payment types, and proceeds-claim cases. The temporary JDK and Firebase config directory were removed afterwards.
- `public/`, `build/cards/`, tracked `.deploy-*`, and image assets were not deleted, moved, compressed, re-encoded, or overwritten.
