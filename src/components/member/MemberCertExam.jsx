// src/components/member/MemberCertExam.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertConfig, subscribeCertification, submitCertTask, certBowGroup, getMember, addRoundArrows, addPracticeLog, checkAndGrantArrowMilestones, finalizePracticeShootingSession } from "../../lib/db";
import { Card, Btn, Inp, Sel, ST, Spinner } from "../shared/UI";
import { normalizeEquipment } from "../shared/Equipment";
import { getRewardsForMilestone } from "../../lib/arrowMilestone";

const BOW_LABEL_MAP = {
  recurve_full: "競技反曲弓（全配）",
  recurve_bare: "競技反曲弓（裸弓）",
  compound:     "美式獵弓",
  traditional:  "傳統弓",
};

function buildBowOptions(equipment) {
  const sets = normalizeEquipment(equipment).filter(s => s.type !== "armor" && s.type !== "accessory");
  if (sets.length === 0) return [{ value: "rental", label: "租借器材", customLabel: "租借器材" }];
  const sorted = [...sets.filter(s => s.isDefault), ...sets.filter(s => !s.isDefault)];
  return sorted.map(s => ({
    value: s.bowCategory,
    label: s.label ? `${s.label}（${BOW_LABEL_MAP[s.bowCategory] || s.bowCategory}）` : (BOW_LABEL_MAP[s.bowCategory] || s.bowCategory),
    customLabel: s.label || BOW_LABEL_MAP[s.bowCategory] || s.bowCategory,
  }));
}

function buildArmorOptions(armorSets) {
  if (!armorSets || armorSets.length === 0) return [];
  return armorSets.map((s, i) => ({
    value: String(i),
    label: s.label || `防具套組 ${i + 1}`,
  }));
}

function buildAccessoryOptions(accessorySets) {
  if (!accessorySets || accessorySets.length === 0) return [];
  return accessorySets.map((s, i) => ({
    value: String(i),
    label: s.label || `飾品套組 ${i + 1}`,
  }));
}

const TIER_LABEL = { blue: "藍證（初階）", gold: "金證（高階）" };

export default function MemberCertExam({ onBack }) {
  const { profile } = useAuth();
  const [config, setConfig]   = useState(null);
  const [cert, setCert]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);

  useEffect(() => {
    getCertConfig().then(setConfig);
    if (!profile?.id) return;
    const unsub = subscribeCertification(profile.id, c => { setCert(c); setLoading(false); });
    getMember(profile.id).then(setMemberData).catch(() => {});
    return () => unsub && unsub();
  }, [profile?.id]);

  if (loading || !config) return <Spinner />;

  const level   = cert?.level || "none";
  const locked  = cert?.locked || false;
  const nextTier = level === "none" ? "blue" : level === "blue" ? "gold" : null;

  const bowOptions       = buildBowOptions(memberData?.equipment || profile?.equipment);
  const armorOptions     = buildArmorOptions(memberData?.armorSets || []);
  const accessoryOptions = buildAccessoryOptions(memberData?.accessorySets || []);
  const armorSets        = memberData?.armorSets || [];
  const accessorySets    = memberData?.accessorySets || [];

  return (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={onBack} className="text-blue-400 text-sm font-bold self-start py-1">← 返回</button>
      <h2 className="text-gray-100 font-black text-xl">🎖️ 射手證畢業考</h2>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <CertBadgeBig level={level} />
          <div>
            <div className="text-gray-400 text-xs">目前射手證</div>
            <div className="font-black text-lg text-gray-100">
              {level === "gold" ? "金證 · 已達最高級" : level === "blue" ? "藍證" : "尚未取得"}
            </div>
          </div>
        </div>
        {locked && (
          <div className="mt-3 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2 text-amber-300 text-xs font-bold">
            🏆 已取得金證（最高級），射手證系統已鎖定，無需再測驗。
          </div>
        )}
      </Card>

      {!locked && nextTier && (
        <TierExam
          tier={nextTier} config={config} cert={cert} memberId={profile.id}
          bowOptions={bowOptions} armorOptions={armorOptions} accessoryOptions={accessoryOptions}
          armorSets={armorSets} accessorySets={accessorySets}
        />
      )}
    </div>
  );
}

