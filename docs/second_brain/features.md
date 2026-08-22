## 🔌 訪客 Arcade：5 位房號加入＋斷線返回戰鬥（2026-08-21）

- ✅ 保留 QR 加入，新增大廳 5 位數房號「加入／返回」。
- ✅ 進房前單次驗證 room + visitor membership；等待房可新加入，已開戰房只准原隊員重連。
- ✅ 暫時網路/Firestore 錯誤保留 IndexedDB `currentTeamRoom` 與未送 arrows，不再誤清房。
- ✅ same-round reload 恢復箭數；remote round 已前進則自動捨棄舊回合箭。
- ✅ 即時同步失敗留在戰鬥並提供人工重新同步，不增加 polling。
- ✅ waiting / fighting / route / result / defeat 常駐顯示房號。
- ✅ 原隊員在結果房保留期間重新整理仍可返回結算；active outsider 仍拒絕。
- ✅ Arcade 155 tests PASS；production build PASS。

## 💰 會計自訂金額＋預約課次狀態隔離（2026-08-20）
- 會計「記帳」的實收金額現在可自行輸入；方案仍會先帶入標準價／早鳥／月卡結果，教練可再改成實際收款數字，最後帳單與營收統計使用自訂後金額。
- 修正同一學生同日「第一筆已下課／結帳 → 新增第二筆預約卻直接顯示已結帳／強制結帳」：新預約維持正常 `confirmed`，只有自己的 bookingId/checkin/billing linkage 才能改成 completed。
- 一般結帳不再自動轉強制結帳；若該預約尚未有自己的已下課紀錄，只提示教練。需要提前結帳時必須明確點「⚡ 強制結帳」。
- 舊資料相容採安全唯一判定；移除同學生同日多筆時「猜最近一筆」的 fallback，避免歷史 checkin／billing 再吃掉新預約。
- 驗證：focused **4 suites / 18 tests PASS**；production build PASS。2026-08-20 已正式部署 `catarrow-6iuk9vhox-broudes-1864s-projects.vercel.app`（Ready），`student.catgroup.com.tw` 已指向此版且 HTTP 200，主 bundle=`main.0f3b697a.js`；會計／預約相關 lazy chunks 與本機 verified build SHA-256 完全一致。未 deploy Firebase Rules / Functions，未 commit / push。

## 🎫 下課結算＋月卡審核制（2026-08-19）
- 首頁與「練箭」共用 `ClassEndSettlementModal`：點下課後顯示今日累積箭數、箭露結算預覽、里程碑獎勵、月卡剩餘時數，並提供不使用／申請扣 1h／申請扣 2h。
- 月卡扣抵維持後台審核制：1/2h 只建立 `monthlyCardRequests pending`，教練後台核准才實際扣 `monthlyCard.sessions`；已有待審或時數不足時禁止重複申請。教練帳號切射手模式與一般學生走同一流程。
- `submitClassEnd()` 不修改月卡；`approveMonthlyCardRequest()` transaction 原子處理扣卡＋approved＋`use_approved` log。
- 月卡後台會員列表新增「➖ 扣除次數」，可手動扣 1/2 次並記錄 `admin_deduct`；transaction 防止扣成負數。
- 首頁固定顯示月卡剩餘 X 小時、到期日、剩餘天數，狀態標示「可申請扣抵」。1 session = 1 小時。
- 驗證：**5 suites / 18 tests PASS**；Vercel production build PASS。2026-08-19 已部署 `catarrow-2g5dn3kbg-broudes-1864s-projects.vercel.app`，`student.catgroup.com.tw` 已指向此版；正式站 HTTP 200、bundle=`main.5cb251c5.js`。`firestore.rules` 已成功部署到正式 Firebase `catgroup-8d0bb`。未 commit / push。

## 🎬 訪客 Arcade：完整戰鬥演出、人工重同步、射擊評價（2026-08-18）
- 組隊 waiting／route／battle／連線錯誤等容易卡住畫面新增「🔄 重新同步」。這是人工救援，不是 polling；每次按下只額外讀取一次權威 team room，重新套用最新狀態並可重播最新 resolution。
- 單人與組隊的怪物即使被第一回合秒殺，也不再直接跳寶箱或結果：完整播放射箭、命中、貓技能、怪物反應、擊破動畫與結算後才切換畫面。
- 組隊攻擊演出從合併 TEAM DAMAGE 改為玩家依 roster **A→B→C→…逐一攻擊**；每位都有攻擊 banner、飛箭、命中、個人傷害與逐步扣血。`lastResolution` 保存本回合怪物 snapshot，避免最後一擊時下一隻怪提前出現在演出。
- 結算新增「射擊表現」：命中率、穩定性、平均每箭、射擊評價 S/A/B/C，以及 20 條不同正向誇獎詞。射擊評價純展示，不影響既有冒險通關評價／金幣。
- Local First 保持不變：單人逐箭只留本場記憶體；組隊 Firestore 不保存完整逐箭歷史，只增加少量 aggregate，當回合 BOSS 落點解析後清除。
- 驗證：Arcade **139/139**；全專案 **233 suites / 2522 tests 全過**；production build `Compiled successfully`。狀態：**2026-08-18 已重新部署** `catarrow-b64t6vbeh-broudes-1864s-projects.vercel.app`（Ready），`student.catgroup.com.tw` alias 已確認切至此版；未 commit / push。

