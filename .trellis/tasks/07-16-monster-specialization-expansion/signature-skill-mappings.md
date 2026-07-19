# Signature skill mappings

本表中的傷害「基準」引用 `monster-skill-catalog.md` 的 Tier／怪物類型倍率。共用欄位一個 ID 代表一般怪配置；兩個 ID 代表小王／大王的 A、B 技能。所有招牌技能使用 `sig_{monsterId}`，動畫使用 `anim_sig_{monsterId}`；預告必須顯示技能名、主要效果及破解門檻。

## 鬼怪族（ghost）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `ghost_t1_normal_a` | `common_weakpoint` | 引燈閃身：基準×0.9；命中後玩家 ATK-5% 1回合 | 射向燈光，70% 以上取消弱化 |
| `ghost_1` | `common_charge` | 供品分享：無傷害；自身護盾=最大HP 5% | 擊中供品光點可破盾 |
| `ghost_t1_normal_b` | `common_weaken` | 星霧推進：基準傷害 | 星霧聚成箭頭時射散 |
| `ghost_t1_mini_a` | `common_charge`,`common_weakpoint` | 導光突進：小王基準，無視防禦10% | 追準移動燈標可削弱突進 |
| `ghost_t1_mini_b` | `common_armor`,`common_weaken` | 霧步封路：小王基準×0.9＋ATK-5% 1回合 | 打亮霧中三個足印 |
| `ghost_t1_boss` | `common_charge`,`common_armor` | 鎮界光陣：大王基準＋自身護盾5% | 擊破三枚光印；70% HP護盾量+2%，40% HP技能傷害+5% |
| `ghost_t2_normal_a` | `common_weakpoint` | 回光引路：基準×0.9；下次高品質箭傷害+10% | 70% 以上同時取消怪物下次反擊增幅 |
| `ghost_2` | `common_weaken` | 迷霧繞路：基準×0.9＋ATK-5% 1回合 | 命中霧中路標可清除弱化 |
| `ghost_t2_normal_b` | `common_charge` | 迴廊封鎖：基準＋DEF-5% 1回合 | 依序擊中發亮門框 |
| `ghost_t2_mini_a` | `common_charge`,`common_stance` | 引燈追影：2段攻擊，總倍率=小王基準 | 兩個燈標各需一次有效命中 |
| `ghost_t2_mini_b` | `common_armor`,`common_weaken` | 霧行截步：小王基準×0.9＋ATK-5% 1回合 | 霧散前達70%可取消狀態 |
| `ghost_t2_boss` | `common_charge`,`common_armor` | 四方巡界：大王基準，無視護盾10% | 四方光印逐一亮起；70% HP減傷+5%，40% HP無視護盾再+5% |
| `ghost_t3_normal_a` | `common_cleanse` | 花霧旋舞：基準×0.9＋DEF-5% 1回合 | 擊中花瓣中心取消降防 |
| `ghost_3` | `common_poison` | 林投葉陣：2段攻擊，總倍率=基準 | 兩片葉標皆達有效品質可大幅削弱 |
| `ghost_t3_normal_b` | `common_shock` | 葉影連斬：2段攻擊，總倍率=基準×1.05 | 連續高品質命中可切斷第二段 |
| `ghost_t3_mini_a` | `common_charge`,`common_cleanse` | 百燈護行：小王基準＋自身護盾7% | 燈列完成前達70%可取消護盾 |
| `ghost_t3_mini_b` | `common_armor`,`common_shock` | 青影封徑：小王基準×0.9＋DEF-8% 1回合 | 擊中青葉符印取消降防 |
| `ghost_t3_boss` | `common_reflect`,`common_cleanse` | 森羅列陣：大王基準＋減傷10% 1回合 | 破解中央令旗；70% HP獲一次5%護盾，40% HP多段總傷+5% |
| `ghost_t4_normal_a` | `common_cleanse` | 墨令飛卷：基準＋ATK-8% 1回合 | 射中墨字而非卷軸邊緣 |
| `ghost_4` | `common_stance` | 城隍判令：基準＋指定9分以上挑戰；完成則本回合玩家傷害+10% | 9分以上箭數達本回合一半即破解 |
| `ghost_t4_normal_b` | `common_shock` | 巡界喝止：基準＋DEF-8% 1回合 | 口令光圈收束前達70% |
| `ghost_t4_mini_a` | `common_charge`,`common_cleanse` | 萬戶點燈：3段攻擊，總倍率=小王基準×1.05 | 每盞燈對應一段，品質越高取消越多段 |
| `ghost_t4_mini_b` | `common_armor`,`common_reflect` | 影令鎖陣：小王基準×0.9＋ATK-8% 2回合 | 完整破解斬斷影鎖；部分破解縮為1回合 |
| `ghost_t4_boss` | `common_reflect`,`common_cleanse` | 天平裁界：大王基準；較低的玩家ATK或DEF再-8% 1回合 | 讓左右天平品質差≤10%；70% HP反射+3%，40% HP狀態幅度+2% |
| `ghost_t5_normal_a` | `common_regen` | 護主追光：基準×0.9＋自身護盾7% | 兩次9分以上可取消護盾 |
| `ghost_5` | `common_stance` | 忠義鎮守：基準＋減傷15% 1回合 | 擊中忠義徽印取消減傷 |
| `ghost_t5_normal_b` | `common_weaken` | 願火護陣：基準＋ATK-10% 2回合 | 擊散三簇願火；部分破解縮為1回合 |
| `ghost_t5_mini_a` | `common_charge`,`common_regen` | 天燈照夜：小王基準，無視防禦15% | 天燈升頂前累積70%可取消穿透 |
| `ghost_t5_mini_b` | `common_reflect`,`common_weaken` | 萬願影陣：小王基準×0.9＋ATK-10% 2回合 | 依序命中三枚願印 |
| `ghost_t5_boss` | `common_regen`,`common_reflect` | 王令鎮域：大王基準＋減傷20% 1回合 | 擊碎王令四角；70% HP護盾10%，40% HP基準傷害+8% |
| `ghost_t6_normal_a` | `common_cleanse` | 星輪迴轉：2段攻擊，總倍率=基準＋DEF-10% 1回合 | 兩個星輪各需高品質命中 |
| `ghost_6` | `common_regen` | 地府輪迴：基準＋延遲攻擊基準×0.5於下回合 | 顯示一回合倒數；完整破解取消延遲段 |
| `ghost_t6_normal_b` | `common_shock` | 神印鎮界：基準，無視護盾10% | 擊中神印核心取消穿盾 |
| `ghost_t6_mini_a` | `common_charge`,`common_regen` | 天燈照世：3段攻擊，總倍率=小王基準×1.1 | 三枚天燈依命中品質逐段取消 |
| `ghost_t6_mini_b` | `common_reflect`,`common_cleanse` | 神火影陣：小王基準×0.9＋DEF-10% 2回合 | 神火環縮小前達70% |
| `ghost_t6_boss` | `common_regen`,`common_reflect` | 輪迴天命：大王基準＋延遲攻擊大王基準×0.6 | 明示輪迴倒數；70% HP減傷10%，40% HP延遲段+10%，仍可完整破解 |

