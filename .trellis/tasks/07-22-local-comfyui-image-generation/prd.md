# 本機 ComfyUI 圖片生成遷移規劃

## Goal

規劃將 catarrow 專案所有 AI 圖片生成工作，從 Gemini／其他雲端圖片 API 與零散手工作業，統一遷移到使用者本機的 ComfyUI 執行，建立可重現、可批次、可追蹤、不中斷現有素材的生成流程。

本階段只討論、研究與產出計畫；不安裝 ComfyUI、模型或 custom nodes，不修改生成腳本，不重新生成或刪除現有圖片。

## Initial Intent

- 新產生圖片的預設執行環境改為本機 ComfyUI。
- 需要涵蓋專案中所有圖片類型與既有生成方式，而非只替換單一腳本。
- 需要讓 Codex 後續可以提交 prompt、workflow 與批次工作，並可靠取得輸出。
- 遷移不能破壞現有圖片路徑、命名、尺寸、透明背景及資料引用。
- Gemini 圖片生成品質不符合需求；新流程不保留 Gemini 生圖 fallback。
- 男／女人形角色必須漂亮、帥氣、華麗且具有足夠視覺吸引力；華麗程度需隨 T1～T6 明顯提升。
- 純怪物不得過度醜陋、血腥或恐怖；可有威脅感，但必須維持可接受、適合遊戲長期觀看的設計。
- 全系列移除台灣特有民俗作為共同世界觀，不綁定單一國家或地域。
- 鬼怪族採純粹幽靈／鬼怪設定，可引用世界各地文化服裝與傳說，但需避免文化元素混雜成無意義拼貼。
- 山林族以動物系角色為主。
- 職場族與考試族保留既有現代生活題材方向。
- 毒蟲族採華麗昆蟲幻想：男／女人形角色融入翅膀、甲殼、觸角、複眼飾品與毒素色彩；純怪物採幻想化昆蟲／蛛形／多足輪廓，禁止寄生、腐爛、鑽體與寫實昆蟲恐怖。
- 神殿族採失落文明神殿守護者：男／女可為祭司、聖騎士、占星師、神殿守衛與神諭者；純怪物可為石像、神獸、魔像、翼獸與古代機關生命。可取材多種古文明，但不直接複製現實宗教神祇、經文或儀式。
- 寶藏族採冒險、鍊金與活化財寶：男／女可為寶藏獵人、鑑定師、鍊金術師、收藏家、探險者、珠寶工匠與寶庫守護者；純怪物可為寶箱怪、金幣精靈、寶石獸、鎧甲守衛、鑰匙生命、黃金龍或活化神器。禁止賭場／拉霸機與現代炫富語言。

## Confirmed Repository and Local Facts

- 本機 ComfyUI API 已在 `http://127.0.0.1:8188` 運作，版本 `0.28.0`，環境為 portable embedded Python。
- GPU 為 NVIDIA GeForce RTX 3080，VRAM 約 10 GB；系統 RAM 約 32 GB。
- 目前只有 `DreamShaperXL_Turbo_v2_1.safetensors` checkpoint；ComfyUI API 未列出 LoRA 或 upscaler model。
- 專案已有三條可運作的 ComfyUI API 腳本：`gen-dungeon-tiles.py`、`gen-zombie-images.py`、`gen-zombie-map-tiles.py`。
- 既有腳本直接建立 API-format workflow、POST `/prompt`、輪詢 `/history/{promptId}`、GET `/view`，並使用 `rembg`、Pillow 輸出 WebP。
- 既有透明背景並非由 checkpoint 直接輸出 alpha；三條管線都先由 ComfyUI 生成一般圖片，再以 `rembg.remove()` 去背、轉 RGBA、裁切置中並輸出透明 WebP。
- 既有腳本將 seed 隨機產生且沒有保存 manifest，三份腳本也重複實作 API client、輪詢與後處理。
- `generateVillageImages.js` 仍以 `GEMINI_API_KEY` 呼叫 Gemini image model；`listModels.js` 亦依賴 Gemini key。
- `cat-card-prompts.md`、`image-prompts/council-hall.md`、`worldboss-small-boss-prompts.md` 仍是手動貼入雲端／通用生成工具的 prompt 文件。
- `tmp/imagegen/` 已有 335 個來源圖、約 680 MB；`public/` 有 1,631 個圖片、約 458 MB，需避免生成中間檔繼續進入 Git 與部署產物。
- 世界王六隻小王已有 prompt、固定輸出路徑與現有 fallback 圖，適合作為低風險試點。