## 👹 訪客 Arcade：怪物圖名一致＋學籍世界王外觀（2026-08-18）
- `ARCADE_MONSTERS` 由 `sourceMonsterId` 同時決定名稱與 `/monsters/<id>.webp`，修掉原本手寫名稱配錯族群圖檔；組隊深淵衍生怪也從 canonical base name 產生名稱。
- `buildVisitorWorldBoss(worldBossKey, combat)` 直接讀學籍 `WORLD_BOSSES` 的 `name/title/desc/pixelKey`，訪客只另給獨立 combat stats，學籍正式世界王數值不會被修改。
- 三個單人訪客王：山魈頭領（貓森）／狼人首領（月夜）／怨靈大君（深淵）；HP=115、DEF=1、ATK=5/6/7，打斷門檻 36 分，弱點圈 bonus 1.35，完全沒中圈仍保留 80% 傷害。
- 平衡驗收：第一次來的新手以 6 箭平均 5 分＝30 分／回合為保守基準，0 弱點命中時三王均第 5 回合擊敗且玩家仍存活；命中弱點或分數更高會更快。
- 驗證：Arcade 131/131、全專案 231 suites / 2514 tests、production build PASS。狀態：**本機完成，未重新 deploy / commit / push**。

## ⚔️ 訪客 Arcade 射手競技場 PvP v1（2026-08-18）
- 新增最多 8 人 PvP：1v1、3～8 人大亂鬥、4/6/8 人團隊戰，3/6 箭回合制；10/X 有明顯傷害差，並用圍攻保護避免多人集火瞬殺。
- 倒下不淘汰出局：轉「支援靈魂」後仍需射箭；團隊戰補同隊，大亂鬥／1v1 自動補最低 HP 存活者。
- Local First：逐箭、本場未送資料、PvP `duelStats`、動畫都保留在各自 IndexedDB；`profileForCloud()` 明確禁止 `duelStats` 上傳 `arcadeProfiles`。
- Cloud for Coordination：每人整場固定一顆 `arcadeRooms/DUELSUB_<code>_<sessionKey>_<encodedVisitorId>` 小摘要、每回合覆寫；只有房主對房內 2～8 顆 exact docs 持續監聽，其他人只讀 parent room；房主一回合只寫一次共享結算。無逐箭 Firestore、無 heartbeat、結束清理 0 額外 reads。
- 每房另有隨機 `sessionKey` 隔離重複 5 位房號，避免異常關閉留下的舊 submission 在未來同房號／同回合時污染新場；不增加讀取。
- QR：`?arcade&duel=XXXXX`；本機 resume 可接回房號、回合、未送箭、目標與本場統計。
- 房主失聯 5 分鐘可接管；回合 4 分鐘可跳過未提交者；戰鬥中離開不阻塞全房。
- 驗證：Arcade 128/128；全專案 231 suites / 2511 tests；production build PASS。
- 狀態：**2026-08-18 已正式部署**。`student.catgroup.com.tw` 已指向 Vercel deployment `catarrow-k4b2e8eaj-broudes-1864s-projects.vercel.app`；`DUELSUB_*` 使用既有 production `arcadeRooms` 權限，匿名 write/delete 線上驗證成功。未 commit / push。

## 官網帶隊比賽／賽事成果系統（2026-08-17）
- 後台：`AdminWebsiteCms` 內的 `AdminWebsiteCompetitions`，來源 collection `websiteCompetitionResults`（admin-only）。
- 公開：`website/assets/competition-results.json` → `npm run website:competitions` → `/competitions/` 與 `/competitions/<slug>/` 靜態頁、首頁最新賽事卡。
- 定位：從第一次射箭到站上賽場的成長證明，不是單純戰績炫耀頁。公開匯出會剝除內部 `linkedMemberId`。
- 一鍵發布：`AdminWebsiteCompetitions` 可呼叫 `asia-east1/publishCompetitionWebsite`；Function 僅允許 admin，重新讀 `websiteCompetitionResults`、server-side 清洗，再從 Functions 內的網站模板產生 `/competitions`、runtime、sitemap，最後透過 Vercel REST API 建立 `catarrow-archery` production deployment。
- 安全：Vercel Token 僅存 Firebase Secret Manager `CAT_ARCHERY_VERCEL`（JSON：token/teamId/projectName），不進 repo／前端；JSON 匯出保留為 fallback。
- Functions 部署：`firebase.json` predeploy 會跑 `npm run website:publisher:prepare`，同步最新 `website/` 與 generator 到 gitignored 的 `functions/website-template/`、`functions/website-publisher-tools/`。
- 啟用狀態：程式已完成與測試通過；尚未設定 `CAT_ARCHERY_VERCEL`、尚未部署 `publishCompetitionWebsite` Function。

# 📋 features — 功能清單
> 最後更新：2026-07-25（稽核補記：補上先前漏列的功能，見下方 🔍 章節）

## 🔍 2026-07-25 稽核補記（先前功能清單漏列，實查原始碼確認）

> 這批是「code 早已存在、但 features.md 從未列入」的功能。詳細規格見 `game-systems.md` 對應章節。

