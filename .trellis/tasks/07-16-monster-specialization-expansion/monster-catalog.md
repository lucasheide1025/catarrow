# Monster and material catalog

## Contract

- 每個 `family × tier` 固定 3 隻一般怪、2 隻小王、1 隻大王。
- 六個非寶箱族的一般怪依序為新增 0.8、既有 1.0、新增 1.2；既有 ID、名稱與素材 ID 不變。
- 寶箱族例外沿用現有特殊／被動怪作一般 0.8、現有標準怪作一般 1.0、現有小王作小王 A、現有大王作大王，只新增一般 1.2 的寶箱守衛與小王 B 的寶石魔偶。
- 新怪 ID 格式：`{family}_t{tier}_{normal_a|normal_b|mini_a|mini_b|boss}`。
- 新素材 ID 格式：`mat_{monsterId}`；招牌技能 ID 格式：`sig_{monsterId}`；卡片 ID 直接引用 `monsterId`。
- 此文件先確認顯示名稱、素材名稱與招牌技能名稱；效果積木、共用技能、卡片效果與美術 prompt 於後續欄位補齊。

## 鬼怪族（ghost）

| Tier | 類型 | Monster ID | 怪物名稱 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `ghost_t1_normal_a` | 提燈小靈 | 微光燈芯 | 引燈閃身 |
| T1 | 一般 1.0 | `ghost_1` | 好兄弟 | 路邊供品 | 供品分享 |
| T1 | 一般 1.2 | `ghost_t1_normal_b` | 星霧守衛 | 星霧徽片 | 星霧推進 |
| T1 | 小王 A | `ghost_t1_mini_a` | 巡夜燈童 | 巡夜燈印 | 導光突進 |
| T1 | 小王 B | `ghost_t1_mini_b` | 初階影衛 | 影衛披片 | 霧步封路 |
| T1 | 大王 | `ghost_t1_boss` | 鎮界靈將・初陣 | 鎮界令碎片 | 鎮界光陣 |
| T2 | 一般 0.8 | `ghost_t2_normal_a` | 迷途紙蝶 | 紙蝶鱗粉 | 回光引路 |
| T2 | 一般 1.0 | `ghost_2` | 魔神仔 | 魔神仔迷霧 | 迷霧繞路 |
| T2 | 一般 1.2 | `ghost_t2_normal_b` | 靈路巡衛 | 靈路徽章 | 迴廊封鎖 |
| T2 | 小王 A | `ghost_t2_mini_a` | 巡夜燈使 | 長明燈芯 | 引燈追影 |
| T2 | 小王 B | `ghost_t2_mini_b` | 霧行影衛 | 霧行披風 | 霧行截步 |
| T2 | 大王 | `ghost_t2_boss` | 鎮界靈將・巡境 | 巡境令牌 | 四方巡界 |
| T3 | 一般 0.8 | `ghost_t3_normal_a` | 林光花靈 | 林光花瓣 | 花霧旋舞 |
| T3 | 一般 1.0 | `ghost_3` | 林投姐 | 林投葉 | 林投葉陣 |
| T3 | 一般 1.2 | `ghost_t3_normal_b` | 青葉影侍 | 青葉護符 | 葉影連斬 |
| T3 | 小王 A | `ghost_t3_mini_a` | 巡夜燈衛 | 靈林燈罩 | 百燈護行 |
| T3 | 小王 B | `ghost_t3_mini_b` | 青葉影衛 | 影葉肩甲 | 青影封徑 |
| T3 | 大王 | `ghost_t3_boss` | 鎮界靈將・森羅 | 森羅令旗 | 森羅列陣 |
| T4 | 一般 0.8 | `ghost_t4_normal_a` | 判簿書靈 | 判簿墨晶 | 墨令飛卷 |
| T4 | 一般 1.0 | `ghost_4` | 城隍爺 | 生死簿碎頁 | 城隍判令 |
| T4 | 一般 1.2 | `ghost_t4_normal_b` | 鎮街靈差 | 鎮街腰牌 | 巡界喝止 |
| T4 | 小王 A | `ghost_t4_mini_a` | 巡夜司燈官 | 司燈官印 | 萬戶點燈 |
| T4 | 小王 B | `ghost_t4_mini_b` | 判界影衛 | 判界臂甲 | 影令鎖陣 |
| T4 | 大王 | `ghost_t4_boss` | 鎮界靈將・判界 | 判界金令 | 天平裁界 |
| T5 | 一般 0.8 | `ghost_t5_normal_a` | 義犬燈靈 | 忠義燈火 | 護主追光 |
| T5 | 一般 1.0 | `ghost_5` | 十八王公 | 義犬魂魄 | 忠義鎮守 |
| T5 | 一般 1.2 | `ghost_t5_normal_b` | 香火神衛 | 香火金片 | 願火護陣 |
| T5 | 小王 A | `ghost_t5_mini_a` | 巡夜天燈將 | 天燈戰印 | 天燈照夜 |
| T5 | 小王 B | `ghost_t5_mini_b` | 香火影將 | 願火肩鎧 | 萬願影陣 |
| T5 | 大王 | `ghost_t5_boss` | 鎮界靈將・王令 | 王令玉牌 | 王令鎮域 |
| T6 | 一般 0.8 | `ghost_t6_normal_a` | 輪迴星使 | 輪迴星砂 | 星輪迴轉 |
| T6 | 一般 1.0 | `ghost_6` | 地獄閻羅 | 閻羅令牌 | 閻羅裁決 |
| T6 | 一般 1.2 | `ghost_t6_normal_b` | 幽界鎮將 | 幽界戰印 | 六道鎮陣 |
| T6 | 小王 A | `ghost_t6_mini_a` | 巡夜天燈聖使 | 聖燈核心 | 星海長明 |
| T6 | 小王 B | `ghost_t6_mini_b` | 星霧影侯 | 星霧王披 | 星霧封天 |
| T6 | 大王 | `ghost_t6_boss` | 鎮界靈將・輪迴 | 輪迴王令 | 六界鎮星 |

