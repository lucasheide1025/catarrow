import { useEffect, useMemo, useState } from "react";
import {
  GATHERING_SITE_MAP,
  GATHERING_TIER_META,
  getUnlockedGatheringTiers,
} from "../../lib/catVillageGathering";
import {
  closeGatheringPartyRoom,
  createGatheringPartyRoom,
  joinGatheringPartyRoom,
  startGatheringPartyRoom,
  submitGatheringPartyResult,
  subscribeGatheringPartyRoom,
} from "../../lib/gatheringPartyDb";
import GatheringRun from "./GatheringRun";

function memberName(profile) {
  return profile?.name || profile?.nickname || profile?.displayName || "玩家";
}

export default function GatheringPartyPanel({
  profile,
  initialSite,
  initialTier,
  buildingLevel,
  equippedCat,
  onStart,
  onClaim,
  onBack,
}) {
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!roomId) return undefined;
    return subscribeGatheringPartyRoom(roomId, setRoom);
  }, [roomId]);

  const memberId = profile?.id;
  const members = room?.members || {};
  const memberEntries = Object.entries(members);
  const partySize = Math.max(1, memberEntries.length);
  const roomSite = room?.siteId ? GATHERING_SITE_MAP[room.siteId] : initialSite;
  const level = room?.buildingLevel || buildingLevel || 1;
  const unlockedTiers = getUnlockedGatheringTiers(level);
  const roomTier = room?.tier || initialTier || unlockedTiers[unlockedTiers.length - 1];
  const isHost = room?.hostId === memberId;
  const myState = memberId ? members[memberId] : null;
  const submittedCount = memberEntries.filter(([, m]) => m.submitted).length;
  const totalProgress = memberEntries.reduce((sum, [, m]) => sum + (Number(m.progressPct) || 0), 0);
  const allSubmitted = partySize > 0 && submittedCount >= partySize;
  const tierMeta = GATHERING_TIER_META[roomTier] || GATHERING_TIER_META.common;

  const summary = useMemo(() => {
    if (totalProgress >= 600) return "大隊豐收";
    if (totalProgress >= 440) return "協力豐收";
    if (totalProgress >= 320) return "完成採集";
    if (totalProgress > 0) return "進行中";
    return "等待採集";
  }, [totalProgress]);

  async function createRoom() {
    if (!profile?.id || !initialSite || busy) return;
    setBusy(true);
    setMsg("");
    const res = await createGatheringPartyRoom(profile.id, memberName(profile), {
      siteId: initialSite.id,
      tier: initialTier,
      buildingLevel,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.reason || "建立房間失敗");
      return;
    }
    setRoomId(res.roomId);
    setMsg(`房間已建立，邀請碼 ${res.code}`);
  }

  async function joinRoom() {
    if (!profile?.id || !joinCode.trim() || busy) return;
    setBusy(true);
    setMsg("");
    const res = await joinGatheringPartyRoom(joinCode.trim(), profile.id, memberName(profile));
    setBusy(false);
    if (!res.ok) {
      setMsg(res.reason || "加入房間失敗");
      return;
    }
    setRoomId(res.roomId);
  }

  async function startRoom() {
    if (!roomId || !isHost || busy) return;
    setBusy(true);
    const res = await startGatheringPartyRoom(roomId);
    setBusy(false);
    if (!res.ok) setMsg(res.reason || "開始失敗");
  }

  async function finishRoom() {
    if (!roomId || !isHost || busy) return;
    setBusy(true);
    const res = await closeGatheringPartyRoom(roomId);
    setBusy(false);
    if (!res.ok) setMsg(res.reason || "結束房間失敗");
  }

  async function handlePartyStart() {
    if (myState?.submitted) return false;
    return onStart?.();
  }

  async function handlePartyFinish(result) {
    if (!roomId || !memberId) return;
    const resultWithParty = {
      ...result,
      gatheringRewards: {
        ...(result.gatheringRewards || {}),
        partySize,
        goalParticipants: 1,
      },
    };
    await onClaim?.(resultWithParty);
    await submitGatheringPartyResult(roomId, memberId, resultWithParty.gatheringRewards);
    setRunning(false);
  }

  if (running && roomSite) {
    return (
      <GatheringRun
        site={roomSite}
        tier={roomTier}
        buildingLevel={level}
        memberId={memberId}
        catId={equippedCat?.catId || null}
        catName={equippedCat?.name || ""}
        partySize={partySize}
        goalParticipants={1}
        modeLabel="協力採集"
        onStart={handlePartyStart}
        onFinish={handlePartyFinish}
        onBack={() => setRunning(false)}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "14px 12px 92px", color: "white", background: "linear-gradient(160deg,#10201a,#13251d,#0f172a)" }}>
      <button onClick={onBack} style={{ minHeight: 40, border: "none", borderRadius: 8, padding: "0 12px", background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 900, cursor: "pointer" }}>
        返回採集地圖
      </button>

      <section style={{ marginTop: 12, padding: 14, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
        <div style={{ fontSize: 22, fontWeight: 950, color: "#bbf7d0" }}>協力採集房間</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.7 }}>
          協力採集只小幅提高素材與貓經驗。每位玩家只累積自己的 18 箭，不會因隊伍人數放大箭數。
        </div>
      </section>

      {!room && (
        <>
          {initialSite && (
            <section style={{ marginTop: 12, padding: 14, borderRadius: 8, background: `linear-gradient(145deg,${initialSite.palette[0]},${initialSite.palette[1]})`, border: `1px solid ${initialSite.palette[2]}66` }}>
              <div style={{ fontSize: 42 }}>{initialSite.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>{initialSite.name}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.68)" }}>{tierMeta.label} · 建築 Lv.{buildingLevel}</div>
              <button onClick={createRoom} disabled={busy} style={{ marginTop: 12, width: "100%", minHeight: 46, border: "none", borderRadius: 8, background: `linear-gradient(90deg,${initialSite.palette[2]},#ffffff)`, color: initialSite.palette[0], fontWeight: 950, cursor: busy ? "default" : "pointer" }}>
                建立協力採集房
              </button>
            </section>
          )}

          <section style={{ marginTop: 12, padding: 14, borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ fontWeight: 950, color: "#bbf7d0", marginBottom: 8 }}>加入房間</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="輸入邀請碼" style={{ flex: 1, minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", color: "white", padding: "0 10px", fontWeight: 900 }} />
              <button onClick={joinRoom} disabled={busy || !joinCode.trim()} style={{ minHeight: 42, padding: "0 14px", border: "none", borderRadius: 8, background: joinCode.trim() ? "#22c55e" : "rgba(255,255,255,0.12)", color: "white", fontWeight: 950, cursor: joinCode.trim() ? "pointer" : "default" }}>
                加入
              </button>
            </div>
          </section>
        </>
      )}

      {room && roomSite && (
        <>
          <section style={{ marginTop: 12, padding: 14, borderRadius: 8, background: `linear-gradient(145deg,${roomSite.palette[0]},${roomSite.palette[1]})`, border: `1px solid ${roomSite.palette[2]}66` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 42 }}>{roomSite.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{roomSite.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>邀請碼 {room.code} · {tierMeta.label} · {partySize}/8 人</div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: 12, padding: 14, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <b style={{ color: "#bbf7d0" }}>全隊進度</b>
              <b>{Math.round(totalProgress)}%</b>
            </div>
            <div style={{ height: 14, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, totalProgress / 6)}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#facc15,#f472b6)" }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>{summary}</div>
          </section>

          <section style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {memberEntries.map(([id, m]) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: m.submitted ? "#22c55e" : "rgba(255,255,255,0.12)", color: "white", fontWeight: 950 }}>{m.submitted ? "✓" : "…"}</span>
                <span style={{ flex: 1, fontWeight: 900 }}>{m.name}{id === room.hostId ? "（房主）" : ""}</span>
                <span style={{ color: "#bbf7d0", fontWeight: 900 }}>{Math.round(Number(m.progressPct) || 0)}%</span>
              </div>
            ))}
          </section>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: isHost ? "1fr 1fr" : "1fr", gap: 8 }}>
            {room.status === "waiting" && isHost && (
              <button onClick={startRoom} disabled={busy || partySize < 2} style={{ minHeight: 48, border: "none", borderRadius: 8, background: partySize >= 2 ? "#22c55e" : "rgba(255,255,255,0.12)", color: "white", fontWeight: 950, cursor: partySize >= 2 ? "pointer" : "default" }}>
                {partySize >= 2 ? "開始協力採集" : "至少 2 人開始"}
              </button>
            )}
            {room.status === "active" && !myState?.submitted && (
              <button onClick={() => setRunning(true)} style={{ minHeight: 48, border: "none", borderRadius: 8, background: "linear-gradient(90deg,#22c55e,#bef264)", color: "#052e16", fontWeight: 950, cursor: "pointer" }}>
                進入採集
              </button>
            )}
            {room.status === "active" && myState?.submitted && (
              <div style={{ minHeight: 48, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(34,197,94,0.16)", color: "#bbf7d0", fontWeight: 950 }}>
                已提交，等待隊友
              </div>
            )}
            {isHost && room.status === "active" && (
              <button onClick={finishRoom} disabled={busy || !allSubmitted} style={{ minHeight: 48, border: "none", borderRadius: 8, background: allSubmitted ? "#f59e0b" : "rgba(255,255,255,0.12)", color: "white", fontWeight: 950, cursor: allSubmitted ? "pointer" : "default" }}>
                結束房間
              </button>
            )}
          </div>
        </>
      )}

      {msg && <div style={{ marginTop: 12, color: msg.includes("失敗") ? "#fecaca" : "#bbf7d0", fontWeight: 850 }}>{msg}</div>}
    </div>
  );
}
