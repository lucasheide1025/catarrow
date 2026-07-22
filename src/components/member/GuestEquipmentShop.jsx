import { useEffect, useState } from "react";
import { initializeGuestEquipment, purchaseGuestEquipment } from "../../lib/guestEquipmentDb";
import { GUEST_COMMON_EQUIPMENT } from "../../lib/guestEquipmentCatalog";

export default function GuestEquipmentShop({ profile }) {
  const [catalog,setCatalog]=useState([]),[busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(false),[initFailed,setInitFailed]=useState(false);
  async function loadCatalog(){
    if(!profile?.id)return;
    if(profile.guestEquipmentSeeded){setCatalog(GUEST_COMMON_EQUIPMENT);setInitFailed(false);setNotice("");return;}
    setLoading(true);setInitFailed(false);setNotice("");
    try{const result=await initializeGuestEquipment(profile.id);setCatalog(result.catalog||[]);}
    catch(e){setInitFailed(true);setNotice(callableMessage(e,"無法初始化裝備，請稍後重試"));}
    finally{setLoading(false);}
  }
  useEffect(()=>{loadCatalog();},[profile?.id,profile?.guestEquipmentSeeded]);
  async function buy(item){setBusy(item.itemId);setNotice("");try{await purchaseGuestEquipment(profile.id,item.itemId);setNotice(`已購買 ${item.name}`);}catch(e){setNotice(callableMessage(e,"購買失敗，請稍後重試"));}finally{setBusy("");}}
  return <section className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-950/25 p-4">
    <h2 className="text-sm font-black text-amber-100">基礎裝備商店</h2><p className="mt-1 text-xs text-amber-100/70">免費練習弓會自動發放；其他普通裝備逐件購買。</p>
    {notice&&<div role="status" className="mt-3 rounded-xl bg-white/10 p-2 text-xs text-white">{notice}</div>}
    {loading&&<div role="status" className="mt-3 text-xs text-slate-300">正在確認練習弓與商店資料…</div>}
    {initFailed&&<button type="button" onClick={loadCatalog} className="mt-3 min-h-11 rounded-xl bg-white/10 px-4 text-xs font-black text-white">重新載入商店</button>}
    <div className="mt-3 space-y-2">{catalog.map(item=>{const owned=!!profile?.rpgEquip?.[item.slotId]?.itemId;return <div key={item.itemId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <div className="min-w-0 flex-1"><div className="text-sm font-black text-white">{item.name}</div><div className="text-xs text-amber-200">🪙 {item.price} · 普通品質</div></div>
      <button disabled={owned||!!busy} onClick={()=>buy(item)} className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">{owned?"已擁有":busy===item.itemId?"購買中":"購買"}</button>
    </div>})}</div>
    <p className="mt-3 text-xs leading-relaxed text-slate-300">裝備可照既有規則持續強化；當需要 T2 以上材料時，代表已進入正式會員的高階冒險進度，並非訪客模式人工鎖住按鈕。</p>
  </section>;
}

function callableMessage(error,fallback){
  const text=`${error?.message||""}`;
  if(text.includes("guest_expired"))return "本次 QR 體驗已到期，無法購買或初始化裝備";
  if(text.includes("insufficient_coins"))return "金幣不足，先去冒險取得更多金幣";
  if(text.includes("slot_already_filled"))return "這個裝備槽已有裝備";
  if(text.includes("owner_mismatch"))return "訪客身分已變更，請重新進入體驗";
  return fallback;
}
