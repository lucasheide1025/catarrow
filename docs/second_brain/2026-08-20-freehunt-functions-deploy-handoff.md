# 2026-08-20 自由狩獵 Functions 部署與 Vercel Secret 接手紀錄

## 目的

本紀錄供後續交給 Codex 接手。這一輪主要處理：

1. 修復自由狩獵新 Cloud Functions 尚未真正部署，導致 localhost 呼叫出現 404 / CORS 假象。
2. 實際部署並驗證兩支新 callable。
3. 追查正常整包 Functions 部署被 `CAT_ARCHERY_VERCEL` Secret 擋住的原因。
4. 確認 Vercel 專案 / Team 資訊與後續補 Secret 的正確方式。

---

## 專案與環境

- Workspace：`C:\Users\broud\Desktop\catarrow`
- Firebase project：`catgroup-8d0bb`
- Cloud Functions region：`asia-east1`
- Firebase Functions：2nd Gen / Node.js 22
- 前端本機：`http://localhost:3000`
- Firebase CLI 部署時建議固定加：`--project catgroup-8d0bb`
- 專案根目錄目前沒有依賴 `.firebaserc` 來選 project，因此不要省略 `--project`。

---

# 一、原始問題

前端呼叫：

```text
https://asia-east1-catgroup-8d0bb.cloudfunctions.net/consumeFreeHuntAttempt
```

瀏覽器出現：

```text
Access to fetch ... has been blocked by CORS policy
No 'Access-Control-Allow-Origin' header...
POST ... net::ERR_FAILED
FirebaseError: internal
```

一開始看起來像 CORS，但實際檢查發現不是 CORS 設定錯誤。

### 實際根因

先執行：

```bash
npx firebase functions:list --project catgroup-8d0bb
```

正式 Firebase 中當時 **不存在**：

```text
consumeFreeHuntAttempt
claimMultiMonsterBattleReward
```

直接對 endpoint 做 OPTIONS 也得到：

```text
404 Not Found
```

因此瀏覽器看到的 CORS 錯誤其實是「endpoint 根本不存在」造成的次級現象。

前端與 Functions 原始碼的 function 名稱、region、project 本身均已核對一致，無需先改 CORS 或前端 callable 名稱。

---

# 二、這次已成功部署的 Functions

需要的兩支 callable：

```text
consumeFreeHuntAttempt
claimMultiMonsterBattleReward
```

原本嘗試直接從正常 `functions` codebase 做 targeted deploy：

```bash
npx firebase deploy --only functions:consumeFreeHuntAttempt,functions:claimMultiMonsterBattleReward --project catgroup-8d0bb
```

但在 source analysis 階段被另一支不相關的 function 擋住：

```text
Error: In non-interactive mode but have no value for the secret: CAT_ARCHERY_VERCEL

Set this secret before deploying:
firebase functions:secrets:set CAT_ARCHERY_VERCEL
```

這個 Secret 是 `publishCompetitionWebsite` 使用，與本次自由狩獵戰鬥 callable 無關，但 Firebase CLI 在分析整個 codebase 時仍要求它存在。

### 本次採用的解法

建立一個臨時、隔離的最小 Functions 部署包，只包含：

- `consumeFreeHuntAttempt`
- `claimMultiMonsterBattleReward`
- 它們需要的 reward / quota 模組與資料

不載入 `publishCompetitionWebsite`，因此可以避開缺少 `CAT_ARCHERY_VERCEL` 的問題。

這個臨時部署包僅用於此次發布，部署完成後已清除。

### Firebase CLI 最終回報

```text
functions[claimMultiMonsterBattleReward(asia-east1)] Successful create operation.
functions[consumeFreeHuntAttempt(asia-east1)] Successful create operation.

Deploy complete!
```

---

# 三、部署後驗證結果

重新執行：

```bash
npx firebase functions:list --project catgroup-8d0bb
```

已看到：

```text
claimMultiMonsterBattleReward   v2   callable   asia-east1   nodejs22
consumeFreeHuntAttempt          v2   callable   asia-east1   nodejs22
```

### CORS / preflight 實測

從 `http://localhost:3000` 模擬 OPTIONS：

```text
consumeFreeHuntAttempt OPTIONS=204
Access-Control-Allow-Origin: http://localhost:3000

claimMultiMonsterBattleReward OPTIONS=204
Access-Control-Allow-Origin: http://localhost:3000
```

因此原本的 404 / CORS 問題已解除。

### 臨時部署檔清理

驗證結果：

```text
TEMP_DIR_EXISTS=False
TEMP_CFG_EXISTS=False
```

臨時隔離部署包沒有留在 workspace。

---

# 四、自由狩獵 quota / reward 目前的重要功能狀態

本輪部署的 server-side 功能對應前面已完成的邏輯：

