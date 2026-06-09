// src/components/member/MemberCertExam.jsx
// 射手證畢業考：學生選裝備 → 看門檻 → 登記任務1(中靶數)/任務2(分數) → 送審
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertConfig, subscribeCertification, submitCertTask, certBowGroup } from "../../lib/db";
import { Card, Btn, Inp, Sel, ST, Spinner } from "../shared/UI";
import { normalizeEquipment } from "../shared/Equipment";

const BOW_LABEL_MAP = {
  recurve_full: "競技反曲弓（全配）",
  recurve_bare: "競技反曲弓（裸弓）",
  compound:     "美式獵弓",
  traditional:  "傳統弓",
};

// 從學生自訂裝備產生可選裝備清單
// 有自訂弓組 → 只列自訂的（預設排第一）；沒有 → 只列租借器材
function buildBowOptions(profile) {
  const sets = normalizeEquipment(profile?.equipment);
  // 過濾掉防具/飾品，只留弓組
  const bowSets = sets.filter(s => s.type !== "armor" && s.type !== "accessory");

  if (bowSets.length === 0) {
    return [{ value: "rental", label: "租借器材" }];
  }

  // 預設排第一，其餘照順序
  const sorted = [
    ...bowSets.filter(s => s.isDefault),
    ...bowSets.filter(s => !s.isDefault),
  ];

  return sorted.map(s => {
    const cat = s.bowCategory;
    return {
      value: cat,
      label: s.label
        ? `${s.label}（${BOW_LABEL_MAP[cat] || cat}）`
        : (BOW_LABEL_MAP[cat] || cat),
    };
  });
}

const TIER_LABEL = { blue: "藍證（初階）", gold: "金證（高階）" };

export default function MemberCertExam({ onBack }) {
  const { profile } = useAuth();
  const bowOptions = buildBowOptions(profile);
  const [config, setConfig] = useState(null);
  const [cert, setCert]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCertConfig().then(setConfig);
    if (!profile?.id) return;
    const unsub = subscribeCertification(profile.id, c => { setCert(c); setLoading(false); });
    return () => unsub && unsub();
  }, [profile?.id]);

  if (loading || !config) return <Spinner />;

  const level = cert?.level || "none";
  const locked = cert?.locked || false;
  const nextTier = level === "none" ? "blue" : level === "blue" ? "gold" : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={onBack} className="text-blue-600 text-sm font-bold self-start">← 返回</button>
      <h2 className="text-gray-800 font-black text-xl">🎖️ 射手證畢業考</h2>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <CertBadgeBig level={level} />
          <div>
            <div className="text-gray-500 text-xs">目前射手證</div>
            <div className="font-black text-lg text-gray-800">
              {level === "gold" ? "金證 · 已達最高級" : level === "blue" ? "藍證" : "尚未取得"}
            </div>
          </div>
        </div>
        {locked && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-xs font-bold">
            🏆 已取得金證（最高級），射手證系統已鎖定，無需再測驗。
          </div>
        )}
      </Card>

      {!locked && nextTier && (
        <TierExam tier={nextTier} config={config} cert={cert} memberId={profile.id} bowOptions={bowOptions} />
      )}
    </div>
  );
}