## 山林族（mountain）

| Tier | 類型 | Monster ID | 怪物名稱 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `mountain_t1_normal_a` | 苔角幼靈 | 青苔小角 | 苔徑躍步 |
| T1 | 一般 1.0 | `mountain_1` | 山豬精 | 山豬獠牙 | 山豬衝撞 |
| T1 | 一般 1.2 | `mountain_t1_normal_b` | 山徑石衛 | 山徑石牌 | 碎石推進 |
| T1 | 小王 A | `mountain_t1_mini_a` | 石角幼衛 | 石角護片 | 石角突進 |
| T1 | 小王 B | `mountain_t1_mini_b` | 森風學徒 | 森風箭羽 | 逐風連射 |
| T1 | 大王 | `mountain_t1_boss` | 雲嶺龍王・初醒 | 初醒雲鱗 | 幼龍震谷 |
| T2 | 一般 0.8 | `mountain_t2_normal_a` | 溪谷風蛇 | 溪風蛇鱗 | 溪風纏繞 |
| T2 | 一般 1.0 | `mountain_2` | 百步蛇王 | 百步蛇毒囊 | 百步毒襲 |
| T2 | 一般 1.2 | `mountain_t2_normal_b` | 岩甲山衛 | 岩甲背片 | 岩壁固守 |
| T2 | 小王 A | `mountain_t2_mini_a` | 石角斥候 | 斥候角環 | 岩徑追擊 |
| T2 | 小王 B | `mountain_t2_mini_b` | 巡林獵手 | 巡林羽飾 | 林間齊射 |
| T2 | 大王 | `mountain_t2_boss` | 雲嶺龍王・聚雲 | 聚雲逆鱗 | 聚雲吐息 |
| T3 | 一般 0.8 | `mountain_t3_normal_a` | 松風狐靈 | 松風尾羽 | 松影閃身 |
| T3 | 一般 1.0 | `mountain_3` | 山魈 | 山魈幻影石 | 山魈幻步 |
| T3 | 一般 1.2 | `mountain_t3_normal_b` | 古木守衛 | 古木心片 | 根脈封路 |
| T3 | 小王 A | `mountain_t3_mini_a` | 石角戰衛 | 戰衛石鎧 | 石角破陣 |
| T3 | 小王 B | `mountain_t3_mini_b` | 森語獵師 | 森語弦線 | 森語標記 |
| T3 | 大王 | `mountain_t3_boss` | 雲嶺龍王・喚雨 | 喚雨龍珠 | 雨幕龍息 |
| T4 | 一般 0.8 | `mountain_t4_normal_a` | 雲霧石童 | 雲霧石鈴 | 霧石翻滾 |
| T4 | 一般 1.0 | `mountain_4` | 霧社巨人 | 霧社巨石 | 霧嶺踏擊 |
| T4 | 一般 1.2 | `mountain_t4_normal_b` | 峰脊巨衛 | 峰脊肩岩 | 山脊震落 |
| T4 | 小王 A | `mountain_t4_mini_a` | 石角將軍 | 將軍岩印 | 崩岩號令 |
| T4 | 小王 B | `mountain_t4_mini_b` | 霧峰獵將 | 霧峰瞄具 | 穿霧狙擊 |
| T4 | 大王 | `mountain_t4_boss` | 雲嶺龍王・震嶺 | 震嶺龍角 | 龍威震岳 |
| T5 | 一般 0.8 | `mountain_t5_normal_a` | 蜜果熊靈 | 蜜果護爪 | 蜜香拍擊 |
| T5 | 一般 1.0 | `mountain_5` | 食人巨熊 | 巨熊利爪 | 巨熊裂木 |
| T5 | 一般 1.2 | `mountain_t5_normal_b` | 雪峰戰熊 | 雪峰胸甲 | 雪崩熊掌 |
| T5 | 小王 A | `mountain_t5_mini_a` | 石角山君 | 山君冠角 | 萬岩奔流 |
| T5 | 小王 B | `mountain_t5_mini_b` | 天林獵侯 | 天林獵章 | 百羽封山 |
| T5 | 大王 | `mountain_t5_boss` | 雲嶺龍王・凌霄 | 凌霄雲冠 | 凌霄龍捲 |
| T6 | 一般 0.8 | `mountain_t6_normal_a` | 潭光幼蛟 | 潭光幼鱗 | 潭光水環 |
| T6 | 一般 1.0 | `mountain_6` | 深山惡蛟 | 惡蛟逆鱗 | 深潭風雨 |
| T6 | 一般 1.2 | `mountain_t6_normal_b` | 天嶺龍衛 | 天嶺戰鱗 | 天嶺龍陣 |
| T6 | 小王 A | `mountain_t6_mini_a` | 石角聖衛 | 聖衛山核 | 萬岳鎮守 |
| T6 | 小王 B | `mountain_t6_mini_b` | 森風聖獵 | 聖獵星羽 | 天風追星 |
| T6 | 大王 | `mountain_t6_boss` | 雲嶺龍王・天穹 | 天穹龍心 | 天穹覆嶺 |

