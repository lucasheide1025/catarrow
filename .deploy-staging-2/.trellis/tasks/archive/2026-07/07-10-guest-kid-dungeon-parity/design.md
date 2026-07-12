# Design：訪客/兒童地下城比照正式系統

## 1. 整體策略：重用正式元件，只換「怎麼拿到一個地下城」這一步

正式系統的資料流：`挖掘探索`分頁（靠每日射箭量賺 T1-T6 解鎖機率）→ 產生/儲存一個 `dungeon` 物件 `{family, difficulty, boss, isHidden, savedId}` → `DungeonSelectionPanel`（顯示怪物/王/獎勵預覽，選單人/組隊）→ `DungeonExpedition`（單人）或 `TeamExpeditionBattle`（組隊）→ 迷霧格子探索 → `DungeonBattleRoom` 戰鬥 → 結算。

訪客/兒童**不做**「挖掘探索」那套賺解鎖機率的機制（design 已在 prd.md 說明原因），所以只需要換掉最上游「怎麼拿到一個 dungeon 物件」這一步，下游 `DungeonSelectionPanel`/`DungeonExpedition`/`DungeonBattleRoom` 全部原封不動重用。

```
訪客/兒童專屬（新）：GuestDungeonEntry → 選 T1/T2 → 就地隨機生成 dungeon 物件（複用 drawExpeditionBoss+隨機family，
                     不經過 excavation/pendingReveal 儲存機制）
                     ↓
共用（正式系統既有元件，加可選 guest 參數）：DungeonSelectionPanel → DungeonExpedition（單人）→ DungeonBattleRoom
```

## 2. Prop 傳遞設計（明確傳遞，不用 Context 偽裝）

- `DungeonLobby.jsx`：新增可選參數 `{ guestProfile, isGuest, tierCap }`。
  - `const { profile: authProfile } = useAuth(); const profile = guestProfile || authProfile;`（原本硬寫 `useAuth()` 的地方全部改用這個 `profile`）
  - `isGuest` 為真時：`tab` state 不允許進入 `"excavate"`（分頁按鈕本身也不渲染這個選項，比照 `MonsterBattle.jsx` 現有的 `{!isGuest && ...}` 寫法）；「進入地下城」分頁改渲染 `GuestDungeonEntry`（新元件）而不是原本讀 `savedDungeons`/`pendingReveal` 的清單畫面。
  - `tierCap` 往下傳給 `GuestDungeonEntry`。
- `DungeonExpedition.jsx` / `TeamExpeditionBattle.jsx`：研究已確認這兩個檔案**已經**是 `profile` prop-driven（不用改），不動。
- `DungeonSelectionPanel.jsx`：已經吃 `profile`/`dungeon`/`onStartSolo`/`onStartTeam`，**新增條件**：`isGuest` 為真時不渲染「組隊」按鈕（只留 `onStartSolo`），比照現有 `{!isGuest && ...}` 條件渲染慣例。
- `EquipmentPage.jsx`：比照 `DungeonLobby` 同樣的模式，新增可選 `guestProfile` 參數，內部 `useAuth()` 改成 `guestProfile || authProfile`。

## 3. 難度封頂機制（`tierCap`，防禦性做兩層）

**第一層（新元件 `GuestDungeonEntry.jsx`）**：只提供 T1／T2 兩個選項的簡單選擇畫面（不是完整挖掘系統），預設選 T1。選完呼叫既有的 `drawExpeditionBoss(tier, family)`（`monsterData.js`，研究已確認這是正式系統產生王的函式）搭配隨機/固定 family，就地組出一個 `dungeon` 物件（`{family, difficulty: tier, boss, isHidden:false, savedId:null}`），直接傳給 `DungeonSelectionPanel`——完全不寫入 `pendingReveal`/`savedDungeons`，訪客/兒童的「選擇」本身就是這次的地下城，不儲存待用清單。

```js
// GuestDungeonEntry.jsx 核心邏輯
function pickTier(requested, tierCap) {
  return Math.min(Math.max(1, requested), tierCap); // tierCap 目前固定傳 2，寫成參數方便未來調整
}
```

