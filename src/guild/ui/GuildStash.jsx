// src/guild/ui/GuildStash.jsx
// 公會倉庫：看 CAT幣/聲望、換裝（倉庫 ↔ 5 槽）、看六維怎麼被裝備改變。
// 純 UI：所有變換走 domain/guildRewards 的純函數，改完把新存檔丟給 onChange 存。
import { useState } from "react";
import { calcGuildExpeditionStats, STAT_META } from "../domain/guildStats";
import { equipFromStash, unequipSlot, GUILD_STASH_LIMIT, DEFAULT_AUTO_SALVAGE, shouldAutoSalvage } from "../domain/guildRewards";
import { enhanceEquip, salvageEquip, salvageMany, enhanceInfo, salvageCost, salvageValue } from "../domain/guildEnhance";
import { nextRankInfo } from "../domain/guildRank";
import { sfxSwitch, sfxClose, sfxLevelUp, sfxError, sfxOpenChest } from "../../lib/sound";
import { hallBg, bgLayer, rankBadge, ArtOrEmoji } from "./GuildArt";
import { GUILD_SLOTS, SLOT_META, GRADE_META, GRADES, GUILD_EQUIP_ARCHETYPES, equipDisplayName, resolveEquipStats, resolveEquipWeight, affixTags } from "../data/guildEquipCatalog";
import GuildIcon, { GUILD_SLOT_ICON } from "./GuildIcon";
import { GuildEquipmentArt } from "./GuildItemArt";

const card = { background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 };
const title = { fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 };

function StatLine({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {Object.keys(STAT_META).map(k => (
        <div key={k} style={{ fontSize: 12 }}>{STAT_META[k].icon} {STAT_META[k].short} <b>{stats[k]}</b></div>
      ))}
    </div>
  );
}

// 一件裝備的六維摘要文字（例：⚔️+12 💨+5）——含強化 +N 與詞綴
function statSummary(item) {
  const s = resolveEquipStats(item.archetypeId, item.grade, item);
  return Object.keys(STAT_META)
    .filter(k => s[k])
    .map(k => `${STAT_META[k].icon}${s[k] > 0 ? "+" : ""}${s[k]}`)
    .join(" ");
}

