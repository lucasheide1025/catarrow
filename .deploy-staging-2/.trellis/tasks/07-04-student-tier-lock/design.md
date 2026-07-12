# 設計文件 — 學生分級與系統鎖定

## 資料模型

### `members/{memberId}` 新欄位

```js
studentTier: "restricted" | "official" | "retired"   // 缺欄位 → 視為 "restricted"
accountFrozen: boolean                                 // 缺欄位 → 視為 false
lastCheckinDate: "YYYY-MM-DD"                          // 缺欄位 → 視為「尚未有記錄」，見下方遷移策略
```

### 新 collection：`systemConfig/maintenance`

```js
{ enabled: boolean, message: string }
```

### 新 collection：`systemConfig/tierPermissions`（2026-07-04 追加，教練可調整）

```js
{
  restricted:  ["home", "training-hub", "practice", "profile"],
  autoLocked:  ["home", "training-hub", "practice", "gacha", "profile", "achievements"],
  retired:     ["profile"],
}
```

- 這份文件**不存在時**（尚未儲存過）用程式內建預設值（即上面三個陣列，與 PRD 權限矩陣一致）
- 教練在後台「權限設定」頁勾選調整後，整份寫回這個文件，全站即時生效（`onSnapshot` 訂閱）
- `official`（未鎖定）不在此文件管轄，恆為 `getAllowedPages` 回傳 `null`（全開）

## Firestore 規則異動

`members/{memberId}` 現有 `allow update`（會員自寫）的 `hasOnly` 白名單（firestore.rules:31-37）：

- **加入** `"lastCheckinDate"`（報到流程需要會員自己的 client 寫入）
- **不加入** `studentTier` / `accountFrozen`（維持只有 `allow write: if isAdmin()`，也就是既有第 28 行涵蓋，會員自己絕對寫不進去）

新增區塊：

```
match /systemConfig/{docId} {
  allow read:  if isLoggedIn();
  allow write: if isAdmin();
}
```

## 核心判斷邏輯（純函式，新檔 `src/lib/accessControl.js`）