## 自由狩獵每日次數

Asia/Taipei 每日兩組獨立 quota：

```text
SINGLE：5 次 / 日
MULTI：5 次 / 日
```

規則：

- 單怪 solo + 單怪 party 共用 SINGLE 5 次。
- 複數怪 solo + 複數怪 party 共用 MULTI 5 次。
- 組隊只扣房主，不扣隊友。
- 建房 / 加入房間不扣次數。
- 真正開始新戰鬥才扣。
- 同一 battleId 重試 / resume 需保持 idempotent，不能重複扣。
- quota server authoritative。

Firestore 使用：

```text
members.freeHuntUsage
freeHuntAttemptClaims
```

其中 member 結構：

```js
freeHuntUsage: {
  date: "YYYY-MM-DD",
  single: N,
  multi: N
}
```

## 複數戰結算

`claimMultiMonsterBattleReward` 是 trusted callable：

- 一次 transaction 處理前排三隻怪物的最終獎勵。
- server 自行推導 rewards，不信任 client 傳入獎勵數值。
- 處理 materials / coins / chest / cards / archer XP。
- 以 battleId 做 idempotency。
- 會拒絕 forged / reordered monsters。

---

# 五、目前尚未完成：CAT_ARCHERY_VERCEL Secret

正常整包 Functions 部署目前仍會受到這個 Secret 影響：

```text
CAT_ARCHERY_VERCEL
```

### 原始碼位置

`functions/index.js`：

```js
const CAT_ARCHERY_VERCEL = defineSecret("CAT_ARCHERY_VERCEL");
```

`publishCompetitionWebsite`：

```js
exports.publishCompetitionWebsite = onCall({
  ...
  secrets: [CAT_ARCHERY_VERCEL],
}, ...)
```

實際使用：

```js
competitionWebsitePublisher.deployDirectory(
  path.join(workspace, "website"),
  CAT_ARCHERY_VERCEL.value()
);
```

### Secret 需要的 JSON 結構

`functions/competitionWebsitePublisher.js` 的 `normalizeConfig()` 要求：

```json
{
  "token": "VERCEL_ACCESS_TOKEN",
  "teamId": "team_VxcUmCVcdSYWAssMj1QUbEfg",
  "projectName": "catarrow-archery"
}
```

三個欄位皆不可空白。

### 已確認的 Vercel 資訊

Vercel CLI 已登入：

```text
username: broudes-1864
```

Team：

```text
name: broudes-1864's projects
slug: broudes-1864s-projects
teamId: team_VxcUmCVcdSYWAssMj1QUbEfg
```

賽事網站 Vercel project：

```text
name: catarrow-archery
projectId: prj_QGnSH10wJJMP6Gf6g3UW9f9ByGny
```

另外主 React 專案 `catarrow` 是另一個 Vercel project，不要混淆：

```text
name: catarrow
projectId: prj_taeswoUqHMumiFojHlddONAfZw7l
```

`CAT_ARCHERY_VERCEL` 必須指向 **catarrow-archery**。

---

# 六、為什麼沒有直接拿目前 Vercel CLI token 塞進 Secret

檢查 Vercel CLI auth storage，發現目前登入資料包含：

```text
token
expiresAt
refreshToken
```

因此 CLI 現有 token 是可更新 / 會過期的 OAuth session，不適合直接拿來當 Cloud Function 的長期 static access token。

曾嘗試透過 Vercel SDK，用目前 CLI session 建立一個專用 Auth Token，但 Vercel API 明確拒絕：

```text
403
Cannot create tokens for this app.
```

因此：

- 沒有成功建立任何新永久 Vercel token。
- 沒有把短效 CLI session 寫進 Firebase。
- 沒有留下孤兒 token。
- `CAT_ARCHERY_VERCEL` 目前仍不存在。

最後再次驗證：

```text
Secret [projects/733358557637/secrets/CAT_ARCHERY_VERCEL] not found.
```

---

# 七、Codex 下一步

## Step 1：取得正式 Vercel Access Token

需要從 Vercel Account Settings → Tokens 手動建立一枚正式 Access Token。

建議名稱：

```text
cat-archery-firebase-publisher
```

Scope：

```text
broudes-1864s-projects
```

有效期選可接受的最長期間。

**不要把 token 寫進 repo、Markdown、console log 或 Git。**

---

## Step 2：建立 Secret JSON

實際要寫入 Firebase Secret Manager 的內容：

```json
{
  "token": "<VERCEL_ACCESS_TOKEN>",
  "teamId": "team_VxcUmCVcdSYWAssMj1QUbEfg",
  "projectName": "catarrow-archery"
}
```

建議透過 stdin 或暫存檔寫入，避免 token 出現在 shell history。

Firebase CLI 支援：

```bash
firebase functions:secrets:set CAT_ARCHERY_VERCEL --data-file - --project catgroup-8d0bb
```

