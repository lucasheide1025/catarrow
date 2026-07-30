import { useMemo, useState } from "react";
import {
  confirmNonCombatRoom,
  purchaseDungeonMerchantItem,
  resolveNonCombatRoom,
} from "../../lib/dungeonDb";
import { buildDungeonMerchant } from "../../lib/dungeonMerchant";
import { sfxError, sfxShopBuy, sfxSuccess, sfxTap } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

const KIND_ICON = {
  instant_heal:"❤️", carry_potion:"🧪", magic_weapon:"⚔️",
  magic_armor:"🛡️", material_chest:"📦", locked:"🔒",
};

export default function DungeonShop({
  roomId, room, memberId, memberData, isHost,
  localMode = false, onLocalBuy, onLocalDone, onSharedDone,
  boughtEffects = {},
}) {
  const family = String(room?.mapDungeonId || "ghost").split("_")[0];
  const merchant = useMemo(() => buildDungeonMerchant({
    type:room?.shopType,
    family,
    tier:room?.expeditionDifficulty || room?.dungeonDifficulty || 1,
  }), [room?.shopType, room?.expeditionDifficulty, room?.dungeonDifficulty, family]);
  const [localCoins, setLocalCoins] = useState(Number(memberData?.coins) || 0);
  const [localCounts, setLocalCounts] = useState({});
  const [localGroups, setLocalGroups] = useState({});
  const [loadingId, setLoadingId] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const coins = localMode ? localCoins : (Number(memberData?.coins) || 0);
  const roomCounts = room?.merchantRoomPurchases?.[memberId] || {};
  const runCounts = room?.merchantRunPurchases?.[memberId] || {};
  const groups = room?.merchantGroups?.[memberId] || {};
  const validIds = Object.entries(room?.members || {}).filter(([, m]) => m && m.alive !== false).map(([id]) => id);
  const allConfirmed = validIds.every(id => room?.roomConfirms?.[id] === true);

  function itemState(item) {
    const counts = localMode
      ? localCounts
      : item.limitScope === "run" ? runCounts : roomCounts;
    const groupMap = localMode ? localGroups : groups;
    const runLocked = localMode && item.limitScope === "run" && boughtEffects[item.group || item.id];
    const count = counts[item.id] || 0;
    if (item.locked) return { disabled:true, reason:item.lockedReason, count };
    if (runLocked || (item.group && groupMap[item.group])) return { disabled:true, reason:"本趟已選擇同類商品", count };
    if (count >= (item.limit || 1)) return { disabled:true, reason:"已達購買上限", count };
    if (coins < item.cost) return { disabled:true, reason:"金幣不足", count };
    return { disabled:false, reason:"", count };
  }

  async function buy(item) {
    const state = itemState(item);
    if (state.disabled || loadingId) return;
    setLoadingId(item.id);
    setMessage("");
    sfxTap();
    if (localMode) {
      onLocalBuy?.(item);
      setLocalCoins(value => value - item.cost);
      setLocalCounts(counts => ({ ...counts, [item.id]:(counts[item.id] || 0) + 1 }));
      if (item.group) setLocalGroups(value => ({ ...value, [item.group]:item.id }));
      setMessage(`已購買：${item.name}`);
      sfxShopBuy();
      setLoadingId("");
      return;
    }
    const result = await purchaseDungeonMerchantItem(roomId, memberId, item.id);
    if (!result.ok) {
      setMessage(result.reason);
      sfxError();
    } else {
      setMessage(`已購買：${item.name}`);
      sfxShopBuy();
    }
    setLoadingId("");
  }

  async function finish() {
    if (localMode) {
      onLocalDone?.();
      return;
    }
    if (!confirmed) {
      setConfirmed(true);
      await confirmNonCombatRoom(roomId, memberId, "done");
      return;
    }
    if (isHost && allConfirmed) {
      sfxSuccess();
      if (onSharedDone) await onSharedDone();
      else await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
    }
  }

  return (
    <DungeonEventStage tone="shop">
      <style>{`
        @keyframes merchant-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .merchant-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .merchant-item{display:flex;min-width:0;flex-direction:column}
        .merchant-item-action{margin-top:auto}
        .merchant-stage-main{width:min(calc(100% - 24px),896px)!important;margin-inline:auto!important}
        @media(min-width:761px){.merchant-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}}
        @media(max-width:760px){.merchant-art{height:112px!important;width:128px!important}}
      `}</style>
      <header className="dungeon-stage-header border-b border-amber-400/20 p-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="merchant-art h-28 w-36 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-900 to-slate-950">
            <img src="/ui/dungeon/merchant-types-sheet.webp" alt=""
              className="relative max-w-none"
              style={{ width:"200%", height:"200%", left:merchant.x ? "-100%" : 0, top:merchant.y ? "-100%" : 0 }} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-[.22em] text-amber-300">DUNGEON MERCHANT</div>
            <h2 className="mt-1 text-xl font-black text-white">{merchant.name}</h2>
            <p className="mt-1 text-xs text-slate-400">{merchant.subtitle}</p>
            <div className="mt-3 inline-flex rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
              金幣 {coins.toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      <main className="dungeon-stage-main merchant-stage-main p-4 md:p-6">
        <div className="merchant-grid">
          {merchant.items.map((item, index) => {
            const state = itemState(item);
            return (
              <article key={item.id} className="merchant-item rounded-2xl border border-white/10 bg-slate-950/80 p-3 shadow-xl md:rounded-3xl md:p-4" style={{ animation:`merchant-in .4s ${Math.min(index, 8) * .05}s both` }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-3xl">{KIND_ICON[item.kind] || "✨"}</span>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                    {item.limitScope === "run" ? "本趟" : "本房"} {state.count}/{item.limit || 1}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-black text-white">{item.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-400">{item.desc}</p>
                <button type="button" onClick={() => buy(item)}
                  disabled={state.disabled || !!loadingId}
                  className="merchant-item-action mt-4 min-h-11 w-full rounded-2xl bg-amber-300 px-2 text-xs font-black text-slate-950 transition enabled:hover:brightness-110 disabled:bg-slate-800 disabled:text-slate-500 md:text-sm">
                  {state.disabled ? state.reason : loadingId === item.id ? "購買中…" : `${item.cost.toLocaleString()} 金幣`}
                </button>
              </article>
            );
          })}
        </div>
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-xs font-bold text-amber-200">{message}</div>}
        <button type="button" onClick={finish}
          disabled={!localMode && confirmed && (!isHost || !allConfirmed)}
          className="mt-5 min-h-12 w-full rounded-2xl bg-emerald-300 font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">
          {localMode ? "離開商店，繼續探索" : !confirmed ? "完成購物" : isHost ? (allConfirmed ? "帶領隊伍繼續" : "等待所有隊員…") : "已完成，等待房主…"}
        </button>
      </main>
    </DungeonEventStage>
  );
}
