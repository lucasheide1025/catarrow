// src/components/shared/BattleResultPanel.jsx
// 通用戰鬥結算面板 — 用 config 布林開關控制顯示區塊
// 支援：單人打怪、組隊、地下城、世界 BOSS
import React from "react";
import { TIER_LABEL } from "../../lib/monsterData";
import { VARIANT_LABEL } from "../../lib/monsterRegistry";

// ── 預設 config 常數 ─────────────────────────────────────────────

export const RESULT_CONFIG_SOLO = {
  showMonsterInfo: true,
  showCoins: true, showMaterial: true, showChest: true,
  showGoldChest: true, showCard: true, showArrowDew: true,
  showDmgDealt: true, showAvgScore: true,
  showArrowCount: true, showRoundCount: true, showCritCount: true,
  showScoreBreakdown: true,
};

export const RESULT_CONFIG_PARTY = {
  ...RESULT_CONFIG_SOLO,
  showDmgTaken: true,
  showPartyMembers: true, showPartyLeader: true,
};

export const RESULT_CONFIG_DUNGEON = {
  ...RESULT_CONFIG_PARTY,
  showIsDungeonBoss: true, showSpecialItem: true,
};

export const RESULT_CONFIG_WORLDBOSS = {
  showMonsterInfo: true,
  showCoins: true, showMaterial: true, showCard: true, showArrowDew: true,
  showDmgDealt: true, showAvgScore: true,
  showArrowCount: true, showCritCount: true,
  showPartyMembers: true,
};

// ── 共用樣式常數 ──────────────────────────────────────────────────
const S = {
  panel: {
    background: "#0f172a",
    borderRadius: 12,
    padding: "16px",
    color: "#e2e8f0",
    fontFamily: "sans-serif",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },
  section: {
    background: "#1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  label: { color: "#94a3b8", fontSize: 12 },
  value: { color: "#f1f5f9", fontWeight: 700 },
  gold: { color: "#fbbf24", fontWeight: 700 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px 12px",
  },
  statCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  statLabel: { color: "#64748b", fontSize: 11 },
  statValue: { color: "#e2e8f0", fontWeight: 700, fontSize: 14 },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
  },
  divider: {
    height: 1,
    background: "#334155",
    margin: "8px 0",
  },
};

