# Technical design

## Component foundation

- `SpotlightCard.jsx`：局部 pointer spotlight，使用 CSS variables；只在 fine pointer 啟用追蹤，touch 顯示穩定靜態邊光。
- `FadeContent.jsx`：以 mount／首次可見為單位的小幅 opacity + translate 動畫，內容初始仍存在；支援 once 與 reduced motion。
- BlurText 類效果：若採用，只放 GuestApp／LoginPage 的品牌 H1，保留完整文字 DOM，最多一次且不阻塞表單。
- CountUp：沿用 `src/components/shared/Widgets.jsx`，必要時只補 reduced-motion 支援與共用格式化能力。

## Placement boundaries

- 學員端：MemberHome 主入口、Training/Adventure/Inventory/Records Hub；數據效果延伸至 Profile/Achievements/Dex/Leaderboard。MemberPerformance 在並行修改完成前排除。
- 訪客端：GuestApp 登入品牌區、首頁 hero、活動入口卡、金幣等真實數據。
- 收藏／裝備：只對選中、稀有或詳情卡使用 spotlight，不處理整個虛擬／長列表。
- 排除沉浸戰鬥、Dungeon、World Boss 戰鬥、Gacha、LootBox、Confetti、底部導覽與重要交易按鈕。
- 地下城例外：非戰鬥事件介面納入，建立 `DungeonEventStage` 類展示骨架供 Event/Trap/Rest/Chest/TreasureRoom/PathSelect 重用；沉浸戰鬥、射箭輸入與傷害動畫仍排除。

## Dungeon event presentation

- 共用層：房間類型色、環境 vignette、粒子／紋理靜態背景、事件 icon、標題、敘事、隊員狀態、選項區、確認／等待／結算狀態。
- SpotlightCard：用於事件選項與路線選擇，不用於整個全畫面舞台。
- FadeContent／AnimatedContent 類：用於房間揭示、敘事與結算階段切換；每個階段整批播放一次。
- 寶箱／寶藏：沿用 persisted reward，以 reveal sequence 展示，不重建 reward data。
- reduced motion：立即顯示最終狀態，停用粒子、模糊、掃光與大幅縮放。
- confirm/resolve callback、disabled 條件、host gating、member status 與 Firestore calls 原封不動傳入展示元件。

## Dungeon art direction

- 核心語言：兒童友善的高級暗色繪本／桌遊卡牌，像大型冒險關卡而不是恐怖地下室。
- 震撼來源：空間尺度、拱門剪影、符文亮起、寶箱金光、塵埃光束、卡牌翻揭、低角度構圖與清楚的色彩分區。
- 事件色彩：事件金、陷阱橘紅、休息青綠、寶箱琥珀、路線藍紫；維持低飽和背景與高可讀文字。
- 可用符號：古代機關、石門、羅盤、星圖、魔法符文、箭矢痕跡、貓咪探險隊剪影、圓潤怪物影子。
- 禁用符號：血液、屍體、肢解、寫實傷口、骷髏主視覺、陰森人臉、眼球凝視、突發貼臉、頻繁閃爍與恐怖噪點。
- 動態：採 220–700ms 的揭示、微小景深與一次性光掃；不用突然放大、畫面劇烈震動或無限閃爍。
- 陷阱結果：以護盾受擊、機關啟動、煙塵與 HP 狀態變化表達，不展示角色受傷。

## Performance contract

- 不新增動畫套件；元件直接 import，避免 barrel file。
- 每張 SpotlightCard 自身不註冊 window listener；pointer handler 綁定元素並以 RAF 合併更新。
- FadeContent 不為每一列建立 observer；優先包 page section 或 card grid。
- 動畫只使用 opacity/transform 與受控 radial-gradient，不改變 layout metrics。
- reduced motion 由 `matchMedia` 或 CSS media query 統一降級，並正確清理 listener。

## Dungeon feedback settings

- 入場設定放在 `DungeonSelectionPanel`／`DungeonRunSettings` 的開始按鈕之前，讓單人與組隊房主在建立 run 前看見目前偏好。
- 偏好以 localStorage 持久化，預設為 on；不寫入 Firestore，因為它是裝置端顯示／回饋偏好，不是房間規則。
- 現有 `fxSettings` 已提供 sound/animation，全域 `sound.js::vibrate()` 目前跟隨 sound gate。新增獨立 `fx_vibration` gate，`vibrate()` 只讀震動偏好；音效仍只讀 `fx_sound`，既有呼叫點不需逐一修改。
- 音效只由 click/confirm/reveal 等使用者互動後觸發；不以頁面 mount 自動播放。

## Dungeon run-settings persistence

- 單人：`activeExpedition` 目前只存 family/difficulty/isHidden/floorsCleared/HP，`handleResumeSolo` 也沒有回填 arrowsPerRound/targetFmt，這是已確認的遺失路徑。修正為 normalize 後一併持久化與恢復。
- 組隊：coordination room 已有 arrowsPerRound/targetFmt 欄位，重連與每層 `createTeamExpeditionBattleRoom` 必須只從 coordination room 複製；全面移除會掩蓋合法值的零散 default source，並為 reconnect、跨層與舊資料 fallback 補測試。
- 正規化函式 `normalizeDungeonRunSettings()` 是唯一允許產生預設值的邊界；render 層只讀已恢復設定。
- 開始後 UI 不允許更新設定；組隊只有 waiting 狀態與 host 可以寫入。

## Rollback

React Bits 類元件為展示 wrapper，不持有業務 state。移除 wrapper 與對應 CSS 即可回復，資料訂閱與 navigation callback 不變。

## Illustration asset system

- 建立共用 WebP 資產組，而非水晶玻璃卡變體：地下城大廳／挖掘／入口／圖鑑，以及練箭與背包各功能類別。
- 地下城事件共用直式環境 key art，以 tone overlay 區分事件類型；卡片內容仍由現有資料驅動。
- Hub 圖片作為卡片的語意縮圖或橫幅，文字與 badge 保持 DOM 內容並位於獨立對比層。
- 圖片由 build pipeline import，取得內容雜湊；控制尺寸與 WebP 品質，避免 base64 內嵌及全尺寸 PNG。
