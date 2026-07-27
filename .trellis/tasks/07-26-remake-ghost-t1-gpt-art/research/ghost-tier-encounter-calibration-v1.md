# 鬼怪族 Tier × Encounter 校準 v1

## 目的

以九隻互不相關的測試怪驗證兩條獨立視覺軸：

- 橫向：普通怪／小王／大王的體量、輪廓、構圖、姿勢與環境反應。
- 縱向：T1／T3／T6 的材質、裝備、能力成熟度與場景規模。

本批僅供美術校準，不使用正式 monster ID，不得整合至 `public/`。

## Prompt 摘要

| Tier | Encounter | 獨立概念 | 核心限制 |
|---|---|---|---|
| T1 | 普通 | 膝高破布遊魂、微弱魂火、路邊小祠 | 約 42% 占幅、大量留白、普通材料 |
| T1 | 小王 | 木枝／麻繩門衛、主動攔截 | 約 65% 占幅、1.3× 體感、一區域招牌能力 |
| T1 | 大王 | 泥石樹根墓塚巨靈 | 約 88% 占幅、低角度、地面與碎石反應 |
| T3 | 普通 | 邊境幽靈劍士、鍛鐵軍刀 | 標準人形、備戰姿勢、受控刀光 |
| T3 | 小王 | 鎖鏈獄卒、鉤刃長柄武器 | 約 1.35× 體感、突進姿勢、局部鎖鏈能力 |
| T3 | 大王 | 石鐵木構攻城象／移動堡壘 | 攻城級體量、全景環境反應，但不用神話材質 |
| T6 | 普通 | 漂亮女性冥府律令書吏、黑曜浮冊 | 人形標準構圖、局部法則、臉部清楚漂亮 |
| T6 | 小王 | 日蝕獵手、月牙空洞神器 | 1.35× 體感、主動攻擊、局部空間彎曲 |
| T6 | 大王 | 漂亮女性冥河主宰 | 巨像低角度、全場重力／河流逆轉，臉部不醜化 |

所有圖共用：3:4 純卡圖、無框／文字／UI、深藍黑鬼怪族色域、冷青魂光、彼此沒有角色延續關係。

## Staging 與 SHA-256

根目錄：`.staging/image-generation/gpt-ghost-calibration/`

| 檔案 | SHA-256 |
|---|---|
| `ghost-cal-t1-normal-v1.png` | `AD87A3422FF3D20B0FC431FB403623312A5A931FB3173EBC04E252F5239D5128` |
| `ghost-cal-t1-mini-v1.png` | `4E1A900031DE8778E3DB8A2759C8B37BE1F58B085E16C1E142CD32A25F209EE6` |
| `ghost-cal-t1-boss-v1.png` | `2D958A454A4ADBCC1D217C0C91C538BF84E0DC5CD6562AE8E6777FC264018DD9` |
| `ghost-cal-t3-normal-v1.png` | `B58CB2678CF43DCF98CB8A7A1F38B06B02BBE1A4FB034E04106DDF4A10E0B010` |
| `ghost-cal-t3-mini-v1.png` | `AD5F37768AC923AB4D8EDA61D386A59D5C93234F986CB43570D7C4E419A94130` |
| `ghost-cal-t3-boss-v1.png` | `60AEF3A469DA5B1765228D163FED49572CCFAC01E93453C89EA02554D02FFB3A` |
| `ghost-cal-t6-normal-v2-beautiful.png` | `3E3C3A3EEB84F0C16BA4D1BB0693DF28E30D816670D247E4E9A026253E0F608A` |
| `ghost-cal-t6-mini-v1.png` | `3C2ECD9BF54A8B000C374055D016456603050DEA3D1504921185148B85ADD86A` |
| `ghost-cal-t6-boss-v1-beautiful.png` | `C228F5EB3FAFA8524FB1C828BC45D67258207FE19FBFC4B981893CCD95D550B8` |

聯絡表：`ghost-calibration-t1-t3-t6-contact-sheet-v1.png`

排列固定為列 `T1／T3／T6`，欄 `普通／小王／大王`。

## 核准結果

- 2026-07-27 使用者確認目前橫向 encounter hierarchy 與縱向 tier progression 沒有問題。
- 女性角色採漂亮優先；純怪物或男性角色不受此條件限制。
- 本批九張仍為 staging 校準素材，不直接對應或覆寫正式遊戲怪物。