- **🎲 貓貓村大富翁（villageBoard）**：28 格環形棋盤、每日 15 顆骰子、12 種格子；`mining/monster/chest` 格要**實際射箭**，完成度分帶（S/A/…）決定獎勵倍率。難度上限受村莊建築等級控制。單人 `villageBoardDb.js` + 組隊 `villageBoardTeamDb.js`。UI：`CatVillageBoard.jsx` / `CatVillageBoardTeam.jsx`。
- **📅 線上約課（booking）✅ 已正式開放**（2026-07-25 作者確認，訪客與學生皆可正常使用，不再是 beta 試辦）：`PublicBookingApp.jsx` 註冊 + 教練後台 `AdminBooking.jsx`（行事曆/開放名單/收費報表三分頁）。程式仍保留 `bookingBetaAccess` 旗標機制（`bookingDb.js`/`bookingSchedule.js`），詳見 quick-ref「約課」章節。
- **🛡️ 裝備專精（equipSpecialization）✅ 早已上線**（2026-07-25 作者確認，玩家可實際使用）：9 條專精軌、解鎖 10000 金、三部位（武器/防具/飾品）各自效果、機率升級含連續失敗保底。引擎 `equipmentSpecializationEngine.js`、UI `EquipSpecializationPanel.jsx`。
- **🧟 殭屍生存模式（zombie）🚧測試中**：獨立 DDD 模組 `src/zombie/`，地圖探索→遭遇→戰鬥→撤離循環，含感染狀態機。**只有 `?zombie` 隱藏網址，禁止建玩家入口。**
- **🛍️ 射箭商品型錄（catalog）🚧測試中**：`src/features/catalog/`，電商瀏覽頁（**非遊戲**），含篩選/比較/翻頁書/淘寶爬蟲。**只有 `?catalog` 隱藏網址，禁止建玩家入口。**
- **📉 讀寫成本控制（基礎設施，非玩法）**：`costControl.js` 5 級管制，超支或啟動期會**靜默擋掉**非核心 Firestore 寫入。除錯「寫入沒反應」時要列入嫌疑，詳見 `ai-guide.md` 鐵律 #11。

## 🎓 學生分級與系統鎖定（2026-07-04）

- `members.studentTier`: `"restricted"|"official"|"retired"`（缺欄位→視為 restricted）；`accountFrozen: boolean`；`lastCheckinDate` 快取（submitCheckin 當下 + approveCheckin 補寫）
- 與 `CERT_LEVELS`（技術檢定）、`monthlyCard`（付費方案）是**不同軸線**，不合併
- 核心純函式 `src/lib/accessControl.js`：`getAllowedPages/isPageAllowed/isAutoLocked`；`official` 超過 14 天未報到自動鎖定（`lastCheckinDate` 缺欄位時不誤鎖，見遷移策略）
- 權限矩陣可由教練後台調整：`systemConfig/tierPermissions`（`onSnapshot` 即時生效），文件不存在時 fallback `DEFAULT_TIER_PERMISSIONS`
- 系統維護鎖：`systemConfig/maintenance`，啟用時一般會員前台全被擋，AdminApp／教練射手模式不受影響
- 優先權：維護鎖 > `accountFrozen` > `studentTier`；`role==="admin"` 完全豁免（`MemberApp` 只服務 role==="member"，天然豁免）
- `MemberApp.jsx`：全站關卡（維護/凍結全螢幕）+ 單一 `pageLocked` 判斷（依目前 `page` 是否在允許清單內），鎖定顯示 `LockedFeatureCard`（不強制跳轉），導覽列不隱藏項目
- 教練後台：`AdminMembers.jsx` 每列會員可設 `studentTier`/`accountFrozen`（`TierModal`）+ 批次勾選一鍵設為 `official` + 維護鎖開關卡片；新頁 `AdminTierPermissions.jsx`（打勾矩陣，`hub-member` → 「權限設定」）

## 🎨 2026-07-03 UI 全面改版 Phase 0-2（同左）

🔗 **在 Obsidian 中開啟**：`obsidian://open?vault=Obsidian%20Vault&file=catarrow%2Ffeatures`

## ✅ 已實作

**🏛️ 冒險者公會遠征（2026-07-25，🚧 測試中：只走 `?guild` 隱藏網址，禁止建玩家入口）**：舊公會重做成獨立 2.5D 鳥瞰 ARPG 遠征遊戲（`src/guild/`，與主線平衡完全隔離）。P1＝備包→2.5D 戰鬥（貓助攻/補給消耗）→凱旋結算；P1.5＝持久化（`guildProfiles` 存 CAT幣/聲望/公會裝倉庫，金幣與材料回饋主線）＋倉庫換裝。規格見 `game-systems.md` 公會章節。階級解鎖、公會商店、大廳/委託板/公會長貓、真貓資料皆已完成；**美術**：場景與物件見 `public/assets/guild/`（`gen-guild-art.py`），角色立繪見 `public/assets/guild/chibi/`（`gen-guild-chars.py`，2026-07-26：玩家射手＋九貓＋42 隻舊怪，2.5D 微縮模型風＝地下城語言）。

**冒險者公會一般懸賞任務自動化（2026-07-04 新增）**：4 個全新獨立難度（1~4，獨立於六階雙週懸賞與三階每日靶紙任務），教練後台管理任務範本池（`guildBountyTemplates`）+ 難度獎勵表（`guildBountyRewards`），每日全員同一批自動刷新（每難度固定抽 1 個範本，日期當 seed），沿用既有 `publishGuildQuest`/`submitGuildQuestCompletion` 發佈與結算路徑；結算時依難度額外發放固定寶箱（wood/iron/gold/epic）

