## 2026-08-13 — 自由狩獵 legacy 怪物／組隊入口清除
- 修正直接建立自由狩獵隊伍時 `PartyBattleRoom` 的 `fixedHuntMonster is not defined`：固定怪物改在元件層解析，Free Hunt 等待室與 `handleStart()` 直接使用固定目標，不再依賴舊 `setupMonster/drawnMonsters/challengeLevel`。
- 修正單人自由狩獵結算按「換對手」會跳回舊怪物介面：`MonsterBattle` 新增 `returnToOpponentSelection()`；只要有 `huntMonsterId`，所有返回選怪動作一律交回父層 `FreeHunt`，不再進 legacy `phase="select"`。
- `MemberApp.jsx` / `AdminApp.jsx` 已移除舊 `PartyLobby` lazy import、預載、`page="party"` 路由與 adventure page 標記；正式會員／後台不再有可進舊 PartyLobby 的 runtime 路徑。
- `GuestApp` 仍保留 `PartyLobby`，因訪客目前仍實際使用該相容流程；本次不硬砍以免破壞訪客組隊。
- 清理前完整備份：`backups/free-hunt-legacy-2026-08-13/`，包含 FreeHunt、MonsterBattle、PartyBattleRoom、MemberApp、AdminApp 修改前版本；備份位於 `src` 外，不會被正式 bundle import。
- 狀態：本機修改，未 commit / push / deploy；驗證結果見本條後續 build/test 紀錄。

## 2026-08-13 — 自由狩獵組隊直連＋隊員個人射擊環境
- `FreeHunt.jsx` 新增「直接加入隊伍」等待房列表；不需先選到與房主相同怪物即可看到並加入所有自由狩獵等待房。
- 選定怪物後按「建立隊伍」會直接呼叫 `createPartyRoom()` 並進入該房，移除自由狩獵流程中舊 `PartyLobby` 的第二次「建立房間」操作；舊 Lobby 仍保留給一般相容入口。
- 自由狩獵隊伍中每位成員可獨立選擇**距離／靶紙／弓種**；資料寫入 `members.{id}.huntDistanceM / huntTargetFmt / bowType`，不再由房主設定後全隊共用。
- 新增 `getPartyMemberFreeHuntEnvironment()` 與 `updatePartyMemberHuntEnvironment()`；`partyDb.processPartyRound()` 逐人成員套用自己的距離、靶紙、弓種倍率與 `faceCap`，舊房間層設定只做 fallback。
- 3／6 箭維持房間共用 `arrowsPerRound`，**只有房主可操作**；隊友僅顯示目前箭數與「由隊長設定」。
- `BattleShootingProfile` 新增 `showDistance`，自由狩獵等待室隱藏重複的練習距離欄，只保留明確的狩獵距離控制。
- 驗證：自由狩獵環境＋房間列表 focused tests 15/15 PASS；完整 196 suites、2206 tests PASS；production build PASS。尚未 commit / push / deploy。

## 2026-08-13 — 修正自由狩獵隊友看不到房間
- 原因：加入頁用加入者目前選中的 huntMonsterId 精確過濾開放房，因此選不同怪物時會顯示 0 間。
- 修正：Join 模式改列出所有等待中的自由狩獵房；房卡顯示房主與怪物，玩家自行選擇加入。建立模式與一般組隊邏輯維持原行為。
- 新增 src/lib/partyLobbyRooms.js 與回歸測試。

## 2026-08-13 — 自由狩獵弓種加成
- 新增弓種倍率：裸弓 ×1、獵弓／複合弓 ×1、傳統弓 ×2；其他/舊資料 ×1。
- `getFreeHuntEnvironment()` 新增弓種資訊，最終倍率改為距離 × 靶紙 × 弓種。
- `BattleShootingProfile` 新增 `onChange`，單人與組隊切換本場弓種後可即時更新倍率。
- 組隊送箭會保存每位成員 bowType，`processPartyRound()` 逐人權威套用，混合弓種隊伍不會共用錯誤加成。
- targeted tests 12/12 PASS；production build Compiled successfully。

## 2026-08-13 — 自由狩獵戰前 UI / 世界王環境倍率
- 自由狩獵戰前畫面移除舊「分數靶紙、學生固定距離、3/6 箭」規則顯示，改為「狩獵環境」。
- 單人與組隊直接共用世界王的靶紙、距離與 `rangeMultiplier` 計算。
- （後續已改版）當時為房主調整 `huntTargetFmt` / `huntDistanceM`、隊員唯讀同步；**現行規則已改為每位成員各自選距離／靶紙／弓種，房間值只做舊資料 fallback**。
- `BattleScreen.onSubmit` 新增可選第二參數 arrow details，保留三連靶 `faceIndex`。
- `partyDb.processPartyRound()` 新增自由狩獵權威倍率與 `faceCap` 驗證；只放大正常箭矢傷害，不放大投擲、毒或貓攻擊。
- 新增 `applyFreeHuntFaceCap()` 回歸測試；自由狩獵相關 targeted tests 10/10 PASS，production build PASS。

## 2026-08-13（🧭 自由狩獵：單人／組隊入口統一）

- 冒險 Hub 原本「RPG打怪」與「組隊打怪」合併為單一「自由狩獵」入口。
- 新增 `FreeHunt.jsx`＋`freeHuntCatalog.js`：玩家依 **七族 → T1~T6 → 精確普通怪物** 選擇目標，再選單人狩獵／建立隊伍／加入隊伍。怪物真本直接使用現行 252 expansion catalog，狩獵池只收 126 隻 `encounter === "normal"`。
- 特別鎖住 T5 邊界：legacy tier 字串 `boss` 只是第五階名稱，不是 encounter 大王；T5 normal 仍可選。測試同時鎖定七族、六階、每族每階 3 隻、miniBoss/boss 不可進池。
- `MonsterBattle` 新增 `huntMonsterId` 固定目標入口，直接轉現行 battle monster 後進 prebattle；既有公會 `questContext` 保持優先，舊直接打怪入口相容。
- 組隊建房新增 `huntMonsterId / monsterId / monsterSnapshot`；`PartyBattleRoom` 偵測固定目標後不再隨機抽怪、也不允許房主重抽，加入者沿用房間目標。舊房間無固定目標欄位時維持原流程。
- 沒有修改傷害、掉落、卡片異常、party reward、Functions 或 Firestore rules。
- Phase 1 決策：先統一 UI 與 data contract；solo 仍使用本機 `MonsterBattle`，尚未改成 Firestore `partySize=1`。
- 驗證：`freeHuntCatalog.test.js` 5/5 PASS；scoped `git diff --check` PASS（僅換行格式 warning）；CRA production build `Compiled successfully`。
- 狀態：僅本機完成，未 commit / push / deploy。

## 2026-08-12（🛡️ 地下城組隊：隊友 HP／前衛轉後衛同步修復）

- 權威結算確認：前衛倒地但仍有其他前衛存活時會轉為 `rear`、恢復約 50% Max HP 且 `alive` 保持 true；下一回合仍可送出後衛行動。後衛 `heal` 維持 `MaxHP × 15% × 命中分數%` 治療池，`dmg` 維持 `命中分數% × 25%` 前衛助攻增傷；本輪未改玩法公式。
- 修正 `BattleScreen` 隊友詳細卡保存舊 ally object：改存 id，每次從最新 `allies` 解析，因此 Firestore 更新 HP／role／ready 後詳細卡不再停在舊值。
- 修正組隊自身 HP 只有本機反擊動畫、權威結算後未同步：新增 party player HP 同步，等 mini-round 演出完成才套 Firestore 最終 HP，涵蓋後衛治療與前衛轉後衛的 50% 回血，不提前覆寫怪物血量動畫。
- 修正 `DungeonBattleRoom` 的 `me?.hp || 100`：HP=0 不再誤顯示滿血；`partyMembers` 同步帶 hp/maxHp/atk/def。
- 新增 `BattleScreen.partyState.test.js`，鎖住 stale ally、HP 同步時機、只同步玩家不覆蓋怪物動畫、0 HP fallback。
- 驗證：3 個 targeted test suites 通過；focused JSX `no-undef` 通過；scoped `git diff --check` 通過（僅換行格式 warning）；`npm run build` 成功。
- 狀態：僅本機完成，未 commit / push / deploy。

## 2026-08-12（🏅 外賽後台改為教練名單直接核發）

- 修正前一輪理解：外賽流程由外部主辦方決定，本系統不應要求射手在站內報名／射箭／結算；先前「建立後再結算」模型改為純後台登錄。
- 後台「賽事管理」拆成「館內賽事／外賽圖鑑」；外賽建立名稱、日期、賽制後，由教練直接勾選正式射手。儲存名單即寫入 `members.competitionDex.<eventId>.participated=true`，自動取得該場參加圖鑑。
- 名次可留空；賽後再把個別射手改成第 8～1 名，同一張動態外賽卡直接升級。刪除誤選射手時只移除該場 `competitionDex`，不碰會員自己申報的 `externalComps` 歷史／審核流程。
- 外賽 catalog 標記為 admin-only，會員 `MemberComps` 會排除，不會出現在學生可報名／可射箭賽事；館內比賽原本的報名、成績、積分結算維持不變。
- 沒有新增 Firestore listener、rules 或額外常駐讀取；射手名單只在外賽編輯視窗開啟時用一次性 `getMembers()`，儲存採 batch，並同步清除圖鑑 catalog local cache。
- 驗證：`achievementDexV3.test.js` 34/34 PASS；focused `no-undef` PASS；scoped `git diff --check` PASS；CRA production build PASS。
- 狀態：僅本機完成，尚未 commit / push / deploy。

## 2026-08-12（🐛 外賽後台入口恢復）

- 根因：`AdminCompetitions` 與 `game-events` preload 已存在，但後台導覽重整時漏掉 `eventsSub="comps"` 的可見按鈕與 render branch，因此正式站沒有入口。
- 修正：恢復 `🎮 遊戲活動 → 🏆 賽事管理`，點入即渲染 `AdminCompetitions`；既有「加入外賽圖鑑」與資格賽／混雙／團體／對抗流程不變。
- 沒有修改 Firestore schema、listener、讀寫契約或既有外賽結算邏輯。
- 本輪僅本機修復，尚未 commit / push / deploy。

## 2026-08-12（🏆 成就圖鑑 V3：分類／收藏／外賽／生涯／年度檢定全面重整完成）

- 寶箱圖鑑完成現行分類重建：通用／卡包最高 10,000 次、七族素材箱各自最高 10,000 次、貓貓箱與咪咪箱最高 100 次、小王／大王素材箱最高 500 次；世界秘寶箱退出現行寶箱圖鑑，只保留舊 ID 相容。
- 七族素材箱自新版起寫入精確族別開箱統計；舊版只保存 aggregate `family_mat` 的歷史資料無法可靠拆回七族，因此不偽造舊進度。
- 寶箱來源顯示改為中文化；例如 `dungeon_boss_choice` 顯示為地下城王房選擇獎勵，族系素材箱使用中文族名。
- 世界王圖鑑拆成「參與戰鬥／擊殺／名次」三區，既有世界王名次與尾刀相關榮耀歸入名次分類。
- 收藏區改為七族 × T1～T6 的 42 組一般怪物卡收藏，以及世界王卡「教練系／貓王系／小王系／大王系」四組；舊總卡數與舊 raw-family 卡片成就退役但保留 ID。
- 冒險者公會新增 T1～T6 各危險度勝場成就，沿用既有 `expeditions.byDanger` 永久統計，不新增 Firestore 讀取。
- 貓貓村新增九貓齊聚、貓貓卡片總收藏、七張探索地圖各自完成次數等成就，沿用既有永久資料。
- 榮耀紀錄新增「外賽」：賽制分為資格賽／混雙／團體／對抗；每種賽制由參加紀念章一路記錄到第 8～1 名。新申報新增獨立 `format` 欄位，避免與弓種／項目 `category` 混用；舊紀錄只有文字能明確辨識賽制時才承接，不能辨識者不亂分類。
- 射手生涯「啟程／練習」調整：累積報到與終身練習箭數改為每個里程碑直接顯示，不再只顯示一張折疊卡。
- 練習新增可靠永久資料可證明的戰鬥履歷：打怪完成場次、決鬥參與、地下城完成、世界王參與、公會遠征完成；沒有永久歷史計數的模式不以傷害或推測值回填。
- 期數圖鑑固定列出第 1～20 期；本人所屬期數解鎖，其餘維持鎖定。無法判定期數時仍顯示 20 期但全部鎖定。
- 年度檢定改為「年份 × 上／下半年 × 裸弓／獵弓／傳統弓」動態折疊圖鑑，例如 `2026 上半年・裸弓` 內含入門／初級／中級／進階／精英。舊 `recurve_full` 在圖鑑中正規化為裸弓，傳統弓舊「菁英」正規化為「精英」；舊終身最高級別成就退役並保留 ID。
- `MemberDex` 僅在沒有上層共享資料時於圖鑑掛載期間訂閱外賽紀錄；沒有增加全域常駐 listener。
- 驗證：`src/lib/achievementDexV3.test.js` 30/30 通過；scoped `git diff --check` 通過；CRA production build 成功。
- 狀態：僅本機完成，尚未 commit / push / deploy。

# 📝 changelog — 變更日誌
> 每次功能完工後由 Claude 自動寫入。格式：日期 / 改了什麼 / 為什麼 / 踩坑提醒
>
> ⚠️ **這是歷史紀錄，不是現況**：每條都是「當時」的快照，舊條目描述的機制可能已被後續改版取代（例如舊地下城房間制、舊貓咪 XP 寫法都已淘汰）。要確認「現在是怎樣」，看 `features.md`（功能現況）、`game-systems.md`（玩法規格）、`quick-ref.md`（函式/DB 事實），不要拿舊 changelog 條目當現況。

---

## 2026-08-12（🚀 本機完成項目整批正式部署）

- 本次正式站整批納入已完成的本機工作：Achievement Dex V3（寶箱／戰鬥／世界王／貓小隊／貓貓村／商店）、252 怪物圖鑑與現行指定討伐、寶箱／素材獎池一致化、貓貓村商店 V6–V11 與棋盤事件 runtime／美術、現行世界王 lifecycle／reward／catalog／技能平衡、組隊獎勵結算、地下城 reward lifecycle（含 `dungeon_battle_not_rewardable` 舊卡房恢復）、公會遠征永久統計，以及已確認無 production 引用的 dead-code cleanup。
- 後端同步部署 Firebase Functions 與 `firestore.rules`，避免只更新前端而漏掉權威結算／規則。
- Release gate：Functions 全套 **74/74 PASS**；前端首次全套 **369/370 PASS**，唯一失敗為世界王 `COACH_BOSS` 測試 fixture 仍使用舊倍率／舊 skill id，已改成現行權威教練王 **1.8 / 2.5** 常數且**未改 runtime 平衡**；相關世界王 targeted tests 全綠，production build 通過。
- 明確不納入 `.deploy-staging-2/**`、build/check 產物、`tmp/**`、`item.cat`、孤兒原型 `src/components/member/ShopSimulator.jsx`，以及僅供稽核／報告用途的未追蹤產物。
- 本條隨本次 `main` 正式站部署一併提交。

## 2026-08-12（🐛 地下城王房：dungeon_battle_not_rewardable／戰利品重新同步修復）

- 根因：`DungeonBattleRoom` 的遠征自動領取在終局 `completed + result:"win"` 後仍呼叫 `returnToMapAfterBattle()`，把王房的 `result:"win"` 清成 `null`；外層接著呼叫 `createDungeonBossRewardClaim` 時，後端因此判定 `dungeon_battle_not_rewardable`。
- 修正：房主只有非終局 `status:"path_select"` 才會回到 `map_explore`；最終王房 `completed + win` 保留為權威勝利證據，直到 Cloud Function 獎勵 claim 完成後再 cleanup。
- 舊卡房恢復：後端只對舊流程已改成 `status:"map_explore" + result:null` 的房間提供嚴格恢復；必須同時滿足房間 `monsterHP <= 0`、最後一筆 battle log `monsterHPAfter <= 0`，以及原有會員、實際參戰、monster id 全部吻合，才允許重新同步。`result:null` 的一般 `path_select` 或非終局紀錄仍不可領獎。
- 「重新同步獎勵」成功後現在會重建王房單場結算並帶入 authoritative `bossDrops`；若是舊 hot-reload 狀態缺少 `resultBase`，至少會直接進戰利品房，不再卡在 `boss_reward_retry` 空狀態。
- 獎勵 claim 的冪等性維持不變；沒有新增 Firestore schema、listener 或額外讀取。
- `functions/dungeonBossReward.test.js`、`rewardClaimLifecycle.test.js`、scoped `git diff --check`、production build 全部通過。
- 本輪只在本機，未 commit / push / deploy。

## 2026-08-12（⚔️ 成就圖鑑：戰鬥寶箱／世界王／貓貓村／商店擴充與語法修復）

- 寶箱從「收藏」移到「戰鬥」；13 種現行寶箱維持同一張圖鑑疊加，里程碑延伸為 `1 / 5 / 10 / 20 / 50 / 100 / 250 / 500 / 1000`。
- 世界王新增「參戰」與「擊殺」永久成就；V2 claim transaction 使用 `worldBossParticipations` / `worldBossKills` 冪等累加，重複 claim 不重複計數。
- 「收藏」新增依 `WB_CARDS` family 分組的世界王卡收藏圖鑑。
- 修正「村莊發展」舊邏輯誤用平均村莊等級：改為九大建築等級總和（最大 180），並新增九棟建築各自 `Lv.1 / 5 / 10 / 15 / 20` 成就；舊 `building_max` 退役。
- 貓貓村新增「商店」分類：商店等級、累積成交、服務顧客、顧客圖鑑。
- 修復本輪新增程式遺失字串引號及重複插入造成的 Babel `Unexpected character '⚔'`；保留單一合法成就定義區塊。
- `achievementDexV3` targeted tests、scoped `git diff --check`、production build 均通過。
- 本輪只在本機，未 commit / push / deploy。

## 2026-08-12（🎁 寶箱圖鑑＋素材獎池合併部署）

**部署內容**
- 成就圖鑑：納入 13 種現行寶箱，使用既有永久開箱統計作為收藏依據；舊版 `cat` 箱保留相容但不列入現行收藏。
- 寶箱素材獎池：地下城普通素材箱、王者寶庫與遠征素材獎勵對齊現行 7 族 expansion 素材；遠征依普通怪／小王／大王發出 `family_mat` / `mini_boss_mat` / `boss_mat`。
- 修正單開寶箱時開箱統計重複計數，不新增 Firestore schema。
- 本次刻意排除未授權的怪物卡包 36→126、252 怪圖鑑、九貓養成等其他 dirty 工作。
- 本條隨本次 `main` 提交部署；push `main` 由 Vercel 自動觸發正式站部署。

## 2026-08-12（🎁 成就圖鑑：寶箱開啟／收集系統重建）

**根因**
- 成就圖鑑的寶箱區仍停在早期 7 種，而且全部被塞在「怪物」分類；後來加入的金幣寶箱、貓貓箱、咪咪箱、世界秘寶箱與三種新版素材箱都沒有成就。
- 寶箱是消耗品，不能拿目前背包數量當「收集」完成度；現行已有永久 `chestStats.opens[type]`，因此用「曾開過」作為收藏真本，開掉後進度不會倒退。

**重建**
- 新增獨立「🎁 寶箱」分類，歸到「收藏」主題。
- 現行追蹤 13 種：通用材料木／鐵／金／史詩／神話箱、藥水箱、金幣寶箱、貓貓箱 (`cat_box`)、咪咪箱、世界秘寶箱、族系素材箱、小王素材箱、大王素材箱。
- 每種箱統一開箱里程碑 `1 / 5 / 10 / 20 / 50 / 100`。
- 新增「寶箱收藏圖鑑」：曾開啟過的不同現行箱型，里程碑 `1 / 3 / 5 / 8 / 10 / 全 13 種`；未知 key 與舊 `cat` 不灌進度。
- 舊 `type=cat` 的 `chest_cat` 與舊 AUTO id 保留供歷史 seen/notified 相容，但標記退役；現行貓貓箱使用 `cat_box`。
- `card_pack` 不列入寶箱圖鑑：現行卡包走獨立卡包流程，不是 `chestStats/openChest` 的寶箱開啟紀錄。

**成本 / 相容**
- 不新增 Firestore schema、讀取、listener 或寫入；MemberApp / MemberDex 原本就已訂閱 `chestStats`。
- 不搬玩家資料、不改現有 chestStats key；舊通用箱／藥水箱紀錄會直接接續新里程碑。

**驗證**
- `achievementDexV3.test.js` 新增寶箱分類、13 種現行箱、特殊箱／金幣箱、legacy cat 退役與收藏過濾回歸。
- targeted V3 tests、scoped `git diff --check`、production build 均通過。
- 本次只在本機，**未 commit / push / deploy**。

## 2026-08-12（🐈 成就圖鑑：九隻貓改為各自等級／羈絆／裝備養成）

**最終設計**
- 貓小隊不再用「任一貓最高值」代表全隊；依 `CATS` 九隻正式貓咪各自建立 3 條獨立階段成就：貓咪等級、羈絆等級、裝備等級，共 **9 × 3 = 27 張 active TIERED**。
- 貓咪等級改讀真正的 `catLevelFromXP()`，里程碑 `10 / 50 / 100 / 200 / 300 / 500`；舊版誤用了冒險者 `levelFromXP()`，且只做到 Lv.200，已不符合現行貓咪 500 級上限。
- 羈絆改讀 `getBondLevel()` 的**羈絆 Lv**，里程碑 `5 / 10 / 20 / 30 / 40 / 50`；不再拿原始 bond 點數直接當成羈絆等級。
- 裝備成就讀七個 `CAT_EQUIP_SLOTS` 的 `catEquipEnhancement()`，以 **七件整套平均強化 = floor(總強化 / 7)** 計算，缺裝視為普通 +0；里程碑 `+5 / +10 / +20 / +30 / +40 / +50`。因此只衝一件神話 +0（可視強化 +50）整套只算 `floor(50/7)=+7`，不能冒充整套高強化。
- 每隻貓只讀自己的 `catId`，未持有的貓三條進度都是 0，不會被其他貓的高等級／高羈絆／高裝備灌進度。

**舊資料相容 / 邊界**
- 舊聚合 `cat_level` / `cat_bond` id 保留但標記 retired，不刪歷史 seen/notified 相容資料；`cat_collect`、`cat_story`、`cat_all9` 維持原樣 active。
- 沒有新增 Firestore schema、讀取、listener 或寫入，只重用既有 cats 子集合資料。

**驗證**
- `achievementDexV3.test.js`：13/13 PASS；新增鎖住 27 條結構、九貓隔離、正確貓咪等級公式、羈絆 Lv、七槽平均裝備與里程碑。
- focused `no-undef`、scoped `git diff --check`、production build 均通過。
- 本次仍只在本機，**未 commit / push / deploy**。

## 2026-08-12（🎯 成就圖鑑：指定怪物討伐收斂為 42 普通怪群組＋84 小王＋42 大王）

**最終設計**
- 作者希望「不要讓圖鑑過多，但指定怪物討伐也不能少到失去辨識度」，因此不再為 252 隻怪全部各做一套討伐卡。
- **普通怪**改成「七族 × T1～T6」分組，共 **42 張**；每張只合計該族、該 T 階的 **3 隻現行 normal 怪**，說明文字會直接列出三隻怪物名稱。
- **小王**保留每隻獨立討伐，共 **84 張**；**大王**保留每隻獨立討伐，共 **42 張**。現行指定討伐卡總數因此固定為 **168 張**。
- 每張現行指定討伐卡統一使用 `1 / 5 / 10 / 25 / 50 / 100` 里程碑；其中 **1 次＝首次討伐**，不再另外做一張重複的「首次擊倒」卡。
- 新卡完全由 `MONSTER_DEX_CATALOG` / expansion catalog metadata 產生，不手寫現行 monster id；普通怪卡只吃自己的 3 隻 normal，小王／大王卡只吃自己的單一 monster id。

**舊資料相容**
- 原本 **36 個**舊 `dex_*` 首次擊倒 AUTO、**180 個**舊單怪 `5/10/25/50/100` AUTO，以及 **36 張**舊單怪 TIERED 定義都**保留 id、不刪資料**，但標記 inactive／retired，不再出現在玩家現行圖鑑。
- `monster_catalog` 的 **252 全圖鑑**與七個 `monster_family_*` **族群圖鑑仍保持 active**；它們是收藏／種類進度，與這次「指定怪物累積討伐」並存，不互相取代。
- ⚠️ **本條取代同日稍早「暫時恢復舊 36 隻個別怪物成就」的方案。** 那次恢復是修正誤刪後的過渡狀態；最終定案已改成本條 42＋84＋42 結構。後續維護不得因看到舊 id 還存在，就重新把那批 legacy 個別卡設成 active。

**驗證 / 邊界**
- `achievementDexV3.test.js` 已鎖住 42 normalGroup / 84 miniBoss / 42 boss、168 總數、`1/5/10/25/50/100` 門檻、普通怪三隻分組與小王／大王單怪隔離，以及 legacy id 存在但 inactive。
- focused `no-undef`、scoped `git diff --check`、targeted V3 tests、production build 均通過。
- 沒有新增 Firestore schema、讀取、listener 或寫入；本次仍只在本機，**未 commit / push / deploy**。

## 2026-08-12（🎯 成就圖鑑：恢復個別怪物擊倒成就，252 圖鑑改為純新增）

**修正**
- 回復前一輪誤退役的原有個別怪物成就；原需求只是補上 252 怪總圖鑑，並沒有要求刪除或取代原本的個別怪物擊倒成就。
- 舊 `MONSTERS` 36 隻的「首次擊倒」`dex_*_t1~t6` 全部恢復為 active。
- 36 隻原有單怪累積擊倒卡全部恢復，每隻仍保留 5 / 10 / 25 / 50 / 100 五階里程碑。
- `monster_catalog`（252 總圖鑑）與七族 `monster_family_*`（每族 36 種）維持新增成就；七族總覽不再用 `replacesIds` 隱藏任何首次擊倒成就。
- 原有單怪 tiered 卡仍只取代同一隻怪的五個內部 auto milestone id，這是原本 UI 彙整機制，不是退役或刪除。
- 沒有改 achievement id、玩家歷史資料、Firestore schema、讀取或 listener。

**驗證**
- `achievementDexV3.test.js` 新增回歸：36 個首次擊倒成就 active、36 個單怪 tiered 系列 active、里程碑維持 5 / 10 / 25 / 50 / 100、七族總覽不得取代個別成就。
- targeted test：PASS。
- production build：Compiled successfully。
- 本次仍只在本機，未 commit / push / deploy。

**邊界**
- 本次是把誤砍的原有個別怪物成就恢復，不是把 252 隻全部擴成 252 套個別 5 / 10 / 25 / 50 / 100 成就；若之後要擴充到所有新版怪，需另行設計與確認。

## 2026-08-12（Achievement Dex V3 怪物圖鑑 252 遷移：完整目錄切換 + 地下城勝利紀錄修正）

**改了什麼**
- 前一版 V3 雖已更新部分成就資料來源，但 `MemberMonsterDex` 仍直接使用 legacy 36 怪並硬編碼 `/36`；本輪將顯示層、成就層與戰鬥紀錄一次對齊現行擴充目錄。
- 現行權威真本為 `EXPANSION_MONSTERS = 252`：7 族 × 6 階 × 每階 6 隻；遭遇分布為 126 一般怪、84 小王、42 大王，每族 36 隻。依目前正式 catalog 並非 254。
- 重新稽核現行玩法後確認 252 隻皆已有正式遭遇來源：一般怪由一般戰鬥／地下城普通房提供，小王與大王由地下城王房的族群 × 階級池提供，寶箱族也包含在同一套七族規則。
- `MemberMonsterDex.jsx` 改用 `EXPANSION_MONSTERS` 作唯一顯示目錄；總完成度改為 `已擊敗 X/252`、`已遭遇 X/252`；七族各顯示 `X/36`；保留族／階級篩選並新增一般怪／小王／大王遭遇類型篩選。
- `achievementDex.js` 新增 `monster_catalog` 不同怪物里程碑 `1/10/25/50/100/150/200/252`；七族改為 `monster_family_*`，各自依正式 catalog 中不同已擊敗 ID 計數，里程碑 `1/6/12/18/24/30/36`。未知／legacy key 不會灌進 252 或 36 的完成度。
- 252 總圖鑑與七族 36 種收集是新增聚合成就；原有 36 怪的首次擊倒與單怪 `5/10/25/50/100` 里程碑仍保留。這批個別成就曾在本輪誤標退役，已於同日修正並恢復。
- 地下城勝利紀錄修正：遠征模式原本會在 early return 前漏掉 `monsterDex` 勝利寫入；非遠征勝利則曾呼叫 `recordBattleDex` 卻漏傳 `"win"`。兩條路徑都改為明確寫入勝利；`recordBattleDex` 也只接受 `"win"`／`"lose"`，缺值或非法結果直接 no-op，不再默認成 loss。
- Firestore 成本：不新增 listener、不新增讀取、不改 schema，只沿用既有永久 `monsterDex`。

**驗證**
- Achievement Dex V3／monster expansion catalog／dungeon boss encounter／dungeon expansion：4 suites / 28 tests 全綠。
- Production build 成功；scoped `git diff --check` 通過。
- 本次仍只在本機，未 commit / push / deploy。

**踩坑提醒**
- 這取代較早「暫不建立 252 圖鑑成就」的保守結論；當時 playable pool 尚未完成稽核。現在 252 隻的正式遭遇來源與永久 `monsterDex` 寫入路徑都已確認／修正。

## 2026-08-12（裝備精練素材名稱／掉落來源一致化）

**根因**
- 精練顯示與現行怪物掉落曾各讀不同素材名稱來源；同一個素材 id 因此可能顯示兩個名字。典型例子：`exam_m3` 在 legacy `monsterMaterials.js` 叫「崩潰眼淚」，現行擴充／經濟清冊則是「期末考卷」。
- `exam_m3` 的現行掉落來源其實存在：**T3「期末考」**。T4 精練配方依既有曲線可以合法抽到較低階的 T3 素材，因此問題不是素材無法取得，而是舊名稱讓玩家無法把需求和掉落對起來。

**修正**
- `RPGEquipPanel.resolveMatMeta()` 改以現行 expansion/economy catalog 為素材顯示單一真本；只有現行清冊找不到 id 時才退回 legacy `MATERIALS`，不改任何已存素材 id。
- 一般材料與關鍵材料列都會額外顯示 `來源：T{tier} {monster}`；例如 `exam_m3` 現在顯示「期末考卷｜來源：T3 期末考」。
- 沒有遷移 inventory、沒有改 Firestore schema、沒有新增 Firestore 讀取。

**回歸驗證**
- 測試鎖定 `exam_m3 = 期末考卷 / T3 / 期末考`。
- 現行精練使用的 **126 個 normal 素材池**全部能反查到現行怪物來源，避免再出現真正的孤兒 normal 素材。
- 精練／素材經濟 targeted tests、`git diff --check`、production build 均通過。
- 本次仍只在本機，未 commit / push / deploy。

## 2026-08-12（成就圖鑑 V3 第三輪：公會遠征終身戰績＋地下城永久通關）

**改了什麼**
- 新增 `src/guild/domain/guildExpeditionStats.js`，只整理既有 `guildProfiles.expeditions.total/won/byDanger`，正規化為 `total / won / hardWon / deadlyWon / mythicWon`；沒有新增 Firestore schema。
- `useGuildRank` 沿用原本 5 分鐘快取＋一次性讀取；既有 `guildRank.expeditions` 仍維持 number 相容舊 UI，另外提供 `expeditionStats` 給成就系統。
- 公會新增 5 條永久里程碑：遠征總次數、遠征勝場、危險度 3+ 勝場、危險度 5+ 勝場、危險度 6 神話勝場。
- 地下城新增 `dungeon_clears`：1 / 5 / 20 / 50 / 100 次，直接讀永久 `member.dungeonClears`；單人與組隊通關本來都會累積這個欄位，因此不會因歷史紀錄裁切而倒退。
- 地下城總數依現行玩法只計 `ghost / mountain / insect / workplace / exam / temple / treasure` 七個正式地城族群；未知 legacy key 不灌進度。`FAMILY_COLLECTIBLES` 是另一套六族收藏品資料，不能再當地下城玩法族群真本。
- `MemberApp` 全站解鎖提示與 `MemberDex` 顯示 context 都已接入 `guildExpeditionStats`。

**為什麼這樣做**
- 沒有使用只保留近期約 20 筆的 `expeditionRecords`，否則舊通關被擠掉時成就進度可能倒退。
- 射箭高分成就這輪刻意不加：完整成績目前主要在歷史集合裡，為成就額外掃描歷史紀錄不划算；等之後有個人最佳摘要欄位再接。

**驗證**
- `achievementDexV3.test.js` + `monsterCardPack.test.js`：通過。
- `git diff --check`：通過。
- `CI=true npx react-scripts build`：Compiled successfully。

**邊界**
- 沒改 Firestore schema、沒改戰鬥核心、沒新增即時監聽。
- 本輪仍只在本機，未 commit / push / deploy。



## 2026-08-12（🎖️ 成就圖鑑 V3 第二輪：新版公會聲望落地＋怪物判定去除舊 ID 假設）

**改了什麼**
- 新增 `guild_reputation` 階段成就，直接沿用新版公會單一真本 `GUILD_RANKS`：1 點聲望啟程，之後依 300 / 900 / 2400 / 6000 / 15000 晉升銅牌、銀牌、金牌、白金、傳說冒險者。
- `MemberApp` 與 `MemberDex` 接入既有 `useGuildRank(profile.id)`；這支 hook 使用 5 分鐘快取的一次性 `getDoc`，沒有新增 Firestore 即時監聽、schema 或寫入。全站成就解鎖提示、紅點與圖鑑因此都能讀到同一份 `guildRep`。
- 舊版 8 個公會 XP／升階 AUTO id 改成明確白名單退役，不再使用「所有 `guild_*` 都退役」的粗略規則，避免新版公會成就被誤殺。
- 頭目／神話判定與頭目累積次數不再依賴 monster id 的 `_5` / `_6` 尾碼，改讀目前可玩 `MONSTERS` metadata，並以已存 `monsterDex.family/tier` 作相容 fallback。
- 七族討伐進度改為計算 common / rare / elite / fierce / boss / mythic 六個階級；同階級多隻怪不重複灌進度，treasure 寶箱族也能使用非舊式 id。

**重要決策**
- 暫時**不建立 252 怪全圖鑑成就**。雖然 `monsterExpansionCatalog` 已有 252 隻資料，但目前一般 `MonsterBattle` 仍從 legacy `MONSTERS` 戰鬥池選怪，`MemberMonsterDex` 也仍以 36 隻為可玩圖鑑。把 252 放進完成率會製造現階段無法完成的成就。
- 等未來戰鬥池與怪物圖鑑正式遷移到擴充目錄後，再啟用 252 收集／討伐終局成就。

**驗證**
- `achievementDexV3.test.js` + `monsterCardPack.test.js`：通過。新增覆蓋公會聲望門檻、舊公會退役、非標準 id 的 boss/mythic metadata、寶箱族六階級去重。
- `git diff --check`：通過。
- `CI=true npx react-scripts build`：Compiled successfully。

**踩坑提醒**
- ⚠️ 「資料目錄有 252」不等於「玩家現在能打 252」。成就完成條件必須跟實際 playable pool／持久化資料一致，不能只看 catalog 數量。
- ⚠️ 公會成就資料來源維持 `guildProfiles.rep`，不要重新接回舊 `adventurerXP/promotionDone`。

---

## 2026-08-12（🎖️ 成就圖鑑 V3 第一輪：19 類平鋪→9 大主題＋舊成就退役）

**改了什麼**
- `MemberDex` 的 19 個頂層分類不再全部塞在同一條手機橫向列，改成 **9 大主題 → 主題內子分類**：射手生涯／榮耀紀錄／戰鬥／世界王／冒險／收藏／貓小隊／貓貓村／養成。既有 `cat` id 完全不改，因此舊授予紀錄、NEW/seen key、排行榜完成度資料都不用遷移。
- 新增 `isActiveAchievement()` 退役層：舊定義與 id 保留，但 `retired/futureData` 不再出現在玩家圖鑑、不觸發新成就提醒，也不算進 `totalAll` 分母。
- 退役三批已失真的內容：① `adventurerXP/promotionDone` 的舊公會等級成就（新公會已改聲望／階級）；② `drop_rare~drop_mythic` 四顆沒有資料來源、永遠 false 的死成就；③ `dex_all36`／`dex_all6`／`mythic_all` 這些綁死舊 36 怪／六族世界觀的終局成就。
- 怪物卡改讀真正卡包單一真本 `getMonsterCardPackPool()`：完整擴充怪物目錄是 **252 隻**，一般怪物卡包只收 `encounter=normal`，目前是 **126 張、7 族**。`card_collect` 里程碑由舊 1/5/10/15/20 改為 1/10/25/50/100/全收，最後一階永遠跟卡包實際總數同步。
- `card_all6fam` 為了舊資料相容**保留 id 不改**，但顯示與判定已改成「七族全收」；族群討伐 tiered 也加入 treasure 寶箱族，不再把六族陣列寫死。
- 公會子分類目前顯示明確空態，下一輪才接新公會聲望／階級／遠征資料，避免這一輪新增 Firestore 讀寫。

