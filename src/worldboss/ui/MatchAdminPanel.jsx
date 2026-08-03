// src/worldboss/ui/MatchAdminPanel.jsx
// 🎓 比賽模式的教練面板：獎勵設定 / 發放 / 重置 / 收榜。
//
// ⚠️ 破壞性的動作（重置、發放）**一律二次確認**。比賽當天教練手忙腳亂，
//    誤觸「重置」等於整場成績歸零——那是無法補救的。
//
// ⚠️ 發放前一定要先看到「總共要發多少、還有幾個人沒發」。
//    按下去才知道發了什麼，教練不敢按。
import { useState } from "react";
import { listMatchDates } from "../../lib/raidMatchDb";
import { CHEST_TYPES } from "../../lib/itemData";
import { COIN_CHEST_TIERS } from "../../lib/lootTable";
import {
  DEFAULT_MATCH_REWARD, describeRewardConfig, matchRewardPreview, normalizeRewardConfig,
} from "../domain/matchRewards";

const box = {
  background: "rgba(15,23,42,.92)", borderRadius: 12, padding: 12, marginBottom: 9,
  border: "1px solid rgba(148,163,184,.2)",
};
const label = { fontSize: 10.5, fontWeight: 900, color: "#c7d2fe", marginBottom: 6 };
const btn = (color, filled = false) => ({
  padding: "10px 0", borderRadius: 9, cursor: "pointer",
  border: filled ? "none" : `1px solid ${color}`,
  background: filled ? color : "transparent",
  color: filled ? "#0f172a" : color, fontWeight: 900, fontSize: 12,
});

function NumField({ k, text, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800, marginBottom: 2 }}>{text}</div>
      <input type="number" min={0} value={value}
        onChange={e => onChange(k, e.target.value)}
        style={{
          width: "100%", padding: "7px 8px", borderRadius: 8, background: "#1e293b",
          border: "1px solid #334155", color: "#f8fafc", fontWeight: 900, fontSize: 13,
        }} />
    </label>
  );
}

