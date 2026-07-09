# Implement：官網視覺互動改版

依「打磨品質優先於數量」的原則排序，若時間有限，優先做 P0，P2 可以之後再補。每做完幾個 section 就開瀏覽器實際看一次，不要全部寫完才第一次看效果。

## Step 0 — 準備
- [ ] 讀過 `website/index.html` 目前 hero/why/bows/price/training/group/facility/reviews/faq/booking/visit/final 各 section 的實際 DOM/CSS，確認 design.md 的構想跟現況對得上，對不上的地方以現況為準調整做法
- [ ] 確認 `docs/second_brain/features.md`／`game-systems.md` 目前 App 實際存在的系統清單，供 `#group` 補卡片文案使用（不要寫還沒做的功能）

## Step 1 — P0：`#training` 與 `#group`（R2，本次核心目標）
- [ ] `#training` 手機 mockup 改成可切換的 2-3 張畫面預覽（分頁指示器 + fade/slide 切換）
- [ ] `.badges` 勳章列表加上 scroll-triggered 依序解鎖動畫
- [ ] `#group` 模式卡片補 1-2 張新卡片（優先「地下城遠征」），文案比照現有模式卡片的語氣
- [ ] `#group` 模式卡片 hover 加輕量圖示動態效果
- [ ] 手動確認：桌機＋手機都測一次，`prefers-reduced-motion` 模擬一次

## Step 2 — P1：`#hero` / `#why` / `#price`
- [ ] `#hero` `.rings`/`.target` 加輕微滑鼠視差與命中閃光
- [ ] `#why` 卡片加爪痕刮過的 SVG 描邊 hover 效果
- [ ] `#price` 數字改成 scroll-triggered 計數動畫 + 命中回彈微動效
- [ ] 手動確認一次

## Step 3 — P2：其餘 section（視時間決定要不要做）
- [ ] `#bows` hover/tap 箭矢微幅擺動
- [ ] `#facility` 若有照片輪播，加 Ken Burns 緩慢縮放
- [ ] `#reviews` 跑馬燈 hover 暫停
- [ ] `#faq` 展開時的箭矢畫過底線動畫
- [ ] 明確不做：`#booking`/`#visit`/`#final` 額外視覺效果（design.md 已說明原因，維持現狀）

## 收尾
- [ ] 全站再跑一次桌機＋手機手動測試
- [ ] Lighthouse（或類似工具）粗略跑一次效能分數，確認沒有明顯劣化
- [ ] `docs/second_brain/features.md` 更新官網那條記錄
- [ ] 同步複製到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`
- [ ] git commit（只涉及 `website/` 目錄）→ push

## Rollback
`website/` 是獨立靜態站，跟 App 完全無程式碼耦合，若上線後發現效果有問題，直接回退對應 commit 即可，不影響 App 任何功能。
