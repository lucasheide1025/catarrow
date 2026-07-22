# ComfyUI 模型選型 v1

## 結論

第一輪改用 **Animagine XL 4.0 Opt** 作為日系 RPG 角色與怪物的基準 checkpoint，停止使用 DreamShaperXL Turbo 進行本專案角色定稿。先只做「一名人型＋一隻純怪物」A/B 小樣，通過美術審核後才生成鬼怪族 T1 六張 canonical master。

## 選擇理由

- Animagine XL 4.0 Opt 是 SDXL 日系插畫模型；官方模型卡聲明改善穩定度、人體比例、雜訊與色彩，方向符合漂亮、帥氣、華麗但不寫實的角色需求。
- 官方模型卡明確支援 ComfyUI，建議以 tag prompt 使用；因此角色規格要轉為固定順序的 tag 模板，不依賴長篇自然語言。
- 模型仍可能產生手指與複雜手勢錯誤；第一輪採自然垂手、背手、扶披風、持燈於身側等低風險姿勢，武器不是必要元素。
- 目前 RTX 3080 10 GB 可沿用 SDXL 工作流，但必須先以單張、適中解析度驗證 VRAM 與耗時，再決定批次併發策略。

## 控制元件分階段導入

### A/B 小樣（最小變因）

1. Animagine XL 4.0 Opt checkpoint。
2. 原生 ComfyUI SDXL workflow。
3. 固定 seed 對照 prompt、構圖和採樣參數。
4. 暫不加入 IP-Adapter；純怪物也不強套人形 OpenPose。

### 小樣通過後

- 人型角色：加入 SDXL ControlNet／Control-LoRA 姿勢控制，鎖定低手部風險姿勢。
- 同一角色跨用途：canonical master 通過後，以該圖作為唯一身份來源，再評估 IP-Adapter 做卡片場景轉繪。
- IP-Adapter Plus 僅在相容性驗證後導入：該節點專案已進入 maintenance-only，且文件要求較新的 ComfyUI；不得直接裝入現有 0.28.0 後假定可用。

## 第一輪 A/B 對象

- 人型：`ghost_t1_normal_a`「暮燈旅者」——測試男性臉部、服裝、幽靈特徵、自然手勢與全身比例。
- 純怪物：`ghost_t1_normal_b`「星霧絨獸」——測試非人形設計、可親但神祕的怪物語言與同家族風格。

兩者都先輸出透明 canonical master 候選；卡片場景圖要等 master 身份核准後才製作，避免角色與卡片分裂成不同畫風或不同個體。

## 審核門檻

- 明確是日系 RPG 2D 插畫，不是照片、3D 玩具或 Q 版。
- T1 保持簡潔，但臉、輪廓、配色具吸引力。
- 人型為成熟 6–7 頭身，手部沒有明顯畸形；不以武器遮掩手部問題。
- 純怪物不血腥、不恐怖、不過度醜陋，且與人型共享鬼怪族色彩、材質與光線語言。
- 背景去除後邊緣可用；若 rembg 再次逾時，先保存原始圖並將透明化拆成可重試後製工作，不重跑擴散模型。
- 小樣未通過不得生成其餘四張，也不得寫入 `public/`。

## 授權與供應鏈紀錄

下載前必須記錄：來源 URL、檔名、版本、授權、下載日期、SHA-256、檔案大小。Animagine XL 4.0 模型卡標示 CreativeML Open RAIL++-M；實際下載時仍需保留授權副本與通知。任何額外 checkpoint、ControlNet、LoRA 或 custom node 都套用相同規則。

## 參考來源

- Animagine XL 4.0 官方模型卡：https://huggingface.co/cagliostrolab/animagine-xl-4.0
- Stability AI Control-LoRA 官方模型卡：https://huggingface.co/stabilityai/control-lora
- IP-Adapter 官方研究實作：https://github.com/tencent-ailab/IP-Adapter
- ComfyUI IPAdapter Plus 節點：https://github.com/cubiq/ComfyUI_IPAdapter_plus
