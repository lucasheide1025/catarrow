# 訪客 / 兒童模式 UI 重製規格
> 日期：2026-07-10  
> 目的：讓訪客 / 兒童模式接近正式會員版的遊戲質感，並支援團康活動。  
> 狀態：Phase 1-6 已完成：首頁 / 單人打怪 / 組隊打怪 / 地下城組隊 / 世界王體驗入口與低價結算 / 角色與獎勵總覽。
> 補充：2026-07-10 已完成地下城舊式 `startsWith("guest")` 判斷清理，改用 `accountType` / `guestProfile`。
> 補充：2026-07-10 已完成訪客/兒童 sessionStorage 隔離，避免同裝置切換 QR 模式時讀到上一個角色。
> 補充：2026-07-10 已完成轉正式防呆，避免 official 帳號被重複轉換。
> 補充：2026-07-10 已完成 `db.js` 正式資料寫入防線，改查 `accountType` 排除 guest/kid。
> 補充：2026-07-10 已完成兒童場次回訪歸屬，後台可用原始場次或最近場次找到孩子。
> 補充：2026-07-10 已完成紀念卡強化，卡面會顯示金幣、裝備、材料、貓咪與最近世界王傷害。
> 補充：2026-07-10 已完成低階體驗轉蛋，僅產出低風險金幣回饋，不接正式貓村轉蛋池。
> 補充：2026-07-10 已完成世界王參戰場次打點，participants 會保存 accountType/sessionSourceId。
> 補充：2026-07-10 已完成世界王本場活動榜與後台場次彙整。
> 補充：2026-07-10 已完成訪客 / 兒童主視覺大改，登入頁、頂部狀態列、首頁、底部導覽與角色頁改成活動式深色遊戲介面。
> 補充：2026-07-10 已完成體驗商店深色化、初始 500 金幣、新手裝備包與體驗戰績紀念卡。

---

## 1. 核心決策

### 1.1 產品定位
訪客 / 兒童模式不是獨立小遊戲，也不是陽春 Demo。

它應該是正式版的「低階團康入口」：
- UI 質感接近正式會員版。
- 玩法盡量共用正式系統。
- 難度限制在 T1~T2。
- 獎勵低風險，不衝擊正式經濟。
- 支援多人一起玩，讓團康活動有共同參與感。

### 1.2 與前一版規劃的差異
先前討論曾傾向限制組隊 / 世界王。此文件更新為：

- 組隊打怪：開放。
- 地下城：開放，且必須接新版正式探索地下城，不使用舊簡化版。
- 世界王：開放，但使用低階 / 活動型弱化王。
- 多人活動是訪客 / 兒童模式的重要價值，不應關閉。

### 1.3 不變原則
- 差異在規則，不在質感。
- 優先共用正式元件，不重刻訪客專用戰鬥 UI。
- 訪客 / 兒童帳號仍是 `members` 文件，只是 `accountType` 為 `"guest"` 或 `"kid"`。
- 不再使用 `memberId.startsWith("guest")` 判斷訪客。新訪客 / 兒童帳號 doc id 是 Firestore 隨機 id，不會以 `guest` 開頭。
- 凡是進入訪客 render tree 的子元件，只要內部有 `useAuth()`，都要支援 `guestProfile` 或明確 profile override，避免教練裝置共用時誤讀教練資料。

---

## 2. 目標使用情境

### 2.1 新生體驗
新生第一次來射箭，使用訪客入口進入，快速體驗：
- 單人打怪。
- 組隊打怪。
- 地下城探索。
- 世界王活動。
- 裝備 / 貓咪成長感。

### 2.2 兒童團康
教練建立兒童場次，孩子掃 QR 進入：
- 大按鈕、少文字、短流程。
- 大家可以一起打同一隻王或同一個組隊怪。
- 地下城可以當小隊探索活動。
- 結算畫面重視徽章、怪物、貓咪與紀念感。

### 2.3 公司 / 團體活動
團康活動需要多人一起玩的內容：
- 教練建立活動。
- 參與者使用訪客 / 兒童帳號加入。
- 組隊打怪 / 世界王 / 低階地下城成為共同活動。

---

## 3. 功能開放矩陣

