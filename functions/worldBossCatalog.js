"use strict";
const base=(name,title,hp,atk,def,pixelKey,family,familyTier=null)=>({name,title,desc:`${title}・世界王討伐目標`,hp,atk,def,pixelKey,family,...(familyTier?{familyGroup:family,familyTier}:{})});
const WORLD_BOSS_CATALOG={
  head_coach:base("主教練","永恆弓聖",540000,270,140,"head_coach","coach"),wife:base("師母","隱世弓后",540000,235,170,"wife","coach"),yumi:base("YUMI教練","速射之神",540000,265,145,"yumi","coach"),
};
const cats={daming:["大娘","萬箭之母",170,125],gege:["哥哥","引路橘光",175,120],meimei:["妹妹","逐箭橘影",178,116],niuniu:["妞妞","精準判官",198,102],haji:["哈吉","夢遊突擊",200,100],baobao:["寶寶","弓袋霸主",190,108],youyou:["悠悠","慢步鷹眼",165,130],xiaoan:["小安","顫爪不退",160,135],diandian:["顛顛","暗影觀氣",168,128]};
for(const[id,[name,title,atk,def]]of Object.entries(cats))WORLD_BOSS_CATALOG[`cat_${id}`]=base(name,title,336000,atk,def,`cat_${id}`,"cat");
const families={ghost:["纏身女鬼","夜半哭聲",60,40,"怨靈大君","千年怨魂",115,75],forest:["山魈頭領","迷霧引路",55,48,"山林守護神","翠林仙尊",105,88],poison:["蜈蚣蜂王","夏日惡夢",72,32,"毒蟲之母","蟲族女王",138,62],office:["奧客糾察隊長","投訴連環信",70,35,"職場終極魔王","工時永恆者",130,68],exam:["期末考魔王","熬夜復仇者",60,40,"考試恐懼之神","白卷支配者",115,78],western:["狼人首領","月圓獵殺",75,30,"古龍皇帝","西境霸主",140,60],treasure:["鎏金寶匣獸","七族守藏者",52,50,"萬寶藏王","無盡寶庫之主",112,90]};
for(const[family,[smallName,smallTitle,smallAtk,smallDef,bigName,bigTitle,bigAtk,bigDef]]of Object.entries(families)){WORLD_BOSS_CATALOG[`${family}_boss_small`]=base(smallName,smallTitle,96000,smallAtk,smallDef,`${family}_boss_small`,family,"small");WORLD_BOSS_CATALOG[`${family}_boss`]=base(bigName,bigTitle,168000,bigAtk,bigDef,`${family}_boss`,family,"big");}
WORLD_BOSS_CATALOG.treasure_boss_small.desc="以金鎖守護七族珍藏的寶匣巨獸。牠不急著進攻，只會讓每一支箭都像射進封死的金庫。";WORLD_BOSS_CATALOG.treasure_boss.desc="統御七族秘寶的藏王，能將無數寶物化為風暴，也能用貪婪封印奪走回復的希望。";
const palette={coach:["#0f172a","#f59e0b"],cat:["#7c2d12","#fdba74"],ghost:["#1e1b4b","#818cf8"],forest:["#14532d","#86efac"],poison:["#451a03","#fcd34d"],office:["#450a0a","#fca5a5"],exam:["#2e1065","#c4b5fd"],western:["#0c1a0c","#4ade80"],treasure:["#422006","#fbbf24"]};for(const boss of Object.values(WORLD_BOSS_CATALOG))[boss.bg,boss.accent]=palette[boss.family]||palette.coach;
module.exports={WORLD_BOSS_CATALOG};