function TierExam({ tier, config, cert, memberId, bowOptions, armorOptions, accessoryOptions, armorSets, accessorySets }) {
  const SS_KEY = `cert_setup_${memberId}_${tier}`;
  const validVals = bowOptions.map(o => o.value);
  const initBow = (cert?.[tier]?.bowType && validVals.includes(cert[tier].bowType))
    ? cert[tier].bowType : bowOptions[0]?.value || "rental";

  let _ss = {}; try { _ss = JSON.parse(sessionStorage.getItem(SS_KEY) || "{}"); } catch {}
  const [bowType,      setBowType]      = useState(_ss.bowType && validVals.includes(_ss.bowType) ? _ss.bowType : initBow);
  const [armorIdx,     setArmorIdx]     = useState(_ss.armorIdx ?? "0");
  const [accessoryIdx, setAccessoryIdx] = useState(_ss.accessoryIdx ?? "0");
  const [useArmor,     setUseArmor]     = useState(_ss.useArmor ?? false);
  const [useAccessory, setUseAccessory] = useState(_ss.useAccessory ?? false);

  useEffect(() => {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ bowType, armorIdx, accessoryIdx, useArmor, useAccessory }));
  }, [bowType, armorIdx, accessoryIdx, useArmor, useAccessory]); // eslint-disable-line

  const distance = tier === "blue" ? config.blueDistance : config.goldDistance;
  const group    = certBowGroup(bowType);
  const th       = config[tier]?.[group] || { task1Hits: 0, task2Score: 0 };

  const tierData = cert?.[tier] || {};
  const t1 = tierData.task1;
  const t2 = tierData.task2;

  const selectedBowOption  = bowOptions.find(b => b.value === bowType);
  const selectedArmorLabel = useArmor && armorSets[Number(armorIdx)]
    ? (armorSets[Number(armorIdx)].label || `防具套組 ${Number(armorIdx) + 1}`) : null;
  const selectedAccessoryLabel = useAccessory && accessorySets[Number(accessoryIdx)]
    ? (accessorySets[Number(accessoryIdx)].label || `飾品套組 ${Number(accessoryIdx) + 1}`) : null;

  const equipLabels = {
    bowLabel:       selectedBowOption?.customLabel || selectedBowOption?.label || bowType,
    armorLabel:     selectedArmorLabel,
    accessoryLabel: selectedAccessoryLabel,
  };

  return (
    <Card className="p-4 flex flex-col gap-4">
      <ST>挑戰 {TIER_LABEL[tier]} · {distance} 米</ST>

      {/* 弓組選擇 */}
      <Sel label="🏹 使用弓組" value={bowType} onChange={e => setBowType(e.target.value)} options={bowOptions} />

      {/* 防具選擇 */}
      {armorOptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
            <input type="checkbox" checked={useArmor} onChange={e => setUseArmor(e.target.checked)} className="accent-orange-500" />
            🛡️ 使用防具套組
          </label>
          {useArmor && armorOptions.length > 1 && (
            <Sel label="選擇防具" value={armorIdx} onChange={e => setArmorIdx(e.target.value)} options={armorOptions} />
          )}
          {useArmor && armorOptions.length === 1 && (
            <div className="text-sm text-orange-300 font-bold bg-orange-500/10 rounded-lg px-3 py-2">{armorOptions[0].label}</div>
          )}
        </div>
      )}

      {/* 飾品選擇 */}
      {accessoryOptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
            <input type="checkbox" checked={useAccessory} onChange={e => setUseAccessory(e.target.checked)} className="accent-purple-500" />
            ✨ 使用飾品套組
          </label>
          {useAccessory && accessoryOptions.length > 1 && (
            <Sel label="選擇飾品" value={accessoryIdx} onChange={e => setAccessoryIdx(e.target.value)} options={accessoryOptions} />
          )}
          {useAccessory && accessoryOptions.length === 1 && (
            <div className="text-sm text-purple-300 font-bold bg-purple-500/10 rounded-lg px-3 py-2">{accessoryOptions[0].label}</div>
          )}
        </div>
      )}

      {/* 門檻說明 */}
      <div className="bg-white/5 rounded-xl p-3 text-sm text-gray-300">
        <div className="font-bold text-gray-200 mb-1">通過門檻（{selectedBowOption?.label}）</div>
        <div>任務1：射 6 箭，至少 <span className="font-black text-blue-400">{th.task1Hits}</span> 箭中靶</div>
        <div>任務2：{distance} 米，達 <span className="font-black text-blue-400">{th.task2Score}</span> 分</div>
      </div>

      <TaskRow tier={tier} task="task1" label="任務 1 · 中靶數（射6箭）" field="hits"
        unit="箭中靶" pass={th.task1Hits} data={t1} bowType={bowType} memberId={memberId} equipLabels={equipLabels} distance={distance} />
      <TaskRow tier={tier} task="task2" label={`任務 2 · ${distance}米分數`} field="score"
        unit="分" pass={th.task2Score} data={t2} bowType={bowType} memberId={memberId} equipLabels={equipLabels} distance={distance} />
    </Card>
  );
}

