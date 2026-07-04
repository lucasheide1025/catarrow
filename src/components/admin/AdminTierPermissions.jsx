// src/components/admin/AdminTierPermissions.jsx
// 教練後台：學生分級「權限設定」頁 — 打勾矩陣（頁面 × 分級）
// 詳見 .trellis/tasks/07-04-student-tier-lock/design.md
import { useState, useEffect, Fragment } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeTierPermissions, setTierPermissions } from "../../lib/db";
import { DEFAULT_TIER_PERMISSIONS, PAGE_REGISTRY } from "../../lib/accessControl";
import { Card, Btn, Spinner, useToast } from "../shared/UI";

const TIER_COLUMNS = [
  { key:"restricted", label:"🔒 受限" },
  { key:"autoLocked", label:"⏳ 鎖定中（14天未報到）" },
  { key:"retired",    label:"🌙 退休中" },
];

export default function AdminTierPermissions() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [perms,   setPerms]   = useState(null); // { restricted:[], autoLocked:[], retired:[] }
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    const unsub = subscribeTierPermissions(cfg => {
      setPerms({
        restricted: cfg?.restricted ?? DEFAULT_TIER_PERMISSIONS.restricted,
        autoLocked: cfg?.autoLocked ?? DEFAULT_TIER_PERMISSIONS.autoLocked,
        retired:    cfg?.retired    ?? DEFAULT_TIER_PERMISSIONS.retired,
      });
      setLoading(false);
    });
    return unsub;
  }, []);

  function toggle(tierKey, pageId) {
    setPerms(prev => {
      const list = prev[tierKey] || [];
      const next = list.includes(pageId) ? list.filter(id => id !== pageId) : [...list, pageId];
      return { ...prev, [tierKey]: next };
    });
  }

  async function save() {
    setSaving(true);
    try {
      await setTierPermissions(perms, profile.id);
      toast("權限矩陣已儲存，全站即時生效 ✓");
    } catch (e) { toast("儲存失敗：" + (e?.message || "")); }
    setSaving(false);
  }

  function resetDefault() {
    setPerms({ ...DEFAULT_TIER_PERMISSIONS });
  }

  if (loading || !perms) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="flex justify-between items-center">
        <h2 className="text-white font-black text-xl">🎓 權限設定</h2>
        <div className="flex gap-2">
          <Btn v="secondary" size="sm" onClick={resetDefault}>還原預設值</Btn>
          <Btn v="primary" size="sm" onClick={save} disabled={saving}>{saving ? "儲存中…" : "💾 儲存"}</Btn>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-400/30 rounded-xl px-4 py-3 text-blue-200 text-xs leading-relaxed">
        調整每個分級（受限／鎖定中／退休中）能看到哪些頁面。「正式學生（未鎖定）」恆為全開，不在此表管轄範圍。
        調整後儲存即時生效，不需重新部署。`accountFrozen` 與系統維護鎖是更高優先權的獨立機制，不受此表影響。
      </div>

      {PAGE_REGISTRY.map(group => (
        <Card key={group.group} className="p-4 flex flex-col gap-2">
          <div className="text-white font-black text-sm mb-1">{group.group}</div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns:"1fr repeat(3, auto)" }}>
            {/* 表頭 */}
            <div />
            {TIER_COLUMNS.map(col => (
              <div key={col.key} className="text-gray-400 text-[10px] font-bold text-center px-1 whitespace-nowrap">{col.label}</div>
            ))}
            {group.pages.map(pg => (
              <Fragment key={pg.id}>
                <div className="text-slate-300 text-xs py-1">{pg.label}</div>
                {TIER_COLUMNS.map(col => (
                  <label key={pg.id + "_" + col.key} className="flex items-center justify-center py-1 cursor-pointer">
                    <input type="checkbox"
                      checked={(perms[col.key] || []).includes(pg.id)}
                      onChange={() => toggle(col.key, pg.id)}
                      className="accent-blue-500 w-4 h-4" />
                  </label>
                ))}
              </Fragment>
            ))}
          </div>
        </Card>
      ))}

      <Btn v="primary" onClick={save} disabled={saving}>{saving ? "儲存中…" : "💾 儲存權限矩陣"}</Btn>
    </div>
  );
}
