// src/components/member/MemberScoring.jsx
import { useState } from "react";
import { submitResult, updateMember, getCertRecords, finalizePracticeShootingSession } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { getCertLevelByScores } from "../../lib/constants";
import { normCertBow } from "../../lib/certStatus";
import { normalizeEquipment, newEquipSet, BOW_CATEGORIES } from "../shared/Equipment";
import { Card, Btn } from "../shared/UI";
import MemberFeatureArt from "./MemberFeatureArt";

// 弓種 → 對照 certScores 的鍵 + 顯示名
const BOW_META = {
  recurve_full: { label: "競技反曲弓（全配）", cert: "recurve_bare" },
  recurve_bare: { label: "競技反曲弓",         cert: "recurve_bare" },
  compound:     { label: "美式獵弓",           cert: "compound" },
  traditional:  { label: "傳統弓",             cert: "traditional" },
};
// 現場租借選項
const RENTALS = [
  { value: "rental_recurve", label: "租借（反曲）", cert: "recurve_bare", icon: "🏹" },
  { value: "rental_compound",label: "租借（獵弓）", cert: "compound",     icon: "🦅" },
  { value: "rental_trad",    label: "租借（傳弓）", cert: "traditional",  icon: "🌿" },
];

// 現行深藍玻璃標準的共用樣式（檢定青色 accent）
const CERT_ACCENT = "#67e8f9";
const CERT_BAR = "from-cyan-300 to-teal-600";
const CERT_CARD_BG = "linear-gradient(145deg,#0e2a38,#101827 68%)";
const CERT_BORDER = "rgba(34,211,238,.28)";
const COMP_CARD_BG = "linear-gradient(145deg,#24180a,#101827 68%)";
const COMP_BORDER = "rgba(251,191,36,.25)";
const COMP_BAR = "from-amber-300 to-orange-600";

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
          .filter(r => r && normCertBow(r.bowType) === normCertBow(choice.cert) && String(r.year) === String(year) && (r.half || "first") === half)
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
    finalizePracticeShootingSession({
      sessionId:`competition_${comp.id}_${profile.id}_${Date.now()}`,
      memberId:profile.id,
      rounds:finalRounds,
      shootingProfile:{ bowType:choice?.cert || profile?.defaultBowType, distance:comp.distance },
      targetFormat:comp.targetFormat || "full_110",
      arrowsPerEnd:arrowCount,
      timingMode:comp.timingMode || "off",
      source:{ kind:isCert ? "certification" : "competition", mode:isCert ? "certification" : "competition" },
      verification:{ level:isCert ? "official" : "self" },
      countsToward:{ officialRecord:!!isCert },
    }).catch(() => {});
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
        }).then(async ()=>{
          finalizePracticeShootingSession({
            sessionId:`competition_${comp.id}_${profile.id}_${Date.now()}`,
            memberId:profile.id,
            rounds:newAll,
            shootingProfile:{ bowType:profile?.defaultBowType, distance:comp.distance },
            targetFormat:comp.targetFormat || "full_110",
            arrowsPerEnd:arrowCount,
            timingMode:comp.timingMode || "off",
            source:{ kind:"competition", mode:"competition" },
            verification:{ level:"self" },
          }).catch(() => {});
          setSaving(false); setPhase("result");
        });
      }
    } else setRound(r=>r+1);
  }

  // 共用：檢定/一般賽的卡片主題
  const th = isCert ? { bg:CERT_CARD_BG, bd:CERT_BORDER, bar:CERT_BAR, feat:"certexam", accent:CERT_ACCENT } : { bg:COMP_CARD_BG, bd:COMP_BORDER, bar:COMP_BAR, feat:"collection", accent:"#fbbf24" };

  // 共用：返回列
  function BackBtn({ to }) {
    return (
      <button onClick={to} className="self-start text-[13px] font-bold py-1" style={{ color:"var(--text-accent)" }}>← 返回</button>
    );
  }

  // ───────────── 確認頁（檢定限定）─────────────
  if(phase==="confirm"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <BackBtn to={onBack} />
        <Card className="relative isolate overflow-hidden p-4" style={{ background:th.bg, border:`1px solid ${th.bd}`, boxShadow:"0 14px 30px rgba(0,0,0,.28)" }}>
          <MemberFeatureArt name={th.feat} size={140} style={{ position:"absolute", right:-28, top:-30, opacity:.12, zIndex:-1 }} />
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${th.bar}`} />
          <div className="text-[10px] font-black tracking-widest mb-1" style={{ color:th.accent }}>年度檢定</div>
          <div className="text-[17px] font-black" style={{ color:"var(--text-primary)" }}>{comp.title}</div>
          <div style={{ fontSize:10.5, color:"var(--text-secondary)", fontWeight:700, marginTop:2 }}>
            考到越高級，三圍越強（ATK 加成上限 +40）
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl p-3" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid var(--glass-border)" }}>
              <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>射程</div>
              <div className="text-[14px] font-bold" style={{ color:"var(--text-primary)" }}>{comp.distance||"—"} 米</div>
            </div>
            <div className="rounded-xl p-3" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid var(--glass-border)" }}>
              <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>規格</div>
              <div className="text-[14px] font-bold" style={{ color:"var(--text-primary)" }}>{arrowCount}箭×{roundCount}回</div>
            </div>
          </div>
        </Card>

        {lastResult && (
          <Card className="p-4">
            <div className="text-[10px] font-bold mb-2" style={{ color:"var(--text-muted)" }}>上一次成績</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px]" style={{ color:"var(--text-primary)" }}>{lastResult.bowLabel||"—"}</div>
                {lastResult.certLevel && <div className="text-[12px] font-bold" style={{ color:"#fbbf24" }}>{lastResult.certLevel}</div>}
              </div>
              <div className="font-black text-2xl" style={{ color:th.accent }}>{lastResult.total}</div>
            </div>
          </Card>
        )}

        <button onClick={()=>setPhase("selectBow")}
          className="w-full py-4 text-white font-black text-lg rounded-xl active:scale-[.98] transition-transform"
          style={{ border:"none", cursor:"pointer", background:"linear-gradient(90deg,#67e8f9,#0891b2)", color:"#083344" }}>
          選擇裝備與檢定項目 →
        </button>
      </div>
    );
  }

  // ───────────── 選裝備頁（檢定限定）─────────────
  if(phase==="selectBow"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <BackBtn to={()=>setPhase("confirm")} />
        <Card className="relative isolate overflow-hidden p-4" style={{ background:th.bg, border:`1px solid ${th.bd}` }}>
          <MemberFeatureArt name={th.feat} size={120} style={{ position:"absolute", right:-24, top:-26, opacity:.12, zIndex:-1 }} />
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${th.bar}`} />
          <div className="text-[15px] font-black" style={{ color:"var(--text-primary)" }}>選擇本次檢定裝備</div>
          <div className="text-[11px] mt-1" style={{ color:"var(--text-secondary)" }}>系統會依弓種對應標準判定級別。</div>
        </Card>

        {/* 自備器材：帶入自建清單 */}
        <div>
          <div className="text-[10px] font-black tracking-widest mb-2" style={{ color:"var(--text-muted)" }}>自備器材</div>
          {myEquip.length === 0 ? (
            <div className="text-[12px] rounded-xl p-3 mb-2" style={{ color:"var(--text-secondary)", background:"rgba(255,255,255,0.04)", border:"1px solid var(--glass-border)" }}>
              尚未建立裝備，可用下方「新建裝備」或選擇租借。
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 mb-2">
              {myEquip.map(set => {
                const meta = BOW_META[set.bowCategory] || BOW_META.recurve_bare;
                return (
                  <button key={set.id}
                    onClick={()=>pickChoice({ label: `${meta.label} - ${set.label||"未命名"}`, cert: meta.cert, rental: false, equipId: set.id })}
                    className="text-left rounded-xl p-3 transition-all active:scale-[.98]"
                    style={{ background:"rgba(255,255,255,0.05)", border:`1px solid var(--glass-border)` }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=CERT_ACCENT; e.currentTarget.style.background="rgba(34,211,238,0.10)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--glass-border)"; e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}>
                    <span className="text-[13px] font-bold" style={{ color:"var(--text-primary)" }}>{meta.label} - {set.label||"未命名"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 新建裝備 */}
          {newBow ? (
            <div className="rounded-xl p-3 flex flex-col gap-2" style={{ border:`2px dashed ${CERT_ACCENT}55`, background:"rgba(34,211,238,0.04)" }}>
              <div className="grid grid-cols-2 gap-2">
                {BOW_CATEGORIES.map(c=>(
                  <button key={c.value} onClick={()=>setNewBow(p=>({...p,bowCategory:c.value}))}
                    className={`text-xs rounded-lg border p-2 transition-all ${newBow.bowCategory===c.value?"text-cyan-950":"text-gray-200"}`}
                    style={newBow.bowCategory===c.value ? { background:"linear-gradient(90deg,#67e8f9,#22d3ee)", border:"1px solid #22d3ee" } : { background:"rgba(255,255,255,0.05)", border:"1px solid var(--glass-border)" }}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <input value={newBow.label} onChange={e=>setNewBow(p=>({...p,label:e.target.value}))}
                placeholder="裝備名稱（例如：大啊耿）"
                className="ui-input px-3 py-2 text-sm"/>
              <div className="flex gap-2">
                <button onClick={()=>setNewBow(null)} className="flex-1 text-[12px] py-2" style={{ color:"var(--text-muted)" }}>取消</button>
                <button onClick={createAndPick} disabled={!newBow.bowCategory||!newBow.label}
                  className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-40"
                  style={{ background:"linear-gradient(90deg,#67e8f9,#0891b2)", color:"#083344", border:"none", cursor:"pointer" }}>建立並使用</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setNewBow({bowCategory:"recurve_bare",label:""})}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ border:`2px dashed ${CERT_ACCENT}55`, color:CERT_ACCENT, background:"transparent", cursor:"pointer" }}>
              + 新建裝備
            </button>
          )}
        </div>

        {/* 現場租借 */}
        <div>
          <div className="text-[10px] font-black tracking-widest mb-2" style={{ color:"var(--text-muted)" }}>現場租借</div>
          <div className="grid grid-cols-3 gap-2">
            {RENTALS.map(r=>(
              <button key={r.value} onClick={()=>pickChoice({ label: r.label, cert: r.cert, rental: true })}
                className="rounded-xl p-3 transition-all active:scale-[.96]"
                style={{ background:"rgba(8,145,178,0.12)", border:"1px solid rgba(34,211,238,0.35)", cursor:"pointer" }}>
                <div className="text-xl">{r.icon}</div>
                <div className="text-[12px] font-bold mt-1" style={{ color:"var(--text-primary)" }}>{r.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color:CERT_ACCENT }}>場地器材</div>
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
        <Card className="relative isolate overflow-hidden p-8 text-center" style={{ background:"linear-gradient(145deg,#0e2a38,#101827)", border:`1px solid ${CERT_BORDER}`, boxShadow:"0 14px 30px rgba(0,0,0,.28)" }}>
          <MemberFeatureArt name="certexam" size={170} style={{ position:"absolute", left:-30, bottom:-34, opacity:.12, zIndex:-1 }} />
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-300 to-teal-600" />
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-[13px] mb-1" style={{ color:"#a5f3fc" }}>第一輪成績</div>
          <div className="font-black text-6xl" style={{ color:"#fff" }}>{roundOneScore}</div>
          <div className="mt-2 inline-block text-[11px] font-black px-3 py-1 rounded-full" style={{ color:"#083344", background:"linear-gradient(90deg,#67e8f9,#22d3ee)" }}>
            已送審資格鎖定
          </div>
        </Card>
        <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.3)", color:"var(--warn-fg)" }}>
          可選擇再挑戰第二輪，系統會自動取兩輪中的最高分送審核。
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
        <Card className="relative isolate overflow-hidden p-8 text-center" style={{ background:"linear-gradient(145deg,#1e1b4b,#101827 68%)", border:"1px solid rgba(129,140,248,.3)", boxShadow:"0 14px 30px rgba(0,0,0,.28)" }}>
          <MemberFeatureArt name="certexam" size={170} style={{ position:"absolute", left:-30, bottom:-34, opacity:.12, zIndex:-1 }} />
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-300 to-violet-600" />
          <div className="text-5xl mb-2">📊</div>
          <div className="text-[13px] mb-1" style={{ color:"#c7d2fe" }}>本次成績</div>
          <div className="font-black text-6xl" style={{ color:"#fff" }}>{finalScore}</div>
          <div className="inline-block mt-3 bg-white/20 text-white font-bold text-sm px-4 py-1 rounded-full">
            沒有比之前高
          </div>
        </Card>
        <div className="rounded-xl p-3 text-xs text-center leading-relaxed" style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.3)", color:"var(--warn-fg)" }}>
          你目前的最佳紀錄是 <span className="font-black">{prevBest}</span> 分，本次 {finalScore} 分未超過，成績不會送審。可以再挑戰一次刷新紀錄！
        </div>
        <Btn v="primary" className="w-full py-3 text-base" onClick={onDone}>返回</Btn>
      </div>
    );
  }

  if(phase==="result"){
    return (
      <div className="p-4 flex flex-col gap-4">
        <Card className="relative isolate overflow-hidden p-8 text-center" style={{ background: isCert ? "linear-gradient(145deg,#0e2a38,#101827)" : "linear-gradient(145deg,#24180a,#101827 68%)", border:`1px solid ${th.bd}`, boxShadow:"0 14px 30px rgba(0,0,0,.28)" }}>
          <MemberFeatureArt name={th.feat} size={170} style={{ position:"absolute", left:-30, bottom:-34, opacity:.12, zIndex:-1 }} />
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${th.bar}`} />
          <div className="text-5xl mb-2">{isCert?"📋":"🎯"}</div>
          <div className="text-[13px] mb-1" style={{ color:th.accent }}>{isCert?"已送出，等待教練審核":"本次成績"}</div>
          <div className="font-black text-6xl" style={{ color:"#fff" }}>{finalScore}</div>
          {isCert && (
            <div className="inline-block mt-3 bg-white/20 text-white font-bold text-sm px-4 py-1 rounded-full">
              ⏳ 審核中
            </div>
          )}
        </Card>
        {isCert && (
          <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.3)", color:"var(--warn-fg)" }}>
            教練審核通過後，才會正式認可級別。審核完成前無法再次參加；若不通過則可重新挑戰。
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
      <BackBtn to={isCert ? ()=>setPhase("selectBow") : onBack} />
      <Card className="relative isolate overflow-hidden p-4" style={{ background:th.bg, border:`1px solid ${th.bd}`, boxShadow:"0 14px 30px rgba(0,0,0,.28)" }}>
        <MemberFeatureArt name={th.feat} size={110} style={{ position:"absolute", right:-22, top:-24, opacity:.12, zIndex:-1 }} />
        <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${th.bar}`} />
        <div className="text-[11px] mb-1" style={{ color:"var(--text-secondary)" }}>
          {comp.title}{isCert && choice ? `　·　${choice.label}` : ""}{isCert ? `　·　第 ${whichRound} 輪` : ""}
        </div>
        <div className="text-[22px] font-black" style={{ color:"var(--text-primary)" }}>
          第 {round+1} 回 <span className="text-base font-medium ml-2" style={{ color:"var(--text-muted)" }}>/ {roundCount}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full" style={{ background:"rgba(255,255,255,0.10)" }}>
          <div className="h-1.5 rounded-full" style={{ width:`${(round/roundCount)*100}%`, background:"linear-gradient(90deg,#67e8f9,#22d3ee)" }} />
        </div>
      </Card>
      {comp.target&&<img src={comp.target} alt="靶紙" className="w-full rounded-2xl max-h-44 object-contain" style={{ background:"rgba(255,255,255,0.06)" }}/>}
      <div className="flex gap-2">{Array.from({length:arrowCount}).map((_,i)=><div key={i} className={`flex-1 h-12 rounded-xl flex items-center justify-center font-black text-lg border-2 ${i<cur.length?"text-white":"text-gray-500"}`} style={i<cur.length?{ background:"linear-gradient(135deg,#0891b2,#0e7490)", borderColor:"#22d3ee" }:{ borderColor:"var(--glass-border)" }}>{i<cur.length?(cur[i]==="M"?"✗":cur[i]):"—"}</div>)}</div>
      <div className="grid grid-cols-4 gap-2">{btns.map(s=><button key={s} onClick={()=>addArrow(s)} disabled={cur.length>=arrowCount} className={`py-3 rounded-xl font-black text-xl active:scale-90 disabled:opacity-30 border transition-all ${s==="M"?"text-red-400":s===10?"text-yellow-900":s>=8?"text-red-400":s>=6?"text-cyan-300":"text-gray-200"}`} style={s==="M"?{ background:"rgba(239,68,68,0.10)", borderColor:"rgba(239,68,68,0.3)" }:s===10?{ background:"linear-gradient(135deg,#fbbf24,#f59e0b)", borderColor:"#f59e0b" }:s>=8?{ background:"rgba(239,68,68,0.10)", borderColor:"rgba(239,68,68,0.3)" }:s>=6?{ background:"rgba(34,211,238,0.10)", borderColor:"rgba(34,211,238,0.3)" }:{ background:"rgba(255,255,255,0.10)", borderColor:"var(--glass-border)" }}>{s}</button>)}</div>
      <Card className="p-4 flex items-center justify-between">
        <div className="text-center"><div className="text-[11px]" style={{ color:"var(--text-muted)" }}>本回</div><div className="font-black text-3xl" style={{ color:"var(--text-primary)" }}>{rt}</div></div>
        <div className="text-center"><div className="text-[11px]" style={{ color:"var(--text-muted)" }}>累計</div><div className="font-black text-3xl" style={{ color:th.accent }}>{soFar()+rt}</div></div>
        <Btn v="primary" className="py-3 px-5 text-base" onClick={submitRoundBtn} disabled={cur.length<arrowCount||saving}>{saving?"儲存中…":round+1>=roundCount?"完成 ✓":"下一回 →"}</Btn>
      </Card>
      {cur.length>0&&<button onClick={()=>setCur(p=>p.slice(0,-1))} className="text-sm text-center" style={{ color:"var(--text-muted)" }}>← 撤銷上一支</button>}
    </div>
  );
}