**為什麼**
- 7/16 的圖鑑規劃建立了正確的 tiered 骨架，但一個月內怪物、公會、卡片都已大改；繼續在舊 36 怪／六族／Lv60 冒險者模型上加內容，只會讓玩家完成率越來越失真。
- 這輪先做「資訊架構與資料契約清理」，**完全不改 Firestore schema、戰鬥結算、掉落或公會存檔**，把風險限制在圖鑑顯示與純判定層。

**驗證**
- `achievementDexV3.test.js` + `monsterCardPack.test.js`：2 suites / **6 tests passed**。
- `git diff --check`：通過。
- `CI=true npx react-scripts build`：Compiled successfully。

**踩坑提醒 / 下一輪**
- ⚠️ `MONSTERS` 是 legacy/mixed 戰鬥目錄，不能拿 `MONSTERS.length` 當現代怪物總數；現行完整目錄看 `monsterExpansionCatalog`（252），一般怪物卡看 `getMonsterCardPackPool()`（126）。
- ⚠️ 退役成就不要直接刪 id。玩家 localStorage 的 seen/notified、舊資料與歷史畫面可能仍引用它；用 active filter 隔離最安全。
- 下一輪：以新公會 `guildProfiles.rep/rank` 設計公會成就；另重新設計「252 怪物圖鑑」要追蹤什麼，先確認 `monsterDex` 對擴充 monster id 的實際覆蓋，再決定是否做全收集終局成就。

## 2026-08-11（🐛 組隊地下城：探索地圖置頂＋最終王房結算驗證失敗）

**改了什麼**
- `TeamExpeditionBattle.jsx`：組隊探索的 `grid` / `branch` 主畫面不再顯示上方 `TeamRoomVotingBar`，地圖直接置頂；功能房與實際戰鬥需要的隊友資訊仍保留。
- 最終 Boss 戰鬥房不再於房主成功推進後 8 秒刪除，改為保留到全隊都完成個人遠征結算後才清除。
- `handleFloorDone` 另存 `finalBossBattleRoomId` 作為最終清理指標，不拿 `bossRewardBattleId` 代替，避免誤啟用 expansion reward。
- 王房戰利品錯誤訊息加入 Firebase error code，之後可直接辨認 `permission-denied`、`failed-precondition` 等實際原因。

**根因**
- 王房獎勵 Cloud Function 會回讀原 `dungeonRooms/{battleId}` 驗證該 member 是否真的參戰；舊流程卻在房主推進後 8 秒刪除同一份王房文件。較慢進入戰利品／結算頁的隊員因此失去驗證依據，造成領獎或進結算失敗。
- 已核對 Firestore rules：`dungeonRooms`、會員王房獎勵欄位與本人 inventory ownership 規則並未缺權限，因此沒有用放寬規則掩蓋問題。

**踩坑提醒**
- ⚠️ 最終王房在個人戰利品領取完成前，同時是 Cloud Function 的參戰資格證據，不能跟普通戰鬥房一樣提早清除。
- ⚠️ 共享遠征進度仍只由房主推進；每位玩家的個人獎勵仍由自己的 member 身份領取，兩條責任不可混在一起。

---

## 2026-08-07（🐛 考過裸弓後首頁看不到檢定：整期完成判定從「任一弓通過」改「三弓全過」）

作者：「我是教練帳號 + 我有考過裸弓 所以目前首頁看不到可以考檢定的部分」

**根因**（多弓種檢定的判定 bug）
- `MemberHome` 的 `certOpen` 與「年度檢定」卡用 `myCertState({ result:
  periodRecords.length>0 ? approved : ... })`——**只要本期有「任何一張」通過的證
  （考過裸弓），整期就被標成 approved**，首頁建議＋檢定卡整張消失。
- 但年度檢定支援**多弓種**（裸弓／獵弓／傳統弓三條獨立跑道，MemberScoring 的
  selectBow 可任選、notHigher 只擋同弓種刷分）——考過裸弓的人**還要去考獵弓、
  傳統弓**，卡片不能就此藏起來。

**改了什麼**
- `certStatus.js` 新增共用判定（純函式，三處共用同一份答案）：
  - `normCertBow`：recurve_full→recurve_bare 正規化（與送審資格鎖同規則，
    舊的 recurve_full 紀錄不會被當成沒考過）；
  - `CERT_SHOW_BOWS`＝三弓種清單；
  - `certPeriodApprovedBows`：本期已通過弓種集合；
  - `certPeriodAllDone`：**三種弓都有通過紀錄才算整期完成**。
- `MemberHome.jsx`：`certOpen` 改 `!certPeriodAllDone(...)`；檢定卡同邏輯（三弓全過
  才 `return null`），新增「已考 N/3 弓」chip（有 pending 仍顯示送審中）；
  每弓 best 用 `normCertBow` 過濾（recurve_full 併入裸弓欄）。
- `MemberApp.jsx`：練箭 nav 紅點改 `!certPeriodAllDone(certActive, certRecords)`；
  因此變成死碼的 `certMyResults` state＋其 Firestore 讀取 effect 一併移除
  （紅點改用成就偵測本來就載的 certRecords，不加讀取）。
- `MemberScoring.jsx`：本機 `RECURVE_NORM` 移除，改用共用的 `normCertBow`
  （reviewer：單一真源，避免兩處漂移）。
- `certStatus.test.js`：＋7 測（正規化、期別過濾、只過一弓不算完成、三弓全過才算、
  legacy recurve_full、無檢定/無紀錄不算）。

**驗證**：ESLint 0 error、certStatus 24 測＋全專案 **1849 測全過**、build 成功。

**踩坑提醒**
- ⚠️ **「有紀錄＝整期完成」是錯的，除非是「三支弓都有紀錄」**：多弓種檢定下，
  「任何一張通過」不能代表整期。日後再碰檢定狀態判定，一律用
  `certPeriodAllDone`（三處已統一），不要自己比 `periodRecords.length > 0`。
- ⚠️ **弓種 key 有正規化問題**：全配（recurve_full）與裸弓（recurve_bare）在送審時
  合併為同一檢定分類，舊資料可能存 recurve_full——比對「哪支弓考過」必須過
  `normCertBow`，否則舊紀錄被當成沒考過。
- ⚠️ 紅點資料來源換了：以前讀 `cert_my_results`（送審狀態），現在直接吃
  certRecords（已審核通過紀錄）——「pending 中」不再單獨亮紅點，但有未過弓種時
  仍亮（提醒去考其他弓），語意一致且省一次讀取。

---

## 2026-08-07（🎨 年度檢定會員端 UI 全面重做：白底舊卡 → 深藍玻璃擬態標準）

作者：「目前檢定的UI介面並沒有重新製作 請幫我按照現在的UI介面標準去重新設計」

**改了什麼**（三塊檢定會員端介面全部換成現行深藍玻璃擬態標準，MemberHome 同款）：
- 🏷️ **CompDetail**（MemberApp.jsx 內嵌元件）：白底灰框卡（`bg-white rounded-2xl
  border-gray-200`）→ 深藍玻璃 Card（檢定青 cyan 色條＋`MemberFeatureArt` 浮水印＋
  `SectionHeader`）＋ token 色（`var(--text-primary)` 等）。我的檢定成績卡改青綠漸層、
  排行列「我」高亮 rgba(34,211,238,.10)、報名名單 pill 青。一般賽維持琥珀色系。
- 🎯 **MemberScoring.jsx**：檢定流程全部 phase（confirm／selectBow／scoring／roundDone／
  result／notHigher）重做成深藍玻璃卡＋左色條＋浮水印；裝備選擇卡 hover 青色邊框、
  新建裝備青色虛線框、租借改三格 icon 卡；計分按鈕按分數帶分色（10 金漸層／8-9 紅／
  6-7 青）＋進度條青漸層。**邏輯一行未動**（送審、兩輪取高、notHigher 比對全保留）。
- 🏆 **MemberComps.jsx**：檢定卡青色左 accent＋青色標題；tab／filter pill 現代化
  （active＝青漸層＋深字、inactive＝玻璃）；打怪入口卡紫系＋左色條。

**為什麼**
- 檢定會員端還是舊版白底 UI（灰框、灰字），跟首頁/圖鑑/世界王等深藍玻璃風格
  完全兩個世界——玩家進檢定像進到另一個舊 App。

**驗證**：ESLint 0 error、全專案 **1842 測全過**、build 成功。

**踩坑提醒**
- ⚠️ **UI 重做時邏輯零變更是硬規則**：MemberScoring 全檔重寫，送審 payload／
  兩輪取高（setTimeout 等 allR 更新）／notHigher 比對／finalizePracticeShootingSession
  全部原樣搬移——reviewer 逐一核對確認無回歸。改 UI 檔案時用 diff 比對邏輯段。
- ⚠️ **檢定主色＝青色（cyan）**，一般賽＝琥珀——檢定是「正式考級」用冷色系莊重感，
  一般賽維持暖色；兩者在同一個 CompDetail 元件內用 `isCertBg` 切換，新增視覺時
  記得跟著 `th`（MemberScoring）／`isCertBg`（CompDetail）走。
- ⚠️ **深藍 token 只在 content-area 覆寫內有效**（`var(--glass-border)` 等定義在
  index.css :root）——這些頁面都在 content-area 內，直接用 token；貓貓村
  （no-override）不適用。

---

## 2026-08-07（🧭 首頁建議跳轉修正：battle/village 無效頁修掉＋貓貓村探索地圖建議）

作者：「但是我選了她建議的內容 他應該要跳到對應有功能的頁面為主 並且除了打怪
還有貓貓村的探索地圖阿」

**根因**：`suggestNextActions` 有兩個跳轉目標在 MemberApp **根本不存在**：
- `battle`（打怪頁其實是 `monster`）→ 點「去打怪練等」跳到空白頁；
- `village`（村目標其實在 `gacha`/貓村）→ 點「村目標還在進行」也跳到空白頁。

**改了什麼**
- `homeSuggestions.js`：
  1. villagegoal 建議 page `"village"` → `"gacha"`；
  2. battle 建議 page `"battle"` → `"monster"`；
  3. 新增 `boardOpen` 參數（預設 true）→ 有骰子時推「🎲 貓貓村探索地圖」
     （key:`board`、page:`board`，在 villagegoal 之後、battle 保底之前）——
     每日 15 顆骰子、擲骰冒險拿寶箱與素材。
- `MemberHome.jsx`：新增 `onOpenVillageBoard` prop；`boardOpen` 計算
  （`profile.villageBoard.dice` 沒資料視為可玩）；兩處建議按鈕對 `page==="board"`
  走 `onOpenVillageBoard`（fallback `onPageChange("gacha")`）。
- `MemberApp.jsx`：傳 `onOpenVillageBoard`＝`setGachaInitTab("board")`＋`setPage("gacha")`。
- `CatVillage.jsx`：`initialTab==="board"` 時初始進議事廳（council），並把
  `CouncilHall` 的 initialTab 設成 `"collect"`（探索地圖）；**只聚焦第一次**——
  之後玩家自己切 tab 回議事廳恢復預設「探險隊」分頁（reviewer nit）。
- `CouncilHall.jsx`：新增 `initialTab` prop（預設 `"expedition"`），
  `"collect"` 時直接開探索地圖分頁。
- `homeSuggestions.test.js`：＋3 測（battle→monster、villagegoal→gacha、board 建議條件）。

**為什麼**
- 建議清單的承諾是「每一筆都帶你去能做那件事的頁面」——page key 寫錯等於點擊即死路。
- 玩家日常除了打怪還有貓貓村探索地圖（大富翁）這條主要玩法線，建議清單卻只有打怪
  一個保底方向。

**驗證**：ESLint 0 error、homeSuggestions 12 測＋全專案 **1842 測全過**、build 成功。

**踩坑提醒**
- ⚠️ **`onOpenVillageBoard?.() || onPageChange("gacha")` 是陷阱**：`?.()` 回傳 undefined
  （函式沒回傳值），`||` fallback **永遠會執行**——等於每次點擊都跳兩次。要判斷
  prop 本身：`onOpenVillageBoard ? onOpenVillageBoard() : onPageChange("gacha")`。
- ⚠️ **建議 page key 要跟 MemberApp 的 `page===` 分支對得上**：MemberApp 的打怪是
  `monster`、村目標在 `gacha`（貓村）、探索地圖是 `gacha` 的議事廳 collect 分頁。
  新增建議時先 grep MemberApp 確認目標頁存在，不然又是「點下去空白頁」。
- ⚠️ AdminApp 也渲染 `MemberHome`（沒傳 `onOpenVillageBoard`）→ 探索地圖建議在那裡
  走 fallback 到 `gacha`（預設村莊分頁），是刻意的降級體驗。

---

## 2026-08-06（🌤️ 首頁「進行中」有項目也持續給建議＋年度檢定提醒加入建議清單）

作者：「進行中的部份 我選擇派出貓貓探險隊後 他就沒有任何建議了 我也沒有看到可以考檢定的提醒部分」

**改了什麼**
- 🐛 **「進行中」卡是二選一邏輯**：沒有任何進行中項目才顯示「今天可以做什麼」；
  一旦有項目（例如派出貓貓探險隊），卡片就只剩那一條倒數、**零建議**——
  玩家派出遠征後就沒下一步了。
- 修法（`MemberHome.jsx`）：
  1. 「進行中」卡**有項目時也在項目下方顯示「接下來還能做什麼」建議區**
     （最多 3 筆，吃同一個 `suggestNextActions`）；
  2. 建議區傳 `worldBossActive:false`/`worldBossCharging:false`/`villageGoal:null`
     ——這三項已在卡上／獨立卡顯示，不重複推薦；遠征槽與檢定照實傳。
- 🎖️ **年度檢定提醒加入建議清單**（`homeSuggestions.js` 新增 `certOpen` 參數）：
  有進行中檢定且我這期未通過 → 建議「年度檢定開放中・考到越高級三圍越強」
  → `comps`。放在世界王之後、遠征之前（限時活動優先）。空狀態與「接下來還能做什麼」
  都帶上。
- 抽出元件層級 `certOpen`（與下方獨立「年度檢定」卡同邏輯：active 且非 approved），
  兩處共用一份判定。

**為什麼**
- 首頁的承諾是「打開來永遠有事做」——但只在**完全沒進行中項目**時兌現；
  派出遠征這種最常見的「有事做」狀態反而變成死卡。檢定提醒原本只有獨立卡
  （在進行中卡＋世界王卡下方），玩家看不到。

**驗證**：ESLint 0 error、homeSuggestions 9 測（+1 檢定提醒）＋全專案 **1839 測全過**、build 成功。

**踩坑提醒**
- ⚠️ **`suggestNextActions` 永遠有保底「去打怪練等」**——「接下來還能做什麼」區塊
  因此**永遠不為空**（遠征全滿＋已報到＋無檢定時也至少有一條）。這是刻意的
  （首頁最怕沒方向），不是 bug；若覺得單獨一條很吵，日後可在該區塊過濾保底。
- ⚠️ **檢定提醒現在可能出現兩次**（進行中建議區的「🎖️ 年度檢定開放中」＋下方獨立
  檢定卡）。鑑於玩家原本完全看不到，重複是故意的；若日後覺得視覺重複，
  可在獨立卡顯示時抑制建議區的 cert 列。
- ⚠️ **`certOpen` 與獨立檢定卡內各自的 state 計算邏輯相同**（periodRecords→hasPending→
  myCertState）——目前兩處各寫一份，讀取一致；日後改檢定狀態判定記得同步兩處。
- ⚠️ 進行中卡的建議區**不能**再傳 `worldBossActive`/`villageGoal` 真實值——
  那些已在卡上顯示，傳了會重複推薦同一件事。

---

## 2026-08-06（🗺️ 首頁「進行中」重構：世界王冷卻/誕生徵兆拆成獨立卡片）

作者：「進行中 目前有世界王顯是冷卻中 導致貓貓探險隊跟其他功能顯示被吃掉了 這裡應該要分開」

**改了什麼**（`MemberHome.jsx`）
- 原本「進行中」卡內嵌世界王冷卻/誕生徵兆區塊（列向大按鈕：icon＋標題＋說明＋
  倒數或 2×2 進度格），冷卻中時很長——**把貓貓探險隊（遠征）跟其他進行中項目
  擠出螢幕**，玩家打開首頁只看到冷卻卡。
- 拆法：
  1. 「進行中」卡**只留真正在進行的項目**——世界王現身（wbActive）／遠征隊（expSlots）／
     村目標（villageGoal）；
  2. 世界王冷卻/誕生徵兆**拆成獨立卡片**（紫系 accent、🌙 冷卻倒數 或 🌌 本輪條件＋
     進度格），放在「進行中」卡下方、年度檢定之前；整張卡（含標題）可點 → 世界王大廳。
  3. 空狀態「今天可以做什麼」條件去掉 wbCharging、`suggestNextActions` 改傳
     `worldBossCharging:false`——世界王已有專卡，不重複推薦（避免同一件事出現兩次）。
- 冷卻倒數仍會 tick（`needTick` 含 `status==="resting"` 不變），拆出去不影響計時。

**為什麼**
- 世界王冷卻**不是玩家個人的進行中事項**（全服狀態），卻佔著個人進行中列表最肥的位置；
  遠征隊才是玩家自己的事，被壓到螢幕外＝首頁最重要的資訊看不見。

**驗證**：ESLint 0 error、homeSuggestions 8 測＋全專案 **1838 測全過**、build 成功。

**踩坑提醒**
- ⚠️ **MemberFeatureArt atlas 沒有 `worldboss` 圖案**（只有 home/adventure/training/
  village/inventory/booking/profile/learn/history/notifications/certexam/external/
  msgs/bowsetting/guide/collection）——用不存在的 name 會 fallback 到 home 圖；
  世界王卡改用 `adventure`。
- ⚠️ 空狀態建議（`suggestNextActions`）與獨立世界王卡是**兩件事**：拆卡後如果不把
  `worldBossCharging` 關掉，玩家會在「今天可以做什麼」看到「推進世界王降臨進度」
  **又**在下面看到世界王卡——同一件事講兩次。
- ⚠️ 世界王「現身中」（wbActive）**仍留在「進行中」卡**（那是個人真的要去打的活動），
  只有冷卻/蓄力（全服狀態）才拆出去——拆錯方向會把「去討伐」的入口藏起來。

---

## 2026-08-06（🎖️ 年度檢定會員端完工：首頁卡片＋我的期別選單＋練箭紅點＋檢定 ATK bug）

作者：「回到年度檢定（certStatus 已有 17 測試＋規則表單抽共用），繼續完成會員端報名與考試流程」

**改了什麼**（後台規則 tab 上一輪已完成，這輪補完會員端露出）
- 🏠 **首頁「進行中」檢定卡片**（`MemberHome.jsx`）：有進行中檢定（open/upcoming、取最新期別）
  才顯示；列出期別（`2026 上半年 ・ 18米`）、我的狀態（尚未報名／已報名・尚未上場／
  成績已送出・等待教練審核／本期已完成）、各弓種距下一級差 N 分（`certProgress`）。
  資料走 `cachedFetch`（`cert_active_comp` / `cert_my_results.<compId>.<uid>`，10 分鐘 TTL）——
  與「我的」、MemberApp 紅點**共用同一組快取 key**，首頁已抓過就 0 讀取。
- 👤 **「我的」年度檢定級別卡片**（`MemberProfile.jsx`）：改成**期別選單**（`certYearOptions`，
  新到舊，預設最新一期）＋選中期別的差 N 分行＋「考到越高級 ATK 加成越多（上限 +40）」說明。
  沒歷年成績但有進行中檢定 → 直接顯示該期門檻/差 N 分＋「前往報名年度檢定 ›」CTA
  （reviewer 抓的空狀態缺口）。差 N 分用**該場 certScores**（教練調過門檻也對得上）。
- 🔴 **練箭 nav 紅點**（`MemberApp.jsx`）：有進行中檢定且我這期還沒審核通過就亮
  （teal 點，與未讀紅點區別；尚未報名也會亮提醒去考），審核通過才熄。
  判定用 `myCertState({ registered, result }) !== "approved"`。
- 🐛 **修「考了檢定但三圍完全沒變」隱形 bug**：`upsertCertRecord` 以前**只存 score 不存 level**，
  而 `calcArcherStats` 讀的是 `r.level` → 檢定的 ATK 加成（級別 ×3，上限 +40）**永遠是 0**。
  修法雙層：
  1. `upsertCertRecord` 現在**補存 level**（審核時用該場 certScores 換算的級別優先，
     教練手動補錄時用預設門檻換算）；
  2. `calcArcherStats` 讀不到 `r.level`（舊資料）時**用分數現算**——歷史紀錄也立刻生效。
  `describeStatSources` 同步拆出「年度檢定」獨立來源列（statSources 測試驗證各段相加＝實際三圍）。

**驗證**：ESLint 0 error、certStatus＋statSources 23 測＋全專案 **1838 測全過**、build 成功。

**踩坑提醒**
- ⚠️ **`upsertCertRecord` 不存 level 是長期潛伏的隱形 bug**：寫入端與讀取端的欄位契約
  （score vs level）不一致，不報錯、三圍就是少一塊。凡「後台補錄 + 玩家顯示」共用的紀錄，
  兩端欄位要對齊；舊資料靠「讀不到就現算」的 fallback 補救。
- ⚠️ **級別換算有兩套門檻來源**：該場檢定賽的 `certScores`（教練可逐場調）vs 預設
  `CERT_DEFAULT_SCORES`。顯示「差 N 分」與審核寫 level 都要傳**該場**的，
  只有歷史期別（那場已結束）才退回預設。
- ⚠️ **審核通過才寫 certRecords**：`cert_my_results` 快取存的是 results 送審狀態；
  三處共用 10 分鐘 TTL，報名/送審/審核通過後畫面最多慢 10 分鐘（成本與即時性的取捨，
  維持與既有模式一致）。
- ⚠️ **紅點判定語意**：練箭紅點亮到「審核通過」才熄——玩家考完但教練還沒審，
  紅點會繼續亮（狀態寫「成績已送出・等待教練審核」），不是 bug。
- ⚠️ MemberApp 的 `certRedDot` 用 `certMyResults[0]`（`getMyCompResults` 已按 memberId 過濾），
  不用再 find——多弓種各一筆時任取一筆即可，紅點只看「有沒有審核通過」不細分弓種。

---

## 2026-08-06（🚀 佈署：排行榜＋卡片系統＋誕生徵兆＋地下城房圖＋世界王 全量上線）

作者：「完成後請幫我佈署上去」

**改了什麼**
- `npx vercel --prod` 一次帶上本輪全部 9 個未提交改動：`HomeLeaderboardBlock.jsx`
  （排行榜一般玩家名次）、`MemberHome.jsx`（誕生徵兆）、`WorldBossLobby.jsx`（大廳
  誕生徵兆卡片）、`DungeonStages.jsx`（地下城房圖快取）、卡片系統三檔
  （`cardTalentDisplay.js`＋`cardTalentDisplay.test.js`＋`TalentEffectPanel.jsx`＋
  `CardDetailSheet.jsx`）、`docs/second_brain/changelog.md`。
- Vercel 部署 `catarrow-9o5hcl309`（READY，Production）→ **Aliased
  https://student.catgroup.com.tw**。
- 線上驗證（browser-use 開正式網址）：「貓小隊射箭場-學籍系統」登入頁正常載入
  （email/password＋Google 登入都顯示），確認部署成功。

**踩坑提醒**
- ⚠️ **`*.vercel.app` 部署網址會被 Vercel 部署保護導到登入頁**（`vercel.com/login`）——
  那是正常的，正式入口是自訂網域 `student.catgroup.com.tw`；驗證要開自訂網域。
- ⚠️ **本 bash 環境對 `student.catgroup.com.tw` 的 curl 會 SSL error（exit 35）**，
  但 DNS 解析正常（→ vercel-dns）、HTTP 308 轉 HTTPS 正常——是環境 TLS 限制，
  不代表網址有問題；要驗證頁面用 browser-use（Chrome）最可靠。
- ⚠️ 未登入首頁只有登入頁，看不到排行榜等內容——「線上跟本機看到的不一樣」
  常常是沒登入；登入後才有會員首頁。

---

## 2026-08-06（🏆 首頁排行榜：一般玩家也看得到名次，沒名次顯示「暫無名次」）

作者：「一般玩家首頁沒有顯示排行榜 就算沒有名次也該要顯示暫無名次之類的 不一定要
顯示前幾名 XX名也可以啊 只要顯示最高排行的前三名就好 然後維持需要手動更新」

**改什麼**（`HomeLeaderboardBlock.jsx`）
- 原本 `computeMine` 只收「我入圍前五名」的榜（`idx < 5`）→ 一般玩家沒進任何榜的前五
  就只剩「還沒擠進任何榜的前五名」一句空話，等於沒看到排行榜。
- 改成 **任何名次都算數**：每個榜只要我有數值就有名次，取**名次最好的前三個榜**顯示
  （排序不變：名次越前越優先、同名次比參與人數）。
- 完全沒名次（15 個候選榜都無數值）→ 顯示「🏅 暫無名次——完成第一個挑戰，排行榜就會
  顯示你的名次！」（不再是「沒進前五」的空話）。
- **手動更新機制原封不動**：結果存 localStorage 無 TTL、只有按「🔄 更新排名」才重讀
  （第一次本機無快取會自動抓一次）、「查看全部 →」進排行榜頁維持每次重算。

**為什麼**
- 排行榜是首頁的成本大戶（算榜要讀整個 members 集合），所以之前刻意只給「有面子的人」
  看。但「看不到名次」對一般玩家等於沒有排行榜——玩家要的是「我到底排第幾」，
  幾名都行；成本設計（手動更新）維持不變就沒有讀取量問題。

**踩坑提醒**
- ⚠️ 排行區塊的成本控制是「**顯示層省讀取**」：算一次榜很貴（全集合），但算完存
  localStorage 無 TTL、不按鈕不重算——**以後若想加「自動更新」或「每秒刷新」
  就是在挑戰這個設計**，別為了即時性把首頁讀取量打回去。
- ⚠️ `rankBoard` 只回傳 value>0 的人（有參與才算數）——「沒名次」＝15 個候選榜
  全無數值，不是「最後一名」；「最後一名」是「第 N 名／N 人」，照樣顯示。
- ⚠️ 排序平手規則（同名次比參與人數）是既有的：極端情況「第 3 名／3人」（小榜末位）
  可能排在「第 5 名／300人」前面——reviewer 標記過，作者以名次為主要訊號，維持現況。

---

## 2026-08-06（🎴 卡片系統：英文名漏譯修掉＋異常效果寫出真實公式）

作者：「卡片系統裡面有一些沒有成功翻譯 它顯示的是英文名稱 以及各種效果是不是可以
寫一下具體真實效果跟計算公式? 就跟現在怪物會中毒但到底傷害怎麼算? 流血? 虛弱?」

**① 英文名稱的三個來源（全修）**
- `cardTalentDisplay.js` 的 `EFFECT_DISPLAY` 對照表**缺 3 個天賦鍵**：`firstStrikePct`
  （蓄勁）／`finisherPct`（終結）／`venomPct`（淬毒）→ `TalentEffectPanel` 直接印英文 key。
- `calcCardCombatEffects` **永遠**塞 `total.inflict`（即使空物件）→ 面板對每個玩家都印
  「• inflict [object Object]%」，且「尚未裝備卡片」空狀態永遠不出現（hasAny 誤判）。
- `CardDetailSheet` 的 `FAMILY_LABEL` 缺 `worldboss` → 世界王卡顯示英文「worldboss」。
- 修法：補 3 個對照、`inflict` 從效果列排除＋專區顯示、`worldboss:世界王`；
  **新增防回歸測試**（每個 TALENT_CAPS 鍵都必須有中文顯示名，以後再漏直接紅）。

**② 異常狀態寫出真實公式（數字與戰鬥同源）**
- 新增 `cardTalentDisplay.js` 顯示 helper（**零抄數字**，全部從 `STATUS_STRENGTH` /
  `MONSTER_STATUSES` 讀，改強度只動 `cardTalents.STATUS_STRENGTH` 一處）：
  - `describeStatusFormula(id)`：中毒=每回合 -3% 最大HP（不致死）／灼燒=每回合 -12% 你的ATK／
    流血=每回合 -8% 你的ATK ×層數（最多5層）／破防=怪物DEF -12%／虛弱=怪物ATK -12%／
    冰凍=本回合無法放技能／麻痺=50% 機率擋反擊。
  - `describeInflict`（deck 的 inflict → 顯示清單）、`describeAllStatuses`、
    `describeStatusProcRule`（9 環以上判定；一般上限 35%、控場 12%）。
- `TalentEffectPanel` 新增兩塊：**☠️ 可施加異常**（每種狀態的機率％＋持續回合＋公式）＋
  **❓ 異常狀態說明**（可收合，七種狀態全列出公式＋「同種不疊加、重複命中刷新回合數
  取較強強度、流血例外會疊層」規則）。
- `CardDetailSheet`：淬毒天賦卡在「天賦」下方多一行「☠️ 族系異常：{公式}」
  （族系→狀態對應走 `FAMILY_STATUS`）。

**驗證**：新增 `cardTalentDisplay.test.js` 5 測（含防英文 key 回歸）；全專案 **1838 測全過**、
ESLint 0 error、build 成功（bundle 用 `\uXXXX` 還原法驗證新字串全在線）。

**踩坑提醒**
- ⚠️ **顯示層的 key→中文對照表只要漏鍵，UI 就直接印英文 key 給玩家看**（不報錯）。
  以後新增天賦/效果鍵，**第一時間補 `EFFECT_DISPLAY`**，測試會盯（TALENT_CAPS 全鍵檢查）。
- ⚠️ **`calcCardCombatEffects` 的 `inflict` 是物件不是百分比**——任何「把所有 key 攤開」
  的顯示都要先把它排除，否則 `formatEffectValue` 印出 `[object Object]%`。
- ⚠️ **顯示公式不要在顯示層抄數字**：`STATUS_STRENGTH`（中毒3%/灼燒12%/流血8%/破防12%/
  虛弱12%/麻痺50%）是唯一真本，顯示從它讀，改強度才不會兩邊漂移。

---

## 2026-08-06（🐛 MemberApp 435 行 eslint 錯誤真因：.eslintcache 重播陳年錯誤）

作者：「然後我在後台都會看到這個錯誤 幫我修正 ERROR [eslint] src\pages\MemberApp.jsx
  Line 435:11: Definition for rule 'react-hooks/exhaustive-deps' was not found」

**完整真相（用「清快取→build 成功、留快取→build 失敗」重現後挖到根）**
- CRA 5 的 build/dev 的 eslint（`eslint-webpack-plugin` 3.2.0）帶 `cache:true`，
  快取在 `node_modules/.cache/.eslintcache`（`eslint/lib/cli-engine/lint-result-cache.js`
  的 `file-entry-cache`，**metadata 策略＝size+mtime+configHash 都相同才命中**）。
- `MemberApp.jsx` 在陳年 build 裡（435 行還寫著 `// eslint-disable-line
  react-hooks/exhaustive-deps` 的時代）被快取成「errorCount:1」的結果——而 dev server 的
  base config（`eslint-config-react-app/base.js`，只載 `plugins:['react']`）**沒有
  react-hooks rule**，所以那顆錯誤就是「Definition for rule ... was not found」。
- 後來移除 directive 的編輯**恰好沒改變檔案的 size（72906）**，快取的
  size+mtime 比對判定「檔案沒變」→ **每次 lint 都直接重播那顆舊錯誤，根本不重新檢查**。
  （鐵證：快取訊息 `endColumn:61`＝舊檔的完整註解長度；現在 435 行只有 32 字元。
  用 plugin 同樣選項＋cache 跑 `lintFiles` 精準重現 errorCount:1。）
- **修法：`rm -rf node_modules/.cache` 一次就夠**——重播源頭清掉後全新 lint 乾淨
  （MemberApp 新快取 errorCount:0、build Compiled successfully）。src 已零
  react-hooks directive，**不會再產生新的錯誤進快取**，所以這是永久解，
  不是治標。
- ⚠️ 舊 dev server（`npm start`）若還開著，**要重啟**：它記憶體裡的 webpack 狀態
  還握著舊錯誤，且可能把舊錯誤寫回快取。重啟＋清快取＝徹底乾淨。
- `ESLINT_NO_DEV_ERRORS=true` 只降級「不擋編譯」（`failOnError` 僅 dev 生效）、錯誤文字
  仍會顯示（`emitError` 未設）；`DISABLE_ESLINT_PLUGIN=true` 連 production eslint 都關——
  都不是乾淨解法，不採用。

**踩坑提醒（本次修正了三輪 session 都誤判「清快取只是治標」的講法）**
- ⚠️ **永遠不要寫 `// eslint-disable-line react-hooks/...`**——dev server 的 base config
  不載 react-hooks plugin，寫了必報「Definition for rule not found」。要壓掉用裸
  `// eslint-disable-line`。
- ⚠️ **看到「Definition for rule X was not found」且 grep 不到 X 的 directive**：
  先 `rm -rf node_modules/.cache` 再 build——這是 `.eslintcache` 在重播陳年錯誤，
  **不是 node_modules 壞掉、不是 eslintrc 問題、也不是程式碼問題**。
  判斷方法：快取裡該檔條目 `errorCount>0` 但訊息的行號/欄位對不上現在內容
  （`endColumn` 比實際行長）＝舊內容被重播。
- ⚠️ **metadata 策略的快取不會偵測「同 size 的內容替換」**：只要檔案字節數不變，
  size+mtime 判定就以為沒變。這是這類重播能存活的根本原因。
- ⚠️ CRA 5 的 eslint 設定藏在 `eslint-config-react-app/base.js`（不是
  `react-scripts/config/eslint.config.js`，那個檔不存在）；build/dev 的 eslint
  由 `eslint-webpack-plugin` 跑，帶 ESLint 內建快取。
- ⚠️ 驗證「是否真的重播」的標準動作：用 `new ESLint({cache:true, cacheLocation:同一路徑,
  baseConfig:同一份})` 對該檔跑 `lintFiles`——有錯誤＝重播；不帶 cache 再跑一次
  （乾淨）＝確認檔案本身沒問題。

---

## 2026-08-06（世界王誕生徵兆卡片同步到大廳：冷卻倒數＋本輪條件）

作者：「世界王誕生徵兆卡片在世界王大廳也顯示冷卻倒數與本輪條件（目前只有首頁有）」

**改了什麼**（`WorldBossLobby.jsx` 的無活躍 Boss 卡片）
- 大廳原本就有進度條＋🎯 標記（`activeSpawnTypes` 淡化沒抽中的），但**缺冷卻倒數**——
  resting 期間畫四條全 0 進度條，正是「進度沒推進、以為壞了」的元兇重現。
- 現在跟首頁卡片同一套邏輯：
  1. 新增 `nowMs` state + 30 秒 ticker（只在 `spawnCycle?.status === "resting"` 時跑，
     跟首頁 `needTick` 同法）；
  2. 卡片本體改 IIFE 兩態：
     - `evaluateWorldBossSpawnCycle(...).reason === "resting"` → 只顯示
       「冷卻剩餘 X 小時 Y 分」（琥珀色大字，floor 不會出現「X 小時 60 分」）
       ＋「本輪條件：{label}（其他行動不計）」小字；
     - 否則維持原四條進度條（🎯 標亮抽中的那一條）。
  3. `describeSpawnCycle(spawnCycle, nowMs)` 帶 nowMs 進去（共用函式本來就有此參數）。

**踩坑提醒**
- ⚠️ **「顯示冷卻倒數」必須附 ticker**：`restEndsAtMs - Date.now()` 算一次是不會動的數字，
  沒 setInterval 的話玩家看到的倒數永遠停在進場那一刻。ticker 只掛在 resting 期，
  冷卻結束狀態切回 charging 自動清掉（`cycleResting` 變 false）。
- ⚠️ **ticker 的開關條件與卡片判讀要一致**（ticker 用 status、卡片用 `ev.reason`）：
  兩者理論上會短暫不一致（文件說 resting 但 restEndsAtMs 已過），無害、下次訂閱快照自會對齊，
  別為此把 ticker 依賴 nowMs 重跑。
- ⚠️ 首頁與大廳的誕生徵兆顯示邏輯現在**兩處各寫一份**（MemberHome 的 rowStyle 卡片 vs 大廳的
  tailwind 卡片）——都只讀 `worldBossSpawnCycle.js` 的共用判讀函式，改規則只動那支就兩邊同步；
  若日後要統一視覺再抽共用元件。

---

## 2026-08-06（🐛 誕生徵兆進度不動不是 bug 是休息期；地下城房圖重複 404 讀取修掉）

作者：「檢查世界王誕生徵兆那裏為什麼進度沒有推進 還是首頁讀取錯誤? 以及地下城是不是
房間圖片每次進去都會讀取? 因為有玩家出去在進來後有機率房間是破圖的」