**官網（2026-07-04 新增，2026-07-10 視覺互動改版）**：`website/` 靜態 SEO 單頁官網（與 App 完全獨立、無建置流程、單一 `index.html`），暖紙＋炭墨＋品牌橘編輯風；JSON-LD（LocalBusiness+FAQ）、OG、sitemap/robots；預約 CTA 連 SimplyBook `#book`；✅ **已上線於 `https://archery.catgroup.com.tw/`（2026-07-25 作者確認，舊 placeholder `catarchery.tw` 作廢）**；學生 App 在 `https://student.catgroup.com.tw/`（不同 Vercel 專案）；地址 12/14 號待確認
- **2026-07-10 視覺互動改版**（Trellis task `07-10-website-visual-interactive-refresh`，只動 `website/`，不連 Firestore／App）：全站沿用既有 `.rv` IntersectionObserver（同一實例、依 class 分流行為，不新增 observer），所有新效果皆有對應 `prefers-reduced-motion` 降級
  - `#training`（R2 核心）：手機 mockup 從單張靜態圖改為可切換的 3 畫面預覽（`.phone-shots` + 分頁圓點 `.pdot` + 觸控滑動），目前 3 張暫用同一張 `assets/015.png` 佔位（切換機制已完成，之後補拍打怪戰鬥／勳章圖鑑截圖只需換 `src`）；`.badges` 加 scroll-triggered 依序解鎖動畫（stagger 110ms/個）
  - `#group`（R2 核心）：新增第 5 張模式卡「地下城遠征 Dungeon Expedition」（對應 App 實際的組隊三層迷霧地下城遠征系統），5 張卡 hover 各有專屬圖示動態（攻擊震動／交錯閃現／靶紙 ping／箭矢推移／寶石微光）
  - `#hero`：`.rings` 隨滑鼠做輕微視差（±5~8px）、`.hero-cat:hover` 時 `.target` 品牌橘閃光一次
  - `#why`：`.wcard` hover 加爪痕刮過 SVG 描邊動畫（`stroke-dashoffset`，3 道錯開時間）
  - `#price`：`.cnum` 數字滾動進場時從 0 計數到實際金額（`requestAnimationFrame` easing），完成時 `.hit` 箭矢圖示做一次命中回彈
  - `#bows`：`.bcard` 新增箭矢圖示（`.arrow-ico`），hover／觸控 tap 時輕微擺動
  - `#facility`：`.fac-photo img` 加極慢速 Ken Burns 縮放（純 CSS `animation`）
  - `#faq`：`summary` 展開瞬間加箭矢畫過底線動畫（`.qline` scaleX）
  - `#reviews` marquee hover 暫停：改版前已存在，未變動
  - 明確不動：`#booking`/`#visit`/`#final`（轉換型區塊，維持現狀，design.md 定調）
  - 驗證：Chrome headless 截圖走查全頁（hero/why/bows/price/training/group/facility/reviews/faq/booking），HTML tag 配對、JSON-LD 解析、JS 語法均通過腳本檢查
- **2026-07-10 SEO/GEO 泛用關鍵字內容上線**（Trellis task `07-10-website-seo-geo-content-rollout`，只動 `website/`，仍無建置流程）：目標讓 Google/AI 搜尋在「台南下雨天去哪」「台南親子活動」等非品牌情境下主動推薦，不只靠品牌詞搜尋
  - 首頁新增 `#scenarios`（05，原 05~10 全部順移 +1 → 現為 06~11）：「什麼時候適合來貓小隊射箭？」8 張情境卡片（`.scen-grid`/`.scard`，`repeat(4,1fr)`→960px `repeat(2,1fr)`→560px `1fr`，8 剛好整除各斷點，不會重蹈上次 5 卡塞 4 欄的孤兒列問題），每張連到對應獨立頁
  - 首頁 FAQPage JSON-LD `mainEntity` 由 8 題追加到 18 題（新 10 題疊加在後，同一陣列），`.faq-list` 視覺同步新增 10 個 `<details>`
  - 新增 **8 支**獨立頁面（PRD/design 文件標題誤寫「7 支」，實際逐頁規格與 implement.md 都是 8 支）：`website/rainy-day/`、`website/sunny-day/`、`website/beginner-guide/`、`website/family/`、`website/couple/`、`website/friends-group/`、`website/corporate-team-building/`、`website/solo-friendly/`，各自 `<slug>/index.html`（乾淨網址、不依賴 rewrite）
  - 每頁 `<head>`/`<style>`/header/footer 從 `index.html` 整份複製再微調：**不**重複 LocalBusiness/SportsActivityLocation schema（只留首頁），改帶各頁專屬 FAQPage schema（3 題，跟首頁與彼此不重複文字）；header 錨點加 `/` 前綴（`/#why` 等）；圖片路徑加 `../`
  - 子頁沿用同一份 `<script>`，但把行銷 marquee 區塊 `document.getElementById('mqTrack')` 的操作加 `if (track) {...}` guard——子頁沒有 `#mqTrack` 元素，若不加 guard 會拋錯中斷同一支 script 後續所有邏輯（此為本任務發現並修正的坑，其餘 DOM 查找皆已有原生 guard 或空陣列安全）
  - 企業團康頁 CTA 沿用 `#group` 的 `.group-cta`／`.line-btn` 樣式與既有 LINE 連結 `https://line.me/ti/p/UJXIAt1s0O`
  - I 人頁紓壓段落刻意避開療效宣稱，只寫「休閒用途、轉換心情」，非醫療用途
  - 驗證：`JSON.parse` 過全部 9 個 JSON-LD block（首頁 2 個 + 8 子頁各 1 個）、`node --check` 過首頁與 8 子頁共 9 個 `<script>` block、grep 確認全站無殘留 `href="#"` 佔位連結
  - 不在本任務範圍：sitemap.xml/robots.txt/BreadcrumbList schema 更新（留給下一個任務，等內容確認後再排）、正式部署（`website/` 整包複製到獨立 Vercel 專案，需使用者確認內容後手動執行）
