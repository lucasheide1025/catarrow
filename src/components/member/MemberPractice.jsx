// src/components/member/MemberPractice.jsx
import { useState, useEffect } from "react";
import { addPracticeLog, subscribePracticeLogs } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { today, fmtDT } from "../../lib/constants";
import { getDefaultBowType } from "../shared/Equipment";
import { Card, Btn, Inp, Sel, ST, Spinner, Empty, useToast } from "../shared/UI";

const BOW_OPTIONS = [
  { value: "recurve_full", label: "競技反曲弓（全配）" },
  { value: "recurve_bare", label: "競技反曲弓（裸弓）" },
  { value: "compound",     label: "美式獵弓" },
  { value: "traditional",  label: "傳統弓" },
];

const DISTANCE_OPTIONS = [6,9,12,15,18,20,25,30,40,50,60,70].map(d=>({value:d,label:`${d} 米`}));

function bowLabel(v){ return BOW_OPTIONS.find(b=>b.value===v)?.label || v; }

export default function MemberPractice() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [phase, setPhase]   = useState("setup");
  const [form, setForm]     = useState(() => ({
    date: today(), bowType: getDefaultBowType(profile?.equipment), distance: 18,
    arrowCount: 6, roundCount: 6, maxScore: 10, hasMiss: true, note: "",
  }));
  const [round, setRound]   = useState(0);
  const [allR, setAllR]     = useState([]);
  const [cur, setCur]       = useState([]);
  const [saving, setSaving] = useState(false);
  const [openMonths, setOpenMonths] = useState({});  // 折疊狀態

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribePracticeLogs(profile.id, data => {
      setLogs(data.filter(l => l.distance && l.totalArrows > 0)); setLoading(false);
    });
    return unsub;
  }, [profile?.id]);

  const btns = [...Array.from({length: form.maxScore+1}, (_,i)=>i), ...(form.hasMiss?["M"]:[])];

  function addArrow(s) {
    if (cur.length < form.arrowCount) setCur(p => [...p, s]);
  }
  function soFar() {
    return allR.flat().filter(s=>s!=="M").reduce((a,b)=>a+b,0);
  }
  function submitRound() {
    const newAll = [...allR, cur];
    setAllR(newAll); setCur([]);
    if (newAll.length >= form.roundCount) setPhase("result");
    else setRound(r => r+1);
  }

  async function saveSession() {
    setSaving(true);
    const total = allR.flat().filter(s=>s!=="M").reduce((a,b)=>a+b,0);
    const miss  = allR.flat().filter(s=>s==="M").length;
    const arrows = form.arrowCount * form.roundCount;
    // ⚠️ 統一用 profile.id（與訂閱的 where memberId==profile.id 一致）
    await addPracticeLog(profile.id,{
      date: form.date,
      bowType: form.bowType,
      distance: form.distance,
      arrowCount: form.arrowCount,
      roundCount: form.roundCount,
      maxScore: form.maxScore,
      rounds: allR,
      total, miss,
      totalArrows: arrows,
      avgPerArrow: arrows > 0 ? Math.round((total/arrows)*10)/10 : 0,
      avgPerRound: form.roundCount > 0 ? Math.round((total/form.roundCount)*10)/10 : 0,
      note: form.note,
    }, profile.id);
    toast("練習紀錄已儲存 ✓");
    setSaving(false);
    setPhase("setup"); setAdding(false);
    setRound(0); setAllR([]); setCur([]);
    setForm(p => ({...p, note:""}));
  }

  // ── 總覽統計 ──
  const stats = () => {
    if (logs.length === 0) return null;
    const totalArrows = logs.reduce((a,l)=>a+(l.totalArrows||0),0);
    const totalScore  = logs.reduce((a,l)=>a+(l.total||0),0);
    const sessions    = logs.length;
    const best        = Math.max(...logs.map(l=>l.total||0));
    const avgScore    = sessions > 0 ? Math.round(totalScore/sessions) : 0;
    return { totalArrows, sessions, best, avgScore };
  };
  const s = stats();

  // ── 依「年 > 月」分組 ──
  function groupLogs() {
    const byYear = {};   // { year: { ym: [logs] } }
    logs.forEach(l => {
      const d = (l.date || "").slice(0,10);
      const year = d.slice(0,4) || "未分類";
      const ym   = d.slice(0,7) || "未分類";
      if (!byYear[year]) byYear[year] = {};
      if (!byYear[year][ym]) byYear[year][ym] = [];
      byYear[year][ym].push(l);
    });
    return byYear;
  }
  function monthStat(arr) {
    const sessions = arr.length;
    const totalScore = arr.reduce((a,l)=>a+(l.total||0),0);
    const totalArrows = arr.reduce((a,l)=>a+(l.totalArrows||0),0);
    const avg = sessions>0 ? Math.round(totalScore/sessions) : 0;
    const best = sessions>0 ? Math.max(...arr.map(l=>l.total||0)) : 0;
    return { sessions, avg, best, totalArrows };
  }
  function toggleMonth(ym){ setOpenMonths(p=>({...p,[ym]:!p[ym]})); }

  if (loading) return <Spinner />;

  // ── 計分畫面 ──
  if (adding && phase === "scoring") {
    const rt = cur.filter(s=>s!=="M").reduce((a,b)=>a+b,0);
    return (
      <div className="p-4 flex flex-col gap-4">
        <button onClick={()=>{setAdding(false);setPhase("setup");setRound(0);setAllR([]);setCur([]);}}
          className="text-gray-500 text-sm">← 放棄此次練習</button>
        <Card className="p-4">
          <div className="text-gray-500 text-xs mb-1">{bowLabel(form.bowType)}　{form.distance}米</div>
          <div className="text-gray-800 font-black text-2xl">
            第 {round+1} 回<span className="text-gray-400 font-medium text-base ml-2">/ {form.roundCount}</span>
          </div>
          <div className="mt-2 bg-gray-100 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{width:`${(round/form.roundCount)*100}%`}}/>
          </div>
        </Card>
        <div className="flex gap-2">
          {Array.from({length:form.arrowCount}).map((_,i)=>(
            <div key={i} className={`flex-1 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2
              ${i<cur.length?"bg-green-500 border-green-500 text-white":"border-gray-200 text-gray-300"}`}>
              {i<cur.length?(cur[i]==="M"?"✗":cur[i]):"—"}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {btns.map(sc=>(
            <button key={sc} onClick={()=>addArrow(sc)} disabled={cur.length>=form.arrowCount}
              className={`py-3 rounded-xl font-black text-xl active:scale-90 disabled:opacity-30 border
                ${sc==="M"?"bg-red-50 text-red-500 border-red-200":
                  sc===10?"bg-yellow-400 text-yellow-900 border-yellow-500":
                  sc>=8?"bg-red-50 text-red-600 border-red-200":
                  sc>=6?"bg-blue-50 text-blue-600 border-blue-200":
                  "bg-gray-50 text-gray-700 border-gray-200"}`}>{sc}</button>
          ))}
        </div>
        <Card className="p-4 flex items-center justify-between">
          <div className="text-center"><div className="text-gray-400 text-xs">本回</div><div className="text-gray-800 font-black text-3xl">{rt}</div></div>
          <div className="text-center"><div className="text-gray-400 text-xs">累計</div><div className="text-green-600 font-black text-3xl">{soFar()+rt}</div></div>
          <Btn v="success" className="py-3 px-5 text-base" onClick={submitRound} disabled={cur.length<form.arrowCount}>
            {round+1>=form.roundCount?"完成 ✓":"下一回 →"}
          </Btn>
        </Card>
        {cur.length>0&&(
          <button onClick={()=>setCur(p=>p.slice(0,-1))} className="text-gray-400 text-sm text-center">← 撤銷上一支</button>
        )}
      </div>
    );
  }

  // ── 結果畫面 ──
  if (adding && phase === "result") {
    const total = allR.flat().filter(s=>s!=="M").reduce((a,b)=>a+b,0);
    const miss  = allR.flat().filter(s=>s==="M").length;
    const arrows = form.arrowCount * form.roundCount;
    const avgArr = arrows>0 ? (total/arrows).toFixed(1) : 0;
    const maxP   = form.arrowCount * form.roundCount * form.maxScore;
    return (
      <div className="p-4 flex flex-col gap-4">
        <Card className="p-8 text-center bg-gradient-to-br from-green-500 to-green-700 border-0 text-white">
          <div className="text-5xl mb-2">🎯</div>
          <div className="text-green-200 text-sm mb-1">練習成績</div>
          <div className="font-black text-6xl">{total}</div>
          <div className="text-green-300 text-sm">/ {maxP} 分{miss>0?`　脫靶 ${miss} 支`:""}</div>
        </Card>
        <div className="grid grid-cols-3 gap-3">
          {[["總箭數",arrows,"text-gray-700"],
            ["均分/箭",avgArr,"text-blue-600"],
            ["均分/回",(form.roundCount>0?(total/form.roundCount).toFixed(1):0),"text-green-600"]].map(([k,v,c])=>(
            <div key={k} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <div className="text-gray-400 text-xs">{k}</div>
              <div className={`font-black text-2xl ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <Card className="p-4">
          <ST>各回成績</ST>
          {allR.map((r,i)=>(
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-500 text-sm w-12">第 {i+1} 回</span>
              <div className="flex gap-1 flex-1 flex-wrap">
                {r.map((sc,j)=>(<span key={j} className={`text-xs px-2 py-1 rounded font-bold ${sc==="M"?"bg-red-100 text-red-500":"bg-gray-100 text-gray-700"}`}>{sc}</span>))}
              </div>
              <span className="text-gray-800 font-black">{r.filter(sc=>sc!=="M").reduce((a,b)=>a+b,0)}</span>
            </div>
          ))}
        </Card>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-semibold">今日備註（選填）</label>
          <textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} rows={3}
            placeholder="今天的感受、需要改進的地方…"
            className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-green-500 resize-none"/>
        </div>
        <Btn v="success" className="w-full py-3 text-base" onClick={saveSession} disabled={saving}>
          {saving?"儲存中…":"儲存練習紀錄"}
        </Btn>
      </div>
    );
  }

  // ── 主畫面 ──
  const grouped = groupLogs();
  const years = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer/>
      <div className="flex justify-between items-center">
        <h2 className="text-gray-800 font-black text-xl">🎯 練習記分</h2>
        {!adding&&<Btn v="success" size="sm" onClick={()=>{setAdding(true);setPhase("setup");}}>+ 開始練習</Btn>}
      </div>

      {/* 總覽統計 */}
      {s&&!adding&&(
        <div className="grid grid-cols-2 gap-3">
          {[["練習場次",s.sessions,"text-blue-600"],
            ["最高分",s.best,"text-green-600"],
            ["平均分",s.avgScore,"text-orange-600"],
            ["累計箭數",s.totalArrows,"text-purple-600"]].map(([k,v,c])=>(
            <div key={k} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <div className="text-gray-400 text-xs">{k}</div>
              <div className={`font-black text-2xl ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* 練習設定表單 */}
      {adding&&phase==="setup"&&(
        <Card className="p-4 flex flex-col gap-3 border-green-200">
          <ST>練習設定</ST>
          <Inp label="日期" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
          <Sel label="弓種" value={form.bowType} onChange={e=>setForm(p=>({...p,bowType:e.target.value}))} options={BOW_OPTIONS}/>
          <Sel label="射程距離" value={form.distance} onChange={e=>setForm(p=>({...p,distance:Number(e.target.value)}))} options={DISTANCE_OPTIONS}/>
          <div className="grid grid-cols-3 gap-2">
            <Inp label="箭數/回" type="number" min="1" max="12" value={form.arrowCount} onChange={e=>setForm(p=>({...p,arrowCount:Number(e.target.value)}))}/>
            <Inp label="回合數" type="number" min="1" max="20" value={form.roundCount} onChange={e=>setForm(p=>({...p,roundCount:Number(e.target.value)}))}/>
            <Inp label="最高環數" type="number" min="1" max="10" value={form.maxScore} onChange={e=>setForm(p=>({...p,maxScore:Number(e.target.value)}))}/>
          </div>
          <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
            <input type="checkbox" checked={form.hasMiss} onChange={e=>setForm(p=>({...p,hasMiss:e.target.checked}))} className="accent-green-600"/>
            啟用 M（脫靶）計分
          </label>
          <div className="flex gap-2">
            <Btn v="secondary" className="flex-1" onClick={()=>setAdding(false)}>取消</Btn>
            <Btn v="success" className="flex-1" onClick={()=>{setPhase("scoring");setRound(0);setAllR([]);setCur([]);}}>開始計分 →</Btn>
          </div>
        </Card>
      )}

      {/* 練習紀錄（年 > 月 分類）*/}
      {!adding&&(
        <>
          <ST>練習紀錄</ST>
          {logs.length===0&&<Empty icon="🎯" message="尚無練習紀錄，開始你的第一次練習！"/>}

          {years.map(year => {
            const months = Object.keys(grouped[year]).sort((a,b)=>b.localeCompare(a));
            const yearSessions = months.reduce((a,ym)=>a+grouped[year][ym].length,0);
            return (
              <div key={year} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-800 font-black text-lg">{year}年</span>
                  <span className="text-gray-400 text-xs">共 {yearSessions} 場</span>
                  <div className="flex-1 h-px bg-gray-200"/>
                </div>

                {months.map(ym => {
                  const arr = grouped[year][ym];
                  const ms = monthStat(arr);
                  const monthNum = ym.slice(5,7);
                  const isOpen = openMonths[ym] !== false; // 預設展開
                  return (
                    <Card key={ym} className="p-0 overflow-hidden">
                      {/* 月份標頭（可折疊）*/}
                      <button onClick={()=>toggleMonth(ym)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-800 font-bold text-sm">{monthNum} 月</span>
                          <span className="text-gray-400 text-xs">{ms.sessions} 場</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">月均 <strong className="text-orange-600">{ms.avg}</strong></span>
                          <span className="text-xs text-gray-500">最高 <strong className="text-green-600">{ms.best}</strong></span>
                          <span className="text-gray-400 text-sm">{isOpen?"▲":"▼"}</span>
                        </div>
                      </button>

                      {/* 月統計列 */}
                      {isOpen && (
                        <div className="px-4 pb-2">
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="bg-blue-50 rounded-lg py-1.5 text-center">
                              <div className="text-gray-400 text-xs">場次</div>
                              <div className="text-blue-600 font-black">{ms.sessions}</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg py-1.5 text-center">
                              <div className="text-gray-400 text-xs">平均分</div>
                              <div className="text-orange-600 font-black">{ms.avg}</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg py-1.5 text-center">
                              <div className="text-gray-400 text-xs">箭數</div>
                              <div className="text-purple-600 font-black">{ms.totalArrows}</div>
                            </div>
                          </div>

                          {/* 該月各場 */}
                          {arr.map(log => (
                            <div key={log.id} className="border-t border-gray-100 py-3">
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <div className="text-gray-800 font-bold text-sm">📅 {log.date}　{log.distance}米</div>
                                  <div className="text-gray-400 text-xs mt-0.5">
                                    {bowLabel(log.bowType)}　{log.arrowCount}箭×{log.roundCount}回　{log.totalArrows} 支
                                  </div>
                                </div>
                                <div className="text-green-600 font-black text-2xl">{log.total}</div>
                              </div>
                              <div className="flex gap-3 text-xs text-gray-500 mb-1">
                                <span>均分/箭 <strong className="text-gray-700">{log.avgPerArrow}</strong></span>
                                <span>均分/回 <strong className="text-gray-700">{log.avgPerRound}</strong></span>
                                {log.miss>0&&<span className="text-red-400">脫靶 {log.miss} 支</span>}
                              </div>
                              {Array.isArray(log.rounds)&&(
                                <div className="flex gap-1 flex-wrap">
                                  {log.rounds.map((r,j)=>(
                                    <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                      回{j+1}:{Array.isArray(r)?r.filter(sc=>sc!=="M").reduce((a,b)=>a+b,0):0}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {log.note&&(
                                <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 italic">「{log.note}」</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}