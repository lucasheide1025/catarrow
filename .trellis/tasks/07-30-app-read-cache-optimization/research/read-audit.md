# 讀取稽核摘要

- UI 訂閱呼叫：約 151。
- UI 直接讀取：約 19。
- 全專案讀取候選：約 571。
- `MemberApp` 已持有 8 類玩家共用快照。
- `MemberDex` 重複訂閱其中 7 類。
- 地下城流程可能由 App、Lobby、Expedition、BattleRoom 重複訂閱卡片。
- `RPGEquipPanel` 有兩條完全相同的 `subscribeEquipItems`。
- `subscribeCertification` 是單次 `getDoc`。
- 未完整覆蓋快取的主要素材目錄包含 images、cards、cats、monsters-battle、council、guild、story、worldboss、items、monsters、art。
