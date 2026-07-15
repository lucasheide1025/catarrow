# 射手表現系統重設：討論稿

## 背景與目標

本系統本質上是射箭訓練系統；遊戲化功能應服務於真實射箭訓練，而不是取代訓練表現。

目前已有大量射擊資料，但資料被分散在練習、戰鬥、競賽、檢定、每日箭數與遊戲進度中。我們希望重新設計成一個能讓射手清楚看見自身技術進步、穩定度與訓練方向的「射手表現系統」。

本文件是提供討論與設計用，不是既定實作規格。

## 現有資料與功能盤點

| 類別 | 目前功能 | 主要資料落點 | 有逐箭／回合資料？ |
| --- | --- | --- | --- |
| 正式自主練習 | 自訂練習、70m／50m資格、室內、局制、計時 | `practiceLogs` | 有，最完整 |
| 打怪 | 單人魔物戰鬥，勝敗均可紀錄 | `practiceLogs`、`monsterLogs` | 有 |
| 組隊戰鬥 | 組隊怪物戰，勝敗均可紀錄 | `practiceLogs` | 有 |
| 地下城 | 地城戰鬥，勝敗均可紀錄 | `practiceLogs` | 有 |
| 世界王 | 世界王多回合射擊 | `practiceLogs`、世界王參戰資料 | 有 |
| 決鬥 | 玩家對玩家戰鬥 | `practiceLogs` | 有 |
| 議會／每日／公會任務 | 任務型射擊 | `practiceLogs` | 多數有，但格式較簡化 |
| 射手證任務 | 藍／金證兩項任務 | `practiceLogs`、`certifications` | 部分 |
| 正式賽事／年度檢定 | 報名、送成績、審核、排名 | `results`、`certRecords` | 有，但與練習分離 |
| 箭數里程碑／村莊目標／發掘 | 今日、終身與活動累積箭數 | `totalArrowsAllTime`、`practiceLogs`、發掘進度 | 僅數量 |

## 已確認的資料設計問題

1. `MemberPractice` 的趨勢、距離與目標分析主要只讀取沒有 `source` 的自主練習紀錄。打怪、地城、組隊、世界王等有真實分數的射擊，幾乎沒有進入射手表現分析。

2. `practiceLogs` 同時承載自主練習、戰鬥、每日任務、射手證與世界王。不同來源欄位不一致：部分使用 `rounds`，部分只有 `scores`；部分有距離、靶面、弓種、箭位，部分沒有。

3. 正式賽事與年度檢定位於 `results` 與 `certRecords`，沒有整合到個人表現趨勢；但它們應是可信度最高的正式成績。

4. 終身箭數主要由 `addRoundArrows()` 即時累加；部分自主練習主要寫入 `practiceLogs`，不一定同步進終身箭數。今日 Header 又直接加總所有當日 `practiceLogs`，存在統計口徑不同的風險。

5. `addPracticeLog()` 以 `type` 判斷 XP 來源，但多數呼叫端使用 `source`。不同射擊來源的 XP 規則因此沒有真正依來源正確套用。

6. 遊戲傷害、角色能力與射箭成績混在同一條體驗中。這對遊戲有趣，但容易讓真實訓練指標被怪物、裝備、技能或模式規則干擾。

## 建議的核心模型

所有射擊都先轉為一筆標準化的 `shootingSession`。遊戲功能、成就、獎勵與戰鬥結果改為附屬資料，而不是射手表現的主資料。

```text
每次射擊 Session
 ├─ 訓練設定：弓種、距離、靶面、箭數、回合、計時
 ├─ 原始箭資料：每箭分數、X/M、座標、輸入方式
 ├─ 表現指標：平均、命中率、X率、散布、穩定度、趨勢
 ├─ 情境標籤：自由練習／課程／賽事／檢定／遊戲戰鬥
 ├─ 驗證等級：自行記錄／教練確認／正式賽事
 └─ 遊戲結果：傷害、掉落、XP、任務進度
```

### 建議的最小欄位

