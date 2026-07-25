// src/guild/ui/GuildVault.jsx
// 雜貨倉庫：撈回來的雜貨**不自動賣**，玩家自己決定何時賣（作者指示 2026-07-25）。
// LUK 的評估加成是「賣出當下」才算 → 先囤著、把 LUK 養高再賣是刻意留的策略空間。
// 賣出：金幣進主線 members.coins、CAT幣進公會存檔（跟遠征結算同一條路）。
import { useState } from "react";
import { junkStockView, allJunkSellMap } from "../domain/guildRewards";
import { JUNK_RARITY } from "../data/guildJunkCatalog";
import { deriveGuildCombat } from "../domain/guildStats";
import { calcGuildExpeditionStats } from "../domain/guildStats";
import { sfxCoinDrop, sfxError, sfxClose, sfxTap } from "../../lib/sound";
import { hallBg, bgLayer, junkArt, ArtOrEmoji } from "./GuildArt";

const card = { background: "rgba(12,8,4,.72)", borderRadius: 12, padding: 12, border: "1px solid rgba(251,191,36,.18)" };
const RARITY_ORDER = ["legend", "prize", "rare", "fine", "common"];

export default function GuildVault({ member, profile, onSell, onClose }) {
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  // LUK → 評估加成（賣出當下計算，所以倉庫顯示的價格會隨裝備變動）
  const stats = calcGuildExpeditionStats(member, profile.equipped);
  const valuationMult = 1 + (deriveGuildCombat(stats).valuationBonusPct || 0);

  const rows = junkStockView(profile, valuationMult);
  const shown = filter === "all" ? rows : rows.filter(r => r.rarity === filter);
  const totalCoins = rows.reduce((s, r) => s + r.totalCoins, 0);
  const totalCat = rows.reduce((s, r) => s + r.totalCatCoins, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  const sell = async (sellMap, label) => {
    if (busy) return;
    setBusy(true);
    const res = await onSell(sellMap, valuationMult);
    setBusy(false);
    if (res?.ok) { sfxCoinDrop(); setMsg(`✅ 賣出${label}　💰+${res.coins}　🐾+${res.catCoins}${res.offline ? "（離線試玩，未存檔）" : ""}`); }
    else { sfxError(); setMsg(`⚠️ ${res?.reason || "賣出失敗"}`); }
  };

  return (
    <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.78)" }), backgroundAttachment: "fixed", color: "#f1e7d5", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🧺 雜貨倉庫</div>
        <button type="button" onClick={() => { sfxClose(); onClose(); }} style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "#334155", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>返回</button>
      </div>

      {/* 總覽 + 一鍵全賣 */}
      <div style={{ ...card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: "#c8b89a" }}>庫存 {totalQty} 件・{rows.length} 種</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fbbf24", marginTop: 2 }}>💰 {totalCoins}　🐾 {totalCat}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              🍀 LUK 評估加成 ×{valuationMult.toFixed(2)}（LUK 越高賣越貴，可以先囤）
            </div>
          </div>
          <button type="button" disabled={busy || !totalQty} onClick={() => sell(allJunkSellMap(profile), "全部")}
            style={{ padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: 900, fontSize: 12, color: "#fff", flexShrink: 0,
              background: totalQty ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#475569", cursor: totalQty ? "pointer" : "not-allowed" }}>
            {busy ? "賣出中…" : "全部賣出"}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}

      {/* 稀有度篩選 */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {["all", ...RARITY_ORDER].map(k => {
          const on = filter === k;
          const meta = JUNK_RARITY[k];
          const n = k === "all" ? rows.length : rows.filter(r => r.rarity === k).length;
          return (
            <button key={k} type="button" onClick={() => { sfxTap(); setFilter(k); }}
              style={{ padding: "4px 9px", borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: "pointer",
                border: `1px solid ${on ? "#fbbf24" : "rgba(255,255,255,.12)"}`,
                background: on ? "rgba(251,191,36,.2)" : "rgba(0,0,0,.3)", color: meta?.color || "#e2e8f0" }}>
              {k === "all" ? "全部" : meta.label} {n}
            </button>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div style={{ ...card, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
          倉庫是空的。去遠征撈雜貨吧——高危險委託更容易出珍品。
        </div>
      )}

      {/* 庫存清單（稀有度高的在前）*/}
      {shown.map(r => {
        const meta = JUNK_RARITY[r.rarity] || JUNK_RARITY.common;
        return (
          <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10, borderColor: `${meta.color}44` }}>
            <ArtOrEmoji sources={[junkArt(r.id)]} emoji={r.icon} size={38} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 900 }}>{r.name}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: meta.color }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>×{r.qty}</span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{r.desc}</div>
              <div style={{ fontSize: 10, color: "#c8b89a", marginTop: 2 }}>單價 💰{r.unitCoins} 🐾{r.unitCatCoins}　合計 💰{r.totalCoins} 🐾{r.totalCatCoins}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              <button type="button" disabled={busy} onClick={() => sell({ [r.id]: 1 }, `${r.name} ×1`)}
                style={{ padding: "5px 9px", borderRadius: 7, border: "none", background: "#334155", color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>賣1</button>
              <button type="button" disabled={busy} onClick={() => sell({ [r.id]: r.qty }, `${r.name} ×${r.qty}`)}
                style={{ padding: "5px 9px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#a855f7,#6d28d9)", color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>全賣</button>
            </div>
          </div>
        );
      })}

      <div style={{ height: 8 }} />
    </div>
  );
}
