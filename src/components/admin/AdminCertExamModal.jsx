// src/components/admin/AdminCertExamModal.jsx
import { useState, useEffect } from "react";
import { getCertification, adminUpdateCertification, deleteCertification } from "../../lib/db";
import { Modal, Btn, Inp, Sel, ST, Spinner, ConfirmModal } from "./../shared/UI";
import { normalizeEquipment } from "../shared/Equipment";

const BOW_LABEL_MAP = {
  rental:       "租借器材",
  traditional:  "傳統弓",
  recurve_bare: "競技反曲弓（裸弓）",
  recurve_full: "競技反曲弓（全配）",
  compound:     "美式獵弓",
};

const LEVEL_OPTIONS = [
  { value: "none", label: "灰證（未通過）" },
  { value: "blue", label: "藍證（初階）" },
  { value: "gold", label: "金證（高階）" },
];

// 從學生裝備產生弓組選單（有自訂就用自訂，沒有就租借）
function buildBowOptions(member) {
  const sets = normalizeEquipment(member?.equipment)
    .filter(s => s.type !== "armor" && s.type !== "accessory");
  if (sets.length === 0) return [{ value: "rental", label: "租借器材" }];
  const sorted = [...sets.filter(s => s.isDefault), ...sets.filter(s => !s.isDefault)];
  return sorted.map(s => ({
    value: s.bowCategory,
    label: s.label
      ? `${s.label}（${BOW_LABEL_MAP[s.bowCategory] || s.bowCategory}）`
      : (BOW_LABEL_MAP[s.bowCategory] || s.bowCategory),
    customLabel: s.label || BOW_LABEL_MAP[s.bowCategory] || s.bowCategory,
  }));
}