export default function MatchAdminPanel({
  matchId, todayId = matchId, onPickMatch = null,
  players = {}, closed = false,
  onSaveConfig, onGrant, onReset, onToggleClose, config,
}) {
  const [cfg, setCfg] = useState(() => normalizeRewardConfig(config));
  const [confirm, setConfirm] = useState(null);   // "grant" | "reset"
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  // 📅 過去的場次：**點了才讀**，不要一開頁就掃整個 collection
  const [dates, setDates] = useState(null);
  const [loadingDates, setLoadingDates] = useState(false);
  const past = matchId !== todayId;

  const loadDates = async () => {
    setLoadingDates(true);
    setDates(await listMatchDates());
    setLoadingDates(false);
  };

  const preview = matchRewardPreview(players, cfg);
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const run = async (fn, done) => {
    setBusy(true); setResult("");
    const res = await fn();
    setBusy(false);
    setConfirm(null);
    setResult(res?.ok === false ? `⚠️ ${res.reason || "失敗"}` : done(res));
  };

  return (
    <div style={{ ...box, border: "1px solid rgba(251,191,36,.4)" }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#fde68a", marginBottom: 8 }}>
        🎓 教練面板　<span style={{ fontSize: 10, color: "#64748b", fontWeight: 800 }}>{matchId}</span>
      </div>

      {/* ── 📅 場次日期 ──
          ⚠️ 比賽是**一天一份文件**，過了午夜就換一場。教練隔天回來要收榜／發獎，
             一定得先切回那一天，否則會對著空的今天按，Firestore 回「找不到文件」，
             看起來就像成績整場不見了。 */}
      <div style={box}>
        <div style={label}>📅 場次日期</div>
        {past && (
          <div style={{
            fontSize: 11, fontWeight: 800, color: "#fca5a5", lineHeight: 1.5,
            background: "rgba(127,29,29,.35)", borderRadius: 8, padding: "6px 8px", marginBottom: 6,
          }}>
            正在檢視<b>過去的場次</b>（{matchId}）——只能結算，選手不能再送分。
          </div>
        )}
        {dates === null ? (
          <button type="button" onClick={loadDates} disabled={loadingDates}
            style={{ ...btn("#93c5fd"), width: "100%" }}>
            {loadingDates ? "讀取中…" : "📂 載入過去的比賽日期"}
          </button>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {dates.length === 0 && (
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>沒有任何比賽紀錄</div>
            )}
            {dates.map(d => (
              <button key={d.id} type="button" onClick={() => onPickMatch?.(d.id)}
                style={{
                  padding: "6px 9px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 900,
                  border: d.id === matchId ? "1px solid #fbbf24" : "1px solid #334155",
                  background: d.id === matchId ? "rgba(251,191,36,.18)" : "#1e293b",
                  color: d.id === matchId ? "#fde68a" : "#cbd5e1",
                }}>
                {d.id === todayId ? "今天 " : ""}{d.id}
                <span style={{ color: "#64748b", marginLeft: 4 }}>
                  {d.players}人{d.granted ? "・已發" : ""}{d.status === "closed" ? "・已收" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 獎勵設定 ── */}
      <div style={box}>
        <div style={label}>每場獎勵設定</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <NumField k="archerXPPerArrow" text="射手XP／箭" value={cfg.archerXPPerArrow} onChange={set} />
          <NumField k="catXPPerArrow" text="貓貓XP／箭" value={cfg.catXPPerArrow} onChange={set} />
          <NumField k="coinsPerPoint" text="金幣／分" value={cfg.coinsPerPoint} onChange={set} />
          <NumField k="arrowsPerChest" text="幾箭1材料箱" value={cfg.arrowsPerChest} onChange={set} />
          <NumField k="arrowsPerCoinChest" text="幾箭1金幣箱" value={cfg.arrowsPerCoinChest} onChange={set} />
          <NumField k="minArrows" text="最少箭數" value={cfg.minArrows} onChange={set} />
          <NumField k="maxChests" text="材料箱上限" value={cfg.maxChests} onChange={set} />
          <NumField k="maxCoinChests" text="金幣箱上限" value={cfg.maxCoinChests} onChange={set} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
          <label>
            <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800, marginBottom: 2 }}>材料箱等級</div>
            <select value={cfg.chestType} onChange={e => set("chestType", e.target.value)}
              style={{
                width: "100%", padding: "7px 6px", borderRadius: 8, background: "#1e293b",
                border: "1px solid #334155", color: "#f8fafc", fontWeight: 800, fontSize: 12,
              }}>
              {Object.values(CHEST_TYPES).filter(c => c.id !== "cat").map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800, marginBottom: 2 }}>金幣箱等級</div>
            <select value={cfg.coinChestTier} onChange={e => set("coinChestTier", e.target.value)}
              style={{
                width: "100%", padding: "7px 6px", borderRadius: 8, background: "#1e293b",
                border: "1px solid #334155", color: "#f8fafc", fontWeight: 800, fontSize: 12,
              }}>
              {Object.entries(COIN_CHEST_TIERS).map(([id, t]) => (
                <option key={id} value={id}>{t.icon} {t.name}（{t.min}~{t.max}）</option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={cfg.accuracyBonus}
            onChange={e => set("accuracyBonus", e.target.checked)} />
          <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 800 }}>
            平均 8 環以上，兩種寶箱各 +1
          </span>
        </label>

        <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 7, lineHeight: 1.6 }}>
          {describeRewardConfig(cfg)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginTop: 8 }}>
          <button type="button" disabled={busy}
            onClick={() => run(() => onSaveConfig(normalizeRewardConfig(cfg)), () => "✅ 設定已儲存")}
            style={btn("#60a5fa", true)}>儲存設定</button>
          <button type="button" onClick={() => setCfg(normalizeRewardConfig(DEFAULT_MATCH_REWARD))}
            style={{ ...btn("#64748b"), padding: "10px 14px" }}>還原預設</button>
        </div>
      </div>

      {/* ── 發放 ── */}
      <div style={box}>
        <div style={label}>發放獎勵</div>
        <div style={{ fontSize: 11.5, color: "#e2e8f0", fontWeight: 800, lineHeight: 1.8 }}>
          待發 <b style={{ color: "#fbbf24" }}>{preview.pending}</b> 人
          ・已發 {preview.already} 人
          ・不符資格 {preview.skipped} 人
        </div>
        {preview.pending > 0 && (
          <div style={{
            marginTop: 6, padding: "8px 10px", borderRadius: 9,
            background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.2)",
            fontSize: 11, color: "#cbd5e1", lineHeight: 1.8,
          }}>
            總共要發：射手XP <b style={{ color: "#fbbf24" }}>{preview.totals.archerXP}</b>
            ・貓XP <b style={{ color: "#fbbf24" }}>{preview.totals.catXP}</b>
            ・金幣 <b style={{ color: "#fbbf24" }}>{preview.totals.coins}</b>
            <br />材料箱 <b style={{ color: "#fbbf24" }}>{preview.totals.chests}</b> 個
            ・金幣箱 <b style={{ color: "#fbbf24" }}>{preview.totals.coinChests}</b> 個
          </div>
        )}
        <button type="button" disabled={busy || !preview.pending}
          onClick={() => setConfirm("grant")}
          style={{
            ...btn("#f59e0b", true), width: "100%", marginTop: 8,
            opacity: preview.pending ? 1 : .4,
            cursor: preview.pending ? "pointer" : "not-allowed",
          }}>🎁 發放給 {preview.pending} 位選手</button>
        <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 5, lineHeight: 1.6 }}>
          已發過的人不會重複領——按第二次只會發給新加入的。
        </div>
      </div>

      {/* ── 場次控制 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <button type="button" disabled={busy}
          onClick={() => run(onToggleClose, () => (closed ? "✅ 已重新開放" : "✅ 已收榜"))}
          style={btn(closed ? "#4ade80" : "#f59e0b")}>
          {closed ? "重新開放送分" : "🏁 收榜"}
        </button>
        <button type="button" disabled={busy} onClick={() => setConfirm("reset")}
          style={btn("#f87171")}>♻️ 重置整場</button>
      </div>

      {result && (
        <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 9,
          background: result.startsWith("⚠️") ? "rgba(127,29,29,.5)" : "rgba(21,128,61,.35)",
          color: result.startsWith("⚠️") ? "#fecaca" : "#bbf7d0",
          fontSize: 11.5, fontWeight: 800,
        }}>{result}</div>
      )}

      {/* ⚠️ 破壞性動作一律二次確認——比賽當天誤觸重置是無法補救的 */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 400, display: "grid", placeItems: "center",
          background: "rgba(2,6,23,.92)", padding: 20,
        }}>
          <div style={{
            maxWidth: 330, width: "100%", background: "#0f172a", borderRadius: 16,
            padding: 18, border: `1px solid ${confirm === "reset" ? "#f87171" : "#f59e0b"}`,
            textAlign: "center",
          }}>
            <div style={{
              fontSize: 15, fontWeight: 900, marginBottom: 6,
              color: confirm === "reset" ? "#fca5a5" : "#fde68a",
            }}>
              {confirm === "reset" ? "⚠️ 重置整場比賽？" : "確認發放獎勵？"}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.8, marginBottom: 14 }}>
              {confirm === "reset"
                ? <>所有射手的分數、箭數、落點紀錄<b style={{ color: "#f87171" }}>全部歸零</b>，
                    而且<b style={{ color: "#f87171" }}>救不回來</b>。<br />確定要重新開始這一場嗎？</>
                : <>將發給 <b style={{ color: "#fbbf24" }}>{preview.pending}</b> 位選手：
                    射手XP {preview.totals.archerXP}、貓XP {preview.totals.catXP}、
                    金幣 {preview.totals.coins}、材料箱 {preview.totals.chests}、
                    金幣箱 {preview.totals.coinChests}。</>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setConfirm(null)} disabled={busy}
                style={{ ...btn("#60a5fa", true), flex: 1 }}>取消</button>
              <button type="button" disabled={busy}
                onClick={() => (confirm === "reset"
                  ? run(onReset, () => "✅ 已重置整場")
                  : run(onGrant, res => `✅ 已發放給 ${res?.granted?.length || 0} 人`
                      + (res?.failed?.length ? `（${res.failed.length} 人失敗，請再按一次）` : "")))}
                style={{
                  ...btn(confirm === "reset" ? "#f87171" : "#f59e0b", true),
                  padding: "10px 18px",
                }}>{busy ? "處理中…" : confirm === "reset" ? "確定重置" : "確定發放"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
