// src/components/admin/AdminVillageManager.jsx — 後台村莊調試工具
import { useState, useEffect } from "react";
import { getMembers, adminSetVillageBuilding, adminAdjustVillageResource, adminResetVillage, subscribeVillageMarketConfig, saveVillageMarketConfig } from "../../lib/db";
import {
  BUILDING_LIST, BUILDINGS, TIERED_RESOURCES, RESOURCE_NAMES, DEFAULT_VILLAGE,
} from "../../lib/villageData";

const TIERED_LIST = ['ore','melon','fish','meat','driedfish','can','potion','fur'];
const TOP_LEVEL_RES = ['gachaCoins'];
const FLAT_RES = ['arrowdew','archer'];

const DEFAULT_BATTLE_EXCHANGE = [
  { type:'wood', icon:'📦', label:'木寶箱',   costs:[{ resource:'ore',  tier:1, count:20 }] },
  { type:'iron', icon:'🧰', label:'鐵寶箱',   costs:[{ resource:'ore',  tier:1, count:35 }, { resource:'melon', tier:1, count:25 }] },
  { type:'gold', icon:'🎁', label:'黃金寶箱', costs:[{ resource:'ore',  tier:2, count:15 }, { resource:'fish',  tier:1, count:30 }] },
  { type:'epic', icon:'💜', label:'史詩寶箱', costs:[{ resource:'ore',  tier:3, count:10 }, { resource:'meat',  tier:2, count:10 }] },
];

