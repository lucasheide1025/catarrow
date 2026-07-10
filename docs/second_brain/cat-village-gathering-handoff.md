# 貓貓村採集任務重製交接筆記
> 日期：2026-07-10  
> 狀態：功能已完成、`npm run build` 已通過、尚未 commit / push / deploy。使用者決定晚點交給 Claude 佈署。

---

## 本次完成範圍

### 1. 玩家說明書更新
- `src/components/member/MemberGuide.jsx`
  - 已補完整專案使用說明書。
  - 包含裝備升級、打怪、地下城、組隊、材料、藥水、七大種族、掉寶、貓貓陪練、貓貓村、轉蛋、成就等章節。
  - 新增「貓村採集委託」章節，說明新版採集規則、六大採集點、回合制、協力採集、村目標。
- `src/components/member/MemberHome.jsx`
  - 首頁快捷入口新增「說明書」按鈕。

### 2. 採集任務從戰鬥型改成射箭委託型
- `src/lib/catVillageGathering.js`
  - 新增六大採集點資料：
    - 星屑礦坑：山岳族材料 + 礦石
    - 月芽農田：昆蟲族材料 + 甜瓜
    - 霧潮港口：幽靈族材料 + 魚
    - 巡林狩獵場：職場族材料 + 肉
    - 喧鬧市集：考試族材料 + 小魚乾
    - 古罐倉庫：神廟族材料 + 罐頭
  - 採集流程為 3 回合，每回合 6 箭，共 18 箭。
  - 分數會轉成採集進度，100% 可完成，130% / 180% 有額外完成度倍率。
  - 獎勵定位：大量貓貓經驗與羈絆、少量怪物材料、少量貓貓村資源、低機率稀有物。
  - 不給金幣、不給寶箱、不給射手經驗，避免搶單人打怪與地下城效率。

### 3. 採集 UI 全新設計
- `src/components/member/GatheringRun.jsx`
  - 全新採集畫面，不沿用打怪 UI。
  - 玩家先選採集點與 Tier，再逐回合輸入箭分。
  - 顯示進度條、里程碑、每回合箭序、結算獎勵。
- `src/components/member/CouncilHall.jsx`
  - 議會廳委託板改成新版採集入口。
  - 單人採集與協力採集分流。
  - 探險隊原有分頁保留。

### 4. 建築等級解鎖採集 Tier
- 採集可選 Tier 依目前貓貓村對應建築等級開放。
- 使用 `getBuildingStage(buildingLevel)` 推算：
  - Stage 1 → T1
  - Stage 2 → T1~T2
  - Stage 3 → T1~T3
  - Stage 4 → T1~T4
  - Stage 5 → T1~T5
- T6 保留為特殊高階內容，不直接由普通建築等級開放。

### 5. 協力採集任務
- `src/lib/gatheringPartyDb.js`
  - 新增協力採集房間 API，使用既有 `partyRooms` collection。
  - 房間類型為 `type: "gathering"`。
  - 最大人數已依使用者要求改為 8 人。
- `src/components/member/GatheringPartyPanel.jsx`
  - 可建立房間、加入邀請碼、等待成員、房主開始、各自完成採集。
  - UI 顯示成員提交狀態與隊伍總進度。
- 獎勵加成已刻意偏小：
  - 2 人：材料 x1.05、貓 XP x1.10
  - 3 人：材料 x1.08、貓 XP x1.15
  - 4 人以上：材料 x1.10、貓 XP x1.20、羈絆 +1
  - 雖然房間最多 8 人，但獎勵倍率只封頂到 4 人，避免效率膨脹。

### 6. 箭數累積注意事項
- 使用者特別提醒「採集任務跟組隊採集任務要注意箭數累積」。
- `src/lib/db.js::completeCouncilSession`
  - 新版 `contractVersion >= 2` 結算時，使用 `totalArrows` 寫入箭數。
  - 實際採集每人最多只計 18 箭：
    - `arrowCount = Math.min(18, totalArrows)`
  - 協力採集不會因為 `partySize` 把箭數乘上隊伍人數。
  - 每位玩家只累積自己射的 18 箭。

