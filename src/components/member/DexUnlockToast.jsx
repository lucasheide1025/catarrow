// src/components/member/DexUnlockToast.jsx
// App 層「成就解鎖」即時提示：打怪/練習/裝備任何地方解鎖成就都會跳這個（由 MemberApp 觸發）。
// 點一下 → 前往圖鑑；也會自動消失。多個一起解鎖時顯示「＋N」，代表值取最高稀有度那個。
import { useEffect } from "react";
import { RARITY_STYLE } from "../../lib/achievementDex";
import { sfxSuccess } from "../../lib/sound";

const CSS = `
@keyframes dut-in  { 0%{transform:translate(-50%,80px) scale(.85);opacity:0} 60%{transform:translate(-50%,-6px) scale(1.03)} 100%{transform:translate(-50%,0) scale(1);opacity:1} }
.dut-wrap { animation:dut-in .45s cubic-bezier(.34,1.56,.64,1) both; }
`;

export default function DexUnlockToast({ info, count = 1, onView, onClose }) {
  useEffect(() => {
    try { sfxSuccess(); } catch { /* ignore */ }
    const t = setTimeout(() => onClose && onClose(), 4200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  if (!info) return null;
  const rs = RARITY_STYLE[info.rarity] || RARITY_STYLE.common;

  return (
    <div className="dut-wrap"
      onClick={() => onView && onView()}
      style={{ position:"fixed", bottom:"84px", left:"50%", zIndex:95, width:"min(88vw,340px)", cursor:"pointer" }}>
      <style>{CSS}</style>
      <div style={{
        borderRadius:16, padding:"12px 14px", display:"flex", alignItems:"center", gap:12,
        background:"linear-gradient(135deg,#0f172a,#1e293b)",
        border:`2px solid ${rs.ring}`, boxShadow: rs.glow || "0 8px 24px rgba(0,0,0,.5)",
      }}>
        <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, fontSize:26,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"#1e293b", border:`2px solid ${rs.ring}` }}>
          {info.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:".08em", color: rs.ring }}>
            🎖️ 解鎖新成就{count > 1 ? `（＋${count - 1} 項）` : ""}
          </div>
          <div style={{ fontWeight:900, color:"#fff", fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {info.name}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.55)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {info.desc}
          </div>
        </div>
        <div style={{ fontSize:11, fontWeight:800, color: rs.ring, flexShrink:0 }}>查看 ›</div>
      </div>
    </div>
  );
}