**① 世界王誕生徵兆「進度沒推進」——查了線上 Firestore，不是首頁讀取錯誤**
- 線上真相：`worldBossSpawnCycles/current` 存在，status=`resting`（王約 2.7 小時前被擊倒，
  8 小時冷卻中），progress 全 0；`worldBossSpawnOps` 其實一堆操作紀錄，但雲端
  `contribute()` 對冷卻期**刻意忽略**（`Date.now() < restEndsAtMs → ignored:"resting"`）。
- 另一個隱形雷：這輪 `requiredType` 只抽中 `monsterKills`，evaluate 只認那一種——
  但卡片畫出四條進度條，玩家射箭／擲骰永遠看不到數字動。
- 修法（`MemberHome.jsx`）：卡片改成兩態——**冷卻中**顯示 🌙＋`restEndsAtMs - nowMs` 倒數
  （needTick 納入 resting，30 秒 tick；倒數用 `Math.floor`，ceil 會顯示「5 小時 60 分」）；
  冷卻結束後顯示「本輪條件：擊倒怪物（其他行動不計）」＋只標亮 requiredType 那條（★），
  其餘變暗。舊週期文件沒 `requiredType` → 退回舊顯示（全體行動都會累積）。
- 作者定案：**維持休息期凍結**（冷卻的設計意義保留），只把狀態講清楚。

**② 地下城房間圖片每次進去都重複讀取＋偶發破圖**（`DungeonStages.jsx`）
- 根因：輕量房（quick_event/coin_pouch/mini_chest/scout/empty）**永遠沒有 family 變體圖**
  （檔案清單實證：ghost/insect/mountain/exam/temple/workplace 六族全缺），但 `RoomTile`
  的圖片鏈每次都先試 `room_${family}_${type}.webp` → 404 → 才退到通用圖。
  每次進出地圖（remount）重複 404 探測＝頻繁讀取的兇手；網路一抖就破圖。
- 修法（雙層）：
  1. 靜態跳過——`LIGHTWEIGHT_ROOM_TYPES` 集合內的房型**根本不進 family 變體**（確定性，零 404）；
  2. session 快取——模組級 `roomArtCache`（family|type → 已知可用 src）＋ `roomArtBad`（已知 404）。
     `onLoad` 記好圖、`onError` 只黑名單 **family 變體**（確定性 404）；通用圖失敗多半是暫態
     網路，**不永久封鎖**，下次進場會重試（reviewer 抓的關鍵點）。

**驗證**：ESLint 0 error、地下城/首頁 313 測＋全專案 1833 測全過、build 成功。
bundle 驗證用 `\uXXXX` 還原法（見下方踩坑），新字串全部在線。

**踩坑提醒**
- ⚠️ **「進度沒推進」先查線上文件再改程式**：用 `serviceAccountKey.json`（backup 腳本同款）
  直讀 Firestore 一次定案——是「貢獻沒到」（ops 空）還是「到了但被忽略」（ops 有、progress 不動
  ＋ status=resting）。這次是後者，根本不是 bug，亂改伺服器邏輯反而會破壞冷卻設計。
- ⚠️ **restEndsAtMs 是毫秒數值不是 Timestamp**（`buildCycle` 用 `Number()` 存）——
  倒數 `Number(worldBossCycle.restEndsAtMs) - nowMs` 才對，別拿去餵 `tsToMs`。
- ⚠️ **倒數分鐘用 `Math.floor` 不是 `ceil`**：ceil 在整點前一刻會顯示「X 小時 60 分」。
- ⚠️ **「圖片鏈嘗試不存在檔案」要分兩類**：確定性缺圖（輕量房 family 變體）用靜態跳過；
  暫態失敗（通用圖偶發 404）不能永久黑名單——`onError` 只封鎖確定缺的那張，
  其餘留給下次 mount 重試，否則一次網路抖動＝整場卡空圖。
- ⚠️ **minify 會把中文轉 `\uXXXX` 逸出、變數名改名**：驗證 bundle 有沒有某段程式，
  要把中文轉成逸出序列再 grep（寫支小 script 用 `charCodeAt(16)` 轉），
  直接 grep 中文會誤判「沒部署」（本次先誤判一輪）。

---

## 2026-08-06（🐛 世界王擊倒後三 bug：舊版動畫、沒有領取按鈕、登入不會自動播）

作者：「世界王擊倒了 但撥放的是舊版的擊倒動畫以及沒有世界王擊倒領取獎勵的按鈕
還有目前世界王被擊倒依然第一次撥放需要自己去按世界王介面 而不是登入就會顯示」。

**① 擊倒播舊版動畫**（`WorldBossLobby.jsx`）
- 根因：大廳擊倒後彈出的是舊版 `KillScreen`（`☠️ BOSS 擊倒！`），新版 `RaidKillCutscene`
  只在戰鬥內播；全服重播 overlay（z-1200）被大廳（z-9999）蓋住，玩家根本看不到。
- 修法：大廳訂閱 status 小文件拿 `killReplay`，`KillScreen` 有 payload 就先播新版
  `RaidKillCutscene`（replay 模式）再進領取面板；無 payload（舊系統擊倒）才退回舊動畫。
  `killReplay` 比 `killEvent` 晚一步到 → `useEffect` 在 payload 到達時接上播放。

**② 沒有領取獎勵按鈕**（`WorldBossLobby.jsx`）
- 根因：`canClaim` 檢查 `pendingEvent?.eventId`，但 `getPendingWorldBossRewards` 回傳的
  WB 文件只有 `id`、沒有 `eventId` → 永遠不成立 → 按鈕不出現。
- 修法：統一 `pendingEventId = pendingEvent?.eventId || pendingEvent?.id`（**先 eventId 後 id**：
  `getLatestWorldBossKill` fallback 回傳的是 WBH 歷史文件，`id` 是歷史紀錄 id、`eventId`
  才是活動 id；順序反了 fallback 路徑會拿歷史 id 去領 → 「活動不存在」）。
  所有比對（KillScreen canClaim、claimPendingReward、底部兩個按鈕）都改用 pendingEventId。

**③ 登入不會自動播擊倒演出**（`MemberApp.jsx` / `raidKill.js`）
- 根因 a：世界王訂閱被 `liveExtras` 成本節流擋住（restricted 以上整個訂閱停掉）；
  根因 b：`KILL_REPLAY_FRESH_MS` 只有 10 分鐘，隔幾小時登入就「不新鮮」不播；
  根因 c：擊倒當下若玩家在世界王頁面，全服 overlay 被大廳蓋住看不到，卻把
  `wb_kill_seen_at` 吃掉 → 登入後永遠不再播。
- 修法：訂閱移出 liveExtras 節流（status 文件極小、本就是設計成常駐訂閱）；
  freshness 放寬到 **24 小時**；`pageRef` 判斷——世界王頁面時不消耗 seen（大廳自己播），
  大廳播完也同步寫 seen，避免跨 session 重複。

**驗證**：世界王 488 測全過、全專案 1833 測全過、ESLint 0 error、build 成功。
（build 第一次誤報 `react-hooks/exhaustive-deps` 找不到——是 `.eslintcache` 殘留，清掉就好。）

**踩坑提醒**
- ⚠️ **同一份資料的兩種來源欄位名不同（id vs eventId）是隱形雷**：比對前先確認
  物件來自哪個 collection——WB 事件文件用 doc id、WBH 歷史文件用 `eventId` 欄位。
- ⚠️ **z-index 疊層：MemberApp 的全服 overlay（1200）在大廳（9999）底下**——
  在世界王頁面播全服重播＝播給自己看但看不到，還白白消耗 seen。
  哪層播、哪層消耗 seen 要對齊，否則「登入不播」比「播兩次」更難查。
- ⚠️ **「看過」標記要跟真正播出同步**：overlay 播了、大廳播了、都得寫 seen，
  漏一處不是重播就是永不播。

---

## 2026-08-06（🐛 世界王三 bug：最後一局重整拿不到獎勵、半靶環值 1~X、傷害被砍半）

作者：「世界王 BUG：①最後一局重整會被跳過收工結算、拿不到上次獎勵；②半靶 SVG 顯示 1~X
（紙上其實是 6~X）；③打到 9~X 傷害依然很低——落點要強制 10＋加成、非弱點照原本公式、
10 分必爆擊、X 是爆擊＋破防點數」。

**① 最後一局重整跳過結算**（`raidResume.js` / `RaidScreen.jsx` / `RaidGate.jsx`）
- 根因：最後一局 `playResolved` 就 `clearRaidProgress()`，而 `handleFinish` 也在送出前清——
  `attackWorldBoss` 是非同步的，存檔在獎勵入帳前就消失，重整回來 resume 是 null。
- 修法：**完場但不結算**的狀態現在可以存（`settled:false`）＋帶結算快照
  （killInfo/reward/killPayload，重整後不會重 roll 獎勵）；`handleFinish` 改成
  **送出成功後才清檔**；resume 恢復完場時自動補送（`raidRoundResults` 對空 roundsRef
  fallback 到 totals.damage，總傷害不丟）。
- ⚠️ 邊際案例：第一次送出其實成功、只是重整時來不及清檔 → 重送會撞每日守衛
  （「今天已經攻擊過了」）。該 rejection **＝獎勵已入帳**，此時也要清檔，
  不然「待領獎勵」卡片會像殭屍留 6 小時。

**② 半靶顯示 1~X**（`RaidTarget.jsx`）
- 根因：放大鏡用 `standardScoreFromRatio`（1~10 跨靶紙標準分），半靶紙上實際印 6~X。
- 修法：抽 `paperRingOf(format, ratio)` 共用 helper，放大鏡與 `commit` 顯示同一套
  靶紙實際環值（半靶 6~10、X 滿靶）。

**③ 傷害公式**（`raidFlow.js` / `raidTimeline.js` / `RaidScreen.jsx`）
- 根因：`RAID_NORMAL_DAMAGE_SCALE = 0.5` 把所有一般傷害砍半——非弱點 9~X 命中
  照原本公式算出來再 ×0.5，自然「打中間傷害還是很低」。
- 修法：**移除砍半**，非弱點 1~10 分照原本公式（`calcWorldBossArrowDmg`）；
  新增紙面爆擊：非弱點 10 分 → ×1.5 必爆、X → ×2.0 ＋破防點數（`RAID_X_BREAK_POINTS=2`）；
  arrow log 帶 `crit`/`xBreak`，volley 聚合帶 `crits`，演出用弱點等級特效顯示。
  弱點圈那箭維持「強制滿分＋固定加成」，不疊爆擊。

**驗證**：世界王 488 測全過、全專案 1833 測全過、ESLint 0 error、build 成功。
新增 4 測（resume 完場未結算可恢復、10 分爆擊、X 爆擊＋破防、非弱點不再砍半）。

**踩坑提醒**
- ⚠️ **任何「打完就清存檔」的流程都要先確認送出是否為同步**。非同步送出
  （寫 Firestore／發 API）期間清檔，玩家一重整就是「白打一場」——
  存檔要留到送出**成功**為止，失敗更要留著給重整補送。
- ⚠️ **resume 恢復完場時 roundsRef 是空的**（重整後新陣列）——結算送出要能
  從 final state fallback（totals.damage），不然補送會送出 0 傷害。
- ⚠️ **跨靶紙的標準分（1~10）只能用在比較與紀錄，不能顯示在靶面**——
  玩家看的是「紙上印的那圈」，半靶的 6~X 印在紙上，顯示 1 環會讓記分對不上。
- ⚠️ **驗證舊系統 WorldBossAttack 時注意**：本次只改了新版 raid（`src/worldboss/`），
  舊版 `src/components/worldboss/` 一行未動（訪客/兒童走舊版，若也要新公式需另案）。

---

## 2026-08-06（線上與本機不一致：265 個未提交變更沒進部署）

作者：「佈署了 但為什麼跟我本機看到的不一樣？」

**根因**：先前佈署只 commit 了地下城的 25 個檔案（`1b7c8b0`），但工作區還有 **265 個
未提交的變更**（訪客評價工作流、世界王改版與音效重寫、首頁改版、guestReviews functions、
firestore 測試、第二大腦等）——這些全部沒進 origin/main，線上自然跟本機不同。

**處置**：`git add -A` 全量 commit（`7101492`，247 個檔案）＋ push，Vercel 自動部署到
`catarrow-hzurfe0tu`（READY）。驗證新 bundle（`main.3d4a0a1e.js`）含 `GuestReviewPage` /
`GuestReviewByToken` / `GuestReviewComplaintReply` / 「評價」UI 字串，且地下城新功能
（陷阱房主決定、inlineToast、瞭望點）未回歸。

**踩坑提醒**
- ⚠️ **commit --only 會造成線上與本機不一致**：只提交部分檔案很危險——線上會缺你
  本機已寫好但沒 commit 的功能，而且不會有任何錯誤提示，只能靠人眼對比。
  要部署「本機現況」就 `git add -A` 全量提交。
- ⚠️ 驗證線上 bundle 有沒有某段程式，**先還原 `\uXXXX` 逸出**（minify 把中文轉逸出，
  直接 grep 中文會誤判「沒部署」）——本次線上其實有全部功能，第一輪搜尋誤判了。

---

## 2026-08-06（🐛 輕量房可重複踩刷錢刷能力——踩過沒擋 cleared）

作者：「小房間沒有防止重複踩 我這樣來回可以瘋狂刷錢跟能力」。

**根因**：輕量房分流（`handleCellClick` → `resolveInlineStep` / `resolveTeamInlineRoom`）
**只檢查房型、沒檢查 `room.cleared`**。結算後房間雖然標記清除，但踩回去還是會再結算
一次 → 同一間 `coin_pouch` / `mini_chest` / `quick_event` 來回走動無限領取。

**修法（三層防護）**：
1. 踩踏分流加 `!room.cleared`（單人 `handleCellClick`、組隊 `handleCellClick` / `enterExplorationRoom`）
2. 結算函式內部再加 `if (!room || room.cleared) return`（`resolveInlineStep` / `resolveTeamInlineRoom`）
3. 組隊端加 `inlineResolvingRef` 在途鎖：Firestore 寫入是 async，連點同一格會在
   cleared 同步回來前觸發第二次 resolve → 重複發獎；ref 鎖到寫入完成才解

已清除的輕量房踩上去仍可通行（純移動），只是不再結算。重量房原本就走「進入」按鈕
（`canEnter` 需 `!cleared`），沒有此漏洞。

**踩坑提醒**：
- ⚠️ 只要新增「踩到即結算」的互動，**第一件事就是加 cleared 守衛**——
  這類互動不像全螢幕房有「進入」按鈕當天然防重。
- ⚠️ 組隊端任何「本地算完寫 Firestore」的流程都要配在途鎖：
  async 寫入期間同一個操作被觸發兩次，第一次的結果還沒同步回來，第二次照樣執行。

---

## 2026-08-06（地下城地圖重製完工：輕量房原地結算、事件全員投票、陷阱房主決定）

作者：「新型的小房間應該直接在大地圖畫面就顯示訊息，不用再另外跳到一個畫面點選繼續探索」
→ 配合 `.trellis/tasks/08-06-dungeon-map-rework/`，把 CLAUDE 遺留的 UI 分流補完。

**改了什麼**
- 🔹 **輕量房（小房間）踩到即結算**：`quick_event` / `empty` / `coin_pouch` / `mini_chest` /
  `scout` 五種房型踩上去**直接在地圖格子原地結算**——套效果、彈浮動訊息（icon＋標題＋
  效果徽章，上浮 1.6s 淡出）、播音效，**不跳出全螢幕、不顯示「進入」按鈕**。
  - 單人：`DungeonExpedition.handleCellClick` 移到輕量房直接 `resolveInlineStep`。
  - 組隊：房主本地算效果 → 寫 `roomResolution:{kind:"inline_room"}` ＋ members updates，
    全員訂閱到就播同一個浮動反饋。
  - `scout` 額外揭開半徑 2 迷霧；迷你寶箱給降一階素材（T1 不降）／藥水／箭露。
- 🔹 **地圖規則層**（CLAUDE 已完成，本次驗證）：GRID_SIZE 5→7、配額制（第1層 13／第2層 14
  間重量房，其餘輕量房填滿）、樓梯不再必在角落、`general_event` 房型廢除（併入 quick_event）。
- 🗳️ **特殊事件改全員投票**：選項解除房主限制，每人一票、即時顯示票數；票多者套用到全隊，
  **平票時房主那票權重 ×2**（`dungeonEventVotes.js` 純函式，13 測）。全員投完房主自動結算，
  結算後清 `roomConfirms` 讓大家看完結果再按「繼續探索」二次確認（結果不會一閃即逝）。
- 👑 **陷阱房押大小收回房主**：隊員只看到陷阱資訊＋「房主正在判斷…」，不再全員亂押。
- 🐛 順手修：`EXCAVATION_FLOOR_CONFIG.roomTypes` 移除 `general_events`（死設定，本無產生路徑）；
  `dungeonInlineRooms` 對 `random` 效果池預先擲定，浮動訊息顯示的數值＝實際套用的數值。

**為什麼**
- 所有房間互動重量一致是疲乏根源：連「+5% ATK 的一般事件」都要開全螢幕舞台、點兩次按鈕。
  拆兩級之後「要認真應付的房間」反而更少（重量房維持原數量），探索感卻變濃。

**踩坑提醒**
- ⚠️ **輕量房分流要放在 `handleCellClick`（踩到即結算），不是只放 `enterRoom`**：
  只放 enterRoom 的話玩家還是要先看到「進入」按鈕再點一下，體驗跟原來的疲乏只差一點。
  而且 `GridMapStage.canEnter` 必須排除輕量房型，否則按鈕還是會出現。
- ⚠️ **全員投票結算的在途鎖**：全員投完的瞬間會連續收到多個 Firestore 快照，若每個快照都觸發
  `resolveTeamEvent`，`random` 效果會被 roll 兩次、金幣道具可能重複入帳。用 ref 在途鎖擋掉。
- ⚠️ **結算成功後要清 `roomConfirms`**：投票時 confirm 跟「看完結果再確認」是兩件事，
  不清的話結果面板一出現就會被自動推進蓋掉，隊員根本看不到自己投票投出了什麼。
- ⚠️ 單人與組隊的音效要同規格：組隊端 `buildTeamEventResolution` 不播音效，
  浮動反饋的房型音效要另外在訂閱 `inline_room` 的地方播（quick_event 依效果正負選 buff/debuff）。

---

## 2026-08-05（訪客登入權限、兩個組隊卡死、年度檢定開工）

**改了什麼**
- 🔑 **訪客登入 Missing or insufficient permissions**：`firestore.rules` 的 members update
  兩支分支都寫死「uid 不可變」、白名單也沒有 `uid`，但 `guestAuth.js` 登入成功後一定會把
  這次的 Firebase uid 寫回文件 → 每次登入都被拒。規則放寬成「保持不變**或**換成登入者
  本人的 uid」，白名單補 `uid`／`hasPassword`／`socialUid`／`socialProvider`。
  程式端把寫回動作抽成 `touchLoginUid()` 並包 try/catch。
- 🕳️ **地下城組隊休息區第二次選不了**：`finishFunctionRoom` 漏清 `restResults`
  （`handleForceAdvance` 有清），殘留值讓 `DungeonRest` 判成已完成 → 全隊卡在等待房主。
- 🎴 **貓貓探索地圖命運/機會卡卡住無法解**：`stuckLong` 的條件不含卡片狀態 → 房主的
  強制推進按鈕不出現；加上卡片是 z-215 全螢幕遮罩，按鈕出現也點不到 → 在遮罩內補一顆。
- 🎖️ **年度檢定**開工（步驟 1-3）：`certStatus.js` 純函式 + 17 測試、`CertRuleFields.jsx`
  規則表單抽共用。規劃在 `.trellis/tasks/08-04-annual-cert-revive/`。

**為什麼**
- 前兩個是同一種病：**同一件事有多條路徑，其中一條的清理清單漏了欄位**。
  找 bug 時先比對「另一條路徑清了什麼」，通常答案就在那裡。
- 年度檢定「沒人考」不是功能缺——整條流程都在，是上半年那場結束後沒開新的，
  且會員端沒有任何「現在可以考／差幾分升級」的露出。

**踩坑提醒**
- ⚠️ `firestore.rules` 改完**一定要手動貼上 Firebase Console**（CLI 403），
  沒貼＝沒生效；訪客登入雖然不再中斷，但 uid 寫不回去，之後進遊戲會找不到人。
- 全螢幕 overlay（`fixed inset-0 z-[...]`）裡的死結，**解卡按鈕必須放在 overlay 內**，
  放在底層工具列等於沒有。

---

## 2026-08-04（線上預約價目表修正：2/3 小時每筆少收 50）

**改了什麼**
- `src/lib/bookingPricing.js::BOOKING_PRICES` 的 2 小時／3 小時價格全部 +50，改回官網公告價：
  一般成人 350／**700**／**700**、兒童學生敬老與自備器材 250／**500**／**500**（原本是 650／450）。
- 同步更新 `bookingPricing.test.js` 的期望值（混合同行 4 人 2h 小計 2200→**2400**）。

**為什麼**
- 官網（`website/index.html` 價格卡＋FAQ 結構化資料）寫的是 700／500，程式碼卻是 650／450，
  線上預約、後台結帳代碼（單二/學三/自二…）、報到開帳單全部從這張表推導，
  等於**每一筆 2 小時以上的預約都少收 50 元**。

**踩坑提醒**
- 價格的單一來源就是 `BOOKING_PRICES` 這一張表，其它地方（`PLAN_PRICE`、`BILLING_PLANS`、
  `CHECKIN_PLANS_*`）都是推導出來的，**改價只改這一張表，不要在任何元件裡手抄數字**。
- 早鳥折抵 NT$50 是另一層（`finalBillPrice`），跟這次的價目無關，不要混在一起調。

---

## 2026-08-04（實體榮譽無上限、三圍來源明細、首頁/背包 UI）

**改了什麼**
- 🏅 **三種章改成「每顆固定加成、不設上限」**，並**移到三圍夾制之外**：
  肥貓章→ATK 銅1/銀4/金12、積分章→DEF 銅1/銀3/金9、成就章→HP 銀3/金8/黑15。
- 🎯 **射手證**：藍證 ATK+10/DEF+10/HP+100；金證再額外 ×1.05。同樣在夾制之外。
- 📊 「我的」新增**三圍來源明細**（`describeStatSources`）：基礎／榮譽章／射手證／等級各貢獻多少。
- 🌤️ 首頁「進行中」空狀態 → **「今天可以做什麼」**（`suggestNextActions`，最多 3 件、一定有保底）。
- 🎒 背包把「相關功能」從大圖磁磚降為緊湊按鈕（順帶少載 5 張 webp）。
- 🐛 修掉既有的首頁崩潰：`rankFromLevel` 漏 import（HEAD 上就有）。

**為什麼**
- 舊版把章算在 `Math.min(160/120/800)` **裡面**，老手早就頂到天花板，
  **再拿章完全沒有感覺**——這才是真正的問題，不是係數大小。
- 作者定案不設上限：「我就是煞車，而且這遊戲會繼續更新往上攀升」。
  章是教練親手發的實體徽章，發放速度本身就是節流閥。
- 加成再大，**畫面上看不到就等於沒有**，玩家不會因此想去拿章 → 才有來源明細。

**踩坑提醒**
- ⚠️ **難度排序是作者定的，不要從點數權重推**。成就章要 160 點才封頂，
  「看起來」最難，但實際上**它最好拿、肥貓章最難拿**。我第一版剛好做反。
- ⚠️ **不要把上限加回去**。看到「無上限」的第一反應會想加回來——測試裡寫了理由。
- ⚠️ **關鍵是位置不是數字**：加成要加在所有 `Math.min` **之後**。
- ⚠️ 金證的 5% 乘的是 `calcArcherStats` 的回傳值（**含章**），
  但**不含等級加成**（那層在外面加）。要吃到得改所有戰鬥呼叫點，刻意不做。
- ⚠️ **eslint `no-undef` 又救了一次**（本 session 第六次）：`rankFromLevel` 漏 import，
  build 照樣「Compiled successfully」，但那段 JSX 一渲染就炸。
- ⚠️ 極簡 eslint 設定（`--no-eslintrc`）沒有 React plugin，`no-unused-vars`
  會對 JSX 元件誤報。**只看 `no-undef`**。
- ⚠️ 背包磁磚**沒有**顯示持有數量：MemberApp 根本沒訂閱寶箱/藥水/素材
  （`badges` prop 也沒被傳，紅點是死的）。為裝飾性數字新增訂閱＝違反成本紀律。

---

## 2026-08-03（村目標：期限一個月、三層獎勵、七族材料箱、目標值下修）

**改了什麼**
- 期限：自然刷出的目標從**寫死 24 小時**改成 **30 天**，結束後 **3 天**才刷下一個。
  抽成 `villageGoalSchedule.js`（16 測），後台「村目標」可調。
- 獎勵：新增 `villageGoalRewards.js`（21 測），三層與世界王**同一套數學**——
  出席保底＋努力分潤（√貢獻）＋達成慶功。安慰獎從固定 30/20/1 改成依階級 100~450 箭露。
- 慶功箱：咪咪箱 1/1/2/3 個（**不是貓貓箱**），外加**七族材料箱** 2/3/4/5 個一族。
- 目標值：階級 2/3 下修（箭數 40k/80k → 25k/38k 等），曲線從每階 ×2.7 收斂到 ×1.6。
  新增 `villageGoalTargets.test.js` 護欄。

**為什麼**
- 目標值隨等級成長 16 倍但時間不動，高階根本打不完。
- 舊獎勵只有保底沒有努力層，射 5,000 箭跟射 50 箭拿一樣多；而且推**一整個月**
  只拿 100~800 金幣，比世界王打**一場**的保底(350)還少，比例是反的。

**踩坑提醒**
- ⚠️ **咪咪箱 mimi_box 😺 ≠ 貓貓箱 cat_box 🎐**。前者開出一隻貓咪夥伴，
  後者 90% 掉一個章碎片。名字太像，程式碼與測試都要註記。
- ⚠️ **材料箱一定要用 `family_mat`**（族系素材箱）。`wood/iron/gold/epic/mythic`
  是**通用材料寶箱**，`openChestContents` 裡它**完全忽略 chest.family**、
  固定開六族且**排除寶箱族**——拿它做「每族一箱」設了 family 也不會被讀，等於白做。
- ⚠️ **族別有兩組清單，抄錯不會報錯**：
  `FAMILY_KEYS`/`ALL_DUNGEON_FAMILIES` = 六族（地下城用，刻意排除寶箱族）；
  `ALL_FAMILIES`/`FAMILIES` = **七族**（素材與寶箱用）。材料箱要用七族那組。
- ⚠️ **階級要存進目標文件**（`tier`）。村莊在這一個月內會升級，結算時現算的話
  同一個目標的獎勵會跟著浮動。舊目標沒這欄 → 退回 0（最保守）。
- ⚠️ 慶功箱**只有完成才有**。安慰獎路徑沒有 `celebration`，不加守衛的話
  `reward.tier` 會是 undefined → 退回 0 → 沒完成的人照樣拿一整批材料箱。
- ⚠️ 目標值的護欄除了看比例，更要看**換算成每天要射幾箭**——
  比例正常的數字換算成每日仍可能不可能達成。

---

## 2026-08-03（箭數同步、世界王獎勵三層整合、重生機制併軌）

**改了什麼**

### ① 箭數「數據不同步」——三個各自壞掉的加總
- 新增 `src/lib/practiceLogArrows.js`（10 測）：一筆 practiceLogs 射了幾箭，**單一真本**。
- `initializeTodayArrows` 與 `checkAndGrantArrowMilestones` 改用同一支。
- `attackWorldBoss` 內建的練習紀錄補上 `date` / `totalArrows`，並新增 `logPractice` 參數。
- 新增教練工具「🩹 箭數補正」（重置中心分頁）＋ `practiceLogRepair.js`（12 測）。

### ② 深度分析讀錯欄位
- `byCondition` 實際要讀的是 `shootingConfig.targetFaceCode`（不是 targetFmt）。
- `FACE_LABEL` 改成從 `TARGET_FACE_FORMATS` 生成，不再手抄。

### ③ 世界王獎勵三層整合
- 新增 `src/lib/worldBossRewards.js`（23 測）取代舊的三張表：
  **出席保底**（不看傷害、不被稀釋）＋**努力分潤**（√傷害 × 出席天數）＋**名次榮譽**（不給大量金幣）。
- 24 隻王血量改用「幾人次 × 12,000」推算，並加護欄測試鎖 ±60%。

### ④ 世界王重生機制併軌 + 蓄力條件四選一
- 刪掉客戶端的 `beginWorldBossSpawnCycle` / `trySpawnWorldBossFromCycle`，
  權威只留雲端 `functions/worldBossLifecycle.js`。
- `worldBossSpawnCycle.js` 改成**唯讀顯示層**。
- 蓄力從「任一達標」改成**開週期時隨機抽一種**（`requiredType`），後台可設抽籤池。
- **已部署**：`ensureWorldBossLifecycle` / `forceSpawnWorldBossFromCycle` /
  `worldBossLifecycleSchedule` / `contributeWorldBossSpawnProgress`（asia-east1）。

**為什麼**
- 作者回報「歷史數據跟實際練習都不相同」。三個 bug 疊在一起，全都不報錯只是靜靜算錯。
- 作者的獎勵理念：「上場幫忙打得都能有不錯的獎勵，努力打得又有更好的獎勵」。
  舊系統下限是 `Math.max(1,…)` ＝ 1 金幣，而且人越多每人越少——**在懲罰上場幫忙**。
- 作者回報「重生機制似乎是兩套卡在一起」——確實，而且其中一套一直壓過另一套。

**踩坑提醒**
- ⚠️ **`practiceLogs.arrowCount` 是「每組幾箭」不是總箭數**。3 箭×20 組被算成 3 箭。
  一律用 `practiceLogArrowCount`，它**刻意不 fallback 到 arrowCount**。
- ⚠️ **Firestore 會直接跳過缺少 orderBy 欄位的文件**。世界王紀錄少了 `date`，
  在歷史與今日箭數都是隱形的——不報錯、沒跡象。補正工具的掃描也**不能用 orderBy("date")**。
- ⚠️ **補 `date` 前一定要先判重**：舊版世界王同一次攻擊記兩筆，簡略那筆靠缺 date 被藏著，
  無腦補回去會讓箭數翻倍。
- ⚠️ **客戶端寫了就會壓過雲端**：`beginWorldBossSpawnCycle` 在擊倒當下用寫死的預設值搶先寫入，
  雲端 `ensureCycle` 看到 `previousEventId` 對上就跳過 → **後台的重生設定從來沒生效過**。
- ⚠️ **抽籤要在開週期時抽一次並存進文件**。評估時抽或客戶端抽的話，條件會一直跳、
  推到一半換題目、不同人看到不同答案。
- ⚠️ **抽籤池不能空**，空了世界王再也不會出現而且沒有錯誤訊息。兩層都要擋。
- ⚠️ **`react-scripts build` 不會擋 `no-undef`**。這輪又中一次（import 沒插進去、build 照樣成功）。
  改完務必另外跑：
  `npx eslint --no-eslintrc --parser-options=ecmaVersion:2022,sourceType:module --env browser,es2022 --rule '{"no-undef":"error"}' <檔案>`
- ⚠️ **heredoc 會吃掉反斜線**：`\s` 寫進 JS 字串會變成 `s`，regex 靜靜地永遠不匹配。
  用 `[ ]*` / `[0-9]+` 這種不含反斜線的字元類。
- ⚠️ 客戶端與雲端的預設值沒辦法共用模組，靠 `worldBossSpawnCycle.test.js`
  **直接讀 functions 原始碼比對**釘住。

---

## 2026-08-02（戰鬥重整：異常狀態實裝、加成管線統一、射箭深度分析改版）

**改了什麼**
- 新增 `src/lib/combatModifiers.js`（28 測）：玩家側加成**統一管線**，
  順序固定為 進場 → 出手 → 受擊 → 中狀態 → 回合末。破甲×穿甲**相乘不相加**。
- 新增 `src/lib/monsterStatus.js`（32 測）：7 種玩家→怪物異常
  中毒／灼燒／流血／破防／虛弱／冰凍／麻痺。族群綁定（`FAMILY_STATUS`）：
  毒蟲=中毒、西方=灼燒、鬼怪=虛弱、職場=破防、考試=麻痺、山林=流血、寶藏=冰凍。
- `cardTalents.js` 把被overload 的 `damagePct` 拆成 `firstStrikePct`／`venomPct`／`finisherPct`，
  「淬毒」從假的傷害加成改成**真的施加中毒**。
- 五種模式全部接上：單人打怪、組隊打怪、地下城單人、地下城組隊、世界王。
  組隊/地下城/世界王是**權威端算傷害**，所以 `partyDb` / `dungeonDb` / `raidFlow`
  各自要合併全隊施加、破防先削防禦、回合末 tick。
- 玩家看得到：左上戰鬥紀錄推施加/持續傷害訊息、血條下異常膠囊、右上加成 chip。
- 後台新增戰鬥模擬沙盒（`cardFxOverride`），不用開真房間就能驗異常。
- 射手「深度分析」重做成 `archeryAnalytics.js`（26 測）+ `ArcheryAnalysis.jsx`：
  群組中心/離散度、左右上下分開判讀、回合內衰退、距離分層、期間選擇器。

**為什麼**
- 作者回報「裝了施毒卡片也沒有實際效果」。查下去發現卡片天賦大多只是換算成傷害％，
  異常根本沒有實體。玩家不知道自己裝了什麼、也感覺不到差別。
- 舊「深度分析」是**遊戲數據**（平均、X 率），不是**射箭教學數據**，教練看不出要修什麼。
  離靶心遠但集中＝調瞄具（好修）；四散＝動作不穩（難修）——這兩件事混著看就給不了建議。

**踩坑提醒**
- ⚠️ **異常觸發要 9 環以上**（`PROC_MIN_SCORE`）。射箭遊戲的身分認同：
  射得好換成戰術優勢，不是抽獎。強度不隨卡片數成長，只有觸發率會——
  否則滿編毒隊會變成純傷害流派。
- ⚠️ **觸發率有上限**：`PROC_CAP` 35%、控場類 `CONTROL_PROC_CAP` 12%。
  `chancePct: 100` 也會被夾。測試要「一定觸發」必須注入 `rand`，不能靠機率。
- ⚠️ `resolveRaidRound` / `rollInflict` 一定要把 `rand` 傳下去，漏傳就不可重現。
- ⚠️ `byCondition` 的欄位名是 `shootingConfig.distanceM` / `metricsSnapshot`，
  猜錯會整排顯示「?m｜未記錄 0環」。
- ⚠️ `react-scripts build` **不會**擋 `no-undef`。這輪因此漏掉 4 次
  （`subscribeOpenRaidRooms`／`matchRewardFor`／`useMemo`／刪碼刪掉還在用的 ref），
  每次 build 都印「Compiled successfully」但一進畫面就白屏。**改完一定要真的開瀏覽器點**。

---

## 2026-07-31（世界王：出擊前的單人房／等待室、擊倒演出分鏡、靶紙射程各自決定）

**改了什麼**
- 補上 `RaidSoloRoom`（單人房＝出擊前準備室＋揪團入口）與 `RaidWaitRoom`（等待室）。
  `raidTeamDb.js` 的 Firestore 房間層之前寫好卻**沒有任何 UI 用它**。
- 轉換邏輯抽成 `domain/raidLobby.js`（純函式、20 條測試）——寫在元件裡就沒辦法測，
  而「誰擋住出發」正是最容易錯的地方。
- 擊倒演出分鏡定案：**王先出現 → 射箭 → 王倒下 → 噴寶箱 → 跳字＋所有參戰人名字**。
  立繪改用沒有拿弓的 `archer_*.webp`；箭矢由下往上並往中線收斂。
- 沙盒新增「🌐 全服擊倒廣播預覽」，不用真的打倒王就能看。
- **靶紙與射程改成每位隊員各自決定**（作者：有人射長有人射短，靶紙也不相同）。

**為什麼**
- 房主統一設定靶紙射程，等於逼所有人配合最短的那個人。
- 出發鈕被擋住卻不寫原因，玩家只會以為壞掉了 → `blockers` 一律全部列出。

**踩坑提醒**
- ⚠️ 三連靶「每張最多 2 箭」的計數原本**全隊共用**，四個人射同一個 `faceIndex`
  會互相吃掉額度 → 改成 key 帶 `memberId`。
- ⚠️ 弱點圈依「靶紙張數」分組（`state.spotsByFace`）：全隊張數相同時它是 `null`，
  `state.spots` 仍是唯一那組 → 既有存檔與測試不受影響。改成「每人各抽一組」會弄壞
  一堆直接覆寫 `state.spots` 的測試，而且不合理（一隻王就一組弱點）。
- ⚠️ `teamStatBonus()` 回的是**倍率**（2 人 = 1.10）不是加成（0.10）。
  等待室曾直接乘 100 印成「ATK +110%」，已加測試釘住。
- ⚠️ `RaidKillCutscene` 的分鏡是內部 state：只換 payload **不會回到第一幕**，
  要連播必須用 `key` 讓它重新掛載。
- ⚠️ `CATS` 是物件不是陣列（`CATS[catId]`，不是 `.find()`）。
- ⚠️ JSX 文字**不會渲染 markdown**，`**粗體**` 會原樣印出星號。

---

## 2026-07-31（世界王重製：彩色弱點圈討伐・強制靶面・`?raid` 沙盒可玩，未接線上）

