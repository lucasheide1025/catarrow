## 2026-08-22 Current Implementation Override：單人地下城共用學籍 UI、Arcade 規則完全隔離

- 單人冒險主控制器改為 `ArcadeDungeonRun.jsx`，維持 **Local First**；`GridMapStage`／`BranchStage` 直接重用學籍地下城 presentation，但不重用 `DungeonExpedition` 的學生資料與 Firestore 流程。
- 五種重量房共用既有 UI：`DungeonShop`／`DungeonTrap`／`DungeonEvent`／`DungeonChest`／`DungeonRest` 全部走 `localMode`。HP、Buff、本趟金幣、房間／地圖進度只存在 `adventureSession`／IndexedDB。
- 戰鬥由 `ArcadeBattleScreenAdapter` 接 `BattleScreen`；`BattleScreen` 只負責輸入與演出，固定使用 `externalBattle + isolateStudentProgression + hideLeaveControl`。**唯一訪客戰鬥權威是 `arcadeBattle.resolveRound()`**，學生卡片、學生裝備、學生同行貓資料不會進 Arcade 計算。
- 同一 `runId` 的地圖與進度可在 reload／同瀏覽器接管後原樣恢復；訪客網格改用 seeded RNG，`expeditionGrid` 的既有學生呼叫若未傳 RNG 仍維持 `Math.random`，學生行為不變。
- 永久 `visitorProfile` 只在終局 `clear / retreat / defeat` 透過冪等 `applyArcadeSettlement()` 更新；途中按返回只暫停並保留 run，**不會提前把本趟戰利品存入永久進度**。
- 地下城：🌲貓森遺跡 2 層；🌙月夜迷城 3 層；🔥深淵巢穴 3 層。月夜／深淵最終層共用 `BranchStage` A/B/C 路線。深淵團滅會失去尚未帶出的本趟金幣，但仍取得 EXP。
- 永久訪客進度仍不做 Firestore profile sync；多人雲端只保留協調用途。
- 驗證：focused **6 suites / 30 tests PASS**；完整 Arcade **18 suites / 195 tests PASS**；`npm run build` PASS；scoped `git diff --check` PASS。
- 狀態：本機完成；**本次 ArcadeDungeonRun 共享地下城改動尚未 deploy / commit / push**。

## 2026-08-21 Current Implementation Override：組隊房號加入＋斷線恢復

- **QR 保留，房號補齊**：組隊仍可掃 QR；訪客大廳與錯誤恢復入口新增 5 位數房號，可手動加入或返回原戰鬥。
- **進房前只做一次權威確認**：`getTeamRoom()` 單次讀取確認房間存在、狀態與玩家身份；不新增 polling/heartbeat 讀取迴圈，維持 Local First / Cloud for coordination。
- **加入規則**：`waiting` 房允許新玩家加入；已開始的 `fighting/route` 房只允許仍在 `players` 的原隊員重連，知道房號的陌生玩家不能插隊。原隊員在保留期內也可回 `result/defeat` 看結算。
- **網路錯誤不等於房間不存在**：Firestore/getDoc/onSnapshot 暫時失敗時，不清 `currentTeamRoom`，也不丟掉尚未送出的箭；只有權威確認房間不存在、過期、對非隊員已結束，或玩家明確離開時才清 resume。
- **回合恢復**：本機存檔 round 與雲端 room.round 相同時恢復尚未送出的 arrows；雲端已前進到下一 round 時丟棄舊回合箭，避免重送舊資料。
- **同步救援**：即時監聽斷線時留在原戰鬥並顯示「重新同步」；人工按鈕才額外做單次權威 read。
- **房號常駐**：waiting、戰鬥、叉路、團滅與結算畫面都顯示 5 位房號，方便隊友口頭告知後重新加入。
- **身份邊界**：若既有 stale cleanup 已經真的把玩家從 `players` roster 移除，系統不會只因為知道房號就讓該 visitor 插回已開始房；這是防止房號外流造成中途插隊的安全限制。
- 驗證：`src/arcade` 11 suites / 155 tests 全通過；production `npm run build` 成功。

## 2026-08-18 Current Implementation Override：怪物 identity／世界王／新手 BOSS 平衡

