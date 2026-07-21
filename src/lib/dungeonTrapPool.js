// src/lib/dungeonTrapPool.js
// 地下城陷阱池（擴充）。維持現有「賭大小」機制，只是把可觸發的陷阱種類變多、貓味化。
// 設計規則：負面一律 ≤ −10%（乘算以「本層」計）；金幣為定額扣除；純驚嚇 effect:{}。
// effect 欄位：hp −0.10 = 扣 10% 最大血；atk/def −0.10 = 本層倍率 −10%；gold = 扣金幣；{} = 純劇情。
// category 對應現有三大類（hp/atk/def）方便沿用「賭大小」結算；gold/none 為新增輕量類。
// 尚未接線；接線時把現有 DungeonTrap 的固定 3 種改為從此池抽。

export const TRAP_EVENTS = [
  // ── HP 類（受傷）──
  { id:"t_waterbowl", icon:"💧", title:"水盆陷阱",   category:"hp",  desc:"一腳踩進水盆，濕答答又狼狽 → 全隊 −8% 血", effect:{ hp:-0.08 } },
  { id:"t_mousetrap", icon:"🪤", title:"捕鼠夾",     category:"hp",  desc:"啪！捕鼠夾夾到腳，痛得跳三尺 → 全隊 −10% 血", effect:{ hp:-0.10 } },
  { id:"t_cactus",    icon:"🌵", title:"仙人掌盆栽", category:"hp",  desc:"想蹭盆栽結果是仙人掌，扎滿刺 → 全隊 −7% 血", effect:{ hp:-0.07 } },
  { id:"t_hotfloor",  icon:"🔥", title:"燙腳地板",   category:"hp",  desc:"地板莫名發燙，全隊跳著走 → 全隊 −9% 血", effect:{ hp:-0.09 } },
  { id:"t_falldrawer",icon:"🗄️", title:"抽屜突襲",   category:"hp",  desc:"探頭進抽屜時被彈回來夾到鬍鬚 → 全隊 −6% 血", effect:{ hp:-0.06 } },
  { id:"t_thorns",    icon:"🥀", title:"荊棘走廊",   category:"hp",  desc:"一整條荊棘，怎麼走都會刮到 → 全隊 −10% 血", effect:{ hp:-0.10 } },

  // ── ATK 弱化 ──
  { id:"t_tape",      icon:"🩹", title:"膠帶地雷",   category:"atk", desc:"被膠帶黏住，掙扎老半天手軟腳軟 → 本層 ATK −10%", effect:{ atk:-0.10 } },
  { id:"t_yarntangle",icon:"🧶", title:"毛線纏身",   category:"atk", desc:"整捆毛線纏上來，出爪都不俐落了 → 本層 ATK −8%", effect:{ atk:-0.08 } },
  { id:"t_glue",      icon:"🫙", title:"黏鼠板",     category:"atk", desc:"踩到黏鼠板，甩了半天才脫身、力氣全耗光 → 本層 ATK −10%", effect:{ atk:-0.10 } },
  { id:"t_slippery",  icon:"🧼", title:"打滑地板",   category:"atk", desc:"地上一灘不明黏液，站都站不穩 → 本層 ATK −7%", effect:{ atk:-0.07 } },
  { id:"t_sleepgas",  icon:"😪", title:"催眠薰香",   category:"atk", desc:"一陣薰香飄來，全隊昏昏欲睡提不起勁 → 本層 ATK −9%", effect:{ atk:-0.09 } },

  // ── DEF 弱化 ──
  { id:"t_roomba",    icon:"🧹", title:"掃地機器人", category:"def", desc:"被掃地機器人追著跑，陣型全亂 → 本層 DEF −10%", effect:{ def:-0.10 } },
  { id:"t_vacuum",    icon:"🌀", title:"吸塵器",     category:"def", desc:"吸塵器一開，全隊嚇到炸毛四散 → 本層 DEF −8%", effect:{ def:-0.08 } },
  { id:"t_watergun",  icon:"🔫", title:"水槍伏擊",   category:"def", desc:"不知哪來的水槍偷襲，濕成落湯貓 → 本層 DEF −10%", effect:{ def:-0.10 } },
  { id:"t_cucumber",  icon:"🥒", title:"小黃瓜驚魂", category:"def", desc:"回頭發現一根小黃瓜，嚇到彈飛、防備全失 → 本層 DEF −9%", effect:{ def:-0.09 } },
  { id:"t_balloon",   icon:"🎈", title:"氣球爆炸",   category:"def", desc:"氣球突然爆掉，全隊亂了方寸 → 本層 DEF −7%", effect:{ def:-0.07 } },

  // ── 金幣損失（輕量）──
  { id:"t_holepocket",icon:"💸", title:"破洞口袋",   category:"gold", desc:"走著走著金幣從破洞漏了一路 → −25 金幣", effect:{ gold:-25 } },
  { id:"t_pickpocket",icon:"🐀", title:"扒手老鼠",   category:"gold", desc:"一隻老鼠飛快摸走幾枚金幣就溜了 → −20 金幣", effect:{ gold:-20 } },
  { id:"t_tollcat",   icon:"🧾", title:"惡霸收費",   category:"gold", desc:"一隻兇貓擋路強收「保護費」 → −30 金幣", effect:{ gold:-30 } },
  { id:"t_vendingeat",icon:"🥤", title:"自販機吃錢", category:"gold", desc:"投幣買零食結果卡住、錢也不退 → −15 金幣", effect:{ gold:-15 } },

  // ── 純驚嚇 / 無傷搞笑 ──
  { id:"t_firework",  icon:"🧨", title:"響炮",       category:"none", desc:"啪！一聲響炮，全隊集體炸毛彈到天花板（純驚嚇，無損）", effect:{} },
  { id:"t_maze",      icon:"🌀", title:"鬼打牆",     category:"none", desc:"明明是直路，卻繞回原地三次（浪費點時間，無傷）", effect:{} },
  { id:"t_fakemouse", icon:"🐁", title:"假老鼠",     category:"none", desc:"撲上去咬才發現是假的，尷尬地假裝沒事（無損）", effect:{} },
  { id:"t_sneeze",    icon:"🤧", title:"胡椒粉",     category:"none", desc:"空氣中飄著胡椒粉，全隊噴嚏連連（吵，但無傷）", effect:{} },
];