**作者回報**：沒有打世界王的感覺、過程無趣、**低等玩家打不動全是高等在貢獻**。

**根因**：`damage.js:221` 的註解自己寫著 `no part system`——一般怪有 11 個部位，世界王刻意關掉，
傷害只剩 `分數 × 攻擊力`。實測差距 **34 倍**，30 箭全程沒有一刻要做決定。

### 最終機制（中間繞了一圈，過程記在下面）

**靶面上的彩色弱點圈**：每回合出現 1~2 個，🟢0.38 / 🟡0.28 / 🟠0.19 / 🔴0.12（半徑比例），
傷害 0.08%~0.50% 王最大血量。**大小＝難度、顏色＝報酬**，命中率可由半徑解析算出，平衡是解出來的。

三條關鍵規則：
- **打中弱點 → 一般傷害一律算滿分**。圈可能長在 6 環外圈，照落點環數算就沒人想拚了。
- **弱點固定傷害不乘 ATK**，是王最大血量的比例。
- **正中只加傷害不加破防**——一場才 30 箭，加了會把全場的槽灌爆。

**強制靶面輸入**（移除「點擊分數」模式）＋ 靶外空間（脫靶也要點得到）。
靶紙只留四種、不寫公分數：半靶 / 全靶 / **三連靶（左中右橫排）** / 原野靶。
三連靶的圈會記 `faceIndex`，射錯張不算。

**射程加成**：難度＝距離 ÷ 靶紙直徑，**基準 5 米 × 半靶 ＝ ×1.00**（新手標準射程），18 米 ×1.90。

**新手扶助**：50 級以下才有、隨等級遞減到 0（1 級 ×2.18）。

### ⚠️ 最重要的一條教訓：補償不要塞進戰鬥模型

我一開始為了把差距壓進 2.5~4.5×，在弱點數值裡動手腳——弄出「紅點最難但破防最少」
這種沒人看得懂的設定，還加了「同一個圈重複打會遞減」。**作者當場否決**：
> 這個區域不要故意去分老手新手 這是標準的戰鬥模型 我們在外面設計新手加成即可

改成「戰鬥模型中性 + 外層新手扶助（`raidRookie.js`）」之後，兩邊都變得可維護：
想調新手體驗只動一支檔案，想調戰鬥手感只動另一支。**這個分層以後任何系統都該照做。**

### 其他踩坑

- **`Number(null) === 0`**：方位加碼沒擋 null，沒有座標的玩家被當成「正中心」白拿加碼。
- **討伐永遠不會結束**：`finished` 算對了但只有呼叫端在守，回合一路加到「第 8/5 回合」。
  改成畫面自己在 `finished` 時鎖輸入並蓋結算層。
- **平衡模擬必須平均多場**：一場只有 30 箭，單一 seed 毫無統計意義——
  同一組參數不同 seed 可以差 60 倍（實測「新手射紅點」有的 seed 是 46 傷害、有的 3000）。
  改成平均 120 場後數字才穩。
- **測試不要寫死平衡數字**：調參數時一票斷言同時碎掉，改成從 `WEAK_SPOT_MAP` 推導。
- **`attackDamageVariance()` 是真的 `Math.random`**：同輸入每次跑差千分之幾，
  斷言不能用精確相等。

### 架構

新開 `src/worldboss/`（domain/ui 分層，比照 `src/guild/`），**舊的 `src/components/worldboss/` 一行沒動**。
鐵律：**domain 產生 log、UI 照 log 原順序重播**（公會就是按類型分桶才會跳過動畫）。

12 個新音效（全合成、不加音檔）、20 餘組 CSS 動畫、`gen-raid-art.py` 生 8 張討伐場地背景。
⚠️ 王的立繪不生：教練/師母/YUMI 是真人、九隻貓王是真貓。

### 現況

113 個世界王測試、全專案 1179 個通過，build 無警告，`?raid` 沙盒實跑驗證過。
**未接線上**：Firestore 欄位、破防貢獻榜、`WorldBossAttack` 接線未做。
規格見 `docs/second_brain/world-boss-redesign.md`。

---

## 2026-07-30（流程教訓：跳過起手式，把已記載的坑又踩一次）

**沒讀 `ai-guide.md` 就開工。** CLAUDE.md 第一條是「禁止先 grep / 讀源碼，先讀第二大腦」，
起手式是 `ai-guide.md` ＋ `quick-ref.md`。這次整場都沒讀，直接用 grep 與 vercel CLI 硬推
部署架構，連續給出兩個錯誤結論（先說「官網不隨 push 重建」、再說「Production Branch 設錯」），
繞了好幾輪才被使用者問「Codex 沒寫？第二大腦沒寫？」——**寫了，而且寫在兩個地方**：

- `ai-guide.md` 第 14 行：官網（`catarrow-archery`）**要手動 `vercel deploy`**。
- 本檔第 1663 行：早就記過同一個坑，連當時的後果都寫了（「誤以為 push 就會部署，
  結果真實照片整合沒真的上線、被使用者發現跟原本沒差多少」）。

也就是說這個坑**被記載過，然後被原封不動再踩一次**。教訓不是「要補筆記」，是**要讀筆記**。

順帶更正 `ai-guide.md` 一處真的過時的資訊：原文寫「純前端、沒有 Cloud Functions」，
實際 `functions/` 已有 17 個 asia-east1 函式，且 `git push` 不會部署它們。

**分工提醒**：官網（`website/`）一直是 Codex 負責，包含部署。其他 AI 動到 `website/` 時
要主動說明「這裡有未部署的官網改動」，不要自己跑部署。

---

## 2026-07-30（大富翁：獎勵演出、棋子搶跑、寶箱格改抽獎）

作者：「大富翁的一些缺乏動畫 聲光效果」＋「很常會出現骰子還沒出現步數 但格子已經先走了」
＋「寶箱格改成不需要射箭而是隨機抽到 1~5 個寶箱」。

**踩坑（重要）：跨 effect 的守衛旗標一律用 ref，不能用 useState。**
`CatVillageBoardTeam.jsx` 的 boardPos 同步 effect 原本寫 `if (room && !animating)`，
而 `animating` 是 useState。同一個 Firestore 快照會同時觸發「跟隨動畫」effect
（宣告在前，`setAnimating(true)`）與這個同步 effect；React 依宣告順序執行，但
`setAnimating(true)` 在同一個 commit 內**還沒生效**，同步 effect 讀到的仍是舊 render 的
`false` → 立刻把棋子設到終點，骰子還在轉棋子就走完了。改用 `animatingRef`。
單機版本來就用 `busyRef`，所以這個 bug 只在組隊版出現（每一步都會踩到，所以「很常」）。

**獎勵三段演出**：新增共用元件 `BoardRewardPopup`（單機與組隊共用，不各寫一份）。
前置動畫約 0.95 秒，圖示與台詞依格子類型變化（素材格「採集中…翻找素材」、寶箱格
「開箱中…撬開鎖扣」）→ 獎勵逐項淡入（每項延遲 70ms）→「收下！」。
演出期間**點背景不關閉**，避免手滑跳過又看不到拿了什麼。遵守 `prefers-reduced-motion`。

**寶箱格改抽獎**：不再射 6 箭。踩到就隨機 1~5 箱，階級**固定等於進場選的 T**
（不再 `rollTier` 隨機降階，讓進場選階有意義），仍受建築 stage 上限夾住。
只改 `TILE_TYPES.chest.shooting = false` 就夠——組隊端與 `villageBoardTeamDb`
都是讀這個旗標決定走 `pendingShoot` 還是 `pendingSettle`。

**順手**：單機版按鈕原本只看 `rolling`，落點停頓與結算那段會顯示成可按但點了被
`busyRef` 無聲擋掉；加一個鏡射 state（`busy`）給 render 用，按鈕顯示「⏳ 結算中…」。

---

## 2026-07-30（貓貓村採集：新增第七族寶箱族，素材改用擴充圖鑑）

作者：「探索地圖 新增第七族 寶箱族可以對應射箭場的建築物等級」＋「目前太多升級材料需要寶箱族了」。

**新增採集點「藏金靶場」🎯，`id: "archery"`。** 這個 id **必須**等於建築 id——採集點的等級判定是
`buildings[site.id]`（`CouncilHall.jsx` 的 `GATHERING_SITES.map()`），id 對齊才會吃到練箭場等級。
因此 UI、解鎖條件、tier 開放全部自動沿用既有邏輯，**不需要改任何元件**。
村資源給 `archer`（貓貓射手），正是練箭場自己的產出。練箭場需轉蛋屋 3 級才解鎖。

**踩坑：專案有兩套並行的材料經濟。**
- 舊：`{族}_m{1-6}`（`monsterMaterials.js`，只有六族，**沒有寶箱族**）
- 新：`mat_*`（`src/data/monsterExpansionCatalog.json`，**7 族 × 6 階 × 6 隻 = 252**）

`equipSpecializationDb` 的 `MATERIAL_META` 由 `EXPANSION_MONSTERS` 建立，**只認得 `mat_*`**。
而採集原本發舊表 id → **採到的素材其實無法用於裝備專精升級**（既有問題，本次一併修好）。
現在採集一律發擴充素材，寫入 `materialInventory`（與專精消耗同一個 collection）。

**素材規則**（`rollGatheringMaterials`）：
- T{n} 可取得 **T1～T{n}** 累積池，每階 3 件（T6 池 18 件）
- **排除小王與大王素材**：每族每階固定 3 normal + 2 miniBoss + 1 boss，只收 normal
- 數量隨機但**總數守恆**＝原本的 `materialCount`，不因隨機膨脹
- 低階權重較高（`weight = maxTier - tierIndex + 1`），T1 最常見

**找資料時的教訓**：確認「某族有沒有材料」不能只 grep `monsterMaterials.js`——
擴充材料在 **JSON** 裡、id 前綴是 `mat_`，用 `treasure_m` 這種舊命名去搜會得到錯誤結論。

**T6 不開放（2026-07-30 作者決定，不要再重新討論）**：`getUnlockedGatheringTiers` 封頂 stage 5，練箭場練到 20 級也只到 T5，`mat_treasure_6` 這類 T6 素材採集拿不到。理由是**素材上限本來就只有 T6**——若採集也能產 T6，最高階就變成日常產出，地下城與王的獎勵定位會被稀釋。T6 維持地下城／打王專屬。（大富翁的 `getModeTierCap` 也是同樣封頂 5。）

---

## 2026-07-30（地下城首次通關：修好顯示不出來，舊制徽章移除）

**三個 bug 都源自同一件事——難度值有字串與數字兩種形式，被多個函式各自用 `Number()` 解讀。**

地圖難度是字串（`normal`/`advanced`/`hard`/`hell`），遠征是數字 1-6。`Number("advanced")` → `NaN`
→ 退回 1，於是：
1. `buildDungeonFirstClearKey`：四種難度全算成 `_t1`。寫入端 `DungeonBattleRoom` 另有一份內嵌
   對映 `{normal:1, advanced:3, hard:4, hell:5}`，所以打完進階寫 `t3`、面板查 `t1` → 顯示「尚未取得」；
   打完普通則四種難度全顯示「已完成」。
2. `getExpeditionFirstClearTrophy`：同樣問題，四種難度都拿到 T1 紀念章，**36 張圖只有 T1 那 6 張會出現**。
3. `getDungeonFirstClearState`：把「沒有 `dungeonFirstClears` 欄位」當成資料未載入，
   但沒通關過的射手本來就沒這欄位 → 永遠停在「首次通關資料讀取中」。

修法：對映集中成 `DUNGEON_DIFFICULTY_TIERS`（`dungeonFirstClear.js`）單一來源，字串與數字都吃；
沿用原本數字（1/3/4/5）所以既有紀錄不失效。

**圖鑑另有兩套並存的紀念品**：舊制 24 件 `{族}_{難度字串}_trophy`（只有 emoji）、新制 36 件
`{族}_t{1-6}_trophy`（有 webp）。`DungeonDex` 查的是舊制 id，所以新制**從未出現在圖鑑裡**；
`MuseumTile` 也只畫 `item.icon` 不畫 `item.image`。依作者決定**舊制已整批移除**，
`COLLECTIBLE_MAP` 因此少 24 件，收藏總數分母（`MemberHome`／`MemberProfile`／`achievementDex`／
`leaderboardData`）會自動跟著變小。已擁有舊制的 9 名會員留下孤兒 key，刻意不做破壞性清理。

**清掉兩筆壞資料**：`dungeonFirstClear/exam_undefined`、`mountain_undefined`（舊路徑傳了 undefined
難度）。產生它們的 `trySetDungeonFirstClear`／`checkDungeonFirstClear`／`getDungeonFirstClearStats`
已無任何呼叫端，是死碼。

**驗證時的教訓**：build 產物把中文轉成 `\uXXXX` 逸出，直接 grep 中文會**誤判成「程式碼沒部署」**。
要驗證線上 bundle 有沒有某段程式，得先還原逸出再比對。

---

## 2026-07-26（音效架構定案：全面樣本優先，合成降為保底）

作者：「我自己安裝的好多了，所以我希望透過這個路線去處理剩下的音效」＋「我比較希望你去處理完整的音效」。

**結論：合成不是目標，是保底。** 全部 44 個音效（不含刻意保留的 3 個教練提醒音）都改成
`sample(檔名, 音量, 合成保底, 震動)`：
- 檔案在 → 播檔案
- 檔案不在／載入失敗 → 跑合成版（**不會無聲**）

**關鍵設計：丟檔案就生效，不必改程式。** 每一個檔名都已經預先接好了，所以補音效的流程是
「把 mp3 放進 `public/sounds/`」——**零程式改動**。可以一次補一顆、隨時 A/B。

**新增 `public/sounds/README.md`**（放在要丟檔案的地方才找得到）：
- 44 個檔名的完整對照表，按**優先度分三級**（🥇玩家每天聽幾百次 → 🥉有就更好）
- 每個檔案的建議長度與性格（例：`ui_tap` 40~80ms 乾輕不刺耳；`round_end` 別太搶戲因為每回合都響）
- 技術規格：單聲道、96~128kbps、正規化、**開頭不要留空白**（前面 20ms 靜音就會有「按了才響」的延遲感）
- 免費可商用來源：Sonniss GDC Bundle（品質最高）／Kenney.nl（CC0）／freesound（授權逐檔看）

**兩個帶參數的音效也處理了**（原本被漏掉）：
- `sfxGachaReveal(isNew)` → 新卡與重複卡是兩種情緒，各給一個檔（`gacha_reveal_new` / `gacha_reveal`）
- `sfxCouncilWork(buildingId)` → 六棟各一個檔（`council_mine` … `council_warehouse`）。
  ⚠️ 缺檔時退回的合成版**刻意是隨機三選一**——連續採集才不會聽起來像壞掉的迴圈。補檔時建議一棟準備 2~3 個變體。

**預載清單只列已存在的檔案**：`SAMPLE_NAMES` 不要列還沒放進來的檔名，否則開站就打一串 404。
沒預載只是第一次觸發稍慢，功能一樣。

## 2026-07-26（音效：把躺著沒用的 8 個真實樣本接上，合成版降為保底）

作者聽完合成版：「跟目前手遊的音效差距有點大」。**這個判斷是對的，不該硬拗。**

**先講技術現實**：合成音效有**硬天花板**。現代手遊音效是錄音素材（真金屬、真布料、真撞擊）經過 DAW 的多頻段壓縮／飽和／transient shaper 做出來的，用振盪器＋噪音**永遠追不上**——尤其「有機」的撞擊聲。UI 點擊、whoosh、科技感這類合成得出來；箭射中肉體則不行。

**然後是關鍵發現**：`public/sounds/` 裡**早就有 8 個真實 mp3**（2026-06-18 加的），但 `playAudio()` **一個呼叫點都沒有**——被後來的合成音效整批蓋過去，白放了一個月。

**處置：改成混合策略**
- `sample(name, vol, fallback, vib)`：檔案播得出來就播檔案，載入失敗／被自動播放政策擋掉就跑合成版（**不會變成無聲**）。
- 已接上的 8 個：`normal_atk`→命中／`crit`→暴擊／`monster_atk`→被打／`monster_crit`→被暴擊／`miss`→閃避／`level_up`→升級／`open_chest`→開寶箱／`victory`→勝利。
- 合成版全部改名成 `sfx*Synth` 留著當保底，一行都沒刪。
- `unlockAudio()` 順便**預載**全部樣本，第一次命中不會延遲。
- 壞檔記進 `_sfxBroken` 不再重試（避免每次觸發都打一次 404）。

**⚠️ 實裝樣本最容易漏的回歸**：合成版的函式體裡本來就有 `vibrate()`，但**走樣本時那段不會執行** → 變成「用了真實音效反而沒有觸覺回饋」。所以 `sample()` 收一個震動參數，播樣本時自己震。

**還缺樣本的**（目前仍是合成）：UI 點擊/切換/開關/錯誤/成功、射箭、貓助攻、擊倒怪物、回合結束、金幣、購買、施法、增益。
> 要繼續縮小差距只有一條路：**補音檔**。丟進 `public/sounds/` 再到 `sound.js` 加一行 `sample(...)` 對照即可，呼叫端完全不用動。

## 2026-07-26（音效現代化：合成引擎重寫，仍然零音檔）

作者問「有辦法創造更符合現代的遊戲音效嗎」→ **可以，而且不用音檔**。舊音效聽起來像電子琴 beep 是有具體技術原因的：

| 舊做法 | 為什麼聽起來廉價 |
|---|---|
| 每個音效**直接接 `destination`** | 沒有空間感、沒有整體壓縮，兩個音效同時觸發就爆音 |
| `tone()` ＝ 單一振盪器 ＋ 線性 attack | 這正是「beep」的來源 |
| `noiseBurst()` 的 lowpass 是**固定頻率** | 少了厚度——現代衝擊音的重量來自**濾波器包絡** |
| 沒有 pitch envelope、沒有 detune | 聲音很薄、很平 |

**新引擎的三個關鍵**（全部 Web Audio 合成）
- **A. 分層**：transient（點擊感）＋ body（音色）＋ air（高頻空氣感）＋ sub（低頻重量）
- **B. 包絡**：不只音量，**音高與濾波器也要有包絡**——「punch」感就來自音高瞬降
- **C. 總線**：共用 `DynamicsCompressor`（黏合、防爆）＋ **合成 IR 的 convolution reverb**（空間感，不需要 IR 音檔）＋ `StereoPanner`

**新原語**：`punch`（音高瞬降）／`pluck`（兩顆失諧鋸齒＋lowpass 包絡）／`impact`（噪音＋lowpass **往下掃**＝重量）／`air`（highpass 噪音＝清脆）／`sub`（低頻墊底）／`swell`（帶通掃頻 whoosh）／`notes`（用 pluck 疊和弦）。

**改了 24 個音效，函式名稱全部不變** → 呼叫端零改動、零回歸風險。
- 介面：tap／switch／open／close／error／success／pathSelect
- 戰鬥：arrowShoot／arrowHit／critBoom／counter／counterCrit／organHit／softFail／monsterDead／roundEnd／cast／buff
- 結算：victoryFanfare／defeat／levelUp／coinDrop／openChest／shopBuy

**刻意不改的**
- 舊的 `tone`／`noiseBurst`／`distTone` **保留不動**——還有二十幾個音效在用，不動就沒有回歸風險。
- **教練後台的三個提醒音**（`sfxCheckinAlert`／`sfxNewBookingAlert`／`sfxNextHourAlert`）：它們是為了在工作電腦上穿透環境噪音而刻意設計的刺耳上行音。「現代化」會讓它變得不夠醒目＝**功能退化**，不是改進。

**新增音效試聽面板**：「我的」→ 音效與動畫卡 → 「▼ 音效試聽」。分介面／戰鬥／結算三組逐一點播——調音要能一顆一顆聽，不然只能在戰鬥裡碰運氣觸發。

## 2026-07-26（🐛 組隊死鎖：房主的自動推進被 busy 卡住）

作者回報「全員輸出完成後，如果不是房主最後輸入會卡死，要等房主出去再回來才會跑」。

**根因是依賴陣列的漏洞**：自動推進的守衛寫成 `... || busy`，但 **`busy` 不在依賴陣列裡**。
1. 房主送出自己的箭 → `setBusy(true)`
2. Firestore 的**本地寫入會立刻觸發快照**，最後一位隊員的箭也在此期間抵達 → `allSubmitted` 變 true → effect 重跑 → **`busy` 還是 true，直接 return**
3. `setBusy(false)` 時 effect **不會再跑**（`busy` 不是依賴）⇒ 永遠不推進
4. 離開再回來＝重新掛載，effect 才用 `busy=false` 重跑 —— 正是作者看到的症狀

**修法兩層**（因為「靠某一次 render 剛好對上」本身就太脆弱）：
- ① 觸發路徑**完全不看 React state**，改用 ref 當 in-flight 鎖。重複推進本來就被擋兩道（`teamCommitRef` 比對 seq ＋ 交易裡的 `if (d.seq >= nextSeq) return`），所以 `busy` 對正確性毫無貢獻，只是 UI 用的。
- ② 加**看門狗**：戰鬥中每 2 秒重檢「全員交齊卻還沒推進」，任何漏掉的 render 都補得回來。
  - ⚠️ 看門狗的依賴陣列**不能**放 `battle`／`room.submits`——它們每次快照都是新物件，interval 會被反覆重建、2 秒永遠倒數不完。改用 ref 讀最新值，interval 只在「開打／結束」時建立一次。

**這一類 bug 的通則**（跟前一條「只有觸發者的畫面會變」是同一家族）：
> 守衛條件裡讀到的每一個 React state，都必須出現在依賴陣列裡；否則它變成「只在別的東西變動時才會被重新評估」的隱形時序炸彈。多人功能尤其致命——卡住的是全隊。

## 2026-07-26（組隊戰鬥動畫：全隊過程都播，但不 gate 共享狀態）

作者：「組隊沒有戰鬥過程動畫」→「**動畫要每個人都跑完，反正過程很快**」。

**先前為什麼沒做，以及那個判斷哪裡錯了**
上版刻意只做「回合摘要」，理由是「多人同時射，逐格播會讓大家互相等」。**這個顧慮只在「用動畫去 gate 共享狀態」時才成立**——房間文件在房主推進的那一刻就已經是回合後的狀態，動畫完全可以是**純本地重播**：各人各自播、播多久都不影響別人，沒有任何人在等別人的動畫。

**做法**
- `view` = 畫面上的狀態，動畫期間停在「回合前」，播完才跳到最新（`finishTo`）。
- 照 `battle.log` 的順序播**全隊**的過程：A 的每一箭 → B 的每一箭 → 貓貓支援 → 怪物推進/攻擊 → 補給/倒地 → 回合橫幅。射手底部立繪會亮起來，看得出「現在是誰在射」。
- **自適應節奏**：組隊一回合可能有 4 人 × 6 箭 = 24 箭，用單人版的 430ms 會播 10 秒 → 改成「總預算 3.2 秒、箭越多播越快」（70~300ms/箭）。
- 箭從**該射手的站位**飛向目標，傷害數字、暴擊、擊殺殘影、受擊紅閃都照單人版的視覺語言。

**兩個一定要處理的競態（都修了）**
- 動畫期間隊友交箭也會讓房間文件更新（**同一個 seq**）。若無條件排進待播佇列，播完會把**同一回合再播一次** → 只收「比正在播的更新」的 seq。
- 中途加入／重連的人沒有「上一回合的畫面」當動畫起點 → **直接跳到最新狀態不播動畫**（正確且不會卡）。
- 手機切背景會凍結 timer → 切回前景時若發現落後，直接對齊到最新狀態（跟貓貓村同一手法）。

## 2026-07-26（組隊：箭數跟房主 × 負重顯示 × 送出錯誤的防護）

**① 每回合箭數全隊統一跟房主**（作者要求）
不然每人不同箭數 → 補給消耗與清場速度全隊不一致，「6 箭清場快但補給加倍」這個取捨會變成各玩各的，回合節奏也對不起來。等待室會寫明「全隊跟房主（現在是 N 箭）」，隊員看得到原因。

**② 等待室補上背包負重**
原本組隊只能調食水卻**看不到負重**，等於把單人版最核心的取捨（裝備佔重 vs 補給佔重）弄丟了。
- 負重常數與算式搬到 `domain/guildStats`（`BASE_CAPACITY`／`SUPPLY_WEIGHT`／`carryStatus`），**單人與組隊共用同一份**——原本 `BASE_CAPACITY` 寫在 `GuildLoadout.jsx` 裡，組隊再抄一份遲早長歪。
- 超重時「準備完成」直接鎖住並顯示原因。

**③ 「多人送出戰鬥出錯」的 uncaught error**
⚠️ **老實說：這個我沒能重現，只修掉了能驗證的缺陷。**
- 我第一個假設是「Firestore 拒收 `undefined`」（它是直接丟例外不是回錯誤碼）。**寫測試實際掃過委託／遠征／戰鬥狀態三個物件，結果是乾淨的——假設錯了。** 不過寫入邊界還是加了 `prune()` 深層剝除 undefined，當作防護。
- **找到並修掉的真缺陷**：`recordArrows` 呼叫 `addRoundArrows(...)` 卻**沒有 `.catch()`** → 任何失敗都會變成「Uncaught (in promise)」浮到 console，看起來就像送出爆掉。箭數同步失敗本身不該中斷戰鬥（它有 localStorage 佇列會補傳）。
- `teamSubmit` 與 `teamCommit` 都改成把例外吞下來變成畫面訊息。**房主端特別重要**：`processTeamRound` 一丟例外就沒人能推進，全隊永遠卡住。

## 2026-07-26（🐛 組隊出發後隊員沒進場——連帶挖出兩個更嚴重的）

作者回報「房主點了出發，隊員沒有跟著進場」。查下去發現**三個問題疊在一起**，全部只影響隊員：

1. **沒進場**（表面症狀）：出發只有房主自己 `setPhase("teamBattle")`。隊員的房間快照其實已經更新（`status→active`、`battle` 有值），但**沒有任何地方改他們的 phase**，所以卡在等待室。
2. **隊員永遠領不到獎勵**（更嚴重）：結算 effect 開頭是 `if (!result || !gp || !run ...) return`，而 `run` 只有房主在 `teamDepart` 裡設過 → 隊員的 `run` 是 null，**整個發獎流程被擋掉**。
3. **隊員聲望算錯**：`contract` 也只有房主有 → 發獎時 `danger` 當成 1。（掉落沒事，那個讀 `expedition.danger`；只有聲望吃 `contract.danger`。）

**修法**：改成「**以房間狀態為準**」——新增一個 effect 監看 `teamRoom.status === "active"`，房主與隊員走**同一條路徑**設定 `contract`／`run`／`phase`。`teamDepart` 不再自己切畫面。
- `run.key` 用 `team_<roomId>`（一個房間＝一趟遠征＝只結算一次，`grantedRef` 靠這個防重複）。
- 順手補上：組隊時委託額度**只算房主那張**（隊員不傳 `contractId`，自己的每日委託不被消耗）——這是原本就講好的規則，但先前沒實作到。
- 回委託板時收掉房間監聽（打完的房間沒必要繼續訂閱）。

**教訓**：多人功能裡「只有觸發者的畫面會變」是很典型的 bug。**狀態轉換要由共享狀態驅動，不要由按按鈕的那個 client 自己推**。

## 2026-07-26（公會防斷線：單人本機續戰 × 組隊自動接回）

作者回報「公會沒有防斷線／重新回去的功能」。**兩種情況成因完全不同，所以解法也不同**：

| | 狀態存在哪 | 斷線會怎樣 | 解法 |
|---|---|---|---|
| **組隊** | Firestore 房間文件 | **進度其實沒掉**，只是沒人告訴你還有一場在打 | `findReconnectableGuildTeamRoom()` 進公會時掃一次 → 續戰橫幅 |
| **單人** | 只在 React 記憶體 | **整趟真的消失**，而委託又還沒結案（玩家會覺得白打） | 每回合存一份到 localStorage |

**實作**
- `GuildBattle` 新增 `resumeState`（續戰用初始狀態）與 `onPersist`（每回合把最新狀態往上報）。**責任分離**：戰鬥畫面不需要知道存在哪，上層決定。
- 委託板頂端顯示續戰橫幅（「▶ 回到戰場 / 放棄」），**組隊優先於單人**——別人也在等你。
- 橫幅寫明進度：組隊顯示人數與是否在戰鬥中；單人顯示第幾回合、第幾波。
- 接新委託／結束／放棄 → 續戰存檔立刻作廢，不會續到舊的那趟。
- 存檔 24 小時過期，且只留 `status === "fighting"` 的。

**⚠️ 為什麼單人不存 Firestore**：一回合寫一次雲端＝純粹浪費（見「省不到的不要動」）。單人進度只有自己需要，本機就夠；真正需要跨裝置的是組隊，而那本來就在雲端。

## 2026-07-26（公會組隊遠征：最多 4 人打同一張委託）

**回合順序（作者拍板）**：隊友A 射完 → 隊友B 射完 → 貓貓支援 → 怪物移動或攻擊 → 下一回合。
由 `domain/teamExpeditionFlow.processTeamRound` 保證，**有測試鎖住**（15 條）。

**架構**
- `domain/teamExpeditionFlow.js`（純函數）：怪物**全隊共享**，但 HP／補給／六維／貓／射擊表現**每人各自一份**。
  - 為什麼不改單人版：單人狀態機只有一個 `hp`/`guildStats`/`supplies`，要支援多人得把三樣都改成 map＝整支重寫，還會讓單人流程背上多人的複雜度。**分兩支、共用箭傷公式**（`arrowDamage` 已 export）最乾淨。
  - `partyHpScale`：怪物 HP 隨人數放大，但**加得比人數少**（1 人 1.0 → 4 人 2.8，不是 4.0）。組隊的獎勵是**效率**，不是更難。
  - `memberSettleState`：把組隊狀態「投影」成單人形狀，讓 `settleExpedition` 原封不動就能用——每人用**自己的**命中率與 LUK 結算，同一場戰鬥裡射得準的人拿得比較好。
- `db/guildTeamDb.js`：`guildTeamRooms/{roomId}`（status／contract／battle／loadouts／submits／claims／seq）。
- `ui/GuildTeamLobby.jsx`：開隊／**點進正在招人的隊伍**／各自備包（只調食水，六維與貓沿用自己的存檔）／房主出發。

**⚠️ 不用房號（作者拍板）**：等待中的隊伍**直接列出來，點一下就進去**（`subscribeOpenGuildTeamRooms` → 顯示委託／房主／人數）。理由很簡單——大家都在同一間箭館，報房號純粹是多的步驟。列表只在「組隊大廳且還沒進隊」時訂閱，離開就取消，不會變成常駐的隱形讀取來源。
- `ui/GuildTeamBattle.jsx`：共享戰場、我方小隊站位、回合摘要。

**規則設計**
- 個人 HP 歸零＝`down`（不能再射，但**全隊繼續**）；**全員 down 才失敗**。
- 已倒地的人送出的箭一律忽略（連射擊表現都不算）。
- 委託額度**只算房主那張**——鼓勵揪人，隊員不消耗自己的每日委託。

**踩過的坑全部預先套用**
- 交箭／領獎的寫入**自動重試**（`retryWrite`）：一次網路抖動就會讓全隊卡住等他（地下城 `confirmNonCombatRoom` 就是這樣，房主只能按強制推進）。
- 房間快照的錯誤回呼**不回 null**，暫時斷線不會把人踢出房間。
- **不做逐箭動畫時間軸**：多人是同時射的，硬要照 log 逐格播會讓所有人卡在動畫上等彼此（貓貓村就是這樣卡死）。改成「回合摘要」，結果一到就顯示。
- 房主端**全員交齊自動推進**（不用手動按），卡超過 20 秒才顯示「強制推進」。
- `partyCats` 的計算搬到 early return **之前**——組隊 handler 會用到它，放在後面會變成依賴渲染順序的 TDZ 陷阱。

⚠️ **要手動貼 Firestore 規則到 Console**（CLI 會 403）：`match /guildTeamRooms/{roomId} { allow read, write: if isLoggedIn(); }`。已寫進 repo 的 `firestore.rules`。**沒貼的話開房會 permission-denied**。

## 2026-07-26（讀寫量稽核第三輪：把剩下沒查的全查完）

**① 世界王的扇出放大（本輪最大一筆）**
- 問題：`subscribeActiveWorldBoss` 訂閱的是**完整王文件**，而每次攻擊都在寫那份文件（HP／參戰數／傷害榜）。Firestore 是「文件一變動就推給所有訂閱者、每人計 1 次讀取」——而這支監聽**常駐在 MemberApp**：20 人在線、每人打 10 次 = 200 次寫入 → **200 × 20 = 4,000 次讀取**，全部只為了顯示一句「世界王現身」。
- 解法：新增 `worldBossStatus/current` 極小狀態文件（只有 `eventId/status/bossName/announcement`），**只在開場／被擊殺／結束時寫**（一場活動個位數次）。App 層改訂閱這份小的；完整王文件只在戰鬥畫面內訂閱（那裡本來就要看 HP）。
- ⚠️ **要手動貼 Firestore 規則到 Console**（CLI 會 403）：`match /worldBossStatus/{docId} { allow read, write: if isLoggedIn(); }`。已寫進 repo 的 `firestore.rules`。寫入權必須開給登入者——「擊殺」是學生的攻擊觸發的；這份文件沒有經濟價值，被亂改最多是橫幅顯示錯誤。
- ⚠️ **規則還沒貼也不會壞**：`subscribeWorldBossStatus` 讀不到（permission-denied 或文件不存在）會**自動退回舊的完整訂閱**，只是省不到。

**② 接上一直沒接線的 `nonessentialListeners`**
`costControl.js` 早就定義了這個能力旗標，但**程式裡從來沒有任何地方真的用它**——等於成本警報升到 restricted 也沒省到。現在 MemberApp 的三個「看板型」監聽（地下城首殺播報／世界王橫幅／緊急任務彈窗）會在 restricted 以上自動停掛。核心功能（通知／報到／認證／存檔）永遠保留。

**③ 登入時的多餘讀寫**
`updateLastLogin` 原本先 `getDoc` 再 `updateDoc`，但呼叫端（useAuth）**剛剛才讀過同一份文件**。改成把已知的舊值傳進來：省掉那次讀取，而且 **30 分鐘內重開 App 不重複寫**。

**④ 挖掘頁的重複讀取**
`initAutoDigTimer` 每次進頁面都 `getDoc(members/{id})`，但那份資料 `profile` 已經即時訂閱了。改成可傳入 `memberData`。

**查過、確認乾淨、不用動的**
- **Cloud Functions**：只有 2 個排程（每天 10:00），都有 `limit(50)`。不是問題來源。
- **射手表現頁**：已經是完整 local-first（`getCached*`／`getChanged*`／本地 meta），300 筆完整歷史藏在按鈕後面。
- **挖掘的箭數寫入**：早就改成「只算 patch，由 `addRoundArrows` 併進同一次 updateDoc」＋ `_excavCache`。
- **貓村採集**（`catVillageGathering.js`）：全部是純函數，沒有 Firestore。
- **卡片市集**：條件渲染，只有開到市集分頁才掛監聽。
- **預約**：`getBookingsForMember` 有 `limit(200)`。
- **訪客流程**：舊的 token 制 GuestBattle 已整個淘汰，沒有東西要查。
- **組隊房每回合寫入**（submitArrows × N ＋ processRound）：這是即時多人的**固有成本**，除非大改架構否則省不掉；`writeBatch` 也不會變便宜（Firestore 按文件寫入次數計費）。

## 2026-07-26（首頁排行榜改「只看自己＋手動更新」× 首頁/我的本地優先）

**首頁排行榜（作者拍板）**
- **只顯示自己的名次**（最多 3 排：榜名／我的數值／第 N 名／共幾人），不再列其他人的 Top5。
- **不按「🔄 更新排名」就不會重新讀取**：結果存 localStorage 且**沒有 TTL**。只有本機第一次（還沒有快取）會自動抓一次，之後開 App 都是 **0 次讀取**。卡片右下角顯示「排名快取於 X 分鐘前」。
- 為什麼值得這樣做：這個區塊要算榜就得讀**整個 members 集合**，而它掛在首頁 ⇒ 原本每個學生每次開 App 都付一次全集合讀取。只留自己的名次還有附帶好處——快取體積極小。
- 要即時的：按更新，或點「查看全部」進排行榜頁（那頁維持每次重算）。

**新增 `src/lib/localCache.js`**——本地優先的共用工具（`readLocal`/`writeLocal`/`dropLocal`/`cachedFetch`）。
- 首頁：檢定紀錄、比賽成績（10 分鐘 TTL）
- 我的：檢定紀錄（與首頁**共用同一份快取**）、裝備專精（10 分鐘 TTL）
- 專精三個寫入函式（解鎖／切換／升級）都會 `dropLocal` 讓快取失效，升級後不會看到舊資料。

> ⚠️ **判準寫在檔頭了**：可以快取的是「變動不頻繁、晚幾分鐘看到沒差」的（檢定、成績、專精）；
> **不可以**快取房間狀態、CAT幣／材料餘額、報到狀態——那些會被別人或自己在別台裝置改，
> 快取住會讓玩家依過期資料做決定。另外**大量文件不要塞 localStorage**（只有 5MB），
> 那種用 Firestore 自己的 IndexedDB 快取（`getDocsFromCache`），見 `getPracticeLogsPage`。

