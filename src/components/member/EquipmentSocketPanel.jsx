import { useMemo, useState } from "react";
import { EQUIP_GRADES, EQUIP_SLOT_DEFS } from "../../lib/constants";
import { setEquipSocketRune, trySocketEquip } from "../../lib/db";
import { EQUIPMENT_RUNES, getEquipmentRune, getEquipmentRuneBonus } from "../../lib/equipmentRuneData";
import EquipmentIcon from "../shared/EquipmentIcon";

function RuneArt({ rune, size = 42 }) {
  const [failed, setFailed] = useState(false);
  if (rune?.img && !failed) {
    return <img src={rune.img} alt="" width={size} height={size}
      onError={() => setFailed(true)} className="shrink-0 object-contain drop-shadow-lg" />;
  }
  return <span aria-hidden="true" style={{ fontSize:size * 0.72 }}>{rune?.icon || "🔮"}</span>;
}

export default function EquipmentSocketPanel({ profile, readOnly = false }) {
  const equipment = profile?.rpgEquip || {};
  const equippedSlots = EQUIP_SLOT_DEFS.filter(slot => equipment[slot.id]?.itemId);
  const [slotId, setSlotId] = useState(() => equippedSlots[0]?.id || "");
  const [picker, setPicker] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const selectedDef = EQUIP_SLOT_DEFS.find(slot => slot.id === slotId) || equippedSlots[0];
  const equipped = selectedDef ? equipment[selectedDef.id] : null;
  const sockets = Array.isArray(equipped?.sockets) ? equipped.sockets : [];
  const gradeIndex = EQUIP_GRADES.findIndex(grade => grade.id === equipped?.grade);
  const inventory = profile?.equipmentRuneInventory || {};
  const availableRunes = useMemo(
    () => Object.values(EQUIPMENT_RUNES).filter(rune => (inventory[rune.id] || 0) > 0),
    [inventory],
  );
  const bonus = getEquipmentRuneBonus(sockets);
  const notify = text => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3200);
  };

  async function openSocket() {
    if (readOnly || busy || !profile?.id || !selectedDef) return;
    setBusy("socket");
    const result = await trySocketEquip(profile.id, selectedDef.id);
    setBusy("");
    notify(result.ok
      ? result.success
        ? `第 ${result.sockets} 個符文洞開啟成功`
        : `開洞失敗，已消耗 ${result.sealCost} 枚王之印記；裝備沒有受損`
      : result.reason);
  }

  async function setRune(index, runeId) {
    if (readOnly || busy || !profile?.id || !selectedDef) return;
    setBusy(`rune-${index}`);
    const result = await setEquipSocketRune(profile.id, selectedDef.id, index, runeId);
    setBusy("");
    if (result.ok) {
      setPicker(null);
      notify(runeId ? "符文已鑲嵌" : "符文已卸下並放回符文背包");
    } else notify(result.reason);
  }

  if (equippedSlots.length === 0) {
    return <div className="rounded-3xl border border-dashed border-violet-300/25 bg-slate-950/55 px-5 py-12 text-center">
      <div className="text-4xl" aria-hidden="true">🔒</div>
      <h3 className="mt-3 text-base font-black text-white">目前沒有可鑲嵌的裝備</h3>
      <p className="mt-2 text-xs leading-6 text-slate-400">先到「我的裝備」穿戴裝備；精良以上品級才能開啟符文洞。</p>
    </div>;
  }

  return <section className="space-y-4">
    <div>
      <h2 className="text-base font-black text-white">選擇裝備部位</h2>
      <p className="mt-1 text-xs text-slate-400">先選擇裝備，再管理它的開洞與符文配置。</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {equippedSlots.map(slot => {
        const item = equipment[slot.id];
        const active = selectedDef?.id === slot.id;
        return <button key={slot.id} type="button" onClick={() => { setSlotId(slot.id); setPicker(null); }}
          className={`min-h-20 rounded-2xl border p-3 text-left transition-all active:scale-[.98] ${
            active ? "border-violet-300/70 bg-violet-500/20 shadow-lg shadow-violet-950/50" : "border-white/10 bg-slate-900/70"
          }`}>
          <div className="flex items-center gap-2">
            <EquipmentIcon slotId={slot.id} size={32} />
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-white">{slot.name}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                {EQUIP_GRADES.find(g => g.id === item.grade)?.name || "普通"} · {item.sockets?.length || 0}/3 洞
              </div>
            </div>
          </div>
        </button>;
      })}
    </div>

    <div className="overflow-hidden rounded-3xl border border-violet-300/25 bg-gradient-to-br from-violet-950/70 via-slate-950/90 to-indigo-950/70 shadow-2xl">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-black text-violet-100">{selectedDef?.name}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              符文總加成：ATK +{Math.round(bonus.atk * 100)}%／DEF +{Math.round(bonus.def * 100)}%／HP +{Math.round(bonus.hp * 100)}%
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-200">
            👑 {profile?.kingSeals || 0}
          </div>
        </div>
        {notice && <div role="status" className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-violet-100">{notice}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2 p-4">
        {[0, 1, 2].map(index => {
          const rune = getEquipmentRune(sockets[index]);
          const opened = index < sockets.length;
          return <button key={index} type="button" disabled={!opened || Boolean(busy) || readOnly}
            onClick={() => setPicker(index)}
            className={`aspect-square min-h-24 rounded-2xl border p-2 text-center transition-all ${
              rune ? "border-violet-300/55 bg-violet-400/15" : opened ? "border-dashed border-cyan-300/40 bg-cyan-400/5" : "border-dashed border-slate-700 bg-black/20"
            } disabled:cursor-not-allowed`}>
            <div className="flex h-full flex-col items-center justify-center gap-1">
              {rune ? <><RuneArt rune={rune} /><span className="text-[10px] font-black text-violet-100">{rune.name} T{rune.tier}</span></>
                : opened ? <><span className="text-2xl text-cyan-300">＋</span><span className="text-[10px] font-bold text-cyan-100">空洞・選擇符文</span></>
                : <><span className="text-2xl opacity-40">🔒</span><span className="text-[10px] text-slate-500">第 {index + 1} 洞未開啟</span></>}
            </div>
          </button>;
        })}
      </div>

      <div className="px-4 pb-4">
        {gradeIndex >= 2 && sockets.length < 3 ? <button type="button"
          disabled={readOnly || Boolean(busy) || (profile?.kingSeals || 0) < sockets.length + 1}
          onClick={openSocket}
          className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 text-sm font-black text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:opacity-40">
          {busy === "socket" ? "開洞中…" : `使用 ${sockets.length + 1} 枚王之印記開啟第 ${sockets.length + 1} 洞・成功率 ${[85, 65, 45][sockets.length]}%`}
        </button> : <div className="rounded-xl bg-black/20 px-3 py-2 text-center text-xs text-slate-400">
          {sockets.length >= 3 ? "此裝備已開滿三個符文洞。" : "精良以上裝備才能開啟符文洞。"}
        </div>}
      </div>
    </div>

    {picker !== null && <div className="rounded-3xl border border-violet-300/25 bg-slate-950/95 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black text-white">第 {picker + 1} 洞要放哪一顆？</div>
        <button type="button" onClick={() => setPicker(null)} className="min-h-11 rounded-xl px-3 text-xs font-bold text-slate-400">關閉</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {getEquipmentRune(sockets[picker]) && <button type="button" onClick={() => setRune(picker, null)}
          className="min-h-14 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-3 text-left text-xs font-bold text-rose-100">
          卸下目前符文並放回背包
        </button>}
        {availableRunes.map(rune => <button key={rune.id} type="button" onClick={() => setRune(picker, rune.id)}
          className="flex min-h-16 items-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-3 text-left">
          <RuneArt rune={rune} size={38} />
          <span className="min-w-0"><span className="block text-xs font-black text-white">{rune.name} T{rune.tier}</span>
            <span className="mt-1 block text-[10px] text-violet-200">持有 ×{inventory[rune.id]}・+{Math.round(rune.bonus * 100)}%</span></span>
        </button>)}
      </div>
      {availableRunes.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-slate-700 px-3 py-5 text-center text-xs text-slate-500">符文背包目前沒有可鑲嵌的符文。</div>}
    </div>}
  </section>;
}
