import { useEffect } from "react";

export default function BattleBonusSheet({ open, onClose, sections = [] }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return <div role="presentation" onClick={onClose} style={{position:"absolute",inset:0,zIndex:40,background:"rgba(2,6,23,.62)",display:"flex",alignItems:"flex-end"}}>
    <section role="dialog" aria-modal="true" aria-label="本場加成" onClick={event=>event.stopPropagation()} style={{width:"100%",maxHeight:"72%",overflowY:"auto",padding:"14px 14px 20px",borderRadius:"20px 20px 0 0",background:"linear-gradient(180deg,#17233a,#0b1220)",borderTop:"1px solid rgba(125,211,252,.35)",boxShadow:"0 -16px 45px rgba(0,0,0,.55)",animation:"rise .24s ease-out"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12}}><div><div style={{fontSize:17,fontWeight:900,color:"#eef6ff"}}>本場加成</div><div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>卡片、專精、異常抗性與目前效果</div></div><button type="button" onClick={onClose} aria-label="關閉本場加成" style={{width:34,height:34,borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#cbd5e1",fontSize:18}}>×</button></div>
      {sections.length ? sections.map(section => <div key={section.id} style={{marginTop:12}}><div style={{fontSize:10,fontWeight:900,color:"#7dd3fc",letterSpacing:".08em",marginBottom:6}}>{section.title}</div><div style={{display:"grid",gap:6}}>{section.items.map(item => <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 9px",borderRadius:10,background:"rgba(255,255,255,.045)",border:"1px solid rgba(148,163,184,.12)"}}><span>{item.icon}</span><span style={{flex:1,fontSize:12,fontWeight:800,color:"#dbeafe"}}>{item.label}</span><span style={{fontSize:11,fontWeight:900,color:"#fcd34d"}}>{item.value}</span></div>)}</div></div>) : <div style={{padding:"24px 8px",textAlign:"center",fontSize:12,color:"#94a3b8"}}>目前沒有額外加成</div>}
    </section>
  </div>;
}