- **2026-07-10 真實照片整合**（Trellis task `07-10-website-real-photos-integration`，只動 `website/index.html` + 新增 `website/assets/images/archery/real/`）：把 218 張真實照片中使用者指定的 46 張整合進首頁，取代插畫示意內容，讓官網更真實可信
  - **來源路徑**：`public/images/archery/real/<分類資料夾>/`（App 端靜態資源，11 個分類子資料夾，原始檔備份不刪除）→ 一次性 Node 腳本用既有 `sharp` 依賴壓縮（`resize(width:1600) + webp quality 80`，超 800KB 才降到 70/60/50 quality floor）→ 輸出到 `website/assets/images/archery/real/`（維持分類子資料夾，官網用相對路徑引用，因為官網是獨立 Vercel 專案 `catarrow-archery` 只打包 `website/`）；壓縮腳本為暫存工具，跑完即丟（未留在 repo）
  - **壓縮成果**：46 張唯一檔案（Hero 圖與新手教學區共用同一張，只處理一次）合計 39.37MB → 4.67MB，全部 <800KB（多數在 quality 80 就已壓到 <250KB，未觸及 quality floor）
  - **Hero 改版**：`.hero` 從左文右插畫兩欄，改為真實照片全幅背景（`.hero-photo-media` 絕對定位 + `::after` 深色/暖橘漸層遮罩）+ 文字疊加在上方（改用淺色文字），插畫吉祥物 `assets/006.png` 仍保留在下方 `#why` 卡片，未刪除
  - **新增 11 個真實照片區塊**（`id="real-*"`，緊接在 GEO 實體描述段落後、`#why` 之前，原有 `#why`〜`#visit` 的 `.sec-num` 全部順移 +11 → 現為 12〜22）：新手教學／場地器材與代購／弓種實拍／親子與兒童／團康活動／長期練習／戶外進階訓練／學籍系統與訓練 App／貓咪安全區／校外合作與賽事成果／活動相簿，標題文字逐字對應 PRD
  - **共用 CSS**：`.real-grid`（`auto-fit minmax(240px,1fr)`，免每區塊寫斷點）、`.real-photo.r32/r43/r34/r23`（依實際圖片比例挑 aspect-ratio class，`object-fit:cover` 不變形）、`.phone-mock`（學籍系統/App 區用手機外框樣式包 4 張截圖，不做滿版大圖）
  - **活動相簿「查看更多」**：11 張圖全部在 DOM 裡，`max-width:640px` 時最後 2 張加 `.album-extra` 用 CSS 隱藏，按鈕 `#albumMoreBtn`（`.btn-ghost`）點擊後對 `#albumGrid` 加 `.expanded` 解除隱藏——純前端展開，非分頁載入
  - Hero 圖 `fetchpriority="high"` 且不加 `loading="lazy"`；其餘全部 `loading="lazy"`；所有圖片皆有具體 alt（依情境撰寫，非檔名）+ 明確 width/height；不使用輪播套件
  - 驗證：46 個圖片路徑全部存在、無重複 `id`、`<section>`/`</section>` 數量相等（24/24）、`<style>` 大括號配平、全部 `<script>` 用 `new Function()` 語法檢查通過；grep 確認 8 支既有情境子頁（rainy-day/sunny-day/beginner-guide/family/couple/friends-group/corporate-team-building/solo-friendly）完全未被動到
  - 不在本任務範圍：正式部署（同上，需使用者確認內容後手動執行）；`public/images/archery/real/` 原始檔全部保留當備份，未刪除
**核心**：登入/角色分流、會員 CRUD、射手卡分享、主題換色（8 種）
**報到**：pending→教練審核→active/rejected、下課結算箭露、浮動視窗
**練習**：自主練習、歷史/總覽/分析、箭數里程碑（多回合+世界王已修 2026-07-02）、箭露累積
**比賽**：建立/提交/審核/結算/排行榜、外部比賽、報名
**檢定**：6 等級 3 弓種、檢定考試任務（藍書/金書）、教練審核
**地下城三大來源系統（2026-07-14）**：
- **① ⏳ 定時生成**：每次領取/放棄/保存後自動重設計時器（隨機 24~144h），時間到可領取隨機地下城（6 族 × T1~T6）
- **② ⛏️ 練箭挖掘**：報到 +20、每箭 +1、每 30 箭提升最高可開等級（T1→T6）；即時顯示 T1~T6 完整機率表；免費降級（T6→T1 無限制）；金幣強化保留
- **③ 📜 世界王卷軸**：擊殺世界王給卷軸，使用時隨機獲得 T1~T6 地下城存入儲存槽；使用前檢查槽位空滿
- **三卡並排 UI**：DungeonExcavationTab 同時顯示三個來源的操作卡片

