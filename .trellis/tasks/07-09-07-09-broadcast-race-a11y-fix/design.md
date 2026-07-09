# Design

## 1. `trySetDungeonFirstClear` → Firestore transaction

**現行簽章不變**：`trySetDungeonFirstClear(dungeonId, memberId, memberName, teamNames = [])` → `{ ok, isFirst }`（呼叫端已依賴此回傳形狀，`design.md` 不動它）。

**內部改寫**（`src/lib/dungeonDb.js`，取代目前 1095-1109 行）：

```js
export async function trySetDungeonFirstClear(dungeonId, memberId, memberName, teamNames = []) {
  try {
    const ref = doc(db, "dungeonFirstClear", dungeonId);
    const isFirst = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return false;
      tx.set(ref, { dungeonId, memberId, memberName, teamNames, clearedAt: serverTimestamp() });
      return true;
    });
    return { ok: true, isFirst };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
```

- 拿掉原本查詢 `dungeonBroadcasts` 的那段（語意上錯誤：判斷「是否已首殺」的唯一鍵應該是 `dungeonFirstClear/{dungeonId}` 文件本身是否存在，不是查 `dungeonBroadcasts` 有沒有相符文件）。
- Firestore transaction 保證「讀取 `dungeonFirstClear/{dungeonId}` → 判斷不存在 → 寫入」這整段對同一個 `dungeonId` 是互斥的：多個併發呼叫者中，只有一個的 transaction 會成功觀察到「不存在」並寫入，其餘會在 commit 階段因為讀到的版本已變而自動重試，重試後會讀到「已存在」而回傳 `false`。不需要呼叫端自己加鎖或重試邏輯。
- `addDoc`/`addDungeonBroadcast` 本身維持不變，呼叫端邏輯（`if (fcResult.isFirst) addDungeonBroadcast(...)`）也不用改，因為現在只會有一個呼叫者拿到 `isFirst:true`。
- 需要在 `dungeonDb.js` 檔案頂部 import 新增 `runTransaction`（Firestore SDK 既有 export，專案其他檔案應該已有引入模式可參考，若沒有則直接從 `firebase/firestore` import）。

**Firestore 規則影響**：`dungeonFirstClear` collection 目前規則是什麼要先確認（若走 transaction 但規則對 `get` 有特殊限制可能導致失敗）；若既有規則允許一般 `setDoc`/`getDoc`，transaction 的 read/write 走的是同一組規則，預期不需要改規則。

## 2. a11y 修正（`src/pages/MemberApp.jsx`）

兩處 `<div onClick>`（507 行 `dungeonKillAlert`、523 行 `wbKillAlert`）改法：保留外層 `<div>`（純樣式容器，不綁 onClick），把 `onClick` 移到一個新增的 `<button>` 包住整個可點擊區域內容，或直接在原本的 div 上補：

```jsx
role="button"
tabIndex={0}
onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); /* 原 onClick 邏輯 */ } }}
```

兩種做法都可以，考量現有 inline style 已經很複雜（flex 排版、漸層背景），選「補 role/tabIndex/onKeyDown」比重構成 `<button>` 改動更小、視覺零風險，採此法。

`aria-live="polite"`：直接加在三個公告的最外層容器：
- `dungeonKillAlert` 的 div（507 行）
- `wbKillAlert` 的 div（523 行）
- `specialAlert` 的 `OverlayModal` 內層卡片 div（561 行）

## 不動的部分

- `addDungeonBroadcast`、`subscribeLatestBroadcast`、`MemberApp.jsx` 的 localStorage 去重邏輯全部不變——這些本來就是對的，問題只在「產生重複文件」，不在「顯示端的去重」。
- 訊息列 (`MemberNotifications.jsx`)、`TYPE_META`、`FILTERS` 完全不動，屬於下一個任務。
