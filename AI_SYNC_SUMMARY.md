# 🧟 Zombie Mode 2.5D AI Sync Record

## 1. 專案背景與進度摘要
- **專案名稱**：貓小隊射箭場積分系統 (catarrow)
- **當前重點**：開發「殭屍模式 (Zombie Mode)」的 2.5D 版本。
- **現狀**：
    - `src/zombie/` 已有完整架構：`ZombieGame.jsx` (Entry), `ZombieBattleArena.jsx`, `ZombieMapView.jsx`。
    - 戰鬥核心：採用 `BattleEngine.js` 的 `zombie` 模式，支援部位破壞 (resolveHitPart)。
    - UI 語法：採用「玻璃化 (Glass)」設計系統，深色系背景 (#0a0e1a)。
    - 資源管理：糧食、水、箭矢、箭露 (currency: arrowdew)。
- **外部依賴**：
    - Firebase Auth + Firestore。
    - 第二大腦：`docs/second_brain/` 為最高優先級參考。
    - CLAUDE 紀錄：`CLAUDE.md` 規範 AI 協作流程。
    - FREEBUFF 紀錄：`docs/second_brain/freebuff-handoff.md` 紀錄了單人戰鬥與 Loot 系統的整合工作。

## 2. 殭屍模式 2.5D 目標 (Next Step)
- **視覺升級**：將現有的 `ZombieMapView` (2D) 或 `ZombieBattleArena` 升級為 2.5D 效果。
- **技術路線**：已確定採用 **Isometric (等角投影)** 地圖網格系統。
- **功能擴展**：
    - 2.5D Isometric 空間感下的地圖探索。
    - 殭屍在等角投影網格上的移動與靠近動畫。
    - 多層次 Isometric 地圖背景。

## 3. 關鍵架構規則 (AI 必讀)
- **ID 區分**：`profile.id` (Firestore docId) vs `profile.uid` (Auth UID)。開發時務必使用 `profile.id`。
- **戰鬥引擎**：`src/battle/` 目錄為核心，勿刪除。所有模式應掛回既有引擎。
- **資料流**：優先瀏覽器端計算，Firestore 只存結果。
- **UI 規範**：繁體中文，手機優先，深色玻璃風格。音效使用 `src/lib/sound.js` (Web Audio)。

## 4. 歷史決策紀錄 (CODEX / CLAUDE / FREEBUFF 彙整)
- **Loot 整合**：`MonsterBattle` 與 `BattleScreen` 已完成整合，直接進入 Loot 畫面。
- **效能優化**：射手表現資料改為先存 localStorage 佇列，下課時再批次寫入 Firestore。
- **抽王邏輯**：已修正王房抽到雜怪的問題，鎖定 `bossEncounter` 與 `bossRunId` 確保預覽與實戰一致。

---
*此檔案由 Gemini CLI 建立，供後續 AI 接手參考。*
*最後更新：2026-07-20*
