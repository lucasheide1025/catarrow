# Implement：鬼怪族 T1 GPT 立繪重製

## Phase 0：3×3 Tier／Encounter 校準（規格重置）

- [x] 生成 T1 普通／小王／大王三張獨立測試怪。
- [x] 生成 T3 普通／小王／大王三張獨立測試怪。
- [x] 生成 T6 普通／小王／大王三張獨立測試怪。
- [x] 保存九張 staging、prompt 與 hash metadata。
- [x] 依固定 row/column 建立 3×3 聯絡表。
- [x] 使用者確認橫向 encounter hierarchy 與縱向 tier progression 同時清楚。
- [x] 校準規則回寫跨種族美術規格後，才重啟正式角色生成。

## Phase A：三種普通角色卡圖樣板

- [x] 整理暮燈旅者、鏡幕幽姬、星霧絨獸三份最終 prompt 與參考圖角色。
- [x] 使用 built-in image generator 分別生成三張卡片圖。
- [x] 將候選圖複製到 `.staging/image-generation/gpt-ghost-t1/cards/`，保存 prompt、來源與 hash metadata。
- [x] 檢查 3:4 構圖、角色身份、T1 華麗度、文字/UI 污染與系列一致性。
- [x] 建立三張聯絡表供使用者核准；未核准不得繼續領袖或覆寫正式素材。

> 上述 Phase A～C 勾選項屬於校準前的已否決 v1，不得作為正式整合依據。

## Phase A2：依雙軸規格重做正式 T1 卡圖

- [x] 生成三隻普通怪：暮燈旅者、鏡幕幽姬、星霧絨獸。
- [x] 生成兩隻小王：蒼焰巡獵者、霧紗影舞者。
- [x] 生成一隻大王：星環冥鹿。
- [x] 保存六張 staging、prompt、來源、尺寸與 SHA-256 manifest。
- [x] 通過 GPT staging manifest validator。
- [x] 建立六張聯絡表並確認普通／小王／大王構圖階級清楚。
- [x] 取得使用者對六張正式卡圖的核准。
- [x] 核准後才以每張卡圖作 identity reference 生成戰鬥立繪。
- [x] 六張戰鬥圖完成色鍵去背與 alpha 檢查。
- [x] 建立新版六張戰鬥聯絡表。
- [x] 使用者否決寫實比例 v1，改採 3.5～4 頭身半 Q 規格。
- [x] 依核准卡圖重生六張半 Q v2 並完成去背。
- [x] 建立半 Q v2 六張戰鬥聯絡表。
- [ ] 取得使用者對六張半 Q v2 戰鬥立繪的核准。

## Phase B：三位領袖卡圖

- [x] 依核准的男／女／獸 T1 樣板生成蒼焰巡獵者、霧紗影舞者、星環冥鹿。
- [x] 保存 staging 與 metadata，建立六張完整卡圖聯絡表。
- [x] 取得使用者核准。

## Phase C：六張戰鬥立繪

- [x] 逐角色載入核准卡圖作 identity reference。
- [x] 生成純色 chroma-key 戰鬥版，維持身份與 4.5～5 頭身／獸型輪廓規則。
- [x] 使用 imagegen chroma-key helper 去背並驗證透明角落、色鍵殘邊、裁切與 200px 辨識度。
- [ ] 建立六張戰鬥圖聯絡表並取得使用者核准。

## Phase D：正式整合

- [ ] 新增可重現的 T1 圖片整合／驗證腳本。
- [ ] 卡圖輸出 3:4 WebP；戰鬥圖輸出 512×512 transparent WebP。
- [ ] 覆寫僅限六個 T1 stable card/battle paths。
- [ ] 驗證未取得灰階卡與已取得彩色卡。
- [ ] 執行 card-focused tests、圖片 metadata checks 與 `npm run build`。
- [ ] 啟動本機頁面供最終驗收；不部署。

## Review Gates

- Gate 1：三張普通卡圖核准。
- Gate 2：六張卡圖整組核准。
- Gate 3：六張戰鬥圖整組核准。
- Gate 4：網站實機核准。

任一 Gate 未通過時只回到該階段調整，不得提前寫入下一階段或正式路徑。