**端對端地下城流程**：
- 挖掘探索（3 來源）→ 100% 揭曉（難度/族系/隱藏）→ 選擇保存/放棄
- 儲存槽固定 3 格（空槽 🕳️ 可視化）→ 選擇面板（單人 or 組隊）
- 單人遠征（DungeonExpedition：第 1、2 層 5×5 迷霧格子＋功能房本地模式，第 3 層 A/B/C 分支王關，2026-07-03 Phase G）
- **組隊遠征**（接現有 DungeonBattleRoom 多人戰鬥系統，2026-07-14 修正路由）：建立組隊房間 → 房主開始 → 三層 DungeonBattleRoom → 結算畫面
- **遠征 Boss／獎勵修訂（2026-07-04）**：建立時固定 Boss；weak/normal/strong/boss 分層；每隻怪保證材料寶箱 ×2＋金幣寶箱 ×2；寶藏房逐張翻牌；最終報告含隊員、傷害與 MVP
- 後台測試工具（AdminDungeon：幫任何玩家設定/移除儲存槽地下城）
- **地下城地圖重製（2026-08-06，已上線，Trellis task `08-06-dungeon-map-rework`）**：地圖 5×5→7×7（40~46 格）；房間拆「重量房／輕量房」兩級——輕量房（quick_event／empty／coin_pouch／mini_chest／scout）踩到即結算、浮動訊息不跳全螢幕；重量房改配額制（第1層 13／第2層 14 間）；特殊事件改全員投票（平票時房主票 ×2）；陷阱押大小決策權收回房主；樓梯不再固定角落

**遊戲化（既有）**：
- 打怪（6 種族 6 難度，正常/組隊/決鬥/地下城/世界首領/賽事）
- 地下城地圖探索：SVG 地圖 + 10 種房型 + 投票移動 + 前後衛陣型 + 符文系統 + 合約系統
- 地下城經典模式：7 層隨機樓層，支援 8 人組隊
- 後衛機制（地下城 + 組隊）：可選治癒/攻擊，反擊只打前衛
- 怪物人數縮放 + 卡死預防機制 + 每人各自領獎
- 怪物卡片 100 張（5 星升級，最多裝備 5 張）
- 射手等級（200 級，5 種模式 XP）
- RPG 裝備（品質+強化）、成就系統、公會任務、議會廳
- 我的裝備頁顯示槽位完成度、實際 ATK／DEF／HP 總加成、單件公式與升級前後比較；神話裝備可強化至 +4

**貓系統**：9 隻貓角色、貓村（9 棟 20 級）、貓卡 100 張、轉蛋機、故事書
- 貓貓戰鬥技能（補血/增傷/防護），等級 200 + 裝備 5 格鍛造
- 九隻貓採「類型基底＋個體配點＋固有特性」：上排治癒、中排攻擊、下排防禦；同類三隻仍有不同成長倍率、技能威力與觸發率
- 貓貓獨立 HP 條、議會廳陪練、組隊虛擬夥伴

**後台**：記帳、通知、訊息、月卡申請/審核、圖鑑、版本更新提示

## 🚧 待辦

- [ ] **🔴 2026-07-04 交接三項（見 changelog.md 頂部「交接筆記」章節，有完整檔案/行號診斷，直接接手不用重查）**：
  ① ~~冒險者公會一般懸賞任務自動化~~ **已完成（2026-07-04，見下方「已實作」與 changelog）**
  ② 箭數里程碑跨模式重複觸發 bug（5檔案根因已查清：AdventurerGuild/CouncilBattle/DuelRoom/DailyQuest 都寫死`getMilestonesReached(0,...)`，MonsterBattle的`sessionArrowsRef`每場重置）
  ③ 首殺通知 bug（A:橫幅已讀狀態未持久化，純前端好修；B:新地下城系統首殺完全沒接上，需改用family+tier當key，設計已定案）
- [x] 地下城組隊失敗路由與全區廣播（2026-07-03 接手收尾）
- [ ] 使用兩個真實帳號完成組隊遠征 Firestore 多客戶端實測
- [ ] 藥水系統大改版——三層藥水架構 + 底部 tab 列 UI（see `potion-system-redesign.md`）
- [ ] UI 改版 Phase 4：後台套版、shared/Equipment.jsx 內層、戰鬥頁 token 收斂、最終刪 `.content-area` 覆寫層
- [ ] 音效/動畫批次 D：戰鬥層（受擊震屏、爆擊 hit-stop、怪物死亡溶解）
- [x] 地下城終戰模式（發掘→三層探險→Boss）— Trellis task `07-14-dungeon-expedition` — **全完成 2026-07-14**
- [x] 三大來源系統（定時生成 + 練箭挖掘 + 世界王卷軸）
- [x] 組隊遠征接 DungeonBattleRoom（正確路由）

## 🏗️ 戰鬥系統架構（2026-07-01 Phases 1-8）

### 共用模組（9 新檔）

```
src/lib/
  damage.js          ← 5 模式共用傷害公式（箭矢/反擊/貓貓/世界王）
  score.js           ← 集中計分邏輯（label↔value、SCORE_MAP、COLORS）

src/battle/
  BattleEvents.js    ← 22 個標準化 EventType + createXxxEvent builders
  BattleConfig.js    ← 戰鬥參數集中管理（箭數、距離、倍率、機率）
  BattleEngine.js    ← 單人戰鬥事件產生器（MonsterBattle pilot）
  BattleAnimation.js ← 19 個 playXxx + EVENT_DISPATCH 映射表
  useFirestoreRound.js ← Firestore 回合生命週期 hook（Party/Duel/Dungeon）
  RoundController.js ← 通用事件播放控制器（Monster/Council/WorldBoss）
  useBattleRound.js  ← React hook 封裝 RoundController
  useMiniRoundReveal.js ← mini-round 動畫 hook（Party/Dungeon）
  useDuelReveal.js   ← 決鬥逐箭揭露 hook（DuelRoom）
```

