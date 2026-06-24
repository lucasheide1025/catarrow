// src/components/admin/AdminBattleEvent.jsx — 打怪賽事模式後台設定
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMonsterEventConfig, setMonsterEventConfig } from "../../lib/db";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";

const MODE_OPTIONS = [
  { value:"novice",  label:"🟢 新手（無反擊）" },
  { value:"student", label:"🎓 學生（低機率反擊）" },
  { value:"veteran", label:"🟠 老手（高機率反擊）" },
];
const BATTLE_OPTIONS = [
  { value:"score",  label:"🎯 分數靶" },
  { value:"zombie", label:"🧟 殭屍靶" },
];
const DIST_OPTIONS = [
  { value:"fixed",   label:"📍 固定距離" },
  { value:"dynamic", label:"🏃 動態起始距離" },
];

export default function AdminBattleEvent() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [cfg, setCfg] = useState({
    active: false,
    name: "",
    desc: "",
    battleMode: "score",
    mode: "student",
    distanceMode: "fixed",
    fixedDistance: 15,
    dynamicStart: 15,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeMonsterEventConfig(data => {
      if (data) setCfg(prev => ({ ...prev, ...data }));
    });
  }, []);

  function set(key, val) { setCfg(prev => ({ ...prev, [key]: val })); }

  async function save() {
    setSaving(true);
    const res = await setMonsterEventConfig(cfg, profile?.id);
    setSaving(false);
    if (res.ok) toast("✅ 賽事設定已儲存");
    else toast("❌ 儲存失敗：" + res.reason, "error");
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <ToastContainer />

      {/* 狀態卡 */}
      <div className={`rounded-2xl p-4 flex items-center justify-between border-2 ${cfg.active ? "bg-amber-50 border-amber-400" : "bg-gray-50 border-gray-200"}`}>
        <div>
          <div className={`font-black text-lg ${cfg.active ? "text-amber-700" : "text-gray-400"}`}>
            {cfg.active ? "⚔️ 賽事模式 開啟中" : "⚔️ 賽事模式 關閉"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">開啟後，射手打怪頁會出現賽事入口按鈕</div>
        </div>
        <button onClick={() => set("active", !cfg.active)}
          className={`w-12 h-6 rounded-full transition-all relative ${cfg.active ? "bg-amber-500" : "bg-gray-300"}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${cfg.active ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      {/* 基本資訊 */}
      <Card className="p-4 flex flex-col gap-3">
        <ST>📋 活動資訊</ST>
        <Inp label="賽事名稱" value={cfg.name} onChange={e => set("name", e.target.value)} placeholder="例：週末射箭練功賽" />
        <Inp label="說明（選填）" value={cfg.desc} onChange={e => set("desc", e.target.value)} placeholder="例：固定 18m，適合中級生練習" />
      </Card>

      {/* 戰鬥設定 */}
      <Card className="p-4 flex flex-col gap-3">
        <ST>⚔️ 戰鬥設定</ST>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-semibold">靶型</label>
          <div className="flex gap-2">
            {BATTLE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => set("battleMode", o.value)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${cfg.battleMode === o.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-semibold">難度模式</label>
          <div className="flex flex-col gap-1.5">
            {MODE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => set("mode", o.value)}
                className={`py-2 px-3 rounded-xl text-sm font-bold border text-left transition-all ${cfg.mode === o.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 距離設定 */}
      <Card className="p-4 flex flex-col gap-3">
        <ST>📏 距離設定</ST>
        <div className="flex gap-2">
          {DIST_OPTIONS.map(o => (
            <button key={o.value} onClick={() => set("distanceMode", o.value)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${cfg.distanceMode === o.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {o.label}
            </button>
          ))}
        </div>

        {cfg.distanceMode === "fixed" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-semibold">固定距離（米）</label>
            <div className="flex gap-2 flex-wrap">
              {[10,15,18,20,25,30].map(d => (
                <button key={d} onClick={() => set("fixedDistance", d)}
                  className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${cfg.fixedDistance === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
        )}

        {cfg.distanceMode === "dynamic" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-semibold">動態起始距離（米）</label>
            <div className="flex gap-2 flex-wrap">
              {[10,15,18,20,25,30].map(d => (
                <button key={d} onClick={() => set("dynamicStart", d)}
                  className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${cfg.dynamicStart === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                  {d}m
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">射手每局分數達標後距離自動增加</div>
          </div>
        )}
      </Card>

      {/* 儲存 */}
      <Btn v="primary" className="w-full" onClick={save} disabled={saving}>
        {saving ? "儲存中…" : "💾 儲存設定"}
      </Btn>

      {/* 預覽 */}
      {cfg.active && (
        <div className="rounded-2xl p-4 border-2 border-amber-400" style={{ background:"linear-gradient(135deg,#92400e,#b45309)" }}>
          <div className="text-xs font-black tracking-widest text-amber-200 mb-1">⚔️ 射手端預覽</div>
          <div className="text-white font-black text-base">{cfg.name || "賽事打怪"}</div>
          {cfg.desc && <div className="text-amber-100 text-xs mt-0.5">{cfg.desc}</div>}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {cfg.battleMode === "zombie" ? "🧟 殭屍靶" : "🎯 分數靶"}
            </span>
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {cfg.mode === "novice" ? "🟢 新手" : cfg.mode === "student" ? "🎓 學生" : "🟠 老手"}
            </span>
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {cfg.distanceMode === "dynamic" ? `🏃 動態 ${cfg.dynamicStart}m起` : `📍 ${cfg.fixedDistance}m`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
