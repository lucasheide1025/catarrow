// src/arcade/ArcadeResultSheet.jsx — 戰鬥結算底部彈出面板（單人／組隊共用，手機原地操作）
// 送出後訊息從底部滑出覆蓋畫面，不推擠版面 → 玩家不用上下捲動。
// result 相容兩種來源：
//   單人：{ log, total, dmg, victory, defeat }
//   組隊：{ log, totalScore, dmg, victory, defeat, adventureDone, comboMult, comboName }
// onNext 省略＝自動推進；單人傳入即顯示「下一回合 →」。
// advance（組隊 BOSS 戰）：{ isHost, hostStale, onAdvance, busy } —— 隊長按「繼續 →」門控推進，
//   隊員顯示等待；隊長離線（hostStale）時隊員可代按。
import React from "react";

export default function BattleResultSheet({ result, roundKey, monsterName, onNext, notes = [], advance = null }) {
  const total = result.total ?? result.totalScore;
  return (
    <div className="arcade-result-sheet" key={roundKey}>
      <div className="arcade-sheet-handle" />
      <div className="arcade-log">
        {result.log.map((l, i) => (
          <div key={i} className={`arcade-log-line kind-${l.kind}`} style={{ animationDelay: `${i * 0.28}s` }}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="arcade-damage">
        💥 {total} 分 → {result.dmg} 傷害
        {result.comboMult > 1 ? `（${result.comboName}）` : ""}
      </div>
      {notes.map((n, i) => (
        <div
          key={i}
          className={`arcade-note${n.style ? "" : ""}`}
          style={n.style ? { marginTop: 10, ...n.style } : { marginTop: 10 }}
        >
          {n.text}
        </div>
      ))}
      <div className="arcade-row" style={{ marginTop: 14 }}>
        {!result.victory && !result.defeat && onNext && (
          <button
            type="button"
            className="arcade-primary green"
            style={{ flex: 1 }}
            onClick={onNext}
          >
            下一回合 →
          </button>
        )}
        {!result.victory && !result.defeat && advance && (
          advance.isHost ? (
            <button
              type="button"
              className="arcade-primary green"
              style={{ flex: 1 }}
              onClick={advance.onAdvance}
              disabled={advance.busy}
            >
              {advance.busy ? "推進中…" : "繼續 →"}
            </button>
          ) : advance.hostStale ? (
            <button
              type="button"
              className="arcade-primary"
              style={{ flex: 1 }}
              onClick={advance.onAdvance}
              disabled={advance.busy}
            >
              {advance.busy ? "推進中…" : "⚡ 隊長離線，點擊繼續"}
            </button>
          ) : (
            <div className="arcade-note" style={{ flex: 1, textAlign: "center", marginTop: 0 }}>
              👑 等待隊長繼續…
            </div>
          )
        )}
        {(result.victory || result.defeat || result.adventureDone) && (
          <div className="arcade-row" style={{ width: "100%" }}>
            {result.adventureDone && <div className="arcade-result-banner win">🏆 冒險完成！</div>}
            {result.victory && <div className="arcade-result-banner win">🎉 擊敗 {monsterName}！</div>}
            {result.defeat && <div className="arcade-result-banner lose">💀 貓咪與你都倒下了…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