## 山林族（mountain）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `mountain_t1_normal_a` | `common_weakpoint` | 苔徑躍步：基準×0.9；自身減傷10% 1回合 | 擊中苔石落點取消減傷 |
| `mountain_1` | `common_charge` | 山豬衝撞：基準傷害 | 衝撞線亮起時累積70%可大幅削弱 |
| `mountain_t1_normal_b` | `common_armor` | 碎石推進：基準＋DEF-5% 1回合 | 擊碎三顆發亮碎石取消降防 |
| `mountain_t1_mini_a` | `common_charge`,`common_stance` | 石角突進：小王基準，無視防禦10% | 射中石角光點取消穿透 |
| `mountain_t1_mini_b` | `common_armor`,`common_weakpoint` | 逐風連射：2段攻擊，總倍率=小王基準 | 兩枚風羽各對應一段攻擊 |
| `mountain_t1_boss` | `common_charge`,`common_armor` | 幼龍震谷：大王基準＋DEF-5% 1回合 | 山谷光環收束前破解；70% HP護盾+2%，40% HP傷害+5% |
| `mountain_t2_normal_a` | `common_weaken` | 溪風纏繞：基準×0.9＋ATK-5% 1回合 | 射斷兩道溪風取消弱化 |
| `mountain_2` | `common_poison` | 百步毒襲：基準＋最大HP 2%毒傷1回合 | 擊中毒光囊取消毒傷 |
| `mountain_t2_normal_b` | `common_armor` | 岩壁固守：無傷害；護盾=最大HP 5%＋減傷10% 1回合 | 擊中岩壁裂紋；不得同時獲得回復 |
| `mountain_t2_mini_a` | `common_charge`,`common_stance` | 岩徑追擊：2段攻擊，總倍率=小王基準 | 依序命中兩個岩徑標記 |
| `mountain_t2_mini_b` | `common_armor`,`common_weakpoint` | 林間齊射：小王基準＋ATK-5% 1回合 | 射散三枚風羽取消弱化 |
| `mountain_t2_boss` | `common_charge`,`common_armor` | 聚雲吐息：大王基準，無視護盾10% | 雲團中心亮起時射散；70% HP減傷+5%，40% HP穿盾+5% |
| `mountain_t3_normal_a` | `common_cleanse` | 松影閃身：基準×0.9＋減傷10% 1回合 | 命中真正松影取消減傷 |
| `mountain_3` | `common_stance` | 山魈幻步：2段攻擊，總倍率=基準 | 真身標記命中可取消第二段 |
| `mountain_t3_normal_b` | `common_shock` | 根脈封路：基準×0.9＋DEF-5% 1回合 | 依序命中三個根節取消降防 |
| `mountain_t3_mini_a` | `common_charge`,`common_armor` | 石角破陣：小王基準，無視防禦15% | 擊中角尖取消穿透 |
| `mountain_t3_mini_b` | `common_weakpoint`,`common_cleanse` | 森語標記：小王基準×0.9＋9分以上挑戰；失敗則ATK-8% 1回合 | 當回合半數箭達9分即取消狀態 |
| `mountain_t3_boss` | `common_regen`,`common_armor` | 雨幕龍息：大王基準＋ATK-8% 1回合 | 雨幕三處亮點可被射散；70% HP護盾7%，40% HP多段總傷+5% |
| `mountain_t4_normal_a` | `common_armor` | 霧石翻滾：基準＋減傷15% 1回合 | 擊中翻滾軌跡前端取消減傷 |
| `mountain_4` | `common_shock` | 霧嶺踏擊：基準＋DEF-8% 1回合 | 震波抵達前達70%取消降防 |
| `mountain_t4_normal_b` | `common_charge` | 山脊震落：基準＋延遲攻擊基準×0.4 | 明示落石位置；完整破解取消延遲段 |
| `mountain_t4_mini_a` | `common_charge`,`common_armor` | 崩岩號令：小王基準＋DEF-8% 1回合 | 三面岩旗各需有效命中 |
| `mountain_t4_mini_b` | `common_weakpoint`,`common_cleanse` | 穿霧狙擊：小王基準，無視防禦15% | 霧中瞄準線顯示，擊中光點取消穿透 |
| `mountain_t4_boss` | `common_regen`,`common_armor` | 龍威震岳：大王基準＋DEF-8% 2回合 | 擊碎山形符印；70% HP減傷10%，40% HP狀態幅度+2% |
| `mountain_t5_normal_a` | `common_regen` | 蜜香拍擊：基準×0.9＋自身護盾7% | 擊中蜜果標記取消護盾 |
| `mountain_5` | `common_rage` | 巨熊裂木：基準，無視防禦10% | 木紋裂開前達70%取消穿透 |
| `mountain_t5_normal_b` | `common_charge` | 雪崩熊掌：基準＋延遲攻擊基準×0.5 | 雪坡顯示一回合倒數，完整破解取消 |
| `mountain_t5_mini_a` | `common_rage`,`common_armor` | 萬岩奔流：3段攻擊，總倍率=小王基準×1.05 | 三道岩流依品質逐段取消 |
| `mountain_t5_mini_b` | `common_weakpoint`,`common_cleanse` | 百羽封山：小王基準×0.9＋ATK-10% 2回合 | 擊中三枚主羽；部分破解縮為1回合 |
| `mountain_t5_boss` | `common_regen`,`common_rage` | 凌霄龍捲：大王基準，無視護盾20% | 龍捲眼亮起時可破；70% HP減傷10%，40% HP傷害+8% |
| `mountain_t6_normal_a` | `common_cleanse` | 潭光水環：基準×0.9＋減傷20% 1回合 | 水環閉合前擊中三個光點 |
| `mountain_6` | `common_regen` | 深潭風雨：2段攻擊，總倍率=基準×1.05＋DEF-10% 1回合 | 風眼與雨核各對應一段，完整破解取消狀態 |
| `mountain_t6_normal_b` | `common_armor` | 天嶺龍陣：基準＋護盾10% | 擊碎龍陣三角取消護盾 |
| `mountain_t6_mini_a` | `common_rage`,`common_armor` | 萬岳鎮守：小王基準＋減傷20% 1回合 | 擊中山核取消減傷 |
| `mountain_t6_mini_b` | `common_weakpoint`,`common_cleanse` | 天風追星：3段攻擊，總倍率=小王基準×1.1 | 三枚星羽依命中品質逐段取消 |
| `mountain_t6_boss` | `common_regen`,`common_rage` | 天穹覆嶺：大王基準＋延遲攻擊大王基準×0.6 | 山影倒數一回合；70% HP護盾10%，40% HP延遲段+10%，仍可完整破解 |