| 系統 | 訪客 | 兒童 | 限制 |
|---|---:|---:|---|
| 單人打怪 | 開放 | 開放 | T1~T2；低階怪物 |
| 組隊打怪 | 開放 | 開放 | T1~T2；弱化縮放 |
| 地下城探索 | 開放 | 開放 | 新版探索地下城；T1~T2 |
| 世界王 | 開放 | 開放 | 活動王 / 弱化王；不進正式高價榜 |
| 裝備 | 開放 | 開放 | 低階裝備；高階強化鎖定 |
| 貓咪 | 開放 | 開放 | 預設貓或低階貓；可得少量 XP / 羈絆 |
| 圖鑑 | 部分開放 | 部分開放 | 只顯示已遇到與低階內容 |
| 轉蛋 | 可展示 / 低階 | 可展示 / 低階 | 不給高價轉蛋池 |
| 交易市場 | 關閉 | 關閉 | 避免衝擊經濟 |
| 完整貓貓村 | 關閉或展示 | 關閉或展示 | 不開放生產 / 市集 |
| 決鬥 | 暫不開放 | 暫不開放 | 競爭與平衡風險較高 |
| 正式排行榜 | 不列入 | 不列入 | 可做活動榜 |

---

## 4. 新版首頁資訊架構

### 4.1 訪客首頁
目標：讓準會員看到正式遊戲的完整感。

主入口：
1. **單人冒險**
   - 進入正式風格打怪。
   - T1~T2 怪物。
2. **一起打怪**
   - 建立 / 加入組隊房間。
   - 顯示邀請碼。
3. **地下城探索**
   - 進入正式探索地下城。
   - 快速生成 T1 / T2 地下城，不顯示正式版三大來源系統。
4. **世界王活動**
   - 顯示目前體驗王 / 活動王。
   - 可直接加入攻擊。
5. **我的角色**
   - 裝備、貓咪、背包摘要、紀念卡。

底部導覽建議：
- 首頁
- 打怪
- 組隊
- 地下城
- 世界王
- 角色

### 4.2 兒童首頁
目標：短流程、大按鈕、低閱讀負擔。

主入口：
1. **出發打怪**
2. **大家一起打**
3. **探索地下城**
4. **打大魔王**
5. **我的貓咪與獎勵**

底部導覽建議：
- 開始
- 打怪
- 組隊
- 地城
- 大王
- 獎勵

兒童版文字原則：
- 避免長段說明。
- 按鈕用動詞。
- 結算用大圖、大數字、短句。

---

## 5. 頁面規格

### 5.1 單人打怪

共用元件：
- `src/components/member/MonsterBattle.jsx`

需要方向：
- 使用 `isGuest` / `kidMode` / `guestProfile` 或等價 profile override。
- 怪物池鎖 T1~T2。
- UI 不要另刻一套，沿用正式版戰鬥畫面。

限制：
- 不給正式高階掉落。
- 訪客 / 兒童不寫入正式排行榜。
- 可以保留低階材料、少量金幣、低階裝備、貓咪 XP。

注意：
- 現有 `MonsterBattle` 訪客流程仍有 `sessionStorage guest_won_once` 與訪客一次性紀念掉落邏輯。若新版訪客要變成持久進度，這段要重新整理，不能同時存在「持久帳號」與「session only」兩種語意。

### 5.2 組隊打怪

共用元件：
- `src/components/party/PartyLobby.jsx`
- `src/components/party/PartyBattleRoom.jsx`
- `src/lib/partyDb.js`

目標：
- 訪客 / 兒童可建立或加入 T1~T2 組隊房。
- 團康活動可讓多人用房號一起打怪。
- 結算每人各自領低階獎勵。

限制：
- 怪物只允許 T1~T2。
- HP 人數縮放要比正式版溫和。
- 不給正式高價寶箱。
- 不進正式排行榜。

高風險技術點：
- 現有 `PartyBattleRoom.jsx` / `partyDb.js` 仍有多處 `memberId.startsWith("guest")` 舊判斷。
- 新版訪客 / 兒童帳號是 Firestore `members` doc id，不會以 `guest` 開頭。
- 開放組隊前必須把訪客判斷改成明確欄位或參數，例如：
  - `accountType === "guest" || accountType === "kid"`
  - `guestProfile`
  - `isGuestMode`

### 5.3 地下城探索

共用元件：
- `src/components/dungeon/DungeonLobby.jsx`
- `src/components/dungeon/GuestDungeonEntry.jsx`
- `src/components/dungeon/DungeonExpedition.jsx`
- `src/components/dungeon/DungeonBattleRoom.jsx`

既有狀態：
- 2026-07-10 已做過訪客 / 兒童地下城整合。
- `GuestDungeonSimple.jsx` 已刪除。
- 訪客 / 兒童地下城已接正式迷霧探索與裝備結算路徑。

