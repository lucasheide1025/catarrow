// src/components/member/cards/CardDetailSheet.jsx
// 卡片詳細底頁（bottom sheet）。列表只顯示必要資訊,完整內容放這裡。
// 開啟時透過 onSeen 清除該卡紅點（寫入在 effect,不在 render）。
// 裝備/升星等實際動作由 props callback 提供（Codex 最後接線）。

import { useEffect } from "react";
import CardArtImage from "./CardArt";
import { calcCardBonus, getCardStat, canUpgradeStar, getUpgradeCost } from "../../../lib/monsterCards";
import { EXPANSION_MONSTER_BY_ID } from "../../../lib/monsterExpansionCatalog";
import { MONSTERS } from "../../../lib/monsterData";
import { getCardTalent } from "../../../lib/cardTalents";
import { getBreakRuleText } from "../../../lib/combatSkillEngine";

const STAT_LABEL = { hp: "❤️ HP", atk: "⚔️ ATK", def: "🛡️ DEF" };

const TIER_LABEL = { common: "T1", rare: "T2", elite: "T3", fierce: "T4", boss: "T5", mythic: "T6", worldboss: "世界王" };
const ENC_LABEL = { normal: "一般怪", miniBoss: "小王", boss: "大王", worldboss: "世界王" };
const FAMILY_LABEL = { ghost: "鬼怪", mountain: "山林", insect: "毒蟲", workplace: "職場", exam: "考試", temple: "西方", treasure: "寶箱" };