```js
// 內建預設值（systemConfig/tierPermissions 文件不存在時的 fallback）
export const DEFAULT_TIER_PERMISSIONS = {
  restricted: ["home", "training-hub", "practice", "profile"],
  autoLocked: ["home", "training-hub", "practice", "gacha", "profile", "achievements"],
  retired:    ["profile"],
};

// 全部可勾選的頁面清單（供權限設定頁生成打勾矩陣，分組顯示用）
export const PAGE_REGISTRY = [
  { group: "首頁", pages: [{ id: "home", label: "首頁（含報到）" }] },
  { group: "冒險", pages: [
    { id: "adventure-hub", label: "冒險大廳" }, { id: "monster", label: "打怪" },
    { id: "party", label: "組隊" }, { id: "party-quest", label: "組隊任務" },
    { id: "party-battle", label: "組隊戰鬥" }, { id: "duel", label: "決鬥大廳" },
    { id: "duel-room", label: "決鬥房" }, { id: "dungeon", label: "地下城" },
    { id: "dungeon-room", label: "地下城房間" }, { id: "worldboss", label: "世界王" },
    { id: "guild", label: "公會" }, { id: "monsterdex", label: "怪物圖鑑" },
  ]},
  { group: "練箭", pages: [
    { id: "training-hub", label: "練箭大廳" }, { id: "practice", label: "自主練習" },
    { id: "comps", label: "比賽列表" }, { id: "comp-detail", label: "比賽詳情" },
  ]},
  { group: "貓村", pages: [{ id: "gacha", label: "貓村" }] },
  { group: "背包", pages: [
    { id: "inventory-hub", label: "背包大廳" }, { id: "coinshop", label: "商店" },
    { id: "materials", label: "材料" }, { id: "cats", label: "貓咪" },
    { id: "catbook", label: "貓咪圖鑑" }, { id: "story", label: "故事書" },
    { id: "equipment", label: "裝備" }, { id: "cards", label: "怪物卡片" },
  ]},
  { group: "我的", pages: [
    { id: "profile", label: "個人資料" }, { id: "learn", label: "學習資源" },
    { id: "msgs", label: "公告訊息" }, { id: "history", label: "歷史紀錄" },
    { id: "external", label: "外部比賽" }, { id: "achievements", label: "成就" },
    { id: "certexam", label: "檢定考試" }, { id: "notifications", label: "通知" },
    { id: "dex", label: "成就圖鑑" }, { id: "guide", label: "使用說明" },
    { id: "leaderboard", label: "排行榜" }, { id: "bowsetting", label: "弓具設定" },
  ]},
];

// 14 天未報到判斷（純函式，client-side 計算，無需 Cloud Functions）
export function isAutoLocked(member) {
  if (member.studentTier !== "official") return false;
  if (!member.lastCheckinDate) return false; // 見遷移策略：新欄位剛上線者不誤鎖
  const days = daysBetween(member.lastCheckinDate, todayStr());
  return days > 14;
}

// tierPermissions：從 Firestore 訂閱取得的設定物件（缺項時逐一 fallback 到預設值）
// 回傳 null = 不限制（全開）；否則回傳允許頁面 id 陣列
export function getAllowedPages(member, role, tierPermissions) {
  if (role === "admin") return null;                    // 教練完全豁免
  if (member.accountFrozen) return [];                   // 凍結：什麼都不行（連 home 都不行）
  const perms = tierPermissions || DEFAULT_TIER_PERMISSIONS;
  const tier = member.studentTier || "restricted";        // 缺欄位 → restricted
  if (tier === "retired")     return perms.retired    ?? DEFAULT_TIER_PERMISSIONS.retired;
  if (tier === "restricted")  return perms.restricted ?? DEFAULT_TIER_PERMISSIONS.restricted;
  if (isAutoLocked(member))   return perms.autoLocked ?? DEFAULT_TIER_PERMISSIONS.autoLocked;
  return null;                                            // official 且未鎖定：全開
}

export function isPageAllowed(member, role, pageId, tierPermissions) {
  const allowed = getAllowedPages(member, role, tierPermissions);
  return allowed === null || allowed.includes(pageId);
}
```

`daysBetween` 用簡單日期字串相減（不需要時區精算，14 天的粒度足夠寬鬆）。

`tierPermissions` 由 `MemberApp.jsx` 用 `onSnapshot` 訂閱 `systemConfig/tierPermissions`，作為 prop/context 往下傳，跟 `profile`/`role` 一起交給 `isPageAllowed`。教練在後台調整後，所有已登入會員的下一次頁面切換就會套用新設定（即時生效，不需重新整理）。

## 遷移策略：`lastCheckinDate` 缺欄位時的行為

**不能**把「缺欄位」當成「很久沒報到」（會誤鎖所有還沒觸發過新版 `submitCheckin` 的 `official` 會員）。`isAutoLocked()` 在 `lastCheckinDate` 不存在時直接回傳 `false`（不鎖）。實務效果：14 天倒數從該會員「上線後第一次報到」才開始算，不會因為欄位剛新增就被追溯鎖定。

## UI 掛載點

### 1. 全站關卡（順序：維護鎖 → 帳號凍結 → 分級鎖定）

在 `MemberApp.jsx` 最外層（`role !== "admin"` 時）：

```
if (systemConfig.maintenance?.enabled) → <MaintenanceScreen />
else if (profile.accountFrozen)        → <FrozenScreen />
else → 正常渲染，但每個 page 渲染前用 isPageAllowed() 檢查
```

`systemConfig/maintenance` 用 `onSnapshot` 訂閱（跟現有 `subscribePendingCheckins` 等即時訂閱同模式）。

### 2. 頁面級鎖定（概念提示卡）

