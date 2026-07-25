// src/guild/GuildTestApp.jsx
// 冒險者公會「戰鬥雛形」測試殼。入口：網址帶 ?guild（隱藏測試用）。
// 已登入 → 讀真存檔（guildProfiles/{memberId}），結算真的發獎（CAT幣/聲望/公會裝/材料/金幣）。
// 未登入（直接開 ?guild）→ 離線試玩：假 member + 起手裝，一切照跑但不寫 Firestore。
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { rollExpedition } from "./domain/rollExpedition";
import { calcGuildExpeditionStats, STAT_META } from "./domain/guildStats";
import { settleExpedition } from "./domain/settleExpedition";
import { normalizeGuildProfile } from "./domain/guildRewards";
import { rankUnlocks, nextRankInfo, canAcceptDanger, repNeededForDanger } from "./domain/guildRank";
import { loadGuildProfile, saveGuildProfile, grantExpeditionRewards, buyGuildShopItem } from "./db/guildDb";
import { DANGER_META } from "./domain/rollExpedition";
import GuildBattle from "./ui/GuildBattle";
import GuildLoadout from "./ui/GuildLoadout";
import GuildStash from "./ui/GuildStash";
import GuildShop from "./ui/GuildShop";

const MOCK_MEMBER = { archerXP: 8000 };
const MOCK_CATS = [
  { id: "cat_a", name: "小黑", icon: "🐈‍⬛", atk: 28, def: 6 },
  { id: "cat_b", name: "橘子", icon: "🐈", atk: 22, def: 4 },
];

function newRun(danger) {
  return { exp: rollExpedition({ danger, family: "ghost" }), key: Date.now() };
}

