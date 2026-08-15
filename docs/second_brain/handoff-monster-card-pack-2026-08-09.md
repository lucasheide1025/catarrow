# 怪物卡包修正接手紀錄（2026-08-09）

## 玩家回報

怪物卡包只能抽到舊怪物，無法抽到新版全部一般怪物。卡包規則應包含所有一般怪物，但不包含小王、大王及世界王。

## 根因

`src/lib/itemData.js` 的卡包抽取仍使用舊版 `MONSTERS`（36 隻）作為候選池，沒有接到正式的新版怪物目錄 `monsterExpansionCatalog`。

## 已完成修改

- 卡包候選池改由 `EXPANSION_MONSTERS` 衍生。
- 只納入 `encounter === "normal"` 的怪物，共 126 隻。
- 明確排除 `miniBoss`、`boss`；世界王本來就屬於獨立卡池，不會進入此目錄。
- 保留原本 T1～T6 的階級權重：`common 50 / rare 25 / elite 15 / fierce 7 / boss 2.5 / mythic 0.5`。
  - 此處 `boss` 是舊 tier 名稱（T5），不是 encounter 的大王分類；T5 的一般怪仍可正常抽到。
- 新版卡片寫入資料補齊 `monsterId`、`name`、`icon`、`tier`、`family`、`artKey`、`tierIndex`、`encounter`。
- 卡包說明由舊「36 種」更新為「126 種一般怪物」。
- 新增 `getMonsterCardPackPool()` 作為卡包池的可測試權威入口。

## 修改檔案

- `src/lib/itemData.js`
- `src/lib/monsterCardPack.test.js`（新增，尚未被 Git 追蹤）

## 驗證結果

- 聚焦測試：3 suites / 12 tests 全通過。
- 完整測試：173 suites / 2040 tests 全通過。
- `npm run build`：成功。
- `git diff --check`：本次已追蹤程式檔沒有 whitespace error（只有既有 LF/CRLF 提示）。

## 部署狀態

- 已建立 Vercel production deployment：`dpl_CRDkQBjQZZofAy5o8kB5euQk9235`
- 部署網址：<https://catarrow-lrp095vlj-broudes-1864s-projects.vercel.app>
- 正式網域：<https://student.catgroup.com.tw>
- Vercel deploy command 成功回傳 deployment；但後續兩次 `vercel inspect` CLI 都無輸出卡住，已手動終止，因此重開機後仍需再次確認 Ready 與 production alias。

## 尚未完成／重開機後待辦

1. 執行 `git status --short -- src/lib/itemData.js src/lib/monsterCardPack.test.js docs/second_brain/handoff-monster-card-pack-2026-08-09.md`，確認三個本次檔案仍在。
2. 用 Vercel inspect 或控制台確認 deployment `dpl_CRDkQBjQZZofAy5o8kB5euQk9235` 已是 Ready，且 `student.catgroup.com.tw` 指向本次部署。
3. 正式站實測開啟怪物卡包，確認能抽到新版一般怪，並即時出現在卡片收藏。
4. 本次修改尚未 commit／push；不得使用 `git add .` 或 `git add -A`。若要提交，只能明確加入上述三個檔案，避免把工作樹中其他 WIP 一起提交。
5. 若實測正常，再把本次摘要同步到 `docs/second_brain/changelog.md`；目前先以本 handoff 作為重開機權威紀錄。

## 注意事項

- 工作樹仍有大量其他人的 WIP、刪除與未追蹤文件，不得自動 restore、stage、commit 或 cleanup。
- 不要把 `monsterData.js` 的舊 36 隻再次接回卡包。
- 卡包的排除條件必須看 `encounter`，不能用 `tier === "boss"` 排除，否則會錯誤排除 T5 的一般怪。
