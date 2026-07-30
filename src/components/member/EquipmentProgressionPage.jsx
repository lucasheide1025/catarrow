import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import EquipSpecializationPanel from "./EquipSpecializationPanel";
import EquipmentRunePanel from "./EquipmentRunePanel";
import EquipmentSocketPanel from "./EquipmentSocketPanel";
import heroArt from "../../assets/hub/specialization-runes-v1.webp";

const MAIN_TABS = [
  { id:"specialization", label:"裝備專精", desc:"選擇戰鬥路線與升級能力" },
  { id:"runes", label:"符文工坊", desc:"製作、合成、開洞與鑲嵌" },
];
const RUNE_TABS = [
  { id:"craft", label:"製作與合成" },
  { id:"socket", label:"開洞與鑲嵌" },
];

export default function EquipmentProgressionPage({ onBack }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("specialization");
  const [runeTab, setRuneTab] = useState("craft");

  return <div className="min-h-[100dvh] text-white"
    style={{ backgroundImage:"linear-gradient(180deg,rgba(3,7,18,.72),rgba(3,7,18,.97)),url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center" }}>
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl px-2 text-sm font-bold text-slate-300 hover:bg-white/10">← 背包</button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-black">專精與符文</h1>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">打造你的戰鬥流派，管理裝備的進階能力</p>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-5xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
      <section className="relative aspect-[16/7] min-h-48 overflow-hidden rounded-3xl border border-violet-300/25 shadow-2xl">
        <img src={heroArt} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/35 to-transparent" />
        <div className="relative flex h-full max-w-sm flex-col justify-end p-5 sm:p-7">
          <div className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">Equipment Mastery</div>
          <h2 className="mt-2 text-2xl font-black text-white drop-shadow-lg">讓每件裝備<br />成為你的戰鬥風格</h2>
          <p className="mt-2 text-xs leading-5 text-slate-200/90">專精決定戰術方向，符文則補強數值。所有原有成本與成功率都維持不變。</p>
        </div>
      </section>

      <nav aria-label="專精與符文功能" className="sticky top-[69px] z-10 -mx-1 mt-4 grid grid-cols-2 gap-2 rounded-3xl bg-slate-950/85 p-2 backdrop-blur-xl">
        {MAIN_TABS.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)}
          className={`min-h-16 rounded-2xl border px-3 text-left transition-all ${
            tab === item.id ? "border-violet-300/55 bg-gradient-to-br from-violet-500/30 to-indigo-500/20 shadow-lg" : "border-white/10 bg-white/5"
          }`}>
          <span className="block text-sm font-black text-white">{item.label}</span>
          <span className="mt-1 block text-[10px] leading-4 text-slate-400">{item.desc}</span>
        </button>)}
      </nav>

      <div className="mt-4">
        {tab === "specialization" ? <EquipSpecializationPanel pageMode /> : <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {RUNE_TABS.map(item => <button key={item.id} type="button" onClick={() => setRuneTab(item.id)}
              className={`min-h-11 rounded-2xl border px-3 text-xs font-black ${
                runeTab === item.id ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-slate-900/70 text-slate-400"
              }`}>{item.label}</button>)}
          </div>
          {runeTab === "craft"
            ? <EquipmentRunePanel profile={profile} pageMode />
            : <EquipmentSocketPanel profile={profile} />}
        </>}
      </div>
    </main>
  </div>;
}