function TierExam({ tier, config, cert, memberId, bowOptions }) {
  const validVals = bowOptions.map(o => o.value);
  const initBow = (cert?.[tier]?.bowType && validVals.includes(cert[tier].bowType))
    ? cert[tier].bowType
    : bowOptions[0]?.value || "rental";
  const [bowType, setBowType] = useState(initBow);
  const distance = tier === "blue" ? config.blueDistance : config.goldDistance;
  const group = certBowGroup(bowType);
  const th = config[tier]?.[group] || { task1Hits: 0, task2Score: 0 };

  const tierData = cert?.[tier] || {};
  const t1 = tierData.task1;
  const t2 = tierData.task2;

  return (
    <Card className="p-4 flex flex-col gap-4">
      <ST>挑戰 {TIER_LABEL[tier]} · {distance} 米</ST>

      <Sel label="使用裝備" value={bowType} onChange={e => setBowType(e.target.value)} options={bowOptions} />

      <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
        <div className="font-bold text-gray-700 mb-1">通過門檻（{bowOptions.find(b => b.value === bowType)?.label}）</div>
        <div>任務1：射 6 箭，至少 <span className="font-black text-blue-600">{th.task1Hits}</span> 箭中靶</div>
        <div>任務2：{distance} 米，達 <span className="font-black text-blue-600">{th.task2Score}</span> 分</div>
      </div>

      <TaskRow tier={tier} task="task1" label="任務 1 · 中靶數（射6箭）" field="hits"
        unit="箭中靶" pass={th.task1Hits} data={t1} bowType={bowType} memberId={memberId} />
      <TaskRow tier={tier} task="task2" label={`任務 2 · ${distance}米分數`} field="score"
        unit="分" pass={th.task2Score} data={t2} bowType={bowType} memberId={memberId} />
    </Card>
  );
}

const ARROW_VALUES = ["M", 6, 7, 8, 9, 10];

function TaskRow({ tier, task, label, field, unit, pass, data, bowType, memberId }) {
  const isTask1 = field === "hits";
  const [val, setVal]       = useState("");
  const [arrows, setArrows] = useState(Array(10).fill(null));
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState("");

  const status = data?.reviewStatus;
  const passed = data?.passed === true;
  const task2Total = arrows.reduce((sum, a) => sum + (a === "M" || a == null ? 0 : Number(a)), 0);
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
      await submitCertTask(memberId, tier, task, payload, bowType);
      setMsg("✅ 已送出，等待教練審核");
      setVal(""); setArrows(Array(10).fill(null));
    } catch (e) { setMsg(e?.message || "送出失敗"); }
    setBusy(false);
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-gray-700 text-sm font-bold">{label}</div>
        {passed ? (
          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 已通過</span>
        ) : status === "pending" ? (
          <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳ 審核中</span>
        ) : status === "rejected" ? (
          <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">未通過 可重考</span>
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
                            ? (v === "M" ? "bg-gray-700 text-white border-gray-700" : "bg-blue-600 text-white border-blue-600")
                            : "bg-white text-gray-500 border-gray-200"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-blue-50 rounded-xl px-3 py-2 mt-1">
                <span className="text-gray-600 text-sm font-bold">加總</span>
                <span className="text-blue-600 font-black text-xl">{task2Total} <span className="text-xs text-gray-400">/ 需達 {pass}</span></span>
              </div>
              <Btn v="primary" onClick={submit} disabled={busy || !arrowsFilled} className="w-full">
                {busy ? "送出中…" : status === "pending" ? "重新送審" : "送審"}
              </Btn>
            </div>
          )}
          {data && (data.hits != null || data.score != null) && status === "pending" && (
            <div className="text-gray-400 text-xs">目前送審：{data.hits != null ? `${data.hits} 箭中靶` : `${data.score} 分`}</div>
          )}
          {msg && <div className={`text-xs ${msg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{msg}</div>}
        </>
      )}
    </div>
  );
}

function CertBadgeBig({ level }) {
  const map = {
    none: { bg: "bg-gray-300", ring: "ring-gray-200" },
    blue: { bg: "bg-gradient-to-br from-blue-400 to-blue-600", ring: "ring-blue-200" },
    gold: { bg: "bg-gradient-to-br from-amber-400 to-yellow-500", ring: "ring-amber-200" },
  };
  const s = map[level] || map.none;
  return (
    <div className={`w-14 h-14 rounded-full ${s.bg} ring-4 ${s.ring} flex items-center justify-center text-white font-black text-xl shadow`}>
      🎖️
    </div>
  );
}