```ts
type ShootingSession = {
  id: string;
  memberId: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;

  context: "practice" | "lesson" | "competition" | "certification" | "game";
  verification: "self" | "coach" | "official";

  bowType: string;
  distanceM: number;
  targetFace: string;
  arrowsPerEnd: number;
  plannedEnds?: number;
  timingMode?: "off" | "wa30" | "wa40";

  ends: Array<{
    arrows: Array<{
      score: number;
      label: string;
      x?: number;
      y?: number;
      inputMode?: "target" | "button";
    }>;
  }>;

  metrics: {
    total: number;
    arrowCount: number;
    averageArrow: number;
    xCount: number;
    missCount: number;
    hitRate: number;
    endAverage?: number;
    endStdDev?: number;
    groupingRadius?: number;
  };

  game?: {
    mode: string;
    result?: "win" | "lose";
    damage?: number;
  };
};
```

## 射手檔案應優先呈現的內容

1. **距離 × 靶面 × 弓種的近期平均與個人最佳**
2. **30／60／90 箭的滾動平均**，避免一次成績過度影響判斷
3. **X 率、M 率、命中率、每回合波動**
4. **散布／箭群趨勢**：僅在有靶面座標資料時啟用
5. **正式成績獨立呈現**：教練確認與正式賽事不應混入一般練習，但可對照
6. **訓練建議**：例如「18m 三連靶近 90 箭平均上升，但第 5 回後波動增大」
7. **遊戲射擊另標示為情境射擊**：可記錄與鼓勵，不應污染正式訓練曲線

## 初步資料分層建議

| 分層 | 包含內容 | 是否納入正式成長曲線 |
| --- | --- | --- |
| 正式 | 賽事、年度檢定、教練確認的課程紀錄 | 是，最高權重 |
| 訓練 | 自主練習、指定練習計畫 | 是 |
| 情境 | 打怪、地城、組隊、世界王、決鬥 | 可選；預設獨立顯示 |
| 活動 | 每日任務、議會、公會任務 | 以箭數與任務完成為主，不宜主導技術曲線 |

## 需要討論並定案的問題

1. 遊戲戰鬥中的真實射擊分數，是否可納入訓練曲線？若可以，應以什麼權重或標記納入？
2. 哪些資料必須具備，才算是一筆可分析的射箭 Session？距離、靶面、弓種是否都必填？
3. 正式賽事與檢定應如何影響射手等級、認證、推薦訓練與排行榜？
4. 應優先使用平均分、箭群散布、X/M 率、回合穩定度中的哪些指標？
5. 對兒童／新手，是否提供更簡化的表現頁面，避免過多統計資訊造成壓力？
6. 舊 `practiceLogs`、`results`、`certRecords` 是否需要回填成標準化 `shootingSession`？若要，哪些可安全回填、哪些僅保留舊格式？
7. 箭數里程碑應只計「真實射出箭數」，還是所有遊戲輸入都計？如何避免重複計數？
8. 射手等級應主要依據：累積箭數、穩定表現、教練認證、正式賽事，或採混合模型？

## 建議的推進順序

1. 定義並鎖定標準化 `shootingSession` schema。
2. 讓所有新射擊流程同時寫入該 schema；保留舊資料不破壞既有功能。
3. 先建置新的射手表現頁：近期平均、距離分組、正式成績、情境射擊分流。
4. 統一箭數計數來源，避免 `practiceLogs` 與 `totalArrowsAllTime` 產生不同答案。
5. 修正 `source`／`type` 不一致的 XP 歸因。
6. 最後才決定是否回填歷史資料，以及如何讓遊戲獎勵引用新的 Session。

## 討論請求

請協助我們把上述方向整理成可落地的產品與資料設計，特別是：

- 如何在「射箭訓練」與「遊戲化動機」間建立正確的資料邊界？
- 建議哪些射箭技術指標應優先顯示，才能對教練與學生真正有幫助？
- `shootingSession` schema 還缺少哪些日後會需要的欄位？
- 如何規畫舊資料遷移與新舊系統並行，才能不破壞現有功能？