## 2026-07-26（讀寫量稽核第二輪：首頁與 per-member 查詢）

把稽核從練習頁擴大到其他頁面，改掉的地方：

| 位置 | 問題 | 處置 |
|---|---|---|
| **首頁**・徽章紀錄 | `subscribeBadgeLogs` 把該會員**歷來所有**徽章紀錄全撈，但只用 `filter(status === "pending_claim")` | 新增 `subscribePendingBadgeLogs`：兩個等式條件、不排序（Firestore index merging，免建複合索引），失敗自動退回原查詢 |
| **首頁**・比賽成績 | `getMemberResults` 撈全部，但只顯示最近 5 筆 | 加 `maxCount` 參數，首頁傳 5（不傳＝維持全撈，成績歷史頁與後台要看全部） |
| **首頁**・排行榜區塊 | 為了算 15 個榜要 `getMembers()`（**整個 members 集合**），而且掛在首頁＝每人每次開 App 都付一次 | 快取**算好的結果**（不是原始會員資料，只留 id/name/value）到 localStorage，TTL 30 分鐘 → 命中就是 0 次讀取。要即時的點「查看全部」進排行榜頁（那頁維持每次重算） |
| 學習紀錄／對外比賽／訊息 | 三支 per-member 查詢都沒有 `limit`，會隨年資無限成長 | 分別加上 100／100／80 的預設上限 |

**確認過沒問題、不動的**
- 教練後台的紅點查詢（待審核成績／報到／月卡／公會提交）都已經是 `where(status == "pending")`，結果集本來就小。
- 射手端常駐的十幾個監聽多半是**單一文件**（certification／monsterDex／cardCollection…），一次 1 次讀取，不值得動。

## 2026-07-26（local-first 歷史紀錄 × 組隊房自動同步）

**練習頁改成 local-first 三層**（作者：「能用本地資料的優先」）
- ① 記分分頁**完全不訂閱**（0 次讀取）——只有歷史／總覽／分析分頁才掛監聽
- ② 掛上去也只要**最近 10 筆**（真正需要新鮮度的就這些）
- ③ 更早的按需翻頁：`getPracticeLogsPage()` **先撈 IndexedDB 快取**，本地筆數夠就完全不打伺服器
- 為什麼安全：練習紀錄是 **append-only 的不可變歷史**，寫完不會再改，放本地永遠不會過期。

> ⚠️ **不要自己做 localStorage 鏡像**：`firebase.js` 已經開了 `persistentLocalCache`（IndexedDB），
> Firestore 本身就是那份「本地快照」。再疊一層只會多一份要維護的過期邏輯，而且 localStorage 只有 5MB。
> 正確做法是用 `getDocsFromCache` 直接命中既有快取（命中＝**計 0 次讀取**）。這個手法專案裡本來就有
> （`shootingSessions`／`gamePerformances` 都是這樣讀的）。

**組隊房「不用再手動按更新」**（作者要求，但**不是**用 3 秒輪詢）
- ⚠️ 這兩個房間本來就是 `onSnapshot` 推送，資料一直有進來。每 3 秒去 Firestore 撈一次**不會更新鮮**，只會讓每人每分鐘多 20 次讀取（8 人房＝每分鐘 160 次）。真正卡住的是**本機**：動畫閘門被背景分頁凍結、claim/confirm 寫入失敗沒重試。
- 貓貓村探索組隊：加**本機看門狗**（卡住 6 秒自動跑 resync 的本地邏輯＋重試自己的寫入，每個 seq 只做一次）＋**切回前景立刻同步一次**（手機鎖屏後最常見的卡住情境）。自動同步不跳提示。→ **0 次額外讀取**。
- 地下城組隊：`confirmNonCombatRoom` 加**自動重試**（3 次、遞增退避）。五個呼叫點全都是 `await` 但不看回傳值，一次網路抖動就等於這個人的確認永遠沒寫進去、全隊卡住等他——房主只好按「強制推進」。在資料層修，五處一次解決。

## 2026-07-26（Firestore 讀寫量稽核與優化）

作者問「讀寫量變得很龐大」，做了一次全面盤點（69 個 onSnapshot、各層寫入路徑），結論與處置：

**先確認已經做對的（沒動）**
- `firebase.js` 有開 `persistentLocalCache`：listener 重新掛載時走 resume token，只計費「變動過的文件」。
- 箭數寫入已批次（localStorage 佇列 ＋ 10 秒 debounce）。

**改掉的五項**
| 問題 | 原本 | 現在 |
|---|---|---|
| 公會存檔寫入放大 | 每個 UI 動作寫一份完整存檔（含 120 格 stash），整理 10 件裝備＝10 次寫入 | `saveGuildProfileDebounced` 1.5 秒合併；`pagehide`／切背景／卸載時 `flushGuildSave` 落地 |
| 練習頁歷史紀錄 | 進頁面就拉 300 筆練習 ＋ 50 筆打怪＝**350 次讀取** | 預設 60 筆，「載入更早的紀錄」再加 120 |
| 教練後台全會員 | 16 個分頁各自 `getMembers()`，切分頁就重讀整個 members | 30 秒 TTL 快取 ＋ inflight 去重；`createMember/updateMember/deleteMember` 會 `invalidateMembersCache()` |
| 首頁/我的公會階級 | 每次掛載一次 `getDoc` | 模組級快取 5 分鐘 ＋ inflight 去重（`invalidateGuildRank` 可手動失效） |
| 決鬥心跳 | 30 秒一次。心跳寫的是**房間文件**，4 人房≈每分鐘 8 寫 + 32 讀 | `DUEL_HEARTBEAT_MS` 90 秒（踢人門檻 5 分鐘，仍有 3 次以上餘裕） |

**⚠️ debounce 的正確性條件**：排隊中的是「當下的完整存檔」，所以任何**直接整份寫入**的路徑（`saveGuildProfile`／購買／賣雜貨／遠征結算）都要先 `cancelGuildSave()`，否則舊快照可能在之後才落地把新資料蓋掉。這幾條路徑都已經加上。

**刻意不做**
- 用 `writeBatch` 合併戰鬥結算的 ~11 次寫入 → **不會變便宜**。Firestore 按「文件寫入次數」計費，batch 只省往返不省錢；要省只能合併 schema，風險高、先不動。
- 縮小 `subscribeAllMessages(150)` → 那 150 筆同時餵給紅點計數與審核頁，砍掉可能讓教練**看不到較早的未回覆訊息**，是功能性退化而不只是省錢。
- 大改計數器 schema → 先看 Firebase Console → Usage 的實際分佈再決定，不要憑猜測優化。

## 2026-07-26（商店三分店 × 七族材料無限量 × 首頁/我的改讀新公會階級 × 戰場站位修正）

**商店重整（作者要求分類）**
- 分成 **武器商店／防具商店／材料商店** 三家（`SHOP_SECTIONS`，槽位→分店對照 `SLOT_SECTION`）。商品太多，一條長列表捲不完。
- **材料商店全面重做**：舊版賣的是「舊六族材料鏈」的 t1~t3（`<族>_m<N>`），但玩家實際掉的是**擴充材料**（`mat_<族>_t<N>_<role>`），貨架跟需求對不上（作者：「只看到山林族的材料」）。現在改吃 `EXPANSION_MATERIALS`：
  - **七大族全開**（含 treasure），族別標籤 × T1~T6 標籤兩層篩選
  - **只賣一般怪素材**（`kind === "normal"`，126 種）；小王／大王素材只能靠打
  - **不限量、不鎖階級**（貨架層級一律 1），高階材料用**價格**當門檻（T1 8 → T6 320 CAT幣）
  - 每種都有單買與 5 入包（8 折）
- `purchaseFromShop` 現在兩套材料都認（擴充材料優先，舊六族鏈保留給舊存檔/舊連結）。

**首頁／我的：舊冒險者等級 → 新公會階級**
- 新增 `src/guild/useGuildRank.js`：**唯讀**小 hook，只讀 `guildProfiles/{memberId}.rep` 兩個欄位。刻意不走 `db/guildDb.loadGuildProfile`——那支會把 guildRewards／裝備目錄／商店資料整包拉進主線 bundle，公會本體是 lazy-load 的，那樣等於白拆。
- 首頁：`冒險 Lv.N` → 階級徽章名稱、`🏛️ 公會 Lv.N` → `公會 <階級>　🏅聲望（距下一階 N）`、統計格 → 公會聲望。
- 我的：射手修煉等級下方新增「🏛️ 冒險者公會」卡（階級／聲望／可接危險度／距下一階）。
- ⚠️ 舊 `adventurerXP` **沒有廢除**——成就圖鑑與教練後台仍在用，只是不再當作「冒險者等級」顯示給玩家。

**2.5D 戰場修正**
- 🐛 `posOf` 的 `topPct` 寫成 `8 + depth*55`，而 `depth` 是「1=遠」→ **遠的怪被放在畫面下方、近的怪跑到最上面**，怪逼近時看起來像在後退。改用 `(1-depth)`：遠 12% → 近 58%。
- 怪物立繪 62 → 92（最遠只剩 46px 看不清楚），實際 74~129px。
- 橫向改以中央展開並隨距離向中央收（近似透視消失點），怪少時不再站到畫面邊緣。
- 結算頁「⭐ 裝備掉落」改用 `equipDisplayName` 顯示中文全名（含詞綴）與品級配色，不再印 `common medic_bag` 這種內部 id。

## 2026-07-26（公會角色美術：玩家立繪 × 九貓微縮模型 × 42 隻舊怪重畫）

戰鬥畫面原本是**三種畫風混在一起**：擴充怪（210 隻）動漫插畫風、舊怪（42 隻 `normalExisting`）寫實暗黑風、玩家還是 emoji 🏹、貓貓用的是「有背景的方形寫實頭像」。本次補齊衝突最大的那三塊。

- **畫風＝跟地下城房塊同一套語言**（可愛微縮模型／黏土手作感／45° 視角／柔和打光）。作者原話：「**不用這麼 Q 版，就像地下城那樣的風格**」。
- **新腳本 `scripts/gen-guild-chars.py`**：ComfyUI → rembg 去背 → 512 WebP → `public/assets/guild/chibi/`。53 張＝玩家 2（idle／拉弓）＋ 九貓 9 ＋ 舊怪 42。
- **玩家立繪接上拉弓動畫**：戰鬥畫面本來就有 `bowPull` 狀態，`HeroArt drawing={bowPull}` 直接換成 `hero_shoot`。
- **貓貓改全身微縮模型**：毛色花紋沿用 `gen-cat-portraits.py` 的九貓描述（玩家要認得出自己的貓）。`CatArt` 新增 `round` 參數並**預設不裁圓**——全身立繪裁圓會把腳切掉。
- **不覆蓋主線圖**：`monsterSources` 改成「公會圖優先、找不到才退回 `/monsters-battle/`」。所以 42 隻舊怪自動吃新圖、210 隻擴充怪照舊，**程式裡不用維護「哪些有新圖」的名單**，主線打怪模式也完全不受影響（公會隔離鐵律）。

**踩坑（生圖）**
- ❌ 先用 Animagine（動漫模型）畫 chibi → 出來是**貼紙風**（白色描邊外框，去背後留一圈白邊）＋平塗向量，跟地下城完全不同世界。**畫風要一致就要用同一個 checkpoint 與同一套風格字串**（DreamShaperXL Turbo / 8 steps / cfg 2.0）。
- ❌ 階級遞進寫 `radiant aura / glowing / floating energy motes` → T5 的熊噴滿彩虹特效塞滿畫面，rembg 認不出主體整張報廢。**強弱改用「裝飾密度／材質／表情」表達，光效字眼一律移到負面詞**。
- ❌ DreamShaper 偏寫實：描述只要有 `huge / roaring / scarred` 就會壓過風格字串畫成寫實猛獸。解法＝每隻怪前面冠上 `a cute chunky toy figurine of`。
- ❌ 模型很愛自己加一塊圓形展示底座（林投姐第一版站在黑色台座上）→ 底座類負面詞要**加權** `(pedestal:1.4)`。
- ❌ **風格字串會決定體型**：STYLE 裡的 `short stubby limbs + FULL BODY standing` 讓所有東西都變兩足人形——百步蛇長出手腳、蜘蛛女王變外星人、六隻寶箱怪全變小怪（箱子不見）。→ 另開 `STYLE_NONBIPED`（換掉那兩句），蛇/蟲/寶箱/紙走這組。
- ❌ 物件型的怪（紙、書、寶箱）連 `a cute toy figurine of` 前綴都要拿掉（前綴＝在叫模型生一隻生物），描述要寫「**身體就是那張紙／那個箱子**」，並把 `(creature:1.4)(animal:1.4)` 加進負面詞；階級遞進也要換成 `TIER_TAIL_OBJ`（不能寫盔甲）。
- 壓不住模型偏好時用 `MOB_NEG` 逐怪加負面詞，比一直重抽有效（蛇連抽三次都失敗，加 `(arms:1.5)(legs:1.5)` 才成）。
- 🧩 **拉弓姿勢用 img2img 從 idle 重繪**（denoise 0.62）：兩張都 txt2img 會抽出兩個長得不一樣的射手，戰鬥中一切換就「閃成別人」。
- 📌 **三層風格結論**（照這個順序選，省得一直重抽）：兩足角色 `STYLE`／四足與蟲蛇 `STYLE_NONBIPED`／主體是物件 `STYLE_OBJECT`（連 figure、character、creature 這些字都要拿掉，並拔掉 `MOB_HEAD` 前綴）。百步蛇王與紙怪各抽四次才中，換到物件風格後一次就對。
- ⚖️ **但「怪＋物件」的合體要留在 NONBIPED**：寶箱怪推到 `STYLE_OBJECT` 之後，變成一個**沒有五官的漂亮寶箱**（或反過來是沒有箱子的獸）。選層級的判準是「主體是不是活的」——寶箱怪是活的，只是長得像箱子。
- ComfyUI 中途卡住是常態（跑到第 7 張卡死）→ `POST /interrupt` 解卡，腳本預設**跳過已存在檔案**可直接續跑。

## 2026-07-26（Vercel Analytics 上線：官網＋學生 App 兩邊都掛）

⚠️ **是兩個不同的 Vercel 專案**，所以要各掛各的、數據也是分開看：
- **官網**（`website/`，`archery.catgroup.com.tw`）：純靜態無建置流程，用 script 標籤 `<script defer src="/_vercel/insights/script.js"></script>`，**9 個頁面全掛**（首頁＋8 個情境子頁）。
- **學生 App**（CRA，`student.catgroup.com.tw`）：`@vercel/analytics` 2.0.1，`src/index.js` 掛 `<Analytics />`。

**本機 `npm start` / 直接開 html 不會有流量**（script 由 Vercel 邊緣注入才有效），數據看各專案的 Vercel → Analytics 分頁。

## 2026-07-26（公會倉庫體驗：撿取過濾器 × 自動分解 × 排序篩選）

掉落率調高之後的**必要配套**——一天進 10+ 件，60 格倉庫兩三天就爆，而且找不到東西。

- **倉庫上限 60 → 120**，而且**滿了不再白掉**：溢出的裝備一律轉成碎片（玩家至少拿得到東西）。原本 `stashFull` 直接丟棄，等於白打。
- **⚙️ 撿取過濾器（ARPG 標配）**：`profile.autoSalvage = { enabled, maxGrade, keepAffixes }`，掉落**當下**就自動分解不想要的。規則刻意只有兩條，設定畫面一眼看懂：
  ① 品級 ≤ maxGrade 的自動分解　② 但「詞綴數 ≥ keepAffixes」或「已強化(+1 以上)」的**一律保留**（怕誤拆好東西）。
  **預設關閉**——不會突然幫玩家拆東西。
- **倉庫排序／篩選**：最新／品級／強化／槽位 ＋ 槽位快篩，掉落變多之後沒有這個根本找不到東西。
- **結算頁回報**：「⚙️ 自動分解 3 件　🔧 +18」，讓玩家知道過濾器做了什麼、拿到多少碎片。
- **架構調整（避免循環相依）**：`enhanceCost`／`enhanceTotalCost`／`salvageValue` 這些**純計價**搬到 `data/guildEquipCatalog.js`，`domain/guildEnhance.js` 改成 re-export。原因：`guildRewards`（入庫時要自動分解）需要 `salvageValue`，但 `guildEnhance` 又 import `guildRewards.normalizeGuildProfile` → 直接引用會變成循環 import。**計價放資料層、碰存檔的操作放 domain** 是這個模組一貫的分法。
- 137 測試全過（新增 6）。

## 2026-07-26（公會裝備掉落大幅調高＋射擊表現連動掉落）

**作者回饋**：「一天只能刷幾次任務，裝備掉落率過低了，要高一點——**這是射箭遊戲啊**」。

- **掉落率調高（兩次）**：`equipChance` 10%~52% → 45%~100% → **65%~100%**（T1~T6，作者二次確認「可以，畢竟還可以分解、刷詞綴」）。理由：一天最多 18 張委託、每張只能接一次（勝敗都結案），舊值讓新手（只能接 3 張 T1）期望值僅 **0.3 件／天**＝等於刷不到。新值新手約 1.4 件／天、高階全清約 12 件／天。**給得大方不會破壞刷裝意義**——低階裝主要是分解成碎片的燃料，真正稀有的是「高品級 × 好詞綴」。
- **🎯 射擊表現連動掉落（核心改動）**：戰鬥狀態新增 `shotStats`（累計箭數與得分），`shootingRatio()` 算整趟命中率，結算用 `ACCURACY_BANDS` 分五帶：
  | 命中率 | 評價 | 掉寶倍率 | 額外判定 |
  |---|---|---|---|
  | ≥90% | S 神射 | ×1.35 | ✅ |
  | ≥78% | A 優異 | ×1.20 | ✅ |
  | ≥62% | B 穩健 | ×1.05 | — |
  | ≥45% | C 普通 | ×0.92 | — |
  | <45% | D 生疏 | ×0.75 | — |
- **一趟最多 3 次裝備判定**：基礎 1 次 ＋ 高命中(A/S) 1 次 ＋ 有首領的委託(danger≥3) 1 次 → 「射得準」與「敢接難的」都看得見回報。結算頁顯示「🎯 射擊評價 S・神射（命中 92%　掉寶 ×1.35　＋額外掉落判定）」。
- **詞綴保底**：掉落品**一律至少 1 條詞綴**（商店貨永遠 0 條）——「刷詞綴」是公會的核心循環，每件都有詞綴才值得一件一件看。T1~T2 有 25% 出第二條、T3~T4 50%、**T5~T6 保證 2 條**。
  - 🐛 順手修：舊的抽詞綴寫法「抽到重複就 break」→ 該掉兩條時偶爾只掉一條。改成從「還沒抽中的池子」`splice` 挑，保證不重複也不會少給。
- **設計定位（寫進資料表註解）**：裝備本身不稀有，稀有的是「**高品級 × 好詞綴**」的組合。掉一堆低階裝是刻意的——它們是①分解成碎片養主力裝 ②不斷重抽詞綴的來源。
- 131 測試全過（新增 6：命中率計算、分帶門檻遞減、神射 vs 生疏、首領額外判定、詞綴保底、T5+ 保證兩條）。

## 2026-07-25（公會稱號 × 冒險者證 × 雜貨圖鑑）

P2 剩下的「稱號／冒險者證」補齊，順帶把已經在存的 `junkSeen` 做成圖鑑。

- **稱號（`data/guildTitles.js` 16 個）**：5 類——遠征次數／高危險委託／收藏／裝備強化／財富。**零戰力加成**（跟階級同一個原則，測試斷言稱號表不得有 `atk`/`hp`/`mult`）。表的形狀是 `{ of(stats), need }`，UI 統一畫「進度 3/10」不必為每個稱號寫顯示邏輯；`need` 可傳函式（「無所不藏」自動跟著雜貨圖鑑總數走）。
- **判定統計全部來自既有欄位**（`domain/guildTitles.buildTitleStats`），不必為稱號另外埋點。只補了兩個「累計型」欄位，因為現有欄位算不出來：`salvagedCount`（分解次數）、`catEarned`（**累計**賺取 CAT幣——`catCoins` 會被花掉，算不出總量）。危險度分流用 `expeditions.byDanger` 直接加總（☠️×3+／×5+／×6）。
- **新 `ui/GuildLicense.jsx`（冒險者證）**：階級徽章＋配戴稱號＋聲望條、6 格戰績（遠征勝/總、☠️×3+、☠️×6、雜貨圖鑑、最高強化、稱號數）、稱號分類清單（未解鎖顯示灰底＋進度條）、**雜貨圖鑑分頁**（72 格，未發現顯示 ❓ 灰底，已發現顯示圖示/稀有度/撿過幾次）。
- **🖼️ 分享圖（`ui/GuildLicenseCard.jsx`）**：作者指正「應該輸出精美圖片，不是複製貼上」——改成 9:16 直式卡片 → `html2canvas` 轉 PNG → `navigator.share`（手機直接分享）／不支援就下載。沿用 `GuestShareCard` 的既有做法（CDN 載 html2canvas）。卡面：大廳底圖＋階級色邊框、階級徽章＋名字＋稱號牌、聲望條、6 格戰績、雜貨圖鑑進度、公會長貓落款與日期。
  - ⚠️ **html2canvas 的雷**（寫在檔頭）：不吃 `aspect-ratio`／`background-clip:text`／複雜濾鏡 → 卡片一律**固定像素＋單純漸層**；圖片要同源並開 `useCORS`；DOM 必須真的可見（放 modal 裡）不能 `display:none`。
  - 踩到的小 bug：`setGuildTitle` 回傳的是「正規化副本」，UI 原本用 `next === profile` 判斷失敗會永遠成立 → 改判 `next.title`。
- 委託板的階級卡整張可點進冒險者證，卡上直接顯示配戴中的稱號。
- **防呆**：存檔裡的稱號若條件已不符（例如日後改門檻）→ `currentTitle` 回 null，不會顯示假稱號。
- 125 測試全過（新增 12）。

## 2026-07-25（公會裝 itemization：詞綴 × 強化 +N × 分解碎片）

刷裝要有深度，得解決兩個問題：**重複掉落的裝備沒用途**（倉庫滿還會卡住 `stashFull`）、**高階裝打到之後沒有長期投資對象**。

- **詞綴（`GUILD_AFFIXES` 10 種）**：銳利/兇暴/堅韌/強壯/疾風/幸運/耐勞/均衡/獵手/守衛，`pct`（對自身六維百分比）＋`flat`（直接加值）。**掉落才有詞綴、商店貨一律沒有** → 「打到的比較好」很直觀。危險度越高越可能帶（T1~2 最多 1 條、T5~6 最多 2 條）。同名同品級的裝備從此不再一模一樣。
- **強化 +N（`PLUS_PCT_PER_LEVEL = 8%`／級）**：上限依品級遞增（粗製 +3 → 傳說 +10），**必定成功**——隨機性已經在掉落與詞綴上了，再賭一層只會變成挫敗來源。裝備中的可以直接強化，不必先卸下。
- **分解 → 碎片（`shards`）**：碎片**只能**從分解裝備取得，而強化只吃碎片＋CAT幣 → **「刷到重複裝」＝「養主力裝的資源」**，掉落永遠不會白費。品級越高回收越多；已投入的強化退回 8 成。倉庫加「♻️ 清倉低階 ×N」一鍵拆掉所有「粗製/精良且未強化」的雜魚裝（**強化過的主力裝絕不會被誤拆**）。
- **踩坑防護**：`equipFromStash`/`unequipSlot` 必須把 `plus`/`affixes` 一起搬，否則強化過的裝備換上換下就歸零——寫了回歸測試守住。`normalizeGuildProfile` 對舊存檔補 `plus:0`/`affixes:[]`、過濾髒詞綴 id、`shards` 夾非負。
- 資料流：`resolveEquipStats(archetypeId, grade, item)` 統一計算（品級倍率 → 詞綴 → 強化係數），`sumGuildEquipStats` 直接吃 item 物件。
- 113 測試全過（新增 16）。

## 2026-07-25（公會遠征：箭數計入紀錄 ＋ 每回合 3/6 箭可選）

作者回報：「冒險任務沒有紀錄箭數，然後要提供 3/6 箭選擇」。

- **箭數計入**：`GuildBattle` 發動回合時把 `shots.length` 回報給 `GuildTestApp`，走**主線同一條** `addRoundArrows(memberId, n, { accountType })`（含離線佇列與 `totalArrowsAllTime`／今日箭數）。公會遠征是真的在射箭，本來就該算進去。訪客/兒童由該函式自行判斷走本機。
- **每回合箭數 3/6**（`GUILD_ARROWS_OPTIONS`，跟主線地下城 `ARROWS_OPTIONS` 同規格）：備包新增選擇（顯示「補給省一半」／「清場快一倍・補給加倍」），存 `guildProfiles.arrowsPerRound`，戰鬥頂列顯示 `🏹n箭/回合`。
- **⚠️ 平衡處理（重要）**：6 箭清場快一倍，如果補給照舊消耗就變成「一律選 6」、選擇形同虛設。所以**補給消耗隨箭數等比放大**（`arrowScale = arrowsPerRound / 3`）→ 變成真正的取捨：**快速清場 vs 撐得久**，跟既有的「裝備 vs 補給」負重張力同一條軸。測試斷言 6 箭的消耗剛好是 3 箭的兩倍。
- 97 測試全過（新增 4）。

## 2026-07-25（公會全面換新：舊 AdventurerGuild 下架）

作者拍板「全面換成新公會介面」→ `MemberApp` 與 `AdminApp` 的 `page==="guild"` **一律**渲染新的
`src/guild/GuildTestApp`（委託板/備包/2.5D 戰鬥/倉庫/商店/雜貨倉庫）。教練端與射手模式一致。

- 舊 `components/member/AdventurerGuild.jsx`（懸賞任務清單）**兩個入口都移除**（檔案留著沒刪）。
- ⚠️ **副作用要知道**：玩家不再能從公會「接懸賞任務」——該玩法已被每日委託板取代。
- **不受影響**：①`submitGuildQuestCompletion` 本來就寫在 `MemberApp`/`AdminApp` 的 `handleQuestKill`（由 MonsterBattle 回報擊殺觸發），**不在舊元件裡** → 進行中的舊任務照樣自動完成 ②教練後台的懸賞範本/獎勵管理在 `AdminApp` 的其他分頁 ③`AdminAdventurerGuild`（冒險者等級總覽）是不同元件，照舊。
- `handleGuildNavigate` 目前沒有呼叫者（保留 + eslint-disable，懸賞玩法若回歸可再接）。
- 冒險入口的「🔧 改建中」→ 金色流光「✨ 全新系統」（純 CSS，`MemberAdventureHub`）。

## 2026-07-25（公會正式對玩家開放＋商店重構＋報酬調高）

- **🚀 正式開放**：`MemberApp` 的 `page==="guild"` 從「改建中」擋板換成新公會遠征（`src/guild/GuildTestApp` + `onBack`）。**教練(admin) 仍走舊 `AdventurerGuild`**——後台懸賞任務流程（`handleGuildNavigate`/`questCtx`）還接在舊元件上，不能一起換掉。`?guild` 隱藏入口保留。
- **🏪 商店重構（作者拍板）**：**商店買不到高階裝備**。只賣 `common`（基礎）與 `rare`（多一階）；`elite` 以上**只能靠遠征掉落**，刷裝才有意義（`validateGuildShop()` 有測試守這條）。貨架分層改成「款式深度」而非「品級高低」：貨架1 常見款 common／貨架2 常見款 rare＋進階款 common／貨架3 進階款 rare。
- **商店擴充**：裝備 58 項（常見款 14 × 2 品級 ＋ 進階款 15 × 2 品級）、材料 36 項（六族 × t1~t3 × 單買/5入包，5 入打 8 折）。裝備價格改成**依六維總量自動估價**（`priceOf`），不再手填、也不會漏改。
- **📈 報酬調高**（作者：報酬率太低）：CAT幣 5/10/18/28/42/60 → **14/28/50/82/125/190**，金幣 60→90 起跳到 980，雜貨件數上限 2~5 → 3~7。定位講清楚：**公會商店是讓玩家自由採購缺的素材，補打怪賺不夠的洞**，所以商店貨幣要給得大方。裝備估價係數同時下調（一趟 T2 遠征就能換一件基礎裝）。
- **🐛 修結算頁「材料：undefined×4」**：材料改成擴充材料後形狀是 `{id,name,qty}`，UI 還在讀舊的 `m.familyTier` → 改讀 `m.name`（中文名）。
- 93 測試全過（新增 4：商店無高階裝、材料主力與 5 入包折扣、5 入包真的給 5 個）。

## 2026-07-25（公會掉落大改：擴充材料 2~3 倍、雜貨倉庫「自己決定何時賣」、雜貨/裝備大擴充）

**作者確認掉落跟主線不一致後拍板三件事。**

- **① 材料改掉擴充材料、量 2~3 倍**（`settleExpedition`）：每隻怪機率命中後掉 **2~3 個**該族該階該 kind 的 `EXPANSION_MATERIALS`（跟主線打怪同一份）。**首領（miniBoss/boss）掉對應 kind 的王素材** → 高危險委託才拿得到。舊六族材料鏈改成 `legacyMaterials` **保底仍給**（舊系統不斷線）。db 層兩種一起寫進 `materialInventory`。
- **② 雜貨不再自動賣掉 → 新增雜貨倉庫**：`settleExpedition` 只回傳撈到什麼，`applyLootToProfile` 存進 `guildProfiles.junkStock`。新 `ui/GuildVault.jsx`：稀有度篩選、單賣／全賣／一鍵全部賣出、顯示單價與合計。**LUK 的評估加成是「賣出當下」才算** → 先囤著把 LUK 養高再賣是刻意留的策略空間（測試有守這條）。金幣進 `members.coins`、CAT幣進公會存檔。
- **③ 雜貨與裝備大擴充**：
  - 新 `data/guildJunkCatalog.js`：**72 種雜貨**（通用 24 + 六族各 8），5 級稀有度（常見/精良/稀有/珍品/傳世）各有權重與價值倍率，**危險度當稀有度 bias**（高階更容易出珍品）；族群雜貨只在該族委託出現（辨識度＝「我今天去了哪裡」）。每件都有一句 flavor。舊 6 個 id 保留，舊圖鑑紀錄不會變孤兒。
  - `guildEquipCatalog` 基礎裝 **14 → 39 種**（每槽 7~9 種）× 6 品級 = **234 組**，流派分明（純攻/極敏/坦/幸運/續航），重的通常也強＝負重取捨更有戲。
- 90 測試全過（新增 9：擴充材料量與 kind、王素材、雜貨進倉庫不換錢、賣出扣庫存、LUK 賣價、髒資料防護、裝備豐富度與舊 id 不失效）。

## 2026-07-25（公會改吃擴充怪 252 隻＋危險度擴到 6 階＋委託牆一排三張）

**作者抓到的漏洞**：「你只有去撈舊怪，沒有去撈新怪」——公會的 `rollExpedition` 一直只讀舊的 `MONSTERS`（36 隻），**擴充圖鑑 252 隻（7 族 × 6 階 × 6 角色，`monsterExpansionCatalog`）完全沒用到**。

- **怪物來源換成 `EXPANSION_MONSTERS`**，用 `toLegacyBattleMonster()` 轉戰鬥形狀（帶 `artKey`/`encounter`/`tierIndex`）。排除寶箱族。
- **危險度 1~6 ＝ 怪物階級 T1~T6**（一對一，最直觀）。`DANGER_META` 重寫：波數 3/3/4/4/5/5、每波隻數遞增、**危險度 3~4 最後一波有小首領、5~6 有大首領**（`encounter` miniBoss/boss，結構感來自「最後一波有東西壓陣」）。
- **⚠️ 新增公會版數值縮放 `GUILD_TIER_SCALE`**：擴充怪是給主線長期養成用的（T6 normal 有 1700~3240 HP），公會六維才剛起步又刻意隔離，直接搬**完全打不動**。縮放依據＝「以該階級預期會穿的公會裝，一隻雜兵約 5 箭解決」反推 HP 係數（T1 0.50 → T6 0.30，ATK 0.90 → 0.75）。**DEF 不縮放**（傷害公式裡已是 `def*0.5`）。這是公會自己的數字，主線不受影響。
- **階級改成一階開一個危險度**：見習 T1／銅牌 T2／銀牌 T3／金牌 T4／白金 T5／傳說 T6（原本 6 階只開 3 個危險度，升階感很鈍）。`LOOT_BY_DANGER` 補到 6 級（高階價值主要來自材料階級更高，不是數字翻倍）。
- **委託改成每個危險度 3 張＝18 張／天**。UI 先做了 T1~T6 折疊分組，**作者說不用折疊、改一排三張** → 改成 `grid repeat(3,1fr)` 的委託牆，卡片自己標 ☠️／T階／族群 icon／波數／首領／狀態，一眼掃完 18 張。
- **詳情頁加「壓陣首領」區塊**（跟雜兵分開列，紅框），`contractMonsterPreview(c, { encounter })` 共用同一個池函式。
- 77 測試全過（新增／改寫 9：一階一危險度、Tn 對應、首領規則、**怪物確實來自擴充圖鑑且 HP 吃過縮放**、寶箱族不出現）。

## 2026-07-25（公會委託板改小卡＋詳情頁：標 T 幾、多元種族）

**作者回饋**：大廳的委託卡太大張，應該小張、點進去才看詳細；要標註是 T 幾的怪物；可以多元種族。

- **委託小卡（`GuildBoard`）**：一張三行——①標題＋☠️星等 ②委託人・族群（混族顯示 `+N`）・**T 階**・波數 ③狀態（點開／已結案／階級不足）。五張一頁看得完。
- **新 `ui/GuildContractSheet.jsx`（詳情底部彈窗）**：故事全文、討伐目標（多元種族標籤＋「混族陣容」）、**怪物階級 T1~T6 色塊**、**可能遭遇清單**（怪物立繪＋名字＋T幾＋❤️⚔️🛡️，格狀）、報酬明細、接受鈕。
- **多元種族**：`rollDailyContracts` 產 `families[]`——例行單族／警戒 1~2 族／緊急 2~3 族（主族排第一，決定故事與戰場底圖）。**混族是玩法差異不是難度差異**（同 tier 的怪，只是陣容更雜）。混族委託的材料標籤會寫「XX等 N 族材料」，因為玩家會拿來湊自己缺的族。
- **`rollExpedition` 抽出 `expeditionMonsterPool(contract)`**：支援 `families[]`（沒給退回單一 `family`）。**關鍵：詳情頁的「可能遭遇」與實際抽怪呼叫同一個函式** → 預覽不會騙人（測試斷言兩者長度一致、且只出現該委託的族群與階級）。
- 71 測試全過（新增 4：混族規則／T 階標註／預覽＝實際池／混族材料標籤）。

## 2026-07-25（公會美術實裝＋大廳排版——emoji 佔位全數換成 ComfyUI 立繪）

**新腳本 `scripts/gen-guild-art.py`**（沿用 `gen-dungeon-covers`/`gen-rune-tiles` 管線，畫風與地下城封面同語言）：
`hall_bg`（公會大廳 2:1）、`field_<族>`×6（2.5D 鳥瞰戰場地面，下緣壓暗留給 UI）、`contract_paper`（羊皮紙材質）、`guild_master`（公會長貓去背立繪）、`rank_<階級>`×6（徽章）、`junk_<id>`×6（雜貨）。全部輸出 `public/assets/guild/`。
- **刻意不生**：怪物與貓貓直接沿用主線 `/monsters-battle/{id}.webp`、`/cats/portraits/{catId}.webp`——省時間，也讓公會看起來就是同一個世界。

**新 `ui/GuildArt.jsx`**：路徑常數 ＋ `ArtOrEmoji`／`MonsterArt`／`CatArt`／`bgLayer`。**鐵律：每張圖都有 emoji fallback**，圖沒生好/載入失敗畫面照樣可玩（排版才能先上、美術後補）。

**排版**：
- **委託板 → 真的像公會大廳**：`hall_bg` 固定底圖、階級徽章＋聲望條的冒險者證、**公會長貓依階級講話**（`MASTER_LINES`，全清當日還有另一句），委託單改成羊皮紙卡＋📌圖釘、深色標籤，危險度用色塊。
- **戰鬥畫面**：族群 `field_<族>` 當戰場地面＋上下漸層分層；怪物 emoji → 真怪物立繪（62px，選中發光）；貓 → 真貓頭像（金框）；死亡殘影也用立繪。
- 備包／倉庫／商店都鋪大廳底圖（不同暗度）；倉庫與商店標上階級徽章；結算頁用該委託族群的戰場底圖（勝綠敗紅），雜貨顯示真圖示，升階橫幅配徽章。

**踩坑（重要，之後生圖必看）**：**全域 STYLE 字串裡的 `warm lantern lighting` 會污染所有 prompt**——羊皮紙生出燈籠＋亂碼文字、雜貨齒輪旁邊長一盞燈。解法是**分層 STYLE**：場景用原本的、**紙張材質 `style=""`（完全不吃）**、**去背物件用中性的 `STYLE_CUTOUT`（soft studio rim light）**，並把 `lantern/candle/pedestal/base` 全塞進負面詞。階級徽章的燈籠紋樣保留（當公會徽記反而好看且六階一致）。

