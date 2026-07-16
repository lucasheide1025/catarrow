# Implementation plan

1. 確認訪客端是否納入 PublicBookingApp，鎖定最終頁面清單。
2. 記錄 MemberApp、GuestApp、各 Hub、Widgets 與現有動畫的修改前結構及 production build 基準。
3. 查核 React Bits 對應元件來源、授權、依賴與 reduced-motion 缺口。
4. 建立最小共用元件與 scoped styles，先用獨立範例驗證 pointer、touch、keyboard、unmount cleanup。
5. 第一批整合 MemberHome 與四個 Hub；不改 props contract、navigation 或資料訂閱。
6. 第二批整合 GuestApp 的登入品牌區、首頁活動卡與可信數據。
7. 在地下城進入／run settings 區加入預設開啟、可持久化的音效與震動控制，處理 user gesture 與不支援裝置降級。
8. 先補 run-settings persistence 單元測試，再修正單人 activeExpedition 持久化／恢復與組隊 reconnect／跨層複製路徑。
9. 建立地下城共用事件舞台，先整合 DungeonEvent/Trap/Rest，再整合 Chest/TreasureRoom/PathSelect/Explore event preview；保留所有 callback 與狀態機。
10. 視效能結果再擴充到 Profile/Achievements/Dex/Leaderboard 與少量收藏／裝備詳情卡；MemberPerformance 在 Claude 並行修改完成前排除。
11. 全面檢查 reduced motion、360/390/430px、鍵盤 focus、CTA layering、返回頁面重播、單人／組隊 confirm-resolve、run settings 與 persisted reward 行為。
12. 執行 `npm test -- --watchAll=false`、`npm run build`；若無獨立 lint/typecheck script，記錄不適用並以 CRA 編譯檢查替代。
13. 比較 build 輸出、依賴與資源增量，修正所有新增警告並提交完整摘要。
14. 以壓縮 WebP 插畫重新設計地下城大廳、挖掘、儲存／進入與圖鑑；排除戰鬥和結算畫面。
15. 擴充 HubTile 的語意縮圖模式，替練箭與背包入口建立功能對應圖片，移除抽象水晶卡作為主要辨識方式。

## Rollback gates

- 若首頁／Hub pointer 效果造成掉幀，fine pointer 追蹤降級為純 CSS 靜態邊光。
- 若 BlurText 造成輸入延遲或重播干擾，完全移除，只保留 FadeContent。
- 若數據動畫降低快速掃讀效率，保留純文字數值。