// 詞綴標籤（掉落品才有，商店貨沒有）
function AffixTags({ item }) {
  const tags = affixTags(item);
  if (!tags.length) return null;
  return (
    <>
      {tags.map(t => (
        <span key={t.name} style={{ fontSize: 9, fontWeight: 800, color: "#fcd34d", background: "rgba(251,191,36,.14)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 5, padding: "1px 5px", marginLeft: 4 }}>
          {t.icon}{t.name}
        </span>
      ))}
    </>
  );
}

function EnhanceRequirement({ item, profile, member }) {
  const info = enhanceInfo(item);
  if (info.maxed) return <div style={{ color: "#94a3b8", fontSize: 10 }}>已達強化上限 +{info.cap}</div>;
  const lacksShards = profile.shards < info.cost.shards;
  const lacksCatCoins = profile.catCoins < info.cost.catCoins;
  const lacksCoins = (member?.coins || 0) < info.cost.coins;
  return (
    <div style={{ fontSize: 10, color: lacksShards || lacksCatCoins || lacksCoins ? "#fca5a5" : "#93c5fd", lineHeight: 1.55 }}>
      <div>升至 +{info.cost.next} 需要：</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <b style={{ color: lacksShards ? "#f87171" : "#e2e8f0", display: "flex", alignItems: "center" }}><GuildIcon name="shard" size={20} />{info.cost.shards}</b>
        <b style={{ color: lacksCatCoins ? "#f87171" : "#e2e8f0", display: "flex", alignItems: "center" }}><GuildIcon name="catCoin" size={20} />{info.cost.catCoins}</b>
        <b style={{ color: lacksCoins ? "#f87171" : "#e2e8f0", display: "flex", alignItems: "center" }}><GuildIcon name="coin" size={20} />{info.cost.coins}</b>
      </div>
    </div>
  );
}

function EquipComparison({ member, profile, item, currentStats }) {
  const nextProfile = equipFromStash(profile, item.uid);
  const nextStats = calcGuildExpeditionStats(member, nextProfile.equipped);
  const deltas = Object.keys(STAT_META)
    .map(key => ({ key, value: (nextStats[key] || 0) - (currentStats[key] || 0) }))
    .filter(delta => delta.value !== 0);
  const total = deltas.reduce((sum, delta) => sum + delta.value, 0);
  const current = profile.equipped[GUILD_EQUIP_ARCHETYPES[item.archetypeId]?.slot];
  const currentWeight = current?.archetypeId ? resolveEquipWeight(current.archetypeId, current.grade) : 0;
  const weightDelta = Math.round((resolveEquipWeight(item.archetypeId, item.grade) - currentWeight) * 10) / 10;
  const tone = total > 0 ? "#86efac" : total < 0 ? "#fca5a5" : "#fde68a";
  const label = total > 0 ? "▲ 換裝後整體能力上升" : total < 0 ? "▼ 換裝後整體能力下降" : "◆ 換裝後整體能力持平";

  return (
    <div style={{ marginTop: 7, padding: 7, borderRadius: 8, background: "rgba(15,23,42,.72)", fontSize: 10 }}>
      <div style={{ color: tone, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 3, color: "#cbd5e1", lineHeight: 1.5 }}>
        {deltas.length
          ? deltas.map(delta => `${STAT_META[delta.key].icon}${delta.value > 0 ? "+" : ""}${delta.value}`).join("　")
          : "六維沒有變化"}
        {weightDelta !== 0 ? `　⚖️${weightDelta > 0 ? "+" : ""}${weightDelta}kg` : ""}
      </div>
    </div>
  );
}

export default function GuildStash({ member, profile, onChange, onEnhance, onSalvage, onSalvageMany, onClose }) {
  const [msg, setMsg] = useState("");
  const [sortBy, setSortBy] = useState("new");     // new | grade | plus | slot
  const [filterSlot, setFilterSlot] = useState("all");
  const [showFilterCfg, setShowFilterCfg] = useState(false);
  const stats = calcGuildExpeditionStats(member, profile.equipped);
  const rankInfo = nextRankInfo(profile);
  const rank = rankInfo.current;

  const doEnhance = async target => {
    const res = onEnhance ? await onEnhance(target) : enhanceEquip(profile, target, { coins: member?.coins || 0 });
    if (!res.ok) { sfxError(); setMsg(`⚠️ ${res.reason}`); return; }
    sfxLevelUp();
    setMsg(`✅ 強化成功 +${res.plus}（花 🔧${res.spent.shards} 🐾${res.spent.catCoins} 🪙${res.coinsSpent}）`);
    if (!onEnhance) onChange(res.profile);
  };
  const doSalvage = async uid => {
    const res = onSalvage ? await onSalvage(uid) : salvageEquip(profile, uid, { coins: member?.coins || 0 });
    if (!res.ok) { sfxError(); setMsg(`⚠️ ${res.reason}`); return; }
    sfxOpenChest();
    setMsg(`♻️ 分解完成，花費 🪙${res.coinsSpent}，獲得 🔧${res.gained} 碎片`);
    if (!onSalvage) onChange(res.profile);
  };
  // 清倉：只拆「粗製/精良且未強化」的雜魚裝——強化過的主力裝絕不會被誤拆
  const junkUids = profile.stash
    .filter(i => ["common", "rare"].includes(i.grade) && !(i.plus > 0))
    .map(i => i.uid);
  const filterCfg = { ...DEFAULT_AUTO_SALVAGE, ...(profile.autoSalvage || {}) };
  const setFilter = patch => {
    sfxSwitch();
    onChange({ ...profile, autoSalvage: { ...filterCfg, ...patch } });
  };

  // 倉庫排序／篩選（掉落變多之後，沒有這個根本找不到東西）
  const gradeRank = g => GRADES.indexOf(g);
  const shownStash = profile.stash
    .filter(i => filterSlot === "all" || GUILD_EQUIP_ARCHETYPES[i.archetypeId]?.slot === filterSlot)
    .slice()
    .sort((a, b) => {
      if (sortBy === "grade") return gradeRank(b.grade) - gradeRank(a.grade) || (b.affixes?.length || 0) - (a.affixes?.length || 0);
      if (sortBy === "plus") return (b.plus || 0) - (a.plus || 0) || gradeRank(b.grade) - gradeRank(a.grade);
      if (sortBy === "slot") return String(GUILD_EQUIP_ARCHETYPES[a.archetypeId]?.slot).localeCompare(String(GUILD_EQUIP_ARCHETYPES[b.archetypeId]?.slot));
      return (b.at || 0) - (a.at || 0);   // new
    });

  const doSalvageJunk = async () => {
    const res = onSalvageMany ? await onSalvageMany(junkUids) : salvageMany(profile, junkUids, { coins: member?.coins || 0 });
    if (!res.ok) { sfxError(); setMsg("⚠️ 沒有可清的低階裝"); return; }
    sfxOpenChest();
    setMsg(`♻️ 清倉 ${res.count} 件，花費 🪙${res.coinsSpent}，獲得 🔧${res.gained} 碎片`);
    if (!onSalvageMany) onChange(res.profile);
  };

  return (
    <div className="guild-panel-page" style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.76)" }), backgroundAttachment: "fixed", color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", display: "flex", alignItems: "center", gap: 7 }}><GuildIcon name="stash" size={38} />公會倉庫</div>
        <button type="button" onClick={() => { sfxClose(); onClose(); }} style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "#334155", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>返回</button>
      </div>

      {/* 冒險者證：階級 + 聲望進度（階級只給解鎖，不給任何戰力） */}
      <div style={{ ...card, border: `1px solid ${rank.color}55` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: rank.color, display: "flex", alignItems: "center", gap: 7 }}>
            <ArtOrEmoji sources={[rankBadge(rank.id)]} emoji={rank.icon} size={34} />
            {rank.name}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>可接 ☠️×{rank.maxDanger}　{rank.shopTier} 級貨架</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
          🏅 聲望 {profile.rep}{rankInfo.next ? ` ／ 距 ${rankInfo.next.name} 還差 ${rankInfo.need}` : "（已達頂階）"}
        </div>
      </div>

      {/* 資產 */}
      <div style={{ ...card, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#f0abfc", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><GuildIcon name="catCoin" size={28} />{profile.catCoins}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>CAT幣</div></div>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><GuildIcon name="reputation" size={28} />{profile.rep}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>聲望</div></div>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#93c5fd", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><GuildIcon name="shard" size={28} />{profile.shards}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>裝備碎片</div></div>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#6ee7b7" }}>🚩 {profile.expeditions.won}/{profile.expeditions.total}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>遠征勝/總</div></div>
      </div>

      {/* 六維 */}
      <div style={card}>
        <div style={title}>目前六維（射手Lv{stats._archerLevel} + 公會裝）</div>
        <StatLine stats={stats} />
      </div>

      {/* 裝備中 */}
      <div style={card}>
        <div style={title}>裝備中（點「卸下」放回倉庫）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9 }}>
          {GUILD_SLOTS.map(slot => {
            const it = profile.equipped[slot];
            const info = it?.archetypeId ? enhanceInfo(it) : null;
            return (
              <div key={slot} style={{ minHeight: 142, padding: 10, borderRadius: 11, border: "1px solid rgba(255,255,255,.1)", background: "rgba(15,23,42,.68)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 900, display: "flex", alignItems: "center", gap: 5 }}><GuildIcon name={GUILD_SLOT_ICON[slot]} size={30} />{SLOT_META[slot].name}</div>
                {it?.archetypeId ? <>
                  <div style={{ fontSize: 12, fontWeight: 900, color: GRADE_META[it.grade]?.color || "#fff" }}>{equipDisplayName(it.archetypeId, it.grade, it)}</div>
                  <div><AffixTags item={it} /></div>
                  <div style={{ color: "#cbd5e1", fontSize: 11 }}>{statSummary(it)}</div>
                  <EnhanceRequirement item={it} profile={profile} member={member} />
                  <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button type="button" disabled={info.maxed} onClick={() => doEnhance({ where: "equipped", slot })}
                      style={{ padding: "7px 5px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 800, color: "#fff", background: info.maxed ? "#475569" : "linear-gradient(135deg,#38bdf8,#1d4ed8)" }}>
                      {info.maxed ? `MAX +${info.cap}` : `強化至 +${info.cost.next}`}
                    </button>
                    <button type="button" onClick={() => { sfxSwitch(); onChange(unequipSlot(profile, slot)); }}
                      style={{ padding: "7px 5px", borderRadius: 7, border: "none", background: "#475569", color: "#fff", fontSize: 10, fontWeight: 800 }}>卸下</button>
                  </div>
                </> : <div style={{ margin: "auto", color: "#64748b", fontSize: 11 }}>尚未裝備</div>}
              </div>
            );
          })}
        </div>
      </div>

      {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}

      {/* 倉庫 */}
      <div style={card}>
        <div style={{ ...title, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>倉庫 {profile.stash.length}/{GUILD_STASH_LIMIT}（裝備／強化／分解）</span>
          {junkUids.length > 0 && (
            <button type="button" onClick={doSalvageJunk}
              title="把粗製/精良且未強化的裝備一次分解（強化過的主力裝不會被拆）"
              style={{ padding: "4px 9px", borderRadius: 7, border: "1px solid rgba(148,163,184,.3)", background: "rgba(15,23,42,.85)", color: "#cbd5e1", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
              ♻️ 清倉低階 ×{junkUids.length}
            </button>
          )}
        </div>
        {/* 排序 / 槽位篩選 / 撿取過濾器 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {[["new", "最新"], ["grade", "品級"], ["plus", "強化"], ["slot", "槽位"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => { sfxSwitch(); setSortBy(k); }}
              style={{ padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer",
                border: `1px solid ${sortBy === k ? "#fbbf24" : "rgba(255,255,255,.12)"}`,
                background: sortBy === k ? "rgba(251,191,36,.2)" : "rgba(0,0,0,.3)", color: "#e2e8f0" }}>
              {label}
            </button>
          ))}
          <span style={{ width: 1, background: "rgba(255,255,255,.15)", margin: "0 2px" }} />
          {[["all", "全部"], ...GUILD_SLOTS.map(sl => [sl, SLOT_META[sl].icon])].map(([k, label]) => (
            <button key={k} type="button" onClick={() => { sfxSwitch(); setFilterSlot(k); }}
              style={{ padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer",
                border: `1px solid ${filterSlot === k ? "#fbbf24" : "rgba(255,255,255,.12)"}`,
                background: filterSlot === k ? "rgba(251,191,36,.2)" : "rgba(0,0,0,.3)", color: "#e2e8f0" }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => { sfxSwitch(); setShowFilterCfg(v => !v); }}
            style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer",
              border: `1px solid ${filterCfg.enabled ? "#38bdf8" : "rgba(255,255,255,.12)"}`,
              background: filterCfg.enabled ? "rgba(56,189,248,.18)" : "rgba(0,0,0,.3)", color: filterCfg.enabled ? "#7dd3fc" : "#94a3b8" }}>
            ⚙️ 自動分解{filterCfg.enabled ? "：開" : "：關"}
          </button>
        </div>

        {showFilterCfg && (
          <div style={{ background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.25)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 900, marginBottom: 6 }}>⚙️ 撿取過濾器（掉落當下自動分解）</div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 7, cursor: "pointer" }}>
              <input type="checkbox" checked={filterCfg.enabled}
                onChange={e => setFilter({ enabled: e.target.checked })} />
              啟用（省得倉庫被垃圾塞爆）
            </label>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>自動分解「這個品級以下」的掉落：</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 7 }}>
              {GRADES.slice(0, 4).map(g => (
                <button key={g} type="button" onClick={() => setFilter({ maxGrade: g })}
                  style={{ padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer",
                    border: `1px solid ${filterCfg.maxGrade === g ? GRADE_META[g].color : "rgba(255,255,255,.12)"}`,
                    background: filterCfg.maxGrade === g ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.3)", color: GRADE_META[g].color }}>
                  {GRADE_META[g].label}以下
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>但這些一定保留：</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[[1, "有 1 條以上詞綴"], [2, "有 2 條詞綴"]].map(([n, label]) => (
                <button key={n} type="button" onClick={() => setFilter({ keepAffixes: n })}
                  style={{ padding: "3px 8px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer",
                    border: `1px solid ${filterCfg.keepAffixes === n ? "#fbbf24" : "rgba(255,255,255,.12)"}`,
                    background: filterCfg.keepAffixes === n ? "rgba(251,191,36,.2)" : "rgba(0,0,0,.3)", color: "#e2e8f0" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 7, lineHeight: 1.6 }}>
              已強化（+1 以上）的裝備**永遠不會**被自動分解。倉庫滿了也不會白掉——多出來的一樣變碎片。
            </div>
          </div>
        )}

        {profile.stash.length === 0 && <div style={{ fontSize: 12, color: "#64748b" }}>還沒有戰利品，去遠征打怪掉裝吧。</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {shownStash.map(it => {
            const arch = GUILD_EQUIP_ARCHETYPES[it.archetypeId];
            const info = enhanceInfo(it);
            return (
              <div key={it.uid} style={{ padding: 11, borderRadius: 12, border: `1px solid ${GRADE_META[it.grade]?.color || "rgba(255,255,255,.12)"}55`, background: "rgba(15,23,42,.72)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GuildEquipmentArt archetypeId={it.archetypeId} grade={it.grade} size={58} />
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 900 }}>{SLOT_META[arch.slot].name}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: GRADE_META[it.grade]?.color || "#fff" }}>{equipDisplayName(it.archetypeId, it.grade, it)}</div>
                <div><AffixTags item={it} /></div>
                <div style={{ color: "#cbd5e1", fontSize: 11 }}>
                  {statSummary(it)}　<span style={{ color: "#94a3b8" }}>⚖️{resolveEquipWeight(it.archetypeId, it.grade)}kg</span>
                </div>
                <EquipComparison member={member} profile={profile} item={it} currentStats={stats} />
                <EnhanceRequirement item={it} profile={profile} member={member} />
                <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                  <button type="button" onClick={() => { sfxSwitch(); onChange(equipFromStash(profile, it.uid)); }}
                    style={{ padding: "7px 4px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff", fontSize: 10, fontWeight: 800 }}>裝備</button>
                  <button type="button" disabled={info.maxed} onClick={() => doEnhance({ where: "stash", uid: it.uid })}
                    style={{ padding: "7px 4px", borderRadius: 7, border: "none", fontSize: 10, fontWeight: 800, color: "#fff", background: info.maxed ? "#475569" : "linear-gradient(135deg,#38bdf8,#1d4ed8)" }}>
                    {info.maxed ? "MAX" : `強化 +${info.cost.next}`}
                  </button>
                  <button type="button" onClick={() => doSalvage(it.uid)}
                    title={`花 🪙${salvageCost(it)}，分解得 🔧${salvageValue(it)} 碎片`}
                    style={{ padding: "7px 4px", borderRadius: 7, border: "1px solid rgba(148,163,184,.3)", background: "rgba(15,23,42,.8)", color: "#cbd5e1", fontSize: 10, fontWeight: 800 }}>
                    分解 🪙{salvageCost(it)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