本次新規格要求：
- 保持新版正式探索地下城。
- 不回到舊的簡化地下城。
- 入口要更像活動入口：
  - 「探索 T1 地下城」
  - 「探索 T2 地下城」
  - 可加「團隊地下城」作為後續階段。

限制：
- `tierCap = 2`。
- 上游 UI 限制 T1 / T2。
- 戰鬥核心仍要在程式層再次 clamp tier，不能只擋 UI。
- 不顯示正式會員的挖掘 / 儲存槽 / 世界王卷軸三來源系統。

### 5.4 世界王活動

共用元件候選：
- `src/components/worldboss/WorldBossLobby.jsx`
- `src/components/worldboss/WorldBossAttack.jsx`
- `src/lib/worldBossDb.js`
- `src/lib/worldBossData.js`

目標：
- 訪客 / 兒童可以一起打同一隻低階世界王。
- 用世界王創造團康共同感。
- 活動結束給紀念型、低風險獎勵。

建議設計：
- 新增「體驗王 / 活動王」概念，不直接打正式高階世界王。
- 活動王可綁定 `campSessionId` 或 `guestEventId`。
- 排行榜只顯示本場活動參與者。
- 訪客可顯示傷害排名，但不進正式世界王獎勵榜。

限制：
- 世界王 HP / ATK / 反擊傷害要低。
- 獎勵以紀念、低階材料、少量貓 XP 為主。
- 不給正式世界王擊殺寶箱、前三名正式獎勵、尾刀高價紀念品。

既有技術狀態：
- `worldBossDb.js::attackWorldBoss` 已有 `isGuest` 參數。
- 目前 `claimWorldBossKillReward` 對 `mine.isGuest` 直接拒絕，正式擊殺獎勵不給訪客。
- 這符合「訪客可參與但不領正式高價擊殺獎勵」的方向。
- 2026-07-10 已完成第一版訪客 / 兒童世界王整合：
  - `WorldBossLobby.jsx` 改用 `accountType` / `guestOverride` 判斷，不再用 `memberId.startsWith("guest")`。
  - 訪客 / 兒童可進入正式世界王大廳與戰鬥室，會出現在參戰者與傷害排行。
  - 大廳的獎勵卡在體驗模式顯示「體驗版獎勵」，明確說明不領正式擊殺箱、王卡、排名獎、箭露。
  - `WorldBossAttack.jsx` 使用 `guestOverride` 作為 active profile，避免教練裝置登入狀態污染訪客數值 / 貓咪。
  - 訪客 / 兒童出戰完成後只給少量體驗金幣與貓貓 XP；不寫正式 practice log、不給射手 XP、箭露、扭蛋幣與正式擊殺獎。
  - 訪客 / 兒童使用世界王藥水或雇用機器人時，金幣會同步扣到體驗角色 `members` 文件。

已完成 / 後續方向：
- 目前先共用正式世界王事件，訪客 / 兒童以低價結算參與。
- 本場活動榜已用 `participants.{memberId}.sessionSourceId` 分組。
- 後台場次卡已可依 `sessionSourceId` 彙整最新世界王參戰人數、總傷害與最高傷害者。
- 後續若要做獨立活動王，可以再新增 `guestEventId` / `campSessionId` 到世界王事件本體，讓活動王血量與正式世界王完全分流。

### 5.5 我的角色

內容：
- 裝備摘要。
- 貓咪資料。
- 低階背包摘要。
- 本次活動紀念卡。
- 轉正式會員提示。

共用元件：
- `src/components/member/EquipmentPage.jsx`
- `src/components/member/RPGEquipPanel.jsx`
- 現有貓咪 / 分享卡元件可延伸。

限制：
- 高階裝備強化鎖定。
- 高階資源展示可以出現，但不要可操作。
- 兒童版可把裝備細節收進「獎勵」頁，不必讓小朋友直接管理複雜強化。

已完成：
- 2026-07-10 `GuestProfileHub` 已改成角色與獎勵總覽。
- 會顯示金幣、T1-T2 體驗狀態、裝備完成度、材料數、轉蛋幣、貓咪數。
- 裝備入口接 `EquipmentPage guestProfile`，避免讀到教練登入中的正式 profile。
- 商店入口接 `GuestShop`，金幣讀寫 `members/{memberId}.coins`。
- `GuestShop` 的金幣護符倍率已統一為 `2` / `3`；已啟動 UI 判斷也同步更新。

---

## 6. 視覺與 UX 原則

### 6.1 共用品質
- Header / 資源列 / 卡片語言要貼近正式會員版。
- 打怪、組隊、地下城、世界王都應使用正式系統視覺。
- 訪客 / 兒童首頁可以更簡化，但不應像另一套產品。