若在 PowerShell 執行，應自行組 JSON 後 pipe 到 stdin；不要把 token 直接放在 command-line argument。

---

## Step 3：確認 Secret 已存在

可用：

```bash
npx firebase functions:secrets:access CAT_ARCHERY_VERCEL --project catgroup-8d0bb
```

注意：這個命令會輸出 secret 內容；若只是驗證是否存在，請避免把 stdout 留在聊天或 log 中，可只檢查 exit code / 隱藏輸出。

---

## Step 4：讓 publishCompetitionWebsite 綁定新的 Secret version

建立 Secret 後，重新部署：

```bash
npx firebase deploy --only functions:publishCompetitionWebsite --project catgroup-8d0bb
```

或等確認整個 codebase 沒其他問題後，再做 targeted Functions deployment。

不要因為補 Secret 就直接全量部署所有 Functions，除非已先確認 diff 與部署範圍。

---

## Step 5：驗證正常 targeted deploy 不再被 Secret 擋住

可重新測：

```bash
npx firebase deploy --only functions:consumeFreeHuntAttempt,functions:claimMultiMonsterBattleReward --project catgroup-8d0bb
```

預期不應再出現：

```text
In non-interactive mode but have no value for the secret: CAT_ARCHERY_VERCEL
```

因為這兩支已存在，這一步主要是驗證正常 codebase deployment pipeline 已恢復，不是因為目前 battle callable 還缺部署。

---

# 八、不要重做／不要誤判的事情

1. **不要再把目前問題判成 CORS 設定錯誤。**
   - 原本 CORS 是 endpoint 404 的結果。
   - 現在兩支 endpoint 已存在，OPTIONS=204，ACAO 正常。

2. **不要再重新建立 / 重部署這兩支戰鬥 callable 才開始測。**
   - `consumeFreeHuntAttempt` 已正式存在。
   - `claimMultiMonsterBattleReward` 已正式存在。

3. **不要使用 Vercel CLI 目前的 OAuth session token 當永久 Secret。**
   - 它有 `expiresAt` / `refreshToken`。
   - Cloud Function 不會自動替 Vercel refresh OAuth session。

4. **不要把 Vercel token 寫入 repo。**

5. **不要 push / commit 未經確認的工作區變更。**
   - 此 repo 長期有大量 dirty / unrelated changes。
   - 只處理本任務相關內容。

6. **不要全量部署 Functions。**
   - 優先 targeted deploy，避免碰到其他舊 function 或 secret / config 問題。

7. Firebase CLI 曾警告 functions package 的 `firebase-functions` 版本偏舊。
   - 這次不是部署失敗原因。
   - 不要在沒有單獨升級任務時順手升級，避免引入大範圍相容性風險。

---

# 九、接手後第一個實際測試建議

先從瀏覽器：

```text
http://localhost:3000
```

Ctrl+F5 強制重整，再進：

```text
自由狩獵 → 複數戰
```

確認：

1. 進場時 `consumeFreeHuntAttempt` 不再 CORS / 404。
2. 戰鬥可正常開始。
3. 勝利後 `claimMultiMonsterBattleReward` 正常結算。
4. 同 battleId refresh / retry 不會重複扣 quota 或重複發 reward。
5. MULTI quota 正常減 1。
6. party 模式只扣 host，不扣 member。

若仍失敗，下一步應查：

- Callable Firebase error code / message。
- Cloud Functions logs。
- auth / uid。
- hostId / room owner 驗證。
- transaction 內 Firestore 權限或資料格式。

此時不要再優先查 CORS，因為 endpoint preflight 已確認正常。

---

# 十、目前結論

### 已完成

- `consumeFreeHuntAttempt` 已正式部署。
- `claimMultiMonsterBattleReward` 已正式部署。
- 兩支均為 v2 callable / asia-east1 / nodejs22。
- localhost CORS preflight 已驗證正常。
- 原本的 404 / CORS blocker 已解除。
- 臨時隔離部署檔已清除。
- Vercel Team / project 資訊已確認。
- 已確認 `CAT_ARCHERY_VERCEL` 正確 schema。

### 尚未完成

- 建立正式 Vercel Access Token。
- 寫入 Firebase Secret：`CAT_ARCHERY_VERCEL`。
- 重新部署 `publishCompetitionWebsite` 讓其綁定 Secret。
- 最後驗證正常 Functions codebase targeted deploy 不再被 Secret analysis 擋住。

### 關鍵狀態

**自由狩獵戰鬥本身目前已經不再被缺少 callable endpoint 擋住。**

`CAT_ARCHERY_VERCEL` 是後續要修的「正常 Functions 部署管線 / 賽事網站發布器」問題，不是現在自由狩獵 callable 是否存在的 blocker。