`MemberApp.jsx` 現有的 `{page==="xxx" && <Component/>}` 渲染清單，改包一層：

```jsx
{page==="dungeon" && (
  isPageAllowed(profile, role, "dungeon")
    ? <DungeonLobby onBack={...} />
    : <LockedFeatureCard reason="此功能需正式學生身份，請洽詢教練" onBack={()=>setPage("home")} />
)}
```

`retired` 狀態的預設登入頁：`useAuth`/`MemberApp` 初始化 `page` state 時，若 `studentTier==="retired"`，初始值設為 `"profile"` 而非 `"home"`（因為 `home` 本身對 retired 是鎖住的）。

底部導覽列（`memberNav`/hub 按鈕）**維持全部顯示**，不因鎖定而隱藏——按下去才顯示鎖卡，符合已確認的 UX 決策。

### 3. 教練後台（`AdminMembers.jsx`）

- 每筆會員列新增：`studentTier` 下拉選單（`restricted`/`official`/`retired`）+ `accountFrozen` 開關
- 新增批次工具：勾選多筆會員 → 一鍵設為 `official`（因為上線初期教練要手動處理大量既有會員，單筆點擊太慢）
- 新增全站維護鎖開關（可放同頁面頂部，或獨立小卡）

### 4. 教練後台新頁面：權限設定（`AdminTierPermissions.jsx`，新元件）

- 用 `PAGE_REGISTRY`（見上方，分組：首頁/冒險/練箭/貓村/背包/我的）產生表格
- 欄＝三個可調分級：受限／正式學生鎖定中／退休中（`official` 不出現在表格，恆全開）
- 列＝每個頁面，勾選格決定該分級是否能看到該頁面
- 初次進入若 `systemConfig/tierPermissions` 不存在，表格預先勾選 `DEFAULT_TIER_PERMISSIONS` 的內容（教練看到的就是已確認的預設矩陣，可直接微調）
- 儲存時整份寫回 `systemConfig/tierPermissions`

對應 db.js / accessControl.js 新函式：

```js
setStudentTier(memberId, tier, operatorId)       // updateDoc studentTier
setAccountFrozen(memberId, frozen, operatorId)   // updateDoc accountFrozen
bulkSetStudentTier(memberIds[], tier, operatorId) // batch write
setMaintenanceMode(enabled, message, operatorId)  // systemConfig/maintenance
subscribeMaintenanceConfig(cb)                    // onSnapshot
setTierPermissions(permissions, operatorId)       // updateDoc systemConfig/tierPermissions
subscribeTierPermissions(cb)                      // onSnapshot（cb 收到 null 時前端 fallback 用 DEFAULT_TIER_PERMISSIONS）
```

### 4. 報到流程更新 `lastCheckinDate`

`submitCheckin` 與 `approveCheckin`（`src/lib/db.js`）各自加一行：

```js
await updateDoc(doc(db, C.members, memberId), { lastCheckinDate: todayStr() });
```

在 `submitCheckin`（學生按報到當下）就更新，不等教練審核，確保鎖定狀態下按報到能立即解鎖（不受教練審核延遲影響）。

## 相容性

- 現有 `MemberHome`／`DungeonLobby` 等元件簽名不變，只是外層多包一層條件渲染，元件本身無需修改。
- 現有 `useAuth.js` 不需改動：`profile` 物件透過既有 `onSnapshot` 即時同步，新欄位自動流入，`role` 已存在可直接用於教練豁免判斷。
- 不影響 `GuestBattle`／`CERT_LEVELS`／`monthlyCard` 任何現有邏輯。

## 風險與回滾

- 若 `LockedFeatureCard` 邏輯寫錯導致誤鎖 `official` 正常會員：由於教練後台可即時查看/修改 `studentTier`/`accountFrozen`，可即時手動排除；不需要 rollback 部署即可補救個案。
- 若批次工具誤操作：`bulkSetStudentTier` 只寫入單一欄位，可再次批次改回，無破壞性副作用。