## 毒蟲族（insect）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `insect_t1_normal_a` | `common_weakpoint` | 露珠彈跳：基準×0.9；自身減傷10% 1回合 | 擊中露珠落點取消減傷 |
| `insect_1` | `common_charge` | 疾走突襲：基準傷害 | 發光移動線收束前達70% |
| `insect_t1_normal_b` | `common_armor` | 甲殼衝鋒：基準＋護盾5% | 擊中背甲亮點取消護盾 |
| `insect_t1_mini_a` | `common_charge`,`common_armor` | 小盾猛進：小王基準，無視防禦10% | 射中小盾中央取消穿透 |
| `insect_t1_mini_b` | `common_weaken`,`common_weakpoint` | 花粉飛襲：小王基準×0.9＋ATK-5% 1回合 | 擊散三簇彩色花粉 |
| `insect_t1_boss` | `common_charge`,`common_armor` | 萬翼初鳴：大王基準＋DEF-5% 1回合 | 三枚翼紋依序亮起；70% HP護盾+2%，40% HP傷害+5% |
| `insect_t2_normal_a` | `common_weakpoint` | 蜜光迴旋：2段攻擊，總倍率=基準×0.9 | 兩顆蜜光各對應一段 |
| `insect_2` | `common_poison` | 蜂王突刺：基準＋最大HP 2%毒傷1回合 | 擊中尾針光點取消毒傷 |
| `insect_t2_normal_b` | `common_charge` | 金蜂穿列：基準，無視防禦10% | 金色飛行線亮起時破解 |
| `insect_t2_mini_a` | `common_charge`,`common_armor` | 甲騎突列：2段攻擊，總倍率=小王基準 | 前後兩片甲標依品質逐段取消 |
| `insect_t2_mini_b` | `common_weaken`,`common_weakpoint` | 蜂翼標記：小王基準×0.9＋9分以上挑戰；失敗ATK-5% 1回合 | 半數箭達9分取消狀態 |
| `insect_t2_boss` | `common_charge`,`common_armor` | 百翼風旋：3段攻擊，總倍率=大王基準 | 三片主翼各對應一段；70% HP減傷+5%，40% HP總傷+5% |
| `insect_t3_normal_a` | `common_weaken` | 柔絲纏足：基準×0.9＋ATK-5% 1回合 | 擊中兩個絲結取消弱化 |
| `insect_3` | `common_poison` | 百足連擊：3段攻擊，總倍率=基準×1.05 | 三個光節依品質逐段取消 |
| `insect_t3_normal_b` | `common_armor` | 節甲封路：基準×0.9＋減傷10% 1回合 | 擊碎中央節甲取消減傷 |
| `insect_t3_mini_a` | `common_charge`,`common_armor` | 鐵甲貫陣：小王基準，無視防禦15% | 甲縫發亮時命中取消穿透 |
| `insect_t3_mini_b` | `common_poison`,`common_weakpoint` | 毒羽追射：小王基準＋最大HP 3%毒傷1回合 | 擊中彩羽尖端取消毒傷 |
| `insect_t3_boss` | `common_regen`,`common_armor` | 千翅風暴：3段攻擊，總倍率=大王基準×1.05 | 三道翼環逐段破解；70% HP護盾7%，40% HP多段總傷+5% |
| `insect_t4_normal_a` | `common_shock` | 晶尾點刺：基準＋DEF-8% 1回合 | 擊中晶尾光點取消降防 |
| `insect_4` | `common_poison` | 蠍王橫掃：2段攻擊，總倍率=基準＋最大HP 3%毒傷1回合 | 鉗與尾各對應一段，完整破解取消毒傷 |
| `insect_t4_normal_b` | `common_charge` | 赤尾破盾：基準，無視護盾10% | 赤尾蓄光時命中取消穿盾 |
| `insect_t4_mini_a` | `common_armor`,`common_stance` | 甲衛列陣：小王基準＋減傷15% 1回合 | 三面甲盾依序擊破取消減傷 |
| `insect_t4_mini_b` | `common_shock`,`common_weakpoint` | 雷羽俯衝：小王基準＋DEF-8% 1回合 | 雷羽落點顯示後達70% |
| `insect_t4_boss` | `common_reflect`,`common_armor` | 蟲翼蔽空：大王基準＋ATK-8% 2回合 | 擊穿天幕三個光孔；70% HP反射+3%，40% HP狀態幅度+2% |
| `insect_t5_normal_a` | `common_weaken` | 月絲牽引：基準×0.9＋ATK-10% 2回合 | 月絲兩端皆命中；部分破解縮為1回合 |
| `insect_5` | `common_poison` | 命運蛛網：基準＋治療量-15% 2回合 | 擊中蛛網四角取消治療弱化 |
| `insect_t5_normal_b` | `common_armor` | 天網封陣：無傷害；護盾7%＋減傷15% 1回合 | 擊破天網核心，效果依純護盾級距 |
| `insect_t5_mini_a` | `common_rage`,`common_armor` | 金甲號令：小王基準＋護盾7% | 擊中金甲徽章取消護盾 |
| `insect_t5_mini_b` | `common_poison`,`common_weakpoint` | 王翼追獵：2段攻擊，總倍率=小王基準×1.05＋治療量-15% 1回合 | 兩片王翼皆命中可取消狀態 |
| `insect_t5_boss` | `common_regen`,`common_reflect` | 萬翼朝王：大王基準＋延遲攻擊大王基準×0.5 | 翼冠倒數一回合；70% HP護盾10%，40% HP延遲段+8% |
| `insect_t6_normal_a` | `common_cleanse` | 星粉幻舞：基準×0.9＋ATK-10% 2回合 | 擊中三顆主星粉；部分破解縮為1回合 |
| `insect_6` | `common_poison` | 萬蟲朝聖：3段光翼攻擊，總倍率=基準×1.1＋治療量-20% 1回合 | 三個族徽逐段破解，完整破解取消狀態 |
| `insect_t6_normal_b` | `common_armor` | 萬甲天壁：基準×0.9＋護盾10% | 擊碎天壁中央甲核取消護盾 |
| `insect_t6_mini_a` | `common_rage`,`common_armor` | 聖甲天征：小王基準，無視防禦15%＋減傷20% 1回合 | 聖甲十字中心命中可同時取消兩項效果 |
| `insect_t6_mini_b` | `common_poison`,`common_weakpoint` | 神翼穿星：3段攻擊，總倍率=小王基準×1.1，無視護盾20% | 三枚星羽逐段取消，85%取消穿盾 |
| `insect_t6_boss` | `common_regen`,`common_reflect` | 萬翼天穹：大王基準＋治療量-20% 2回合 | 四翼天幕逐一擊破；70% HP反射+3%，40% HP傷害+8%，狀態仍受破解 |

