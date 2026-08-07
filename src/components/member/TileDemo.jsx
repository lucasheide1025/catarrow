// src/components/member/TileDemo.jsx
// 貓貓村探索地圖：格子「動手」演示——挖礦（mining）／採集素材（material）／
// 寶箱（chest）／箭露（arrowdew）。
// 08-08 重做：
//   - 挖礦**不再有三選一**——純動作動畫（ComfyUI 幀），踩到直接播→結算；
//   - 節奏全面放慢（挖礦 2.6s、採集 2.2s）——之前 1.4~1.6s 太快，看不出動作；
//   - 寶箱／箭露沒有 ComfyUI 動作幀，用格子 2.5D 圖 + CSS 演出（搖晃→爆開／水滴升起）。
// 動作幀：/assets/board/action_<mapId>_<dig|gather>_<1..3>.webp
//   dig（挖礦）：舉鋤 → 揮鋤擊中 → 收穫礦石；gather（採集）：伸手 → 摘取 → 收穫。
// onDone()：動畫播完自動結算（無選擇）。onCancel()：跳過動畫直接結算。
import { useState, useEffect } from "react";
import { sfxSuccess, sfxCast, sfxOpenChest, sfxCoinDrop, sfxTap } from "../../lib/sound";

const ASSET = "/assets/board";

// 各 variant 的節奏與文案（duration 刻意拉長，讓動作有「手感」）
const CFG = {
  mining:    { title: "挖礦",     dur: 2600, color: "#fbbf24", bg: "linear-gradient(160deg,#3b2a10,#1c1206)", bd: "rgba(251,191,36,.35)", label: ["舉起鋤頭…", "挖下去了…", "收穫礦石！"] },
  material:  { title: "採集素材", dur: 2200, color: "#4ade80", bg: "linear-gradient(160deg,#103b1c,#0a2311)", bd: "rgba(74,222,128,.35)", label: ["伸出貓掌…", "摘到手了…", "採集完成！"] },
  chest:     { title: "寶箱",     dur: 2400, color: "#fb923c", bg: "linear-gradient(160deg,#3b1d0a,#1c0e04)", bd: "rgba(251,146,60,.4)",  label: ["發現寶箱！", "箱子在動…", "打開了！"] },
  arrowdew:  { title: "箭露",     dur: 2200, color: "#67e8f9", bg: "linear-gradient(160deg,#0a2633,#04141d)", bd: "rgba(103,232,249,.4)", label: ["發現露珠…", "收集箭露…", "裝滿瓶子！"] },
};

export default function TileDemo({ meta, tier, variant = "mining", onDone, onCancel, cancelLabel = "✕ 取消（返回地圖）", zIndex = 138 }) {
  const cfg = CFG[variant] || CFG.mining;
  const [progress, setProgress] = useState(0);

  // 動作動畫三幀（mining/material 用）；chest/arrowdew 用格子圖 + CSS 演出
  const action = variant === "mining" ? "dig" : "gather";
  const frames = [1, 2, 3].map(n => `${ASSET}/action_${meta?.id || "mine"}_${action}_${n}.webp`);
  const frameIndex = progress < 0.35 ? 0 : progress < 0.7 ? 1 : 2;

  // 播放進度：慢節奏三幀動畫（或寶箱/箭露的 CSS 階段）後自動結算
  // ⚠️ 完成後的 onDone 延遲也要在 cleanup 清掉——否則玩家在最後 250ms 按「取消」
  //    元件已卸載，pending timeout 仍會觸發 onDone → 單人版會把玩家取消的格子又結算一次。
  useEffect(() => {
    sfxCast();
    const start = Date.now();
    let doneT = null;
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / cfg.dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(iv);
        if (variant === "chest") { sfxOpenChest(); sfxCoinDrop(); }
        else sfxSuccess();
        doneT = setTimeout(() => onDone(), 250);
      }
    }, 50);
    return () => { clearInterval(iv); if (doneT) clearTimeout(doneT); };
  }, [variant, onDone]); // eslint-disable-line

  // 寶箱：搖晃階段（0~45%）→ 爆開階段（45%+）
  const chestOpening = variant === "chest";
  const chestShake = chestOpening && progress < 0.45;
  // 箭露：水滴升起階段（35%~75%）
  const dewRising = variant === "arrowdew" && progress >= 0.35 && progress < 0.75;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4" style={{ zIndex }}>
      <div className="w-full max-w-sm rounded-3xl border-2 bg-slate-900 p-5 text-center animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]"
        style={{ borderColor: cfg.color }}>
        <div className="text-xs font-black tracking-widest mb-1" style={{ color: cfg.color }}>
          {meta?.icon || "⛏️"} {cfg.title}・{meta?.familyName || ""} {meta?.resourceName || ""}
        </div>

        <div className="py-4">
          <div className={`relative mx-auto w-44 h-44 rounded-3xl overflow-hidden flex items-center justify-center ${chestShake ? "board-chest-shake" : dewRising ? "board-dew-rising" : ""}`}
            style={{ background: cfg.bg, border: `1px solid ${cfg.bd}` }}>
            {(variant === "mining" || variant === "material") ? (
              frames.map((src, i) => (
                <img key={src} src={src} alt=""
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${i === frameIndex ? "opacity-100" : "opacity-0"}`}
                  onError={e => { e.currentTarget.style.display = "none"; }} draggable={false} />
              ))
            ) : (
              <img src={`${ASSET}/tile_${variant}.webp`} alt=""
                className={`absolute inset-0 w-full h-full object-cover ${chestShake ? "scale-110" : ""}`}
                onError={e => { e.currentTarget.style.display = "none"; }} draggable={false} />
            )}
            {chestOpening && progress >= 0.45 && <span className="absolute inset-0 rounded-3xl board-burst" style={{ "--board-fx": "rgba(251,146,60,.9)" }} />}
            {chestOpening && progress >= 0.45 && <span className="absolute -top-2 -right-2 text-2xl board-chest-shake">✨</span>}
            {dewRising && (
              <>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-3xl board-dew-drop">💧</span>
                <span className="absolute bottom-2 left-[20%] text-xl board-dew-drop" style={{ animationDelay: ".3s" }}>💧</span>
                <span className="absolute bottom-2 right-[20%] text-xl board-dew-drop" style={{ animationDelay: ".55s" }}>💧</span>
              </>
            )}
            {progress >= 0.7 && <span className="absolute -top-2 -right-2 text-2xl board-chest-shake">✨</span>}
          </div>

          {/* 進度條 */}
          <div className="mx-auto mt-4 h-2.5 w-3/4 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-100"
              style={{ width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg,${cfg.color},#f59e0b)` }} />
          </div>
          <div className="mt-2 text-xs font-bold" style={{ color: `${cfg.color}b0` }}>
            {cfg.label[frameIndex]}
          </div>
          <div className="mt-1 text-[10px] font-bold text-slate-500">
            {variant === "mining" ? "挖礦不再需要射箭，踩到直接獲得資源" : `踩到${cfg.title}格，直接入袋`}（T{tier}）
          </div>
        </div>

        <button onClick={() => { sfxTap(); onCancel(); }} className="mt-3 w-full py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold active:scale-95">
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