## 2026-07-25（公會動畫＋音效實裝——把「瞬間結算」演成有過程的戰鬥）

**問題**：`processRound` 是純函數、**一瞬間就算完整個回合**，玩家只看到數字忽然變了，完全沒有打擊感。

**演出架構（重點，下次改動畫先看這段）**：算完先把結果**扣在手上**，照 `next.log` 的順序排時間軸播動畫與音效，**播完才 `setState(next)`**。
- 動畫期間 `animating` 鎖住所有輸入（分數鈕/發動鈕/選目標）。
- 血條用 `hitMap`（動畫期間累積的傷害）先扣 → 數字跟得上畫面，收尾時清空換成真實狀態。
- 位置用**開打前**的座標快照（`posMap`）——因為打完怪就從 `alive` 移除了，箭要有東西可以飛過去。
- `posOf(index, len, distance)` 抽成共用函式：怪物定位與箭矢飛行終點用同一份計算，兩邊才對得準。
- 所有 `setTimeout` 進 `timersRef`，卸載時全清（不然動畫跑一半離開畫面會 setState on unmounted）。
- 節奏參數集中在 `const T = { arrowStep, arrowFly, catStep, hitLinger, endPause }`，要調快慢只改這裡。

**動畫**：箭矢從玩家位置飛向目標（CSS transition）、命中抖動＋浮動傷害數字（爆擊 💥 金色）、擊殺殘影 poof、貓貓助攻往前彈跳＋🐾爪痕數字、玩家受擊全畫面紅閃、閃避顯示 MISS、補給耗盡「🍖💧力竭」、怪物距離推進有 0.5s 移動過渡、回合摘要橫幅淡入淡出。

**音效（全部沿用 `src/lib/sound.js` 的 Web Audio 合成，零音檔）**：選目標 `sfxTap`、射箭 `sfxArrowShoot`＋拉弓動畫、命中 `sfxArrowHit`／爆擊 `sfxCritBoom`＋震動、擊殺 `sfxMonsterDead`、貓助攻 `sfxCounter`、受擊 `sfxOrganHit`＋震動、力竭 `sfxSoftFail`、清波 `sfxRoundEnd`、勝 `sfxVictoryFanfare`／敗 `sfxDefeat`；結算頁金幣 `sfxCoinDrop`→裝備 `sfxOpenChest`→升階 `sfxLevelUp` **依序錯開**才聽得出層次。委託板接委託 `sfxPathSelect`、備包加減 `sfxTap`／選貓 `sfxSwitch`／出發 `sfxCast`、商店買到 `sfxShopBuy`／買不到 `sfxError`、倉庫換裝 `sfxSwitch`。
- ⚠️ `unlockAudio()` 在 `GuildTestApp` 掛載時呼叫一次——Web Audio 要使用者手勢才出聲，不解鎖第一個音效會被吃掉。

**新增**：升階橫幅（聲望跨門檻當下顯示新階級＋解鎖內容，配 `sfxLevelUp`）。

## 2026-07-25（公會委託板——扁平的「選危險度」變成有故事的每日委託）

**背景**：公會的入口原本是三顆「危險度 1／2／3」按鈕，完全沒有選擇感與敘事。

- **新 `data/guildContractPool.js`**：純文案庫——8 位委託人 NPC（廟公阿伯／菜市場阿姨／夜班警衛…）× 六族各 3 則在地感故事 × 危險度語氣（例行／警戒／緊急）。**這裡零數值**，加委託只往表裡加資料、不動邏輯。
- **新 `domain/guildContracts.js`**：`rollDailyContracts({ dateKey, memberId })`——**seed = 日期＋memberId 的 hash（mulberry32）**，所以「同一天同一人永遠同一批」。為什麼要 deterministic：**不然玩家會一直重整刷到想要的委託**；但混入 memberId 才有「這是我的委託板」的感覺。
- **危險度分佈固定 `[1,1,2,2,3]`**：低階玩家永遠有兩張接得起來的，也永遠看得到一張接不了的（跟商店鎖住的貨架同一個手法——鎖著也要看得見目標）。
- **結案紀錄** `guildProfiles.contracts = { dateKey, done[] }`：**勝敗都結案**（企劃拍板：失敗也算接過，當天不能重刷），跨日自動換板（`dateKey` 不同就整批視為新的）。
- **新 `ui/GuildBoard.jsx`**：委託單卡片（委託人、故事、族群、波數、💰🐾📦⭐ 獎勵預覽級距）；階級不足顯示「🔒 還差 X 聲望」、已接顯示「✓ 今日已結案」。
- **`GuildTestApp` 改成委託導向**：預設進委託板 → 接委託 → 備包（可「放棄」回板，還沒出發不算結案）→ 戰鬥 → 結算「📜 回委託板」。移除三顆危險度按鈕。
- **驗證**：67 測試全過（新增 12，含「同日同人必相同」「換人換日必不同」「跨日紀錄失效」）、`CI=true` build 乾淨。

## 2026-07-25（全站組隊房「手滑解散」防護盤點）

大富翁修完返回鍵後回頭掃其他組隊房，**同樣的手滑風險有三處**（房主一按就毀掉全房、零提示）：

- **`DungeonLobby.jsx:343` 最隱蔽**：組隊遠征戰術大廳的 **←（返回）** 在上層 `onBack` 裡就會 `disbandTeamExpeditionRoom`，玩家以為只是回上一頁，實際整房解散。
- **`DungeonTeamLobby.jsx` 的「解散房間」按鈕**：無確認，一鍵毀房。
- **`PartyBattleRoom.jsx`**：原本只有 `status === "active"` 才 confirm，但 `leavePartyRoom(.., isHost=true)` 是把房間設 `completed`＝解散，**等待中房主離開一樣毀房卻沒問**。`PartyQuestRoom` 同一個洞。

修法：`DungeonTeamLobby` 三個出口（←／解散／離開）統一走同一個確認彈窗（房主顯示會踢掉 N 位隊友、隊員顯示可再加入）；Party 兩處把確認條件改成「**房主任何狀態都問**、隊員只在戰鬥中問」。

> 通則：**判斷「要不要確認」的依據是後果（會不會影響別人），不是當下狀態**。`isHost` 才是關鍵條件，`status === "active"` 只是次要條件。

## 2026-07-25（大富翁組隊卡死修復——寫入失敗沒補救，全隊互等）

**現象**：組隊大富翁「各自等其他玩家」時卡死，看起來八人都通過了卻不繼續。

**作者的假設是「沒有即時監聽／房主要定時重刷」——這點要修正**：`subscribeBoardRoom` 是 onSnapshot、房主的 finalize/clear effect 每收到一次快照就重算，監聽沒問題。**房主再怎麼刷也沒用，因為缺的那筆資料根本不在 Firestore 裡**。真正的根因是四個「寫入失敗零補救」：

1. **射手交分**（`confirmShootResult`）：原本**先收起射擊 UI 再送出，而且完全不看回傳值**。8 人同時寫同一份房間文件，`runTransaction` 可能 ABORTED；一失敗射手以為交了、房主 `finalizeBoardShoot` 的 `submitted.length < shooters.length` 永遠不成立 → 卡在「射箭中 1/2」。→ 改成**確認寫入成功才收 UI**，失敗顯示原因並保留畫面可再按，按鈕加 `submittingScore` 防重複。
2. **結算 claim**：鎖用 `lastSettleRef`（useRef）**且在呼叫前就設值**，失敗後 ref 已等於 seq，之後每次快照都被自己擋掉 → **永不重試** → `settleClaims[我]` 缺席 → 房主 `allPassed` 永遠 false。→ 失敗時把 ref 退回並用新的 `retryNonce` state 排 1.5 秒重試（**只靠 ref 解鎖沒用——大家都在等時不會再有新快照來叫醒 effect**）。
3. **事件卡 claim**（`confirmCard`）：`claimBoardEvent` 失敗沒處理，卡片永遠停在 `waiting` → 全隊等他。→ 失敗退回可按狀態 + toast。
4. **動畫閘門**：claim/翻牌都要等 `animatedSeq` 追上 `room.seq`，但手機切背景時 `setInterval` 被瀏覽器節流/凍結，動畫走不完 → 那個人永遠不 claim。→ 加 9 秒保險絲直接對齊（狀態本來就是權威的，動畫只是視覺）。
5. **房主 finalize 自我重試**：這步只由快照驅動，撞交易失敗後不會再有快照叫醒它 → 加每 2.5 秒重試到成功。

6. **🔄 重新同步按鈕（右上角，房主與隊員都有）**：作者回報「所有人通過後要等房主重整才能繼續」——這證明卡住的是**房主那台的本地閘門**（`canRoll` 要 `allPassed && !animating && !card && !rolling`，任何一個沒重置就永遠按不下去），房間文件本身是對的，所以重整就好了。這顆按鈕做的就是「重整會做的事」但不用離開房間：對齊 `animatedSeq`、清 `animating`/`rolling`/waiting 卡片、解鎖 claim 重試（已領過的會被 `settleClaims` 擋掉不會重複領）、房主在**全員已領完時**才清 pending（沒這個條件會把還沒領的人的獎勵抹掉）。

7. **返回鍵加確認彈窗**（等待室＋遊戲中兩處）：原本左上角 ← 直接執行 `exitRoom`，而**房主按下去是 `disbandBoardRoom`＝整間解散、所有隊友一起被踢**，手滑一次全隊重來。改成先跳確認，房主／隊員文案不同（房主明說會踢掉 N 位隊友且進度不保留；隊員說明可從大廳重新加入）。

8. **房主解卡工具（隊員關 App／斷線時全隊永遠互等）**：斷線的人不會再寫任何 claim，`allPassed` 就永遠不成立。卡同一步 **15 秒**後（避免網路慢就被踢）房主才會看到：
   - **移除隊員** `kickBoardMember`：等同幫他按離開。⚠️ **他若是本回合被指派的射手，必須同時從 `pendingShoot.shooters` 移掉**，否則 `finalizeBoardShoot` 還是收不齊，踢了也解不了卡。
   - **強制推進** `forceAdvanceRoom`：哪段卡住推哪段——卡射箭 → 用已交的分數直接結算（沒交的不計入平均）；卡領取 → 寫 `forcedSeq = seq`，各端把 `forced` 視為 `allPassed`。**沒領到就是沒領到（作者拍板）**，但人還在房裡，下一步能繼續玩。
   - 被踢的人前端偵測 `room.members[me]` 消失 → 自動退回大廳並提示。
   - ⚠️ **文案踩坑**：一開始寫「移除後可重新加入」是錯的——`joinBoardRoom` 只收 `status==="waiting"` 的房間、`findReconnectableBoardRoom` 要求人還在 `members` 裡，所以**遊戲進行中被移除或自行離開都回不來**。返回確認彈窗也依 `room.status` 分兩種文案（等待室可再加入／遊戲中回不來）。

**通則（寫給下一個 AI）**：組隊功能裡任何「別人在等我這筆寫入」的操作，**失敗一定要能重試，而且不能只靠 ref 解鎖**——因為卡住時系統是靜止的、不會再有快照事件。UI 也不能在確認寫入成功前就先收掉。另外「要重整才會動」＝**本地閘門沒重置**，不是伺服器資料有問題，永遠要留一個不用重整的重新同步出口。

## 2026-07-25（公會：真貓參戰——接上主線貓貓養成）

**背景**：公會戰鬥的貓一直是 `MOCK_CATS` 假資料（小黑/橘子），但「貓村×打怪的融合」是這個系統的立意核心，貓不接真的就沒融合。

- **新 `domain/guildCats.js`**：`toGuildCat`（真貓文件 → 戰鬥單位）**沿用主線 `calcCatCombatStats`**，公會不另開一套貓數值 → **在貓村養貓（XP/羈絆/貓裝）直接讓遠征變強**，測試有斷言「養越多 atk 越高」。`buildCatRoster`（依攻擊排序）、`pickPartyCats`、`togglePartyCat`。上限 `MAX_PARTY_CATS = 3`。
- **單向依賴**：公會**只讀**貓資料，不呼叫 `addCatBond`/`addCatXP`（遠征不養貓），避免公會偷偷灌主線成長。
- **存檔**：`guildProfiles.partyCats`。**`null`（沒設定過）→ 自動帶最強前 3 隻**；**`[]`（玩家刻意全取消）→ 真的不帶貓**。這兩者一定要分開——如果用「空陣列＝未設定」，取消最後一隻貓會被自動補回去，看起來像壞掉（測試有守這條）。
- **UI**：備包頁新增「出戰貓貓 n/3」選擇區（顯示 Lv/類型/⚔️/🛡️，不佔負重）；`GuildBattle` 底部原本畫死兩隻 🐱，改成**實際出戰的貓**（名字+攻擊力）。未登入離線試玩仍用假貓（名字標「（測試）」）。
- **驗證**：55 測試全過（新增 8）、`CI=true` build 乾淨。

## 2026-07-25（公會 P2：階級/聲望 + 公會商店——CAT幣終於有去處）

**背景**：P1.5 之後聲望與 CAT幣只會累積、沒有任何意義。這次讓兩者各自有出口：聲望→階級解鎖、CAT幣→商店。

- **新 `domain/guildRank.js`**：6 階（見習 0／銅牌 100／銀牌 300／金牌 700／白金 1500／傳說 3000）。`repToRank`/`nextRankInfo`/`rankUnlocks`/`canAcceptDanger`/`repNeededForDanger`。
- **核心設計決策：階級零戰力加成**。舊公會的 `RANKS.mult` 金幣加乘已廢除，新階級只解鎖 ①**可接的危險度上限**（見習☠️1／銅銀☠️2／金牌以上☠️3）②**商店貨架層級**。進度感來自「能去更深的地方」，不是偷偷變強 → 公會強度永遠不會外溢。**測試直接斷言階級表沒有 `mult`/`atk`/`hp` 欄位**，防止日後有人手滑加回去。
- **新 `data/guildShop.js` + `domain/guildShopPurchase.js`（純函數）**：賣兩類——①主線材料（六族 t1~t3，10/25/60 CAT幣，回饋打怪/貓村經濟；高階材料不賣，留成就感）②公會裝（3 個貨架層級 35~380 CAT幣）。驗證階級/CAT幣/倉庫上限全在純函數，db 只寫。
- **新 `ui/GuildShop.jsx`**：鎖住的貨架**仍顯示**（給目標感）但按鈕禁用並標「需 🥈銀牌冒險者」。
- **UI 接線**：`GuildTestApp` 備包頁加「委託危險度」選擇列（鎖住的顯示「差X聲望」）＋階級/CAT幣列＋倉庫/商店入口；結算頁加階級進度條；`GuildStash` 上方加「冒險者證」卡（階級/可接危險度/貨架層級/聲望進度）。
- **驗證**：47 測試全過（新增 13）、`CI=true` build 乾淨。定價基準＝一趟遠征約 5~25 CAT幣，調價只改 `guildShop.js` 一張表。

## 2026-07-25（公會 P1.5：持久化——獎勵真的入帳、公會裝可換）

**背景**：P1 迴圈可玩但**打完什麼都不留**（CAT幣/聲望/掉的裝備一重整就沒了）。這次把存檔接上，公會才算真的有「養成」。

- **存哪裡（決策）**：新集合 **`guildProfiles/{memberId}`**（`catCoins` / `rep` / `equipped` / `stash` / `junkSeen` / `expeditions`）。design.md 原本寫「members 欄位或獨立集合」，選獨立集合的理由＝**不必動 members 那兩份 hasOnly 白名單**（規則只加一個 block），也更符合公會隔離。
- **回饋主線的兩樣照舊寫主線**：金幣 → `members/{id}.coins`（已在白名單）、材料 → `materialInventory`（`addMaterials`）。公會的 `ghost_t3` 用 `guildMaterialId()` 對應主線 `ghost_m3`（同族同階），對不到就丟棄不寫髒資料。
- **新 `domain/guildRewards.js`（純函數，13 測試）**：`normalizeGuildProfile`（舊/壞資料補完整形狀＋過濾不存在的裝備 id）、`applyLootToProfile`（CAT幣/聲望/裝備入庫/雜貨圖鑑/場次，不改輸入）、`equipFromStash`/`unequipSlot`（換下來的**退回倉庫不消失**）、`GUILD_STASH_LIMIT=60`、聲望＝危險度×10。
- **新 `db/guildDb.js`**：只做 I/O，規則全在 domain。`loadGuildProfile`/`subscribeGuildProfile`/`saveGuildProfile`/`grantExpeditionRewards`。
- **新 `ui/GuildStash.jsx`**：CAT幣/聲望/勝場、六維、5 槽卸下、倉庫換裝（顯示每件六維與重量）。
- **`GuildTestApp`**：接 `useAuth`，登入 → 真存檔；**未登入 `?guild` 仍可離線試玩**（算得出結果但不寫 Firestore，畫面標「離線試玩」）。新玩家給起手裝（木弓/木箭/布甲 common），不裸奔。
- **⚠️ 待辦：`firestore.rules` 新增 `guildProfiles` block，需老闆手動貼 Console**，否則入帳會顯示「⚠️ 入帳失敗」。

**踩坑**：`settleExpedition` 有隨機性——原本用 `useMemo` 算一份顯示、入帳時若再算一次就會**顯示與實得不同**。改成在入帳的 effect 裡 roll 一次存進 state，顯示與寫入同一份；一趟一次用 `grantedRef` 鎖 `run.key`。

**隔離佐證**：`grep -rn "guild/" src` 除 `App.jsx` 路由外零引用；`calcGuildExpeditionStats`/`guildRewards`/`guildDb` 沒有任何主線檔案 import。

## 2026-07-25（冒險者公會重生 P1：獨立 2.5D 遠征遊戲雛形）

**背景**：舊冒險者公會「雞肋」→ 企劃成一款**貓村×打怪融合的獨立 2.5D ARPG 遠征遊戲**（完整企劃在 `.trellis/tasks/07-25-adventurer-guild-rework/` prd/design/implement）。前台舊入口已鎖「改建中」（射手鎖/教練可測），新雛形走隱藏入口 **`?guild`**。

**架構定位**：獨立模組 `src/guild/`（比照 zombie DDD），**只帶入射手等級+貓貓**，不帶怪物卡/主線裝備 → 天生與主線隔離、主線平衡零風險。

**P1 已完成（本 session，全 commit、測試護、隔離）**：
- `data/guildEquipCatalog.js`：ARPG 裝備（5槽×多基礎裝×6品級×六維參數），`guildLootTable.js` 雜貨/掉落。
- `domain/`：`guildStats`(六維 HP/ATK/AGI/DEF/VIT/LUK + 衍生值)、`rollExpedition`(委託→隨機怪波，沿用打怪數值)、`expeditionFlow`(戰鬥狀態機：射箭/貓貓助攻/怪距離倒數攻擊/補給消耗/勝敗)、`settleExpedition`(材料/雜貨→金幣+CAT幣/裝備掉落)。**21 測試全過。**
- `ui/`：`GuildBattle`(2.5D 鳥瞰、emoji 佔位、選目標射真實箭)、`GuildLoadout`(備包：裝備 vs 補給的負重抉擇)。
- `?guild` 測試入口（App.jsx，比照 ?zombie）。

**完整迴圈可玩**：備包 → 出發 → 2.5D 戰鬥(貓貓參戰/補給消耗) → 凱旋結算。

**六維影響**：ATK傷害/AGI額外箭+閃避/DEF減傷/VIT省補給+負重/LUK掉寶+爆擊+雜貨價值。

**下次接（不同性質，適合新 session）**：①持久化(CAT幣/材料/公會裝/聲望存 Firestore+規則+獎勵真發背包) ②階級/聲望(P2) ③大廳+委託板+公會長貓(P4) ④ComfyUI 2.5D 美術(P4)。**目前美術是 emoji 佔位。**

**踩坑**：GuildBattle 未用的 import(STAT_META/derived) 會被 CI 當 error 擋——公會這種新元件記得清乾淨再 build。

## 2026-07-25（卡片天賦透明化：裝備總效果面板 — 純顯示零平衡）

**背景**：玩家反映怪物卡天賦「裝上去跟顯示有落差、不知道怎麼搭」。根因＝三個隱形機制沒攤開：①`TALENT_CAPS` 隱形上限 ②名字不同卻共用同一 key＋上限（蓄勁/淬毒/蠻力→damagePct）③UI 只顯示單卡、戰鬥吃彙總砍上限後的值。決策：第一段只做「純顯示」，不動任何數值/公式/上限。

- **新 `src/lib/cardTalentDisplay.js`**：`EFFECT_DISPLAY`（key→icon/名/共池來源，cap 一律引用 `TALENT_CAPS` 不抄數字）、`buildEquippedViews`、`buildContribution`（key→貢獻卡片含 monsterId）、`buildSuggestion`（撞頂/差一張套裝/有空間 主動建議）。
- **新 `TalentEffectPanel.jsx`**（裝備頁 header）：實際生效值進度條（x/上限、封頂「已滿」變灰）、每條下「來自：卡片名」、族系套裝、主動建議、可收合。移除 `CardCollectionModern` 舊的重複套裝區。
- **`CardMiniCell`**：卡面直接顯示天賦（不用點進去）。**`CardDetailSheet`**：天賦後補「歸【分類】共享上限」。
- **零平衡佐證**：`cardTalents.js` 唯一改動＝`TALENT_CAPS` 加 `export`（供顯示層引用同一份上限），數值/caps/公式一個沒動。
- **踩坑**：①`TALENT_CAPS` 原本沒 export → 顯示層 import 到 undefined，`effectCap` 讀 `undefined.damagePct` 在**教練射手模式**直接白屏崩潰（正是 ai-guide 鐵律 #7 的點）；加 export 修好。②卡名要用 `CARD_CATALOG_BY_ID[monsterId].name` 解析，且名稱解析放**元件層**不放 lib（避免 lib→component 循環 import）。
- **順帶修正**：`game-systems.md` 舊記「MAX_EQUIPPED=5」錯誤 → 實際 `MAX_EQUIPPED_BY_STAT {hp:5,atk:3,def:3}` 共 11 張。
- **第二段（未做）**：拆共池 key、套裝 vs 天賦流派重設計＝會動平衡，另案。

## 2026-07-25（第二大腦大校正 — 稽核筆記 vs 實際 code）

**背景**：作者發現第二大腦筆記與現況嚴重脫節。用 Gemini Flash 做全專案稽核（讀 210 檔），Claude 逐條驗收後修正。稽核結果：筆記正確率約 29%（✅42 / ⚠️過時38 / ❌缺漏45 / 🗑️已死18）。稽核報告留存於 `docs/second_brain/_audit/`（`gap-map.md` + `src-inventory.md`）。

- **`ai-guide.md`**：DB 模組清單從 6 個補成 **20 個 `*Db.js` 權威清單**（實查 `src/lib/*Db.js`）；新增鐵律 #11「成本控制會靜默擋寫入」；除錯表補「寫入沒反應」第三嫌疑犯；快速路標補 `?zombie`/`?catalog` 路由（標🚧測試中）。
- **`quick-ref.md`**：`const C` 修正 5 個錯誤常數名（`C_MONSTER`→`C_MONSTER_SESSION` 等）、集合名 `monthlyCards`→`monthlyCardRequests`；補 6 個漏記集合 + 15 個獨立常數；`subscribeTodayPracticeLogs`（已刪）兩處標「已廢除」。
- **`game-systems.md`**：補 3 個真玩法——貓貓村大富翁、裝備專精、殭屍生存模式（各實查原始碼）。
- **`features.md`**：補漏列功能——大富翁/約課/裝備專精/殭屍/catalog/成本控制。
- **殭屍 & catalog 定位**：作者指示兩者仍測試中，**只保留隱藏網址、禁止建玩家入口**，已寫入 game-systems/ai-guide/features 三處明文約束。

**踩坑提醒（重要）**：
- **Gemini Flash 稽核會產生幻覺**。這次抓到它捏造一條「quick-ref.md:271 還在用舊 token 訪客機制」——實際整份筆記早已是 `resolveGuestSession`，那個位置是遠征/卡片市集。**結論：Flash 適合做「讀 code 填表」的機械稽核（省 token），但它的落差判斷會捏造、會誇大嚴重度，必須由 Claude 逐條回原始碼驗證後才能寫進筆記。分工＝Flash 稽核、Claude 驗收+編寫。**
- 判斷性內容（為什麼/踩坑/架構敘述）不可交給 Flash 寫——它會產出「看似合理實為幻覺」的敘述污染事實來源。

## 2026-07-25（排行榜全面改版 + 季賽系統）

**背景**：舊排行榜（`MemberLeaderboard.jsx`）資料豐富但呈現陽春、無時間維度→定型後沒人看。作者要：重做視覺(RPG 深色風)、加季賽(用「季」)、照現有功能多加榜、一次到位。

- **季賽（`src/lib/seasonDb.js`，新）**：日曆季 `2026-Q3`。**快照差值法**——每季首位開榜者用 `runTransaction` 建 `seasons/{id}` 存全員當下數值快照；本季榜 = 現值 − 快照(clamp≥0)。不需為每筆紀錄埋時間戳，任何累計欄位都能算「這季新增」。`seasonDaysLeft()` 季末倒數。
- **資料層（`src/lib/leaderboardData.js`，新）**：集中 `LB_GROUPS`/`LB_TABS`/`rankBoard`/`computeSeasonMetrics`/`buildCertMaps`。UI 只畫。榜分五類：競技/戰鬥/徽章/收藏/貓貓村。
- **UI 重寫 `MemberLeaderboard.jsx`**：深色 RPG、頒獎台(冠亞季軍高低台階)、**我的名次卡**(不管排第幾都置頂+距上一名差X)、分組 pill、族群子頁、總榜/本季切換、季末倒數條。
- **新榜**：射箭總數(`totalArrowsAllTime` 已存)、族群獵殺×7族(monsterDex)、頭目+、突破地下城×7族+總(`dungeonClears.{family}`★)、世界王傷害(`worldBossDmgTotal`★)、組隊傷害(`partyDmgTotal`★)、卡片收藏、地下城圖鑑完成度、成就圖鑑完成度(`computeDexStats`)、最高等級貓貓(`maxCatXP`★)、探索繞圈(`villageTotalLaps`★)。
- **埋點(★新指標，從上線起算，無法回推歷史)**：
  - `villageTotalLaps`：`villageBoardDb.rollAndMove` 繞圈時 +1（單機）；`CatVillageBoardTeam` 跟隨動畫 `finish()` 每成員各自 +1（組隊共用棋子、房主不能代寫全員→各 client 在自己 seq 記一次）
  - `dungeonClears.{family}`：`DungeonExpedition.showResult(won)` 唯一出口、`clearCountedRef` 防重複（**目前只計單人遠征，組隊 ExpeditionBattleRoom 尚未埋**）
  - `worldBossDmgTotal`：`worldBossDb` strike 非訪客區塊 += combinedDmg
  - `partyDmgTotal`：`PartyBattleRoom.handleClaim` 勝場 dex 記錄同一 once-guard 內 += myDmg
  - `maxCatXP`：`catDb.addCatXP` 升 XP 後讀該貓新總 XP，> 現值才更新（全隊最高貓）
- **兩套家族**：怪物擊殺/突破榜用 `FAMILIES`(monsterData，含 treasure 共 7)；地下城地圖 `FAMILY_META` 只 6 族(無寶箱)→突破榜資料驅動顯示，有破才亮。
- **firestore.rules**：member 兩份白名單加 `villageTotalLaps/dungeonClears/worldBossDmgTotal/partyDmgTotal/maxCatXP`；新增 `seasons` collection(登入者可讀+create，admin 可改)。
- **⚠️ 踩坑**：Bash 工具是 Git Bash 不是 PowerShell——`@'...'@` heredoc 會被當字面 `@`，commit 訊息開頭多 `@`；bash 要用 `<<'EOF'`。
- **待辦**：①~~firestore.rules 需手動貼 Console~~ **✅ 已貼（2026-07-25 作者確認）** ②組隊遠征突破次數未埋 ③季快照在季中首次開榜才拍→會漏該季開榜前的量(首季上線自然、可接受)。

## 2026-07-23（怪物掉落改新族系/王素材箱 — 接線 FREEBUFF 設計）

**背景**：FREEBUFF 設計的新素材箱（`itemData.js` commit 38cfbd0）只有定義+開箱邏輯，**沒接到掉落**。作者要：一般怪掉「該族該階族系箱」、小王掉小王箱、大王掉大王箱；舊箱保留不刪。

- `makeChests(monster, mode)`（所有戰鬥共同入口）新增分箱：`ALL_FAMILIES`（ghost/mountain/insect/workplace/exam/temple/treasure）內的家族 → 依 `encounter` 給 `family_mat`/`mini_boss_mat`/`boss_mat`；傳統家族（forest/dragon/…）或缺 family → **沿用舊通用箱**（舊系統完整保留、既有背包舊箱照常開）。
- `encounter`/`family`/`tierIndex` 優先讀怪物物件，缺就用 `EXPANSION_MONSTER_BY_ID[monster.id]` 回查圖鑑（戰鬥物件可能被精簡）。tier→tierIndex 用 `MONSTER_TIER_ORDER`。
- **作者拍板**：`makeMiniBossChest`/`makeBossChest` 從「跨家族單 kind」改成**綁該族該階、開該族該階全部素材**（normal+miniBoss+boss 全 kind）；小王 2~4 個、大王 3~6 個。命名改「幽冥小王T3素材箱」等。
- 顯示：`MemberMaterials` 已 `ch.name || base.name`（族系名正確顯示）；`MonsterBattle` 戰鬥 log 改用 `mainChest.name`。
- **踩坑**：遊戲有**兩套家族**——傳統打怪 forest/dragon…、地下城/擴充 ghost/mountain…；新族系箱只吃擴充家族，用 `ALL_FAMILIES.includes(family)` 當守門，避免傳統打怪掉到空箱。
- **通用材料寶箱（同日追加）**：舊 wood/iron/gold/epic/mythic 五種箱**重新定位為「通用材料寶箱」**——`openChestContents` 改成依來源怪階級開出**六大族**（ghost/mountain/insect/workplace/exam/temple，**不含 treasure**）該階材料，kind 依箱等級放寬（木/鐵普通、金/史詩加小王、神話含大王），每族 1~maxPerTier 個。取代舊的「單一家族分層擴散」。CHEST_TYPES 名稱/desc 改「通用材料X箱」。移除已無用的 `RARITY_ORDER`。
  - **設計影響**：這些箱現在只從「傳統家族單人打怪」(forest/dragon…) 掉（地下城家族怪走新族系/王箱）；開出的是**地下城六大族素材**，非 legacy forest/dragon 素材（legacy 素材仍可由直接掉落 `rollFamilyMaterial` 取得，只是不再從這些箱開出）。
  - 測試 `expansionChestMaterials.test.js` 更新為驗證新通用箱行為（同階、跨族、不含寶箱族）。
- **族系箱美術（同日追加，ComfyUI）**：作者選「42 張、只族系箱、RPG 質感寫實」。`scripts/gen-chest-tiles.py`（沿用 gen-dungeon-tiles 管線：ComfyUI /prompt→rembg 去背→512 WebP）生 7 族×6 階 closed chest 立繪到 `public/assets/chests/chest_<family>_t<n>.webp`；風格寫實（負面詞排除 cartoon/chibi），族系材質主題（幽冥藍調鬼火/山嶺岩木/昆蟲甲殼/職場金屬藍/考試書卷/神廟白金神聖/寶箱族純金）+ 階級遞進（T1樸素→T6華麗發光）。小王/大王箱維持 emoji/顏色（作者選不另生圖）。
  - `makeFamilyMaterialChest` 加 `img: /assets/chests/chest_<family>_t<n>.webp`；`MemberMaterials` 背包卡與開箱動畫改「有 img 用 `<img>`、無則 emoji」。小王/大王/舊通用箱無 img 走 emoji。

---

## 2026-07-23（後台訪客帳號卡片：預約明細直顯 + 最後預約時間 + 逾14天標記）

- `AdminGuestAccounts.jsx` `GuestCard`：把「📋 預約明細」（總筆數/進行中/已完成/已取消）從展開區移出、**直接顯示**；移除展開區內的重複那份。
- 新增「🗓 最後一次預約」：讀 `bookingStats.lastBookingAt`（建立/改期更新、取消不動）。
- 新增「😴 逾 N 天未預約」徽章：`daysSinceBooking >= 14` 時亮，對應既有 14 天自動回訪信（`functions/bookingReminder.js` `REMINDER_DELAY_DAYS=14`、`bookingEmail.js` `studentInactive`「好久不見，回來預約練習吧」）。
- 註：回訪信 Cloud Function 依「最後完成課程」滿 14 天且無未來預約才寄；此徽章只是後台對照，不改寄信邏輯。

---

## 2026-07-23（修：我的>裝備展示 升級材料顯示原始 ID）

- `MemberProfile.jsx` 升級材料需求原本 `MATERIALS[m.id]?.name`——但 `MATERIALS` 是**陣列不是 map**，索引永遠 undefined → 顯示原始 ID（`workplace_m4`、`mat_ghost_t4_normal_a`…）。且 `mat_*` 擴充素材根本不在 legacy `MATERIALS`。
- 修：建 `MATERIAL_BY_ID`（合併 legacy `MATERIALS` + `EXPANSION_MATERIALS`）→ 顯示 icon + 中文名。
- **踩坑**：`monsterEconomyCatalog.MATERIAL_BY_ID` 只含擴充素材；要同時顯示 legacy 家族素材（`家族_m階`）名稱得自建合併 map。

---

## 2026-07-23（地下城美術重製 + 儲存槽 3→6 + 符文美術）

**① 地下城房塊風格統一（GEMINI 方塊圖 → 圓石台）**
- 作者回報：幽靈族（我的圓石台手繪風）好，其他 6 族是 GEMINI `addff2b` 生的方形等角草地方塊圖，風格不一致、族特色薄弱。
- 用 `gen-dungeon-tiles.py` 重生 mountain/insect/workplace/exam/temple/treasure 全房型（11 房型/族），統一成圓石台手繪風、各族 creature 加強特色。幽靈族保留不動。
- **踩坑**：`STYLE_CREATURE` 主體太搶焦會讓「圓石台」被 seed 省略（懸空）→ 強化「FULL round platform 完整可見 + 創作物中等大小 + 負面詞 no platform/square tile」才穩。地圖只畫細連接線不畫台座，故 tile 圖必須自帶石台。

**② 地下城橫向外觀封面（7 族 × 6 階 = 42 張，新）**
- `gen-dungeon-covers.py`：寬幅 2:1 手繪地下城入口場景（不去背，風格同 map_bg）+ **階級遞進**（T1 樸素平靜 → T6 傳說級宏偉危險）→ `public/assets/dungeon/cover_<family>_t<tier>.webp`。（原先只做每族一張，作者要求每族每階不同 → 補到 42 張；每族通用圖 `cover_<family>.webp` 保留當 fallback）
- `DungeonStorageTab`：保存卡改成**封面橫圖 + 漸層壓字**，封面優先「該族該階」→ 退「該族」→ 退 emoji。

**②b 儲存槽鎖 3 的漏網（作者回報「還是鎖 3」）**
- `DungeonExcavationTab.jsx` 有一處 `storageFull = savedCount >= 3` 寫死（沒用常數），揭曉/保存/卷軸都被它 gate → 改用 `MAX_SAVED_DUNGEONS`。連帶修 `AdminDungeon`（/3→常數）、`MemberGuide`（文案 3→6）。
- **踩坑**：改「上限常數」時，除了 lib 的判斷，UI 元件裡各自的 `>= N` gate 也要一起搜（`DungeonExcavationTab` 就漏了一處，只改 lib 不夠）。

**③ 地下城儲存槽 3 → 6**
- `dungeonExcavation.js` 新增 `export const MAX_SAVED_DUNGEONS = 6`，取代三處寫死的 `>= 3`；`DungeonStorageTab` 改 2×3 grid、文案用常數。

**④ 符文美術（16 顆，新）**
- `gen-rune-tiles.py`：RPG 寫實符文石板（去背）+ 發光類型符號（攻=紅劍/防=藍盾/生命=綠心/貓靈=紫貓掌）+ 階級遞進 → `public/assets/runes/rune_<type>_t<tier>.webp`。
- `equipmentRuneData.js` 每顆符文加 `img`；`EquipmentRunePanel` 製作格 + 背包列改 `RuneImg`（缺圖 fallback emoji）。

---

## 2026-07-23（訪客登入回歸修復：學籍帳號被當訪客 + 同信箱重複建帳號）

**背景**：作者回報 (1) 有學籍的帳號又能登入成訪客帳戶、(2) 同一 email `lin19991008` 冒出 3 筆不同 ID 的 guest 文件、(3) 某 uid 帳號「被訪客蓋過去」。根因都在 `guestAuth.js`，且與 `a226c41 (guest mode ui fixes)` 的改動有關。

**① 學籍帳號被當訪客登入 → `loginGuestWithPassword` 判斷順序錯。**
- 舊版：先查 guest 文件、找到就直接登入 guest，**只有查無 guest 時才檢查正式帳號**。→「同時有 guest 舊文件＋學籍」的 email 先被 guest 分支接走，繞過學籍偵測。
- 修：把學籍檢查**提前到最前面**（`findEnrolledMemberDoc`），學籍帳號一律登入正式身分（仍可預約），永不落進 guest。

