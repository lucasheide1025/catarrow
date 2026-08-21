# Implementation Plan

1. 建立 UI 契約測試：首頁主 CTA、三地下城、組隊／競技場／商店入口、本機保存提示、戰鬥必要 HUD 與 reduced-motion。
2. 抽離 Arcade 全域 CSS 至獨立樣式檔，建立 tokens、背景、safe-area 與 responsive foundation。
3. 建立 `ArcadeShell`、`ArcadePlayerBar`、`ArcadeActionDock` 等無資料副作用的呈現元件。
4. 重設首次訪客畫面：角色舞台、單一暱稱區、可滑選同行貓與動態 CTA。
5. 重設回訪大廳：玩家狀態列、地下城 carousel、單一開始／繼續動作、次要功能島與底部 sheet／導航。
6. 為森林、月夜、深淵建立一致但可辨識的場景 theme。
7. 將單人 Adventure、Team 與 Duel 的戰鬥外框套入共用魔法街機 HUD；保持既有資料與演出流程。
8. 在 360px／390px 與 reduced-motion 條件檢查溢位、safe area、焦點與主要觸控尺寸。
9. 執行 focused UI contracts、完整 Arcade tests、React 品質檢查與 production build。
10. 先新增組隊人數 HP 縮放、玩家 HP、全體怪物反擊與團滅條件的純函式測試，再修改 Team logic／DB／presentation。
11. 新增決鬥 2～8 人 × 3／6 箭 HP 矩陣測試，修改初始 combat 建立並驗證 persisted maxHp 不漂移。
12. 先以純函式測試建立分享卡五軸資料與 fallback，再重畫 `arcadeShare.js` Canvas 為貓弓冒險檔案；更新單人／組隊 shareData 並保留既有 Web Share／下載行為。

## Review gates

- Gate A：onboarding／hub 所有既有功能仍可達。
- Gate B：地下城選擇只改呈現，不改 `ADVENTURE_TYPES` 或開始參數。
- Gate C：戰鬥元件只改 markup／class／presentation wrapper，不改 round resolution、DB writes 或 rewards。
- Gate D：不得納入工作區其他既有未提交變更。
- Gate E：多人平衡只在房間開始時鎖定；reload、reconnect、late cleanup 不重新依在線人數計算。