## 職場族（workplace）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `workplace_t1_normal_a` | `common_weakpoint` | 急件飛送：基準×0.9；命中後ATK-5% 1回合 | 射中發亮便條取消弱化 |
| `workplace_1` | `common_weaken` | 客訴連發：2段攻擊，總倍率=基準 | 兩張客訴單各對應一段 |
| `workplace_t1_normal_b` | `common_armor` | 排隊封鎖：基準×0.9＋護盾5% | 擊中隊伍最前方標記取消護盾 |
| `workplace_t1_mini_a` | `common_charge`,`common_stance` | 工具快打：2段攻擊，總倍率=小王基準 | 扳手與木槌圖示各對應一段 |
| `workplace_t1_mini_b` | `common_armor`,`common_weaken` | 紅印追件：小王基準×0.9＋ATK-5% 1回合 | 擊中紅印中央取消弱化 |
| `workplace_t1_boss` | `common_charge`,`common_armor` | 契約初令：大王基準＋DEF-5% 1回合 | 契約三角依序亮起；70% HP護盾+2%，40% HP傷害+5% |
| `workplace_t2_normal_a` | `common_weakpoint` | 醒腦飛杯：基準×0.9；下次高品質箭傷害+10% | 擊中杯緣光圈取得加成並削弱反擊 |
| `workplace_2` | `common_weaken` | 話術施壓：基準×0.9＋ATK-5% 1回合 | 射散三個對話泡泡取消弱化 |
| `workplace_t2_normal_b` | `common_charge` | 延時議程：基準＋延遲攻擊基準×0.35 | 時鐘明示一回合倒數；完整破解取消延遲段 |
| `workplace_t2_mini_a` | `common_charge`,`common_stance` | 工序號令：小王基準＋減傷10% 1回合 | 依正確順序命中三個齒輪 |
| `workplace_t2_mini_b` | `common_armor`,`common_weaken` | 限期執行：小王基準＋ATK-5% 1回合 | 倒數結束前達70%取消狀態 |
| `workplace_t2_boss` | `common_charge`,`common_armor` | 定稿封令：大王基準＋護盾5% | 擊中定稿章四角；70% HP減傷+5%，40% HP護盾+2% |
| `workplace_t3_normal_a` | `common_cleanse` | 數字飛散：3段攻擊，總倍率=基準 | 三個發亮數字依品質逐段取消 |
| `workplace_3` | `common_weaken` | 畫餅攻勢：基準×0.9＋ATK-8% 1回合 | 擊破中央彩色圓餅取消弱化 |
| `workplace_t3_normal_b` | `common_armor` | 條款掃描：基準＋指定9分以上挑戰；失敗DEF-5% 1回合 | 半數箭達9分取消狀態 |
| `workplace_t3_mini_a` | `common_charge`,`common_cleanse` | 工坊輪轉：3段攻擊，總倍率=小王基準×1.05 | 三枚齒輪各對應一段 |
| `workplace_t3_mini_b` | `common_armor`,`common_weaken` | 條文封步：小王基準×0.9＋ATK-8% 1回合 | 擊中條文中的三處金字 |
| `workplace_t3_boss` | `common_reflect`,`common_cleanse` | 黃金蓋印：大王基準＋減傷10% 1回合 | 金印落下前擊中中心；70% HP護盾7%，40% HP傷害+5% |
| `workplace_t4_normal_a` | `common_shock` | 漲租快遞：基準＋DEF-8% 1回合 | 擊中信封封蠟取消降防 |
| `workplace_4` | `common_weaken` | 租約追擊：2段攻擊，總倍率=基準＋ATK-8% 1回合 | 兩份租約各對應一段，完整破解取消狀態 |
| `workplace_t4_normal_b` | `common_armor` | 門禁封陣：無傷害；護盾7%＋減傷15% 1回合 | 三把發亮鑰匙依序擊破 |
| `workplace_t4_mini_a` | `common_charge`,`common_stance` | 產線壓陣：小王基準＋延遲攻擊小王基準×0.4 | 輸送帶顯示倒數，完整破解取消延遲段 |
| `workplace_t4_mini_b` | `common_armor`,`common_shock` | 裁定紅線：小王基準＋DEF-8% 2回合 | 射斷紅線兩端；部分破解縮為1回合 |
| `workplace_t4_boss` | `common_reflect`,`common_cleanse` | 王令追繳：大王基準＋ATK-8% 2回合 | 擊中三枚王令印；70% HP反射+3%，40% HP狀態幅度+2% |
| `workplace_t5_normal_a` | `common_regen` | 行程排滿：基準×0.9＋延遲攻擊基準×0.45 | 行事曆明示一回合倒數 |
| `workplace_5` | `common_rage` | 財閥號令：基準＋ATK-10% 2回合 | 擊碎金印取消弱化；部分破解縮為1回合 |
| `workplace_t5_normal_b` | `common_armor` | 金庫壁壘：無傷害；護盾10%＋減傷15% 1回合 | 擊中金庫轉盤三個亮點 |
| `workplace_t5_mini_a` | `common_rage`,`common_stance` | 千工齊作：3段攻擊，總倍率=小王基準×1.05 | 三個工坊圖標各對應一段 |
| `workplace_t5_mini_b` | `common_armor`,`common_weaken` | 終局執行：小王基準＋ATK-10% 2回合 | 黑印完成前達70%；部分破解縮為1回合 |
| `workplace_t5_boss` | `common_regen`,`common_reflect` | 萬約歸一：大王基準＋延遲攻擊大王基準×0.5 | 契約卷顯示倒數；70% HP護盾10%，40% HP延遲段+8% |
| `workplace_t6_normal_a` | `common_cleanse` | 無盡抄錄：3段攻擊，總倍率=基準×1.05 | 三頁卷軸依品質逐段取消 |
| `workplace_6` | `common_rage` | 資本洪流：基準，無視護盾10%＋ATK-10% 1回合 | 洪流中央金幣標記可取消穿盾與狀態 |
| `workplace_t6_normal_b` | `common_armor` | 永續裁令：基準＋減傷20% 1回合 | 永續環閉合前擊中三個節點 |
| `workplace_t6_mini_a` | `common_rage`,`common_stance` | 萬機共鳴：3段攻擊，總倍率=小王基準×1.1 | 三座機關依序亮起並逐段破解 |
| `workplace_t6_mini_b` | `common_reflect`,`common_weaken` | 天約執行：小王基準＋ATK-10% 2回合 | 天約四角依序擊破；部分破解縮為1回合 |
| `workplace_t6_boss` | `common_regen`,`common_reflect` | 永恆工時：大王基準＋延遲攻擊大王基準×0.6 | 時鐘明示一回合倒數；70% HP減傷10%，40% HP延遲段+10%，仍可破解 |

