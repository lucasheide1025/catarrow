# 📝 changelog — 變更日誌
> 每次功能完工後由 Claude 自動寫入。格式：日期 / 改了什麼 / 為什麼 / 踩坑提醒

---

## 2026-07-16（圖鑑 Phase 3：跨系統新分類 + 成就通知/紅點系統 + 修洪水 bug）

**為什麼**：多個系統（練習箭數/貓咪/貓村/裝備衝裝打洞符文/世界王/決鬥歷練/月卡）完全沒圖鑑；且成就通知綁在圖鑑頁、無首次基準 → 進圖鑑會洪水式重複噴 toast，打怪當下又不提醒。通盤規劃見 `docs/achievement-dex-master-plan.md`。

- **`achievementDex.js`**：
  - `DEX_CATEGORIES` 14→20：新增 practice/worldboss/cat/village/equip（＋既有）。
  - 新增 tiered 系列（讀 member 文件既有欄位或 ctx.cats）：`arrows_total`(totalArrowsAllTime)、`cat_collect/cat_level/cat_bond/cat_story`(cats 子集合)、`village_level/building_max`(village.buildings)、`equip_slots/equip_plus/equip_grade/equip_mythic/equip_socket/equip_rune`(rpgEquip：衝裝/打洞/符文)、`mode_duel`(決鬥總場次)。
  - 新增 single：`cat_all9`/`village_allbuilt`/`equip_full_mythic`/`equip_full_socket`。
  - `wb_trophy_*` 48 個獎盃 cat 從 special → **worldboss**。
  - **復活 `card_first`**（月卡已實裝，check 改讀 `monthlyCard.startedAt/active`）；`card_renew` 待 renewCount（Phase 4）。
  - 新增 `getUnlockedKeys(ctx)`（單次=id、tiered=`id#里程碑index`）＋ `describeKey(key)` ＋ `REPLACED_BY_TIERED`，供 App 層即時偵測與紅點共用。`computeDexStats` 收 `cats`。
  - ⚠️ 裝備讀 `member.rpgEquip`（db 寫入路徑），非 equipData.js 註解的 `equipment`。
- **新增 `src/lib/dexSeen.js`**：比照 `bookingSeen.js` 的 `seedIfFirstRun` 三件式，雙集合 notified（避免重複提醒）/ seen（紅點/NEW）。**根治洪水 bug**：首次載入把當下已解鎖全部標基準，之後才解鎖才算新。
- **新增 `src/components/member/DexUnlockToast.jsx`**：App 層成就解鎖提示（點擊前往圖鑑）。
- **`MemberApp.jsx`**：訂閱 cats、取 certRecords；App 層 `getUnlockedKeys` 偵測 → 即時跳 DexUnlockToast + epic↑ 發站內通知 + 「我的」nav 亮紅點（`dexUnseenCount`）。**偵測搬離圖鑑頁**＝打怪/練習/裝備任何地方解鎖都即時提醒。
- **`MemberDex.jsx`**：移除舊的洪水式 toast 偵測；改為進圖鑑＝凍結「未看」快照→標記已看清紅點（`onDexViewed` 回拋 App 重算）；DexCell 加 NEW 角標、分類頁籤加紅點；ctx 補 cats + 修卡片 cardCount。
- ✅ `CI=true npx react-scripts build` 通過。未部署、未實機測試。
- **待辦（Phase 4）**：`modeStats`（單人/組隊/地下城場次）、`expeditionsDone`、世界王統計、`drop_*` 掉寶、`monthlyCard.renewCount`、議會廳採集——都要各加 increment + 補 firestore.rules 白名單。

---

## 2026-07-16（圖鑑合併 Phase 2：巨量動態系列合併 + 計數修正）

**為什麼**：Phase 1 已把 8 個明顯系列做成 `TIERED_ACHIEVEMENTS`，但 `kill_*`(180格)/`chest_*`(28格)/`potion_{id}_*`/`dex_{fam}_t*`(36格) 這些 for-loop 動態巨量成就還沒合併，圖鑑仍超長捲動；且 `computeDexStats` 只數舊 `AUTO_ACHIEVEMENTS`、完全沒算 tiered → 標題「X/Y」和實際合併後格數對不上。

- **`achievementDex.js`**：在 `TIERED_ACHIEVEMENTS` 靜態陣列後新增 4 組 for-loop 生成（沿用上方 AUTO 用的常數）：
  - `kill_{monster}`（36 隻各 1 格）取代 `kill_{id}_{5,10,25,50,100}`；getValue=該怪 `monsterDex[id].wins`
  - `chest_{type}`（7 種箱各 1 格）取代 `chest_{type}_open_{1,5,10,20}`；getValue=`chestStats[type]`
  - `potion_{id}`（每藥水 1 格，濾掉 futureFeature）取代 `potion_{id}_{count}`；getValue=`potionDex.used[id]`
  - `dex_{fam}`（6 族各 1 格）取代 `dex_{fam}_t{1..6}`。⚠️ **語意調整**：舊版每格＝「擊敗該族第 N 級怪」不是單調值、套不進進度條；改為「擊破該族不同怪物數量(0~6)」，單調遞增。一族只 fam_1..fam_6 共 6 隻、fam_6 為神話怪，要 6 星必打過神話怪。
  - 每組 `replacesIds` 一定要列全對應舊 AUTO id，`cellsFor` 才濾得掉舊格。
- **`achievementDex.js::computeDexStats`**：改成①先收集所有 tiered 的 `replacesIds` 成 `replacedByTiered`，AUTO 跳過這些不計；②每個 tiered 用 `computeTierProgress` 的 `totalTiers`/`unlockedCount` 計格數。既有 8 組是 1:1（replacesIds 數＝tiers 數）→ 數字幾乎不變，加新系列也不會歪。
- **`MemberDex.jsx`**：⚠️ 修**既有 bug**——元件 ctx 只傳 `cardData` 物件、沒有 `cardCount`/`mythicCards`/`cardFamilies`，導致 `card_collect`(tiered)＋舊 `card_1..20`/`card_mythic`/`card_all6fam` 在**畫面與 toast 恆判 0**。改在 ctx 依 `cardData.cards` 推導這三值（跟 `computeDexStats` 內部同算法）。
- **待辦**：`drop_rare~drop_mythic` 死成就仍未修（需在戰鬥端補掉寶統計寫入，超出圖鑑重構範圍，另開處理）。
- ✅ `CI=true npx react-scripts build` 通過。未部署。

---

## 2026-07-16（訪客/兒童獎勵正式化：裝備操作、貓貓動畫、全部獎勵比照正式會員）

**為什麼**：訪客（有記憶 `accountType===guest`）與兒童（QR/一次性 `accountType===kid`）原本多處獎勵/功能被 `isGuest` 或 `kidMode` 限制，裝備唯讀、貓貓動畫看不見、戰利品不給。使用者要求兩種角色都「正常給」——獎勵、裝備操作、貓貓視覺全部比照正式會員。

- **`MonsterBattle.jsx`**：
  - 新增 `const isLimitedAccount = false`（取消所有限制閘門）
  - 移除 `if (isGuest)` 強制低屬性覆蓋（`{hp:100, atk:10, def:10}`），訪客/兒童走正式 `calcArcherStats` 計算真實射手屬性
  - 2 處 useEffect 依賴陣列從 `[profile?.id, isGuest]` 改 `[profile?.id]`（避免 stale closure）
  - 所有顯示層級（等級徽章、卡片加成、每日次數、回復提示、第二數值顯示區）均改用 `isLimitedAccount`（=false，全部顯示）
  - 修正 intro 時引入的重複 `if (!profile?.id) return;`
  - ⚡ 射手XP、貓XP/羈絆、寶箱/卡片/素材掉落、圖鑑記錄、藥水記錄、練習紀錄全部正常寫入

- **`PartyBattleRoom.jsx`**：
  - `isLimitedAccount = false`
  - **`isGuestPlayer = false`**（原為 `isLimitedAccount || me.accountType === "kid"`，導致 kid 帳號在 handleClaim 仍被跳過金幣/寶箱/素材/卡片/圖鑑/XP/練習/羈絆）

- **`DungeonBattleRoom.jsx`**：
  - `isLimitedAccount = false`
  - 地下城結算獎勵（金幣/寶箱/素材/圖鑑/箭露/XP/里程碑）全部正常寫入

- **`RPGEquipPanel.jsx`**：
  - `isGuestEquipReadOnly = false`（裝備可完全操作：強化、打洞、符文）
  - 移除 `equipMaxGradeAllowed` 未定義變數的 prop 傳遞

- **`GuestApp.jsx`**：
  - 加入 `CatBuddyProvider` + `<CatBuddy />`，訪客/兒童戰鬥畫面右下角顯示貓貓動畫

- ✅ `CI=true npx react-scripts build` 通過。未部署。

**為什麼**：新舊預約關係（改期產生的 cancelled+confirmed 配對）＋「已開始」guard 導致教練刪不掉/改不了；學生臨時要換方案但課已開始也卡死。

- **`bookingDb.js::cancelBooking(bookingId, options)`**：加 `options.force`（教練後台）跳過「已開始」與「非 confirmed」兩道 guard。⚠️ **計數器安全**：只有原本 `status==="confirmed"`（`wasHolding`）才釋放時段名額＋扣 `totalBookings`；force 取消已 cancelled/completed 的不再重複釋放，否則 `bookingSlotCounts` 會被扣爛。
- **`bookingDb.js::rescheduleBooking(...newEndTime, options)`**：加 `options.force`（跳過 30 分前置＋已開始）＋支援 `options.durationHours`/`options.planType` 覆寫（＝**變更方案/時數**）。改時數＝佔用連續格數變、但**人數不變**，沿用既有「新舊格淨變化」計數器邏輯，不動人數數學。呼叫端要自己算好對應 `newEndTime`。
- **`AdminBooking.jsx`**：教練按鈕**永遠顯示**（非 cancelled 都能取消、confirmed 都能改期）；已開始/已結帳的顯示「**強制取消/強制改期**」＋ `window.confirm` 二次確認；一律傳 `force:true`。改期 Modal 的 `RescheduleSlotPicker` 內建 `PlanDurationPicker`，可一步改方案/時數（換時數會清掉已選時段、驅動 `DateSlotPicker` 重查連續格；`endTime` 用「新起始＋新時數」重算不信 picker）。
- ⚠️ **規則零改動**：`firestore.rules` 的 `bookings.update` 本來就無條件放行 `isAdmin()`，不用貼 Console。
- ⚠️ **已知取捨**：強制取消 `completed`（已結帳）預約只改 `status`，**不動連著的 `billingRecords`**。若要一併退款/作廢帳務是另一條線。

---

## 2026-07-12（遠征隊灌值 + 建築產能上調 + 貓貓圖鑑加乘預留）

**為什麼**：鍛造上限到 50 級（一格 ~18,450 材料），但遠征隊完全沒發貓 XP/羈絆、材料杯水車薪、且高階 tier 掉不到（貓草包=driedfish 要 T4 才掉→根本開不了工）。**決策：鍛造成本不砍（維持長期目標），改灌遠征＋提高建築產能來餵。**

- **`expeditionData.js`**：①材料全域 `EXPEDITION_MATERIAL_BOOST = 4`；②T3~T5 補齊缺的 matKey tier（T3 加 ore_t3/meat_t2/driedfish_t1、T4 加 ore_t4/meat_t3/driedfish_t2、T5 加 ore_t5/meat_t5/driedfish_t3）打通死路；③每趟發 catXP（×貓戰力倍率、上限 800）＋catBond（固定值、上限 15），`calcExpeditionRewards` 吐出 `catXP`/`catBond` key。
- **`db.js::collectExpedition(memberId, slotIdx, rewards, catId)`**：加 `catId` 參數；把 `catXP`/`catBond` 從村莊資源迴圈排除，改呼叫 `addCatXP`/`addCatBond`（clamp 800/15）。⚠️ 原本會把任何 key 無腦寫進 `village.resources.${key}`，不接線的話 catXP 會變成假村莊資源。`ExpeditionPanel.jsx` 領獎補傳 `exp.catId`、`fmtRewardKey` 加「⭐貓咪經驗/💛羈絆」標籤。
- **`villageData.js`**：①`STAGE_MULTIPLIERS [1,1,1.1,1.2,1.4]→[1.2,1.4,1.7,2,2.5]`。⚠️ **關鍵**：stageMult **只作用於分層材料**（礦/肉/小魚乾/藥水＝鍛造料），**不影響箭露/扭蛋幣** → 提高鍛造料產能但**建築升級門檻（卡箭露）不變**，正好對到「升級需求不下修、但提高產能」。②**貓貓圖鑑生產加乘預留** `CATDEX_PRODUCTION_MULT = 1.0`，`calcPendingResources(village, { catDexMult })` 傳入放大全村產能，未實裝前恆為 1 不動平衡。
- ⚠️ 鍛造一格滿級成本：5 品質 ×（品質內強化 2,690 ＋轉品質 1,000）＝matKey ~18,450 ＋皮 125。弓/防具共用 ore（雙倍需求）。

---

## 2026-07-12（接手 FREEBUFF 戰鬥模擬器 `AdminBattleTest.jsx`：確認送出/放慢/靶面/打擊感）

Claude 接手修 4 項細節（主體由 FREEBUFF 寫）：

- **#3 分數要確認才送出**（原本第 6 箭自動結算跳關）：`SCORE_ARROW` 拆成「只記錄不結算」，滿 6 箭停在 SCORING；新增 `SUBMIT_ROUND`（按送出才扣怪/反擊/判勝敗）、`UNDO_ARROW`（刪最後一箭）。計分覆蓋層加「⌫ 刪除上一箭 / 🏹 送出這一回合」控制列，滿箭時鍵盤變灰停用。⚠️ `UNDO_ARROW` 用新增的 `computeUnlocked(arrows)` 從剩餘箭重算殭屍靶已解鎖部位，否則刪箭後解鎖狀態殘留。
- **#1 戰鬥過程放慢**：PROCESSING delay 逐箭 320→640ms（爆擊箭 820）、前後加緩衝、貓貓 450→1000、反擊 550→1100、結算 200→450。
- **#4 靶面＋鍵盤並存**（使用者選）：計分覆蓋層上方加 SVG `TargetFace`——分數仍用鍵盤，每箭依環數在靶紙留落點（世界射箭配色；`arrowMark(i,score)` 固定角度表+環數半徑帶算落點，穩定不亂跳；爆擊箭金色、最新箭脈動）。
- **#2 打擊感**：逐箭命中時怪物身上浮「-傷害」（爆擊放大金色）＋爆擊全螢幕金光 `critFlash`＋怪物 `hitShock` 亮白。新增 keyframes dmgFloat/critFlash/hitShock。⚠️ **`battleSound.js` 預設 `_mode="debug"` 只印 console 不出聲**，測試畫面要切 live 才有音效——「音效不足」有一半是這個。
- ⚠️ 此檔仍是 FREEBUFF 進行中的 WIP（git 未追蹤），Claude 只改細節；動戰鬥相關檔前要跟 FREEBUFF 對，避免 git 分岔。

---

## 2026-07-12（課表小卡定案版：時段分組小色牌）

- `BookingScheduleCard.jsx` **最終版式**（取代前兩版一列一筆的做法）：
  - 依**開始時段分組**，同時段的人併同一列；每人一個**小色牌**（可自動換行 flow layout）。
  - 色牌只顯示「姓名（多人加 ×N）」＋**新舊生**：🆕琥珀＝新生、藍＝舊生（`NEW_STYLE`/`OLD_STYLE`）。**不再顯示方案／時數**（教練只要知道這時段有誰、是不是新生）。
  - 尺寸再縮到 W=460，Modal 內 `max-w-[460px]`；header 加「新生／舊生」圖例。
- ⚠️ **踩坑（Canvas measureText 字級陷阱）**：週幾弽章的 X 位置用 `ctx.measureText(date).width` 算，但量測時 `ctx.font` 已切成弽章的 14px、日期實際是 900 28px → 量出來偏窄，弽章被推左壓住日期（「週日被遮住」）。**修法：在畫日期的 28px 字級當下先存 `dateW`，切字級前量。measureText 永遠回傳「當前 ctx.font」的寬度，跨字級量測前務必先量好存起來。**
- ⚠️ 版面高度需在設定 `canvas.width/height`（會重置 ctx）**之前**先用 ctx 量測分組/換行算出總高；量到的數字是純數值，重置後仍有效，重置後再 `scale` 並依存好的 layout 繪製。

---

## 2026-07-12（約課通知三改：小卡精簡 / 取消通知 / 修下一小時橫幅殘留）

- **課表小卡改精簡**：`BookingScheduleCard.jsx` 尺寸字級全縮（W 720→520、PAD 36→22、ROW_H 88→52、字級同比縮），原本「太大一片」，現在緊湊適合群組分享。
- **新增預約取消通知**：
  - `bookingDb.js::getRecentCancellations(n)`：依 `cancelledAt` desc 抓最近取消的（單欄位自動索引，client 再 filter `status==="cancelled" && cancelledAt`）。
  - `bookingSeen.js`：加**取消專用**已看集合（`LS_CANCEL`/`LS_CANCEL_INIT`，含 `seedCancelIfFirstRun`/`getCancelSeenSet`/`isCancelUnseen`/`markAllCancelSeen`）。⚠️ 故意跟新預約的 seen 分開——同一筆先亮「新」被取消後又要亮「取消」，共用集合會因 id 已存在而不亮。
  - `AdminBookingAlert.jsx`：紅色 ❌ 橫幅列出被取消的預約，音效 `sfxError`，教練點「知道了」→ `markAllCancelSeen` 整批標記已看即消失。
- **修 bug：下一小時橫幅點過不消失**：render 條件原本只看 `nextHour.length > 0`，沒看 `dismissedNextHour` → 教練點過音效停了、訊息卻殘留一直在。改用 `showNextHour = nextHour.length>0 && !dismissedNextHour` 統一控制顯示與 null-guard。⚠️ 這類「dismiss 後要整個消失」的橫幅，顯示條件與 sound gate 要用同一個 `show*` 布林，不能一個看 length、一個看 dismissed。

---

## 2026-07-12（新功能：今日課表小卡 PNG 匯出）

- **新檔** `src/components/booking/BookingScheduleCard.jsx`：把某一天已排定的預約畫成一張圖，教練下載 PNG 後貼到學生群組。
- **接入** `AdminBooking.jsx::CalendarTab`：日檢視工具列加「🖼 輸出課表」鈕（週檢視不顯示，用 `viewMode==="day"` 守）→ 開 Modal 顯示 canvas 預覽 + 下載鈕。傳入的 `bookings` 就是該天已載好的資料，元件內再 filter 這天+confirmed/completed 並依 startTime 排序。
- **做法**：用 Canvas 2D 直接繪製再 `toBlob` 匯出，**不加任何套件**（比照 Web Audio 音效 / SVG 怪物的零相依哲學，跨裝置最穩）。自製 `roundRectPath`（不靠瀏覽器原生 `ctx.roundRect`，兼容舊 WebView/OPPO）。高清輸出用 `Math.min(2, devicePixelRatio)*2` 當 scale。
- 卡片內容：場館名＋日期＋週幾徽章、每列（時段／時數／姓名(人數)／方案色條＋新舊生）、底部堂數。方案色：general 藍 / discount 綠 / own_equipment 橘。
- ⚠️ 用途取向＝「已排定課表通知」，會顯示學生姓名，Modal 內有提示只貼自己的學生群組。若日後要「招生用（只露空位不露姓名）」是另一種卡，需另做。
- ⚠️ 踩坑：`// eslint-disable-next-line react-hooks/exhaustive-deps` 在本專案 CRA 設定下會因「規則未啟用」變成**編譯錯誤**（不是警告）。本專案沒開 exhaustive-deps，別加這行 disable 註解。

---

## 2026-07-12（修 bug：後台線上約課行事曆卡住轉不停）

- **症狀**：後台「線上約課 → 行事曆」Spinner 一直轉、表格出不來。
- **根因**：`AdminBooking.jsx` 第 9 行的 `firebase/firestore` import **漏了 `where`**，但 190/191/530 行有用到。日曆 `load()`（183 行）在 `Promise.all` 內同步呼叫 `where(...)` 建 billingRecords 查詢 → 丟 `ReferenceError`。`load` 是 async 且在 `useEffect` 內無 `.catch`，例外變未處理 rejection，**209 行的 `setLoading(false)` 永遠跑不到 → loading 卡 true**。
- **修法**：import 補上 `where`（同時修好 530 行「結帳」查 billingRecords 的同一缺失）。
- ⚠️ 踩坑：Firestore 函式漏 import 在 dev 有時因快取不會立即炸，線上必壞。任何 async loader 的 `setLoading(false)` 要能保證執行（或 loader 內包 try/finally），否則一個同步例外就讓畫面永久卡 loading。

---

## 2026-07-12（平衡：怪物弱化/強化變體改浮動）

- `monsterData.js::applyVariant`：弱化/強化的 HP/ATK/DEF 倍率從固定值改**浮動區間**（原本弱化過頭×0.6、強化過頭×1.5/1.4）。
  - 弱化 weak：三圍 ×**0.78~0.92**
  - 強化 strong：HP ×**1.15~1.40**、ATK/DEF ×**1.10~1.30**
  - normal(×1.0) / boss(HP×2.0,ATK/DEF×1.6) 維持固定。
- 每隻怪生成時擲一次 `t`(0~1)，三圍用同一個 t 內插 → 一隻怪強弱一致（不會血厚攻低），整場固定不變（抽怪那刻定案）。
- ⚠️ 戰鬥實際走 `applyVariant`(內部 `VARIANT_RANGE`/`VARIANT_FIXED`，原 `VARIANT_MULT`)；`monsterConfig.js::VARIANT_CONFIG` 的 hp/atk/def 是**死資料**（`getMonsterVariantStats` 無人呼叫），只有它的掉落倍率 dropMult/coinMult 才在用。要調戰鬥強度改 monsterData 這張，不要改 monsterConfig。

---

## 2026-07-12（組隊地下城 batch 3：增益分層 + 放棄分流）

### 增益拆兩桶（藥水戰鬥級 / 事件商人樓層級）
規格：戰鬥藥水＝該場用、打完歸零；事件/商人增益＝該層用、換樓或結束才清。
- `members.{id}.buffs`＝**樓層級**（事件/商人）。`members.{id}.potionBuffs`＝**戰鬥級**（藥水）。
- `applyDungeonCarryPotion` 改寫 `potionBuffs`（原本寫 buffs → 被 `syncTeamExpeditionMembers:359` 帶回 teamRoom 跨場，這就是藥水跨場根源）。
- 傷害計算（dungeonDb 309/310/441）兩桶相乘：`buffs.xMult * potionBuffs.xMult`。
- `startRoomBattle` 恢復繼承 teamRoom 的樓層 buffs（同層多場帶著）+ 每場乾淨 potionBuffs。
- 換樓歸零：`startFloor`（組隊）清 teamRoom.members.buffs；`advanceDungeonFloor`（單人）清 buffs + potionBuffs。
- potionBuffs 不被 sync 回 teamRoom（syncTeamExpeditionMembers 只同步 buffs），故打完該場自然消失。

### 放棄分流
`handleAbandon` 本來就依 isHost 分流（房主→設 completed/abandoned + cleanupTeamExpeditionRoom 全隊解散；隊員→leaveTeamExpeditionRoom 自己離開）。放棄按鈕經 handleLeave→onExit→handleAbandon 已正確觸發，只補確認框文案依 isHost 區分。

### 踩坑提醒
- 組隊遠征增益資料流：事件/商人房操作 teamRoom（roomId=teamRoomId）→ 寫 teamRoom.members.buffs；戰鬥房是獨立 dungeonRoom，`syncTeamExpeditionMembers` 把戰鬥房成員 hp/buffs 同步回 teamRoom（會跨場）。要「戰鬥級」不跨場的東西一律放 potionBuffs（不進 sync）。
- 新增任何「戰鬥中暫時增益」都要想清楚是樓層級(buffs)還是戰鬥級(potionBuffs)，並在傷害計算把新桶乘進去。

---

## 2026-07-12（組隊地下城 batch 2：今日箭數/里程碑、藥水跨場、放棄鈕）

- **今日箭數/里程碑破案**：`DungeonBattleRoom.handleClaimSelf` 在 `expeditionMode` **早退 return**，跳過了 practiceLog(今日箭數來源)+`checkAndGrantArrowMilestones`(里程碑)，只有非遠征模式才寫。→ 組隊遠征今日箭數/里程碑永遠不增加（總箭數 totalArrowsAllTime 走 addRoundArrows 每回合正常）。已在 expeditionMode 分支 return 前補回這兩個「個人紀錄」（金幣/寶箱仍由遠征系統發）。今日箭數＝當日 practiceLogs.totalArrows 加總，不濾來源。
- **藥水/事件增益跨場**：`TeamExpeditionBattle.startRoomBattle`(392行)建新戰鬥房時 `buffs: m.buffs || {default}` 會**繼承上一場**的 buffs。改成每場一律乾淨 buffs → 戰鬥藥水/踩事件增益打完該場就歸零，不帶到下一場/下一層。（先前 `advanceDungeonFloor` 的 buffs 重置只管非遠征的單房多層路徑，遠征是每房開新戰鬥房，要在建房時重置才有效。）
- **戰鬥中放棄鈕**：`DungeonBattleRoom` expeditionMode header 新增「🏳️ 放棄」+ 二次確認框，接既有 `onExit→onAbandon(handleAbandon)` 結算流程。解決「怪太強打不死、卡在戰鬥出不去」。
- 戰鬥中顯示會員本名：其實已被前一批暱稱修正涵蓋（`startRoomBattle` 用 teamRoom 成員 name，來源是 DungeonLobby 的 myName=nickname）——但只對**修正後新開的組隊房**生效，舊房仍是舊名。

---

## 2026-07-12（組隊地下城多項修正 + 全站暱稱優先顯示）

### 組隊地下城
- **換樓層 buff 歸零**：`advanceDungeonFloor` 換樓時把所有成員 buffs(atk/def/dmg 倍率、復活)重置，藥水/踩事件增益不再帶到下一層。
- **箭數/里程碑**：診斷確認 `addRoundArrows`/`totalArrowsAllTime` 每回合寫入其實成功；真正缺的是**今日箭數里程碑**——地下城結算(win/lose)有寫 practiceLog(今日箭數來源)卻沒呼叫 `checkAndGrantArrowMilestones`，故里程碑不觸發。已補上。⚠️ 今日箭數/里程碑在**整場結算時**記入(靠 practiceLog)，非每回合；終身箭數才是每回合累積。
- **已清房間重觸發戰鬥**：`TeamExpeditionBattle.enterExplorationRoom` 判斷順序錯，戰鬥房(battle/elite/boss)判斷排在 `room.cleared` 之前，導致已清房回頭踩會重打。把 cleared/樓梯/入口檢查移到戰鬥判斷之前。

### 全站顯示暱稱優先（nickname || name）
- 多處寫入端誤用 `profile.name`：組隊地下城建房/加入(`DungeonLobby.myName`)、遠征成員資料與名牌(`DungeonExpedition` 3 處)、地下城公告廣播(`TeamExpeditionBattle.myName`)、採集組隊(`GatheringPartyPanel.memberName` 順序寫反)。統一改 `nickname || name`。世界王/組隊打怪原本已正確。

### 踩坑提醒
- 「今日箭數」的真相來源是**當日 practiceLogs 的 totalArrows 加總**（`checkAndGrantArrowMilestones` 內部就是這樣算），跟 `totalArrowsAllTime`(終身)是兩套。地下城要影響今日箭數/里程碑，一定要寫 practiceLog + 呼叫 checkAndGrant。
- 顯示名字一律 `nickname || name`；未來新增任何「把玩家名字存進房間/公告/參戰」的地方都要遵守，不要直接用 `profile.name`。

---

## 2026-07-12（Google×密碼 自動連結共存）

- `useAuth`：Google 登入若撞 `auth/account-exists-with-different-credential`（同 email 已有密碼帳號、專案設「一個 email 一個帳號」），暫存 Google 憑證（模組級 `pendingGoogleCred`）並拋 `auth/link-password-required`。新增 `linkGoogleWithPassword(email,password)`：用密碼登入既有帳號後 `linkWithCredential` 綁上 Google，之後兩種登入方式共存。
- `LoginPage`：撞到時顯示「輸入密碼連結 Google」小表單（連結並登入／取消）。
- 已連結過（provider-already-linked / credential-already-in-use）視為成功忽略。

---

## 2026-07-12（防堵 Google 登入孤兒帳號 + 教練新增帳號撞 email 的救援）

### 問題
教練後台新增學員時報 `auth/email-already-in-use`，但會員中心/訪客中心都找不到這個 email。
根因：學生在主登入頁**用 Google 登入**（`useAuth.loginWithGoogle`），Firebase Auth 當下就建了帳號，
但這人還不是學員（members 無對應文件）→ 帳號殘留在 Auth 層（會員/訪客中心讀 Firestore，看不到），
卻擋掉教練用同 email 建帳號。且 Google 帳號沒有密碼，無法用密碼連結。

### 修法
- `useAuth.loginWithGoogle`：popup 成功後三查（admins/uid、members/uid、members/email），
  **確定都查無**才 `cred.user.delete()` 刪掉這個剛建的孤兒帳號並拋 `auth/no-member-profile`。
  查詢失敗一律不刪（避免誤刪正式會員）。`LoginPage` 顯示「請先請教練建立帳號」。
- `AdminMembers` AddMemberModal：撞到 `email-already-in-use` 時，用教練填的密碼試登入既有帳號 →
  查無會員就補建 members 文件（認領密碼型孤兒帳號）；密碼不符則提示可能是 Google 帳號，
  引導去 Firebase Console 刪除。

### 踩坑提醒
- Google 登入成功的瞬間 Auth 帳號就建立了，前端無法「不建立」；只能靠剛登入者 `delete()` 自己善後。
- 刪除孤兒**只能刪查詢成功且確定為空**的情況；transient 查詢失敗刪帳號會誤殺正式會員。
- 此修復防堵「未來」的孤兒；已卡住的那個要嘛請學生再 Google 登入一次自動清除，要嘛教練到
  Firebase Console → Authentication 手動刪。前端無權限刪別人的 Auth 帳號。
- 教練用 email/密碼建的會員 uid 是密碼型；同人之後用 Google 登入時 email 相符會被 useAuth 的
  email 備援查詢補寫 uid（帳號連結），不會被當孤兒刪除。

---

## 2026-07-11（卡片動作列移到卡片下方）

- `CardCollection`：點卡片後，裝備/卸下/設為稱號/升星/選屬性按鈕不再擠在小卡片裡，改成格線下方一條全寬動作列（大顆好按），選取時 `scrollIntoView({block:"nearest"})` 自動捲入畫面；卡片內動作區塊與 `.selected` 撐開 CSS 移除。

---

## 2026-07-11（經驗值/掉卡/採集大改版 + 卡片 UI 修復）

### 經驗值重新分配
- **單人打怪**（MonsterBattle）：移除冒險者 XP（含結算顯示自動隱藏，因 gainedXP 不再 set）。保留 射手（主）＋貓XP＋貓羈絆(+1)。
- **組隊**（PartyBattleRoom）：移除冒險者 XP。保留 射手＋貓XP＋貓羈絆(+2)。
- **地下城**（DungeonBattleRoom）：本來就無冒險者 XP；**補上貓羈絆 `addCatBond("dungeon")`+2**（原本只有貓XP）。
- **世界王**（WorldBossAttack）：**新增冒險者 XP**＝射手 XP 同額（bossXP）。射手/貓XP/貓羈絆本來就有。
- 結論：冒險者 XP 現在只從「世界王 + 公會任務」取得，不再每隻怪都給。

### 掉卡
- **地下城不再掉怪物卡片**：移除 `DungeonExpedition` 的 `addMonsterCard` + 寶藏顯示 + `DungeonTreasureRoom` 卡片列。（上游 `loot.card` 仍會算但無人消費＝無害死資料。）
- **單人/組隊固定 20%**：`lootTable.rollCardDrop` 預設改 flat `CARD_CHANCE`(0.20)，不再依 mode 縮放；MonsterBattle 呼叫拿掉 mode 參數。

### 採集（GatheringRun/PartyPanel → completeCouncilSession，contractVersion≥2）
- 本來就無射手/冒險者 XP。**放大**：`catVillageGathering.calculateGatheringRewards` 村材料 ×3、貓XP ×1.6、貓羈絆 ×1.5。
- `completeCouncilSession` 上限放寬：村資源 50→150、貓XP 500→800、羈絆 10→15。
- ⚠️ CouncilBattle / GatheringBattle（有射手XP那支）是**死代碼**（無任何 render），未動。

### 卡片 UI（CardCollection）
- 卡片變小：瀏覽區 `grid-cols-2`→`grid-cols-3`。
- 去白底：`.monster-real-card` 及子元素（art/statline/lore/equipped/upgrade-note）全改深色卡面＋淺字，跟世界王卡一致。
- 按鈕不再被遮：`.selected` 時 `aspect-ratio:auto; overflow:visible` 讓卡片撐開顯示裝備/卸下/設為稱號。
- **世界王卡稱號前台顯示**：`MemberProfile` 名字下方新增稱號徽章（讀 `cardData.activeTitleBossKey` → `wbCards[key].title` / `WB_CARDS[key].title`）。原本稱號只有 CardCollection 內部讀，前台完全沒接。

### 踩坑提醒
- 冒險者 XP 顯示：MonsterBattle 的 `gainedXP` state 保留但不再 set，`{gainedXP>0 && ...}` 自動隱藏，未拆 JSX（低風險）。
- 世界王冒險者 XP 加在「每次攻擊」路徑（WorldBossAttack:769 旁），與射手 XP 同源同額，非結算路徑（worldBossDb 是擊殺均分獎勵，另一條）。
- 採集只放大「貓貓村材料（村資源）」，怪物素材 materialCount 未動——升級裝備素材沿用打怪/地下城，避免抵銷剛做的裝備升級 nerf。
- 稱號徽章目前只加在 MemberProfile；若要 MemberHome/排行也顯示需各自接 cardData/訂閱。

---

## 2026-07-11（平衡：裝備升級材料需求改 plusLevel 遞增曲線 + 整體 +30%含金幣）

### 改了什麼
- `equipData.js::generateRandomMats(grade, plusLevel)` 新增 `plusLevel` 參數 + `_PLUS_MAT_COUNTS` 曲線表。材料數量（主族/副族/關鍵素材）隨 +等級遞增，合計：+0=8、+1=10、+2=16、+3=20、+4=26 個，每品級總消耗 30→80（約 2.7 倍，後段變重、前段幾乎不變）。
- `equipData.js::EQUIP_UPGRADE_COST` 金幣整體 ×1.3：common 130 / rare 390 / elite 1040 / epic 2600 / legend 6500 / mythic 13000。
- 三個呼叫點都串入 plusLevel：`db.js` upgradeEquipSlot 的 `generateRandomMats(newGrade, newPlusLevel)`、`RPGEquipPanel.jsx` openSlot（`equip.plusLevel`）與首次裝備（`common,0`）。

### 為什麼
- 原本同品級內 +0~+4 材料需求固定 6 個 + 金幣固定，配上一場戰鬥掉 3~7 個材料（掉落率**刻意不動**，保留學生打怪即時回饋/多巴胺），導致後段秒升。改用「墊高消耗」而非「砍 faucet」拉長節奏。
- 分兩步定案：先做遞增曲線（總消耗 61），使用者再要求在此基礎上整體 +30% 且**金幣一併調**，故材料曲線→80、金幣→×1.3。掉落率與 UI 仍不動；`generateRandomMats` 回傳結構不變。

### 踩坑提醒
- **既有玩家的 nextMats 是舊公式（6 個）存在 Firestore**，openSlot 有 nextMats 就直接用，所以每個槽位「下一次升級」仍是舊便宜價，要升過一次後 `newNextMats` 才套用新曲線。會自然收斂，未做強制覆寫（純前端、逐玩家、成本不值得）。
- 曲線只吃 plusLevel 0~4（`Math.min(4)` 夾住），神話+4 是最高、不會再生成。

---

## 2026-07-11（後台線上約課：最新預約清單 + 置頂提示顯示明細 + 未看高亮可點）

### 改了什麼
- 新檔 `src/lib/bookingSeen.js`：教練「新預約/看過了沒」的共用真相來源（localStorage `adminBooking_seenIds` 集合 + 首次啟用把現有預約全標已看當基準）。`seedIfFirstRun/getSeenSet/isUnseen/markSeen/markAllSeen`。
- `bookingDb.js` 新增 `getRecentBookings(maxCount)`：`orderBy("createdAt","desc") limit()` 抓最新建立的預約（單欄位索引，免建複合索引）。
- `AdminBooking.jsx` 行事曆頁最上方新增 `RecentBookingsPanel`：最新 10 筆，每列寫明「日期・時間・人數・方案」。未看過整列琥珀高亮 🆕，點下去＝標記已看 + 跳到那天日曆開該時段詳情。附「全部已看」「收起」。
- `AdminBookingAlert.jsx` 置頂橫幅：改用共用 seenIds（不再自己算 lastSeen 時間戳），並把每筆新預約的「日期・時間・人數・方案・姓名」直接列出來（最多顯示 4 筆 +「等共 N 筆」）。點「查看預約 →」只停音效+跳頁，不強制標已看。

### 為什麼
- 教練要一眼看到「約什麼時候」，原本橫幅只寫「N 筆新預約」資訊不足。
- 橫幅與清單若各自判斷「看過沒」會數字對不上，故抽 `bookingSeen.js` 當單一真相來源。

### 踩坑提醒
- `getRecentBookings` 用 createdAt 排序，比舊的「日期範圍查詢」更能抓到「約很遠未來、但剛建立」的新預約；但它會含 cancelled，呼叫端要自行 filter（清單/橫幅都只取 confirmed）。多抓 20 筆再過濾，避免一批取消洗空清單。
- seenIds 判斷純前端、單裝置：換瀏覽器/清快取會重跑首次基準。教練固定一台後台即可，不需跨裝置同步。
- 橫幅點擊刻意「不標記已看」——只停提示音；真正標已看在清單逐筆點或「全部已看」。這是為了對應「未看過不同色、可點過去看」的需求。

---

## 2026-07-11（修：下課結帳沒對到線上約課 → 可重複結帳）

### 改了什麼
- `bookingDb.js` 新增 `completeBookingForMemberOnDate(memberId, date, checkinId, billingId)`：結帳當下再找一次當天該會員「尚未結帳」的 confirmed 預約補做完成連動（選取規則同 `linkCurrentBookingToCheckin`：優先時段內，否則唯一一筆才自動處理）。
- `AdminDailyQuest.jsx` `confirmBill` / `skipBill`：原本 `if (c.bookingId)` 才連動 → 改成沒綁 bookingId 時 fallback 呼叫上面新函式。

### 為什麼
- 「已結帳」判斷看的是 `booking.billingRecordId`（`AdminBooking.jsx:440`），唯一寫入來源是 `completeBookingFromCheckin`。而 `checkin.bookingId` 只在**報到當下**由 `linkCurrentBookingToCheckin` 綁定，綁定條件脆弱（報到時間要落在時段內、或當天只有一筆預約）。沒綁到時下課結帳整個跳過 booking，線上約課永遠停在「結帳」按鈕 → 可重複結帳、重複開會計記錄。

### 踩坑提醒
- 兩個結帳入口不對稱：`AdminBooking` 的 `CheckoutModal` 本來就有 `booking.id`（可靠）；`AdminDailyQuest` 下課結帳只有 `checkin`，得靠 fallback 反查。日後改結帳流程兩邊都要顧。
- `skipBill`（未記帳完成）會把 booking 標 completed 但**不寫 billingRecordId**，所以 `AdminBooking` 仍顯示「結帳」按鈕（+🏁已完成課程），這是刻意的：完成但未收費，教練可事後補結帳。
- 多筆預約又都不在報到時段內＝無法安全判斷是哪一筆，fallback 刻意不動，留給教練從行事曆手動結帳。

---

## 2026-07-11（訪客預約頁更新公告 + 世界王出戰準備頁可滾動修復）

### 改了什麼
- `PublicBookingApp.jsx` 主入口（選方案+時段那頁）標題下方新增**醒目公告**：預約系統已全面更新——沒有學籍帳號的舊帳號請重新註冊；已有學籍帳號的請改用學員專用 App 預約。
- `WorldBossAttack.jsx` phase==="prep"（買藥水/雇用 AI 機器人/計分設定/開始挑戰）畫面**滑不下去**修復：root 由 `min-h-full` 改 `h-[100dvh]`，中間內容區加 `flex-1 min-h-0 overflow-y-auto`，讓 header/footer 固定、中間可捲動。原本內容較長時（多人/多機器人）會被父容器裁切、看不到也捲不到下方的「開始挑戰」。

### 踩坑提醒
- 世界王戰鬥畫面本來就用 `position:fixed` 全高，準備頁卻用 `min-h-full` 靠父層高度——父層一旦 overflow:hidden/固定高就裁切。全螢幕接管的畫面要嘛 fixed、要嘛自己給 definite height + 內部 overflow-auto，別依賴父層。
- 世界王準備頁修復尚未實機捲動確認（需走到世界王→進入戰鬥→準備頁）；`CI build` 乾淨。

---

## 2026-07-11（後台提示音：報到加大聲 + 新預約/下一小時各自不同的大聲提示音）

### 改了什麼
- `sound.js` 新增三個「後台大聲提示音」：`sfxCheckinAlert`（每日報到待審，明亮上行三連音，音量從 ~0.2 提到 ~0.4）、`sfxNewBookingAlert`（新預約，門鈴叮咚下行）、`sfxNextHourAlert`（下一小時，急促三短音）——三種彼此可辨識、都比 `sfxNotify` 大聲。
- `AdminApp.jsx`：待審核報到的 12 秒循環提示音從 `sfxNotify` 改用 `sfxCheckinAlert`（更大聲）。
- `AdminBookingAlert.jsx`：新預約 / 下一小時各自用對應音效，每 12 秒重複提醒，**直到教練點該橫幅「查看/閱讀」為止**；又有更新的預約進來會再次響起。兩音效錯開 700ms 避免疊在一起。

### 踩坑提醒
- 瀏覽器 autoplay 政策：音效需使用者互動後才播——教練在後台操作即已解鎖（跟既有報到提示音同機制）。
- 尚未實機聽過音量/辨識度（後台切換自動化卡頓）；`CI build` 乾淨。上線後教練聽一次，太吵/太小聲再調 gain。

---

## 2026-07-11（地下城戰鬥增益只對該場有效：戰鬥結束歸零）

### 改了什麼
- `DungeonExpedition.handleBattleDone`：戰後同步 playerState 時**不再把 `member.buffs` 的倍率帶回**（原本 `{...prev.buffs, ...member.buffs}` 會把戰鬥中喝的藥水/戰鬥buff 永久累積）。現在只保留 `prev.buffs`（事件增益，仍由 `handleDescend` 換層歸零）＋同步 `hasRevival` 的消耗狀態。→ 戰鬥中的增益藥水只影響該場，戰鬥結束即歸零。

### 待處理（6a，未修）
- 使用者回報「正式會員模式，戰鬥中喝藥水沒作用」。已逐層追過：`onCarryPotion → applyDungeonCarryPotion`（room doc `buffs.atkMult`，effect schema `atkPct/defPct/hpPct` 對得上）→ `processDungeonRound` Step1 `effectiveAtk = atk×buffs.atkMult`（有吃），expedition room `status:"active"`、member alive、potion `kind:"carry"` 都正確。**靜態看不出 bug**。最可疑：`useFirestoreRound` 送出回合時用的 `room`(React state) 可能早於喝藥水的 snapshot → `processDungeonRound` 吃到喝藥水前的舊 buff（stale-room race）。需實機重現（會員遠征戰鬥、喝ATK藥水、看傷害有無變）才能確認；未盲改共用/CODEX 戰鬥碼。

---

## 2026-07-11（地下城防堆疊：商店一次性商品 + 事件增益換層歸零）

### 改了什麼
- **商店一次性商品**（`DungeonExpedition.handleLocalBuy` + `DungeonShop.jsx`）：攻擊藥水(atk_mult)、防禦藥水(def_mult)、復活符(revival)**整趟遠征只能買一次**。以 **effect** 為單位追蹤（`ONE_TIME_SHOP_EFFECTS`＋新 state `boughtOneTime`），所以 atk_boost(×1.2) 與 atk_large(×1.5) 買了其一另一支也鎖；跨不同商店房也記得（父層 state，不像舊的 `localPurchases` 每個商店房重置）。DungeonShop 新增 `boughtEffects` prop 據此禁用+顯示「已購」。
- **ATK/DEF 藥水改寫進 base atk/def**（不再是 `buffs.atkMult`），這樣整趟持續、又不受下面換層歸零影響。
- **事件增益/減益換層歸零**（`handleDescend`）：進下一層時 `buffs.atkMult/defMult/dmgMult` 全部歸 1，防止跨層無限堆疊；`hasRevival`（復活符）保留。離開/戰勝地下城本來就會重建 playerState，自動恢復。

### 踩坑 / 待確認
- 舊的 `DungeonShop.localPurchases` 只擋「同一個商店房內、同一 item.id」重買——換商店房或換等級品項(atk_boost↔atk_large)就破功，這次才用父層 effect 級追蹤根治。

### 2026-07-11 補強（依使用者回覆）
- **規則統一**：除了回血藥水(`hp_restore`)以外，**所有商品整趟只能買一次**（含 `hp_max_boost` 生命上限符）。solo 用 `isOneTimeShopEffect(e)=e!=="hp_restore"`。
- **多人組隊也一起處理**：`dungeonDb.purchaseDungeonItem` 新增 `shopBoughtEffects.{memberId}`（arrayUnion effect），此欄位**不**被 `selectDungeonPath`/`advanceDungeonFloor` 清除（那兩支只清 `shopPurchases`），所以換層後同款效果仍鎖定。`DungeonShop` 統一用 `boughtEffectSet`（多人 room.shopBoughtEffects＋solo 父層 boughtEffects＋本房 item.id→effect）判斷 `alreadyBought`。
- `revival_front`（前衛復活藥，多人限定）目前也被歸為一次性（除 hp_restore 外全鎖）——若希望它可重複買，之後把它加進白名單。

---

## 2026-07-11（教練後台預約通知 Part A：新預約 + 下一小時提醒橫幅）

### 改了什麼
- 新增 `src/components/admin/AdminBookingAlert.jsx`：教練後台頂部橫幅。① 🆕 自上次查看後的新預約筆數（createdAt 晚於 localStorage `adminBookingAlert_lastSeenMs`，首次以「現在」建基準避免被歷史灌爆），點擊→booking 頁並更新 lastSeen；② ⏰ 未來一小時內開始的預約（今天、startTime∈[now, now+60min]），**沒有就不顯示**（對應需求「若無則不用通知」）。每 5 分鐘自動刷新。
- `src/pages/AdminApp.jsx`：加一行 import＋在既有審核橫幅（🔔/🎫）之後掛 `<AdminBookingAlert onGoBooking={...}/>`（只在非射手模式的後台 render 顯示）。

### 為什麼 / 設計取捨
- 這是「教練登入系統內」的通知（Part A）。Part B「系統外通知」（LINE/推播）需要 Firestore-triggered Cloud Function（前端無法安全持有外部 API 金鑰），待與使用者討論後另做。
- **刻意做成自給自足小元件**：自己抓資料（reuse `bookingDb.getBookingsForDateRange`，唯讀）＋純前端計算＋lastSeen 存 localStorage，**完全不動 `AdminBooking.jsx` / `bookingDb.js`**——因為 CODEX 當時正在改那兩支（booking-attendance-completion 任務）。這樣兩邊工作零衝突，AdminApp 只需掛一行。
- 視覺沿用後台既有審核橫幅語言（全寬色塊按鈕），不另創樣式。

### 踩坑提醒
- 與 CODEX 同時改預約系統：我只 commit 這 2 個檔（新元件＋AdminApp 掛載），沒碰 CODEX 的熱檔。
- **尚未用真實預約資料實機看過橫幅渲染**（後台切換有自動化點擊卡頓＋測試帳號當下無新/下一小時預約→元件正確回傳 null 不顯示）；已確認 `CI build` 乾淨、後台載入 console 零錯誤。上線後請造一筆今天近一小時的預約確認橫幅有出來。

---

## 2026-07-11（修復：訪客地下城「開始探索」production 崩潰 — Cannot access before initialization / TDZ）

### 改了什麼
- 新增 `src/components/dungeon/DungeonStages.jsx`：把原本定義在 `DungeonExpedition.jsx`、又被 `TeamExpeditionBattle.jsx` 具名匯入的 `GridMapStage`／`BranchStage`／`PlayerStatusBar`＋房型圖示常數 `TYPE_ICONS`／`TYPE_HINTS` 抽出成獨立模組。
- `DungeonExpedition.jsx` 與 `TeamExpeditionBattle.jsx` 改成都從 `DungeonStages.jsx` 匯入這些關卡元件（原本 TeamExpeditionBattle 是 `import { GridMapStage, BranchStage } from "./DungeonExpedition"`）。
- `FLOOR_LABELS` 留在 `DungeonExpedition.jsx`（只有同檔的 `FloorIntro` 用）。

### 為什麼（root cause）
- 症狀：訪客模式進地下城→點「開始探索」立刻 `Uncaught ReferenceError: Cannot access 'yt' before initialization`。**只在 production build 發生、dev 完全正常**（`yt` 是 minify 後的變數名）。
- 成因：`TeamExpeditionBattle` 直接從 `DungeonExpedition`（一個同時含 default export＋大量模組級 const 的大型元件檔）具名匯入 `GridMapStage`/`BranchStage`。這種「跨檔匯入大型元件模組的具名匯出」在 webpack production 的 **scope hoisting（module concatenation）** 下會把模組併進同一 scope，使 `const`（如 `TYPE_ICONS`）在被讀取時仍在 TDZ → 拋 "Cannot access before initialization"；`GridMapStage` 正是「開始探索」渲染的元件，所以崩在那一刻。dev 不做 scope hoisting 故不炸。
- 正是第二大腦 memory 記過的坑：「共用常數勿放 UI 元件再 re-export」。抽成獨立小模組即消除。

### 踩坑提醒
- 「dev 正常、prod 才炸、錯誤是 minified 變數名 + before initialization」= 幾乎必為 **循環／跨檔匯入大型模組 + prod scope hoisting**。把共用元件/常數抽到獨立檔是標準解。
- 已在 dev 完整走過訪客 T1（選單→單人遠征→確認出發→FloorIntro→開始探索→GridMapStage 正常渲染、含 TYPE_HINTS 文案），無 regression；`CI=true build` 乾淨編譯。
- **prod 崩潰本身未能在本機測試環境實機重現**（訪客登入卡在 Firestore 權限/持久化鎖），故此修復是「針對該症狀的標準成因下標準解＋dev 無 regression」，非實機 before/after 對照。上線後請實測訪客 T1 一次確認。

---

## 2026-07-10（官網真實照片整合上線 + 情境子頁配圖 + 部署方式修正）

### 改了什麼
- 官網首頁 12 區塊真實照片、Hero 還原插畫版、照片統一橫式裁切、器材代購分組、訓練系統勳章清單改 11 款、場地 banner 換 AAA00185，全部**實際部署上線**。
- 8 支情境子頁（新手/公司團康/情侶/親子/朋友/雨天/一個人/大太陽）各加一個 3-4 張的照片牆（固定高度 190px、object-fit cover grid），取代原本的插畫佔位圖。

### 踩坑提醒（重要）
- **官網 `catarrow-archery` 這個 Vercel 專案沒有接 GitHub 自動部署**。`git push` 只會更新 GitHub repo，**不會**讓官網上線。今天就因為誤以為 push 就會部署，結果連稍早的真實照片整合都沒真的上線、被使用者發現「跟原本沒差多少」。
- 正確部署方式：把 `website/` 內容複製到暫存資料夾 → `npx vercel link --project catarrow-archery` → `npx vercel deploy --prod --yes`。CLI 已在本機登入（`broudes-1864`），token 之前壞掉是因為沒登入，重新 OAuth 授權後恢復。
- 主 App（`catarrow` 專案）才是 push GitHub 自動部署；官網（`catarrow-archery`）要手動 deploy。兩者是**不同 Vercel 專案、不同部署機制**，別搞混。

---

## 2026-07-10（貓貓村採集任務重製＋協力採集，已 push main — commit f691b5d）

### 改了什麼
- 議會廳採集任務從「類打怪」改成全新射箭委託玩法：3 回合 × 6 箭，分數推進採集進度，100% 完成，130% / 180% 取得更高完成倍率。
- 新增六大採集點與對應建築 / 材料 / 村資源：星屑礦坑、月芽農田、霧潮港口、巡林狩獵場、喧鬧市集、古罐倉庫。
- 採集 Tier 受貓貓村建築等級限制；普通建築 stage 解鎖 T1~T5，T6 保留為特殊高階內容。
- 新增協力採集：使用邀請碼房間，最多 8 人；每位玩家各自完成 18 箭，獎勵加成偏小且倍率封頂到 4 人，避免搶單人打怪與地下城效率。
- 新增採集類村目標：採集進度、參與人次、指定怪物材料、指定貓村物資。
- 玩家說明書補上完整系統說明，首頁新增「說明書」快捷入口。

### 踩坑提醒
- 採集與協力採集的箭數累積不能乘上隊伍人數。新版結算在 `completeCouncilSession(contractVersion >= 2)` 只用 `Math.min(18,totalArrows)` 記錄單一玩家本人的箭數。
- 協力房間最多 8 人，但採集獎勵倍率只封頂到 4 人；不要因為 UI 顯示 8 人就把經濟倍率同步放大。
- 採集模式刻意不給金幣、寶箱、射手 XP；主要獎勵是貓貓 XP / 羈絆，搭配少量怪物材料與少量貓村物資。
- 詳細交接與部署注意事項見 `docs/second_brain/cat-village-gathering-handoff.md`。本次尚未 commit / push / deploy。

---

## 2026-07-10（新生隱藏入口改用Email密碼註冊登入 + 結帳串接會計系統 + 2小時方案，尚未 push main）

### 改了什麼
- `src/lib/guestAuth.js` 新增 `registerGuestWithPassword`/`loginGuestWithPassword`：新生隱藏入口（`PublicBookingApp.jsx`）從「留姓名/email/電話」升級成「Email+密碼」，回訪可以直接登入找回同一筆記錄，不用重填資料。跟既有 `resolveGuestSession` 一樣，一律在隔離的臨時 Firebase App 上做，絕不碰主要 `auth` 物件（同一個坑，避免這台裝置上教練自己的登入被干擾）。身份仍然以 email 的 `contactHash` 為準，不是 uid——這樣舊的匿名QR碼記錄也能被密碼登入正確接續上。這組密碼帳號只在這個隱藏頁面有效，不會打開完整學生App（沒有 `bookingBetaAccess`）。
- `PublicBookingApp.jsx` 流程重排：改成「先選方案+時段 → 選完才出現註冊/登入 → 用選好的時段直接送出」，不是原本「先填資料才能選時段」。
- `AdminBooking.jsx` 行事曆詳情每筆預約加「結帳」按鈕：依 `planType+durationHours` 自動對應到既有 `BillingSystem.jsx` 的方案代碼（單一/單二/單三…），送出呼叫既有 `addBillingRecord()` 寫進同一個會計系統collection，不重做一套；`bookings` 新增 `billingRecordId` 避免重複結帳。
- 新增 **2小時**方案（收費不變＝直接是1小時的2倍，沒有折扣——3小時「2送1」才是折扣價，數字剛好等於2小時的原價）；`BillingSystem.PLANS` 新增 自二/單二/學二 三個代碼。
- 方案類別+時數原本是兩個獨立下拉，改成單一組合選單（`PlanDurationPicker.jsx`，三個入口共用），每個選項直接顯示金額。
- 教練後台行事曆格子改成直接顯示每筆預約的「姓名+方案」小色塊（比照使用者提供的SimplyBook截圖），不用點進去才看得到是誰；學生前台確認過完全沒有讀取其他人的姓名/聯絡方式，只顯示新舊生聚合人數。

### 踩坑提醒
- 新增任何「時數」相關的顯示文字，都要走 `bookingSchedule.js::durationLabel()`，不要各自寫 `durationHours===3?"3小時":"1小時"` 這種只認得兩種值的三元判斷——這次新增2小時就是因為好幾個地方各自寫死判斷式，得逐一找出來改。
- 方案價格數字在兩個地方各自維護（`bookingSchedule.js::PLAN_PRICE` 給預約時顯示用、`BillingSystem.jsx::PLANS` 給結帳寫進會計系統用），之後真的要調價記得兩邊都要改，不是同一份資料。
- 密碼註冊/登入函式的安全屬性：`registerGuestWithPassword`/`loginGuestWithPassword` 內部只能用 `tmpAuth`（隔離臨時App），絕對不能出現對主要 `auth` 物件的 `signInWithEmailAndPassword`/`createUserWithEmailAndPassword` 呼叫——之後如果要擴充這兩個函式，這條界線不能破。

---

## 2026-07-10（線上約課擴充：3小時方案＋跨時段原子鎖定＋新舊生統計，尚未 push main）

### 改了什麼
- `src/lib/bookingDb.js`：`createBooking`/`cancelBooking`/`rescheduleBooking` 三個全部從「單一 `slotKey`」推廣成「`slotKeys[]` 陣列」，容量鎖定/釋放對N個時段格在同一個transaction內做「全部讀取→逐格檢查→全部通過才逐格寫入」，任何一格失敗整筆丟出、零寫入（不會出現3小時預約鎖到第2格才發現第3格滿的爛尾狀態）。新增內部工具 `slotKeysFor(date,startTime,durationHours)`。`createBooking` 簽章新增 `durationHours`（1|3）、`isNewStudent`（boolean）兩個參數。`rescheduleBooking` 對舊/新 slotKeys 做 union，只對「新增佔用」的格子做容量檢查，重疊格子淨變化為0不重複讀寫；`durationHours`/`isNewStudent` 固定沿用原預約值，這次不開放改期時連時數一起改。
- `bookings/{id}` 新增欄位：`durationHours`、`slotKeys:string[]`、`isNewStudent:boolean`；`slotKey`（單數）保留＝`slotKeys[0]`向後相容舊讀取程式碼。
- `bookingSlotCounts/{slotKey}` 新增 `newCount`/`returningCount`，跟既有 `count` 在同一次 `tx.set()` 一起寫（不變式 `count===newCount+returningCount`）。3小時預約橫跨的每一格都各自+1，不是只加在起點格。
- `src/lib/bookingSchedule.js`：新增 `DURATION_OPTIONS`、`computeEndTime(startTime,durationHours)`；`slotState()` 簽章加 `durationHours=1` 參數，多時段方案時額外檢查「以這格當起點往後數N格」有沒有任何一格額滿/封鎖，顯示文字從單純的 `count/8` 改成 `新X／舊X（共Y/8）`。
- `src/components/booking/DateSlotPicker.jsx`：新增 `durationHours` prop——過濾掉「起點+時數會超過22:00打烊」的起始時段、選中後用 `computeEndTime` 算正確 `endTime`（不再永遠 `+1小時`）。
- 三個建立預約入口（`MemberBooking.jsx`／`PublicBookingApp.jsx`／`AdminBooking.jsx` 的 `CreateBookingModal`）都新增「時數」（1/3小時）選擇＋「是否為第一次來體驗」勾選框，並更新 `createBooking(...)` 呼叫傳入新參數。預設值：`bookingStats.totalBookings` 是0（或不存在）時預設勾選「第一次」，教練代建時用選定顧客的 `bookingStats` 帶出同樣的預設，使用者/教練都可自己改。
- `AdminBooking.jsx` 的行事曆格線（`CalendarTab`，這是**獨立於** `DateSlotPicker` 的一套格線邏輯）：格子上的人數顯示改成直接讀 `bookingSlotCounts[slotKey]` 的 `count`/`newCount`/`returningCount`（原本用 `bookingsBySlot.length` 現算，只認單數 `booking.slotKey`，3小時預約跨進來的格子會漏算，這次順便修正）；`bookingsBySlot` 分組改用 `booking.slotKeys||[booking.slotKey]` 逐格 push，`SlotDetailModal` 現在點任何一格都能看到「從更早時段跨進來、還在佔用中」的預約並可取消/改期。
- `test-booking-concurrency.js` 新增 Test E：複寫一份多時段版本的 `createBooking`（`createBookingMultiAdmin`），驗證兩個3小時預約併發搶同一個瓶頸時段格時，剛好一個成功、輸家在起點/終點格完全不留殘留寫入（「N格全有全無」保證）。

### 為什麼
- 官網價目表本來就有「1小時／3小時（2送1）」兩種方案，上一個任務刻意留白（design.md 有寫但沒做，見上一版 changelog 條目），這次補上。
- `isNewStudent` 用使用者自己勾選、不用 `accountType` 反推：官方學生也曾是新生、訪客帳號也可能是老客戶回訪，兩者不是同一個維度。
- 每個時段格都要正確算入「橫跨進來的3小時預約」：如果只在起點格+1，10:00/11:00這種被跨進來的格子會低估目前人數，教練後台跟學生前台看到的「還剩幾位」會不準確。

### 踩坑提醒
- **hourly slot key 語意**：一個 key 代表「這個小時是這筆預約佔用的其中一格起點」，9:00起3小時佔用 `9:00,10:00,11:00` 三個key，**不含 12:00**（那是 endTime，不是這筆預約佔用的格子）。這是 PRD 驗收項目2（9點3小時舊生預約→10/11點正確算入→12點不算入）的核心正確性依據，改這塊邏輯前一定要先想清楚這個語意，不要直覺地把 endTime 也算進 slotKeys。
- **`AdminBooking.jsx` 的行事曆格線不是共用 `DateSlotPicker`**——是它自己刻的一套週/日檢視格線，這次多時段顯示要在兩個地方分開改（見上方「改了什麼」），改任何一邊記得檢查另一邊要不要跟著改，這跟 `TargetFaceOverlay` 5處呼叫端各自維護鎖定邏輯是同一類坑。
- **DateSlotPicker 新增的 22:00 打烊過濾邏輯是這次任務自己加的判斷**（design.md沒有明講這個邊界情況），不是照抄設計文件的既有規格——3小時方案若允許從21:00開始會跨出打烊時間、產生沒人看得到的「幽靈時段格」，所以在起始時段清單裡直接濾掉「起點+時數>22:00」的選項。之後如果新增其他時數選項（例如2小時），這個過濾邏輯要一起適用，不用額外改。
- **`test-booking-concurrency.js` Test E 尚未實際對 Firestore 跑過**（額度尚未恢復），只做到 `node --check` 語法驗證＋人工邏輯走查，比照 Test A-D 原本的待驗證狀態。
- 這個任務沿用上一個任務「不要 push main」的既有限制，commit 之後仍要等使用者親自測試（含 Firestore 額度恢復後跑併發測試腳本）才問要不要 push。

---

## 2026-07-10（線上約課預約系統・學生試用版：與 SimplyBook 並存，尚未 push main）

### 改了什麼
- 新 collection `bookings`／`bookingSlotCounts`（資料層 `src/lib/bookingDb.js`，Step 1 已完工並通過獨立 review：`createBooking`/`cancelBooking`/`rescheduleBooking`/`blockSlot`/`unblockSlot`/`getBookingsForMember`/`getBookingsForDateRange`，容量計算全走 `runTransaction`，全場固定 `LANE_CAPACITY=8`）。
- 新 `src/lib/bookingSchedule.js`（唯讀顯示層，不含寫入邏輯）+ 共用元件 `src/components/booking/DateSlotPicker.jsx`（日期/時段選擇器，學生前台/新生隱藏入口/教練後台代建三處共用）。
- `MemberApp.jsx`／`AdminApp.jsx`（射手模式）新增「約課」底部導覽按鈕，只在 `profile?.bookingBetaAccess===true || role==="admin"` 時渲染（不是灰階，比照既有條件式不渲染慣例）；新元件 `src/components/member/MemberBooking.jsx`（選時段送出預約 + 我的預約清單改期/取消）。
- 新元件 `src/components/admin/AdminBooking.jsx`，掛進 `AdminApp.jsx` 會員中心 Hub：行事曆週/日檢視（色塊格線）、建立預約 Modal（顧客搜尋既有 `members` 或建立新顧客電話進線）、封鎖/解除封鎖時段、`bookingBetaAccess` 開放名單開關、收費分類報表（`planType × paymentMethod`）。
- 新頁面 `src/pages/PublicBookingApp.jsx`（比照 `GuestApp.jsx` 模式）+ `App.jsx` 新增一個不公開、不規律 query 參數的隱藏路由，供教練私下告知新生使用；頁面掛載時手動插入 `<meta name="robots" content="noindex,nofollow">`。
- `firestore.rules` 新增 `bookings`／`bookingSlotCounts` 區塊（Step 1 已完工，**尚待使用者手動貼進 Firebase Console**，CLI 部署規則會 403，這個專案的已知限制）。

### 為什麼
- 官網「立即預約」CTA 導去 SimplyBook，跟這個 App 的學籍系統完全沒有資料串接。這次做一套自製系統跟 SimplyBook 並存試用，驗證穩定後才考慮換官網連結（這次不動 `website/`，官網上不會出現任何連到新系統的連結）。
- `bookingBetaAccess` 漸進開放旗標是 push main 之外的第二層保護：即使之後上線，教練也能自己控制先開放給誰測試，不是全體學生一次全開。
- 新生隱藏入口刻意不做 App Check/驗證碼等反濫用機制，只靠「網址不公開」——這是刻意的權宜之計（試用階段流量小），要正式公開取代 SimplyBook 那天才需要一起補上。

### 踩坑提醒
- **⚠️ 範圍縮減（不是實作細節，使用者應該知道）：全部方案類別統一鎖 1 小時，design.md 資料模型章節寫的「`endTime` 依 planType 對應時數換算（1hr 或 3hr）」這次沒有實作**——check agent 複查已重新確認 `bookingDb.js` 的容量交易（`createBooking`/`cancelBooking`/`rescheduleBooking`）只對單一 `slotKey`（一個時段格）做原子鎖定，沒有「同一個 transaction 內鎖多個連續時段格」的邏輯；`bookingSchedule.js::slotsForDate()` 也是每格固定切 1 小時，不吃 `planType`。要支援真正 3 小時的方案，需要在 Step 1 資料層加「一次交易同時鎖定連續 N 個 slotKey」的邏輯（且要處理「連續格子其中一格被佔走」的失敗情境），這是資料層等級的改動，不是這次 UI 範圍能安全做的簡化，所以這次全部方案一律當 1 小時處理。**如果之後真的有 3 小時方案的需求，要回頭在 `bookingDb.js` 補多格鎖定邏輯，不能只在 UI 層加時數選項。**
- **`accessControl.js` 的 `restricted`/`retired`/`autoLocked` 分級白名單沒有 `"booking"` 頁面 id**——`official`（未鎖定）學生 `getAllowedPages()` 回傳 `null`（全開）才不受影響；分級中的學生即使開了 `bookingBetaAccess` 也進不去這個分頁，這次視為預期行為（PRD 沒要求覆蓋）。check agent 複查時已把 `"booking"` 加進 `PAGE_REGISTRY`（新分組「預約」），這樣教練後台「權限設定」矩陣現在看得到這個頁面的打勾格，之後想開放給分級學生用，教練自己勾選對應分級即可，**不需要再改程式碼**；`DEFAULT_TIER_PERMISSIONS` 本身沒有跟著改（維持分級預設不給，比照 `dungeon`/`worldboss`/`guild` 等其他特權功能同樣「有註冊但預設不在分級白名單」的既有慣例）。
- **`AdminBooking.jsx` 建立預約 Modal 的顧客搜尋**：check agent 複查加了 `limit(2000)` 防禦性上限（`getDocs(query(collection(db,"members"), limit(2000)))`），原本完全無界。這不是修 `getMembers()` 本身的已知無界讀取（那個維持現狀，今天稍早的任務已經評估過是可接受的既有模式），只是新查詢比照「別留無界讀取」的教訓多一層防禦，不影響搜尋功能（正常會員數不會碰到這個上限）。
- **`fetchSlotCountsForRange` 用 `documentId()` range query**（`bookingSlotCounts` 的文件 ID 就是 `slotKey="YYYY-MM-DD_HH:mm"`，字典序可排序），上界用「隔天日期前綴」當 exclusive 邊界（`addDays(endDate,1)+"_"`），不是用 `` 高位字元技巧——兩種寫法邏輯上都對，這次選前者是因為更直觀好懂，不需要解釋 Unicode 邊界字元的用途。
- Firestore 額度當天稍早已耗盡兩次（預期下午3點恢復），本次全程只能用程式碼審查 + `CI=true npx react-scripts build` 驗證，**沒有跑過任何真實 Firestore 端對端測試**，尤其是 PRD 驗收項目4「雙分頁同時搶同一時段最後名額」這個最核心的正確性風險，只確認了 `bookingDb.js` transaction 邏輯讀寫順序正確，沒有實際開兩個分頁跑過。額度恢復、使用者測試通過前，**不要 push main**（PRD 明確要求）。
- 新生隱藏入口的實際網址只在 `App.jsx` 一個常數定義一次（grep 全 `src/`+`website/` 已確認零殘留連結），這份筆記與 `App.jsx` 原始碼可能外流，**實際網址不寫進任何文件**，只在完工報告當下跟使用者口頭/文字複述一次。

---

## 2026-07-10（訪客/兒童地下城比照正式系統：整合而非重刻，T1-T2封頂+裝備+真實掉落物）

### 改了什麼
- **重用正式地下城元件，不是再刻一套**：`DungeonLobby.jsx`/`DungeonSelectionPanel.jsx`/`DungeonExpedition.jsx`/`EquipmentPage.jsx`/`RPGEquipPanel.jsx`/`DungeonDex.jsx` 全部新增可選 `guestProfile`/`isGuest`/`tierCap` 參數（沒傳就照舊呼叫 `useAuth()`，正式學生行為完全不變，逐一 regression 過）。
- 新元件 `src/components/dungeon/GuestDungeonEntry.jsx`：訪客/兒童專屬 T1/T2 難度選擇畫面，選完用 `drawExpeditionBoss(tier,family)` 就地組出 dungeon 物件（`family` 隨機挑六族之一，比照 `dungeonExcavation.js::claimAutoDig` 既有清單），**不寫入** `pendingReveal`/`savedDungeons`——訪客的「選擇」本身就是這次遠征，是純前端暫存物件，不進儲存槽系統。
- **難度封頂兩層防禦**（見 `.trellis/tasks/07-10-guest-kid-dungeon-parity/design.md §3`）：
  1. 第一層：`GuestDungeonEntry` UI 只給 T1/T2 兩個按鈕可選。
  2. 第二層（真正的防線，不能省略）：`DungeonExpedition.jsx` 內 `isGuest` 時 `difficultyTier = Math.min(excavation?.difficulty||1, tierCap||2)`，**且** `fixedBoss` 也改成用這個已封頂的 `difficultyTier` 重新呼叫 `drawExpeditionBoss()` 重抽（不信任上游傳入的 `excavation.boss` 物件本身可能是封頂前抽的）——這一步很關鍵，因為 `difficultyTier`（數字）夾住只影響樓層怪物池/獎勵倍率，王關戰鬥用的是獨立的 `boss` 物件，兩者都要重新從封頂後的 tier 導出才是真正的防線。用 `useMemo` 鎖定同一場遠征內王的身份，避免每次 render 重抽。
- `DungeonLobby.jsx` 的「進入地下城」分頁：`isGuest` 時渲染 `GuestDungeonEntry` 取代讀 `savedDungeons` 的畫面；`DungeonSelectionPanel` call site 補上 `isGuest={isGuest}`（Step 1 建好的組隊按鈕隱藏功能原本沒接上，這次修正）；`onStartSolo` 的 `fromStorage` 改成 `!isGuest`（訪客的 dungeon 物件 `savedId` 是 `null`，不能觸發 `removeSavedDungeon` 消耗儲存槽邏輯）。
- `GuestApp.jsx`：新增 `guestFullProfile`（`onSnapshot` 訂閱完整 `members/{id}` 文件，取代原本只有 `{id,name,coins}` 的 `guestOverride` 快照+舊的單純 `liveCoins` 監聽），地下城分頁改成 `<DungeonLobby guestProfile={guestFullProfile} isGuest tierCap={2} .../>`，取代舊的 `<GuestDungeonSimple>`；新增「裝備」入口（GuestHome 卡片 + `equipment` tab）掛 `<EquipmentPage guestProfile={guestFullProfile} .../>`。
- **`GuestDungeonSimple.jsx` 已刪除**（grep 確認零殘留引用後移除）——舊版是固定3層+固定王+跳過 Firestore 持久化的簡化版，跟正式系統完全獨立；現在訪客/兒童直接吃正式系統的迷霧格子探索/前後衛編隊/裝備加成/真實掉落物。
- **掉落物現在真的會持久化**：訪客/兒童現在走的是跟正式學生完全同一條地下城結算路徑（`DungeonExpedition.jsx::handleBattleDone/handleFinish` → `grantExpeditionRewards`/`addMaterials`/`addChests`/`addCoins`/`addCollectibles`），這條路徑逐行確認過**沒有任何** `isGuest`/`if(!isGuest)` 守衛——是整合的自然結果，不需要另外設計新掉落表。**跟 `MonsterBattle.jsx` 的訪客首勝實體勳章流程完全無關，那個檔案這次完全沒動。**

### 為什麼
- 訪客/兒童模式原本的地下城視覺跟正式學籍系統落差太大（`GuestDungeonSimple.jsx` 是完全獨立刻的 inline style），玩法也砍到只剩固定3層固定王，跟正式系統的迷霧探索/裝備加成/前後衛完全沒關聯。直接重用正式元件而非模仿重刻，「質感落差」問題自然解決，因為用的就是同一套視覺與邏輯，且未來正式系統任何改版訪客會自動跟著吃到，不需要雙邊維護兩份地下城邏輯。
- 難度封頂特意做兩層是因為 PRD 驗收明確要求「程式碼層面確認 tierCap 有確實夾住所有相關的隨機抽取函式，不是只擋 UI」——單靠入口 UI 擋選項不夠，任何未來程式改動或邊界案例都可能讓訪客意外拿到 T3+ 內容，兩層獨立檢查才是真正的防線。

### 踩坑提醒
- **`DungeonBattleRoom.jsx`/`PartyBattleRoom.jsx`/`db.js` 裡大量 `myId.startsWith("guest")` 字串前綴守衛，是舊系統遺留（早於 07-09 guest-kid-mode-overhaul），目標的是舊版literal `"guest_"+timestamp` 這種非持久化 ID**——現在 `guest-kid-mode-overhaul` 之後的訪客/兒童 member id 是 Firestore `addDoc` 自動產生的隨機 ID，永遠不會以字面 `"guest"` 開頭，這些舊守衛實質上對新訪客系統是死代碼、不會誤觸發，**已逐一追過確認不影響本次整合**，未來新增訪客邏輯時不要再沿用 `startsWith("guest")` 字串判斷這個過時模式，一律用明確傳遞的 `isGuest`/`guestProfile` 參數。
- **凡是被 `DungeonLobby`/`EquipmentPage` 底下渲染、且內部自己呼叫 `useAuth()` 的子元件都要一併檢查/補 `guestProfile`**——這次實作過程中發現 Step 1 只改了 `DungeonLobby`/`EquipmentPage`/`DungeonSelectionPanel` 本身，但它們渲染的 `RPGEquipPanel.jsx`（裝備實際操作面板）、`DungeonDex.jsx`（圖鑑）內部各自獨立呼叫 `useAuth()`，完全沒收到 `guestProfile`，這次一併補上。**這不只是功能不完整的問題，是真的資料外洩風險**：`guestAuth.js` 明確記載了「教練裝置被小朋友掃 QR code 進兒童模式」這個共用裝置情境，此時 `auth.currentUser` 仍是教練本人的真實登入——若子元件沒有明確吃 `guestProfile` 而是回退用 `useAuth()`，兒童模式畫面會顯示教練自己的裝備/圖鑑資料，不是空的或報錯，是「看起來正常但資料是別人的」這種更難發現的 bug。以後任何新增給訪客用的頁面，凡是有 `useAuth()` 呼叫的子元件都要沿著 render tree 追到底、逐一補上 `guestProfile` fallback，不能只改最外層容器就假設完工。
- **check agent 複查時又追出一個同類型的漏網之魚：`DungeonBattleRoom.jsx`**——這個檔案也是獨立呼叫 `useAuth()`（沒收到任何 profile prop），而且它正是被 `DungeonExpedition.jsx` 內部的 `ExpeditionBattleRoom` 包裝元件在訪客單人遠征戰鬥時實際渲染的戰鬥核心（`isGuest`/`guestProfile` 在 Step 2 施工時被 `DungeonExpedition.jsx` 接住了，但沒有再往下傳進 `<DungeonBattleRoom>`）。同一顆「教練裝置被小朋友掃 QR code」地雷：戰鬥中的獎勵發放（`addCoins`/`addMaterials`/`recordBattleDex` 等，全部以 `useAuth()` 解出的 `myId` 為準）會因此寫進教練自己的 `members` 文件而不是小朋友的。已修正：`DungeonBattleRoom` 新增可選 `guestProfile` 參數（`const profile = guestProfile || authProfile`，跟其他檔案同一慣例），`DungeonExpedition.jsx` 的 `ExpeditionBattleRoom` 新增 `guestProfile` prop 並在呼叫 `<DungeonBattleRoom>` 時往下傳，主元件渲染 `<ExpeditionBattleRoom>` 時傳入 `guestProfile={isGuest ? profile : undefined}`（非訪客時維持 `undefined`，行為與改動前逐字一致）。`DungeonController.jsx`/`TeamExpeditionBattle.jsx` 呼叫 `<DungeonBattleRoom>` 時没有傳這個新參數，正式學生/組隊路徑不受影響（`guestProfile` 預設 `undefined` 時退回 `useAuth()`，跟改動前完全相同）。教訓：**Grep `useAuth()` 只抓到「直接」被容器渲染的子元件不夠，要沿著整條 render 呼叫鏈（含中間層的本地 wrapper component，例如同檔案內的 `ExpeditionBattleRoom`）追到最底層才算完整。**
- Firestore 規則 `members` 的 `update` 已有 `(isLoggedIn() && resource.data.accountType in ["guest","kid"])` 分支，訪客/兒童寫入完全不受 `hasOnly` 欄位白名單限制（研究已確認，設計文件也有記載）——這次新增的所有欄位寫入（`rpgEquip`/`dungeonCollectibles`/`coins`/`activeExpedition`/`dungeonExcavation`）都不需要動 `firestore.rules`。
- Firestore 配額當時耗盡（預期下午3點重置），本次只能靠仔細讀程式碼路徑 + `CI=true npx react-scripts build` 驗證，**沒有跑過真實 Firestore 的端對端測試**——尤其是「訪客實際跑完一場遠征後 `members/{id}` 材料/金幣有正確增加」這條，是靠逐行追蹤 `handleBattleDone`→`handleFinish`→`grantExpeditionRewards`/`addMaterials`/`addChests` 完全沒有 guard 來確認的，還沒有真的在瀏覽器裡點過一輪驗證寫入結果，配額恢復後應該找時機補一次真實跑局驗證。

---

## 2026-07-10（官網 SEO/GEO 泛用關鍵字內容上線：首頁情境區塊 + 10題FAQ + 8支獨立頁面）

### 改了什麼
- `website/index.html`：新增「什麼時候適合來貓小隊射箭？」情境區塊（`#scenarios`，8張卡片，放在 `#training`/`#group` 之間），首頁 FAQPage schema 從 8 題擴到 18 題（新增10題情境式問答，同步進 `.faq-list` 手風琴）。
- 新增 8 支獨立 SEO/GEO 頁面（`website/<slug>/index.html`）：`rainy-day`／`sunny-day`／`beginner-guide`／`family`／`couple`／`friends-group`／`corporate-team-building`／`solo-friendly`。每頁各自帶專屬的 FAQPage schema（3題，不跟首頁重複文字），LocalBusiness/SportsActivityLocation schema 刻意只留首頁一份。
- **PRD 標題誤寫「7支獨立頁面」但內容規格實際列了8支**——已依實際內容做滿8支，PRD/design標題後續要記得改正避免誤導下一個人。
- 8 支頁面用同一套模板生成（複製首頁 `<head>`/`<style>`/header/footer，asset路徑補 `../`，nav錨點補 `/` 前綴），確保跟首頁 CSS 完全一致。

### 為什麼
- 讓 Google/AI 搜尋在「台南下雨天去哪」「台南親子活動」這類非品牌情境下也能主動推薦，不是只有搜品牌詞才出現。完整策略邏輯（關鍵字分組、優先序判斷、schema取捨）記錄在 `.trellis/tasks/archive/2026-07/07-10-website-seo-geo-content-rollout/`。

### 踩坑提醒
- **子頁面沒有 `#mqTrack`（跑馬燈）元素，共用的 script block 裡跑馬燈初始化如果沒包 `if(track){...}` 會直接噴錯，導致同一個 script block 後面的所有互動（價格計數、hero視差、手機截圖切換、弓卡片wiggle）全部跟著壞掉**——這個站台所有互動都擠在同一個 script block 裡，任何一個元素找不到都可能拖垮後面所有效果，之後新增頁面要記得比照這個 guard 寫法。
- **「新手體驗指南」被設計成所有情境頁的共同導流終點**，每支情境頁都該連回去——這次驗收就抓到3支頁面（sunny-day/friends-group/corporate-team-building）漏了這條連結，已補上。以後新增情境頁記得檢查這條。
- 新增頁面務必用同一套 `<style>`（直接複製，不要手動重寫），否則 8 支頁面的視覺會慢慢跟首頁走鐘。

---

## 2026-07-10（官網視覺互動改版 + 靶位數/LINE聯絡修正）

### 改了什麼
- `website/index.html`（純靜態站，跟 App/`src/` 無程式碼耦合）：全站新增品牌語彙的生成式互動細節（滾動計數價格、爪痕SVG描邊、命中閃光視差、勳章依序解鎖動畫等），全部沿用既有的單一 `IntersectionObserver` 與 `prefers-reduced-motion` 降級區塊，沒有引入任何外部函式庫。
- `#training`（訓練系統）手機截圖從單張靜態圖改成可切換的 3 張畫面預覽（分頁指示器+淡入淡出），素材暫時沿用同一張 `assets/015.png` 佔位，之後可直接換真實截圖。
- `#group`（團康）新增第 5 張模式卡「地下城遠征」，文案內容已對照 `game-systems.md`/`features.md` 確認是 App 現有真實功能（組隊多層迷霧地下城、前後衛分工、王關），不是畫大餅。
- 修正官網文字錯誤：「九個靶位」兩處改成「八個靶位」（教練確認場館實際只有 8 個靶位）。
- `#group` 團康 CTA 補一個 LINE 線上諮詢按鈕（`https://line.me/ti/p/UJXIAt1s0O`），跟現有「來電洽詢」電話並列，不用只能打電話。

### 為什麼
- 官網原本走克制的編輯風但區塊之間文字偏多；這次刻意只做「跟品牌/射箭語彙相關」的生成式細節（不是套用泛用特效庫），維持「靜心防空洞」的調性同時做技術力展示。
- 「地下城遠征」卡片是為了讓官網更即時反映 App 實際的遊戲化系統廣度（原本官網文案停留在打怪/決鬥/練習，沒提到後來上線的地下城遠征系統）。
- 靶位數這個錯字不只是行銷文案問題——後續在規劃「自製預約系統」時，靶位總數是預約容量的核心設計輸入（8個靶位＝線上自助預約的並行上限），先把官網這個事實修正掉才不會之後設計時抓錯數字依據。

### 踩坑提醒
- 這個檔案沒有 build 流程，是手寫的單一 HTML 檔（inline `<style>`+一段 vanilla JS）。改完務必用 `node --check` 抽出 script 區塊驗證語法——這個檔案所有既有互動（`.rv` 滾動淡入、跑馬燈、FAQ手風琴）都跟新效果共用同一個 script block，任何語法錯誤會讓全站互動一次死光,不是只有新功能壞掉。
- 新增 `.mode` 卡片時要注意 `.modes{grid-template-columns:repeat(4,1fr)}` 是 4 欄網格，加第 5 張卡會單獨掉到下一行歪一邊，記得補 `grid-column` 覆寫（這次已修好，未來再加卡片要留意同樣的坑）。
- 任何新動畫/transition 都要記得補 `prefers-reduced-motion` 的降級規則，JS 驅動的效果（如滑鼠視差、數字計數）要在觸發前檢查 `reduceMotion`，不能只靠 CSS media query。

---

## 2026-07-10（資料庫讀寫次數優化與死代碼清除：R1-R5，純效能優化不動玩家行為）

### 改了什麼
- **R1 刪除 5 個確定死代碼函式**（研究階段 grep 確認全專案零呼叫點，實作時再複查一次）：`db.js::debugGetAllGuildSubs()`、`db.js::getApprovedResults()`、`db.js::subscribeAllMonthlyRequests()`（注意跟活著的 `subscribePendingMonthlyRequests`/`subscribeMyMonthlyRequests` 不是同一個）、`dungeonDb.js::updateDungeonMemberStats()`、`dungeonDb.js::subscribeAllDungeonBroadcasts()`。
- **R4 `DungeonDex.jsx`**：移除自己的 `subscribeCollectibles(myId, setCollectibles)` 即時監聽，改直接讀 `profile.dungeonCollectibles`（`useAuth.js` 本來就對 `members/{id}` 開著監聽，`profile` 內容本來就是即時的），少開一個重複的 `members/{id}` 監聽。確認 `subscribeCollectibles`（`dungeonDb.js`）全專案零其他呼叫點後一併刪除該函式定義。
- **R5 `db.js::subscribePracticeLogs(memberId, callback)`**：加上第三個參數 `maxCount=300` 並在查詢加 `limit(maxCount)`，向後相容（不傳走預設值）。`WorldBossLobby.jsx`／`PartyLobby.jsx`（只需要「我的」worldboss/party 子集，本來是訂閱整個生涯練習紀錄再前端 filter）改傳 `maxCount=60`；`MemberPractice.jsx`（完整練習歷史頁）維持不傳，走預設 300 當防禦性天花板。**沒有加 `where("source",...)` 伺服器端過濾**——那需要新複合索引，索引/規則變更都要老闆手動到 Firebase Console 建，忘記建索引會直接讓正式環境噴 `FirebaseError: The query requires an index`，這個風險大於要省的讀取量，選擇不做。
- **R3 `MonsterBattle.jsx`**：拿掉 mount 時 `subscribeMonsterLogs(profile.id, ..., 100)` 這個常駐 100 筆即時監聽，改成 mount 時呼叫一次性 `getMonsterLogs(profile.id, 30)`。勝利/落敗結算的 `saveMonsterLog(...)` 之後各自串一個新增的 `refreshHistory()` helper（`.catch(()=>{}).then(() => refreshHistory())`）重新抓一次歷史，維持「打完一場預覽清單立刻看得到新紀錄」的既有體驗。「歷史」分頁的一次性抓取筆數也從 20 統一調成 30，跟 mount 時一致。
- **R2（風險最高，全站呼叫頻率最高的路徑）`addRoundArrows`（`db.js`）+ `dungeonExcavation.js`**：
  - 原本每發一箭記分都會對同一份 `members/{id}` 文件做「1 次 `getDoc` + 2 次獨立 `updateDoc`」（一次寫 `totalArrowsAllTime`，一次寫 `dungeonExcavation` 進度，寫入在 `dungeonExcavation.js::addExcavationByArrows` 內部）。
  - `addExcavationByArrows` 改名為 `computeExcavationPatch(memberId, arrowCount)`——**不再自己呼叫 `updateDoc`/`setDoc`**，只回傳 `{ patch }`（要 merge 進 `members/{id}` 的欄位物件），由 `addRoundArrows` 統一組成 `{ totalArrowsAllTime: increment(count), ...excav.patch }` 後只呼叫一次 `updateDoc`，兩次寫入合併成一次。
  - `dungeonExcavation.js` 新增模組級記憶體快取 `_excavCache`（`Map<memberId, {...dungeonExcavation欄位, ts}>`，`readExcavationCached()` 5 分鐘 TTL）：`computeExcavationPatch` 改用快取讀當前 `progress`/`lastActiveDate`/`dailyArrowsUsed`，同一場戰鬥（連續好幾箭）只有第一發箭觸發真正的 `getDoc`，後面每一發都只讀記憶體、算完立刻寫回快取（不是清空逼重讀）。快取是**單一分頁記憶體內**，重新整理/切分頁就清空重讀，不會跨裝置資料錯亂。
  - `addExcavationByCheckin`（每人每天最多 1-2 次，優先度低）維持原本自己 `getDoc` 的寫法，只補了寫入成功後清快取，沒有套用 `readExcavationCached`（PRD 允許做不做都不影響驗收）。

### 為什麼
- catarrow 是純前端 + Firestore 計費架構，沒有後端擋讀寫，`addRoundArrows` 是全站呼叫頻率最高的路徑（打怪/決鬥/組隊/地下城/議會/檢定/世界王 7 種模式的每一發箭都會觸發），任何節省會被「會員總數 × 每日發箭數」放大，投報率最高。其餘 R1/R3/R4/R5 都是「明確浪費」（死代碼、重複監聽同一份文件、無界查詢）的低風險小修。

### 踩坑提醒（尤其重要：R2 的快取失效）
- **`dungeonExcavation.js` 只要是新增/修改「會寫入 `dungeonExcavation` 欄位」的函式，寫入成功後一定要呼叫 `_excavCache.delete(memberId)`！** 這次已經把檔案裡所有既有的寫入函式（`resetAutoDigTimer`/`claimAutoDig`/`initDailyExcavation`/`addExcavationByCheckin`/`revealExcavation`/`upgradeExcavationDifficulty`/`downgradeExcavationDifficulty`/`completeExcavation`/`abandonExcavation`/`saveExcavation`/`removeSavedDungeon`/`grantDungeonScroll`/`useDungeonScroll`/`adminSetSavedDungeon`）都補上了這行，但**未來如果在這個檔案新增任何一個會 `updateDoc`/`setDoc` 寫 `dungeonExcavation.*` 欄位的函式，忘記補 `_excavCache.delete(memberId)` 就會讓 `computeExcavationPatch` 用到舊快取覆蓋掉這次寫入，玩家的地下城發掘進度會靜默算錯**——這是最容易在往後維護時忘記的細節，比對 `computeExcavationPatch` 的實作與快取讀寫邏輯一起看。
- `computeExcavationPatch` 換日（`lastActiveDate !== today`）分支的 `progress` 有 `Math.min(100, ...)` 封頂，但同一天內累加分支**刻意沒有**封頂在 100（沿用舊版 `increment()` 的原始行為，只是把「每次呼叫最多加 100」的封頂保留，最終總和理論上可能超過 100）——這是舊代碼本來就有的不一致，這次是「原樣遷移邏輯」不是新 bug，沒有一併修正（超出本次「不改變玩家可見行為」的範圍）。
- `MonsterBattle.jsx` 拿掉即時監聽後，`saveMonsterLog` 是 fire-and-forget，如果忘記在勝/敗結算後串 `refreshHistory()`，「近期戰鬥紀錄」預覽會卡在打這場之前的舊資料（因為不再有即時推送）。
- `subscribePracticeLogs` 的 `maxCount` 是加在函式簽名最後一個參數（向後相容），呼叫端沒傳就是走預設 300，不會是 undefined 導致 `limit(undefined)` 噴錯。

### 不在本次範圍（PRD 已列出原因，供未來接手參考）
- `db.js::subscribePendingCertTasks`（`onSnapshot(collection(db,"certifications"))` 無 `where`/`limit`，AdminApp 每個教練 session 都常駐）——需要新增反正規化欄位（如 `hasPendingCertTask`）才能改 `where` 查詢，屬於資料模型變更，本次先不動。
- AdminApp/MemberApp 頂層 ~13 個常駐 `onSnapshot`——個別都合理範圍，只有「總數偏多」值得未來考慮合併成聚合文件。
- `DuelRoom`/`DuelLobby` 30 秒心跳寫入——設計上就是有界，優先度低。
- `subscribeEquipItems`/`subscribeAllGuildQuests` 全集合監聽——後台/商店用途、集合成長慢，暫不處理。
- `db.js` 剩餘 ~250 個 exported 函式的死代碼全面稽核——本次只涵蓋 research 階段 spot-check 出的高信心候選，之後如需要可再開一輪 symbol-by-symbol 掃描。

---

## 2026-07-09（新增 ai-guide.md：任何 AI 模型通用的接手手冊）

### 改了什麼
- 新檔 `docs/second_brain/ai-guide.md`：記錄「方法論」層級的知識——功能設計思路（先查再想/資料模型先行/分Phase切/重用戰鬥核心/數值交叉檢查）、UI/UX美術設計語言（深色卡片/漸層按鈕/emoji+SVG/Web Audio音效/手機優先/Hub模式）、除錯SOP（症狀→嫌疑犯對照表、資料流三段檢查）、完工定義 checklist、10條鐵律。
- `CLAUDE.md`：筆記目錄加入 ai-guide.md，並註明「新 AI session 起手式 = ai-guide.md + quick-ref.md」。

### 為什麼
- quick-ref.md 記的是「事實」（哪個函式在哪、踩過哪些坑），但「怎麼想」（設計取捨的邏輯、UI語言、除錯順序）一直只存在於對話歷史裡，換一個 AI 模型或開新 session 就流失。ai-guide.md 把這層 meta 知識落地，讓任何模型讀完就能延續同一套思路。

### 踩坑提醒
- ai-guide.md 與 quick-ref.md 的分工要維持：**方法進 ai-guide、事實進 quick-ref**，不要在兩邊重複寫同一件事（會養出不同步的兩份真相）。新踩的坑照舊寫進 quick-ref/changelog，只有「上升為通用原則」的教訓才回寫 ai-guide。

---

## 2026-07-09（訪客/兒童模式 Phase 5：後台管理——夏令營場次、帳號列表、轉正式、official-only 查詢稽核）

### 改了什麼
- `db.js`：`C` collection 常數新增 `campSessions: "campSessions"`。新增 `getCampSessions()`/`subscribeCampSessions()`/`createCampSession()`/`updateCampSession()`/`deleteCampSession()` 這組場次CRUD（欄位 `{name, startDate, endDate, active, createdBy, createdAt}`，沒有另外存 `qrCode` 欄位——QR的URL是前端用 `?kid=<sessionDocId>` 現算，不需要落地存）。
- `db.js`：新增 `subscribeKidAccounts(callback)`，訂閱整個 `members` collection 再用 JS filter 挑出 `accountType==="guest"||"kid"` 的文件（Firestore 沒有對「有些舊文件完全沒有這個欄位」友善的 `not-in` 查詢，用 `where` 會漏掉，所以维持跟 `getMembers()` 一樣的「client-side filter」模式）。
- `db.js`：新增 `convertGuestToOfficial(memberId, officialFields, newUid, operatorId)`——**原地改寫同一份 `members/{memberId}` 文件**：`uid` 換成新建立的正式帳號 uid、`accountType` 改成 `"official"`、`contactHash`/`createdViaQR` 用 `deleteField()` 清掉，`contactRaw`/`sessionSourceId` 刻意保留當歷史紀錄。**沒有新建文件、沒有搬資料**——遊戲資料（金幣/材料/地下城進度/貓咪等）全部原封不動留在同一份文件裡。
- **為什麼「原地轉換」是安全的**：`createMember()`（給教練後台「新增會員」用）是用 `setDoc(doc(db,"members",uid))`，所以正式會員的 doc ID 剛好等於 auth uid——但這只是建立當下的巧合，`useAuth.js` 的登入查詢是 `query(collection(db,"members"), where("uid","==",fbUser.uid))`，**完全不靠 doc ID 對應 uid**。所以 guest/kid 帳號那份 doc ID 其實是 `addDoc()` 隨機產生的、天生就跟 uid 對不上，轉正式後即使 doc ID 依然對不上新 uid，登入查詢照樣抓得到——不需要為了轉正式另外搬文件或做特殊處理。
- `db.js::getMembers()`／`getMembersForBilling()`：都加上 `isOfficial` filter（`accountType !== "guest" && accountType !== "kid"`，欄位缺省視為 official）。這一改動連帶讓 `AdminMembers.jsx` 會員列表、`MemberLeaderboard.jsx` 排行榜自動排除訪客/兒童帳號（兩者都是呼叫 `getMembers()`）。
- **`resetAllDungeonUsed`/`resetAllMonsterSessions` 刻意沒有加過濾**——design.md 明確說每日重置本來就該對所有帳號類型生效。
- **檢定/競賽報名查詢（`getRegistrations`/`getAllCertRecords`/`isMemberRegistered`）刻意沒有加過濾**——`GuestApp.jsx`/`KidApp` 完全沒有任何UI入口能走到報名/檢定流程，這是結構性不可達，不是真的資料外洩風險，加防禦性 filter 只是死代碼。
- 新檔 `src/components/admin/AdminKidMode.jsx`：場次CRUD卡片列表（含啟用/停用切換、QR彈窗、編輯、刪除）＋帳號列表（可依場次篩選，顯示名稱/帳號類型徽章/聯絡方式/金幣/最近登入）＋「轉正式」彈窗（沿用 `AddMemberModal` 的欄位子集：email/password/name/nickname/archerNo/archerNoDate/joinDate/phone/note，一樣用「臨時第二個 Firebase App」模式建立 email/password 帳號，避免切換教練自己的登入身份）。含一則警語 banner（訪客/兒童帳號安全等級較低，轉正式前勿輸入信用卡等機密資料）。
- `AdminApp.jsx`：`AdminKidMode` 併入 lazy import、`ADMIN_NAV_PRELOADS["hub-member"]`、`AdminMemberHub` 新增「🎈 兒童模式」HubCard、`memberSub==="kidmode"` render 分支。
- `CI=true npx react-scripts build`：Compiled successfully。

### 踩坑提醒
- `campSessions` 的 Firestore 規則（`allow read: if isLoggedIn(); allow write: if isAdmin();`）**在 Phase 1 就已經寫進 `firestore.rules` 並部署過了**，這次沒有再碰 `firestore.rules`。
- `convertGuestToOfficial` 這次刻意設計成「呼叫端自己去建立 Firebase Auth 帳號、拿到 `newUid` 再傳進來」，函式本身不碰 `firebase/app`/`firebase/auth` 的 init 邏輯——維持跟 `AddMemberModal::save()` 一致的「臨時 App 建帳號」慣例，不要在 `db.js` 裡另外發明一套。
- `subscribeKidAccounts`/`getMembers`/`getMembersForBilling` 都是整包 collection 訂閱/抓取後在 JS 端 filter，會員數量大時要注意效能，但目前跟既有 `subscribeMembers()` 的模式一致，沒有引入新的效能落差。

---

## 2026-07-09（訪客/兒童模式 Phase 4：兒童模式打怪難度修正 + UI簡化 + 跨帳號協戰確認）

### 改了什麼
- `MonsterBattle.jsx`：`kidMode` prop 原本設計是「拉高兒童模式的 archerStats（hp/atk/def）讓小朋友更好打贏」，**在寫完當下自我發現這是個會反效果的設計並改掉**：`archerStats` 會餵給 `calcArcherPower()`（`monsterData.js:523`，公式 `hp*0.4+atk*1.5+def*1.0`）決定 `getTierPoolByPower()` 能配對到哪些怪物階級。訪客基礎數值（100/10/10）戰力是65，落在 `<100` 只會配對 `common/rare`；原本規劃的兒童加成數值（180/22/16）戰力是121，會跨過 `>=100` 門檻多解鎖 `elite` 階怪物——而 elite 怪物血量/攻擊力約是 common 的2.6倍，遠超過數值加成帶來的優勢，等於兒童模式反而更難打。**最終改成訪客/兒童共用同一組基礎數值，完全不動戰鬥數值。**
- 兒童模式的「更好打」改用 UI 簡化達成：出戰前「開始挑戰」按鈕在 `kidMode` 下放大（`py-6 text-2xl`）、文案改成「⚔️ 出發打怪！」。
- `GuestApp.jsx`：`<MonsterBattle isGuest={true} kidMode={isKid} />`，正式把 `kidMode` 接上。
- 確認「官方學生/家長協助兒童打地下城」需求**不需要新程式碼**：`PartyLobby.jsx`/`DungeonLobby.jsx` 的房號加入機制本來就跟 `accountType` 無關，`MemberApp.jsx` 已經掛了這兩個元件的入口，官方學生本來就能直接輸入房號加入兒童模式建立的房間。
- `CI=true npm run build`：Compiled successfully。

### 踩坑提醒
- **千萬別為了「讓某模式更好打」直接拉高 `archerStats`**——這個數值同時是戰鬥力也是怪物配對難度輸入，兩者是耦合的。要做難度調整應該只動傷害計算或選怪池，不要動會被 `calcArcherPower` 讀到的數值。
- `getTierPoolByPower` 門檻：`<50`→common only；`>=50`→+rare；`>=100`→+elite；`>=180`→+fierce；`>=280`→+boss；`>=400`→+mythic。日後任何「戰力相關」的加成都要先檢查會不會跨這些門檻。

---

## 2026-07-09（訪客/兒童模式 Phase 3：簡化版地下城 + 體驗紀念卡）

### 改了什麼
- 新檔 `src/components/dungeon/GuestDungeonSimple.jsx`：固定3層地下城，第1層抽 common 階、第2層抽 rare 階任意族怪物，第3層固定王「十八王公」（`ghost_5`），戰鬥核心重用既有 `DungeonBattleRoom.jsx` + `expeditionDb.js::createExpeditionBattleRoom`（跟正式遠征系統走同一套 `useFirestoreRound` 引擎，只是不掛接挖掘/地圖/事件/商店那些複雜系統），完全比照 `DungeonExpedition.jsx` 裡 `ExpeditionBattleRoom` 的既有驗證過模式（用 `dungeonRooms/{roomId}` 的 `status` 變化偵測樓層完成/失敗）。
- 新檔 `src/components/member/GuestShareCard.jsx`：訪客/兒童的體驗紀念卡，視覺沿用 `ShareCard.jsx` 的漸層卡片美術（同一份 `SHARE_THEMES` 色票、同一套 `html2canvas` 存圖機制），內容改成暱稱/累積金幣（即時訂閱）/標語/日期——**範圍比 PRD 原訂的更精簡**（沒有做「今日擊敗的怪物清單/地下城通關層數」這些逐場戰績統計，因為目前沒有把每個子系統的戰鬥結果往上冒泡回 `GuestApp.jsx` 彙整，那需要另外設計一個 session 統計層）。
- `GuestApp.jsx`：新增「地下城」跟「結算」分頁，首頁 bento grid 卡片同步補上。
- `CI=true npm run build`：Compiled successfully。

### 踩坑提醒
- `GuestDungeonSimple.jsx` 用的怪物固定王 id 是 `ghost_5`（十八王公），如果之後 `monsterData.js` 改了這隻怪的定義或刪掉，這裡要記得跟著改，目前沒有做防呆 fallback 以外的處理（找不到會退到 `MONSTERS[0]`，體驗會變得很奇怪但不會壞掉）。
- 體驗紀念卡目前只有「累積金幣」是真實動態數據，其餘（怪物擊殺清單、地下城戰績）是已知的簡化——如果之後要做完整版，需要在 `GuestApp.jsx` 層級加一個 session 統計 state，讓 `MonsterBattle`/`GuestDungeonSimple`/`WorldBossLobby` 等子元件在勝利時往上回報一個事件。

---

## 2026-07-09（訪客商店金幣改接持久帳號）

- `GuestShop.jsx`：金幣餘額從 `sessionStorage.getItem("guest_coins")`（每次3小時就重置回500）改成訂閱真正的 `members/{memberId}.coins`，購買扣款也改用 `addCoins(memberId, -cost)`。新增 `memberId` prop，由 `GuestApp.jsx` 傳入 `guestProfile.id`。
- 世界王藥水/打怪金幣護符這類**單次消耗buff維持原本的 sessionStorage**（本來就該是一次性效果，不需要跨次保留）。
- `CI=true npm run build`：Compiled successfully。
- **`MonsterBattle.jsx` 的 `isGuest` 模式持久化落差這次沒有動**——那個檔案體量太大、`isGuest` 邏輯散落在十幾個地方，牽動每天在用的正式打怪系統，這麼晚的時間點不適合冒險做大範圍重構，留給下一輪專門處理。

---

## 2026-07-09（訪客/兒童模式 Phase 2：全新訪客UI，舊版 GuestBattle 整個淘汰）

### 改了什麼
- 新檔 `src/pages/GuestApp.jsx`：取代舊的 `GuestBattle.jsx`。入口畫面改成輸入信箱/電話（呼叫 Phase 1 的 `resolveGuestSession`），不再是「輸入名稱即可、3小時後全部清空」。分頁：首頁（bento grid卡片導覽）/打怪/世界王/決鬥/組隊/商店，視覺全新設計（深色漸層入口頁+卡片式首頁，跟正式會員的 `MemberApp` 風格明顯區隔）。`accountType` prop 決定是訪客（紫藍配色）還是兒童模式（橘紅配色），兒童模式文案語氣也不同。
- `App.jsx`：路由改成 `?guest=1` / `?kid=1`（或 `?kid=<sessionId>`）直接進 `GuestApp`，完全移除舊的 `GuestRoute`（token驗證+過期畫面）邏輯。
- `AdminMembers.jsx::GuestQRModal`：訪客QR產生流程大幅簡化——舊版要教練每次點「產生新QR」拿一個3小時有效的一次性token；新版是固定連結（`?guest=1`），印一次就能長期張貼，因為身份持續性現在是靠訪客自己輸入的信箱/電話，不需要教練預先產生。
- `db.js`：移除整組已淘汰的訪客 session 函式（`createGuestSession`/`getGuestSession`/`deleteGuestSession`/`generateGuestToken`，含 `guestSessions` collection 的使用）。
- 刪除 `src/components/member/GuestBattle.jsx`。
- `CI=true npm run build`：Compiled successfully（main bundle 因為刪掉舊檔還變小了 37KB）。

### 為什麼
- 使用者明確要求「全新設計，舊的整個遺棄」，且訪客身份要能跨次造訪追蹤——這跟舊版「用完即丟」的token模型在概念上互斥，必須整個換掉而不是並存。

### 踩坑提醒
- **這個階段還沒有做地下城分頁跟結算分享卡**（Phase 3 才做），現在的 `GuestApp.jsx` 分頁是「首頁/打怪/世界王/決鬥/組隊/商店」六個，PRD 定案的完整清單還少了「地下城」跟「結算分享」。
- **`MonsterBattle.jsx` 的 `isGuest={true}` 模式目前仍是完全不持久化**（內部大量 `if (isGuest) return` 跳過所有寫入邏輯，且讀取的 `profile` 來自 `useAuth()` 而非傳入的 guest 身份）——這代表訪客帳號雖然現在會員文件是持久的，但「打怪」分頁本身的戰績/掉落目前還是不會存進那筆持久記錄。組隊/決鬥/世界王三個分頁因為原本就支援 `guestOverride` prop，這次改用真正持久的 `id`（不再是每次隨機產生的 `guest_xxx_隨機碼`），所以這三個模式的紀錄已經是跨次持續的。
- `GuestShop.jsx` 的金幣餘額目前還是讀 `sessionStorage.getItem("guest_coins")`，沒有接到持久的 `members/{id}.coins`——這兩個是已知但這次沒做的落差，如果要讓「打怪」和「商店」也真正持久化，需要另外排一輪重構（`MonsterBattle` 要能吃一個 profile-like prop 而不是只認 `useAuth()`）。
- **Phase 1 的 `firestore.rules` 如果還沒手動貼到 Firebase Console，這次的 `GuestApp` 完全無法運作**（`resolveGuestSession` 的 create/update 會被舊規則擋下）。

---

## 2026-07-09（訪客/兒童模式 Phase 1：accountType 資料模型 + Firestore 規則 + 掃碼接續帳號邏輯）

Trellis 任務 `07-09-guest-kid-mode-overhaul`（大型多階段任務，這次只做 Phase 1），PRD/design/implement 見 `.trellis/tasks/07-09-guest-kid-mode-overhaul/`。

### 改了什麼
- `firestore.rules::members`：新增 `accountType in ["guest","kid"]` 的專屬分支——`create` 匿名登入即可建立（前提 `uid` 對得上自己這次的登入）；`update`/`get` 對 guest/kid 文件**不要求 uid 對應本人**（因為每次匿名重新登入 uid 都不同，要能跨次造訪接續回同一筆記錄）。既有 `official` 帳號的規則完全沒變動（uid/email對應+hasOnly白名單）。新增 `campSessions` 集合規則（夏令營場次管理，登入可讀、admin可寫）。
- 新檔 `src/lib/guestAuth.js`：`resolveGuestSession(contact, accountType, sessionSourceId)`——匿名登入→用聯絡方式的 sha256 hash 查詢有沒有既有記錄→有就接續（改寫 uid）、沒有就新建。`normalizeContact()`（email轉小寫、電話去除非數字字元）、`sha256()`（用瀏覽器原生 `crypto.subtle`，不需要後端函式）。
- `CI=true npm run build`：Compiled successfully。

### 為什麼
- 使用者要新增可跨次造訪追蹤的訪客模式＋新的兒童模式（夏令營用），且兩者都要能跟正式學籍一起組隊/打地下城，最後還要能轉正式——這需要一個新的帳號分類（`accountType`）疊加在既有 `members` 集合上，而不是另開一個平行的 collection，這樣才能讓「轉正式」變成單純改一個欄位、不用搬資料，也讓地下城/打怪/合成等現有系統完全不用改就能相容。
- 匿名登入每次 uid 都不同，是這個功能最大的技術障礙——既有的「uid 必須對應本人」規則會擋掉「同一個信箱下次再來却是新uid」的情境，所以 guest/kid 分支刻意放寬，是跟使用者確認過的安全取捨（訪客/兒童帳號沒有真實金流/隱私資料）。

### 踩坑提醒
- **這次的 `firestore.rules` 修改必須手動貼到 Firebase Console 才會生效**，在貼上之前，`resolveGuestSession()` 呼叫會全部失敗（因為線上的規則還是舊版，不認得 guest/kid 分支）。CLI 部署一樣會 403（沿用專案既有已知限制）。
- Phase 1 只做了地基（資料模型+規則+登入接續邏輯），**還沒有任何 UI 會呼叫 `resolveGuestSession()`**——舊的 `GuestBattle.jsx`／`App.jsx::GuestRoute` 完全沒有改動，現有訪客連結流程照常運作不受影響。Phase 2（訪客新UI）才會真正接上這個函式。
- 之後任何新增寫入 `members` 頂層欄位的地方，要記得 guest/kid 分支是完全放行的（`isLoggedIn() && accountType in [guest,kid]`，沒有 hasOnly 限制），跟 official 分支的白名單邏輯不同，改規則時兩塊要分開看，不要誤植。

---

## 2026-07-09（世界王六大族改版：12隻家族王＋三類完整掉落表＋排名獎勵＋48專屬獎盃）

Trellis 任務 `07-09-worldboss-family-split-rewards`，PRD/design/implement 見 `.trellis/tasks/07-09-worldboss-family-split-rewards/`。

### 改了什麼
- **六大族從6隻改成12隻**（`worldBossData.js::WORLD_BOSSES`）：既有6隻改當「大王」（`familyTier:"big"`，代表該族T4~T6，數值/外觀不動），新增6隻「小王」（`familyTier:"small"`，代表T1~T3，數值抓大王的35~45%）。**移除 `rTier` 全域排序**，六族之間不刻意比較強度。世界王總數 18→24（教練3+貓貓9+家族12）。
- 新建 `docs/second_brain/worldboss-small-boss-prompts.md`：6隻新小王的完整 GPT/Midjourney 生圖提示詞（含通用風格前綴、各自配色/角色設計描述），小王外觀暫時 fallback 借用同族大王的像素圖（`WorldBossSVG.jsx::PIXEL_MAP`），生圖後存成 `public/worldboss/{bossKey}.webp` 會自動優先讀取。
- **世界王卡自動擴充到24張**：`worldBossCards.js` 的 `WB_CARDS` 是動態依 `WORLD_BOSSES` key 產生，不用改程式碼，資料層補齊後自動生效。
- **`claimWorldBossKillReward` 全面重寫**（`worldBossDb.js`）：新增 `DROP_TABLE_BY_CATEGORY`/`getDropCategory(boss)`，依「六族小王/六族大王/貓貓/教練」四分類決定完整掉落表——比例貨幣（金幣/箭露/射手經驗/貓咪經驗/羈絆值，依自己傷害佔全團總傷害%分配，下限1）、寶箱（六族=該族材料寶箱不掉金幣箱；貓貓/教練=T?~T6金幣寶箱×5+咪咪箱+貓貓箱機率+怪物卡包1~3；教練額外六族材料寶箱×10隨機族）、世界王卡機率（25%/25%/20%/10%，重複已擁有改發100金幣）、世界王地下城召喚卷。
- **排名額外獎勵**（`RANK_BONUS`，疊加不取代均分獎勵）：第一/二/三名各自3000/2000/1000金幣+500/250/100箭露+10轉蛋幣+貓貓箱+咪咪箱各1；尾刀王+500箭露+咪咪箱1。
- **48件世界王專屬收藏獎盃**（`WB_TROPHY_MAP`，24隻×尾刀+前三名2種）：比照 `dungeonCollectibles.js` 首通紀念章模式，存進同一個 `member.dungeonCollectibles` 欄位（id前綴不會撞名，不用另開欄位）。`achievementDex.js` 動態產生對應48個成就（`cat:"special"`，隱藏型，達成才顯示）。
- **後台清理**（`AdminWorldBoss.jsx`）：移除完全沒被讀取的「🏆擊殺分層獎勵」區塊（含死掉的「前3名」分頁——這次重寫後其實連「第1名」「其餘」兩個分頁也一起變成死的，均分獎勵改由 `DROP_TABLE_BY_CATEGORY` 自動決定，不再是後台單場活動可編輯的東西），Boss 選單加上「🔹小王／🔸大王／👑教練／🐱貓貓」標籤。
- **世界王登場動畫**：確認 `WorldBossIntro.jsx` 本來就是完全資料驅動（讀 `WORLD_BOSSES[bossKey]` 的 name/title/desc/accent/bg + `WorldBossSVG`），6隻新小王资料補齊後**自動**就有完整的震動→光環→登場→標題動畫，不用另外寫代碼。
- **6隻小王專屬反擊語錄**（`BOSS_QUOTES`，網路迷因/生活梗）：`WorldBossAttack.jsx` 的反擊台詞選擇邏輯改成優先查有沒有這隻王的專屬語錄，有就用專屬的，沒有（其餘18隻王）沿用原本的通用台詞池。
- `catDb.js::addCatBond` 新增第4參數 `customAmount`，可覆蓋原本 source 對應的固定值，供世界王比例分配羈絆值使用（小改動，向後相容）。
- `CI=true npm run build`：Compiled successfully（分七次修改，每次都過）。

### 為什麼
- 使用者指出六大族「跨族統一排R1~R6」的設計理解錯了，正確需求是「一族2隻，各自代表該族前三階/後三階」，族與族之間不用比較。
- 使用者要求把「均分獎勵」擴充成完整道具清單（含之前完全沒整合進世界王的箭露/轉蛋幣/各種經驗值/羈絆值），並依教練/貓貓/六族三大類分別訂出完整掉落表——這是本次最大的邏輯重寫，把「均分獎勵」從單純「金幣+固定寶箱」升級成「比例貨幣+分類寶箱+王卡機率+召喚卷」的完整系統。
- 使用者確認「前三名/尾刀」除了數字獎勵，還要各自對應每隻王專屬的收藏獎盃+成就（不是通用的），所以新增48件獎盃而不是沿用原本的2個通用成就。

### 踩坑提醒
- **均分獎勵現在不是後台單場活動可編輯的東西**——`DROP_TABLE_BY_CATEGORY` 的池子大小/寶箱數量/王卡機率全部寫死在 `worldBossData.js`，後台只保留「保底」（`reward.base.coins`）可調。PRD 原本有寫「後台可調整這四分類的數值」，這次為了控制範圍**沒有做**，只在 `AdminWorldBoss.jsx` 留了說明文字告知教練要調整請直接改檔案。如果之後真的需要後台可調，要另外比照 `worldBossSpawn` 的 `sysConfig` 模式做一個 `worldBossDropTable` 設定。
- `addCatBond` 的比例羈絆值目前是「有裝備貓咪才給，沒裝備改發等值金幣（1:1換算）」，這個換算率是初版猜測值，沒有精算平衡，之後如果玩家反應「不裝貓咪拿到的金幣補償感覺不划算/太划算」需要回來調 `WB_NO_CAT_COIN_RATE`。
- `participants.{memberId}` 沒有記錄「打王當下裝備哪隻貓」，貓咪經驗/羈絆值是用**結算當下**（不是攻擊當下）的裝備貓咪去發放，如果玩家在打王期間中途換貓，獎勵會算到最後換上的那隻貓身上，不是每次攻擊當下那隻——這是刻意的簡化，避免動到 `attackWorldBoss` 主流程。
- 六大族材料寶箱型別只有 wood/iron/gold/epic/mythic 5階（`itemData.js::CHEST_TYPES`），但怪物階級有6階（common~mythic），T5/T6 都對應到 `epic`/`mythic`（`MATERIAL_CHEST_TYPE_BY_TIER` 陣列），不是嚴格1:1對應，這是既有系統的限制沿用，不是這次引入的新問題。

---

## 2026-07-09（箭數里程碑統一修復 + 世界王 mimiBoxes 死欄位修復）

### 改了什麼
- **`db.js`：里程碑發獎統一成一套**。`checkAndGrantArrowMilestones`（下課/決鬥/議會/打怪/公會共用的較新函式）原本讀 `r?.rewards`，但 `getRewardsForMilestone()` 實際回傳的是扁平物件 `{gachaCoins, catBoxes}`，根本沒有 `.rewards` 欄位——導致這個函式**永遠不會真的發轉蛋幣/貓貓箱，卻還是會把里程碑標記成「今天已領過」**。改成內部呼叫本來就寫對的 `grantArrowMilestoneRewards()` 實際發獎，`checkAndGrantArrowMilestones` 現在只負責「重新查詢今日累計箭數＋算出穿越了哪些門檻」這件事。
- **更深一層的臭蟲**：上面那個「重新查詢今日累計箭數」的邏輯，讀的欄位是 `arrowTotals`（巢狀物件），但**全專案沒有任何一個地方會寫入這個欄位**——所有 `addPracticeLog` 呼叫端寫的都是 `totalArrows`（單一數字）。也就是說這個查詢過去永遠算出「今天 0 箭」，只有靠呼叫端自己傳入的 `sessionArrowCount` 撐著，導致跨場次的里程碑（例如上午打了3場怪各6箭，理論上該跨過18箭門檻）永遠抓不到，只有下課時（`DailyQuest.jsx` 剛好是傳「今日總箭數」而非單場箭數，數學上意外地矇對）才會補上。已改成正確讀取 `totalArrows`。
- 同時修正一個潛在的重複計算風險：修好欄位名稱後，若呼叫端在 `addPracticeLog` 沒 `await` 完成就緊接著呼叫 `checkAndGrantArrowMilestones`（打怪/決鬥/議會都是這樣寫的 fire-and-forget），查詢到的「今日累計」可能剛好已經包含本次剛寫入的那筆，再加一次 `sessionArrowCount` 會重複計算。改用「用查到的新總數反推舊總數」（`oldTotal = max(0, newTotal - sessionArrowCount)`）取代「查到舊總數再加」，避免這個 race condition 造成重複發獎。
- **檢定/畢業考（`MemberCertExam.jsx`）補上箭數追蹤**：原本完全沒有呼叫任何箭數相關函式。任務一固定6箭、任務二固定10箭，送出時呼叫 `addRoundArrows`＋`addPracticeLog`（`source:"cert"`）＋`checkAndGrantArrowMilestones`，達成里程碑會直接顯示在送出成功的訊息裡。
- **世界王 `mimiBoxes` 死欄位修復**：後台獎勵表單本來就有咪咪箱可以調，但 `claimWorldBossKillReward` 從沒讀過這個值，設定了也不會真的發。補上發放邏輯（產生 `mimi_box` 寶箱）＋`WorldBossLobby.jsx` 的「你的獎勵」顯示區塊補上這行。
- `CI=true npm run build`：Compiled successfully（分四次修改，每次都過）。

### 為什麼
- 使用者回報「地下城可能記錄可能不記錄」「檢定畢業考沒紀錄」「累積箭數但下課沒拿到箭露/轉蛋幣」，追查後發現是同一套系統裡疊了兩層 bug（發獎讀錯欄位 + 查詢讀錯欄位），檢定則是完全沒接。
- **澄清一個調查時的誤判**：一開始委派調查時，回報「地下城/組隊/單人遠征完全沒呼叫 `addRoundArrows`」，但實際追下去發現地下城/遠征三種模式（經典、單人遠征、組隊遠征）最終都是靠同一顆共用元件 `DungeonBattleRoom.jsx` 出箭，這顆元件本來就有呼叫 `addRoundArrows`＋`addPracticeLog`，所以**地下城/遠征的箭數本來就有在記錄**，不是真的漏接——用戶感受到的「有時候沒記錄」，根因其實是上面那個「跨場次查詢永遠算出0」的 bug，不是地下城特別漏接。這提醒之後调查「某功能是否被呼叫」時，光在最外層 wrapper 檔案 grep 函式名稱不夠，要追到實際渲染/送出箭矢的共用元件。

### 踩坑提醒
- `getRewardsForMilestone()`（`arrowMilestone.js`）回傳的是**扁平物件**（`{gachaCoins, catBoxes}`），不是 `{rewards:[...]}` 陣列——以後如果要改里程碑獎勵結構，要嘛保持這個扁平格式，要嘛同時改掉 `grantArrowMilestoneRewards()` 讀取的方式，不要只改一邊。
- `checkAndGrantArrowMilestones` 的「今日累計」查詢跟 `DailyQuest.jsx`/`MemberHome.jsx` 前台顯示用的加總邏輯（`l.totalArrows ?? ...`）現在終於讀同一個欄位了，兩邊要保持一致，不要其中一邊又改成別的欄位名。
- **已經被舊 bug「標記成已領但獎勵是0」的里程碑沒有做追溯補發**——沒辦法自動分辨誰是真的用舊函式正確領過、誰是被新函式吃掉。這次選擇不追溯（風險考量：追溯可能造成少數人重複領取），之後如果要補發，需要教練手動判斷或後台新增一個批次工具。
- 世界王的「非擊殺獎勵」（每次出戰結算的金幣/箭露/轉蛋幣/經驗值）目前完全跟打哪隻王無關（寫死數字，跟18隻王的強度分級脫節）——這次只修了 `mimiBoxes` 死欄位，「非擊殺獎勵要不要照 R1~R6 強度分級」是使用者還沒定案的重新設計題目，留待下一輪討論。

---

## 2026-07-09（成就圖鑑：地下城死代碼清理 + 貓貓卡片數量顯示修正）

### 改了什麼
- `MemberHome.jsx` 首頁「收藏進度列」的貓貓卡片格：`catTotal` 從寫死的 `100` 改成 `CAT_CARDS.length`（動態抓 `catCardData.js` 實際張數，目前200），`catOwned` 從錯誤讀取怪物卡收藏（`cardData.cards`）改成正確讀 `profile.catCards`（比照 `GachaMachine.jsx::CardDex` 的正確寫法）。`GachaMachine.jsx` 裡另一處寫死的 `/200張` 也順手改成 `CAT_CARDS.length`。
- `achievementDex.js`「地下城」成就類別整個重寫：舊版 10 個成就全部依賴 `dungeonClears`/`dungeonFamClear` 這兩個欄位，全專案沒有任何地方會寫入，是永遠不可能達成的死成就（推測是舊版「6族×4難度×24張地圖」地下城模型的遺留，現在的地下城系統早就不是那個模型）。改成基於真正會寫入的 `member.dungeonCollectibles`（地下城掉落收藏品，`dungeonCollectibles.js` 定義：6族×(20普通+10稀有+5頭目+1超稀有)=216件+24首通紀念章=240件），新增：拾獲總數里程碑（1/10/60/150/240）、六族踏查、每族拾荒者/收藏家/稀有獵人/稀有大師/王者遺物/至寶（6族×6檔=36個）、24張首通紀念章成就。**沒有動到任何資料寫入邏輯或 `computeDexStats` 的呼叫端**——`dungeonCollectibles` 本來就是 `member` 物件的欄位，已經在 ctx 裡，不需要额外接線。
- `CI=true npm run build`：Compiled successfully。

### 為什麼
- 使用者指出前台貓貓卡片數量顯示錯誤（明明有200張卻顯示100），追出去發現不只是數字寫死，連讀取的資料來源都是錯的（讀成怪物卡收藏）。
- 使用者要求先處理成就圖鑑裡的死代碼，並指定「地下城」類別要改成「地下城道具圖鑑」，之後要對應玩家技能——順著這個方向，剛好 `dungeonCollectibles.js` 本來就是一個完整、正在運作、資料量豐富（240件）的道具收藏系統，比重新設計一套全新的更合理，直接拿來用。

### 踩坑提醒
- `achievementDex.js` 的成就 `check` 函式讀 `c.member?.xxx` 時，`c.member` = `computeDexStats()` 呼叫端傳入的 `member: profile`，也就是完整的會員文件——**不是**額外接線進來的欄位。之後要用會員文件上任何既有欄位當成就依據，直接讀 `c.member?.欄位名` 即可，不用改 `computeDexStats` 的參數簽章或去改 7 個呼叫端。
- 圖鑑 `card_all6fam`（怪物卡「六族全收」成就）目前仍寫死 `["ghost","mountain","insect","workplace","exam","temple"]`，跟寶箱族擴充後的 `FAMILY_STAT` 不同步（寶箱族怪物卡理論上可以掉，但這個成就抓不到）——這次沒有動，留給下一輪成就圖鑑擴充時一併處理。
- 世界王/貓貓陪伴/貓貓卡200張/村莊/符文系統目前完全沒有對應的成就類別，是下一輪要討論設計的範圍（使用者已提出「三個收集元素未來對應HP/ATK/DEF技能」的方向，尚在討論階段，還沒定案）。

---

## 2026-07-09（世界王自動刷新天數改為可設定，預設鎖定30天）

- `worldBossDb.js`：新增 `getWorldBossSpawnConfig()`/`saveWorldBossSpawnConfig(days, operatorId)`，存在 `sysConfig/worldBossSpawn.durationDays`（沿用既有 `sysConfig` collection 規則，讀取任何登入者可，寫入僅 admin，不用改 `firestore.rules`）。`autoSpawnWorldBoss()` 原本寫死 `durationDays: 7`，改成讀這個設定，預設值 30（等於 `BOSS_DURATION_MAX_DAYS` 上限）。
- `AdminWorldBoss.jsx`「建立活動」分頁新增一張獨立卡片可以調整這個天數（跟下面手動建立活動用的「持續天數」欄位是分開的兩件事，不要混淆——一個是系統自動開王用，一個是教練手動開王時單次用）。
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（世界王後台補完：獎勵表單接上分級建議 + 直接移除功能 + 自動刷新機制確認）

延續世界王 Phase 2 的部署前確認，發現後台「建立活動」表單完全沒用到 Phase 2 新寫的 5 檔獎勵分級系統。

### 改了什麼
- `AdminWorldBoss.jsx`：新增 `rewardFromBossKey(key)`，選王時（非隨機模式）用 `useEffect` 自動把 `getRewardByBossKey(bossKey)` 的建議值帶進表單（教練仍可手動覆蓋，另外加了「套用建議值」按鈕可以隨時重置），並在獎勵區塊標題旁顯示目前選中的王屬於哪個建議檔次（入門/低/中/高/頂級）。
- 新增「🗑️ 直接移除」動作：`forceEndWorldBossEvent(eventId)` 原本是完全沒有呼叫點的死函式，改成真正用途——狀態改成 `"cancelled"`（不同於「強制結束」用的 `expireWorldBossEvent`／`"expired"`，不發任何獎勵、不寫入 `worldBossHistory`），給教練在建錯王/測試用王時可以直接撤掉。`subscribeLatestWorldBoss` 補上排除 `"cancelled"` 狀態。
- 確認 `autoSpawnWorldBoss()`（玩家進世界王頁面時觸發的每日自動刷新）：`WORLD_BOSS_KEYS` 是動態算的，自動涵蓋新的 18 隻王，沒呼叫點需要改；未傳 `reward` 給 `createWorldBossEvent` 時會 fallback 到 `getRewardByBossKey`，所以自動刷新本來就吃得到新的 5 檔分級系統。**但選王邏輯本身是均勻隨機**（排除上一隻，其餘 17 隻等機率），完全沒有利用 R1~R6 的難度排序做漸進式出王——這是沿用舊有邏輯，不是這次改壞的，但如果之後想要「由弱到強」的世界王節奏，需要另外設計選王權重，目前沒做。

### 為什麼
- 使用者部署前主動確認後台是否跟上新設計，抓到「手動建立活動」這條路徑完全繞過新的分級系統——教練手動開王時獎勵永遠是同一組寫死的值，跟選哪隻王無關，等於 Phase 2 的分級設計在最常用的建立方式裡形同虛設。

### 踩坑提醒
- 世界王事件現在有 4 種終止狀態：`defeated`（擊殺）、`expired`（超時，發安慰獎）、`cancelled`（教練直接移除，不發獎勵，新增）、以及理論上還沒被排除的其他未來狀態——任何新增「排除非活躍事件」的查詢（比照 `subscribeLatestWorldBoss`）都要記得把 `cancelled` 也排除掉，不能只排 `expired`。
- `mimiBoxes` 欄位（後台表單有，但 `claimWorldBossKillReward` 從沒讀過）仍然是死欄位，這次沒有動，發現只是順便記錄。
- 世界王卡的擊殺掉落機率（`WB_CARD_DROP_CHANCE=0.10`）跟世界秘寶箱內容數值都還是寫死在 `worldBossDb.js`/`itemData.js`，後台目前看不到也調不了，這次也沒動，只是一併記錄成已知現況。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（世界王 Phase 2：18隻王重製 + 專屬寶箱/卡片 + 卡片系統裝備改版）

Trellis 任務 `07-09-worldboss-phase2-cards`，PRD/design/implement 見 `.trellis/tasks/07-09-worldboss-phase2-cards/`。

### 改了什麼
- **世界王資料**（`worldBossData.js`）：貓貓系列從 3 隻通用貓改成 9 隻真貓（`cat_daming`~`cat_diandian`，讀 `catData.js::CATS`+`CAT_SKILL_GROUPS`），六大族新增 `rTier:1~6`（poison→forest→exam→ghost→office→western 難度遞增），教練系列數值上調成隱藏王定位。`rewardByHP()` 改成 `getRewardTier()`+5檔（entry/low/mid/high/top）取代原本3檔 HP 門檻寫死判斷。`WorldBossSVG.jsx` 新增 `CatGenericPixel`（讀 `catData.js` 的 `palette` 上色），取代原本寫死的 3 隻貓像素圖，9 隻貓共用一套版型。
- **卡片系統核心**（`monsterCards.js`）：新增 `worldboss` 卡片階級（固定 25 點加成、無升星）、`resolveEquippedCards()`（相容新舊 `equipped` 格式的統一解析函式）、`calcEquippedBonus()` 回傳值擴充 `dmgBonusPct/dmgReducePct/healBonusPct`（僅 worldboss 卡才有，每張 +3%）。裝備上限從「總共5張任意」改成「怪物卡 HP/ATK/DEF 各3張（`MAX_EQUIPPED_PER_STAT`）+ 世界王卡獨立3張（`MAX_WB_EQUIPPED`，不分屬性）」。
- **世界王卡定義**（新檔 `worldBossCards.js`）：18張，六族/貓貓卡固定屬性（沿用 `FAMILY_STAT`/分組），教練卡開卡時玩家自選屬性。
- **Firestore 層**（`db.js`）：`cardCollections/{id}` 新增 `wbCards`（世界王卡池，跟 `cards` 怪物卡池分開）；`equipCard`/`unequipCard` 簽章改成 `(memberId, key, source)`，`source==="wb"` 走獨立3格上限、`source==="monster"` 走per-stat 3格上限；新增 `addWorldBossCard`（一隻王一張，重複略過）、`setWorldBossCardStat`、`setActiveTitle`/`clearActiveTitle`（稱號＝從已裝備王卡選一張的 `title` 對外顯示）、`adminGrantWorldBossCard`（後台限定發放，不進任何掉落池）。
- **寶箱**（`itemData.js`）：新增 `wb_relic`（世界秘寶箱，教練/貓貓王掉落，開出金幣+`wb_relic_shard`世界王專屬材料，新增進 `monsterMaterials.js`）。六大族王沿用既有 `gold/epic/mythic` 家族寶箱，`chest.family` 用新的 `WB_FAMILY_TO_DUNGEON_FAMILY` 對照表轉成地城6族key（`poison→insect, forest→mountain, office→workplace, western→temple`，`ghost/exam`同名）。
- **卡片掉落機制**（`worldBossDb.js::claimWorldBossKillReward`）：世界王專屬卡片改成**擊殺結算當下直接判定機率**（`WB_CARD_DROP_CHANCE=0.10`）直接呼叫 `addWorldBossCard`，不用開箱，符合「卡片只從世界王身上掉」的需求；寶箱另外照六族/教練貓貓分支發放。
- **傷害公式**（`damage.js`）：`calcRoundDamage`/`calcWorldBossArrowDmg` 加可選 `dmgBonusPct` 參數；`calcStandardCounter`/`calcPartyCounter`/`calcWorldBossCounter`/`calcDungeonCounter` 加可選 `dmgReducePct` 參數，預設0（無加成，不影響既有呼叫點）。
- **戰鬥端接線**：`WorldBossAttack.jsx` 完整串接（傷害/減傷都套用）；`partyDb.js::processPartyRound`／`PartyBattleRoom.jsx` 完整串接（含治療加成，`updateBattleMemberStats` 新增 `wbBonus` 參數寫入 `members.{id}.wbBonus`）；`dungeonDb.js::processDungeonRound` 也接了 `m.wbBonus` 讀取（傷害/減傷/治療），但**目前是死接線**——見下方踩坑提醒。
- **UI**：`CardCollection.jsx` 全面重寫——已裝備區改三欄（HP/ATK/DEF各3格）+世界王卡獨立3格列、篩選籤改「全部/HP/ATK/DEF/世界王」、卡片列表改九宮格小卡片、世界王卡用全息動態邊框CSS+底部稱號小字、可從已裝備王卡設定「使用中稱號」。新增 `WorldBossCardBadge.jsx`（純視覺閃亮徽章），掛在 `WorldBossAttack.jsx`/`PartyBattleRoom.jsx`/`DungeonBattleRoom.jsx` 三處玩家名牌旁（裝備任一王卡才顯示）。`AdminWorldBoss.jsx` 新增「發放王卡」分頁（選會員+選王卡+可選屬性→發放，不進任何玩家掉落池）。

### 為什麼
- 貓貓系列改真貓：使用者要求世界王要對應道館真實養的九隻貓，不能沿用舊的3隻通用貓皮。
- 卡片裝備改「per-stat 3張」+「世界王卡獨立3格」：使用者明確定案，怪物卡跟世界王卡是分開的收藏池，但裝備欄位只有世界王卡自己獨立（不佔怪物卡的 HP/ATK/DEF 格），這樣才問得出「那稱號?」——因為世界王卡欄位是獨立的，才會需要一個「從裝備中選一張當稱號」的機制。
- 卡片只從世界王身上掉：使用者明確反對「打贏王→掉寶箱→開箱才可能出卡」這種間接掉落，要求擊殺當下直接判定，寶箱只保留金幣/材料用途。
- 世界王卡被動效果（±3%/張封頂9%）：使用者說「要有功效才有意義」，不能只是換皮/换數字，所以額外接了 `dmgBonusPct/dmgReducePct/healBonusPct` 進三套戰鬥系統的傷害/減傷/治療計算。

### 踩坑提醒（下次接手務必先看這段）
- **（已補上，見下方「追加修正」）** 原本地下城系統完全沒有串接怪物卡片——已修好，見「追加修正（同日）」。
- `equipped` 欄位資料格式從「字串陣列（monsterId）」改成「物件陣列（`{key,source}`）」是破壞性變更，採**漸進式相容讀取**（`resolveEquippedCards()`/`normalizeEquipped()` 兩處都判斷 `typeof item === "string"`），沒有寫遷移腳本。舊資料完全相容，新裝備一律寫新格式。
- 這次順手修掉一個潛在regression：`equipped` 格式改變後，`CouncilHall.jsx`/`PartyBattleRoom.jsx`/`MemberHome.jsx`/`MonsterBattle.jsx`/`WorldBossAttack.jsx` 五處原本各自手刻 `equipped.map(id=>cards[id])` 的邏輯全部需要改用新的 `resolveEquippedCards()`，否則卡片加成會靜默歸零。**其中 `CouncilHall.jsx` 原本的寫法本來就是錯的**（直接把 `equipped` 陣列的字串傳進 `calcEquippedBonus`，沒有先轉成卡片物件），順手一併修正。
- `AdminWorldBoss.jsx` 有個 pre-existing 的 React hooks 順序問題：`if (showBattle) return <WorldBossLobby/>` 這個提早 return 寫在一堆 `useState`/`useEffect` 宣告**之前**，理論上切換 `showBattle` 會觸發「Rendered fewer hooks than expected」。這次新增的手動發卡功能相關 hooks 也放在這個 return 之後（跟現有其他 hooks 位置一致），**沒有引入新問題但也沒有修**，因為這是完全獨立的既有問題，不在這次任務範圍內。

### 驗證
- `CI=true npm run build`：Compiled successfully，無編譯錯誤。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：貓貓王正確顯示9隻＋像素圖上色正確、擊殺六族王掉對應族寶箱、擊殺教練/貓貓王掉世界秘寶箱、擊殺後有機率直接拿到王卡、卡片頁三欄裝備格運作正常、世界王卡全息邊框+稱號設定、組隊/世界王/地下城三套戰鬥系統裝備世界王卡都確實影響傷害數字。

### 追加修正（同日）：補上地下城完全沒串接卡片系統的缺口
使用者確認要修，順著地下城的實際資料流（`buildExpeditionMemberData` → `dungeonRooms/{id}.members.{id}` → `processDungeonRound` 讀 `m.atk/m.wbBonus`）一路補齊：
- `expeditionMemberData.js::buildExpeditionMemberData(profile, cardBonus)`：新增 `cardBonus` 參數（`calcEquippedBonus(resolveEquippedCards(...))` 結果），把 HP/ATK/DEF 卡片加成併入基礎值，並把 `dmgBonusPct/dmgReducePct/healBonusPct` 包成 `wbBonus` 欄位一起回傳。
- `expeditionDb.js::createExpeditionBattleRoom`／`expeditionTeamDb.js::createTeamExpeditionRoom`/`joinTeamExpeditionRoom`：member 物件都加上 `wbBonus: memberData?.wbBonus || null`。`syncTeamExpeditionMembers`（跨樓層同步）本來就是 `{...member, ...}` 展開舊物件在前，不用改就會自動帶著 `wbBonus` 走。
- `TeamExpeditionBattle.jsx`：找到一處「從房間 `members` 重新組裝陣列丟給 `createTeamExpeditionBattleRoom`」的地方**漏掉了 `wbBonus` 欄位**（這是最容易漏、也最難發現的一環——組隊模式進戰鬥房間前會重新映射一次成員陣列，任何新增欄位都要記得在這個映射也加一次）。
- `DungeonLobby.jsx`（組隊）／`DungeonExpedition.jsx`（單人）：各自新增 `subscribeCardCollection` 訂閱＋算 `cardBonus`，呼叫 `buildExpeditionMemberData` 時帶入。單人模式額外把 `wbBonus` 存進 `playerState`（跨樓層持續的本地狀態），每次建立戰鬥房間時用 `playerState.wbBonus` 覆蓋（因為裝備中途不會變，不用每層重算）。
- `CI=true npm run build`：Compiled successfully。

**教訓**：地下城/遠征系統有 3 條平行的「建立戰鬥房間」路徑（單人 `createExpeditionBattleRoom`、組隊建立 `createTeamExpeditionRoom`+`createTeamExpeditionBattleRoom`、舊版未使用的 `dungeonDb.js::createDungeonRoom`），任何要塞進 `room.members.{id}` 的新欄位都要**沿著全部路徑**一路追過去確認每個「重新組裝 member 物件」的地方都有帶到，漏一個環節就會在特定情境下（比如剛好走組隊模式）悄悄失效。

---

## 2026-07-09（寶箱族擴充：14隻怪物 + 隱藏地下城改為專屬寶箱族農場）

Trellis 任務 `07-09-07-09-treasure-family-expansion`，PRD/design/implement 見 `.trellis/tasks/07-09-07-09-treasure-family-expansion/`。

### 改了什麼
- `src/lib/monsterData.js`：
  - 新增 6 隻「真」寶箱怪（`treasure_1_real`~`treasure_6_real`，ATK=1 幾乎不會反擊，DEF 比同階「假」的更高）；既有 `treasure_1~6` 維持不變，視為「假」（有正常 ATK，需要正常應戰）。
  - 新增寶箱王 2 隻（`treasure_king_small`/`treasure_king_big`，`isKing:true`）。
  - 新增 `drawTreasureMonsterPool(count, tier)`（純寶箱族抽池，真假隨機混，排除王）、`drawTreasureKing(difficultyTier)`（≤3出小王，≥4出大王）。
  - `drawMixedMonsterPool`（一般 6 族混池）加 5% 機率把其中一個抽選結果換成同階寶箱族怪物，當一般地城的驚喜彩蛋。
  - `drawFloorMonsters` 支援 `options.family==="treasure"`：三層樓全部走寶箱族抽池+寶箱王，不再混一般 6 族。
- `src/lib/dungeonExcavation.js::revealExcavation`：`isHidden` 擲出 true 時，`family` 直接指定 `"treasure"`（不再隨機 6 族），`boss` 改用 `drawTreasureKing`。`claimAutoDig`/`useDungeonScroll` 本來就不會產生隱藏地城，沒有改。
- `src/lib/expeditionDb.js::calculateExpeditionRewards`：加 `family` 參數，`family==="treasure"` 時金幣/箭露 ×3、經驗值 ×1.3（經驗值加幅刻意較小，避免打寶箱地城變成練等最佳解）。`settleAbandonedExpedition` 也一併補上 `family`。
- `DungeonExpedition.jsx`/`TeamExpeditionBattle.jsx`：呼叫 `calculateExpeditionRewards` 補 `family`；王房通關（`won && family==="treasure"`）額外加碼金幣（300+難度×100）、3 個傳說級材料（借用既有 6 族材料池的 legendary 稀有度池，沒有另外新建寶箱族專屬材料鏈）、一個對應難度的金幣寶箱、一份符文掉落（`rollRuneDrop`/`addRune`，符文物品本身可以拿到，但符文的「使用」介面目前仍是隱藏的，那是另一個獨立項目）。組隊模式的王獎勵掛在 `handleFinish()`（每人各自呼叫自己的份，避免上一個任務才修好的「幫別人寫入」權限問題重演）。
- `DungeonBattleRoom.jsx::handleClaimSelf`（非遠征模式路徑）：`monster.family==="treasure"` 時金幣 ×3，讓一般地城 5% 彩蛋也有對應的加成獎勵。

### 為什麼
- 使用者明確定調：「隱藏地下城本身的用意並不是擊倒而是獲得大量獎勵的地方」——這不是戰鬥挑戰內容，是獎勵農場，所以核心改動集中在「讓隱藏地城 100% 是寶箱族」+「寶箱族的獎勵明顯高於一般族系」，而不是設計新的戰鬥機制。
- 真假定義（使用者原話）：「真的沒有攻擊力好打倒，假的定義是他就真的是怪物，所以會反擊有傷害」——用既有的 `applyVariant`/ATK 數值機制就能表達，不需要新的戰鬥引擎特判邏輯（ATK 接近 0 的怪物在既有傷害公式下自然幾乎不會反擊）。
- **遠征模式完全略過逐怪物掉落**（`handleClaimSelf` 的 `expeditionMode` 分支整段跳過，見上一個「組隊遠征穩定性」任務的調查），而隱藏地城 100% 走遠征系統，所以「寶箱族獎勵更豐厚」必須讓 `calculateExpeditionRewards`（run 結算層）依 family 加成，改 `rollCoins`/`rollMaterialDrops`（怪物掉落層）對隱藏地城完全沒有作用——這兩層要分開處理，是本次最容易搞混的地方。

### 踩坑提醒
- **樓層 1、2 的一般怪物池本來完全不看「整趟遠征主題 family」**，永遠是 6 族隨機混池（只有王/Boss 才看 family）——這是隱藏地下城要做到「全部都是寶箱族」時最容易漏掉的地方，`drawFloorMonsters` 現在三層樓都要判斷 `options.family==="treasure"`。
- 寶箱王材料獎勵**沒有**建立寶箱族專屬的材料鏈（`monsterMaterials.js` 的材料是依 6 族 `family` 建的，寶箱族沒有對應的 `treasure_m2~m6`），改成從既有材料池篩 `rarity==="legendary"` 隨機發 3 個，避免發出不存在的材料 id 造成庫存出現垃圾欄位。若之後想要寶箱族專屬材料外觀，需要另外設計。
- `treasure_king_small`/`treasure_king_big` 用既有 `tier:"boss"`/`tier:"mythic"` 掛欄位，靠新增的 `isKing:true` 排除在一般寶箱怪抽池外——**如果之後要再新增寶箱族怪物，記得排除條件要一起檢查 `isKing`**，否則王可能意外被抽進一般樓層。
- 一般地城 5% 彩蛋**刻意不套用**寶箱族的豐厚倍率（只是視覺驚喜換皮，非遠征模式走 `rollCoins`×3 已經有一點加成），避免一般地城的期望報酬意外暴增。
- 符文「使用」介面解鎖跟「新系統藥水無法使用」都是**獨立項目**，本次沒有處理，王掉落的符文物品本身能正常拿到、進背包，只是還不能用。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：練箭挖掘刷出隱藏地城時三層樓都是寶箱族、王房正確依難度出小王/大王、結算畫面金幣數字明顯高於一般地城同難度、一般地城偶爾（不用刻意驗證機率）能遇到寶箱族怪物彩蛋。

### 追加修正（同日）
- `drawTreasureMonsterPool` 原本內部寫死套用 `applyVariant(monster,"normal")`，忽略了跟一般 6 族一樣的樓層強弱分層（第1層弱化/第2層普通+精英強化/第3層強化+王）。改成跟 `drawMixedMonsterPool` 一樣吃 `variant` 參數，`drawFloorMonsters` 呼叫處三層樓分別傳 `"weak"/"normal"/"strong"`，寶箱族現在也有跟其他族系一致的強弱分層。
- **DEF 全面調降**：原本的 DEF 是一般 6 族同階（以鬼怪族 14/24/40/68/105/155 為參考）的 2~5 倍，對照 `damage.js` 的傷害公式（`base = 8 + ATK×0.7 + 分數×1.2 − DEF×0.35`，下限 1 傷/箭）會導致一般程度射手幾乎每箭被壓到最低傷害，高階寶箱怪變成要射幾百箭。調降到跟一般族系同量級、只是略高一截：假 DEF 15/30/50/85/130/190，真 DEF 20/35/60/95/150/220。ATK/HP 數值不變。
- **寶箱王改成小王/大王各自都有 T1~T6 強度曲線**：原本 `drawTreasureKing` 是「T1-3 固定用一組小王數值、T4-6 固定用一組大王數值」，導致 T1 玩家碰到的小王強度跟 T3 玩家一樣，對 T1 太強。改成 `treasure_king_small_1~6`/`treasure_king_big_1~6` 共 12 隻，每隻對應一個難度階級，`drawTreasureKing(difficultyTier)` 先照難度選階級、再 50/50 隨機選小王或大王系列。`isKing:true` 標記維持不變，`drawTreasureMonsterPool` 排除邏輯不受影響。

---

## 2026-07-09（組隊/單人遠征穩定性：斷線回房+畫面卡死+進度不遺失）

Trellis 任務 `07-09-07-09-expedition-stability`，PRD/design/implement 見 `.trellis/tasks/07-09-07-09-expedition-stability/`。

### 改了什麼
- `src/components/dungeon/DungeonBattleRoom.jsx`：`expeditionMode===true` 時隱藏戰鬥畫面內的「離開」快速按鈕（原本無確認對話框，且被 `TeamExpeditionBattle.jsx`/`DungeonExpedition.jsx` 直接接到全隊解散/移出房間的邏輯，完全無視 `{preserve:true}` 訊號）。
- `src/lib/expeditionDb.js` 新增 `setActiveExpeditionProgress`/`clearActiveExpeditionProgress`/`settleAbandonedExpedition`：把單人遠征進度（`family`/`difficultyTier`/`isHidden`/`floorsCleared`）持久化到 `members/{id}.activeExpedition`，中斷結算沿用既有 `calculateExpeditionRewards(...,won:false)` 公式，**沒有改任何獎勵數值**。
- `src/components/dungeon/DungeonExpedition.jsx`：進入/樓層推進時同步 `activeExpedition`；正常結算 (`handleFinish`) 與確認放棄 (`handleAbandon`) 都會清除它。
- `src/components/dungeon/DungeonLobby.jsx`：新增單人遠征復原 banner（偵測 `profile.activeExpedition`，只有「結算並領取」一個按鈕，**不做**地圖位置復原，只做部分獎勵結算），跟既有的組隊 `reconnectRoom` banner 並列。
- `src/components/dungeon/TeamExpeditionBattle.jsx`：新增卡死保護——房主端 `activeRoomId` 卡住 20 秒自動清除協調欄位；非房主端等待 20 秒無變化顯示提示+「暫時返回大廳」按鈕（呼叫 `onComplete`，**不**呼叫 `leaveTeamExpeditionRoom`，不影響隊伍成員資格，之後仍可用既有復原機制連回來）。
- `firestore.rules`：`members` update 白名單新增 `"activeExpedition"`（**需手動貼到 Firebase Console**）。

### 為什麼
- **根因（已讀 code 逐一確認）**：組隊模式其實**本來就有**斷線復原機制（`DungeonLobby.jsx::findReconnectableTeamExpedition`），但被 `DungeonBattleRoom.jsx` 戰鬥畫面裡一個無確認的「離開」按鈕直接打穿——按下去呼叫 `onExit({preserve:true})`，但 `TeamExpeditionBattle.jsx`/`DungeonExpedition.jsx` 把 `onExit` 直接接到 `handleAbandon`，完全無視 `preserve` 訊號：房主誤點=全隊解散，隊員誤點=被移出 `room.members`（一旦被移出，連復原機制都救不回來，因為復原邏輯要求你還在 `members` 裡）。地圖層級的「撤退」按鈕（`GridMapStage`/`BranchStage`）本來就有正確的二次確認，這條路徑完全沒動。
- 獎勵公式 `calculateExpeditionRewards` 本來就支援「沒破關」的部分樓層結算（`floorMult=floorsCleared/3`），**不需要重新設計經濟數值**——真正缺的只是「玩家連不回去結算畫面時，怎麼讓這筆部分獎勵不要憑空消失」，所以整個修法都是持久化+復原，沒有動任何獎勵數字。
- `TeamExpeditionBattle.jsx` 的樓層/事件協調（`activeRoomId`/`roomConfirms`）全部是 `if (!isHost) return`，只有房主能推進，房主卡住時其他隊員點什麼都沒反應——這是「偶爾畫面無法點擊」的成因。單場戰鬥本身（`DungeonBattleRoom.jsx`）已經有 15 秒逾時保護，這次補的是「樓層之間」這一層。

### 踩坑提醒
- **單人遠征刻意不做地圖位置復原**：5×5 迷霧格地圖要精確還原「走到哪一格、開過哪些房間」風險高、範圍大，這次只保證「不會白打」（用既有部分結算公式），不保證能接著原本的探索進度打下去。若之後要做完整地圖復原，是全新的一塊工作。
- **房主永久失聯（host failover）沒有解**：如果組隊遠征房主整個消失不會再回來，地圖推進機制依然會卡住（所有推進都是房主專屬）。這次只做到「非房主可以安全離開畫面、之後能重連」，沒有做「房主轉移」，如果這個情境常發生，需要另開任務設計。
- `activeExpedition` 用 `updateDoc` 整包覆寫（不是 merge），每次樓層推進都是「取代」語意，不是累加。
- 20 秒逾時數字是沿用舊系統 `DungeonBattleRoom.jsx` 既有的慣例值，沒有特別跟使用者確認精確秒數。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做多裝置斷線實測（無瀏覽器環境）；建議上線後找兩個帳號實際跑一次組隊遠征，中途讓非房主裝置斷網確認能重連、讓房主裝置卡住確認 20 秒後其他人畫面恢復可操作。

---

## 2026-07-09（村目標歷史獎勵補發工具）

### 改了什麼
- `src/lib/villageGoalDb.js` 新增 `adminBackfillVillageGoalRewards()`：掃描所有 `status in [completed, expired]` 的村目標，幫尚未 `claimed` 的參與者補發獎勵（`completed` 用 `goal.rewards`，`expired` 用 `CONSOLATION_REWARD`），發完標記 `claimed:true` + `claimedByBackfill:true`。**僅限教練後台觸發**（靠 `isAdmin()` 才能寫入任意會員文件）。
- `src/components/admin/AdminVillageManager.jsx`：「🎯 村目標設定」面板內新增「🎁 補發歷史村目標獎勵」按鈕（不依賴 `activeGoal`，一直可見），點擊後跑一次補發並回報掃描了幾個目標、補發給幾人次。

### 為什麼
- 上一個任務（村目標改自行請領）修好了「以後」的發放，但舊資料的 `villageGoals` 文件從來沒有 `claimed` 欄位，代表過去很可能有玩家沒真的拿到獎勵，需要補發。

### 踩坑提醒
- **已跟使用者明確確認接受的風險**：Firestore 資料完全無法分辨「當初那次是不是剛好教練觸發、已經成功發過」，所以補發是「全部沒 `claimed` 標記的都補發」，可能讓極少數已經領過的人重複拿到一次獎勵。使用者判斷金額小（遊戲內金幣/箭露/扭蛋幣），寧可多發不要漏發，**不要**未來又改成「更精確判斷」而漏掉真正沒領到的人，除非使用者主動要求。
- 函式本身可安全重複執行（已標記 `claimed` 的會被跳過），教練可以隨時多按幾次確認沒漏網之魚。
- `where("status","in",[...])` 是單欄位 `in` 查詢，不需要額外的 Firestore 複合索引。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未實測（無瀏覽器環境）；建議教練登入後台親自按一次「掃描並補發」，確認回報的人次數字合理。

---

## 2026-07-09（村目標獎勵改自行請領，修正一般會員無法收到獎勵）

Trellis 任務 `07-09-07-09-village-goal-reward-claim`，PRD 見 `.trellis/tasks/07-09-07-09-village-goal-reward-claim/`。

### 改了什麼
- `src/lib/villageGoalDb.js`：
  - `completeGoal`/`expireGoal`：移除「觸發者瀏覽器幫全部參與者寫入獎勵」的 for-loop，只標記 `status`+`completedAt`/`expiredAt`，`completeGoal` 保留完成公告。
  - `adminForceCompleteGoal`：同樣移除發獎迴圈，只標記狀態（+`completedByAdmin`），不再跟一般完成流程走不同的發獎路徑。
  - 新增 `claimVillageGoalReward(goalId, memberId)`：參與者用自己的帳號讀目標、驗證資格（有貢獻、狀態已結束、`participants.{memberId}.claimed` 尚未為 true）、寫自己的 `members` 文件（`addCoins`/`addArrowdew`/`addGachaCoins`），再標記 `claimed:true`。
- `src/components/member/VillageGoalBanner.jsx`：訂閱改用 `subscribeLatestGoal`（原本 `subscribeActiveGoal` 只認 active，目標一完成就訂閱不到、banner 消失，永遠沒機會觸發請領）。`status==="active"` 時維持原本 banner 顯示；`completed`/`expired` 時若偵測到自己有未請領的貢獻，自動呼叫 `claimVillageGoalReward`，成功用 `useToast` 跳提示。
- `src/components/admin/AdminVillageManager.jsx`：「強制完成並發獎勵」按鈕文案改成「貢獻者下次登入時會自動領取獎勵」，反映新的非即時發放行為。

### 為什麼
- **根因（已對照 firestore.rules 驗證，非推測）**：`checkGoalStatus()` 由 `VillageGoalBanner.jsx` 每分鐘輪詢、任何會員瀏覽器都可能觸發，觸發後舊版 `completeGoal`/`expireGoal` 在該瀏覽器內迴圈幫「所有參與者」寫入獎勵。但 `firestore.rules:23-38` 的 `members` collection `allow update` 限制「只能改自己的文件（`resource.data.uid==request.auth.uid`）」，寫入別人的 `members` 文件會被拒絕，整段包在 `.catch(()=>{})` 靜默吞掉——只有恰好是教練切學生模式瀏覽（有 `isAdmin()`）時才會真的成功。跟公會懸賞系統已知的坑（見 2026-07-04 交接筆記）是同一種架構限制：專案無 Cloud Functions/cron，所有結算都是 client-triggered，凡是「一人幫多人寫入」的模式都會有這個問題。

### 踩坑提醒
- **這類「client-triggered 幫別人寫入」模式是本專案的系統性風險**，目前已知至少 3 處用過（公會懸賞自動刷新、村目標舊版發獎、地下城 team 領獎前也曾有類似疑慮）。之後若再看到「for...of participants { await addXxx(otherMemberId, ...) }」這種寫法，先假設它在非 admin 觸發時會靜默失敗，優先改成自行請領模式。
- `villageGoals` collection 的 `allow update: if isLoggedIn()` 本來就沒有欄位限制，`claimVillageGoalReward` 寫 `participants.{memberId}.claimed` 不需要改規則。
- 歷史已完成/過期的 `villageGoals` 文件（舊資料沒有 `claimed` 欄位）**沒有補發**，過去很可能有玩家沒真的拿到獎勵；是否要做後台補發工具，待使用者決定。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做多帳號實測（無瀏覽器環境）；建議上線後用兩個不同會員帳號（都非 admin）貢獻同一目標達標，確認兩人都各自拿到獎勵，且重整頁面不會重複入帳。

---

## 2026-07-09（世界王結算系統第一階段：修權限bug+結算畫面顯示獎勵+獎勵均等+紀念品）

Trellis 任務 `07-09-07-09-worldboss-settlement-phase1`。第二階段（R1-R6強度分級、專屬寶箱、六族對應寶箱、專屬卡片）使用者已確認另外排期，不在本次範圍。

### 改了什麼
- `src/lib/worldBossDb.js::distributeWorldBossRewards`：不再迴圈幫全部參戰者寫入獎勵，改成只計算 `top3Ids`（傷害排序前三，訪客排除）寫回事件文件，`rewardDistributed` 語意改為「已定案可請領」。
- 新增 `claimWorldBossKillReward(memberId, eventId)`：參戰者自己呼叫，共同獎勵**統一改用原本 `rank1`（最高檔）**發給每一位真實參戰者（不再依傷害排名分層），另外貢獻前三名/最後一擊拿**紀念品**（卡包/貓貓箱，跟共同獎勵分開發），世界王地下城维持人人都有。標記 `participants.{id}.claimed` 防重複。
- `src/components/worldboss/WorldBossLobby.jsx`：偵測到 Boss 死亡時，除了既有的 `KillScreen`（sessionStorage 防重複顯示）外，同時呼叫 `claimWorldBossKillReward` 領取（用 `claimed` 欄位防重複，不受 sessionStorage 限制）。`KillScreen` 新增「🎁 你的獎勵」區塊，顯示實際拿到的金幣/寶箱/卡包，以及紀念品標示。
- `src/components/admin/AdminWorldBoss.jsx`：「手動發放擊殺獎勵」按鈕文案改成「手動結算定案（供參戰者自行領取）」，反映新的非即時發放行為。

### 為什麼
- 使用者回報「世界王沒有戰鬥結算畫面，玩家沒看到就退出去了」。查證發現：`distributeWorldBossRewards` 由**打出最後一擊的玩家瀏覽器**觸發，內部迴圈幫全部參戰者寫入 `members` 文件，除非最後一擊剛好是教練，否則其他人的獎勵必定被規則擋掉（`.catch(()=>{})` 靜默吞掉）——跟今天稍早修過的村目標/市集是同一種架構問題。`WorldBossLobby.jsx` 其實**已經有** `KillScreen` 顯示給所有人看（排行榜+擊殺者），只是沒有「你自己拿到什麼」這塊——這正是使用者感受到「沒結算」的地方，本質是同一個 bug 的兩面，不是 UI 沒做，是獎勵發放本身在默默失敗。
- 獎勵均等+紀念品是使用者主動確認的重新設計方向：拿掉依傷害排名分層（原本第1名/2-3名/其餘），改成全員一致的豐富共同獎勵，貢獻前三名/尾刀改發專屬紀念品而非更多資源。

### 踩坑提醒
- `expireWorldBossEvent`（時間到未擊殺的安慰獎路徑）**有一模一樣的跨帳號寫入模式**，但目前**只有 `AdminWorldBoss.jsx` 後台會呼叫它**（教練觸發，`isAdmin()` 豁免），所以現況沒有壞掉，這次**沒有動它**。如果之後有人想把它改成 client-triggered 自動過期，要記得一起改成自行請領，不要重蹈覆轍。
- `AdminWorldBoss.jsx` 的「額外發放卡包給所有參戰者」（`handleGiveCardPacks`）同理，只在教練後台觸發，這次沒動。
- 舊資料（已經 `rewardDistributed:true` 但沒有 `top3Ids` 的歷史世界王事件）不會回溯處理，只影響新產生的事件。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 不需要新增/修改 firestore.rules（`worldBossEvents` 本來就 `allow read,write: if isLoggedIn()`，新函式只寫呼叫者自己的 `members` 文件）。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後找非教練帳號實測擊殺世界王，確認自己跟隊友都能在 `KillScreen` 看到「你的獎勵」且金幣/寶箱有真的入帳。

---

## 2026-07-09（組隊打怪 partyDb.js 前後衛公式同步地下城改版）

### 改了什麼
- `src/lib/partyDb.js::processPartyRound`：套用跟 `dungeonDb.js`（前後衛重構任務）一樣的公式：
  - 後衛不再直接對怪物造成傷害（原本 dmg 選項 ×0.5 傷害直接打怪）。
  - 後衛 `dmg`（助攻）改成命中分數% × 25% 當加攻池，均分給存活前衛，套用在前衛 `calcDmgFn` 的 ATK 參數上（多名後衛可疊加）。
  - 後衛 `heal` 治癒池從固定 `maxHP×25%` 改成 `maxHP×15%×命中分數%`，均分給存活隊友。
  - `playerLog` 新增 `heal`/`buffPct` 欄位。
- `src/components/party/PartyBattleRoom.jsx`：戰鬥紀錄面板的玩家傷害顯示補上治癒/助攻%的分支（原本永遠顯示 `+0`）。按鈕文案本來就沒寫死數字（「💊 治癒隊友」「⚡ 協助攻擊」），不用改。

### 為什麼
- 上一個任務只改了地下城系統，組隊打怪（`partyDb.js`）是完全獨立的一份實作，維持舊公式會造成兩套前後衛數值不一致。使用者確認要同步。

### 踩坑提醒
- `arrowsPerRound`/`frontIds`/`rearIds` 原本宣告在函式中段，這次改成提前到函式開頭（因為要在 Step 1 算傷害之前，先算出後衛的加攻池），順手移除了原本重複的宣告。
- 組隊打怪的戰鬥文字捲軸日誌（`PartyBattleRoom.jsx` 約1600行，`if((p.dmg||0)>0)` 那段）沒有一併補上治癒/助攻的文字行——後衛選 heal/助攻時 dmg 永遠是 0，會被那段邏輯跳過、不出現在捲軸文字日誌裡（但戰鬥紀錄面板本身已經正確顯示）。這是次要顯示位置，這次沒改，之後若要補齊可以參考這次戰鬥紀錄面板的寫法。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（修正市集交換卡片 Missing or insufficient permissions）

Trellis 任務 `07-09-07-09-card-market-permission-fix`。

### 改了什麼
- `src/lib/db.js::buyCardListing`：買家端的 `writeBatch` 移除對賣家 `members` 文件的寫入，只保留買家自己的扣款/拿卡。`cardMarket` listing 更新新增 `sellerClaimed:false`（+ `offeredCardId` 供交換類型使用）。
- 新增 `claimCardSaleProceeds(sellerId, listingId)`：賣家自己呼叫，驗證後把箭露/扭蛋幣/交換卡片加到自己的文件，標記 `sellerClaimed:true`。
- `src/components/member/CatVillage.jsx::CardMarketPanel`：既有的 `myListings` 訂閱裡新增自動偵測「賣出但未請領」的掛賣，自動呼叫 `claimCardSaleProceeds`，成功後跳一個簡短提示（此檔案沒有共用 toast，做了一個本地小 banner）。

### 為什麼
- 使用者回報射手帳號市集交換卡片出現 `Missing or insufficient permissions`。根因：`buyCardListing` 原本在買家瀏覽器裡直接寫入賣家的 `members` 文件給錢/卡片，違反 `firestore.rules`「只能改自己文件」的規則，整個 `writeBatch` 被拒絕——**這是必現 bug，不是偶發**，市集交易原本完全跑不通。跟村目標獎勵（見同日稍早的變更）是同一種架構問題，改用同一套「自行請領」模式解決。

### 踩坑提醒
- 通知賣家的文案已從「已收到」改成「開啟市集頁即可領取」，因為現在是非即時到帳。
- `cancelCardListing` 本來就有 `status!=="active"` 的檢查，賣出後的掛賣如果被誤點「下架」只會跳錯誤訊息，不會出資料問題，這次沒有特別隱藏該按鈕（UI 小瑕疵，非必要範圍）。
- 不需要改 `cardMarket`/`notifications` 的 firestore.rules，兩者本來就是 `allow read, write: if isLoggedIn()`。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後用兩個帳號實測一次完整交易（掛賣→購買→賣家開市集頁確認自動收到款項）。

---

## 2026-07-09（修正貓咪遠征隊 Missing or insufficient permissions）

### 改了什麼
- `firestore.rules`：`members` collection 的 update hasOnly 白名單加入 `"expeditions"`（**需手動貼到 Firebase Console**）。

### 為什麼
- 使用者回報射手帳號「遠征隊」操作出現 `Missing or insufficient permissions`。查證：`db.js::startExpedition`/`collectExpedition`（貓咪遠征隊，2026-06-27 改版新增）寫入 `expeditions.{slotIdx}` 欄位，但 `expeditions` 這個頂層欄位名稱從改版當時就沒被加進 `members` 的 hasOnly 白名單，導致任何會員開始遠征/領取遠征獎勵都會被規則拒絕——這不是偶發，是每次都會發生的必現 bug。
- 同一次回報還有「市集交換卡片」也是同一個錯誤訊息，但根因不同（見下一則變更）。

### 驗證
- 規則語法正確（純新增陣列元素），需使用者手動部署到 Firebase Console 後才會生效，此環境無法直接驗證實際行為。

---

## 2026-07-09（地下城前後衛重構：橫向滑動 UI + 後衛加攻/治療改用命中分數）

Trellis 任務 `07-09-07-09-front-rear-guard-rework`。

### 改了什麼
- `src/components/dungeon/DungeonBattleRoom.jsx`：
  - 主排卡片寬度從「除以人數擠壓」改成固定寬度，人數 >4 時容器加 `overflowX:"auto"` 橫向滑動。
  - 戰鬥紀錄面板（含小結算彈窗）新增顯示後衛的治癒量（💚）/助攻加攻%（🛡️），不再永遠顯示 `+0` 傷害。
  - 後衛行動選擇按鈕文案更新：「治癒 (看命中%)」「助攻 (前衛加攻擊)」，配色從紅色攻擊改成藍色支援。
  - 每回合逐箭訊息：後衛（治癒/助攻）不再顯示成「脫靶了」。
- `src/lib/dungeonDb.js::processDungeonRound`：
  - 後衛**不再直接對怪物造成傷害**（原本 dmg 選項是 ×0.5 傷害直接打怪物）。
  - 後衛 `dmg`（助攻）選項改成：本回合命中分數% × 25% 當作加攻池，均分給存活前衛（多名後衛可疊加），套用在前衛的 `effectiveAtk` 計算上。
  - 後衛 `heal` 選項：治癒池從固定 `maxHP × 25%` 改成 `maxHP × 15% × 命中分數%`，一樣均分給存活隊友（不含自己）。
  - `playerLog` 新增 `heal`/`buffPct` 欄位供 UI 顯示。

### 為什麼
- 使用者回報：前衛 4 人時畫面被擠滿；後衛「攻擊」選項想改成幫前衛加攻擊力（用命中分數% 換算，不看後衛自己的能力值）；後衛「治療」選項的治癒量從沒有在畫面上顯示過。
- 治療/加攻公式使用者已確認：都用命中分數%換算、都均攤給受益人數；加攻池刻意調低且封頂 25%（`分數% × 25%`，滿分才會到 25% 上限），避免後衛變成無腦最優解。

### 踩坑提醒
- **`src/lib/partyDb.js`（組隊打怪 PartyBattleRoom 的後端）有完全獨立的一份前後衛邏輯**（沒有共用 `dungeonDb.js` 的函式），目前還是舊公式（固定 25%maxHP 治癒、0.5倍傷害的 dmg 選項）。這次**只改了地下城系統**，組隊打怪的前後衛沒有跟著改，因為使用者這次的需求脈絡是地下城，尚未確認組隊打怪要不要一致同步。
- `atkBuffPctForFront` 是所有選擇助攻的後衛「各自貢獻的池子 ÷ 存活前衛數」加總，不是取最大值——多名後衛同時助攻會疊加超過單一後衛的 25% 上限（例如兩位後衛都滿分助攻，理論上前衛拿到的加成會超過 25%，這是刻意允許的疊加，不是每人都封頂在 25% 而是「單一後衛的貢獻」封頂在 25%）。
- `calcScorePct` 用 `arrow.score`（已經是正規化後的分數，包含 target_score 等特殊合約的 X=11 等情況），用 `Math.min(1,...)` 夾住避免超過 100%。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：4 人前衛橫向滑動流暢、後衛選治癒/助攻後戰鬥紀錄能看到對應數字、多名後衛同時助攻時前衛攻擊力有明顯疊加提升。

---

## 2026-07-09（地下城掉落倍率改為隨機 1~3，取代原本固定 ×2）

### 改了什麼
- `src/lib/expeditionRewards.js`：`EXPEDITION_DROP_MULTIPLIER`（固定值 2）拆成 `EXPEDITION_DROP_MULTIPLIER_MIN=1`/`_MAX=3`，新增 `rollExpeditionDropMultiplier()` 內部函式，`createExpeditionKillLoot()` 每次擊殺都重新擲骰（材料寶箱跟金幣寶箱用同一次擲骰結果，維持同步，不是各自獨立隨機）。`getExpeditionRewardPreview()` 回傳的欄位也從單一 `multiplier` 改成 `multiplierMin`/`multiplierMax` 範圍。
- `src/components/dungeon/DungeonSelectionPanel.jsx`：三處寫死的「×2」文字（含一處連數字都沒接變數、直接硬寫 `×2` 字面值）全部改成 `×{min}~{max}（隨機）`。

### 為什麼
- 使用者回報「地下城掉落的金幣、寶箱、箭露都是固定 2 倍」，希望改成每次隨機 1~3 倍，增加驚喜感。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（修正地下城藥水無法使用——用錯資料來源的死欄位）

### 改了什麼
- `src/components/dungeon/DungeonBattleRoom.jsx`：
  - 藥水庫存訂閱改成直接 `subscribePotions(myId, setPotionInv)`（比照 `PartyBattleRoom.jsx` 的正確寫法），取代原本讀 `room?.members?.[myId]?.items` 的方式。
  - `BattleBottomBar` 的 `potionInv` prop 改傳 `potionInv`（state），原本傳的是 `me.items || {}`。

### 為什麼
- 使用者回報「新系統藥水無法使用」，查證後發現這不是新系統特有的問題，而是 `DungeonBattleRoom.jsx`（新舊地下城系統共用同一個元件）本身的 bug：藥水庫存試圖從 `room.members.{id}.items` 讀取，但 `dungeonDb.js`/`expeditionDb.js`/`expeditionTeamDb.js` 建立房間/加入房間的邏輯**從來沒有任何地方寫入過這個欄位**，是個死欄位，永遠是 `undefined`。更嚴重的是即使訂閱邏輯本身修對了，UI 元件的 prop 仍然讀著 `me.items`（同一個死欄位），畫面上永遠不會顯示任何藥水可選。

### 踩坑提醒
- 玩家真正的藥水庫存存在獨立的 `potionInventory/{memberId}` collection（`items:{potionId:count}`），**不是**存在 `members`/房間文件裡，任何戰鬥模式要正確顯示藥水都要直接 `subscribePotions(myId, cb)`，不要嘗試從房間的 member 物件讀。
- 這個死欄位 bug 影響**所有**經過 `DungeonBattleRoom.jsx` 的戰鬥（舊地下城系統 + 新遠征系統），不只是使用者一開始以為的「新系統」。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後實測：帳號有藥水庫存時，進入任何地下城戰鬥（一般/遠征都測）能在藥水頁籤看到並成功使用。

---

## 2026-07-09（BattleShootingProfile 弓種下拉帶入自建裝備名稱）

### 改了什麼
- `src/components/shared/BattleShootingProfile.jsx`：改用 `useAuth()` 讀 `profile.equipment`（`normalizeEquipment`），弓種下拉選單的**顯示文字**若玩家在「我的弓具設定」建過對應分類的裝備，改顯示「{通用分類} - {自建裝備名稱}」，沒有則維持原本通用分類名稱。

### 為什麼
- 這個共用元件被 5 種戰鬥模式（打怪/組隊/決鬥/地下城/世界王）用來標記每場戰鬥用的弓種，但一直是寫死 4 個通用分類，完全沒接到玩家自己在 `MemberBowSettings.jsx` 建立的裝備清單。

### 踩坑提醒
- **底層存值（`bowType`）刻意沒有換成自訂裝備 id**，只換了下拉選單的顯示文字。原因：`bowType` 會被寫進 `MonsterBattle`/`DungeonBattleRoom`/`PartyBattleRoom`/`DuelRoom`/`WorldBossAttack` 的戰鬥紀錄，`MemberPractice.jsx` 的箭數分析、`bowsUsed`/`combos` 分組、目標比對全部依賴這 4 個固定值（`recurve_bare/recurve_full/compound/traditional`）做 key，換成自訂 id 會整套分析壞掉。以後如果要真的儲存「用了哪一組自訂裝備」，要另外加欄位，不要動 `bowType` 本身。

### 驗證
- `CI=true npm run build`：Compiled successfully。

---

## 2026-07-09（首殺/世界王擊殺公告寫入訊息列 + 分類頁籤）

Trellis 任務 `07-09-07-09-broadcast-to-notifications`，PRD 見 `.trellis/tasks/07-09-07-09-broadcast-to-notifications/`。

### 改了什麼
- `src/lib/dungeonDb.js::addDungeonBroadcast()`：新增 `memberName` 參數（順手修正原本從未傳入、單人首殺橫幅顯示「undefined 成為首殺英雄」的小 bug），成功寫入 `dungeonBroadcasts` 後額外呼叫 `createNotification({type:"dungeon", targetMemberId:null, ...})`，非同步 `.catch(()=>{})`，不影響原本回傳值。
- `src/components/dungeon/DungeonExpedition.jsx`、`TeamExpeditionBattle.jsx`、`DungeonBattleRoom.jsx`：三個呼叫端補上 `memberName` 參數。
- `src/lib/worldBossDb.js::attackWorldBoss()`：`defeated` 分支內額外呼叫 `createNotification({type:"worldboss", targetMemberId:null, ...})`。
- `src/components/member/MemberNotifications.jsx`：`FILTERS` 新增「地下城」「世界王」兩個頁籤，`matchFilter()` 補對應條件。`TYPE_META` 本來就有 `dungeon`/`worldboss` 定義，沒改。

### 為什麼
- 首殺/世界王擊殺公告原本只是一次性頂部橫幅，消失後完全沒有紀錄可查；`MemberNotifications.jsx` 的分類系統早就預留好這兩種 type 的圖示/顏色，只是從沒有寫入端真的用過。使用者要求橫幅維持原樣（仍顯示一次），額外把同一事件寫進訊息列供事後回顧。

### 踩坑提醒
- `addDungeonBroadcast` 現在依賴上一個任務（`07-09-07-09-broadcast-race-a11y-fix`）修好的 `trySetDungeonFirstClear` transaction 保證只有一個呼叫者會真的建立廣播；如果之後又出現「一次首殺多筆通知」，先查 `trySetDungeonFirstClear` 有沒有被改回非 atomic 寫法，而不是懷疑這次新加的 `createNotification`。
- `attackWorldBoss()` 本身**還沒有** transaction 保護（`getDoc`→本地算→`updateDoc`），本次只是在既有 `defeated` 分支上掛一個通知呼叫，沒有修這個潛在 race——跟使用者之後要討論的「世界王結算」項目重疊，留到那個任務一起處理。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- Firestore 規則：`notifications` collection 本來就 `allow create: if isLoggedIn()`，不需改規則。

---

## 2026-07-09（首殺公告重複 race condition 修正 + MemberApp 兩處 a11y）

Trellis 任務 `07-09-07-09-broadcast-race-a11y-fix`，PRD/design/implement 見 `.trellis/tasks/07-09-07-09-broadcast-race-a11y-fix/`。

### 改了什麼
- `src/lib/dungeonDb.js::trySetDungeonFirstClear`：改用 `runTransaction` 包住「讀取 `dungeonFirstClear/{dungeonId}` 是否存在 → 不存在才寫入」，移除原本查詢 `dungeonBroadcasts` 判斷已廣播的錯誤邏輯。
- `src/pages/MemberApp.jsx`：`dungeonKillAlert`（507行附近）、`wbKillAlert`（523行附近）兩個 `<div onClick>` 公告補上 `role="button" tabIndex={0} onKeyDown`（Enter/Space 可關閉）；這兩個 + `specialAlert` 三個全域公告容器補 `aria-live="polite"`。

### 為什麼
- **根因（已用 code 讀取確認，非推測）**：`trySetDungeonFirstClear` 原本是「先 `getDocs` 查 `dungeonBroadcasts` 有沒有該 `dungeonId` → 空的話才 `setDoc`」，兩步之間沒有鎖。`TeamExpeditionBattle.jsx::handleFinish()`（隊伍領獎）**每個隊員各自呼叫**，不是只有房主。多名隊員幾乎同時領獎時，大家都在別人寫入完成前查到「還沒有」，導致每個人都各自建立一筆 `dungeonBroadcasts` 文件（`addDoc` 產生不同 doc id）——同一次首殺產生多筆廣播，`MemberApp.jsx` 的 localStorage 去重機制只認「單一已讀 id」，對這些「各自不同」的新 id 完全無效，因此使用者看到公告一次次跳出來。
- `firestore.rules` 裡 `dungeonFirstClear` 的規則註解本來就寫「由 trySetDungeonFirstClear **原子**寫入」，代表這是設計時就打算做成 atomic、只是實作沒做到，這次修正是把實作補齊成符合原始設計意圖。
- a11y 兩點是 `web-design-guidelines` skill 審查 `MemberApp.jsx` 時發現的可行動項目。

### 踩坑提醒
- `trySetDungeonFirstClear` 呼叫端（`DungeonExpedition.jsx:1080`、`TeamExpeditionBattle.jsx:628`、`DungeonBattleRoom.jsx:481`）**完全沒改**，因為回傳形狀 `{ok,isFirst}` 沒變，這是刻意設計成呼叫端無感知的修法。
- 判斷「是否已首殺」的唯一鍵是 `dungeonFirstClear/{dungeonId}` 這個 deterministic doc id 本身是否存在，**不要**再查 `dungeonBroadcasts` collection（那是廣播記錄，不是首殺判斷的正確依據，兩者曾經對不上）。
- 舊系統路徑（`DungeonBattleRoom.jsx`，`mapDungeonId` 查表）跟新系統（`TeamExpeditionBattle.jsx`/`DungeonExpedition.jsx`，`family+tier` key）共用同一個 `trySetDungeonFirstClear`，這次修法對兩邊都生效，不用分開處理。
- 本次**沒有**動到：訊息列 (`MemberNotifications.jsx`) 分類路由、地下城其餘 6 項已知 bug（結算時機/畫面卡死/斷線回不去房間/T1-T6獎勵沒差異/寶箱族第七族未實裝+村目標獎勵未發放）、世界王結算+玩法重新設計——這些使用者已確認排在後面，個別另開 Trellis 任務。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後手動驗證：組隊多人同時點「領取」時只出現一次首殺公告、鍵盤 Tab 可以聚焦到公告並用 Enter/Space 關閉。

---

## 2026-07-04（冒險者公會「一般懸賞任務」自動化 — 交接項目①已完成）

Trellis 任務 `07-04-guild-general-bounty`，PRD/design/implement 見 `.trellis/tasks/07-04-guild-general-bounty/`。

### 改了什麼
- `src/lib/adventurerSystem.js`：`makeSeedRand` 加 `export`（供 db.js 複用同一套日期 seed 亂數，與 `getDailyGuildTasks` 同源）。
- `src/lib/db.js` 新增：
  - `DEFAULT_BOUNTY_REWARDS`（4 難度預設獎勵 fallback）
  - 範本 CRUD：`getGuildBountyTemplates`/`subscribeGuildBountyTemplates`/`createGuildBountyTemplate`/`updateGuildBountyTemplate`/`toggleGuildBountyTemplateActive`/`deleteGuildBountyTemplate`（collection `guildBountyTemplates`）
  - 獎勵表讀寫：`getGuildBountyRewards`/`subscribeGuildBountyRewards`/`setGuildBountyRewards`（collection `guildBountyRewards`，單一文件 `config`）
  - `autoPublishDailyGeneralBounties()`：每日刷新主邏輯（下架昨天舊任務 → 讀 active 範本池+獎勵表 → 日期 seed 每難度抽 1 個 → `publishGuildQuest` 發佈 → 寫 `guildMeta/dailyGeneralBounty` 防重複）
  - `publishGuildQuest` 擴充寫入 `bountyDifficulty`/`bountySource`/`bountyDateKey` 三個新欄位（原本只有 periodTag 等）
  - `submitGuildQuestCompletion` 擴充：`quest.bountyDifficulty` 存在時，額外讀取當前 `guildBountyRewards` 取得 `chestType`，呼叫既有 `addChests` 發放對應難度寶箱
- `src/components/member/AdventurerGuild.jsx`：掛載時新增呼叫 `autoPublishDailyGeneralBounties()`（與既有 `autoPublishBountyQuests` 並列，client-triggered 模式）；懸賞卡片與確認接取頁新增 `BOUNTY_DIFF_LABEL` 難度徽章（僅 `bountySource==="daily_general"` 顯示）。
- `src/components/admin/AdminGuildQuests.jsx`：新增 tab `"bounty"`，渲染新元件。
- **新增** `src/components/admin/AdminGuildBountyTemplates.jsx`：範本池 CRUD（4 難度分組）+ 難度獎勵表編輯（xp/coins/arrowDew/gachaCoins + chestType 下拉）+「立即重新產生今日任務」測試按鈕。
- `firestore.rules`：新增 `guildBountyTemplates`/`guildBountyRewards` 兩個 collection（read: isLoggedIn，write: isAdmin）— **需手動貼到 Firebase Console**。

### 為什麼
- 與現有兩套系統（每日靶紙任務三階、雙週怪物討伐懸賞六階）明確區分，教練需要能自訂「任務範本」與「難度獎勵」而不是寫死常數，同時不修改既有兩套系統任何一行。
- 沿用既有 `publishGuildQuest`/`submitGuildQuestCompletion` 發佈與結算路徑、既有 `autoPublishBountyQuests` 的 client-triggered + `guildMeta` 防重複模式，是專案既有慣例（無 Cloud Functions/cron）。

### 踩坑提醒 / 與 design.md 的關鍵出入
- **design.md 原文寫 `questSubtype: "general"`，實作改成 `questSubtype: "kill_monster"`**：交叉檢查 `AdventurerGuild.jsx` 實際渲染邏輯後發現，「接取任務→開始狩獵→擊殺進度比對→提交完成」整套按鈕流程完全以 `questSubtype==="kill_monster"` 判斷式為準（`sub===` 系列 if-else），若照 design.md 字面寫 `"general"`，前端會直接落到 `lock.ok` 最後一個 fallback 分支（手動填說明送出，不驗證擊殺數），等於玩家不用真的打怪就能領獎，違反 PRD 決策③「比照現有雙週懸賞的判定邏輯」。改用 `bountySource==="daily_general"` + `bountyDifficulty` 兩個新欄位區分「這是每日一般懸賞」，不依賴 `questSubtype`。**日後如果要修 kill_monster 判定邏輯，記得雙週懸賞和每日一般懸賞現在共用同一段前端判斷式。**
- `publishGuildQuest` 原本白名單只寫入固定欄位（不是全量 spread `...data`），新增 `bountyDifficulty`/`bountySource`/`bountyDateKey` 三個欄位必須顯式加進該函式的 `setDoc` 內，否則會被靜默丟棄。
- `guildMeta`/`guildQuests` 這兩個 collection 在 `firestore.rules` 目前**完全沒有對應規則**（`guildQuests` write 限 `isAdmin()`，`guildMeta` 甚至整個沒出現在規則檔）——這是雙週懸賞既有的已知行為：一般會員觸發 `autoPublish*` 會 permission-denied 靜默失敗（都包了 `.catch(()=>{})`），只有「教練切換射手模式」瀏覽公會頁時（仍是 admin 身份）才會真的寫入成功。本次沿用同一機制，未新增/修改這兩個 collection 的規則（design.md 也明確指示不需要）。
- `submitGuildQuestCompletion` 內對寶箱的 `getGuildBountyRewards()` 是即時讀最新設定（不是用發佈當下 snapshot 的獎勵值），代表教練事後調整難度獎勵的 `chestType`，會影響「已上架但尚未提交」任務的寶箱結算結果——這是刻意跟隨 design.md 的行為，如果需要「發佈當下鎖定」語意需另外討論。

### 驗證
- `CI=true npm run build`：Compiled successfully。
- 尚未做瀏覽器實測（無瀏覽器環境）；建議上線後手動驗證：同一天重複呼叫 `autoPublishDailyGeneralBounties()` 回傳 `already_exists`、範本池某難度為空時不影響其他難度正常上架、結算後 `chestInventory` 確實新增對應寶箱。

---

## 🔴 2026-07-04 交接筆記 — 三項未完成工作（前一位 Claude 因限流中斷，交給接手的 AI）

以下三項是同一次對話裡使用者提出、**已完整診斷根因/確認需求，但尚未建立完整任務或尚未動手實作**的項目。已完成並 commit 的工作（組隊地下城修復、鎖定計分模式切換、貓咪圖鑑101-200、archery.catgroup.com.tw重新部署）不在此列，見上方/下方其他 changelog 條目。

### 項目 1：冒險者公會「一般懸賞任務」自動化 — ✅ 已完成（2026-07-04，見上方新條目）

**現況**：Trellis 任務已建立於 `.trellis/tasks/07-04-guild-general-bounty/prd.md`，PRD 內的「已確認的需求決策」章節記錄了使用者透過 AskUserQuestion 確認的所有決策，**直接照 PRD 內容執行即可，不需要重新問使用者**：
- 4 個全新獨立難度等級（不沿用現有 6 階或 3 階系統）
- 教練後台新增的是「任務範本」，系統每天自動從範本池抽選發佈（不是教練手動逐一發佈單一任務）
- 任務達成條件先只做「擊殺指定怪物數」（`kill_monster` 型）
- 全員同一批（比照 `getDailyGuildTasks` 用日期當 seed）
- 每難度固定抽 1 個範本上架，共 4 個；範本池不夠時允許重複抽取
- 舊任務隔天直接下架失效（不给補做寬限期）
- 各難度實際獎勵數字（金幣/經驗/箭露/轉蛋幣/寶箱）**先用合理預設值上線**，之後教練再進後台調整

**現有系統參考**（PRD 裡已寫的探索結果，不用重查）：
- 保留不動：`src/lib/adventurerSystem.js::getDailyGuildTasks(date)`（克蘇魯/人質/殭屍靶每日任務）
- 可參考生成邏輯：`generateBiWeeklyBounties(periodKey, monsters)` + `BOUNTY_TIER_CONFIG`（雙週怪物討伐懸賞，6階，可作為「範本池抽選+依難度套用獎勵」寫法的參考範本，但這次要做的是全新獨立4階系統，不是複用這6階）
- 既有 CRUD 全部沿用：`publishGuildQuest`/`updateGuildQuest`/`deleteGuildQuest`/`updateGuildQuestStatus`（`src/lib/db.js`），`AdminGuildQuests.jsx` 已有 `questSubtype:"general"` 選項
- 自動刷新沿用既有 client-triggered 模式（`autoPublishBountyQuests` 用 `guildMeta/{key}` 文件防重複發佈，専案無 Cloud Functions/cron）

**下一步**：讀完 PRD 後直接寫 `design.md`（資料模型：新的範本池 collection 設計、每難度獎勵表 collection、每日抽選+發佈邏輯、教練後台新增範本管理 UI + 獎勵表調整 UI）+ `implement.md`，然後 `task.py start` 進入實作。

---

### 項目 2：箭數里程碑 bug（跨模式系統性錯誤，根因已 100% 確認，尚未建任務/尚未修）

**症狀**：不管哪個模式，每打完一次都會重複跳出「已完成6箭里程碑」的提示，即使今天早就已經領過。

**根因（已用 Grep 逐一確認，非推測）**：`src/lib/arrowMilestone.js::getMilestonesReached(oldTotal, newTotal)` 本身沒問題（純函式，正確計算門檻跨越），問題在呼叫端傳入的 `oldTotal`/`newTotal` 各模式算法不一致：

| 檔案 | 目前寫法 | 問題 |
|---|---|---|
| `src/components/member/AdventurerGuild.jsx`（約216行） | `getMilestonesReached(0, arrowCount)` | 寫死從0算，每場只要超過6箭就跳 |
| `src/components/member/CouncilBattle.jsx`（約388行） | `getMilestonesReached(0, totalArrows)` | 同上 |
| `src/components/duel/DuelRoom.jsx`（約450行） | `getMilestonesReached(0, myArrowCount)` | 同上 |
| `src/components/member/DailyQuest.jsx`（約139行） | `getMilestonesReached(0, todayArrows)` | 同上（下課結算時） |
| `src/components/member/MonsterBattle.jsx`（約905-910行） | 用 `sessionArrowsRef`（`useRef(0)`），但 `startBattle()`（約792行）會把它重設為0 | 同一天打第二場新戰鬥，ref歸零，一樣會重複跳 |

**唯二正確的參考範本**：
- `src/components/member/MemberPractice.jsx`（約2269-2272行）：`oldTodayArrows`/`newTodayArrows` 是真正累計「今天」的箭數，正確
- `src/components/worldboss/WorldBossAttack.jsx`（約705-708行）：用真實 `todayArrows` 變數，正確

**建議修法**：不要在每個檔案各自修正各自的計算方式（容易再次不一致），應該做一個**共用的單一入口函式**（例如在 `db.js` 或 `arrowMilestone.js` 新增 `checkAndGrantArrowMilestones(memberId, arrowCount)`），內部統一用同一種方式取得「今天真正累計箭數」（可能需要新增一個持久化的 `todayArrows` 欄位，比照 `dailyQuestCount` 的模式，在每次箭數送出時 increment，並在換日時重置——需要設計換日重置的判斷方式），取代掉上面 5 個檔案裡各自不一致的寫法。

**下一步**：建 Trellis 任務（例如 slug `arrow-milestone-fix`），寫 PRD（可直接引用上表）+ design（設計共用函式的資料結構與換日重置邏輯）+ implement，分派 trellis-implement 執行，範圍橫跨 5 個檔案 + 可能新增 1 個共用函式。

---

### 項目 3：首殺通知 bug（兩個獨立問題，根因已查清，尚未建任務/尚未修）

**症狀**：使用者回報「首殺通知都沒有消掉，會一直重複出現」，並指出「現在是新的地下城系統，首殺的部分應該要處理」。

**問題 A：橫幅已讀狀態沒有持久化（純前端 bug，容易修，跟新舊地下城系統無關）**
- `MemberApp.jsx` 用 `dismissedBroadcastRef`/`lastBroadcastIdRef`（約136-137行，都是 `useRef(null)`）追蹤「使用者是否已讀最新一筆首殺廣播」，純記憶體狀態，**沒有寫入 localStorage 或 Firestore**。
- 只要使用者重新整理頁面或 `MemberApp` 重新掛載，這兩個 ref 就歸零，`subscribeLatestBroadcast()`（`dungeonDb.js:1193`）立刻拿到同一筆「最新廣播」（因為在下一次首殺發生前它本來就一直是同一筆），比對失敗，橫幅重新彈出。
- **修法**：把已讀狀態換成持久化（例如 `localStorage` 存最後已讀的 broadcast id），取代純 `useRef`。這部分可以直接修，不需要額外設計決策。

**問題 B：新版地下城系統完全沒有接上首殺判斷（不是bug是功能缺口，需要的設計決策使用者已經確認）**
- 首殺判斷邏輯 `trySetDungeonFirstClear`（`dungeonDb.js`，約1094行起註解寫 `dungeonId 格式："ghost_normal", "temple_hell"`）完全綁定**舊版固定地下城目錄查表**（`DUNGEON_MAPS.find(d => d.id === room?.mapDungeonId)`）。
- 新版地下城系統（2026-07-14起的「三大來源」excavation系統）的地下城是隨機生成的 `family` + `difficultyTier`（T1~T6）組合，不是固定目錄裡的 `mapDungeonId`，所以 `DUNGEON_MAPS.find(...)` 永遠找不到、`dungeonInfo` 是 `undefined`，整段首殺判斷直接安靜跳過（`setFirstClearBonus(false)` 後 return），**新系統的地下城完全沒有首殺獎勵或廣播**——不是壞掉，是從一開始就沒接上。
- 觸發點確認在 `DungeonBattleRoom.jsx`（約470-486行，`isBossRoom && isMapMode && isHost` 時呼叫首殺檢查），`TeamExpeditionBattle.jsx`（約173-176行）呼叫 `<DungeonBattleRoom isMapMode={true} expeditionMode={true} .../>`，兩個旗標都是 true，所以確實有進到檢查區塊，只是查表查不到。
- **使用者已確認的設計決策**：新系統的「首殺」改用 **`family + tier` 當 key**（例如「第一次打過 ghost 族 T3」就算首殺，不管是哪次隨機生成的具體地下城）。
- **下一步**：需要重新設計 `dungeonId`/首殺紀錄的 key 格式（從 `"ghost_normal"` 這種固定目錄格式，改成能表示 `family+tier` 的格式，例如 `"ghost_t3"`），在 `TeamExpeditionBattle.jsx`／單人 `DungeonExpedition.jsx` 對應的 Boss 通關處接上新的判斷邏輯，不能直接沿用 `DUNGEON_MAPS` 查表。舊系統（`DungeonBattleRoom.jsx` 原本走 `mapDungeonId` 那條路徑，非 expedition 模式）應保持不動，只新增新系統的判斷路徑。

**下一步**：建 Trellis 任務（例如 slug `dungeon-first-clear-fix`），問題A可以直接修不用問使用者；問題B已有設計決策（family+tier當key），寫 PRD+design 後直接分派實作即可，不需要再問使用者。

---

## 2026-07-04（鎖定戰鬥中計分模式切換：Party/Dungeon/MonsterBattle + WorldBoss/Duel 補漏）

### 改了什麼
- `PartyBattleRoom.jsx`、`DungeonBattleRoom.jsx`、`MonsterBattle.jsx`（implement agent 已完成，見 commit 訊息誤植為「subscribeNotifications 加 limit(50)」的那次）：
  - 回合中永遠可點的 🎯 切換鈕改為只在 `!scoringModeChosen`（或 Dungeon hit_count 合約的 `arrows.length===0 && !targetMode`）時才顯示。
  - `TargetFaceOverlay` 的 `onClose={() => { setTargetMode(false); setBattleInputMode("button"); }}` 整個移除（三處呼叫都不再傳 `onClose`），避免關閉靶面覆蓋層時偷偷切回按鈕模式。
  - `handleTargetSubmit()` 開頭加 `if (targetPending) return;`，防止 2 秒 timeout 期間重複觸發疊加。
- **本次 check agent 額外發現並修復**：同一個 `TargetFaceOverlay` 共用元件在 `WorldBossAttack.jsx`（世界王）與 `DuelRoom.jsx`（決鬥）也有完全相同的漏洞，PRD 原始範圍只列了 Party/Dungeon/MonsterBattle 三個檔案，這兩個是漏網之魚：
  - `WorldBossAttack.jsx`：🎯 切換鈕加上 `arrows.length===0` 條件（該檔沒有 `scoringModeChosen` 機制，改用「本回合尚未輸入任何箭」為鎖定條件，比照 Dungeon hit_count 分支的既有寫法）；移除 `onClose` 副作用；`handleTargetSubmit` 補 `if (targetPending) return;`。
  - `DuelRoom.jsx`：🎯 切換鈕（原本完全無鎖定，任何時候都能點）同樣加上 `myArrows.length===0` 條件，並包進條件式 render；移除 `onClose` 副作用；`handleTargetSubmit` 補 `if (targetPending) return;`。

### 為什麼
- 根因：`TargetFaceOverlay` 是 5 個戰鬥模式（Party/Dungeon/MonsterBattle/WorldBoss/Duel）共用的元件，但「回合中鎖定計分模式」這件事是各檔案自己在呼叫端手動維護（`scoringModeChosen` 或 `arrows.length===0` 條件），不是元件本身強制的。這次修 3 個檔案時，另外 2 個共用同一元件、同一模式的檔案很容易被漏掉——這正是 PRD 提到「先前 RPG 打怪送出後被踢回首頁」bug 反覆出現的同一類根因。
- `DuelRoom.jsx` 的切換鈕原本是本次調查範圍外發現最嚴重的一個：完全沒有任何鎖定條件（連 `arrows.length===0` 都沒有），回合打到一半也能自由切換。

### 踩坑提醒
- 以後任何在 `TargetFaceOverlay` 呼叫端新增/修改鎖定邏輯時，務必 `grep "TargetFaceOverlay"` 找出**所有**呼叫端（目前共 5 處：Party/Dungeon/MonsterBattle/WorldBoss/Duel），逐一確認同一套鎖定條件都有套用，不要只改 PRD 列出的那幾個檔案。
- `WorldBossAttack.jsx`／`DuelRoom.jsx` 沒有 `scoringModeChosen` 這個 state，用的是「本回合箭數是否為 0」當鎖定條件（`arrows.length===0` / `myArrows.length===0`）；這與 Party/Dungeon/MonsterBattle 用的 `scoringModeChosen`（整場戰鬥只選一次，不會逐回合重置）語意不完全一樣，但都能滿足「回合中不能切換」的驗收標準，故未強行統一寫法，避免額外風險。
- `onClose` prop 在 `TargetFaceOverlay.jsx` 本身是 optional（`{onClose && (...)}`），5 個呼叫端全部移除該 prop 後，靶面覆蓋層内建的「⌨️ 換按鈕」關閉鈕就不會渲染——這是刻意的：目前沒有其他方式關閉靶面覆蓋層直到本回合送出/結束，如果之後要加「暫時關閉看其他資訊」的需求，必須新增一個不影響 `targetMode` 的獨立關閉按鈕，不能複用 `onClose` 這個名字（避免未來又被誤用去切模式）。

## 2026-07-04（組隊地下城修復：地圖崩潰＋人數上限＋前後衛選擇）

### 改了什麼
- `src/lib/expeditionGrid.js` 新增 `stripGridForSync(gridFloor)`：淺拷貝剔除 `grid`（2D 陣列，Firestore 不支援巢狀陣列）。`generateGridFloor()` 本身格式不動（單人模式仍依賴）。
- `src/components/dungeon/TeamExpeditionBattle.jsx` 新增本地 helper `stripMapStateGrid(state)`，所有 9 處把 `expeditionMapState` 寫入 `updateTeamExpeditionRoom()` 的地方一律先過這個 helper，徹底解決組隊地下城「建立→進入」時的 Firestore「Nested arrays are not supported」崩潰。
- `src/lib/expeditionTeamDb.js`：`joinTeamExpeditionRoom` 人數上限從 `>= 4` 改為 `>= 8`；新增 `setTeamExpeditionMemberRole(roomId, memberId, role)`（transaction，各角色上限 4 人，只決定進場初始 role）。
- `src/components/dungeon/DungeonTeamLobby.jsx`：人數顯示與空位佔位符改「/8」；隊員清單新增前衛/後衛選擇按鈕（僅本人可選）+ 即時「前衛 X/4 · 後衛 Y/4」提示；`handleStart()` 組出的 `memberList` 帶上 `role`。
- `src/lib/partyDb.js` 新增 `setPartyMemberRole(roomId, memberId, role)`（同上 transaction 邏輯，各上限 4）。
- `src/components/party/PartyBattleRoom.jsx` 等待室（`room.status==="waiting"`）隊員列表新增角色徽章 + 本人前衛/後衛選擇按鈕 + 計數提示。

### 為什麼
- Bug 根因：組隊遠征的 `gridFloor.grid` 從未被下游渲染用到（`GridMapStage` 只用 `rooms` 陣列自建查找表），純屬多餘且直接炸 Firestore 寫入。
- 組隊地下城人數上限寫死 4，UI 也寫死 4，與舊版「地下城經典模式」（`dungeonDb.js`，8 人）不一致。
- 前後衛過去完全沒有進場前選擇：`createTeamExpeditionBattleRoom()` 的 `role: m.role || "front"` 因為 `members` 從未帶 `role` 欄位，導致每個人都變前衛，後衛沒人。Party 模式同樣沒有初始選擇（`role` 只在 `submitArrows` 時透過本地 `myRole` state 決定，預設一律 front）。

### 踩坑提醒
- 只需在**寫入 Firestore 前**剔除 `grid`，不需要在讀取端做任何還原——因為沒有任何下游邏輯依賴它。一旦第一次寫入時就剔除乾淨，後續所有 `...mapState.gridFloor` 的 spread 都不會再帶出 `grid`。
- 前衛倒下自動轉後衛復活的既有機制（`partyDb.js::processPartyRound` 內，約行 508-518，`isCurrentlyFront` 判斷處）完全沒動；新增的角色選擇只影響**開戰當下**的初始 `role`，戰鬥中動態切換邏輯不受影響。
- Party 模式的 `role` 欄位在 `resetPartyRoom()`（下一場重置）不會被清除，所以玩家上一場結束時的角色（含自動轉後衛的結果）會帶到下一場等待室，可再自由重選。
- 組隊地下城的 `DungeonTeamLobby.jsx::handleStart()` 傳出的 `memberList` 目前只有 `DungeonLobby.jsx::handleTeamStart` 接收但實際上該參數未被使用（見 `_memberList` 命名）——真正決定戰鬥房 `role` 的資料來源是 Firestore `dungeonRooms` 房間文件裡的 `members[id].role`（透過 `setTeamExpeditionMemberRole` 寫入），並在 `TeamExpeditionBattle.jsx::startRoomBattle` 直接讀取 `teamRoom.members` 建立戰鬥房成員列表。

## 2026-07-04（學生分級與系統鎖定）

### 改了什麼
- `members` 新欄位：`studentTier`（restricted/official/retired，缺欄位→restricted）、`accountFrozen`（獨立凍結機制）、`lastCheckinDate`（報到快取，submitCheckin 即寫、approveCheckin 補寫）
- 新檔 `src/lib/accessControl.js`：純函式 `getAllowedPages/isPageAllowed/isAutoLocked` + `DEFAULT_TIER_PERMISSIONS`/`PAGE_REGISTRY`
- 新 collection `systemConfig/maintenance`（全站維護鎖）與 `systemConfig/tierPermissions`（可調權限矩陣，教練後台打勾即時生效）
- `MemberApp.jsx`：維護鎖/帳號凍結全螢幕擋下 + 單一 `pageLocked` 判斷擋下未授權頁面（`LockedFeatureCard`，不強制跳轉，導覽列不隱藏）；retired 首次登入自動導向「我的」
- `AdminMembers.jsx`：新增 `TierModal`（分級下拉 + 凍結勾選）、批次勾選一鍵設 `official`、維護鎖開關卡片
- 新頁 `AdminTierPermissions.jsx`：頁面 × 分級打勾矩陣，掛在 `hub-member` →「權限設定」
- `firestore.rules`：`members` 自寫白名單加入 `lastCheckinDate`；新增 `systemConfig/{docId}`（read: isLoggedIn，write: isAdmin）— **需手動貼到 Firebase Console**

### 為什麼
- 出席/使用規範（分級）要與技術檢定（CERT_LEVELS）、付費方案（monthlyCard）分開治理，讓教練能獨立管控誰能用系統哪些部分
- 上線初期大量既有會員需要教練手動從 restricted 升到 official，批次工具避免逐一點擊
- 權限矩陣不寫死常數，改教練後台可調，因應未來規則微調不需重新部署

### 踩坑提醒
- `lastCheckinDate` 缺欄位時 `isAutoLocked` 必須直接回傳 `false`，否則所有舊會員一上線就被誤判「14 天未報到」鎖死
- `systemConfig` 是全新 collection，與既有 `sysConfig`（版本號）不同名不共用，勿混淆
- `MemberApp.jsx` 只服務 `role==="member"`（`App.jsx` 已分流 admin 進 `AdminApp`），所以組件內完全不需要額外判斷 `role==="admin"` 豁免——教練本體永遠走 `AdminApp` 的射手模式，不受這裡任何鎖定影響
- 頁面級鎖定用「目前 `page` 是否在允許清單內」單一判斷取代逐一包裹每個 `{page==="xxx" && ...}`，效果等價（同一時間只有一個 page 生效）且大幅減少改動面

## 2026-07-04（我的裝備顯示與加成修正）

- 修正品級說明與裝備詳情漏算每品 +5 及強化值；所有單槽與總加成統一使用同一計算函式。
- 裝備頁改為槽位完成度、實際 ATK／DEF／HP 加成、公式說明及升級前後差值；品牌明確標示不影響數值。
- 補齊神話 +0～+4 的金幣與 T6 材料需求，並改善手機底部視窗、空品項與提示訊息。

## 2026-07-04（官網重製：website/ 靜態 SEO 網站）

### 改了什麼
- 新增 `website/` 資料夾（與 React App 完全獨立）：`index.html`（單頁，inline CSS/JS 零依賴）、`robots.txt`、`sitemap.xml`、`assets/`（11 張圖，自 imgbb 下載本地託管：logo + 001~009 + 015）。
- 設計：暖米紙底 `#faf6ef` + 炭墨 `#2b2926` + 品牌橘 `#e8720c`（取自 logo 本色），Noto Serif TC 大標編輯風，與 SimplyBook 舊站深藍金完全區隔。
- SEO/GEO：JSON-LD ×2（SportsActivityLocation 含價目 OfferCatalog + FAQPage 8 題）、OG tags、GEO 實體描述段（hero 下方）、語意標籤、單一 h1、全圖 alt、lazy loading。
- **SimplyBook widget 完整嵌入**：新增「09 線上預約」區塊（`#booking`），用官方 `simplybook.asia/v2/widget/widget.js` 的 `SimplybookWidget({widget_type:'iframe', container_id:'sb-widget'})` 把預約日曆內嵌頁內；捲動接近（rootMargin 800px）或點 CTA 才載入 script，不拖慢首屏；所有預約 CTA 改頁內錨點 `#booking`，widget 下保留「新視窗開啟」備援連結（外連 `.../v2/#book`）。

### 為什麼
- SimplyBook 預設版型無法自訂 SEO；靜態單頁最快最省，Vercel 可另建專案（root=website/）獨立部署。

### 踩坑提醒
- **正式網域未定**：全檔用 placeholder `https://catarchery.tw`，部署後需全域取代（index.html canonical/OG/JSON-LD + robots.txt + sitemap.xml + simplybook-home.html 官網連結）。
- **地址疑義**：舊站主文寫「8 弄 12 號」、SimplyBook footer 寫「14 號」，目前採 12 號，需向老闆確認。
- 本機預覽：`py -3 -m http.server 8899 --directory website`（file:// 會被瀏覽器工具擋）。

### 2026-07-04 續（SimplyBook 品牌整合，已驗證生效）
- **嵌入改直接 iframe**：`loadSB()` 從 `widget.js` script 改成直接建 `<iframe src=".../v2/#book">`，理由：iframe 版預約頁會吃 SimplyBook 後台的自訂 CSS，能與官網同色系；widget.js 版不吃。仍保留 IntersectionObserver 延遲載入 + CTA 點擊載入。
- **`website/simplybook-custom.css`**：貼到後台「預約首頁 CSS」＋「預約套件 CSS」兩欄（同一份）。已把 v2 版型選擇器（`.step_info_item`/`.service-item`/`.calendar`/`.slot`/`.btn` 等，實地檢查 DOM 得來）+ 舊版模板選擇器（`#events`/`#widget_container`）都填品牌色。使用者已貼上，實測：步驟列變橘、服務卡白底圓角、日曆/時段橘色選中——生效。
- **`website/simplybook-home.html`**：SimplyBook 後台首頁描述欄位用的品牌內容（暖紙橘風入口：logo＋標語＋雙 CTA＋三特色＋價格摘要＋聯絡）。⚠ 內含「認識貓小隊→官方網站」連結指向 placeholder `catarchery.tw`，部署後要換。
- **踩坑**：SimplyBook v2 首頁頂部深藍金 banner 是後台上傳的**背景圖片**，非 CSS，custom CSS 改不動；要換得進後台換圖或改用 simplybook-home.html 內容。
- **使用者決定不獨立部署**：整個新官網要留在 SimplyBook 裡（不買網域、不架站）。已誠實告知：這樣 SEO/GEO 會打折（綁 simplybook.asia 子網域，title/meta/JSON-LD/sitemap 都改不了）。`website/index.html` 那套完整 SEO 版仍保留在 repo，未來想獨立上線可直接部署。
- **`website/simplybook-home-full.html`**：把完整官網設計（hero＋為什麼＋四弓種＋價目表＋訓練＋團康＋場地師資＋評論＋FAQ＋聯絡）改寫成**一大塊可貼的自足 HTML**——全 inline 樣式、圖片用 i.ibb.co 線上網址、FAQ 用原生 `<details>`（免 JS）、無 `<script>`/`<style>`（不怕後台過濾）、響應式靠 flex-wrap。供整份貼到 SimplyBook 後台首頁內容欄位。
- **`website/_preview-sb-home.html`**：本機預覽外殼（帶 `<meta charset=UTF-8>`，fetch 注入 full 檔）。⚠ 純內容片段直接用瀏覽器開會因缺 charset 顯示中文亂碼，那是預覽假象；貼進 SimplyBook（UTF-8 頁）就正常。此外殼不需貼進 SimplyBook。

### 2026-07-04 再續（官網正式部署 Vercel，使用者改走「部署+轉址」路線）
- 使用者在 SimplyBook 發現「重新導向網址」設定 → 決定改走最佳路線：官網獨立部署，SimplyBook 轉址過去。
- **已部署**：`website/` 公開檔案（index.html/robots.txt/sitemap.xml/assets）→ Vercel 新專案 **catarrow-archery**，正式網址 **https://catarrow-archery.vercel.app**（已實測線上正常）。
  - Vercel 帳號 `broudes-1864`、team slug `broudes-1864s-projects`（與現有 React App 專案 catarrow 同 org，但**獨立專案**，root 目錄那個 `.vercel/project.json` 是 catarrow 不要動）。
  - 部署方式：把公開檔複製到 scratchpad `catarrow-archery/` 再 `vercel deploy --prod`（未接 git 自動部署；之後改內容要重跑，或未來再設 git root=website 自動化）。
- **canonical/OG/JSON-LD/sitemap/robots 已全部從占位 `catarchery.tw` 改成真實 `catarrow-archery.vercel.app`**（否則 Google 因 canonical 指死網域不收錄）。未來買自訂網域再全域替換一次。
- **待使用者操作**：SimplyBook 後台「重新導向網址」填 `https://catarrow-archery.vercel.app`。注意 iframe 迴圈風險（見上），設好要一起測預約嵌入。
- **✅ 已驗證上線（2026-07-04）**：舊站首頁自動轉址到新官網（實測 `catarcherycom.simplybook.asia` → `catarrow-archery.vercel.app`）；新站預約 iframe 正常載入無迴圈（`!inBooking` 放行 `#book`）。轉址採「重新導向網址」欄位法（純 URL，不用貼 script）；script 版曾因貼進「首頁內容」欄位被即時預覽執行、害編輯頁自我跳轉點不到套用，已加 hostname 防呆。
- **手機日曆右欄被裁修正**：SimplyBook 日曆每列 `.inner` 是 `flex + nowrap`，內含固定寬 7 個 `.name`/`.date`，窄螢幕溢出裁掉「日」欄。`simplybook-custom.css` 加 `@media(max-width:767px)` 讓 `.inner > .date/.name` 改 `flex:1 1 0; min-width:0`（1/7 均分）。同源注入實測：容器 320px 時 7 格自動 46px、`overflow:false`。⚠ 改完 CSS 使用者需重貼到 SimplyBook 後台兩個 CSS 欄位。

### 2026-07-04 定案網域 + Cookie 橫幅
- **最終網域規劃**：射箭官網 `archery.catgroup.com.tw`、學籍/學生系統 `student.catgroup.com.tw`（domain `catgroup.com.tw`，NS 在 `ns1/ns2.cyberdns.tw`）。
- 官網全站 URL（canonical/OG/JSON-LD/sitemap/robots + `simplybook-redirect.html` 轉址目標 + `simplybook-home.html` 官網連結）從 `catarrow-archery.vercel.app` 改成 `archery.catgroup.com.tw`，已重新部署。
- Vercel：`archery.catgroup.com.tw` 已指派到 `catarrow-archery` 專案（`vercel domains inspect` 確認）；**待使用者在 cyberdns.tw 加 DNS**：CNAME `archery` → `cname.vercel-dns.com`。DNS 生效後再把 SimplyBook「重新導向網址」從 vercel.app 換成 archery.catgroup.com.tw。
- **Cookie 橫幅**：SimplyBook 的 `<div id="sb_cookies_block" class="cookies sb-important">`（fixed, z1000）在手機嵌入時一直跳出——iOS 封鎖 iframe 第三方 cookie，「已接受」存不住。`simplybook-custom.css` 加 `#sb_cookies_block{display:none}` 隱藏。⚠ 需重貼 CSS。

## 2026-07-04（九隻陪練貓個體化）

- 保留 `allround` 資料鍵相容舊帳號，顯示名稱改為「治癒型」；九隻貓維持上排治癒、中排攻擊、下排防禦。
- 新增每隻貓獨立的 HP／ATK／DEF 最終配點、技能威力與觸發率特性，高等級與高裝備時仍有明顯差異。
- 戰鬥 hook、遠征與貓咪詳情統一使用 `calcCatCombatStats()`，頁面新增三排定位與個體流派介紹。

## 2026-07-04（地下城 Boss、四階出怪與獎勵結算修正）

- 組隊遠征不再使用舊版三場直戰：改與單人共用前兩層 5×5 迷霧地圖、功能房、第三層分支、Boss 與寶藏房；房主控制路線並同步全隊，前衛／後衛、HP 與 buff 跨戰鬥保留。
- 組隊等待室移除 `h-full + overflow-hidden` 導致的手機捲動死鎖，改由主內容區統一捲動；開始／解散操作列固定於底部並加入安全區。
- 戰鬥進場外框與狀態徽章統一讀取怪物 `variant`；補回擊殺演出、裝備貓咪進場與攻擊回合，並修正寶藏房怪物卡片名稱 `undefined` 及翻牌無音效。
- 組隊地下城新增斷線恢復：進入地下城首頁時查找仍包含自己的未完成協調房，可手動返回等待室、進行中的戰鬥或尚未領取的結算。
- 3／6 箭與靶紙格式改由房主在進場前設定；單人、組隊協調房及每層戰鬥房共用同一設定，開始後鎖定，移除探索遭遇與戰鬥中的切換入口。
- 地下城三個功能分頁移除 `100dvh` 子畫面與巢狀垂直捲動，統一由 `MemberApp` 主內容區滾動；分頁列改為 sticky，手機滑動不再搶手勢。
- 地下城建立時固定守關 Boss，進場畫面放大並顯示 Boss、保證寶箱與 `×2` 掉落倍率。
- 修正高難度地下城仍可能抽到 T1 Boss：所有怪物改用地下城指定 Tier，一樓 weak、二樓 normal/strong、三樓 strong、王房 boss。
- 每隻遠征怪改掉對應族系／Tier 材料寶箱 ×2 與金幣寶箱 ×2。
- 寶藏房保留金幣噴泉，後續改為玩家逐張翻牌；最終報告加入總獎勵、隊員傷害與 MVP。
- 組隊領獎改為 Firestore transaction，並修正結算同步失敗、儲存槽靜默失敗及房主退出留下戰鬥房等問題。

## 2026-07-03（Phase G：單人遠征 5×5 迷霧格子重構 — Step G1~G3）

### 改了什麼

- **新檔 `src/lib/expeditionGrid.js`**（單人／團隊共用純函式）
  - `generateGridFloor(floorIndex, difficultyTier)`：5×5 格子抽 11~13 間連通房（邊界擴張生成，保證連通）；起點隨機、樓梯 BFS 放最遠；房型 = 保底戰鬥（依 `EXCAVATION_FLOOR_CONFIG.monsterCount`）+ 第 2 層 1 精英 + 1 休息 + 權重抽（events/traps/merchants/chests）。回傳 `{ size, grid, rooms, startPos, stairsPos }`，房物件 `{ id, type, label, pos:{x,y}, cleared }`。
  - `generateBranchFloor()`：第 3 層入口 → A/B/C 各「3 隨機功能房（保底 1 戰鬥）+ 休息」→ boss → treasure。
- **`DungeonExpedition.jsx` 全面重構**
  - 第 1、2 層 `GridMapStage`：SVG 迷霧地圖（只顯示已探索＋相鄰格）、點相鄰格移動、cleared 房自由通行不再觸發、樓梯站上後底部面板確認下樓。
  - 第 3 層 `BranchStage`：A/B/C 選定即鎖 → 依序進房 → 王 → 寶箱（`DungeonTreasureRoom`）。
  - 刪除佔位 `ExpeditionRoomStage`；商人/陷阱/事件/寶箱/休息房改復用多人元件的「本地單人模式」。
  - `playerState`（hp/maxHP/atk/def/buffs）全程跨房間跨樓層帶著走；戰鬥房出場從房間快照同步回來（`??` 防 0 復活）。
  - 事件效果本地映射：hp_restore_all/atk/def/dmg mult/gold_bonus 立即生效；monster_hp_mult 存下一層、monster_atk_mult 存本層（進戰鬥時乘到怪物身上）；skip_counter 僅存欄位（單人戰鬥房尚未支援，已註記）。
- **五個多人房間元件加 `localMode` 轉接**（DungeonShop/Trap/Event/Chest/Rest）
  - `localMode=true` 時 confirm/choice 走元件內部 state，效果經 `onLocalEffect`、結束經 `onLocalDone` 回父層，完全不寫 Firestore 房間文件；**多人路徑一行未動**（僅新增 gated 分支與 gated 音效）。
  - 陷阱房保留賭大小閃避；商店由父層 `onLocalBuy` 扣真金幣＋套效果；寶箱金幣經父層發放、收藏品照常寫 member 文件。
- **`DungeonTreasureRoom.jsx`** 加選填 `onLoot(loot)`：生成獎勵時回傳一次，單人遠征據此實發金幣＋收藏品（不影響原無 prop 行為）。
- **`expeditionDb.js`**
  - 修 bug：`grantExpeditionRewards` 用了 `increment` 但沒 import → 之前獎勵靜默發放失敗，已補 import。
  - `createExpeditionBattleRoom` buffs 改帶入 `memberData.buffs`（`??` 預設），讓商店符/事件 buff 進戰鬥生效。

### 為什麼

- 前一輪 AI 重構把遠征功能房弄丟成「只有繼續按鈕」的佔位畫面；本次照 Phase G 定案恢復並升級成迷霧格子玩法。

### 踩坑提醒

- 金幣顯示直接讀 `profile.coins`（useAuth 有 onSnapshot 即時同步），**不要**另外累計 delta，會雙算。
- `finishPendingRoom` 不可在 setState updater 內呼叫其他 setState（updater 必須純函式）。
- Step G4（團隊遠征接格子）尚未做；`TeamExpeditionBattle.jsx` / `expeditionTeamDb.js` 本次完全未動。

### 驗證

- `npm run build` 通過（Compiled successfully，無 ESLint 警告）。
- expeditionGrid 生成器 500+200 次隨機驗證：連通性、房數 11~13、entrance/stairs 唯一、第 2 層必有精英、每層必有休息與戰鬥、分支必含戰鬥＋休息，全數通過。

---

## 2026-07-03（Freebuff 交接後：組隊遠征一致性收尾）

### 修正內容

- `expeditionTeamDb.js`
  - 等待室加入改用 Firestore transaction，避免兩人同時加入突破 4 人上限。
  - 離房改用 `deleteField()`，不再留下 `null` 成員佔用名額。
  - 開始遠征時原子切換為 `expedition_active`，開始後不再出現在開放列表，也不能中途加入。
  - 建戰鬥房改為顯式傳入 `hostId`，不再依 Firestore map 順序猜房主。
  - 新增樓層成員狀態同步與全員結算領取追蹤。
- `DungeonLobby.jsx` / `DungeonTeamLobby.jsx`
  - 加入碼回傳真正房主資訊；離開等待室會實際移除成員。
  - 隊員初始戰鬥數值改由 `calcArcherStats + archerLevelBonus` 計算，不再全員落到 500/10/10 預設值。
- `TeamExpeditionBattle.jsx`
  - 只有房主能推進及清理戰鬥房，避免隊員先刪房造成房主卡住。
  - 非房主可正確收到 `expeditionPhase=result`，三層之間保留 HP／死亡狀態。
  - 結算獎勵由房主抽一次並同步全隊，畫面與實際發放不再重新抽值。
  - 最後一名領獎者才清理組隊協調房，避免房主先領造成隊員失去結算。
  - 增加建房／同步失敗畫面與重試，防止靜默卡在載入中。
- `DungeonExpedition.jsx`
  - 單人結算獎勵同樣固定一次，畫面與實際發放一致。
- `firestore.rules`
  - `members.update` 白名單加入 `expeditionRecords`，修正遠征紀錄被規則靜默阻擋。

### 儲存槽重要語意

- 保存地下城時已清除上一輪 pending/progress；開始遠征只消耗選定槽位。
- 儲存槽遠征成功、失敗或離開，都不得再呼叫 complete/abandon 清掉玩家正在累積的新一輪挖掘。
- 組隊遠征只消耗房主槽位；隊員的挖掘與槽位不受影響。

### 驗證

- `npm test -- --watchAll=false --passWithNoTests`：通過（專案目前無測試檔）。
- `npm run build`：production build 通過；只有既有 bundle size 與 Node `fs.F_OK` deprecation 警告。
- 尚需兩個真實帳號實測 Firestore 多客戶端流程。

### 測試工具踩坑（2026-07-03）

- 不要在使用者正在跑 `npm start` 的專案 `node_modules` 內臨時安裝 Playwright。一次 `npm install --no-save playwright-core` 逾時，留下半安裝的 `firebase/node_modules/@firebase/auth`，造成 development server 誤報所有 `firebase/auth` exports 不存在。
- 已用原 lockfile 執行 `npm install` 修復；`package.json` / `package-lock.json` 均無變動，production build 與 development bundle 都恢復。
- 後續瀏覽器自動化應放在獨立暫存目錄，避免 npm 重排正式專案依賴。

---

## 2026-07-14（三大地下城來源系統 + 組隊遠征接 DungeonBattleRoom）

### 改了什麼

**功能 A：地下城三大來源系統**

`dungeonExcavation.js` 完整重寫，三個獨立來源並存：

**① ⏳ 定時生成（新系統）**
- `initAutoDigTimer(memberId)` — 初始化隨機 24~144 小時倒數計時器，寫入 `autoDigNextAt`
- `checkAutoDigStatus(ex)` — 純函式，回傳 `{ ready, remainingMs }`
- `claimAutoDig(memberId)` — 時間到後領取，隨機 6 族 + T1~T6 均等，產出 `pendingReveal`
- `resetAutoDigTimer(memberId)` — 領取/保存/放棄後自動重設計時器（下一輪）
- `abandonExcavation` / `saveExcavation` 自動連動計時器重置

**② ⛏️ 練箭挖掘（公式修正）**
- `addExcavationByCheckin` → +20 進度（原 +10）
- `addExcavationByArrows` → 每箭 +1 進度（原 +0.3）
- `getTierProbabilities(dailyArrows)` — 回傳 T1~T6 機率陣列：
  ```
  maxTier = min(6, 1 + floor(dailyArrows / 30))
  每 30 箭提升一級最高可開等級，各級均等機率
  ex: dailyArrows=0 → T1=100%；dailyArrows=30 → T1=50%, T2=50%
      dailyArrows=60 → T1=33%, T2=33%, T3=33%
      dailyArrows=150 → T1~T6 各 ~16.7%
  ```
- `downgradeExcavationDifficulty` — 免費降級（T6→T1，無限制）
- `revealExcavation` — 改用機率表抽難度（取代舊 fixed 稀有度骰）
- 金幣強化保留（反向升級：向上升一級）

**③ 📜 世界王卷軸（新系統）**
- `grantDungeonScroll(memberId)` / `grantWorldBossDungeon`（別名）— 擊殺後給 1 卷軸
- `useDungeonScroll(memberId)` — 檢查 `scrollCount > 0` + `savedDungeons.length < 3` → 隨機生成 T1~T6 直接存入
- `getDungeonScrollCount(memberId)` — 讀取卷軸持有數
- worldBossDb.js `distributeWorldBossRewards` 改為呼叫 `grantDungeonScroll`（非直接寫入 savedDungeons）

**DungeonExcavationTab.jsx 三卡 UI**：
- 卡 1：⏳ 定時生成 — 倒數計時器 + 就緒時「領取」按鈕
- 卡 2：⛏️ 練箭挖掘 — 進度條 + T1~T6 即時機率表 + 揭曉 overlay（含免費降級/金幣強化）
- 卡 3：📜 世界王卷軸 — 持有數顯示 + 「使用」按鈕（偵測儲存槽空位）

**功能 B：組隊遠征路由修正（接現有 DungeonBattleRoom）**

之前組隊遠征出發後錯誤地進了 `DungeonExpedition`（單人遠征），現在改接現有的多人戰鬥系統：

- `expeditionTeamDb.js`：新增 `createTeamExpeditionBattleRoom(members, monster, ...)` — 建立含所有隊員 HP/ATK/DEF 的戰鬥房間
- `DungeonBattleRoom.jsx`：新增 `expeditionMode` prop — 遠征模式跳過個人獎勵，僅 host 可呼叫 `returnToMapAfterBattle`
- **NEW** `TeamExpeditionBattle.jsx`：三層團隊戰鬥管理器 — 房主生成怪物 → 創建戰鬥房間 → 全員進 `DungeonBattleRoom` → 樓層推進 → 結算畫面
- `DungeonTeamLobby.jsx`：開始按鈕傳遞全員資料給 `onStart`
- `DungeonLobby.jsx`：組隊遠征改走 `TeamExpeditionBattle`；非房主自動訂閱組隊房間偵測戰鬥開始

### 為什麼
- 原本練箭挖掘的公式太慢（+0.3/箭）且機率不透明，玩家不知道要練多少箭才能開高等
- 世界王掉落應該要讓玩家可以選擇「何時使用」，而非直接塞入槽位（可能滿槽）
- 組隊遠征之前偷懶接了單人遠征( Expedition)，應使用現成的多人戰鬥系統

### 踩坑提醒
- `grantWorldBossDungeon` 和 `adminSetSavedDungeon` 共享 ~80% 邏輯（讀取→檢查→寫入），若有更多「幫玩家加地下城」函式出現，建議萃取共用 helper
- `getTierProbabilities` 是純函式，不直接讀 Firestore——`dailyArrows` 由上層傳入
- 組隊遠征的 `createTeamExpeditionBattleRoom` 怪物參數必須含所有戰鬥數值（HP/ATK/DEF/rewardMult），否則 `DungeonBattleRoom` 會算錯
- 非房主訂閱組隊房間的 `currentBattleRoomId`，變更時自動切換 `DungeonBattleRoom`；不需要手動清理舊房間

---

## 2026-07-03（音效/動畫批次 C：慶祝與獎勵層 — Confetti + 分階段音效）

### 改了什麼

**新元件 `src/components/shared/Confetti.jsx`**
- 全螢幕彩帶粒子（canvas、零依賴）：props `pieces/duration/colors/onDone`
- 尊重動畫開關：`<html class="no-anim">` 時直接跳過（立即 onDone）
- 播完自動停 rAF、unmount 自動清理；`pointer-events:none` 不擋點擊

**慶祝時刻接線**
- `ArrowMilestonePopup.jsx`：Big（百箭）→ `sfxVictoryFanfare` + Confetti；Small → `sfxLevelUp`（遵守「不干擾戰鬥」原則，小里程碑不用全螢幕）
- `CardCollection.jsx`：升星成功 `sfxLevelUp` / 失敗 `sfxError` / 神話選屬性 `sfxBuff`（原本全程無聲）
- `MemberMaterials.jsx`：碎片合成銀章 → Confetti；epic/legendary 藥水合成 → Confetti；開箱結果含卡片/貓/全開 → Confetti；金幣寶箱開箱 → `sfxSuccess` 後 350ms 追加 `sfxCoinDrop`
- `GachaMachine.jsx`：抽到新卡 showing 階段 → Confetti（`key` 換 idx，十連抽每張新卡各播一次）

### 為什麼
- HonorCelebration 已有自製 canvas 煙火，**不**重複疊加
- 震動回饋已內建在各 sfx 函式（批次 A 的 vibrate 閘門管制），無需另做

### 踩坑提醒
- Confetti 想「重播」要換 `key`（同 fx-bounce 的教訓）；同 key 重 render 不會重播
- Confetti 不傳 `onDone` 也安全：rAF 播完自停，canvas 留著透明直到 overlay unmount
- 待做批次 D：戰鬥層（受擊震屏、爆擊 hit-stop、怪物死亡溶解）

---

## 2026-07-03（音效/動畫批次 A+B：全域開關基礎設施 + UI 回饋層 + 亂播音效/畫面亂跑修復）

### 改了什麼

**批次 A — 基礎設施**
- `src/lib/fxSettings.js`（新檔）：音效/動畫全域開關，localStorage `fx_sound`/`fx_anim`（預設開）；動畫關閉或系統 `prefers-reduced-motion` → `<html class="no-anim">`；`initFxSettings()` 在 `index.js` render 前呼叫
- `sound.js`：`ctx()` 單點總閘門（音效關閉回 null，所有合成音效靜音）；`playAudio`（mp3）/`vibrate` 各自補 guard（震動跟隨音效開關）；新增 UI 音效家族 `sfxSwitch`/`sfxOpen`/`sfxClose`/`sfxError`
- `index.css`：`.no-anim` 全域抑制（animation/transition/scroll-behavior + View Transitions pseudo）；`fx-` 前綴通用動畫庫（pop-in/fade-up/shake/pulse-glow/float-up/bounce-once）+ utility classes（`.fx-pop`/`.fx-shake`…）
- `MemberProfile.jsx`：新增 `FxSettings` 卡（🔊 音效與震動 / ✨ 介面動畫 兩個 toggle，44px 觸控目標），放帳號設定上方

**批次 B — UI 回饋層**
- `shared/UI.jsx` Btn：全站按鈕點擊音（`sfxTap`），新增 `silent` prop 逃生門（自帶音效的按鈕可關）
- `MemberApp.jsx` 底部 nav：切換 tab 播 `sfxSwitch` + icon `fx-bounce` 彈跳（用 `key={active}` 重掛重播動畫）
- `shared/Widgets.jsx`：新增 `CountUp` 數字滾動元件（easeOutCubic，`.no-anim` 時直接跳值）；header 三個貨幣 chips 改用 CountUp；`StatBar` 滿值時 `fx-pulse` 發光

**Bug 修復（使用者回報「亂播音效、畫面亂跑」）**
- `AdminApp.jsx`：`pendingMonthlyRef` 初始 `0` → `null`——首次 Firestore 快照若已有 pending 月卡申請，開頁就播 `sfxNotify`（亂播音效根源之一）；改為首次快照只記錄不播
- `MonsterBattle` / `DungeonBattleRoom` / `PartyBattleRoom` 三處戰鬥 log 捲底：`scrollIntoView({behavior:"smooth"})` 補 `block:"nearest"`——預設 `block:"start"` 會把**所有可捲動祖先**（含整頁）捲到元素置頂，戰鬥中 log 每更新一次整頁被拉走（畫面亂跑根源）

### 為什麼
- 使用者要求全面加音效/動畫前，必須先有全域開關（否則吵到使用者無法關）與 reduced-motion 尊重
- 教練後台 12 秒提醒輪播（`pendingCheckinAwaitN`）是刻意設計（工作電腦提醒用），保留但現在受音效總開關管制

### 踩坑提醒
- **腳本生成的檔案要跑 parse check**：`monsterConfig.js` 混入 4 行 shell 指令 `echo "Phase N done"`（phase 腳本 heredoc 貼歪），造成 build 失敗；已清除。快速全樹檢查：`@babel/parser` 掃 `src/**/*.{js,jsx}`（179 檔數秒完成）
- **音效總閘門在 `ctx()` 單點**：所有直接 `const c = ctx()` 的合成函式自動被閘；日後新增音效不需個別 guard，但 mp3（`playAudio`）與 `vibrate` 是獨立路徑要記得
- **`scrollIntoView` 不加 `block:"nearest"` = 整頁亂捲**：日後任何 log 捲底一律加
- **Firestore 訂閱首次快照會觸發「計數增加」判斷**：比較型音效（n > prev）ref 初始值要用 `null` 區分「尚未收到首次快照」
- `fx-bounce` 重播靠 `key` 換值重掛元素；純 class 切換不會重播 CSS animation
- 待做批次：C（慶祝 confetti/fanfare/震動）、D（戰鬥 screen shake/hit-stop/死亡溶解）

---

## 2026-07-03（UI 全面改版 Phase 3：會員端逐頁套版完工）

### 改了什麼

Trellis 任務 `07-03-ui-redesign-p3`（commit `997c0ec` 主體 + `a340aa1` 檢查修正）：

- **Step 1-2 訓練/排行系列**：MemberComps / MemberScoring / MemberLeaderboard / MemberHistory / MemberExternalComp 淺色 class 全改 token tint；MemberPractice / DailyQuest / MemberRecordsHub 勘查後已是深色原生零改動
- **Step 3-4 我的/背包系列**：MemberProfile / MemberAchievements / MemberNotifications / MemberMessages / MemberLearn / MemberCertExam / MemberDex / MemberGuide / MemberBowSettings / CardCollection / MemberMaterials / MemberMonsterDex 共 12 檔套版；CoinShop / EquipmentPage 原生深色零改動
- **constants.js**：`COMP_TYPE_COLOR` 加 `darkText` key（additive）；`certLevelStyle` 的 `soft` 深色化 + 新增 `softLight`（原淺色）
- 品質檢查 8 項全過：build 無警告、純視覺 diff（handler/props/訂閱零改動）、無循環 import、覆寫層未動

### 踩坑提醒
- **`certLevelStyle("soft")` 深色化會讓未遷移的後台白卡上徽章隱形** → 後台（AdminApp CompDetail）改用 `softLight`；日後改共用 style 函式時要 grep 所有呼叫點確認背景色
- 刻意保留的功能性白底：MemberMaterials 慶祝彈窗 CTA、MemberProfile 宇宙星點、MemberScoring 10 分金色鈕
- UI 改版剩餘（另開任務）：後台 AdminApp 系列、shared/Equipment.jsx 內層、戰鬥頁 token 收斂 → 全部完成後才能刪 `.content-area` 覆寫層

---

## 2026-07-03（UI 全面改版 Phase 0-2：設計系統 + 導覽 + 首頁儀表板）

### 改了什麼

**Phase 0 — 設計系統**（Trellis 任務 `07-03-ui-redesign-p0`）
- `index.css`：`:root` 補齊 design tokens（語意色 success/warn/danger/info 各 fg+bg、accent/accent-soft/primary、圓角 --r-sm~xl、陰影、玻璃卡 --glass-*）；新增 `.ui-card` / `.ui-input` 元件層 CSS 類
- `shared/UI.jsx`：15 個共用元件全部深色 token 化（dark-first）；Card light/dark 都輸出玻璃卡；Btn 淺色 variant 改深色視覺、`dark-*` 變 alias、新增 `outline`；API 完全向後相容（props/variant key 零刪除）
- `shared/Widgets.jsx`（新檔）：SectionHeader / StatBar / ProgressRing / Skeleton / HubTile
- `theme.js` 收斂為單一 navy 主題（API 保留；舊 localStorage 值自動 fallback）；MemberProfile 主題選擇器以 `APP_THEMES.length > 1` 守門隱藏

**Phase 1 — 導覽**
- MemberApp header：頭像+等級環（ProgressRing + archerXPProgress）、檢定 pill、金幣/箭露/轉蛋幣 chips（點擊跳轉）、通知鈴鐺紅點
- 底部 nav：token 化、active 金色指示條、觸控目標 ≥44px（NAV_PRELOADS / viewTransitionName 保留）
- 四個 hub 頁（Adventure/Training/Inventory/Records）改 SectionHeader + HubTile 2 欄格線；入口改 module-level 常數陣列；hub 新增選用 prop `badges = {}`

**Phase 2 — 首頁儀表板**（MemberHome）
- 今日卡：報到狀態 pill + 今日箭數 + 下一每日里程碑 ProgressRing（用 `ALL_MILESTONES`）
- 進行中卡（無內容整卡隱藏）：世界王入口 / 遠征 3 槽倒數（舊 `expedition` 欄位兼容為槽 0）/ 村目標 StatBar（用既有 `subscribeActiveGoal`）
- MemberApp/AdminApp 新增下傳 props：`todayCheckin`、`worldBoss`（掛既有訂閱 callback，零新增 Firestore 讀取）
- 快速入口 4 格：打怪/自主練習/商店/排行榜；cell-*.webp 引用全數移除（檔案保留）

### 為什麼
- 原本深色 = 靠 `.content-area` 覆寫 Tailwind 淺色 class 的補丁層，顏色散落各元件難維護（後台 16 處白底事件的病根）
- 收斂 token 後元件原生深色，不再命中覆寫規則；覆寫層暫留保護未遷移頁面（比賽/練習/排行等）

### 踩坑提醒
- **Tailwind 是 CDN 版**（非 build-time）：focus/placeholder 偽類要寫在 index.css 純 CSS 類（`.ui-card`/`.ui-input`），不能靠任意 Tailwind class
- **HubTile 的 `accent` 必須傳 6 碼 hex**：內部 `${accent}26` 疊 15% 透明層，傳 `var(--xxx)` 會產生非法 CSS（預設值地雷已修為 `#f59e0b`）
- **BillingSystem / CatVillage 零依賴 shared/UI**（全自帶樣式），深色化不影響
- 全站原本沒有任何呼叫點傳 `theme` prop 給 Card → 統一深色安全
- 待實機驗證（靜態檢查無法取代）：教練切射手模式逐頁不空白、390px 手機寬 header/nav 排版

---

## 2026-07-02（Firestore 規則補 totalArrowsAllTime + dungeonClearLog + dungeonFirstKills）

### 改了什麼

**根因分析**：
- `addRoundArrows(memberId, count)` 每回合射完箭就呼叫 `increment("totalArrowsAllTime")`
- 但 Firestore 安全規則的 `members.update` 中 `hasOnly([])` 沒有包含 `totalArrowsAllTime`
- 會員自己更新 `members` 文件時，Firestore 比對 affectedKeys → 發現 `totalArrowsAllTime` 不在允許清單 → **拒絕寫入**
- 效果：終身箭數永遠不會增加，所有依賴 `totalArrowsAllTime` 的功能（里程碑、村目標貢獻、排行榜）都拿不到正確資料

**修正**（`firestore.rules`）：
- `members.update` 的 `hasOnly()` 加入 `"totalArrowsAllTime"`
- 同時補上 CLAUDE 版本中已有的 `"dungeonClearLog"` 和 `"dungeonFirstKills"`（本地檔案 vs Firebase 已同步，但跟 CLAUDE 版本有差異）

### 踩坑提醒
- **`totalArrowsAllTime` 是隱形的 bug**：`addRoundArrows` 有 `.catch(() => {})`，寫入失敗完全靜默，沒有人發現箭數沒累積
- **日後新增 member 欄位**時，若會員需要自行更新（非 only admin），務必同步加到 `hasOnly()` 列表，否則 Firestore 靜默擋掉
- **Firebase Console 部署**：CLI `firebase deploy --only firestore:rules` 有 403，需手動將 `firestore.rules` 內容貼到 Firebase Console → Firestore → 規則

---

## 2026-07-02（Firestore 規則補齊 + 射箭里程碑多回合修正）

### 改了什麼

**firestore.rules — 補 villageGoals / cardMarket**
- `villageGoals`：原本完全沒有規則 → 預設 deny，教練無法發佈村目標
- `cardMarket`：原本在 `service cloud.firestore { }` 的 **外面**（無效位置），移入正確位置
- `villageGoals` 規則：`read/create/update` 登入者皆可（autoSpawnVillageGoal 由前端觸發）；`delete` 限 admin

**MonsterBattle.jsx — 修正多回合箭數計算**
- 根本原因：`setRoundScores` 只在 `BATTLE_WIN/LOSE` 事件（最終回合）呼叫，非最終回合從未 push
- 導致：`endBattle` 裡 `roundScores = []`，`practiceRounds.flat().length = 6`（永遠只有最後一回合）
- 修正：非最終回合路徑（line ~682）補加 `setRoundScores(prev => [...prev, {round, scores: midRoundArr}])`
- 里程碑計算：加 `sessionArrowsRef`（`useRef(0)`），跨回合累積；`getMilestonesReached(oldSession, oldSession + arrowCount)` 取代舊的 `getMilestonesReached(0, arrowCount)`
- `startBattle` 時 `sessionArrowsRef.current = 0` 重置（新一場重算）

**WorldBossAttack.jsx — 補里程碑觸發**
- 世界王完全沒有里程碑邏輯
- 在 `addRoundArrows` 之後補 `getMilestonesReached(0, totalArrowsSent)` + `grantArrowMilestoneRewards`
- 加 `milestoneQueue` state + `SmallMilestonePopup` 在 result 頁面顯示

### 踩坑提醒
- **Firestore 規則在正確 service block 內部**：`match /databases/{database}/documents { }` 裡才有效；外面的規則一律被忽略（cardMarket 已修）
- **React 非同步 state**：`endBattle` 閉包捕獲的 `roundScores` 是呼叫當下的 stale value；這就是為什麼 `lastRoundArr` 要單獨傳入。但非最終回合若從未呼叫 `setRoundScores`，前幾回合分數就全丟了
- **`sessionArrowsRef` 跨打怪局累積**：同一個 session 打多隻怪時里程碑正確遞增，不會每局重從 0 算（`grantArrowMilestoneRewards` 已有每日防重複保護）
- CLI `firebase deploy --only firestore:rules` 有 403，**規則必須手動貼到 Firebase Console**

---

## 2026-07-02（BattleResultPanel 統一結算 — WB / Party / Dungeon / Duel）

### 改了什麼

**BattleResultPanel.jsx — PartySection 新增 isMvp + alive 支援**
- `isMvp === true` → 顯示 "👑 MVP" 黃色 badge（緊接在名字旁）
- `alive === false` → 顯示 "💀 陣亡" 紅色 badge，頭像半透明，傷害字體變灰
- `m.crits ?? 0` 防 undefined 爆炸

**WorldBossAttack.jsx — 結果畫面重整**
- `wbResultConfig` 追加 `showDmgDealt: true` + `showCritCount: true`
- 移除舊 "戰鬥報告" div（5 行 BattleStatRow），改成精簡的 3 行：機器人傷害（conditional）+ 本次總傷害 + Boss 剩餘 HP
- 移除 allRounds 回合 log 顯示（資訊移入 BattleResultPanel 分數分布）
- `BattleResultPanel` 現在一次顯示：傷害 + 爆擊 + 平均分 + 箭數 + 回合數 + 分數分布

**PartyBattleRoom.jsx — 戰績表統一進 BattleResultPanel**
- 在 `mvpId` 計算之後，將 `partyResultData.party` 補入隊伍成員（含 `isMvp` / `alive`）
- `partyStatsConfig` 追加 `showPartyMembers: true` + `showPartyLeader: true`
- 移除舊的 `statsList.map(...)` JSX 詳細戰績表 div
- 結算頁現在只有一個 `<BattleResultPanel>` 統一呈現（含怪物資訊、個人統計、隊伍成員）

**DungeonBattleRoom.jsx — 普通房間結算改用 BattleResultPanel**
- 新增 import `BattleResultPanel`, `RESULT_CONFIG_DUNGEON`
- 舊的「本房間獎勵」div 完全移除，改為 IIFE 計算 `dungeonRoomData` + `dungeonRoomConfig`
- drops 包含：coins / materials / arrowDew / chest（chestCount > 0 → true）
- stats：從 `room.log` 加總個人傷害，有傷害才顯示 `showDmgDealt`，沒有 log 則 stats = null
- 另加獨立「經驗獎勵」block（archerXP / catXP / gachaCoins）和收藏品 block

**DuelRoom.jsx — 結算統計改用 BattleResultPanel**
- 新增 import `BattleResultPanel`
- 計算 `duelArrowBreakdown`（從 log.attacks 過濾自己的 arrowBreakdown）→ scoreBreakdown / avgScore / critCount
- 舊的 3 個 BattleStatCard flex div 替換為 `<BattleResultPanel>` 顯示完整統計
- `duelStats` 累積戰績保留為獨立的 BattleStatCard

### 踩坑提醒
- `partyResultData.party` 要在 `mvpId` 算完後再賦值（statsList 才有 mvpId 可用）
- DuelRoom 的 `arrowBreakdown` 在 log 裡是 per-attack 層級（`entry.attacks[].arrowBreakdown`），不是 per-round
- Dungeon non-boss 的 `loot.arrowdew`（小寫 d）要對應到 `drops.arrowDew`（大寫 D）

---

## 2026-07-02（事件彈窗倒數 + banner 淡出 + 角色往上攻擊動作）

### 改了什麼

**事件彈窗：5 秒倒數 + 自動繼續（PartyBattleRoom.jsx）**
- 新增 `eventCountdown` state（預設 5）
- 新增 `useEffect` 監聽 `showEvent`：每秒 -1、5 秒後自動執行 dismiss 邏輯
- 彈窗 UI 加入圓形倒數圓環 + "點擊或等 X 秒繼續" 文字
- 自動倒數的 dismiss 邏輯直接在 effect 內執行（不呼叫 `handleDismissEvent`，避免 stale closure）

**「玩家回合」banner 先淡出再攻擊（useMiniRoundReveal.js + PartyBattleRoom.jsx）**
- `useMiniRoundReveal` 新增：在 `initialDelay - 500ms` 觸發 `setAnimPhase("bannerFadeOut")`
- `"bannerFadeOut"` 相位：banner 播 `party-banner-exit 0.5s ease forwards`（縮小淡出）
- 等 0.5s 動畫跑完，第一個 mini 才開始（攻擊開始時 banner 已消失）
- 新增 CSS `@keyframes party-banner-enter`（進場）、`party-banner-exit`（退場），取代舊的 `mb-float`（定位會跑掉）
- Banner JSX 加 `key={isCounter ? "counter" : "player"}` 讓 React 重新 mount 觸發進場動畫

**角色往上攻擊動作（PartyBattleRoom.jsx）**
- `mb-archer-attack` 改成 `translateY`：`0→-22px→-10px→0`（向上衝刺再落回）
- 時長從 0.4s 改為 0.55s
- 觸發條件不變：`isTopHit && !animCounter`（傷害最高的玩家才播）

### 踩坑提醒
- `"bannerFadeOut"` timer 要判斷 `!activeRef.current`，否則 stopReveal 後舊 timer 仍觸發
- 倒數 effect 的 auto-dismiss 直接用 `pendingRevealRef.current`（ref 永遠是最新值），不呼叫 `handleDismissEvent`（stale closure 問題）
- `party-banner-enter/exit` 的 transform 必須包含 `translate(-50%,-50%)`，否則定位錯誤（banner 使用 absolute + left:50% + translate 定位）

---

## 2026-07-02（怪物被秒殺沒看到死亡動畫）

### 改了什麼

**單人打怪（BattleAnimation.js）**
- 新增 `playBattleWin(d, p)` 函式並加入 `EVENT_DISPATCH`
- 效果：`anim.hit(true)`（怪物閃白 crit 效果）+ `sfxCritBoom()` + `await d.delay(2000)`
- 意義：以前 `BATTLE_WIN` 在 EVENT_DISPATCH 沒有對應動畫，擊殺後幾乎瞬間跳結算；現在有 2 秒停頓讓玩家看到擊殺

**組隊打怪（PartyBattleRoom.jsx）**
- 新增 `isKillingRound` 判斷：`entry.miniRounds.some(m => m.monsterHPAfter <= 0)`
- 擊殺回合 `entryEndExtra: 3500`（一般 1500ms）
- `onEntryEnd` 播 `sfxMonsterDead()` + 600ms 後 `sfxSuccess()`
- 新增 `sfxMonsterDead` import
- 新增「💀 擊倒！」全畫面 overlay：當 `liveEntry !== null && displayHP <= 0` 時出現，持續到結算畫面
- `handleDismissEvent` 也加入 `isKillingRound` 邏輯（事件觸發死亡的情況）

### 踩坑提醒
- `entryEndExtra` 只影響最後一個 mini 結束 → `setLiveEntry(null)` 的等待時間，並非動畫速度
- `displayHP` = `curMini?.monsterHPAfter ?? room.monsterHP`；殺死那一箭的 mini HP after = 0，overlay 在那瞬間出現
- 擊殺 overlay `zIndex:44`，比事件彈窗（50）低，不會擋住隨機事件確認

---

## 2026-07-02（「玩家回合」banner 與攻擊同時顯示）

### 改了什麼

**`src/battle/useMiniRoundReveal.js`**
- 玩家攻擊 mini 觸發時，`setAnimPhase("attacking")`（原本是 `"player"`）
- 現在 `animPhase` 語意：
  - `"player"` = initialDelay 預備期（banner 顯示，還沒開打）
  - `"attacking"` = 玩家實際攻擊中（banner 消失）
  - `"cat"` = 貓貓攻擊中
  - `"counter"` = 怪物反擊中

**`src/components/party/PartyBattleRoom.jsx`**
- Banner 條件從 `animPhase === "player" && liveMiniRoundIdx === 0 && !curMini?.isCounter` 簡化為 `animPhase === "player"`
- `initialDelay` 從 1200ms 改為 2000ms（兩個 startReveal 呼叫點都改）

### 踩坑提醒
- 舊條件 `liveMiniRoundIdx === 0` 是錯的：第一個 mini 開始後 idx 仍為 0，導致 banner 和攻擊同時顯示
- `"attacking"` 是新加的相位值，不出現在 banner 判斷裡（直接忽略）

---

## 2026-07-02（隨機事件彈窗暫停後續動畫）

### 改了什麼

**問題**：事件彈窗出現後，後面的箭矢/反擊動畫繼續跑，玩家無法在彈窗出現時暫停觀看。

**單人打怪（MonsterBattle + RoundController）：**
- `RoundController.playEvents` 第 4 步改為 `await handlers.onRandomEventEnd?.()`（加 await）
- `onRandomEventEnd` 現在回傳 Promise，把 `resolve` 存進 `randomEventResolveRef`
- 事件卡 UI 改為點擊才能繼續：點擊後清 `currentEvent`、還原 `battlePhase`、呼叫 `resolve()`
- 效果：箭矢動畫等玩家點事件卡才開始

**組隊打怪（PartyBattleRoom）：**
- 有 `entry.event` 時：不立即呼叫 `startReveal`，改把 entry 存進 `pendingRevealRef`，顯示彈窗
- 新增 `handleDismissEvent()`：玩家點彈窗後清 `showEvent`、讀 `pendingRevealRef`、才呼叫 `startReveal`
- 彈窗改為 `cursor:pointer`、移除 `pointerEvents:none`，顯示「點擊繼續 ▶」提示

### 踩坑提醒
- `onRandomEventEnd` 必須回傳 Promise，否則 `await` 會立即通過（undefined 被 await 視為 resolved）
- Party mode：`startReveal` 必須在 `handleDismissEvent` 裡呼叫，才能拿到最新的 `room?.members`
- 組隊事件彈窗原本有 `pointerEvents:"none"` — 要刪掉才能接收點擊事件

---

## 2026-07-02（BattleEngine 隨機事件重排：Phase 0 先行）

### 改了什麼

`src/battle/BattleEngine.js` 回合順序重整：

**舊**：箭矢 → 隨機事件 → 貓貓 → 怪物反擊

**新**：Phase 0 隨機事件 → Phase 1 玩家箭矢 → Phase 2 貓貓回合 → Phase 3 怪物回合

技術重點：
- `const effATK` 改 `let`，Phase 0 更新 `curATKMod` 後立即重算，讓 ATK buff/debuff 影響本回合箭傷
- Phase 0 若直接擊殺怪物提前返回 `BATTLE_WIN`
- MonsterBattle 的 `RANDOM_EVENT` handler 不需修改：事件在列的第一個 → UI 自動先彈 popup，確認後才播箭矢動畫

兩種「隨機事件」釐清：
- **狀態隨機事件**（`RANDOM_EVENTS`）→ Phase 0，影響 ATK/HP/skipCounter
- **貓貓反應訊息**（`triggerCatAction()`）→ 每箭命中觸發，純 UI 文字，不動

### 踩坑提醒

- ATK 修正在 Phase 0 後必須同步更新 `effATK`，否則箭傷用舊值
- Phase 0 結束若 monsterHP ≤ 0，`processedArrowScores` 為空，BATTLE_WIN handler 從組件 `arrows` state 讀已輸入分數

---

## 2026-07-02（移除報到限制 + 下課里程碑全覽板）

### 改了什麼

**邏輯調整：移除「需報到才能累積箭數」限制**
- `MonsterBattle.jsx`：`addRoundArrows` 和 `addPracticeLog` 的呼叫條件從 `checkinActive && profile?.id` 改為只要 `profile?.id && !isGuest`，即不管有沒有報到，射箭都會記錄
- 箭露和里程碑獎勵仍需點「下課」才兌換

**DailyQuest.jsx 大改版**
1. `subscribeTodayPracticeLogs` 移除 `DIRECT_SOURCES` 過濾 → 全模式射箭都計入「今日箭數」
2. 「今日 X 箭」卡片：只要 `todayArrows > 0` 就顯示（不限狀態）
3. 下課確認對話框新增「今日里程碑全覽板（`MilestoneBoard`）」：全部 11 個門檻，解鎖=亮色，未解鎖=暗色 35%，附帶進度條
4. `arrowMilestone.js` 新增 `export const ALL_MILESTONES`（原本未導出）

### 為什麼

射手不知道射箭里程碑有獎勵，每次只看到 6 箭 popup。改成在「下課」時一次顯示全覽板，讓學生清楚今天解鎖了哪些、還差多少到下一個。

### 踩坑提醒

- `addPracticeLog` 的 `totalArrows` 用於 `subscribeTodayPracticeLogs` 計算今日總量；`addRoundArrows` 只更新 `totalArrowsAllTime`，兩者不重疊
- DIRECT_SOURCES 移除後，party/duel/dungeon 的 session-end log 也計入 todayArrows，但這些在戰鬥結束後才寫，中途不會立即反映
- `MilestoneBoard` 是純 UI 預覽；`grantArrowMilestoneRewards` 在 `confirmClassEnd` 才實際寫 Firestore

---

## 2026-07-02（戰鬥回合大重構：大回合制 + 箭數選擇）

### 總覽

將地下城（`dungeonDb.js`）和組隊（`partyDb.js`）的回合邏輯從「每 2 箭中途反擊」改為「全箭打完後大回合末唯一一次反擊」，並新增 3/6 箭數選擇 UI。

### 改了什麼

- **`src/battle/BattleConfig.js`**：移除 `COUNTER_INTERVAL`，新增 `ARROWS_OPTIONS = [3, 6]` 和 `ARROWS_PER_ROUND_DEFAULT = 6`
- **`src/lib/dungeonDb.js` `processDungeonRound`**：`ARROWS_PER_CTR` 移除，迴圈改用 `room.arrowsPerRound || 6`，反擊移至貓貓攻擊後（大回合末唯一一次）
- **`src/lib/partyDb.js` `processPartyRound`**：三輪雙箭迴圈改為每位玩家一個 mini-round 含全部箭矢（`arrowsPerRound` 箭）
- **`src/components/dungeon/DungeonBattleRoom.jsx`**：`status === "waiting"` 顯示 3/6 箭選擇 UI（房主可設定，他人唯讀）；戰鬥中各箭數相關 hardcode 6 改為讀 `room.arrowsPerRound || 6`
- **`src/components/party/PartyBattleRoom.jsx`**：等待室加入 3/6 箭選擇 UI（同樣邏輯）

### 為什麼

玩家反映「每 2 箭反擊」節奏太快、多人局搞混不清楚傷害輸出，改成大回合末反擊可讓玩家先看到全部攻擊動畫再承受一次反擊，節奏更清晰。

### 踩坑提醒

- `ctrAccum` 累積保留（dungeonDb 用於 `ctrHitsThisFloor` 難度追蹤）
- `partyDb.js` 新循環中 `totalDmgP` 是 block-scoped，不衝突外層的 `totalDmg`
- `DungeonBattleRoom` 的 `status === "waiting"` 在地圖模式下幾乎不會被到達（DungeonController 只對 active/completed/path_select/floor_transition 顯示 DungeonBattleRoom）；但保留此 UI 確保非地圖模式兼容
- `BattleEngine.js` 不需修改（已是大回合末單次反擊結構，且未使用 `COUNTER_INTERVAL`）

---

## 2026-07-02（角色系統修正 + 統一箭數更新）

### 改了什麼

**修正 1：PartyBattleRoom 移除「自由選擇前後衛」按鈕**
- 原本在輸入區域有一組 ⚔️前衛 / 🛡後衛 toggle button，讓玩家可以在戰鬥中途自由切換，脫離原本設計
- **根本原因**：`myRole` 已由 Firestore 透過 `useEffect` 同步（`if (serverRole) { setMyRole(serverRole); }`），只要前後衛分配在遊戲開始時確定，玩家就不應再手動切換
- **修正**：移除前衛/後衛 toggle buttons；改為只在 `myRole === "rear"` 時顯示「後衛行動選擇」（heal/dmg），附加「後衛」提示標題，與 DungeonBattleRoom 的設計一致
- **踩坑提醒**：DungeonBattleRoom 的角色鎖定設計一直是正確的（只在 `me.role === "rear"` 時顯示後衛選項），PartyBattleRoom 是後來寫的時候誤加了 toggle

**修正 2：統一每回合箭數更新（totalArrowsAllTime）**
- **背景問題**：`addPracticeLog` 是在戰鬥結束後才批次更新 `totalArrowsAllTime`，若連線中斷或 Firestore 規則問題會導致整局箭數遺失
- **修正**：
  - `db.js` 新增 `addRoundArrows(memberId, count)` — 只更新 `members/{id}.totalArrowsAllTime: increment(count)`，輕量且即時
  - `db.js` 從 `addPracticeLog` 移除 `totalArrowsAllTime` 更新（避免雙重計算）
  - `useFirestoreRound.js` 新增 `onSubmitSuccess(...extraArgs)` callback（用 ref 存，避免 stale closure），submit 成功後立即呼叫
  - **Party** / **Dungeon** / **Duel**：在 `useFirestoreRound` 的 `onSubmitSuccess` 呼叫 `addRoundArrows(myId, arrows.length)`
  - **MonsterBattle**：在 `submitRound` 開頭（引擎前）呼叫 `addRoundArrows(profile.id, arrowsPerRound)`，只有 `!isGuest && checkinActive` 時才執行
  - **WorldBossAttack** / **CouncilBattle**：在 `addPracticeLog` 呼叫前加 `addRoundArrows(myId/memberId, totalArrows)`

### 踩坑提醒

- `addPracticeLog` 現在**不再**更新 `totalArrowsAllTime`；所有模式必須自己呼叫 `addRoundArrows`，否則終身箭數不會累計
- `onSubmitSuccess` 的參數是 `...extraArgs`（即 `handleSubmit` 的參數），DuelRoom 的 extraArgs 是 `(team, arrows, target)`，所以 callback 要 `(_team, submittedArrows) => ...`
- CouncilBattle 的 `logCouncilArrows` 是在戰鬥結束後才呼叫（不是每回合），所以它的 `addRoundArrows` 是一次補計整場所有箭數，仍屬於「結束時更新」——若要改成真正每回合更新，需要在 Council 的回合 submit 處理

---

## 2026-07-02（Check Agent 補丁：PartyBattleRoom + DungeonBattleRoom 修正）

### 改了什麼

**`src/components/party/PartyBattleRoom.jsx`（3 項修正）**：
1. 移除 `const [room, setRoom] = useState(null)` — 此 state 從未被更新（訂閱已由 `useFirestoreRound` hook 內部處理），導致 `room` 永遠是 `null`，畫面永遠顯示「載入中…」
2. 改為從 `useFirestoreRound` 的返回值解構取得 `room`（`const { room, handleSubmit, ... } = useFirestoreRound(...)`）
3. 將 `const myId = ...` 移到 `useFirestoreRound` hook 呼叫之前（原在第 185 行，hook 在第 119 行）— 避免 `const` 時間死區（TDZ）錯誤，`myId` 在 hook 呼叫時必須已初始化

**`src/components/dungeon/DungeonBattleRoom.jsx`（1 項修正）**：
1. 第 1469 行：`setSubmitted(false)` → `setFsSubmitted(false)` — `setSubmitted` 已在解構時別名為 `setFsSubmitted`（`setSubmitted: setFsSubmitted`），直接呼叫 `setSubmitted` 會拋出 ReferenceError

### 為什麼

這兩個 bug 是在 `useFirestoreRound` hook 整合時引入的——hook 的訂閱結果（`room`）沒有被組件使用，且變數別名沒有同步更新呼叫端。

### 踩坑提醒

- `useFirestoreRound` 回傳 `{ room, setRoom, submitted, setSubmitted, handleSubmit, localProcessing }`，呼叫端若需要 `room` 必須明確解構
- 解構時使用別名（如 `setSubmitted: setFsSubmitted`）後，呼叫端所有地方都要用別名，不可再用原名

---

## 2026-07-01（Phase 1-6 戰鬥系統全面模組化重構）

### 總覽

將 5 個戰鬥模式（MonsterBattle / PartyBattleRoom / DuelRoom / DungeonBattleRoom / CouncilBattle / WorldBossAttack）中的重複程式碼萃取為 8 個共用模組，歸納至 `src/battle/` 與 `src/lib/`。

**統計**：+2242 / −833 行（淨 +1409 行），8 新檔 + 7 檔修改

---

### Phase 1: 統一傷害公式 (`src/lib/damage.js`, +235 行)

**為什麼**：5 個戰鬥模式各自內聯計算箭矢傷害/反擊/貓貓攻擊，公式不一致（爆擊倍率、DEX 加成、前後衛修飾等細節各異）。

**改了什麼**：
- `calcArrowDamage(score, atk, def, dex, options)` — 共用的單箭傷害公式（含爆擊×1.5、DEX+1、隨機±10%）
- `calcCounterDamage(monAtk, def)` — 反擊傷害
- `calcStandardArrowDmg` / `calcStandardCounter` — 標準戰鬥模式封裝
- `calcWorldBossArrowDmg` — 世界王專用（含助攻縮放）
- `calcCatDamage` — 貓貓攻擊

**踩坑提醒**：`options.forceCrit` 用於 `hit_count` 合約強制爆擊；CouncilBattle 與 WorldBossAttack 仍使用自己的公式，尚未遷移。

---

### Phase 2: 統一計分邏輯 (`src/lib/score.js`, +201 行)

**為什麼**：分數 label↔value 轉換（X/11 → 6/0）、SCORE_MAP、COLORS 散落在各元件中。

**改了什麼**：
- `SCORE_MAP` / `SCORE_COLORS` / `SCORE_MAP_REVERSE` — 集中管理
- `scoreLabel(score)` / `scoreValue(label)` — 轉換函式
- `SCORE_ROW_A/B` — 折疊計分板兩頁定義
- 5 個戰鬥模式改用 `score.value` 取代硬編碼

**踩坑提醒**：`score.js` 的 `scoreValue("X")` 回傳 11，`scoreValue("M")` 回傳 0；各模式務必使用回傳值而非再自定義映射。

---

### Phase 3: 戰鬥引擎 (`src/battle/BattleEvents.js` / `BattleConfig.js` / `BattleEngine.js`, +682 行)

**為什麼**：MonsterBattle 的 50 行 event loop 耦合了事件產生、動畫播放、音效、狀態更新，難以在其他模式複用。

**改了什麼**：
- **`BattleEvents.js`** — 22 個 EventType（`arrow_hit` / `arrow_crit` / `counter` / `random_event` / `battle_win` 等）+ `createXxxEvent` builder
- **`BattleConfig.js`** — 戰鬥模式參數（箭數、距離、倍率、機率）統一管理
- **`BattleEngine.js`** — 單人戰鬥事件產生器（`generateRoundEvents`），接收 `roundResult` → 產生完整事件陣列

**踩坑提醒**：EventType 字串值用 camelCase（`arrow_hit`），不要在元件中再自創 type；用 `EventType.ARROW_HIT` 引用。

---

### Phase 4: 動畫派遣器 (`src/battle/BattleAnimation.js`, +234 行)

**為什麼**：19 個 `playXxx` 動畫函式散布在 MonsterBattle 內，需要拆出讓所有模式共用。

**改了什麼**：
- `playSoundEffect(type)` / `playHitAnimation(type)` / `playVisualEffect(type)` — 動畫三層封裝
- `addRoundLog(phase, msg)` / `addEventLog(...)` — log 系統標準化
- **`EVENT_DISPATCH`** — 事件→動畫映射表（22 個 EventType 各自對應 `playXxx`）
- `createDispatch()` — 工廠函式，回傳 `{ playSoundEffect, playHitAnimation, playVisualEffect, dispatch, ...addLog }`

**踩坑提醒**：`EVENT_DISPATCH` 的 handler 簽名為 `(payload, eventCtx, dispatch)`，請勿改變順序；`dispatch.animate()` 回傳 Promise 讓 RoundController 可以 await。

---

### Phase 5: Firestore 回合抽象層 (`src/battle/useFirestoreRound.js`, +183 行；3 元件重構)

**為什麼**：PartyBattleRoom / DuelRoom / DungeonBattleRoom 三模式的 Firestore 訂閱+提交+房主處理邏輯高度重複（每人約 30~50 行），且都有卡死 bug 歷史。

**改了什麼**：
- **`useFirestoreRound(config)`** — 統一 hook，參數：
  - `subscribe` / `submit` — Firestore 訂閱/提交箭分
  - `processRound` — 房主處理回合邏輯
  - `getMembers` / `isProcessing` / `canProcess` / `getBotsUnready` / `submitBotArrows` / `getExtraProcessArgs` / `processDelayMs` / `maxRetries`
  - `onBeforeSubmit` / `onSubmitError` — 生命週期回呼
  - 回傳：`{ room, submitted, submitting, handleSubmit, fsHandleSubmit, setFsSubmitted, retryCount }`
- 自動管理：subscribe lifecycle、submitted state、submitting guard、all-ready detection、delay、host processing、retry

**重構的元件**：
| 模式 | 關鍵變更 |
|------|---------|
| PartyBattleRoom (Pilot) | 36 行 handleSubmit → 5 行；host processing effect 移除 |
| DuelRoom (Bot 支援) | subscribe + host processing effects 移除；getBotsUnready + submitBotArrows 移至 hook config |
| **DungeonBattleRoom (最複雜)** | subscribe callback 4 職責 split；35 行 host processing（含 1s delay + 8s safety-net）→ hook config；5 個 ref 移除（processingRef, lastProcessedRef, allReadyTimerRef, forceProcessTimerRef, submitFallbackRef）；dead code `loading` state 清理 |

**踩坑提醒**：
- `submit` config 必須封裝 team 參數（DuelRoom 需要傳 team A/B）
- `getBotsUnready` 必須回傳 `{ id, team, m }` 結構
- `processDelayMs: 1000` 保留地下城原有的 1 秒延遲（防 Firestore 快照競爭）
- non-host processing timeout 20s 保留在 hook 內部（永不遺忘）

---

### Phase 6: RoundController (`src/battle/RoundController.js` / `useBattleRound.js`, +179 行；3 元件重構)

**為什麼**：MonsterBattle 的 50 行 event loop（for + switch + 15 case）需要抽象為共用控制器，讓 CouncilBattle 與 WorldBossAttack 也能使用。

**改了什麼**：
- **`RoundController` class** — `playEvents(events, eventCtx, handlers)` 方法：
  - 事件迭代 loop（for...of）
  - 動畫派遣（透過 EVENT_DISPATCH）
  - 計時管理：箭矢事件 1500ms 延遲，其他 0ms（可自訂）
  - BATTLE_WIN / BATTLE_LOSE 自動中斷
  - RANDOM_EVENT 清理回呼
  - 回傳 `{ battleEnded, battleResult }`
  - 建構子接受 `options.customDelays` 覆寫延遲

- **`useBattleRound` hook** — 封裝 RoundController、管理 `isPlaying` 狀態

**重構的元件**：

| 模式 | 事件迴圈 | Handlers |
|------|---------|----------|
| **MonsterBattle** | 50 行 for+switch → `controller.playEvents(events, ctx, handlers)` | 15 per-type handlers |
| **CouncilBattle** | 自訂 CB_EVT（Arrow/Counter/Result/End）→ playEvents + 4 handlers | 箭矢動畫、反擊動畫、結果顯示、戰鬥結束 |
| **WorldBossAttack** | 25 行 for+600ms delay → events 陣列 + playEvents | WB_EVT（Arrow/CatMsg/Support）自訂型別 + customDelays 600ms |

**踩坑提醒**：
- CouncilBattle 與 WorldBossAttack 使用自訂 EventType（`CB_EVT` / `WB_EVT`），不在 BattleAnimation 中，dispatch 會跳過 animate step（只跑 handler）
- WorldBossAttack 的 `processingIdx` 在事件預先計算時 batch 為同步，不會觸發 re-render → 修復為播放前一次性 `setProcessingIdx(totalEvents-1)`
- `customDelays` 向後相容，不傳 options 的既有呼叫（MonsterBattle, CouncilBattle）不受影響

---

### Phase 7: 共用 mini-round 動畫 hook (`useMiniRoundReveal.js`)

**為什麼**：PartyBattleRoom 與 DungeonBattleRoom 的 mini-round 逐箭動畫邏輯 ~85% 相同（setTimeout 鏈管理 liveEntry/animHit/animMonsterCharge/floatDmg 等 8 個 state），但寫在兩個元件中各 80+ 行，導致維護雙倍成本。

**改了什麼**：
- **`src/battle/useMiniRoundReveal.js`**（新增，+134 行）— 共用 mini-round 動畫 hook：
  - 管理 8 個動畫 state：`liveEntry` / `liveMiniIdx` / `animHit` / `animMonsterCharge` / `animScreenShake` / `floatCounterDmgs` / `localHpOverride` / `floatDmg` / `attackingIds`
  - `startReveal(entry, opts)` — 啟動 setTimeout 鏈播放 mini-round：
    - `key` — 去重 key（防止 F5 重整重播）
    - `attackDelay` / `counterDelay` / `entryEndExtra` — 可自訂計時（預設 1400/2700/1500ms）
    - `members` — 用於反擊 HP lock 計算
    - `onMiniTick(mini, idx)` — 每 mini-round 開始時回呼（sfx/attackingIds）
    - `onCounterHit(mini, idx)` — 反擊命中時回呼（sfxCounter/vibrate）
    - `onEntryEnd(entry)` — 全部播放完時回呼（擊殺動畫/回合結算）
  - `stopReveal()` — 清除計時器 + 重置所有 state
  - 自動 `clearTimers` 在下次 `startReveal` 時清理前一輪 timer

**重構的元件**：

| 元件 | 行數變化 | 關鍵變更 |
|------|---------|---------|
| **PartyBattleRoom.jsx** | +245/−245 | 80+ 行 inline setTimeout 鏈 → `reveal.startReveal()` + 回呼；移除 `isAnimating` 手動 state（hook 直接提供） |
| **DungeonBattleRoom.jsx** | +366/−366 | 90+ 行 inline setTimeout 鏈 → `reveal.startReveal()` + onMiniTick/onCounterHit/onEntryEnd；移除 8 個 animation state + `revealTimersRef` |

**踩坑提醒**：
- `setAttackingIds` 需暴露給 `onMiniTick` 回呼使用 → hook 回傳值中加 `setAttackingIds`（向後相容）
- DungeonBattleRoom 保留 `lastAnimKeyRef` 作為 render guard（`hasNewAnim` 檢查），確保完成畫面不會在動畫開始前閃爍
- DuelRoom 的動畫架構（逐箭揭露 12 步 + cross-referencing attacks[]）與 mini-round 不同，不適用此 hook
- 計時差異：hook 預設 `entryEndExtra: 1500ms`，原本 DungeonBattleRoom 是 `delay + 500 + minDelay` → 回合結果 overlay 約晚 1 秒顯示

---

### 最終架構關係（Phases 1-7）

```
src/lib/
  damage.js          ← 各模式共用傷害公式
  score.js           ← 各模式共用計分邏輯

src/battle/
  BattleEvents.js    ← 22 種標準事件型別 + builder
  BattleConfig.js    ← 戰鬥模式參數集中管理
  BattleEngine.js    ← 單人戰鬥事件產生器
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH
  useFirestoreRound.js ← Firestore 回合 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← 共用 mini-round 動畫 hook（Party/Dungeon）
```

---

### Phase 8: 逐箭揭露 hook (`useDuelReveal.js`) + damage.js 公式補完

**為什麼**：
- DuelRoom 的 12 步逐箭揭露邏輯（~170 行 inline useEffect + 11 個 state + 4 個 effect）無法被 `useMiniRoundReveal` 共用（架構不同——逐箭揭露 vs mini-round 離散回合）
- CouncilBattle 的 `getPartMult()` 與 damage.js 的 `getCouncilPartMult()` 重複
- CouncilBattle 的 `scoreVal()` 與 score.js 的 `labelToValue()` 重複
- WorldBossAttack 的 `calcArrowDmg`/`calcCounterDmg` wrapper 只是 damage.js 的傳遞函式

**改了什麼**：

#### 新檔：`src/battle/useDuelReveal.js`（~190 行）

封裝 DuelRoom 的逐箭揭露邏輯：
- 管理 11 個 state：`revealEntry`, `revealIdx`, `displayHp`, `floats`, `flashIds`, `attackingIds`, `hittingIds`, `eventPhase`, `showCatRound`, `duelCatCats`, `revealPhaseBanner`
- 4 個內部 effect：log 偵測 → 事件暫停/揭露 → 逐箭計時器（1000ms）→ 揭露完成（貓貓 overlay + 清理）
- 對外 callback：`onSoundEffect(hasCrit, hasHit)`、`onComplete(entry)`
- 方法：`skipEvent()`（跳過事件暫停）、`stopReveal()`（清理重置）

#### 修改：`src/components/duel/DuelRoom.jsx`

```
Before (4 effects, ~170 行):          After (~10 行 hook + callbacks):
 log 偵測 effect                       useDuelReveal({ room,
 逐一揭露計時器 effect                    onSoundEffect,
 事件暫停 effect                        onComplete })
 完成清理 effect                       + skipEvent → skipEvent
 + 11 個 state 宣告                    + resetLocalState → stopReveal()
 + lastLogLen ref
 + startReveal()
```

#### 修改：`src/components/member/CouncilBattle.jsx`

```
Before:                               After:
 getPartMult(label, fmt)  (內聯)       getCouncilPartMult(label, fmt)  (damage.js)
 scoreVal(label)          (內聯)       labelToValue(label)              (score.js)
 getMappedScore (內聯 parseInt)        getMappedScore 使用 labelToValue
```

#### 修改：`src/components/worldboss/WorldBossAttack.jsx`

```
Before:                               After:
 calcArrowDmg(s, a, b, p) → wrapper   wbArrowDmg(s, a, b, p) → direct call
 calcCounterDmg(a, d) → wrapper        wbCounter(a, d) → direct call
```

**踩坑提醒**：
- `useDuelReveal` 只在 DuelRoom 使用（無跨模式複用價值），抽取是為了隔離程式碼而非複用
- `revealEntry` 和 `revealIdx` 使用 ref 同步防止閉包陳舊（timers 中的 callback 讀最新的值）
- 完成 effect 必須依賴 `room` 物件來計算貓貓攻擊（`room.teamA`/`room.teamB` 找 `allMembersMap`）
- CouncilBattle 的 `getCouncilPartMult` 比舊 `getPartMult` 多處理 `"M"` label（但不影響 CouncilBattle 的 `"0"` 標籤）
- WorldBossAttack 的 `scoreVal`/`scoreLabel` 包裝保留（大量 JSX 使用，移除成本 > 收益）

---

### 最終架構關係（Phases 1-8）

```
src/lib/
  damage.js          ← 各模式共用傷害公式
  score.js           ← 各模式共用計分邏輯
  itemData.js        ← 藥水資料（9 攜帶型 + 7 投擲型 + 村莊配方）
  villageData.js     ← 煉金室產出箭露（arrowdew，微量）

src/battle/
  BattleEvents.js    ← 22 種標準事件型別 + builder
  BattleConfig.js    ← 戰鬥模式參數集中管理
  BattleEngine.js    ← 單人戰鬥事件產生器
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH
  useFirestoreRound.js ← Firestore 回合 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← mini-round 動畫 hook（Party/Dungeon）
  useDuelReveal.js   ← 決鬥逐箭揭露 hook（DuelRoom）
```

### Phases 1-8 總覽

```
Phase 1  Damage Engine     ██████████████████████████████ ✅
Phase 2  Score Engine      ██████████████████████████████ ✅
Phase 3  Battle Engine     ██████████████████████████████ ✅
Phase 4  Animation Manager ██████████████████████████████ ✅
Phase 5  Firestore 回合     ██████████████████████████████ ✅
Phase 6  RoundController   ██████████████████████████████ ✅
Phase 7  Mini-Round Reveal ██████████████████████████████ ✅
Phase 8  Duel Reveal +     ██████████████████████████████ ✅
         damage.js 補完
```

---

---

## 2026-06-29（佈署 Bug 修正 3 連）

### Bug 1：MonsterBattle 進場報 `ReferenceError: n is not defined`
- **根因**：`MonsterBattle.jsx` 第 464 行在 `useCarryPotion` 函式上方多了一個孤立的 `n` 字元，被 JS 當成未宣告變數執行
- **修正**：刪除該 `n` 字元（`n  // 🧪 使用攜帶型藥水...` → `  // 🧪 使用攜帶型藥水...`）
- **踩坑**：minified bundle 的 `n is not defined` 指向的是源碼中的孤立識別字，不一定是某個真實變數名稱

### Bug 2：進場後 HP NaN/100、ATK 0（DEF 正常）
- **根因**：`calcPotionBuffs`（`itemData.js`）重設計時把回傳格式從 `{ hpMult, atkMult }` 改成 `{ hpPct, atkPct }`，但 `MonsterBattle.jsx` 計算 `bStats` 仍讀 `buffs.hpMult` / `buffs.atkMult`，取到 `undefined`，乘法結果變 `NaN`
- **DEF 正常原因**：`def = baseStats.def + ... `（加法，不乘 buffs）
- **HP 顯示 NaN**：`archerHP` 初始化為 `bStats.hp = NaN`
- **ATK 顯示 0**：UI 有 `||0` fallback，`NaN || 0 = 0`
- **修正**：在 `calcPotionBuffs` 結尾補算 `buffs.hpMult = 1 + hpPct/100`、`buffs.atkMult = 1 + atkPct/100`，兩種格式並存向後相容

### Bug 3：Push 失敗——`codebase-memory-mcp.exe` 超過 GitHub 100MB 限制
- **根因**：`codebase-ui-extracted/` 資料夾含 257MB `.exe` 被 git 追蹤
- **修正**：`.gitignore` 加入 `codebase-ui-extracted/`、`codebase-ui.zip`、`install.ps1`
- **踩坑**：大型二進位工具資料夾務必在第一次 `git add` 前就加進 `.gitignore`

**重要架構提醒**：`calcPotionBuffs` 現在同時輸出 `hpPct/atkPct`（百分比數字）和 `hpMult/atkMult`（倍率）。未來修改此函式時，兩種格式都要維護，否則會影響 MonsterBattle 的開戰數值計算。

---

## 2026-06-28（地下城 7 Bug 修正批次）

### Bug 1：商店 revival_front 復活目標錯誤
- **根因**：`handleResolve` 檢查購買者自身 `role==="rear"`，應找隊伍中任何 `role==="rear"` 的成員
- **修正**：改為掃描 `shopPurchases` 確認有人購買後，取 `members` 中第一個 `alive && role==="rear"` 的成員復活
- `hasFallenFront` 計算移到元件頂層，供按鈕 disabled 和 handleBuy 共用

### Bug 2：休息區全員狀態確認
- `handleResolve` fallback（無人倒地時投票 revive → 全體回 50% HP）原本即正確，保留
- 加入全員狀態小卡（Bug 4 合併）

### Bug 3：計分板折疊 + 視角切換
- **3a 分數折疊**：新增 `scoreRowPage` state；`SCORE_ROW_A=["X","10","9","8","7","6","M"]` / `SCORE_ROW_B=["6","5","4","3","2","1","M"]`；7顆 repeat(7,1fr) + 外部 ▼/▲ 切換按鈕
- **3b 視角切換**：新增 `viewRearInInput` state；`displayedRowMembers` 在非動畫/非送出時允許切換後衛視角；角色列標頭右側加小按鈕

### Bug 4：商店/休息區全員狀態小卡
- 兩個元件 header 下方加 `overflowX:auto` 橫排小卡，顯示 HP 條 + 存活狀態 + 角色

### Bug 5：商店購買限制
- 移除 `bought` state，改為只依賴 Firestore `myPurchases`
- `revival_front` 購買前需 `hasFallenFront === true`，否則 block + 顯示 ⚠️ 無前衛倒地

### Bug 6：關卡機制修改
- **6a all_hit → M懲罰關**：移除「有M全歸零」早回，改為回合結束後 `totalDmg *= max(0, 1 - mCount * 0.1)`；不再限制靶面/按鈕（全分數有意義）；icon 改 ⚠️
- **6b score_gate 比例懲罰**：移除「低於門檻全0」邏輯，改為每箭 `d *= max(0, 1 - (threshold - effectiveScore) * 0.1)`；X/10 視同 9；contractParam cap 9；`_roomMeta` 改 `Math.min(6+tier, 9)`

### Bug 7：後台白底框
- AdminReviewCenter：三個 toggle 按鈕、統計卡、兩個 input 欄位、外賽審核決定區、category badge 改深色
- AdminMembers：MemberCard 主框、EquipTabs 非選中、爭議 Modal 修正區、歷程統計卡、檢定卡 改深色
- AdminFinance：tab 按鈕非選中 改深色
- QR Code 白框保留（掃碼必需）

**踩坑提醒**：
- `score_gate` 的 score_gate penalty 在 dmgMult 之前套用（讓 buff 可以再補救）
- `all_hit` 的 M 計數用 `arrows.filter(a=>(a.score??0)===0)` 而非 breakdown 中的脫靶（breakdown 裡的脫靶還包含 part 未命中的情況）
- `SCORE_GATE_LABELS.slice(0,5)` = ["9","8","7","6","5"]，`slice(5)` = ["4","3","2","1","M"]

---

## 2026-06-27（地下城前後衛顯示重設計 + 死亡轉後衛時機修正）

### Bug A：前衛死亡後在動畫開始前就被移到後排
- **根因**：`processDungeonRound` 一次寫入 `log` 和 `members.role`；客戶端收到快照時動畫剛啟動但 role 已是 post-round 值 → 分排計算立即改變
- **修正**：在 `dungeonDb.js` 新增 `displayGroup` 欄位（`DEFAULT_MEMBER` + `joinDungeonRoom`），並在 `logEntry` 加入 `displayGroupsBefore`；客戶端動畫期間改用 `liveEntry.displayGroupsBefore[id]` 決定分排，動畫結束後才反映新 `displayGroup`

### Bug B：前後兩排同時顯示，怪物畫面被遮住
- **設計調整**：改為「視角分排」——每人只看自己的排（前衛看前衛排，後衛看後衛排）
  - 平時（等待輸入/已送出）：只顯示 `myRowMembers`（完整卡）
  - 動畫進行中：上方補顯 `otherRowMembers` 緊湊小卡（讓後衛看到前衛出手/讓前衛看到後衛支援）
- **displayGroup 規則**：
  - 加入時 `displayGroup = defaultRole`（和 `role` 同步）
  - 前衛死亡：`role → "rear"`；若當前後衛顯示位置 < 4 → `displayGroup → "rear"`（真正移動）；否則 `displayGroup` 保持 "front"（只改狀態標籤）
  - 死亡後留在前排的成員：紫色邊框（`rgba(168,85,247,0.45)`）+ 顯示 "🛡後衛" 標籤

### 實作細節
- `dungeonDb.js`：`DEFAULT_MEMBER` 加 `displayGroup:"front"`；`joinDungeonRoom` 加 `displayGroup:defaultRole`；`processDungeonRound` Step 5b 前計算 `displayGroupsBefore` 並寫入 `logEntry`；死亡邏輯中判斷後衛座位數（`<4`）再決定是否更新 `displayGroup`
- `DungeonBattleRoom.jsx`：新增 `dgOf(m)` 函式（動畫中用 `displayGroupsBefore`，否則用 `displayGroup??role`）；新增 `myRowMembers`/`otherRowMembers`/`myDisplayGroup`/`myRowW`/`otherRowW`；角色列改單排顯示 + 動畫時補顯緊湊他排

**踩坑提醒**：
- `displayGroupsBefore` 是 `aliveIds` 在 Step 5b **之前**快照，確保包含死亡前的分組
- `curRearDisplayCount` 要用 `members`（原始資料）而非 `memberUpd`（已有 patch 但尚未寫入），否則同一回合多人死亡時計數會不準
- 動畫期間 `dgOf` 讀 `liveEntry.displayGroupsBefore`，結束後 `liveEntry = null` → 自動切回 `m.displayGroup`，不需額外清理

---

## 2026-06-27（地下城隊員卡住修復 + 全員 ready 延遲 2 秒）

### DungeonBattleRoom.jsx — 兩個並發競速 Bug

**問題 1：非房主隊員卡住**
- 房主有 20 秒超時清除 `processing` flag，但非房主隊員若 Firestore 快照沒收到 flag 清除，會永遠停留在「等待中」
- **修復**：新增非房主專用 useEffect，監聽 `room.processing`；20 秒未解除 → 自動 `setSubmitted(false)` + 寫 Firestore 清除 `ready/arrows`，讓玩家重新輸入箭分

**問題 2：全員 ready 後瞬間結算（Firestore 快照尚未傳播到房主）**
- 最後一個玩家按送出 → 房主可能在其他成員快照更新前就跑 `handleProcess`
- **修復**：all-ready useEffect 改用 `allReadyTimerRef` 計時 2 秒再呼叫 `handleProcess`；若期間有人取消 ready，timer 即清除；若 timer 已在跑則不重新啟動（防重複）

**踩坑提醒**：
- `allReadyTimerRef` 宣告在 useEffect 同層（hook 頂層），不能放在 useEffect 內（違反 Hooks 規則）
- cleanup fn 在 React StrictMode 下可能被呼叫兩次，ref guard (`if (allReadyTimerRef.current)`) 防重複
- 非房主 reset 要同時清 Firestore 的 `ready` 和 `arrows`，否則 Firestore 仍顯示已送出

---

## 2026-06-27（Bug 修正 + 首頁/成就/怪物卡改版）

### Bug 1：商店購買記憶 + 藥水重購
- `dungeonDb.js`：`enterNonCombatRoom` / `resolveNonCombatRoom` 不再重置 `shopPurchases`
- `purchaseDungeonItem`：`hp_potion` 跳過記入 bought 清單 → 允許重複購買
- `DungeonShop.jsx`：本地 `bought` 也跳過 `hp_potion`

### Bug 2：進場動畫 + 樓層顯示
- `DungeonBattleRoom.jsx`：地圖模式用 `mapCurrentRoomId` 作動畫 key（而非 floor 始終不變）
- `dungeonDb.js`：`enterMapCombatRoom` 的 `currentFloor` 改從 `mapFloorIndex + 1` 計算

### Bug 3：今日箭數同步
- `DailyQuest.jsx`：改用 `subscribeTodayPracticeLogs`（Firestore 側限日期），排除 party/duel/dungeon source

### Bug 4：地下城事件效果驗證
- `dungeonDb.js`：新增 `def_mult_all` case（守護結界事件之前缺失）
- `dungeonData.js`：修正 `reversal` 合約的 `arrowBreakdown.push` 中 `dmg` → `dmg: d` 拼寫錯誤
- `DungeonBattleRoom.jsx`：`CONTRACT_HEX` 補上 reversal/odd_only/even_only 顏色

### Bug 5：成就通知系統
- `MemberDex.jsx`：
  - 成就 useEffect deps 補上 `monsterDex, craftStats, chestStats, potionDex, cardData`（原先缺失導致部分成就無法即時偵測）
  - `createNotification` 改為個人通知（`targetMemberId: profile.id`）而非全頻廣播，防止每次進頁就廣播
  - 通知 type 改為 `"achievement"`

### Bug 6：首頁等級卡改版（MemberHome.jsx）
- 移除 `bg-white/15` 個人資訊列（徽章總覽/賽事積分/月卡），改放到等級卡
- 名字旁加入公會等級 pill（`adventurerXP` + `levelFromXP`）
- 等級卡新增：地下城圖鑑/成就圖鑑/貓貓卡片收藏進度小格
- 月卡移入等級卡（月卡剩餘次數 + 申請按鈕）
- 移除「年度檢定摘要」與「最近成績」區塊
- 引入 `COLLECTIBLE_MAP` from dungeonCollectibles 計算地下城圖鑑總量

### Bug 7：怪物卡片改版（CardCollection.jsx）
- 改為條列式（`flex-col` 取代 `grid-cols-2`）
- 每列顯示：icon/名稱/階級/星數/加成 + 直接顯示「✨ 可升星」提示（inline，無需展開）
- 右側快速裝備/卸下按鈕（inline，無需展開）
- 展開只剩升星操作與 mythic 屬性選擇

### Bug 8：廣播訊息改版（MemberHome.jsx）
- 移除 `msg-scroll-bg.webp` 底圖，改為半透明深色背景
- 新增分類篩選：全部|優惠|重要|考證|成就|地下城|世界王|一般|掉寶
- 廣播文字顏色改為白色系（深色背景相容）

---

## 2026-06-27（地下城 + 組隊模式前後衛分排統一為 role-based）

### DungeonBattleRoom.jsx + PartyBattleRoom.jsx — role-based 分排顯示
- **變更前**：前排 = `memberList.slice(0,4)`，後排 = `memberList.slice(4)`（依加入順序，與 role 無關）
- **變更後**：
  ```
  rearRoleMembers   = memberList.filter(m => m.role === "rear")
  frontRoleMembers  = memberList.filter(m => m.role !== "rear")
  frontMembers = [...frontRoleMembers, ...rearRoleMembers.slice(4)]  // 後衛滿4時溢位到前排
  backMembers  = rearRoleMembers.slice(0, 4)                        // 最多4人後排
  ```
- **溢位後衛**：role="rear" 但後排已滿4人 → 顯示在前排格子，青色邊框（`rgba(20,184,166,0.4)`）區分
- **後排邊框**：改為青色（`#14b8a6` 系列），與前衛的紅色形成對比
- **排頭標籤**：有後排成員時顯示「⚔️ 前衛 / 🛡 後衛」小標（只在有後排時出現）
- **後排寬度**：地下城改用 `backW`（獨立計算，不再硬借 `frontW`）

### dungeonDb.js + partyDb.js — 攻擊順序統一前衛優先
```js
const orderedAliveIds = [
  ...frontIds.filter(id => aliveIds.includes(id)),
  ...rearIds.filter(id => aliveIds.includes(id)),
];
// 攻擊 pass 改用 orderedAliveIds（前衛先動，後衛後動）
```
- miniRounds 中前衛的攻擊動畫先播，後衛後播，再接怪物反擊
- 反擊仍只打 frontIds（後衛全程免疫，前衛全滅才打後衛）

**踩坑提醒**：
- `backW` 要獨立計算（`backMembers.length` 分母），地下城舊版錯用 `frontW` 導致後排卡片過寬

---

## 2026-06-27（組隊模式前後衛系統 + 怪物人數縮放）

### partyDb.js — 前後衛戰鬥邏輯
- **`submitArrows`**：新增 `role="front"|"rear"` 與 `rearChoice="heal"|"dmg"|null` 參數，每次送箭時寫入 Firestore
- **`processPartyRound` Step 1**：後衛選「攻擊」者，所有箭傷 ×0.5（arrowBreakdown 也同步縮放）
- **前後衛分類**：`frontIds`（role 未定義或 "front"）/ `rearIds`（role="rear"）
- **反擊邏輯**：只打存活 `frontIds`；前衛全滅時才打所有存活成員
- **後衛治癒**：選擇 "heal" → pool = 25% maxHP，均分給所有存活隊友（不含自己）
- **前衛復活機制**：前衛 HP 歸零 → 不立即陣亡，改為轉後衛 + 復活至 50% HP；後衛 HP 歸零才真正陣亡

### partyDb.js — 怪物人數縮放（補完）
- `genPartyHPMult` 改為確定性公式：`1.0 + (playerCount-1) * 0.5`（HP 每多一人 +50%）
- `startPartyBattle` 加入 `monAtkMult = 1+(N-1)*0.15`、`monDefMult = 1+(N-1)*0.15`、`rewardMult = 1+(N-1)*0.2`
- `rewardMult` 存入 Firestore room document，結算時讀取用

### PartyBattleRoom.jsx — 角色選擇 UI
- 計分前顯示「⚔️前衛 / 🛡後衛」選擇按鈕
- 選後衛後出現「💊治癒隊友 / ⚡協助攻擊」策略按鈕
- 後衛未選策略時送出按鈕鎖住（顯示「請先選擇後衛策略」）
- 新回合時從 Firestore 讀取 role（捕捉前衛轉後衛通知），否則重置為 "front"
- 玩家名牌顯示 ⚔️/🛡 角色標籤

**踩坑提醒**：
- `allPlayerData` 在 Step 1 即縮放，miniRounds 的 pairDmg 自動正確
- 前衛轉後衛由伺服器寫入 `role="rear"`，下回合 `useEffect([room?.round])` 讀取後更新本地 state

---

## 2026-06-27（地下城/組隊怪物人數縮放 + 後衛機制修正 + 等待室 Bug）

### dungeonDb.js — 後衛機制重設計
- 後衛傷害倍率：×1.5 → **×0.5**（後衛本應保護，不是輸出強化）
- 後衛治癒：原「自己回 25% HP」→ **25% maxHP pool 均分給存活隊友（不含自己）**
  - `receivedHeal` 物件累計，HP update 時套用

### dungeonDb.js — 怪物人數縮放
- `startDungeonBattle`：新增 `monHPMult = 1+(N-1)*0.5`、`monAtkMult = 1+(N-1)*0.15`、`monDefMult = 1+(N-1)*0.15`、`rewardMult = 1+(N-1)*0.2`
- 廢除 `memberAtkMult`（玩家 ATK 加成移除）

### DungeonLobby.jsx — 等待室卡死修復 + 按鈕並排
- **問題**：等待室按鈕被 `overflow-hidden` 截掉，無法點擊「開始地下城」
- **根因**：House 設定 `div` 用了 `shrink-0`，把 footer 推到視區外
- **修復**：將地下城設定移到 `flex-1 overflow-y-auto` 捲動區內；footer 改為 `flex gap-2`，「離開」與「開始」並排顯示

---

## 2026-06-27（地下城收藏品圖鑑全面重設計）

### dungeonCollectibles.js — 完整重寫（216 件）
- **規格**：6 族系 × (20 普通 + 10 稀有 + 5 首領 + 1 超稀有) = 216 件，加上原有 24 首殺限定
- **掉落邏輯**：
  - 普通怪物房 15%（原 10%）
  - 精英房 20% 稀有 + 25% 普通（原 35%+30%）
  - 寶箱房 15% 稀有 + 40% 普通（原 20%+50%）
  - Boss 房：`rollBossDrops(family, difficulty)` 回傳陣列，65% Boss 物品 + 難度依比超稀有（normal 1% / hard 2% / elite 3% / nightmare 5%）
- **API 變更**：`rollBossDrop` → `rollBossDrops`，回傳 `[{itemId}]` 陣列而非單一物件

### DungeonBattleRoom.jsx — 三處 Bug 修復
1. **family 偵測**：`room?.dungeonId` → `room?.mapDungeonId || room?.dungeonId`（地圖模式用 mapDungeonId）
2. **首殺 trophy**：同上，共三個地方（line ~500, ~506, ~893）全改為 mapDungeonId
3. **collectible → collectibles**：`claimLootRef.current` 改用陣列格式，UI 支援同時顯示多件掉落

### DungeonDex.jsx — 新增超稀有稀有度
- `RARITY_LABEL` / `RARITY_COLOR` 加入 `superRare`（金黃色 #fde047）
- `allFamilyItems` 加入 `tiers.superRare`

**踩坑提醒**：
- `rollBossDrops` 可能回傳空陣列（Boss 沒掉），UI 需做 length 判斷
- superRare 物品的 rarity 字串是 `"superRare"`（camelCase），RARITY_COLOR 也用同名 key

---

## 2026-06-27（地下城等待室重整持久化）

### 地下城等待室：重整後不再跳出
- **問題**：在等待室（DungeonLobby）重整後，用戶回到初始建立/加入畫面，失去等待室狀態
- **分析**：`dungeon-room` 頁面（戰鬥中）早已透過 `member_page` + `dungeon_room` 兩個 sessionStorage key 正確持久化；但等待室是 `page="dungeon"` + 無 roomId 記錄，重整後無法還原
- **修復**：`DungeonLobby.jsx` — 加入 `dungeon_waiting_room` sessionStorage key（`{roomId, isHost}`）：
  - `handleCreate` 成功後 → `setItem`
  - `handleJoinRoom` 成功後 → `setItem`；訂閱到 active/map_explore → `removeItem` 後跳轉
  - `handleStart`（房主開始）→ `removeItem` 後跳轉
  - 「離開等待室」按鈕 → `removeItem`
  - mount `useEffect`（`[myId]`）→ 讀取存檔、重新訂閱房間；房間已 active 則直接跳轉；房間不存在則清除存檔
- **坑**：恢復訂閱的 `sub` 變數在 callback 內用 `sub?.()` 取消，因 Firestore `onSnapshot` 同步回傳 unsub，callback 執行前 `sub` 已被賦值，安全

---

## 2026-06-27（地下城全面 bug 修復 — 透明度/卡死/投票/後排/合約顏色）

### 1. 地下城大廳透明度 & 底部導航遮擋
- **問題**：大廳背景太透明（無暗色疊層）、資訊框透明度過高可讀性差；等待室 `h-[100dvh]` 未計入底部導航高度，開始戰鬥按鈕被遮住
- **修復**：`DungeonLobby.jsx` — 背景加 `rgba(0,0,0,0.6)` 疊層；amber 資訊框 `/10→/20`、文字 `text-slate-300→200`；等待室外層 `h-[100dvh]→h-full`（正確填滿 MemberApp flex 容器）
- **8人支援**：`dungeonDb.js` `joinDungeonRoom` 限制 `>=4→>=8`

### 2. 地下城結算改為各自領取獎勵
- **問題**：打完首領後必須等房主按領取，隊員無法各自拿獎勵；且自動存檔 useEffect 和按鈕領取可能雙重加 XP
- **修復**：`DungeonBattleRoom.jsx` — 新增 `handleClaimSelf()` 每人點自己的按鈕領獎（金幣/寶箱/素材/圖鑑/XP/箭露/扭蛋幣/符文/收藏品）；移除舊 `handleClaim()`（房主代領）和自動存檔 `useEffect`；清除無用 `xpSavedRef`
- **坑**：`xpSavedRef` 是舊自動存檔的 guard，移除後記得也刪掉變數宣告

### 3. 投票顯示中文房間名 + 全員同意自動前進
- **問題**：投票文字顯示房間代碼（如 `f0c1r0`）而非中文名（如「幽暗走廊」）；全部人同意後仍要等 30 秒
- **修復**：`DungeonExplore.jsx` — `VoteOverlay` 接收 `floorData` prop，用 `proposal.targetRoomId` 查 `floorData.rooms[].label` 顯示中文名；自動結算條件從 `voteCount >= totalVotes`（全部投同一房）改為 `totalVoteCast >= totalVotes`（全部有投票即可），並補上 `onResolve` 到 useEffect deps 避免閉包過時

### 4. 後排角色卡完整顯示 + 玩家高亮
- **問題**：超過 4 人時後排角色只在戰鬥動畫期間短暫顯示，且資訊精簡（只有名字+HP條）
- **修復**：`DungeonBattleRoom.jsx` — `showBackRow` 條件改為 `backMembers.length > 0`（永遠顯示）；後排卡改用 `frontW` 寬度，加入完整資訊（角色圖像85px、前衛/後衛徽章、ATK/DEF、合約圖標、就緒狀態、跳過按鈕）；自己→金色邊框+光暈+頭像描邊；後衛→紫色邊框+光暈
- **後衛機制驗證**：`processDungeonRound`（`dungeonDb.js`）邏輯正確 — 治癒：傷害歸零+回合末回25%HP；攻擊：傷害×1.5倍；反擊只打前衛（`frontIds`），後衛完全免疫

### 5. 合約文字黑色看不見
- **問題**：進場關卡合約名稱在深色背景上顯示黑色，完全看不到
- **根因**：`CONTRACT_TYPES.color` 存的是 Tailwind class（如 `text-yellow-300`），但在 HUD 的 `BattleStatusTags` 中被當作 inline `color` 值使用，瀏覽器無法解析 → 預設黑色
- **修復**：`DungeonBattleRoom.jsx` — 加入 `CONTRACT_HEX` 映射表（`all_hit→#fde047` 等），HUD 改用 hex 色值

### 6. 地下城卡死全面修復（核心）
- **問題**：全員送出箭分後常卡住需重整；重整後無法輸入分數（按鈕沒反應）；房主強制重置按鈕不見或不 work
- **根因分析**：
  - `handleProcess` 無 try/finally — `processDungeonRound` 拋例外或 Firestore 超時時 `processingRef.current` 永遠卡在 `true`，阻擋所有後續結算嘗試
  - 重整後 `me.ready` 仍為 `true`，但本地 `submitted` 重置為 `false` — 玩家可看到輸入畫面但 Firestore 不認
  - 強制重置按鈕只出現在 `submitted===true` 時，房主重整後看不到
- **修復（`DungeonBattleRoom.jsx`）**：
  1. **try/finally**：`handleProcess` 的 `processDungeonRound` 呼叫包在 `try/catch/finally` 中，`finally` 保證重置 `processingRef.current=false` + `setLoading(false)`
  2. **重整自動同步**：新增 `useEffect`，當 `me.ready===true` 但本地 `submitted===false` 時自動寫 Firestore 清除 `ready` + `arrows`（用 `readySyncedRef` 確保只執行一次）
  3. **房主強制重置常駐**：HUD 區域新增 `position:fixed` 的 ⚙️ 強制重置按鈕，戰鬥中永遠可見（呼叫 `clearDungeonProcessing` 清除 Firestore `processing` flag）
  4. **重新輸入按鈕**：`submitted` 狀態下非房主可點「重新輸入」清掉 Firestore `ready/arrows` + 本地 `submitted`，重新輸入箭分
  5. **5秒安全網**：房主送出後若未全員 `ready`，5 秒後用 `roomRef.current`（最新 room 資料）重新檢查並強制結算（避免 Firestore 同步延遲造成的卡住）
- **坑**：fallback timeout 不能用 `handleProcess()`（閉包中的 `room` 已過時），必須用 `roomRef.current` 直接呼叫 `processDungeonRound`；`lastProcessedRef.current` 要先鎖定再解鎖，和 `handleProcess` 一致

---

## 2026-06-27（全系統深藍主題改造）

### 改造目標
全站（射手模式 + 教練模式 + 後台）從淺色背景改為深藍色主題，提升夜間使用舒適度與視覺一致性。貓貓村保留原始淺色風格不受影響。

### 架構設計
採用 **CSS specificity 三層分級**控制，不使用 `!important`（inline override 例外）：

| 層級 | 選擇器 | Specificity | 作用 |
|------|--------|-------------|------|
| Tailwind 原始值 | `.bg-white` | 0,1,0 | 預設樣式 |
| 深藍覆寫 | `.content-area .bg-white` | **0,2,0** | 子頁面變深藍 |
| 貓貓村保護 | `.content-area .no-override .bg-white` | **0,3,0** | 還原原始值 |

### 修改檔案

**`src/index.css`**
- 新增 CSS 變數（`--bg-deep: #0f172a`、`--bg-surface: #1e293b`、`--bg-card: #1e293b`、`--text-primary: #f1f5f9` 等）
- body 全域深藍背景 + 自訂滾動條
- **56 行 `.content-area` 覆寫**：背景（bg-white→#1e293b、bg-gray-50→#1e293b 等）、文字（text-gray-900→#f1f5f9、text-gray-600→#94a3b8 等）、邊框（border-gray-200→rgba(255,255,255,0.08)）、陰影
- **34 行 `.no-override` 重置**：完全還原 Tailwind 原始顏色保護貓貓村
- **Attribute selector + `!important` 層**：蓋掉後台 inline styles（`background:"white"` → `background:#1e293b !important`、`color:"#1e293b"` → `color:#f1f5f9 !important`），因為 inline style 優先級高於 CSS class

**`src/pages/MemberApp.jsx`**
- 頁面內容區加入 `className="content-area"`
- 貓貓村用 `<div className="no-override">` 包裹
- 底部導覽列：白底黑字 → `#0f172a` 深藍 + `#94a3b8` 淺灰文字（active 用 `#60a5fa` 藍高亮、`#f59e0b` 金色指示條）
- 小紅點邊框：白 → `#0f172a` 無縫融入

**`src/pages/AdminApp.jsx`**
- **射手模式容器**：`#f8fafc` 淺灰 → `#0f172a` 深藍，改為 `height:100dvh` flex 布局
- **後台容器**：`#f8fafc` → `#0f172a`
- **後台 Header**：白底黑字 → 深藍漸層 `#0f172a→#0c4a6e` + 淺色文字
- **兩個模式的底部導覽列**：白底 → 深藍 + 淺色文字
- **Hub 卡片**：白底 → `#1e293b`，深色標題 → `#f1f5f9`
- 頁面內容區加入 `className="content-area"`

### 踩坑提醒
1. **CSS class 無法蓋掉 inline style**：`BillingSystem.jsx` 用 `background:"white"` inline 語法，CSS `.bg-white` 覆寫完全無效 → 改用 `[style*="background: white"] { background: #1e293b !important; }` attribute selector
2. **`unset` 會讓背景變透明**：初始 `.no-override` 用 `background-color: unset` → 貓貓村白底變透明 → 改為顯式指定 `background-color: #fff` 才能正確還原
3. **`!important` 是必要之惡**：只用在 inline override 層（attribute selector），class-based 覆寫全不用 `!important`

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Fchangelog`

---

## 2026-07-14（世界王噴地下城 + 3 槽固定顯示 + 後台測試工具簡化）

### 改了什麼

**功能 A：世界王擊殺掉落地下城**
- `dungeonExcavation.js`：新增 `grantWorldBossDungeon(memberId)` — 隨機挑選 6 族 + 難度 2~4（稀有~強悍），標記 `fromWorldBoss: true`，寫入 `savedDungeons`（max 3 自動跳過）
- `worldBossDb.js` `distributeWorldBossRewards`：擊殺獎勵 loop 中對每位真實參與者（不含訪客）呼叫 `grantWorldBossDungeon`，放在 `rewardDistributed` 標記前（失敗可重試）

**功能 B：🌍 世界王掉落標示 UI**
- `DungeonStorageTab.jsx`：已保存卡片旁邊顯示 🌍 世界王掉落（橘色 #fb923c）badge
- `DungeonSelectionPanel.jsx`：資訊卡 + 確認 overlay 兩處都顯示該 badge

**功能 C：3 槽固定顯示**
- `DungeonStorageTab.jsx`：改為固定 3 槽卡片設計（`Array.from({length:3}).map`），空格顯示 🕳️ 空槽 placeholder，已滿顯示族系卡片

**功能 D：後台測試工具簡化**
- `AdminDungeon.jsx`：移除地下城次數重置功能（`resetDungeonUsed`/`resetAllDungeonUsed` import、`busy`/`showReset`/`loading` state、`handleResetOne`/`handleResetAll`、重置 JSX 區塊）
- 現在專注於：挑玩家 → 選種族/難度 → 存入選單 → 檢視/刪除槽位

### 為什麼
- 世界王擊殺後缺乏實質獎勵，掉落地下城讓參與者有長期目標
- 儲存槽固定 3 格視覺化，空槽可視讓玩家知道還有空間
- 地下城已無每日次數限制（改為挖掘進度制），重置功能不再需要

### 踩坑提醒
- `grantWorldBossDungeon` 和 `adminSetSavedDungeon` 共享 ~80% 邏輯（讀取→檢查→寫入），若有更多「幫玩家加地下城」函式出現，建議萃取 `_pushSavedDungeon(memberId, entry)` 共用 helper
- 世界王掉落只發給真實參與者（`!isGuest`），訪客無此獎勵

---

## 2026-07-14（地下城選單系統 + 組隊遠征 + Phase E 獎勵結算）

### 改了什麼

**功能 A：地下城選單系統（儲存槽 + 選擇面板）**
- `dungeonExcavation.js`：新增 `saveExcavation(memberId)` — 揭曉時保存到 `savedDungeons` 陣列（最多 3 個）；`removeSavedDungeon` / `getSavedDungeons`
- `DungeonExcavationTab.jsx`：揭曉後改為「📦 保存到地下城選單」，滿 3 個時紅字提示並禁用挖掘
- `DungeonStorageTab.jsx`（新）：即時訂閱已保存地下城清單（族系 emoji + 難度徽章 + 隱藏標記），支援單個移除
- `DungeonSelectionPanel.jsx`（新）：選定地下城後顯示單人確認 overlay / 組隊探索入口
- `DungeonLobby.jsx`：分頁改為「⛏️ 挖掘探索 | 🗺️ 進入地下城 | 🔮 圖鑑」，加入地下城面板含「加入地下城」入口
- `DungeonExpedition.jsx`：支援 `fromStorage` 標記，啟動時自動釋放槽位

**功能 B：組隊遠征系統（建立房間 + 等待 + 加入）**
- `expeditionTeamDb.js`（新）：Firestore 操作層 — `createTeamExpeditionRoom`（含地下城資訊）、`joinTeamExpeditionRoom`（6 碼邀請碼）、`subscribeOpenTeamExpeditionRooms`（開放房間列表）、`disbandTeamExpeditionRoom` / `cleanupTeamExpeditionRoom`
- `DungeonTeamLobby.jsx`（新）：等待室 — 地下城資訊卡 + 隊員清單（最多 4 人）+ 房主可複製邀請碼 + 「開始遠征」/「解散」按鈕；成員顯示「等待房主」+「離開」
- 路由整合至 `DungeonLobby.jsx`：選地城→組隊→建立房間→分享邀請碼→夥伴輸入代碼或從開放列表加入→房主開始
- 加入地下城分頁：輸入邀請碼 + 顯示開放中房間列表

**功能 C（Phase E）：遠征獎勵結算 + 紀錄保存**
- `expeditionDb.js`：新增 `calculateExpeditionRewards`（6 級難度獎勵表金幣/箭露/XP）、`saveExpeditionRecord`（最多保留 20 筆）、`grantExpeditionRewards`（Firestore increment）
- `DungeonExpeditionResult.jsx`（新）：三階段進場動畫 + 成功/失敗配色 + 獎勵明細 + 「🎊 領取獎勵」按鈕
- `DungeonExpedition.jsx`：追蹤 `floorsCleared` 和 `wonLast`，完成/失敗統一顯示結算畫面，領取時自動發放獎勵 + 儲存紀錄 + 重置挖掘
- 清理：移除無用 `ExpeditionFailed` 元件、`resultRewards` state、`showRewards` state；恢復 `broadcastExpeditionFailure` 失敗廣播

### 為什麼
- 原本地下城挖掘後直接進入遠征，缺乏選單管理與組隊功能
- 玩家需要能儲存多個地下城、選擇何時出發、與夥伴組隊
- Phase E 補齊獎勵回饋閉環（打怪→獎勵→紀錄），讓遠征有完整結束感

### 踩坑提醒
- `saveExcavation` 最多存 3 個，滿時 Disable 挖掘（`storageFull` 狀態驅動）
- 組隊遠征使用 6 碼代碼加入，與舊 `dungeonDb` 的代碼空間不衝突
- `DungeonExpedition` mount 時自動 `removeSavedDungeon` 釋放槽位
- `broadcastExpeditionFailure` 仍在 `handleBattleDone` 失敗分支中呼叫（`useCallback` 加入 `profile` 依賴）
- `floorsCleared` 計算：改用 `floorIndex`（0-based）而非 `Math.max(1, floorIndex)`，更精確

---

## 2026-07-14（地下城終戰模式設計定稿）

### 設計完成

地下城全新模式定稿，記錄於 Trellis task `07-14-dungeon-expedition` 的 `prd.md`。

**核心機制**：
- 發掘進度（登入+10、報到+10、每箭+0.3）→ 100% 時手動揭曉
- 金幣強化（隨機 500~2000 強化一級）
- 三層固定結構（探索層→戰鬥層→王關層）
- 六級難度 × 七族（含寶箱族）
- 混種怪物（每層從六族隨機抽不同種）
- 失敗處理：已獲獎勵不收回，進度歸零＋全區廣播

### 第二大腦更新
- `features.md`：新增地下城終戰模式條目
- `quick-ref.md`：新增發掘進度 / 寶箱族 / 難度表速查

---

## 2026-07-14（Phase C：難度擴增 4→6 級 + 混種抽怪 + 寶箱族資料）

### 改了什麼

**Phase C** 為地下城終戰模式建立資料基礎，涵蓋 Trellis task `07-14-dungeon-expedition` 的 Phase C。

**`src/lib/monsterData.js`**
- `FAMILIES` 新增第 7 族 `treasure`（寶箱族 📦）
- 新增 6 隻寶箱怪（寶箱怪 → 神話寶箱巨像，設計為高防低攻型）
- 新增 `drawMixedMonsterPool(count, variant, tier)` — 從六族隨機抽不同種怪物
- 新增 `drawFloorMonsters(floorIndex, difficultyTier)` — 依三層結構生成怪物組合

**`src/lib/monsterRegistry.js`**
- `FAMILY_LOOT` 新增 `treasure` 族掉落表（金幣 ×5、高寶箱率、專屬收藏品）

**`src/lib/dungeonData.js`**
- `EXCAVATION_DIFFICULTIES` — 6 級難度（普通級→神話級，對應 monster tier 1-6）
- `EXCAVATION_FLOOR_CONFIG` — 三層房間類型權重定義（第1層探索/第2層戰鬥/第3層王關）
- `MIXED_FAMILY_WEIGHTS` — 六族均等權重
- `UPGRADE_COIN_RANGE` — 強化金幣 500~2000 隨機
- `EXCAVATION_RARITY_WEIGHTS` — 稀有度骰子權重（依練箭量調整）

**`src/components/dungeon/DungeonTreasureRoom.jsx`** — NEW
- 寶箱族獎勵房元件：金幣噴泉、材料卡、寶箱、收藏品、箭露
- 四階段動畫（enter → fountain → loot → done）
- 使用 `rollBattleLoot` 生成獎勵（金幣 ×5 加成）

### 踩坑提醒
- `drawFloorMonsters` 每次呼叫生成隨機怪物，Phase D 需用 `useMemo` 或 state 快取結果
- 寶箱族怪物掉落的 `rollBattleLoot` 使用 `COIN_RANGE[treasureMonster.tier]`，tier 字串映射需與 `monsterData.js` 的 `TIER_ORDER` 一致

---

## 2026-06-27（修正 Boss 通關 React crash）

### Bug：Boss 結算畫面 `TIER_LABEL` 物件當 React child
- **Bug**：首領通關後畫面卡住並噴 `Error #31: object with keys {label, color, bg}`，且連帶導致組隊模式也無法開房
- **根因**：`DungeonBattleRoom.jsx` Boss 結算畫面中 `{TIER_LABEL[room.monster.tier] || room.monster.tier}` — `TIER_LABEL[tier]` 回傳的是 `{label, color, bg}` 整個物件，React 無法渲染物件 → 擲回 Error #31 → 整個 React 樹掛掉 → 所有依賴同一個 App 殼的頁面都無法運作
- **修復**：改為 `{TIER_LABEL[room.monster.tier]?.label || room.monster.tier}`（只取 label 字串）
- **坑記錄**：HUD 區的 TIER_LABEL 使用模式正確（`const tl = TIER_LABEL[...]; ...tl.label`），但 Boss 結算區直接用 `TIER_LABEL[...]` 作為 JSX child，兩處不一致導致漏修

---

## 2026-06-27（地下城任務類型重設計 + 商店/事件清理 + 方型地圖）

### 任務類型 6→9 種
- **新增 3 種**：`reversal`（逆轉關：6↔X, 7↔10, 8↔9 分數映射）、`odd_only`（單數關：只算 7/9/X）、`even_only`（雙數關：只算 6/8/10）
- **`assignContracts`/`rerollContract`** 參數改為 `x_crit` 6~10、`target_score` 20~50
- **`calcDungeonContractDmg`**：加入 reversal 分數映射邏輯、odd_only/even_only 過濾、target_score 總分門檻檢查（6箭總分 > param 才有傷害）
- **`getContractBadge`**：新增 reversal(橘)/odd_only(青)/even_only(粉) badge

### 商店清理（DUNGEON_SHOP_ITEMS 5→8 項）
- **移除**：`contract_reset`（契約重置）、`rune_repair`（符文修復石）— 功能不需要
- **新增**：`hp_max_boost`（HP上限+30%）、`atk_large`（ATK×1.5）、`def_large`（DEF×1.5）、`revival_front`（前衛復活藥）
- **`dungeonDb.js` `purchaseDungeonItem`**：移除 contract_reset / rune_repair case
- **`DungeonShop.jsx` `SHOP_ITEM_META`**：同步移除對應定義

### 隨機事件豐富化（DUNGEON_EVENTS 10→18 項）
- **移除**：`scroll`（古老卷軸）、`contract_swap`（契約轉換）
- **新增精細級距事件**：`cursed_spray`（ATK×0.7 重度）、`blessed_wind`（ATK×1.2 強化）、`fairy_blessing`（回40%HP）、`dark_ritual`（單人ATK×0.5）、`golden_fountain`（80金幣）、`time_warp` / `sleepy_dust`（怪物不反擊）、`defense_boost`（DEF×1.5）、`wish_well`（單人ATK×2）

### 地圖方形房間改造
- **`DungeonMap.jsx` 完整重寫**：圓形節點 → SVG 方形房間（`<rect>` 圓角矩形），加入斜線網底（未探索）、發光濾鏡（當前房間）、脈衝外框（可移動）、房間標籤+合約 badge
- **`DungeonLobby.jsx` 選擇畫面加大**：難度按鈕 `flex` → `grid-cols-2` 大按鈕、地下城卡片放大（`py-5 px-4`）、加入樓層 badge + 地圖序號

### 修正 reversal 關
- 分數映射：6↔X(11), 7↔10, 8↔9 後走正常傷害公式，非特殊爆擊規則

**踩坑提醒**：
- `target_score` 的 CONTRACT_TYPES desc 需保持與 spec 一致（超越分數關：總分門檻）
- calcDungeonContractDmg 的 reversal 是分數映射而非特殊 crit/miss 規則

---

## 2026-06-27（組隊開房自動清除舊房間）

### 新增：createPartyRoom 自動清除該使用者的舊 waiting 房間
- **為什麼**：前次 React crash 後舊房間殘留在「waiting」狀態，導致使用者無法新建房間
- **改了什麼**：`partyDb.js` `createPartyRoom` 開頭加入查詢該 hostId + status=waiting 的舊房間，`deleteDoc` 全部清除後再建立新房間
- **坑記錄**：如果 dungeon room 也有相同問題，可到 `dungeonDb.js` 的 `createDungeonRoom` 加入相同邏輯

---

## 2026-06-27（地下城地圖模式成員復活 Bug 修復）

### 地下城組隊：跨房間死亡 Bug（`enterMapCombatRoom` 未重置 alive）
- **Bug**：玩家在地圖模式某個戰鬥房間死亡（alive=false），進入下一個房間後仍保持死亡狀態，永遠被排除在戰鬥之外（表現為「被踢掉」）
- **根因**：`enterMapCombatRoom` 沒有像 `startDungeonFloor` 一樣重置 `alive=true`
- **修復**：`dungeonDb.js` `enterMapCombatRoom` 的 member 更新迴圈中加入：
  - `revived: false`（每間房間重置復活旗標，讓復活符重新生效）
  - 若 `!m.alive`：`alive=true` + `hp = max(1, maxHP*0.3)`（以 30% HP 復活）
- **坑記錄**：`startDungeonFloor`（舊地下城模式）有重置 alive，但地圖模式的 `enterMapCombatRoom` 是後來寫的，漏掉了這個重置

---

## 2026-06-27（遠征隊 3 槽 + 遠征獎勵重構 + 村莊三修）

### 遠征隊：3 槽位同時派遣
- **Firestore 欄位**：`members/{id}.expedition`（舊，單一）→ `members/{id}.expeditions.{0|1|2}`（新，map）
- `db.js`：`startExpedition(memberId, slotIdx, ...)` / `collectExpedition(memberId, slotIdx, ...)` 加 `slotIdx` 參數
- `ExpeditionPanel.jsx` 全量重寫：頂部 3 張槽位卡片（空置/進行中/完成）；點空槽展開派遣表單；已在遠征的貓不出現在選貓清單
- 向後兼容：若 `expeditions` 為空但存在舊 `expedition`，UI 自動顯示為 slot 0
- **坑**：Firestore map 更新用 `expeditions.${slotIdx}` 路徑，不能用陣列 index 更新

### 遠征獎勵重構
- `expeditionData.js`：各 T 加入建築材料（ore/melon/fish/meat/driedfish/can），覆蓋 T1-T5
- 稀有獎勵統一 **30% 機率**（T1 arrowdew 5-10 / T2 5-15 / T3 10-30 / T4 15-50 / T5 25-75；扭蛋幣 T1 1 / T2 1-2 / T3 1-3 / T4 1-4 / T5 1-5）
- 倍率從 `catLevelMult(catLevel)` 改為 `catPowerMult(catATK)`
  - `calcCatFullStats(catData)` 純函式：鏡像 useCatCompanion 計算（類型基底+等級+裝備+羈絆）→ 放在 `expeditionData.js` 避免 lib→hook 反向引用
  - `catPowerMult(catATK) = min(3.0, max(1.0, 1 + (atk-10)/100))`：攻擊型貓、高裝備、高羈絆天然得更高獎勵倍率
- `calcExpeditionRewards(tier, catData)` 接收完整 catData（不再只傳 catLevel）
- `handleCollect` 傳 `myCats[exp.catId]`（完整物件）

### 貓貓村三項修正
1. **扭蛋幣小數**：ResourceRow 改 `Math.floor(gachaCoins || 0)`
2. **市集掛賣到期**：`listCardForSale` 寫入 `expiredAt`（+7天）；`subscribeCardMarket` 客戶端過濾過期；UI 顯示「⏳ N天後下架」（1天內紅字警告）
3. **賣家售出通知**：`buyCardListing` 成交後 `createNotification({ targetMemberId: listing.sellerId, type:"market_sale" })`

---

## 2026-06-27（地下城收藏品 + 入口房修正）

### 地下城收藏品系統（全新）
- `src/lib/dungeonCollectibles.js`（新建）：6族系 × 7件 = 42普通 + 24首殺限定 = 66件
- `src/lib/dungeonDb.js`：新增 `addCollectible / addCollectibles / subscribeCollectibles`
- DungeonBattleRoom 結算：Boss 必掉 boss 族系收藏品；普通/精英/寶箱房依機率掉；首殺額外掉限定品
- `src/components/dungeon/DungeonDex.jsx`（新建）：圖鑑元件，進度條 + 族系篩選 + 首殺限定切換
- DungeonLobby：加第三個 Tab「🔮 圖鑑」

### 地下城入口房修正
- `dungeonData.js`：入口格 (0,0) 改為 `entrance` 類型（不再是 monster），`ROOM_TYPE_META` 補 entrance 定義
- 樓梯改放 `row≥1` 隨機位置，避免跟入口同行
- `DungeonExplore.jsx`：entrance 房靜默通過（自動清除），已清除房再次踩不觸發（商人除外）

### Firestore 欄位
- `members/{id}.dungeonCollectibles = { [itemId]: qty }` （increment，不需額外規則）

---

## 2026-06-27（符文系統 + 貓咪修正 + 世界王 + 報到修復）

### 符文系統（地下城專屬）
- `src/lib/runeData.js`（新建）：13類型 × 4階段 = 52種符文，`calcRuneBonus()` 計算加成
- `src/lib/runeDb.js`（新建）：Firestore 操作（getRuneInventory, addRune, equipRunesToDungeon）
- DungeonLobby 等待室加入符文槽 UI，開始時套用 ATK/DEF/HP 加成
- DungeonBattleRoom Boss 通關後掉符文，金幣/XP 獎勵套符文倍數
- Firestore：`members/{id}.runeInventory`、`dungeonRooms/{id}.memberRunes.{memberId}`

### 貓咪系統
- **羈絆每級連續加成**：攻/防型 `+5%/Lv`，全能型 `+2.5%/Lv`（移除 Lv5/Lv10 里程碑制）
- 移除 CatCollection.jsx 手動類型選擇器，改顯示 `CAT_TYPE_MAP` 固定類型
- 修正 PartyBattleRoom catOverlayCats 中 catId 錯誤取了 archerStyle

### 世界王
- `simulateBotRound(bot, bossAtk, bossDef, playerAtk=80)` — 機器人 ATK 改用玩家實際數值

### 報到修復
- rejected 狀態可重新報到：`submitCheckin` 允許覆蓋、按鈕改為「🔄 重新報到」

---

## 2026-06-26（24 地下城 + 首殺系統 + 成就 + 全系統公告）

### 核心設計
- **24 個地下城**（6族 × 4難度），從舊版 `shadow-crypt` 原型升級為完整地下城矩陣
- **首殺系統**：Boss 房通關 → 寫入 `dungeonFirstClears/{dungeonId}`（Firestore），紀錄保持一年後重整，首殺 host 獲得 `dungeonFirstKills` 陣列條目
- **成就圖鑑**：新增「地下城」類別 + 11 個成就（首通關 / 累積次數 / 各難度全族 / 地獄勇者 / 首殺英雄 / 征服者）
- **全系統公告**：首殺後寫入 `systemBroadcasts`，MemberApp + AdminApp 訂閱 30 分鐘內播報，顯示橫幅 toast

### 難度設計
| 難度 | 層數 | 怪物 Tier | Boss Modifier |
|------|------|-----------|---------------|
| 普通 | 2層  | T1-T2     | HP×1.5, ATK×1.5, DEF×1.5 |
| 進階 | 3層  | T3-T4     | HP×1.5, ATK×1.2, DEF×1.2 |
| 困難 | 3層  | T4-T5     | HP×1.4 only |
| 地獄 | 4層  | T5-T6     | 無（原始數值）|

### Tier 映射（mapRoomTier 1→6）
`common / rare / elite / fierce / boss / mythic`

### Firestore 新 Collections
- `dungeonFirstClears/{dungeonId}` — 首殺紀錄（memberId, memberName, clearedAt, teamNames...）
- `systemBroadcasts/{id}` — 全系統播報（type, dungeonId, dungeonName, memberName...）
- `members/{id}.dungeonClearLog.${dungeonId}.{count,lastAt}` — 個人通關記錄
- `members/{id}.dungeonFirstKills[]` — 首殺地下城 ID 陣列（用於成就）

⚠️ **注意**：`dungeonFirstClears` 與 `systemBroadcasts` 需在 Firebase Console 手動新增 Firestore 安全規則：
```
match /dungeonFirstClears/{id} { allow read, write: if request.auth != null; }
match /systemBroadcasts/{id} { allow read: if request.auth != null; allow write: if request.auth != null; }
```

### 修改檔案
- `src/lib/dungeonData.js`：DUNGEON_MAPS 改為 24 個，新增 `DIFFICULTY_CONFIGS`、`FAMILY_CONFIGS` exports，4 個 floor 模板函式
- `src/lib/dungeonDb.js`：新增 6 個函式（`trySetDungeonFirstClear`, `getDungeonFirstClear`, `updateMemberDungeonLog`, `addMemberFirstKill`, `publishDungeonFirstKill`, `subscribeLatestBroadcast`）
- `src/lib/achievementDex.js`：新增 dungeon 類別 + 11 個成就
- `src/components/dungeon/DungeonExplore.jsx`：`mapRoomTier` 支援 tier 1-6
- `src/components/dungeon/DungeonLobby.jsx`：難度 tab + 六族 2×3 格子選單
- `src/components/dungeon/DungeonBattleRoom.jsx`：handleClaim 加入 Boss 房偵測、首殺邏輯、首殺橫幅 overlay
- `src/pages/MemberApp.jsx` / `AdminApp.jsx`：訂閱 `subscribeLatestBroadcast` 顯示首殺橫幅

### 踩坑
- `setFirstKillData(killMeta)` 是非同步的，同一個 handleClaim 函式內不能用 `if (!firstKillData)` 判斷——改用 `wasFirstKill` local 變數
- 管理員 AdminApp 已加 `useRef` import，不需重複加

---

## 2026-06-26（地下城地圖探索模式 Phase 1-3 完整實作）

### 核心設計
地下城模式全面重設計：從「單調樓層」改為「SVG 地圖探索 → 戰鬥 → 返回地圖」循環。

### 新增檔案
- `src/lib/dungeonData.js`：`DUNGEON_MAPS`（幽冥地窖 3 層 24 房）、`ROOM_TYPE_META`（10 種房型）、`getReachableRooms`、合約標籤 helpers
- `src/lib/runeData.js`：7 種符文（復活/強攻/守護/貓靈/暴烈/生命 + 多重復活），3 個稀有度
- `src/components/dungeon/DungeonController.jsx`：根據 Firestore `status` 路由（map_explore→DungeonExplore，active/completed→DungeonBattleRoom）
- `src/components/dungeon/DungeonMap.jsx`：SVG 地圖，5 種節點狀態（未探索黑底問號、已探索彩色、當前金框、可移動脈衝動畫、已清除打勾）
- `src/components/dungeon/DungeonExplore.jsx`：探索 UI + 投票系統 + 前後衛/符文多步驟選擇 modal

### 修改檔案
- `dungeonDb.js`：新增 `initDungeonMapRun`、`saveMapExploration`、`proposeMapMove`、`castMapVote`、`resolveMapVote`、`advanceMapFloor`、`enterMapCombatRoom`（含怪物+陣型+符文注入）、`returnToMapAfterBattle`
- `DungeonBattleRoom.jsx`：加 `isMapMode/onReturnToMap` props；地圖模式 win 畫面顯示「房間通關！」，host 領獎後呼叫 `returnToMapAfterBattle`，Firestore 訂閱自動路由回地圖
- `DungeonLobby.jsx`：新增「地圖探索 / 經典樓層」切換 + 地下城選擇 UI
- `MemberApp.jsx`：DungeonBattleRoom → DungeonController

### 踩坑記錄
- `enterMapCombatRoom` 未設 `totalFloors`，`processDungeonRound` defaults 到 7 → 殺怪進 `path_select` 而非 `completed`；修正：明確設 `totalFloors:1, currentFloor:1`
- DungeonExplore 早期版本含巢狀 DungeonBattleRoom，與 DungeonController 路由衝突；已移除，改由 Firestore status 驅動路由
- `returnToMapAfterBattle` 後不需要呼叫 `onReturnToMap?.()`，Firestore 訂閱自動觸發 DungeonController 重渲染

### 待做（Phase 4+）
- 前後衛傷害規則（前衛全傷/後衛 -30%）接入 `processDungeonRound`
- 後衛每回合「攻擊 vs 治療」選擇 UI（DungeonBattleRoom）
- 非 host 成員的陣型/符文選擇（DungeonBattleRoom 進場前 modal）
- 掉寶清單（dungeonLoot.js）
- 通關結算通知（通知中心）

---

## 2026-06-26（UI 一致性修復 — 組隊死亡動畫 + 地下城HP條 + 世界王CatMsg/CatRoundOverlay）

### 組隊打怪怪物死亡畫面增強
**為什麼**：組隊打死怪物後只有一個單調的黃底文字畫面，遠不如打怪模式的華麗擊殺動畫，玩家感受落差大。
**改了什麼**：`PartyBattleRoom.jsx` `pending_confirm` 區段：
- 加入 `pbr-die-*` CSS keyframes（怪物變黑白+發光 → 討伐印章彈出 → 討伐成功文字 → 戰績統計）
- 使用 `PartyMonsterImg` 顯示怪物大圖 + 擊殺濾鏡動畫
- 新增「討伐」印章 overlay（旋轉彈入，半透明黑底紅字）
- 新增戰績統計三欄：最終傷害 / 回合數 / 參戰人數
- 確認按鈕加入金色發光陰影 `boxShadow` 和進場動畫
- `disabled` 狀態補上 `pointerEvents: none` 防止雙擊
**踩坑提醒**：`pbr-die-*` 前綴避免與打怪模式的 `mb-*` 動畫命名衝突。

### 地下城怪物 HP 條統一
**為什麼**：地下城的 HP 條高度（16px）與打怪/組隊（21px）不一致，邊框顏色也不同。
**改了什麼**：`DungeonBattleRoom.jsx`：`height: 16` → `height: 21`、邊框統一 `1.5px solid #7f1d1d`、背景 `#1e293b`、圓角 20。

### 世界王 CatMsg 改用共享元件
**為什麼**：`WorldBossAttack.jsx` 自定義了一個 `CatMsg` 本地元件，與 `cat/CatMsg` 共享元件功能相同但樣式不同。
**改了什麼**：
- 移除本地 `CatMsg` 函式定義
- 加入 `import CatMsg from "../cat/CatMsg"` 使用共享元件

### 世界王加入貓咪回合視覺覆蓋（CatRoundOverlay）

---

## 2026-06-26（SharedBattleComponents 共用元件庫 — HP條/箭槽/分數按鈕/狀態標籤）

### 建立共用元件庫
**為什麼**：MonsterBattle、PartyBattleRoom、DungeonBattleRoom、WorldBossAttack 四個戰鬥模式各自實作了怪物 HP 條、箭槽、分數按鈕、狀態標籤，程式碼高度重複（每組約 20~40 行），且樣式細節有微小差異。
**改了什麼**：
- 新增 `src/components/shared/SharedBattleComponents.jsx`，包含 4 個元件：
  - **`BattleHPBar`** — 怪物 HP 條（支援 height/21px、showBorder、label、compact 模式）
  - **`BattleArrowSlots`** — 箭槽顯示（支援 slotSize/26~36px、highlightNext、processing 箭號高亮、extraContent 自訂按鈕）
  - **`BattleScoreButtons`** — 分數按鈕（支援三種 variant：`image`/`minimal`/`tailwind`，btnSize）
  - **`BattleStatusTags`** — 狀態標籤列（支援自訂 tags 陣列）
- 修改 4 個檔案導入共用元件：
  - `MonsterBattle.jsx` — HP條→BattleHPBar，狀態標籤→BattleStatusTags，箭槽→BattleArrowSlots，分數按鈕→BattleScoreButtons
  - `PartyBattleRoom.jsx` — 同上
  - `DungeonBattleRoom.jsx` — 同上（分數按鈕使用 tailwind variant）
  - `WorldBossAttack.jsx` — HP條→BattleHPBar(compact模式)，箭槽→BattleArrowSlots，分數按鈕→BattleScoreButtons
**踩坑提醒**：
- WorldBossAttack 箭槽需要傳 `processingIdx` 才能正確顯示逐箭處理動畫
- tailwind variant 的分數按鈕直接用 `SCORE_COLORS` class 陣列，以保持 DungeonBattleRoom 現有風格
- import 路徑 `../shared/SharedBattleComponents` — 注意是從各戰鬥模式的目錄相對路徑

### 世界王加入貓咪回合視覺覆蓋（CatRoundOverlay）
**為什麼**：世界王有貓貓每回合攻擊輸出，但完全沒有視覺回饋。
**改了什麼**：`WorldBossAttack.jsx`：
- 加入 `import CatRoundOverlay` 和狀態變數（`showCatRound`、`catRoundCats`、`catRoundTotalDmg`）
- 戰鬥階段 JSX 中渲染 `<CatRoundOverlay>`
- 貓貓攻擊後設定 overlay 資料並顯示 1800ms

---

## 2026-06-26（結算畫面共用元件 — BattleResultHeader/StatCard/StatRow/RewardItem）

### 新增結算畫面共用元件
**為什麼**：4 個戰鬥模式的結算畫面各自實作，標題區塊、統計卡片、獎勵列表的視覺風格不一致。
**改了什麼**：
- `SharedBattleComponents.jsx` 新增：
  - **`BattleResultHeader`** — 結果標題（emoji + title + subtitle，5 種主題色，內嵌 result-pop 動畫）
  - **`BattleStatCard`** — 卡片式統計（icon + label + value，支援 highlight）
  - **`BattleStatRow`** — 列式統計（icon + label + value，支援 borderTop）
  - **`BattleRewardItem`** — 獎勵品項（icon + name + desc + tier badge）
- 修改 4 個戰鬥模式：
  - `MonsterBattle.jsx` — 戰績統計區 → `BattleStatCard`
  - `PartyBattleRoom.jsx` — 結算標題 → `BattleResultHeader`
  - `WorldBossAttack.jsx` — 標題/戰鬥報告/獎勵 → `BattleResultHeader` + `BattleStatRow`
  - `DuelRoom.jsx` — 結果大字/個人統計 → `BattleResultHeader` + `BattleStatCard`
**踩坑提醒**：`result-pop` keyframe 內嵌在共用元件；DungeonBattleRoom 因即將大更新暫跳過。

---

## 2026-06-26（第 4~5 輪：總射箭里程 + 首頁重整 + 教練射手模式統一 + 全部遺漏修復）

### 總射箭里程系統
**為什麼**：首頁等級卡缺少長期成長回饋，射手想知道自己總共射了多少箭。
**改了什麼**：
- `db.js`：`addPracticeLog` 自動累計 `totalArrowsAllTime`（increment）
- `MemberHome.jsx`：等級卡新增「🏹 總射箭里程」里程碑進度條（100→500→1000→5000→10000→50000 箭）

### 首頁重整 Part 1：徽章精簡 + 貓貓等級加入
**為什麼**：首頁與「我的」重複區塊過多；射手等級卡沒有貓貓資訊。
**改了什麼**：
- `MemberHome.jsx`：
  - 射手狀態卡徽章三色從完整展開（3 行）改為一行「🐱 ⭐ 🏆」總數摘要
  - 等級卡加入完整貓夥伴資訊（頭像/名稱/類型/等級XP/羈絆/技能群組/裝備加成）
  - 清理未使用的 `BadgePip` import

### 教練射手模式統一（AdminApp archerMode）
**為什麼**：教練切換射手模式時，介面仍用固定深藍色 Header，缺少報到視窗、主題色、今日箭數等。
**改了什麼**：
- `AdminApp.jsx`：
  - Import：加入 `subscribeTodayPracticeLogs / subscribeMyCheckin / submitCheckin`
  - 狀態：`todayArrowsGlobal / todayCheckin / showCheckinPopup / checkinBusy / checkinPopupShownRef`
  - Effects：報到訂閱（首次進入自動彈窗）+ 今日箭數訂閱
  - Header：從固定 `#1e3a5f` → `appTheme` 主題色（含 🪙💧🏹👤 資源列 + 返回後台按鈕）
  - 報到浮動視窗：與 MemberApp 完全一致
  - 底部導覽：加入 `appTheme.navActive / navIndicator` 顏色 + active 指示條
  - 補傳 `todayArrows={todayArrowsGlobal}` 給 MemberHome
**踩坑提醒**：handleCheckinSubmit 必須定義在 archerMode render 之前（已在元件層級定義）。

### 教練射手模式遺漏功能全部修復（11 項）
**為什麼**：比對 AdminApp 與 MemberApp，發現共 11 項功能不一致。
**改了什麼**：
1. **Header 射手等級** — 加入 `⚔️Lv.{archerLevelFromXP}`
2. **決鬥 reconnect banner** — 離開決鬥時顯示「⚔️ 決鬥進行中 — 點此回到戰場」
3. **地下城 reconnect banner** — 同上，🏰 地下城
4. **決鬥/地下城 sessionStorage 重整恢復** — `admin_duel_room` / `admin_dungeon_room`
5. **MonsterBattle props** — 補傳 `monsterDex/craftStats/chestStats/potionDex/duelStats`
6. **CatCollection onOpenForge** — 可從貓收藏跳到鍛造
7. **CatVillage initialTab+key** — 鍛造連結可直接定位
8. **版本更新提醒** — `subscribeAppVersion` + `needsUpdate` 彈窗
9. **CompDetail 報名偵測** — 用 `isMemberRegistered` 確認報名
10. **組隊 reconnect 顏色** — 改為 `appTheme.partyBg`
11. **地下城 → DungeonController** — 支援地圖探索模式
**踩坑提醒**：`DungeonController` 是 `DungeonBattleRoom` 的包裝層（含地圖探索路由），需同步替換 `DungeonBattleRoom` import。

### 首頁重整 Part 2：年度檢定精簡
**為什麼**：首頁與「我的」都顯示完整三欄檢定卡片，重複且佔空間。
**改了什麼**：
- `MemberHome.jsx`：年度檢定從 3 欄完整卡片（含背景圖/等級樣式/分數）→ 單行弓種摘要（弓種·分數·等級標籤） + 「查看詳細 →」導向 profile 頁面
- 清理未使用的 `CERT_BG` 常數
**踩坑提醒**：`onPageChange("profile")` 導向的是 MemberProfile，該頁有完整歷年檢定（含展開收合）。

### 首頁重整 Part 3：「我的」快捷連結重新排列
**為什麼**：原分組過多零散（5 組），部分組只有 1 個連結，視覺碎片化。
**改了什麼**：
- `MemberProfile.jsx`：quickLinkGroups 從 5 組 → 3 組：
  - 📌 **常用功能**：學習紀錄・成績歷史・訊息中心（最常用的 3 個）
  - 🎖️ **檢定與申報**：射手證考試・對外比賽
  - ✉️ **溝通與設定**：留言教練・我的弓具・使用說明
- 所有 8 個連結保留，3 欄網格剛好裝滿

### 其他小型修復
- `AdminApp.jsx`：`ADMIN_INVENTORY` 補上 `"gacha"`（與 MemberApp 的 `INVENTORY_PAGES` 一致）

---

### 打怪模式不再掉落徽章碎片與貓貓箱
**為什麼**：36 隻怪物打怪後給徽章碎片（frag_*）與貓貓箱（cat type chest）不符合設計方向。
**改了什麼**：`MonsterBattle.jsx`：
- `makeChests` 解構移除 `catChest`，不加入 mainChests
- 移除 catChest log 行
- `rollMaterialDrops` 結果 `.filter(m => !m.id?.startsWith("frag_"))` 過濾碎片
- 移除 `addFragments` 呼叫與 import
**踩坑提醒**：frags 已被獨立分出來（`mats.filter(frag_)`），直接在 rollMaterialDrops 後過濾更乾淨。

### 貓貓在決鬥模式（DuelRoom）傷害
**為什麼**：貓貓只存了名字，沒有真正參戰。
**改了什麼**：
- `duelDb.js` 新增 `calcCatDmg(catAtk, targetDef)` helper（6箭合算，0.5~2.0倍隨機）
- `applyPlayerCatToRoom` 加 `catAtk` 參數，存到 `team${team}.${memberId}.catAtk`
- `processDuelRound` 在 attacks 加總前插入貓貓攻擊段（effAliveA/B 各選目標，isCat:true）
- `DuelRoom.jsx`：從 hook 取 `catATK`，傳入 `applyPlayerCatToRoom`

### 貓貓在地下城模式（DungeonBattleRoom）傷害
**為什麼**：同上。
**改了什麼**：
- `dungeonDb.js` 新增 `calcCatDmg` helper
- `updateDungeonMemberStats` 加 `catAtk` 參數，存到 `members.${memberId}.catAtk`
- `processDungeonRound` Step 3 結束後插入「貓貓攻擊」mini round（isCat:true）
- `DungeonLobby.jsx`：import `useCatCompanion`，取 `myCatATK`，傳入兩個 updateDungeonMemberStats 呼叫

### 村莊累積生產模型（T2 → T1+T2 同時產出）
**為什麼**：高等建築應同時產出低階材料，方便玩家管理資源，升級更有感。
**改了什麼**：
- `villageData.js` `calcPendingResources`：tiered 資源改為 loop tier 1~maxTier，各自以同速率計算
- `db.js` `collectVillageResources`：同樣邏輯，非分層資源（箭露/射手等）維持原邏輯
**踩坑提醒**：non-tiered 資源（arrowdew、archer、gachaToken）不進 loop，避免 fracKey 衝突。

### 市集重設計（6 種族材料包 + 藥水箱 + 怪物卡包 + 黃金寶箱）
**為什麼**：原本 4 種通用寶箱不夠明確，玩家無法選擇要哪族材料。
**改了什麼**：
- `CatVillage.jsx` `BATTLE_EXCHANGE`：6 族材料包（ghost/mountain/exam/insect/workplace/temple）各消耗對應建築 T1 資源 ×30，加藥水箱/卡包/黃金寶箱
- `doBattleExchange` 加 `family` 參數，傳入 `exchangeMaterialsForChest`
- `db.js` `exchangeMaterialsForChest` 加 `family` 可選參數，加入寶箱 object
**踩坑提醒**：`gotThis` key 改為 `type + family`（否則不同族包 justGot 無法區分）。

---

## 2026-06-25（貓貓等級+裝備+技能系統）

### 舊 catStatMult 被動加成移除（設計簡化）
**為什麼**：TYPE × 羈絆等級的被動加成（射手 ATK/DEF 百分比）與新的 ID 群組主動技能重疊，且 catStatMult 雖有計算但從未真正套用到戰鬥傷害。簡化為「TYPE 只決定基礎 ATK 倍率，羈絆等級只影響技能觸發機率與效果幅度」。
**改了什麼**：
- `catData.js` CAT_TYPES skills 全部改為搞笑貓咪行為敘事（無任何數字加成）
- `useCatCompanion.js` 移除 `getCatStatMult` import 和 `catStatMult` return
- `DungeonBattleRoom.jsx`：移除 catStatMult，光環顯示改為「陪戰中」
- `DuelRoom.jsx`：`applyPlayerCatToRoom` 固定傳 1.0
- `PartyBattleRoom.jsx`：`getArcherStats` catStatMult 參數全換成 1.0
**踩坑提醒**：catData.js 的 `getCatStatMult` / `getCatBattleBonus` 函式保留（以防 UI 有用），但已不被 hook 呼叫。

## 2026-07-03（地下城探索/戰鬥介面修整）

### 進度
**為什麼**：實測發現地下城現在缺少原本想要的「逐房探索地圖」感，而且戰鬥輸入列太早展開，容易卡到點擊。

**改了什麼**：
- `DungeonExpedition.jsx`：新增遠征地圖過場，房間會一格一格往前推進，不再只剩純文字跳轉
- `DungeonBattleRoom.jsx` / `BattleBottomBar.jsx`：戰鬥改成先按「開始計分」，再展開「計分｜藥水｜隊友」
- `DungeonBattleRoom.jsx`：地下城戰鬥預設直接給分數按鈕，移除戰前的額外模式選擇

**踩坑提醒**：
- 剛把地圖過場做完時，`ExpeditionMapStage` 出現 runtime error，原因是新地圖頁面用了未穩定的元件路徑；後來改成內嵌 SVG 地圖，避免再碰到 import / HMR 的 undefined 問題。
- 這次遠征獎勵流程仍維持原本的單人/組隊分流，沒有動到地下城資料結構。

### 進度
**為什麼**：實測遠征還有三個核心問題：不小心退出後回不去、探索流程太系統自動化、以及進場素質沒正確帶入。

**改了什麼**：
- `MemberApp.jsx` / `AdminApp.jsx`：地下城離開時改成「暫離保留房號」，只有房間真的不存在或結束時才清掉 `activeDungeon`
- `DungeonController.jsx` / `DungeonBattleRoom.jsx`：把「暫時離開」和「房間失效」分流，避免誤刪重連資料
- `DungeonExpedition.jsx`：遠征改為手動推進，每一房都要玩家點確認，不再自動跳房
- `expeditionMemberData.js`：抽出遠征戰鬥素質組裝共用 helper，避免 single-player 與 lobby 算法分裂
- `expeditionDb.js`：建立戰鬥房時改用 `??` 預設值，避免 0 值被 `||` 誤判成缺值

**踩坑提醒**：
- `DungeonController` 的 `not_found / completed` 一定要清掉房號，不然 banner 會一直掛著死房。
- 暫離時不能再呼叫 `leaveDungeonRoom()`，否則 host 會被直接結束房間、隊友會被標成離場。

### 貓貓等級 / 裝備 / 技能 三系統實作
**為什麼**：從輔助型升為「真正陪伴玩家的戰鬥夥伴」，與射手等級系統平行。

**改了什麼**：
- `src/lib/catLevel.js`（新）：200級、XP公式與射手相同，`CAT_TIER_XP` 戰鬥後給 XP
- `catData.js` 新增：`CAT_SKILL_GROUPS`（前三補血/中三攻擊/後三防禦）、`CAT_EQUIP_SLOTS`（5格）、`calcCatEquipBonus`、`calcForgeCost`、`calcCatSkillChance/Effect`
- `catDb.js` 新增：`addCatXP`、`upgradeCatEquip`（同步 equippedCat 快取）；`equipCat` 更新同步 `catXP+equip`
- `useCatCompanion.js` 重寫：戰鬥數值整合等級+裝備加成；新增 `triggerCatSkill()`、`saveXP()`
- `MonsterBattle.jsx`：
  - ATK技能：貓咪攻擊後追加 XX%~翻倍傷害
  - HEAL技能：回復射手 HP
  - DEF技能：`catDefShieldRef` 保護下回合計數器攻擊（減傷/完全格擋）
  - 勝利後呼叫 `saveXP(CAT_TIER_XP[monster.tier])`
- `CatVillage.jsx` 新增「🔨 鍛造」TAB：`ForgePanel` 顯示 5 格裝備、費用（村莊材料）、升強化/升階按鈕

**踩坑提醒**：
- 計數器攻擊用 `let cdmg` 才能被貓盾修改（原本是 const）
- `equippedCat.equip` 可能是 `undefined`（舊資料），預設 `{}` → 所有格位視為「普通 +0」
- `calcForgeCost` 回傳 null 代表已達神話+5（極限）

---

## 2026-06-25

### 報到系統改為教練審核制（刪除日常任務）
**為什麼**：舊系統讓學生自己做任務（三選一），太複雜且難以管理；新流程改為教練手動確認出席。
**改了什麼**：
- `db.js`：`submitCheckin` 改建 `pending`；新增 `approveCheckin`/`rejectCheckin`；`subscribePendingCheckins` 加 `pending` filter
- `DailyQuest.jsx`：**完整重寫**，移除任務/施法/Buff，改為 pending/rejected/active/classEnded 狀態顯示 + 下課按鈕
- `MemberApp.jsx`：新增浮動報到視窗（`sessionStorage("checkin_popup_shown")` 防本 session 重複彈）
- `AdminDailyQuest.jsx`：「待施法」→「待審核」，通過/不通過按鈕；inProgress 改用 `!classEnded` 判斷；done 改用 `classEnded` 判斷
**踩坑提醒**：舊 `done` 是 `questDone`，新 `done` 是 `classEnded`。歷史資料的 `questDone` 欄位不影響新邏輯（篩掉了）。

### 修復：下課後不再觸發里程碑 popup
**為什麼**：下課時已結算箭露，若再去練習還會觸發里程碑，導致重複獎勵。
**改了什麼**：`MemberPractice.jsx` 加 `classEndedRef`（useRef）+ `subscribeMyCheckin` 訂閱；saveRound 前檢查 `!classEndedRef.current`。
**踩坑提醒**：用 useRef 而非 useState，避免訂閱更新觸發不必要的重新渲染。

### 首頁射手等級 widget 擴展
**為什麼**：玩家需要在首頁快速看到自己的完整數值與資源狀況。
**改了什麼**：`MemberHome.jsx` 新增 `calcEquippedBonus/calcArcherStats/archerLevelBonus` import；widget 顯示實際 HP/ATK/DEF（三層加成相加）；新增資源列（金幣/箭露/轉蛋幣/今日箭數）。
**踩坑提醒**：`calcArcherStats` 需要 `dexStats`，而 `computeDexStats` 在同一元件已有呼叫，直接複用即可。

### 修復：怪物卡片效果在選擇畫面不顯示
**為什麼**：原本 `cardCollRef`（useRef）不觸發重新渲染，選擇畫面讀到的永遠是初始空值。
**改了什麼**：`MonsterBattle.jsx` 改成 `useState + useRef` 雙軌——`useState` 給渲染用，`useRef` 給 `startBattle` 異步函式同步讀取。
**踩坑提醒**：這是 React closure stale 問題的標準解法，其他元件若有同樣情境可參考此模式。

---

## 2026-06-22（前次 session）

### 效能優化（3 個函式）
**為什麼**：買裝備/升級裝備/申請月卡 UI 卡住，因為有多次串行 Firestore getDoc 讀取。
- `upgradeEquipSlot`：5 次 ops → 2 次平行（接受 clientData，不需 getDoc）
- `submitMonthlyCardRequest`：移除 getDocs/getDoc，接受 `clientCard/hasPending`
- `MemberApp` practice logs：改用 `subscribeTodayPracticeLogs`（只讀今日）
- `MemberHome`：`useState(false)` 移除阻塞 spinner
**設計依據**：CLAUDE.md 規則「優先瀏覽器計算，不需防作弊」

### 射手等級系統（新檔案 archerLevel.js）
**為什麼**：讓射箭練習有長期成長感，各戰鬥模式都需要回饋。
**改了什麼**：新增 `archerLevel.js`；5 種戰鬥模式加 `addArcherXP`；4 處顯示等級（Header/MemberHome/MonsterBattle選擇/MemberProfile）。
**踩坑提醒**：Header 顯示的是 Lv.X，首頁 widget 顯示的是完整 HP/ATK/DEF（三層加成）。

### 組隊打怪靶紙選擇器修復
**為什麼**：`TargetFmtPicker` 出現在戰鬥每一回合，應只在設定時選一次。
**改了什麼**：`PartyBattleRoom.jsx` 移除戰鬥階段的 `TargetFmtPicker` block。

## 2026-07-12（戰鬥模擬器大改版：VS動畫＋戰鬥流程動畫＋統一音效管理器＋音效整合清單）

### VS 進場動畫（`AdminBattleTest.jsx`）
- **貓貓夥伴進場**：射手左側新增縮小版貓貓頭像（44px），帶技能類型對應的發光邊框（綠/紅/紫），晚 0.3 秒彈入。貓貓名字以 `+ 貓名` 格式並排顯示。沒選貓貓時不出現。
- **貓貓進場戰吼**：9 隻貓依 skillGroup（heal/atk/def）各有 2 種隨機台詞，`CAT_BATTLE_CRIES` 常數，useMemo 鎖定不重選。晚 0.7 秒彈入＋發光陰影。
- **類型專屬進場特效**（`CAT_INTRO_EFFECTS`）：IIFE 渲染背景光暈＋浮動粒子（catParticle keyframe，向外飛散旋轉 360°）＋類型標籤徽章。
  - 💚 治癒型 → 翠綠＋✨×6／⚡ 攻擊型 → 赤紅＋💥×5／🛡️ 防禦型 → 紫色＋🔮×5

### 戰鬥過程動畫（PROCESSING phase）
- **新階段** `PHASE.PROCESSING("processing")`：SCORE_ARROW 最後一箭結束後（非勝敗）進入 PROCESSING 而非直接跳 ROUND_RES。NEXT_PHASE reducer 負責轉場。
- **animStep 狀態機**（-1~9）：useEffect async 序列依序執行，`delay(320)` 每箭間隔。cancelled flag＋cleanup 防記憶體洩漏。
- **逐箭 UI**：z-index 9 半透明覆蓋層，底部顯示已命中箭數對應格（亮起高亮＋傷害數字）。
- **貓貓協戰動畫**：animStep 7 中央彈窗（類型色邊框＋發光陰影）。
- **怪物反擊動畫**：animStep 8 紅色警告面板。
- **怪物震動**：PROCESSING 期間套用 `procMonster` keyframe（translateX ±6px + rotate ±2°），每 0.45 秒循環。
- **可選貓貓**：控制面板 9 隻 CAT_IDS＋「❌ 無」，用 `calcCatCombatStats()` 真實計算模擬中高等級。
- **貓貓協戰邏輯**（ROUND_RES 觸發）：承受反擊傷害(35%－貓 DEF×0.5)＋協戰攻擊(ATK×0.8×亂數)＋技能觸發(治癒/追加/減傷疊加)。

### 音效預留 → 統一音效管理器 `src/lib/battleSound.js` 🆕
- 9 個音效ID：cat_intro/cat_type_sound/arrow_flight/arrow_hit/cat_attack/monster_counter/victory_fanfare/victory_cheer/defeat_sigh
- 雙模式：debug（console.log `🔊 [SOUND]` 前綴） vs live（播放真實音效，預留）
- API：playBattleSound/setBattleSoundMode/toggleBattleSoundMode/getBattleSoundMode/SOUND_IDS
- AdminBattleTest.jsx 全部 9 處 console.log 已替換為 playBattleSound() 統一呼叫
- 箭矢飛行兩段式（battleMode 判斷 分數靶→破風疾馳／殭屍靶→近距離穿透）＋命中音（含爆擊標記）
- 勝利/敗北音效預留：victory_fanfare（擊倒時）、victory_cheer（轉 WON 時）、defeat_sigh（敗北時）

### 音效整合清單文件 `docs/sound-effect-checklist.md` 🆕
- 完整記錄 9 個音效掛載點（ID／時機／Console範例／行號／未來實作 code）、API、建議音效函式列表（10 個）

### live 模式真實音效播放 + 控制面板音效切換（2026-07-12 追加）
- `battleSound.js` 加入 12 個 `import` 和 9 個 `livePlay` 映射：cat_intro→sfxBattleIntro, arrow_hit→sfxArrowHit/sfxCritBoom, victory_fanfare→sfxVictoryFanfare 等
- live 模式在瀏覽器 Console 輸入 `toggleBattleSoundMode()` 即可從 debug 切換到播放真實音效
- 控制面板（showCtl 區塊）加入「🔧 音效：除錯／🎵 音效：播放中」切換按鈕（綠色高亮表示 live 模式）
- 按鈕即時切換 `toggleBattleSoundMode()` + React state 同步，無需重整

### 🚀 接手開發指引（給 CLAUDE / CODEX）
本任務已完成的工作：
- `src/lib/battleSound.js`🆕：統一音效管理器（9 IDs、debug/live 雙模式、`playBattleSound/setBattleSoundMode/toggleBattleSoundMode`）
- `AdminBattleTest.jsx`：全部 9 處 console.log 已替換為 `playBattleSound()`，控制面板加入音效切換按鈕
- `docs/sound-effect-checklist.md`🆕：9 個掛載點完整文件
- `docs/second_brain/quick-ref.md` 已新增 🔊 章節

**下一步可能方向**：
1. 將 battleSound.js 整合進正式戰鬥（MonsterBattle.jsx / PartyBattleRoom.jsx / DungeonBattleRoom.jsx）
2. 音效模式狀態存 localStorage 讓重整後恢復
3. 戰鬥畫面內加入小型音效模式指示器
4. 調整個別 livePlay 映射的真實聽感（目前是初版對應）
5. 若有多戰鬥實例同時存在，`_mode` 需改成 instance-scoped

### 踩坑提醒
- animStep cancelled flag 必須＋cleanup，否則 StrictMode 會疊加非同步序列
- useMemo 鎖定 catBattleCry 的依賴項要含 hasCat+skillGroup，漏 hasCat 會讓清空貓後仍顯示舊 cry
- IIFE 粒子 pointerEvents:"none" 避免擋住 VS intro 互動
- battleSound _mode 是模組級變數，未來多戰鬥實例需改 instance-scoped

---