export default function CardDetailSheet({ view, onClose, onSeen, onEquip, onUpgrade, onPickStat, onSetTitle }) {
  // 開啟一張已取得的卡 → 清紅點（effect,不在 render 寫）
  useEffect(() => {
    if (view && view.owned && onSeen) onSeen(view.monsterId);
  }, [view, onSeen]);

  if (!view) return null;
  const owned = view.owned;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={owned ? view.name : "未取得卡片"}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,6,23,.7)", display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card-sheet"
        style={{
          width: "100%", maxHeight: "82vh", overflowY: "auto", background: "#0f172a",
          borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16,
          borderTop: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <span style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,.2)" }} />
        </div>

        {/* 立繪放大：滿寬大圖（有些卡圖真的很漂亮） */}
        <div style={{ width: "100%", maxWidth: 280, margin: "0 auto", aspectRatio: "3 / 4", borderRadius: 16, overflow: "hidden", background: "#1e293b", boxShadow: "0 8px 30px rgba(0,0,0,.45)" }}>
          <CardArtImage view={view} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#f1f5f9" }}>{owned ? view.name : "未取得"}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8" }}>
              {FAMILY_LABEL[view.family] || view.family} · {TIER_LABEL[view.tier] || view.tier} · {ENC_LABEL[view.encounter] || view.encounter}
            </div>
            {owned ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#e2e8f0" }}>
                <div style={{ color: "#facc15" }}>{"★".repeat(view.stars || 1)}{view.equipped && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 900, color: "#34d399" }}>✓ 裝備中</span>}</div>
                <div style={{ marginTop: 4 }}>重複張數：{view.duplicates || 0}</div>
                {(() => {
                  const stat = getCardStat(view);
                  if (!stat) return <div style={{ marginTop: 4, color: "#a5b4fc" }}>選擇屬性後顯示裝備效果</div>;
                  const bonus = calcCardBonus(view.tier, view.stars || 1);
                  const next = (view.stars || 1) < 5 ? calcCardBonus(view.tier, (view.stars || 1) + 1) : null;
                  return <div style={{ marginTop: 4, color: "#6ee7b7", fontWeight: 800 }}>
                    裝備效果：{STAT_LABEL[stat] || stat} +{bonus}{next != null && <span style={{ color: "#64748b", fontWeight: 400 }}>（升星後 +{next}）</span>}
                  </div>;
                })()}
                {(() => {
                  const talent = getCardTalent(view);
                  return talent ? <div style={{ marginTop: 2, color: "#c4b5fd", fontWeight: 800 }}>天賦：{talent.text}</div> : null;
                })()}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>擊敗對應怪物即可取得此卡。</div>
            )}
            {view.availability === "missing" && owned && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#f59e0b" }}>（此卡圖尚未製作,暫用替代圖）</div>
            )}
          </div>
        </div>

        {/* 怪物設定介紹：舊 60 隻用原 desc;新擴充怪用招牌技能設定＋破解提示 */}
        {view.source !== "wb" && (() => {
          const legacy = MONSTERS.find(m => m.id === view.monsterId);
          const mon = EXPANSION_MONSTER_BY_ID?.[view.monsterId];
          if (!legacy?.desc && !mon) return null;
          return (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
              {legacy?.desc && <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6, fontStyle: "italic" }}>「{legacy.desc}」</div>}
              {mon?.signatureSummary && (
                <div style={{ marginTop: legacy?.desc ? 8 : 0, fontSize: 11, color: "#d8b4fe", lineHeight: 1.55 }}>
                  ⚡ 招牌技能：{mon.signatureSummary}
                </div>
              )}
              {mon?.counterSummary && <div style={{ marginTop: 4, fontSize: 11, color: "#94a3b8", lineHeight: 1.55 }}>🎬 技能演出設定：{mon.counterSummary}</div>}
              {mon && <div style={{ marginTop: 6, padding: "7px 9px", borderRadius: 9, background: "rgba(16,185,129,.1)", border: "1px solid rgba(52,211,153,.25)", fontSize: 11, fontWeight: 800, color: "#6ee7b7", lineHeight: 1.55 }}>🎯 實際破解規則：{getBreakRuleText()}</div>}
            </div>
          );
        })()}

        {/* 動作（實際邏輯由 Codex 接線;無 callback 時停用） */}
        {owned && (<>
          {((view.tier === "mythic" || view.statMode === "choose") && !view.chosenStat) && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:16 }}>
              {["hp","atk","def"].map(stat => <button key={stat} type="button" onClick={() => onPickStat?.(view, stat)} style={{padding:10,borderRadius:10,border:"1px solid rgba(255,255,255,.14)",background:"rgba(99,102,241,.18)",color:"#e0e7ff",fontWeight:900}}>{stat.toUpperCase()}</button>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" disabled={!onEquip} onClick={() => onEquip && onEquip(view)}
              style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 800, fontSize: 14, border: "1px solid rgba(255,255,255,.15)", background: onEquip ? "#6366f1" : "rgba(255,255,255,.06)", color: onEquip ? "#fff" : "#475569" }}>
              {view.equipped ? "卸下" : "裝備"}
            </button>
            {(() => {
              const upgradable = view.source !== "wb" && canUpgradeStar(view.stars || 1, view.duplicates || 0, view.tier);
              const cost = (view.stars || 1) < 5 ? getUpgradeCost(view.stars || 1) : null;
              const enabled = !!onUpgrade && upgradable;
              return <button type="button" disabled={!enabled} onClick={() => enabled && onUpgrade(view)}
                style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 800, fontSize: 14, border: "1px solid rgba(255,255,255,.15)", background: enabled ? "#f59e0b" : "rgba(255,255,255,.06)", color: enabled ? "#111827" : "#475569" }}>
                {(view.stars || 1) >= 5 ? "已滿星" : view.source === "wb" ? "王卡不升星" : enabled ? `升星（耗重複×${cost}）` : `升星（重複 ${view.duplicates || 0}/${cost ?? "-"}）`}
              </button>;
            })()}
          </div>
          {view.source === "wb" && <button type="button" onClick={() => onSetTitle?.(view)} style={{width:"100%",marginTop:8,padding:10,borderRadius:10,border:"1px solid rgba(250,204,21,.35)",background:"rgba(250,204,21,.12)",color:"#fde68a",fontWeight:900}}>{view.activeTitle?"取消稱號":"設為展示稱號"}</button>}
        </>)}

        <button type="button" onClick={onClose}
          style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, fontWeight: 800, fontSize: 14, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "#94a3b8" }}>
          關閉
        </button>
      </div>
    </div>
  );
}
