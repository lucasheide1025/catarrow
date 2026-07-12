# Design：訪客模式全新UI＋兒童模式＋跨帳號共戰＋帳號轉移系統

## 1. 資料模型

`members/{id}` 新增欄位：
```js
{
  accountType: "official" | "guest" | "kid", // 未設定視為 "official"
  contactHash: string | null,                // sha256(email或電話正規化後)，只有 guest/kid 才有
  contactRaw: string | null,                  // 明碼保留供教練後台顯示/聯絡用（非公開查詢用途）
  sessionSourceId: string | null,             // 對應哪個場次/QR來源（兒童模式用，見下方 campSessions）
  createdViaQR: string | null,                // 建立當下的 QR/連結識別碼
}
```
新集合 `campSessions/{sessionId}`（夏令營場次）：
```js
{ name, startDate, endDate, qrCode, createdBy, createdAt, active: bool }
```

## 2. 認證與 Firestore 規則變更

`firestore.rules::members` 新增分支（在既有 `allow write: if isAdmin();` 之後，用獨立的 `allow create/update/get` 疊加）：

```
allow create: if isAdmin() || (
  isLoggedIn() &&
  request.resource.data.accountType in ["guest", "kid"] &&
  request.resource.data.uid == request.auth.uid
);

allow get: if isAdmin()
  || resource.data.uid   == request.auth.uid
  || resource.data.email == request.auth.token.email
  || (isLoggedIn() && resource.data.accountType in ["guest", "kid"]);

allow update: if (
  (resource.data.uid == request.auth.uid || resource.data.email == request.auth.token.email)
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly([...既有清單, "accountType", "contactHash", "contactRaw", "sessionSourceId", "createdViaQR"])
) || (
  isLoggedIn() && resource.data.accountType in ["guest", "kid"]
  // 訪客/兒童：不要求 uid 對應本人（匿名重登入每次 uid 都變），這是使用者已確認接受的安全取捨
);
```
`accountType` 從 `guest/kid` 改成 `official`（轉正式）這個寫入動作，因為改變了 `accountType` 本身，會落在「非 hasOnly 名單限制」的 guest/kid 分支（`resource.data.accountType in ["guest","kid"]` 這條件在寫入當下用的是**舊值**，所以轉正式那一次寫入仍然符合這條放寬規則），可以正常執行。轉正式後之後的寫入就會落回嚴格的 official 分支。

新集合 `campSessions`：`allow read: if isLoggedIn(); allow write: if isAdmin();`（比照其他管理型集合）。

## 3. 入口與帳號接續（新檔 `src/lib/guestAuth.js`）

```js
export async function resolveGuestSession(contact, accountType /* "guest"|"kid" */, sessionSourceId) {
  await signInAnonymously(auth);
  const contactHash = await sha256(normalizeContact(contact));
  const q = query(collection(db, "members"),
    where("accountType", "==", accountType), where("contactHash", "==", contactHash), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const existing = snap.docs[0];
    await updateDoc(existing.ref, { uid: auth.currentUser.uid, lastLoginAt: serverTimestamp() });
    return { id: existing.id, ...existing.data() };
  }
  const ref = await addDoc(collection(db, "members"), {
    accountType, contactHash, contactRaw: contact, sessionSourceId: sessionSourceId || null,
    uid: auth.currentUser.uid, name: accountType === "kid" ? "小小射手" : "訪客射手",
    coins: 0, createdAt: serverTimestamp(),
  });
  return { id: ref.id, accountType, uid: auth.currentUser.uid };
}
```
用瀏覽器 `crypto.subtle.digest` 做 sha256（前端算 hash，不需要後端函式）。`normalizeContact`：email 轉小寫去空白；電話去除非數字字元。

`useAuth.js` 需要能承載這個「非 email/password 登入」的 profile（目前 `useAuth` 假設一定有 Firebase Auth email 登入流程）——訪客/兒童入口繞過 `useAuth`，改成獨立的 `GuestApp`/`KidApp` 頂層元件直接管理自己的 `profile` state（不掛進 `AuthProvider`），比照現有 `GuestBattle.jsx` 已經是獨立於 `useAuth` 之外運作的模式。

