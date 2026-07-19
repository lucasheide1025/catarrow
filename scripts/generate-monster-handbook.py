# scripts/generate-monster-handbook.py — 由 catalog 自動生成怪物手冊(docs/second_brain/monster-handbook.md)
# 資料改動後重跑:py -3 scripts/generate-monster-handbook.py
import json, io, re

cat = json.load(io.open("src/data/monsterExpansionCatalog.json", encoding="utf-8"))
monsters = cat["monsters"]

FAM = {"ghost":"👻 鬼怪","mountain":"🏔️ 山林","insect":"🦂 毒蟲","workplace":"💼 職場","exam":"📝 考試","temple":"🏰 西方","treasure":"📦 寶箱"}
ENC = {"normal":"一般","miniBoss":"小王","boss":"大王"}
FAM_ORDER = ["ghost","mountain","insect","workplace","exam","temple","treasure"]

# 天賦判定(鏡射 cardTalents.TALENT_RULES 優先序,文字比對版)
def talent(m):
    s = m.get("signatureSummary","")
    t = m.get("tierIndex",1); scale = 1 if t<=2 else (1.5 if t<=4 else 2)
    def v(b): return round(b*scale,1)
    if "無視防禦" in s: return f"🗡️ 穿甲 {v(1)}%"
    if "無視護盾" in s: return f"💥 破盾 {v(1)}%"
    if re.search(r"\d段", s): return f"⚡ 連擊(爆擊) {v(1)}%"
    if "延遲攻擊" in s: return f"⏳ 蓄勁(傷害) {v(1)}%"
    if "自身護盾" in s or re.search(r"(?<!最大HP )護盾\d", s) or "護盾=最大HP" in s: return f"🛡️ 護體(開場盾) {v(1)}%"
    if "減傷" in s: return f"🧱 堅盾(受傷減免) {v(1)}%"
    if "反射" in s: return f"🌵 荊棘(反彈) {v(1)}%"
    if "ATK-" in s: return f"😱 威嚇(怪物ATK-) {v(1)}%"
    if "DEF-" in s: return f"🔨 破防(怪物DEF-) {v(1)}%"
    if "治療量-" in s: return f"🌿 汲取(回合末回復) {v(2)}"
    if "毒傷" in s: return f"☠️ 淬毒(傷害) {v(1)}%"
    if "高品質箭傷害" in s: return f"🎯 精研(高品質傷害) {v(2)}%"
    if "挑戰" in s: return f"🏆 挑戰者(爆擊) {v(2)}%"
    return f"💪 蠻力(傷害) {v(1)}%"

out = []
out.append("# 🐲 怪物手冊(自動生成,勿手改——重跑 scripts/generate-monster-handbook.py)\n")
out.append(f"> 生成基準:monsterExpansionCatalog v{cat.get('version','?')},共 {len(monsters)} 隻。掉落規則見首章;各怪素材/技能/卡片天賦見族系章節。\n")

out.append("""
## 第一章:掉落規則總表

### 單人打怪(挑戰強度,進場自選,記住上次)
| 強度 | 怪物數值 | 專屬素材 | 金幣 | 金幣寶箱 | 掉卡率 |
|---|---|---|---|---|---|
| 😌 輕鬆 | ×0.8 | ×3 | ×0.8 | 20% | 12% |
| ⚔️ 標準 | ×1.0 | ×5 | ×1.0 | 50% | 20% |
| 🔥 挑戰 | ×1.2 | ×7 | ×1.5 | 100% | 30% |

另:主寶箱+藥水寶箱必掉;金幣基底=Tier 級距(T1 3-8/T2 6-15/T3 12-25/T4 20-40/T5 35-65/T6 60-100)×套裝加成。

### 組隊打怪(房主選強度;每多 1 人)
怪物強度 +10%|素材 +1|掉卡 +5%(上限60%)|金幣寶箱 +15%(上限100%)|金幣/XP +20%/人。

### 地下城/遠征(難度=帶哪張圖;單人組隊同規格)
- 難度→怪物 Tier:普通=T1-2、進階=T4、困難=T5、地獄=T6;**層數固定 3 層**(第1層探索/第2層精英/第3層分支+王房)
- 中途擊殺(一般/精英房):**不掉單怪素材**——材料寶箱+金幣寶箱必掉 ×「出圖擲定 1~3 倍」;金幣=Tier級距**×5**;射手XP=Tier×6(精英×1.5)
- 組隊遠征另有:怪物 +10%/額外隊員
- 箭露:只在通關結算=基準×難度倍率(1/1.5/2/2.5/3/3)**×5**
- 王房(35%/35%/30% 抽小王A/B/大王,連3場無大王保底):王素材×1、同族一般素材(基準×5/×8,40/35/25拆三種)、王之印記、符文碎片、金幣、圖鑑收藏、選擇箱(小王選1/大王選2)
- **王卡 pity**:首殺必得;之後小王 20%/第5次保底、大王 10%/第8次保底;中途小怪不掉卡

### 卡片裝備規則
普通卡不分屬性上限 10 張、世界王卡 3 張;同族 2/4 張觸發套裝;每卡帶招牌衍生天賦(彙總有上限)。
""")