// ── 子元件：怪物資訊 ──────────────────────────────────────────────
function MonsterInfoSection({ monster, tier, variant, isDungeonBoss }) {
  return (
    <div style={S.section}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 36 }}>{monster?.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#f1f5f9" }}>
            {monster?.name}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {tier && (
              <span style={{ ...S.tag, color: tier.color, background: tier.bg }}>
                {tier.label}
              </span>
            )}
            {variant && (
              <span style={{ ...S.tag, color: variant.color, background: "#1e293b", border: `1px solid ${variant.color}` }}>
                {variant.label}
              </span>
            )}
            {isDungeonBoss && (
              <span style={{ ...S.tag, color: "#fbbf24", background: "#422006", border: "1px solid #d97706" }}>
                BOSS 房
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 子元件：掉落資訊 ──────────────────────────────────────────────
function DropsSection({ drops, config }) {
  if (!drops) return null;

  const hasAny = (
    (config.showCoins && drops.coins > 0) ||
    (config.showMaterial && (drops.material || drops.materials?.length > 0)) ||
    (config.showChest && drops.chest) ||
    (config.showGoldChest && drops.goldChest) ||
    (config.showCard && drops.card) ||
    (config.showArrowDew && drops.arrowDew > 0) ||
    (config.showSpecialItem && drops.specialItem)
  );
  if (!hasAny) return null;

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>戰利品</div>
      {config.showCoins && drops.coins > 0 && (
        <div style={S.row}>
          <span>🪙</span>
          <span style={S.label}>金幣</span>
          <span style={S.gold}>+{drops.coins}</span>
        </div>
      )}
      {config.showArrowDew && drops.arrowDew > 0 && (
        <div style={S.row}>
          <span>💧</span>
          <span style={S.label}>箭露</span>
          <span style={{ ...S.value, color: "#38bdf8" }}>+{drops.arrowDew}</span>
        </div>
      )}
      {config.showMaterial && drops.material && (
        <div style={S.row}>
          <span>{drops.material.icon}</span>
          <span style={S.label}>素材</span>
          <span style={S.value}>{drops.material.name}</span>
        </div>
      )}
      {config.showMaterial && drops.materials?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {drops.materials.map((m, i) => (
            <div key={i} style={S.row}>
              <span>{m.icon}</span>
              <span style={S.label}>素材</span>
              <span style={S.value}>{m.name}{(m.quantity || 1) > 1 ? ` ×${m.quantity}` : ""}</span>
            </div>
          ))}
        </div>
      )}
      {config.showChest && drops.chestList?.length > 0 ? (
        drops.chestList.map((chest, i) => (
          <div key={i} style={S.row}>
            <span>{chest.icon || "📦"}</span>
            <span style={S.label}>寶箱</span>
            <span style={{ ...S.value, color: "#a3e635" }}>{chest.name || "寶箱"}</span>
          </div>
        ))
      ) : (config.showChest && drops.chest && (
        <div style={S.row}>
          <span>📦</span>
          <span style={S.label}>普通寶箱</span>
          <span style={{ ...S.value, color: "#a3e635" }}>獲得！</span>
        </div>
      ))}
      {config.showGoldChest && drops.goldChest && (
        <div style={S.row}>
          <span>🎁</span>
          <span style={S.label}>金幣寶箱</span>
          <span style={S.gold}>{drops.coinChestName || "獲得！"}</span>
        </div>
      )}
      {/* 經驗值（合併進戰利品欄） */}
      {drops.adventurerXP > 0 && (
        <div style={S.row}><span>⚔️</span><span style={S.label}>冒險者 XP</span><span style={{ ...S.value, color: "#c084fc" }}>+{drops.adventurerXP}</span></div>
      )}
      {drops.archerXP > 0 && (
        <div style={S.row}><span>🏹</span><span style={S.label}>射手 XP</span><span style={{ ...S.value, color: "#fbbf24" }}>+{drops.archerXP}</span></div>
      )}
      {drops.catXP > 0 && (
        <div style={S.row}><span>🐱</span><span style={S.label}>貓貓 XP</span><span style={{ ...S.value, color: "#f9a8d4" }}>+{drops.catXP}</span></div>
      )}
      {config.showCard && drops.card && (
        <div style={S.row}>
          <span>{drops.card.icon}</span>
          <span style={S.label}>卡片</span>
          <span style={{ ...S.value, color: "#c084fc" }}>{drops.card.name}</span>
        </div>
      )}
      {config.showSpecialItem && drops.specialItem && (
        <div style={S.row}>
          <span>{drops.specialItem.icon}</span>
          <span style={S.label}>特殊道具</span>
          <span style={{ ...S.value, color: "#f472b6" }}>{drops.specialItem.name}</span>
        </div>
      )}
    </div>
  );
}

// ── 子元件：分數統計 ──────────────────────────────────────────────
const SCORE_ORDER = ["X", "10", "9", "8", "7", "6", "M"];
const SCORE_COLOR = {
  X:  "#fbbf24",
  "10": "#a3e635",
  "9": "#34d399",
  "8": "#38bdf8",
  "7": "#818cf8",
  "6": "#94a3b8",
  M:  "#f87171",
};

function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", marginTop: 4 }}>
      {SCORE_ORDER.map((key) => {
        const count = breakdown[key];
        if (!count) return null;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{
              background: SCORE_COLOR[key] || "#94a3b8",
              color: "#0f172a",
              borderRadius: "50%",
              width: 20, height: 20,
              display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 900,
            }}>
              {key}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>×{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 子元件：戰鬥統計 ──────────────────────────────────────────────
function StatsSection({ stats, config }) {
  if (!stats) return null;

  const cells = [];
  if (config.showDmgDealt)   cells.push({ label: "造成傷害", value: (stats.dmgDealt ?? 0).toLocaleString(), color: "#f87171" });
  if (config.showDmgTaken)   cells.push({ label: "承受傷害", value: (stats.dmgTaken ?? 0).toLocaleString(), color: "#fbbf24" });
  if (config.showAvgScore)   cells.push({ label: "平均箭分", value: parseFloat(stats.avgScore ?? 0).toFixed(1), color: "#34d399" });
  if (config.showArrowCount) cells.push({ label: "總箭數",   value: stats.arrowCount ?? 0 });
  if (config.showRoundCount) cells.push({ label: "回合數",   value: stats.roundCount ?? 0 });
  if (config.showCritCount)  cells.push({ label: "爆擊次數", value: stats.critCount ?? 0, color: "#fbbf24" });

  const hasBreakdown = config.showScoreBreakdown && stats.scoreBreakdown;

  if (cells.length === 0 && !hasBreakdown) return null;

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>戰鬥統計</div>
      {cells.length > 0 && (
        <div style={S.statsGrid}>
          {cells.map(({ label, value, color }) => (
            <div key={label} style={S.statCell}>
              <span style={S.statLabel}>{label}</span>
              <span style={{ ...S.statValue, ...(color ? { color } : {}) }}>{value}</span>
            </div>
          ))}
        </div>
      )}
      {hasBreakdown && (
        <>
          {cells.length > 0 && <div style={S.divider} />}
          <div style={{ ...S.statLabel, marginBottom: 4 }}>分數分布</div>
          <ScoreBreakdown breakdown={stats.scoreBreakdown} />
        </>
      )}
      {config.showTargetFace && (
        <>
          <div style={S.divider} />
          <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "8px 0" }}>
            {/* 靶面分析 — 待實作 */}
            靶面分析（即將推出）
          </div>
        </>
      )}
    </div>
  );
}

// ── 子元件：隊伍資訊 ──────────────────────────────────────────────
function PartySection({ party, config }) {
  if (!party?.members?.length) return null;
  if (!config.showPartyMembers) return null;

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>隊伍成員</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {party.members.map((m) => {
          const isLeader = config.showPartyLeader && m.id === party.leaderId;
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isLeader ? "#422006" : "#0f172a",
                border: isLeader ? "2px solid #fbbf24" : "2px solid #334155",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: isLeader ? "#fbbf24" : "#94a3b8",
                flexShrink: 0,
                opacity: m.alive === false ? 0.5 : 1,
              }}>
                {m.name?.[0] ?? "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{m.name ?? "?"}</span>
                  {isLeader && (
                    <span style={{ ...S.tag, color: "#fbbf24", background: "#422006", fontSize: 10 }}>隊長</span>
                  )}
                  {m.isMvp === true && (
                    <span style={{ ...S.tag, color: "#fbbf24", background: "#422006", fontSize: 10 }}>👑 MVP</span>
                  )}
                  {m.alive === false && (
                    <span style={{ ...S.tag, color: "#f87171", background: "#450a0a", fontSize: 10 }}>💀 陣亡</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: m.alive === false ? "#475569" : "#f87171", fontSize: 12, fontWeight: 700 }}>
                  {(m.dmgDealt ?? 0).toLocaleString()} 傷
                </div>
                {(m.crits ?? 0) > 0 && (
                  <div style={{ color: "#fbbf24", fontSize: 10 }}>
                    ×{m.crits} 爆擊
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────
/**
 * BattleResultPanel — 通用戰鬥結算面板
 * @param {BattleResultData} data
 * @param {BattleResultConfig} config
 */
export function BattleResultPanel({ data, config = {} }) {
  if (!data) return null;
  const { monster, drops, stats, party } = data;
  const tier    = TIER_LABEL[monster?.tier];
  const variant = VARIANT_LABEL[monster?.variant || "normal"];
  const isDungeonBoss = config.showIsDungeonBoss && monster?.isDungeonBoss;

  return (
    <div style={S.panel}>
      {config.showMonsterInfo && (
        <MonsterInfoSection
          monster={monster}
          tier={tier}
          variant={variant}
          isDungeonBoss={isDungeonBoss}
        />
      )}
      <DropsSection drops={drops} config={config} />
      <StatsSection stats={stats} config={config} />
      <PartySection party={party} config={config} />
    </div>
  );
}