本節代表目前實作，若下方較早章節仍出現「毒甲蟲／狼王／岩甲龜／森林魔王／月夜狼王／深淵魔王」、Boss 160/180/300 HP、打斷 45 分、全脫弱點圈傷害減半等敘述，視為歷史版本紀錄，以本節為準。

- 普通怪 gameplay id 為了存檔與技能相容不更名，但每隻怪以同一 `sourceMonsterId` 綁定 canonical 名稱與圖片：`goblin→temple_1 哥布林`、`beetle→insect_1 大蟑螂`、`wolf→temple_3 狼人`、`turtle→temple_2 骷髏劍士`、`ghost→ghost_1 鏡幕幽姬`。圖片一律 `/monsters/<sourceMonsterId>.webp`，禁止再獨立手寫另一張怪物圖。
- 單人 Boss 的名稱／稱號／描述／外觀直接讀學籍系統 `WORLD_BOSSES`：貓森=`forest_boss_small` 山魈頭領、月夜=`western_boss_small` 狼人首領、深淵=`ghost_boss` 怨靈大君；圖檔分別使用其 `pixelKey` 對應的 `forest_boss.webp`／`western_boss.webp`／`ghost_boss.webp`。
- **只重用世界王 identity，不重用學籍世界王能力。** 學籍正式世界王原 HP/ATK/DEF 不修改；訪客單人版三王皆 HP 115、DEF 1，ATK 依難度為 5／6／7。
- 單人 Boss 新手平衡：6 箭一回合，打斷大招門檻 36 分；弱點圈命中基礎傷害 bonus ×1.35；完全沒有射進弱點圈仍保留 ×0.8 傷害。
- 平衡驗收基準：第一次來的新手以 6 箭平均每箭 5 分＝30 分／回合，且 0 弱點命中。`(30 - DEF1) × 0.8 ≈ 23` 傷／回合，因此 115 HP 世界王第 5 回合擊敗；前三王在前四次反擊後玩家 HP 仍大於 0，不依賴貓咪技能才能通關。命中弱點、拿到 buff 或平均分更高時可少於 5 回合。
- 2026-08-18 回歸驗證：Arcade 131/131、全專案 231 suites / 2514 tests、production build PASS；8 張實際引用怪物／世界王圖檔均存在。此版目前僅本機完成，尚未重新部署。

# 貓小隊射箭場｜新版訪客冒險系統（第一版產品規格）

> 狀態：設計確認（2026-08-17，玩家主導）
> 定位：獨立於學生系統的新系統，固定在射箭場公告 QR 進入（QR 網址永不變）。
> 最高原則：**Local First / Cloud When Necessary / Account Last**

## 1. 產品重新定位

不要把這套系統設計成：

- 「學生系統的訪客版」
- 「射箭計分 App」

真正的定位：

> **射箭場裡，掃 QR 就能玩的手機 Arcade RPG。**

核心體驗：

> **射箭是主體，遊戲是第二層體驗。**

客人第一次來，不需要一開始就玩遊戲，正常射箭即可。當他開始覺得射箭→拔箭→射箭→拔箭有點重複時，現場只需要出現一句：

> **射膩了嗎？掃一下 QR，拿你的箭去冒險。**

掃描後直接開始。

## 2. 第一原則：遊戲先玩，帳號後補

禁止把以下流程放在遊戲開始之前：正式註冊、Email、密碼、Email 驗證、手機驗證、建立學籍、正式玩家帳號、大量角色設定、教學長文、複雜 RPG 選單。

目標：**掃 QR 後 10～20 秒內進入遊戲。**

流程：

```
掃 QR → 自動建立匿名 Visitor ID → 輸入暱稱 → 取得／選擇一隻同行貓 → 開始冒險
```

## 3. 技術架構：Local First

- 手機端優先採 **PWA／純前端遊戲 + IndexedDB**
- 第一次進入：下載必要素材 → 建立匿名玩家 → 本機保存
- 之後：即使網路不穩，也能正常單人遊戲

### IndexedDB 保存主要資料

```text
visitorProfile
├─ visitorId
├─ nickname
├─ selectedCat
├─ cats
├─ catLevel
├─ inventory
├─ coins
├─ dungeonProgress
├─ achievements
├─ statistics
└─ lastPlayedAt
```