**② 同信箱重複建帳號 → `resolveLegacyGuestSession` 用匿名 uid 查。**
- `a226c41` 把 resume 查詢從 `contactHash` 改成 `where uid == 匿名uid`；匿名 uid 每個 session 都變 → 永遠查不到本尊 → 每次都 `addDoc` 新建 → 同一 email 多筆重複 guest（也是「被訪客蓋過去」的來源）。
- 修：改回用 `contactHash`（email 衍生、跨 session 穩定）查。合法性：`firestore.rules` line 48-49 本就允許任何登入者 list guest/kid 文件（正因匿名 uid 不穩定），所以不違反規則、也非列舉漏洞。

**③ 學籍偵測器統一化（作者建議：用 `studentTier`）。**
- 新增 `isEnrolledMemberDoc(data)`：`accountType` 不是 guest/kid（含 undefined＝教練 createMember 建的正式生）**或** 有 `studentTier`（受限/正式/退休，createMember 與 convertGuestToOfficial 一定會寫）即算學籍。
- 新增 `findEnrolledMemberDoc(email, contactHash)`：email + contactHash 兩路查（涵蓋 email 為空的舊學員）。
- `registerGuestWithPassword` / `loginGuestWithPassword` / `signInWithGoogle` 全改用這組共用偵測器。**不需要新增欄位**——`studentTier` 已存在。

**待辦（資料層，需後台/Console 手動，非程式可修）：**
- `lin19991008@gmail.com` 3 筆：保留本尊 `NGFcbRq...`（林穎姿/500金幣/有預約），刪除兩筆 07/23 空帳號 `MlyMKs...`、`VL7NU1...`（部署後 contactHash 才會唯一命中本尊，故先部署再刪空帳號）。
- uid `tvrtBfX0SyZY8tMqYQeLxOqNyky2` 被蓋案：待查 Firestore 實際文件才能決定還原方式。

**踩過的坑（本次）：**
- 訪客身分索引一律用 **contactHash（email 衍生穩定值）**，**絕不可用匿名 uid**（每 session 變 → 重複建帳號）。
- 多分支登入函式，「學籍/正式帳號偵測」必須在 guest 分支**之前**，否則有舊 guest 文件的學籍帳號會被搶先接走。
- 學籍最可靠訊號是 `studentTier`（教練建帳號不寫 accountType，但一定寫 studentTier）。

---

## 2026-07-23（組隊地下城存檔/殘房修復 + 官網訪客忘記密碼 + 貓咪 XP 寫錯位置修復）

**① 組隊地下城「存檔沒反應」→ firestore.rules 白名單漏 `teamSavedProgress`。**
- `saveTeamExpeditionProgress` 寫 `members.teamSavedProgress`，但 members hasOnly 白名單沒這欄位 → permission-denied 靜默失敗。
- 修：`firestore.rules` 兩個 members 更新區塊（official + guest/kid）都補 `"teamSavedProgress"`。**要手動貼 Console**（CLI 403）。

**② 組隊地下城「房間殘留」→ 房主返回沒解散。**
- `DungeonLobby.jsx` 等待室 `onBack={() => setTeamLobby(null)}` 只切畫面、不刪房 → `expedition_waiting` 房永久殘留（開放房列表 + 斷線重連 banner 一直冒）。
- 修：`onBack` 改成房主 `disband+cleanup`、隊員 `leave`；`expeditionTeamDb.js` 新增 `isStaleWaitingRoom()`（等待房 >2h 視為殘房），`subscribeOpenTeamExpeditionRooms` 與 `findReconnectableTeamExpedition` 都過濾（防瀏覽器直接關、cleanup 跑不到的殘房）。

**③ 官網（PublicBookingApp）訪客忘記密碼。**
- 訪客 email＋密碼＝真正 Firebase Auth 帳號，直接用內建 `sendPasswordResetEmail`（無狀態、不碰 Firestore，直接用主 auth）。
- `guestAuth.js` 新增 `sendGuestPasswordReset(email)`（user-not-found 也回 ok 防 email 列舉）；登入分頁加「忘記密碼？」連結，寄出後顯示提示，**明確提醒信可能在垃圾信件夾**，並提示「當初用 Google 登入的沒有密碼、不會收到信」。

**④ 陪練貓 XP / 村莊工作貓 XP 完全沒進帳（寫錯位置）。**
- 根因：`revealCatExcavation`（+150 XP）與 `collectVillageResources`（每小時 5 XP）都把 XP 寫成 **member 文件的 `cats.{id}.catXP` 欄位**。但貓咪 XP 的正解是 `members/{id}/cats/{catId}` **子集合**（`addCatXP` / `catRef`），且 `cats` 不在 member 白名單。
- 後果：`collectVillageResources` **只要有派貓工作，整包 updateDoc 被規則擋掉 → 連資源都收不到**；陪練貓揭曉的 updateDoc 同樣被擋（`.catch` 吞掉）→ `pendingReveal`/進度重置也沒存成功。
- 修：兩處都移除 `updates["cats..."]`，改在 member 寫入成功後用 `addCatXP()` 補進子集合（`dungeonExcavation.js` 新增 import `addCatXP`；`db.js` 已有 import，用 `workerXP` 暫存後迴圈補發）。
- **✅ 本來就有效**：`catDigProgress`（`db.js:923` 每箭 +0.5×箭數）與 CAT_DIG_SPECIALTIES 家族偏好加成。

**踩過的坑（本次）：**
- **貓咪 XP 一律走 `addCatXP()`（子集合），永遠不要寫 member 文件的 `cats.X` 欄位**——位置錯 + 不在白名單，會讓整包 updateDoc 被拒（靜默）。
- 任何寫入 `members` 的新欄位（如 `teamSavedProgress`）都要同步加進 `firestore.rules` 兩個 hasOnly 區塊，否則必現 permission-denied 靜默失敗。
- 多人房間殘留類 bug：離開/返回路徑都要走「房主解散＋刪房 / 隊員離開」，並對「瀏覽器直接關」加時間過濾防禦。

---

## 2026-07-21（地下城 2.5D 立繪地圖重做 + 兩段式移動 + 王 fix + ComfyUI 生圖管線）

**① 地下城地圖改「等角 2.5D 立繪」（取代 Gemini 斜角 SVG 版）。**
- `DungeonStages.jsx`：`RoomTile`(iso x/y/z 定位、族系圖→共用圖→empty→SVG fallback、迷霧 brightness 0.2 + 問號、玩家用 `player_logo.webp`)、`MapViewport`(中央面板 overflow 裁切+深色底、鏡頭 transform 跟隨、fit 縮放給分支選路)、`DungeonMapView`(iso 排列 `HALF_W=78/HALF_H=45`、房間石板路含通往迷霧房)、`DungeonBranchView`(第 3 層 iso)。
- 常數：`TILE_W=84`、`HALF_W=78`、`HALF_H=45`（格子大小/菱形錯位，改這幾個就能調版面）。
- **移除** use25D 平面切換 + 舊 flat SVG（永遠 2.5D，兩層一致）。
- **為什麼**：使用者要正向/等角 2.5D + 族系文明特色；斜角薄卡片被否決。

**② 第 1-2 層兩段式移動（跟第 3 層一致）。**
- `DungeonExpedition.handleCellClick` 只移動+揭露；`GridMapStage` 底部「進入」按鈕才 `enterRoom`；站上未清除房 `locked` 鎖移動（樓梯例外）。
- **組隊安全**：`locked = canEnter && !!onEnterRoom`、按鈕 gate `onEnterRoom`——組隊沒傳 onEnterRoom 就不鎖、維持即點即進（GridMapStage 單人/組隊共用，勿讓組隊卡死）。

**③ 王房打到雜兵 fix（連帶修獎勵三選一 + 結算頁）。**
- `enterRoom` 王房改用 `fixedBoss || monsterPool.boss`（與 DungeonSelectionPanel 預覽同源 resolveDungeonBossEncounter）；`dungeonExpansionMonsters.js` 王缺席時優先 `tagExpansionBoss(options.fixedBoss)` 才 fallback 隨機。
- **為什麼**：`fixedBoss` 為 null 時舊碼補「隨機 strong 雜兵」；打到假王 → 沒觸發王獎勵 → 結算頁走錯路徑（連鎖）。

**④ ComfyUI 本機生圖管線（重大，可重用）→ 見 memory [[comfyui_art_pipeline]]。**
- 房間立繪全自動：`scripts/gen-dungeon-tiles.py`（ComfyUI API 生成→rembg 去背→512 WebP→`public/assets/dungeon/`）。
- 目前只有幽冥系專屬（`room_ghost_<type>`）+ 共用（`room_<type>`）；其餘 6 族之後各生獨立。

**踩過的坑：**
- **物件 prompt 太小 → 物件消失**：STYLE_OBJECT 寫「小到 1/3」會讓寶箱等物件被模型畫沒；改「MEDIUM-SIZED 明顯」才穩。
- **幽靈貓抽卡**：DreamShaper Turbo 愛畫實體有腳貓；要「經典圓床單幽靈身體 + 加貓耳 + 波浪裙襬、負面詞 legs/feet/pikachu」才會對，且每張是 seed 抽卡（裙襬/貓耳不一定同時中）。
- **ComfyUI 卡住**：長時間連續生成偶爾 1 個 job 卡在 running、system_stats timeout；POST `/interrupt` 解卡。
- **dev server 被 `| head` 關掉**：`npm start | head` 會因管線關閉觸發 SIGPIPE 結束；背景跑 dev server 不要接管線。
- **瀏覽器邊寫檔邊讀**：批次覆寫圖片時瀏覽器抓到半成品會退到 fallback；硬重整 Ctrl+Shift+R 解。

---

## 2026-07-20（地下城 2.5D 視覺重構 & 七族六級風格化樣式 & 全模組 UI 種族變換）

**① 地下城探索地圖 2.5D 視覺重構。**
- **改了什麼**：將 `GridMapStage` 地圖從二維「平面方格」重構為 2.5D「懸浮等角視角（Isometric）微縮地下城地圖」，並根據使用者的設計概念圖進行深度美術優化：
  1. **坐標與間距調整 (Isometric Spacing Fix)**：為了解決平台擠在一起重合的問題，將平台繪製尺寸（`TILE_W = 56`, `TILE_H = 32`）與投影移動步長（`PROJ_W = 84`, `PROJ_H = 48`，對應為 `HALF_W_proj = 42`, `HALF_H_proj = 24`）進行解耦。這在縮小平台本體（使微縮感更精緻）的同時，拉開了 28px 的水平與 16px 的垂直間隙，給懸空橋樑留出空間，完全重現了概念圖中懸空島嶼錯落有致的空間美感。
  2. **3D 平台側面與頂面**：SVG 繪製頂面鑽形 (Rhombus) 以及左/右兩個可視側面厚度（厚度 10px + 難度*2），形成具有立體感的懸浮石板平台。
  3. **微縮裝飾物與標籤膠囊**：
     * **房型裝飾 (DungeonTileDecorations)**：精細化戰鬥房的雙角火把點綴、休息區柴木藍焰、商店小遮雨棚、寶箱黃金光圈與階梯石拱門。
     * **標籤膠囊 (Pill Labels)**：在每個已探索房間的圖示下方，加入圓角半透明黑底的標籤膠囊（顯示「戰鬥」、「營地」、「商店」、「休息」、「寶箱」等文字），完美重現概念圖中的精緻遊戲質感。
  4. **移動動畫**：利用 CSS Transition 動態平移 locator pin `<g>` 元件，過渡時間為 320ms，並在跨樓層/大跨度移動時進行「無縫瞬移（禁用 Transition）」，效果非常順滑且完全不佔 CPU/GPU。
  5. **未探索迷霧與呼吸效果**：用半透明紫色 SVG 面板覆蓋未探索格子，並配合 CSS `opacity` 與 `transform` 呼吸動畫，營造緩慢流動的迷霧感。
  6. **通道與實木/石造橋樑**：連接相鄰的已探索格子，在下方繪製陰影與石造基座，表面覆蓋 `strokeDasharray` 木紋/石板橫條鋪面，使其看起來像懸空吊橋或懸空石板路，未完全通行的橋樑顯示虛線且降低透明度。
  7. **懸浮深淵松林背景 (Forest Canyon Background)**：在 SVG 中定義了 `pine-tree` 松樹形狀，並在懸浮格子群的四周（左上、右上、左下、右下）以不同比例和極低透明度渲染松樹剪影，與背景融為一體，營造深邃幽暗的深谷氣氛。
  8. **新舊版地圖切換**：在 Header 新增「💎 2.5D / 🗺️ 平面」切換按鈕，切換時將狀態 `use25D` 儲存於 `localStorage`，確保隨時可切換回舊版防呆。

- **為什麼**：升級遊戲的視覺品質（從平面 Emoji 按鈕到微縮立體模型），同時**完全不修改任何核心邏輯**，減少 Bug 發生率，並給予玩家更高品質的手機遠征體驗。

**② 七大種族主題特色 + 6 種難度等級結構樣式。**
- **改了什麼**：
  1. **七族主題化與全 UI 變換**：擴充 `FAMILY_STYLES` 設定，針對 `ghost` (幽冥), `mountain` (山嶺), `insect` (昆蟲), `workplace` (職場), `exam` (考試), `temple` (神廟), `treasure` (寶箱) 類配對專屬顏色，且**整個 UI 介面都會隨之變換**：
     * **背景深淵**：外層 container 背景在 2.5D 模式下，會由原本的冷黑漸層轉變為各具種族偏光特色的魔幻深淵漸層（如幽冥系為紫靛漸層、考試系為暗紅漸層）。
     * **Header 與卡片**：Header 標題、狀態列與底部卡片的文字、邊框、Glassmorphism 背景均融入該種族偏光。
     * **主行動按鈕**：底部「前往下一層」或「挑戰 Boss」按鈕，由傳統橘黃漸層變更為種族的主題漸層（如幽冥系變更為藍紫漸層，考試系變更為火紅漸層），並加上對應主題色的發光陰影（Box Shadow）。
     * **第 3 層分支王關連動**：第 3 層的 `BranchStage` 同步新增 `difficulty` 與 `family` 參數，其實體選路按鈕、行進路線卡片與前前進按鈕全部自動換膚，實現一致的主題沉浸感。
  2. **6 種難度結構化**：平台的厚度隨著難度（1~6）增加（`10 + difficulty * 2`，由 12px 遞增至 22px），並且在 T3+ 地面繪製石板裂紋，T5+ 繪製角落符文，增強高難度關卡的沉重與史詩感。
- **為什麼**：讓不同難度與不同種族的地下城在地圖視覺上呈現出完全不同的氛圍，增強遊戲探索的沉浸感與挑戰感。

**踩過的坑：**
- **參數傳遞與 scope 限制**：原本 `GridMapStage` 的 Prop 沒帶 `difficulty` 與 `family`。我們需要在呼叫端（`DungeonExpedition.jsx` 與 `TeamExpeditionBattle.jsx`）將這兩個變數傳進去（後者對應為 `dungeonDifficulty` 與 `dungeonFamily`）。如果沒傳，則預設 fallback 到 `difficulty = 1` 與 `family = "ghost"`。
- **移動滑行穿幫**：如果不對跨樓層或大跨度移動進行處理，定位針會從上一個位置橫越整個螢幕滑行到新起點。我們用 `useRef` 紀錄 `prevPos` 與 `prevFloor`，凡是距離大於 1 或樓層改變，均設置 `transitionEnabled = false` 瞬移，下一拍再重新啟用 Transition，完美解決穿幫問題。
- **點擊 hitbox 覆蓋**：2.5D 多邊形容易因為上下重疊導致點擊區域交叉。我們在 clickable 的外圈也繪製了一個等角的 hover polygon 來引導點擊，確保點擊 Hitbox 精準地落在鑽面上。
- **透明度色彩切除**：在 JSX 中使用 `rgba` 合成顏色時，若以字串裁切（如 `theme.primary.slice(1)`）並轉換成 RGB 數值，必須確保傳入值為標準 6 碼 Hex 格式。我們在程式碼中使用標準 `FAMILY_STYLES` 設定，以確保轉換穩健，並對非 2.5D 模式進行防禦性 Fallback。

---

## 2026-07-19（三連修：預覽王≠實戰王 / 第3層跨族雜怪 / 結算少算一份獎勵）

**① 預覽王 ≠ 實戰王，和 ② 第 3 層跨族雜怪，是同一個 race condition。**
使用者實測 T2 神廟：選擇畫面顯示**狼人**（`temple_3`，舊表 T3 `normal` 雜怪），進去打到**銀盾城堡先鋒**（`temple_t2_mini_a`，正確的 T2 小王）；且第 3 層跑出爛主管（職場）＋虎頭蜂（昆蟲）＋魔神仔（幽冥）三族混雜。

- **根因**：`DungeonExpedition` 用 **dynamic import + useEffect** 非同步算王，`startFloor` 常在王算好之前就跑 → `fixedBoss` 是 null。而 `drawDungeonFloorMonsters` 第 3 層一旦缺王，就把**整層**（連雜怪）打回舊 `drawFloorMonsters` —— 舊邏輯是跨族跨階的。王本身也退回 `excavation.boss` 的舊值，所以預覽是雜怪。
- **修法**：
  1. `dungeonBossEncounter.js` 新增 `resolveDungeonBossEncounter` / `resolveDungeonBossRunId`，**預覽端與戰鬥端共用同一支**。runId 優先序 `expansionRunId → bossRunId → id → revealedAt`：接線前產生的舊地下城沒有 `bossRunId`，但 `id` 穩定，因此兩端仍推到同一隻王（**順手修好舊資料**）。
  2. `DungeonExpedition`：dynamic import 改同步 `useMemo`，`fixedBoss` 不再缺席。**刻意不注入 `expansionRunIdRef`** —— 那顆對舊地下城是隨機值，注入後預覽端永遠算不出同一隻王。
  3. `drawDungeonFloorMonsters`：第 3 層缺王時**只補王**，不再把整層打回跨族舊表。王缺席是上游問題，不該波及整層。

**③ 結算頁少算一份獎勵**（使用者：「結算顯示的經驗值跟正式的有出入」）。不是重複發放，是獎勵有**兩個來源**而結算頁只顯示一份：
- **沿路擊殺** — 每殺一隻當下就 `addCoins`/`addArcherXP` 入帳
- **通關獎勵** — 按下「領取獎勵」才由 `grantExpeditionRewards` 發放

前者的數字以前只餵給 4.5 秒的 `killToast` 就丟掉，**沒累積到任何 state**。單人（`DungeonExpedition`）與組隊（`TeamExpeditionBattle`）是各自獨立、但一模一樣的漏法，兩邊都補 `killTotals` 累計。兩者本來就共用 `DungeonExpeditionResult`，改一次版式同步。結算頁新增「來源拆解列」標明哪份已入帳、哪份按領取才發，避免看起來像發兩次。

**踩過的坑：**
- **非同步算關鍵資料 = race**。王是整層生成的輸入，卻用 dynamic import 晚一拍給，下游只好 fallback。這種「缺資料就整批退回舊邏輯」的設計會把小延遲放大成全面錯誤 —— fallback 的粒度要跟缺的東西一致。
- **診斷要看 id 不要看名字**：`ghost_3` / `temple_2` 這種舊表 id 一眼就能認出走了舊路徑，比對名字快得多。

驗收：53 suites / 369 tests 綠、build 無警告。

## 2026-07-19（DLC 全面安裝：移除 flag + 收掉重複的抽王實作）

**使用者實測王房連三次抽到雜怪**（後台新增 → 林投姐 `ghost_3`／卷軸 → 骷髏劍士 `temple_2`，都是**舊 60 隻表的 id**、`encounter:"normal"`）。追下去發現兩件事：

**① 根因是 flag，不是抽王壞掉。** `DungeonExpedition.jsx:327` 的 `if (!isMonsterExpansionEnabled()) return undefined;` 一旦 flag 為 false，整條擴充路徑直接 early return，`fixedBoss` 退回 `excavation.boss` 的舊值 —— **畫面上完全看不出差別**，只是王變成雜怪。測試裝置殘留的 `localStorage("monsterExpansionV1")="off"` 或 Vercel 環境變數都可能觸發。
→ **flag 整個移除**：`isMonsterExpansionEnabled()` 恆回 `true`，`syncMonsterExpansionFlagFromUrl()` 變 no-op（兩個 export 保留，12 處呼叫端不動，else 分支成 dead code 待清）。測試改成守「殘留的 off 再也關不掉」。

**② 我自己造成的重複實作（已收）。** 前一個 commit 在 `dungeonExpansionMonsters.js` 加了 `drawDungeonBossEncounter` 並接進 `dungeonExcavation.js`，**但 7/18 就已經有 `createLockedDungeonBossEncounter` 在做同一件事**，而且戰鬥端讀的是後者。兩套並存 = 選擇畫面預覽一隻王、進去打另一隻。
→ 刪掉 `drawDungeonBossEncounter` 與其測試，`rollExcavationBoss` 改為複用 `createLockedDungeonBossEncounter`，並把整筆 encounter 存進地下城物件的 **`bossEncounter`** 欄位；戰鬥端 `DungeonExpedition.jsx:336` 會把它當 `lockedEncounter` 傳回引擎、命中即原封不動沿用 → **預覽與實戰保證同一隻**。
→ 地下城物件新增三個欄位：`boss`（快照，預覽用）、`bossEncounter`（鎖定王）、`bossRunId`（穩定種子）。

**踩過的坑 / 設計決策：**
- **升降級沿用同一個 `bossRunId`**。王因此是決定性的：升上去再降回來拿到原本那隻。降級免費，不鎖 runId 就能無限重抽刷大王素材。（前一版用 `forceKind` 保留大小王身分，改用 runId 後更乾淨，`forceKind` 已移除。）
- **`rollExcavationBoss` 的 try/catch 是靜默 fallback**：某族某階湊不齊「2 小王 + 1 大王」就安靜退回舊 `drawExpeditionBoss` 抽雜怪。新增測試「六族 × 六階都湊得齊王池」整表釘死。
- **`saveExcavation` 要把 `bossEncounter`/`bossRunId` 一起搬進儲存槽**，否則遠征時重抽，又變成預覽/實戰不一致。
- **既有資料不會自動修**：儲存槽裡接線前產生的地下城，`boss` 已寫死在 Firestore，仍是雜怪。打完或放棄才會汰換。
- **教訓**：接線前要先查「戰鬥端實際從哪裡取這個值」，而不是照著上一個 commit 的敘述往下接。差點多做一整套平行系統。

驗收：53 suites / 365 tests 綠、build `Compiled successfully` 無警告。

## 2026-07-19（王房抽王正式接線：`dungeonExcavation.js`）

**上一個 commit（96b5020）只加了 `drawDungeonBossEncounter` 函式沒接呼叫端，王房行為還是舊的。本次接線後才真正生效。**

- **舊行為的 bug**：`drawExpeditionBoss` 是「找該族該階的**第一隻怪**再套 boss 倍率」，完全沒過濾 `isKing`/`encounter` —— T1 鬼怪王房實測抽到 `ghost_1`「好兄弟」，也就是**一隻被放大的雜怪**。
- **新入口 `rollExcavationBoss(difficulty, family, excavation, { forceKind })`**（`dungeonExcavation.js` 頂部）：flag 開且抽得到王 → `drawDungeonBossEncounter`；否則原封不動 fallback 舊 `drawExpeditionBoss`。回傳 `{ boss, miniStreak }`，**`miniStreak === null` 代表不要寫回 Firestore**。
- **7 個呼叫端分兩類**：
  - **推進保底計數**（新地下城誕生）：`claimAutoDig`、`revealExcavation`、`useDungeonScroll`。
  - **不推進**：`upgradeExcavationDifficulty` / `downgradeExcavationDifficulty`（換難度重抽，傳 `forceKind: pending.boss?.encounter` 保留大／小王身分）、`saveExcavation`（純防呆 fallback）、`adminSetSavedDungeon`（教練手動塞）。
- **保底計數存 `members/{id}.dungeonExcavation.miniBossStreak`。**
- **踩坑：升降級一定要 `forceKind`。** 不然玩家反覆「花金幣升級→免費降級」就能一直重抽王，把小王保底刷滿、無限拿大王素材（降級是免費的，這條白嫖路徑本來就存在）。`forceKind` 也因此**刻意不推進計數**。
- **隱藏地下城（寶箱族）維持走 `drawTreasureKing`**，不進族系抽王也不動保底計數。
- 不另存 `bossKind` 欄位 —— `toLegacyBattleMonster` 已把 `encounter` 帶進 boss 物件，直接讀 `boss.encounter`。
- 驗收：53 suites / 373 tests 綠、build `Compiled successfully` 無警告。**尚未瀏覽器實跑**。

## 2026-07-19（修正：材料階級對應表整條推高一階）

**使用者實測回報**「稀有的升級材料居然出現 T5 傳說材料」，並貼出實際需求（金幣 390 = 稀有；虎頭蜂刺／溪風蛇鱗 = **T2**、崩潰眼淚／林光花瓣 = **T3**）。

