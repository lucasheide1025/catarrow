import { useEffect, useState } from "react";
import { describeDungeonBossChoice } from "../../lib/dungeonBossChoiceSummary";

export default function DungeonBossRewardRoom({ claimId, envelope, memberId, onComplete }) {
  const [selected,setSelected]=useState([]);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [revealed,setRevealed]=useState(()=>envelope?.revealedRewards?.length?envelope.revealedRewards:null);
  const needed=envelope?.choiceCount||1;
  useEffect(()=>{if(envelope?.revealedRewards?.length)setRevealed(envelope.revealedRewards);},[envelope]);

  function toggle(id){
    if(submitting||revealed)return;
    setSelected(current=>current.includes(id)?current.filter(value=>value!==id):current.length>=needed?(needed===1?[id]:current):[...current,id]);
  }
  async function submit(){
    if(submitting||selected.length!==needed)return;
    setSubmitting(true);setError("");
    try{
      const {claimDungeonBossChoices}=await import("../../lib/dungeonBossRewardDb");
      const result=await claimDungeonBossChoices({claimId,memberId,selectedOptionIds:selected});
      setRevealed(result.revealedRewards||[]);
    }catch(reason){setError(reason?.message||"獎勵領取失敗，請稍後重試");setSubmitting(false);}
  }
  const fixed=envelope.fixedReward;
  if(revealed)return <main className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-lg rounded-3xl border border-amber-400/30 bg-slate-900 p-6"><h1 className="text-2xl font-black text-amber-200">獎勵揭曉</h1><div className="mt-5 grid gap-3">{revealed.map((reward,index)=><div key={`${reward.type}-${index}`} className="rounded-2xl bg-white/5 p-4 font-bold">{describeDungeonBossChoice(reward)}</div>)}</div><button type="button" onClick={onComplete} className="mt-6 min-h-12 w-full rounded-2xl bg-amber-300 font-black text-slate-950">繼續探索</button></div></main>;
  return <main className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-2xl"><header className="mb-5 rounded-3xl border border-amber-400/30 bg-slate-900 p-5"><div className="text-xs font-black tracking-[.2em] text-amber-300">BOSS REWARD</div><h1 className="mt-2 text-2xl font-black">王房獎勵</h1><p className="mt-2 text-sm text-slate-300">六張牌位置已鎖定，請選 {needed} 張後揭曉。</p><div className="mt-4 text-sm text-slate-300">固定獎勵：金幣 {fixed.coins.toLocaleString()}・王印 {fixed.bossMarks}・符文碎片 {fixed.runeFragment.count}</div></header><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{envelope.choiceOptions.map((option,index)=>{const active=selected.includes(option.id);return <button key={option.id} type="button" aria-pressed={active} aria-label={`選擇獎勵牌 ${index+1}`} onClick={()=>toggle(option.id)} className={`min-h-36 rounded-2xl border p-4 ${active?"border-amber-300 bg-amber-400/15":"border-white/10 bg-white/5"}`}><span className="block text-5xl">{active?"✅":"🎴"}</span><span className="mt-3 block font-black">獎勵牌 {index+1}</span></button>})}</div>{error?<div role="alert" className="mt-4 text-rose-300">{error}</div>:null}<button type="button" onClick={submit} disabled={submitting||selected.length!==needed} className="mt-5 min-h-12 w-full rounded-2xl bg-amber-300 font-black text-slate-950 disabled:opacity-40">{submitting?"領取中…":`揭曉 ${needed} 張獎勵`}</button></div></main>;
}