主要遊戲狀態（HP、怪物、傷害、房間、地下城、貓咪、寶箱、Buff、道具、金幣、成就、探索進度）全部優先存在本機。少量 UI／設定資料可以使用 `localStorage`。

## 4. 不要把一般戰鬥塞進 Firestore

禁止設計成「射一箭→write、怪物扣血→write、貓咪攻擊→write……」的每步寫入。單人遊戲全部在手機完成。理想狀態：**99% 單人遊戲過程不需要資料庫讀寫**。這同時降低 Firestore 成本、延遲、網路問題、race condition、processing 卡死、資料同步 BUG、系統維護成本。

## 5. 真正需要雲端的只有少數功能

### A. 組隊
只有多人遊戲需要即時交換資料。同步內容盡可能小：

```text
anonymousPlayerId, roomId, nickname, cat, currentHp,
roundAttack, buff, heal, ready, battleComplete
```

**不要同步整份 visitorProfile。**

### B. 公開紀錄
例如今日最高傷害、今日最高地下城層數、Boss 擊殺、最長 Team Combo——只在產生最終結果時**上傳一次**。

### C. 跨裝置保存
預設不要。等玩家真的玩了一段時間後才問：

> **喜歡今天的冒險嗎？想下次換手機也能繼續嗎？**
> 【不用，保存在這支手機】／【保存我的冒險】

這時才考慮恢復碼、Email、Google、正式帳號、學生帳號。也就是「遊戲先玩，帳號後補」。

## 6. 必須告訴玩家本機保存限制

因為 IndexedDB 並非永久帳號，畫面適當位置標示：**「訪客進度保存在本裝置。」** 如果清除 Safari 網站資料、無痕模式、換手機、瀏覽器清除資料，可能遺失。不要讓玩家以為已經雲端保存。

## 7. 第二次來要比第一次更快

同一支手機再次掃 QR：

```
找到 visitorProfile → 歡迎回來，胖胖勇者！→ 🐱 哈吉已經在等你了 → 【繼續冒險】
```

不要重新註冊，甚至暱稱都不用再問。

## 8. 戰鬥核心：改變「射箭的目的」

這不是計分 App。例如玩家射 7、8、6：

- 一般射箭：21 分
- 遊戲：🐱 哈吉使出突擊！🎯 三箭 21 分 💥 哥布林受到 34 傷害！

玩家實際仍然只是在射三箭，但心理目的已變成「我要打死這隻怪」。

## 9. 怪物也可以改變玩家下一輪的射箭目標

- 🐺 狼王準備突進：下一輪至少 **2 箭進紅區** 就能閃避攻擊
- 🐢 岩甲龜進入防禦：射中 **1 箭黃心** 即可破甲
- 👻 幽靈進入隱身：三箭總分 ≥ 20 才能找到它
- 🐲 Boss 蓄力：**全隊總分 ≥ 60** 就能打斷大招

這才是真正把「實體射箭」和「手機 RPG」結合起來。

## 10. 基本戰鬥 UI 必須極簡

玩家只需要看到：

- 怪物：🐛 毒甲蟲 ❤️ 80 / 100
- 玩家：❤️ 100 / 100 🐱 哈吉
- 任務：🎯 本回合：盡量射高分！
- 三箭：`[ 8 ] [ 9 ] [ X ]` ＋【攻擊！】
- 結果：💥 27 DAMAGE → 🐱 哈吉追擊 +9 → 🐛 怪物反擊 -6 →【下一回合】

## 11. 複雜 RPG 數值藏在底層

系統內部可以有 `damageMultiplier / poisonResistance / criticalChance / catSkillChance / shield / defBreak / combo`，但訪客 UI 不要直接顯示數字。

- 不要「ATK +25%」→ 改成「🔥 火焰箭：下一場攻擊變強！」
- 不要「Poison Resist +50%」→ 改成「🌿 解毒草：這場比較不怕毒！」

## 12. 失誤也必須有娛樂效果

新手射 X X X，不要只顯示 0 DAMAGE，可以：

> 🐱 哈吉：「……還是我來吧。」 💥 **貓咪救援 +5**

九隻貓各自準備：命中台詞、高分台詞、失誤台詞、Boss 台詞、寶箱台詞，讓貓咪成為遊戲人格的一部分。