## Requirements

- MUST 盤點所有圖片目錄、來源、生成腳本、prompt 文件、API key 使用點及資料引用方式。
- MUST 盤點本機 ComfyUI 的安裝位置、版本、啟動方式、API 可達性、GPU/VRAM、模型與 custom nodes；只做唯讀偵測。
- MUST 定義 Codex 到 ComfyUI 的工作提交、進度輪詢、失敗重試、輸出收集與 manifest 合約。
- MUST 定義不同素材類型的 workflow profile，包括角色／怪物、icon、背景、卡片、UI 素材、透明背景與變體。
- MUST 保存 seed、prompt、negative prompt、模型、LoRA、sampler、steps、CFG、尺寸及 workflow 版本等可重現 metadata。
- MUST 定義輸出暫存、人工審核、壓縮、命名、正式歸位與引用驗證流程。
- MUST 規劃 Gemini 生圖入口的完整退場；既有素材仍按批次審核，不因來源直接移除。
- MUST 在實作階段移除 Gemini 圖片生成腳本、model listing 腳本與只為 Gemini 生圖存在的專用依賴／設定；移除前需證明沒有其他用途。
- MUST 不因既有圖片由 Gemini 生成就自動刪除；替換必須逐批通過視覺與引用驗證。
- MUST 將 GPT 圖片生成設計為人工升級路徑，而非自動 fallback 或批次 provider。
- MUST 在轉交 GPT 前保存本機 ComfyUI 的 workflow、模型、prompt、seed、嘗試次數、輸出與不合格原因，證明本機無法完成主視覺需求。
- MUST 只有經使用者明確批准的單一素材／批次才能轉交 GPT。
- MUST 允許安裝少量新增 checkpoint、LoRA 或必要 custom nodes，但每項必須記錄來源、版本、license、檔案雜湊、磁碟需求與 RTX 3080 10 GB 驗證結果。
- MUST 避免無目的大量下載；模型引入需對應明確 asset profile 與可驗證品質缺口。
- MUST 對主視覺、角色、世界王與卡片逐張人工批准。
- MUST 對大量同規格素材先自動檢查尺寸、alpha、格式、檔案大小、命名與數量，再由使用者整批批准。
- MUST 將未批准輸出存放於 Git/Vercel 排除的 staging；批准前不得覆寫正式素材。
- MUST 建立既有圖片的縮圖索引、路徑、尺寸、大小、格式、引用位置與可判定的生成來源清冊。
- MUST 對既有低品質圖片採逐批重生；舊圖在替代品批准、引用切換及回歸驗證完成前不得移除。
- MUST 支援先提交 ComfyUI 批次，再利用 GPU 等待時間平行執行其他互不衝突的專案優化，最後回收並審核生成結果。
- MUST 限制第一輪只提交已定義 prompt、workflow、輸出 staging 與審核標準的素材；不得把所有現有圖片無差別一次送入生成。
- MUST 將圖片生成與程式優化分成不同 Trellis 子任務／commit，避免生成資產、Rules、安全修補與重構互相污染。
- MUST 為每個怪物建立唯一 canonical master art；戰鬥立繪、卡片、圖鑑與地城呈現只能由同一母版裁切、縮放、合成背景或生成受控變體，不得各自重新自由生成。
- MUST 以 monster id 將 canonical source、battle derivative、card derivative、dex derivative、dungeon derivative 與 metadata 綁在同一 manifest。
- MUST 統一卡片 art asset 為 `3:4`；角色與種族／Tier 背景在 WebP 內，卡框、名稱、Tier、技能、星級與數值全部由 React UI 疊加。
- MUST 禁止生成圖片內出現文字、數值、卡框或 UI；每個 `family × tier` 共用色彩、材質、光線、紋樣與華麗度語言，但允許各角色使用與設定相關的專屬場景。
- MUST 不強迫人形角色持有武器；武器、道具、姿勢與場景只在符合角色主要設定時使用。
- MUST 將角色美感、角色個性、種族關聯與故事辨識度置於武器展示之前。
- MUST 在品質閘門比較角色輪廓、臉部／頭部特徵、服裝／配色、武器與道具；身份特徵不一致即整批拒絕。
- MUST 為 T1～T6 定義可觀察的華麗度階梯，包括服裝層次、材質、配件、武器、光效與輪廓複雜度；不能只靠更多粒子特效假裝升階。
- MUST 對純怪物加入 negative constraints：gore、blood、body horror、rotting flesh、exposed organs、photoreal horror、grotesque deformity。
- MUST 允許重寫角色顯示名稱、掉落物顯示名稱與戰鬥技能顯示名稱，使其符合新種族世界觀與角色外觀。
- MUST 保持 monster/material/skill 的穩定 ID、資料 schema、掉落數量、轉換規則、技能公式、觸發條件與戰鬥效果不變，除非另立平衡任務。
- MUST 建立 rename mapping，涵蓋前端 catalog、Functions 同步資料、測試、手冊與所有使用者可見文字，避免只改單一副本。
- MUST 在生成造型前先定義每個 `family × tier` 的男、女、純怪物配比與角色槽映射。
- MUST 將六個既有角色槽分成普通組三個（`normalA`、`normalExisting`、`normalB`）與首領組三個（`miniA`、`miniB`、`boss`）。
- MUST 將模型檔、輸出快取與大型中間檔排除在 Git 與 Vercel 部署來源之外。
- MUST 考慮 NSFW、安全提示詞、授權、模型來源、磁碟容量與 GPU 資源限制。

