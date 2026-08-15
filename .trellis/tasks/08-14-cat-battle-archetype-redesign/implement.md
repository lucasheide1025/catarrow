# Implementation Plan

1. 建立九隻貓能力目錄、羈絆 0–50 成長曲線、模式 policy 與資料完整性測試。
2. 以測試先行建立 `catBattleEngine`：基礎效果、強力保底、治療異常混合傷害、守護反攻及三隻攻擊分支。
3. 擴充 `combatModifiers` 的應援專精，使攻擊、治療、護盾／格擋都有對等 scaling。
4. 接入單人 BattleScreen reducer、事件訊息、動畫與續戰 snapshot。
5. 接入組隊狩獵權威結算與團隊效果 cap，寫入可重播 round log。
6. 接入單人／組隊地下城權威結算與跨樓層 policy。
7. 接入世界王限制 policy；確認決鬥仍走舊 resolver。
8. 重構 CatCollection 手機資訊架構，完成陪練房、三型 tabs、角色卡、bottom sheet 與 sticky equip CTA。
9. 更新首頁／指南／詳情等所有舊技能文字，避免顯示過時說明。
10. 執行引擎、跨模式、snapshot、UI 契約、無障礙與 production build 驗證。

## Validation

- `npm.cmd test -- --watchAll=false --runTestsByPath <cat engine/catalog/snapshot/authority/UI tests>`
- `npm.cmd run build`
- 手機人工流程：三型各一隻，單人四回合保底、重整續戰、組隊雙帳號、地下城換層、世界王限制。

## Risk and Rollback Points

- `BattleScreen`, `partyDb`, `dungeonDb` 是共享高風險路徑；每種模式分段接入並保留舊 resolver flag。
- 異常引爆與最大 HP 傷害必須先通過 boss/worldboss cap 測試才可接 UI。
- CatCollection 重構不得改變 equip 寫入與忙碌貓限制。
