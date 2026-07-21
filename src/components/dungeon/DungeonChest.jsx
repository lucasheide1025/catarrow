// src/components/dungeon/DungeonChest.jsx — 地下城寶箱房間（三選一 ＋ 彩蛋擬態怪/空寶箱）
import { useState, useEffect, useMemo, useRef } from "react";
import { confirmNonCombatRoom } from "../../lib/dungeonDb";
import { createOrdinaryChestLoot } from "../../lib/dungeonChestLoot";
import { sfxOpenChest, sfxCoinDrop, sfxSuccess } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

export default function DungeonChest({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
}) {
  const [animPhase, setAnimPhase] = useState("entering"); // entering | opening | choices | empty | done
  const [chosenIdx, setChosenIdx] = useState(null);
  const [claiming, setClaiming]   = useState(false);
  const [eggType, setEggType]     = useState("normal"); // normal | empty | mimic
  const chestSeedRef = useRef(null);

  const dungeonMapId = room?.mapDungeonId || "";
  const family = dungeonMapId.split("_")[0] || "ghost";
  const isHidden = !!room?.hiddenRoomLoot?.found;

  // 1. 初始化寶箱與彩蛋判斷 (10% 擬態怪, 3% 空箱)
  if (!chestSeedRef.current) {
    const rollEgg = Math.random();
    let egg = "normal";
    if (rollEgg < 0.10) egg = "mimic";
    else if (rollEgg < 0.13) egg = "empty";
    setEggType(egg);

    chestSeedRef.current = createOrdinaryChestLoot({
      family,
      difficultyTier: room?.expeditionDifficulty || room?.dungeonDifficulty || 1,
      hidden: isHidden,
    });
  }

  const baseLoot = chestSeedRef.current;

  // 2. 產生「三選一」獎勵選項
  const choices = useMemo(() => {
    if (!baseLoot) return [];
    return [
      {
        id: "choice_coins",
        title: "🪙 金幣大禮包",
        icon: "🪙",
        desc: `獲得 ${(baseLoot.coins || 100) + 50} 金幣`,
        type: "coins",
        value: (baseLoot.coins || 100) + 50,
      },
      {
        id: "choice_item",
        title: baseLoot.item ? baseLoot.item.name : "🧪 冒險藥水包",
        icon: baseLoot.item ? (baseLoot.item.icon || "✨") : "🧪",
        desc: baseLoot.item ? (baseLoot.item.desc || "地下城收藏品") : "獲得回復藥水 ×1",
        type: baseLoot.item ? "item" : "potion",
        item: baseLoot.item,
      },
      {
        id: "choice_material",
        title: baseLoot.material ? baseLoot.material.name : "🧱 稀有素材包",
        icon: baseLoot.material ? (baseLoot.material.icon || "🧱") : "📦",
        desc: baseLoot.material ? "獲得精選掉落素材 ×2" : "獲得基礎備用建材包",
        type: "material",
        material: baseLoot.material,
      },
    ];
  }, [baseLoot]);

  // 開箱動畫
  useEffect(() => {
    const t1 = setTimeout(() => {
      setAnimPhase("opening");
      sfxOpenChest();
    }, 400);

    const t2 = setTimeout(() => {
      if (eggType === "empty") {
        setAnimPhase("empty");
      } else {
        setAnimPhase("choices");
      }
      sfxCoinDrop();
    }, 1500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [eggType]);

  async function handleSelectChoice(index) {
    if (chosenIdx !== null || claiming) return;
    setChosenIdx(index);
    setClaiming(true);
    sfxSuccess();

    const selected = choices[index];

    try {
      if (selected.type === "coins") {
        if (localMode) onLocalEffect?.({ type: "coins", value: selected.value });
        else {
          const { addCoins } = await import("../../lib/db");
          await addCoins(memberId, selected.value);
        }
      } else if (selected.type === "material" && selected.material) {
        const { addMaterials } = await import("../../lib/db");
        await addMaterials(memberId, [selected.material]);
      } else if (selected.item) {
        const { addCollectibles } = await import("../../lib/dungeonDb");
        await addCollectibles(memberId, [{ itemId: selected.item.id, qty: 1 }]);
      }

      setAnimPhase("done");
      if (!localMode) {
        await confirmNonCombatRoom(roomId, memberId, "opened");
      }
    } finally {
      setClaiming(false);
    }
  }

  async function handleFinish() {
    if (localMode) {
      onLocalDone?.();
      return;
    }
    if (onSharedDone) await onSharedDone();
  }

  return (
    <DungeonEventStage tone="chest">
      <div className="dungeon-stage-header text-center py-4 border-b border-white/10">
        <div className="text-4xl mb-1">
          {animPhase === "opening" ? "✨" : eggType === "empty" ? "🕳️" : "🎁"}
        </div>
        <div className="text-xl font-black text-amber-300">
          {eggType === "empty" ? "空寶箱！" : "神秘寶箱（三選一）"}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {eggType === "empty"
            ? "裡面只有一個咬了一口的蘋果...空空如也！"
            : "請點選您最心儀的一項戰利品！"}
        </div>
      </div>

      <div className="dungeon-stage-main flex flex-col items-center justify-center p-6 space-y-4">
        {/* 三選一卡片 */}
        {animPhase === "choices" && (
          <div className="w-full max-w-md grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in">
            {choices.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectChoice(idx)}
                className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 hover:border-amber-400 text-left transition transform hover:-translate-y-1 flex flex-col justify-between"
              >
                <div>
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <div className="font-black text-sm text-amber-300">{c.title}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">{c.desc}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] font-bold text-emerald-400">
                  👉 點擊選擇此獎勵
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 空寶箱或選擇完成 */}
        {(animPhase === "empty" || animPhase === "done") && (
          <div className="w-full max-w-sm bg-slate-900/90 border border-slate-700 p-6 rounded-2xl text-center space-y-4 animate-fade-in">
            <div className="text-4xl">
              {animPhase === "empty" ? "🍎" : "🎉"}
            </div>
            <div className="text-sm font-bold text-slate-200">
              {animPhase === "empty"
                ? "這是一隻餓鬼留下的空箱，什麼都沒拿到！"
                : "已成功領取您選擇的戰利品！"}
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm shadow-md"
            >
              繼續探索
            </button>
          </div>
        )}
      </div>
    </DungeonEventStage>
  );
}