## Acceptance Criteria

- [ ] 完成現有圖片生成面與資產類型清冊。
- [ ] 完成本機 ComfyUI 能力與缺口清冊。
- [ ] 選定一套 Codex 可呼叫的 ComfyUI API 架構與工作合約。
- [ ] 定義至少一個低風險試點 workflow，以及後續分批遷移順序。
- [ ] 定義 metadata、manifest、檔名、尺寸、壓縮與品質閘門。
- [ ] 定義失敗、重啟、佇列、重試及回滾策略。
- [ ] 產出 `design.md` 與 `implement.md`，經使用者確認後才進入實作。

## Out of Scope

- 本規劃階段安裝或升級 ComfyUI、Python、CUDA、模型或 custom nodes。
- 修改／刪除現有圖片、prompt、生成腳本或雲端憑證。
- 一次重新生成全部既有素材。
- 將 ComfyUI 對公網開放。

## Open Questions

- 第一個標準化試點是否同時包含世界王 portrait profile 與一張不覆寫正式素材的 transparent-asset profile。
- 第一批既有圖片重生應優先處理哪個產品區域。
- ComfyUI 等待期間，第一輪允許實作的優化子任務範圍。

## Decisions

- Gemini 圖片生成全面退場，不保留 fallback。
- Gemini 生圖腳本與專用依賴於實作階段安全移除；本規劃階段不執行刪除。
- 自動化與批次生成一律使用本機 ComfyUI。
- 本機確認無法完成主視覺需求後，才可經使用者明確批准轉交 GPT；系統不得自動切換。
- 第一階段採雙 profile 試點：世界王六隻小王驗證主視覺；另生成一張不覆寫正式素材的透明 WebP，驗證 `ComfyUI + rembg + RGBA` 管線。
- 允許後續實作階段新增少量、授權清楚且經 RTX 3080 10 GB 驗證的 checkpoint／LoRA／必要 custom nodes；保留 DreamShaperXL Turbo 作基線。
- 主視覺類逐張批准；大量同規格素材通過自動品質檢查後可整批人工批准。未批准輸出不得進入正式路徑。
- 既有低品質／Gemini 圖片納入逐批重生，不採一次性全量替換。
- 執行時採非同步工作節奏：提交已核准的 ComfyUI 批次，平行處理獨立優化，再回收圖片進度與審核。
- 第一輪六張世界王小王 portrait 全部拒絕：DreamShaperXL Turbo 對持弓／箭姿勢、手部結構與角色立繪美感未達需求；只保留為 staging 基線證據，不得進入正式素材。
- 現況已證實同一怪物存在三套互不一致的圖：例如 `ghost_1` 的 card 是場景式可愛幽靈男孩、battle 是寫實女性幽魂、legacy monster 是 Q 版小和尚；此結構禁止延續。
- 使用者拒絕以舊版 60 張怪物卡片作 canonical 視覺基準，原因是整體過度寫實；它們只可用於角色／內容盤點，不可直接決定新風格。
- 在新的怪物美術方向、寫實程度、比例與呈現媒材經使用者批准前，暫停下一輪怪物生成。
- T1 每個種族的六個角色總配比定為 `2 男、2 女、2 純怪物`。
- T1～T6 的 `miniA`、`miniB`、`boss` 採男／女／純怪物輪動，不允許大王永久固定為單一型態。
- 首領組輪動表確定為：T1/T4=`miniA 男、miniB 女、boss 純怪物`；T2/T5=`miniA 女、miniB 純怪物、boss 男`；T3/T6=`miniA 純怪物、miniB 男、boss 女`。
- 普通組在每個種族、每個 Tier 固定保持 `1 男、1 女、1 純怪物`，不隨 T1～T6 輪動。
- 普通組固定 slot：`normalA=男`、`normalExisting=女`、`normalB=純怪物`；所有既有普通怪外觀重新設計，不保留與固定 slot 衝突的舊身份。
- 舊名稱、技能、材料與種族主題只作概念輸入；新 canonical art 與角色造型從零重建。
- 名稱、掉落物與技能名稱也納入重新命名；實際 gameplay 作用、數值與穩定 ID 維持不變。
- 所有使用者可見文字一起重寫，包括怪物名稱／稱號、技能名稱／摘要／反制提示、掉落物名稱／說明、卡片、圖鑑與怪物手冊敘事；gameplay 效果完全不變。
- 鬼怪族 T1 `ghost_t1_normal_a`（普通男性）確定為「暮燈旅者」：俊美男性幽靈引路人、歐洲舊時代旅裝、銀灰短髮、冷藍／灰銀配色、漂浮幽光提燈。技能顯示名「殘燈掠影」，掉落物「幽光燈芯」，卡片場景為黃昏古道或霧中石橋；保留原傷害與 ATK 弱化效果。
- 鬼怪族 T1 `ghost_1`（普通女性）確定為「鏡幕幽姬」：優雅女性幽靈、古典舞會禮服元素、銀白長髮、冷紫／霧銀配色、漂浮霧銀手鏡。技能顯示名「鏡界庇護」，掉落物「霧銀鏡片」，卡片場景為廢棄舞廳或月光鏡廊；保留原無傷害與最大 HP 5% 護盾效果。
- 後續鬼怪族 T1 角色概念不再逐一詢問，依既定規則完成整批提案後由使用者集中審閱。
- 鬼怪族 T1 六角色整組已批准：`normalB=星霧絨獸`、`miniA=蒼焰巡獵者`、`miniB=霧紗影舞者`、`boss=星環冥鹿`，連同前兩位形成首個美術／文案垂直切片。
- 男／女人形角色採 6～7 頭身的成熟日系 RPG 插畫比例；不得使用 Q 版、真人照片感或過度寫實的八／九頭身時裝比例。
- T1～T6 華麗度階梯確定：T1 初階、T2 熟練、T3 菁英、T4 高階領袖、T5 傳說、T6 神話；升階主要依靠服裝層次、材質、配件、武器與輪廓，光效不得遮臉或取代設計。
- Canonical 角色使用透明全身母版；戰鬥使用完整母版，卡片使用同圖的 3/4 身裁切與背景合成，圖鑑使用同圖半身裁切。
- 卡片分層固定：圖片只含角色與背景；所有框面與文字資訊由 UI 呈現。
- 卡片立繪是角色設定與場景的視覺補充，不是制式武器展示圖；主要驗收標準為好看且與角色設定相關。
- 同一 `family × tier` 不共用完全相同背景；角色專屬場景可變化，但不得改變系列共同美術語言或搶走角色焦點。

## Open Questions

- 新怪物系列的目標美術方向、角色比例、線條／上色媒材與可接受寫實程度。
- canonical 全身立繪與卡片裁切／背景／構圖的呈現規格。
- 第一個完整垂直切片應選哪個種族與 Tier，以驗證六角色配比、canonical art、卡片、rename mapping 與 gameplay 語意同步。
- 鬼怪族 T1 其餘五個角色的逐一概念、命名、場景與技能／掉落物文案。

## Notes

- 本任務為複雜規劃，完成 `design.md` 與 `implement.md` 並經使用者審閱前不得開始實作。