**第二層（防禦性，寫在 `DungeonExpedition.jsx` 實際消耗 `difficultyTier` 的地方）**：目前正式系統在 `DungeonExpedition.jsx:678` 是 `const difficultyTier = excavation?.difficulty || 1;`。改成：

```js
const difficultyTier = isGuest
  ? Math.min(dungeon.difficulty, tierCap || 2)   // 訪客/兒童：用第一層傳來的值，但這裡再夾一次，不完全信任上游
  : (excavation?.difficulty || 1);                // 正式學生：完全不變
```

**這第二層很重要，不能省略**——PRD 驗收項目3明確要求「不是只擋UI」，如果只有 `GuestDungeonEntry` 那個選擇畫面擋住T3+選項，但下游函式沒有再檢查一次，任何未來的程式改動或邊界案例都可能讓訪客/兒童意外拿到T3+內容。兩層都要夾。

## 4. 掉落物實裝

地下城戰鬥/王關結算的既有邏輯（不管是正式或訪客都會經過 `DungeonBattleRoom`/結算函式）已經在呼叫 `lootTable.js`/`monsterMaterials.js` 的 `rollMaterialDrops`/`rollCoins` 等函式並寫回 `members/{id}`。**訪客/兒童現在會拿到真正的材料/金幣，因為他們現在走的是同一條正式結算路徑，不是 `GuestDungeonSimple.jsx` 那個獨立、刻意跳過持久化寫入的簡化流程。** 這代表本次改動大部分「掉落物」需求是**整合的自然結果**，不需要另外設計新的掉落表——唯一要注意的是確認結算函式沿路沒有任何 `if (!isGuest)` 之類的守衛把訪客/兒童擋在寫入之外（`MonsterBattle.jsx` 有這種守衛是因為那邊刻意設計成訪客不留存打怪紀錄，但地下城這次的需求方向相反，要留存），實作時要逐一確認地下城這條路徑沒有繼承到類似的守衛。

## 5. `GuestApp.jsx` 進入點

`GuestApp.jsx` 現在對打怪走的是 `<MonsterBattle isGuest kidMode={isKid} />`；地下城原本是 `<GuestDungeonSimple guestOverride={...} />`。改成：
```jsx
<DungeonLobby guestProfile={guestProfile} isGuest tierCap={2} onBack={...} />
```
`guestProfile` 就是 `GuestApp.jsx` 現有的、透過 `resolveGuestSession` 拿到的那個 profile 物件（已經是真實 `members` 文件），不需要另外組裝。

## 6. UI 質感

不新刻樣式——直接吃正式系統元件現有的 CSS/Tailwind class，質感落差問題是「用了不同元件」造成的，換成同一套元件後自然解決，不需要額外的視覺設計工作。

## 7. `GuestDungeonSimple.jsx` 去留

實作完成、驗證過（PRD驗收1-7都過）之後，`GuestDungeonSimple.jsx` 沒有其他呼叫點了（只有 `GuestApp.jsx` 用它），可以刪除。刪除前先 grep 確認零殘留引用（比照這個專案處理死代碼的既有慣例）。

## 8. 施工順序

1. `DungeonLobby.jsx`/`EquipmentPage.jsx` 加可選 guest 參數，`useAuth()` 呼叫改成 fallback 寫法——**先確認正式學生路徑完全沒變**（沒傳 `guestProfile` 時行為要跟改動前逐字一致），這是本次風險最高的一步，因為動到的是正式系統本體
2. `GuestDungeonEntry.jsx` 新元件（T1/T2選擇畫面）+ 難度封頂兩層防禦
3. `DungeonSelectionPanel.jsx` 訪客隱藏組隊按鈕
4. `GuestApp.jsx` 接上新的 `<DungeonLobby>` 呼叫，拿掉 `<GuestDungeonSimple>`
5. 掉落物路徑逐一確認沒有繼承 `!isGuest` 守衛
6. 驗證：正式學生完整跑一次地下城（回歸測試）＋訪客/兒童完整跑一次（新功能測試）
7. 確認無誤後刪除 `GuestDungeonSimple.jsx`
