// src/components/member/MemberScoring.jsx
import { useState } from "react";
import { submitResult, updateMember, getCertRecords } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { getCertLevelByScores } from "../../lib/constants";
import { normalizeEquipment, newEquipSet, BOW_CATEGORIES } from "../shared/Equipment";
import { Card, Btn } from "../shared/UI";

// 弓種 → 對照 certScores 的鍵 + 顯示名
const BOW_META = {
  recurve_full: { label: "競技反曲弓（全配）", cert: "recurve_bare" },
  recurve_bare: { label: "競技反曲弓",         cert: "recurve_bare" },
  compound:     { label: "美式獵弓",           cert: "compound" },
  traditional:  { label: "傳統弓",             cert: "traditional" },
};
// 全配/裸弓合為同一檢定分類，兼容舊 recurve_full certRecords
const RECURVE_NORM = k => (k === "recurve_full" || k === "recurve_bare") ? "recurve_bare" : k;

// 現場租借選項
const RENTALS = [
  { value: "rental_recurve", label: "租借（反曲）", cert: "recurve_bare" },
  { value: "rental_compound",label: "租借（獵弓）", cert: "compound" },
  { value: "rental_trad",    label: "租借（傳弓）", cert: "traditional" },
];

export default function MemberScoring({ comp, onDone, onBack, lastResult }) {
  const { profile } = useAuth();
  const isCert = comp.type === "年度檢定";

  // 檢定：confirm → selectBow → scoring → roundDone → result
  // 一般賽：直接 scoring
  const [phase, setPhase] = useState(isCert ? "confirm" : "scoring");
  const [choice, setChoice] = useState(null);   // {label, cert, rental, equipId?}

  // 計分狀態
  const [round, setRound] = useState(0);
  const [allR, setAllR]   = useState([]);
  const [cur, setCur]     = useState([]);
  const [saving, setSaving] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [prevBest, setPrevBest] = useState(0);

  // 兩輪：保存每輪總分
  const [roundOneScore, setRoundOneScore] = useState(null);   // 第一輪總分
  const [roundOneData, setRoundOneData]   = useState(null);   // 第一輪明細
  const [whichRound, setWhichRound]       = useState(1);      // 目前打第幾輪

  // 新建裝備暫存
  const [newBow, setNewBow] = useState(null);   // {bowCategory, label}

  const maxScore = comp.maxScore || 10;
  const arrowCount = comp.arrowCount || 6;
  const roundCount = comp.roundCount || 5;
  const btns = [...Array.from({length: maxScore+1}, (_,i)=>i), ...(comp.hasMiss?["M"]:[])];

  const myEquip = normalizeEquipment(profile?.equipment);

  function addArrow(s){ if(cur.length<arrowCount) setCur(p=>[...p,s]); }
  function soFar(){ return allR.flat().filter(s=>s!=="M").reduce((a,b)=>a+b,0); }

  // 選定裝備 → 開始計分
  function pickChoice(c){
    setChoice(c);
    setPhase("scoring"); setRound(0); setAllR([]); setCur([]);
    setWhichRound(1); setRoundOneScore(null); setRoundOneData(null);
  }

  // 新建一組裝備並選用
  async function createAndPick(){
    if(!newBow?.bowCategory || !newBow?.label) return;
    const set = newEquipSet(newBow.bowCategory);
    set.label = newBow.label;
    if(myEquip.length === 0) set.isDefault = true;
    const next = [...myEquip, set];
    await updateMember(profile.id, { equipment: next }, profile.id);
    setNewBow(null);
    pickChoice({ label: `${BOW_META[newBow.bowCategory].label} - ${newBow.label}`, cert: BOW_META[newBow.bowCategory].cert, rental: false, equipId: set.id });
  }

  function startSecondRound(){
    setWhichRound(2);
    setPhase("scoring"); setRound(0); setAllR([]); setCur([]);
  }

  // 送出（送審）
  async function submitFinal(finalTotal, finalRounds){
    setSaving(true);
    setFinalScore(finalTotal);
    const certLevel = isCert && choice ? getCertLevelByScores(choice.cert, finalTotal, comp.certScores) : null;

    // 檢定：送審前先比對自己該期該弓種的現有紀錄。有紀錄且沒比較高 → 不送審，顯示「沒比之前高」
    if (isCert && choice) {
      const year = comp.year || new Date(comp.date).getFullYear();
      const half = comp.half || "first";
      try {
        const recs = await getCertRecords(profile.id);
        const bestScore = (Array.isArray(recs) ? recs : [])
          .filter(r => r && RECURVE_NORM(r.bowType) === RECURVE_NORM(choice.cert) && String(r.year) === String(year) && (r.half || "first") === half)
          .reduce((best, r) => Math.max(best, Number(r.score || 0)), -1);
        if (bestScore >= 0 && Number(finalTotal) <= bestScore) {
          setPrevBest(bestScore);
          setSaving(false);
          setPhase("notHigher");
          return;
        }
      } catch (e) {
        console.warn("讀取檢定紀錄失敗，仍照常送審：", e?.message);
      }
    }

    const payload = {
      memberId: profile.id, name: profile.name, nickname: profile.nickname,
      compTitle: comp.title, compType: comp.type, date: comp.date,
      rounds: finalRounds, total: finalTotal, miss: 0,
    };
    if(isCert && choice){
      payload.isCert      = true;
      payload.certBowType = choice.cert;
      payload.bowLabel    = choice.label;
      payload.isRental    = !!choice.rental;
      payload.certLevel   = certLevel || "未達標";
      payload.certYear    = comp.year || new Date(comp.date).getFullYear();
      payload.certHalf    = comp.half || "first";
      payload.reviewStatus= "pending";   // 送審，鎖住
    }
    await submitResult(comp.id, profile.id, payload);
    setSaving(false);
    setPhase("result");
  }

  function submitRoundBtn(){
    const newAll=[...allR,cur]; setAllR(newAll); setCur([]);
    if(newAll.length>=roundCount){
      // 這輪打完
      if(isCert){
        // 用 setTimeout 確保 allR 已更新後再結算
        setTimeout(()=>{
          const total = newAll.flat().filter(s=>s!=="M").reduce((a,b)=>a+b,0);
          if(whichRound===1){ setRoundOneScore(total); setRoundOneData(newAll); setPhase("roundDone"); }
          else { submitFinal(Math.max(roundOneScore,total), total>=roundOneScore?newAll:roundOneData); }
        },0);
      } else {
        // 一般賽：直接送出
        const total=newAll.flat().filter(s=>s!=="M").reduce((a,b)=>a+b,0);
        const miss=newAll.flat().filter(s=>s==="M").length;
        setFinalScore(total);
        setSaving(true);
        submitResult(comp.id, profile.id, {
          memberId: profile.id, name: profile.name, nickname: profile.nickname,
          compTitle: comp.title, compType: comp.type, date: comp.date,
          rounds:newAll, total, miss,
        }).then(()=>{ setSaving(false); setPhase("result"); });
      }
    } else setRound(r=>r+1);
  }

  // ───────────── 確認頁（檢定限定）─────────────
  if(phase==="confirm"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <button onClick={onBack} className="text-gray-400 text-sm text-left py-1">← 返回</button>
        <Card className="p-5">
          <div className="text-gray-400 text-xs mb-1">年度檢定</div>
          <div className="text-gray-100 font-black text-lg mb-3">{comp.title}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-xl p-3"><div className="text-gray-400 text-xs">射程</div><div className="text-gray-200 font-bold text-sm">{comp.distance||"—"} 米</div></div>
            <div className="bg-white/5 rounded-xl p-3"><div className="text-gray-400 text-xs">規格</div><div className="text-gray-200 font-bold text-sm">{arrowCount}箭×{roundCount}回</div></div>
          </div>
        </Card>

        {lastResult && (
          <Card className="p-4">
            <div className="text-gray-400 text-xs font-bold mb-2">上一次成績</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-200 text-sm">{lastResult.bowLabel||"—"}</div>
                {lastResult.certLevel && <div className="text-amber-400 text-xs font-bold">{lastResult.certLevel}</div>}
              </div>
              <div className="text-blue-400 font-black text-2xl">{lastResult.total}</div>
            </div>
          </Card>
        )}

        <button onClick={()=>setPhase("selectBow")}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl">
          選擇裝備與檢定項目 →
        </button>
      </div>
    );
  }

  // ───────────── 選裝備頁（檢定限定）─────────────
  if(phase==="selectBow"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <button onClick={()=>setPhase("confirm")} className="text-gray-400 text-sm text-left py-1">← 返回</button>
        <Card className="p-4">
          <div className="text-gray-100 font-black text-base">選擇本次檢定裝備</div>
          <div className="text-gray-400 text-xs mt-1">系統會依弓種對應標準判定級別。</div>
        </Card>

        {/* 自備器材：帶入自建清單 */}
        <div>
          <div className="text-gray-400 text-xs font-bold mb-2">自備器材</div>
          {myEquip.length === 0 ? (
            <div className="text-gray-400 text-xs bg-white/5 rounded-xl p-3 mb-2">尚未建立裝備,可用下方「新建裝備」或選擇租借。</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 mb-2">
              {myEquip.map(set => {
                const meta = BOW_META[set.bowCategory] || BOW_META.recurve_bare;
                return (
                  <button key={set.id}
                    onClick={()=>pickChoice({ label: `${meta.label} - ${set.label||"未命名"}`, cert: meta.cert, rental: false, equipId: set.id })}
                    className="text-left rounded-xl border border-white/15 bg-white/5 p-3 hover:border-blue-400 hover:bg-blue-500/10 transition-all">
                    <div className="text-gray-200 text-sm font-bold">{meta.label} - {set.label||"未命名"}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 新建裝備 */}
          {newBow ? (
            <div className="border-2 border-dashed border-blue-400/30 rounded-xl p-3 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {BOW_CATEGORIES.map(c=>(
                  <button key={c.value} onClick={()=>setNewBow(p=>({...p,bowCategory:c.value}))}
                    className={`text-xs rounded-lg border p-2 ${newBow.bowCategory===c.value?"bg-blue-600 text-white border-blue-600":"bg-white/5 border-white/15 text-gray-300"}`}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <input value={newBow.label} onChange={e=>setNewBow(p=>({...p,label:e.target.value}))}
                placeholder="裝備名稱（例如：大啊耿）"
                className="ui-input px-3 py-2 text-sm"/>
              <div className="flex gap-2">
                <button onClick={()=>setNewBow(null)} className="flex-1 text-gray-400 text-xs py-2">取消</button>
                <button onClick={createAndPick} disabled={!newBow.bowCategory||!newBow.label}
                  className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-lg disabled:opacity-40">建立並使用</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setNewBow({bowCategory:"recurve_bare",label:""})}
              className="w-full py-2.5 border-2 border-dashed border-blue-400/30 rounded-xl text-blue-400 text-sm font-bold hover:bg-blue-500/10">
              + 新建裝備
            </button>
          )}
        </div>

        {/* 現場租借 */}
        <div>
          <div className="text-gray-400 text-xs font-bold mb-2">現場租借</div>
          <div className="grid grid-cols-3 gap-2">
            {RENTALS.map(r=>(
              <button key={r.value} onClick={()=>pickChoice({ label: r.label, cert: r.cert, rental: true })}
                className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3 hover:border-orange-400 transition-all">
                <div className="text-gray-200 text-xs font-bold">{r.label}</div>
                <div className="text-orange-400 text-xs mt-0.5">場地器材</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ───────────── 第一輪結束（檢定限定）─────────────
  if(phase==="roundDone"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <Card className="p-8 text-center bg-gradient-to-br from-blue-600 to-blue-800 border-0 text-white">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-blue-200 text-sm mb-1">第一輪成績</div>
          <div className="font-black text-6xl">{roundOneScore}</div>
        </Card>
        <div className="rounded-xl p-3 text-xs" style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.3)", color:"var(--warn-fg)" }}>
          可選擇再挑戰第二輪,系統會自動取兩輪中的最高分送審核。
        </div>
        <Btn v="primary" className="w-full py-3 text-base" onClick={startSecondRound}>繼續挑戰第二輪</Btn>
        <Btn v="secondary" className="w-full py-3 text-base"
          onClick={()=>submitFinal(roundOneScore, roundOneData)} disabled={saving}>
          {saving?"送出中…":"結束這次測驗"}
        </Btn>
      </div>
    );
  }

  // ───────────── 送審完成 ─────────────
  // ───────────── 沒有比之前高（檢定刷分失敗）─────────────
  if(phase==="notHigher"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <Card className="p-8 text-center bg-gradient-to-br from-gray-500 to-gray-700 border-0 text-white">
          <div className="text-5xl mb-2">📊</div>
          <div className="text-gray-200 text-sm mb-1">本次成績</div>
          <div className="font-black text-6xl">{finalScore}</div>
          <div className="inline-block mt-3 bg-white/20 text-white font-bold text-sm px-4 py-1 rounded-full">
            沒有比之前高
          </div>
        </Card>
        <div className="rounded-xl p-3 text-xs text-center" style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.3)", color:"var(--warn-fg)" }}>
          你目前的最佳紀錄是 <span className="font-black">{prevBest}</span> 分，本次 {finalScore} 分未超過，成績不會送審。可以再挑戰一次刷新紀錄！
        </div>
        <Btn v="primary" className="w-full py-3 text-base" onClick={onDone}>返回</Btn>
      </div>
    );
  }

  if(phase==="result"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <Card className="p-8 text-center bg-gradient-to-br from-blue-600 to-blue-800 border-0 text-white">
          <div className="text-5xl mb-2">{isCert?"📋":"🎯"}</div>
          <div className="text-blue-200 text-sm mb-1">{isCert?"已送出,等待教練審核":"本次成績"}</div>
          <div className="font-black text-6xl">{finalScore}</div>
          {isCert && (
            <div className="inline-block mt-3 bg-white/20 text-white font-bold text-sm px-4 py-1 rounded-full">
              ⏳ 審核中
            </div>
          )}
        </Card>
        {isCert && (
          <div className="rounded-xl p-3 text-xs" style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.3)", color:"var(--warn-fg)" }}>
            教練審核通過後,才會正式認可級別。審核完成前無法再次參加;若不通過則可重新挑戰。
          </div>
        )}
        <Btn v="primary" className="w-full py-3 text-base" onClick={onDone}>返回</Btn>
      </div>
    );
  }

  // ───────────── 計分畫面 ─────────────
  const rt=cur.filter(s=>s!=="M").reduce((a,b)=>a+b,0);
  return(
    <div className="p-4 flex flex-col gap-4">
      <button onClick={isCert ? ()=>setPhase("selectBow") : onBack} className="text-gray-400 text-sm text-left py-1">← 返回</button>
      <Card className="p-4">
        <div className="text-gray-400 text-xs mb-1">
          {comp.title}{isCert && choice ? `　·　${choice.label}` : ""}{isCert ? `　·　第 ${whichRound} 輪` : ""}
        </div>
        <div className="text-gray-100 font-black text-2xl">第 {round+1} 回 <span className="text-gray-500 font-medium text-base ml-2">/ {roundCount}</span></div>
        <div className="mt-2 bg-white/10 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width:`${(round/roundCount)*100}%`}}/></div>
      </Card>
      {comp.target&&<img src={comp.target} alt="靶紙" className="w-full rounded-2xl max-h-44 object-contain bg-white/10"/>}
      <div className="flex gap-2">{Array.from({length:arrowCount}).map((_,i)=><div key={i} className={`flex-1 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 ${i<cur.length?"bg-blue-600 border-blue-600 text-white":"border-white/15 text-gray-500"}`}>{i<cur.length?(cur[i]==="M"?"✗":cur[i]):"—"}</div>)}</div>
      <div className="grid grid-cols-4 gap-2">{btns.map(s=><button key={s} onClick={()=>addArrow(s)} disabled={cur.length>=arrowCount} className={`py-3 rounded-xl font-black text-xl active:scale-90 disabled:opacity-30 border ${s==="M"?"bg-red-500/10 text-red-400 border-red-400/30":s===10?"bg-yellow-400 text-yellow-900 border-yellow-500":s>=8?"bg-red-500/10 text-red-400 border-red-400/30":s>=6?"bg-blue-500/10 text-blue-400 border-blue-400/30":"bg-white/10 text-gray-200 border-white/15"}`}>{s}</button>)}</div>
      <Card className="p-4 flex items-center justify-between">
        <div className="text-center"><div className="text-gray-400 text-xs">本回</div><div className="text-gray-100 font-black text-3xl">{rt}</div></div>
        <div className="text-center"><div className="text-gray-400 text-xs">累計</div><div className="text-blue-400 font-black text-3xl">{soFar()+rt}</div></div>
        <Btn v="primary" className="py-3 px-5 text-base" onClick={submitRoundBtn} disabled={cur.length<arrowCount||saving}>{saving?"儲存中…":round+1>=roundCount?"完成 ✓":"下一回 →"}</Btn>
      </Card>
      {cur.length>0&&<button onClick={()=>setCur(p=>p.slice(0,-1))} className="text-gray-400 text-sm text-center">← 撤銷上一支</button>}
    </div>
  );
}
