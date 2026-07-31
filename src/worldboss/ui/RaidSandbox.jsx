// src/worldboss/ui/RaidSandbox.jsx
// 🚧 討伐版式的試裝間（?raid）。假資料驅動，不碰 Firestore、不影響線上世界王。
//
// 為什麼要沙盒：既有慣例「先驗證再實裝」（battle-ui-redesign.md 實裝計畫第 1 條）。
// 這裡可以自由切換王、玩家強度、輸入模式，把版式與所有特效先看爽度，
// 確認 OK 才接到真正的世界王戰鬥。
import { useMemo, useState } from "react";
import { WORLD_BOSSES } from "../../lib/worldBossData";
import { WORLD_BOSS_SKILLS } from "../../lib/worldBossSkillData";
import { createRaidState } from "../domain/raidFlow";
import { raidBackground } from "../raidAssets";
import RaidScreen from "./RaidScreen";

const PRESETS = {
  rookie:  { label: "新手白板", atk: 30,  def: 30, hp: 180 },
  mid:     { label: "中階玩家", atk: 120, def: 60, hp: 260 },
  veteran: { label: "114 級好裝", atk: 300, def: 95, hp: 380 },
};

const BOSS_CHOICES = ["cat_baobao", "ghost_boss_r1", "head_coach"]
  .filter(key => WORLD_BOSSES[key])
  .concat(Object.keys(WORLD_BOSSES).slice(0, 6))
  .filter((v, i, arr) => arr.indexOf(v) === i)
  .slice(0, 8);

export default function RaidSandbox() {
  const [bossKey, setBossKey] = useState(BOSS_CHOICES[0] || Object.keys(WORLD_BOSSES)[0]);
  const [preset, setPreset] = useState("mid");
  const [inputMode, setInputMode] = useState("button");
  const [hpScale, setHpScale] = useState(0.05);   // 沙盒預設把血調低，才看得到階段轉換
  const [runId, setRunId] = useState(0);
  const [state, setState] = useState(null);
  const [summary, setSummary] = useState(null);

  const boss = WORLD_BOSSES[bossKey];

  const start = () => {
    const maxHp = Math.max(1000, Math.round((boss?.hp || 200000) * hpScale));
    const p = PRESETS[preset];
    setSummary(null);
    setState(createRaidState({
      boss: {
        key: bossKey, name: boss?.name || bossKey,
        hp: maxHp, maxHp, atk: boss?.atk || 120, def: boss?.def || 50,
        skillConfig: WORLD_BOSS_SKILLS?.[bossKey] || null,
      },
      stats: { atk: p.atk, def: p.def, hp: p.hp },
      weakClock: 1 + Math.floor(Math.random() * 12),
    }));
    setRunId(n => n + 1);
  };

  if (state) {
    return (
      <RaidScreen
        key={runId}
        state={state}
        bossKey={boss?.pixelKey || bossKey}
        bossTitle={boss?.title}
        participants={24}
        bgUrl={raidBackground(boss?.family)}
        inputMode={inputMode}
        onState={next => setState(next)}
        onFinish={next => setSummary(next)}
        onExit={() => setState(null)}
      />
    );
  }

  const cardStyle = { background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 14, marginBottom: 12 };
  const labelStyle = { fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 };

  return (
    <div style={{
      minHeight: "100dvh", background: "linear-gradient(180deg,#05040a,#0f172a)",
      color: "#e2e8f0", padding: 16, maxWidth: 520, margin: "0 auto",
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fde68a", marginBottom: 4 }}>
        🚧 世界王討伐・試裝間
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14, lineHeight: 1.7 }}>
        假資料驅動，不會碰到線上的世界王。用來確認版式與聲光效果——確認 OK 才接真的。
      </div>

      {summary && (
        <div style={{ ...cardStyle, border: "1px solid #f59e0b" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fde68a", marginBottom: 7 }}>
            {summary.bossHp <= 0 ? "🏆 討伐成功" : "戰報"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7, fontSize: 11.5 }}>
            <div>總傷害　<b style={{ color: "#fbbf24" }}>{summary.totals.damage.toLocaleString()}</b></div>
            <div>破防貢獻　<b style={{ color: "#fbbf24" }}>{summary.totals.breakPoints}</b></div>
            <div>弱點命中　<b>{summary.totals.weakHits}</b></div>
            <div>擦過　<b style={{ color: "#94a3b8" }}>{summary.totals.grazes}</b></div>
            <div>最高連擊　<b>{summary.totals.bestCombo}</b></div>
            <div>成功打斷　<b style={{ color: "#4ade80" }}>{summary.totals.interrupts}</b></div>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={labelStyle}>王</div>
        <select value={bossKey} onChange={e => setBossKey(e.target.value)}
          style={{ width: "100%", padding: 9, borderRadius: 9, background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", fontWeight: 700 }}>
          {Object.keys(WORLD_BOSSES).map(key => (
            <option key={key} value={key}>{WORLD_BOSSES[key].name}（{(WORLD_BOSSES[key].hp / 10000).toFixed(0)} 萬血）</option>
          ))}
        </select>
        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 6 }}>{boss?.desc}</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>玩家強度（驗證新老玩家的差距）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} type="button" onClick={() => setPreset(key)}
              style={{
                padding: "9px 2px", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${preset === key ? "#fbbf24" : "rgba(255,255,255,.1)"}`,
                background: preset === key ? "rgba(251,191,36,.16)" : "#1e293b",
                color: "#e2e8f0", fontSize: 11, fontWeight: 900,
              }}>
              {p.label}
              <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>ATK {p.atk}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>輸入方式</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
          {[{ id: "button", label: "⌨️ 點擊分數" }, { id: "target", label: "🎯 點擊靶面" }].map(m => (
            <button key={m.id} type="button" onClick={() => setInputMode(m.id)}
              style={{
                padding: "9px 0", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${inputMode === m.id ? "#60a5fa" : "rgba(255,255,255,.1)"}`,
                background: inputMode === m.id ? "rgba(96,165,250,.16)" : "#1e293b",
                color: "#e2e8f0", fontSize: 12, fontWeight: 900,
              }}>{m.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
          靶面模式多一層「方位弱點」加碼；按分數鍵的玩家完全不受影響。
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>王的血量（沙盒調低才看得到三個階段）</div>
        <input type="range" min="1" max="100" value={Math.round(hpScale * 100)}
          onChange={e => setHpScale(Number(e.target.value) / 100)}
          style={{ width: "100%" }} />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {Math.round(hpScale * 100)}%　＝ {Math.round((boss?.hp || 0) * hpScale).toLocaleString()} 血
        </div>
      </div>

      <button type="button" onClick={start}
        style={{
          width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff",
          fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 18px rgba(245,158,11,.4)",
        }}>
        🔥 開始討伐
      </button>
    </div>
  );
}