## 4. 前端元件

- `src/pages/GuestApp.jsx`（新，取代 `GuestBattle.jsx` 整合進 `App.jsx` 路由）：入口畫面（聯絡方式輸入）→ 主體分頁（打怪/地下城簡化版/組隊/決鬥/世界王/商店/結算）。
- `src/pages/KidApp.jsx`（新）：比照 GuestApp 但額外套用兒童向 UI 主題（大按鈕/簡化文字），單人打怪走簡化版邏輯，組隊/地下城直接 render 既有 `PartyLobby`/`DungeonLobby`（不簡化）。
- `src/components/dungeon/GuestDungeonSimple.jsx`（新）：固定3層+固定王的簡化地下城，不掛接挖掘/遠征/卷軸系統，戰鬥核心仍可重用 `DungeonBattleRoom.jsx`（帶一個 `simpleMode` flag 隱藏進階功能）。
- `src/components/member/GuestShareCard.jsx`（新）：沿用 `ShareCard.jsx` 的 `SHARE_THEMES` 視覺常數，內容改用 session 內累積的統計（今日箭數/擊敗清單/地城層數/金幣），需要在打怪/地下城/組隊過程中累積一個本地 session 統計物件（不用整合進正式的 `monsterDex`/`dungeonCollectibles` 也可以，但比較理想是共用同一套寫入邏輯，讓訪客資料轉正式後這些紀錄還在）。
- `src/components/member/KidMonsterBattle.jsx`（新，或用 `MonsterBattle.jsx` 加 `kidMode` prop）：加大按鈕、保底命中率（例如把 `resolveHitPart` 的脫靶機率再打七折之類，需要跟 `monsterData.js` 的命中判定邏輯對接，不是重新設計一套）、鼓勵動畫。

## 5. 後台

`src/components/admin/AdminKidMode.jsx`（新）：
- 場次管理（CRUD `campSessions`）
- 帳號列表（query `members where accountType in ["guest","kid"]`，可篩選 `sessionSourceId`）
- 轉正式：跳轉到既有「新增會員」表單邏輯，額外把來源記錄的 `id` 帶入，成功建立正式帳號後：`updateDoc(members/{id}, { uid: 新uid, accountType:"official", ...正式學籍欄位 })`（同一份文件原地轉換，不建立新文件）。
- QR/連結產生（比照現有 guest token 產生邏輯，改成 `?kid=sessionId` 或 `?guest=1` 這種免登入即可用的長效連結，不是3小時過期token）。

## 6. 既有官方查詢的 accountType 過濾稽核清單（初步，實作時需完整跑一次）

- `db.js::getMembers()`（line 51）：admin 會員管理列表，需排除 guest/kid（或改成可切換檢視）。
- `db.js::resetAllDungeonUsed`/`resetAllMonsterSessions`（line 2534/2541）：批次重置每日限制，訪客/兒童理論上也該重置，先不排除。
- `db.js::getMembersForBilling`（line 2994）：金流/收費對象，**必須**排除 guest/kid（他們不是繳費學生）。
- `MemberLeaderboard.jsx`／排行榜相關查詢：需排除，避免訪客洗榜。
- 檢定/競賽報名相關查詢：需排除（guest/kid 不該出現在檢定名冊）。

## 7. 風險

- Firestore 規則放寬（guest/kid 免uid比對）意味著任何登入的匿名使用者理論上能改到任意一筆 guest/kid 資料，這是已跟使用者確認接受的取捨，但要在後台管理畫面明確標示「訪客/兒童帳號安全等級較低，不存放真實付款/隱私資訊」。
- `contactRaw` 明碼存電話/信箱在 `members` 文件裡，要確認這符合資料保護考量（教練端能看到，一般查詢不會，因為 `list` 規則沒開放給訪客身份查詢別人）。
- 範圍極大，建議依 `implement.md` 分 Phase 逐步上線，不要一次全做完再測試。