## 毒蟲族（insect）

| Tier | 類型 | Monster ID | 怪物名稱 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `insect_t1_normal_a` | 露珠瓢蟲 | 露珠翅殼 | 露珠彈跳 |
| T1 | 一般 1.0 | `insect_1` | 大蟑螂 | 蟑螂觸角 | 疾走突襲 |
| T1 | 一般 1.2 | `insect_t1_normal_b` | 鐵殼甲蟲 | 鐵殼背甲 | 甲殼衝鋒 |
| T1 | 小王 A | `insect_t1_mini_a` | 甲衛侍從 | 侍從甲片 | 小盾猛進 |
| T1 | 小王 B | `insect_t1_mini_b` | 花翼斥候 | 花翼粉塵 | 花粉飛襲 |
| T1 | 大王 | `insect_t1_boss` | 萬翼蟲皇・萌芽 | 萌芽王翅 | 萬翼初鳴 |
| T2 | 一般 0.8 | `insect_t2_normal_a` | 花粉蜂靈 | 花粉蜜晶 | 蜜光迴旋 |
| T2 | 一般 1.0 | `insect_2` | 虎頭蜂 | 虎頭蜂刺 | 蜂王突刺 |
| T2 | 一般 1.2 | `insect_t2_normal_b` | 金甲蜂衛 | 金甲腹片 | 金蜂穿列 |
| T2 | 小王 A | `insect_t2_mini_a` | 甲衛騎手 | 騎手鞍甲 | 甲騎突列 |
| T2 | 小王 B | `insect_t2_mini_b` | 蜂翼偵察 | 偵察翼膜 | 蜂翼標記 |
| T2 | 大王 | `insect_t2_boss` | 萬翼蟲皇・展翼 | 展翼王粉 | 百翼風旋 |
| T3 | 一般 0.8 | `insect_t3_normal_a` | 絲葉幼蠶 | 絲葉繭線 | 柔絲纏足 |
| T3 | 一般 1.0 | `insect_3` | 蜈蚣精 | 蜈蚣百腳 | 百足連擊 |
| T3 | 一般 1.2 | `insect_t3_normal_b` | 百節甲衛 | 百節護片 | 節甲封路 |
| T3 | 小王 A | `insect_t3_mini_a` | 甲衛騎士 | 騎士胸甲 | 鐵甲貫陣 |
| T3 | 小王 B | `insect_t3_mini_b` | 毒翼遊俠 | 遊俠尾羽 | 毒羽追射 |
| T3 | 大王 | `insect_t3_boss` | 萬翼蟲皇・千翅 | 千翅王紋 | 千翅風暴 |
| T4 | 一般 0.8 | `insect_t4_normal_a` | 晶尾小蠍 | 晶尾碎片 | 晶尾點刺 |
| T4 | 一般 1.0 | `insect_4` | 蠍子王 | 蠍王毒刺 | 蠍王橫掃 |
| T4 | 一般 1.2 | `insect_t4_normal_b` | 赤甲戰蠍 | 赤甲尾鎧 | 赤尾破盾 |
| T4 | 小王 A | `insect_t4_mini_a` | 甲衛隊長 | 隊長甲章 | 甲衛列陣 |
| T4 | 小王 B | `insect_t4_mini_b` | 雷翼斥候 | 雷翼導片 | 雷羽俯衝 |
| T4 | 大王 | `insect_t4_boss` | 萬翼蟲皇・天幕 | 天幕翼晶 | 蟲翼蔽空 |
| T5 | 一般 0.8 | `insect_t5_normal_a` | 月紋蛛靈 | 月紋絲球 | 月絲牽引 |
| T5 | 一般 1.0 | `insect_5` | 蜘蛛女王 | 蛛后毒腺 | 命運蛛網 |
| T5 | 一般 1.2 | `insect_t5_normal_b` | 天網蛛衛 | 天網絲軸 | 天網封陣 |
| T5 | 小王 A | `insect_t5_mini_a` | 甲衛侯爵 | 侯爵金甲 | 金甲號令 |
| T5 | 小王 B | `insect_t5_mini_b` | 王翼獵將 | 王翼獵章 | 王翼追獵 |
| T5 | 大王 | `insect_t5_boss` | 萬翼蟲皇・王座 | 王座翅冠 | 萬翼朝王 |
| T6 | 一般 0.8 | `insect_t6_normal_a` | 星翼蝶使 | 星翼蝶粉 | 星粉幻舞 |
| T6 | 一般 1.0 | `insect_6` | 蟲神 | 蟲神核心 | 萬蟲朝聖 |
| T6 | 一般 1.2 | `insect_t6_normal_b` | 萬甲蟲衛 | 萬甲核心 | 萬甲天壁 |
| T6 | 小王 A | `insect_t6_mini_a` | 甲衛聖騎 | 聖騎神甲 | 聖甲天征 |
| T6 | 小王 B | `insect_t6_mini_b` | 神翼斥候 | 神翼星羽 | 神翼穿星 |
| T6 | 大王 | `insect_t6_boss` | 萬翼蟲皇・神話 | 神話翼心 | 萬翼天穹 |