## 考試族（exam）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `exam_t1_normal_a` | `common_weakpoint` | 筆尖突刺：基準×0.9；命中後ATK-5% 1回合 | 擊中發亮筆尖取消弱化 |
| `exam_1` | `common_charge` | 臨時抽考：基準＋9分以上挑戰；完成則玩家本回合傷害+10% | 半數箭達9分即破解並取得獎勵 |
| `exam_t1_normal_b` | `common_armor` | 方格列陣：基準×0.9＋護盾5% | 依序命中三個發亮方格 |
| `exam_t1_mini_a` | `common_charge`,`common_weakpoint` | 開卷點名：小王基準＋ATK-5% 1回合 | 被點亮的卷軸名字位置為弱點 |
| `exam_t1_mini_b` | `common_armor`,`common_stance` | 加總封門：小王基準×0.9＋減傷10% 1回合 | 命中合計為10的兩個數字取消減傷 |
| `exam_t1_boss` | `common_charge`,`common_armor` | 啟蒙試煉陣：大王基準＋DEF-5% 1回合 | 三枚初階符號依序亮起；70% HP護盾+2%，40% HP傷害+5% |
| `exam_t2_normal_a` | `common_weakpoint` | 紙鶴傳題：2段攻擊，總倍率=基準×0.9 | 兩隻紙鶴各對應一段 |
| `exam_2` | `common_weaken` | 範圍擴張：基準×0.9＋ATK-5% 1回合 | 擊中卷軸上三個發亮章節取消弱化 |
| `exam_t2_normal_b` | `common_charge` | 四選突擊：基準＋指定光色挑戰；失敗DEF-5% 1回合 | 四個選項中命中發亮選項即可削弱 |
| `exam_t2_mini_a` | `common_charge`,`common_weakpoint` | 銀羽閱卷：2段攻擊，總倍率=小王基準 | 羽筆與卷印各對應一段 |
| `exam_t2_mini_b` | `common_armor`,`common_stance` | 倍數屏障：無傷害；護盾5%＋減傷10% 1回合 | 命中同色倍數符號取消效果 |
| `exam_t2_boss` | `common_charge`,`common_armor` | 百卷問答陣：大王基準＋ATK-5% 1回合 | 三卷中發亮主卷為弱點；70% HP減傷+5%，40% HP傷害+5% |
| `exam_t3_normal_a` | `common_cleanse` | 墨跡追題：2段攻擊，總倍率=基準×0.9 | 兩滴星墨各對應一段 |
| `exam_3` | `common_charge` | 全科突襲：3段攻擊，總倍率=基準×1.05 | 三個科目徽章依品質逐段取消 |
| `exam_t3_normal_b` | `common_armor` | 圓弧封鎖：基準×0.9＋減傷10% 1回合 | 命中圓心與弧線交點取消減傷 |
| `exam_t3_mini_a` | `common_charge`,`common_cleanse` | 藍卷追問：小王基準＋9分以上挑戰；失敗ATK-8% 1回合 | 半數箭達9分取消狀態 |
| `exam_t3_mini_b` | `common_armor`,`common_shock` | 分割結界：小王基準×0.9＋DEF-8% 1回合 | 左右區域品質差≤10%可完整破解 |
| `exam_t3_boss` | `common_regen`,`common_armor` | 萬卷迴廊：大王基準＋延遲攻擊大王基準×0.4 | 卷軸路徑倒數一回合；70% HP護盾7%，40% HP延遲段+5% |
| `exam_t4_normal_a` | `common_weakpoint` | 星線定位：基準＋指定9分以上挑戰；完成則玩家傷害+10% | 命中星線交點並達70%取得獎勵 |
| `exam_4` | `common_charge` | 倒數鐘聲：基準＋延遲攻擊基準×0.45 | 明示一回合倒數；完整破解取消延遲段 |
| `exam_t4_normal_b` | `common_armor` | 黑格盾陣：無傷害；護盾7%＋減傷15% 1回合 | 依亮起順序命中三個方格 |
| `exam_t4_mini_a` | `common_charge`,`common_cleanse` | 金印封卷：小王基準＋ATK-8% 2回合 | 擊中金印四角；部分破解縮為1回合 |
| `exam_t4_mini_b` | `common_armor`,`common_shock` | 未知數牢籠：小王基準×0.9＋DEF-8% 2回合 | 命中唯一發亮未知數取消狀態 |
| `exam_t4_boss` | `common_regen`,`common_armor` | 星算天盤：3段攻擊，總倍率=大王基準×1.05 | 三顆主星逐段破解；70% HP減傷10%，40% HP總傷+5% |
| `exam_t5_normal_a` | `common_cleanse` | 榮光鼓舞：基準×0.9＋自身護盾7% | 擊中徽章中央取消護盾 |
| `exam_5` | `common_regen` | 長年試煉：基準＋延遲攻擊基準×0.5 | 年輪顯示一回合倒數，完整破解取消 |
| `exam_t5_normal_b` | `common_armor` | 聖典鎮頁：基準＋減傷15% 1回合 | 擊中書扣兩側取消減傷 |
| `exam_t5_mini_a` | `common_charge`,`common_cleanse` | 王立裁卷：小王基準＋ATK-10% 2回合 | 王立印落下前達70%；部分破解縮為1回合 |
| `exam_t5_mini_b` | `common_armor`,`common_shock` | 曲線迷宮：小王基準×0.9＋DEF-10% 2回合 | 擊中曲線轉折點；部分破解縮為1回合 |
| `exam_t5_boss` | `common_regen`,`common_reflect` | 真知裁問：大王基準＋9分以上挑戰；失敗ATK-10% 2回合 | 半數箭達9分取消狀態；70% HP護盾10%，40% HP傷害+8% |
| `exam_t6_normal_a` | `common_cleanse` | 天書疾筆：3段攻擊，總倍率=基準×1.05 | 三道羽筆光痕依品質逐段取消 |
| `exam_6` | `common_regen` | 制度迷宮：基準＋延遲攻擊基準×0.55 | 路線清楚倒數一回合，完整破解取消 |
| `exam_t6_normal_b` | `common_armor` | 星典鎮界：基準＋護盾10% | 擊中書脊三顆星石取消護盾 |
| `exam_t6_mini_a` | `common_charge`,`common_cleanse` | 天命終卷：小王基準＋ATK-10% 2回合 | 天命卷四角逐一擊破；部分破解縮為1回合 |
| `exam_t6_mini_b` | `common_armor`,`common_shock` | 無限推演：3段攻擊，總倍率=小王基準×1.1＋DEF-10% 1回合 | 三個無限環節逐段破解，完整破解取消狀態 |
| `exam_t6_boss` | `common_regen`,`common_reflect` | 全知終極試煉：大王基準＋延遲攻擊大王基準×0.6 | 全知星盤倒數一回合；70% HP減傷10%，40% HP延遲段+10%，仍可破解 |

