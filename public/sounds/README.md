# 🔊 音效檔清單（`public/sounds/`）

## 怎麼加音效

**把 `.mp3` 丟進這個資料夾，檔名照下表。就這樣，不用改任何程式。**

`src/lib/sound.js` 已經為下表**每一個檔名**預先接好 `sample(檔名, 音量, 合成保底)`：

- 檔案存在 → 播你的音檔
- 檔案不存在／載入失敗 → 自動退回合成版（**不會變成無聲**）

所以可以一次補一個、隨時聽差別。缺檔時 console 會有一次 404（每個檔案每次開站只會一次），補上就消失。

> 📌 想讓某個檔案「開站就預載」（第一次觸發不延遲）：把檔名加進 `sound.js` 的 `SAMPLE_NAMES`。
> 不加也能用，只是第一次觸發稍慢。

## 試聽

「我的」→ 音效與動畫卡 → **▼ 音效試聽**，分介面／戰鬥／結算三組逐一點播。

---

## 已經放進來的（8）

| 檔名 | 用在哪 |
|---|---|
| `normal_atk.mp3` | 箭命中 |
| `crit.mp3` | 暴擊 |
| `monster_atk.mp3` | 玩家被攻擊 |
| `monster_crit.mp3` | 玩家被暴擊 |
| `miss.mp3` | 閃避／沒中 |
| `level_up.mp3` | 升級 |
| `open_chest.mp3` | 開寶箱 |
| `victory.mp3` | 勝利號角（大結算） |

---

## 🥇 優先補（玩家每天聽幾百次）

| 檔名 | 用在哪 | 建議長度／性格 |
|---|---|---|
| `ui_tap.mp3` | 所有按鈕點擊 | 40~80ms，乾、輕、不刺耳。**這顆最重要**，聽最多次 |
| `ui_switch.mp3` | 分頁／選項切換 | 40~60ms，比 tap 再輕一點、音高略高 |
| `arrow_shoot.mp3` | 射箭（每回合 3~6 次） | 150~250ms，弓弦「嗡」＋箭離弦的「颯」 |
| `monster_dead.mp3` | 擊倒怪物 | 300~500ms，崩落／消散感 |
| `coin.mp3` | 掉金幣 | 250~400ms，多顆硬幣彈跳，**避免太長**（會蓋掉後面的音） |
| `round_end.mp3` | 回合結束 | 200~300ms，柔和，不要太搶戲（每回合都響） |
| `ui_error.mp3` | 操作失敗 | 150~250ms，低沉否定感，**不要尖銳** |
| `ui_success.mp3` | 操作成功 | 250~400ms，上行、明亮 |

## 🥈 次要（明顯但不頻繁）

| 檔名 | 用在哪 |
|---|---|
| `ui_open.mp3` / `ui_close.mp3` | 面板開／關（whoosh） |
| `ui_confirm.mp3` | 接下委託／選定路徑 |
| `ui_notify.mp3` | 一般通知 |
| `cat_assist.mp3` | 貓貓助攻命中 |
| `defeat.mp3` | 遠征失敗 |
| `victory_small.mp3` | 小勝利（`victory.mp3` 是大結算用的） |
| `shop_buy.mp3` | 商店購買 |
| `potion.mp3` | 喝藥水 |
| `cast.mp3` / `buff.mp3` / `debuff.mp3` / `revive.mp3` | 施法／增益／減益／復活 |

## 🥉 場景型（有就更好）

| 檔名 | 用在哪 |
|---|---|
| `battle_intro.mp3` | 戰鬥開場 |
| `boss_appear.mp3` | 世界王登場 |
| `zombie_roar.mp3` | 殭屍吼叫 |
| `door_open.mp3` | 地下城開門 |
| `epic.mp3` | 史詩級事件 |
| `gacha_roll.mp3` / `gacha_reveal.mp3` / `gacha_reveal_new.mp3` | 抽卡轉動／翻牌／**新卡**（新卡要更華麗） |
| `village_collect.mp3` / `village_build.mp3` / `village_exchange.mp3` | 貓貓村收成／建造／兌換 |
| `gather_click.mp3` / `gather_defeat.mp3` / `gather_fail.mp3` / `gather_victory.mp3` | 採集點擊／擊倒／失敗／完成 |
| `council_mine.mp3` `council_farm.mp3` `council_harbor.mp3` `council_hunting.mp3` `council_market.mp3` `council_warehouse.mp3` | 議會廳六棟的工作聲 |

---

## ⚠️ 刻意**不要**換成音檔的

`sfxCheckinAlert`／`sfxNewBookingAlert`／`sfxNextHourAlert` —— 教練後台的三個提醒音。

它們是為了在工作電腦上**穿透環境噪音**而刻意設計的刺耳上行合成音。換成「好聽」的音檔會讓它變得不夠醒目——那是**功能退化**，不是改進。

---

## 技術規格建議

- **格式**：`.mp3`（`playAudio` 直接組 `/sounds/<name>.mp3`）
- **聲道**：單聲道就夠（UI/衝擊音不需要立體聲），檔案小一半
- **位元率**：96~128kbps 足夠；UI 短音 64kbps 也聽不出差別
- **音量**：正規化到接近 0dB，程式端再用每個音效的 `volume` 參數調（見 `sound.js` 的對照表）
- **開頭不要留空白**：前面有 20ms 靜音就會感覺「按了才響」，延遲感很明顯
- **長度**：UI 類 ≤100ms、命中類 ≤300ms、結算類 ≤1.5s

## 免費且可商用的來源

- **Sonniss GDC Bundle** —— 每年釋出、專業錄音、royalty-free，免費資源裡品質最高
- **Kenney.nl** —— CC0（連署名都不用），偏 indie 風但很齊
- **freesound.org** —— 量大，但**授權逐檔不同**，要看清楚 CC0／CC-BY