export default function AdminVillageManager() {
  const [members, setMembers]     = useState([]);
  const [query, setQuery]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [busy, setBusy]           = useState(false);
  const [msg, setMsg]             = useState("");
  const [deltaMap, setDeltaMap]   = useState({});
  const [lvMap, setLvMap]         = useState({});
  const [marketCfg, setMarketCfg] = useState(null);
  const [showCfg, setShowCfg]     = useState(false);

  useEffect(() => { getMembers().then(setMembers); }, []);
  useEffect(() => {
    const unsub = subscribeVillageMarketConfig(setMarketCfg);
    return unsub;
  }, []);

  const filtered = members.filter(m =>
    !query || (m.name || m.id).toLowerCase().includes(query.toLowerCase())
  );

  function flash(text) { setMsg(text); setTimeout(() => setMsg(""), 2500); }

  function getVillage(m) { return m.village || DEFAULT_VILLAGE; }
  function getBuildings(m) { return getVillage(m).buildings || DEFAULT_VILLAGE.buildings; }
  function getResources(m) { return getVillage(m).resources || {}; }

  async function setBuildingLevel(m, id) {
    const lv = Number(lvMap[id] ?? getBuildings(m)[id] ?? 1);
    setBusy(true);
    try {
      await adminSetVillageBuilding(m.id, id, lv);
      // refresh member locally
      setMembers(prev => prev.map(x => x.id !== m.id ? x : {
        ...x, village: { ...getVillage(x), buildings: { ...getBuildings(x), [id]: lv } }
      }));
      setSelected(prev => prev ? { ...prev, village: { ...getVillage(prev), buildings: { ...getBuildings(prev), [id]: lv } } } : prev);
      flash(`✓ ${BUILDINGS[id].name} → Lv.${lv}`);
    } catch(e) { flash("❌ " + e.message); }
    setBusy(false);
  }

  async function adjustResource(m, key, delta) {
    const d = Number(delta);
    if (!d) { flash("請輸入數量"); return; }
    setBusy(true);
    try {
      await adminAdjustVillageResource(m.id, key, d);
      flash(`✓ ${key} ${d > 0 ? "+" : ""}${d}`);
      // refresh member locally
      const isTopLevel = TOP_LEVEL_RES.includes(key);
      setMembers(prev => prev.map(x => {
        if (x.id !== m.id) return x;
        if (isTopLevel) return { ...x, [key]: (x[key] || 0) + d };
        return { ...x, village: { ...getVillage(x), resources: { ...getResources(x), [key]: (getResources(x)[key] || 0) + d } } };
      }));
      setSelected(prev => {
        if (!prev || prev.id !== m.id) return prev;
        if (isTopLevel) return { ...prev, [key]: (prev[key] || 0) + d };
        return { ...prev, village: { ...getVillage(prev), resources: { ...getResources(prev), [key]: (getResources(prev)[key] || 0) + d } } };
      });
    } catch(e) { flash("❌ " + e.message); }
    setBusy(false);
  }

  async function resetVillage(m) {
    if (!window.confirm(`確定要重置 ${m.name || m.id} 的村莊嗎？`)) return;
    setBusy(true);
    try {
      await adminResetVillage(m.id);
      flash("✓ 村莊已重置");
      setSelected(null);
    } catch(e) { flash("❌ " + e.message); }
    setBusy(false);
  }

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>🏡 村莊調試工具</div>

      {/* ── 市集兌換設定 ── */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setShowCfg(p => !p)}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #93c5fd",
            background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, fontSize: 13, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚔️ 市集兌換設定（打怪寶箱材料需求）</span>
          <span>{showCfg ? "▲ 收起" : "▼ 展開"}</span>
        </button>
        {showCfg && (
          <MarketExchangeConfig
            config={marketCfg}
            defaults={DEFAULT_BATTLE_EXCHANGE}
            busy={busy}
            onSave={async (items) => {
              setBusy(true);
              try { await saveVillageMarketConfig(items); flash("✓ 兌換設定已儲存"); }
              catch (e) { flash("❌ " + e.message); }
              setBusy(false);
            }}
          />
        )}
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✓") ? "#dcfce7" : "#fee2e2",
          color: msg.startsWith("✓") ? "#16a34a" : "#dc2626",
          borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontWeight: 700, fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* 搜尋 */}
      <input
        placeholder="搜尋射手姓名…"
        value={query} onChange={e => setQuery(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #e2e8f0",
          fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
      />

      {/* 射手列表 */}
      {!selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.slice(0, 30).map(m => (
            <button key={m.id} onClick={() => setSelected(m)}
              style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10,
                border: "1px solid #e2e8f0", background: "white", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{m.name || m.id}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                村莊 Lv.{m.village ? Object.values(m.village.buildings || {}).reduce((a,b)=>a+b,0) : "?"} · 🪙{m.gachaCoins || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 選中射手的村莊詳情 */}
      {selected && (
        <div>
          <button onClick={() => { setSelected(null); setLvMap({}); setDeltaMap({}); }}
            style={{ color: "#64748b", fontSize: 13, fontWeight: 700, background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>
            ← 返回列表
          </button>

          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{selected.name || selected.id}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
            🪙 扭蛋幣：{selected.gachaCoins || 0}
          </div>

          {/* 建築等級 */}
          <Section title="🏗️ 建築等級">
            {BUILDING_LIST.map(id => {
              const lv = getBuildings(selected)[id] ?? 1;
              const inputLv = lvMap[id] ?? lv;
              return (
                <Row key={id}
                  label={`${BUILDINGS[id].emoji} ${BUILDINGS[id].name}`}
                  value={`Lv.${lv}`}>
                  <input type="number" min={1} max={20} value={inputLv}
                    onChange={e => setLvMap(p => ({ ...p, [id]: e.target.value }))}
                    style={inputStyle} />
                  <ActionBtn disabled={busy} onClick={() => setBuildingLevel(selected, id)}>設定</ActionBtn>
                </Row>
              );
            })}
          </Section>

          {/* 箭露 */}
          <Section title="💧 箭露">
            <ResourceAdjustRow
              label="箭露" resKey="arrowdew"
              value={getResources(selected).arrowdew || 0}
              deltaMap={deltaMap} setDeltaMap={setDeltaMap}
              busy={busy} onAdjust={d => adjustResource(selected, "arrowdew", d)} />
          </Section>

          {/* 扭蛋幣 */}
          <Section title="🪙 扭蛋幣（共用）">
            <ResourceAdjustRow
              label="扭蛋幣" resKey="gachaCoins"
              value={selected.gachaCoins || 0}
              deltaMap={deltaMap} setDeltaMap={setDeltaMap}
              busy={busy} onAdjust={d => adjustResource(selected, "gachaCoins", d)} />
          </Section>

          {/* 貓貓射手 */}
          <Section title="🏹 貓貓射手">
            <ResourceAdjustRow
              label="射手" resKey="archer"
              value={getResources(selected).archer || 0}
              deltaMap={deltaMap} setDeltaMap={setDeltaMap}
              busy={busy} onAdjust={d => adjustResource(selected, "archer", d)} />
          </Section>

          {/* 分 tier 材料 */}
          <Section title="📦 村莊材料（T1–T5）">
            {TIERED_LIST.map(res =>
              [1,2,3,4,5].map(t => {
                const key = `${res}_t${t}`;
                const val = Math.floor(getResources(selected)[key] || 0);
                return (
                  <ResourceAdjustRow key={key}
                    label={`${RESOURCE_NAMES[res]} T${t}`} resKey={key}
                    value={val}
                    deltaMap={deltaMap} setDeltaMap={setDeltaMap}
                    busy={busy} onAdjust={d => adjustResource(selected, key, d)} />
                );
              })
            )}
          </Section>

          {/* 重置 */}
          <button
            disabled={busy}
            onClick={() => resetVillage(selected)}
            style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 10,
              background: "#fee2e2", color: "#dc2626", fontWeight: 900, border: "1px solid #fca5a5",
              cursor: "pointer", fontSize: 14 }}>
            🗑️ 重置此玩家村莊
          </button>
        </div>
      )}
    </div>
  );
}

// ── 子元件 ──────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#475569", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white",
      border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px" }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#64748b", minWidth: 44, textAlign: "right" }}>{value}</span>
      {children}
    </div>
  );
}

