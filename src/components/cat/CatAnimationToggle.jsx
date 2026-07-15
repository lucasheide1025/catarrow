// src/components/cat/CatAnimationToggle.jsx
// 貓貓動畫開關元件 — 只有教練（admin）看得到
// 放在教練後台的設定區塊中

import { useCatAnimationAccess } from "../../hooks/useCatAnimationAccess";
import { Card } from "../shared/UI";

export default function CatAnimationToggle() {
  const { visible, enabled, toggle } = useCatAnimationAccess();

  // 非教練完全不顯示
  if (!visible) return null;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>
            🐱 貓貓戰鬥動畫
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color:"var(--text-muted)" }}>
            {enabled
              ? "戰鬥中貓貓會對射箭結果做出動態反應"
              : "貓貓在戰鬥中僅顯示靜態圖片"}
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          style={{
            position: "relative",
            width: 48,
            height: 26,
            borderRadius: 13,
            border: "none",
            cursor: "pointer",
            transition: "background .2s",
            background: enabled
              ? "linear-gradient(135deg, #a78bfa, #7c3aed)"
              : "rgba(255,255,255,0.15)",
            flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute",
            top: 3,
            left: enabled ? 24 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            transition: "left .2s cubic-bezier(.34,1.56,.64,1)",
          }} />
        </button>
      </div>
    </Card>
  );
}