## 職場族（workplace）

| Tier | 類型 | Monster ID | 怪物名稱 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `workplace_t1_normal_a` | 跑腿紙偶 | 跑腿便條 | 急件飛送 |
| T1 | 一般 1.0 | `workplace_1` | 奧客 | 投訴書 | 客訴連發 |
| T1 | 一般 1.2 | `workplace_t1_normal_b` | 櫃台鐵衛 | 櫃台名牌 | 排隊封鎖 |
| T1 | 小王 A | `workplace_t1_mini_a` | 工坊助理 | 助理工具扣 | 工具快打 |
| T1 | 小王 B | `workplace_t1_mini_b` | 見習執行員 | 見習契約角 | 紅印追件 |
| T1 | 大王 | `workplace_t1_boss` | 黃金契約王・草約 | 草約金頁 | 契約初令 |
| T2 | 一般 0.8 | `workplace_t2_normal_a` | 咖啡信使 | 香氣咖啡豆 | 醒腦飛杯 |
| T2 | 一般 1.0 | `workplace_2` | 爛主管 | PUA語錄 | 話術施壓 |
| T2 | 一般 1.2 | `workplace_t2_normal_b` | 會議守衛 | 會議時鐘 | 延時議程 |
| T2 | 小王 A | `workplace_t2_mini_a` | 工坊監督 | 監督銅哨 | 工序號令 |
| T2 | 小王 B | `workplace_t2_mini_b` | 契約執行員 | 執行紅印 | 限期執行 |
| T2 | 大王 | `workplace_t2_boss` | 黃金契約王・定稿 | 定稿金墨 | 定稿封令 |
| T3 | 一般 0.8 | `workplace_t3_normal_a` | 報表小精靈 | 報表光頁 | 數字飛散 |
| T3 | 一般 1.0 | `workplace_3` | 壞老闆 | 空頭支票 | 畫餅攻勢 |
| T3 | 一般 1.2 | `workplace_t3_normal_b` | 契約稽核官 | 稽核鏡片 | 條款掃描 |
| T3 | 小王 A | `workplace_t3_mini_a` | 工坊主任 | 主任齒章 | 工坊輪轉 |
| T3 | 小王 B | `workplace_t3_mini_b` | 契約審核官 | 審核銀印 | 條文封步 |
| T3 | 大王 | `workplace_t3_boss` | 黃金契約王・封印 | 封印金章 | 黃金蓋印 |
| T4 | 一般 0.8 | `workplace_t4_normal_a` | 租屋信差 | 租約信封 | 漲租快遞 |
| T4 | 一般 1.0 | `workplace_4` | 黑心包租婆 | 漲租通知 | 租約追擊 |
| T4 | 一般 1.2 | `workplace_t4_normal_b` | 大樓管理將 | 管理金鑰 | 門禁封陣 |
| T4 | 小王 A | `workplace_t4_mini_a` | 工坊總監 | 總監量尺 | 產線壓陣 |
| T4 | 小王 B | `workplace_t4_mini_b` | 契約裁定官 | 裁定金筆 | 裁定紅線 |
| T4 | 大王 | `workplace_t4_boss` | 黃金契約王・王令 | 王令金紙 | 王令追繳 |
| T5 | 一般 0.8 | `workplace_t5_normal_a` | 金章秘書 | 金章緞帶 | 行程排滿 |
| T5 | 一般 1.0 | `workplace_5` | 財閥總裁 | 財閥印章 | 財閥號令 |
| T5 | 一般 1.2 | `workplace_t5_normal_b` | 財庫近衛 | 財庫護牌 | 金庫壁壘 |
| T5 | 小王 A | `workplace_t5_mini_a` | 工坊督導 | 督導王尺 | 千工齊作 |
| T5 | 小王 B | `workplace_t5_mini_b` | 首席執行官 | 首席黑印 | 終局執行 |
| T5 | 大王 | `workplace_t5_boss` | 黃金契約王・王座 | 王座金契 | 萬約歸一 |
| T6 | 一般 0.8 | `workplace_t6_normal_a` | 永續文書靈 | 永續卷軸 | 無盡抄錄 |
| T6 | 一般 1.0 | `workplace_6` | 資本魔王 | 資本核心 | 資本洪流 |
| T6 | 一般 1.2 | `workplace_t6_normal_b` | 永續執行官 | 永續徽印 | 永續裁令 |
| T6 | 小王 A | `workplace_t6_mini_a` | 工坊大匠 | 大匠金輪 | 萬機共鳴 |
| T6 | 小王 B | `workplace_t6_mini_b` | 聖印執行官 | 聖印契核 | 天約執行 |
| T6 | 大王 | `workplace_t6_boss` | 黃金契約王・永恆 | 永恆金契 | 永恆工時 |

