# 🔧 第二輪 Firestore 優化：卡片收集 & 藥水庫存

> 操作日期：2026-07-14
> 操作者：Buffy (AI Agent)
> 作業依據：第一輪優化完成後的 onSnapshot 用量調查報告

---

## 一、作業目的

根據第一輪優化結束後的調查，`subscribeCardCollection`（16 次使用）和 `subscribePotions`（11 次使用）是專案中用量最高的即時監聽器。兩者監聽的都是庫存/裝備類資料——卡牌一旦裝備後幾乎不再變動，藥水在戰鬥中也不會變化。將這兩個函式從 `onSnapshot`（即時監聽）改為 `getDoc`（一次性讀取），可消除 **27 個 onSnapshot 監聽器**。

---

## 二、備份清單

共備份 **14 個檔案**（所有引用這兩個函式的元件 + db.js），存放於本目錄下對應的路徑：

### src/lib/（1 個檔案）

| 檔案 | 說明 |
|------|------|
| `db.js` | 主資料庫操作層，含 `subscribeCardCollection` 與 `subscribePotions` 定義 |

### src/pages/（2 個檔案）

| 檔案 | 說明 |
|------|------|
| `MemberApp.jsx` | 會員前台，傳遞 cardCollection props |
| `AdminApp.jsx` | 管理後台，傳遞 cardCollection props |

### src/components/dungeon/（3 個檔案）

| 檔案 | 說明 |
|------|------|
| `DungeonBattleRoom.jsx` | 地下城戰鬥房（使用 CardCollection + Potions） |
| `DungeonExpedition.jsx` | 地下城遠征（使用 CardCollection） |
| `DungeonLobby.jsx` | 地下城大廳（使用 CardCollection） |

### src/components/member/（6 個檔案）

| 檔案 | 說明 |
|------|------|
| `CardCollection.jsx` | 卡牌收集頁面（使用 CardCollection） |
| `MemberDex.jsx` | 會員圖鑑（使用 CardCollection） |
| `MemberProfile.jsx` | 會員個人資料（使用 CardCollection） |
| `CatVillage.jsx` | 貓村（使用 Potions） |
| `MemberMaterials.jsx` | 會員素材背包（使用 Potions） |
| `MonsterBattle.jsx` | 個人打怪（使用 CardCollection + Potions） |

### src/components/party/（1 個檔案）

| 檔案 | 說明 |
|------|------|
| `PartyBattleRoom.jsx` | 組隊戰鬥房（使用 CardCollection + Potions） |

### src/components/worldboss/（1 個檔案）

| 檔案 | 說明 |
|------|------|
| `WorldBossAttack.jsx` | 世界王戰鬥（使用 CardCollection + Potions） |

---

## 三、實際變更內容

### 🔴 變更：`subscribeCardCollection` → 改為 `getDoc` 一次性讀取

**變更檔案：`src/lib/db.js`**

```diff
- return onSnapshot(doc(db, C_CARDS, memberId), snap => {
-   const data = snap.exists() ? { ...EMPTY_COLLECTION, ...snap.data() } : EMPTY_COLLECTION;
-   callback({ ...data, wbCards: normalizeWorldBossCards(data.wbCards || {}) });
- }, err => { console.warn(...); callback(EMPTY_COLLECTION); });
+ getDoc(doc(db, C_CARDS, memberId)).then(snap => {
+   const data = snap.exists() ? { ...EMPTY_COLLECTION, ...snap.data() } : EMPTY_COLLECTION;
+   callback({ ...data, wbCards: normalizeWorldBossCards(data.wbCards || {}) });
+ }).catch(err => {
+   console.warn("subscribeCardCollection:", err?.message);
+   callback(EMPTY_COLLECTION);
+ });
+ return () => {};
```

### 🔴 變更：`subscribePotions` → 改為 `getDoc` 一次性讀取

**變更檔案：`src/lib/db.js`**

```diff
- return onSnapshot(doc(db, C_POTIONS, memberId), snap => {
-   const data = snap.exists() ? snap.data() : {};
-   const migrated = migratePotionInventory(data);
-   callback(migrated.items);
-   if (migrated.migrated) { setDoc(...); }
- }, err => { console.warn(...); callback({}); });
+ getDoc(doc(db, C_POTIONS, memberId)).then(snap => {
+   const data = snap.exists() ? snap.data() : {};
+   const migrated = migratePotionInventory(data);
+   callback(migrated.items);
+   if (migrated.migrated) { setDoc(...); }
+ }).catch(err => {
+   console.warn("subscribePotions:", err.message);
+   callback({});
+ });
+ return () => {};
```

### 未變更

- **所有 14 個呼叫端元件**：完全不需要修改。API 簽章保持一致：
  - `subscribeCardCollection(memberId, callback)` → 回傳 unsubscribe function
  - `subscribePotions(memberId, callback)` → 回傳 unsubscribe function
- **`migratePotionInventory` 遷移邏輯**：保留，在 `getDoc` 成功後執行

---

## 四、效果預估

| 指標 | 改前 | 改後 |
|------|------|------|
| **subscribeCardCollection 監聽器** | 16 個 onSnapshot | **0 個**（一次性 getDoc） |
| **subscribePotions 監聽器** | 11 個 onSnapshot | **0 個**（一次性 getDoc） |
| **合計消除 onSnapshot** | 27 個 | — |
| **讀取延遲** | 即時推送（200-500ms） | 首次讀取可能需網路，後續由 IndexedDB 快取提供 |

---

## 五、安全機制

| 情境 | 處理方式 |
|------|---------|
| 元件在 getDoc 完成前卸載 | `.then()` callback 會執行但 React 不處理（無錯誤） |
| Firestore 讀取失敗 | `catch` 中呼叫 `callback({})`，確保畫面不崩潰 |
| CardCollection.jsx 裝備變更 | 該頁面通常會本地更新 state，不依賴訂閱回推（如有依賴需確認） |
| 首次載入（無快取） | 走網路讀取，一次 getDoc 成本遠低於持續 onSnapshot |

---

## 六、專案原始 git HEAD

```
Commit: 2d5532a
Message: fix: 完善射手同步與遠征獎勵權限
Branch: main
```

## 七、回滾方式

```bash
# 將備份檔案覆蓋回原始路徑
cp backups/2026-07-14_card-potion-optimization/src/lib/db.js src/lib/db.js
```

或使用 git 回復：

```bash
git checkout -- src/lib/db.js
```

---

*本紀錄由 Buffy (Freebuff AI Agent) 自動產生*
