// src/components/member/MonsterHandbook.jsx — 遊戲內怪物手冊（252 擴充怪＋24 世界王）
// 資料全部來自 catalog（monsterExpansionCatalog / worldBossData / worldBossSkillData / cardTalents）,零手工。
// 一次只渲染選中的 族系×Tier（≤6 列）或世界王分類,不做虛擬清單。

import { useMemo, useState } from "react";
import { EXPANSION_MONSTERS } from "../../lib/monsterExpansionCatalog";
import { WORLD_BOSSES } from "../../lib/worldBossData";
import { WORLD_BOSS_SKILLS } from "../../lib/worldBossSkillData";
import { getCardTalent } from "../../lib/cardTalents";

const FAMILIES = [
  { id: "ghost", label: "👻 鬼怪" }, { id: "mountain", label: "🏔️ 山林" }, { id: "insect", label: "🦂 毒蟲" },
  { id: "workplace", label: "💼 職場" }, { id: "exam", label: "📝 考試" }, { id: "temple", label: "🏰 西方" },
  { id: "treasure", label: "📦 寶箱" }, { id: "worldboss", label: "🌍 世界王" },
];
const ENC_LABEL = { normal: "一般", miniBoss: "小王", boss: "大王" };
const ENC_COLOR = { normal: "#94a3b8", miniBoss: "#fbbf24", boss: "#ef4444" };
const TIER_SKILL_MULT = {
  1: { normal: 1.05, miniBoss: 1.10, boss: 1.15 }, 2: { normal: 1.08, miniBoss: 1.13, boss: 1.18 },
  3: { normal: 1.12, miniBoss: 1.18, boss: 1.23 }, 4: { normal: 1.15, miniBoss: 1.21, boss: 1.26 },
  5: { normal: 1.18, miniBoss: 1.24, boss: 1.30 }, 6: { normal: 1.22, miniBoss: 1.28, boss: 1.35 },
};

function StatPills({ hp, atk, def }) {
  return (
    <span className="flex gap-2 text-[11px] font-black tabular-nums">
      <span style={{ color: "#4ade80" }}>❤️{hp}</span>
      <span style={{ color: "#fb923c" }}>⚔️{atk}</span>
      <span style={{ color: "#60a5fa" }}>🛡️{def}</span>
    </span>
  );
}

const FAMILY_NAME_MAP = {
  ghost:     "👻 鬼怪族",
  mountain:  "🏔️ 山林族",
  insect:    "🦂 毒蟲族",
  workplace: "💼 職場族",
  exam:      "📝 考試族",
  temple:    "🏰 西方神殿族",
  treasure:  "📦 寶箱族",
  worldboss: "🌍 世界王",
};

function MonsterCard({ monster }) {
  const talent = getCardTalent({ monsterId: monster.id, tierIndex: monster.tierIndex, source: "monster" });
  const mult = TIER_SKILL_MULT[monster.tierIndex]?.[monster.encounter];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {FAMILY_NAME_MAP[monster.family] || monster.family}・T{monster.tierIndex || monster.tier || 1}
        </span>
        <span className="font-black text-sm text-slate-100">{monster.name}</span>
        {monster.title && <span className="text-[10px] text-slate-400">「{monster.title}」</span>}
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: `${ENC_COLOR[monster.encounter]}22`, color: ENC_COLOR[monster.encounter] }}>
          {ENC_LABEL[monster.encounter]}{mult ? `・技傷×${mult}` : ""}
        </span>
        <span className="flex-1" />
        <StatPills hp={monster.hp} atk={monster.atk} def={monster.def} />
      </div>
      {monster.signatureSummary && (
        <div className="mt-1.5 text-[11px] leading-relaxed text-purple-300">⚡ {monster.signatureSummary}</div>
      )}
      {monster.counterSummary && (
        <div className="mt-1 text-[11px] leading-relaxed text-emerald-300">🎯 {monster.counterSummary}</div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
        {monster.material?.name && <span>🧪 素材：{monster.material.name}</span>}
        {talent && <span>🃏 卡片天賦：{talent.text}</span>}
      </div>
    </div>
  );
}

function WorldBossCard({ bossKey }) {
  const boss = WORLD_BOSSES[bossKey];
  const skills = WORLD_BOSS_SKILLS[bossKey];
  if (!boss) return null;
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-white/[.04] p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-black text-sm" style={{ color: boss.accent || "#fbbf24" }}>{boss.name}</span>
        <span className="text-[10px] text-slate-400">「{boss.title}」</span>
        <span className="flex-1" />
        <StatPills hp={boss.hp.toLocaleString()} atk={boss.atk} def={boss.def} />
      </div>
      {boss.desc && <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400 italic">{boss.desc}</div>}
      {skills && (
        <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed">
          <div className="text-rose-300">⚡ R2「{skills.r2Strike.name}」×{skills.r2Strike.baseMultiplier}
            {skills.r2Strike.status && `｜附加 ${skills.r2Strike.status.name}-${skills.r2Strike.status.strength}%（${skills.r2Strike.status.duration}回合）`}
            {skills.r2Strike.armorPiercePct ? `｜無視防禦${skills.r2Strike.armorPiercePct}%` : ""}
            {skills.r2Strike.shieldPiercePct ? `｜無視護盾${skills.r2Strike.shieldPiercePct}%` : ""}
            {skills.r2Strike.hits > 1 ? `｜${skills.r2Strike.hits}段演出` : ""}
          </div>
          <div className="text-orange-300">☄️ R4「{skills.r4Finisher.name}」×{skills.r4Finisher.baseMultiplier}（可擊倒,無附加異常）</div>
          <div className="text-emerald-300">🎯 射出高分可破解：≥85% 完全免傷｜70-84% 傷害×0.4｜50-69% ×0.7｜&lt;50% 全額</div>
        </div>
      )}
    </div>
  );
}

