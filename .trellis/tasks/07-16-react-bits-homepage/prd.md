# 學員與訪客端低風險動畫整合

## Goal

在不影響手機效能、資料可讀性、無障礙或核心操作的前提下，選擇性導入 React Bits 類元件，提升學員、訪客與地下城非戰鬥事件介面的一致性、層級感與狀態回饋。

## Confirmed facts

- 根目錄 App 使用 React 19 canary、JavaScript、Create React App (`react-scripts` 5.0.1) 與 Tailwind CSS 4。
- 未安裝 Motion、Framer Motion 或 GSAP；現有動畫以 CSS、`requestAnimationFrame` 與少量 canvas 為主。
- `MemberApp` 已使用 route-level lazy loading，並在共用 `Widgets.jsx` 提供可清理 RAF 的 `CountUp`。
- 學員端主要入口為 `MemberHome` 以及 training/adventure/inventory/records 等 Hub。
- 登入後的訪客體驗由 `GuestApp` 提供，包含 guest/kid 模式、首頁活動卡、練箭、射手表現與冒險入口。
- `PublicBookingApp` 是另一個公開預約流程；是否納入「訪客端」仍待使用者確認。
- 地下城非戰鬥房採共用 confirm → resolve 契約，`DungeonEvent`、`DungeonTrap`、`DungeonRest`、`DungeonChest` 同時由單人與組隊遠征重用；視覺改造不能改變確認、投票、host resolve 或 persisted reward 行為。
- 地下城事件介面目前分散使用 inline styles 與各自動畫，缺少共用舞台、房間層級與一致的揭示語言；使用者明確要求納入改善。
- 系統已有即時戰鬥、轉蛋、LootBox、成就與彩帶動畫；即時戰鬥與既有慶祝層不應再疊加 React Bits。地下城寶箱／寶藏室可整理既有動畫，但不得重抽或改變獎勵。
- 正式官網 `website/` 已由使用者取消本次動畫整合，完全排除。
- 教練後台 `AdminApp` 明確排除。
- `MemberPerformance`／射手表現目前由 Claude 並行修改；在對方完成與變更整合前，本任務不編輯、不格式化該區域。

## Requirements

- 實際使用的參考元件統一放在 `src/components/react-bits/`，不複製 repository、不安裝整包依賴。
- 優先採用 SpotlightCard 與 FadeContent 類型；BlurText 僅限登入／首次品牌標題，且不可延遲表單或 CTA。
- CountUp 必須沿用或抽取現有 `Widgets.jsx` 實作，不建立重複版本。
- Spotlight 只用於入口卡、選取卡或少量重點卡，不套用長列表全部項目。
- FadeContent 以頁面或卡片群組為單位，避免逐字、逐列動畫。
- 觸控裝置資訊不可依賴 hover，動畫不得擋住按鈕或改變點擊區域。
- `prefers-reduced-motion: reduce` 時停用或顯著簡化。
- 所有 listener、RAF、timer、observer 在 unmount 時清理。
- 不修改 Firestore、登入、權限、學籍、戰鬥、預約或結算商業邏輯。
- 地下城美術方向為「兒童友善的史詩冒險」：可以帥氣、有尺度感與震撼揭示，但不得使用血腥、肢解、寫實傷口、骷髏恐怖意象、陰森人臉、jump scare 或強烈壓迫感。
- 陷阱與失敗以機關、煙霧、符文、護盾碎光、貓咪探險反應等方式呈現，不以受傷恐怖畫面製造張力。
- 進入地下城前顯示音效與震動設定，兩者第一次使用預設開啟，使用者之後可自行關閉且選擇需持久化。
- 音效與震動為兩個獨立開關；靜音不得連帶停用震動，關閉震動也不得影響音效。
- 音效必須遵守瀏覽器 user gesture 限制，不得在尚未互動時嘗試自動播放；震動只在支援 Vibration API 的裝置生效。
- 修正單人與組隊斷線重連後 `arrowsPerRound`、`targetFmt` 及同一組 run settings 被 fallback 預設值覆蓋的問題。
- run settings 在開始後鎖定，重連只能恢復既有值，不能重新選擇或重新正規化成不同設定。