### 重構的 8 個元件

| 模式 | Phase | 重構目標 | 行數變化 |
|------|-------|---------|---------|
| MonsterBattle.jsx | 6 | 50 行 event loop → RoundController | −263 |
| PartyBattleRoom.jsx | 5, 7 | handleSubmit + host processing → useFirestoreRound；mini-round 動畫 → useMiniRoundReveal | +58 |
| DuelRoom.jsx | 5, 8 | subscribe + host processing → useFirestoreRound；12 步逐箭揭露 → useDuelReveal | +58 |
| DungeonBattleRoom.jsx | 5, 7 | 4 合 1 subscribe + host processing → useFirestoreRound；90 行 inline mini-round → useMiniRoundReveal | +94 |
| CouncilBattle.jsx | 6 | 內聯動畫/音效/log → RoundController | +138 |
| WorldBossAttack.jsx | 6 | 25 行 arrow loop → RoundController + customDelays 600ms | +12 |

### 架構原則

- **事件驅動**：標準化 EventType 22 種，EventType-driven dispatch
- **關注點分離**：傷害引擎 (damage.js) → 事件產生 (BattleEngine) → 動畫派遣 (BattleAnimation) → 回合控制 (RoundController/useFirestoreRound)
- **Firestore 回合抽象**：subscribe + submit + host process 三合一 hook，減少重複 30-50 行/元件
- **向後相容**：customDelays 等參數使用 options 物件，預設值不影響既有呼叫

---

## 🔧 2026-06-27 修正/改版

- **地下城事件**：補實裝 `def_mult_all`（守護結界）；reversal 合約 dmg 拼寫 bug 已修
- **商店購買記憶**：`shopPurchases` 不再在每次進出商店時重置；`hp_potion` 可重複購買
- **進場動畫 / 樓層**：地圖模式用 `mapCurrentRoomId` 作 key；`currentFloor` 從 `mapFloorIndex+1` 算
- **今日箭數同步**：`DailyQuest` 改用 `subscribeTodayPracticeLogs`（Firestore 側限日期）
- **成就通知**：改為個人通知（不再全頻廣播），deps 補全避免部分成就偵測失效
- **首頁改版**：公會等級 pill（adventurerXP）、三個收藏進度格、月卡移入等級卡、移除個人資訊列/年度檢定/最近成績
- **廣播訊息**：移除底圖，加 8 類分類篩選；type="achievement" 對應「成就」分類
- **怪物卡片**：改條列式，inline 顯示可升星、快速裝備按鈕；合約 HEX 補三色
- **地下城前後衛顯示**：改視角分排（單排顯示）；前衛死亡轉排時機修正（動畫後才移動）；`displayGroup` 欄位控制視覺分排；非房主卡住自動恢復；全員 ready 延遲 2 秒結算

## 🔧 2026-06-28 修正

- **復活藥/休息區復活**：修正 `handleResolve` 邏輯——改為掃描隊伍中所有 `alive && role==="rear"` 的成員來復活，不再錯誤檢查購買者本身的 role
- **商店 revival_front 條件**：只有隊伍中有前衛倒地（role=rear 的存活成員）時才能購買
- **休息區全員狀態卡**：頂部加橫排 HP 小卡，顯示所有隊員的 HP/role 狀態，便於討論投票選項
- **商店全員狀態卡**：同上，便於討論購買決策
- **商店購買限制修正**：移除 local `bought` state，改用 Firestore `shopPurchases` 作唯一購買記錄依據（避免換頁後 local state 重置而允許重複購買）
- **計分板折疊**：12 顆分數按鈕改為 7 顆折疊切換——Row A（X 10 9 8 7 6 M）/ Row B（6 5 4 3 2 1 M），節省螢幕空間
- **前衛觀察後衛**：輸入分數時，前衛新增小按鈕可切換角色卡視角至後衛排觀察狀況
- **關卡機制改版**：
  - `all_hit`（全中關）→「M懲罰關」：不再全部清零，改為每一發 M 扣除 10% 總傷害，最低歸零
  - `score_gate`（得分關）→ 比例懲罰：低於門檻的箭依距離降低該箭傷害（差1分-10%），且最高門檻 cap 至 9（不再要求 X/10）；score_gate 的分數按鈕去除 X 和 10
- **後台暗色主題**：`AdminReviewCenter`、`AdminMembers`、`AdminFinance` 共修正 16 處白底/淺色框（CertReviewCard、ExtReviewCard、MsgReplyCard、CertTaskCard 等）；QR code 白底保留（掃碼必需）

## ⚡ 2026-06-28 效能優化（vercel-react-best-practices）

- **Lazy Loading**（bundle-dynamic-imports）：MemberApp / AdminApp 共 50+ 元件改 `React.lazy`，主 bundle 676KB → **475KB（-30%）**
- **React.memo**（rerender-memo）：`MonsterSVG`、`BadgeSVG`、`SharedBattleComponents` 全員加 memo，戰鬥畫面 timer tick 不再重渲染純 SVG/HP bar
- **智能預載**（bundle-preload + js-request-idle-callback）：
  - `MemberApp` / `AdminApp` 登入後瀏覽器空閒時預下載最常用 chunk
  - nav 按鈕加 `onPointerEnter`，碰到就開始下載，切頁無 loading 感
  - Safari 無 `requestIdleCallback` 時 fallback 到 `setTimeout(cb, 1000)`

