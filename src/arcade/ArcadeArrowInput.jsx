// src/arcade/ArcadeArrowInput.jsx — 6 箭分數輸入（記分板點選）
// 上方 6 格顯示分數，下方固定記分板直接點選：
// - 點記分板 → 填到「目前游標」格並自動跳到下一格
// - 點上方箭格 → 游標移到該格（可以回頭改）
// - 記分板順序與專案既有計分一致（src/lib/score.js）：X(內十) 最高 → ... → M(脫靶) 最低
// - 值語意：-1 = 未填、0 = M 脫靶、1~10 = 分數、11 = X（內十，計 10 分）
import { useEffect, useState } from "react";
import { sfxTap } from "../lib/sound";

const SCORES = [
  { label: "X", value: 11, x: true },
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
  { label: "M", value: 0, miss: true },
];

export default function ArcadeArrowInput({ count = 6, values, onChange }) {
  // 目前游標（下一個要填的格）。外部重置（回合重設）時回到第一格。
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    // 外部把值清空（新回合）→ 游標回到第一格
    if (values.every((v) => v < 0)) setCursor(0);
  }, [values]);

  // 找「下一個空格」：從游標往後找，找不到從頭找；全滿就停在最後
  function nextEmpty(from) {
    for (let k = 0; k < count; k++) {
      const i = (from + k) % count;
      if (values[i] < 0) return i;
    }
    return from;
  }

  function pick(v) {
    const i = nextEmpty(cursor);
    onChange(i, v);
    sfxTap();
    setCursor((i + 1) % count);
  }

  function focusSlot(i) {
    setCursor(i);
  }

  function slotVal(v) {
    if (v < 0) return "－";      // 未填
    if (v === 11) return "X";    // 內十
    return v;                    // 0(M) 或 1~10
  }

  return (
    <div className="arcade-arrows">
      {/* 上方：6 格顯示 */}
      <div className="arcade-arrow-slots">
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`arcade-arrow-slot ${v > 0 ? (v === 11 ? "x" : "filled") : v === 0 ? "miss" : ""} ${cursor === i ? "current" : ""}`}
            onClick={() => focusSlot(i)}
            aria-label={`第 ${i + 1} 箭${v < 0 ? "：未填" : v === 11 ? "：X 內十" : `：${v} 分`}`}
          >
            <span className="arcade-arrow-idx">{i + 1}</span>
            <span className="arcade-arrow-val">{slotVal(v)}</span>
          </button>
        ))}
      </div>
      {/* 下方：固定記分板（X 最高 → M 最低） */}
      <div className="arcade-scoreboard">
        {SCORES.map((s, i) => {
          const isMiss = s && s.miss;
          const isX = s && s.x;
          const value = s && s.value !== undefined ? s.value : s;
          return (
            <button
              key={i}
              type="button"
              className={`arcade-score-btn ${isX ? "x" : ""} ${isMiss ? "miss" : ""}`}
              onClick={() => pick(value)}
              disabled={values.every((v) => v >= 0)}
            >
              {s && s.label !== undefined ? s.label : s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
