# Design

文件矩陣與 Emulator tests 分離 current behavior / desired behavior。第一個 hardening batch 只處理文件 ID 已由 client call sites 證實等於 memberId 的 collection，統一使用既有 `ownsMember()` helper，保留 admin 維運能力。測試以 Rules disabled context 建立 member/admin identity，再驗證 owner、other、anonymous、admin 四種 actor。共享與匿名流程不套用此 helper，避免破壞必要產品流程。不得部署。
