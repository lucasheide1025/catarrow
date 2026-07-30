import { useState } from "react";
import { rankUnlocks, canAcceptDanger, repNeededForDanger, nextRankInfo, effectiveMaxDanger, archerDangerCap } from "../domain/guildRank";
import { currentTitle } from "../domain/guildTitles";
import { sfxOpen } from "../../lib/sound";
import { hallBg, paperBg, rankBadge, bgLayer, ArtOrEmoji } from "./GuildArt";
import GuildIcon from "./GuildIcon";

const paperStyle = {
  borderRadius: 12,
  color: "#2b1d10",
  backgroundColor: "#e8d6ae",
  backgroundImage: `linear-gradient(rgba(255,250,235,.08),rgba(255,250,235,.08)),url(${paperBg()})`,
  backgroundSize: "cover",
  boxShadow: "0 5px 15px rgba(0,0,0,.35)",
};

const dangerColor = danger => (danger >= 5 ? "#7f1d1d" : danger >= 3 ? "#b45309" : "#3f6212");

function MenuButton({ icon, iconName, label, note, color, onClick, badge }) {
  return (
    <button type="button" onClick={() => { sfxOpen(); onClick?.(); }}
      style={{
        minWidth: 0,
        padding: "11px 9px",
        borderRadius: 13,
        border: "1px solid rgba(255,255,255,.09)",
        background: color,
        color: "#fff",
        cursor: "pointer",
        textAlign: "left",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {iconName ? <GuildIcon name={iconName} size={42} label={label} /> : <span style={{ fontSize: 20 }}>{icon}</span>}
        <span style={{ minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 12 }}>{label}{badge ? ` · ${badge}` : ""}</b>
          <span style={{ display: "block", marginTop: 1, color: "#cbd5e1", fontSize: 9.5 }}>{note}</span>
        </span>
      </div>
    </button>
  );
}

export default function GuildBoard({
  profile,
  contracts,
  doneIds = [],
  onOpen,
  onOpenStash,
  onOpenShop,
  onOpenVault,
  onOpenLicense,
  onOpenTeam,
  onOpenTerritory,
  onPromotion,
  resume,
  onBack,
  onLegacy,
  archerLevel = 0,
  challengeContracts = [],
}) {
  const rankInfo = nextRankInfo(profile);
  const rank = rankInfo.current;
  const { maxDanger: rankMaxDanger } = rankUnlocks(profile);
  // 實際上限＝公會階級與射手等級取高者（射手等級最高開到 ☠️5，☠️6 仍要公會資歷）
  const maxDanger = effectiveMaxDanger(profile, archerLevel);
  const archerCap = archerDangerCap(archerLevel);
  const openable = contracts.filter(contract => canAcceptDanger(profile, contract.danger, archerLevel));
  // 挑戰委託另開分頁：一般 18 張＋挑戰 12 張塞在同一面板手機上太長
  const [tab, setTab] = useState("daily");
  const shownContracts = tab === "daily" ? contracts : challengeContracts;
  const challengeOpenable = challengeContracts.filter(c => canAcceptDanger(profile, c.danger, archerLevel));
  const challengeDone = challengeOpenable.filter(c => doneIds.includes(c.id)).length;
  const doneCount = openable.filter(contract => doneIds.includes(contract.id)).length;
  const junkCount = Object.values(profile.junkStock || {}).reduce((sum, count) => sum + count, 0);
  const wornTitle = currentTitle(profile);

  return (
    <div style={{
      minHeight: "100dvh",
      ...bgLayer(hallBg(), { overlay: "rgba(10,7,3,.7)" }),
      backgroundAttachment: "fixed",
      color: "#f8fafc",
      padding: "clamp(12px,3vw,22px)",
    }}>
      <main style={{ width: "min(100%,860px)", margin: "0 auto" }}>
        {(onBack || onLegacy) ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 11 }}>
            {onBack ? (
              <button type="button" onClick={() => { sfxOpen(); onBack(); }}
                style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(251,191,36,.3)", background: "rgba(12,8,4,.8)", color: "#fde68a", fontWeight: 800 }}>
                返回射箭場
              </button>
            ) : <span />}
            {onLegacy ? (
              <button type="button" onClick={() => { sfxOpen(); onLegacy(); }}
                style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(148,163,184,.25)", background: "rgba(30,41,59,.82)", color: "#cbd5e1", fontWeight: 800 }}>
                舊版入口
              </button>
            ) : null}
          </div>
        ) : null}

        <section onClick={() => { sfxOpen(); onOpenLicense?.(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 13,
            borderRadius: 17,
            background: "linear-gradient(135deg,rgba(12,8,4,.92),rgba(30,25,15,.88))",
            border: `1px solid ${rank.color}66`,
            boxShadow: "0 14px 36px rgba(0,0,0,.28)",
            cursor: onOpenLicense ? "pointer" : "default",
          }}>
          <ArtOrEmoji sources={[rankBadge(rank.id)]} emoji={rank.icon} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "#a89878" }}>冒險者階級</div>
            <div style={{ marginTop: 1, fontSize: 18, fontWeight: 900, color: rank.color }}>
              {rank.name}
              {wornTitle ? <span style={{ marginLeft: 7, color: "#fcd34d", fontSize: 11 }}>{wornTitle.icon} {wornTitle.name}</span> : null}
            </div>
            <div style={{ height: 6, margin: "7px 0 4px", overflow: "hidden", borderRadius: 99, background: "rgba(255,255,255,.1)" }}>
              <div style={{ width: `${rankInfo.progressPct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", color: "#c8b89a", fontSize: 10 }}>
              <span>聲望 {profile.rep}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><GuildIcon name="catCoin" size={18} />CAT {profile.catCoins}</span>
              <span>可接 T1–T{maxDanger}</span>
              {/* 射手等級開得比公會階級高時要講清楚，否則玩家不知道為何突然能接高危險度 */}
              {archerCap > rankMaxDanger && (
                <span style={{ color: "#7dd3fc" }}>
                  🏹 射手 Lv{archerLevel} 額外開放 T{rankMaxDanger + 1}–T{archerCap}
                </span>
              )}
              <span>今日 {doneCount}/{openable.length}</span>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 11 }}>
          <div style={{ margin: "0 2px 7px", fontSize: 11, color: "#a89878" }}>公會設施</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 7 }}>
            <MenuButton iconName="stash" label="裝備倉庫" note="整備與強化" color="rgba(51,65,85,.9)" onClick={onOpenStash} />
            <MenuButton iconName="shop" label="公會商店" note="補給與材料" color="rgba(76,29,149,.9)" onClick={onOpenShop} />
            <MenuButton iconName="territory" label="公會領地" note="建設與生產" color="rgba(22,101,52,.9)" onClick={onOpenTerritory} />
            <MenuButton iconName="vault" label="戰利品庫" note="出售雜物" color="rgba(120,53,15,.9)" onClick={onOpenVault} badge={junkCount || ""} />
            <MenuButton iconName="contracts" label="組隊遠征" note="與同伴出發" color="rgba(21,94,117,.9)" onClick={onOpenTeam} />
          </div>
        </section>

        {resume ? (
          <section style={{ marginTop: 11, padding: 12, borderRadius: 14, background: "rgba(120,53,15,.72)", border: "1px solid rgba(251,191,36,.5)" }}>
            <div style={{ fontSize: 10, color: "#fbbf24" }}>未完成的遠征</div>
            <b style={{ display: "block", margin: "2px 0 9px", fontSize: 13 }}>{resume.label}</b>
            <div style={{ display: "flex", gap: 7 }}>
              <button type="button" onClick={() => { sfxOpen(); resume.onResume(); }}
                style={{ flex: 1, padding: 9, border: 0, borderRadius: 10, background: "#d97706", color: "#fff", fontWeight: 900 }}>繼續遠征</button>
              <button type="button" onClick={() => { sfxOpen(); resume.onDrop(); }}
                style={{ padding: "9px 14px", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, background: "rgba(0,0,0,.3)", color: "#cbd5e1", fontWeight: 800 }}>放棄</button>
            </div>
          </section>
        ) : null}

        {rankInfo.trialAvailable ? (
          <button type="button" onClick={() => { sfxOpen(); onPromotion?.(); }}
            style={{ width: "100%", marginTop: 11, padding: 13, borderRadius: 14, border: "1px solid #fbbf24", background: "linear-gradient(135deg,#7f1d1d,#4c1d95)", color: "#fff", textAlign: "left", cursor: "pointer" }}>
            <b style={{ display: "block", color: "#fde68a" }}>⚔️ {rankInfo.next.name}晉升試煉已解鎖</b>
            <span style={{ display: "block", marginTop: 3, fontSize: 10.5, color: "#ddd6fe" }}>挑戰固定怪物陣容；失敗不占每日委託，可立即重試。</span>
          </button>
        ) : null}

        <section style={{ marginTop: 15 }}>
          <style>{BOARD_FX_CSS}</style>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[
              { id: "daily", label: "今日委託", icon: "📜", done: doneCount, total: openable.length },
              { id: "challenge", label: "挑戰委託", icon: "☠️", done: challengeDone, total: challengeOpenable.length },
            ].map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => { sfxOpen(); setTab(t.id); }}
                  className={active && t.id === "challenge" ? "gb-tab-danger" : undefined}
                  style={{
                    flex: 1, padding: "9px 8px", borderRadius: 10, cursor: "pointer",
                    border: active ? "1px solid rgba(251,191,36,.65)" : "1px solid rgba(255,255,255,.10)",
                    background: active
                      ? (t.id === "challenge"
                        ? "linear-gradient(135deg,rgba(127,29,29,.92),rgba(69,10,10,.92))"
                        : "linear-gradient(135deg,rgba(120,80,20,.9),rgba(60,38,8,.92))")
                      : "rgba(20,14,6,.55)",
                    color: active ? "#fde68a" : "#a89878",
                    fontWeight: 900, fontSize: 12.5, textAlign: "left",
                    boxShadow: active ? "0 4px 14px rgba(0,0,0,.45)" : "none",
                    transition: "background .18s ease, color .18s ease",
                  }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
                  <span style={{ display: "block", marginTop: 2, fontSize: 9.5, opacity: .85, fontWeight: 700 }}>
                    {t.done}/{t.total} 完成
                  </span>
                </button>
              );
            })}
          </div>
          {tab === "challenge" && (
            <div style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 9,
              background: "rgba(127,29,29,.28)", border: "1px solid rgba(248,113,113,.32)",
              color: "#fecaca", fontSize: 10.5, lineHeight: 1.5 }}>
              同樣的危險度，敵人帶著<b>詞綴</b>。獎勵與聲望大幅提高，但公會不保證你回得來。
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 8 }}>
            {shownContracts.map(contract => {
              const locked = !canAcceptDanger(profile, contract.danger, archerLevel);
              const need = repNeededForDanger(profile, contract.danger);
              const done = doneIds.includes(contract.id);
              const tier = contract.tiers?.[0];
              return (
                <button key={contract.id} type="button" onClick={() => { sfxOpen(); onOpen(contract); }}
                  className={contract.challenge && !locked && !done
                    ? (contract.challenge === "perilous" ? "gb-card-perilous" : "gb-card-elite")
                    : "gb-card"}
                  style={{
                    ...paperStyle,
                    minHeight: contract.challenge ? 150 : 126,
                    padding: "10px 11px",
                    border: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    opacity: locked || done ? .65 : 1,
                    filter: done ? "grayscale(.55)" : "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 5 }}>
                    <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ padding: "2px 5px", borderRadius: 4, color: "#fff", background: dangerColor(contract.danger), fontSize: 9, fontWeight: 900 }}>{contract.skulls}</span>
                      {contract.challengeMeta && (
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 900,
                          color: "#1c1917", background: contract.challengeMeta.color }}>
                          {contract.challengeMeta.icon}{contract.challengeMeta.name}
                        </span>
                      )}
                    </span>
                    <b style={{ color: tier?.color || "#5b4527", fontSize: 10 }}>T{tier?.tierNo}</b>
                  </div>
                  <b style={{ color: "#241809", fontSize: 13, lineHeight: 1.35 }}>{contract.title}</b>
                  {contract.affixList?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {contract.affixList.map(affix => (
                        <span key={affix.id} title={affix.desc}
                          style={{ padding: "1.5px 5px", borderRadius: 999, fontSize: 9, fontWeight: 900,
                            color: "#1c1917", background: affix.color, whiteSpace: "nowrap" }}>
                          {affix.icon}{affix.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: "auto", color: "#5b4527", fontSize: 9.5 }}>
                    {contract.modeMeta?.icon} {contract.modeMeta?.label}　{(contract.familyTags || []).map(family => family.icon).join("")}
                  </div>
                  {contract.rewardMult?.loot > 1 && (
                    <div style={{ color: "#9a3412", fontSize: 9.5, fontWeight: 900 }}>
                      🎁 掉落 ×{contract.rewardMult.loot}　🏅 聲望 ×{contract.rewardMult.rep}
                    </div>
                  )}
                  <div style={{ color: done ? "#57534e" : locked ? "#9a3412" : "#3f6212", fontSize: 9.5, fontWeight: 900 }}>
                    {done ? "今日已完成" : locked ? (need === "trial" ? "需完成晉升試煉" : `尚需 ${need} 聲望`) : "可接受委託"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

// 委託板特效。挑戰委託要「一眼看出不一樣」：精銳有金色掃光、危殆有紅色脈動。
// 全部尊重 .no-anim（index.css 已全域抑制），不需在這裡各自處理 reduced-motion。
const BOARD_FX_CSS = `
@keyframes gb-sheen { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(220%); } }
@keyframes gb-danger-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,.55), 0 6px 16px rgba(0,0,0,.35); }
  50%     { box-shadow: 0 0 0 4px rgba(248,113,113,0), 0 6px 22px rgba(127,29,29,.6); }
}
@keyframes gb-tab-glow {
  0%,100% { box-shadow: 0 4px 14px rgba(0,0,0,.45); }
  50%     { box-shadow: 0 4px 20px rgba(248,113,113,.5); }
}
.gb-card { transition: transform .16s ease, box-shadow .16s ease; }
.gb-card:active { transform: scale(.97); }
.gb-card-elite, .gb-card-perilous {
  position: relative; overflow: hidden;
  transition: transform .16s ease, box-shadow .16s ease;
}
.gb-card-elite:active, .gb-card-perilous:active { transform: scale(.97); }
.gb-card-elite::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 45%;
  background: linear-gradient(100deg, transparent, rgba(255,232,150,.5), transparent);
  animation: gb-sheen 2.8s ease-in-out infinite; pointer-events: none;
}
.gb-card-perilous { animation: gb-danger-pulse 2.2s ease-in-out infinite; }
.gb-card-perilous::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(circle at 50% 120%, rgba(248,113,113,.28), transparent 62%);
}
.gb-tab-danger { animation: gb-tab-glow 2.4s ease-in-out infinite; }
`;