- **根因是解讀錯誤，不是程式 bug。** 使用者原始規格寫「普通 2組T1；稀有 3組T1+2組T2，+3 起加 1組T3；後面以此類推」。我當時把 T1/T2 讀成**相對的**「該階／下一階」，沿用既有的 `_GRADE_MAT_TIER`（稀有 main=m2），整條對應表因此**被往上推一階**：稀有吃 T2/T3、精英吃 T3/T4/**T5**（T5 在 legacy `MATERIALS` 是 `rarity:"legendary"` 傳說稀有度）。當時有把這個歧義寫出來問，使用者回「按照你的建議」，但顯然沒對到焦 —— **規格裡的絕對階級不該自作主張改成相對的**。
- **改回字面規格**：主階 = 普通T1、稀有T1、精英T2、史詩T3、傳說T4、神話T5，每級再往上兩階。神話沒有 T7（未實裝）→ `next2` 為 null，改 5 種該階 + 3 種下一階補足重量。
- 種類總量：普通 122 / 稀有 228 / 精英・史詩・傳說 313 / 神話 365。
- **UI 補上階級標籤**（`matTierIndex()` 從 id 反推，顯示 `T2` 小徽章）。之前畫面只有材料名稱、沒有階級，對應表錯了好幾天都沒人看得出來 —— 這是這次能被發現的關鍵缺口。
- 新增護欄測試：稀有在任何 plusLevel 都不得碰到 T4 以上；各品級的該階／下一階／再下一階階級逐一釘死。

## 2026-07-19（精煉材料難度曲線依品級分級 + 修精煉舊需求覆蓋）

**⚠️ 重要決策：品級加成公式維持不動。** 一度改成凸曲線（讓突破更有手感，神話+4 從 30 → 59），但**使用者當場否決**：怪物防禦最高只有 200 出頭，ATK 四格合計從 120 灌到 236 會直接壓垮既有戰鬥平衡。已完整撤回，`getEquipSlotBonus` 回到 `(品級index × 5 + 1) + plusLevel`，並加了**護欄測試**逐格釘住這條公式（含「神話+4 必須是 30」）。**要調精煉難度一律改材料需求，不要動數值加成。**

**新檔 `src/lib/equipGradeCurve.js`** 因此只剩 T7~T9 顯示用定義：上古／天啟／永恆，數值沿用同一條直線（31~45）接在神話後面。**刻意不放進 `EQUIP_GRADES`**——`upgradeEquipSlot` 的 `isMaxGrade` 是用 `EQUIP_GRADES.length - 1` 判斷，放進去會讓玩家真的升上未實裝品級。測試守住「神話仍是最高可升品級」。

**材料需求改為依品級分級**（`equipData.js`）。舊版所有品級共用同一張表，每級都要 284 個材料——普通裝跟神話裝一樣重，只有金幣差 230 倍，對新學生太硬、對老玩家太鬆。新規格：

| 品級 | 該階 | 下一階 | 再下階 | 總量 |
|---|---|---|---|---|
| 普通 | 2 | — | — | 122 |
| 稀有 | 3 | 2 | 1（+3 起） | 228 |
| 精英／史詩 | 4 | 3 | 1 | 313 |
| 傳說 | 4 | 3 | 0（T7 未實裝） | 304 |
| 神話 | 6 | — | — | 366 |

**精煉改用完整素材清冊**（使用者提醒「新增很多新材料要加入使用」後才發現）。舊 `generateRandomMats` 是用**寫死字串** `` `${family}_m${N}` `` 組 id，`_FAMILIES` 只有六族 → 全清冊 252 種**只用到 36 種（14%）**：

- 每族每階其實有 **3 種** normal 材料（`ghost_m1`、`mat_ghost_t1_normal_a`、`_normal_b`），精煉只認得舊的那 1 種
- **寶藏族（treasure）整族 18 種**從未被要求過
- 王素材同樣先從六族抽一族再挑，寶藏族的小王／大王素材**永遠抽不到**

改法：新增 `normalMaterialPool(tierIndex, ...)` 直接從清冊撈該階所有 `kind==="normal"` 的 id（每階 21 種＝7族×3種）；`pickBossMaterialId` 拿掉 family 參數改從整池抽。擴充關閉時退回舊的六族 36 種（避免產生玩家拿不到的 id）。測試跑 400 輪抽樣確認 **126 種 normal 全部會被要求、王素材涵蓋全 7 族**。

- **順帶解掉的坑**：精英以上要 4+3+1 = **8 種**，原本只有六族會切爆——現在每階池子有 21 種，綽綽有餘。每個 tier 仍各自洗牌，不同 tier 的 id 本來就不同、不會撞。

**該階材料改「保底」抽法**（使用者指示）。每階 21 種候選但一次只要 4 種，純隨機常常整組都是玩家手上沒有的，**進度感直接歸零**。改為固定讓其中一種是玩家**持有最多**的材料，其餘隨機。

- `generateRandomMats` 新增 `options.inventory`；`pickMostHeldId()` 挑持有最多者，持有量相同時隨機挑（避免每次固定同一種、看起來像壞掉），庫存為 0／負值（歷史髒資料）一律略過，全空時退回純隨機。
- **保底只作用在該階**，下一階／再下一階維持隨機——否則玩家囤一種材料就能架空整條難度曲線。有測試守住。
- **`db.js` 的 `generateRandomMats` 呼叫移進 transaction 內、且移到扣材料之後**：原本在交易外先算，用的是**扣除前**的庫存，保底會挑到剛剛被扣光的那種，玩家看到的「持有最多」是假的。
- `RPGEquipPanel` 的兩處呼叫（`openSlot` 重算、`handleEquip` 首次裝備）都補傳 `matInv`。
- **踩坑**：傳說的再下階（T7）與神話的下一階都不存在。若照種類數硬生，會產出 `ghost_m7` 這種**玩家永遠拿不到的 id、精煉直接卡死**。`matKindsFor()` 會在 tier 不存在時把種類歸 0，神話改吃滿六族該階維持重量。有測試掃全品級全等級確認不會出現 `_m7~_m9`。
- `isMatsCurveCurrent(nextMats, **grade**, plusLevel)` 多吃一個 grade 參數（種類數現在跟品級綁定）。判定改為「每筆都必須有 `tierRole`」，沒標的一律視為舊資料重算；王素材標 `tierRole:"boss"` 排除在種類檢查外。

**修 bug：精煉沒吃到新材料**（使用者回報）。`RPGEquipPanel.openSlot` 偵測到舊曲線時會重算並 `saveEquipNextMats(...)` **fire-and-forget**。若玩家一開面板就馬上按升級，那筆寫入可能**晚於**升級交易才落地，把升級後產生的新需求**覆蓋回舊的**——表現就是需求清單不更新、精煉看起來沒吃到新材料。修法：用 `pendingMatsSaveRef` 記住那個 promise，`handleUpgrade` 開頭先 await 它。（同一類 race 已經是第三次踩到，見 `feedback_firestore_snapshot_race`。）

- 驗證：53 suites / **354 tests 綠** + build `Compiled successfully` 無警告 + 改動檔 `no-undef` 專項掃描乾淨。

## 2026-07-19（武器精煉套入新素材消耗 + 寶箱卡片排版修正）

- **精煉成本**（economy-loot-catalog §6）：傳說金幣 6500→**12000**、神話 13000→**30000**;新增王素材門檻 `bossMatRequirementFor()`——史詩+4 突破小王×1;傳說 0/1/2/3 各需小王 1/1/2/2、+4 突破大王×1;神話 0/1/2/3 各需大王 1/1/2/2。素材 Tier 取目前品級對應階（epic=T4、legend=T5、mythic=T6）。
- **關鍵防呆**：王素材唯一來源是地下城王房（在 `monsterExpansionV1` flag 之後）。若不跟著 flag 走，flag 關閉的正式環境玩家將**無從取得素材、高階精煉直接卡死**——因此 `generateRandomMats` 只在擴充開啟時加入王素材需求，並有測試守住。
- **相容**：新需求掛在 `generateRandomMats` 產生的 `nextMats` 內，db.js 的扣除迴圈不必改;已存的舊 `nextMats` 自然可依舊制完成一次（符合規格「更新前已顯示的可依舊制完成一次」）。
- **UI**：`RPGEquipPanel` 新增 `resolveMatMeta()`——原本只查 legacy `MATERIALS`，擴充素材會露出原始 id（`mat_ghost_t5_mini_a`）。現在查不到會回退擴充清冊，並對王素材標示 🔱／👑 與「小王素材／大王素材」註記。
- **寶箱卡片排版**（使用者截圖回報「擠成一團」）：翻牌卡正反面都是 `position:absolute`，對外不貢獻寬度，在 `items-center` 的 flex 容器裡整張卡塌成近 0 寬 → 中文因每字皆可斷行，min-content 寬度＝一個字，名稱變直排。修法：外層補 `w-full` 讓 `width:100%` 有依據（根源），文字容器再加 `flex:1 + minWidth:0 + nowrap/ellipsis` 兩層保險。
- **組隊「開始戰鬥沒反應」防護**：`startRoomBattle` 的 `floorStartingRef` 若因中途例外沒重置，之後**所有房間點擊都會靜默失效**（無錯誤、無反應）。改為 try/catch/finally，保證解鎖並把錯誤顯示到 `flowError`。根因仍待使用者提供 console 錯誤。
- 驗證：48 suites / 313 tests 綠 + build 無警告 + `no-undef` 專項掃描乾淨。

## 2026-07-19（遠征掉落明細顯示 + 倍率角標收進頂欄）

- **新 `KillLootToast.jsx`**（單人／組隊共用）：每場擊殺後直接列出掉了**哪種寶箱、各幾個**（走 `summarizeExpeditionChests`，與結算畫面同一套敘述，避免兩處說法不一致）＋金幣／XP。
  - 單人端原本**完全沒有**每殺回饋（只有最後結算才看得到），現已補上（掛在 grid／branch 樓層畫面）。
  - 組隊端原本只顯示籠統的「材料寶箱 ×N」，改為列出實際寶箱明細。
- **「🎲 本圖寶箱 ×N」改放頂端狀態列**（使用者指示）：原本是戰鬥畫面右上角的 `position:fixed` 浮動角標，改成 `PlayerStatusBar` 內的 pill（HP 條與金幣之間），單人／組隊兩端一致。

## 2026-07-19（遠征取消直接掉素材，改為只給寶箱）

**使用者拍板**：遠征單人＋組隊一律**不直接掉素材**，素材只能從寶箱開出（掉落來源單一化）。

- `DungeonBattleRoom` 勝利結算移除 `rollMaterialDrops` → `addMaterials` 這條路（此元件現在只有遠征單人／組隊在用，舊地下城模式已刪，所以影響範圍剛好等於需求範圍）。
- 結算面板預覽的 `materials` 一併改為 `[]`，避免顯示實際拿不到的東西（`BattleResultPanel` 本來就有 `length > 0` 防護，空陣列自動隱藏區塊）。
- 清掉因此變成孤兒的 import：`addMaterials`、`rollMaterialDrops`、`rollMaterialDrop`（最後這個是先前就沒用到的）。
- **不受影響（刻意保留）**：①王房專屬獎勵 envelope（王素材／選擇箱，走 Cloud Function）;②組隊結算的 `kingVault.materials`（王房寶庫）;③寶藏房 `handleTreasureLoot` 的收藏品;④單人打怪 `MonsterBattle` 的掉落（不是遠征）。
- 驗證：47 suites / 304 tests 綠 + build 過。

## 2026-07-18（🐛 修 VS 畫面狂跳 + 寶箱掉錯 Tier 素材）

**使用者實測回報**：①一進地下城戰鬥，VS 開場畫面不斷重跳（伴隨 Firestore commit 400）;②打靈路巡衛（鬼怪 T2）掉出路邊供品（鬼怪 T1 素材）。

- **VS 狂跳（根因）**：`BattleScreen` 的自動開場 effect 依賴 `handleStartBattle`，而它的依賴含 `monster`／`difficulty`——呼叫端 `DungeonBattleRoom` 是用**行內物件字面值**傳的，父層每次 render 都產生新參考 → effect 每次 render 重跑 → `dispatch START` 把 phase 打回 INTRO。`case "START"` 又永遠回傳全新 state、沒有任何防護，於是形成無限迴圈。修法：新增 `autoStartedForRef`，以**怪物 id 當閘門**，換怪才重新開場。
- **組隊端補 `key={roomId}`**：`TeamExpeditionBattle` 沒給 DungeonBattleRoom key，元件實例會跨戰鬥房沿用 → 閘門 ref 不會重置，連續兩場同種怪會開不了場。加 key 讓每房重新掛載（與單人端 `key={pendingRoom.id}` 一致）。
- **寶箱掉錯 Tier（根因）**：`itemData.openChestContents` 開箱時 `for (t=0..tierCount)` 從 **T1 逐層往上抽**，完全沒用寶箱自己的 `tier` 欄位 → 打 T2 怪的 iron 箱會抽到 T1 素材。修法：以 `chest.tier` 反查來源 Tier，有帶就固定抽該 Tier（沒帶的舊寶箱/商店箱維持逐層擴散，不影響）。
- **踩坑（重要）**：`RARITY_ORDER`（legacy 稀有度 common/uncommon/rare/epic/legendary）與**怪物 tier**（common/rare/elite/fierce/boss/mythic）是**兩套不同詞彙**，`"rare"` 在前者是 T3、後者是 T2，**索引不可互用**。新增 `MONSTER_TIER_ORDER` 常數區分。
- 驗證：47 suites / 304 tests 綠 + build 過;新增迴圈與寶箱 Tier 的回歸測試。
- **未解**：Firestore commit 400 尚未取得完整錯誤訊息。已排除技能結算資料（252 隻全掃無 undefined/NaN/巢狀陣列）與擴充怪物件本身。推測是迴圈造成的重複寫入所致，修好迴圈後需回頭確認是否消失。

## 2026-07-18（🗑️ 移除舊地下城模式（房間制/地圖探索））

**為什麼**：地下城早已全面改用「遠征」流程（DungeonLobby → DungeonExpedition／TeamExpeditionBattle，固定 3 層）。舊的房間制/地圖探索模式已無任何 UI 入口（`createDungeonRoom` 零呼叫端、`handleEnterDungeonRoom` 只有定義沒人呼叫），只剩重整還原的殘留路徑，屬死碼。

- **刪檔（7）**：`DungeonController.jsx`、`DungeonExplore.jsx`、`DungeonMap.jsx`（舊模式三元件孤島）＋ 4 個無人 import 的備份檔 `DungeonBattleRoom/MonsterBattle/PartyBattleRoom/WorldBossAttack.legacy.jsx`。
- **MemberApp／AdminApp**：移除 `DungeonController` lazy import 與預載、`dungeon-room` 分頁與路由、`dungeonRoomId` state、sessionStorage 還原邏輯（`dungeon_room`／`admin_dungeon_room`）、「🏰 地下城進行中」浮動按鈕、`handleEnterDungeonRoom`／`handleLeaveDungeon`。
- **`dungeonDb.js`（1603→1165 行）**：刪 23 個零引用函式——建房（createDungeonRoom/joinDungeonRoom/startDungeonFloor）、地圖模式整組（initDungeonMapRun/saveMapExploration/proposeMapMove/castMapVote/resolveMapVote/advanceMapFloor/enterMapCombatRoom/proposeMapBattle/clearMapPendingRoom/tryDiscoverHiddenRoom/enterHiddenRoom/addMapLoot）、advanceDungeonFloor、leaveDungeonRoom、subscribeOpenDungeonRooms、cleanupStaleDungeonRooms、activeDungeon 系列（checkDungeonRoomExists/setActiveDungeon/clearActiveDungeon/checkMemberActiveDungeon）。
- **`dungeonData.js`**：刪 `DUNGEON_LENGTHS`（短途5/標準7/長征10 — 舊長度制，遠征固定 3 層）。
- **保留（仍是活的，別誤刪）**：`DungeonBattleRoom` 及其 `isMapMode` 分支——**遠征就是傳 `isMapMode={true}`**，`returnToMapAfterBattle`／`ensureChestRoomLoot`／`selectDungeonPath`／`purchaseDungeonItem`／`confirmDungeonEvent`／`claimDungeonReward`／`clearDungeonProcessing`／`setDungeonMemberRole` 都仍有 live 呼叫端。`DungeonShop/Event/Rest/Trap/Chest` 為遠征共用。
- **踩坑**：用腳本批次刪函式時，`function f(a, extraData = {})` 的**預設參數大括號會被誤判成函式主體起點**，導致切錯位置留下 `) {` 孤兒區塊（4 處）。括號配對要從簽章的右括號之後才開始找 `{`。
- 驗證：46 suites / 298 tests 綠 + build 過;bundle 769.16 → 764.64 kB。

## 2026-07-18（🔥 地下城接線：中途樓層擴充怪物池 + 招牌技能引擎）

**為什麼**：252 隻擴充怪先前只接到「單人打怪」與地下城「王房」;地下城中途樓層還在抽舊 60 隻表，且整個地下城戰鬥完全沒有招牌技能（技能結算只在 standalone BattleScreen 跑，partyMode 提前 return）。

- **`dungeonExpansionMonsters.js`（新）**：難度→Tier 對映**普通=T1-2、進階=T4、困難=T5、地獄=T6**;只抽 `encounter==="normal"`（王只在 BOSS 房生成，PRD §151-152）;family 別名正規化（forest→mountain 等）;treasure 族同規則。唯一接線入口 `drawDungeonFloorMonsters`／`drawDungeonFallbackMonster`，**flag off 或抽不到就 fallback 舊 `drawFloorMonsters`**（回退安全）。接線點：DungeonExpedition（startFloor＋補怪）、TeamExpeditionBattle（樓層計畫＋grid/branch 補怪）。
- **踩坑**：擴充王快照數值已含錨點倍率（PRD §67），第3層**不可**再套舊版 `applyVariant(boss)` 的 ×2/×1.6，否則王被二次放大——改成只貼 `variant:"boss"` 標籤供 UI 光暈。
- **`dungeonAbilityRound.js`（新，純函式）**：地下城技能回合規劃。破解採**全隊聚合**（實得分合計 ÷ 最高可能得分合計，PRD §44）;目標依 encounter 推導（招牌技能表無 target 欄位）——**大王=全隊（×0.5）、一般怪/小王=單體且不點名後衛**;技能傷害不致死（最低留 1 HP）;倒地/未提交者不入分母。
- **`soloMonsterAbilityEngine`**：主體改為 `resolveTeamMonsterAbility`(submissions 陣列)，`resolveSoloMonsterAbility` 變成長度 1 的包裝——**兩路徑共用同一實作，避免規則分歧**。
- **`processDungeonRound` Step 2.5**：host 權威端每回合結算一次（玩家＋貓咪攻擊後、反擊前，HP 比例正確供大王 70%/40% 階段被動）;冪等靠 `dungeon:{roomId}` + round 的 resolvedKey，**log 已有同 key 就跳過**（host 重試/重連保護）。異常存 `abilityStatuses`（下回合 atkDown/defDown 生效、回合末毒 tick 不致死）、怪物盾/減傷存 `monsterAbilityState`。
- **踩坑**：破解率的箭要**濾掉藥水箭**——傷害路徑本來就用 `getPotion` 濾，若不濾，丟藥水會被當 0 分箭拖累破解率（懲罰用道具）。
- **UI**：成員端 `BattleScreen` 從 `partyResolution.ability` 轉成既有 skillFx 形狀，共用同一組蓋版演出（四色破解＋自己受到的傷害＋附加異常）。
- 驗證：46 suites / 298 tests 綠 + build 過;含全 7 族 × 4 難度 × 3 樓層的整合煙霧測試（抽怪不出王、技能結算不爆）。
- **層數規格取消**（使用者拍板）：地下城**固定 3 層**（第1層探索／第2層精英／第3層分支+王房），手冊原本寫的「層數 4/5/6/7」是未實作的舊構想，已從 `scripts/generate-monster-handbook.py` 移除並重生成手冊。


## 2026-07-18（🔍 組隊地下城兩 bug 調查中——下個 session 接手）

**使用者回報**：①之前每場打死怪立刻有獎勵領取畫面,現在不見了;②最終 boss 打到剩 ~100 HP 突然被踢出房間、回不去。

**已盤點的事實**（TeamExpeditionBattle.jsx）：
- 獎勵鏈已改為新 claim 系統：王房走 `createDungeonBossRewardClaim`（dungeonBossRewardDb → monsterRewardClaims/dungeonBossChoiceClaims,rules 已貼）;一般怪場的獎勵在 room 結算,疑似改版後**中途樓層的每場獎勵畫面被拿掉/靜默化**（待確認 DungeonBattleRoom victory 面板路徑）。
- 被踢疑點：166-176 行,最終層 battle room `completed+win` → `finishBattle` 立即轉場;若成員 snapshot 較慢或 host `cleanupExpeditionRoom` 先刪 battle room,成員端 battle room snapshot 變 null → 被彈出;teamRoom status 已 completed → 無法 rejoin。另 `bossRewardEligibleMemberIds` gate 可能誤判(未達 validRounds 者直接沒有獎勵路徑)。
- 「剩100多HP被踢」很可能不是 HP 事件,而是**另一位成員先打死 boss**（總傷同步差）→ host 端結算/清房搶跑。

**下一步**（新 session 開工清單）：
1. 重現：兩人房打到最終 boss,觀察 host/成員兩端的 room/battleRoom snapshot 順序。
2. 檢查 `cleanupExpeditionRoom` 呼叫時機是否早於成員端 finishBattle;必要時延遲清房/改 tombstone。
3. 找回每場擊殺的獎勵顯示（DungeonBattleRoom victory → claim 結果面板）。
4. rejoin 防線：status completed 但自己 unclaimed → 允許進入領獎畫面。


## 2026-07-18（卡片個性系統：族系套裝 + 招牌天賦,方向1+2）

**為什麼**：252 張卡效果只有 HP/ATK/DEF+N,重疊嚴重。使用者選定方向1（套裝）+2（天賦）。

- **`cardTalents.js`（新）**：①`FAMILY_SET_BONUSES` 七族套裝,同族怪物卡 2/4 張兩階（鬼怪異常-1回合/-20%強度、山林回合末回復、毒蟲毒傷減半→免疫、職場/寶箱金幣+%、考試高品質+%、西方對王+%）;②招牌天賦**零手工**：從 signatureEffectCatalog 積木自動映射（穿甲/破盾/連擊/蓄勁/護體/堅盾/荊棘/威嚇/破防/汲取/淬毒/精研/挑戰者/蠻力）,Tier 放大 ×1/×1.5/×2,彙總各鍵有 cap。世界王卡不參與。
- **戰鬥接線（BattleScreen）**：subscribeCardCollection→`calcCardCombatEffectsFromCollection`→START 帶入;威嚇/破防壓怪物面板、開場護盾、傷害/高品質/對王加成、連擊爆擊（×1.3）、穿甲疊專精、堅盾疊反擊減傷、鬼怪套裝削異常、毒蟲套裝縮毒傷、回合末回復。金幣加成接 MonsterBattle rollCoins。
- **UI**：DetailSheet 加「天賦：…」行;收藏頁標頭加套裝狀態 pills（未觸發顯示提示）。
- 驗證：42 suites / 265 tests 綠 + build 過。


## 2026-07-18（掉落素材顯示原始 id 修正）

- 打怪掉落顯示 `mat_exam_t5_normal_b`：`MonsterBattle` 掉落顯示層用 `monster.materialName`（adapter 只帶 `materialId`,欄位不存在）→ fallback 露出原始 id。改從 `monsterEconomyCatalog.MATERIAL_BY_ID` 查中文名。
- 驗證：261 tests 綠 + build 過。


## 2026-07-18（突發事件真兇＝示意彈窗;箭數累積補進 standalone BattleScreen）

- **突發事件真兇**：不是 randomEvents——是 BattleScreen 改版留的「回合開始前・特殊事件」**示意佔位**（ROUND_EVENTS,每回合 60% 機率）。已停用擲骰（資料保留供未來正式事件系統）。
- **架構釐清（重要）**：單人 RPG 打怪目前跑 **standalone BattleScreen**（MonsterBattle 1866 行,無 onSubmit）——舊 `submitRound`（含 addRoundArrows/引擎流程）是死路;技能結算/skillFx 在此路徑本來就會跑（battleId 有傳）。上一輪插在 MonsterBattle 2.5 的結算是死路程式（無害,留給舊 target 模式）。
- **箭數不累積**：standalone 路徑沒人呼叫 addRoundArrows → 在 BattleScreen handleSubmit 本地分支補上（每回合送出累積今日+終身;external 模式由各自元件記,不會重複計）。
- 驗證：261 tests 綠 + build 過。


## 2026-07-18（🔥 單人打怪技能真正接進 MonsterBattle 自有流程）

**踩坑（重要）**：RPG 打怪不是走 BattleScreen 的 local reducer——`MonsterBattle.jsx` 有整套自有回合流程（processMonsterRound + RoundController + 自有 log/HP state）。前一輪把技能結算/skillFx 接在 BattleScreen SUBMIT_ROUND,在 external/onSubmit 路徑**根本不會執行** → 玩家只看得到預告、沒有任何實際效果。
- 修法：`MonsterBattle` 引擎呼叫後插入「2.5 技能結算」——`resolveSoloMonsterAbility`（battleId=`mb:{id}:{nonce}`,once-only ref 防重複）;傷害=`calcStandardCounter×skillDamageMult`（保 1 HP）＋浮動傷害數字;atkDown 立掛 `archerATKMod`;毒=最大HP% 單次（不致死）;其餘異常/護盾/蓄力寫入戰鬥 log（type counter_crit/debuff/buff）。
- 隨機事件 gate（`ctx.allowRandomEvents`）確認唯一來源在 BattleEngine;使用者若仍看到 → 請硬重整（Ctrl+Shift+R）。
- 驗證：261 tests 綠 + build 過。


## 2026-07-18（卡片頁二輪 UX：已裝備列/小卡效果行/大立繪/設定介紹）

- 收藏頁頂部新增「🎽 裝備中」列（普通 n/10・世界王 n/3,點卡直接開詳情卸下）。
- 小卡星星下直接顯示效果行（❤️/⚔️/🛡️ +N;神話未選屬性顯示「待選屬性」）。wbViews 補 `stat` 欄位讓固定屬性王卡效果正確。
- 詳情面板立繪改滿寬大圖（maxWidth 280 置中）。
- 詳情新增設定介紹區塊：舊 60 隻用 monsterData 原 desc（斜體引言）;擴充怪顯示「⚡招牌技能」與「🎯破解方式」（catalog signatureSummary/counterSummary）。
- 驗證：261 tests 綠 + build 過。


## 2026-07-18（卡片頁 UX 補強：5欄大卡/裝備中標示/效果與升星判斷）

- 網格 `minmax(150px,1fr)`+maxWidth 830 → 桌機一排最多約 5 張（使用者指示）;CardGroupSection 同步。
- `CardMiniCell`：裝備中 → 綠框+光暈+「裝備中」角標。
- `CardDetailSheet`：新增裝備效果行（`getCardStat`+`calcCardBonus`,顯示目前加成與升星後數值;神話/教練王未選屬性提示）;升星鈕真判斷 `canUpgradeStar`（顯示 重複 n/需求;滿星/王卡不可升星文案）;星數旁顯示 ✓ 裝備中。
- 驗證：261 tests 綠 + build 過。


## 2026-07-18（單人打怪：關閉突發事件 + 技能發動演出;卡片裝備規則 10+3）

- **突發事件預設關閉**：`BattleEngine` Phase 0 改 `ctx.allowRandomEvents === true` 才擲骰（使用者指示取消每回合突發事件;要開回來只要呼叫端傳 flag）。
- **技能發動演出**：`BattleScreen` 新增 `skillFx` 蓋版——SUBMIT_ROUND 後 2.6 秒顯示「⚡ 怪物發動『技能名』」＋破解結果四色（完全破解綠/高分藍/部分黃/未破解紅）＋附加異常/怪物護盾/蓄力提示。共用技能名稱從 `ability.scheduled.name` 補進 resolution。原本只有 log 文字看不出有沒有發動。
- **卡片裝備規則**（使用者指示）：普通卡撤銷「每屬性3張」→ **不分屬性總量10張**;世界王卡維持3張。`monsterCards.MAX_MONSTER_EQUIPPED=10`,`db.equipCard` 改總量檢查。裝備/升星入口在點卡後的 DetailSheet（有判斷已裝備/可升星）。
- 驗證：261 tests 綠 + build 過。

## 2026-07-17（🔥 庫存負數根因修復 + 卡片收藏改單一大網格）

**症狀**：專精面板 T4×-85、貓貓村資源也出現負數。
**根因**：多處扣款「用 client 傳入資料驗證 → 盲目 `increment(-n)`」——多分頁（Firestore 退回 memory cache）/資料過期/連點時直接扣穿成負數。主要元兇：`db.js upgradeEquipSlot`（裝備強化,吃 materialInventory）與 `catDb.upgradeCatEquip`（村莊資源）。
- **修法**：兩處改 `runTransaction` 內讀伺服器當下值重新驗證、扣到 0 為底;歷史負值視為 0。
- **一次性修復**：素材面板載入時把 materialInventory 負值歸零寫回;MemberApp 登入時 `repairNegativeVillageResources` 歸零村莊資源負值。`summarizeMaterialsForSpec` 顯示端也 clamp。
- **仍有同 pattern 的站點**（db.js 2928 藥水/4395/4663 村莊、符文 4292/4312）——之後建議統一收成 safe-deduct helper,先修最常用兩處。
- **卡片收藏**：使用者回報桌機仍一排一卡＋未取得無剪影——真因是彙總視圖「一個族系×Tier一節,每節只有1-2張」的直向長列,且依原效能設計不畫未取得。改成**單一大網格**（auto-fill 104px 小卡）顯示全部符合篩選的卡,未取得＝暗化 SVG 剪影（零網路請求,最多 252 格）。
- 驗證：261 tests 綠 + build 過。

## 2026-07-17（DLC 收 Codex 尾：專精入戰鬥 + 大王階段被動 + 素材轉換 UI。未部署）

**為什麼**：使用者指示把 Codex 原負責範圍收完。缺口盤點：專精效果沒進戰鬥、PRD 54 階段被動沒做、新素材轉換沒 UI、孤兒 CardCollection.jsx、44 張卡圖（無圖片生成能力,做不了,SVG 佔位頂著）。

- **專精效果入 BattleScreen**：`useAuth`+`getEquipSpecializations` 載入每 slot 啟用專精 → START 帶入 state。武器：破甲(SCORE_ARROW 傷害公式吃 effDef)/精準(8環+/X 加成)/獵王(`monsterBossTagged`);防具：堅韌/守勢(HP≤35%)套在破解減幅後、護盾前(PRD 19 順序),免疫先降強度再縮回合最低1;飾品：營養(開場加最大HP)/睡飽(APPLY_COUNTER 回合末回復,倒地不觸發)。應援(貓加成)未接——solo 貓傷害路徑分散,另批。
- **大王階段被動（PRD 54）**：42 隻大王 counterSummary 尾句「70% HP…，40% HP…」8 類詞彙全解析（`parsePhasePassives`,validator 保證 42/42）;resolver 依 `monsterHpRatio`（≤70% 啟動、≤40% 疊加）修正護盾/傷害/減傷/反射/狀態幅度/延遲段/穿盾,不追加攻擊;solo 從 battle state 帶 HP 比例、party 從 room.monster。
- **素材轉換**：`materialConversionDb.convertMaterials`（transaction,金幣+庫存驗證後一次扣寫）;`ExpansionMaterialsPanel` 掛素材頁 materials tab——庫存清單（點選來源）、同Tier轉換（T1-3 3:1/T4-5 4:1/T6 5:1）/同族升階（5:1,T6 禁止）、批量+即時成本預覽。
- 刪孤兒 `CardCollection.jsx`（已無引用,build 驗證）。
- **Codex 仍欠**：44 張卡圖（temple T6×3/treasure×11/workplace×30）;箱池 expansion 更新（Phase 7 第一項）未查證完。
- 驗證：41 suites / 261 tests 綠 + CI build 過。
- **🔥 追修：單機打怪刷不出新怪的真因**——`monsterExpansionFeature.js` 第一行還吃 `REACT_APP_MONSTER_EXPANSION_V1==="true"` 環境變數,沒設=永遠關（我先前只看 grep 節選誤判「預設開」）。修法：localStorage `monsterExpansionV1` 支援 `"on"` 強制開/`"off"` 強制關,否則看環境變數;已建 `.env.development.local` 設 true（本機重啟後預設開）,使用者瀏覽器已設 "on" 並實測刷出新怪。**正式部署時 Vercel 要加同名環境變數**（或屆時把 ENV 預設翻正）。

**為什麼**：招牌技能一直停在「文字摘要」（引擎回 `signature_effect_not_structured`），PRD 33-34 要求積木化＋共用 resolver。摘要是腳本照模式生成的 → 直接寫解析器結構化,不再手抄 252 筆。

- **`signatureEffectCatalog.js`（新）**：252 條 `signatureSummary` → 1~3 效果積木（damage/multi-hit/pierce/delayedBurst/playerStatus/selfShield/selfReduction/selfReflect/hqMark/challenge），module load 一次解析;`validateSignatureEffects()` 保證 252/252 全解析、基準與遭遇類型一致（解析器一次過,因摘要模式固定）。Tier 數值帶 `TIER_SKILL_ATK_MULT` 照 monster-skill-catalog。
- **`signatureAbilityEngine.js`（新）**：共用 resolver。回傳**倍率**（`skillDamageMult`＝Tier基準×積木×強化版×破解減幅）而非絕對值,各模式 adapter 用自己的反擊公式乘——符合 PRD 34「adapter 只給上下文」。穿甲/破盾/自身效果依 `statusMultiplier` 縮放（≥70% 破解歸零）;挑戰=達標箭數過半（城隍判令語意）;大王 R6 強化版 `SIGNATURE_ENHANCED_MULT=1.1`（PRD 未給數值,集中常數可調）。
- **PRD 51 落地**：`mergeCombatStatus` 加同能力（atk/def）總減幅 40% cap（跨異常 clamp 進場強度）;同名刷新不疊加、最多 3 種維持原樣。
- **接線**：solo/party 引擎招牌分支改走 resolver（party 預設 single 目標）;BattleScreen reducer——多狀態合併、技能傷害**取代**該回合標準反擊（含穿甲/破盾）、延遲攻擊下回合落地、反射（上限最大HP15%不致死）、怪物護盾（HIT_MONSTER/THROW_DMG 吸收）、怪物自身減傷（ADD_ARROW 期限內生效）、hqMark/挑戰加成套用到下一回合箭傷。
- **卡片收藏頁**：`CardGroupSection` grid 從固定 3 欄改 `auto-fill minmax(104px,1fr)` + maxWidth 720——手機仍 3 欄,桌機小卡橫向多張不再放大成巨卡（使用者回報）。
- **單機打怪沒看到新怪**：接線本來就完整（`MonsterBattle` 417/508 行,flag 預設開）——是**正式站還沒部署 DLC**;本機 localhost 有效。
- **裝備專精 UI（Phase 7,新）**：`EquipSpecializationPanel.jsx` 掛在裝備頁（訪客隱藏）——9 條專精解鎖(🪙10,000)/升級(金幣+同Tier一般素材彙總+Lv8起王素材)/成功率與連敗pity(＋15pp,3連敗必成)/啟用切換/現在與下一級效果文字。持久化 `equipSpecializationDb.js` → 新 collection `equipSpecializations/{memberId}`（design.md §8 shape）,全 transaction 驗證後一次扣寫。**⚠️ 規則新增了 equipSpecializations 區塊,必須手動貼 firestore.rules 到 Console 才能寫入**。素材消耗設計決策：40/35/25 主次拆分視為配方描述,實際從玩家該 Tier 全部一般素材彙總扣（多的先扣）,不指定家族。戰鬥端 applyWeapon/Armor/AccessorySpecialization 效果接線**還沒做**（另批）。
- 驗證：41 suites / 259 tests 綠 + CI build 過（含專精 UI 後再跑一輪）。

## 2026-07-17（DLC Phase 6：世界王 R2/R4 強攻全接線，未部署）

**為什麼**：怪物專精擴充案 Phase 6。引擎切片（`worldBossStrikeEngine`）上上輪已好，這輪補資料與 UI 接線。**只在本機，未 commit**（DLC 整批之後一起上）。

- **`src/lib/worldBossSkillData.js`（新）**：24 王 × R2/R4 技能資料，PRD 22-26 逐條落地（六族 1.3x/1.8x、教練貓王 1.6x/2.2x；穿甲 `armorPiercePct`／破盾 `shieldPiercePct`／減益 status：`atkDownPct`/`defDownPct`/`healDownPct`/`dealtDownPct`/`dotMaxHpPct`，多段演出 `hits`）。貓王 R4 名稱 PRD 未給,自創（月下終舞/家法降臨…）。
- **引擎擴充**：`validateWorldBossSkillConfig` 依 `bossClass`（prime/family）驗倍率；穿甲/破盾入結算,並依 PRD 24「部分破解同步降低穿甲破盾強度」用 `statusMultiplier` 縮放（70-84% 破解會直接歸零副效果）。
- **`WorldBossAttack.jsx` 接線**：`finishRound` 反擊段,R2/R4 改走 `resolveWorldBossStrike`（R2 保 1 HP、R4 可擊倒且睡飽 regen 不復活）；減益只作用下一回合（ATK/DEF/對王傷害/治療量/蜂毒,蜂毒不致死保 1）；R1/R3 末 `getWorldBossTelegraph` 設預告 → 全螢幕 BattleScreen 分支頂部橫幅（**注意：1276 行第二個 `if (phase==="battle")` 是不可達舊版面,別把 UI 加在那**）；`sortieId`/`resolvedStrikeKeys`/`strikeDebuffs`/`pendingTelegraph` 全部進中途記憶 localStorage,重連一致、once-only 不重複扣血。
- 驗證：39 suites / 246 tests 綠（含 24 王完整性 6 測 + 穿甲破盾縮放 3 測）+ CI build 過。實戰 UI 驗收待有 active 王時本機打一場。

## 2026-07-17（世界王：擊倒後看不到領取畫面 → 三洞齊補，已單獨部署）

**為什麼**：正式站回報「王被擊倒後有人看不到領取畫面」。commit `0b69b7d`（只含世界王兩檔，DLC WIP 未動）。

- **根因1（主因）**：新版 `WorldBossAttack.jsx` 擊倒時**漏呼叫** `distributeWorldBossRewards`（legacy 版有、新版只剩一行註解）→ `worldBossHistory` 快照從未建立 → Lobby 的 `pendingEvent` 靠 `getLatestWorldBossKill()` 讀歷史，永遠 null → KillScreen 的領取區塊（`canClaim`）與「上次獎勵」按鈕都不出現。教練有在後台手動按過結算的場次才看得到 → 造成「有人看得到、有人看不到」。
- **根因2**：KillScreen 每分頁只自動彈一次（sessionStorage `wb_kill_seen_`），且王還是最新事件時「上次獎勵」按鈕被 `event.id !== pendingEvent.eventId` 條件藏住 → 錯過那一眼（或 pendingEvent 還在網路載入中就關掉）整個 session 無入口。
- **根因3**：`claimPendingReward` 失敗靜默（`result.ok=false` 無任何 UI）。
- **修法**：① 擊倒時補回 `distributeWorldBossRewards(event.id)`；② `pendingEvent` 加事件文件 fallback——最新事件是 defeated 且我參戰未領就直接可領，不依賴歷史（同時救回舊場次）；③ defeated 期間底部常駐「🎁 領取擊殺獎勵」按鈕（點了重開 KillScreen 走原領取流程）；④ 失敗顯示原因、`already_claimed` 收掉入口。
- 驗證：全套 237 tests 綠 + CI build 過；本機教練帳號開世界王頁正常（教練非參戰者故無按鈕，符合預期）。
- 踩坑：CRA 的 eslint 沒裝 `react-hooks/exhaustive-deps` 規則,寫 disable 註解反而 build fail。

## 2026-07-17（卡片收藏頁：全族/全 Tier 顯示持有卡彙總 + 世界王強攻引擎驗收）

**為什麼**：使用者回報「卡片系統沒讀玩家持有卡」。實查資料層是通的（`subscribeCardCollection` → `cardCollections/{memberId}`，標頭已收藏數正確），真正問題是 `CardCollectionPrototype` 原設計**必須選定「族系×Tier」才渲染卡片**——切「全族」或「全 Tier」整個清單空白，看起來像沒讀到。

- **`CardCollectionPrototype.jsx`**：新增 `aggregateSections`——未選定單一分組時，彙總顯示**已持有**的卡（依族系×Tier 分節，沿用 CardGroupSection）。只渲染持有卡（數量小），252 張未取得剪影仍須點進分組才畫，效能設計不變。
- 預設 `family`/`tier` 從 `ghost`/`common` 改為 `""`（全族/全 Tier）→ 進頁第一眼就是「我的持有卡總覽」。
- 踩坑提醒：`全族` chip 是 `onFamily(null)`，判斷一律用 falsy（`!family`），不要 `=== "all"`。
- **世界王強攻引擎**（上次限流中斷的切片）：`src/lib/worldBossStrikeEngine.js` + 測試其實已完整，本次驗收 9/9 綠。全套 38 suites / 237 tests 綠。
- C7 卡圖進度：208/252 已部署，缺 44（temple T6×3、treasure_b×11、workplace×30），缺圖由 `CardArt.jsx` SVG 佔位自動頂替，Codex 流量回來再補圖即可。

**為什麼**：射手表現「亂/醜」、遊戲戰績分頁 prod 崩潰、深度分析只是一堆圖表、日週月年差異極小。與 Codex 平行開發（Codex 負責 react-bits/地下城，交接文件 `.trellis/tasks/07-16-react-bits-homepage/claude-performance-handoff.md`：射手表現全歸 Claude、禁新增動畫依賴、CountUp 用現成 Widgets、吃 `.no-anim`/reduced-motion）。

- **修 prod 崩潰**（遊戲戰績分頁）：`style={{ color }}` shorthand 用了未定義的 `color`（本意 `c`）。dev 各模組獨立 scope 沒事，**prod scope hoisting 併成同一 scope 後被 terser 綁到別模組未初始化的 `const` → `Cannot access 'ut' before initialization`（TDZ）**。改 `style={{ color:c }}`。madge 找不到（非 import 問題）。→ 這是 prod-only TDZ 的第二種成因。
- **版面重構**：背景加深色遮罩救對比；分頁 5→4（總覽/深度分析/歷史/遊戲戰績，同步併入歷史底部）；sticky pill 分頁列；總覽移除與深度分析重複的趨勢圖。
- **動畫**：分頁 `key={tab}`+`.fx-fade-up` 淡入；遊戲戰績數字用 `Widgets.jsx::CountUp`。零新依賴。
- **深度分析 v2**：新增 `src/lib/archerDiagnosis.js` 純前端診斷引擎（6維：準度/群聚精密度/群心偏移/節奏穩定/後段耐力/近期趨勢，每維分數+評級+建議，總評挑最優先建議；門檻在檔頂 `TH` 供教練校正）。`exactArrows` 帶入靶面座標 `position`。`ShotGroupOverlay` 支援 4 疊加模式（分場/合併/前段vs後段/密度熱區）+ 近3/5/10場。
- **期間取樣縮放**：近N箭視窗隨期間放大 日90/週300/月600/年900/全部1000（原本全部只算前90箭故差異極小）。加 `MAX_SESSION_SCAN=120` 場硬上限保護 IO。
- **本機優先未破壞**：全走 `getCachedShootingSessionEnds`（`getDocsFromCache`，cache miss 回 []、**不打網路**）；唯一常態網路讀仍是 `getMemberPerformanceSync`。過去資料仍要手動載入。
- **深色卡片禁淺灰字**：`var(--text-muted)`(#64748b) 33 處全改 `var(--text-secondary)`(#94a3b8)。
- **教練檢視持久化**：`selectedMemberId` 存 localStorage（切走再回自動帶回）+ 檢視他人時橫幅「檢視中：學員名」+ 返回我自己。範圍決策=**A（只在唯讀檢視頁，動作類永遠教練本人）**。
- ⚠️ **踩坑**：第 4 波用 `git add -A` 把 Codex 平行 WIP（react-bits/、dungeon/DungeonEventStage、expeditionDb、fxSettings、assets）一起 commit 上線（build 有過、無遺失，但半成品提前部署）。教訓：**多 agent 同 working tree 時只 `git add <自己的具體檔>`**。
- ✅ 每波 `npm run build` 通過並實機驗證四分頁無 console 錯誤。已部署。
- **待辦**：診斷 `TH` 門檻需教練用有靶面資料的學員校正；A 方案若要擴到其他唯讀頁（成就/戰績歷史）再逐頁加 `profileOverride`。

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



## 2026-08-11（世界王卡 v2 收藏介面補齊）

**改了什麼**
- 修正世界王卡雖已改成 v2 專屬被動，收藏詳情仍誤顯示舊版 `HP/ATK/DEF +25`。
- `wbViews` 改以 `WB_CARDS` v2 定義為能力唯一來源，不再讓 Firestore 舊 `stat/chosenStat` 覆蓋新版資料。
- 世界王卡詳情直接列出專屬被動；怪物卡才繼續使用原本面板數值與升星預覽。
- `CardMiniCell` 外部小卡同步切到 v2：世界王卡不再呼叫舊 `calcCardBonus("worldboss")` 顯示 `ATK/HP/DEF +25`，改顯示「👑 專屬被動」與 `effectText` 摘要；一般怪物卡維持原本屬性加成與天賦。

**原因**
- v2 能力定義已存在，但收藏 view 沒把 `effects/effectText` 帶進 UI，詳情頁又仍共用舊 `calcCardBonus(worldboss)` 路徑。

**範圍**
- 未修改尚未完成的世界王戰鬥畫面流程。



## 2026-08-13 (World Boss monsterKills audit/fix)
- monsterKills is event-driven via contributeWorldBossSpawnProgress(), not a scan of all battle records.
- Count scope is seven-family PvE only: solo monster, party, dungeon. Duel, worldBoss, zombie, exams and external competitions are excluded.
- Fixed pending shooting-session early return so qualifying kills contribute immediately; deferred flush retries the same monster:<sessionId> operation idempotently.
- Resting-cycle contributions now consume an ignored worldBossSpawnOps operation so retries cannot leak into a later charging window.
- Admin/lobby labels now describe seven-family PvE scope consistently.
- Focused tests, worldBossLifecycle syntax check, scoped diff check and production build passed. Not committed/pushed/deployed.

## 2026-08-13（外賽直接核發／年度檢定場次綁定收尾）
- 外賽流程確認維持教練權威名單：建立外賽項目 → 教練勾選參賽射手 → 儲存即直接寫入 competitionDex 核發參賽圖鑑；外賽不建立玩家報名、射箭或本系統計分流程。
- 玩家比賽頁持續隱藏 adminOnly 外賽 catalog，避免把外部賽事誤當館內可報名／可射箭賽事。
- 年度檢定由後台建立 catalog 後即在圖鑑生成鎖定卡；通過後的 certRecords 必須以相同 compId 對應該場檢定才會亮起，避免同年度／半年／弓種的舊 legacy 成績提前解鎖新檢定。
- 沒有任何檢定 catalog 時仍保留 legacy 年份 × 半年 × 弓種相容顯示。
- 驗證：achievementDexV3 focused tests PASS、scoped git diff --check PASS、production build PASS。
- 本批外賽／檢定仍為本機修改，尚未 commit / push / deploy。

## 2026-08-13 自由狩獵 Phase 2 — 狩獵環境
- 自由狩獵戰前頁移除舊「分數靶紙／學生模式／固定距離／每回合箭數」摘要，改為手機優先「狩獵環境」卡。
- `src/lib/freeHuntEnvironment.js` 直接引用世界王 `src/worldboss/domain/raidFaces.js` 與 `raidRange.js`，維持單一倍率真本。
- 距離 5–18m；半靶 ×1.0、全靶 ×1.2、原野靶 ×1.4、三連靶 ×1.5；三連靶每張最多 2 箭產生有效傷害。
- 最終環境倍率沿用 `rangeMultiplier()`（距離倍率 × 靶紙倍率），只在單人自由狩獵透過 `BattleScreen.outgoingDamageMultiplier` 套入既有最終箭傷；其他模式預設 ×1。
- 靶紙與距離沿用 `targetFmt`／`selectedDistance`、`mb_defaults` 與 battle snapshot，不建立平行設定。


## 2026-08-13｜狩獵模式組隊 Phase UI 第一版
- 新增 Hunt 專用 input / waiting / resolution 呈現狀態與測試。
- 修正等待 overlay 可能遮住權威結算動畫：processing / pending resolution 時立即切出演出。
- 新增手機 compact HUD 與權威怪物異常、自身護盾資訊。
- 驗證：195 suites / 2192 tests PASS、production build PASS、localhost:3000 正常。


## 2026-08-14 - Email Campaign admin feature
- Added AdminMarketingEmail and AdminApp members-finance entry.
- Added functions/marketingEmail.js helpers and campaign callables/scheduler/delivery/open/unsubscribe endpoints in functions/index.js.
- Added Firestore server-only boundaries for campaign queue, suppression and run counters.
- Validation: marketingEmail node checks PASS; node:test 5/5 PASS; React production build PASS.
- Not deployed yet. Existing Firebase Trigger Email extension must remain active.

