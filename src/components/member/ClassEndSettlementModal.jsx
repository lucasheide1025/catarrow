import { ALL_MILESTONES, describeMilestoneRewards, getRewardsForMilestone } from "../../lib/arrowMilestone";
import { CHEST_TYPES } from "../../lib/itemData";
import { COIN_CHEST_TIERS } from "../../lib/lootTable";
import { getUsableMonthlyCardSessions } from "../../lib/monthlyCardStats";
import { getVillagePack } from "../../lib/villagePack";

function MilestoneBoard({ todayArrows }) {
  return (
    <div style={{ background:"rgba(15,23,42,.72)", border:"1px solid rgba(148,163,184,.14)", borderRadius:12, padding:"9px 10px" }}>
      <div style={{ color:"#94a3b8", fontSize:10, fontWeight:900, marginBottom:6 }}>🎁 今日里程碑獎勵</div>
      <div style={{ maxHeight:126, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
        {ALL_MILESTONES.map(ms => {
          const unlocked = todayArrows >= ms.arrows;
          const rewardText = describeMilestoneRewards(getRewardsForMilestone(ms), {
            CHEST_TYPES, COIN_CHEST_TIERS, getVillagePack,
          }).map(row => `${row.icon}${row.count}`).join(" ");
          return (
            <div key={ms.arrows} style={{ display:"flex", alignItems:"center", gap:7, opacity:unlocked ? 1 : .34 }}>
              <span style={{ width:18, textAlign:"center", fontSize:10 }}>{unlocked ? "✅" : "○"}</span>
              <span style={{ flex:1, color:unlocked ? "#e2e8f0" : "#64748b", fontSize:10, fontWeight:unlocked ? 800 : 500 }}>{ms.arrows} 箭</span>
              <span style={{ color:unlocked ? "#fbbf24" : "#475569", fontSize:9, fontWeight:800 }}>{rewardText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClassEndSettlementModal({
  open,
  todayArrows = 0,
  monthlyCard = null,
  hasPending = false,
  busy = false,
  onClose,
  onConfirm,
}) {
  if (!open) return null;
  const sessions = getUsableMonthlyCardSessions(monthlyCard, Date.now());
  const choose = hours => {
    if (busy) return;
    onConfirm?.(hours);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:260, background:"rgba(2,6,23,.74)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div role="dialog" aria-modal="true" aria-label="下課結算" style={{ width:"min(430px,100%)", maxHeight:"88vh", overflowY:"auto", background:"#f8fafc", borderRadius:20, padding:18, boxShadow:"0 24px 70px rgba(0,0,0,.45)" }}>
        <div style={{ color:"#0f172a", fontSize:19, fontWeight:950 }}>🏁 下課結算</div>
        <div style={{ color:"#64748b", fontSize:12, marginTop:3 }}>確認本次練習成果，再選擇是否申請月卡扣抵。</div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
          <div style={{ borderRadius:12, padding:"10px 12px", background:"#eff6ff", border:"1px solid #bfdbfe" }}>
            <div style={{ color:"#64748b", fontSize:10, fontWeight:800 }}>今日累積</div>
            <div style={{ color:"#1d4ed8", fontSize:20, fontWeight:950 }}>🏹 {todayArrows} 箭</div>
          </div>
          <div style={{ borderRadius:12, padding:"10px 12px", background:"#ecfeff", border:"1px solid #a5f3fc" }}>
            <div style={{ color:"#64748b", fontSize:10, fontWeight:800 }}>下課立即結算</div>
            <div style={{ color:"#0e7490", fontSize:20, fontWeight:950 }}>💧 +{todayArrows}</div>
            <div style={{ color:"#64748b", fontSize:9 }}>箭露</div>
          </div>
        </div>

        <div style={{ marginTop:9 }}><MilestoneBoard todayArrows={todayArrows} /></div>

        <div style={{ marginTop:10, borderRadius:12, padding:"10px 12px", background:"#fff7ed", border:"1px solid #fed7aa" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"center" }}>
            <span style={{ color:"#9a3412", fontSize:12, fontWeight:900 }}>🎫 月卡剩餘</span>
            <span style={{ color:"#c2410c", fontSize:14, fontWeight:950 }}>{sessions} 小時</span>
          </div>
          <div style={{ color:"#9a3412", fontSize:10, marginTop:3 }}>
            {hasPending ? "已有一筆月卡扣抵申請等待教練審核，不能重複送出。" : sessions > 0 ? "選擇 1／2 小時後只會送出申請；教練核准後才真正扣除。" : "目前沒有可用月卡時數，本次仍可正常下課。"}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:12 }}>
          <button type="button" disabled={busy} onClick={() => choose(0)} style={{ padding:"11px 12px", borderRadius:12, border:"1px solid #cbd5e1", background:"white", color:"#334155", fontWeight:900, cursor:busy ? "default" : "pointer", opacity:busy ? .55 : 1 }}>
            本次不使用月卡
            <span style={{ display:"block", marginTop:2, color:"#94a3b8", fontSize:10, fontWeight:600 }}>直接下課，不送月卡申請</span>
          </button>
          <button type="button" disabled={busy || hasPending || sessions < 1} onClick={() => choose(1)} style={{ padding:"11px 12px", borderRadius:12, border:0, background:"#2563eb", color:"white", fontWeight:900, cursor:busy || hasPending || sessions < 1 ? "default" : "pointer", opacity:busy || hasPending || sessions < 1 ? .4 : 1 }}>
            申請扣 1 小時（月卡 -1 次）
            <span style={{ display:"block", marginTop:2, color:"#dbeafe", fontSize:10, fontWeight:600 }}>核准後剩 {Math.max(0, sessions - 1)} 小時</span>
          </button>
          <button type="button" disabled={busy || hasPending || sessions < 2} onClick={() => choose(2)} style={{ padding:"11px 12px", borderRadius:12, border:0, background:"#7c3aed", color:"white", fontWeight:900, cursor:busy || hasPending || sessions < 2 ? "default" : "pointer", opacity:busy || hasPending || sessions < 2 ? .4 : 1 }}>
            申請扣 2 小時（月卡 -2 次）
            <span style={{ display:"block", marginTop:2, color:"#ede9fe", fontSize:10, fontWeight:600 }}>核准後剩 {Math.max(0, sessions - 2)} 小時</span>
          </button>
        </div>

        <button type="button" disabled={busy} onClick={onClose} style={{ width:"100%", marginTop:9, padding:8, border:0, background:"transparent", color:"#64748b", fontWeight:800, cursor:busy ? "default" : "pointer" }}>取消</button>
      </div>
    </div>
  );
}
