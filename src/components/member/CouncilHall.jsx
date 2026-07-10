import { useEffect, useMemo, useState } from "react";
import { checkCouncilDailyLimit, completeCouncilSession, recordCouncilSession } from "../../lib/db";
import { isBuildingUnlocked } from "../../lib/villageData";
import {
  GATHERING_SITE_MAP,
  GATHERING_SITES,
  GATHERING_TIER_META,
  getUnlockedGatheringTiers,
} from "../../lib/catVillageGathering";
import ExpeditionPanel from "./ExpeditionPanel";
import GatheringPartyPanel from "./GatheringPartyPanel";
import GatheringRun from "./GatheringRun";

const CSS = `
@keyframes gather-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`;

export default function CouncilHall({ profile, village, onBack }) {
  const [tab, setTab] = useState("collect");
  const [activeSite, setActiveSite] = useState(null);
  const [partySite, setPartySite] = useState(null);
  const [selectedTiers, setSelectedTiers] = useState({});
  const [dailyLeft, setDailyLeft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  const buildings = useMemo(() => village?.buildings || {}, [village?.buildings]);
  const equippedCat = profile?.equippedCat || null;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    checkCouncilDailyLimit(profile.id)
      .then(left => { if (!cancelled) setDailyLeft(left); })
      .catch(() => { if (!cancelled) setDailyLeft(5); });
    return () => { cancelled = true; };
  }, [profile?.id]);

  async function handleContractStart() {
    if (dailyLeft <= 0 || saving) return false;
    setSaving(true);
    try {
      await recordCouncilSession(profile.id);
      setDailyLeft(left => Math.max(0, (left ?? 1) - 1));
      return true;
    } catch (error) {
      setDoneMsg(`委託建立失敗：${error.message || "請稍後再試"}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish(result) {
    setActiveSite(null);
    if (!result) return;
    setSaving(true);
    try {
      await completeCouncilSession(profile.id, result);
      if (result.contractVersion >= 2) {
        const rewards = result.gatheringRewards;
        setDoneMsg(`採集完成：${rewards?.completion?.label || "完成"}，進度 ${rewards?.progressPct || 0}%`);
      } else {
        setDoneMsg("委託完成，獎勵已入帳。");
      }
      setTimeout(() => setDoneMsg(""), 4200);
    } catch (error) {
      setDoneMsg(`領取失敗：${error.message || "請稍後再試"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleClaimOnly(result) {
    if (!result) return;
    setSaving(true);
    try {
      await completeCouncilSession(profile.id, result);
      setDoneMsg("協力採集成果已入帳。");
      setTimeout(() => setDoneMsg(""), 4200);
    } catch (error) {
      setDoneMsg(`領取失敗：${error.message || "請稍後再試"}`);
    } finally {
      setSaving(false);
    }
  }

  if (activeSite) {
    const level = buildings[activeSite.id] || 1;
    const tiers = getUnlockedGatheringTiers(level);
    const tier = selectedTiers[activeSite.id] || tiers[tiers.length - 1];
    return (
      <GatheringRun
        site={activeSite}
        tier={tier}
        buildingLevel={level}
        memberId={profile?.id}
        catId={equippedCat?.catId || null}
        catName={equippedCat?.name || ""}
        onStart={handleContractStart}
        onFinish={handleFinish}
        onBack={() => setActiveSite(null)}
      />
    );
  }

  if (partySite) {
    const level = buildings[partySite.id] || 1;
    const tiers = getUnlockedGatheringTiers(level);
    const tier = selectedTiers[partySite.id] || tiers[tiers.length - 1];
    return (
      <GatheringPartyPanel
        profile={profile}
        initialSite={partySite}
        initialTier={tier}
        buildingLevel={level}
        equippedCat={equippedCat}
        onStart={handleContractStart}
        onClaim={handleClaimOnly}
        onBack={() => setPartySite(null)}
      />
    );
  }

  return (
    <div style={{ minHeight: "100%", background: "linear-gradient(160deg,#101820,#17212b,#0f172a)", padding: "12px 12px 100px", color: "white" }}>
      <style>{CSS}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button
          onClick={onBack}
          aria-label="返回貓貓村"
          style={{ minWidth: 44, minHeight: 44, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 900, cursor: "pointer" }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 18, color: "#f8fafc" }}>貓咪探險隊委託板</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>採集、巡邏、村務委託集中管理</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>今日採集</div>
          <div style={{ fontWeight: 950, fontSize: 20, color: (dailyLeft ?? 0) > 0 ? "#facc15" : "#fb7185" }}>
            {dailyLeft ?? "-"}<span style={{ fontSize: 12, color: "#94a3b8" }}>/5</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          ["collect", "採集地圖"],
          ["expedition", "探險隊"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              minHeight: 42,
              border: "none",
              borderRadius: 8,
              background: tab === key ? "linear-gradient(90deg,#facc15,#fb923c)" : "rgba(255,255,255,0.08)",
              color: tab === key ? "#1f1300" : "#cbd5e1",
              fontWeight: 950,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {doneMsg && (
        <div aria-live="polite" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: doneMsg.includes("失敗") ? "rgba(127,29,29,0.78)" : "rgba(22,101,52,0.78)", border: "1px solid rgba(255,255,255,0.14)", fontWeight: 850, fontSize: 13 }}>
          {doneMsg}
        </div>
      )}

      {tab === "expedition" && <ExpeditionPanel profile={profile} />}

      {tab === "collect" && (
        <>
          <section style={{ padding: "12px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 12 }}>
            <div style={{ fontWeight: 950, color: "#facc15", marginBottom: 6 }}>新版採集</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "#cbd5e1" }}>
              選擇建築對應的採集地點後，以 3 輪、每輪 6 箭推進採集進度。採集專注在怪物素材、少量貓村資源、貓經驗與羈絆，不會發放寶箱、金幣或射手經驗。
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(156px, 1fr))", gap: 10 }}>
            {GATHERING_SITES.map(site => {
              const level = buildings[site.id] || 1;
              const unlocked = isBuildingUnlocked(site.id, buildings);
              const tiers = getUnlockedGatheringTiers(level);
              const selectedTier = selectedTiers[site.id] || tiers[tiers.length - 1];
              const tierMeta = GATHERING_TIER_META[selectedTier] || GATHERING_TIER_META.common;
              const canEnter = unlocked && (dailyLeft ?? 0) > 0 && !saving;

              return (
                <article key={site.id} style={{
                  borderRadius: 8,
                  padding: 12,
                  minHeight: 210,
                  background: unlocked
                    ? `linear-gradient(145deg,${site.palette[0]},${site.palette[1]})`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${unlocked ? `${site.palette[2]}66` : "rgba(255,255,255,0.08)"}`,
                  opacity: unlocked ? 1 : 0.55,
                  animation: "gather-in 0.22s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.12)", fontSize: 28, flexShrink: 0 }}>
                      {site.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 950 }}>{site.name}</div>
                      <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.62)" }}>
                        {site.buildingName} Lv.{level} · {site.raceName}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.72)", minHeight: 56 }}>
                    {unlocked ? site.flavor : "建築尚未解鎖，先提升貓貓村前置建築。"}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {tiers.map(tierKey => {
                      const meta = GATHERING_TIER_META[tierKey];
                      const selected = tierKey === selectedTier;
                      return (
                        <button
                          key={tierKey}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => setSelectedTiers(prev => ({ ...prev, [site.id]: tierKey }))}
                          style={{
                            minHeight: 32,
                            padding: "0 8px",
                            borderRadius: 8,
                            border: `1px solid ${meta.color}`,
                            background: selected ? meta.color : "rgba(0,0,0,0.16)",
                            color: "white",
                            fontWeight: 900,
                            fontSize: 11,
                            cursor: unlocked ? "pointer" : "default",
                          }}
                        >
                          T{meta.no}
                        </button>
                      );
                    })}
                    {level >= 17 && (
                      <span style={{ minHeight: 32, display: "inline-flex", alignItems: "center", padding: "0 8px", borderRadius: 8, background: "rgba(219,39,119,0.16)", border: "1px dashed rgba(244,114,182,0.7)", color: "#f9a8d4", fontSize: 11, fontWeight: 900 }}>
                        T6 稀有委託預留
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: tierMeta.color, fontWeight: 950 }}>
                      {tierMeta.label}
                    </span>
                    <button
                      onClick={() => canEnter && setActiveSite(GATHERING_SITE_MAP[site.id])}
                      disabled={!canEnter}
                      style={{
                        minHeight: 38,
                        padding: "0 12px",
                        border: "none",
                        borderRadius: 8,
                        background: canEnter ? `linear-gradient(90deg,${site.palette[2]},#ffffff)` : "rgba(255,255,255,0.1)",
                        color: canEnter ? site.palette[0] : "rgba(255,255,255,0.42)",
                        fontWeight: 950,
                        cursor: canEnter ? "pointer" : "default",
                      }}
                    >
                      採集
                    </button>
                    <button
                      onClick={() => canEnter && setPartySite(GATHERING_SITE_MAP[site.id])}
                      disabled={!canEnter}
                      style={{
                        minHeight: 38,
                        padding: "0 12px",
                        border: "1px solid rgba(255,255,255,0.24)",
                        borderRadius: 8,
                        background: canEnter ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                        color: canEnter ? "white" : "rgba(255,255,255,0.42)",
                        fontWeight: 950,
                        cursor: canEnter ? "pointer" : "default",
                      }}
                    >
                      協力
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
