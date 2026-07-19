// src/components/dungeon/KillLootToast.jsx — 遠征每場擊殺的掉落提示（單人／組隊共用）
// 2026-07-19 使用者要求：遠征只給寶箱，但要「直接顯示掉了什麼、有幾個」。
// 明細一律走 summarizeExpeditionChests，與結算畫面同一套敘述，避免兩處說法不一致。
import { summarizeExpeditionChests } from "../../lib/expeditionRewards";

const FAMILY_LABEL = {
  ghost: "鬼怪", mountain: "山林", insect: "毒蟲",
  workplace: "職場", exam: "考試", temple: "西方", treasure: "寶箱族",
};

export default function KillLootToast({ monsterName, chests, coins = 0, archerXP = 0, lootMult = 1 }) {
  const summary = summarizeExpeditionChests(chests);
  if (!summary.length && !coins && !archerXP) return null;
  return (
    <div style={{ position:"fixed", left:12, right:12, bottom:88, zIndex:95,
      display:"flex", justifyContent:"center", pointerEvents:"none" }}>
      <div style={{ maxWidth:340, width:"100%", padding:"10px 14px", borderRadius:14,
        background:"rgba(6,20,13,.95)", border:"1.5px solid #34d399",
        boxShadow:"0 0 22px rgba(52,211,153,.35)" }}>
        <div style={{ fontSize:12, fontWeight:900, color:"#6ee7b7", textAlign:"center" }}>
          🎁 擊殺獎勵已入背包{monsterName ? `（${monsterName}）` : ""}
        </div>
        {lootMult > 1 && (
          <div style={{ fontSize:10, color:"#fcd34d", textAlign:"center", marginTop:2 }}>
            🎲 本圖 {lootMult} 倍掉落
          </div>
        )}
        <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:3 }}>
          {summary.map(item => (
            <div key={item.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              fontSize:11, color:"#e2e8f0" }}>
              <span>
                {item.icon} {item.family ? `${FAMILY_LABEL[item.family] || item.family} ` : ""}{item.name}
              </span>
              <span style={{ fontWeight:900, color:"#fcd34d" }}>×{item.count}</span>
            </div>
          ))}
        </div>
        {(coins > 0 || archerXP > 0) && (
          <div style={{ fontSize:11, color:"#fcd34d", marginTop:4, textAlign:"center" }}>
            {coins > 0 && <span>🪙 +{coins}</span>}
            {coins > 0 && archerXP > 0 && <span>　</span>}
            {archerXP > 0 && <span style={{ color:"#c4b5fd" }}>⭐ XP +{archerXP}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