## 考試族（exam）

| Tier | 類型 | Monster ID | 怪物名稱 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `exam_t1_normal_a` | 鉛筆小精靈 | 星屑筆芯 | 筆尖突刺 |
| T1 | 一般 1.0 | `exam_1` | 小考 | 小考卷 | 臨時抽考 |
| T1 | 一般 1.2 | `exam_t1_normal_b` | 方格答題兵 | 方格紙片 | 方格列陣 |
| T1 | 小王 A | `exam_t1_mini_a` | 見習卷軸考官 | 見習考官章 | 開卷點名 |
| T1 | 小王 B | `exam_t1_mini_b` | 加法守門員 | 加法算珠 | 加總封門 |
| T1 | 大王 | `exam_t1_boss` | 試煉大賢者・啟蒙 | 啟蒙賢者印 | 啟蒙試煉陣 |
| T2 | 一般 0.8 | `exam_t2_normal_a` | 筆記紙鶴 | 摺頁筆記 | 紙鶴傳題 |
| T2 | 一般 1.0 | `exam_2` | 段考 | 段考筆記 | 範圍擴張 |
| T2 | 一般 1.2 | `exam_t2_normal_b` | 選擇題劍士 | 選項徽片 | 四選突擊 |
| T2 | 小王 A | `exam_t2_mini_a` | 銀羽卷軸考官 | 銀羽考官章 | 銀羽閱卷 |
| T2 | 小王 B | `exam_t2_mini_b` | 乘法守門員 | 乘法算珠 | 倍數屏障 |
| T2 | 大王 | `exam_t2_boss` | 試煉大賢者・博聞 | 博聞賢者印 | 百卷問答陣 |
| T3 | 一般 0.8 | `exam_t3_normal_a` | 墨水書靈 | 靈墨小瓶 | 墨跡追題 |
| T3 | 一般 1.0 | `exam_3` | 期末考 | 期末考卷 | 全科突襲 |
| T3 | 一般 1.2 | `exam_t3_normal_b` | 幾何圓規騎士 | 幾何銀針 | 圓弧封鎖 |
| T3 | 小王 A | `exam_t3_mini_a` | 藍紋卷軸考官 | 藍紋考官章 | 藍卷追問 |
| T3 | 小王 B | `exam_t3_mini_b` | 分數守門員 | 分數晶板 | 分割結界 |
| T3 | 大王 | `exam_t3_boss` | 試煉大賢者・萬卷 | 萬卷賢者印 | 萬卷迴廊 |
| T4 | 一般 0.8 | `exam_t4_normal_a` | 星圖尺精靈 | 星圖刻度 | 星線定位 |
| T4 | 一般 1.0 | `exam_4` | 學測魔王 | 學測准考證 | 倒數鐘聲 |
| T4 | 一般 1.2 | `exam_t4_normal_b` | 答題卡重衛 | 答題晶片 | 黑格盾陣 |
| T4 | 小王 A | `exam_t4_mini_a` | 金印卷軸考官 | 金印考官章 | 金印封卷 |
| T4 | 小王 B | `exam_t4_mini_b` | 方程守門員 | 方程符石 | 未知數牢籠 |
| T4 | 大王 | `exam_t4_boss` | 試煉大賢者・星算 | 星算賢者印 | 星算天盤 |
| T5 | 一般 0.8 | `exam_t5_normal_a` | 榮譽徽章靈 | 榮譽緞帶 | 榮光鼓舞 |
| T5 | 一般 1.0 | `exam_5` | 國考煉獄 | 國考證書 | 長年試煉 |
| T5 | 一般 1.2 | `exam_t5_normal_b` | 知識聖典衛 | 聖典書扣 | 聖典鎮頁 |
| T5 | 小王 A | `exam_t5_mini_a` | 王立卷軸考官 | 王立考官章 | 王立裁卷 |
| T5 | 小王 B | `exam_t5_mini_b` | 函數守門員 | 函數星盤 | 曲線迷宮 |
| T5 | 大王 | `exam_t5_boss` | 試煉大賢者・真知 | 真知賢者印 | 真知裁問 |
| T6 | 一般 0.8 | `exam_t6_normal_a` | 天穹羽筆使 | 天穹羽尖 | 天書疾筆 |
| T6 | 一般 1.0 | `exam_6` | 升學制度本體 | 升學制度碎片 | 制度迷宮 |
| T6 | 一般 1.2 | `exam_t6_normal_b` | 星界典籍將 | 星界書脊 | 星典鎮界 |
| T6 | 小王 A | `exam_t6_mini_a` | 天命卷軸考官 | 天命考官章 | 天命終卷 |
| T6 | 小王 B | `exam_t6_mini_b` | 無限算式守門員 | 無限算環 | 無限推演 |
| T6 | 大王 | `exam_t6_boss` | 試煉大賢者・全知 | 全知賢者冠 | 全知終極試煉 |