TIER_SKILL = {1:{"normal":1.05,"miniBoss":1.10,"boss":1.15},2:{"normal":1.08,"miniBoss":1.13,"boss":1.18},3:{"normal":1.12,"miniBoss":1.18,"boss":1.23},4:{"normal":1.15,"miniBoss":1.21,"boss":1.26},5:{"normal":1.18,"miniBoss":1.24,"boss":1.30},6:{"normal":1.22,"miniBoss":1.28,"boss":1.35}}

for fam in FAM_ORDER:
    rows = [m for m in monsters if m["family"] == fam]
    if not rows: continue
    out.append(f"\n## {FAM[fam]}族({len(rows)} 隻)\n")
    for t in range(1, 7):
        tier_rows = [m for m in rows if m["tierIndex"] == t]
        if not tier_rows: continue
        out.append(f"\n### T{t}\n")
        out.append("| 怪物 | 類型 | HP/ATK/DEF | 招牌技能 | 破解方式 | 專屬素材 | 卡片天賦 |")
        out.append("|---|---|---|---|---|---|---|")
        order = {"normalA":0,"normalExisting":1,"normalB":2,"miniA":3,"miniB":4,"boss":5}
        for m in sorted(tier_rows, key=lambda x: order.get(x.get("role"),9)):
            enc = ENC.get(m["encounter"], m["encounter"])
            skill_mult = TIER_SKILL[t][m["encounter"]]
            name = m["name"] + (f"「{m['title']}」" if m.get("title") else "")
            sig = m.get("signatureSummary","").replace("|","/")
            counter = (m.get("counterSummary","") or "").replace("|","/")
            mat = m.get("material",{}).get("name","-")
            out.append(f"| **{name}** | {enc}(技傷×{skill_mult}) | {m['hp']}/{m['atk']}/{m['def']} | {sig} | {counter} | {mat} | {talent(m)} |")

out.append("""
\n## 附錄:共用技能 12 式(T1-2/T3-4/T5-6 三段)
蓄力(反擊+25/30/35%)、護甲(減傷15/20/25%)、回復(最大HP 5/7/9%,一般怪每場一次)、狂暴(HP≤40% ATK+10/15/20%)、弱點姿態(高品質命中+25%,未破解下次反擊+20%)、毒素(每回合最大HP 2/3/4%)、虛弱(玩家ATK-10/15/20%)、震盪(玩家DEF-10/15/20%)、淨化(每3回合一次)、戰鬥姿態(ATK+15%/減傷15%切換)、有限反射(5/8/10%,單次上限最大HP15%)、再生(連兩回合4/6/8%,兩次高品質命中可中斷)。

## 附錄:破解級距(一般/地下城)
本回合有效箭品質(10分=1.0/9=0.9/8=0.75/7=0.55/1-6=0.3/M=0)平均:≥85% 完全破解(0傷0異常)|70-84% ×0.35且取消異常|50-69% ×0.7且異常減半|<50% 全額。世界王 R2/R4 專用 ×0/×0.4/×0.7/×1.0。
""")

io.open("docs/second_brain/monster-handbook.md","w",encoding="utf-8").write("\n".join(out))
print(f"OK {len(monsters)} monsters -> docs/second_brain/monster-handbook.md")
