# Implement — 地下城 2.5D 顯示層

## 前置
- 圖片可**平行進行**：使用者依 assets-spec.md 生 13 張圖（11 房 + room_empty + map_bg），去背→512 WebP→放 `public/assets/dungeon/`。
- 架構不等圖：全程有 fallback，先用 `room_empty` / SVG 佔位跑通。

## 執行順序（階段）
### P1 骨架元件（不動既有行為）
1. 在 DungeonStages.jsx 新增 `RoomTile`（img + onError fallback + 動態層 slot + zIndex=row）。
2. 新增 `MapViewport`（viewport/world/相機 transform，viewport 寬實測 ref，當前房置中）。
3. 加 keyframes（脈動框、玩家圖釘浮動）。

### P2 第 1-2 層 GridMapStage 接線
4. GridMapStage 改用 MapViewport + RoomTile；保留 fog / bridge / visited 推導，移除斜角 SVG 繪製。
5. 家族 overlay tint、迷霧、可移動框、✓、當前房高亮接上。
6. 橋 / 連接線（相鄰已探索）用 SVG/div 疊在 world 層。

### P3 第 3 層 BranchStage 接線
7. 建分支固定座標表（entrance / A,B,C×4 / boss / treasure）。
8. 三條並排渲染；null 時三條可點=onChoose；選定後未選變暗+禁點；branchStep 前進、鏡頭跟隨、無回頭。
9. boss/treasure 迷霧直到抵達；沿用 onEnterNext / onRetreat / 撤退確認 modal。

### P4 驗證與收尾
10. `npm run build` 通過、無新 lint error（注意 no-undef / 未用變數，清掉 Gemini 遺留 failedImages/handleImageError 若不用）。
11. 手機寬（375px）實測：不橫向爆版、鏡頭跟隨順、z-index 無穿插。
12. 教練切射手模式不空白；單人 + 組隊兩路徑都測。
13. 圖片缺失 fallback 不破版驗證。
14. 更新 docs/second_brain（quick-ref 路徑、changelog）。

## 驗證指令
```bash
npm run build
git status   # push 前確認無漏追蹤的新檔（見 memory debug_untracked_dep_ci_fail）
```

## 風險檔案 / 回滾點
- 只動 `src/components/dungeon/DungeonStages.jsx`（render 層）。
- 回滾：git 還原 DungeonStages.jsx 即回到現況。
- 勿動 expeditionGrid.js（資料生成）、DungeonExpedition/TeamExpeditionBattle 的移動邏輯。

## 前置檢查（task.py start 前）
- [ ] 使用者已過目 prd/design/implement。
- [ ] 至少 room_empty.webp 就緒（或確認 SVG 佔位足夠先跑）。