export default function MonsterHandbook({ onBack }) {
  const [family, setFamily] = useState("ghost");
  const [tier, setTier] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();

  const list = useMemo(() => {
    if (q) return [];
    if (family === "worldboss") return [];
    const order = { normalA: 0, normalExisting: 1, normalB: 2, miniA: 3, miniB: 4, boss: 5 };
    return EXPANSION_MONSTERS
      .filter(m => m.family === family && m.tierIndex === tier)
      .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
  }, [family, tier, q]);

  const wbKeys = useMemo(() => Object.keys(WORLD_BOSSES), []);

  const searchResults = useMemo(() => {
    if (!q) return null;
    const matchedMonsters = EXPANSION_MONSTERS.filter(m => (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.signatureSummary && m.signatureSummary.toLowerCase().includes(q)) ||
      (m.counterSummary && m.counterSummary.toLowerCase().includes(q)) ||
      (m.material?.name && m.material.name.toLowerCase().includes(q)) ||
      (m.family && m.family.toLowerCase().includes(q))
    ));
    const matchedBosses = wbKeys.filter(k => {
      const b = WORLD_BOSSES[k];
      const s = WORLD_BOSS_SKILLS[k];
      return (
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.desc && b.desc.toLowerCase().includes(q)) ||
        (s?.r2Strike?.name && s.r2Strike.name.toLowerCase().includes(q)) ||
        (s?.r4Finisher?.name && s.r4Finisher.name.toLowerCase().includes(q))
      );
    });
    return { monsters: matchedMonsters, bosses: matchedBosses };
  }, [q, wbKeys]);

  return (
    <div className="min-h-full text-white" style={{ background: "linear-gradient(180deg,#07101d,#0b1220)" }}>
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        {onBack && <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>}
        <div className="flex-1">
          <h1 className="font-black text-base">📖 怪物手冊</h1>
          <div className="text-[10px] text-slate-500">{EXPANSION_MONSTERS.length} 隻怪物＋{wbKeys.length} 隻世界王的完整設定</div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-8 space-y-3">
        {/* 全區搜尋輸入框 */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 搜尋怪物名稱、技能、掉落材料（例如：九尾、靈界令牌、毒液）..."
            className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕ 清除
            </button>
          )}
        </div>

        {!q && (
          <>
            {/* 族系 */}
            <div className="flex gap-1.5 flex-wrap">
              {FAMILIES.map(f => (
                <button key={f.id} onClick={() => setFamily(f.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black border ${
                    family === f.id ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-slate-400"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Tier（世界王不分 Tier） */}
            {family !== "worldboss" && (
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6].map(t => (
                  <button key={t} onClick={() => setTier(t)}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-black border ${
                      tier === t ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white/5 border-white/10 text-slate-400"}`}>
                    T{t}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          {q && searchResults ? (
            <div>
              <div className="text-xs text-indigo-400 font-bold mb-2">
                搜尋「{searchQuery}」結果（共 {searchResults.monsters.length + searchResults.bosses.length} 筆）
              </div>
              {searchResults.monsters.length === 0 && searchResults.bosses.length === 0 && (
                <div className="text-slate-500 text-xs py-8 text-center bg-white/5 rounded-2xl border border-white/10">
                  找不到符合「{searchQuery}」的怪物或掉落物，換個關鍵字試試看！
                </div>
              )}
              {searchResults.bosses.map(key => <WorldBossCard key={key} bossKey={key} />)}
              {searchResults.monsters.map(monster => <MonsterCard key={monster.id} monster={monster} />)}
            </div>
          ) : (
            family === "worldboss"
              ? wbKeys.map(key => <WorldBossCard key={key} bossKey={key} />)
              : list.map(monster => <MonsterCard key={monster.id} monster={monster} />)
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-[10px] leading-relaxed text-slate-500">
          💡 技能破解：本回合射出高分即可削弱或無效化怪物技能（≥85% 完全破解｜70-84% 大幅削弱｜50-69% 減半｜&lt;50% 全額生效）。
          大王在 HP 70%／40% 會強化階段被動;掉落規則見各模式進場說明。
        </div>
      </div>
    </div>
  );
}