export default function GuildTestApp() {
  const { profile, loading } = useAuth();
  const memberId = profile?.id || null;
  const member = profile || MOCK_MEMBER;

  const [gp, setGp] = useState(null);            // 公會存檔（null = 載入中）
  const [danger, setDanger] = useState(1);
  const [run, setRun] = useState(() => newRun(1));
  const [result, setResult] = useState(null);
  const [loot, setLoot] = useState(null);        // 只 roll 一次：顯示與入帳同一份
  const [grantMsg, setGrantMsg] = useState("");
  const [phase, setPhase] = useState("loadout"); // loadout | battle | stash | shop
  const [supplies, setSupplies] = useState({ food: 6, water: 6 });
  const grantedRef = useRef(null);               // 一趟只請領一次

  // 載入存檔（auth 還在解析時先不載，免得用離線存檔覆蓋真存檔）
  useEffect(() => {
    if (loading) return;
    let alive = true;
    loadGuildProfile(memberId).then(p => { if (alive) setGp(p); });
    return () => { alive = false; };
  }, [memberId, loading]);

  // 結算入帳：settleExpedition 有隨機性，只能 roll 這一次
  useEffect(() => {
    if (!result || !gp || grantedRef.current === run.key) return;
    grantedRef.current = run.key;
    const rolled = result.status === "won" ? settleExpedition(result) : { won: false, materials: [], junk: [], equipDrops: [], coins: 0, catCoins: 0 };
    setLoot(rolled);
    grantExpeditionRewards(memberId, rolled, { danger, profile: gp }).then(res => {
      setGp(res.profile);
      if (res.offline) setGrantMsg("（未登入：離線試玩，未存檔）");
      else if (!res.ok) setGrantMsg(`⚠️ 入帳失敗：${res.reason || "請確認 Firestore 規則已貼上"}`);
      else if (rolled.won) setGrantMsg(`✅ 已入帳　聲望 +${res.repGained}${res.stashFull ? "　⚠️倉庫已滿，裝備沒收進去" : ""}`);
    });
  }, [result, gp, run.key, memberId, danger]);

  const restart = d => { setResult(null); setLoot(null); setGrantMsg(""); setDanger(d); setRun(newRun(d)); setPhase("loadout"); };

  const changeProfile = next => {
    const p = normalizeGuildProfile(next);
    setGp(p);
    saveGuildProfile(memberId, p);
  };

  const buy = async itemId => {
    const res = await buyGuildShopItem(memberId, gp, itemId);
    if (res.ok) setGp(res.profile);
    return res;
  };

  if (loading || !gp) {
    return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b1220", color: "#94a3b8", fontSize: 13 }}>載入公會存檔…</div>;
  }

  const rankInfo = nextRankInfo(gp.rep);
  const rank = rankInfo.current;

  // 危險度按鈕（階級不足就鎖住，並顯示還差多少聲望——鎖著也要看得到目標）
  const DangerButtons = ({ small }) => (
    <>
      {[1, 2, 3].map(d => {
        const locked = !canAcceptDanger(gp.rep, d);
        const need = repNeededForDanger(gp.rep, d);
        return (
          <button key={d} type="button" disabled={locked} onClick={() => restart(d)}
            title={locked ? `還差 ${need} 聲望` : ""}
            style={{ padding: small ? "6px 10px" : "10px 16px", borderRadius: 10, fontWeight: 900, fontSize: small ? 11 : 14, color: "#fff", border: "none",
              background: locked ? "#475569" : d === danger ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#334155",
              cursor: locked ? "not-allowed" : "pointer" }}>
            {locked ? "🔒" : DANGER_META[d].skulls} {DANGER_META[d].label}
            {locked && <span style={{ fontSize: 10, opacity: .8 }}>（差{need}聲望）</span>}
          </button>
        );
      })}
    </>
  );

  if (phase === "stash") {
    return <GuildStash member={member} profile={gp} onChange={changeProfile} onClose={() => setPhase("loadout")} />;
  }

  if (phase === "shop") {
    return <GuildShop profile={gp} onBuy={buy} onClose={() => setPhase("loadout")} />;
  }

  if (result) {
    const won = result.status === "won";
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", background: "linear-gradient(180deg,#0a1a0a,#05100a)", color: "#e2e8f0" }}>
        <div style={{ fontSize: 56 }}>{won ? "🎉" : "💀"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: won ? "#fbbf24" : "#f87171" }}>{won ? "凱旋歸來！" : "遠征失敗"}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{won ? "討伐完成，戰利品如下" : result.lostReason}</div>
        {loot && won && (
          <div style={{ width: "100%", maxWidth: 340, background: "rgba(0,0,0,.35)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 12, padding: 12, fontSize: 13, textAlign: "left", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "#fbbf24", fontWeight: 900 }}>💰 {loot.coins} 金幣　🐾 {loot.catCoins} CAT幣</div>
            {loot.materials.length > 0 && <div style={{ color: "#a7f3d0" }}>📦 材料：{loot.materials.map(m => `${m.familyTier}×${m.qty}`).join("、")}</div>}
            {loot.junk.length > 0 && <div style={{ color: "#93c5fd" }}>🎒 雜貨：{loot.junk.map(j => `${j.icon}${j.name}`).join("、")}</div>}
            {loot.equipDrops.length > 0 && <div style={{ color: "#f0abfc", fontWeight: 800 }}>⭐ 裝備掉落：{loot.equipDrops.map(e => `${e.grade} ${e.archetypeId}`).join("、")}</div>}
            {loot.materials.length === 0 && loot.junk.length === 0 && loot.equipDrops.length === 0 && <div style={{ color: "#64748b" }}>（這趟只拿到基礎報酬）</div>}
          </div>
        )}
        {grantMsg && <div style={{ fontSize: 12, color: grantMsg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{grantMsg}</div>}

        {/* 階級進度：聲望的意義在這裡被看見 */}
        <div style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: rank.color, fontWeight: 900 }}>{rank.icon} {rank.name}</span>
            <span style={{ color: "#94a3b8" }}>🏅 {gp.rep}{rankInfo.next ? `　距 ${rankInfo.next.name} 還差 ${rankInfo.need}` : "　已達頂階"}</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>🐾 CAT幣 {gp.catCoins}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
          <DangerButtons />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => { setResult(null); setPhase("stash"); }} style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 900, fontSize: 12, color: "#fff", border: "none", background: "#334155", cursor: "pointer" }}>🎒 倉庫</button>
          <button onClick={() => { setResult(null); setPhase("shop"); }} style={{ padding: "8px 14px", borderRadius: 10, fontWeight: 900, fontSize: 12, color: "#fff", border: "none", background: "#4c1d95", cursor: "pointer" }}>🏪 商店</button>
        </div>
      </div>
    );
  }

  if (phase === "loadout") {
    return (
      <div>
        <div style={{ padding: "8px 12px", background: "#1a1207", color: "#fcd34d", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ color: rank.color }}>{rank.icon} {rank.name}　🐾 {gp.catCoins}　🏅 {gp.rep}{memberId ? "" : "（離線試玩）"}</span>
          <span style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setPhase("stash")} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#334155", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🎒 倉庫</button>
            <button type="button" onClick={() => setPhase("shop")} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#4c1d95", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🏪 商店</button>
          </span>
        </div>
        {/* 委託危險度：階級 gate 就在這裡發生作用 */}
        <div style={{ padding: "8px 12px", background: "#0f172a", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>委託危險度</span>
          <DangerButtons small />
        </div>
        <GuildLoadout member={member} guildEquip={gp.equipped} onDepart={sup => { setSupplies(sup); setPhase("battle"); }} />
      </div>
    );
  }

  const stats = calcGuildExpeditionStats(member, gp.equipped);
  return (
    <div>
      <div style={{ padding: "6px 12px", background: "#1a1207", color: "#fcd34d", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>
        <span>🏛️ 公會遠征雛形（測試）· 危險度 {danger}</span>
        <span style={{ color: "#94a3b8" }}>
          {Object.keys(STAT_META).map(k => `${STAT_META[k].short} ${stats[k]}`).join(" · ")}
        </span>
      </div>
      <GuildBattle key={run.key} expedition={run.exp} guildStats={stats} supplies={supplies} cats={MOCK_CATS} onEnd={setResult} />
    </div>
  );
}