## 13. 寶箱

戰鬥後「🎁 發現寶箱！」三選一：

- 🔥 火焰箭：下一戰攻擊變強
- 🍙 貓咪飯糰：恢復生命
- 🌿 貓薄荷：下一戰貓咪特別有精神

底層可以是數值，訪客不用知道公式。

## 14. 組隊必須極簡

隊長按【和朋友一起玩】直接建立「隊伍 5827」並產生 QR；朋友掃 QR 立即加入，或輸入 `5827`。不要「建立房間→房間設定→Lobby→選怪→Ready→Start」的流程。

## 15. 第一版組隊只做 Team Attack

A:27 + B:24 + C:28 全部送出 → **TEAM ATTACK** → 27+24+28 → 💥 **79 DAMAGE！** 三隻貓一起衝出去。第一版不要：前衛、後衛、Tank、Support、仇恨、技能配置。

## 16. Team Combo

- 🔥 3 Hits → Combo ×1.1
- 🔥 6 Hits → Combo ×1.25
- ⭐ 9 Hits → **TEAM BREAK！**（全隊貓咪總攻擊）
- 🎯 **完美配合！**：全員本輪都沒有低於 5 分 → Team Damage ×1.5

## 17～21. 三種地下城

### 🌲 貓森遺跡（新手／教學／可愛探索，★☆☆）
10～15 分鐘，第一次玩的訪客優先推薦。流程：入口→小怪→寶箱→特殊事件→小怪→Boss。怪物弱、節奏快，自然學會射箭→攻擊→貓技能→寶箱→Boss，不需要閱讀教學。

### 🌙 月夜迷城（路線選擇／朋友討論，★★☆）
開始加入探索選擇（岔路：寶箱／神秘事件／菁英怪）。每打完一房「下一步走哪裡？」，組隊時所有人一起討論。樂趣是「我們走哪邊？」

### 🔥 深淵巢穴（高難度／進階合作／風險，★★★）
才逐步把學生地下城較深的東西拿回來（Tank/Attack/Heal/Buff/Debuff/Boss 機制/前後衛/特殊狀態/團隊任務），但仍用訪客能理解的文字包裝。加入「繼續還是撤退」：

> 🔥 深淵第 5 層完成！目前戰利品：🪙126 下一層：☠️ 高危險
> 【帶著戰利品離開】／【繼續深入 ×2】

團滅則尚未帶出的戰利品消失——產生非常好的重玩性。

### 學習曲線

| 地下城 | 玩家學到什麼 | 複雜度 |
|---|---|---|
| 🌲 貓森遺跡 | 射箭、攻擊、貓、寶箱 | ★ |
| 🌙 月夜迷城 | 選路、事件、合作決策 | ★★ |
| 🔥 深淵巢穴 | 職責、Boss、風險管理 | ★★★ |

複雜度是玩家自己往深處走才出現，不是一掃 QR 就全部砸到臉上。

## 22. QR 不只是一張

- 靶位 QR：🗺️ 開始冒險
- 休息區 QR：🐱 看看我的貓
- Boss 海報：👑 今日世界王
- 場內隱藏 QR：🎁 你發現神秘寶箱！（每個月換位置）

## 23. QR 可以連接實體空間

牆上「🐾 奇怪的貓腳印……」→ 掃描發現秘密通道 → 取得月夜迷城鑰匙。Boss 海報掃描直接開限定 Boss。遊戲與射箭場本身融合。

## 24. Session 與永久進度分開

本機保存 `visitorProfile`；每次來店另外建立 `adventureSession`（startedAt、dungeon、kills、damage、treasures、bossKills、teamCombo、finishedAt）。兩者都仍 Local First。

## 25. 遊戲結束頁非常重要

不要打完 Boss 就回首頁。一定要有漂亮的 Adventure Result：同行夥伴、擊敗怪物、寶箱、最高傷害、Team Break、Boss、冒險評價（S 級）。最好能產生**分享戰績圖片**讓朋友拍照／分享。

## 26. 到最後才問帳號

Result 最下面：「想下次繼續嗎？目前冒險已保存在這支手機。」【就這樣】／【☁️ 保存我的冒險】——只有第二個才進雲端流程。

## 27. 與正式學生系統的關係