## ✨ 2026-06-28 View Transitions（vercel-react-view-transitions）

- **react@canary** 升級（19.3.0-canary）：`ViewTransition` 只在 canary 可用，用 `--legacy-peer-deps` 安裝
- **全分頁 cross-fade**：所有 `setPage()` 呼叫改透過 `startTransition()` 包裹（`useCallback` 封裝為新的 `setPage`）
- `MemberApp` 與 `AdminApp` 兩個 content-area 加 `<ViewTransition key={page} enter="fade-in" exit="fade-out" default="none">` 包裹 Suspense
- **底部導覽列隔離**：`member-nav` / `admin-nav` 加 `viewTransitionName`，切頁時導覽列不跟著動
- CSS recipes 加入 `src/index.css`：fade / slide-y keyframes、nav persistent isolation、reduced motion 支援

## 🔧 2026-06-28（續）地下城多人 Bug 修正

- **非房主拖出地圖**：`DungeonBattleRoom.handleClaimSelf` 改為：房主才呼叫 `returnToMapAfterBattle`，非房主設 `localClaimed=true` 顯示「等待房主」overlay，等 Firestore status 自然切換
- **隊員看不到房主選的怪物房**：`DungeonExplore.handleRoomClick` 選到怪物房時寫 `mapPendingRoom` 到 Firestore；非房主 subscribe 到後顯示唯讀預告 modal（「等待隊長決定是否出戰…」）；房主按出戰或撤退後清除 `mapPendingRoom`
- `dungeonDb.js` 新增 `proposeMapBattle(roomId, roomData)` / `clearMapPendingRoom(roomId)`

## ✅ 地下城終戰模式完成範圍

- 三大來源、三槽選單、單人／組隊三層遠征、結算獎勵、失敗廣播均已接線。
- 2026-07-03 接手收尾：等待室 transaction、固定房主、樓層 HP 延續、全員結果同步、固定獎勵與 `expeditionRecords` 規則已修。
- 尚待兩帳號實機驗證；在完成前不要把「build 通過」等同多人流程已驗證。
- [ ] 藥水系統大改版——三層藥水架構 + 底部 tab 列 UI（see `potion-system-redesign.md`）——原設計藥水應從遠征隊取得，煉金室仍維持箭露生產
- [x] CouncilBattle / WorldBossAttack 改用統一 `damage.js` 公式（Phase 8）
- [x] 透過 `RoundController` 重構 Party/Duel/Dungeon 戰鬥模式的 event playback
- [x] 透過 `useDuelReveal` 重構 DuelRoom 的逐箭揭露動畫

---

## 🏆 2026-08-01～02 比賽模式 / 對外賽事 / 戰鬥重整 / 深度分析

### 比賽模式（`?match`，實體比賽當天的計分系統）
- 靶紙王（不反擊、無限重生），**一場＝一顆文件 `raidMatches/{YYYY-MM-DD}`**
- 三箭一輪輸入、**逐箭寫入**（落點要一筆一筆留，箭序當冪等鍵）
- 場上其他人的分數即時可見；場外也看得到（`MatchLeaderboard`）
- 逐箭落點統計表（`shots` 子集合，點開才抓）、激勵詞句、隨機戰場背景
- 教練面板：獎勵設定／發放／重置／收榜／**場次日期切換**（2026-08-03 補）
- ⚠️ 獎勵**不即時發**，但即時顯示累積量——看不到累積量玩家不知道多射有什麼用

### 對外賽事歷史（`tournaments`）
- 教練可補登比賽年月日、名稱、選手、分數、最終名次（資格賽／對抗賽都能補）
- 可把當天的比賽成績一鍵匯入草稿

### 戰鬥重整（五種模式全接）
- `combatModifiers.js` + `monsterStatus.js`，7 種異常、族群綁定、玩家可見的告知
- 卡片天賦共池 key 拆開，「淬毒」變成真的施加中毒
- 後台戰鬥模擬沙盒（不用開真房間就能驗）
- 規格見 `game-systems.md` 的「🧪 異常狀態系統」

### 射手深度分析改版
- `archeryAnalytics.js` + `ArcheryAnalysis.jsx`：群組中心/離散、左右上下分開判讀、
  回合內衰退、距離分層、期間選擇器（相對期間／指定月份／指定單場）
- 讀取紀律比照排行榜：**自己點才載入最新**

### ⏳ 尚未驗證（不要當成完成）
- [ ] 世界王**組隊**線上同步：從沒兩台裝置實跑過
- [ ] 組隊／地下城權威端異常：只有單元測試，Firestore 讀寫層沒開過真房間
- [ ] 練習模式的設定與參數研究（作者 2026-07-31 交代，未開始）



## Email Campaign notification (2026-08-14)
- Status: local implementation complete; Functions and Firestore Rules deployment still required.
- Admin can preview eligible counts, create drafts, start/pause/resume campaigns, and view queued/sent/failed/opened/unsubscribed/suppressed totals.
- Consent is fail-closed: only marketingOptIn=true official/guest records are eligible; existing records are not auto-opted-in.
- Uses hourly scheduler, daily/hourly caps, deterministic queue/mail ids, max 3 delivery attempts, unsubscribe suppression and optional open analytics.

