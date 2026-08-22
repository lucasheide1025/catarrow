// src/components/dungeon/DungeonChest.jsx — 地下城寶箱房間（背面隱藏三選一 ＋ 逐一揭示 ＋ 狀態變化）
import { useState, useEffect } from "react";
import { claimTeamDungeonChestChoice, confirmNonCombatRoom } from "../../lib/dungeonDb";
import { createOrdinaryChestChoices } from "../../lib/dungeonChestLoot";
import { COLLECTIBLE_MAP, rollFamilyDrop } from "../../lib/dungeonCollectibles";
import { sfxOpenChest, sfxCoinDrop, sfxSuccess } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

export default function DungeonChest({
  roomId, room, memberId,
  localMode = false, onLocalEffect, onLocalDone,
  isHost = false, onSharedDone,
}) {
  const existingClaim = room?.chestClaims?.[memberId] || null;
  const [animPhase, setAnimPhase]   = useState(existingClaim ? "done" : "entering"); // entering | opening | choices | empty | done
  const [cardState, setCardState]   = useState(existingClaim ? "revealed" : "hidden");   // hidden (背面) | revealing (逐一揭示中) | revealed (完成)
  const [revealedCount, setRevealedCount] = useState(existingClaim ? 3 : 0);    // 1, 2, 3 逐一翻牌計數
  const [chosenIdx, setChosenIdx]   = useState(existingClaim?.choiceIndex ?? null);
  const [claiming, setClaiming]     = useState(false);
  const [confirmedWait, setConfirmedWait] = useState(false);
  const [bonusCollectible, setBonusCollectible] = useState(
    existingClaim?.collectibleItemId ? COLLECTIBLE_MAP[existingClaim.collectibleItemId] || null : null
  );
  const dungeonMapId = room?.mapDungeonId || "";
  const family = dungeonMapId.split("_")[0] || "ghost";
  const isHidden = !!room?.hiddenRoomLoot?.found;
  const [eggType] = useState(() => {
    if (room?.chestEggType) return room.chestEggType;
    const roll = Math.random();
    if (roll < 0.10) return "mimic";
    if (roll < 0.13) return "empty";
    return "normal";
  });
  const [choices] = useState(() =>
    room?.chestChoices || createOrdinaryChestChoices({
      family,
      difficultyTier: room?.expeditionDifficulty || room?.dungeonDifficulty || 1,
      hidden: isHidden,
    })
  );
  const activeMemberIds = Object.entries(room?.members || {})
    .filter(([, member]) => member && member.alive !== false)
    .map(([id]) => id);
  const allConfirmed = activeMemberIds.length > 0
    && activeMemberIds.every(id => room?.roomConfirms?.[id] === true);
  const selectedChoice = chosenIdx === null ? null : choices[chosenIdx];

  // 組隊玩家翻牌完成即標記「已閱讀」，結果頁仍保留；只有房主能推進地圖。
  useEffect(() => {
    if (localMode || animPhase !== "done" || confirmedWait) return;
    setConfirmedWait(true);
    confirmNonCombatRoom(roomId, memberId, "opened").catch(() => {
      setConfirmedWait(false);
    });
  }, [animPhase, confirmedWait, localMode, memberId, roomId]);

  // 開箱動畫
  useEffect(() => {
    if (existingClaim) return undefined;
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
  }, [eggType, existingClaim]);

  // 點擊選擇背面卡片 → 觸發逐一揭示動畫
  async function handleSelectFaceDownCard(index) {
    if (chosenIdx !== null || claiming) return;
    if (!localMode) {
      const claim = await claimTeamDungeonChestChoice(roomId, memberId, index);
      if (!claim.ok) return;
      if (claim.collectible?.itemId) setBonusCollectible(COLLECTIBLE_MAP[claim.collectible.itemId] || null);
    }
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
        if (localMode) {
          if (selected.type === "coins") onLocalEffect?.({ type: "coins", value: selected.value });
          else onLocalEffect?.({ type: "chest_reward", reward: selected });
          setAnimPhase("done");
          return;
        }
        if (selected.type === "coins") {
          const { addCoins } = await import("../../lib/db");
          await addCoins(memberId, selected.value);
        } else if (selected.type === "material" && selected.material) {
          const { addMaterials } = await import("../../lib/db");
          await addMaterials(memberId, Array.from(
            { length:selected.material.quantity || 1 },
            () => selected.material
          ));
        } else if (selected.type === "potion" && selected.potion) {
          const { addPotions } = await import("../../lib/db");
          await addPotions(memberId, [{ id:selected.potion.id, count:selected.potion.quantity || 1 }]);
        } else if (selected.item) {
          const { addCollectibles } = await import("../../lib/dungeonDb");
          await addCollectibles(memberId, [{ itemId: selected.item.id, qty: 1 }]);
        }
        if (localMode) {
          // 單人本地房沒有共享 transaction，仍只判定一次並立即入帳。
          const collectibleDrop = rollFamilyDrop(family, "chest");
          if (collectibleDrop?.itemId) {
            const item = COLLECTIBLE_MAP[collectibleDrop.itemId];
            if (item) {
              const { addCollectibles } = await import("../../lib/dungeonDb");
              await addCollectibles(memberId, [{ ...collectibleDrop, qty: 1 }]);
              setBonusCollectible(item);
            }
          }
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
    if (isHost && allConfirmed) await onSharedDone?.();
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

        {/* 翻牌結束後切換為單一結果頁，只保留實際取得的內容。 */}
        {(animPhase === "empty" || animPhase === "done") && cardState !== "revealing" && (
          <div className="w-full max-w-sm bg-slate-900/95 border border-amber-500/40 p-6 rounded-3xl text-center space-y-4 animate-fade-in shadow-2xl backdrop-blur-md">
              <div className="text-5xl">
              {animPhase === "empty" ? "🍎" : selectedChoice?.icon || "🎉"}
            </div>
            <div>
              <div className="text-base font-black text-amber-300">
                {animPhase === "empty"
                  ? "這是一隻餓鬼留下的空箱，什麼都沒拿到！"
                  : `獲得：${selectedChoice?.title || "寶箱戰利品"}`}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {animPhase === "empty"
                  ? "收拾心情前進下一間房間吧。"
                  : selectedChoice?.desc || "戰利品已加入您的背包與個人資源庫。"}
              </div>
              {bonusCollectible && (
                <div className="mt-3 rounded-2xl border border-purple-400/40 bg-purple-950/40 p-3">
                  <div className="text-[10px] font-black text-purple-300">地下城圖鑑收藏品</div>
                  <div className="mt-1 text-sm font-black text-purple-100">
                    {bonusCollectible.icon || "🏺"} {bonusCollectible.name}
                  </div>
                </div>
              )}
            </div>
            {localMode ? (
              <button type="button" onClick={handleFinish}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-black text-slate-950 shadow-xl transition-all hover:brightness-110 active:scale-95">
                ➡️ 繼續探索下一關
              </button>
            ) : isHost ? (
              <button type="button" onClick={handleFinish} disabled={!allConfirmed}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-black text-slate-950 shadow-xl transition-all enabled:hover:brightness-110 enabled:active:scale-95 disabled:cursor-wait disabled:bg-slate-800 disabled:text-slate-400">
                {allConfirmed ? "➡️ 帶領隊伍繼續探索" : "等待所有隊員領取完成…"}
              </button>
            ) : (
              <div className="w-full rounded-2xl border border-amber-500/30 bg-slate-800 px-4 py-3.5 text-sm font-black text-amber-200">
                ✅ 已完成領取，等待房主進行下一步…
              </div>
            )}
          </div>
        )}
      </div>
    </DungeonEventStage>
  );
}