## 西方怪物族（temple）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `temple_t1_normal_a` | `common_weakpoint` | 蘑菇彈跳：基準×0.9；自身減傷10% 1回合 | 擊中蘑菇帽亮點取消減傷 |
| `temple_1` | `common_charge` | 金牙突襲：基準傷害 | 金牙蓄光時達70%可大幅削弱 |
| `temple_t1_normal_b` | `common_armor` | 木盾推進：基準×0.9＋護盾5% | 擊中木盾中央取消護盾 |
| `temple_t1_mini_a` | `common_charge`,`common_stance` | 先鋒衝陣：小王基準，無視防禦10% | 擊中旗幟箭頭取消穿透 |
| `temple_t1_mini_b` | `common_armor`,`common_weakpoint` | 符文光彈：2段攻擊，總倍率=小王基準 | 兩枚符文各對應一段 |
| `temple_t1_boss` | `common_charge`,`common_armor` | 幼龍翔擊：大王基準＋DEF-5% 1回合 | 兩翼間的龍冠亮起；70% HP護盾+2%，40% HP傷害+5% |
| `temple_t2_normal_a` | `common_armor` | 鎧甲迴旋：2段攻擊，總倍率=基準×0.9 | 肩甲兩側各對應一段 |
| `temple_2` | `common_stance` | 月光劍舞：2段攻擊，總倍率=基準 | 兩道月光劍痕依品質逐段取消 |
| `temple_t2_normal_b` | `common_charge` | 長槍封路：基準＋DEF-5% 1回合 | 擊中槍尖光點取消降防 |
| `temple_t2_mini_a` | `common_charge`,`common_stance` | 銀盾突進：小王基準，無視防禦10% | 銀盾開啟時命中中央取消穿透 |
| `temple_t2_mini_b` | `common_armor`,`common_weakpoint` | 青紋屏障：無傷害；護盾5%＋減傷10% 1回合 | 擊中三枚青紋節點 |
| `temple_t2_boss` | `common_charge`,`common_armor` | 振翼風壓：大王基準，無視護盾10% | 翼風中央出現弱點；70% HP減傷+5%，40% HP穿盾+5% |
| `temple_t3_normal_a` | `common_weakpoint` | 月影疾行：2段攻擊，總倍率=基準×0.9 | 真正月影帶有星點，可取消第二段 |
| `temple_3` | `common_rage` | 月下追獵：基準，無視防禦10% | 月輪中央亮起時命中取消穿透 |
| `temple_t3_normal_b` | `common_charge` | 高空俯衝：基準＋延遲攻擊基準×0.4 | 地面落點明示一回合倒數 |
| `temple_t3_mini_a` | `common_charge`,`common_stance` | 月堡連斬：3段攻擊，總倍率=小王基準×1.05 | 三面月旗各對應一段 |
| `temple_t3_mini_b` | `common_armor`,`common_shock` | 雷紋鎖鏈：小王基準×0.9＋DEF-8% 1回合 | 擊中兩個雷紋接點取消狀態 |
| `temple_t3_boss` | `common_regen`,`common_armor` | 蒼翼旋風：3段攻擊，總倍率=大王基準×1.05 | 三道翼風逐段破解；70% HP護盾7%，40% HP總傷+5% |
| `temple_t4_normal_a` | `common_cleanse` | 緞帶旋舞：2段攻擊，總倍率=基準＋ATK-8% 1回合 | 兩條緞帶各對應一段，完整破解取消狀態 |
| `temple_4` | `common_stance` | 紅月禮劍：基準，無視防禦10% | 擊中非血色的紅月寶石取消穿透 |
| `temple_t4_normal_b` | `common_armor` | 薔薇劍陣：3段攻擊，總倍率=基準×1.05 | 三枚銀薔薇依品質逐段取消 |
| `temple_t4_mini_a` | `common_charge`,`common_stance` | 王旗衝鋒：小王基準，無視防禦15% | 王旗尖端亮起時命中取消穿透 |
| `temple_t4_mini_b` | `common_armor`,`common_shock` | 炎紋法環：小王基準＋DEF-8% 2回合 | 擊破法環三個火紋；部分破解縮為1回合 |
| `temple_t4_boss` | `common_regen`,`common_armor` | 熾翼吐息：大王基準，無視護盾20% | 熾翼合攏前擊中龍冠；70% HP減傷10%，40% HP傷害+5% |
| `temple_t5_normal_a` | `common_cleanse` | 星頁飛舞：3段攻擊，總倍率=基準 | 三頁星書依品質逐段取消 |
| `temple_5` | `common_regen` | 王座秘法：基準＋延遲攻擊基準×0.5 | 王座符文倒數一回合，完整破解取消 |
| `temple_t5_normal_b` | `common_armor` | 奧術壁壘：無傷害；護盾10%＋減傷15% 1回合 | 擊中晶核四角取消效果 |
| `temple_t5_mini_a` | `common_rage`,`common_stance` | 聖冠破陣：小王基準，無視防禦15% | 聖冠中央寶石為弱點 |
| `temple_t5_mini_b` | `common_reflect`,`common_cleanse` | 星紋天幕：小王基準×0.9＋減傷20% 1回合 | 擊破天幕三顆主星取消減傷 |
| `temple_t5_boss` | `common_regen`,`common_reflect` | 星翼流光：3段攻擊，總倍率=大王基準×1.1 | 三道星翼光流逐段破解；70% HP護盾10%，40% HP總傷+8% |
| `temple_t6_normal_a` | `common_cleanse` | 雲端推進：基準×0.9＋減傷20% 1回合 | 擊中雲環中心取消減傷 |
| `temple_6` | `common_rage` | 末日龍息：基準，無視護盾10%＋DEF-10% 1回合 | 龍息核心明確亮起，完整破解取消附加效果 |
| `temple_t6_normal_b` | `common_armor` | 聖劍開天：基準，無視防禦10% | 聖劍交叉點命中可取消穿透 |
| `temple_t6_mini_a` | `common_rage`,`common_stance` | 天穹遠征：3段攻擊，總倍率=小王基準×1.1 | 三面天穹旗幟逐段破解 |
| `temple_t6_mini_b` | `common_reflect`,`common_cleanse` | 神域封界：小王基準×0.9＋護盾10% | 擊破神域法陣四個節點取消護盾 |
| `temple_t6_boss` | `common_regen`,`common_reflect` | 帝翼星隕：大王基準＋延遲攻擊大王基準×0.6 | 星隕落點倒數一回合；70% HP減傷10%，40% HP延遲段+10%，仍可破解 |

