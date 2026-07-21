// src/components/dungeon/DungeonChest.jsx — 地下城寶箱房間（背面隱藏三選一 ＋ 逐一揭示 ＋ 狀態變化）
import { useState, useEffect, useMemo, useRef } from "react";
import { confirmNonCombatRoom } from "../../lib/dungeonDb";
import { createOrdinaryChestLoot } from "../../lib/dungeonChestLoot";
import { sfxOpenChest, sfxCoinDrop, sfxSuccess } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

export default function DungeonChest({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
}) {
  const [animPhase, setAnimPhase]   = useState("entering"); // entering | opening | choices | empty | done
  const [cardState, setCardState]   = useState("hidden");   // hidden (背面) | revealing (逐一揭示中) | revealed (完成)
  const [revealedCount, setRevealedCount] = useState(0);    // 1, 2, 3 逐一翻牌計數
  const [chosenIdx, setChosenIdx]   = useState(null);
  const [claiming, setClaiming]     = useState(false);
  const [confirmedWait, setConfirmedWait] = useState(false);
  const [eggType, setEggType]       = useState("normal");   // normal | empty | mimic
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
    }, 1400);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [eggType]);

  // 點擊選擇背面卡片 → 觸發逐一揭示動畫
  async function handleSelectFaceDownCard(index) {
    if (chosenIdx !== null || claiming) return;
    setChosenIdx(index);
    setClaiming(true);
    sfxSuccess();

    // 啟動逐一翻牌動效 (0.4s, 0.8s, 1.2s 逐一揭示 3 張卡片)
    setCardState("revealing");
    setTimeout(() => { setRevealedCount(1); sfxCoinDrop(); }, 300);
    setTimeout(() => { setRevealedCount(2); sfxCoinDrop(); }, 700);
    setTimeout(() => { setRevealedCount(3); sfxCoinDrop(); }, 1100);

    setTimeout(async () => {
      setCardState("revealed");
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
      } finally {
        setClaiming(false);
      }
    }, 1500);
  }

  async function handleFinish() {
    if (localMode) {
      onLocalDone?.();
      return;
    }
    setConfirmedWait(true);
    await confirmNonCombatRoom(roomId, memberId, "opened");
    if (isHost && onSharedDone) await onSharedDone();
  }

  return (
    <DungeonEventStage tone="chest">
      <div className="dungeon-stage-header text-center py-4 border-b border-white/10">
        <div className="text-4xl mb-1">
          {animPhase === "opening" ? "✨" : eggType === "empty" ? "🕳️" : "🎁"}
        </div>
        <div className="text-xl font-black text-amber-300">
          {eggType === "empty" ? "空寶箱！" : "神秘寶箱（盲抽三選一）"}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {eggType === "empty"
            ? "裡面只有一個咬了一口的蘋果...空空如也！"
            : cardState === "hidden"
            ? "三張寶箱卡皆已背面隱藏，請憑直覺選取一張！"
            : cardState === "revealing"
            ? "正在逐一揭示所有寶箱卡內容…"
            : "恭喜獲得您選取的寶箱戰利品！"}
        </div>
      </div>

      <div className="dungeon-stage-main flex flex-col items-center justify-center p-6 space-y-4">
        {/* 三選一背面隱藏/逐一揭示卡片區 */}
        {animPhase === "choices" && (
          <div className="w-full max-w-lg grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fade-in">
            {choices.map((c, idx) => {
              const isPicked = chosenIdx === idx;
              const isRevealed = cardState === "revealed" || (cardState === "revealing" && revealedCount >= idx + 1);

              return (
                <div
                  key={c.id}
                  className={`relative rounded-3xl p-5 border text-left transition-all duration-500 flex flex-col justify-between min-h-[180px] shadow-2xl ${
                    !isRevealed
                      ? "bg-gradient-to-b from-slate-900 via-slate-950 to-amber-950/40 border-amber-500/40 cursor-pointer hover:border-amber-400 hover:scale-105 active:scale-95"
                      : isPicked
                      ? "bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-400 shadow-amber-500/30 ring-2 ring-amber-400/40"
                      : "bg-slate-900/90 border-slate-700/80 opacity-70"
                  }`}
                  onClick={() => !isRevealed && cardState === "hidden" && handleSelectFaceDownCard(idx)}
                >
                  {!isRevealed ? (
                    /* 背面隱藏卡面 */
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-2">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner animate-pulse">
                        ❓
                      </div>
                      <div>
                        <div className="font-black text-sm text-amber-300">寶箱卡 #{idx + 1}</div>
                        <div className="text-[10px] text-amber-200/60 mt-0.5">點擊盲抽揭示</div>
                      </div>
                    </div>
                  ) : (
                    /* 正面揭示卡面 */
                    <div className="h-full flex flex-col justify-between animate-fade-in">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-3xl">{c.icon}</span>
                          {isPicked && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-slate-950 shadow">
                              ⭐ 你的選擇
                            </span>
                          )}
                        </div>
                        <div className="font-black text-base text-amber-300">{c.title}</div>
                        <div className="text-xs text-slate-300 mt-1 leading-relaxed">{c.desc}</div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-white/10 text-[11px] font-black text-emerald-400">
                        {isPicked ? "✨ 戰利品已領取" : "已揭示"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 空寶箱或選擇完成後顯示繼續探索 */}
        {(animPhase === "empty" || animPhase === "done") && cardState !== "revealing" && (
          <div className="w-full max-w-sm bg-slate-900/95 border border-amber-500/40 p-6 rounded-3xl text-center space-y-4 animate-fade-in shadow-2xl backdrop-blur-md">
            <div className="text-5xl">
              {animPhase === "empty" ? "🍎" : "🎉"}
            </div>
            <div>
              <div className="text-base font-black text-amber-300">
                {animPhase === "empty"
                  ? "這是一隻餓鬼留下的空箱，什麼都沒拿到！"
                  : "已成功揭示並領取戰利品！"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {animPhase === "empty" ? "收拾心情前進下一間房間吧。" : "戰利品已加入您的背包與個人資源庫。"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              disabled={confirmedWait}
              className={`w-full py-3.5 font-black rounded-2xl text-sm shadow-xl transition-all ${
                confirmedWait
                  ? "bg-slate-800 text-amber-300/80 border border-amber-500/30 cursor-wait animate-pulse"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 active:scale-95"
              }`}
            >
              {confirmedWait ? "✅ 已完成確認，等待其他隊友繼續…" : "➡️ 繼續探索下一關"}
            </button>
          </div>
        )}
      </div>
    </DungeonEventStage>
  );
}
