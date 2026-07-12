// 貓咪攻擊回合全螢幕覆蓋層
// open=true 時遮蓋整個畫面，cats=[{ catId, catName, dmg }]

const CSS = `
@keyframes cro-bounce {
  0%   { transform: scale(0.2) translateY(40px); opacity: 0; }
  65%  { transform: scale(1.12) translateY(-10px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes cro-strike {
  0%   { transform: translateY(0) rotate(0deg); }
  30%  { transform: translateY(-28px) rotate(-8deg) scale(1.15); }
  55%  { transform: translateY(8px) rotate(4deg) scale(0.95); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}
@keyframes cro-dmg {
  0%   { transform: scale(0) translateY(8px); opacity: 0; }
  60%  { transform: scale(1.25) translateY(-6px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes cro-title {
  0%   { opacity: 0; transform: scale(0.8) translateY(-8px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
`;

export default function CatRoundOverlay({ open, cats = [], totalDmg }) {
  if (!open || !cats.length) return null;

  const count = cats.length;
  const size  = count === 1 ? 148 : count <= 2 ? 120 : count <= 4 ? 90 : 68;
  const total = totalDmg ?? cats.reduce((s, c) => s + (c.dmg || 0), 0);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(5,0,20,0.92)",
      backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 20, padding: 28,
    }}>
      <style>{CSS}</style>

      {/* 標題 */}
      <div style={{
        fontSize: 20, fontWeight: 900, color: "#f9a8d4",
        letterSpacing: "0.18em", textShadow: "0 0 16px rgba(244,114,182,0.7)",
        animation: "cro-title 0.35s ease both",
      }}>
        🐾 貓咪攻擊！
      </div>

      {/* 貓咪頭像格 */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: count > 4 ? 10 : 16,
        maxWidth: count <= 2 ? (count * (size + 20)) : 360,
      }}>
        {cats.map((cat, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            {/* 頭像 */}
            <div style={{
              width: size, height: size,
              borderRadius: "50%", overflow: "hidden",
              border: "3px solid #f472b6",
              boxShadow: "0 0 28px rgba(244,114,182,0.55), inset 0 0 12px rgba(244,114,182,0.15)",
              animation: `cro-bounce 0.5s cubic-bezier(.34,1.56,.64,1) ${i * 0.1}s both`,
            }}>
              <img
                src={`/cats/portraits/${cat.catId || "baobao"}.webp`}
                alt={cat.catName || "貓貓"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            {/* 貓名 */}
            <div style={{
              color: "#fce7f3", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
              maxWidth: size, textAlign: "center", wordBreak: "break-word",
            }}>
              {cat.catName || "貓貓"}
            </div>
            {/* 傷害 */}
            {cat.dmg > 0 && (
              <div style={{
                color: "#fbbf24", fontSize: 16, fontWeight: 900,
                textShadow: "0 0 8px rgba(251,191,36,0.7)",
                animation: `cro-dmg 0.4s cubic-bezier(.34,1.56,.64,1) ${0.55 + i * 0.08}s both`,
              }}>
                -{cat.dmg}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 合計傷害（多貓才顯示）*/}
      {count > 1 && total > 0 && (
        <div style={{
          color: "#fbbf24", fontSize: 24, fontWeight: 900,
          textShadow: "0 0 12px rgba(251,191,36,0.6)",
          animation: `cro-dmg 0.4s ease ${0.7 + count * 0.08}s both`,
        }}>
          合計 -{total}
        </div>
      )}
    </div>
  );
}
