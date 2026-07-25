# Flash 執行指令書 — quick-ref.md 的 DB 清單機械修正

> ✅【已作廢 2026-07-25】此任務已改由 Claude 直接執行完成，本指令書不需再跑。
> ⚠️ 驗收發現：下方「改動 4」的第三列（舊 token 訪客 Session）是 **Flash 稽核時的幻覺**——
>    `quick-ref.md` 裡根本沒有 `createGuestSession` 舊機制，全檔早已是 `resolveGuestSession`。
>    保留此檔僅供記錄「Flash 會捏造不存在的落差」這個教訓。
>
> 出題與驗收：Claude。執行：Gemini Flash。
> 這是**純搬運/純改字**任務，零判斷。你只要照下面的對照表改 `docs/second_brain/quick-ref.md`，不准自由發揮、不准腦補新內容。

---

## 鐵則
1. **只改 `docs/second_brain/quick-ref.md` 這一個檔**。其他檔一律不准動。
2. **只做下面列出的改動**，不要順手改別的段落、不要重排、不要「優化」文字。
3. 下面的「新值」全部來自 `docs/second_brain/_audit/src-inventory.md`（已驗證的權威清單）。有疑問就去對照那份，不要自己編。
4. **禁止任何 git 指令。**

---

## 改動 1：修正 `const C` 集合常數名稱（約在 174-178 行）

把這幾行的常數名改對（集合名稱不變，只改右邊常數名）：

| 集合名稱 | ❌ 舊（錯） | ✅ 新（正確） |
|----------|-----------|--------------|
| `monsterSessions` | `C_MONSTER` | `C_MONSTER_SESSION` |
| `monsterLogs` | `C_MONSTER_LOG` | `C_MONSTER_LOGS` |
| `cardCollections` | `C_CARD_COLL` | `C_CARDS` |
| `monthlyCards` → 實際集合名是 `monthlyCardRequests` | `C_MONTHLY_CARD` | `C_MONTHLY` |
| `monthlyCardLogs` | `C_MONTHLY_LOG` | `C_MONTHLY_LOGS` |

> 注意 `monthlyCards` 這行：集合名稱本身也要從 `monthlyCards` 改成 `monthlyCardRequests`。

## 改動 2：補上 `C` 物件漏記的 6 個集合

`quick-ref.md` 的 `const C` 速查漏了這 6 個（都在 `src/lib/db.js:47-52`），請補進 `C` 清單：

```
campSessions          "campSessions"
shootingSessions      "shootingSessions"
gamePerformances      "gamePerformances"
arrowCountEvents      "arrowCountEvents"
memberPerformanceSync "memberPerformanceSync"
arrowRoundOperations  "arrowRoundOperations"
```

## 改動 3：補上漏記的「獨立 Collection 常數」

`quick-ref.md` 未列出的重要獨立常數（不在 `C` 物件，是各自 `const C_XXX`），請新增一個小節「獨立 collection 常數」，內容照抄 `src-inventory.md` 第 2.2 節的整張表（`C_NOTIF`/`C_MATERIALS`/`C_CHESTS`/`C_POTIONS`/`C_FRAGS`/`C_CARDS`/`C_CARD_MARKET`/`C_DEX_GRANT`… 全部）。**直接複製那張表過來即可，不要重寫。**

## 改動 4：標記已死函式（不要刪，改成警告）

以下項目 code 裡已不存在，但 quick-ref 還在推薦。**不要直接刪**，在該行前面加 `⚠️【已廢除】` 並註明替代方案：

| 位置 | 舊內容 | 處理 |
|------|--------|------|
| 約 221 行 | `subscribeTodayPracticeLogs(memberId, todayStr, cb)  // ← 用這個` | 前面加 `⚠️【已廢除，函式已不存在】` |
| 約 1164 行 | `DailyQuest.jsx ...（subscribeTodayPracticeLogs）` | 同上標記 |
| 約 271 行 | 舊 Token 訪客 Session（`createGuestSession`/`getGuestSession`/`deleteGuestSession`/`generateGuestToken`） | 前面加 `⚠️【已廢除，改用 src/lib/guestAuth.js 的 resolveGuestSession】` |

> 為什麼標記而不刪：保留「這東西曾經存在、現在沒了」的線索，避免未來有人又想加回來。

---

## 完工自查
- [ ] 只動了 `quick-ref.md`
- [ ] 改動 1 的 5 個常數名全部改對
- [ ] 改動 2 的 6 個集合已補
- [ ] 改動 3 的獨立常數表已從 src-inventory.md 複製過來
- [ ] 改動 4 的 3 處已加 `⚠️【已廢除】` 標記（沒有直接刪除）
- [ ] 沒動其他段落、沒跑 git

完成後回報改了哪幾行，交 Claude 驗收。