兩套系統不要高度互相依賴。學生系統＝長期 RPG，訪客系統＝Arcade RPG。可在最後建立橋樑：訪客成為正式學生後得到「🎖️ 最初的冒險者」徽章（第一次進入貓森遺跡日期、第一次同行貓、特殊 Boss、訪客紀念徽章、少數成就轉進學生系統）。**不要把整份訪客資料硬轉。**

## 28. 第一階段實作清單

1. PWA
2. IndexedDB visitorProfile
3. 匿名 Visitor ID
4. 暱稱
5. 同行貓
6. 本機 Session
7. 三箭戰鬥
8. 怪物特殊射箭條件
9. 自動貓技能
10. 快速戰鬥演出
11. 寶箱三選一
12. 貓森遺跡
13. 月夜迷城基本選路
14. 深淵巢穴基本層數
15. QR 建立／加入隊伍
16. 最小化多人同步
17. Team Attack
18. Team Combo
19. Boss
20. Adventure Result
21. 本機保存提示

## 29. 第一階段不要做

完整正式帳號、完整學生資料同步、複雜裝備、技能樹、商城、大型經濟系統、九貓複雜養成、大量 Firestore 即時同步、完整前後衛、複雜 Tank/Heal/Support。第三地下城先留架構接口。

## 30. 技術上的最高原則

- 單人：**Local First**（IndexedDB 是主要遊戲資料來源）
- 多人：**Cloud for coordination**（雲端只負責協調不同手機）
- 排行榜：**Upload final result**（不要同步過程）
- 永久保存：**Opt-in**（玩家主動要求才上雲）

> **Local First / Cloud When Necessary / Account Last**

## 31. UX 驗收標準

- 掃碼 20 秒內能不能開始玩？
- 不用教學，第一次來的人知不知道下一步要做什麼？
- 60 秒內能不能完成第一次攻擊？
- 3 分鐘內有沒有寶箱／貓咪技能／事件？
- 5 分鐘內有沒有值得叫朋友看的畫面？
- 組隊是不是掃朋友 QR 就能加入？
- 網路突然斷掉，單人是不是照樣能玩？
- 玩完的人有沒有可能說：「再打一場。」

## 32. 射手競技場 PvP v1（2026-08-18）

PvP 仍遵守同一條最高原則：**Local First / Cloud for Coordination**。玩家的逐箭輸入、未送出的本回合、PvP 生涯戰績、動畫與可重建狀態都留在自己的瀏覽器；Firestore 只保存跨手機一定要共享的最小房間資料。

### 模式與人數

- ⚔️ 1 VS 1：固定 2 人
- 👑 大亂鬥：3～8 人
- 🛡️ 團隊戰：4／6／8 人，自動依加入順序交錯分成 A／B 隊
- 每回合可選 3 箭或 6 箭；3 箭模式 Max HP 80，6 箭模式 Max HP 130

### 傷害與保護

- 1～9 分：同分數傷害
- 10：15 傷害
- X：20 傷害（計分仍視為 10 分）
- 同一回合多人鎖定同一目標時，全體攻擊套用圍攻保護：1 人 ×1.00、2 人 ×0.85、3 人 ×0.70、4 人以上 ×0.55
- 全回合採同步結算，不因誰先按送出而改變結果
- 倒下後轉為「支援靈魂」，仍可繼續射箭；團隊戰可補同隊存活射手，大亂鬥／1v1 自動支援目前 HP 最低的存活射手

### Firestore 最小同步契約

房間仍使用 `arcadeRooms/{roomCode}`，並以 `kind:"duel"` 與既有 Team Adventure 區分。每位玩家每回合只覆寫自己固定的一顆：

```text
arcadeRooms/DUELSUB_{roomCode}_{sessionKey}_{encodeURIComponent(visitorId)}
  visitorId
  round
  targetId
  totalScore
  baseDamage
  tens
  xCount
  hits
  submittedAt
```