function ResourceAdjustRow({ label, resKey, value, deltaMap, setDeltaMap, busy, onAdjust }) {
  const d = deltaMap[resKey] ?? "";
  return (
    <Row label={label} value={value}>
      <input type="number" placeholder="±數量" value={d}
        onChange={e => setDeltaMap(p => ({ ...p, [resKey]: e.target.value }))}
        style={inputStyle} />
      <ActionBtn disabled={busy || !d} onClick={() => { onAdjust(Number(d)); setDeltaMap(p => ({ ...p, [resKey]: "" })); }}>給予</ActionBtn>
    </Row>
  );
}

function ActionBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "4px 10px", borderRadius: 7, border: "none",
        background: disabled ? "#e2e8f0" : "#3b82f6", color: disabled ? "#94a3b8" : "white",
        fontWeight: 800, fontSize: 12, cursor: disabled ? "default" : "pointer", flexShrink: 0 }}>
      {children}
    </button>
  );
}

function MarketExchangeConfig({ config, defaults, busy, onSave }) {
  const [items, setItems] = useState(config?.battleExchange || defaults);

  useEffect(() => {
    if (config?.battleExchange) setItems(config.battleExchange);
  }, [config]);

  function setCost(ei, ci, field, val) {
    setItems(prev => prev.map((ex, i) => i !== ei ? ex : {
      ...ex,
      costs: ex.costs.map((c, j) => j !== ci ? c : { ...c, [field]: val }),
    }));
  }

  function addCost(ei) {
    setItems(prev => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, costs: [...ex.costs, { resource:'ore', tier:1, count:3 }],
    }));
  }

  function removeCost(ei, ci) {
    setItems(prev => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, costs: ex.costs.filter((_,j) => j !== ci),
    }));
  }

  return (
    <div style={{ border: "1px solid #93c5fd", borderTop: "none", borderRadius: "0 0 10px 10px",
      padding: "12px", background: "#f8faff", display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((ex, ei) => (
        <div key={ex.type} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{ex.icon} {ex.label}</div>
          {ex.costs.map((c, ci) => (
            <div key={ci} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <select value={c.resource} onChange={e => setCost(ei, ci, 'resource', e.target.value)}
                style={{ ...inputStyle, width: 96, textAlign: "left" }}>
                {TIERED_LIST.map(r => <option key={r} value={r}>{RESOURCE_NAMES[r]}</option>)}
              </select>
              <span style={{ fontSize: 11, color: "#64748b" }}>T</span>
              <input type="number" min={1} max={5} value={c.tier}
                onChange={e => setCost(ei, ci, 'tier', Number(e.target.value))}
                style={{ ...inputStyle, width: 38 }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>×</span>
              <input type="number" min={1} max={99} value={c.count}
                onChange={e => setCost(ei, ci, 'count', Number(e.target.value))}
                style={{ ...inputStyle, width: 46 }} />
              {ex.costs.length > 1 && (
                <button onClick={() => removeCost(ei, ci)}
                  style={{ padding: "2px 7px", borderRadius: 6, border: "none",
                    background: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>✕</button>
              )}
            </div>
          ))}
          {ex.costs.length < 3 && (
            <button onClick={() => addCost(ei)}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 7, border: "1px dashed #86efac",
                background: "#f0fdf4", color: "#16a34a", cursor: "pointer", fontWeight: 700 }}>
              ＋ 新增條件
            </button>
          )}
        </div>
      ))}
      <ActionBtn disabled={busy} onClick={() => onSave(items)}>💾 儲存兌換設定</ActionBtn>
    </div>
  );
}

const inputStyle = {
  width: 72, padding: "4px 6px", borderRadius: 7, border: "1px solid #e2e8f0",
  fontSize: 12, textAlign: "center",
};