## 西方怪物族（temple）

| Tier | 類型 | Monster ID | 怪物名稱 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `temple_t1_normal_a` | 蘑菇帽小妖 | 斑點帽片 | 蘑菇彈跳 |
| T1 | 一般 1.0 | `temple_1` | 哥布林 | 哥布林金牙 | 金牙突襲 |
| T1 | 一般 1.2 | `temple_t1_normal_b` | 木盾地精兵 | 橡木盾片 | 木盾推進 |
| T1 | 小王 A | `temple_t1_mini_a` | 城堡見習先鋒 | 見習先鋒章 | 先鋒衝陣 |
| T1 | 小王 B | `temple_t1_mini_b` | 學徒符文法衛 | 初刻符石 | 符文光彈 |
| T1 | 大王 | `temple_t1_boss` | 天穹龍皇・幼翼 | 幼翼龍冠片 | 幼龍翔擊 |
| T2 | 一般 0.8 | `temple_t2_normal_a` | 鎧甲小靈 | 空心鎧片 | 鎧甲迴旋 |
| T2 | 一般 1.0 | `temple_2` | 骷髏劍士 | 碎骨片 | 月光劍舞 |
| T2 | 一般 1.2 | `temple_t2_normal_b` | 石塔長槍兵 | 石塔槍尖 | 長槍封路 |
| T2 | 小王 A | `temple_t2_mini_a` | 銀盾城堡先鋒 | 銀盾先鋒章 | 銀盾突進 |
| T2 | 小王 B | `temple_t2_mini_b` | 青紋符文法衛 | 青紋符石 | 青紋屏障 |
| T2 | 大王 | `temple_t2_boss` | 天穹龍皇・振翼 | 振翼龍冠片 | 振翼風壓 |
| T3 | 一般 0.8 | `temple_t3_normal_a` | 月影狐靈 | 月影尾毛 | 月影疾行 |
| T3 | 一般 1.0 | `temple_3` | 狼人 | 狼人之爪 | 月下追獵 |
| T3 | 一般 1.2 | `temple_t3_normal_b` | 獅鷲斥候 | 獅鷲羽片 | 高空俯衝 |
| T3 | 小王 A | `temple_t3_mini_a` | 月堡城堡先鋒 | 月堡先鋒章 | 月堡連斬 |
| T3 | 小王 B | `temple_t3_mini_b` | 雷紋符文法衛 | 雷紋符石 | 雷紋鎖鏈 |
| T3 | 大王 | `temple_t3_boss` | 天穹龍皇・蒼翼 | 蒼翼龍冠片 | 蒼翼旋風 |
| T4 | 一般 0.8 | `temple_t4_normal_a` | 夜宴蝙蝠侍 | 夜宴緞帶 | 緞帶旋舞 |
| T4 | 一般 1.0 | `temple_4` | 吸血鬼伯爵 | 吸血鬼獠牙 | 紅月禮劍 |
| T4 | 一般 1.2 | `temple_t4_normal_b` | 古堡薔薇騎士 | 銀薔薇章 | 薔薇劍陣 |
| T4 | 小王 A | `temple_t4_mini_a` | 王家城堡先鋒 | 王家先鋒章 | 王旗衝鋒 |
| T4 | 小王 B | `temple_t4_mini_b` | 炎紋符文法衛 | 炎紋符石 | 炎紋法環 |
| T4 | 大王 | `temple_t4_boss` | 天穹龍皇・熾翼 | 熾翼龍冠片 | 熾翼吐息 |
| T5 | 一般 0.8 | `temple_t5_normal_a` | 星袍書靈 | 星袍布片 | 星頁飛舞 |
| T5 | 一般 1.0 | `temple_5` | 巫妖王 | 巫妖魔法書 | 王座秘法 |
| T5 | 一般 1.2 | `temple_t5_normal_b` | 奧術塔守衛 | 奧術晶核 | 奧術壁壘 |
| T5 | 小王 A | `temple_t5_mini_a` | 聖冠城堡先鋒 | 聖冠先鋒章 | 聖冠破陣 |
| T5 | 小王 B | `temple_t5_mini_b` | 星紋符文法衛 | 星紋符石 | 星紋天幕 |
| T5 | 大王 | `temple_t5_boss` | 天穹龍皇・星翼 | 星翼龍冠片 | 星翼流光 |
| T6 | 一般 0.8 | `temple_t6_normal_a` | 天空島風靈 | 天空風晶 | 雲端推進 |
| T6 | 一般 1.0 | `temple_6` | 末日惡龍 | 末日龍鱗 | 末日龍息 |
| T6 | 一般 1.2 | `temple_t6_normal_b` | 神話聖劍將 | 神話劍晶 | 聖劍開天 |
| T6 | 小王 A | `temple_t6_mini_a` | 天穹城堡先鋒 | 天穹先鋒章 | 天穹遠征 |
| T6 | 小王 B | `temple_t6_mini_b` | 神域符文法衛 | 神域符石 | 神域封界 |
| T6 | 大王 | `temple_t6_boss` | 天穹龍皇・帝翼 | 帝翼龍冠 | 帝翼星隕 |

