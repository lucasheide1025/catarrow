// src/components/dungeon/DungeonDex.jsx — 地下城收藏品圖鑑
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeCollectibles } from "../../lib/dungeonDb";
import { FAMILY_COLLECTIBLES, COLLECTIBLE_MAP } from "../../lib/dungeonCollectibles";
import { DUNGEON_MAPS, FAMILY_CONFIGS } from "../../lib/dungeonData";

const RARITY_LABEL = { common:"普通", rare:"稀有", boss:"首領", exclusive:"首殺限定" };
const RARITY_COLOR = {
  common:    { bg:"rgba(148,163,184,0.15)", border:"rgba(148,163,184,0.3)", text:"#94a3b8" },
  rare:      { bg:"rgba(96,165,250,0.15)",  border:"rgba(96,165,250,0.3)",  text:"#60a5fa" },
  boss:      { bg:"rgba(251,191,36,0.15)",  border:"rgba(251,191,36,0.3)",  text:"#fbbf24" },
  exclusive: { bg:"rgba(168,85,247,0.15)",  border:"rgba(168,85,247,0.3)",  text:"#c084fc" },
};

export default function DungeonDex() {
  const { profile } = useAuth();
  const myId = profile?.id;
  const [collectibles, setCollectibles] = useState({});
  const [selFamily, setSelFamily] = useState("all");
  const [showExclusive, setShowExclusive] = useState(false);

  useEffect(() => {
    if (!myId) return;
    return subscribeCollectibles(myId, setCollectibles);
  }, [myId]);

  // 統計
  const allItems = Object.values(COLLECTIBLE_MAP);
  const owned = allItems.filter(it => (collectibles[it.id] || 0) > 0).length;
  const total = allItems.length;

  // 過濾
  const familyOrder = FAMILY_CONFIGS.map(f => f.id);
  const families = selFamily === "all" ? familyOrder : [selFamily];

  return (
    <div className="pb-10">
      {/* 標頭 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-lg font-black text-white">🔮 地下城圖鑑</div>
          <div className="text-sm font-bold" style={{ color:"#c084fc" }}>
            {owned} / {total}
          </div>
        </div>
        {/* 進度條 */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width:`${(owned/total)*100}%`, background:"linear-gradient(90deg,#7c3aed,#c084fc)" }} />
        </div>
      </div>

      {/* 切換：普通 / 首殺限定 */}
      <div className="px-4 mb-3 flex gap-2">
        <button onClick={() => setShowExclusive(false)}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
          style={!showExclusive
            ? { background:"rgba(168,85,247,0.3)", color:"#c084fc", border:"1px solid rgba(168,85,247,0.5)" }
            : { background:"rgba(255,255,255,0.05)", color:"#64748b", border:"1px solid rgba(255,255,255,0.1)" }}>
          普通收藏品
        </button>
        <button onClick={() => setShowExclusive(true)}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
          style={showExclusive
            ? { background:"rgba(245,158,11,0.2)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.4)" }
            : { background:"rgba(255,255,255,0.05)", color:"#64748b", border:"1px solid rgba(255,255,255,0.1)" }}>
          ★ 首殺限定（24）
        </button>
      </div>

      {showExclusive ? (
        /* ── 首殺限定品 ── */
        <div className="px-4 space-y-2">
          {DUNGEON_MAPS.map(dm => {
            const itemId = `${dm.id}_trophy`;
            const item = COLLECTIBLE_MAP[itemId];
            if (!item) return null;
            const qty = collectibles[itemId] || 0;
            const c = RARITY_COLOR.exclusive;
            return (
              <div key={dm.id} className="flex items-center gap-3 rounded-xl p-3 transition-all"
                style={{ background: qty > 0 ? c.bg : "rgba(255,255,255,0.03)", border:`1px solid ${qty > 0 ? c.border : "rgba(255,255,255,0.06)"}`, opacity: qty > 0 ? 1 : 0.45 }}>
                <span style={{ fontSize:28, filter: qty === 0 ? "grayscale(1)" : "none" }}>{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black" style={{ color: qty > 0 ? "#fcd34d" : "#64748b" }}>{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background:"rgba(168,85,247,0.2)", color:"#c084fc" }}>
                      {dm.emoji} {dm.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{item.desc}</div>
                </div>
                {qty > 0 && (
                  <div className="text-xs font-black rounded-full w-6 h-6 flex items-center justify-center"
                    style={{ background:"rgba(168,85,247,0.3)", color:"#c084fc" }}>
                    {qty}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── 普通收藏品 by 族系 ── */
        <>
          {/* 族系篩選 */}
          <div className="px-4 mb-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
            <button onClick={() => setSelFamily("all")}
              className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all"
              style={selFamily === "all"
                ? { background:"rgba(99,102,241,0.35)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.5)" }
                : { background:"rgba(255,255,255,0.05)", color:"#64748b", border:"1px solid rgba(255,255,255,0.1)" }}>
              全部
            </button>
            {FAMILY_CONFIGS.map(f => (
              <button key={f.id} onClick={() => setSelFamily(f.id)}
                className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all"
                style={selFamily === f.id
                  ? { background:"rgba(99,102,241,0.35)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.5)" }
                  : { background:"rgba(255,255,255,0.05)", color:"#64748b", border:"1px solid rgba(255,255,255,0.1)" }}>
                {f.emoji} {f.label}
              </button>
            ))}
          </div>

          {families.map(family => {
            const tiers = FAMILY_COLLECTIBLES[family];
            if (!tiers) return null;
            const familyConf = FAMILY_CONFIGS.find(f => f.id === family);
            const allFamilyItems = [...tiers.common, ...tiers.rare, ...tiers.boss];
            const ownedCount = allFamilyItems.filter(it => (collectibles[it.id] || 0) > 0).length;
            return (
              <div key={family} className="px-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{familyConf?.emoji}</span>
                  <span className="text-sm font-black text-white">{familyConf?.label}</span>
                  <span className="text-xs text-slate-500">{ownedCount}/{allFamilyItems.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {allFamilyItems.map(item => {
                    const fullItem = COLLECTIBLE_MAP[item.id];
                    if (!fullItem) return null;
                    const qty = collectibles[item.id] || 0;
                    const c = RARITY_COLOR[fullItem.rarity] || RARITY_COLOR.common;
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl p-3 transition-all"
                        style={{ background: qty > 0 ? c.bg : "rgba(255,255,255,0.03)", border:`1px solid ${qty > 0 ? c.border : "rgba(255,255,255,0.06)"}`, opacity: qty > 0 ? 1 : 0.45 }}>
                        <span style={{ fontSize:26, filter: qty === 0 ? "grayscale(1)" : "none" }}>{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black" style={{ color: qty > 0 ? c.text : "#64748b" }}>{item.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: qty > 0 ? c.bg : "rgba(255,255,255,0.06)", color: qty > 0 ? c.text : "#475569", border:`1px solid ${qty > 0 ? c.border : "rgba(255,255,255,0.08)"}` }}>
                              {RARITY_LABEL[fullItem.rarity]}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.desc}</div>
                        </div>
                        {qty > 0 && (
                          <div className="text-xs font-black rounded-full w-6 h-6 flex items-center justify-center shrink-0"
                            style={{ background: c.bg, color: c.text, border:`1px solid ${c.border}` }}>
                            {qty}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
