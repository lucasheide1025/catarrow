# Design: 貓村九冊卡片成長系統

## Domain Model

- `CAT_CARDS[].villageAlbum`：穩定的九冊歸屬 ID。
- `member.catCardStars`：`{ [cardId]: 1..5 }`，與既有數字型 `catCards` 分離以維持市場相容。
- `member.villageCardAlbums`：
  - `version`: 補算版本。
  - `xp`: `{ [buildingId]: integer }`，永久累積。
- 卡冊等級與倍率皆由 EXP 純函數衍生，不儲存重複的 level/bonus。

## Curve

`threshold(level) = round(1110 * ((level - 1) / 19) ^ 2)`，level 範圍 1..20。

`bonus(level) = (level - 1) * 0.0025`，因此 Lv.1 為 0%、Lv.20 為 4.75%。為符合產品定義「Lv.20 共 5%」，實作採 `level * 0.0025`，包含 Lv.1 的首級 0.25%；未建立/零 EXP 則視為 Lv.0、0%。達第一門檻後自動成為 Lv.1。

曲線實作需用明確的 Lv.1 門檻，避免 0 EXP 自帶加成。建議以等級 0..20 建模：

`threshold(level) = round(1110 * (level / 20) ^ 2)`，Lv.1 約 3 EXP，Lv.20 = 1110 EXP。

## Atomic Write Boundary

- `drawGachaCards()` 在同一次 member 更新內：
  - 扣扭蛋幣；
  - 增加 `catCards.<id>`；
  - 增加 `villageCardAlbums.xp.<albumId>`。
- 十連保底目前在 UI 取得伺服器結果後替換最後一張，會造成已寫入資料與畫面不一致；本功能需將保底選擇移到資料層，再一次原子寫入最終結果。
- 市場購買/交換取得卡片時增加買方對應卡冊 EXP；賣方扣卡不倒扣。
- 取消掛賣只是返還已擁有卡，不算新取得、不增加 EXP。

## Migration

- 讀取 member 時若 `villageCardAlbums.version` 缺失，由一個具交易/原子保護的資料層入口依當下 `catCards` 計算初始 EXP。
- 設定版本與 XP 必須在同一寫入完成。
- 多個頁籤同時觸發時，只有第一個版本遷移生效。

## Production Formula

- `getVillageAlbumMultiplier(albumXp, buildingId)` 回傳 `1 + albumLevel * 0.0025`。
- `calcPendingResources` 與 `collectVillageResources` 對每棟建築使用同一函數及同一份 XP。
- 不再使用單一全村 `CATDEX_PRODUCTION_MULT` 常數作為實際卡冊加成。

## UI Architecture

- `GachaMachine` 主頁籤：扭蛋／村莊九冊／全卡圖鑑。
- `VillageAlbumOverview`：九冊卡片格，手機兩欄。
- `VillageAlbumDetail`：標題、Lv/EXP/加成摘要及冊內卡片網格。
- `CatCardTile`：圖鑑與卡冊共用，負責圖片、鎖定、持有數與星級。
- `CatCardDetailSheet`：放大卡圖與升星操作。
- 抽卡結果資料包含 `albumId`, `albumXpGain`, `albumBefore`, `albumAfter`，UI 合併同冊結果。

## Compatibility and Security

- 保留 `catCards` 數字格式，避免破壞卡市集、排行榜與既有 UI。
- 升星必須由資料層交易驗證實際持有數，不能只相信前端。
- Firestore rules 若限制 member 可修改欄位，需同步允許新欄位並防止負數/越界；伺服器驗證能力有限時至少確保交易入口與既有規則不衝突。