### 6.2 兒童模式差異
兒童模式差異在資訊密度，不在遊戲核心：
- 大按鈕。
- 大圖示。
- 少文字。
- 結算畫面更有成就感。
- 不改戰鬥數值去硬降難，避免觸發正式系統的戰力配對副作用。

### 6.3 鎖定提示
高階功能不要完全消失，可以用鎖定卡呈現：
- 「正式會員可挑戰 T3+」
- 「正式會員可參加高階世界王」
- 「正式會員可使用完整貓貓村」

但不要在兒童版塞太多推銷文字。訪客版可以明確提示轉正式保留進度。

---

## 7. 資料與權限規則

### 7.1 身份
訪客 / 兒童資料都在 `members/{id}`：
- `accountType: "guest"` 或 `"kid"`。
- 可以轉正式會員，沿用同一份文件。

### 7.2 Profile 傳遞
任何正式元件若要被訪客 / 兒童使用，需要支援：
- `guestProfile`
- 或 `profileOverride`
- 或 `isGuestMode + accountType`

不可在訪客 render tree 中讓子元件自行回退讀教練登入中的 `useAuth()` profile。

### 7.3 獎勵
訪客 / 兒童可拿：
- 低階材料。
- 少量金幣。
- 低階裝備。
- 貓咪 XP / 羈絆。
- 活動紀念獎勵。

不建議拿：
- 高階寶箱。
- 大量轉蛋幣。
- 正式世界王擊殺獎勵。
- 交易市場資產。
- 會影響正式經濟排行的獎勵。

### 7.4 排行榜
- 正式排行榜排除 guest / kid。
- 可新增活動榜、場次榜、本場傷害榜。
- 活動榜資料不應混進正式會員永久排行榜。

---

## 8. 建議實作階段

### Phase 1：UI 首頁與路由整理
狀態：已完成（2026-07-10，`src/pages/GuestApp.jsx`）。

目標：
- 重製 `GuestApp.jsx` 首頁資訊架構。
- 把訪客 / 兒童入口改成「單人、組隊、地下城、世界王、角色」。
- 先不改底層戰鬥，只整理導航與頁面容器。

驗收：
- 訪客與兒童進入後不再看到陽春 Demo 感首頁。
- 所有入口文案與狀態清楚。

完成內容：
- 底部導覽已改為「首頁 / 打怪 / 組隊 / 地城 / 大王 / 角色」。
- 首頁主入口已改成單人冒險、一起打怪、地下城探索、世界王活動、我的角色。
- 決鬥主入口已移除；決鬥仍不屬於訪客 / 兒童新版核心流程。
- 新增角色 Hub，集中裝備、體驗商店、紀念卡、金幣與進度保留提示。
- `npm run build` 已通過。

### Phase 2：單人打怪一致化
目標：
- 訪客 / 兒童使用正式 `MonsterBattle` 視覺。
- 整理訪客持久獎勵語意。
- T1~T2 限制明確。
- 補 `MonsterBattle` 的 `guestProfile` / profile override，避免教練裝置共用時讀到教練 `useAuth()` 資料。

驗收：
- 訪客打一場怪可正常結算。
- 不寫入正式高階獎勵。
- 不讀到教練 profile。

### Phase 3：組隊打怪開放
目標：
- 修掉 `startsWith("guest")` 舊判斷。
- 訪客 / 兒童可建立 / 加入低階組隊房。
- 結算每人各自領低階獎勵。

驗收：
- 兩個訪客 / 兒童帳號可同場組隊。
- 箭數、獎勵、房間狀態不混到教練帳號。
- 正式會員組隊路徑不回歸。

### Phase 4：地下城入口活動化
目標：
- 保持正式探索地下城。
- 改善訪客 / 兒童地下城入口 UI。
- 若要做團隊地下城，需另評估與正式多人地下城房間串接。

驗收：
- 訪客 / 兒童 T1/T2 地下城可完整跑完。
- 入口沒有挖掘 / 儲存槽 / 卷軸來源的正式複雜流程。
- 探索、房間事件、Boss、結算都使用正式探索版本。

### Phase 5：世界王活動入口
目標：
- 訪客 / 兒童可打體驗王 / 活動王。
- 活動榜與正式榜分離。
- 設計低階獎勵。

驗收：
- 多位訪客 / 兒童可看到同一隻活動王。
- 可以一起攻擊並看到傷害貢獻。
- 不可領正式世界王擊殺高價獎勵。

### Phase 6：角色 / 裝備 / 貓咪頁整合
目標：
- 角色頁顯示裝備、貓咪、背包摘要、紀念卡。
- 高階操作鎖定。
- 訪客轉正式提示清楚。