### 7. 村目標串接新版採集
- `src/lib/villageGoalData.js`
  - 新增村目標類型：
    - `gathering_progress`
    - `gathering_participants`
    - `gathering_material`
    - `gathering_resource`
  - 新增採集指定材料 / 指定村資源目標池。
- `src/lib/villageGoalDb.js`
  - 新增 `contributeGatheringToGoal(memberId, payload)`。
  - 可依目標類型累積：
    - 採集進度
    - 參與人次
    - 指定怪物材料
    - 指定貓村物資
- `src/components/member/VillageGoalBanner.jsx`
  - 村目標 banner 已可顯示採集類目標描述。

### 8. 結算寫入
- `src/lib/db.js::completeCouncilSession`
  - 新增 `contractVersion >= 2` 結算分支。
  - 會發放：
    - 怪物材料
    - 貓貓村資源
    - 稀有掉落
    - 貓貓 XP
    - 貓貓羈絆
    - 採集箭數
    - 村目標貢獻
  - 舊版議會廳任務結算邏輯仍保留。

---

## 稀有物定義

新版採集的「稀有物」目前主要是：
- 少量轉蛋幣，封頂避免破壞經濟。
- 額外貓貓村資源。
- 額外怪物材料。

設計定位：
- 採集不是打寶主線。
- 單人打怪仍是怪物材料與一般掉寶主線。
- 地下城仍是大量寶箱、金幣、進階素材與高價值獎勵主線。
- 採集主打「貓貓養成」與「村目標協作」。

---

## 已驗證

- `npm run build` 已通過。
- CRA 大包警告仍存在，屬既有狀況。
- Node `fs.F_OK` deprecation warning 仍存在，屬既有狀況。

---

## 尚未完成

- 尚未 commit。
- 尚未 push。
- 尚未 Vercel production deploy。
- 尚未用多人真實帳號完整測協力採集 Firestore 流程。
- 使用者表示晚點會讓 Claude 佈署。

---

## 部署交接給 Claude

### 現況
- 本機 Vercel CLI 有登入狀態問題。
- 直接執行 production deploy 時曾失敗：
  - `No refresh token found`
  - `Error refreshing token`
  - `The value of "err" is out of range. It must be a negative integer. Received 1`
- `.vercel/project.json` 已連到 Vercel 專案：
  - projectName: `catarrow`
  - projectId: `prj_taeswoUqHMumiFojHlddONAfZw7l`
  - orgId: `team_VxcUmCVcdSYWAssMj1QUbEfg`
- git remote:
  - `https://github.com/lucasheide1025/catarrow.git`
- branch:
  - `main`

### 建議部署方式
因為 Vercel CLI 本機 token 壞掉，建議 Claude 用 GitHub 觸發 Vercel 部署：

1. 先確認使用者同意 push `main`。
2. 只 stage 本次採集相關檔案，不要 stage `website/` 或圖片異動。
3. commit。
4. push `origin main`。
5. 讓 Vercel 從 GitHub main 自動部署 production。

### 只應 stage 的檔案
```txt
src/components/member/CouncilHall.jsx
src/components/member/MemberGuide.jsx
src/components/member/MemberHome.jsx
src/components/member/VillageGoalBanner.jsx
src/components/member/GatheringPartyPanel.jsx
src/components/member/GatheringRun.jsx
src/lib/db.js
src/lib/villageGoalData.js
src/lib/villageGoalDb.js
src/lib/catVillageGathering.js
src/lib/gatheringPartyDb.js
```

### 不要誤 stage 的既有髒檔
目前工作樹還有一批與本次 App 功能無關的官網 / 圖片異動，Claude 部署前不要一起 commit：

```txt
website/index.html
website/assets/images/archery/real/**
public/images/archery/**
.claude/settings.local.json
```

---

## 接手測試建議

部署前至少手動跑：

```bash
npm run build
```

部署後建議用兩個會員帳號測：
- 單人採集一輪，確認只加 18 箭。
- 協力採集 2 人一輪，確認每人各自只加自己的 18 箭。
- 協力房間最多 8 人顯示正確。
- 房主開始後，非房主可完成並送出。
- 村目標若為採集類型，進度會被推進。
- 採集不會給金幣、寶箱、射手 XP。
- 貓貓 XP / 羈絆會增加。