## 寶箱族（treasure）

| Monster ID | 共用技能 | 招牌技能效果 | 破解提示／階段被動 |
|---|---|---|---|
| `treasure_1_real` | `common_armor` | 安靜藏寶：無傷害；自身護盾5% | 擊中鎖孔取消護盾；永不安排反擊 |
| `treasure_1` | `common_armor` | 箱蓋反彈：基準×0.8；不附加狀態 | 箱蓋開啟前擊中鎖孔可完整破解 |
| `treasure_t1_normal_b` | `common_charge` | 木箱衝撞：基準傷害 | 木輪路線亮起時達70% |
| `treasure_king_small_1` | `common_charge`,`common_armor` | 銅鎖號令：小王基準＋護盾5% | 擊中銅鎖三個扣點取消護盾 |
| `treasure_t1_mini_b` | `common_armor`,`common_stance` | 原石重拳：小王基準，無視防禦10% | 原石拳心亮起時命中取消穿透 |
| `treasure_king_big_1` | `common_charge`,`common_armor` | 王庫震地：大王基準＋DEF-5% 1回合 | 地面三枚金幣圈依序亮起；70% HP護盾+2%，40% HP傷害+5% |
| `treasure_2_real` | `common_armor` | 金光藏寶：無傷害；自身護盾5% | 擊中金鎖取消護盾；永不安排反擊 |
| `treasure_2` | `common_armor` | 金幣飛散：2段攻擊，總倍率=基準×0.8 | 兩枚主金幣各對應一段 |
| `treasure_t2_normal_b` | `common_charge` | 金庫推進：基準＋減傷10% 1回合 | 擊中推進路線中央取消減傷 |
| `treasure_king_small_2` | `common_charge`,`common_armor` | 銀鎖封門：小王基準×0.9＋護盾5% | 銀鎖左右扣點皆命中可取消護盾 |
| `treasure_t2_mini_b` | `common_armor`,`common_stance` | 琥珀震波：小王基準＋DEF-5% 1回合 | 琥珀核心亮起時達70% |
| `treasure_king_big_2` | `common_charge`,`common_armor` | 王庫金雨：3段攻擊，總倍率=大王基準 | 三枚王冠金幣逐段破解；70% HP減傷+5%，40% HP總傷+5% |
| `treasure_3_real` | `common_armor` | 鑽光藏寶：無傷害；自身護盾7% | 擊中鑽鎖折光點取消護盾；永不安排反擊 |
| `treasure_3` | `common_reflect` | 鑽光折射：基準×0.8＋有限反射5% 1回合 | 擊中非閃爍的固定鑽面取消反射 |
| `treasure_t3_normal_b` | `common_armor` | 晶盾衝鋒：基準＋護盾7% | 擊中晶盾中心取消護盾 |
| `treasure_king_small_3` | `common_reflect`,`common_armor` | 晶鎖結界：無傷害；護盾7%＋減傷15% 1回合 | 擊中三個晶鎖節點 |
| `treasure_t3_mini_b` | `common_charge`,`common_stance` | 藍晶脈衝：2段攻擊，總倍率=小王基準 | 內外兩圈脈衝各對應一段 |
| `treasure_king_big_3` | `common_reflect`,`common_armor` | 王庫折光：大王基準＋有限反射5% 1回合 | 擊中固定王冠晶面；70% HP護盾7%，40% HP反射+3% |
| `treasure_4_real` | `common_armor` | 祕銀藏寶：無傷害；自身護盾7%＋減傷10% 1回合 | 擊中祕銀鎖芯取消效果；永不安排反擊 |
| `treasure_4` | `common_armor` | 祕銀壁壘：無傷害；護盾7%＋減傷15% 1回合 | 三道祕銀裂紋依序擊破 |
| `treasure_t4_normal_b` | `common_charge` | 銀壁推進：基準，無視防禦10% | 銀壁推進前擊中中央取消穿透 |
| `treasure_king_small_4` | `common_reflect`,`common_armor` | 祕銀封庫：小王基準×0.9＋減傷15% 1回合 | 擊中四枚祕銀鉚釘取消減傷 |
| `treasure_t4_mini_b` | `common_charge`,`common_shock` | 紫晶重壓：小王基準＋DEF-8% 1回合 | 紫晶落點明確顯示，達70%取消狀態 |
| `treasure_king_big_4` | `common_reflect`,`common_armor` | 王庫銀牆：大王基準＋護盾10% | 銀牆三段依序擊破；70% HP減傷10%，40% HP護盾+2% |
| `treasure_5_real` | `common_armor` | 古庫藏寶：無傷害；自身護盾10% | 擊中遠古鎖文取消護盾；永不安排反擊 |
| `treasure_5` | `common_regen` | 古代機關：基準×0.8＋延遲攻擊基準×0.4 | 機關倒數一回合，完整破解取消延遲段 |
| `treasure_t5_normal_b` | `common_armor` | 古庫鎮守：基準＋減傷15% 1回合 | 遠古護鎖四角逐一擊破 |
| `treasure_king_small_5` | `common_reflect`,`common_armor` | 遠古封印：小王基準×0.9＋護盾10% | 擊中封印中心取消護盾 |
| `treasure_t5_mini_b` | `common_charge`,`common_shock` | 星鑽墜擊：小王基準＋延遲攻擊小王基準×0.5 | 星鑽落點倒數一回合 |
| `treasure_king_big_5` | `common_regen`,`common_reflect` | 王庫星震：3段攻擊，總倍率=大王基準×1.05 | 三顆庫星逐段破解；70% HP護盾10%，40% HP總傷+8% |
| `treasure_6_real` | `common_armor` | 神庫藏寶：無傷害；自身護盾10%＋減傷20% 1回合 | 擊中神話鎖核取消效果；永不安排反擊 |
| `treasure_6` | `common_regen` | 神話金流：3段攻擊，總倍率=基準×0.9 | 三道金流依品質逐段取消 |
| `treasure_t6_normal_b` | `common_armor` | 神庫進軍：基準，無視防禦10%＋減傷20% 1回合 | 神庫徽章亮起時命中取消附加效果 |
| `treasure_king_small_6` | `common_reflect`,`common_armor` | 神話封庫：小王基準×0.9＋護盾10% | 擊中神話鎖的四個星點取消護盾 |
| `treasure_t6_mini_b` | `common_charge`,`common_shock` | 虹彩星爆：3段攻擊，總倍率=小王基準×1.1 | 紅藍金三色晶核逐段破解，不以閃爍辨識 |
| `treasure_king_big_6` | `common_regen`,`common_reflect` | 王庫天降：大王基準＋延遲攻擊大王基準×0.6 | 王冠落點倒數一回合；70% HP減傷10%，40% HP延遲段+10%，仍可破解 |
