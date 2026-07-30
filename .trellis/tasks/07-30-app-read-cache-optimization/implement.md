# 執行清單

1. 建立訂閱稽核測試或靜態契約測試。
2. 修正 `RPGEquipPanel` 完全重複監聽。
3. 盤點 `MemberApp`／`AdminApp` 已有狀態並建立共用 props 契約。
4. 改造高重複頁面為「傳入資料優先、缺少時後備訂閱」。
5. 移除不必要的強制重新掛載 key。
6. 確認多人房間與戰鬥即時監聽未被移除。
7. 補齊所有固定公開圖片目錄 Cache-Control。
8. 執行針對性測試。
9. 執行完整 `npm test` 與 `npm run build`。
10. 用 `rg` 重新統計重複訂閱並比較修改前後。

## 高風險檔案

- `src/pages/MemberApp.jsx`
- `src/pages/AdminApp.jsx`
- `src/components/member/MonsterBattle.jsx`
- `src/components/worldboss/WorldBossAttack.jsx`
- `src/components/dungeon/*`
- `vercel.json`

## 檢查門檻

- 不得更動登入或 Firestore Rules。
- 不得讓訪客／兒童模式因缺少共用 props 而空白。
- 不得取消組隊、世界王及戰鬥房間即時監聽。
