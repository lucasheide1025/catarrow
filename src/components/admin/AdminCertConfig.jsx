// src/components/admin/AdminCertConfig.jsx
// 後台：射手證畢業考門檻設定（藍證/金證，三組裝備）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertConfig, saveCertConfig, CERT_PASS_DEFAULT } from "../../lib/db";
import { Card, Btn, Inp, ST, Spinner, useToast } from "../shared/UI";

const GROUPS = [
  { key: "rental",      label: "租借器材" },
  { key: "traditional", label: "傳統弓" },
  { key: "standard",    label: "全配 / 裸弓 / 美式獵弓" },
];

export default function AdminCertConfig() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getCertConfig().then(setConfig); }, []);

  if (!config) return <Spinner />;

  function setVal(tier, group, field, v) {
    setConfig(p => ({
      ...p,
      [tier]: { ...p[tier], [group]: { ...p[tier][group], [field]: Number(v) } },
    }));
  }
  function setDist(field, v) {
    setConfig(p => ({ ...p, [field]: Number(v) }));
  }

  async function save() {
    setSaving(true);
    await saveCertConfig(config, profile.id);
    toast("門檻已儲存 ✓");
    setSaving(false);
  }
  function resetDefault() {
    setConfig(JSON.parse(JSON.stringify(CERT_PASS_DEFAULT)));
    toast("已還原預設值（記得儲存）");
  }

  function TierSection({ tier, title, distField }) {
    return (
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ST>{title}</ST>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-xs">距離</span>
            <input type="number" min="1" value={config[distField]}
              onChange={e => setDist(distField, e.target.value)}
              className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm font-bold" />
            <span className="text-gray-500 text-xs">米</span>
          </div>
        </div>
        {GROUPS.map(g => (
          <div key={g.key} className="border border-gray-200 rounded-xl p-3">
            <div className="text-gray-700 text-sm font-bold mb-2">{g.label}</div>
            <div className="grid grid-cols-2 gap-2">
              <Inp label="任務1 中靶數（射6箭）" type="number" min="0"
                value={config[tier][g.key].task1Hits}
                onChange={e => setVal(tier, g.key, "task1Hits", e.target.value)} />
              <Inp label="任務2 達標分數" type="number" min="0"
                value={config[tier][g.key].task2Score}
                onChange={e => setVal(tier, g.key, "task2Score", e.target.value)} />
            </div>
          </div>
        ))}
      </Card>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <h2 className="text-gray-800 font-black text-xl">🎖️ 射手證考證門檻</h2>
        <button onClick={resetDefault} className="text-blue-600 text-xs font-bold">↺ 還原預設</button>
      </div>

      <TierSection tier="blue" title="藍證（初階）" distField="blueDistance" />
      <TierSection tier="gold" title="金證（高階）" distField="goldDistance" />

      <Btn v="primary" className="w-full py-3" onClick={save} disabled={saving}>
        {saving ? "儲存中…" : "儲存門檻設定"}
      </Btn>
    </div>
  );
}
