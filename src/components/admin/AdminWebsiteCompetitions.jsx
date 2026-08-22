import { useEffect, useMemo, useState } from "react";
import { deleteWebsiteCompetitionResult, getWebsiteCompetitionResults, saveWebsiteCompetitionResult } from "../../lib/db";
import { uploadWebsiteImage } from "../../lib/websiteCms";
import { publishCompetitionWebsite } from "../../lib/websitePublish";

const emptyParticipant = () => ({ publicDisplayName:"", linkedMemberId:"", bowType:"", category:"", score:"", rank:"", award:"", resultNote:"" });
const emptyEvent = () => ({ id:"", status:"draft", slug:"", title:"", eventDate:"", endDate:"", location:"", organizer:"", eventType:"", summary:"", story:"", coverImageUrl:"", galleryImageUrls:[], tags:[], featured:false, participants:[] });
const cleanSlug = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g,"-").replace(/^-+|-+$/g,"").replace(/-{2,}/g,"-");
const tsText = value => value?.toDate?.().toISOString?.() || (typeof value === "string" ? value : "");

function publicEvent(row) {
  return {
    slug: cleanSlug(row.slug || row.title), title:String(row.title||"").trim(), eventDate:String(row.eventDate||"").trim(), endDate:String(row.endDate||"").trim(),
    location:String(row.location||"").trim(), organizer:String(row.organizer||"").trim(), eventType:String(row.eventType||"").trim(), summary:String(row.summary||"").trim(), story:String(row.story||"").trim(),
    coverImageUrl:String(row.coverImageUrl||"").trim(), galleryImageUrls:(row.galleryImageUrls||[]).map(String).map(s=>s.trim()).filter(Boolean), tags:(row.tags||[]).map(String).map(s=>s.trim()).filter(Boolean),
    featured:row.featured===true, status:row.status === "published" ? "published" : "draft", publishedAt:tsText(row.publishedAt), updatedAt:tsText(row.updatedAt),
    participants:(row.participants||[]).map(p=>({ publicDisplayName:String(p.publicDisplayName||"").trim(), bowType:String(p.bowType||"").trim(), category:String(p.category||"").trim(), score:String(p.score||"").trim(), rank:String(p.rank||"").trim(), award:String(p.award||"").trim(), resultNote:String(p.resultNote||"").trim() })).filter(p=>p.publicDisplayName||p.rank||p.award||p.resultNote),
  };
}