驗收：
- 兒童版不被複雜裝備資訊淹沒。
- 訪客版能理解「升級正式會員可保留進度」。

---

## 9. Claude 接手注意事項

### 9.1 優先閱讀
接手前先讀：
- `docs/second_brain/quick-ref.md`
- `docs/second_brain/changelog.md` 中 2026-07-09 / 2026-07-10 訪客兒童相關段落
- 本文件
- `src/pages/GuestApp.jsx`
- `src/lib/guestAuth.js`
- `src/components/member/MonsterBattle.jsx`
- `src/components/party/PartyBattleRoom.jsx`
- `src/components/party/PartyLobby.jsx`
- `src/components/dungeon/DungeonLobby.jsx`
- `src/components/dungeon/DungeonExpedition.jsx`
- `src/lib/worldBossDb.js`

### 9.2 不要踩的坑
- 不要新增 `id.startsWith("guest")` 判斷。
- 不要讓訪客 / 兒童元件讀到教練 `useAuth()` profile。
- 不要重刻戰鬥 UI。
- 不要把世界王訪客參與者塞進正式擊殺獎勵。
- 不要把 T1~T2 只擋在 UI；底層抽怪 / 抽王也要 clamp。
- 不要把正式會員功能改壞；所有 `guestProfile` / `profileOverride` prop 都應可選，沒傳時維持正式會員原行為。

### 9.3 建議測試清單
- 教練登入狀態下，掃兒童 QR 進入，確認畫面資料不是教練資料。
- 訪客單人打怪一場。
- 兒童單人打怪一場。
- 兩個訪客 / 兒童帳號組隊打一場。
- 訪客 / 兒童 T1 地下城完整跑完。
- 訪客 / 兒童 T2 地下城完整跑完。
- 多個訪客 / 兒童一起打活動世界王。
- 轉正式會員後，原本訪客 / 兒童資料仍保留。
- 正式會員打怪、組隊、地下城、世界王都正常。

---

## 10. 待確認問題

這些可以在實作前再跟使用者確認：

1. 活動世界王要不要綁定夏令營 / 團康場次？
2. 訪客 / 兒童組隊房最多幾人？是否沿用正式組隊上限？
3. 訪客 / 兒童世界王是否要有「本場 MVP」紀念徽章？
4. 訪客 / 兒童可否消耗藥水？
5. 訪客 / 兒童是否要開低階轉蛋？
6. 兒童模式結算是否要產生可下載紀念卡？

目前可先照保守預設：
- 世界王先做活動王，不混正式王。
- 組隊人數沿用正式上限。
- MVP 只顯示在活動結算，不寫正式成就。
- 低階獎勵可以持久化。
- 高價經濟功能先關閉。

---

## 11. 實作進度

### 2026-07-10 Phase 1
- `src/pages/GuestApp.jsx` 已重排首頁與底部導覽。
- 新導覽：首頁 / 打怪 / 組隊 / 地城 / 大王 / 角色。
- 角色 Hub 已集中裝備、體驗商店、紀念卡與進度保留提示。
- `npm run build` 通過。

### 2026-07-10 Phase 2 單人打怪資料來源
- `src/pages/GuestApp.jsx` 的打怪入口已等待 `guestFullProfile` 載入後才渲染 `MonsterBattle`。
- `src/components/member/MonsterBattle.jsx` 新增 `guestProfile` prop：
  - 訪客 / 兒童使用 `guestProfile || authProfile`。
  - `useCheckinActive` 在 `isGuest` 時不訂閱正式報到狀態。
  - 呼叫 `useCatCompanion(isGuest ? profile : null)`，避免貓咪資料讀到教練登入中的帳號。
- `src/hooks/useCatCompanion.js` 新增可選 `profileOverride`，正式會員不傳時行為不變。
- 訪客 / 兒童打怪勝利現在會把低階金幣與最多 1 個材料寫入自己的持久帳號，結算畫面會顯示「已存入體驗角色」。
- `src/components/member/GuestShop.jsx` 修正金幣護符倍率：原本 UI 寫 ×2 / ×3，但實際存 10 / 15；已改為真正的 2 / 3，避免新版持久金幣膨脹。
- `npm run build` 通過。

### 2026-07-10 Phase 3 組隊打怪接線
- `src/components/party/PartyLobby.jsx`
  - 建立 / 加入房間時會把 `accountType` 寫入成員資料。
  - 訪客 / 兒童不訂閱正式組隊歷史紀錄。