**不寫入逐箭陣列、不寫完整 visitorProfile、不做 heartbeat。** 每位玩家整場固定使用一顆 `arcadeRooms/DUELSUB_*` top-level submission 文件，每回合覆寫；只有房主對房內 2～8 顆 exact docs 訂閱，roster 不變時跨回合沿用同一組 listeners，其他玩家只訂閱 parent room。房主收齊後，用純函式結算並只寫一次共享 `combat / lastResolution / round / result`。結束清理直接依 parent room 已知的玩家 ID 批次刪除最多 8 顆 submission，不先 query，因此 cleanup 為 0 額外 read。此設計直接沿用既有 `arcadeRooms` production rules，不需要新增子集合 rule。 每個新房另存隨機 `sessionKey` 並放進 submission docId，避免 5 位房號未來重複時撞到舊場次文件；這項隔離不增加 Firestore read。

8 人一回合的設計上限大致是：8 次玩家 submission write + 1 次房主 parent result write；只有房主承擔 submission 變更 reads，其他 7 支手機完全不讀其他人的 submission。實際 Firestore 計費仍會受重連／listener 生命週期影響。

### 本機保存與重連

- QR：`?arcade&duel=XXXXX`
- IndexedDB 保存 `{ roomCode, round, arrows, targetId, localMatch, submittedRound, seenResolutionRound, resultSaved }`
- reload 後可接回同一場與尚未送出的箭，不需要為 resume 額外讀一套歷史資料
- `duelStats { matches, wins, damage, xCount, bestScore }` 是 **local-only**；`profileForCloud()` 在任何 `arcadeProfiles` 上傳前都會剝除 `duelStats`，避免其他 Arcade 功能日後同步時意外把 PvP 生涯送上雲

### 卡死保護

- 房主 lease 5 分鐘，不做背景 heartbeat；lease 過期後其他玩家可接管
- 一回合 4 分鐘後房主可強制結算，缺席玩家該回合視為 0 分
- 戰鬥中離開會標記 forfeited／spirit，不再列入必須提交者，避免整房卡死

實作檔案：`ArcadeDuel.jsx`、`arcadeDuelLogic.js`、`arcadeDuelDb.js`。2026-08-18 本機驗證：Arcade 126/126、全專案 231 suites / 2509 tests、production build 全部通過；尚未部署。

---

## 視覺系統（生成素材固定前綴）

正式命名：**「貓小隊童話冒險 RPG 視覺系統」**

風格定義：**童話冒險 × 手繪遊戲介面 × 射箭場實體活動海報**。核心不是一般宣傳海報，而是像一本可愛 RPG 冒險手冊：羊皮紙底、木質邊框、Q 版貓咪冒險者、地下城卡片、寶箱、怪物、靶紙與箭矢，用大量圖示把流程講清楚；色彩溫暖、飽和但不刺眼，偏森林綠、焦糖橘、深藍與火焰紅，讓小朋友、朋友團體與第一次來射箭的人都能一眼理解。

建議基底提示詞：

> 直式 A3 射箭場訪客遊戲說明海報，童話冒險 RPG infographic style，hand-painted storybook game UI，溫暖羊皮紙背景，厚實木質與皮革邊框，可愛 Q 版貓咪弓箭手角色，圓潤誇張表情，清楚的射箭靶、弓箭、寶箱、地下城入口、怪物與 Boss 插圖。整體像高品質手機 RPG 新手教學頁與冒險公會海報的結合，資訊分區清楚，大標題、卡片式流程、圖示優先、文字簡短，適合第一次來射箭的訪客快速理解。色彩使用森林綠、暖棕、金色、深夜藍、熔岩紅，柔和手繪陰影，細緻紙張紋理，帶一點奇幻中世紀冒險感，但保持明亮、友善、適合親子。不要科技感、不要現代企業簡報風、不要寫實人物、不要過度複雜 UI、不要陰暗恐怖風。

生成「訪客模式」素材額外加固定風格鎖定：

> **All visuals belong to the same Cat Archery Adventure visual system: cute chibi cats, cozy fantasy dungeon adventure, hand-painted mobile RPG UI, playful archery motifs, warm storybook atmosphere, immediately understandable for casual visitors.**

三個地下城子風格：

- **貓森遺跡**：翠綠森林、青苔石牆、陽光與可愛史萊姆
- **月夜迷城**：深藍月光、城鎮屋頂、紫色怪物與神秘岔路
- **深淵巢穴**：熔岩紅、黑色岩壁、龍與強烈火光（角色仍保持可愛，不做成黑暗魂系）