## Recommended rollout

1. Foundation：共用 SpotlightCard、FadeContent、reduced-motion hook／CSS contract。
2. Member entry surfaces：MemberHome 與四個 Hub 的主要入口卡。
3. Guest entry surfaces：GuestApp 登入品牌區、首頁活動卡、真實數據顯示。
4. Data and collection surfaces：Achievements、Dex、Profile、Leaderboard、選中裝備／稀有收藏卡；MemberPerformance 等待並行工作完成後另行評估。
5. Dungeon event surfaces：建立共用事件舞台，套用到 Event、Trap、Rest、Chest、TreasureRoom、PathSelect 與 Explore 的事件預覽；排除即時戰鬥輸入。
6. Final audit：手機、鍵盤、低動態模式、bundle、單人／組隊同步與既有動畫衝突。

## Acceptance criteria

- [ ] 學員與訪客入口的層級更清楚，但不改變資訊架構或操作路徑。
- [ ] 360px、390px、430px 下無裁切、卡頓、誤觸或 CTA 遮擋。
- [ ] 返回常用頁面時不反覆播放干擾性的標題動畫。
- [ ] reduced motion 下只保留必要狀態變化。
- [ ] 沒有新增大型 animation dependency，並回報資源增量。
- [ ] 現有 CountUp 不重複實作，真實動態數據才使用數字動畫。
- [ ] 即時戰鬥輸入、轉蛋、LootBox 與既有全畫面慶祝層沒有疊加新視覺效果。
- [ ] 地下城非戰鬥事件視覺一致且更有質感，confirm → resolve、host authority、投票與獎勵資料契約完全不變。
- [ ] 地下城在兒童使用情境下不含驚嚇或恐怖元素，同時仍具備清楚的房間尺度、光影與事件揭示張力。
- [ ] 地下城寶箱與寶藏室只改展示，不重抽、不提前 grant、不改 resultClaims。
- [ ] 進入地下城前可看到並變更音效／震動設定，預設開啟，重整與重連後仍保留使用者選擇。
- [ ] 單人地下城以 3 或 6 箭及任一合法靶紙開始後，斷線／重整／返回重連仍使用完全相同設定。
- [ ] 組隊地下城由房主持久化設定後，房主與隊員斷線重連、跨層建立新戰鬥房時都沿用相同設定。
- [ ] 舊資料缺少新欄位時才使用安全預設值；已存在的合法值不得被 `||` 或重新初始化覆蓋。
- [ ] 教練後台與正式官網零修改。
- [ ] lint/build/test 及關鍵學員／訪客導覽流程通過。

## Expanded visual redesign (2026-07-16)

- 地下城非戰鬥流程全面納入：大廳、挖掘探索、進入地下城、圖鑑、路線與事件房；戰鬥和最終結算畫面排除。
- 地下城頁面必須以實際場景、入口、挖掘工具、地圖與收藏品插畫建立辨識度，不得只用抽象水晶／玻璃卡片換色。
- 練箭 Hub 與背包 Hub 的入口卡改用對應功能圖片，讓使用者由圖像理解功能；保留原有導覽目標、權限、badge 與 disabled 狀態。
- 圖片需採可重用資產組、響應式裁切與壓縮格式，避免為每筆動態資料建立大型圖片。
- 手機首屏維持清楚文字、足夠對比和可點擊區，不讓圖片遮蔽 CTA 或狀態資訊。

## Out of scope

- `website/` 正式官網。
- `AdminApp` 教練後台。
- 大型 Three.js/WebGL、游標特效與全畫面持續 GPU 動畫。
- Firestore、Firebase、權限、學籍、地下城狀態機、獎勵與預約商業邏輯。

## Open question

- 「訪客端」是否只指登入後的 `GuestApp`（含 guest/kid），或也包含公開預約流程 `PublicBookingApp`。
- 射手表現相關頁是否完全移出本次動畫整合，或待 Claude 完成後另行做相容性整合。