- `src/components/party/PartyBattleRoom.jsx`
  - 改用 `guestOverride` / `accountType` 判斷訪客，不再用 `memberId.startsWith("guest")`。
  - 訪客 / 兒童使用 `useCatCompanion(guestOverride)`，避免讀到教練登入中的貓咪。
  - 訪客 / 兒童勝利後給低階持久金幣與低機率材料，顯示「已存入體驗角色」。
  - 訪客 / 兒童不拿正式寶箱、怪物卡片、射手 XP、冒險者 XP，也不寫正式練習紀錄 / 圖鑑。
- `src/lib/partyDb.js`
  - `partyRooms.members.{id}.accountType` 已寫入。
  - `storeBattleRewards()` 可接 `{id, accountType}`，會跳過 guest / kid 的正式寶箱。
  - `claimBattleReward()` 新增 `options.isGuest`，訪客 / 兒童只標記請領，不寫正式寶箱 / 圖鑑。
- 已用 `rg` 確認 `PartyLobby.jsx` / `PartyBattleRoom.jsx` / `partyDb.js` 沒有殘留 `startsWith("guest")`。
- `npm run build` 通過。

待測：
- 兩個訪客 / 兒童帳號建立 / 加入同一組隊房。
- 訪客房主開房、正式會員加入，以及正式會員房主開房、訪客加入，兩種混合情境。
- 確認訪客 / 兒童勝利後只有低階持久獎勵，正式會員仍有原本寶箱 / XP / 練習紀錄。

### 2026-07-10 Phase 4 地下城入口活動化
- `src/components/dungeon/GuestDungeonEntry.jsx`
  - 訪客 / 兒童地下城入口改成「地下城探索活動」樣式。
  - T1 / T2 卡片改為活動式文案：T1 新手探索、T2 團康挑戰。
  - 文案明確說明使用正式迷霧探索版本，可單人或組隊。
- `src/components/dungeon/DungeonSelectionPanel.jsx`
  - 訪客 / 兒童不再隱藏「組隊探索」。
  - 訪客文案改為「團康組隊探索」，建立邀請碼讓大家一起挑戰低階探索地下城。
- `src/components/dungeon/DungeonLobby.jsx`
  - 訪客 / 兒童地下城首頁新增「加入團康地下城」入口。
  - 可輸入邀請碼加入，也可加入開放中的組隊地下城房間。
  - 訪客仍不顯示正式會員的挖掘 / 儲存槽 / 卷軸三來源。
- `src/lib/expeditionTeamDb.js`
  - 組隊地下城成員資料新增 `accountType`。
  - `claimTeamExpeditionResult()` 會辨識 guest / kid：
    - 金幣上限封頂為低階活動量。
    - 不給箭露。
    - 不給射手 XP。
    - 不給正式地下城寶箱。
    - 仍會標記請領與保留遠征紀錄。
- `src/components/dungeon/TeamExpeditionBattle.jsx`
  - 戰鬥房會把 `guestProfile` 傳給 `DungeonBattleRoom`，避免教練裝置共用時誤讀 `useAuth()`。
  - guest / kid 不觸發寶箱王高價加碼、不寫正式遠征首殺廣播。
- `npm run build` 通過。

待測：
- 訪客建立 T1 / T2 組隊地下城，另一位訪客用邀請碼加入。
- 訪客進入組隊地下城戰鬥時，獎勵與寫入對象是訪客自己的 `members/{id}`。
- 訪客 / 兒童結算不拿正式寶箱、箭露、射手 XP。
- 正式會員地下城挖掘、儲存槽、組隊遠征維持原行為。

### 2026-07-10 Phase 7 地下城舊判斷清理
- `src/components/dungeon/DungeonBattleRoom.jsx`
  - 新增 `isGuestMode = !!guestProfile || accountType in ["guest","kid"]`。
  - `useCatCompanion(isGuestMode ? profile : null)`，避免教練登入狀態污染訪客/兒童貓咪。
  - 地下城正式箭數累積、藥水庫存訂閱、卡片收藏訂閱、ready 重整同步、練習紀錄寫入都改用 `isGuestMode` 判斷。
  - 移除同檔以 `myId.startsWith("guest")` 判斷訪客的做法。
- `src/lib/dungeonDb.js`
  - `createDungeonRoom()` / `joinDungeonRoom()` 支援可選 `extraData.accountType`，成員資料預設 `official`。
  - `confirmDungeonEvent()` 的金幣事件改用 `members.{id}.accountType` 跳過 guest/kid。
  - `claimDungeonReward()` 支援 `options.accountType`，guest/kid 不領舊式正式金幣獎勵。
