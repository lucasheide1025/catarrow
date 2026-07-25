// src/guild/GuildTestApp.jsx
// 冒險者公會「戰鬥雛形」測試殼。入口：網址帶 ?guild（隱藏測試用）。
// 先用假 member + 假裝備 roll 一趟遠征，直接進 2.5D 戰鬥試玩循環。
import { useMemo, useState } from "react";
import { rollExpedition } from "./domain/rollExpedition";
import { calcGuildExpeditionStats, STAT_META } from "./domain/guildStats";
import { settleExpedition } from "./domain/settleExpedition";
import GuildBattle from "./ui/GuildBattle";

const MOCK_MEMBER = { archerXP: 8000 };
const MOCK_CATS = [
  { id: "cat_a", name: "小黑", icon: "🐈‍⬛", atk: 28, def: 6 },
  { id: "cat_b", name: "橘子", icon: "🐈", atk: 22, def: 4 },
];
const MOCK_EQUIP = {
  bow: { archetypeId: "hunter_bow", grade: "elite" },
  arrow: { archetypeId: "sharp_arrow", grade: "rare" },
  armor: { archetypeId: "leather_armor", grade: "rare" },
  quiver: { archetypeId: "ranger_quiver", grade: "common" },
  potionPouch: { archetypeId: "potion_pouch_l", grade: "rare" },
};

function newRun(danger) {
  return { exp: rollExpedition({ danger, family: "ghost" }), key: Date.now() };
}

export default function GuildTestApp() {
  const [danger, setDanger] = useState(1);
  const [run, setRun] = useState(() => newRun(1));
  const [result, setResult] = useState(null);
  const stats = calcGuildExpeditionStats(MOCK_MEMBER, MOCK_EQUIP);
  const loot = useMemo(() => (result && result.status === "won" ? settleExpedition(result) : null), [result]);

  const restart = d => { setResult(null); setDanger(d); setRun(newRun(d)); };

  if (result) {
    const won = result.status === "won";
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", background: "linear-gradient(180deg,#0a1a0a,#05100a)", color: "#e2e8f0" }}>
        <div style={{ fontSize: 56 }}>{won ? "🎉" : "💀"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: won ? "#fbbf24" : "#f87171" }}>{won ? "凱旋歸來！" : "遠征失敗"}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{won ? "討伐完成，戰利品如下" : result.lostReason}</div>
        {loot && (
          <div style={{ width: "100%", maxWidth: 340, background: "rgba(0,0,0,.35)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 12, padding: 12, fontSize: 13, textAlign: "left", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "#fbbf24", fontWeight: 900 }}>💰 {loot.coins} 金幣　🐾 {loot.catCoins} CAT幣</div>
            {loot.materials.length > 0 && <div style={{ color: "#a7f3d0" }}>📦 材料：{loot.materials.map(m => `${m.familyTier}×${m.qty}`).join("、")}</div>}
            {loot.junk.length > 0 && <div style={{ color: "#93c5fd" }}>🎒 雜貨：{loot.junk.map(j => `${j.icon}${j.name}`).join("、")}</div>}
            {loot.equipDrops.length > 0 && <div style={{ color: "#f0abfc", fontWeight: 800 }}>⭐ 裝備掉落：{loot.equipDrops.map(e => `${e.grade} ${e.archetypeId}`).join("、")}</div>}
            {loot.materials.length === 0 && loot.junk.length === 0 && loot.equipDrops.length === 0 && <div style={{ color: "#64748b" }}>（這趟只拿到基礎報酬）</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {[1, 2, 3].map(d => (
            <button key={d} onClick={() => restart(d)} style={{ padding: "10px 16px", borderRadius: 10, fontWeight: 900, color: "#fff", border: "none", background: "linear-gradient(135deg,#f59e0b,#b45309)", cursor: "pointer" }}>
              再來一趟（危險{d}）
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "6px 12px", background: "#1a1207", color: "#fcd34d", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
        <span>🏛️ 公會遠征雛形（測試）· 危險度 {danger}</span>
        <span style={{ color: "#94a3b8" }}>
          {Object.keys(STAT_META).map(k => `${STAT_META[k].short} ${stats[k]}`).join(" · ")}
        </span>
      </div>
      <GuildBattle key={run.key} expedition={run.exp} guildStats={stats} supplies={{ food: 6, water: 6 }} cats={MOCK_CATS} onEnd={setResult} />
    </div>
  );
}
