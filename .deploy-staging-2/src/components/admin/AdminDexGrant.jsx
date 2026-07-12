// src/components/admin/AdminDexGrant.jsx
// 後台：授予圖鑑成就（屆數名次 / 擊敗教練）+ 屆數管理
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getMembers, subscribeDexGrants,
  grantRoundAchievement, revokeRoundAchievement,
  grantSpecialAchievement, revokeSpecialAchievement,
  getDexConfig, saveDexConfig,
} from "../../lib/db";
import { SPECIAL_GRANTS, RANK_STYLE } from "../../lib/achievementDex";
import { Card, Btn, Sel, Inp, ST, useToast } from "../shared/UI";

export default function AdminDexGrant() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [members, setMembers] = useState([]);
  const [selId, setSelId] = useState("");
  const [grants, setGrants] = useState([]);
  const [config, setConfig] = useState({ physicalMax: 10, pointMax: 10 });
  const [tab, setTab] = useState("physical");

  useEffect(() => {
    getMembers().then(setMembers);
    getDexConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!selId) { setGrants([]); return; }
    const unsub = subscribeDexGrants(selId, setGrants);
    return () => unsub && unsub();
  }, [selId]);

  const sel = members.find(m => m.id === selId);

  async function saveRounds() {
    await saveDexConfig(config, profile.id);
    toast("屆數設定已更新 ✓");
  }

  async function grantRound(type, round, rank) {
    await grantRoundAchievement(selId, type, round, rank, profile.id);
    toast(`已授予 ${sel?.nickname || sel?.name}：${type === "physical" ? "實體賽" : "積分賽"} 第${round}屆 ${RANK_STYLE[rank].label}`);
  }
  async function revokeRound(type, round) {
    await revokeRoundAchievement(selId, type, round, profile.id);
    toast("已取消");
  }
  async function toggleSpecial(id, has) {
    if (has) { await revokeSpecialAchievement(selId, id, profile.id); toast("已取消"); }
    else { await grantSpecialAchievement(selId, id, profile.id); toast("已授予 ✓"); }
  }

  function rankOf(type, round) {
    const g = grants.find(x => x.type === type && x.round === round);
    return g ? g.rank : null;
  }

  const max = tab === "physical" ? config.physicalMax : config.pointMax;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-gray-800 font-black text-xl">🎖️ 圖鑑授予</h2>

      {/* 屆數設定 */}
      <Card className="p-4 flex flex-col gap-3 border border-indigo-200">
        <ST>屆數設定（之後辦新一屆就 +1）</ST>
        <div className="grid grid-cols-2 gap-2">
          <Inp label="實體賽目前屆數" type="number" value={config.physicalMax}
            onChange={e => setConfig({ ...config, physicalMax: Number(e.target.value) })} />
          <Inp label="積分賽目前屆數" type="number" value={config.pointMax}
            onChange={e => setConfig({ ...config, pointMax: Number(e.target.value) })} />
        </div>
        <Btn v="primary" onClick={saveRounds}>儲存屆數</Btn>
      </Card>

      {/* 選學生 */}
      <Card className="p-4">
        <Sel label="選擇學生" value={selId} onChange={e => setSelId(e.target.value)}
          options={[{ value: "", label: "— 請選擇 —" }, ...members.map(m => ({ value: m.id, label: `${m.nickname || m.name}（${m.name}）` }))]} />
      </Card>

      {!selId ? (
        <div className="text-gray-400 text-sm text-center py-6">請先選擇學生</div>
      ) : (
        <>
          {/* 賽別 tab */}
          <div className="flex gap-2">
            {[["physical", "🏆 實體賽"], ["point", "⭐ 積分賽"], ["special", "✨ 特殊"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border ${tab === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "special" ? (
            <div className="flex flex-col gap-2">
              {SPECIAL_GRANTS.map(s => {
                const has = grants.some(g => g.type === "special" && g.id === s.id);
                return (
                  <div key={s.id} className={`flex items-center justify-between rounded-xl p-3 border ${has ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
                    <div>
                      <div className="text-gray-800 text-sm font-bold">{s.icon} {s.name}</div>
                      <div className="text-gray-400 text-xs">{s.desc}</div>
                    </div>
                    <Btn v={has ? "danger" : "success"} size="sm" onClick={() => toggleSpecial(s.id, has)}>
                      {has ? "取消" : "授予"}
                    </Btn>
                  </div>
                );
              })}
            </div>
          ) : (
            // 屆數授予
            <div className="flex flex-col gap-2">
              {Array.from({ length: max }).map((_, i) => {
                const round = i + 1;
                const cur = rankOf(tab, round);
                return (
                  <div key={round} className="rounded-xl p-3 border bg-white border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-800 text-sm font-bold">第 {round} 屆</span>
                      {cur != null && <span className="text-xs font-bold text-amber-600">{RANK_STYLE[cur].icon} {RANK_STYLE[cur].label}</span>}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[[1, "🥇冠軍"], [2, "🥈亞軍"], [3, "🥉季軍"], [0, "✓參加"]].map(([rk, lbl]) => (
                        <button key={rk} onClick={() => grantRound(tab, round, rk)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${cur === rk ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {lbl}
                        </button>
                      ))}
                      {cur != null && (
                        <button onClick={() => revokeRound(tab, round)}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 bg-white">
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