- `DungeonBattleRoom` 呼叫 `claimDungeonReward()` 時會傳入目前 profile 的 `accountType`。

### 2026-07-10 Phase 8 session 隔離
- `src/pages/GuestApp.jsx`
  - 訪客 / 兒童 profile session key 改為 `guest_v2_profile_${accountType}_${sessionSourceId || "default"}`。
  - 組隊進行中 session key 改為 `guest_v2_party_session_${accountType}_${sessionSourceId || "default"}`。
  - 組隊恢復資料會記錄 `memberId`，若與目前體驗角色不同會自動清除，避免上一位玩家的房間被下一位玩家接走。
  - 當同一分頁從 `?guest=1` 切到 `?kid=<sessionId>` 時，會主動重讀對應 session、重置組隊 / 世界王暫態並回首頁。

### 2026-07-10 Phase 9 轉正式防呆
- `src/lib/db.js::convertGuestToOfficial()`
  - 轉換前會確認原帳號仍是 `guest` 或 `kid`。
  - 如果已經是 `official` 或其他類型，會拒絕重複轉正式。
- `src/components/admin/AdminKidMode.jsx`
  - 轉正式建立 Firebase Auth 帳號時，臨時 app 名稱加入亂數，降低同毫秒操作撞名風險。
  - Email 會先 trim 再建立 Auth 帳號與寫入會員文件。
  - 轉正式提示會顯示來源是訪客或兒童帳號。

### 2026-07-10 Phase 10 正式資料層防線
- `src/lib/db.js`
  - 新增 `isGuestOrKidMember(memberId)`，以 `members/{id}.accountType` 判斷訪客/兒童；舊 `guest...` 前綴仍視為訪客以相容舊資料。
  - 以下正式系統寫入不再只靠 `memberId.startsWith("guest")`：
    - `addRoundArrows()`
    - `saveMonsterLog()` 的怪物圖鑑更新
    - `recordBattleDex()`
    - `recordPotionUsed()`
    - `addCardPack()`
    - `addMonsterCard()`
    - `addWorldBossCard()`
    - `checkAndGrantArrowMilestones()`
  - `recordPotionUsed()` 現在可接受單一 potion id 字串或陣列，避免把字串逐字元寫入圖鑑。
  - `addCoins()` 沒有改成排除 guest/kid，因為新版體驗帳號需要低階持久金幣。

### 2026-07-10 Phase 11 兒童場次回訪歸屬
- `src/lib/guestAuth.js`
  - 新兒童/訪客帳號會寫入 `sessionSourceId` 與 `lastSessionSourceId`。
  - 既有帳號再次掃不同兒童場次 QR 時，不搬動原始 `sessionSourceId`，但會更新 `lastSessionSourceId`。
- `src/components/admin/AdminKidMode.jsx`
  - 場次篩選同時比對 `sessionSourceId` 與 `lastSessionSourceId`。
  - 帳號卡片顯示原始場次與最近場次，方便教練辨識回訪孩子。

### 2026-07-10 Phase 12 紀念卡強化
- `src/components/member/GuestShareCard.jsx`
  - 可接收 `profile` 與 `wbResult`。
  - 卡面顯示金幣、裝備完成度、材料數、貓咪數。
  - 若有最近世界王結果，顯示最近世界王傷害。
- `src/pages/GuestApp.jsx`
  - 開啟紀念卡時傳入 `guestFullProfile` 與 `wbResult`。

### 2026-07-10 Phase 13 低階體驗轉蛋
- `src/pages/GuestApp.jsx`
  - 新增 `GuestGachaPanel`，從角色頁進入。
  - 每次消耗 1 枚 `gachaCoins`，獲得 8~24 金幣。
  - 定位為低風險活動回饋，不接正式貓村高價轉蛋池、不掉貓卡或世界王卡。
- `src/components/member/GuestShop.jsx`
  - 新增「體驗轉蛋幣」商品，花 60 金幣取得 1 枚 `gachaCoins`。

### 2026-07-10 Phase 14 世界王活動來源打點
- `src/pages/GuestApp.jsx`
  - `guestOverride` 會帶 `currentSessionSourceId`。
- `src/components/worldboss/WorldBossAttack.jsx`
  - 呼叫 `attackWorldBoss()` 時傳入 `accountType` 與 `sessionSourceId`。
- `src/lib/worldBossDb.js`
  - `participants.{memberId}` 會保存 `accountType` 與 `sessionSourceId`。
  - 後續若要做「本場活動榜」或活動王篩選，可直接用這兩個欄位，不需要回填歷史資料。