const ARROW_VALUES = ["M", 6, 7, 8, 9, 10];

function TaskRow({ tier, task, label, field, unit, pass, data, bowType, memberId, equipLabels, distance }) {
  const isTask1 = field === "hits";
  const SS_KEY = `cert_task_${memberId}_${tier}_${task}`;
  let _ss = {}; try { _ss = JSON.parse(sessionStorage.getItem(SS_KEY) || "{}"); } catch {}
  const [val, setVal]       = useState(_ss.val ?? "");
  const [arrows, setArrows] = useState(_ss.arrows ?? Array(10).fill(null));
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ val, arrows }));
  }, [val, arrows]); // eslint-disable-line

  const status = data?.reviewStatus;
  const passed = data?.passed === true;
  const task2Total  = arrows.reduce((sum, a) => sum + (a === "M" || a == null ? 0 : Number(a)), 0);
  const arrowsFilled = arrows.every(a => a != null);

  function setArrow(i, v) {
    setArrows(prev => { const next = [...prev]; next[i] = v; return next; });
  }

  async function submit() {
    setMsg("");
    let payload;
    if (isTask1) {
      if (val === "" || Number.isNaN(Number(val))) { setMsg("請輸入中靶數"); return; }
      payload = { hits: Number(val), score: null };
    } else {
      if (!arrowsFilled) { setMsg("請完成 10 箭的點選"); return; }
      payload = { score: task2Total, hits: null, arrows: arrows.map(a => a === "M" ? 0 : Number(a)) };
    }
    setBusy(true);
    try {
      await submitCertTask(memberId, tier, task, payload, bowType, equipLabels);
      sessionStorage.removeItem(SS_KEY);
      setVal(""); setArrows(Array(10).fill(null));

      // 檢定的箭也要算進終身箭數/今日練習紀錄/箭數里程碑（之前完全沒接，是漏掉的一塊）
      const arrowCount = isTask1 ? 6 : 10;
      let milestoneMsg = "";
      if (memberId && !memberId.startsWith("guest")) {
        addRoundArrows(memberId, arrowCount).catch(() => {});
        addPracticeLog(memberId, {
          date: new Date().toISOString().slice(0, 10), source: "cert",
          monsterName: `${tier === "gold" ? "金證" : "藍證"}${isTask1 ? "任務一" : "任務二"}`,
          result: "n/a", rounds: [], total: isTask1 ? 0 : task2Total,
          totalArrows: arrowCount, bowType,
        }, memberId).catch(() => {});
        if (!isTask1) {
          finalizePracticeShootingSession({
            sessionId:`certification_${memberId}_${tier}_${task}_${Date.now()}`,
            memberId,
            rounds:[arrows],
            shootingProfile:{ bowType, distance },
            targetFormat:"full_110",
            arrowsPerEnd:arrows.length,
            source:{ kind:"certification", mode:"certification" },
            verification:{ level:"coach" },
            countsToward:{ officialRecord:false },
          }).catch(() => {});
        }
        try {
          const res = await checkAndGrantArrowMilestones(memberId, arrowCount);
          if (res.milestones.length > 0) {
            const last = res.milestones[res.milestones.length - 1];
            const r = getRewardsForMilestone(last);
            milestoneMsg = ` 🎉 達成${last.label}（+${r.gachaCoins}轉蛋幣${r.catBoxes ? `、+${r.catBoxes}貓貓箱` : ""}）`;
          }
        } catch (_) {}
      }
      setMsg(`✅ 已送出，等待教練審核${milestoneMsg}`);
    } catch (e) { setMsg(e?.message || "送出失敗"); }
    setBusy(false);
  }

  return (
    <div className="border border-white/15 rounded-xl p-3 flex flex-col gap-2 bg-white/5">
      <div className="flex items-center justify-between">
        <div className="text-gray-200 text-sm font-bold">{label}</div>
        {passed ? (
          <span className="text-xs font-bold bg-green-500/15 text-green-300 px-2 py-0.5 rounded-full">✅ 已通過</span>
        ) : status === "pending" ? (
          <span className="text-xs font-bold bg-yellow-500/15 text-yellow-300 px-2 py-0.5 rounded-full">⏳ 審核中</span>
        ) : status === "rejected" ? (
          <span className="text-xs font-bold bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">未通過 可重考</span>
        ) : null}
      </div>

      {!passed && (
        <>
          {isTask1 ? (
            <div className="flex gap-2 items-end">
              <Inp label={`中靶數（${unit}）`} type="number" min="0" max="6" value={val}
                onChange={e => setVal(e.target.value)} placeholder={`需達 ${pass}`} />
              <Btn v="primary" onClick={submit} disabled={busy} className="whitespace-nowrap">
                {busy ? "送出中…" : status === "pending" ? "重新送審" : "送審"}
              </Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-gray-400">點選每一箭的分數（半靶 6~10，M=脫靶0分）</div>
              <div className="flex flex-col gap-1.5">
                {arrows.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 w-10">第{i + 1}箭</span>
                    {ARROW_VALUES.map(v => (
                      <button key={v} onClick={() => setArrow(i, v)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all
                          ${a === v
                            ? (v === "M" ? "bg-red-500/25 text-red-300 border-red-400/50" : "bg-blue-600 text-white border-blue-600")
                            : "bg-white/10 text-gray-300 border-white/15"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-blue-500/10 rounded-xl px-3 py-2 mt-1">
                <span className="text-gray-300 text-sm font-bold">加總</span>
                <span className="text-blue-400 font-black text-xl">{task2Total} <span className="text-xs text-gray-400">/ 需達 {pass}</span></span>
              </div>
              <Btn v="primary" onClick={submit} disabled={busy || !arrowsFilled} className="w-full">
                {busy ? "送出中…" : status === "pending" ? "重新送審" : "送審"}
              </Btn>
            </div>
          )}
          {data && (data.hits != null || data.score != null) && status === "pending" && (
            <div className="text-gray-400 text-xs">目前送審：{data.hits != null ? `${data.hits} 箭中靶` : `${data.score} 分`}</div>
          )}
          {msg && <div className={`text-xs ${msg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{msg}</div>}
        </>
      )}
    </div>
  );
}

function CertBadgeBig({ level }) {
  const map = {
    none: { bg: "bg-gray-500", ring: "ring-white/15" },
    blue: { bg: "bg-gradient-to-br from-blue-400 to-blue-600", ring: "ring-blue-400/30" },
    gold: { bg: "bg-gradient-to-br from-amber-400 to-yellow-500", ring: "ring-amber-400/30" },
  };
  const s = map[level] || map.none;
  return (
    <div className={`w-14 h-14 rounded-full ${s.bg} ring-4 ${s.ring} flex items-center justify-center text-white font-black text-xl shadow`}>
      🎖️
    </div>
  );
}