export default function AdminCertExamModal({ member, onClose, onDone, operatorId, toast }) {
  const [cert, setCert]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const [level,  setLevel]  = useState("none");
  const [locked, setLocked] = useState(false);
  const [blue,   setBlue]   = useState(() => emptyTier(buildBowOptions(member)));
  const [gold,   setGold]   = useState(() => emptyTier(buildBowOptions(member)));

  const bowOptions    = buildBowOptions(member);
  const armorSets     = member?.armorSets     || [];
  const accessorySets = member?.accessorySets || [];

  function emptyTier(opts) {
    return {
      bowType: opts?.[0]?.value || "rental",
      bowLabel: null, armorLabel: null, accessoryLabel: null,
      task1: { passed: false, hits: "" },
      task2: { passed: false, score: "" },
    };
  }

  function normalizeTier(t) {
    return {
      bowType:        t.bowType        || "rental",
      bowLabel:       t.bowLabel       || null,
      armorLabel:     t.armorLabel     || null,
      accessoryLabel: t.accessoryLabel || null,
      task1: { passed: t.task1?.passed || false, hits: t.task1?.hits ?? "" },
      task2: { passed: t.task2?.passed || false, score: t.task2?.score ?? "" },
    };
  }

  useEffect(() => {
    getCertification(member.id).then(c => {
      setCert(c);
      if (c) {
        setLevel(c.level || "none");
        setLocked(c.locked || false);
        if (c.blue) setBlue(normalizeTier(c.blue));
        if (c.gold) setGold(normalizeTier(c.gold));
      }
      setLoading(false);
    });
  }, [member.id]); // eslint-disable-line

  async function save() {
    setSaving(true);
    try {
      const tierData = (tier) => ({
        bowType:        tier.bowType,
        bowLabel:       tier.bowLabel       || null,
        armorLabel:     tier.armorLabel     || null,
        accessoryLabel: tier.accessoryLabel || null,
        task1: { passed: tier.task1.passed, hits: tier.task1.hits === "" ? null : Number(tier.task1.hits), reviewStatus: tier.task1.passed ? "approved" : "rejected" },
        task2: { passed: tier.task2.passed, score: tier.task2.score === "" ? null : Number(tier.task2.score), reviewStatus: tier.task2.passed ? "approved" : "rejected" },
      });
      await adminUpdateCertification(member.id, { level, locked, blue: tierData(blue), gold: tierData(gold) }, operatorId);
      toast("射手證已更新 ✓");
      onDone && onDone();
      onClose();
    } catch (e) {
      toast("儲存失敗：" + (e?.message || ""), "error");
    }
    setSaving(false);
  }

  async function doDelete() {
    await deleteCertification(member.id, operatorId);
    toast("射手證紀錄已刪除");
    setDelConfirm(false);
    onDone && onDone();
    onClose();
  }

  function TierEditor({ label, tier, setTier }) {
    return (
      <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-3">
        <div className="text-gray-700 text-sm font-bold">{label}</div>

        {/* 弓組選單：用學生自訂裝備 */}
        <Sel label="使用弓組" value={tier.bowType}
          onChange={e => {
            const opt = bowOptions.find(o => o.value === e.target.value);
            setTier(p => ({ ...p, bowType: e.target.value, bowLabel: opt?.customLabel || null }));
          }}
          options={bowOptions} />

        {/* 防具選單 */}
        {armorSets.length > 0 && (
          <Sel label="🛡️ 防具套組"
            value={tier.armorLabel || ""}
            onChange={e => setTier(p => ({ ...p, armorLabel: e.target.value || null }))}
            options={[
              { value: "", label: "（不使用防具）" },
              ...armorSets.map((s, i) => ({ value: s.label || `防具套組 ${i+1}`, label: s.label || `防具套組 ${i+1}` })),
            ]} />
        )}
        {tier.armorLabel && (
          <div className="text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-2">
            🛡️ 防具：<span className="font-bold">{tier.armorLabel}</span>
          </div>
        )}

        {/* 飾品選單 */}
        {accessorySets.length > 0 && (
          <Sel label="✨ 飾品套組"
            value={tier.accessoryLabel || ""}
            onChange={e => setTier(p => ({ ...p, accessoryLabel: e.target.value || null }))}
            options={[
              { value: "", label: "（不使用飾品）" },
              ...accessorySets.map((s, i) => ({ value: s.label || `飾品套組 ${i+1}`, label: s.label || `飾品套組 ${i+1}` })),
            ]} />
        )}
        {tier.accessoryLabel && (
          <div className="text-xs bg-purple-50 text-purple-700 rounded-lg px-3 py-2">
            ✨ 飾品：<span className="font-bold">{tier.accessoryLabel}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Inp label="任務1 中靶數" type="number" min="0" value={tier.task1.hits}
              onChange={e => setTier(p => ({ ...p, task1: { ...p.task1, hits: e.target.value } }))} />
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={tier.task1.passed}
                onChange={e => setTier(p => ({ ...p, task1: { ...p.task1, passed: e.target.checked } }))}
                className="accent-green-600" /> 任務1 通過
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <Inp label="任務2 分數" type="number" min="0" value={tier.task2.score}
              onChange={e => setTier(p => ({ ...p, task2: { ...p.task2, score: e.target.value } }))} />
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={tier.task2.passed}
                onChange={e => setTier(p => ({ ...p, task2: { ...p.task2, passed: e.target.checked } }))}
                className="accent-green-600" /> 任務2 通過
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Modal open wide onClose={onClose} title={`射手證 — ${member.name}`}>
      {loading ? <Spinner /> : (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-xs">
            後台最高權限：可直接改等級、裝備、任務成績與鎖定狀態。改完按儲存。
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Sel label="目前證書等級" value={level} onChange={e => setLevel(e.target.value)} options={LEVEL_OPTIONS} />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
                <input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} className="accent-amber-600" />
                🔒 鎖定（金證最高級）
              </label>
            </div>
          </div>

          <TierEditor label="🔵 藍證（初階 / 10米）" tier={blue} setTier={setBlue} />
          <TierEditor label="🟡 金證（高階 / 15米）" tier={gold} setTier={setGold} />

          <div className="flex gap-2">
            <Btn v="danger" onClick={() => setDelConfirm(true)}>🗑️ 刪除紀錄</Btn>
            <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
            <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>
              {saving ? "儲存中…" : "儲存"}
            </Btn>
          </div>
        </div>
      )}
      <ConfirmModal open={delConfirm} title="刪除射手證紀錄"
        message="確定刪除此學生的整個射手證紀錄？此操作無法復原，學生需重新考證。"
        onConfirm={doDelete} onCancel={() => setDelConfirm(false)} />
    </Modal>
  );
}