### 2026-07-10 Phase 15 世界王本場活動榜
- `src/components/worldboss/WorldBossLobby.jsx`
  - 訪客 / 兒童模式會用 `activeProfile.currentSessionSourceId || lastSessionSourceId || sessionSourceId` 找出目前活動來源。
  - 若世界王 `participants.{memberId}.sessionSourceId` 與目前活動來源相同，會額外顯示「本場活動榜」。
  - 本場活動榜只影響 UI 呈現，不改世界王血量、全體傷害排行、參戰人數加成或正式獎勵。
  - 舊參戰資料若沒有 `sessionSourceId`，不會被硬塞進本場活動榜；仍會保留在全體傷害排行。

### 2026-07-10 Phase 16 後台世界王場次彙整
- `src/components/admin/AdminKidMode.jsx`
  - 後台訂閱最新一筆世界王，讀取 `participants.{memberId}.sessionSourceId`。
  - 每張夏令營場次卡會顯示該場孩子 / 訪客在最新世界王的參戰人數、本場累積傷害與最高傷害者。
  - 這是營運回顧用 UI，只讀現有 participants，不新增世界王查詢、不改活動排行或獎勵結算。
  - 沒有 `sessionSourceId` 的舊世界王參戰資料不會歸入任何場次卡。

### 2026-07-10 Phase 17 世界王本機暫存隔離
- `src/components/worldboss/WorldBossAttack.jsx`
  - 世界王中途戰鬥暫存 key 從 `wb_battle_${event.id}` 改為 `wb_battle_${event.id}_${memberId}`。
  - 暫存內容會寫入 `memberId`，讀取時同時比對 `eventId` 與 `memberId`。
  - 訪客 / 兒童世界王備用金幣暫存 key 改為 `guest_wb_coins_${memberId}`。
  - 訪客 / 兒童世界王藥水暫存 key 改為 `guest_wb_potion_${eventId}_${memberId}`。
  - 目的：同一台平板連續給多位孩子掃 QR 時，不會讀到上一位玩家的未完成世界王戰鬥、備用金幣或藥水選擇。

### 2026-07-10 Phase 18 訪客 / 兒童主視覺大改
- `src/pages/GuestApp.jsx`
  - 新增 scoped CSS `GUEST_VISUAL_CSS`，只影響訪客 / 兒童模式。
  - 登入頁改成全螢幕遊戲入口，使用 `/ui/page-bg.webp` 與射手貓素材。
  - 登入後主畫面改成深色活動介面，包含固定頂部狀態列、金幣 pill、底部玻璃感導覽。
  - 首頁改為大型活動 hero、金幣 / 世界王狀態摘要、活動入口 grid，不再是白底一般卡片清單。
  - 角色頁改為深色角色卡、角色摘要 grid、角色功能活動卡。
  - 訪客與兒童共用同一套視覺骨架，但兒童 hero 使用較暖色活動調性。
  - 打怪、組隊、地下城、世界王的實際玩法入口保持原本正式元件，不重刻戰鬥邏輯。

### 2026-07-10 Phase 19 初始資金、體驗商店與紀念戰績
- `src/lib/guestAuth.js`
  - 新建 guest / kid 帳號給 500 初始金幣。
  - 既有 guest / kid 若沒有 `starterCoinsGranted`，下次登入會一次性補 500 金幣並標記，避免舊測試帳號停在 0 金幣。
- `src/components/member/GuestShop.jsx`
  - 商店改成深色活動視覺，修正白底與灰字標題對比不足。
  - 新增「新手裝備包」商品，花 240 金幣補齊 10 格普通 `rpgEquip`，並寫入 `unlockedEquipItems`。
  - 世界王藥水 key 改為 `guest_wb_potion_${memberId}`，避免共用裝置互相污染。
- `src/pages/GuestApp.jsx`
  - 體驗轉蛋機改成深色活動視覺，修正白底區塊與灰字看不清楚問題。
- `src/lib/db.js`
  - 新增 `recordGuestBattleStats(memberId, entry)`，只允許 guest / kid 寫入低風險體驗戰績摘要。
- `MonsterBattle.jsx` / `PartyBattleRoom.jsx` / `DungeonBattleRoom.jsx` / `WorldBossAttack.jsx`
  - 訪客 / 兒童完成戰鬥時會累積 `guestBattleStats`：戰鬥次數、勝場、箭數、總分、傷害與最近一次表現。
- `src/components/member/GuestShareCard.jsx`
  - 紀念卡顯示箭數、勝場、平均分、最近表現與傷害摘要。