export default function AdminWebsiteCompetitions() {
  const [rows,setRows]=useState([]); const [form,setForm]=useState(emptyEvent); const [busy,setBusy]=useState(false); const [publishing,setPublishing]=useState(false); const [notice,setNotice]=useState("");
  const publishedCount=useMemo(()=>rows.filter(r=>r.status==="published").length,[rows]);
  const load=async()=>{ setBusy(true); try{setRows(await getWebsiteCompetitionResults());}catch(e){setNotice(`讀取失敗：${e.message}`);}finally{setBusy(false);} };
  useEffect(()=>{load();},[]);
  const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
  const edit=row=>setForm({...emptyEvent(),...row,galleryImageUrls:Array.isArray(row.galleryImageUrls)?row.galleryImageUrls:[],tags:Array.isArray(row.tags)?row.tags:[],participants:Array.isArray(row.participants)?row.participants:[]});
  const save=async()=>{
    const slug=cleanSlug(form.slug||form.title); if(!form.title.trim()||!form.eventDate||!slug){setNotice("請至少填寫比賽名稱、日期與 slug。");return;}
    setBusy(true); setNotice(""); try{const id=await saveWebsiteCompetitionResult({...form,slug}); setNotice(`已儲存${form.status==="published"?"（標記為公開）":"草稿"}。`); await load(); setForm(f=>({...f,id}));}catch(e){setNotice(`儲存失敗：${e.message}`);}finally{setBusy(false);}
  };
  const remove=async row=>{if(!window.confirm(`刪除「${row.title}」？`))return; setBusy(true);try{await deleteWebsiteCompetitionResult(row.id);setForm(emptyEvent());await load();setNotice("已刪除賽事紀錄。");}catch(e){setNotice(`刪除失敗：${e.message}`);}finally{setBusy(false);}};
  const updateParticipant=(index,key,value)=>patch("participants",form.participants.map((p,i)=>i===index?{...p,[key]:value}:p));
  const exportSnapshot=()=>{
    const events=rows.filter(r=>r.status==="published").map(publicEvent);
    const blob=new Blob([JSON.stringify({generatedAt:new Date().toISOString(),events},null,2)+"\n"],{type:"application/json;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download="competition-results.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`已匯出 ${events.length} 筆公開賽事；內部 linkedMemberId 不會包含在 JSON。`);
  };
  const upload=async(file,key)=>{if(!file)return;setBusy(true);try{const url=await uploadWebsiteImage("competition-results",file,key);return url;}finally{setBusy(false);}};
  const publishOfficial=async()=>{
    if(!window.confirm(`確定把目前已儲存且標記「已發布」的 ${publishedCount} 場賽事發布到正式官網？\n\n尚未儲存的表單變更不會包含在這次發布。`)) return;
    setPublishing(true); setNotice("正在建立正式官網部署…");
    try{
      const result=await publishCompetitionWebsite();
      setNotice(`正式官網部署已送出：${result.eventCount ?? publishedCount} 場賽事、${result.fileCount || "—"} 個網站檔案。${result.url ? ` 部署網址：${result.url}` : ""}`);
    }catch(e){
      const detail=e?.details?.message || e?.message || "未知錯誤";
      setNotice(`正式官網發布失敗：${detail}`);
    }finally{setPublishing(false);}
  };

  return <section className="mt-8 rounded-2xl border border-amber-500/30 bg-slate-900/80 p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black tracking-[.2em] text-amber-300">COMPETITION & TEAM RESULTS</p><h2 className="text-lg font-black mt-1">🏆 帶隊比賽／賽事成果</h2><p className="text-sm text-slate-400 mt-1">這裡管理官網公開的帶隊、參賽與射手成長紀錄，與館內計分賽事資料分開。</p></div><div className="flex gap-2"><button onClick={()=>setForm(emptyEvent())} className="px-3 py-2 rounded-xl bg-slate-700 text-sm font-bold">＋ 新增比賽</button><button onClick={publishOfficial} disabled={busy||publishing} className="px-3 py-2 rounded-xl bg-emerald-600 text-sm font-black">{publishing?"發布中…":`🚀 發布到正式官網（${publishedCount}）`}</button><button onClick={exportSnapshot} disabled={busy} className="px-3 py-2 rounded-xl bg-slate-700 text-sm font-black">匯出公開 JSON（{publishedCount}）</button></div></div>
    <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100"><strong>正式發布流程：</strong>先儲存賽事並標記「已發布」，再按「發布到正式官網」。後端會重新讀取 Firestore、移除內部欄位、產生 /competitions 靜態頁與 sitemap，最後送到正式 Vercel 專案。匯出 JSON 保留作緊急備援。</div>
    {notice&&<div className="mt-3 rounded-xl bg-slate-800 px-3 py-2 text-sm text-amber-100">{notice}</div>}
    <div className="grid xl:grid-cols-[300px_minmax(0,1fr)] gap-4 mt-4"><aside className="space-y-2 max-h-[70vh] overflow-y-auto">{rows.length===0&&<div className="text-sm text-slate-500">尚無賽事紀錄。</div>}{rows.map(row=><button key={row.id} onClick={()=>edit(row)} className={`w-full text-left rounded-xl border p-3 ${form.id===row.id?"border-orange-400 bg-orange-500/10":"border-slate-700 bg-slate-950/60"}`}><div className="flex justify-between gap-2"><strong className="text-sm">{row.title||"未命名"}</strong><span className={`text-[10px] ${row.status==="published"?"text-emerald-300":"text-slate-500"}`}>{row.status==="published"?"已發布":"草稿"}</span></div><div className="text-xs text-slate-500 mt-1">{row.eventDate} {row.location}</div></button>)}</aside>
      <div className="space-y-4"><div className="grid md:grid-cols-2 gap-3">
        <label className="text-xs">比賽名稱<input value={form.title} onChange={e=>patch("title",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm" /></label>
        <label className="text-xs">網址 slug<input value={form.slug} onChange={e=>patch("slug",cleanSlug(e.target.value))} onBlur={()=>!form.slug&&patch("slug",cleanSlug(form.title))} placeholder="2026-hunting-cup" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm" /></label>
        <label className="text-xs">開始日期<input type="date" value={form.eventDate} onChange={e=>patch("eventDate",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label><label className="text-xs">結束日期<input type="date" value={form.endDate} onChange={e=>patch("endDate",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label>
        <label className="text-xs">地點<input value={form.location} onChange={e=>patch("location",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label><label className="text-xs">主辦單位<input value={form.organizer} onChange={e=>patch("organizer",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label>
        <label className="text-xs">賽事類型<input value={form.eventType} onChange={e=>patch("eventType",e.target.value)} placeholder="邀請賽／選拔賽／原野賽" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label><label className="text-xs">標籤（逗號分隔）<input value={form.tags.join(", ")} onChange={e=>patch("tags",e.target.value.split(",").map(x=>x.trim()).filter(Boolean))} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label>
      </div>
      <label className="text-xs block">短摘要<textarea rows="2" value={form.summary} onChange={e=>patch("summary",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label><label className="text-xs block">賽事紀錄<textarea rows="6" value={form.story} onChange={e=>patch("story",e.target.value)} placeholder="記錄準備、出發、比賽與射手成長，不需要只寫名次。" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label>
      <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end"><label className="text-xs">封面照片 URL<input value={form.coverImageUrl} onChange={e=>patch("coverImageUrl",e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2" /></label><label className="px-3 py-2 rounded-lg bg-slate-700 text-xs font-bold cursor-pointer">上傳封面<input type="file" accept="image/*" className="hidden" onChange={async e=>{const u=await upload(e.target.files?.[0],`cover-${Date.now()}`);if(u)patch("coverImageUrl",u);e.target.value="";}} /></label></div>
      <div><div className="flex justify-between"><strong className="text-sm">賽場照片</strong><label className="text-xs bg-slate-700 rounded-lg px-3 py-1 cursor-pointer">＋ 上傳照片<input type="file" accept="image/*" multiple className="hidden" onChange={async e=>{const next=[...form.galleryImageUrls];for(const file of [...e.target.files]){const u=await upload(file,`gallery-${Date.now()}-${next.length}`);if(u)next.push(u);}patch("galleryImageUrls",next);e.target.value="";}} /></label></div><textarea rows="3" value={form.galleryImageUrls.join("\n")} onChange={e=>patch("galleryImageUrls",e.target.value.split("\n").map(x=>x.trim()).filter(Boolean))} placeholder="每行一個圖片 URL" className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs" /></div>
      <div><div className="flex justify-between items-center"><strong className="text-sm">參賽者／成果</strong><button onClick={()=>patch("participants",[...form.participants,emptyParticipant()])} className="text-xs px-3 py-1 rounded-lg bg-indigo-700">＋ 參賽者</button></div><p className="text-[11px] text-slate-500 mt-1">公開姓名必須手動填寫。linkedMemberId 只供內部辨識，匯出官網時一定剝除；不會自動帶出 Email、電話或其他學籍個資。</p><div className="space-y-2 mt-2">{form.participants.map((p,i)=><div key={i} className="rounded-xl border border-slate-700 p-3 grid md:grid-cols-4 gap-2"><input placeholder="公開姓名" value={p.publicDisplayName} onChange={e=>updateParticipant(i,"publicDisplayName",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><input placeholder="內部 memberId（不公開）" value={p.linkedMemberId} onChange={e=>updateParticipant(i,"linkedMemberId",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><input placeholder="弓種" value={p.bowType} onChange={e=>updateParticipant(i,"bowType",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><input placeholder="組別／項目" value={p.category} onChange={e=>updateParticipant(i,"category",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><input placeholder="成績" value={p.score} onChange={e=>updateParticipant(i,"score",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><input placeholder="名次" value={p.rank} onChange={e=>updateParticipant(i,"rank",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><input placeholder="獎項" value={p.award} onChange={e=>updateParticipant(i,"award",e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><div className="flex gap-1"><input placeholder="成果備註" value={p.resultNote} onChange={e=>updateParticipant(i,"resultNote",e.target.value)} className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs"/><button onClick={()=>patch("participants",form.participants.filter((_,x)=>x!==i))} className="px-2 text-red-300">×</button></div></div>)}</div></div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-700 pt-4"><select value={form.status} onChange={e=>patch("status",e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm"><option value="draft">草稿</option><option value="published">已發布</option></select><label className="text-sm flex gap-2"><input type="checkbox" checked={form.featured} onChange={e=>patch("featured",e.target.checked)}/>首頁優先顯示</label><button disabled={busy} onClick={save} className="px-5 py-2 rounded-xl bg-orange-600 font-black">{busy?"處理中…":"儲存賽事"}</button>{form.id&&<button disabled={busy} onClick={()=>remove(form)} className="px-4 py-2 rounded-xl bg-red-950 text-red-200">刪除</button>}</div>
      </div>
    </div>
  </section>;
}