## 寶箱族（treasure）

> 既有寶箱怪、小王與大王名稱不改；括號內為新版卡面稱號，不參與舊資料識別。安分寶箱怪保留不主動反擊的特色，王怪仍只出現在地下城 BOSS 房。

| Tier | 類型 | Monster ID | 怪物名稱／稱號 | 專屬素材 | 招牌技能 |
|---|---|---|---|---|---|
| T1 | 一般 0.8 | `treasure_1_real` | 安分寶箱怪 | 舊木鎖片 | 安靜藏寶 |
| T1 | 一般 1.0 | `treasure_1` | 寶箱怪 | 活木箱扣 | 箱蓋反彈 |
| T1 | 一般 1.2 | `treasure_t1_normal_b` | 木庫寶箱守衛 | 木庫護鎖 | 木箱衝撞 |
| T1 | 小王 A | `treasure_king_small_1` | 寶箱小王（銅鎖領主） | 銅鎖王印 | 銅鎖號令 |
| T1 | 小王 B | `treasure_t1_mini_b` | 原石寶石魔偶 | 原石魔偶核 | 原石重拳 |
| T1 | 大王 | `treasure_king_big_1` | 寶箱大王（王冠木庫） | 木庫王核 | 王庫震地 |
| T2 | 一般 0.8 | `treasure_2_real` | 安分黃金寶箱怪 | 溫金鎖片 | 金光藏寶 |
| T2 | 一般 1.0 | `treasure_2` | 黃金寶箱怪 | 黃金箱扣 | 金幣飛散 |
| T2 | 一般 1.2 | `treasure_t2_normal_b` | 黃金寶箱守衛 | 黃金護鎖 | 金庫推進 |
| T2 | 小王 A | `treasure_king_small_2` | 寶箱小王（銀鎖領主） | 銀鎖王印 | 銀鎖封門 |
| T2 | 小王 B | `treasure_t2_mini_b` | 琥珀寶石魔偶 | 琥珀魔偶核 | 琥珀震波 |
| T2 | 大王 | `treasure_king_big_2` | 寶箱大王（王冠金庫） | 金庫王核 | 王庫金雨 |
| T3 | 一般 0.8 | `treasure_3_real` | 安分鑽石寶箱怪 | 柔光鑽片 | 鑽光藏寶 |
| T3 | 一般 1.0 | `treasure_3` | 鑽石寶箱怪 | 鑽石箱扣 | 鑽光折射 |
| T3 | 一般 1.2 | `treasure_t3_normal_b` | 鑽晶寶箱守衛 | 鑽晶護鎖 | 晶盾衝鋒 |
| T3 | 小王 A | `treasure_king_small_3` | 寶箱小王（晶鎖領主） | 晶鎖王印 | 晶鎖結界 |
| T3 | 小王 B | `treasure_t3_mini_b` | 藍晶寶石魔偶 | 藍晶魔偶核 | 藍晶脈衝 |
| T3 | 大王 | `treasure_king_big_3` | 寶箱大王（王冠晶庫） | 晶庫王核 | 王庫折光 |
| T4 | 一般 0.8 | `treasure_4_real` | 安分祕銀寶箱怪 | 溫潤祕銀片 | 祕銀藏寶 |
| T4 | 一般 1.0 | `treasure_4` | 祕銀寶箱怪 | 祕銀箱扣 | 祕銀壁壘 |
| T4 | 一般 1.2 | `treasure_t4_normal_b` | 祕銀寶箱守衛 | 祕銀護鎖 | 銀壁推進 |
| T4 | 小王 A | `treasure_king_small_4` | 寶箱小王（祕銀領主） | 祕銀王印 | 祕銀封庫 |
| T4 | 小王 B | `treasure_t4_mini_b` | 紫晶寶石魔偶 | 紫晶魔偶核 | 紫晶重壓 |
| T4 | 大王 | `treasure_king_big_4` | 寶箱大王（王冠祕庫） | 祕庫王核 | 王庫銀牆 |
| T5 | 一般 0.8 | `treasure_5_real` | 安分遠古寶箱怪 | 古舊符鎖 | 古庫藏寶 |
| T5 | 一般 1.0 | `treasure_5` | 遠古寶箱怪 | 遠古箱扣 | 古代機關 |
| T5 | 一般 1.2 | `treasure_t5_normal_b` | 遠古寶箱守衛 | 遠古護鎖 | 古庫鎮守 |
| T5 | 小王 A | `treasure_king_small_5` | 寶箱小王（遠古領主） | 遠古王印 | 遠古封印 |
| T5 | 小王 B | `treasure_t5_mini_b` | 星鑽寶石魔偶 | 星鑽魔偶核 | 星鑽墜擊 |
| T5 | 大王 | `treasure_king_big_5` | 寶箱大王（王冠古庫） | 古庫王核 | 王庫星震 |
| T6 | 一般 0.8 | `treasure_6_real` | 安分神話寶箱巨像 | 神話靜默鎖 | 神庫藏寶 |
| T6 | 一般 1.0 | `treasure_6` | 神話寶箱巨像 | 神話箱核 | 神話金流 |
| T6 | 一般 1.2 | `treasure_t6_normal_b` | 神話寶箱守衛 | 神話護鎖 | 神庫進軍 |
| T6 | 小王 A | `treasure_king_small_6` | 寶箱小王（神話領主） | 神話王印 | 神話封庫 |
| T6 | 小王 B | `treasure_t6_mini_b` | 虹彩寶石魔偶 | 虹彩魔偶核 | 虹彩星爆 |
| T6 | 大王 | `treasure_king_big_6` | 寶箱大王（王冠神庫） | 神庫王核 | 王庫天降 |
